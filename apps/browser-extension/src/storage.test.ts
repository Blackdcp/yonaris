import { describe, expect, it } from "vitest";
import { DeviceStorage, type ExtensionStorageArea } from "./storage";

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

describe("DeviceStorage", () => {
	it("persists the paired device configuration in local extension storage", async () => {
		const storage = new DeviceStorage(memoryStorage());
		await storage.saveDevice({
			portalBaseUrl: "https://portal.yonaris.com",
			deviceId: "device-1",
			deviceToken: `yrd_${"a".repeat(43)}`,
			allowedBrandIds: ["stepfun"],
		});

		await expect(storage.loadDevice()).resolves.toMatchObject({ deviceId: "device-1", allowedBrandIds: ["stepfun"] });
	});

	it("stores only task journal metadata and strips response content", async () => {
		const storage = new DeviceStorage(memoryStorage());
		await storage.saveJournal({
			taskId: "task-1",
			phase: "submitted",
			surfaceTargetKey: "doubao.consumer_web",
			updatedAt: "2026-08-16T00:00:00.000Z",
			answerText: "must never persist",
		} as never);

		const serialized = JSON.stringify(await storage.dump());
		expect(serialized).toContain("task-1");
		expect(serialized).not.toContain("must never persist");
		expect(serialized).not.toContain("answerText");
	});

	it("clears the device secret and journal on explicit disconnect", async () => {
		const storage = new DeviceStorage(memoryStorage());
		await storage.saveDevice({
			portalBaseUrl: "https://portal.yonaris.com",
			deviceId: "device-1",
			deviceToken: `yrd_${"a".repeat(43)}`,
			allowedBrandIds: ["stepfun"],
		});
		await storage.saveJournal({
			taskId: "task-1",
			phase: "claimed",
			surfaceTargetKey: "deepseek.consumer_web",
			updatedAt: "2026-08-16T00:00:00.000Z",
		});

		await storage.disconnect();
		expect(await storage.dump()).toEqual({});
	});
});
