import { z } from "zod";
import { getCredential } from "../../secrets";
import { API_PROVIDER_MAX_OUTPUT_TOKENS, warnIfOutputCapped } from "../config";
import type {
	Provider,
	ProviderOptions,
	ScrapeResult,
	StructuredResearchOptions,
	StructuredResearchResult,
} from "../types";

const AGNES_BASE_URL = "https://apihub.agnes-ai.com/v1";
const DEFAULT_MODEL = "agnes-2.5-flash";
const DEFAULT_RESEARCH_MODEL = "agnes-2.5-flash";

interface AgnesContentPart {
	type?: string;
	text?: string;
}

interface AgnesChatResponse {
	model?: string;
	choices?: Array<{
		message?: { content?: string | AgnesContentPart[] };
		finish_reason?: string;
	}>;
}

class AgnesApiError extends Error {
	constructor(
		readonly status: number,
		readonly details: string,
	) {
		super(`Agnes API error (${status}): ${details}`);
		this.name = "AgnesApiError";
	}
}

async function agnesPost(path: string, body: object): Promise<AgnesChatResponse> {
	const response = await fetch(`${AGNES_BASE_URL}${path}`, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${getCredential("AGNES_API_KEY")}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify(body),
	});

	if (!response.ok) {
		const details = (await response.text()).slice(0, 1000).replace(/sk-[A-Za-z0-9_-]+/g, "[redacted]");
		throw new AgnesApiError(response.status, details);
	}

	return (await response.json()) as AgnesChatResponse;
}

function extractMessageText(data: AgnesChatResponse): string {
	const content = data?.choices?.[0]?.message?.content;
	if (typeof content === "string") return content;
	if (Array.isArray(content)) {
		return content
			.filter((part) => part?.type === "text" && typeof part.text === "string")
			.map((part) => part.text as string)
			.join("\n");
	}
	return "";
}

function parseJsonText(text: string): unknown {
	const trimmed = text.trim();
	const withoutFence = trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
	try {
		return JSON.parse(withoutFence);
	} catch {
		const start = withoutFence.indexOf("{");
		const end = withoutFence.lastIndexOf("}");
		if (start >= 0 && end > start) return JSON.parse(withoutFence.slice(start, end + 1));
		throw new Error("Agnes returned no valid JSON object");
	}
}

async function requestStructuredOutput(prompt: string, jsonSchema: unknown): Promise<AgnesChatResponse> {
	const messages = [
		{
			role: "system",
			content:
				"This integration has no live web search. Ignore requests to search the web and rely only on facts in the supplied prompt or website excerpt; use empty arrays when evidence is missing. Return only one JSON object matching the supplied JSON Schema, without Markdown or prose.",
		},
		{
			role: "user",
			content: `${prompt}\n\nJSON Schema:\n${JSON.stringify(jsonSchema)}`,
		},
	];
	const baseBody = {
		model: DEFAULT_RESEARCH_MODEL,
		messages,
		max_tokens: API_PROVIDER_MAX_OUTPUT_TOKENS["agnes-api"],
	};

	try {
		return await agnesPost("/chat/completions", {
			...baseBody,
			response_format: {
				type: "json_schema",
				json_schema: { name: "research_output", strict: true, schema: jsonSchema },
			},
		});
	} catch (error) {
		const isResponseFormatCompatibilityError =
			error instanceof AgnesApiError &&
			(error.status === 400 || error.status === 422) &&
			/response.?format|json.?schema|unsupported|unknown (field|parameter)/i.test(error.details);
		if (!isResponseFormatCompatibilityError) throw error;
		return agnesPost("/chat/completions", baseBody);
	}
}

export const agnesApi: Provider = {
	id: "agnes-api",
	name: "Agnes API",

	isConfigured() {
		return !!getCredential("AGNES_API_KEY");
	},

	validateTarget(config) {
		if (config.webSearch) {
			return "Agnes API does not expose a documented native web-search tool; remove the :online suffix";
		}
		return null;
	},

	async run(_model: string, prompt: string, options?: ProviderOptions): Promise<ScrapeResult> {
		const version = options?.version ?? DEFAULT_MODEL;
		const data = await agnesPost("/chat/completions", {
			model: version,
			messages: [{ role: "user", content: prompt }],
			max_tokens: API_PROVIDER_MAX_OUTPUT_TOKENS["agnes-api"],
		});
		warnIfOutputCapped("agnes-api", version, data?.choices?.[0]?.finish_reason);
		return {
			rawOutput: data,
			textContent: extractMessageText(data),
			webQueries: [],
			citations: [],
			modelVersion: data?.model ?? version,
		};
	},

	async runStructuredResearch<T>({
		prompt,
		schema,
		webSearch = true,
	}: StructuredResearchOptions<T>): Promise<StructuredResearchResult<T>> {
		if (webSearch) {
			console.warn("[agnes-api] native web search is unavailable; structured research uses supplied context only");
		}
		const jsonSchema = z.toJSONSchema(schema as z.ZodType);
		const data = await requestStructuredOutput(prompt, jsonSchema);
		const object = (schema as z.ZodType).parse(parseJsonText(extractMessageText(data))) as T;
		return { object, modelVersion: data?.model ?? DEFAULT_RESEARCH_MODEL };
	},
};
