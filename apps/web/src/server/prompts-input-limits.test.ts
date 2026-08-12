import { describe, expect, it } from "vitest";
import {
	assertPromptCapacity,
	MAX_PROMPT_TAG_CHARACTERS,
	MAX_PROMPT_TAG_LENGTH,
	MAX_PROMPT_TAGS,
	MAX_PROMPT_TEXT_LENGTH,
	updatePromptsInputSchema,
} from "./prompts";

const scopeId = "10000000-0000-4000-8000-000000000001";

function input(overrides: Record<string, unknown> = {}) {
	return {
		brandId: "stepfun",
		scopeId,
		prompts: [{ value: "Which domestic AI providers should I evaluate?", tags: ["china", "unbranded"] }],
		...overrides,
	};
}

describe("updatePromptsInputSchema", () => {
	it("accepts bounded prompts and normalizes duplicate tags", () => {
		const result = updatePromptsInputSchema.parse(
			input({ prompts: [{ value: "A valid prompt", tags: [" china ", "china", "unbranded"] }] }),
		);

		expect(result.prompts[0]?.tags).toEqual(["china", "unbranded"]);
	});

	it("rejects more than 100 prompts", () => {
		expect(() =>
			updatePromptsInputSchema.parse(
				input({ prompts: Array.from({ length: 101 }, (_, i) => ({ value: `Prompt ${i}` })) }),
			),
		).toThrow();
	});

	it("rejects empty or oversized prompt text", () => {
		expect(() => updatePromptsInputSchema.parse(input({ prompts: [{ value: "   " }] }))).toThrow();
		expect(() =>
			updatePromptsInputSchema.parse(input({ prompts: [{ value: "x".repeat(MAX_PROMPT_TEXT_LENGTH + 1) }] })),
		).toThrow();
	});

	it("rejects excessive tag count, tag length, and aggregate tag size", () => {
		expect(() =>
			updatePromptsInputSchema.parse(
				input({
					prompts: [{ value: "Prompt", tags: Array.from({ length: MAX_PROMPT_TAGS + 1 }, (_, i) => `tag-${i}`) }],
				}),
			),
		).toThrow();
		expect(() =>
			updatePromptsInputSchema.parse(
				input({ prompts: [{ value: "Prompt", tags: ["x".repeat(MAX_PROMPT_TAG_LENGTH + 1)] }] }),
			),
		).toThrow();
		expect(() =>
			updatePromptsInputSchema.parse(
				input({
					prompts: [
						{
							value: "Prompt",
							tags: Array.from({ length: MAX_PROMPT_TAGS }, (_, i) => `${i}-${"x".repeat(50)}`),
						},
					],
				}),
			),
		).toThrow(`Prompt tags may contain at most ${MAX_PROMPT_TAG_CHARACTERS} characters in total`);
	});
});

describe("prompt scope capacity", () => {
	it("allows the exact scope cap and rejects repeated incremental inserts", () => {
		expect(() => assertPromptCapacity(99, 1)).not.toThrow();
		expect(() => assertPromptCapacity(100, 1)).toThrow(/at most 100 prompts/);
		expect(() => assertPromptCapacity(75, 26)).toThrow(/at most 100 prompts/);
	});

	it("rejects invalid capacity counts", () => {
		expect(() => assertPromptCapacity(-1, 1)).toThrow(/invalid/);
		expect(() => assertPromptCapacity(1, Number.POSITIVE_INFINITY)).toThrow(/invalid/);
	});
});
