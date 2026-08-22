import contract from "../selector-contracts/wenxin-web-v1.json";
import { createConsumerAdapter } from "./consumer-adapter";
import type { ConsumerDomPort, ConsumerWebAdapter, SelectorContract } from "./contracts";
import {
	type SearchEvidenceAdapter,
	visibleCitationFromElement,
	visibleCitationFromJsonAttribute,
} from "./search-evidence-adapter";

const WENXIN_THINKING_BLOCK_SELECTOR = ".ai-entry-block.ai-thinking-steps";
const WENXIN_DISCLOSURE_SELECTOR = ".root-header";
const WENXIN_STEP_DISCLOSURE_SELECTOR = ".step-header";
const WENXIN_SEARCH_ICON_SELECTOR = ".cos-icon-search";
const WENXIN_CITATION_SELECTOR = ".ai-entry-block.ai-markdown .marklang a.marklang-link[href]";
const WENXIN_SOURCE_ITEM_SELECTOR = "[data-long-press-ext-info][data-long-press-menu][data-long-press-menu-buttons]";

export const wenxinSelectorContract = contract as SelectorContract;

export const wenxinSearchEvidenceAdapter: SearchEvidenceAdapter = {
	version: "wenxin-search-evidence-20260822-v5",
	settleTimeoutMs: 60_000,
	async read(context) {
		const thinkingBlocks = [...context.acceptedAnswer.querySelectorAll(WENXIN_THINKING_BLOCK_SELECTOR)].filter(
			context.isVisible,
		);
		if (thinkingBlocks.length > 1) throw new Error("Wenxin thinking evidence is ambiguous");
		const citationCandidates = [...context.acceptedAnswer.querySelectorAll(WENXIN_CITATION_SELECTOR)];
		const directCitations = citationCandidates
			.filter(context.isVisible)
			.map((element) => visibleCitationFromElement(element, context.readVisibleText));
		let structuredCitationCandidates: Element[] = [];
		let observed: boolean | null = null;
		let structuredCitations: ReturnType<typeof visibleCitationFromJsonAttribute>[] = [];
		const thinkingBlock = thinkingBlocks[0];
		if (thinkingBlock) {
			const disclosures = [...thinkingBlock.querySelectorAll(WENXIN_DISCLOSURE_SELECTOR)].filter(context.isVisible);
			if (disclosures.length > 1) throw new Error("Wenxin search disclosure is ambiguous");
			const searchObserved = [...thinkingBlock.querySelectorAll(WENXIN_SEARCH_ICON_SELECTOR)].some(context.isVisible);
			if (disclosures.length === 1) {
				const disclosed = await withRestoredWenxinSourceCandidates(
					context,
					thinkingBlock,
					disclosures[0] as Element,
					searchObserved,
					(candidates) => ({
						candidates,
						citations: candidates.map((element) =>
							visibleCitationFromJsonAttribute(
								element,
								"data-long-press-ext-info",
								"link",
								"linkTitle",
								context.readVisibleText,
							),
						),
					}),
				);
				observed = disclosed.observed ? true : null;
				structuredCitationCandidates = disclosed.candidates;
				structuredCitations = disclosed.citations;
			}
		}
		const citations = [...directCitations, ...structuredCitations];
		return {
			webSearchObserved: observed,
			queryAvailability: observed ? "unavailable" : "unknown",
			webQueries: [],
			citations,
			diagnostics: {
				extractorVersion: wenxinSearchEvidenceAdapter.version,
				evidenceSource: observed || citations.length > 0 ? "dom" : "none",
				searchBlockCount: observed ? 1 : 0,
				queryCandidateCount: 0,
				citationCandidateCount: citationCandidates.length + structuredCitationCandidates.length,
			},
		};
	},
};

