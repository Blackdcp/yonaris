import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/i18n/provider";
import { SamplingBatchCreateDialog } from "./sampling-batch-create-dialog";
import type { SamplingContextView } from "./types";

vi.mock("@workspace/ui/components/dialog", () => ({
	Dialog: ({ children }: { children: ReactNode }) => <div>{children}</div>,
	DialogContent: ({ children }: { children: ReactNode }) => <section>{children}</section>,
	DialogDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
	DialogFooter: ({ children }: { children: ReactNode }) => <footer>{children}</footer>,
	DialogHeader: ({ children }: { children: ReactNode }) => <header>{children}</header>,
	DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
	DialogTrigger: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@workspace/ui/components/select", () => ({
	Select: ({ children }: { children: ReactNode }) => <div>{children}</div>,
	SelectContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
	SelectItem: ({ children, value }: { children: ReactNode; value: string }) => <div data-value={value}>{children}</div>,
	SelectTrigger: ({ children }: { children: ReactNode }) => <div>{children}</div>,
	SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>,
}));

const context: SamplingContextView = {
	brands: [{ id: "brand-raw-stepfun", name: "StepFun 原名" }],
	browserRunnerEnabled: true,
	overseasRunNow: { googleAiOverviewReady: true },
	selectedBrand: {
		id: "brand-raw-stepfun",
		name: "StepFun 原名",
		scopes: [
			{
				id: "scope-raw-cn-01",
				key: "cn-zh-scored-raw",
				name: "China scored 原始",
				market: "CN",
				locale: "zh-CN",
				timezone: "Asia/Shanghai",
				enabled: true,
				manualOnly: true,
				samplingEvaluationRole: "scored",
			},
		],
		prompts: [
			{
				id: "prompt-raw-01",
				scopeId: "scope-raw-cn-01",
				value: "阶跃星辰 StepFun 是一家什么公司？",
				tags: ["raw-tag"],
				enabled: true,
			},
		],
	},
	targets: [
		{
			surfaceTargetKey: "doubao.consumer_web",
			captureRouteKey: "browser_runner.doubao",
			model: "doubao-model/raw-v1",
			label: "豆包 原始目标",
			launchUrl: "https://www.doubao.com/chat/",
			surfaceKind: "chat_surface",
			defaultSessionRequirement: "anonymous_clean",
			defaultSearchRequirement: "forbidden",
		},
	],
};

describe("SamplingBatchCreateDialog localization", () => {
	it("renders every batch form choice in Chinese while leaving submitted identity examples literal", () => {
		const markup = renderToStaticMarkup(
			<I18nProvider locale="zh-CN">
				<SamplingBatchCreateDialog context={context} onCreate={vi.fn()} />
			</I18nProvider>,
		);

		expect(markup).toContain("创建批次");
		expect(markup).toContain("创建抽样批次");
		expect(markup).toContain("批次名称");
		expect(markup).toContain("监测范围");
		expect(markup).toContain("评估池");
		expect(markup).toContain("执行方式");
		expect(markup).toContain("手动工作台");
		expect(markup).toContain("测量窗口开始时间");
		expect(markup).toContain("提示词（已选择 0 条）");
		expect(markup).toContain("消费者界面（已选择 0 个）");
		expect(markup).toContain("创建并冻结批次");
		expect(markup).toContain("China scored 原始 · CN/zh-CN · Asia/Shanghai");
		expect(markup).toContain("阶跃星辰 StepFun 是一家什么公司？");
		expect(markup).toContain("豆包 原始目标");
		expect(markup).toContain("doubao.consumer_web");
		expect(markup).toContain('data-value="scope-raw-cn-01"');
		expect(markup).not.toContain("Create sampling batch");
	});
});
