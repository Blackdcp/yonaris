import { formatScrapeTarget, type ModelConfig } from "@workspace/config/scrape-targets";

export type SurfaceKind = "consumer_web" | "search_surface" | "official_api" | "aggregated_api" | "llm_response";
export type CaptureMode =
	| "vendor_browser"
	| "vendor_api"
	| "official_api"
	| "aggregated_api"
	| "manual_import"
	| "assisted_browser"
	| "test";

export interface ObservationTargetDescriptor {
	surfaceTargetKey: string;
	captureRouteKey: string;
	surfaceKind: SurfaceKind;
	captureMode: CaptureMode;
	fixedMarket?: string;
	fixedLocale?: string;
}

const route = (
	surfaceTargetKey: string,
	captureRouteKey: string,
	surfaceKind: SurfaceKind,
	captureMode: CaptureMode,
	localization?: Pick<ObservationTargetDescriptor, "fixedMarket" | "fixedLocale">,
): ObservationTargetDescriptor => ({
	surfaceTargetKey,
	captureRouteKey,
	surfaceKind,
	captureMode,
	...localization,
});

const US_EN = { fixedMarket: "US", fixedLocale: "en" } as const;

/**
 * Explicit contract between legacy SCRAPE_TARGETS and measurement identity.
 * Adding a Provider target requires choosing its real user-facing surface; an
 * unknown combination fails closed instead of silently mixing API and UI data.
 */
const TARGET_ROUTES: Record<string, ObservationTargetDescriptor> = {
	"chatgpt:brightdata": route(
		"chatgpt.consumer_web",
		"brightdata.chatgpt_dataset",
		"consumer_web",
		"vendor_browser",
		US_EN,
	),
	"perplexity:brightdata": route(
		"perplexity.consumer_web",
		"brightdata.perplexity_dataset",
		"consumer_web",
		"vendor_browser",
		US_EN,
	),
	"gemini:brightdata": route(
		"gemini.consumer_web",
		"brightdata.gemini_dataset",
		"consumer_web",
		"vendor_browser",
		US_EN,
	),
	"copilot:brightdata": route(
		"copilot.consumer_web",
		"brightdata.copilot_dataset",
		"consumer_web",
		"vendor_browser",
		US_EN,
	),
	"google-ai-mode:brightdata": route(
		"google_search.ai_mode",
		"brightdata.google_ai_mode_dataset",
		"search_surface",
		"vendor_browser",
		US_EN,
	),
	"google-ai-overview:brightdata": route(
		"google_search.ai_overview",
		"brightdata.google_serp",
		"search_surface",
		"vendor_browser",
		US_EN,
	),

	"chatgpt:olostep": route("chatgpt.consumer_web", "olostep.chatgpt_parser", "consumer_web", "vendor_browser"),
	"perplexity:olostep": route("perplexity.consumer_web", "olostep.perplexity_parser", "consumer_web", "vendor_browser"),
	"gemini:olostep": route("gemini.consumer_web", "olostep.gemini_parser", "consumer_web", "vendor_browser"),
	"copilot:olostep": route("copilot.consumer_web", "olostep.copilot_parser", "consumer_web", "vendor_browser"),
	"grok:olostep": route("grok.consumer_web", "olostep.grok_parser", "consumer_web", "vendor_browser"),
	"google-ai-mode:olostep": route(
		"google_search.ai_mode",
		"olostep.google_ai_mode_parser",
		"search_surface",
		"vendor_browser",
	),
	"google-ai-overview:olostep": route(
		"google_search.ai_overview",
		"olostep.google_ai_overview_parser",
		"search_surface",
		"vendor_browser",
	),

	"chatgpt:oxylabs": route("chatgpt.consumer_web", "oxylabs.chatgpt_target", "consumer_web", "vendor_browser"),
	"perplexity:oxylabs": route("perplexity.consumer_web", "oxylabs.perplexity_target", "consumer_web", "vendor_browser"),
	"google-ai-mode:oxylabs": route(
		"google_search.ai_mode",
		"oxylabs.google_ai_mode_target",
		"search_surface",
		"vendor_browser",
	),
	"google-ai-overview:oxylabs": route(
		"google_search.ai_overview",
		"oxylabs.google_ai_overview_target",
		"search_surface",
		"vendor_browser",
	),

	"google-ai-mode:dataforseo": route(
		"google_search.ai_mode",
		"dataforseo.google_ai_mode",
		"search_surface",
		"vendor_api",
		US_EN,
	),
	"google-ai-overview:dataforseo": route(
		"google_search.ai_overview",
		"dataforseo.google_ai_overview",
		"search_surface",
		"vendor_api",
		US_EN,
	),
	"chatgpt:dataforseo": route("chatgpt.llm_response", "dataforseo.chatgpt_llm", "llm_response", "vendor_api"),
	"perplexity:dataforseo": route("perplexity.llm_response", "dataforseo.perplexity_llm", "llm_response", "vendor_api"),
	"gemini:dataforseo": route("gemini.llm_response", "dataforseo.gemini_llm", "llm_response", "vendor_api"),
	"claude:dataforseo": route("claude.llm_response", "dataforseo.claude_llm", "llm_response", "vendor_api"),

	"chatgpt:openai-api": route("openai.responses_api", "openai_api.responses", "official_api", "official_api"),
	"claude:anthropic-api": route("anthropic.messages_api", "anthropic_api.messages", "official_api", "official_api"),
	"deepseek:deepseek-api": route("deepseek.official_api", "deepseek_api.responses", "official_api", "official_api"),
	"mistral:mistral-api": route(
		"mistral.conversations_api",
		"mistral_api.conversations",
		"official_api",
		"official_api",
	),
	"agnes:agnes-api": route("agnes.official_api", "agnes_api.responses", "official_api", "official_api"),

	"chatgpt:openrouter": route(
		"chatgpt.aggregated_api",
		"openrouter.chat_completions",
		"aggregated_api",
		"aggregated_api",
	),
	"claude:openrouter": route(
		"claude.aggregated_api",
		"openrouter.chat_completions",
		"aggregated_api",
		"aggregated_api",
	),
	"gemini:openrouter": route(
		"gemini.aggregated_api",
		"openrouter.chat_completions",
		"aggregated_api",
		"aggregated_api",
	),
	"deepseek:openrouter": route(
		"deepseek.aggregated_api",
		"openrouter.chat_completions",
		"aggregated_api",
		"aggregated_api",
	),
	"kimi:openrouter": route("kimi.aggregated_api", "openrouter.chat_completions", "aggregated_api", "aggregated_api"),
	"grok:openrouter": route("grok.aggregated_api", "openrouter.chat_completions", "aggregated_api", "aggregated_api"),
	"mistral:openrouter": route(
		"mistral.aggregated_api",
		"openrouter.chat_completions",
		"aggregated_api",
		"aggregated_api",
	),
};

