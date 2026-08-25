import { describe, expect, it } from "vitest";

type CopyModule = {
	GLOBAL_COPY?: Record<string, unknown>;
	CHINA_COPY?: Record<string, unknown>;
};

const subject = (await import("./index").catch(() => undefined)) as CopyModule | undefined;

const retiredSalesLanguage =
	/reviewable|denominator|managed delivery|human review|configured scope|evidence boundary|interface demonstration|no customer data|causal proof|answer field|product lens|observed gap|observable parts|证据边界|有效分母|人工审核点|配置化观察|责任边界|当前软件|当前演示|因果证明/i;

describe("regional customer copy", () => {
	it("provides complete, independent copy models for both editions", () => {
		expect(subject?.GLOBAL_COPY, "global copy must exist").toBeDefined();
		expect(subject?.CHINA_COPY, "China copy must exist").toBeDefined();
		if (!subject?.GLOBAL_COPY || !subject.CHINA_COPY) return;
		const expected = ["home", "product", "approach", "geo", "company", "diagnostic", "privacy"];
		expect(Object.keys(subject.GLOBAL_COPY)).toEqual(expected);
		expect(Object.keys(subject.CHINA_COPY)).toEqual(expected);
		expect(JSON.stringify(subject.GLOBAL_COPY)).not.toMatch(retiredSalesLanguage);
		expect(JSON.stringify(subject.CHINA_COPY)).not.toMatch(retiredSalesLanguage);
	});

	it("does not publish the retired section or role-based segmentation", () => {
		const rendered = JSON.stringify(subject ?? {});
		expect(rendered).not.toMatch(/resources|research|for CMOs|for marketers|市场总监|品牌负责人/i);
	});

	it("keeps customer claims inside the product's observable capability boundary", () => {
		const global = JSON.stringify(subject?.GLOBAL_COPY ?? {});
		const china = JSON.stringify(subject?.CHINA_COPY ?? {});
		expect(global).toContain("See how AI answers your market’s buying questions.");
		expect(global).not.toMatch(/change the outcome|source influence|signals behind the response/i);
		expect(china).toContain("客户怎么问，AI 怎么答，先看哪里");
		expect(china).not.toMatch(/北美市场|欧洲市场|亚太市场|交付物|竞品更靠前/);
		expect(china).not.toMatch(/四个可核对结果|待核对信息|复查记录|确认范围|在中国扎根|陪中国企业走向全球/);
	});

	it("aligns consultation calls to action with the approved three-field handoff", () => {
		const global = JSON.stringify(subject?.GLOBAL_COPY ?? {});
		expect(global).not.toMatch(/See your brand through AI|Walk through your question|Bring us your question/i);
		expect(global).toContain("Share three details");
	});
});
