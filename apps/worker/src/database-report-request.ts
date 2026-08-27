import { parseGeneratedReportOutput } from "@workspace/lib/report-output";
import { getEffectiveBrandedStatus, isPromptBranded } from "@workspace/lib/tag-utils";

export const DATABASE_REPORT_TARGET = "chatgpt:brightdata:online";
export const DATABASE_REPORT_SCOPE_KEY = "legacy-unspecified";
export const DATABASE_REPORT_EXPECTED_RUNS = 1;
export const DATABASE_REPORT_OUTPUT_LANGUAGE = "en" as const;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const REQUEST_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{2,99}$/;

export class DatabaseReportRequestError extends Error {
	constructor(
		readonly code: string,
		message: string,
	) {
		super(message);
		this.name = "DatabaseReportRequestError";
	}
}

export type DatabaseReportCliOptions = {
	requestFile: string;
	mode: "dry-run" | "apply" | "status-only";
};

export type DatabaseReportRequest = {
	schemaVersion: 1;
	requestId: string;
	reportId: string;
	brand: { nameExact: string } | { idExact: string };
	scope: { keyExact: typeof DATABASE_REPORT_SCOPE_KEY };
	promptSelection: { limit: 1; preferUnbranded: true };
	execution: { targets: [typeof DATABASE_REPORT_TARGET]; runsPerTarget: 1 };
};

export type DatabaseReportSummaryState = {
	brandName: string;
	outputLanguage: string;
	promptCount: number | null;
	competitorCount: number | null;
	status: string;
	actualRuns: number | null;
	createdAt: string | null;
	completedAt: string | null;
	updatedAt: string | null;
};

