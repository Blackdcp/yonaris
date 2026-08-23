import contract from "../selector-contracts/deepseek-web-v1.json";
import { createConsumerAdapter } from "./consumer-adapter";
import type { ConsumerDomPort, ConsumerWebAdapter, SelectorContract } from "./contracts";
import { type SearchEvidenceAdapter, visibleCitationFromElement } from "./search-evidence-adapter";

const DEEPSEEK_CITATION_SELECTOR = "a[href]";
const DEEPSEEK_CITATION_MARKER_SELECTOR = ".ds-markdown-cite";

export const deepSeekSelectorContract = contract as SelectorContract;

export const deepSeekSearchEvidenceAdapter: SearchEvidenceAdapter = {
	version: "deepseek-search-evidence-20260822-v1",
	async read(context) {
		const citationCandidates = [...context.acceptedAnswer.querySelectorAll(DEEPSEEK_CITATION_SELECTOR)];
		const visibleCandidates = citationCandidates.filter(context.isVisible);
		const citations = visibleCandidates.flatMap((element) => {
			try {
				return [visibleCitationFromElement(element, context.readVisibleText)];
			} catch {
				return [];
			}
		});
		const searchMarkers = visibleCandidates.filter((element) => {
			const marker = element.querySelector(DEEPSEEK_CITATION_MARKER_SELECTOR);
			return marker !== null && context.isVisible(marker);
		});
		const observed = searchMarkers.length > 0 ? true : null;
		return {
			webSearchObserved: observed,
			queryAvailability: observed ? "unavailable" : "unknown",
			webQueries: [],
			citations,
			diagnostics: {
				extractorVersion: deepSeekSearchEvidenceAdapter.version,
				evidenceSource: observed || citations.length > 0 ? "dom" : "none",
				searchBlockCount: searchMarkers.length,
				queryCandidateCount: 0,
				citationCandidateCount: citationCandidates.length,
			},
		};
	},
};

export function createDeepSeekAdapter(
	port: ConsumerDomPort,
	selectorContract: SelectorContract = deepSeekSelectorContract,
): ConsumerWebAdapter {
	return createConsumerAdapter(
		port,
		selectorContract,
		selectorContract === deepSeekSelectorContract ? deepSeekSearchEvidenceAdapter : undefined,
	);
}
