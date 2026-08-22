import contract from "../selector-contracts/kimi-web-v1.json";
import { createConsumerAdapter } from "./consumer-adapter";
import type { ConsumerDomPort, ConsumerWebAdapter, SelectorContract } from "./contracts";
import { type SearchEvidenceAdapter, visibleCitationFromElement } from "./search-evidence-adapter";

const KIMI_SEARCH_BLOCK_SELECTOR = ".toolcall-container.toolcall-web_search";
const KIMI_CITATION_SELECTOR = "a.pua-ref-cite-tag.pua-ref-cite-tag--text[data-site-name][href]";

export const kimiSelectorContract = contract as SelectorContract;

export const kimiSearchEvidenceAdapter: SearchEvidenceAdapter = {
	version: "kimi-search-evidence-20260822-v1",
	async read(context) {
		const searchBlocks = [...context.acceptedAnswer.querySelectorAll(KIMI_SEARCH_BLOCK_SELECTOR)];
		if (searchBlocks.length > 1) throw new Error("Kimi search evidence is ambiguous");

		const citationCandidates = [...context.acceptedAnswer.querySelectorAll(KIMI_CITATION_SELECTOR)];
		const citations = citationCandidates
			.filter(context.isVisible)
			.map((element) => visibleCitationFromElement(element, context.readVisibleText));
		const observed = searchBlocks.length === 1 ? true : null;
		return {
			webSearchObserved: observed,
			queryAvailability: observed ? "unavailable" : "unknown",
			webQueries: [],
			citations,
			diagnostics: {
				extractorVersion: kimiSearchEvidenceAdapter.version,
				evidenceSource: observed || citations.length > 0 ? "dom" : "none",
				searchBlockCount: searchBlocks.length,
				queryCandidateCount: 0,
				citationCandidateCount: citationCandidates.length,
			},
		};
	},
};

export function createKimiAdapter(port: ConsumerDomPort): ConsumerWebAdapter {
	return createConsumerAdapter(port, kimiSelectorContract, kimiSearchEvidenceAdapter);
}
