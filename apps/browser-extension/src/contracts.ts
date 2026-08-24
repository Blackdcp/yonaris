import type {
	BrowserExtensionCaptureRoute,
	BrowserExtensionSurface as SharedBrowserExtensionSurface,
} from "@workspace/lib/browser-extension-surfaces";

export { BROWSER_EXTENSION_SURFACES } from "@workspace/lib/browser-extension-surfaces";

export const PORTAL_ORIGIN = "https://portal.yonaris.com" as const;
export const EXTENSION_VERSION = "0.3.25" as const;

export type BrowserExtensionSurface = SharedBrowserExtensionSurface;
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

export type TaskJournalPhase =
	| "claimed"
	| "prepared"
	| "submit_intent"
	| "submitted"
	| "collected"
	| "uploaded"
	| "needs_human";

export interface TaskJournalEntry {
	taskId: string;
	batchId: string;
	brandId: string;
	phase: TaskJournalPhase;
	interruptedPhase?: Exclude<TaskJournalPhase, "needs_human">;
	surfaceTargetKey: BrowserExtensionSurface;
	tabId: number;
	runnerSessionId: string;
	promptSha256: string;
	updatedAt: string;
}

export interface BrowserExtensionClaim {
	taskId: string;
	batchId: string;
	brandId: string;
	scopeId: string;
	promptId: string;
	promptText: string;
	sampleIndex: number;
	surfaceTargetKey: BrowserExtensionSurface;
	captureRouteKey: BrowserExtensionCaptureRoute;
	launchUrl: string;
	sessionRequirement: "dedicated_sampling_profile";
	searchRequirement: "platform_default";
	evaluationRole: "scored";
	minimumEvidenceArtifacts: 1;
	automationAttemptCount: number;
	leaseToken: string;
	leaseGeneration: number;
	leaseExpiresAt: string;
	postSubmitAssist: boolean;
	submitConfirmed: boolean;
	runnerSessionId: string | null;
}

export type BrowserTaskReconciliationState =
	| "resumable_pre"
	| "resumable_post"
	| "active"
	| "released"
	| "terminal"
	| "blocked";

export interface BrowserTaskReconciliation {
	state: BrowserTaskReconciliationState;
	task: Pick<TaskJournalEntry, "taskId" | "batchId" | "brandId" | "surfaceTargetKey"> & { promptText: string };
	runnerSessionId: string | null;
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
