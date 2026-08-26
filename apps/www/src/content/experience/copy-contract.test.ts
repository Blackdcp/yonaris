import { describe, expect, it } from "vitest";

const retiredDistributionPattern = new RegExp(["source", "open"].reverse().join("[ -]?"), "i");

type CopyModule = {
	GLOBAL_COPY?: Record<string, unknown>;
	CHINA_COPY?: Record<string, unknown>;
	AGENT_FACTS?: Record<string, unknown>;
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
		expect(china).toContain("AI 正在替客户认识你、比较你，也可能误解你。");
		expect(china).toContain("不是再做一层内容，而是重建品牌被理解的基础设施。");
		expect(china).toContain("从一句 AI 答案，追到真正影响选择的那个断点。");
		expect(china).toContain("公开方法演示 · 示例场景，不代表客户结果。");
		expect(china).toContain("换一个市场，先换判断条件，不是只换语言。");
		expect(china).toContain("同一家公司，应该让人和 Agent 都读得清楚。");
		expect(china).toContain("带一道你最不想让 AI 答错的问题来。");
		expect(china).not.toMatch(/北美市场|欧洲市场|亚太市场|交付物|竞品更靠前/);
		expect(china).not.toMatch(/四个可核对结果|待核对信息|确认范围|在中国扎根|陪中国企业走向全球/);
		expect(china).not.toMatch(/中国市场基线|海外目标|出海|进入海外|服务中国市场/);
		expect(china).not.toMatch(/(?<!不)保证(?:排名|推荐)|自动改变|全网覆盖|流量承诺/);
		expect(china).not.toMatch(
			/客户问 AI 时，你的品牌被怎么说？|从最担心的品牌问题开始|让企业看清 AI 如何介绍自己的品牌/,
		);
	});

	it("aligns consultation calls to action with the approved three-field handoff", () => {
		const global = JSON.stringify(subject?.GLOBAL_COPY ?? {});
		expect(global).not.toMatch(/See your brand through AI|Walk through your question|Bring us your question/i);
		expect(global).toContain("Share three details");
	});

	it("never presents an unconfirmed form attempt as delivered", () => {
		const global = JSON.stringify(subject?.GLOBAL_COPY ?? {});
		const china = JSON.stringify(subject?.CHINA_COPY ?? {});
		expect(global).toContain("The page confirms form delivery only after the delivery service accepts the request");
		expect(global).not.toContain("They are sent to Yonaris");
		expect(china).toContain("只有投递服务接受申请后，页面才显示已送出");
	});

	it("keeps the machine copy on the approved company category without exposing a personal fallback", () => {
		const facts = JSON.stringify(subject?.AGENT_FACTS ?? {});
		expect(facts).toContain(
			"AI-native MarTech infrastructure built for decisions made by people and shaped by agents.",
		);
		expect(facts).toContain("面向人类决策、由 Agent 共同塑造的 AI 原生营销科技基础设施。");
		expect(facts).not.toMatch(/black\.dcp@outlook\.com|mailto:|upstream AI surface/i);
		expect(facts).not.toMatch(retiredDistributionPattern);
	});
});
