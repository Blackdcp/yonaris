import { describe, expect, it } from "vitest";
import { selectImplicitMeasurementScope } from "./measurement-scope-selection";

type Scope = {
	id: string;
	enabled: boolean;
	isDefault: boolean;
	hasEnabledPrompts: boolean;
	samplingEvaluationRole: "scored" | "observation" | null;
};

const scope = (overrides: Partial<Scope> & Pick<Scope, "id">): Scope => ({
	id: overrides.id,
	enabled: overrides.enabled ?? true,
	isDefault: overrides.isDefault ?? false,
	hasEnabledPrompts: overrides.hasEnabledPrompts ?? false,
	samplingEvaluationRole: overrides.samplingEvaluationRole ?? null,
});

describe("selectImplicitMeasurementScope", () => {
	it("prefers a populated scope over an empty database default", () => {
		const selected = selectImplicitMeasurementScope([
			scope({ id: "legacy", isDefault: true }),
			scope({ id: "china", hasEnabledPrompts: true }),
			scope({ id: "global", hasEnabledPrompts: true }),
		]);

		expect(selected?.id).toBe("china");
	});

	it("keeps the database default when it has enabled prompts", () => {
		const selected = selectImplicitMeasurementScope([
			scope({ id: "global", isDefault: true, hasEnabledPrompts: true }),
			scope({ id: "china", hasEnabledPrompts: true }),
		]);

		expect(selected?.id).toBe("global");
	});

	it("falls back to the empty default when no enabled scope has prompts", () => {
		const selected = selectImplicitMeasurementScope([
			scope({ id: "legacy", isDefault: true }),
			scope({ id: "diagnostic" }),
		]);

		expect(selected?.id).toBe("legacy");
	});

	it("ignores disabled scopes", () => {
		const selected = selectImplicitMeasurementScope([
			scope({ id: "legacy", isDefault: true }),
			scope({ id: "disabled", enabled: false, hasEnabledPrompts: true }),
			scope({ id: "china", hasEnabledPrompts: true }),
		]);

		expect(selected?.id).toBe("china");
	});

	it("prefers a populated scored Program over an earlier diagnostic observation scope", () => {
		const selected = selectImplicitMeasurementScope([
			scope({ id: "legacy", isDefault: true }),
			scope({ id: "diagnostic", hasEnabledPrompts: true, samplingEvaluationRole: "observation" }),
			scope({ id: "china", hasEnabledPrompts: true, samplingEvaluationRole: "scored" }),
		]);

		expect(selected?.id).toBe("china");
	});
});
