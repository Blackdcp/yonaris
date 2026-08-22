import contract from "../selector-contracts/kimi-web-v1.json";
import { createConsumerAdapter } from "./consumer-adapter";
import type { ConsumerDomPort, ConsumerWebAdapter, SelectorContract } from "./contracts";
import { citationFromMetadataValues, type SearchEvidenceAdapter } from "./search-evidence-adapter";

const KIMI_SEARCH_BLOCK_SELECTOR = ".toolcall-container.toolcall-web_search";
const KIMI_QUERY_SELECTOR = ".toolcall-title-container-text";
const KIMI_CITATION_SELECTOR = "a.pua-ref-cite-tag.pua-ref-cite-tag--text[data-site-name][href]";

export const kimiSelectorContract = contract as SelectorContract;

export const kimiSearchEvidenceAdapter: SearchEvidenceAdapter = {
	version: "kimi-search-evidence-20260822-v3",
	settleTimeoutMs: 15_000,
	async read(context) {
		const searchBlocks = [...context.acceptedAnswer.querySelectorAll(KIMI_SEARCH_BLOCK_SELECTOR)].filter(
			context.isVisible,
		);
		if (searchBlocks.length > 1) throw new Error("Kimi search evidence is ambiguous");
		const queryCandidates = searchBlocks[0]
			? [...searchBlocks[0].querySelectorAll(KIMI_QUERY_SELECTOR)].filter(context.isVisible)
			: [];
		if (queryCandidates.length > 1) throw new Error("Kimi query evidence is ambiguous");
		const query = queryCandidates[0] ? context.readVisibleText(queryCandidates[0]).normalize("NFKC").trim() : "";
		if (query.length > 2_000) throw new Error("Kimi query evidence exceeds the observation contract");
		const webQueries = query ? [query] : [];

		const citationCandidates = [...context.acceptedAnswer.querySelectorAll(KIMI_CITATION_SELECTOR)];
		const citations = citationCandidates.filter(context.isVisible).map((element) => {
			const rawUrl = element.getAttribute("href");
			const rawTitle = element.getAttribute("data-site-name");
			if (!rawUrl || !rawTitle) throw new Error("Kimi citation metadata is incomplete");
			return citationFromMetadataValues(rawUrl, rawTitle);
		});
		const observed = searchBlocks.length === 1 ? true : null;
		return {
			webSearchObserved: observed,
			queryAvailability: observed ? (webQueries.length > 0 ? "exposed" : "unavailable") : "unknown",
			webQueries,
			citations,
			diagnostics: {
				extractorVersion: kimiSearchEvidenceAdapter.version,
				evidenceSource: observed || citations.length > 0 ? "dom" : "none",
				searchBlockCount: searchBlocks.length,
				queryCandidateCount: queryCandidates.length,
				citationCandidateCount: citationCandidates.length,
			},
		};
	},
};

export function createKimiAdapter(port: ConsumerDomPort): ConsumerWebAdapter {
	return createConsumerAdapter(port, kimiSelectorContract, kimiSearchEvidenceAdapter);
}
