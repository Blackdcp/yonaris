import type { CollectedCitation, SearchEvidenceContract } from "./contracts";
import type { StructuredSearchEvidence, VisibleTextReader } from "./search-evidence";

export type SearchEvidenceQueryAvailability = "exposed" | "unavailable" | "not_searched" | "unknown";

export type SearchEvidenceDiagnostics = {
	extractorVersion: string;
	evidenceSource: "dom" | "network" | "dom_and_network" | "none";
	searchBlockCount: number;
	queryCandidateCount: number;
	citationCandidateCount: number;
};

export type SearchEvidenceResult = {
	webSearchObserved: boolean | null;
	queryAvailability: SearchEvidenceQueryAvailability;
	webQueries: string[];
	citations: CollectedCitation[];
	diagnostics: SearchEvidenceDiagnostics;
};

export type SearchEvidenceReadContext = {
	acceptedAnswer: Element;
	document: Document;
	isVisible: (element: Element) => boolean;
	readVisibleText: VisibleTextReader;
	readStructuredEvidence: (contract: SearchEvidenceContract | null) => Promise<StructuredSearchEvidence>;
};

export interface SearchEvidenceAdapter {
	readonly version: string;
	read(context: SearchEvidenceReadContext): Promise<SearchEvidenceResult>;
}

export function createStructuredDomSearchEvidenceAdapter(
	version: string,
	contract: SearchEvidenceContract | null,
): SearchEvidenceAdapter {
	return {
		version,
		async read(context) {
			const evidence = await context.readStructuredEvidence(contract);
			const observed = evidence.searchUsedCount === 1 ? true : null;
			return {
				webSearchObserved: observed,
				queryAvailability: observed ? (evidence.webQueries.length > 0 ? "exposed" : "unavailable") : "unknown",
				webQueries: evidence.webQueries,
				citations: evidence.citations,
				diagnostics: {
					extractorVersion: version,
					evidenceSource: observed || evidence.citations.length > 0 ? "dom" : "none",
					searchBlockCount: evidence.searchUsedCount,
					queryCandidateCount: evidence.webQueries.length,
					citationCandidateCount: evidence.citations.length,
				},
			};
		},
	};
}

export function fallbackUnknownSearchEvidence(
	extractorVersion: string,
	citations: CollectedCitation[],
): SearchEvidenceResult {
	return {
		webSearchObserved: null,
		queryAvailability: "unknown",
		webQueries: [],
		citations,
		diagnostics: {
			extractorVersion,
			evidenceSource: "none",
			searchBlockCount: 0,
			queryCandidateCount: 0,
			citationCandidateCount: citations.length,
		},
	};
}

export function validateSearchEvidenceResult(
	value: SearchEvidenceResult,
	expectedVersion: string,
): SearchEvidenceResult {
	if (value.webSearchObserved !== true && value.webSearchObserved !== false && value.webSearchObserved !== null) {
		throw new Error("Search evidence observation is invalid");
	}
	if (value.diagnostics.extractorVersion !== expectedVersion) {
		throw new Error("Search evidence extractor version is invalid");
	}
	if (
		(value.queryAvailability === "exposed" && (value.webSearchObserved !== true || value.webQueries.length === 0)) ||
		(value.queryAvailability === "unavailable" &&
			(value.webSearchObserved !== true || value.webQueries.length !== 0)) ||
		(value.queryAvailability === "not_searched" &&
			(value.webSearchObserved !== false || value.webQueries.length !== 0)) ||
		(value.queryAvailability === "unknown" && (value.webSearchObserved !== null || value.webQueries.length !== 0))
	) {
		throw new Error("Search evidence availability is inconsistent");
	}
	if (
		!["dom", "network", "dom_and_network", "none"].includes(value.diagnostics.evidenceSource) ||
		![
			value.diagnostics.searchBlockCount,
			value.diagnostics.queryCandidateCount,
			value.diagnostics.citationCandidateCount,
		].every((count) => Number.isSafeInteger(count) && count >= 0 && count <= 10_000)
	) {
		throw new Error("Search evidence diagnostics are invalid");
	}
	return value;
}
