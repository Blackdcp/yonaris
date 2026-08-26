import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
	calculateOverseasRunNowCallCount,
	createOverseasRunNowSubmissionController,
	executeOverseasRunNowSubmission,
	OverseasRunNowDialog,
} from "./overseas-run-now-dialog";

describe("OverseasRunNowDialog", () => {
	it("reuses one idempotency key after an unknown result and rotates it only after success", () => {
		const observedKeys: string[] = [];
		let sequence = 0;
		const controller = createOverseasRunNowSubmissionController(() => `intent-${++sequence}`);
		const selection = {
			brandId: "ppio",
			scopeId: "scope-1",
			channelKeys: ["chatgpt"] as ["chatgpt"],
			samplesPerChannel: 1 as const,
		};
		const first = controller.begin(selection);
		if (first) {
			observedKeys.push(first.input.idempotencyKey);
			controller.finish(first, false);
		}
		const retry = controller.begin(selection);
		if (retry) {
			observedKeys.push(retry.input.idempotencyKey);
			controller.finish(retry, true);
		}
		const nextRun = controller.begin(selection);
		if (nextRun) observedKeys.push(nextRun.input.idempotencyKey);

		expect(observedKeys).toEqual(["intent-1", "intent-1", "intent-2"]);
	});

	it("passes the same key back to onRun after a timeout-like rejection", async () => {
		const observedKeys: string[] = [];
		let sequence = 0;
		let calls = 0;
		const controller = createOverseasRunNowSubmissionController(() => `intent-${++sequence}`);
		const selection = {
			brandId: "ppio",
			scopeId: "scope-1",
			channelKeys: ["chatgpt"] as ["chatgpt"],
			samplesPerChannel: 1 as const,
		};
		const onRun = async ({ idempotencyKey }: { idempotencyKey: string }) => {
			observedKeys.push(idempotencyKey);
			calls += 1;
			if (calls === 1) throw new Error("network timeout");
		};
		await expect(executeOverseasRunNowSubmission(controller, selection, onRun)).rejects.toThrow("network timeout");
		await executeOverseasRunNowSubmission(controller, selection, onRun);
		await executeOverseasRunNowSubmission(controller, selection, onRun);

		expect(observedKeys).toEqual(["intent-1", "intent-1", "intent-2"]);
	});

	it("claims a submission synchronously so a same-frame second click cannot dispatch", () => {
		const controller = createOverseasRunNowSubmissionController(() => "intent-1");
		const selection = {
			brandId: "ppio",
			scopeId: "scope-1",
			channelKeys: ["chatgpt"] as ["chatgpt"],
			samplesPerChannel: 1 as const,
		};

		const first = controller.begin(selection);
		const sameFrameSecond = controller.begin(selection);

		expect(first?.input.idempotencyKey).toBe("intent-1");
		expect(sameFrameSecond).toBeNull();
	});

	it("does not rotate an active intent while its paid submission result is unknown", () => {
		let sequence = 0;
		const controller = createOverseasRunNowSubmissionController(() => `intent-${++sequence}`);
		const selection = {
			brandId: "ppio",
			scopeId: "scope-1",
			channelKeys: ["chatgpt"] as ["chatgpt"],
			samplesPerChannel: 1 as const,
		};
		const active = controller.begin(selection);
		if (!active) throw new Error("Expected the first submission to be claimed");

		controller.resetIntent();
		controller.finish(active, false);
		const retry = controller.begin(selection);

		expect(retry?.input.idempotencyKey).toBe("intent-1");
	});

	it("starts a new intent when the selected Program or channels change", () => {
		let sequence = 0;
		const controller = createOverseasRunNowSubmissionController(() => `intent-${++sequence}`);
		const first = controller.begin({
			brandId: "ppio",
			scopeId: "scope-1",
			channelKeys: ["chatgpt"],
			samplesPerChannel: 1,
		});
		if (!first) throw new Error("Expected the first submission to be claimed");
		controller.finish(first, false);

		const changedSelection = controller.begin({
			brandId: "ppio",
			scopeId: "scope-2",
			channelKeys: ["perplexity"],
			samplesPerChannel: 1,
		});

		expect(first.input.idempotencyKey).toBe("intent-1");
		expect(changedSelection?.input.idempotencyKey).toBe("intent-2");
	});

	it("starts a new intent when the administrator upgrades the sample count", () => {
		let sequence = 0;
		const controller = createOverseasRunNowSubmissionController(() => `intent-${++sequence}`);
		const standard = controller.begin({
			brandId: "ppio",
			scopeId: "scope-1",
			channelKeys: ["chatgpt"],
			samplesPerChannel: 1,
		});
		if (!standard) throw new Error("Expected the standard submission to be claimed");
		controller.finish(standard, false);

		const paid = controller.begin({
			brandId: "ppio",
			scopeId: "scope-1",
			channelKeys: ["chatgpt"],
			samplesPerChannel: 5,
		});

		expect(standard.input.idempotencyKey).toBe("intent-1");
		expect(paid?.input.idempotencyKey).toBe("intent-2");
	});

	it("invalidates a failed intent as soon as the administrator changes the selection", () => {
		let sequence = 0;
		const controller = createOverseasRunNowSubmissionController(() => `intent-${++sequence}`);
		const selection = {
			brandId: "ppio",
			scopeId: "scope-1",
			channelKeys: ["chatgpt"] as ["chatgpt"],
			samplesPerChannel: 1 as const,
		};
		const failed = controller.begin(selection);
		if (!failed) throw new Error("Expected the failed submission to be claimed");
		controller.finish(failed, false);
		controller.resetIntent();

		const afterSelectionChange = controller.begin(selection);

		expect(afterSelectionChange?.input.idempotencyKey).toBe("intent-2");
	});

	it("defaults all six Bright Data channels to one sample and offers the paid five-sample option", () => {
		const markup = renderToStaticMarkup(
			<OverseasRunNowDialog
				brandId="ppio"
				programs={[{ id: "scope-1", name: "Global Market", promptCount: 10, timezone: "America/Los_Angeles" }]}
				cohorts={[]}
				googleAiOverviewReady
				onRun={vi.fn()}
			/>,
		);

		for (const label of ["ChatGPT", "Perplexity", "Gemini", "Copilot", "Google AI Mode", "Google AI Overview"]) {
			expect(markup).toContain(label);
		}
		expect(markup).toContain("5 samples (paid add-on)");
		expect(markup).toContain("10 × 6 × 1 = 60 calls");
		expect(markup).toContain("Run 60 overseas calls now");
		expect(markup).not.toContain('type="number"');
	});

	it("keeps the other five channels runnable but disables AI Overview when no SERP zone is configured", () => {
		const markup = renderToStaticMarkup(
			<OverseasRunNowDialog
				brandId="ppio"
				programs={[{ id: "scope-1", name: "Global Market", promptCount: 10, timezone: "America/Los_Angeles" }]}
				cohorts={[]}
				googleAiOverviewReady={false}
				onRun={vi.fn()}
			/>,
		);

		expect(markup).toContain("Google AI Overview");
		expect(markup).toContain("Configure BRIGHTDATA_SERP_ZONE to enable Google AI Overview.");
		expect(markup).toMatch(/<button[^>]*disabled[^>]*id="overseas-google-ai-overview"/);
		expect(markup).toContain("10 × 5 × 1 = 50 calls");
		expect(markup).toContain("Run 50 overseas calls now");
		expect(markup).not.toContain("10 × 6 × 1 = 60 calls");
	});

	it("calculates one sample by default and five only for the paid option", () => {
		expect(calculateOverseasRunNowCallCount(10, 6)).toBe(60);
		expect(calculateOverseasRunNowCallCount(10, 6, 5)).toBe(300);
	});
});
