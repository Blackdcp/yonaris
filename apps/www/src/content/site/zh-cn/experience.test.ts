import { describe, expect, it } from "vitest";

type SubjectModule = typeof import("./experience");
const subject = (await import("./experience").catch(() => undefined)) as SubjectModule | undefined;

describe("中国区域网站内容模型", () => {
	it("从五个 AI 焦虑问题出发，而不是按职能分人群", () => {
		expect(subject, "中国区域内容模型必须存在").toBeDefined();
		if (!subject) return;
		expect(subject.ZH_ANSWER_QUESTIONS).toHaveLength(5);
		expect(subject.ZH_ANSWER_QUESTIONS.map(({ id }) => id)).toEqual([
			"recommended",
			"accurate",
			"competitor",
			"sources",
			"next-test",
		]);
		expect(JSON.stringify(subject.ZH_ANSWER_QUESTIONS)).not.toMatch(/市场总监|销售负责人|创始人|CMO/);
	});

	it("明确完整交付链路与每一步责任", () => {
		expect(subject, "中国区域内容模型必须存在").toBeDefined();
		if (!subject) return;
		expect(subject.ZH_DELIVERY_STAGES.map(({ label }) => label)).toEqual(["诊断", "观察", "判断", "行动", "复测"]);
		for (const stage of subject.ZH_DELIVERY_STAGES) {
			expect(stage.customerInput).toBeTruthy();
			expect(stage.yonarisWork).toBeTruthy();
			expect(stage.output).toBeTruthy();
			expect(stage.review).toBeTruthy();
		}
	});

	it("分别表达中国市场与全球市场的可配置能力", () => {
		expect(subject, "中国区域内容模型必须存在").toBeDefined();
		if (!subject) return;
		expect(subject.ZH_MARKET_CONTEXTS.map(({ id }) => id)).toEqual(["china", "global"]);
		expect(subject.ZH_MARKET_CONTEXTS[1]?.boundary).toContain("按市场配置");
		expect(JSON.stringify(subject.ZH_MARKET_CONTEXTS)).not.toMatch(/全覆盖|所有平台|100%/);
	});
});
