import fs from "node:fs/promises";
import path from "node:path";
import { parse } from "dotenv";
import { PostHog } from "posthog-node";

const TELEMETRY_KEY_ENV = "YONARIS_POSTHOG_KEY";
const TELEMETRY_HOST_ENV = "YONARIS_POSTHOG_HOST";

function envDisabled(): boolean {
	return Boolean(process.env.DISABLE_TELEMETRY);
}

async function readEnvKey(configDir: string, key: string): Promise<string | undefined> {
	try {
		const contents = await fs.readFile(path.join(configDir, ".env"), "utf8");
		return parse(contents)[key];
	} catch {
		return undefined;
	}
}

async function isTelemetryDisabled(configDir: string): Promise<boolean> {
	if (envDisabled()) return true;
	return Boolean(await readEnvKey(configDir, "DISABLE_TELEMETRY"));
}

async function resolveTelemetryConfig(configDir: string): Promise<{ key: string; host: string } | null> {
	const key = process.env[TELEMETRY_KEY_ENV] ?? (await readEnvKey(configDir, TELEMETRY_KEY_ENV));
	const host = process.env[TELEMETRY_HOST_ENV] ?? (await readEnvKey(configDir, TELEMETRY_HOST_ENV));
	if (!key || !host) return null;

	try {
		const url = new URL(host);
		if (url.protocol !== "https:") return null;
		return { key, host: url.toString() };
	} catch {
		return null;
	}
}

export async function trackCliEvent(
	configDir: string,
	eventName: string,
	properties?: Record<string, string | number | boolean | undefined>,
	personProperties?: Record<string, string | number | boolean | undefined>,
): Promise<void> {
	if (await isTelemetryDisabled(configDir)) return;
	const distinctId = await readEnvKey(configDir, "DEPLOYMENT_ID");
	if (!distinctId) return;
	const telemetry = await resolveTelemetryConfig(configDir);
	if (!telemetry) return;

	try {
		const client = new PostHog(telemetry.key, { host: telemetry.host });
		client.capture({
			distinctId,
			event: eventName,
			properties: {
				...properties,
				...(personProperties ? { $set: personProperties } : {}),
			},
		});
		await client.shutdown();
	} catch {
		// Telemetry should never block the CLI
	}
}
