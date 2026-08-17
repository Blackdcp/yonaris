import { describe, expect, test } from "vitest";
import { AdapterError } from "../adapters/contracts";
import { DeviceStorage, type ExtensionStorageArea } from "../storage";
import { DurableTaskJournal } from "./journal";
import { RunnerTabOpenError, runClaimedTask } from "./task-runner";
import { claimedTask, fakeAdapter, fakeRunnerApi, fakeTabDriver } from "./test-fixture";

describe("runClaimedTask", () => {
	test("durably records submit intent before clicking the consumer page", async () => {
		const events: string[] = [];
		const dependencies = fixtureDependencies(events);

		await expect(runClaimedTask(claimedTask(), dependencies)).resolves.toMatchObject({ status: "succeeded" });
		expect(events.indexOf("journal:submit_intent")).toBeLessThan(events.indexOf("api:submit_intent"));
		expect(events.indexOf("api:submit_intent")).toBeLessThan(events.indexOf("adapter:submit"));
		expect(events.filter((event) => event === "adapter:submit")).toHaveLength(1);
	});

	test("a durable submit intent prevents automatic resubmission after restart", async () => {
		const events: string[] = [];
		const dependencies = fixtureDependencies(events);
		await dependencies.journal.start(claimedTask(), {
			tabId: 42,
			runnerSessionId: "session-1",
			promptSha256: await sha256("Prompt A"),
		});
		await dependencies.journal.advance("task-1", "submit_intent");

		await expect(runClaimedTask(claimedTask(), dependencies)).resolves.toMatchObject({ status: "needs_human" });
		expect(events).not.toContain("adapter:submit");
		expect(events).toContain("api:needs_human");
	});

	test("resumes an uploaded post-submit task from the same tab without moving the journal backwards illegally", async () => {
		const events: string[] = [];
		const dependencies = fixtureDependencies(events);
		const claim = claimedTask({ postSubmitAssist: true, submitConfirmed: true, runnerSessionId: "session-1" });
		await dependencies.journal.start(claim, {
			tabId: 42,
			runnerSessionId: "session-1",
			promptSha256: await sha256("Prompt A"),
		});
		await dependencies.journal.advance("task-1", "submit_intent");
		await dependencies.journal.advance("task-1", "uploaded");

		await expect(runClaimedTask(claim, dependencies)).resolves.toEqual({ status: "succeeded" });
		expect(events).not.toContain("adapter:submit");
		expect(events).toContain("api:complete");
	});

	test("successful acceptance removes local answer state and closes the tab", async () => {
		const events: string[] = [];
		const dependencies = fixtureDependencies(events);
		await runClaimedTask(claimedTask(), dependencies);

		expect(await dependencies.journal.entries()).toEqual({});
		expect(events).toContain("api:complete");
		expect(events.at(-1)).toBe("tab:close");
	});

	test("pre-submit navigation failure is offered once to the server retry policy", async () => {
		const events: string[] = [];
		const dependencies = fixtureDependencies(events, { openFailure: new Error("navigation timeout") });

		await expect(runClaimedTask(claimedTask(), dependencies)).resolves.toMatchObject({ status: "retry_scheduled" });
		expect(events).toContain("api:retry:page_load_timeout");
		expect(await dependencies.journal.entries()).toEqual({});
	});

	test("a first-open page drift journals the created tab before waiting for an administrator", async () => {
		const events: string[] = [];
		const storage = new DeviceStorage(memoryStorage());
		const journal = new DurableTaskJournal(storage);
		const adapter = fakeAdapter(events);
		const preservedTab = {
			tabId: 42,
			adapter,
			close: async () => {
				events.push("tab:close");
			},
		};
		const tabs = fakeTabDriver(events, adapter);
		tabs.open = async () => {
			throw new RunnerTabOpenError(
				preservedTab,
				new AdapterError("page_drift", "pre_submit", "Initial page left the approved channel"),
			);
		};

		await expect(
			runClaimedTask(claimedTask(), {
				api: fakeRunnerApi(events),
				journal,
				tabs,
				browserVersion: "Chrome/140",
				randomSessionId: () => "session-1",
			}),
		).resolves.toEqual({ status: "needs_human", code: "page_drift" });
		expect(events).not.toContain("tab:close");
		await expect(journal.entries()).resolves.toMatchObject({
			"task-1": { phase: "needs_human", interruptedPhase: "claimed", tabId: 42 },
		});
	});

	test("a recovered tab that left the approved surface remains an exact needs-human task", async () => {
		const events: string[] = [];
		const storage = new DeviceStorage(memoryStorage());
		const journal = new DurableTaskJournal(storage);
		const claim = claimedTask();
		await journal.start(claim, {
			tabId: 42,
			runnerSessionId: "session-1",
			promptSha256: await sha256(claim.promptText),
		});
		const tabs = fakeTabDriver(events, fakeAdapter(events));
		tabs.attach = async () => {
			throw new AdapterError("page_drift", "pre_submit", "Preserved tab left the approved channel");
		};

		await expect(
			runClaimedTask(claim, {
				api: fakeRunnerApi(events),
				journal,
				tabs,
				browserVersion: "Chrome/140",
			}),
		).resolves.toEqual({ status: "needs_human", code: "page_drift" });
		expect(events).not.toContain("api:retry:page_load_timeout");
		expect(events).not.toContain("tab:close");
		await expect(journal.entries()).resolves.toMatchObject({
			"task-1": { phase: "needs_human", interruptedPhase: "claimed", tabId: 42 },
		});
	});

	test("post-submit collection failure never submits again and preserves the tab for recovery", async () => {
		const events: string[] = [];
		const dependencies = fixtureDependencies(events, { collectFailure: new Error("page drift") });

		await expect(runClaimedTask(claimedTask(), dependencies)).resolves.toMatchObject({ status: "needs_human" });
		expect(events.filter((event) => event === "adapter:submit")).toHaveLength(1);
		expect(events).toContain("api:needs_human");
		expect(events).not.toContain("tab:close");
	});

	test.each(["signed_out", "captcha", "page_drift", "account_restricted"] as const)(
		"preserves the exact tab when %s stops before submit",
		async (code) => {
			const events: string[] = [];
			const storage = new DeviceStorage(memoryStorage());
			const journal = new DurableTaskJournal(storage);
			const adapter = fakeAdapter(events);
			adapter.preflight = async () => {
				events.push("adapter:preflight");
				throw new AdapterError(code, "pre_submit", `${code} requires an administrator`);
			};

			await expect(
				runClaimedTask(claimedTask(), {
					api: fakeRunnerApi(events),
					journal,
					tabs: fakeTabDriver(events, adapter),
					browserVersion: "Chrome/140",
					randomSessionId: () => "session-1",
				}),
			).resolves.toEqual({ status: "needs_human", code });

			expect(events).not.toContain("adapter:submit");
			expect(events).not.toContain("tab:close");
			await expect(journal.entries()).resolves.toMatchObject({
				"task-1": { phase: "needs_human", interruptedPhase: "claimed", tabId: 42 },
			});
		},
	);

	test("durable submit intent forces an adapter-reported pre-submit error into post-submit recovery", async () => {
		const events: string[] = [];
		const storage = new DeviceStorage(memoryStorage());
		const journal = new DurableTaskJournal(storage, (phase) => events.push(`journal:${phase}`));
		const adapter = fakeAdapter(events);
		adapter.submitOnce = async () => {
			events.push("adapter:submit");
			throw new AdapterError("page_drift", "pre_submit", "send button changed after durable intent");
		};
		const failures: Array<{ stage: string; code: string }> = [];
		const api = fakeRunnerApi(events);
		api.failTask = async (_claim, failure) => {
			failures.push(failure);
			return { retryScheduled: false };
		};

		const result = await runClaimedTask(claimedTask(), {
			api,
			journal,
			tabs: fakeTabDriver(events, adapter),
			browserVersion: "Chrome/140",
			randomSessionId: () => "session-1",
		});

		expect(result).toEqual({ status: "needs_human", code: "page_drift" });
		expect(failures).toMatchObject([{ stage: "post_submit", code: "page_drift" }]);
		expect(events).not.toContain("tab:close");
	});

	test("does not report a centrally completed task as failed when local journal cleanup is blocked", async () => {
		const events: string[] = [];
		const values: Record<string, unknown> = {};
		const storage = new DeviceStorage({
			get: async () => ({ ...values }),
			set: async (items) => {
				Object.assign(values, items);
			},
			remove: async () => {
				throw new Error("local storage cleanup blocked");
			},
		});
		const result = await runClaimedTask(claimedTask(), {
			api: fakeRunnerApi(events),
			journal: new DurableTaskJournal(storage),
			tabs: fakeTabDriver(events, fakeAdapter(events)),
			browserVersion: "Chrome/140",
		});

		expect(result).toEqual({ status: "succeeded" });
		expect(events).toContain("api:complete");
		expect(events).not.toContain("api:needs_human");
		expect(events).toContain("tab:close");
	});
});

function fixtureDependencies(
	events: string[],
	options: { openFailure?: Error; collectFailure?: Error } = {},
): Parameters<typeof runClaimedTask>[1] {
	const storage = new DeviceStorage(memoryStorage());
	const journal = new DurableTaskJournal(storage, (phase) => events.push(`journal:${phase}`));
	return {
		api: fakeRunnerApi(events),
		journal,
		tabs: fakeTabDriver(events, fakeAdapter(events, options.collectFailure), options.openFailure),
		browserVersion: "Chrome/140",
		randomSessionId: () => "session-1",
	};
}

function memoryStorage(): ExtensionStorageArea {
	const values: Record<string, unknown> = {};
	return {
		get: async () => ({ ...values }),
		set: async (items) => {
			Object.assign(values, items);
		},
		remove: async (keys) => {
			for (const key of Array.isArray(keys) ? keys : [keys]) delete values[key];
		},
	};
}

async function sha256(value: string): Promise<string> {
	const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
	return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
