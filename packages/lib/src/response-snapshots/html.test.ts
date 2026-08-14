import { describe, expect, it } from "vitest";
import { renderResponseSnapshotHtml, sanitizeAnswerHtml } from "./html";

describe("response snapshot HTML", () => {
	it("removes executable and network-active markup while retaining answer structure", () => {
		const sanitized = sanitizeAnswerHtml(`
			<div class="provider-theme" onclick="steal()">
				<script>steal()</script>
				<iframe src="https://attacker.example"></iframe>
				<style>@import url(https://attacker.example/x.css)</style>
				<p style="background:url(https://attacker.example/x)">Hello <strong>StepFun</strong></p>
				<img src="https://attacker.example/pixel.png">
				<a href="https://example.com/source" onmouseover="steal()">Source</a>
				<a href="javascript:steal()">Bad</a>
				<svg><script>steal()</script></svg>
			</div>
		`);

		expect(sanitized).toContain("<p>Hello <strong>StepFun</strong></p>");
		expect(sanitized).toContain('<a href="https://example.com/source" rel="noopener noreferrer nofollow">Source</a>');
		expect(sanitized).toContain("Bad");
		expect(sanitized).not.toMatch(/script|iframe|style=|<style|<img|<svg|onclick|onmouseover|javascript:/i);
	});

	it("renders a deterministic standalone fallback without executing customer content", () => {
		const html = renderResponseSnapshotHtml({
			answerHtml: undefined,
			answerText: "第一行\n\n<script>alert(1)</script>",
			channel: "chatgpt",
			observedAt: "2026-08-15T01:02:03.000Z",
			citations: [
				{
					url: "https://example.com/article?x=1&y=2",
					title: "A < B",
					domain: "example.com",
					citationIndex: 0,
				},
			],
		});

		expect(html).toContain("<!doctype html>");
		expect(html).toContain("第一行");
		expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
		expect(html).toContain("A &lt; B");
		expect(html).not.toContain("<script>");
		expect(html).not.toContain("https://attacker.example");
	});
});
