import { createHash } from "node:crypto";
import type { ModelConfig } from "@workspace/config/scrape-targets";
import { assertObservationRouteSupportsScope, resolveObservationTarget } from "@workspace/lib/observation-targets";

export const OVERSEAS_RUN_NOW_SAMPLES = 5;
export const OVERSEAS_RUN_NOW_MAX_CALLS = 10_000;

export const OVERSEAS_RUN_NOW_CHANNELS = [
	{ key: "chatgpt", label: "ChatGPT", config: { model: "chatgpt", provider: "brightdata", webSearch: true } },
	{
		key: "perplexity",
		label: "Perplexity",
		config: { model: "perplexity", provider: "brightdata", webSearch: true },
	},
	{ key: "gemini", label: "Gemini", config: { model: "gemini", provider: "brightdata", webSearch: true } },
	{ key: "copilot", label: "Copilot", config: { model: "copilot", provider: "brightdata", webSearch: true } },
	{
		key: "google-ai-mode",
		label: "Google AI Mode",
		config: { model: "google-ai-mode", provider: "brightdata", webSearch: true },
	},
	{
		key: "google-ai-overview",
		label: "Google AI Overview",
		config: { model: "google-ai-overview", provider: "brightdata", webSearch: true },
	},
] as const satisfies readonly { key: string; label: string; config: ModelConfig }[];

export type OverseasRunNowChannelKey = (typeof OVERSEAS_RUN_NOW_CHANNELS)[number]["key"];

/**
 * This is intentionally only a configuration readiness check. The POST path
 * still checks the configured zone against Bright Data's account metadata
 * before it creates any paid calls.
 */
export function getOverseasRunNowReadiness(environment: Record<string, string | undefined> = process.env): {
	googleAiOverviewReady: boolean;
} {
	return { googleAiOverviewReady: Boolean(environment.BRIGHTDATA_SERP_ZONE?.trim()) };
}

export function assertOverseasRunNowChannelsAvailable(
	channels: readonly (typeof OVERSEAS_RUN_NOW_CHANNELS)[number][],
	validateTarget: (config: ModelConfig) => string | null,
): void {
	for (const channel of channels) {
		const reason = validateTarget(channel.config);
		if (reason) throw new Error(`Overseas Run now channel ${channel.label} is unavailable: ${reason}`);
	}
}

export function assertOverseasRunNowProvidersConfigured(
	channels: readonly (typeof OVERSEAS_RUN_NOW_CHANNELS)[number][],
	isConfigured: (provider: string) => boolean,
): void {
	const checked = new Set<string>();
	for (const channel of channels) {
		const provider = channel.config.provider;
		if (checked.has(provider)) continue;
		checked.add(provider);
		if (!isConfigured(provider)) {
			const label = provider === "brightdata" ? "Bright Data" : provider;
			throw new Error(`${label} is not configured`);
		}
	}
}

export function assertOverseasRunNowPromptCompatibility(
	calls: readonly OverseasRunNowCall[],
	validatePrompt: (provider: string, prompt: string) => string | null,
): void {
	const checked = new Set<string>();
	for (const call of calls) {
		const provider = call.config.provider;
		const key = `${provider}\0${call.promptId}`;
		if (checked.has(key)) continue;
		checked.add(key);
		const reason = validatePrompt(provider, call.promptText);
		if (reason) throw new Error(`Overseas Run now prompt ${call.promptId} is unavailable for ${provider}: ${reason}`);
	}
}

export async function assertOverseasRunNowChannelsReady(
	channels: readonly (typeof OVERSEAS_RUN_NOW_CHANNELS)[number][],
	validateTarget: (config: ModelConfig) => string | null,
	preflightTarget: (config: ModelConfig) => Promise<string | null>,
): Promise<void> {
	assertOverseasRunNowChannelsAvailable(channels, validateTarget);
	for (const channel of channels) {
		const reason = await preflightTarget(channel.config);
		if (reason) throw new Error(`Overseas Run now channel ${channel.label} is unavailable: ${reason}`);
	}
}

