import contract from "../selector-contracts/qwen-web-v2.json";
import { createConsumerAdapter } from "./consumer-adapter";
import type { ConsumerDomPort, ConsumerWebAdapter, SelectorContract } from "./contracts";
import {
	type SearchEvidenceAdapter,
	visibleCitationFromElement,
	visibleCitationFromJsonAttribute,
	withRestoredDisclosureCandidates,
} from "./search-evidence-adapter";

const QWEN_LATEST_TURN_SELECTOR = ".chat-round.last-message-item";
const QWEN_ANSWER_WRAPPER_SELECTOR = ".chat-answers-card-wrap";
const QWEN_SOURCE_INDICATOR_SELECTOR = ".reference-wrap-iEjeb3 .search-content-iMifAk";
const QWEN_CITATION_SELECTOR = "a[href]";
const QWEN_SOURCE_ITEM_SELECTOR = "[data-click-extra][data-log-click-name][data-log-exposure-name]";

export const qwenSelectorContract = contract as SelectorContract;

export const qwenSearchEvidenceAdapter: SearchEvidenceAdapter = {
	version: "qwen-search-evidence-20260822-v2",
	async read(context) {
		const latestTurns = [...context.document.querySelectorAll(QWEN_LATEST_TURN_SELECTOR)].filter(context.isVisible);
		if (latestTurns.length !== 1) throw new Error("Qwen latest turn is ambiguous");
		const latestTurn = latestTurns[0];
		if (!latestTurn) throw new Error("Qwen latest turn is unavailable");
		const answerWrappers = [...latestTurn.querySelectorAll(QWEN_ANSWER_WRAPPER_SELECTOR)].filter(context.isVisible);
		if (answerWrappers.length !== 1 || !answerWrappers[0]?.contains(context.acceptedAnswer)) {
			throw new Error("Qwen accepted answer is not bound to the latest turn");
		}
		const sourceIndicators = [...latestTurn.querySelectorAll(QWEN_SOURCE_INDICATOR_SELECTOR)].filter(context.isVisible);
		if (sourceIndicators.length > 1) throw new Error("Qwen source evidence is ambiguous");

		const citationCandidates = [...context.acceptedAnswer.querySelectorAll(QWEN_CITATION_SELECTOR)];
		const directCitations = citationCandidates.flatMap((element) => {
			if (!context.isVisible(element)) return [];
			try {
				return [visibleCitationFromElement(element, context.readVisibleText)];
			} catch {
				return [];
			}
		});
		const observed = sourceIndicators.length === 1 ? true : null;
		let structuredCitationCandidates: Element[] = [];
		const structuredCitations = observed
			? await withRestoredDisclosureCandidates({
					context,
					disclosure: sourceIndicators[0] as Element,
					root: context.document,
					candidateSelector: QWEN_SOURCE_ITEM_SELECTOR,
					read: (candidates) => {
						structuredCitationCandidates = candidates;
						return candidates.map((element) =>
							visibleCitationFromJsonAttribute(element, "data-click-extra", "url", "title", context.readVisibleText),
						);
					},
				})
			: [];
		const citations = [...directCitations, ...structuredCitations];
		return {
			webSearchObserved: observed,
			queryAvailability: observed ? "unavailable" : "unknown",
			webQueries: [],
			citations,
			diagnostics: {
				extractorVersion: qwenSearchEvidenceAdapter.version,
				evidenceSource: observed || citations.length > 0 ? "dom" : "none",
				searchBlockCount: sourceIndicators.length,
				queryCandidateCount: 0,
				citationCandidateCount: citationCandidates.length + structuredCitationCandidates.length,
			},
		};
	},
};

export function createQwenAdapter(port: ConsumerDomPort): ConsumerWebAdapter {
	return createConsumerAdapter(port, qwenSelectorContract, qwenSearchEvidenceAdapter);
}
