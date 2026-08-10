import { describe, expect, it } from "vitest";
import { analyzeMentions } from "./mention-analysis";

const brand = {
	name: "阶跃星辰",
	aliases: ["StepFun", "阶跃 AI"],
	website: "https://www.stepfun.com",
	additionalDomains: ["step-ai.com"],
};

const competitors = [
	{ name: "竞品甲", aliases: ["Comp A"], domains: ["comp-a.example"] },
	{ name: "竞品乙", aliases: [], domains: ["comp-b.example"] },
];

describe("analyzeMentions", () => {
	it("matches Chinese aliases and compatibility-width text", () => {
		const result = analyzeMentions("推荐阶跃 ＡＩ，也可以比较 Ｃｏｍｐ Ａ。", brand, competitors);

		expect(result).toEqual({ brandMentioned: true, competitorsMentioned: ["竞品甲"] });
	});

	it("matches normalized domains", () => {
		const result = analyzeMentions("来源：https://WWW.STEP-AI.COM/path 和 comp-b.example", brand, competitors);

		expect(result).toEqual({ brandMentioned: true, competitorsMentioned: ["竞品乙"] });
	});

	it("ignores blank aliases and domains", () => {
		const result = analyzeMentions("完全无关的回答", { ...brand, aliases: [""], additionalDomains: [""] }, [
			{ name: "竞品甲", aliases: [""], domains: [""] },
		]);

		expect(result).toEqual({ brandMentioned: false, competitorsMentioned: [] });
	});
});
