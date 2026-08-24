import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

type SubjectModule = typeof import("./global-agent-page");
const subject = (await import("./global-agent-page").catch(() => undefined)) as SubjectModule | undefined;

describe("global Agent HTML pages", () => {
	it("renders an official branded Agent index with Human parity links", () => {
		expect(subject, "the branded Agent page must exist").toBeDefined();
		if (!subject) return;
		const markup = renderToStaticMarkup(<subject.GlobalAgentPage pageKey="index" />);
		expect(markup).toContain('/brand/logos/yonaris-wordmark-white.png');
		expect(markup).toContain('data-view="agent"');
		expect(markup).toContain('aria-current="page">Agent');
		expect(markup).toContain('href="/product"');
		expect(markup).toContain('href="/agent/product"');
	});

	it("renders the same declared facts as the machine product document", () => {
		expect(subject, "the branded Agent page must exist").toBeDefined();
		if (!subject) return;
		const markup = renderToStaticMarkup(<subject.GlobalAgentPage pageKey="product" />);
		expect(markup).toContain("Make AI market answers observable.");
		expect(markup).toContain("visible-workbench");
		expect(markup).toContain("The evidence workbench records market scope");
		expect(markup).toContain('href="/product"');
		expect(markup).toContain('href="/agent/product"');
	});
});