export function resolveObservationTarget(config: ModelConfig): ObservationTargetDescriptor {
	if (config.provider === "stub") {
		return route(`${config.model}.test_surface`, "stub.test", "llm_response", "test");
	}

	const descriptor = TARGET_ROUTES[`${config.model}:${config.provider}`];
	if (!descriptor) {
		throw new Error(
			`No measurement target is registered for ${config.model}:${config.provider}. ` +
				"Register its real surface and capture route before enabling it.",
		);
	}

	return descriptor;
}

export function assertObservationRouteSupportsScope(
	descriptor: ObservationTargetDescriptor,
	scope: { market: string; locale: string },
): void {
	// Legacy rows intentionally carry unknown localization. They remain runnable
	// during the compatibility window, but are never presented as localized data.
	if (scope.market === "ZZ" && scope.locale === "und") return;

	if (descriptor.fixedMarket && descriptor.fixedMarket.toUpperCase() !== scope.market.toUpperCase()) {
		throw new Error(
			`Capture route ${descriptor.captureRouteKey} is fixed to market ${descriptor.fixedMarket}, ` +
				`but scope requests ${scope.market}`,
		);
	}

	if (descriptor.fixedLocale) {
		const requestedLanguage = scope.locale.toLowerCase().split("-")[0];
		const fixedLanguage = descriptor.fixedLocale.toLowerCase().split("-")[0];
		if (requestedLanguage !== fixedLanguage) {
			throw new Error(
				`Capture route ${descriptor.captureRouteKey} is fixed to locale ${descriptor.fixedLocale}, ` +
					`but scope requests ${scope.locale}`,
			);
		}
	}
}

export function buildObservationSourceKey(input: {
	sourceJobId: string;
	config: ModelConfig;
	sampleIndex: number;
}): string {
	return `pgboss:${input.sourceJobId}:${formatScrapeTarget(input.config)}:${input.sampleIndex}`;
}
