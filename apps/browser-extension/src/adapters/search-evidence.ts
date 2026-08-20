import type { CollectedCitation, CompletionDomState, SearchEvidenceContract } from "./contracts";

const QUERY_MAX_COUNT = 32;
const QUERY_MAX_CHARACTERS = 2_000;
const CITATION_MAX_COUNT = 100;
const CITATION_URL_MAX_CHARACTERS = 10_000;
const CITATION_TITLE_MAX_CHARACTERS = 1_000;

export type StructuredSearchEvidence = {
	searchUsedCount: number;
	webQueries: string[];
	citations: CollectedCitation[];
};

export type VisibleTextReader = (element: Element) => string;

export type StructuredSearchQualification = {
	status: "qualified" | "no_answer" | "no_search_evidence" | "no_citation_evidence" | "page_drift";
	answerCount: number;
	queryCount: number;
	citationCount: number;
};

export function extractStructuredSearchEvidence(
	answer: Element,
	contract: SearchEvidenceContract | null,
	isContainerVisible: (element: Element) => boolean = isNotExplicitlyHidden,
	readVisibleText: VisibleTextReader = renderedText,
): StructuredSearchEvidence {
	if (!contract) return emptyEvidence();
	const containers = selectWithin(answer, contract.container).filter(isContainerVisible);
	if (containers.length === 0) return emptyEvidence();
	if (containers.length !== 1) throw evidenceError("the current answer has multiple search blocks");
	const container = containers[0];
	if (!container) throw evidenceError("the current search block disappeared");

	const summaryLine = readVisibleText(container)
		.split(/\r?\n/u)
		.map((line) => line.trim())
		.find(Boolean);
	if (!summaryLine) throw evidenceError("the search summary is missing");
	const summary = exactNamedMatch(summaryLine, contract.summaryTextPattern);
	const expectedQueryCount = safeCount(summary.groups?.queries, QUERY_MAX_COUNT, "query");
	const expectedCitationCount = safeCount(summary.groups?.citations, CITATION_MAX_COUNT, "citation");
	if (expectedQueryCount === 0) throw evidenceError("an observed search block has no query");

	const queryPattern = compilePattern(contract.queryTextPattern, "gu");
	const webQueries = selectWithin(container, contract.queryItem)
		.filter(isContainerVisible)
		.flatMap((element) =>
			[...readVisibleText(element).matchAll(queryPattern)].map((match) => (match.groups?.query ?? "").trim()),
		);
	if (
		webQueries.some((query) => !query || query.length > QUERY_MAX_CHARACTERS) ||
		webQueries.length !== expectedQueryCount ||
		new Set(webQueries.map(queryIdentity)).size !== webQueries.length
	) {
		throw evidenceError("the extracted query count does not match the search summary");
	}

	const citationPrefix = compilePattern(contract.citationTitlePrefixPattern, "u");
	const citationElements = selectWithin(container, contract.citationLink).filter(isContainerVisible);
	if (citationElements.length !== expectedCitationCount) {
		throw evidenceError("the extracted citation count does not match the search summary");
	}
	const citations = citationElements.map((element) => citationFromElement(element, citationPrefix, readVisibleText));
	if (new Set(citations.map((citation) => citation.url)).size !== citations.length) {
		throw evidenceError("the extracted citations are not uniquely identified by URL");
	}

	return { searchUsedCount: 1, webQueries, citations };
}

function queryIdentity(value: string): string {
	return value.normalize("NFKC").replace(/\s+/gu, " ").trim().toLocaleLowerCase("zh-CN");
}

export function inspectLatestStructuredSearchEvidence(
	document: Document,
	answerSelector: string,
	contract: SearchEvidenceContract | null,
	isAnswerVisible: (element: Element) => boolean,
	completionSelector: string | null = null,
	readVisibleText: VisibleTextReader = renderedText,
	generatingSelector: string | null = null,
	completionCompanionSelector: string | null = null,
): StructuredSearchQualification {
	let answers: Element[];
	try {
		answers = [...document.querySelectorAll(answerSelector)].filter(isAnswerVisible);
	} catch {
		return qualification("page_drift", 0);
	}
	const answer = answers.at(-1);
	if (!answer) return qualification("no_answer", 0);
	try {
		if (completionSelector) {
			if (
				!completionCompanionSelector ||
				inspectAnswerCompletionState(answer, completionSelector, completionCompanionSelector, isAnswerVisible) !==
					"bound"
			) {
				return qualification("page_drift", answers.length);
			}
		}
		if (generatingSelector && [...document.querySelectorAll(generatingSelector)].some(isAnswerVisible)) {
			return qualification("page_drift", answers.length);
		}
		const evidence = extractStructuredSearchEvidence(answer, contract, isAnswerVisible, readVisibleText);
		if (evidence.searchUsedCount === 0) return qualification("no_search_evidence", answers.length);
		if (evidence.citations.length === 0) return qualification("no_citation_evidence", answers.length);
		return {
			status: "qualified",
			answerCount: answers.length,
			queryCount: evidence.webQueries.length,
			citationCount: evidence.citations.length,
		};
	} catch {
		return qualification("page_drift", answers.length);
	}
}

