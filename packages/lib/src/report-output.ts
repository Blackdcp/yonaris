export interface GeneratedReportCompetitor {
	name: string;
	domain: string;
}

export interface GeneratedReportPrompt {
	brandId?: string;
	value: string;
	enabled?: boolean;
	tags?: string[];
	systemTags?: string[];
}

export type GeneratedReportJsonValue =
	| null
	| boolean
	| number
	| string
	| GeneratedReportJsonValue[]
	| { [key: string]: GeneratedReportJsonValue };

export interface GeneratedReportRun {
	model: string;
	version: string;
	webSearchEnabled: boolean;
	rawOutput: GeneratedReportJsonValue;
	webQueries: string[];
	textContent: string;
	brandMentioned: boolean;
	competitorsMentioned: string[];
}

export interface GeneratedReportPromptRun {
	promptValue: string;
	runs: GeneratedReportRun[];
}

export interface GeneratedReportOutput {
	competitors: GeneratedReportCompetitor[];
	prompts: GeneratedReportPrompt[];
	promptRuns: GeneratedReportPromptRun[];
}

export class InvalidReportOutputError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "InvalidReportOutputError";
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
	return Array.isArray(value) && value.every((item) => typeof item === "string");
}

/**
 * Reads the report payload stored in the JSON column.
 *
 * New workers persist the payload as a JSON object. Older workers serialized
 * it before writing to the JSON column, so PostgreSQL returns a JSON string.
 * Decode that historical representation once, then validate the shape relied
 * on by the renderer and API.
 */
export function parseGeneratedReportOutput(value: unknown): GeneratedReportOutput {
	let decoded = value;
	if (typeof value === "string") {
		try {
			decoded = JSON.parse(value);
		} catch {
			throw new InvalidReportOutputError("Stored report output is not valid JSON");
		}
	}

	if (!isRecord(decoded)) {
		throw new InvalidReportOutputError("Stored report output must be a JSON object");
	}

	const competitors = decoded.competitors;
	const prompts = decoded.prompts;
	const promptRuns = decoded.promptRuns;
	if (!Array.isArray(competitors) || !Array.isArray(prompts) || !Array.isArray(promptRuns)) {
		throw new InvalidReportOutputError("Stored report output is missing report collections");
	}

	for (const competitor of competitors) {
		if (!isRecord(competitor) || typeof competitor.name !== "string" || typeof competitor.domain !== "string") {
			throw new InvalidReportOutputError("Stored report output contains an invalid competitor");
		}
	}

	for (const prompt of prompts) {
		if (!isRecord(prompt) || typeof prompt.value !== "string") {
			throw new InvalidReportOutputError("Stored report output contains an invalid prompt");
		}
	}

	for (const promptRun of promptRuns) {
		if (!isRecord(promptRun) || typeof promptRun.promptValue !== "string" || !Array.isArray(promptRun.runs)) {
			throw new InvalidReportOutputError("Stored report output contains an invalid prompt run");
		}
		for (const run of promptRun.runs) {
			if (
				!isRecord(run) ||
				typeof run.model !== "string" ||
				typeof run.version !== "string" ||
				typeof run.webSearchEnabled !== "boolean" ||
				!isStringArray(run.webQueries) ||
				typeof run.textContent !== "string" ||
				typeof run.brandMentioned !== "boolean" ||
				!isStringArray(run.competitorsMentioned)
			) {
				throw new InvalidReportOutputError("Stored report output contains an invalid model run");
			}
		}
	}

	return decoded as unknown as GeneratedReportOutput;
}
