import type { CollectedCitation, SearchEvidenceContract } from "./contracts";
import { normalizeCitationTitle, type StructuredSearchEvidence, type VisibleTextReader } from "./search-evidence";

const CITATION_URL_MAX_CHARACTERS = 10_000;

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
	wait?: (milliseconds: number) => Promise<void>;
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

export function visibleCitationFromElement(element: Element, readVisibleText: VisibleTextReader): CollectedCitation {
	if (element.tagName.toLocaleLowerCase("en-US") !== "a") throw new Error("Citation candidate is not a link");
	const rawUrl = element.getAttribute("href");
	if (!rawUrl) throw new Error("Citation link has no URL");
	const url = new URL(rawUrl);
	if (
		(url.protocol !== "http:" && url.protocol !== "https:") ||
		url.username ||
		url.password ||
		url.href.length > CITATION_URL_MAX_CHARACTERS
	) {
		throw new Error("Citation URL is invalid");
	}
	const title = readVisibleText(element).trim();
	if (!title) throw new Error("Citation link has no visible title");
	return { url: url.href, title: normalizeCitationTitle(title) };
}

export function visibleCitationFromJsonAttribute(
	element: Element,
	attributeName: string,
	urlKey: string,
	titleKey: string,
	readVisibleText: VisibleTextReader,
): CollectedCitation {
	if (!readVisibleText(element).trim()) throw new Error("Structured citation has no visible source row");
	const rawMetadata = element.getAttribute(attributeName);
	if (!rawMetadata) throw new Error("Structured citation metadata is missing");
	let metadata: unknown;
	try {
		metadata = JSON.parse(rawMetadata);
	} catch {
		throw new Error("Structured citation metadata is invalid JSON");
	}
	if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
		throw new Error("Structured citation metadata is invalid");
	}
	const record = metadata as Record<string, unknown>;
	const rawUrl = record[urlKey];
	const rawTitle = record[titleKey];
	if (typeof rawUrl !== "string" || typeof rawTitle !== "string") {
		throw new Error("Structured citation URL or title is missing");
	}
	return citationFromMetadataValues(rawUrl, rawTitle);
}

export function citationFromMetadataValues(rawUrl: string, rawTitle: string): CollectedCitation {
	const url = new URL(rawUrl);
	if (
		(url.protocol !== "http:" && url.protocol !== "https:") ||
		url.username ||
		url.password ||
		url.href.length > CITATION_URL_MAX_CHARACTERS
	) {
		throw new Error("Structured citation URL is invalid");
	}
	return { url: url.href, title: normalizeCitationTitle(rawTitle) };
}

export async function withRestoredDisclosureCandidates<Result>(options: {
	context: SearchEvidenceReadContext;
	disclosure: Element;
	root: ParentNode;
	candidateSelector: string;
	allowInitiallyVisible?: boolean;
	read: (candidates: Element[]) => Result;
}): Promise<Result> {
	const { context, disclosure, root, candidateSelector, allowInitiallyVisible = false, read } = options;
	const visibleCandidates = () => [...root.querySelectorAll(candidateSelector)].filter(context.isVisible);
	const initialCandidates = visibleCandidates();
	if (initialCandidates.length > 0) {
		if (!allowInitiallyVisible) throw new Error("A pre-existing source disclosure is ambiguous");
		return read(initialCandidates);
	}
	const clickable = disclosure as Element & { click?: () => void };
	if (typeof clickable.click !== "function") throw new Error("Source disclosure is not clickable");
	clickable.click();
	let revealed: Element[] = [];
	let result: Result | undefined;
	let failed = false;
	let failure: unknown;
	try {
		for (let attempt = 0; attempt < 15; attempt += 1) {
			revealed = visibleCandidates();
			if (revealed.length > 0) break;
			await (context.wait?.(100) ?? Promise.resolve());
		}
		if (revealed.length === 0) throw new Error("Source disclosure did not reveal evidence");
		result = read(revealed);
	} catch (error) {
		failed = true;
		failure = error;
	}
	clickable.click();
	for (let attempt = 0; attempt < 15 && visibleCandidates().length > 0; attempt += 1) {
		await (context.wait?.(100) ?? Promise.resolve());
	}
	if (visibleCandidates().length > 0) throw new Error("Source disclosure did not restore its prior state");
	if (failed) throw failure;
	return result as Result;
}
