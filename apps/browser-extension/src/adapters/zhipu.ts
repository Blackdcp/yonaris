import contract from "../selector-contracts/zhipu-web-v2.json";
import { createConsumerAdapter } from "./consumer-adapter";
import type { ConsumerDomPort, ConsumerWebAdapter, SelectorContract } from "./contracts";
import {
	citationFromMetadataValues,
	type SearchEvidenceAdapter,
	visibleCitationFromElement,
} from "./search-evidence-adapter";

const ZHIPU_TRACE_SELECTOR = ".advance-thinking";
const ZHIPU_SOURCE_CONTAINER_SELECTOR = ".advance-thinking-area .tool-result-content .sources-tab-container";
const ZHIPU_CITATION_SELECTOR = "a[href]";
const ZHIPU_STRUCTURED_CITATION_SELECTOR = ".source-item[data-url][data-id][data-group-key]";
const ZHIPU_STRUCTURED_CITATION_TITLE_SELECTOR = ".source-item-num-name";

export const zhipuSelectorContract = contract as SelectorContract;

export const zhipuSearchEvidenceAdapter: SearchEvidenceAdapter = {
	version: "zhipu-search-evidence-20260822-v2",
	async read(context) {
		const adjacentTraces = [context.acceptedAnswer.previousElementSibling, context.acceptedAnswer.nextElementSibling]
			.filter((element): element is Element => element !== null)
			.filter((element) => element.matches(ZHIPU_TRACE_SELECTOR));
		const sourceContainers = adjacentTraces.flatMap((trace) => [
			...trace.querySelectorAll(ZHIPU_SOURCE_CONTAINER_SELECTOR),
		]);
		if (sourceContainers.length > 1) throw new Error("Zhipu source evidence is ambiguous");

		const citationCandidates = [...context.acceptedAnswer.querySelectorAll(ZHIPU_CITATION_SELECTOR)];
		const directCitations = citationCandidates.flatMap((element) => {
			if (!context.isVisible(element)) return [];
			try {
				return [visibleCitationFromElement(element, context.readVisibleText)];
			} catch {
				return [];
			}
		});
		const structuredCitationCandidates = [
			...context.acceptedAnswer.querySelectorAll(ZHIPU_STRUCTURED_CITATION_SELECTOR),
		];
		const structuredCitations = structuredCitationCandidates.flatMap((element) => {
			if (!context.isVisible(element)) return [];
			const titles = [...element.querySelectorAll(ZHIPU_STRUCTURED_CITATION_TITLE_SELECTOR)].filter(context.isVisible);
			if (titles.length !== 1) throw new Error("Zhipu structured citation title is incomplete or ambiguous");
			const rawUrl = element.getAttribute("data-url");
			const rawTitle = context.readVisibleText(titles[0] as Element).trim();
			if (!rawUrl || !rawTitle) throw new Error("Zhipu structured citation metadata is incomplete");
			return [citationFromMetadataValues(rawUrl, rawTitle)];
		});
		const citations = [...directCitations, ...structuredCitations];
		const observed = sourceContainers.length === 1 ? true : null;
		return {
			webSearchObserved: observed,
			queryAvailability: observed ? "unavailable" : "unknown",
			webQueries: [],
			citations,
			diagnostics: {
				extractorVersion: zhipuSearchEvidenceAdapter.version,
				evidenceSource: observed || citations.length > 0 ? "dom" : "none",
				searchBlockCount: sourceContainers.length,
				queryCandidateCount: 0,
				citationCandidateCount: citationCandidates.length + structuredCitationCandidates.length,
			},
		};
	},
};

export function createZhipuAdapter(port: ConsumerDomPort): ConsumerWebAdapter {
	return createConsumerAdapter(port, zhipuSelectorContract, zhipuSearchEvidenceAdapter);
}
