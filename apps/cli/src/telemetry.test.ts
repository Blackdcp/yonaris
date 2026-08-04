import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const posthog = vi.hoisted(() => ({
	capture: vi.fn(),
	shutdown: vi.fn().mockResolvedValue(undefined),
	clientFactory: vi.fn(),
}));

vi.mock("posthog-node", () => ({
	PostHog: class {
		capture = posthog.capture;
		shutdown = posthog.shutdown;

		constructor(key: string, options: { host: string }) {
			posthog.clientFactory(key, options);
		}
	},
}));

import { trackCliEvent } from "./telemetry.js";

describe("CLI telemetry", () => {
	let configDir: string;

	beforeEach(async () => {
		configDir = await mkdtemp(path.join(tmpdir(), "yonaris-cli-telemetry-"));
		await writeFile(path.join(configDir, ".env"), "DEPLOYMENT_ID=test-deployment\n", "utf8");
		posthog.capture.mockClear();
		posthog.shutdown.mockClear();
		posthog.clientFactory.mockClear();
		vi.stubEnv("DISABLE_TELEMETRY", "");
		vi.stubEnv("YONARIS_POSTHOG_KEY", "");
		vi.stubEnv("YONARIS_POSTHOG_HOST", "");
	});

	afterEach(async () => {
		vi.unstubAllEnvs();
		await rm(configDir, { recursive: true, force: true });
	});

	it("does nothing when no Yonaris-owned key and endpoint are configured", async () => {
		await trackCliEvent(configDir, "cli_init");

		expect(posthog.clientFactory).not.toHaveBeenCalled();
		expect(posthog.capture).not.toHaveBeenCalled();
	});

	it.each([
		["key only", "yonaris-project-key", ""],
		["host only", "", "https://telemetry.yonaris.example"],
	])("does nothing with %s", async (_label, key, host) => {
		vi.stubEnv("YONARIS_POSTHOG_KEY", key);
		vi.stubEnv("YONARIS_POSTHOG_HOST", host);

		await trackCliEvent(configDir, "cli_init");

		expect(posthog.clientFactory).not.toHaveBeenCalled();
	});

	it("sends only when both Yonaris telemetry settings are present", async () => {
		vi.stubEnv("YONARIS_POSTHOG_KEY", "yonaris-project-key");
		vi.stubEnv("YONARIS_POSTHOG_HOST", "https://telemetry.yonaris.example");

		await trackCliEvent(configDir, "cli_init", { version: "1.0.0" });

		expect(posthog.clientFactory).toHaveBeenCalledWith("yonaris-project-key", {
			host: "https://telemetry.yonaris.example/",
		});
		expect(posthog.capture).toHaveBeenCalledWith({
			distinctId: "test-deployment",
			event: "cli_init",
			properties: { version: "1.0.0" },
		});
		expect(posthog.shutdown).toHaveBeenCalledOnce();
	});

	it("can read an explicitly configured Yonaris destination from the deployment env", async () => {
		vi.stubEnv("YONARIS_POSTHOG_KEY", undefined);
		vi.stubEnv("YONARIS_POSTHOG_HOST", undefined);
		await writeFile(
			path.join(configDir, ".env"),
			[
				"DEPLOYMENT_ID=test-deployment",
				"YONARIS_POSTHOG_KEY=yonaris-project-key",
				"YONARIS_POSTHOG_HOST=https://telemetry.yonaris.example",
			].join("\n"),
			"utf8",
		);

		await trackCliEvent(configDir, "cli_upgrade");

		expect(posthog.clientFactory).toHaveBeenCalledWith("yonaris-project-key", {
			host: "https://telemetry.yonaris.example/",
		});
		expect(posthog.capture).toHaveBeenCalledWith({
			distinctId: "test-deployment",
			event: "cli_upgrade",
			properties: {},
		});
	});

	it("rejects non-HTTPS telemetry endpoints", async () => {
		vi.stubEnv("YONARIS_POSTHOG_KEY", "yonaris-project-key");
		vi.stubEnv("YONARIS_POSTHOG_HOST", "http://telemetry.yonaris.example");

		await trackCliEvent(configDir, "cli_init");

		expect(posthog.clientFactory).not.toHaveBeenCalled();
	});

	it("honors DISABLE_TELEMETRY even when a destination is configured", async () => {
		vi.stubEnv("DISABLE_TELEMETRY", "1");
		vi.stubEnv("YONARIS_POSTHOG_KEY", "yonaris-project-key");
		vi.stubEnv("YONARIS_POSTHOG_HOST", "https://telemetry.yonaris.example");

		await trackCliEvent(configDir, "cli_init");

		expect(posthog.clientFactory).not.toHaveBeenCalled();
	});
});