export function buildDatabaseReportSummary(
	request: DatabaseReportRequest,
	state: DatabaseReportSummaryState,
): Record<string, unknown> {
	return {
		ok: true,
		requestId: request.requestId,
		reportId: request.reportId,
		brandName: state.brandName,
		outputLanguage: state.outputLanguage,
		scopeKey: request.scope.keyExact,
		promptCount: state.promptCount,
		competitorCount: state.competitorCount,
		target: request.execution.targets[0],
		expectedRuns: DATABASE_REPORT_EXPECTED_RUNS,
		status: state.status,
		actualRuns: state.actualRuns,
		createdAt: state.createdAt,
		completedAt: state.completedAt,
		updatedAt: state.updatedAt,
	};
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, keys: string[]): boolean {
	const actual = Object.keys(value).sort();
	const expected = [...keys].sort();
	return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

export function parseDatabaseReportCliOptions(argv: string[]): DatabaseReportCliOptions {
	let requestFile: string | undefined;
	let apply = false;
	let statusOnly = false;

	for (let index = 0; index < argv.length; index++) {
		const argument = argv[index];
		if (argument === "--apply" || argument === "--status-only") {
			if (argument === "--apply") {
				if (apply) throw new DatabaseReportRequestError("duplicate_option", "An option was supplied more than once");
				apply = true;
			} else {
				if (statusOnly) {
					throw new DatabaseReportRequestError("duplicate_option", "An option was supplied more than once");
				}
				statusOnly = true;
			}
			continue;
		}
		if (argument !== "--request-file") {
			throw new DatabaseReportRequestError("unknown_option", "Unknown option");
		}
		if (requestFile !== undefined) {
			throw new DatabaseReportRequestError("duplicate_option", "An option was supplied more than once");
		}
		const value = argv[index + 1];
		if (!value || value.startsWith("--")) {
			throw new DatabaseReportRequestError("missing_request_file", "--request-file requires a value");
		}
		requestFile = value;
		index++;
	}

	if (!requestFile) {
		throw new DatabaseReportRequestError("request_file_required", "--request-file is required");
	}
	if (apply && statusOnly) {
		throw new DatabaseReportRequestError("conflicting_mode", "--apply cannot be combined with --status-only");
	}
	return { requestFile, mode: statusOnly ? "status-only" : apply ? "apply" : "dry-run" };
}

export function parseDatabaseReportRequest(value: unknown): DatabaseReportRequest {
	if (
		!isRecord(value) ||
		!exactKeys(value, ["schemaVersion", "requestId", "reportId", "brand", "scope", "promptSelection", "execution"])
	) {
		throw new DatabaseReportRequestError("invalid_manifest_shape", "The request manifest has an invalid shape");
	}
	if (value.schemaVersion !== 1) {
		throw new DatabaseReportRequestError("unsupported_manifest_version", "The request manifest version is unsupported");
	}
	if (typeof value.requestId !== "string" || !REQUEST_ID_PATTERN.test(value.requestId)) {
		throw new DatabaseReportRequestError("invalid_request_id", "The request ID is invalid");
	}
	if (typeof value.reportId !== "string" || !UUID_PATTERN.test(value.reportId)) {
		throw new DatabaseReportRequestError("invalid_report_id", "The report ID must be an explicit RFC UUID");
	}

	const brand = value.brand;
	if (!isRecord(brand)) {
		throw new DatabaseReportRequestError("invalid_brand_selector", "The brand selector is invalid");
	}
	const hasName =
		exactKeys(brand, ["nameExact"]) && typeof brand.nameExact === "string" && brand.nameExact.trim() !== "";
	const hasId = exactKeys(brand, ["idExact"]) && typeof brand.idExact === "string" && brand.idExact.trim() !== "";
	if (hasName === hasId) {
		throw new DatabaseReportRequestError(
			"invalid_brand_selector",
			"The manifest must contain exactly one exact brand selector",
		);
	}

	if (
		!isRecord(value.scope) ||
		!exactKeys(value.scope, ["keyExact"]) ||
		value.scope.keyExact !== DATABASE_REPORT_SCOPE_KEY
	) {
		throw new DatabaseReportRequestError(
			"invalid_scope",
			`The request must target the ${DATABASE_REPORT_SCOPE_KEY} scope exactly`,
		);
	}
	if (
		!isRecord(value.promptSelection) ||
		!exactKeys(value.promptSelection, ["limit", "preferUnbranded"]) ||
		value.promptSelection.limit !== 1 ||
		value.promptSelection.preferUnbranded !== true
	) {
		throw new DatabaseReportRequestError(
			"invalid_prompt_selection",
			"Database report requests must select one deterministic unbranded-first prompt",
		);
	}
	if (
		!isRecord(value.execution) ||
		!exactKeys(value.execution, ["targets", "runsPerTarget"]) ||
		!Array.isArray(value.execution.targets) ||
		value.execution.targets.length !== 1 ||
		value.execution.targets[0] !== DATABASE_REPORT_TARGET ||
		value.execution.runsPerTarget !== 1
	) {
		throw new DatabaseReportRequestError(
			"invalid_execution_budget",
			"The request manifest exceeds the fixed one-target, one-run execution budget",
		);
	}

	return {
		schemaVersion: 1,
		requestId: value.requestId,
		reportId: value.reportId.toLowerCase(),
		brand: hasName ? { nameExact: (brand.nameExact as string).trim() } : { idExact: (brand.idExact as string).trim() },
		scope: { keyExact: DATABASE_REPORT_SCOPE_KEY },
		promptSelection: { limit: 1, preferUnbranded: true },
		execution: { targets: [DATABASE_REPORT_TARGET], runsPerTarget: 1 },
	};
}

export function selectExactlyOne<T>(rows: T[], notFoundCode: string, ambiguousCode: string, entityName: string): T {
	if (rows.length === 0) {
		throw new DatabaseReportRequestError(notFoundCode, `No ${entityName} matched the exact selector`);
	}
	if (rows.length !== 1) {
		throw new DatabaseReportRequestError(ambiguousCode, `More than one ${entityName} matched the exact selector`);
	}
	return rows[0] as T;
}

export type PromptCandidate = {
	id: string;
	value: string;
	tags: string[];
	systemTags: string[];
	createdAt: Date;
};

function candidateIsBranded(candidate: PromptCandidate, brandName: string, brandWebsite: string): boolean {
	const classificationTags = [...candidate.tags, ...candidate.systemTags].map((tag) => tag.toLowerCase());
	if (classificationTags.includes("branded") || classificationTags.includes("unbranded")) {
		return getEffectiveBrandedStatus(candidate.systemTags, candidate.tags).isBranded;
	}
	return isPromptBranded(candidate.value, brandName, brandWebsite);
}

/** Prefer effectively unbranded prompts, then oldest creation time and UUID. */
export function selectDeterministicPrompt(
	candidates: PromptCandidate[],
	brandName: string,
	brandWebsite: string,
): PromptCandidate {
	const selected = [...candidates].sort((left, right) => {
		const brandedDifference =
			Number(candidateIsBranded(left, brandName, brandWebsite)) -
			Number(candidateIsBranded(right, brandName, brandWebsite));
		if (brandedDifference !== 0) return brandedDifference;
		const timeDifference = left.createdAt.getTime() - right.createdAt.getTime();
		if (timeDifference !== 0) return timeDifference;
		return left.id.localeCompare(right.id);
	})[0];
	if (!selected) {
		throw new DatabaseReportRequestError("prompt_not_found", "The selected scope has no enabled prompts");
	}
	return selected;
}

export function assertExistingReportMatches(
	existing: { brandName: string; brandWebsite: string; outputLanguage: string },
	expected: { brandName: string; brandWebsite: string; outputLanguage: typeof DATABASE_REPORT_OUTPUT_LANGUAGE },
): void {
	if (
		existing.brandName !== expected.brandName ||
		existing.brandWebsite !== expected.brandWebsite ||
		existing.outputLanguage !== expected.outputLanguage
	) {
		throw new DatabaseReportRequestError(
			"report_id_conflict",
			"The report UUID already belongs to a different frozen snapshot",
		);
	}
}

export type DatabaseReportCompletionAssessment = {
	healthy: boolean;
	promptCount: number | null;
	competitorCount: number | null;
	actualRuns: number | null;
};

export function assessDatabaseReportCompletion(input: {
	status: string;
	completedAt: Date | null;
	rawOutput: unknown;
	outputLanguage: string;
}): DatabaseReportCompletionAssessment {
	let promptCount: number | null = null;
	let competitorCount: number | null = null;
	let actualRuns: number | null = null;
	let outputValid = false;
	if (input.rawOutput !== null) {
		try {
			const output = parseGeneratedReportOutput(input.rawOutput);
			promptCount = output.prompts.length;
			competitorCount = output.competitors.length;
			actualRuns = output.promptRuns.reduce((total, promptRun) => total + promptRun.runs.length, 0);
			outputValid = true;
		} catch {
			// Malformed output is unhealthy and remains opaque to the operation receipt.
		}
	}
	return {
		healthy:
			input.outputLanguage === DATABASE_REPORT_OUTPUT_LANGUAGE &&
			input.status === "completed" &&
			input.completedAt !== null &&
			outputValid &&
			promptCount === 1 &&
			competitorCount !== null &&
			competitorCount > 0 &&
			actualRuns === DATABASE_REPORT_EXPECTED_RUNS,
		promptCount,
		competitorCount,
		actualRuns,
	};
}
