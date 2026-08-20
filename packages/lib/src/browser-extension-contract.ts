import {
	BROWSER_EXTENSION_SURFACE_DEFINITIONS,
	BROWSER_EXTENSION_SURFACES,
	type BrowserExtensionCaptureRoute,
	type BrowserExtensionSurface,
	mapBrowserExtensionSurfaces,
} from "./browser-extension-surfaces";

export type { BrowserExtensionCaptureRoute, BrowserExtensionSurface } from "./browser-extension-surfaces";
export { BROWSER_EXTENSION_SURFACES, browserExtensionCaptureRoute } from "./browser-extension-surfaces";
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

const APPROVED_ADAPTER_VERSIONS: Readonly<Record<BrowserExtensionSurface, string>> = mapBrowserExtensionSurfaces(
	(surface) => BROWSER_EXTENSION_SURFACE_DEFINITIONS.find(({ key }) => key === surface)?.adapterVersion ?? "",
);

const LEGACY_ADAPTER_VERSION_OMISSION_WINDOWS: Readonly<Partial<Record<BrowserExtensionSurface, string>>> = {
	"doubao.consumer_web": "doubao-web-20260818-localpc-v7",
};

export const STRUCTURED_BROWSER_EXTENSION_ADAPTER_VERSIONS: Readonly<Record<BrowserExtensionSurface, string>> =
	mapBrowserExtensionSurfaces(
		(surface) => BROWSER_EXTENSION_SURFACE_DEFINITIONS.find(({ key }) => key === surface)?.adapterVersion ?? "",
	);

const MAX_STRUCTURED_SCREENSHOT_BYTES = 2 * 1024 * 1024;

export function isBrowserExtensionSurface(value: string): value is BrowserExtensionSurface {
	return BROWSER_EXTENSION_SURFACES.some((surface) => surface === value);
}

export function parseBrowserExtensionSurface(value: string): BrowserExtensionSurface {
	if (!isBrowserExtensionSurface(value)) {
		throw new Error(`Browser extension surface ${value} is not supported`);
	}
	return value;
}

export function isApprovedBrowserExtensionAdapterVersion(
	surface: BrowserExtensionSurface,
	adapterVersion: string,
): boolean {
	return isCurrentBrowserExtensionAdapterVersionBindingSatisfied(surface, adapterVersion);
}

export function isBrowserExtensionAdapterVersionBindingSatisfied(input: {
	surface: BrowserExtensionSurface;
	requestedAdapterVersion: string | undefined;
	approvedAdapterVersion: string | undefined;
}): boolean {
	if (input.approvedAdapterVersion === undefined) return false;
	if (input.requestedAdapterVersion !== undefined) {
		return input.requestedAdapterVersion === input.approvedAdapterVersion;
	}
	return LEGACY_ADAPTER_VERSION_OMISSION_WINDOWS[input.surface] === input.approvedAdapterVersion;
}

export function isCurrentBrowserExtensionAdapterVersionBindingSatisfied(
	surface: BrowserExtensionSurface,
	requestedAdapterVersion: string | undefined,
): boolean {
	return isBrowserExtensionAdapterVersionBindingSatisfied({
		surface,
		requestedAdapterVersion,
		approvedAdapterVersion: APPROVED_ADAPTER_VERSIONS[surface],
	});
}

export function isBrowserExtensionCaptureRoute(value: string): value is BrowserExtensionCaptureRoute {
	return BROWSER_EXTENSION_SURFACE_DEFINITIONS.some(({ captureRoute }) => captureRoute === value);
}

export function assertExtensionEvidenceProtocol(input: {
	captureRouteKey: string;
	adapterVersion?: string;
	minimumArtifacts: number;
	kinds: readonly string[];
	mediaTypes?: readonly string[];
	byteSizes?: readonly number[];
}): void {
	if (!input.captureRouteKey.startsWith("browser_extension.")) return;
	if (!isBrowserExtensionCaptureRoute(input.captureRouteKey)) {
		throw new Error(`Browser extension capture route ${input.captureRouteKey} is not supported`);
	}
	const surface = BROWSER_EXTENSION_SURFACE_DEFINITIONS.find(
		({ captureRoute }) => captureRoute === input.captureRouteKey,
	)?.key;
	if (!surface) throw new Error(`Browser extension capture route ${input.captureRouteKey} is not supported`);
	if (STRUCTURED_BROWSER_EXTENSION_ADAPTER_VERSIONS[surface] === input.adapterVersion) {
		if (
			input.minimumArtifacts !== 1 ||
			input.kinds.length !== 1 ||
			input.kinds[0] !== "screenshot" ||
			input.mediaTypes?.length !== 1 ||
			input.mediaTypes[0] !== "image/jpeg" ||
			input.byteSizes?.length !== 1 ||
			!Number.isInteger(input.byteSizes[0]) ||
			(input.byteSizes[0] ?? 0) < 1 ||
			(input.byteSizes[0] ?? 0) > MAX_STRUCTURED_SCREENSHOT_BYTES
		) {
			throw new Error("Structured browser extension completion requires exactly one bounded JPEG screenshot");
		}
		return;
	}
	if (input.minimumArtifacts !== 1 || input.kinds.length !== 1 || input.kinds[0] !== "page_snapshot") {
		throw new Error("Browser extension completion requires exactly one page snapshot");
	}
}
