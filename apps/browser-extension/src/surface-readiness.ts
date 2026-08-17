import {
	BROWSER_EXTENSION_SURFACES,
	type BrowserExtensionReadiness,
	type BrowserExtensionReadinessStatus,
	type BrowserExtensionSurface,
	type SurfaceReadiness,
} from "./contracts";
import deepSeekContract from "./selector-contracts/deepseek-web-v1.json";
import doubaoContract from "./selector-contracts/doubao-web-v1.json";

const READINESS_STATUSES = new Set<BrowserExtensionReadinessStatus>([
	"ready",
	"signed_out",
	"paused_by_risk_control",
	"adapter_incompatible",
	"unavailable",
]);

export const CURRENT_ADAPTER_VERSIONS: Readonly<Record<BrowserExtensionSurface, string>> = {
	"doubao.consumer_web": doubaoContract.version,
	"deepseek.consumer_web": deepSeekContract.version,
};

export function defaultSurfaceReadiness(): Record<BrowserExtensionSurface, SurfaceReadiness> {
	return {
		"doubao.consumer_web": {
			status: "ready",
			adapterVersion: CURRENT_ADAPTER_VERSIONS["doubao.consumer_web"],
			activeConcurrency: 0,
		},
		"deepseek.consumer_web": {
			status: "unavailable",
			adapterVersion: CURRENT_ADAPTER_VERSIONS["deepseek.consumer_web"],
			activeConcurrency: 0,
		},
	};
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
