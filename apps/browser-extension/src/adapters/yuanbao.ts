import contract from "../selector-contracts/yuanbao-web-v2.json";
import { createConsumerAdapter } from "./consumer-adapter";
import type { ConsumerDomPort, ConsumerWebAdapter, SelectorContract } from "./contracts";
import { type SearchEvidenceAdapter, visibleCitationFromElement } from "./search-evidence-adapter";

const YUANBAO_REFERENCE_LIST_SELECTOR = ".hyc-common-markdown__ref-list";
const YUANBAO_CITATION_SELECTOR = "a[href]";

export const yuanbaoSelectorContract = contract as SelectorContract;

export const yuanbaoSearchEvidenceAdapter: SearchEvidenceAdapter = {
	version: "yuanbao-search-evidence-20260822-v1",
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
		return {
			webSearchObserved: observed,
			queryAvailability: observed ? "unavailable" : "unknown",
			webQueries: [],
			citations,
			diagnostics: {
				extractorVersion: yuanbaoSearchEvidenceAdapter.version,
				evidenceSource: observed || citations.length > 0 ? "dom" : "none",
				searchBlockCount: referenceLists.length,
				queryCandidateCount: 0,
				citationCandidateCount: citationCandidates.length,
			},
		};
	},
};

export function createYuanbaoAdapter(port: ConsumerDomPort): ConsumerWebAdapter {
	return createConsumerAdapter(port, yuanbaoSelectorContract, yuanbaoSearchEvidenceAdapter);
}
