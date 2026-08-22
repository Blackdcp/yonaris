import {
	browserExtensionSurfaceDefinition,
	type BrowserExtensionSurface,
} from "@workspace/lib/browser-extension-surfaces";
import { isDomElementVisible } from "./dom-port";

const MAXIMUM_CANDIDATES = 200;
const SAFE_TOKEN = /^[\p{L}_][\p{L}\p{N}_-]{0,79}$/u;
const STRUCTURAL_TEXT = /搜索|联网|资料|来源|引用|参考|网页|search|source|citation|reference/giu;

export type SearchEvidenceProbeInput = {
	surface: BrowserExtensionSurface;
	answerSelector: string;
	candidateTextPattern: string;
	maximumCandidates: number;
	pageUrl: string;
};

export type SearchEvidenceProbeCandidate = {
	relation: "inside_latest_answer" | "adjacent_to_latest_answer" | "page_other";
	tag: string;
	role: string | null;
	classTokens: string[];
	ariaNames: string[];
	dataAttributeNames: string[];
	hrefHostname: string | null;
	visible: boolean;
	textCategory: "search" | "source" | "citation" | "reference" | "unknown";
	textLength: number;
	textSha256: string;
};

export type SearchEvidenceProbeReport = {
	schemaVersion: 1;
	surface: BrowserExtensionSurface;
	adapterVersion: string;
	pageUrlShape: string;
	answerCount: number;
	candidates: SearchEvidenceProbeCandidate[];
	truncated: boolean;
};

export async function probeSearchEvidenceCandidates(
	document: Document,
	input: SearchEvidenceProbeInput,
): Promise<SearchEvidenceProbeReport> {
	const pattern = approvedPattern(input.candidateTextPattern);
	let answers: Element[];
	try {
		answers = [...document.querySelectorAll(input.answerSelector)].filter(isDomElementVisible);
	} catch {
		throw new Error("Approved answer selector is no longer valid CSS");
	}
	const latestAnswer = answers.at(-1) ?? null;
	const previous = latestAnswer?.previousElementSibling ?? null;
	const next = latestAnswer?.nextElementSibling ?? null;
	const elements = [...document.querySelectorAll("*")].filter(
		(element) =>
			isCandidateControl(element) ||
			pattern.test(normalizedText(element)) ||
			(element === latestAnswer && pattern.test(normalizedText(element))),
	);
	const relevant = elements.filter((element) => {
		if (latestAnswer?.contains(element)) return true;
		if (previous?.contains(element) || next?.contains(element)) return true;
		return (
			pattern.test(normalizedText(element)) ||
			[element.getAttribute("aria-label"), element.getAttribute("aria-description")].some(
				(value) => value !== null && pattern.test(value),
			)
		);
	});
	const maximum = Math.max(1, Math.min(MAXIMUM_CANDIDATES, Math.trunc(input.maximumCandidates)));
	const selected = relevant.slice(0, maximum);
	const candidates = await Promise.all(
		selected.map((element) => candidateFromElement(element, latestAnswer, previous, next, input.pageUrl)),
	);

	return {
		schemaVersion: 1,
		surface: input.surface,
		adapterVersion: browserExtensionSurfaceDefinition(input.surface).adapterVersion,
		pageUrlShape: pageUrlShape(input.pageUrl),
		answerCount: answers.length,
		candidates,
		truncated: relevant.length > selected.length,
	};
}

function approvedPattern(value: string): RegExp {
	if (!value.trim() || value.length > 500) throw new Error("Search-evidence probe pattern is invalid");
	try {
		return new RegExp(value, "iu");
	} catch {
		throw new Error("Search-evidence probe pattern is invalid");
	}
}

function isCandidateControl(element: Element): boolean {
	const tag = element.tagName.toLowerCase();
	return tag === "a" || tag === "button" || element.hasAttribute("role");
}

async function candidateFromElement(
	element: Element,
	latestAnswer: Element | null,
	previous: Element | null,
	next: Element | null,
	pageUrl: string,
): Promise<SearchEvidenceProbeCandidate> {
	const text = normalizedText(element);
	return {
		relation: relationToAnswer(element, latestAnswer, previous, next),
		tag: element.tagName.toLowerCase(),
		role: safeRole(element.getAttribute("role")),
		classTokens: [...element.classList].filter((token) => SAFE_TOKEN.test(token)).sort().slice(0, 20),
		ariaNames: safeAriaNames(element),
		dataAttributeNames: element
			.getAttributeNames()
			.filter((name) => name.startsWith("data-") && SAFE_TOKEN.test(name))
			.sort()
			.slice(0, 20),
		hrefHostname: hrefHostname(element, pageUrl),
		visible: isDomElementVisible(element),
		textCategory: categorizeText(text),
		textLength: text.length,
		textSha256: await sha256(text),
	};
}

function relationToAnswer(
	element: Element,
	latestAnswer: Element | null,
	previous: Element | null,
	next: Element | null,
): SearchEvidenceProbeCandidate["relation"] {
	if (latestAnswer?.contains(element)) return "inside_latest_answer";
	if (previous?.contains(element) || next?.contains(element)) return "adjacent_to_latest_answer";
	return "page_other";
}

function normalizedText(element: Element): string {
	return (element.textContent ?? "").normalize("NFKC").replace(/\s+/gu, " ").trim();
}

function safeRole(value: string | null): string | null {
	const role = value?.trim().toLocaleLowerCase("en-US") ?? "";
	return SAFE_TOKEN.test(role) ? role : null;
}

function safeAriaNames(element: Element): string[] {
	const values = [element.getAttribute("aria-label"), element.getAttribute("aria-description")];
	const names = new Set<string>();
	for (const value of values) {
		if (!value) continue;
		for (const match of value.normalize("NFKC").matchAll(STRUCTURAL_TEXT)) {
			const token = match[0]?.toLocaleLowerCase("en-US");
			if (token) names.add(token);
		}
	}
	return [...names].sort();
}

function hrefHostname(element: Element, pageUrl: string): string | null {
	const href = element.getAttribute("href");
	if (!href) return null;
	try {
		const url = new URL(href, pageUrl);
		if ((url.protocol !== "http:" && url.protocol !== "https:") || url.username || url.password) return null;
		return url.hostname.replace(/^www\./, "").toLowerCase();
	} catch {
		return null;
	}
}

function categorizeText(text: string): SearchEvidenceProbeCandidate["textCategory"] {
	if (/citation|引用/iu.test(text)) return "citation";
	if (/source|来源|资料/iu.test(text)) return "source";
	if (/reference|参考/iu.test(text)) return "reference";
	if (/search|搜索|联网|网页/iu.test(text)) return "search";
	return "unknown";
}

async function sha256(value: string): Promise<string> {
	const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
	return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function pageUrlShape(value: string): string {
	const url = new URL(value);
	if (url.protocol !== "https:" || url.username || url.password) throw new Error("Probe page URL is not approved");
	const segments = url.pathname.split("/").filter(Boolean);
	const path = segments.length > 0 ? `/${segments.map(() => ":segment").join("/")}` : "/";
	const keys = [...new Set([...url.searchParams.keys()].filter((key) => SAFE_TOKEN.test(key)))].sort();
	return `${url.origin}${path}${keys.length > 0 ? `?${keys.join("&")}` : ""}`;
}
