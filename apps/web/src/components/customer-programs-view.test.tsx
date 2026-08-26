import type { UiLanguage } from "@workspace/config/language";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { I18nProvider } from "@/i18n/provider";
import { type CustomerProgramsContextView, CustomerProgramsView } from "./customer-programs-view";

const baseContext: CustomerProgramsContextView = {
	brand: { id: "stepfun", name: "StepFun" },
	canProvision: false,
	programs: [],
};

const onProvision = async () => ({ copiedPromptCount: 0 });

function renderPrograms(context: CustomerProgramsContextView, locale: UiLanguage = "en") {
	return renderToStaticMarkup(
		<I18nProvider locale={locale}>
			<CustomerProgramsView context={context} onProvision={onProvision} />
		</I18nProvider>,
	);
}

describe("CustomerProgramsView", () => {
	it("shows the create affordance only to owners and admins authorized by the server", () => {
		const managerMarkup = renderPrograms({ ...baseContext, canProvision: true });
		const readOnlyMarkup = renderPrograms({ ...baseContext, canProvision: false });

		expect(managerMarkup).toContain("Create program");
		expect(managerMarkup).not.toContain("Read-only");
		expect(readOnlyMarkup).toContain("Read-only");
		expect(readOnlyMarkup).not.toContain("Create program");
		expect(readOnlyMarkup).toContain("Only organization owners and admins can create programs");
	});

	it("renders the measurement context and delivery status for each program", () => {
		const markup = renderPrograms({
			...baseContext,
			programs: [
				{
					id: "scope-1",
					key: "cn-zh-scored",
					name: "StepFun China scored",
					market: "CN",
					locale: "zh-CN",
					timezone: "Asia/Shanghai",
					enabled: true,
					isDefault: true,
					manualOnly: true,
					samplingEvaluationRole: "scored",
					promptCount: 40,
					enabledPromptCount: 38,
				},
			],
		});

		expect(markup).toContain("StepFun China scored");
		expect(markup).toContain("CN / zh-CN");
		expect(markup).toContain("Asia/Shanghai");
		expect(markup).toContain("Scored");
		expect(markup).toContain("38");
		expect(markup).toContain("40 total");
		expect(markup).toContain("Manual only");
		expect(markup).toContain("Default");
	});

	it("renders a populated Program table in Chinese without changing measurement identity", () => {
		const markup = renderPrograms(
			{
				...baseContext,
				programs: [
					{
						id: "scope-cn-literal",
						key: "cn-zh-scored",
						name: "StepFun China scored",
						market: "CN",
						locale: "zh-CN",
						timezone: "Asia/Shanghai",
						enabled: true,
						isDefault: true,
						manualOnly: true,
						samplingEvaluationRole: "scored",
						promptCount: 40,
						enabledPromptCount: 38,
					},
				],
			},
			"zh-CN",
		);

		expect(markup).toContain("项目");
		expect(markup).toContain("评分抽样");
		expect(markup).toContain("仅手动");
		expect(markup).toContain("默认");
		expect(markup).toContain("StepFun China scored");
		expect(markup).toContain("cn-zh-scored");
		expect(markup).toContain("CN / zh-CN");
		expect(markup).toContain("Asia/Shanghai");
		expect(markup).not.toContain("Scored</");
	});

	it("renders the empty read-only Program state in Chinese", () => {
		const markup = renderPrograms(baseContext, "zh-CN");

		expect(markup).toContain("只读");
		expect(markup).toContain("暂无项目");
		expect(markup).toContain("只有组织所有者和管理员可以创建项目");
		expect(markup).toContain("StepFun");
		expect(markup).not.toContain("No programs yet");
	});
});