function qualification(
	status: Exclude<StructuredSearchQualification["status"], "qualified">,
	answerCount: number,
): StructuredSearchQualification {
	return { status, answerCount, queryCount: 0, citationCount: 0 };
}

function emptyEvidence(): StructuredSearchEvidence {
	return { searchUsedCount: 0, webQueries: [], citations: [] };
}

function selectWithin(root: Element, selector: string): Element[] {
	try {
		return [...root.querySelectorAll(selector)];
	} catch {
		throw evidenceError("an approved selector is no longer valid CSS");
	}
}

function exactNamedMatch(value: string, pattern: string): RegExpMatchArray {
	const match = value.match(compilePattern(pattern, "u"));
	if (!match || match[0] !== value || !match.groups) {
		throw evidenceError("the search summary no longer matches the approved format");
	}
	return match;
}

function compilePattern(value: string, flags: string): RegExp {
	try {
		return new RegExp(value, flags);
	} catch {
		throw evidenceError("an approved text pattern is no longer valid");
	}
}

function safeCount(value: string | undefined, maximum: number, label: string): number {
	if (!value || !/^\d+$/u.test(value)) throw evidenceError(`the ${label} count is missing`);
	const count = Number(value);
	if (!Number.isSafeInteger(count) || count < 0 || count > maximum) {
		throw evidenceError(`the ${label} count is outside the approved range`);
	}
	return count;
}

function citationFromElement(
	element: Element,
	titlePrefix: RegExp,
	readVisibleText: VisibleTextReader,
): CollectedCitation {
	if (element.tagName.toLowerCase() !== "a") throw evidenceError("a citation candidate is not a link");
	const rawUrl = element.getAttribute("href");
	if (!rawUrl) throw evidenceError("a citation link has no URL");
	let url: URL;
	try {
		url = new URL(rawUrl);
	} catch {
		throw evidenceError("a citation URL is not absolute");
	}
	if ((url.protocol !== "http:" && url.protocol !== "https:") || url.username || url.password) {
		throw evidenceError("a citation URL is not a safe public HTTP URL");
	}
	if (url.href.length > CITATION_URL_MAX_CHARACTERS) {
		throw evidenceError("a citation URL exceeds the approved length");
	}
	const visibleTitle = readVisibleText(element).trim();
	if (!visibleTitle) throw evidenceError("a citation link has no visible title");
	const rawTitle = visibleTitle.replace(titlePrefix, "").trim();
	if (!rawTitle) throw evidenceError("a citation link has no visible title after its ordinal prefix");
	const title = normalizeCitationTitle(rawTitle);
	return { url: url.href, title };
}

export function inspectAnswerCompletionState(
	answer: Element,
	completionSelector: string,
	companionSelector: string,
	isVisible: (element: Element) => boolean,
): CompletionDomState {
	if (!answer.isConnected) return "missing";
	const document = answer.ownerDocument;
	const visibleCompletions = [...document.querySelectorAll(completionSelector)].filter(isVisible);
	if (visibleCompletions.length === 0) return "missing";

	const actionGroup = answer.nextElementSibling;
	if (!actionGroup || ["HTML", "BODY", "FOOTER"].includes(actionGroup.tagName) || !isVisible(actionGroup)) {
		return "unbound";
	}
	const completions = [...actionGroup.querySelectorAll(completionSelector)].filter(isVisible);
	const companions = [...actionGroup.querySelectorAll(companionSelector)].filter(isVisible);
	if (completions.length > 1 || companions.length > 1) return "ambiguous";
	return completions.length === 1 && companions.length === 1 ? "bound" : "unbound";
}

export function normalizeCitationTitle(value: string): string {
	const title = truncateUtf16(value.trim(), CITATION_TITLE_MAX_CHARACTERS);
	if (!title) throw new Error("Invalid citation title");
	return title;
}

function renderedText(element: Element): string {
	const innerText = (element as Element & { innerText?: unknown }).innerText;
	return (typeof innerText === "string" ? innerText : (element.textContent ?? "")).trim();
}

function isNotExplicitlyHidden(element: Element): boolean {
	const hiddenAncestor = element.closest('[hidden],[aria-hidden="true"]');
	if (hiddenAncestor) return false;
	const style = element.getAttribute("style")?.toLocaleLowerCase("en-US") ?? "";
	return !/(?:^|;)\s*(?:display\s*:\s*none|visibility\s*:\s*hidden)\s*(?:;|$)/u.test(style);
}

function truncateUtf16(value: string, maximum: number): string {
	if (value.length <= maximum) return value;
	let result = value.slice(0, maximum);
	const last = result.charCodeAt(result.length - 1);
	if (last >= 0xd800 && last <= 0xdbff) result = result.slice(0, -1);
	return result;
}

function evidenceError(message: string): Error {
	return new Error(`Doubao search evidence is invalid: ${message}`);
}
