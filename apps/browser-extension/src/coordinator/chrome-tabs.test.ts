import { describe, expect, test } from "vitest";
import { BROWSER_EXTENSION_SURFACES } from "../contracts";
import { extensionSurfaceDefinition } from "../surface-registry";
import { ChromeTabDriver, type ChromeTabsGateway } from "./chrome-tabs";
import { claimedTask } from "./test-fixture";

describe("ChromeTabDriver", () => {
	test("opens the exact frozen consumer URL and invokes the content adapter", async () => {
		const events: string[] = [];
		const gateway = fakeGateway(events);
		const driver = new ChromeTabDriver(gateway, { wait: async () => undefined });
		const tab = await driver.open(claimedTask());

		await tab.adapter.preflight();
		await tab.adapter.openNewConversation();
		await tab.adapter.prepare("Prompt A");
		await tab.adapter.submitOnce("Prompt A");
		await tab.close();

		expect(events[0]).toBe("create:https://chat.deepseek.com/:active=true");
		expect(events).toContain("message:42:preflight");
		expect(events).toContain("message:42:open_new_conversation");
		expect(events).toContain("message:42:submit_once");
		expect(events.at(-1)).toBe("remove:42");
	});

	test("opens and accepts the exact registered URL for every domestic surface", async () => {
		for (const surface of BROWSER_EXTENSION_SURFACES) {
			const events: string[] = [];
			const definition = extensionSurfaceDefinition(surface);
			const driver = new ChromeTabDriver(fakeGateway(events, { url: definition.launchUrl }), {
				wait: async () => undefined,
			});
			const tab = await driver.open(
				claimedTask({
					surfaceTargetKey: surface,
					captureRouteKey: definition.captureRoute,
					launchUrl: definition.launchUrl,
				}),
			);

			expect(tab.adapter.surface).toBe(surface);
			expect(tab.adapter.launchUrl).toBe(definition.launchUrl);
			expect(events[0]).toBe(`create:${definition.launchUrl}:active=true`);
		}
	});

	test("captures every planned answer frame and re-verifies the active tab", async () => {
		const events: string[] = [];
		const crop = async (dataUrl: string, rect: { x: number }) => {
			events.push(`crop:${dataUrl}:${rect.x}`);
			return Uint8Array.from([0xff, 0xd8, 0xff]);
		};
		const gateway = fakeGateway(events, {
			onMessage: (_tabId, command) => {
				if (command.action === "begin_evidence_capture") {
					return {
						ok: true,
						value: {
							sessionId: "capture-1",
							index: 0,
							expectedSegmentCount: 2,
							overlapTopCssPx: 0,
							rect: { x: 10, y: 20, width: 100, height: 80, devicePixelRatio: 1 },
							done: false,
						},
					};
				}
				if (command.action === "advance_evidence_capture") {
					return {
						ok: true,
						value: {
							sessionId: "capture-1",
							index: 1,
							expectedSegmentCount: 2,
							overlapTopCssPx: 64,
							rect: { x: 10, y: 20, width: 100, height: 80, devicePixelRatio: 1 },
							done: true,
						},
					};
				}
				return { ok: true, value: undefined };
			},
		});
		const driver = new ChromeTabDriver(gateway, {
			wait: async (milliseconds) => {
				events.push(`wait:${milliseconds}`);
			},
			captureCroppedJpeg: crop,
			composeEvidenceJpeg: async () => Uint8Array.from([0xff, 0xd8, 0xff, 0x01]),
		});
		const tab = await driver.open(claimedTask());

		await expect(
			tab.captureEvidence("Prompt A", { x: 10, y: 20, width: 100, height: 80, devicePixelRatio: 1 }),
		).resolves.toEqual({
			expectedSegmentCount: 2,
			segments: [
				{ bytes: Uint8Array.from([0xff, 0xd8, 0xff]), overlapTopCssPx: 0, devicePixelRatio: 1 },
				{ bytes: Uint8Array.from([0xff, 0xd8, 0xff]), overlapTopCssPx: 64, devicePixelRatio: 1 },
			],
			composite: Uint8Array.from([0xff, 0xd8, 0xff, 0x01]),
		});
		expect(events.filter((event) => event === "capture:7:jpeg:82")).toHaveLength(2);
		expect(events).toContain("crop:data:image/jpeg;base64,fixture:10");
		expect(events).toContain("wait:500");
		expect(events).toContain("message:42:end_evidence_capture");
		expect(events.filter((event) => event === "get:42")).toHaveLength(7);
	});

	test("ends the page capture session when a frame cannot be cropped", async () => {
		const events: string[] = [];
		const gateway = fakeGateway(events, {
			onMessage: (_tabId, command) =>
				command.action === "begin_evidence_capture"
					? {
							ok: true,
							value: {
								sessionId: "capture-1",
								index: 0,
								expectedSegmentCount: 1,
								overlapTopCssPx: 0,
								rect: { x: 10, y: 20, width: 100, height: 80, devicePixelRatio: 1 },
								done: true,
							},
						}
					: { ok: true, value: undefined },
		});
		const driver = new ChromeTabDriver(gateway, {
			wait: async () => undefined,
			captureCroppedJpeg: async () => {
				throw new Error("crop failed");
			},
		});
		const tab = await driver.open(claimedTask());

		await expect(
			tab.captureEvidence("Prompt A", { x: 10, y: 20, width: 100, height: 80, devicePixelRatio: 1 }),
		).rejects.toThrow("crop failed");
		expect(events.at(-1)).toBe("message:42:end_evidence_capture");
	});

	test("rejects a recovered tab that has navigated outside the claimed channel", async () => {
		const gateway = fakeGateway([], { url: "https://example.com/" });
		const driver = new ChromeTabDriver(gateway, { wait: async () => undefined });
		await expect(driver.attach(42, "deepseek.consumer_web")).rejects.toMatchObject({
			code: "page_drift",
			stage: "pre_submit",
		});
	});

	test("returns the newly-created tab handle when initial navigation leaves the claimed channel", async () => {
		const gateway = fakeGateway([], { url: "https://example.com/" });
		const driver = new ChromeTabDriver(gateway, { wait: async () => undefined });

		await expect(driver.open(claimedTask())).rejects.toMatchObject({
			name: "RunnerTabOpenError",
			tab: { tabId: 42 },
			cause: { code: "page_drift", stage: "pre_submit" },
		});
	});

	test("activates the preserved tab before an administrator resumes it", async () => {
		const events: string[] = [];
		const driver = new ChromeTabDriver(fakeGateway(events), { wait: async () => undefined });

		await driver.activate(42);

		expect(events).toContain("activate:42");
	});

	test("rebinds manual recovery to the active approved consumer tab", async () => {
		const events: string[] = [];
		const driver = new ChromeTabDriver(
			fakeGateway(events, {
				activeTab: { id: 84, url: "https://yuanbao.tencent.com/chat/workspace/thread", status: "complete" },
			}),
			{ wait: async () => undefined },
		);

		await expect(driver.resolveManualRecoveryTab(42, "yuanbao.consumer_web")).resolves.toBe(84);
		expect(events).toContain("query:active-approved-tab");
	});

	test("falls back to the preserved tab when the active tab belongs to another channel", async () => {
		const events: string[] = [];
		const driver = new ChromeTabDriver(
			fakeGateway(events, {
				activeTab: { id: 84, url: "https://example.com/", status: "complete" },
			}),
			{ wait: async () => undefined },
		);

		await expect(driver.resolveManualRecoveryTab(42, "deepseek.consumer_web")).resolves.toBe(42);
		expect(events).toContain("get:42");
	});

	test("maps structured content adapter errors without leaking page content", async () => {
		const gateway = fakeGateway([], {
			response: { ok: false, error: { code: "captcha", stage: "pre_submit", message: "Verification required" } },
		});
		const driver = new ChromeTabDriver(gateway, { wait: async () => undefined });
		const tab = await driver.open(claimedTask());
		await expect(tab.adapter.preflight()).rejects.toMatchObject({ code: "captcha", stage: "pre_submit" });
	});

	test("preserves an explicit account restriction as a fail-closed adapter code", async () => {
		const gateway = fakeGateway([], {
			response: {
				ok: false,
				error: { code: "account_restricted", stage: "pre_submit", message: "Consumer account is restricted" },
			},
		});
		const driver = new ChromeTabDriver(gateway, { wait: async () => undefined });
		const tab = await driver.open(claimedTask());
		await expect(tab.adapter.preflight()).rejects.toMatchObject({
			code: "account_restricted",
			stage: "pre_submit",
		});
	});
});

