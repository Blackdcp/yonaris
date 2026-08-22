import contract from "../selector-contracts/zhipu-web-v2.json";
import { createConsumerAdapter } from "./consumer-adapter";
import type { ConsumerDomPort, ConsumerWebAdapter, SelectorContract } from "./contracts";
import { type SearchEvidenceAdapter, visibleCitationFromElement } from "./search-evidence-adapter";

const ZHIPU_TRACE_SELECTOR = ".advance-thinking";
const ZHIPU_SOURCE_CONTAINER_SELECTOR = ".advance-thinking-area .tool-result-content .sources-tab-container";
const ZHIPU_CITATION_SELECTOR = "a[href]";

export const zhipuSelectorContract = contract as SelectorContract;

export const zhipuSearchEvidenceAdapter: SearchEvidenceAdapter = {
	version: "zhipu-search-evidence-20260822-v1",
	async read(context) {
		const adjacentTraces = [context.acceptedAnswer.previousElementSibling, context.acceptedAnswer.nextElementSibling]
			.filter((element): element is Element => element !== null)
			.filter((element) => element.matches(ZHIPU_TRACE_SELECTOR));
		const sourceContainers = adjacentTraces.flatMap((trace) => [
			...trace.querySelectorAll(ZHIPU_SOURCE_CONTAINER_SELECTOR),
		]);
		if (sourceContainers.length > 1) throw new Error("Zhipu source evidence is ambiguous");

		const citationCandidates = [...context.acceptedAnswer.querySelectorAll(ZHIPU_CITATION_SELECTOR)];
		const citations = citationCandidates.flatMap((element) => {
			if (!context.isVisible(element)) return [];
			try {
				return [visibleCitationFromElement(element, context.readVisibleText)];
			} catch {
				return [];
			}
		});
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
				citationCandidateCount: citationCandidates.length,
			},
		};
	},
};

export function createZhipuAdapter(port: ConsumerDomPort): ConsumerWebAdapter {
	return createConsumerAdapter(port, zhipuSelectorContract, zhipuSearchEvidenceAdapter);
}
