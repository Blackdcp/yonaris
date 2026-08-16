import { describe, expect, test } from "vitest";
import { DeviceStorage, type ExtensionStorageArea } from "../storage";
import { ExtensionCoordinator } from "./extension-coordinator";
import { DurableTaskJournal } from "./journal";
import { claimedTask, fakeAdapter, fakeRunnerApi, fakeTabDriver } from "./test-fixture";

describe("ExtensionCoordinator", () => {
	test("polls every paired brand across both approved channels", async () => {
		const storage = new DeviceStorage(memoryStorage());
		await storage.saveDevice({
			portalBaseUrl: "https://portal.yonaris.com",
			deviceId: "device-1",
			deviceToken: `yrd_${"a".repeat(43)}`,
			allowedBrandIds: ["stepfun", "customer-2"],
		});
		const claims: string[] = [];
		const api = {
			...fakeRunnerApi([]),
			claimNext: async (brandId: string, surface: string) => {
				claims.push(`${brandId}:${surface}`);
				return null;
			},
			resume: async () => claimedTask(),
		};
		const coordinator = new ExtensionCoordinator({
			storage,
			apiFactory: () => api,
			tabs: fakeTabDriver([], fakeAdapter([])),
			browserVersion: "Chrome/140",
		});

		await coordinator.runOnce();
		expect(new Set(claims)).toEqual(
			new Set([
				"stepfun:doubao.consumer_web",
				"customer-2:doubao.consumer_web",
				"stepfun:deepseek.consumer_web",
				"customer-2:deepseek.consumer_web",
			]),
		);
	});

	test("resumes an already-submitted task in the same local tab without submitting again", async () => {
		const events: string[] = [];
		const storage = new DeviceStorage(memoryStorage());
		await storage.saveDevice({
			portalBaseUrl: "https://portal.yonaris.com",
			deviceId: "device-1",
			deviceToken: `yrd_${"a".repeat(43)}`,
			allowedBrandIds: ["stepfun"],
		});
		const journal = new DurableTaskJournal(storage);
		await journal.start(claimedTask(), {
			tabId: 42,
			runnerSessionId: "session-1",
			promptSha256: await sha256("Prompt A"),
		});
		await journal.advance("task-1", "submit_intent");
		const api = {
			...fakeRunnerApi(events),
			claimNext: async () => null,
			resume: async () => claimedTask({ postSubmitAssist: true, submitConfirmed: true, runnerSessionId: "session-1" }),
		};
		const coordinator = new ExtensionCoordinator({
			storage,
			apiFactory: () => api,
			tabs: fakeTabDriver(events, fakeAdapter(events)),
			browserVersion: "Chrome/140",
		});

		await coordinator.runOnce();
		expect(events).not.toContain("adapter:submit");
		expect(events).toContain("adapter:confirm");
		expect(events).toContain("api:complete");
		expect(await journal.entries()).toEqual({});
	});
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

async function sha256(value: string): Promise<string> {
	const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
	return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
