import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { getCredential } from "../../secrets";
import { extractCitationsFromAnthropic, extractTextFromAnthropic } from "../../text-extraction";
import {
	ANTHROPIC_WEB_SEARCH_MAX_USES,
	API_PROVIDER_MAX_OUTPUT_TOKENS,
	RESEARCH_WEB_SEARCH_MAX_USES,
	warnIfOutputCapped,
} from "../config";
import type {
	Provider,
	ProviderOptions,
	ScrapeResult,
	StructuredResearchOptions,
	StructuredResearchResult,
} from "../types";

const DEEPSEEK_ANTHROPIC_BASE_URL = "https://api.deepseek.com/anthropic";
const DEFAULT_MODEL = "deepseek-v4-pro";
const DEFAULT_RESEARCH_MODEL = "deepseek-v4-pro";
const MAX_SERVER_TOOL_CONTINUATIONS = 2;

interface DeepSeekMessageResult {
	response: Anthropic.Messages.Message;
	continuationCount: number;
	continuationUsage: Anthropic.Messages.Usage[];
}

function getClient(): Anthropic {
	const apiKey = getCredential("DEEPSEEK_API_KEY");
	if (!apiKey) throw new Error("DEEPSEEK_API_KEY is required");
	return new Anthropic({
		apiKey,
		authToken: null,
		baseURL: DEEPSEEK_ANTHROPIC_BASE_URL,
	});
}

function sanitizeForJson(value: unknown): unknown {
	return JSON.parse(JSON.stringify(value));
}

function extractWebQueries(content: Anthropic.Messages.ContentBlock[]): string[] {
	const queries: string[] = [];
	for (const block of content) {
		if (block.type !== "server_tool_use" || block.name !== "web_search") continue;
		if (typeof block.input !== "object" || block.input === null || !("query" in block.input)) continue;
		const query = block.input.query;
		if (typeof query === "string" && query.trim()) queries.push(query);
	}
	return queries;
}

function trimStoredContent(content: Anthropic.Messages.ContentBlock[]): unknown[] {
	return content.flatMap((block) => {
		if (block.type === "thinking") return [];
		if (block.type !== "web_search_tool_result" || !Array.isArray(block.content)) return block;
		return {
			...block,
			content: block.content.map((result) =>
				result.type === "web_search_result" ? { type: result.type, url: result.url, title: result.title } : result,
			),
		};
	});
}

function shouldContinueServerToolTurn(response: Anthropic.Messages.Message): boolean {
	if (response.stop_reason === "pause_turn") return true;
	if (response.stop_reason !== "tool_use") return false;

	const hasServerToolUse = response.content.some((block) => block.type === "server_tool_use");
	const hasClientToolUse = response.content.some((block) => block.type === "tool_use");
	return hasServerToolUse && !hasClientToolUse;
}

async function createMessage(
	model: string,
	messages: Anthropic.Messages.MessageParam[],
	tools: Anthropic.Messages.ToolUnion[],
	toolChoice?: Anthropic.Messages.ToolChoice,
	thinking?: Anthropic.Messages.ThinkingConfigParam,
): Promise<DeepSeekMessageResult> {
	const client = getClient();
	const conversation = [...messages];
	const allContent: Anthropic.Messages.ContentBlock[] = [];
	const continuationUsage: Anthropic.Messages.Usage[] = [];
	let response: Anthropic.Messages.Message | undefined;
	let continuationCount = 0;

	for (let round = 0; round <= MAX_SERVER_TOOL_CONTINUATIONS; round++) {
		response = await client.messages.create({
			model,
			max_tokens: API_PROVIDER_MAX_OUTPUT_TOKENS["deepseek-api"],
			messages: conversation,
			...(tools.length > 0 ? { tools } : {}),
			...(toolChoice ? { tool_choice: toolChoice } : {}),
			...(thinking ? { thinking } : {}),
		});
		allContent.push(...response.content);
		continuationUsage.push(response.usage);

		if (!shouldContinueServerToolTurn(response)) break;
		if (round === MAX_SERVER_TOOL_CONTINUATIONS) {
			throw new Error(`DeepSeek server-tool turn did not finish after ${round + 1} requests`);
		}

		conversation.push({
			role: "assistant",
			content: response.content as Anthropic.Messages.ContentBlockParam[],
		});
		continuationCount++;
	}

	if (!response) throw new Error("DeepSeek returned no response");
	return {
		response: { ...response, content: allContent },
		continuationCount,
		continuationUsage,
	};
}

