import contract from "../selector-contracts/wenxin-web-v1.json";
import { createConsumerAdapter } from "./consumer-adapter";
import type { ConsumerDomPort, ConsumerWebAdapter, SelectorContract } from "./contracts";
import {
	type SearchEvidenceAdapter,
	visibleCitationFromElement,
	visibleCitationFromJsonAttribute,
	withRestoredDisclosureCandidates,
} from "./search-evidence-adapter";

const WENXIN_THINKING_BLOCK_SELECTOR = ".ai-entry-block.ai-thinking-steps";
const WENXIN_DISCLOSURE_SELECTOR = ".root-header";
const WENXIN_SEARCH_ICON_SELECTOR = ".cos-icon-search";
const WENXIN_CITATION_SELECTOR = ".ai-entry-block.ai-markdown .marklang a.marklang-link[href]";
const WENXIN_SOURCE_ITEM_SELECTOR = "[data-long-press-ext-info][data-long-press-menu][data-long-press-menu-buttons]";

export const wenxinSelectorContract = contract as SelectorContract;

export const wenxinSearchEvidenceAdapter: SearchEvidenceAdapter = {
	version: "wenxin-search-evidence-20260822-v2",
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
			if (disclosures.length === 1) {
				const disclosed = await withRestoredDisclosureCandidates({
					context,
					disclosure: disclosures[0] as Element,
					root: thinkingBlock,
					candidateSelector: WENXIN_SOURCE_ITEM_SELECTOR,
					allowInitiallyVisible: true,
					read: (candidates) => ({
						observed: [...thinkingBlock.querySelectorAll(WENXIN_SEARCH_ICON_SELECTOR)].some(context.isVisible),
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
				});
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

export function createWenxinAdapter(port: ConsumerDomPort): ConsumerWebAdapter {
	return createConsumerAdapter(port, wenxinSelectorContract, wenxinSearchEvidenceAdapter);
}
