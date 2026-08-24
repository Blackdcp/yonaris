import { describe, expect, it } from "vitest";

type ExperienceModule = typeof import("./experience");

const subject = (await import("./experience").catch(() => undefined)) as ExperienceModule | undefined;

describe("global Answer Studio content", () => {
	it("covers the five approved buyer anxieties without role segmentation", () => {
		expect(subject, "the global experience model must exist").toBeDefined();
		if (!subject) return;

		expect(subject.GLOBAL_ANSWER_QUESTIONS.map(({ id }) => id)).toEqual([
			"recommended",
			"accurate",
			"competitor",
			"sources",
			"next-test",
		]);
		expect(new Set(subject.GLOBAL_ANSWER_QUESTIONS.map(({ label }) => label)).size).toBe(5);
		for (const question of subject.GLOBAL_ANSWER_QUESTIONS) {
			expect(question.answer.length).toBeGreaterThan(20);
			expect(question.evidence.length).toBeGreaterThan(20);
			expect(question.nextTest.length).toBeGreaterThan(20);
		}
		expect(JSON.stringify(subject.GLOBAL_ANSWER_QUESTIONS)).not.toMatch(/CMO|marketer|sales team|founder/i);
		expect(subject.getGlobalAnswerQuestion("recommended").label).toBe("Are we being recommended?");
	});
});
