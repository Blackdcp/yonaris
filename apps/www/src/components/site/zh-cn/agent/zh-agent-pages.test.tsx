import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

type SubjectModule = typeof import("./zh-agent-page");
const subject = (await import("./zh-agent-page").catch(() => undefined)) as SubjectModule | undefined;

describe("中国区域 Agent 页面", () => {
	it("使用官方品牌资产并保持人类与 Agent 路径配对", () => {
		expect(subject, "中国区域 Agent 页面必须存在").toBeDefined();
		if (!subject) return;
		const markup = renderToStaticMarkup(<subject.ZhAgentPage pageKey="index" />);
		expect(markup).toContain("/brand/logos/yonaris-wordmark-white.png");
		expect(markup).toContain('data-edition="zh-cn-agent"');
		expect(markup).toContain('aria-current="page">Agent 阅读');
		expect(markup).toContain('href="/zh/product"');
		expect(markup).toContain('href="/zh/agent/product"');
	});

	it("产品 Agent 页面公开同一套中国区域事实和边界", () => {
		expect(subject, "中国区域 Agent 页面必须存在").toBeDefined();
		if (!subject) return;
		const markup = renderToStaticMarkup(<subject.ZhAgentPage pageKey="product" />);
		expect(markup).toContain("把 AI 对品牌的回答");
		expect(markup).toContain("connected-workbench");
		expect(markup).toContain("单次回答不代表所有用户");
		expect(markup).toContain('href="/zh/product"');
	});
});
