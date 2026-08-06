/**
 * Mock for @/lib/config/client — provides a controllable clientConfig.
 *
 * Components import `clientConfig` directly from this module.
 * Stories call `setMockClientConfig()` before rendering to control values.
 */

export type DeploymentMode = "whitelabel" | "local" | "demo" | "cloud";

export interface FeaturesConfig {
	readOnly: boolean;
	showOptimizeButton: boolean;
	supportsMultiOrg: boolean;
	canCreateBrands: boolean;
}

export interface BrandingConfig {
	name: string;
	icon?: string;
	wordmark?: string;
	wordmarkOnDark?: string;
	url?: string;
	parentName?: string;
	parentUrl?: string;
	onboardingRedirectUrl?: string;
	optimizationUrlTemplate?: string;
	chartColors: string[];
}

export interface AnalyticsConfig {
	plausibleDomain?: string;
	clarityProjectId?: string;
	posthogKey?: string;
	posthogHost?: string;
}

export interface ClientConfig {
	mode: DeploymentMode;
	features: FeaturesConfig;
	branding: BrandingConfig;
	analytics: AnalyticsConfig;
	defaultDelayHours: number;
	canRegister: boolean;
	hasUsers: boolean;
}

const DEFAULT_CHART_COLORS = ["#1e2a39", "#ff6a00", "#52677c", "#3e6259", "#8b6f5c", "#6e7f91", "#c57b45", "#4f6b75"];

// ---------------------------------------------------------------------------
// Module-level config that stories can mutate
// ---------------------------------------------------------------------------

let _config: ClientConfig = {
	mode: "local",
	features: {
		readOnly: false,
		showOptimizeButton: false,
		supportsMultiOrg: false,
		canCreateBrands: false,
	},
	branding: {
		name: "Yonaris",
		icon: "/icons/yonaris-icon.svg",
		wordmark: "/brand/yonaris-wordmark-navy.png",
		wordmarkOnDark: "/brand/yonaris-wordmark-white.png",
		chartColors: DEFAULT_CHART_COLORS,
	},
	analytics: {},
	defaultDelayHours: 24,
	canRegister: false,
	hasUsers: true,
};

export function setMockClientConfig(config: ClientConfig) {
	_config = config;
}

/**
 * Proxy-like object that always reads from the current `_config`.
 * This ensures that stories calling `setMockClientConfig` before render
 * will have the updated config read by child components.
 */
export const clientConfig: ClientConfig = new Proxy({} as ClientConfig, {
	get(_target, prop: string) {
		return (_config as unknown as Record<string, unknown>)[prop];
	},
});

export { _config as getDeployment };
