import { afterEach, describe, expect, it } from "vitest";
import { getRunsPerPrompt, RUNS_PER_PROMPT_FALLBACK } from "./constants";

const originalRunsPerPrompt = process.env.RUNS_PER_PROMPT;

afterEach(() => {
	if (originalRunsPerPrompt === undefined) delete process.env.RUNS_PER_PROMPT;
	else process.env.RUNS_PER_PROMPT = originalRunsPerPrompt;
});

describe("getRunsPerPrompt", () => {
	it("uses the default when the variable is unset", () => {
		delete process.env.RUNS_PER_PROMPT;
		expect(getRunsPerPrompt()).toBe(RUNS_PER_PROMPT_FALLBACK);
	});

	it("accepts a positive integer override", () => {
		process.env.RUNS_PER_PROMPT = "1";
		expect(getRunsPerPrompt()).toBe(1);
	});

	it.each(["0", "-1", "1.5", "not-a-number"])("rejects invalid override %s", (value) => {
		process.env.RUNS_PER_PROMPT = value;
		expect(getRunsPerPrompt()).toBe(RUNS_PER_PROMPT_FALLBACK);
	});
});
