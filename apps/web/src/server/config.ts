/**
 * Server functions for providing deployment configuration to the client.
 */
import { createServerFn } from "@tanstack/react-start";
import { getEnvValidationState } from "@workspace/config/env";
import type { ClientConfig } from "@workspace/config/types";
import { getDefaultDelayHours } from "@workspace/lib/constants";
import { countUsers } from "@workspace/lib/db/provisioning";
import { redactMissingEnvironmentDetails } from "@/lib/auth/execution-boundaries";
import { getAuthSession, isAdmin } from "@/lib/auth/helpers";
import { getDeployment } from "@/lib/config/server";

export type PublicClientConfig = Omit<ClientConfig, "branding"> & {
	branding: Omit<ClientConfig["branding"], "onboardingRedirectUrl">;
};

/**
 * Get the client-safe deployment configuration.
 * This server function is called in the root route's loader
 * so the config is available to all routes via context.
 *
 * IMPORTANT: The return value must be fully serializable (no functions, classes, etc.).
 * BrandingConfig.onboardingRedirectUrl is a function, so we strip it and send the
 * raw template string instead. The client can reconstruct the function if needed.
 */
function resolvePosthogKey(): string | undefined {
	if (process.env.DISABLE_TELEMETRY) return undefined;
	return process.env.VITE_POSTHOG_KEY;
}

export const getClientConfig = createServerFn({ method: "GET" }).handler(async (): Promise<PublicClientConfig> => {
	const deployment = getDeployment();

	const { onboardingRedirectUrl, ...serializableBranding } = deployment.branding;

	const userCount = await countUsers();
	const hasUsers = userCount > 0;
	// Cloud is public self-serve, so registration is always open. Otherwise it's
	// only reachable in local mode before the first user signs up — once the
	// instance is bootstrapped, both the UI and API reject signups.
	const canRegister = deployment.features.selfServeSignup || (deployment.mode === "local" && !hasUsers);

	return {
		mode: deployment.mode,
		features: deployment.features,
		branding: serializableBranding,
		analytics: {
			plausibleDomain: process.env.VITE_PLAUSIBLE_DOMAIN,
			clarityProjectId: process.env.VITE_CLARITY_PROJECT_ID,
			posthogKey: resolvePosthogKey(),
			posthogHost: process.env.VITE_POSTHOG_HOST,
		},
		defaultDelayHours: getDefaultDelayHours(),
		canRegister,
		hasUsers,
	};
});

export const getEnvValidationStateFn = createServerFn({ method: "GET" }).handler(async () => {
	const envState = getEnvValidationState();
	let platformAdmin = false;
	try {
		const session = await getAuthSession();
		platformAdmin = session ? isAdmin(session) : false;
	} catch {
		// Invalid boot configuration can make session storage unavailable. The
		// public fallback must stay generic while still rendering recovery UI.
	}
	const missing = redactMissingEnvironmentDetails({
		missing: envState.missing,
		isValid: envState.isValid,
		platformAdmin,
	});
	return {
		mode: envState.mode,
		missing,
		isValid: envState.isValid,
	};
});
