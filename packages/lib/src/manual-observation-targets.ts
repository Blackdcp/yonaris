import type { ObservationTargetDescriptor, SurfaceKind } from "./observation-targets";

export const MANUAL_OBSERVATION_SURFACE_TARGET_KEYS = [
	"doubao.consumer_web",
	"deepseek.consumer_web",
	"kimi.consumer_web",
	"yuanbao.consumer_web",
	"qwen.consumer_web",
	"wenxin.consumer_web",
	"chatgpt.consumer_web",
	"perplexity.consumer_web",
	"gemini.consumer_web",
	"copilot.consumer_web",
	"claude.consumer_web",
	"grok.consumer_web",
	"google_search.ai_overview",
	"google_search.ai_mode",
] as const;

export const MANUAL_OBSERVATION_CAPTURE_ROUTE_KEYS = ["manual_import.generic", "assisted_browser.generic"] as const;

export type ManualObservationSurfaceTargetKey = (typeof MANUAL_OBSERVATION_SURFACE_TARGET_KEYS)[number];
export type ManualObservationCaptureRouteKey = (typeof MANUAL_OBSERVATION_CAPTURE_ROUTE_KEYS)[number];

export type ManualObservationModelSlug =
	| "doubao"
	| "deepseek"
	| "kimi"
	| "yuanbao"
	| "qwen"
	| "wenxin"
	| "chatgpt"
	| "perplexity"
	| "gemini"
	| "copilot"
	| "claude"
	| "grok"
	| "google-ai-overview"
	| "google-ai-mode";

export interface ManualObservationTargetDescriptor extends ObservationTargetDescriptor {
	model: ManualObservationModelSlug;
	surfaceTargetKey: ManualObservationSurfaceTargetKey;
	captureRouteKey: ManualObservationCaptureRouteKey;
	captureMode: "manual_import" | "assisted_browser";
}

interface ManualSurfaceDescriptor {
	model: ManualObservationModelSlug;
	surfaceKind: SurfaceKind;
}

const MANUAL_SURFACES: Record<ManualObservationSurfaceTargetKey, ManualSurfaceDescriptor> = {
	"doubao.consumer_web": { model: "doubao", surfaceKind: "consumer_web" },
	"deepseek.consumer_web": { model: "deepseek", surfaceKind: "consumer_web" },
	"kimi.consumer_web": { model: "kimi", surfaceKind: "consumer_web" },
	"yuanbao.consumer_web": { model: "yuanbao", surfaceKind: "consumer_web" },
	"qwen.consumer_web": { model: "qwen", surfaceKind: "consumer_web" },
	"wenxin.consumer_web": { model: "wenxin", surfaceKind: "consumer_web" },
	"chatgpt.consumer_web": { model: "chatgpt", surfaceKind: "consumer_web" },
	"perplexity.consumer_web": { model: "perplexity", surfaceKind: "consumer_web" },
	"gemini.consumer_web": { model: "gemini", surfaceKind: "consumer_web" },
	"copilot.consumer_web": { model: "copilot", surfaceKind: "consumer_web" },
	"claude.consumer_web": { model: "claude", surfaceKind: "consumer_web" },
	"grok.consumer_web": { model: "grok", surfaceKind: "consumer_web" },
	"google_search.ai_overview": { model: "google-ai-overview", surfaceKind: "search_surface" },
	"google_search.ai_mode": { model: "google-ai-mode", surfaceKind: "search_surface" },
};

const MANUAL_CAPTURE_MODES: Record<ManualObservationCaptureRouteKey, ManualObservationTargetDescriptor["captureMode"]> =
	{
		"manual_import.generic": "manual_import",
		"assisted_browser.generic": "assisted_browser",
	};

const SURFACE_HOSTS: Record<ManualObservationSurfaceTargetKey, readonly string[]> = {
	"doubao.consumer_web": ["doubao.com"],
	"deepseek.consumer_web": ["chat.deepseek.com"],
	"kimi.consumer_web": ["kimi.com", "kimi.moonshot.cn"],
	"yuanbao.consumer_web": ["yuanbao.tencent.com"],
	"qwen.consumer_web": ["qianwen.com", "tongyi.aliyun.com"],
	"wenxin.consumer_web": ["yiyan.baidu.com", "wenxin.baidu.com"],
	"chatgpt.consumer_web": ["chatgpt.com"],
	"perplexity.consumer_web": ["perplexity.ai"],
	"gemini.consumer_web": ["gemini.google.com"],
	"copilot.consumer_web": ["copilot.microsoft.com", "bing.com"],
	"claude.consumer_web": ["claude.ai"],
	"grok.consumer_web": ["grok.com", "x.com"],
	"google_search.ai_overview": [
		"google.com",
		"google.com.hk",
		"google.com.sg",
		"google.co.jp",
		"google.co.uk",
		"google.com.au",
		"google.co.in",
		"google.ca",
		"google.de",
		"google.es",
		"google.fr",
	],
	"google_search.ai_mode": [
		"google.com",
		"google.com.hk",
		"google.com.sg",
		"google.co.jp",
		"google.co.uk",
		"google.com.au",
		"google.co.in",
		"google.ca",
		"google.de",
		"google.es",
		"google.fr",
	],
};

export function isManualObservationSurfaceTargetKey(value: string): value is ManualObservationSurfaceTargetKey {
	return Object.hasOwn(MANUAL_SURFACES, value);
}

export function isManualObservationCaptureRouteKey(value: string): value is ManualObservationCaptureRouteKey {
	return Object.hasOwn(MANUAL_CAPTURE_MODES, value);
}

export function assertManualObservationSurfaceTargetKey(
	value: string,
): asserts value is ManualObservationSurfaceTargetKey {
	if (!isManualObservationSurfaceTargetKey(value)) {
		throw new Error(`Manual observation surface target ${value} is not registered`);
	}
}

export function assertManualObservationCaptureRouteKey(
	value: string,
): asserts value is ManualObservationCaptureRouteKey {
	if (!isManualObservationCaptureRouteKey(value)) {
		throw new Error(`Manual observation capture route ${value} is not registered`);
	}
}

export function resolveManualObservationTarget(input: {
	surfaceTargetKey: string;
	captureRouteKey: string;
}): ManualObservationTargetDescriptor {
	assertManualObservationSurfaceTargetKey(input.surfaceTargetKey);
	assertManualObservationCaptureRouteKey(input.captureRouteKey);

	const surface = MANUAL_SURFACES[input.surfaceTargetKey];

	return {
		model: surface.model,
		surfaceTargetKey: input.surfaceTargetKey,
		captureRouteKey: input.captureRouteKey,
		surfaceKind: surface.surfaceKind,
		captureMode: MANUAL_CAPTURE_MODES[input.captureRouteKey],
	};
}

export function assertManualObservationPageUrl(
	surfaceTargetKey: ManualObservationSurfaceTargetKey,
	pageUrl: string,
): void {
	const hostname = new URL(pageUrl).hostname.toLowerCase().replace(/\.$/, "");
	const matches = SURFACE_HOSTS[surfaceTargetKey].some(
		(allowedHost) => hostname === allowedHost || hostname.endsWith(`.${allowedHost}`),
	);
	if (!matches) {
		throw new Error(`Page host ${hostname} does not match manual observation surface ${surfaceTargetKey}`);
	}
}
