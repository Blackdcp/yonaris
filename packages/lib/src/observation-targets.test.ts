import { describe, expect, it } from "vitest";
import {
	assertObservationRouteSupportsScope,
	buildObservationSourceKey,
	resolveObservationTarget,
} from "./observation-targets";

describe("resolveObservationTarget", () => {
	it("keeps the ChatGPT consumer surface separate from the OpenAI API", () => {
		const consumer = resolveObservationTarget({
			model: "chatgpt",
			provider: "brightdata",
			webSearch: true,
		});
		const api = resolveObservationTarget({
			model: "chatgpt",
			provider: "openai-api",
			version: "gpt-5-mini",
			webSearch: true,
		});

		expect(consumer.surfaceTargetKey).toBe("chatgpt.consumer_web");
		expect(api.surfaceTargetKey).toBe("openai.responses_api");
		expect(consumer.surfaceTargetKey).not.toBe(api.surfaceTargetKey);
	});

	it("allows two routes to observe the same consumer surface without losing provenance", () => {
		const brightData = resolveObservationTarget({ model: "perplexity", provider: "brightdata", webSearch: true });
		const olostep = resolveObservationTarget({ model: "perplexity", provider: "olostep", webSearch: true });

		expect(brightData.surfaceTargetKey).toBe("perplexity.consumer_web");
		expect(olostep.surfaceTargetKey).toBe("perplexity.consumer_web");
		expect(brightData.captureRouteKey).toBe("brightdata.perplexity_dataset");
		expect(olostep.captureRouteKey).toBe("olostep.perplexity_parser");
	});

	it("treats Google answer surfaces as search surfaces across vendors", () => {
		const scraper = resolveObservationTarget({
			model: "google-ai-overview",
			provider: "brightdata",
			webSearch: true,
		});
		const serpApi = resolveObservationTarget({
			model: "google-ai-overview",
			provider: "dataforseo",
			webSearch: true,
		});

		expect(scraper.surfaceTargetKey).toBe("google_search.ai_overview");
		expect(serpApi.surfaceTargetKey).toBe("google_search.ai_overview");
	});

	it("does not label an OpenRouter model as its consumer product", () => {
		const target = resolveObservationTarget({
			model: "kimi",
			provider: "openrouter",
			version: "moonshotai/kimi-k3",
			webSearch: false,
		});

		expect(target.surfaceTargetKey).toBe("kimi.aggregated_api");
		expect(target.captureMode).toBe("aggregated_api");
	});

	it("fails closed when a provider route has no declared measurement surface", () => {
		expect(() => resolveObservationTarget({ model: "chatgpt", provider: "unknown-provider", webSearch: true })).toThrow(
			/No measurement target is registered/,
		);
	});

	it("rejects a fixed US route in a China scope while preserving legacy compatibility", () => {
		const target = resolveObservationTarget({ model: "chatgpt", provider: "brightdata", webSearch: true });

		expect(() => assertObservationRouteSupportsScope(target, { market: "CN", locale: "zh-CN" })).toThrow(
			/fixed to market US/,
		);
		expect(() => assertObservationRouteSupportsScope(target, { market: "US", locale: "en-US" })).not.toThrow();
		expect(() => assertObservationRouteSupportsScope(target, { market: "ZZ", locale: "und" })).not.toThrow();
	});

	it("builds a stable planned-sample key that includes the exact configured route", () => {
		expect(
			buildObservationSourceKey({
				sourceJobId: "job-1",
				config: { model: "chatgpt", provider: "brightdata", webSearch: true },
				sampleIndex: 2,
			}),
		).toBe("pgboss:job-1:chatgpt:brightdata:online:2");
	});
});
