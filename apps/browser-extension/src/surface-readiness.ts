import {
	browserExtensionSurfaceDefinition,
	mapBrowserExtensionSurfaces,
} from "@workspace/lib/browser-extension-surfaces";
import {
	BROWSER_EXTENSION_SURFACES,
	type BrowserExtensionReadiness,
	type BrowserExtensionReadinessStatus,
	type BrowserExtensionSurface,
	type SurfaceReadiness,
} from "./contracts";

const READINESS_STATUSES = new Set<BrowserExtensionReadinessStatus>([
	"ready",
	"signed_out",
	"paused_by_risk_control",
	"adapter_incompatible",
	"unavailable",
]);

export const CURRENT_ADAPTER_VERSIONS: Readonly<Record<BrowserExtensionSurface, string>> = mapBrowserExtensionSurfaces(
	(surface) => browserExtensionSurfaceDefinition(surface).adapterVersion,
);

export function defaultSurfaceReadiness(): Record<BrowserExtensionSurface, SurfaceReadiness> {
	return mapBrowserExtensionSurfaces((surface) => ({
		status: "unavailable",
		adapterVersion: CURRENT_ADAPTER_VERSIONS[surface],
		activeConcurrency: 0,
	}));
}

export function normalizeSurfaceReadiness(value: unknown): Record<BrowserExtensionSurface, SurfaceReadiness> {
	const defaults = defaultSurfaceReadiness();
	if (!isRecord(value)) return defaults;
	const normalized = { ...defaults };
	for (const surface of BROWSER_EXTENSION_SURFACES) {
		const candidate = value[surface];
		if (candidate === undefined) continue;
		normalized[surface] = normalizeSurface(candidate, surface);
	}
	return normalized;
}

export function readySurfaces(readiness: BrowserExtensionReadiness): BrowserExtensionSurface[] {
	return BROWSER_EXTENSION_SURFACES.filter((surface) => readiness[surface]?.status === "ready");
}

function normalizeSurface(value: unknown, surface: BrowserExtensionSurface): SurfaceReadiness {
	const adapterVersion = CURRENT_ADAPTER_VERSIONS[surface];
	if (!isRecord(value) || value.adapterVersion !== adapterVersion) {
		return { status: "adapter_incompatible", adapterVersion, activeConcurrency: 0 };
	}
	const status = value.status;
	if (typeof status !== "string" || !READINESS_STATUSES.has(status as BrowserExtensionReadinessStatus)) {
		return { status: "adapter_incompatible", adapterVersion, activeConcurrency: 0 };
	}
	return { status: status as BrowserExtensionReadinessStatus, adapterVersion, activeConcurrency: 0 };
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
