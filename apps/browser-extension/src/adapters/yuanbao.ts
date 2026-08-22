import contract from "../selector-contracts/yuanbao-web-v2.json";
import { createConsumerAdapter } from "./consumer-adapter";
import type { ConsumerDomPort, ConsumerWebAdapter, SelectorContract } from "./contracts";
import {
	citationFromMetadataValues,
	type SearchEvidenceAdapter,
	type SearchEvidenceReadContext,
	visibleCitationFromElement,
} from "./search-evidence-adapter";

const YUANBAO_REFERENCE_LIST_SELECTOR = ".hyc-common-markdown__ref-list";
const YUANBAO_REFERENCE_TRIGGER_SELECTOR = ".hyc-common-markdown__ref-list__trigger[data-idx-list]";
const YUANBAO_REFERENCE_POPUP_SELECTOR = ".hyc-common-markdown__ref-list__popup";
const YUANBAO_REFERENCE_CARD_SELECTOR = ".hyc-common-markdown__ref_card[data-idx][data-url]";
const YUANBAO_REFERENCE_TITLE_SELECTOR = ".hyc-common-markdown__ref_card-title";
const YUANBAO_CITATION_SELECTOR = "a[href]";

export const yuanbaoSelectorContract = contract as SelectorContract;

export const yuanbaoSearchEvidenceAdapter: SearchEvidenceAdapter = {
	version: "yuanbao-search-evidence-20260822-v3",
	settleTimeoutMs: 60_000,
	async read(context) {
		const referenceLists = [...context.acceptedAnswer.querySelectorAll(YUANBAO_REFERENCE_LIST_SELECTOR)].filter(
			context.isVisible,
		);
		const citationCandidates = [...context.acceptedAnswer.querySelectorAll(YUANBAO_CITATION_SELECTOR)];
		const citations = citationCandidates.filter(context.isVisible).flatMap((element) => {
			try {
				return [visibleCitationFromElement(element, context.readVisibleText)];
			} catch {
				return [];
			}
		});
		const observed = referenceLists.length > 0 ? true : null;
		const referenceTriggers = referenceLists.flatMap((referenceList) =>
			[...referenceList.querySelectorAll(YUANBAO_REFERENCE_TRIGGER_SELECTOR)].filter(context.isVisible),
		);
		if (observed && referenceTriggers.length !== referenceLists.length) {
			throw new Error("Yuanbao reference-list triggers are incomplete or ambiguous");
		}
		const structuredCitations = observed ? await readYuanbaoReferenceCitations(context, referenceTriggers) : [];
		const allCitations = [...citations, ...structuredCitations];
		return {
			webSearchObserved: observed,
			queryAvailability: observed ? "unavailable" : "unknown",
			webQueries: [],
			citations: allCitations,
			diagnostics: {
				extractorVersion: yuanbaoSearchEvidenceAdapter.version,
				evidenceSource: observed || allCitations.length > 0 ? "dom" : "none",
				searchBlockCount: referenceLists.length,
				queryCandidateCount: 0,
				citationCandidateCount: citationCandidates.length + structuredCitations.length,
			},
		};
	},
};

async function readYuanbaoReferenceCitations(
	context: SearchEvidenceReadContext,
	referenceTriggers: Element[],
): Promise<ReturnType<typeof citationFromMetadataValues>[]> {
	const citationsByIndex = new Map<number, ReturnType<typeof citationFromMetadataValues>>();
	for (const trigger of referenceTriggers) {
		const expectedIndices = parseReferenceIndices(trigger.getAttribute("data-idx-list"));
		const disclosed = await readYuanbaoReferenceCarousel(context, trigger, expectedIndices);
		for (const { index, citation } of disclosed) {
			const existing = citationsByIndex.get(index);
			if (existing && (existing.url !== citation.url || existing.title !== citation.title)) {
				throw new Error("Yuanbao source metadata changed between reference markers");
			}
			if (!existing) citationsByIndex.set(index, citation);
		}
	}
	return [...citationsByIndex.values()];
}

function parseReferenceIndices(rawValue: string | null): number[] {
	if (!rawValue) throw new Error("Yuanbao reference marker has no source indices");
	const indices = [...rawValue.matchAll(/\d+/gu)].map((match) => Number(match[0]));
	if (
		indices.length === 0 ||
		indices.some((index) => !Number.isSafeInteger(index) || index <= 0 || index > 10_000) ||
		new Set(indices).size !== indices.length
	) {
		throw new Error("Yuanbao reference marker source indices are invalid");
	}
	return indices;
}

