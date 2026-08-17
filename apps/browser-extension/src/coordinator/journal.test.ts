import { describe, expect, test } from "vitest";
import { DeviceStorage, type ExtensionStorageArea } from "../storage";
import { DurableTaskJournal } from "./journal";
import { claimedTask } from "./test-fixture";

describe("DurableTaskJournal", () => {
	test("persists only execution metadata and advances phases monotonically", async () => {
		const storage = new DeviceStorage(memoryStorage());
		const journal = new DurableTaskJournal(storage);
		await journal.start(claimedTask(), {
			tabId: 42,
			runnerSessionId: "session-1",
			promptSha256: "a".repeat(64),
		});
		await journal.advance("task-1", "prepared");
		await journal.advance("task-1", "submit_intent");

		await expect(journal.advance("task-1", "prepared")).rejects.toThrow(/phase/i);
		const serialized = JSON.stringify(await storage.dump());
		expect(serialized).toContain("submit_intent");
		expect(serialized).not.toContain("answerText");
		expect(serialized).not.toContain("answerHtml");
		expect(serialized).not.toContain("leaseToken");
	});

	test("does not let a concurrent lower phase overwrite post-submit intent", async () => {
		const storage = new DeviceStorage(memoryStorage());
		const journal = new DurableTaskJournal(storage);
		await journal.start(claimedTask(), {
			tabId: 42,
			runnerSessionId: "session-1",
			promptSha256: "a".repeat(64),
		});

		const results = await Promise.allSettled([
			journal.advance("task-1", "submit_intent"),
			journal.advance("task-1", "prepared"),
		]);

		expect(results[0]).toMatchObject({ status: "fulfilled" });
		expect(results[1]).toMatchObject({ status: "rejected" });
		await expect(journal.entries()).resolves.toMatchObject({ "task-1": { phase: "submit_intent" } });
	});

	test("allows only one concurrent start for the same task", async () => {
		const storage = new DeviceStorage(memoryStorage());
		const journal = new DurableTaskJournal(storage);
		const startInput = {
			tabId: 42,
			runnerSessionId: "session-1",
			promptSha256: "a".repeat(64),
		};

		const results = await Promise.allSettled([
			journal.start(claimedTask(), startInput),
			journal.start(claimedTask(), startInput),
		]);

		expect(results.map(({ status }) => status)).toEqual(["fulfilled", "rejected"]);
		await expect(journal.entries()).resolves.toMatchObject({ "task-1": { phase: "claimed" } });
	});

	test("honors a remove requested while the same task is starting", async () => {
		const storage = new DeviceStorage(memoryStorage());
		const journal = new DurableTaskJournal(storage);

		await Promise.all([
			journal.start(claimedTask(), {
				tabId: 42,
				runnerSessionId: "session-1",
				promptSha256: "a".repeat(64),
			}),
			journal.remove("task-1"),
		]);

		await expect(journal.entries()).resolves.toEqual({});
	});

	test("records the interrupted phase when a task stops for human review", async () => {
		const storage = new DeviceStorage(memoryStorage());
		const journal = new DurableTaskJournal(storage);
		await journal.start(claimedTask(), {
			tabId: 42,
			runnerSessionId: "session-1",
			promptSha256: "a".repeat(64),
		});
		await journal.advance("task-1", "submit_intent");

		await journal.advance("task-1", "needs_human");

		await expect(journal.entries()).resolves.toMatchObject({
			"task-1": { phase: "needs_human", interruptedPhase: "submit_intent" },
		});
	});

	test("refuses to resume a pre-submit needs-human entry", async () => {
		const storage = new DeviceStorage(memoryStorage());
		const journal = new DurableTaskJournal(storage);
		await journal.start(claimedTask(), {
			tabId: 42,
			runnerSessionId: "session-1",
			promptSha256: "a".repeat(64),
		});
		await journal.advance("task-1", "prepared");
		await journal.advance("task-1", "needs_human");

		await expect(journal.resumePostSubmit("task-1")).rejects.toThrow(/post-submit/i);
		await expect(journal.entries()).resolves.toMatchObject({
			"task-1": { phase: "needs_human", interruptedPhase: "prepared" },
		});
	});

	test("re-arms an exact pre-submit needs-human entry without losing its original tab", async () => {
		const storage = new DeviceStorage(memoryStorage());
		const journal = new DurableTaskJournal(storage);
		await journal.start(claimedTask(), {
			tabId: 42,
			runnerSessionId: "session-1",
			promptSha256: "a".repeat(64),
		});
		await journal.advance("task-1", "prepared");
		await journal.advance("task-1", "needs_human");

		await expect(journal.resumePreSubmit("task-1")).resolves.toMatchObject({
			phase: "claimed",
			tabId: 42,
			runnerSessionId: "session-1",
		});
	});

	test("never re-arms a post-submit needs-human entry as pre-submit", async () => {
		const storage = new DeviceStorage(memoryStorage());
		const journal = new DurableTaskJournal(storage);
		await journal.start(claimedTask(), {
			tabId: 42,
			runnerSessionId: "session-1",
			promptSha256: "a".repeat(64),
		});
		await journal.advance("task-1", "submit_intent");
		await journal.advance("task-1", "needs_human");

		await expect(journal.resumePreSubmit("task-1")).rejects.toThrow(/pre-submit/i);
	});

	test("records a server-confirmed boundary for a legacy needs-human entry", async () => {
		const storage = new DeviceStorage(memoryStorage());
		const journal = new DurableTaskJournal(storage);
		await journal.start(claimedTask(), {
			tabId: 42,
			runnerSessionId: "session-1",
			promptSha256: "a".repeat(64),
		});
		await journal.advance("task-1", "needs_human");

		await journal.markPostSubmitBoundary("task-1", "submitted");

		await expect(journal.entries()).resolves.toMatchObject({
			"task-1": { phase: "needs_human", interruptedPhase: "submitted" },
		});
	});

	test.each([
		{ localPhase: "claimed" as const, serverStage: "pre_submit" as const, interruptedPhase: "claimed" },
		{ localPhase: "prepared" as const, serverStage: "pre_submit" as const, interruptedPhase: "prepared" },
		{ localPhase: "prepared" as const, serverStage: "post_submit" as const, interruptedPhase: "submit_intent" },
		{ localPhase: "submit_intent" as const, serverStage: "pre_submit" as const, interruptedPhase: "claimed" },
	])(
		"aligns local $localPhase with a server-authoritative $serverStage handoff",
		async ({ localPhase, serverStage, interruptedPhase }) => {
			const storage = new DeviceStorage(memoryStorage());
			const journal = new DurableTaskJournal(storage);
			await journal.start(claimedTask(), {
				tabId: 42,
				runnerSessionId: "session-1",
				promptSha256: "a".repeat(64),
			});
			if (localPhase !== "claimed") await journal.advance("task-1", localPhase);

			await journal.alignNeedsHuman("task-1", serverStage);

			await expect(journal.entries()).resolves.toMatchObject({
				"task-1": { phase: "needs_human", interruptedPhase, tabId: 42 },
			});
		},
	);
});

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
