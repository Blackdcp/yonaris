import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/i18n/provider";
import { SamplingBatchList } from "./sampling-batch-list";
import type { SamplingBatchView, SamplingCoverageCounts } from "./types";

function counts(overrides: Partial<SamplingCoverageCounts> = {}): SamplingCoverageCounts {
	return {
		planned: 0,
		available: 0,
		claimed: 0,
		succeeded: 0,
		failed: 0,
		cancelled: 0,
		total: 3,
		attempted: 0,
		resolved: 0,
		successCoverage: 0,
		completionCoverage: 0,
		...overrides,
	};
}

function batch(overrides: Partial<SamplingBatchView> = {}): SamplingBatchView {
	const overall = counts();
	return {
		id: "00000000-0000-4000-8000-000000000001",
		brandId: "stepfun",
		scopeId: "00000000-0000-4000-8000-000000000002",
		scopeName: "China · Simplified Chinese · Scored",
		scopeMarket: "CN",
		scopeLocale: "zh-CN",
		scopeTimezone: "Asia/Shanghai",
		name: "StepFun domestic sampling",
		status: "frozen",
		plannedTaskCount: 3,
		claimableTaskCount: 3,
		manifestHash: "hash",
		createdAt: "2026-08-12T10:00:00.000Z",
		frozenAt: "2026-08-12T10:00:00.000Z",
		startedAt: null,
		completedAt: null,
		cancelledAt: null,
		coverage: {
			overall,
			byEvaluationRole: { scored: overall, observation: counts({ total: 0 }) },
		},
		...overrides,
	};
}

function render(batches: SamplingBatchView[], locale: "en" | "zh-CN" = "en"): string {
	return renderToStaticMarkup(
		<I18nProvider locale={locale}>
			<SamplingBatchList
				batches={batches}
				actingBatchId={null}
				onClaim={vi.fn()}
				onStartAutomation={vi.fn()}
				onFinalizeNeedsHuman={vi.fn()}
				onCancel={vi.fn()}
			/>
		</I18nProvider>,
	);
}