async function readYuanbaoReferenceCarousel(
	context: SearchEvidenceReadContext,
	trigger: Element,
	expectedIndices: number[],
): Promise<Array<{ index: number; citation: ReturnType<typeof citationFromMetadataValues> }>> {
	dispatchHoverEvent(context.document, trigger, "mouseover", true);
	dispatchHoverEvent(context.document, trigger, "mouseenter", false);
	let popup: Element | null = null;
	try {
		popup = await waitForMatchingPopup(context, expectedIndices[0] as number);
		const citations = [];
		for (let position = 0; position < expectedIndices.length; position += 1) {
			const expectedIndex = expectedIndices[position] as number;
			const card = await waitForCarouselCard(context, popup, expectedIndex);
			citations.push({ index: expectedIndex, citation: citationFromYuanbaoCard(card) });
			if (position < expectedIndices.length - 1) {
				clickUniqueCarouselButton(popup, ".icon-arrow-right", "next");
			}
		}
		for (let position = expectedIndices.length - 2; position >= 0; position -= 1) {
			clickUniqueCarouselButton(popup, ".icon-arrow-left", "previous");
			await waitForCarouselCard(context, popup, expectedIndices[position] as number);
		}
		return citations;
	} finally {
		dispatchHoverEvent(context.document, trigger, "mouseout", true);
		dispatchHoverEvent(context.document, trigger, "mouseleave", false);
		await (context.wait?.(100) ?? Promise.resolve());
	}
}

function dispatchHoverEvent(document: Document, target: Element, type: string, bubbles: boolean): void {
	const EventConstructor = document.defaultView?.MouseEvent ?? document.defaultView?.Event;
	if (!EventConstructor) throw new Error("Yuanbao source disclosure events are unavailable");
	target.dispatchEvent(new EventConstructor(type, { bubbles, composed: true }));
}

async function waitForMatchingPopup(context: SearchEvidenceReadContext, expectedIndex: number): Promise<Element> {
	for (let attempt = 0; attempt < 15; attempt += 1) {
		const matching = [...context.document.querySelectorAll(YUANBAO_REFERENCE_POPUP_SELECTOR)].filter((popup) => {
			const cards = [...popup.querySelectorAll(YUANBAO_REFERENCE_CARD_SELECTOR)];
			return cards.length === 1 && Number(cards[0]?.getAttribute("data-idx")) === expectedIndex;
		});
		if (matching.length > 1) throw new Error("Yuanbao source disclosure is ambiguous");
		if (matching[0]) return matching[0];
		await (context.wait?.(100) ?? Promise.resolve());
	}
	throw new Error("Yuanbao source disclosure did not reveal the expected source");
}

async function waitForCarouselCard(
	context: SearchEvidenceReadContext,
	popup: Element,
	expectedIndex: number,
): Promise<Element> {
	for (let attempt = 0; attempt < 15; attempt += 1) {
		const cards = [...popup.querySelectorAll(YUANBAO_REFERENCE_CARD_SELECTOR)];
		if (cards.length > 1) throw new Error("Yuanbao source carousel is ambiguous");
		if (cards.length === 1 && Number(cards[0]?.getAttribute("data-idx")) === expectedIndex) {
			return cards[0] as Element;
		}
		await (context.wait?.(100) ?? Promise.resolve());
	}
	throw new Error("Yuanbao source carousel did not advance to the expected source");
}

function clickUniqueCarouselButton(popup: Element, iconSelector: string, direction: string): void {
	const buttons = [
		...new Set(
			[...popup.querySelectorAll(iconSelector)]
				.map((icon) => icon.closest("button"))
				.filter((button): button is HTMLButtonElement => button !== null),
		),
	];
	if (buttons.length !== 1 || buttons[0]?.matches(":disabled") || buttons[0]?.classList.contains("t-is-disabled")) {
		throw new Error(`Yuanbao source carousel ${direction} control is unavailable`);
	}
	buttons[0].click();
}

function citationFromYuanbaoCard(card: Element): ReturnType<typeof citationFromMetadataValues> {
	const rawUrl = card.getAttribute("data-url");
	const titles = [...card.querySelectorAll(YUANBAO_REFERENCE_TITLE_SELECTOR)];
	if (!rawUrl || titles.length !== 1) throw new Error("Yuanbao source card metadata is incomplete");
	const rawTitle = (titles[0]?.textContent ?? "").normalize("NFKC").trim();
	if (!rawTitle) throw new Error("Yuanbao source card title is missing");
	return citationFromMetadataValues(rawUrl, rawTitle);
}

export function createYuanbaoAdapter(port: ConsumerDomPort): ConsumerWebAdapter {
	return createConsumerAdapter(port, yuanbaoSelectorContract, yuanbaoSearchEvidenceAdapter);
}
