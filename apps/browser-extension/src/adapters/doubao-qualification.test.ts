import { parseHTML } from "linkedom";
import { describe, expect, test } from "vitest";
import doubaoContract from "../selector-contracts/doubao-web-v1.json";
import { inspectLatestStructuredSearchEvidence } from "./search-evidence";

describe("read-only Doubao search-evidence qualification", () => {
	test("reports counts only from the latest visible answer without returning content", () => {
		const { document } = parseHTML(`<!doctype html><html><body>
			<div data-message-id="old" class="relative grid w-full">Old answer</div>
			<div data-message-id="current" class="relative grid w-full">Current answer
				<div data-plugin-identifier="search_query_result_block">
					搜索 1 个关键词，参考 1 篇资料
					<div class="mb-8 text-sm">“qualification query”</div>
					<a data-thinking-box-tool-call="true" href="https://source.example/report">1. Source</a>
				</div>
			</div>
			<div class="answer-actions">
				<button aria-label="朗读">Current answer control</button>
				<button aria-label="复制">Copy current answer</button>
			</div>
		</body></html>`);

		const result = inspectLatestStructuredSearchEvidence(
			document,
			doubaoContract.answer,
			doubaoContract.searchEvidence,
			() => true,
			doubaoContract.completion,
			undefined,
			undefined,
			'button[aria-label="复制"]',
		);

		expect(result).toEqual({ status: "qualified", answerCount: 2, queryCount: 1, citationCount: 1 });
		expect(JSON.stringify(result)).not.toMatch(/qualification query|source\.example/i);
	});

	test("does not qualify when the latest action group has ambiguous completion controls", () => {
		const { document } = parseHTML(`<div data-message-id="current" class="relative grid w-full">
			<div data-plugin-identifier="search_query_result_block">
				搜索 1 个关键词，参考 1 篇资料
				<div class="mb-8 text-sm">“qualification query”</div>
				<a data-thinking-box-tool-call="true" href="https://source.example/report">1. Source</a>
			</div>
		</div>
		<div class="answer-actions">
			<button aria-label="朗读">One</button><button aria-label="朗读">Two</button>
			<button aria-label="复制">Copy</button>
		</div>`);

		expect(
			inspectLatestStructuredSearchEvidence(
				document,
				doubaoContract.answer,
				doubaoContract.searchEvidence,
				() => true,
				doubaoContract.completion,
				undefined,
				undefined,
				'button[aria-label="复制"]',
			),
		).toEqual({ status: "page_drift", answerCount: 1, queryCount: 0, citationCount: 0 });
	});

	test("does not let an old answer completion marker qualify a newer unfinished answer", () => {
		const { document } = parseHTML(`<div data-message-id="old" class="relative grid w-full">Old answer</div>
		<div class="answer-actions">
			<button aria-label="朗读">Old answer control</button>
			<button aria-label="复制">Copy old answer</button>
		</div>
		<div data-message-id="current" class="relative grid w-full">
			<div data-plugin-identifier="search_query_result_block">
				搜索 1 个关键词，参考 1 篇资料
				<div class="mb-8 text-sm">“unfinished query”</div>
				<a data-thinking-box-tool-call="true" href="https://source.example/report">1. Source</a>
			</div>
		</div>`);

		expect(
			inspectLatestStructuredSearchEvidence(
				document,
				doubaoContract.answer,
				doubaoContract.searchEvidence,
				() => true,
				doubaoContract.completion,
				undefined,
				undefined,
				'button[aria-label="复制"]',
			),
		).toEqual({ status: "page_drift", answerCount: 2, queryCount: 0, citationCount: 0 });
	});

	test("does not qualify while the live page still exposes the generating marker", () => {
		const { document } = parseHTML(`<div data-message-id="current" class="relative grid w-full">
			<div data-plugin-identifier="search_query_result_block">
				搜索 1 个关键词，参考 1 篇资料
				<div class="mb-8 text-sm">“unfinished query”</div>
				<a data-thinking-box-tool-call="true" href="https://source.example/report">1. Source</a>
			</div>
		</div>
		<div class="answer-actions">
			<button aria-label="朗读">Current answer control</button>
			<button aria-label="复制">Copy current answer</button>
		</div>
		<div id="input-engine-container"><button class="bg-dbx-text-highlight">Stop</button></div>`);

		expect(
			inspectLatestStructuredSearchEvidence(
				document,
				doubaoContract.answer,
				doubaoContract.searchEvidence,
				() => true,
				doubaoContract.completion,
				undefined,
				doubaoContract.generating,
				'button[aria-label="复制"]',
			),
		).toEqual({ status: "page_drift", answerCount: 1, queryCount: 0, citationCount: 0 });
	});

	test("does not let an unrelated footer read-aloud action qualify the latest answer", () => {
		const { document } = parseHTML(`<div data-message-id="current" class="relative grid w-full">
			<div data-plugin-identifier="search_query_result_block">
				搜索 1 个关键词，参考 1 篇资料
				<div class="mb-8 text-sm">“qualification query”</div>
				<a data-thinking-box-tool-call="true" href="https://source.example/report">1. Source</a>
			</div>
		</div>
		<footer>
			<button aria-label="朗读">Read page chrome</button>
			<button aria-label="复制">Copy page chrome</button>
		</footer>`);

		expect(
			inspectLatestStructuredSearchEvidence(
				document,
				doubaoContract.answer,
				doubaoContract.searchEvidence,
				() => true,
				doubaoContract.completion,
				undefined,
				undefined,
				'button[aria-label="复制"]',
			),
		).toEqual({ status: "page_drift", answerCount: 1, queryCount: 0, citationCount: 0 });
	});

	test("does not search arbitrary later siblings for an action group", () => {
		const { document } = parseHTML(`<div data-message-id="current" class="relative grid w-full">
			<div data-plugin-identifier="search_query_result_block">
				搜索 1 个关键词，参考 1 篇资料
				<div class="mb-8 text-sm">“qualification query”</div>
				<a data-thinking-box-tool-call="true" href="https://source.example/report">1. Source</a>
			</div>
		</div>
		<div class="unrelated-sibling">Unrelated page chrome</div>
		<div class="answer-actions">
			<button aria-label="朗读">Read unrelated answer</button>
			<button aria-label="复制">Copy unrelated answer</button>
		</div>`);

		expect(
			inspectLatestStructuredSearchEvidence(
				document,
				doubaoContract.answer,
				doubaoContract.searchEvidence,
				() => true,
				doubaoContract.completion,
				undefined,
				undefined,
				'button[aria-label="复制"]',
			),
		).toEqual({ status: "page_drift", answerCount: 1, queryCount: 0, citationCount: 0 });
	});

	test("does not qualify a latest action group without its copy companion", () => {
		const { document } = parseHTML(`<div data-message-id="current" class="relative grid w-full">
			<div data-plugin-identifier="search_query_result_block">
				搜索 1 个关键词，参考 1 篇资料
				<div class="mb-8 text-sm">“qualification query”</div>
				<a data-thinking-box-tool-call="true" href="https://source.example/report">1. Source</a>
			</div>
		</div>
		<div class="answer-actions"><button aria-label="朗读">Read current</button></div>`);

		expect(
			inspectLatestStructuredSearchEvidence(
				document,
				doubaoContract.answer,
				doubaoContract.searchEvidence,
				() => true,
				doubaoContract.completion,
				undefined,
				undefined,
				'button[aria-label="复制"]',
			),
		).toEqual({ status: "page_drift", answerCount: 1, queryCount: 0, citationCount: 0 });
	});

	test("qualifies the latest turn when each turn has its own adjacent action group", () => {
		const { document } = parseHTML(`<div data-message-id="old" class="relative grid w-full">Old answer</div>
		<div class="answer-actions">
			<button aria-label="朗读">Read old</button><button aria-label="复制">Copy old</button>
		</div>
		<div data-message-id="current" class="relative grid w-full">
			<div data-plugin-identifier="search_query_result_block">
				搜索 1 个关键词，参考 1 篇资料
				<div class="mb-8 text-sm">“current query”</div>
				<a data-thinking-box-tool-call="true" href="https://source.example/current">1. Current source</a>
			</div>
		</div>
		<div class="answer-actions">
			<button aria-label="朗读">Read current</button><button aria-label="复制">Copy current</button>
		</div>`);

		expect(
			inspectLatestStructuredSearchEvidence(
				document,
				doubaoContract.answer,
				doubaoContract.searchEvidence,
				() => true,
				doubaoContract.completion,
				undefined,
				undefined,
				'button[aria-label="复制"]',
			),
		).toEqual({ status: "qualified", answerCount: 2, queryCount: 1, citationCount: 1 });
	});

	test("returns an inconclusive state without sending or inventing data", () => {
		const { document } = parseHTML(
			'<div data-message-id="current" class="relative grid w-full">Answer without search</div>',
		);

		expect(
			inspectLatestStructuredSearchEvidence(document, doubaoContract.answer, doubaoContract.searchEvidence, () => true),
		).toEqual({ status: "no_search_evidence", answerCount: 1, queryCount: 0, citationCount: 0 });
	});

	test("does not qualify a search answer that cannot exercise the citation selector", () => {
		const { document } = parseHTML(`<div data-message-id="current" class="relative grid w-full">
			<div data-plugin-identifier="search_query_result_block">
				搜索 1 个关键词，参考 0 篇资料
				<div class="mb-8 text-sm">“qualification query”</div>
			</div>
		</div>`);

		expect(
			inspectLatestStructuredSearchEvidence(document, doubaoContract.answer, doubaoContract.searchEvidence, () => true),
		).toEqual({ status: "no_citation_evidence", answerCount: 1, queryCount: 0, citationCount: 0 });
	});

	test("reports drift without leaking partial queries or citations", () => {
		const { document } = parseHTML(`<div data-message-id="current" class="relative grid w-full">
			<div data-plugin-identifier="search_query_result_block">
				搜索 2 个关键词，参考 1 篇资料
				<div class="mb-8 text-sm">“only one”</div>
				<a data-thinking-box-tool-call="true" href="https://source.example/secret">Secret source</a>
			</div>
		</div>`);

		const result = inspectLatestStructuredSearchEvidence(
			document,
			doubaoContract.answer,
			doubaoContract.searchEvidence,
			() => true,
		);
		expect(result).toEqual({ status: "page_drift", answerCount: 1, queryCount: 0, citationCount: 0 });
		expect(JSON.stringify(result)).not.toMatch(/only one|source\.example/i);
	});
});
