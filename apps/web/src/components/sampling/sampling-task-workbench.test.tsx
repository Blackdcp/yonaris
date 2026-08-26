import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/i18n/provider";
import { SamplingTaskWorkbench } from "./sampling-task-workbench";
import type { SamplingEvidenceArtifactView, SamplingTaskView } from "./types";

function asHtmlText(value: string): string {
	return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

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
			<I18nProvider locale="en">
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
				/>
			</I18nProvider>,
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

	it("labels platform-default search as native auto in the frozen protocol", () => {
		const markup = renderToStaticMarkup(
			<I18nProvider locale="en">
				<SamplingTaskWorkbench
					task={task({
						searchRequirement: "platform_default",
						automation: null,
						captureRouteKey: "assisted_browser.generic",
					})}
					lease={{ leaseToken: "lease-token", leaseGeneration: 2, leaseExpiresAt: null }}
					heartbeatError={null}
					initialEvidenceArtifacts={[]}
					evidenceArtifactsLoading={false}
					evidenceArtifactsError={null}
					onRelease={vi.fn(async () => undefined)}
					onSubmit={vi.fn(async () => undefined)}
					onFail={vi.fn(async () => undefined)}
				/>
			</I18nProvider>,
		);

		expect(markup).toContain("platform default (native auto)");
		expect(markup).toContain("Observed web search");
	});

	it("renders the Chinese workbench while keeping identifiers, frozen protocol values, prompt, and raw Runner detail exact", () => {
		const automation = task().automation;
		if (!automation) throw new Error("Expected the task fixture to include Browser Runner automation");
		const artifact: SamplingEvidenceArtifactView = {
			id: "artifact-raw-0001",
			kind: "screenshot",
			fileName: "evidence-原始.png",
			mimeType: "image/png",
			sizeBytes: 1234,
			sha256: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
			status: "staged",
			createdAt: "2026-08-13T04:05:00.000Z",
			downloadUrl: "/api/admin/sampling/evidence/artifact-raw-0001?receipt=raw",
		};
		const rawReason = "RUNNER_DETAIL response_capture_failed :: byte-for-byte 原始";
		const markup = renderToStaticMarkup(
			<I18nProvider locale="zh-CN">
				<SamplingTaskWorkbench
					task={task({
						id: "task-raw-00000001",
						batchId: "batch-raw-00000002",
						promptId: "prompt-raw-00000003",
						scopeId: "scope-raw-00000004",
						surfaceTargetKey: "doubao.consumer_web",
						captureRouteKey: "browser_runner.doubao",
						model: "doubao-model/raw-v1",
						market: "CN",
						locale: "zh-CN",
						timezone: "Asia/Shanghai",
						automation: {
							...automation,
							needsHumanCode: "response_capture_failed",
							needsHumanReason: rawReason,
						},
					})}
					lease={{
						leaseToken: "lease-token-byte-identical",
						leaseGeneration: 2,
						leaseExpiresAt: "2026-08-13T04:30:00.000Z",
					}}
					heartbeatError={null}
					initialEvidenceArtifacts={[artifact]}
					evidenceArtifactsLoading={false}
					evidenceArtifactsError={null}
					onRelease={vi.fn(async () => undefined)}
					onSubmit={vi.fn(async () => undefined)}
					onFail={vi.fn(async () => undefined)}
				/>
			</I18nProvider>,
		);

		expect(markup).toContain("Browser Runner 需要人工接管");
		expect(markup).toContain("请勿打开新对话或重新发送此提示词");
		expect(markup).toContain("确认终止失败");
		expect(markup).toContain("原始执行详情");
		expect(markup).toContain(rawReason);
		expect(markup).toContain("task-raw-00000001");
		expect(markup).toContain("batch-raw-00000002");
		expect(markup).toContain("prompt-raw-00000003");
		expect(markup).toContain("scope-raw-00000004");
		expect(markup).toContain("doubao.consumer_web");
		expect(markup).toContain("browser_runner.doubao");
		expect(markup).toContain("doubao-model/raw-v1");
		expect(markup).toContain("CN / zh-CN");
		expect(markup).toContain("Asia/Shanghai");
		expect(markup).toContain("阶跃星辰 StepFun 是一家什么公司？");
		expect(markup).toContain("第 2 代");
		expect(markup).not.toContain("Do not open a new conversation");
	});

	it("localizes evidence pending and error states while retaining the raw recovery error", () => {
		const rawError = 'EVIDENCE_RECOVERY_RAW::{"artifactId":"artifact-raw-9"}';
		const render = (loading: boolean, evidenceError: string | null) =>
			renderToStaticMarkup(
				<I18nProvider locale="zh-CN">
					<SamplingTaskWorkbench
						task={task({ automation: null })}
						lease={{ leaseToken: "lease-token", leaseGeneration: 2, leaseExpiresAt: null }}
						heartbeatError={null}
						initialEvidenceArtifacts={[]}
						evidenceArtifactsLoading={loading}
						evidenceArtifactsError={evidenceError}
						onRelease={vi.fn(async () => undefined)}
						onSubmit={vi.fn(async () => undefined)}
						onFail={vi.fn(async () => undefined)}
					/>
				</I18nProvider>,
			);

		expect(render(true, null)).toContain("正在恢复暂存证据…");
		const errorMarkup = render(false, rawError);
		expect(errorMarkup).toContain("无法恢复暂存证据");
		expect(errorMarkup).toContain("原始错误详情");
		expect(errorMarkup).toContain(asHtmlText(rawError));
	});
});
