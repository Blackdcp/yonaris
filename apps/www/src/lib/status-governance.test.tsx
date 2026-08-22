import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import type { StatusEntry } from "./status-helpers";
import { renderStatusOgImage } from "./status-og";

const passingEntry: StatusEntry = {
	ts: "2026-08-22T00:00:00.000Z",
	status: "pass",
	latency: 1200,
	retries: 0,
	textLength: 480,
	rawOutputBytes: 800,
	citations: 2,
	webQueries: 1,
	webSearch: true,
	error: null,
};

describe("status truth and failure semantics", () => {
	test("renders OG status as periodic check evidence rather than a service/SLA claim", () => {
		const markup = renderToStaticMarkup(
			renderStatusOgImage([{ target: "chatgpt:openai-api:gpt", entries: [passingEntry] }]),
		);

		expect(markup).toContain("Periodic provider checks");
		expect(markup).toContain("7-day check pass rate");
		expect(markup).not.toMatch(/all systems|uptime|real-time|SLA/i);
		expect(markup).not.toMatch(/gradient/i);
	});

	test("renders a waiting OG image when no check history is available", () => {
		const markup = renderToStaticMarkup(renderStatusOgImage([]));
		expect(markup).toContain("Waiting for check data");
		expect(markup).toContain("No service-level claim");
	});

	test("turns a rejected status reader into an honest empty check history", async () => {
		const subject = await import("./status");
		expect(subject.loadStatusDataWith, "status loader must expose its failure-safe boundary").toBeTypeOf("function");
		if (!subject.loadStatusDataWith) return;

		const result = await subject.loadStatusDataWith({
			now: () => new Date("2026-08-22T12:00:00.000Z").getTime(),
			targets: ["chatgpt:openai-api:gpt"],
			read: async () => {
				throw new Error("Redis unavailable");
			},
		});
		expect(result).toEqual([{ target: "chatgpt:openai-api:gpt", entries: [] }]);
	});
});
