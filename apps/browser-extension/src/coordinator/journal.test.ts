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
