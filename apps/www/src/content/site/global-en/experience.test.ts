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

describe("global product architecture", () => {
	it("defines four complete, inspectable modules", () => {
		expect(subject, "the global experience model must exist").toBeDefined();
		if (!subject) return;

		expect(subject.GLOBAL_PRODUCT_MODULES.map(({ id }) => id)).toEqual(["scope", "answers", "evidence", "experiments"]);
		for (const module of subject.GLOBAL_PRODUCT_MODULES) {
			expect(module.label).toBeTruthy();
			expect(module.question).toBeTruthy();
			expect(module.output).toBeTruthy();
			expect(module.owner).toBeTruthy();
			expect(module.boundary).toBeTruthy();
			expect(subject.getGlobalProductModule(module.id)).toBe(module);
		}
	});
});

describe("global evidence journey", () => {
	it("defines four decisions with an artifact and boundary at every step", () => {
		expect(subject, "the global experience model must exist").toBeDefined();
		if (!subject) return;

		expect(subject.GLOBAL_EVIDENCE_JOURNEY.map(({ id }) => id)).toEqual(["define", "observe", "inspect", "decide"]);
		for (const step of subject.GLOBAL_EVIDENCE_JOURNEY) {
			expect(step.promise).toBeTruthy();
			expect(step.artifact).toBeTruthy();
			expect(step.reviewQuestion).toBeTruthy();
			expect(step.boundary).toBeTruthy();
			expect(subject.getGlobalEvidenceStep(step.id)).toBe(step);
		}
	});
});
