import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
	CanonicalRecordTransform,
	canonicalRecordReadingProgress,
	canonicalRecordRevealState,
} from "./canonical-record-transform";

describe("CanonicalRecordTransform", () => {
	it("renders the canonical fact once and attaches source, boundary, identity and review metadata", () => {
		const html = renderToStaticMarkup(<CanonicalRecordTransform locale="en" />);
		const fact = "AI-native MarTech infrastructure built for decisions made by people and shaped by agents.";
		expect(html.split(fact)).toHaveLength(2);
		expect(html).toContain('id="yonaris.category.ai-native-martech"');
		expect(html).toContain('data-stable-id="yonaris.category.ai-native-martech"');
		for (const label of ["Public basis", "Boundary", "Stable identity", "Review date"]) expect(html).toContain(label);
		expect(html).toContain('type="range"');
		expect(html).toContain('href="/company#yonaris.category.ai-native-martech"');
		expect(html).toContain('href="/agent/company#yonaris.category.ai-native-martech"');
		expect(html).toContain('href="/agent/company.md"');
		expect(html).toContain('type="text/markdown"');
		expect(html).toContain("do not guarantee ranking, inclusion, retrieval, or citation");
		expect(html).toContain('role="status"');
		expect(html).not.toContain("aria-valuetext");
		expect(html).toContain('value="25"');
		expect(html).toContain("<div><dt>Public basis</dt>");
		expect(html).toContain('aria-pressed="true"');
		expect(html).toContain('aria-pressed="false"');
		expect(html).toContain('<fieldset aria-label="One public record for people and agents">');
		expect(html).not.toContain("token reduction");
	});

	it("localizes the canonical anchor, representations and retrieval boundary", () => {
		const html = renderToStaticMarkup(<CanonicalRecordTransform locale="zh" />);
		const fact = "面向人类决策、由 Agent 共同塑造的 AI 原生营销科技基础设施。";
		expect(html.split(fact)).toHaveLength(2);
		expect(html).toContain('href="/zh/company#yonaris.category.ai-native-martech"');
		expect(html).toContain('href="/zh/agent/company#yonaris.category.ai-native-martech"');
		expect(html).toContain('href="/zh/agent/company.md"');
		expect(html).toContain("机器可读表示支持检索与核查；但不保证排名、收录、检索或引用。");
	});

	it("reveals one record progressively before reaching the explicit agent state", () => {
		expect(canonicalRecordRevealState(0)).toEqual({
			publicBasis: false,
			boundary: false,
			identityAndRepresentations: false,
			reviewDate: false,
		});
		expect(canonicalRecordRevealState(25)).toEqual({
			publicBasis: true,
			boundary: false,
			identityAndRepresentations: false,
			reviewDate: false,
		});
		expect(canonicalRecordRevealState(50)).toEqual({
			publicBasis: true,
			boundary: true,
			identityAndRepresentations: false,
			reviewDate: false,
		});
		expect(canonicalRecordRevealState(75)).toEqual({
			publicBasis: true,
			boundary: true,
			identityAndRepresentations: true,
			reviewDate: false,
		});
		expect(canonicalRecordRevealState(100)).toEqual({
			publicBasis: true,
			boundary: true,
			identityAndRepresentations: true,
			reviewDate: true,
		});
	});

	it("uses the same explicit progress endpoints for direct readings and reduced motion", () => {
		expect(canonicalRecordReadingProgress("human")).toBe(25);
		expect(canonicalRecordReadingProgress("agent")).toBe(100);
	});
});
