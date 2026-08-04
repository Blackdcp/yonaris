import { PostHog } from "posthog-node";

const DEFAULT_POSTHOG_HOST = "https://us.i.posthog.com";

let client: PostHog | null = null;

function isTelemetryDisabled(): boolean {
	return Boolean(process.env.DISABLE_TELEMETRY);
}

function getClient(): PostHog | null {
	if (isTelemetryDisabled()) return null;
	if (!process.env.DEPLOYMENT_ID) return null;
	if (!process.env.VITE_POSTHOG_KEY) return null;
	if (client) return client;
	client = new PostHog(process.env.VITE_POSTHOG_KEY, {
		host: process.env.VITE_POSTHOG_HOST ?? DEFAULT_POSTHOG_HOST,
		flushAt: 20,
		flushInterval: 30_000,
	});
	return client;
}

export function trackWorkerEvent(
	eventName: string,
	properties?: Record<string, string | number | boolean | string[] | undefined>,
): void {
	const ph = getClient();
	if (!ph) return;

	try {
		ph.capture({
			distinctId: process.env.DEPLOYMENT_ID,
			event: eventName,
			properties: {
				deployment_mode: process.env.DEPLOYMENT_MODE ?? "local",
				...properties,
			},
		});
	} catch {
		// Telemetry must never interfere with job processing
	}
}

export async function shutdownTelemetry(): Promise<void> {
	if (client) {
		await client.shutdown();
		client = null;
	}
}