async function withRestoredWenxinSourceCandidates<Result extends { candidates: Element[] }>(
	context: Parameters<SearchEvidenceAdapter["read"]>[0],
	thinkingBlock: Element,
	rootDisclosure: Element,
	searchIconObserved: boolean,
	read: (candidates: Element[]) => Result,
): Promise<Result & { observed: boolean }> {
	const visibleCandidates = () =>
		[...thinkingBlock.querySelectorAll(WENXIN_SOURCE_ITEM_SELECTOR)].filter(context.isVisible);
	const sourceSteps = () =>
		[...thinkingBlock.querySelectorAll(WENXIN_STEP_DISCLOSURE_SELECTOR)].filter((header) =>
			header.parentElement?.querySelector(WENXIN_SOURCE_ITEM_SELECTOR),
		);
	const nestedSearchCount = (step: Element | undefined): number | null => {
		if (!step || !context.isVisible(step)) return null;
		const match = context
			.readVisibleText(step)
			.trim()
			.match(/^搜索全球(?<citations>\d{1,3})篇资料$/u);
		if (!match?.groups?.citations) throw new Error("Wenxin nested search summary changed");
		return Number(match.groups.citations);
	};
	const validateCandidates = (candidates: Element[], step: Element | undefined): boolean => {
		const expectedCount = nestedSearchCount(step);
		if (expectedCount !== null && expectedCount !== candidates.length) {
			throw new Error("Wenxin nested search source count changed");
		}
		return searchIconObserved || expectedCount !== null;
	};
	const initialCandidates = visibleCandidates();
	if (initialCandidates.length > 0) {
		const step = sourceSteps().filter(context.isVisible)[0];
		return { ...read(initialCandidates), observed: validateCandidates(initialCandidates, step) };
	}

	let rootOpened = false;
	let stepOpened = false;
	let result: Result | undefined;
	let failure: unknown;
	try {
		let steps = sourceSteps();
		if (steps.length > 1) throw new Error("Wenxin nested search disclosure is ambiguous");
		if (!steps[0] || !context.isVisible(steps[0])) {
			clickDisclosure(rootDisclosure, "root");
			rootOpened = true;
			await waitForWenxinEvidenceState(
				context,
				() => visibleCandidates().length > 0 || sourceSteps().some(context.isVisible),
			);
		}
		let candidates = visibleCandidates();
		if (candidates.length === 0) {
			steps = sourceSteps().filter(context.isVisible);
			if (steps.length !== 1) throw new Error("Wenxin nested search disclosure is incomplete or ambiguous");
			clickDisclosure(steps[0] as Element, "search step");
			stepOpened = true;
			await waitForWenxinEvidenceState(context, () => visibleCandidates().length > 0);
			candidates = visibleCandidates();
		}
		if (candidates.length === 0) throw new Error("Wenxin search disclosure did not reveal evidence");
		const step = sourceSteps().filter(context.isVisible)[0];
		result = { ...read(candidates), observed: validateCandidates(candidates, step) } as Result;
	} catch (error) {
		failure = error;
	}
	if (stepOpened || rootOpened) {
		await waitForWenxinEvidenceLayoutToSettle(context, thinkingBlock);
	}
	if (stepOpened) {
		const steps = sourceSteps().filter(context.isVisible);
		if (steps.length !== 1) throw new Error("Wenxin nested search disclosure could not be restored");
		clickDisclosure(steps[0] as Element, "search step");
		await waitForWenxinEvidenceState(context, () => visibleCandidates().length === 0);
		await waitForWenxinEvidenceLayoutToSettle(context, thinkingBlock);
	}
	if (rootOpened) {
		clickDisclosure(rootDisclosure, "root");
		await waitForWenxinEvidenceState(context, () => sourceSteps().every((step) => !context.isVisible(step)));
		await waitForWenxinEvidenceLayoutToSettle(context, thinkingBlock);
	}
	if (failure) throw failure;
	return result as Result & { observed: boolean };
}

function clickDisclosure(element: Element, label: string): void {
	const liveClickTargets = [...element.querySelectorAll(":scope > [class*='_could-expand_']")];
	if (liveClickTargets.length > 1) throw new Error(`Wenxin ${label} disclosure target is ambiguous`);
	const clickable = (liveClickTargets[0] ?? element) as Element & { click?: () => void };
	if (typeof clickable.click !== "function") throw new Error(`Wenxin ${label} disclosure is not clickable`);
	clickable.click();
}

async function waitForWenxinEvidenceState(
	context: Parameters<SearchEvidenceAdapter["read"]>[0],
	predicate: () => boolean,
): Promise<void> {
	for (let attempt = 0; attempt < 15; attempt += 1) {
		if (predicate()) return;
		await (context.wait?.(100) ?? Promise.resolve());
	}
	throw new Error("Wenxin search disclosure did not reach the expected state");
}

async function waitForWenxinEvidenceLayoutToSettle(
	context: Parameters<SearchEvidenceAdapter["read"]>[0],
	thinkingBlock: Element,
): Promise<void> {
	let previousSignature: string | undefined;
	for (let attempt = 0; attempt < 15; attempt += 1) {
		await (context.wait?.(100) ?? Promise.resolve());
		const signature = [...thinkingBlock.querySelectorAll("main")]
			.map((element) => {
				const rect = element.getBoundingClientRect();
				return [rect.left, rect.top, rect.width, rect.height].map((value) => Math.round(value)).join(":");
			})
			.join("|");
		if (signature === previousSignature) return;
		previousSignature = signature;
	}
	throw new Error("Wenxin search disclosure layout did not settle");
}

export function createWenxinAdapter(port: ConsumerDomPort): ConsumerWebAdapter {
	return createConsumerAdapter(port, wenxinSelectorContract, wenxinSearchEvidenceAdapter);
}
