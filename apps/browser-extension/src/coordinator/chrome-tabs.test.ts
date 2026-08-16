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

		expect(events[0]).toBe("create:https://chat.deepseek.com/");
		expect(events).toContain("message:42:preflight");
		expect(events).toContain("message:42:open_new_conversation");
		expect(events).toContain("message:42:submit_once");
		expect(events.at(-1)).toBe("remove:42");
	});

	test("rejects a recovered tab that has navigated outside the claimed channel", async () => {
		const gateway = fakeGateway([], { url: "https://example.com/" });
		const driver = new ChromeTabDriver(gateway, { wait: async () => undefined });
		await expect(driver.attach(42, "deepseek.consumer_web")).rejects.toThrow(/approved channel/i);
	});

	test("maps structured content adapter errors without leaking page content", async () => {
		const gateway = fakeGateway([], {
			response: { ok: false, error: { code: "captcha", stage: "pre_submit", message: "Verification required" } },
		});
		const driver = new ChromeTabDriver(gateway, { wait: async () => undefined });
		const tab = await driver.open(claimedTask());
		await expect(tab.adapter.preflight()).rejects.toMatchObject({ code: "captcha", stage: "pre_submit" });
	});
});

function fakeGateway(events: string[], options: { url?: string; response?: unknown } = {}): ChromeTabsGateway {
	return {
		create: async (url) => {
			events.push(`create:${url}`);
			return { id: 42, url: options.url ?? url, status: "complete" };
		},
		get: async () => ({ id: 42, url: options.url ?? "https://chat.deepseek.com/", status: "complete" }),
		remove: async (tabId) => {
			events.push(`remove:${tabId}`);
		},
		sendMessage: async (tabId, command) => {
			events.push(`message:${tabId}:${command.action}`);
			return options.response ?? { ok: true, value: undefined };
		},
	};
}
