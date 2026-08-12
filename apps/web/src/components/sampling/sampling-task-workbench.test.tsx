import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { SamplingTaskWorkbench } from "./sampling-task-workbench";
import type { SamplingTaskView } from "./types";

function task(overrides: Partial<SamplingTaskView> = {}): SamplingTaskView {
	return {
		id: "00000000-0000-4000-8000-000000000001",
		batchId: "00000000-0000-4000-8000-000000000002",
		batchName: "StepFun domestic sampling",
		brandId: "stepfun",
		brandName: "StepFun",
		status: "claimed",
		promptId: "00000000-0000-4000-8000-000000000003",
		promptText: "阶跃星辰 StepFun 是一家什么公司？",
		surfaceTargetKey: "doubao.consumer_web",
		captureRouteKey: "browser_runner.doubao",
		targetLabel: "豆包",
		model: "doubao",
		launchUrl: "https://www.doubao.com/chat/",
		scopeId: "00000000-0000-4000-8000-000000000004",
		scopeName: "China · Simplified Chinese · Scored",
		market: "CN",
		locale: "zh-CN",
		timezone: "Asia/Shanghai",
		sessionRequirement: "anonymous_clean",
		searchRequirement: "forbidden",
		evaluationRole: "scored",
		sampleIndex: 1,
		claimCount: 1,
		leaseGeneration: 2,
		leaseExpiresAt: "2026-08-13T04:30:00.000Z",
		measurementWindowStartsAt: "2026-08-13T00:00:00.000Z",
		measurementWindowEndsAt: "2026-08-20T00:00:00.000Z",
		minimumEvidenceArtifacts: 2,
		requireEvidenceSha256: true,
		requirePageUrl: true,
		automation: {
			status: "running",
			humanHandoffRequired: true,
			attemptCount: 1,
			maxPreSubmitAttempts: 2,
			submitIntentAt: "2026-08-13T04:00:00.000Z",
			submitConfirmedAt: null,
			needsHumanCode: "response_capture_failed",
			needsHumanReason: "The original answer must be recovered from the retained Runner session.",
		},
		...overrides,
	};
}

describe("SamplingTaskWorkbench Browser Runner handoff", () => {
	it("does not expose ordinary observation, upload, release, or replay controls after submit intent", () => {
		const markup = renderToStaticMarkup(
			<SamplingTaskWorkbench
				task={task()}
				lease={{
					leaseToken: "lease-token",
					leaseGeneration: 2,
					leaseExpiresAt: "2026-08-13T04:30:00.000Z",
				}}
				heartbeatError={null}
				initialEvidenceArtifacts={[]}
				evidenceArtifactsLoading={false}
				evidenceArtifactsError={null}
				onRelease={vi.fn(async () => undefined)}
				onSubmit={vi.fn(async () => undefined)}
				onFail={vi.fn(async () => undefined)}
			/>,
		);

		expect(markup).toContain("Do not open a new conversation or resend this prompt");
		expect(markup).toContain("Confirm terminal failure");
		expect(markup).not.toContain(">Observation<");
		expect(markup).not.toContain("Upload evidence");
		expect(markup).not.toContain("Release to queue");
		expect(markup).not.toContain("Submit recovered observation");
		expect(markup).not.toContain("Open 豆包");
		expect(markup).not.toContain(">Copy<");
	});
});
