export const BROWSER_EXTENSION_SURFACES = ["doubao.consumer_web", "deepseek.consumer_web"] as const;

export type BrowserExtensionSurface = (typeof BROWSER_EXTENSION_SURFACES)[number];
export type BrowserExtensionCaptureRoute = "browser_extension.doubao" | "browser_extension.deepseek";
export type BrowserExtensionDeviceStatus = "online" | "offline" | "revoked";
export type BrowserExtensionReadinessStatus =
	| "ready"
	| "signed_out"
	| "paused_by_risk_control"
	| "adapter_incompatible"
	| "unavailable";

export interface BrowserExtensionSurfaceReadiness {
	status: BrowserExtensionReadinessStatus;
	adapterVersion: string;
	activeConcurrency: number;
}

export type BrowserExtensionReadiness = Partial<Record<BrowserExtensionSurface, BrowserExtensionSurfaceReadiness>>;

export interface BrowserExtensionClaim {
	taskId: string;
	batchId: string;
	brandId: string;
	scopeId: string;
	surfaceTargetKey: BrowserExtensionSurface;
	captureRouteKey: BrowserExtensionCaptureRoute;
	promptText: string;
	sampleIndex: number;
	leaseToken: string;
	leaseGeneration: number;
	leaseExpiresAt: string;
}

const CAPTURE_ROUTES: Record<BrowserExtensionSurface, BrowserExtensionCaptureRoute> = {
	"doubao.consumer_web": "browser_extension.doubao",
	"deepseek.consumer_web": "browser_extension.deepseek",
};

export function isBrowserExtensionSurface(value: string): value is BrowserExtensionSurface {
	return Object.hasOwn(CAPTURE_ROUTES, value);
}

export function parseBrowserExtensionSurface(value: string): BrowserExtensionSurface {
	if (!isBrowserExtensionSurface(value)) {
		throw new Error(`Browser extension surface ${value} is not supported`);
	}
	return value;
}

export function browserExtensionCaptureRoute(surface: BrowserExtensionSurface): BrowserExtensionCaptureRoute {
	return CAPTURE_ROUTES[surface];
}

export function isBrowserExtensionCaptureRoute(value: string): value is BrowserExtensionCaptureRoute {
	return value === "browser_extension.doubao" || value === "browser_extension.deepseek";
}

export function assertExtensionEvidenceProtocol(input: {
	captureRouteKey: string;
	minimumArtifacts: number;
	kinds: readonly string[];
}): void {
	if (!input.captureRouteKey.startsWith("browser_extension.")) return;
	if (!isBrowserExtensionCaptureRoute(input.captureRouteKey)) {
		throw new Error(`Browser extension capture route ${input.captureRouteKey} is not supported`);
	}
	if (input.minimumArtifacts !== 1 || input.kinds.length !== 1 || input.kinds[0] !== "page_snapshot") {
		throw new Error("Browser extension completion requires exactly one page snapshot");
	}
}
