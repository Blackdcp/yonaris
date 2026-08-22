import contract from "../selector-contracts/wenxin-web-v1.json";
import { createConsumerAdapter } from "./consumer-adapter";
import type { ConsumerDomPort, ConsumerWebAdapter, SelectorContract } from "./contracts";
import { type SearchEvidenceAdapter, visibleCitationFromElement } from "./search-evidence-adapter";

const WENXIN_THINKING_BLOCK_SELECTOR = ".ai-entry-block.ai-thinking-steps";
const WENXIN_STEP_HEADER_SELECTOR = ".step-header";
const WENXIN_CITATION_SELECTOR = ".ai-entry-block.ai-markdown .marklang a.marklang-link[href]";
const WENXIN_SOURCE_HEADER_PATTERN = /(?:搜索|检索|网页|来源|参考|资料|search|source|reference)/iu;

export const wenxinSelectorContract = contract as SelectorContract;

export const wenxinSearchEvidenceAdapter: SearchEvidenceAdapter = {
	version: "wenxin-search-evidence-20260822-v1",
	async read(context) {
		const searchBlocks = [...context.acceptedAnswer.querySelectorAll(WENXIN_THINKING_BLOCK_SELECTOR)].filter(
			(block) =>
				context.isVisible(block) &&
				[...block.querySelectorAll(WENXIN_STEP_HEADER_SELECTOR)].some((header) =>
					WENXIN_SOURCE_HEADER_PATTERN.test((header.textContent ?? "").normalize("NFKC")),
				),
		);
		const citationCandidates = [...context.acceptedAnswer.querySelectorAll(WENXIN_CITATION_SELECTOR)];
		const citations = citationCandidates
			.filter(context.isVisible)
			.map((element) => visibleCitationFromElement(element, context.readVisibleText));
		const observed = searchBlocks.length > 0 ? true : null;
		return {
			webSearchObserved: observed,
			queryAvailability: observed ? "unavailable" : "unknown",
			webQueries: [],
			citations,
			diagnostics: {
				extractorVersion: wenxinSearchEvidenceAdapter.version,
				evidenceSource: observed || citations.length > 0 ? "dom" : "none",
				searchBlockCount: searchBlocks.length,
				queryCandidateCount: 0,
				citationCandidateCount: citationCandidates.length,
			},
		};
	},
};

export function createWenxinAdapter(port: ConsumerDomPort): ConsumerWebAdapter {
	return createConsumerAdapter(port, wenxinSelectorContract, wenxinSearchEvidenceAdapter);
}
