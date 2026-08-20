import { describe, expect, test } from "vitest";
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

	test("captures the claimed active tab and re-verifies it after cropping", async () => {
		const events: string[] = [];
		const crop = async (dataUrl: string, rect: { x: number }) => {
			events.push(`crop:${dataUrl}:${rect.x}`);
			return Uint8Array.from([0xff, 0xd8, 0xff]);
		};
		const driver = new ChromeTabDriver(fakeGateway(events), { wait: async () => undefined, captureCroppedJpeg: crop });
		const tab = await driver.open(claimedTask());

		await expect(tab.captureEvidence({ x: 10, y: 20, width: 100, height: 80, devicePixelRatio: 1 })).resolves.toEqual(
			Uint8Array.from([0xff, 0xd8, 0xff]),
		);
		expect(events).toContain("capture:7:jpeg:82");
		expect(events).toContain("crop:data:image/jpeg;base64,fixture:10");
		expect(events.filter((event) => event === "get:42")).toHaveLength(4);
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

function fakeGateway(events: string[], options: { url?: string; response?: unknown } = {}): ChromeTabsGateway {
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
		captureVisibleTab: async (windowId, captureOptions) => {
			events.push(`capture:${windowId}:${captureOptions.format}:${captureOptions.quality}`);
			return "data:image/jpeg;base64,fixture";
		},
		sendMessage: async (tabId, command) => {
			events.push(`message:${tabId}:${command.action}`);
			return options.response ?? { ok: true, value: undefined };
		},
	};
}
