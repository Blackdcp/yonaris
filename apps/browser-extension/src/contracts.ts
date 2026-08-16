export const PORTAL_ORIGIN = "https://portal.yonaris.com" as const;
export const EXTENSION_VERSION = "0.1.0" as const;
export const BROWSER_EXTENSION_SURFACES = ["doubao.consumer_web", "deepseek.consumer_web"] as const;

export type BrowserExtensionSurface = (typeof BROWSER_EXTENSION_SURFACES)[number];
export type BrowserExtensionReadinessStatus =
	| "ready"
	| "signed_out"
	| "paused_by_risk_control"
	| "adapter_incompatible"
	| "unavailable";

export interface SurfaceReadiness {
	status: BrowserExtensionReadinessStatus;
	adapterVersion: string;
	activeConcurrency: number;
}

export type BrowserExtensionReadiness = Partial<Record<BrowserExtensionSurface, SurfaceReadiness>>;

export interface DeviceHeartbeatInput {
	extensionVersion: string;
	browserFamily: "chrome";
	browserVersion: string;
	platform: "windows" | "macos";
	supportedSurfaces: BrowserExtensionSurface[];
	readiness: BrowserExtensionReadiness;
}

export interface PairedDeviceConfig {
	portalBaseUrl: typeof PORTAL_ORIGIN;
	deviceId: string;
	deviceToken: string;
	allowedBrandIds: string[];
}

export type TaskJournalPhase = "claimed" | "intent_recorded" | "submitted" | "collecting" | "needs_human";

export interface TaskJournalEntry {
	taskId: string;
	phase: TaskJournalPhase;
	surfaceTargetKey: BrowserExtensionSurface;
	updatedAt: string;
}

export interface PairingResponse {
	deviceId: string;
	deviceToken: string;
	allowedBrandIds: string[];
}

export interface HeartbeatResponse {
	deviceId: string;
	serverTime: string;
	featureVersion: "browser-extension.v1";
}