async function runDeepSeek(prompt: string, model: string, options?: ProviderOptions): Promise<ScrapeResult> {
	const tools: Anthropic.Messages.ToolUnion[] = [];
	if (options?.webSearch) {
		tools.push({
			type: "web_search_20250305",
			name: "web_search",
			max_uses: ANTHROPIC_WEB_SEARCH_MAX_USES,
		});
	}

	const { response, continuationCount, continuationUsage } = await createMessage(
		model,
		[{ role: "user", content: prompt }],
		tools,
	);

	warnIfOutputCapped("deepseek-api", model, response.stop_reason);
	const textContent = extractTextFromAnthropic(response);
	if (!textContent.trim()) {
		throw new Error(`DeepSeek returned no final text (model=${model}, stop_reason=${response.stop_reason})`);
	}

	return {
		rawOutput: sanitizeForJson({
			...response,
			content: trimStoredContent(response.content),
			continuationCount,
			continuationUsage,
		}),
		textContent,
		webQueries: extractWebQueries(response.content),
		citations: extractCitationsFromAnthropic(response),
		modelVersion: response.model ?? model,
	};
}

export const deepseekApi: Provider = {
	id: "deepseek-api",
	name: "DeepSeek API",

	isConfigured() {
		return !!getCredential("DEEPSEEK_API_KEY");
	},

	async run(_model: string, prompt: string, options?: ProviderOptions): Promise<ScrapeResult> {
		return runDeepSeek(prompt, options?.version ?? DEFAULT_MODEL, options);
	},

	async runStructuredResearch<T>({
		prompt,
		schema,
		webSearch = true,
	}: StructuredResearchOptions<T>): Promise<StructuredResearchResult<T>> {
		let structuredPrompt = prompt;
		if (webSearch) {
			const researchTools: Anthropic.Messages.ToolUnion[] = [
				{
					type: "web_search_20250305",
					name: "web_search",
					max_uses: RESEARCH_WEB_SEARCH_MAX_USES,
				},
			];
			const research = await createMessage(DEFAULT_RESEARCH_MODEL, [{ role: "user", content: prompt }], researchTools);
			warnIfOutputCapped("deepseek-api", DEFAULT_RESEARCH_MODEL, research.response.stop_reason);
			const notes = extractTextFromAnthropic(research.response);
			if (!notes.trim()) {
				throw new Error(
					`DeepSeek returned no research text (model=${DEFAULT_RESEARCH_MODEL}, stop_reason=${research.response.stop_reason})`,
				);
			}
			structuredPrompt = `${prompt}\n\nWeb research notes:\n${notes}\n\nUse the notes above and return the requested structured result.`;
		}

		const jsonToolDefinition: Anthropic.Messages.ToolUnion = {
			name: "json",
			description: "Return the requested structured JSON object.",
			input_schema: z.toJSONSchema(schema as z.ZodType) as Anthropic.Messages.Tool.InputSchema,
		};

		const { response } = await createMessage(
			DEFAULT_RESEARCH_MODEL,
			[{ role: "user", content: structuredPrompt }],
			[jsonToolDefinition],
			{
				type: "tool",
				name: "json",
				disable_parallel_tool_use: true,
			},
			{ type: "disabled" },
		);
		warnIfOutputCapped("deepseek-api", DEFAULT_RESEARCH_MODEL, response.stop_reason);

		const jsonToolResult = response.content.find(
			(block) => block.type === "tool_use" && (block as Anthropic.Messages.ToolUseBlock).name === "json",
		) as Anthropic.Messages.ToolUseBlock | undefined;
		if (!jsonToolResult) {
			throw new Error(`DeepSeek returned no structured JSON tool result (model=${DEFAULT_RESEARCH_MODEL})`);
		}

		return {
			object: (schema as z.ZodType).parse(jsonToolResult.input) as T,
			modelVersion: response.model ?? DEFAULT_RESEARCH_MODEL,
		};
	},
};
