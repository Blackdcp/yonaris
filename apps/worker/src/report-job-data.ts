import type { OutputLanguage } from "@workspace/config/language";
import type { ReportJobData } from "./report-worker";

export type QueuedReportJobData = Omit<ReportJobData, "outputLanguage"> & {
	outputLanguage?: unknown;
};

export class ReportJobDataError extends Error {
	constructor(
		readonly code: "invalid_output_language",
		message: string,
	) {
		super(message);
		this.name = "ReportJobDataError";
	}
}

function normalizeOutputLanguage(value: unknown): OutputLanguage {
	if (value === undefined) return "en";
	if (value === "en" || value === "zh-CN") return value;
	throw new ReportJobDataError("invalid_output_language", "Unsupported report output language. Expected en or zh-CN.");
}

/** Queue ingress is the only compatibility boundary for jobs created before outputLanguage existed. */
export function normalizeQueuedReportJobData(data: QueuedReportJobData): ReportJobData {
	return { ...data, outputLanguage: normalizeOutputLanguage(data.outputLanguage) };
}

export async function dispatchQueuedReportJobData<T>(
	data: QueuedReportJobData,
	downstream: (normalized: ReportJobData) => Promise<T>,
): Promise<T> {
	return downstream(normalizeQueuedReportJobData(data));
}

export function buildManualReportCandidates(
	manualPrompts: readonly string[],
	isBranded: (prompt: string) => boolean,
): Array<{ prompt: string; brandedPrompt: boolean }> {
	return manualPrompts.map((prompt) => ({ prompt, brandedPrompt: isBranded(prompt) }));
}

export function preserveProviderReportRun<TRawOutput>(input: {
	model: string;
	configuredVersion?: string;
	provider: string;
	webSearchEnabled: boolean;
	result: {
		modelVersion?: string | null;
		rawOutput: TRawOutput;
		webQueries: string[];
		textContent: string;
	};
	brandMentioned: boolean;
	competitorsMentioned: string[];
}) {
	return {
		model: input.model,
		version: input.result.modelVersion ?? input.configuredVersion ?? input.provider,
		webSearchEnabled: input.webSearchEnabled,
		rawOutput: input.result.rawOutput,
		webQueries: input.result.webQueries,
		textContent: input.result.textContent,
		brandMentioned: input.brandMentioned,
		competitorsMentioned: input.competitorsMentioned,
	};
}