function fakeGateway(
	events: string[],
	options: {
		url?: string;
		response?: unknown;
		activeTab?: { id: number; url: string; status: string };
		onMessage?: (tabId: number, command: Parameters<ChromeTabsGateway["sendMessage"]>[1]) => unknown;
	} = {},
): ChromeTabsGateway {
	return {
		create: async (url, createOptions?: { active: boolean }) => {
			events.push(`create:${url}:active=${String(createOptions?.active)}`);
			return { id: 42, url: options.url ?? url, status: "complete" };
		},
		get: async () => {
			events.push("get:42");
			return {
				id: 42,
				windowId: 7,
				active: true,
				url: options.url ?? "https://chat.deepseek.com/",
				status: "complete",
			};
		},
		remove: async (tabId) => {
			events.push(`remove:${tabId}`);
		},
		activate: async (tabId) => {
			events.push(`activate:${tabId}`);
		},
		query: async () => {
			events.push("query:active-approved-tab");
			return options.activeTab ? [options.activeTab] : [];
		},
		captureVisibleTab: async (windowId, captureOptions) => {
			events.push(`capture:${windowId}:${captureOptions.format}:${captureOptions.quality}`);
			return "data:image/jpeg;base64,fixture";
		},
		sendMessage: async (tabId, command) => {
			events.push(`message:${tabId}:${command.action}`);
			if (options.onMessage) return options.onMessage(tabId, command);
			return options.response ?? { ok: true, value: undefined };
		},
	};
}
