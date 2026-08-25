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
		expect(china).toContain("客户开始问 AI，品牌的第一解释权还在你手里吗？");
		expect(china).toContain("品牌为什么没进客户的候选池？");
		expect(china).toContain("先做品牌体检，再定 GEO 打法");
		expect(china).toContain("生成式搜索和 AI 答案中的品牌表现");
		expect(china).toContain("出海不是翻译官网，而是重做一遍当地品类心智。");
		expect(china).toContain("不卖玄学排名，先把 AI 怎么说你查清楚");
		expect(china).toContain("第一次沟通只确认摸底范围");
		expect(china).not.toMatch(/北美市场|欧洲市场|亚太市场|交付物|竞品更靠前/);
		expect(china).not.toMatch(/四个可核对结果|待核对信息|复查记录|确认范围|在中国扎根|陪中国企业走向全球/);
		expect(china).not.toMatch(/保证排名|保证推荐|自动改变|全网覆盖|流量承诺/);
		expect(china).not.toMatch(/客户问 AI 时，你的品牌被怎么说？|从最担心的品牌问题开始|让企业看清 AI 如何介绍自己的品牌/);
	});

	it("aligns consultation calls to action with the approved three-field handoff", () => {
		const global = JSON.stringify(subject?.GLOBAL_COPY ?? {});
		expect(global).not.toMatch(/See your brand through AI|Walk through your question|Bring us your question/i);
		expect(global).toContain("Share three details");
	});
});
