import { describe, expect, it } from "vitest";
import { InvalidReportOutputError, parseGeneratedReportOutput } from "./report-output";

const output = {
	competitors: [{ name: "Competitor", domain: "competitor.example" }],
	prompts: [{ value: "Which product should I use?" }],
	promptRuns: [
		{
			promptValue: "Which product should I use?",
			runs: [
				{
					model: "chatgpt",
					version: "test",
					webSearchEnabled: true,
					rawOutput: { answer: "Example" },
					webQueries: ["example query"],
					textContent: "Example",
					brandMentioned: true,
					competitorsMentioned: [],
				},
			],
		},
	],
};

describe("parseGeneratedReportOutput", () => {
	it("reads newly stored JSON objects", () => {
		expect(parseGeneratedReportOutput(output)).toBe(output);
	});

	it("reads the historical JSON-string-in-JSON representation", () => {
		expect(parseGeneratedReportOutput(JSON.stringify(output))).toEqual(output);
	});

	it("rejects malformed and repeatedly serialized payloads", () => {
		expect(() => parseGeneratedReportOutput("not-json")).toThrow(InvalidReportOutputError);
		expect(() => parseGeneratedReportOutput(JSON.stringify(JSON.stringify(output)))).toThrow("must be a JSON object");
		expect(() => parseGeneratedReportOutput({ competitors: [], prompts: [] })).toThrow("missing report collections");
	});
});