export interface OverseasRunNowCall {
	identity: string;
	promptId: string;
	promptText: string;
	channelKey: OverseasRunNowChannelKey;
	config: ModelConfig;
	surfaceTargetKey: string;
	captureRouteKey: string;
	sampleIndex: number;
}

export function planOverseasRunNow(input: {
	prompts: readonly { id: string; value: string }[];
	channelKeys: readonly OverseasRunNowChannelKey[];
	scope: { market: string; locale: string; timezone: string };
}) {
	if (input.scope.market.trim().toUpperCase() === "CN") {
		throw new Error("Overseas Run now requires an explicit non-China Program");
	}
	if (input.prompts.length === 0) throw new Error("Overseas Run now requires at least one enabled Prompt");
	if (input.channelKeys.length === 0) throw new Error("Overseas Run now requires at least one channel");
	if (new Set(input.channelKeys).size !== input.channelKeys.length) {
		throw new Error("Overseas Run now received a duplicate channel");
	}

	const promptIds = input.prompts.map(({ id }) => requiredText(id, "Prompt id"));
	if (new Set(promptIds).size !== promptIds.length) throw new Error("Overseas Run now received a duplicate Prompt");
	const prompts = input.prompts
		.map(({ id, value }) => ({ id: requiredText(id, "Prompt id"), value: requiredText(value, "Prompt text") }))
		.sort((left, right) => left.id.localeCompare(right.id));
	const selected = new Set(input.channelKeys);
	for (const key of selected) {
		if (!OVERSEAS_RUN_NOW_CHANNELS.some((channel) => channel.key === key)) {
			throw new Error(`Overseas Run now channel ${key} is unsupported`);
		}
	}
	const channels = OVERSEAS_RUN_NOW_CHANNELS.filter(({ key }) => selected.has(key));
	const callCount = prompts.length * channels.length * OVERSEAS_RUN_NOW_SAMPLES;
	if (callCount > OVERSEAS_RUN_NOW_MAX_CALLS) {
		throw new Error(
			`Overseas Run now cannot contain more than ${OVERSEAS_RUN_NOW_MAX_CALLS.toLocaleString("en-US")} calls`,
		);
	}

	const descriptors = new Map(
		channels.map((channel) => {
			const descriptor = resolveObservationTarget(channel.config);
			assertObservationRouteSupportsScope(descriptor, input.scope);
			return [channel.key, descriptor] as const;
		}),
	);
	const calls: OverseasRunNowCall[] = [];
	for (const prompt of prompts) {
		for (const channel of channels) {
			const descriptor = descriptors.get(channel.key);
			if (!descriptor) throw new Error(`Overseas Run now channel ${channel.key} is not registered`);
			for (let sampleIndex = 1; sampleIndex <= OVERSEAS_RUN_NOW_SAMPLES; sampleIndex += 1) {
				const identity = `${prompt.id}:${descriptor.surfaceTargetKey}:${sampleIndex}`;
				calls.push({
					identity,
					promptId: prompt.id,
					promptText: prompt.value,
					channelKey: channel.key,
					config: { ...channel.config },
					surfaceTargetKey: descriptor.surfaceTargetKey,
					captureRouteKey: descriptor.captureRouteKey,
					sampleIndex,
				});
			}
		}
	}
	const manifest = {
		schemaVersion: 1 as const,
		scope: { ...input.scope },
		samplesPerChannel: OVERSEAS_RUN_NOW_SAMPLES,
		calls,
	};
	return {
		manifest,
		manifestFingerprint: createHash("sha256").update(JSON.stringify(manifest)).digest("hex"),
		calls,
		callCount,
		channels,
		samplesPerChannel: OVERSEAS_RUN_NOW_SAMPLES,
	};
}

function requiredText(value: string, field: string): string {
	const normalized = value.trim();
	if (!normalized) throw new Error(`${field} is required`);
	return normalized;
}
