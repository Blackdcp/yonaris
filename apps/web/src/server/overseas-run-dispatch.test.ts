import { describe, expect, it } from "vitest";
import { dispatchOverseasRunCalls } from "./overseas-run-dispatch";

describe("overseas Run now dispatch", () => {
	it("sends each undispatched call once with a deterministic singleton key", async () => {
		const sent: Array<{ name: string; data: unknown; options: Record<string, unknown> }> = [];
		const marked: string[] = [];
		const result = await dispatchOverseasRunCalls("cohort-1", {
			listUndispatched: async () => [{ id: "call-a" }, { id: "call-b" }],
			send: async (name, data, options) => {
				sent.push({ name, data, options });
				return `job-${sent.length}`;
			},
			markDispatched: async (callId) => {
				marked.push(callId);
				return true;
			},
		});

		expect(result).toEqual({ planned: 2, dispatched: 2, alreadyDispatched: 0, failed: 0 });
		expect(marked).toEqual(["call-a", "call-b"]);
		expect(sent).toEqual([
			{
				name: "process-overseas-run-call",
				data: { cohortId: "cohort-1", callId: "call-a" },
				options: expect.objectContaining({ singletonKey: "overseas-run-call-call-a", retryLimit: 0 }),
			},
			{
				name: "process-overseas-run-call",
				data: { cohortId: "cohort-1", callId: "call-b" },
				options: expect.objectContaining({ singletonKey: "overseas-run-call-call-b", retryLimit: 0 }),
			},
		]);
	});

	it("marks a pre-existing singleton as dispatched and leaves failed sends recoverable", async () => {
		const marked: string[] = [];
		const result = await dispatchOverseasRunCalls("cohort-1", {
			listUndispatched: async () => [{ id: "call-existing" }, { id: "call-failed" }],
			send: async (_name, data) => {
				if ((data as { callId: string }).callId === "call-failed") throw new Error("queue unavailable");
				return null;
			},
			markDispatched: async (callId) => {
				marked.push(callId);
				return true;
			},
		});

		expect(result).toEqual({ planned: 2, dispatched: 0, alreadyDispatched: 1, failed: 1 });
		expect(marked).toEqual(["call-existing"]);
	});
});
