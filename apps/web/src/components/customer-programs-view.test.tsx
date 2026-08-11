import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { type CustomerProgramsContextView, CustomerProgramsView } from "./customer-programs-view";

const baseContext: CustomerProgramsContextView = {
	brand: { id: "stepfun", name: "StepFun" },
	canProvision: false,
	programs: [],
};

const onProvision = async () => ({ copiedPromptCount: 0 });

describe("CustomerProgramsView", () => {
	it("shows the create affordance only to owners and admins authorized by the server", () => {
		const managerMarkup = renderToStaticMarkup(
			<CustomerProgramsView context={{ ...baseContext, canProvision: true }} onProvision={onProvision} />,
		);
		const readOnlyMarkup = renderToStaticMarkup(
			<CustomerProgramsView context={{ ...baseContext, canProvision: false }} onProvision={onProvision} />,
		);

		expect(managerMarkup).toContain("Create program");
		expect(managerMarkup).not.toContain("Read-only");
		expect(readOnlyMarkup).toContain("Read-only");
		expect(readOnlyMarkup).not.toContain("Create program");
		expect(readOnlyMarkup).toContain("Only organization owners and admins can create programs");
	});

	it("renders the measurement context and delivery status for each program", () => {
		const markup = renderToStaticMarkup(
			<CustomerProgramsView
				context={{
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
				}}
				onProvision={onProvision}
			/>,
		);

		expect(markup).toContain("StepFun China scored");
		expect(markup).toContain("CN / zh-CN");
		expect(markup).toContain("Asia/Shanghai");
		expect(markup).toContain("Scored");
		expect(markup).toContain("38");
		expect(markup).toContain("40 total");
		expect(markup).toContain("Manual only");
		expect(markup).toContain("Default");
	});
});