describe("SamplingBatchList automation controls", () => {
	it("keeps legacy manual failures out of the explicit human-takeover queue", () => {
		const failed = counts({ failed: 3, attempted: 3, resolved: 3, completionCoverage: 1 });
		const markup = render([
			batch({
				executionMode: "manual",
				coverage: { overall: failed, byEvaluationRole: { scored: failed, observation: counts({ total: 0 }) } },
			}),
		]);

		expect(markup).toContain("Not automated");
		expect(markup).toContain("Manual");
		expect(markup).not.toContain("Final");
		expect(markup).toContain("Claim next");
		expect(markup).not.toContain("Continue pre-submit task");
	});

	it("requires an explicit start for an enabled Browser Runner batch", () => {
		const markup = render([
			batch({
				executionMode: "browser_runner",
				browserRunnerEnabled: true,
				automationStatus: "not_started",
				automationProgress: { total: 3, completed: 0, running: 0, needsHuman: 0 },
				needsHumanCount: 0,
				resultStatus: "provisional",
			}),
		]);

		expect(markup).toContain("Start automated run");
		expect(markup).not.toContain("Claim next");
		expect(markup).toContain("Provisional");
		expect(markup).toContain("Asia/Shanghai");
	});

	it("shows human takeover only for the explicit needs-human count", () => {
		const successful = counts({
			succeeded: 2,
			attempted: 2,
			resolved: 2,
			successCoverage: 2 / 3,
			completionCoverage: 2 / 3,
		});
		const markup = render([
			batch({
				status: "in_progress",
				executionMode: "browser_runner",
				browserRunnerEnabled: true,
				automationStatus: "needs_human",
				automationProgress: { total: 3, completed: 2, running: 0, needsHuman: 1 },
				needsHumanCount: 1,
				needsHumanPreSubmitCount: 1,
				resultStatus: "provisional",
				coverage: {
					overall: successful,
					byEvaluationRole: { scored: successful, observation: counts({ total: 0 }) },
				},
			}),
		]);

		expect(markup).toContain("Continue pre-submit task");
		expect(markup).toContain("Success coverage");
		expect(markup).not.toContain("Start automated run");
		expect(markup).not.toContain('aria-label="Cancel batch"');
	});

	it("does not offer the ordinary browser handoff for a post-submit task", () => {
		const markup = render([
			batch({
				status: "in_progress",
				executionMode: "browser_runner",
				browserRunnerEnabled: true,
				automationStatus: "needs_human",
				automationProgress: {
					total: 3,
					completed: 2,
					running: 0,
					needsHuman: 1,
					needsHumanPreSubmit: 0,
					needsHumanPostSubmit: 1,
				},
				needsHumanCount: 1,
				needsHumanPreSubmitCount: 0,
				needsHumanPostSubmitCount: 1,
				finalizableNeedsHumanCount: 1,
				canFinalizeNeedsHuman: true,
				resultStatus: "provisional",
			}),
		]);

		expect(markup).toContain("1 same-session");
		expect(markup).toContain("Finalize incomplete (1)");
		expect(markup).not.toContain("Continue pre-submit task");
		expect(markup).not.toContain("Claim next");
	});

	it("offers explicit incomplete finalization only when the server marks the queue safe to finalize", () => {
		const markup = render([
			batch({
				status: "in_progress",
				executionMode: "browser_runner",
				browserRunnerEnabled: true,
				automationStatus: "needs_human",
				automationProgress: { total: 3, completed: 2, running: 0, needsHuman: 1 },
				needsHumanCount: 1,
				needsHumanPostSubmitCount: 1,
				finalizableNeedsHumanCount: 1,
				canFinalizeNeedsHuman: true,
				resultStatus: "provisional",
			}),
		]);

		expect(markup).toContain("Finalize incomplete (1)");
	});

	it("shows a settled automatic batch below full success coverage as incomplete, never final", () => {
		const incomplete = counts({
			succeeded: 2,
			failed: 1,
			attempted: 3,
			resolved: 3,
			successCoverage: 2 / 3,
			completionCoverage: 1,
		});
		const incompleteBatch = batch({
			status: "completed",
			executionMode: "browser_runner",
			browserRunnerEnabled: true,
			automationStatus: "settled",
			automationProgress: { total: 3, completed: 3, running: 0, needsHuman: 0 },
			needsHumanCount: 0,
			resultStatus: "incomplete",
			coverage: {
				overall: incomplete,
				byEvaluationRole: { scored: incomplete, observation: counts({ total: 0 }) },
			},
		});

		const markup = render([incompleteBatch]);

		expect(markup).toContain("Incomplete");
		expect(markup).not.toContain(">Final<");
	});

	it("shows final only when the server marks a fully covered automatic batch final", () => {
		const complete = counts({
			succeeded: 3,
			attempted: 3,
			resolved: 3,
			successCoverage: 1,
			completionCoverage: 1,
		});
		const markup = render([
			batch({
				status: "completed",
				executionMode: "browser_runner",
				browserRunnerEnabled: true,
				automationStatus: "settled",
				automationProgress: { total: 3, completed: 3, running: 0, needsHuman: 0 },
				needsHumanCount: 0,
				resultStatus: "final",
				coverage: {
					overall: complete,
					byEvaluationRole: { scored: complete, observation: counts({ total: 0 }) },
				},
			}),
		]);

		expect(markup).toContain(">Final<");
		expect(markup).not.toContain("Incomplete");
	});

	it("renders Chinese status, table, automation, coverage, and actions while preserving raw batch and Program data", () => {
		const successful = counts({
			succeeded: 2,
			attempted: 2,
			resolved: 2,
			successCoverage: 2 / 3,
			completionCoverage: 2 / 3,
		});
		const markup = render(
			[
				batch({
					id: "batch-raw-00000001",
					name: "StepFun domestic sampling 原始",
					scopeName: "China · Simplified Chinese · Scored 原始",
					scopeMarket: "CN",
					scopeLocale: "zh-CN",
					scopeTimezone: "Asia/Shanghai",
					manifestHash: "sha256:manifest-byte-identical",
					status: "in_progress",
					executionMode: "browser_runner",
					browserRunnerEnabled: true,
					automationStatus: "needs_human",
					automationProgress: { total: 3, completed: 2, running: 0, needsHuman: 1 },
					needsHumanCount: 1,
					needsHumanPreSubmitCount: 1,
					resultStatus: "provisional",
					coverage: {
						overall: successful,
						byEvaluationRole: { scored: successful, observation: counts({ total: 0 }) },
					},
				}),
			],
			"zh-CN",
		);

		expect(markup).toContain("批次");
		expect(markup).toContain("项目");
		expect(markup).toContain("进行中");
		expect(markup).toContain("需要人工");
		expect(markup).toContain("成功覆盖率");
		expect(markup).toContain("暂定");
		expect(markup).toContain("继续提交前任务");
		expect(markup).toContain("StepFun domestic sampling 原始");
		expect(markup).toContain("China · Simplified Chinese · Scored 原始");
		expect(markup).toContain("CN/zh-CN · Asia/Shanghai");
		expect(markup).toContain("batch-ra");
		expect(markup).not.toContain("Continue human task");
	});

	it("renders the Chinese empty state", () => {
		const markup = render([], "zh-CN");

		expect(markup).toContain("没有符合当前筛选条件的抽样批次。");
		expect(markup).not.toContain("No sampling batches match these filters.");
	});
});
