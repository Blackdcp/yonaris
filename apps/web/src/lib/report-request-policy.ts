export const REPORT_REQUEST_LIMITS = {
	brandNameCharacters: 160,
	websiteCharacters: 2048,
	manualPromptCount: 50,
	manualPromptCharacters: 1000,
	manualPromptTotalCharacters: 15_000,
	manualPromptInputCharacters: 20_000,
} as const;

/** Normalize a bounded, newline-delimited manual prompt list for a report job. */
export function normalizeManualPrompts(input: string | undefined): string[] {
	return normalizeManualPromptValues(input?.split(/\r?\n/) ?? []);
}

/** Normalize an API array using the same cost ceiling as the report UI. */
export function normalizeManualPromptValues(values: readonly string[]): string[] {
	if (values.length > REPORT_REQUEST_LIMITS.manualPromptCount) {
		throw new Error(`A report can contain at most ${REPORT_REQUEST_LIMITS.manualPromptCount} manual prompts.`);
	}

	const unique = new Map<string, string>();
	let totalCharacters = 0;
	for (const rawLine of values) {
		const prompt = rawLine.trim();
		if (!prompt) continue;
		if (prompt.length > REPORT_REQUEST_LIMITS.manualPromptCharacters) {
			throw new Error(
				`Each manual prompt must be ${REPORT_REQUEST_LIMITS.manualPromptCharacters} characters or fewer.`,
			);
		}

		const dedupeKey = prompt.normalize("NFKC").toLocaleLowerCase("und");
		if (unique.has(dedupeKey)) continue;
		unique.set(dedupeKey, prompt);
		totalCharacters += prompt.length;
		if (unique.size > REPORT_REQUEST_LIMITS.manualPromptCount) {
			throw new Error(`A report can contain at most ${REPORT_REQUEST_LIMITS.manualPromptCount} manual prompts.`);
		}
		if (totalCharacters > REPORT_REQUEST_LIMITS.manualPromptTotalCharacters) {
			throw new Error(
				`Manual prompts must total ${REPORT_REQUEST_LIMITS.manualPromptTotalCharacters} characters or fewer.`,
			);
		}
	}

	return [...unique.values()];
}
