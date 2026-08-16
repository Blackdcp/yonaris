import { BrowserRunnerDeviceError } from "@workspace/lib/db/browser-runner-devices";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { pairBrowserRunnerDevice, updateBrowserRunnerDeviceHeartbeat } from "./browser-runner-devices";

const heartbeat = {
	extensionVersion: "0.1.0",
	browserFamily: "chrome" as const,
	browserVersion: "140.0.7339.81",
	platform: "windows" as const,
	supportedSurfaces: ["doubao.consumer_web", "deepseek.consumer_web"] as Array<
		"doubao.consumer_web" | "deepseek.consumer_web"
	>,
	readiness: {
		"doubao.consumer_web": {
			status: "ready" as const,
			adapterVersion: "doubao-web-v1",
			activeConcurrency: 5,
		},
	},
};

describe("browser extension device service", () => {
	beforeEach(() => vi.stubEnv("BROWSER_RUNNER_ENABLED", "true"));
	afterEach(() => vi.unstubAllEnvs());

	it("returns a paired device token once without echoing device metadata", async () => {
		const result = await pairBrowserRunnerDevice(
			{ code: "yrp_pairing", ...heartbeat },
			{
				consumePairing: async () => ({
					device: { id: "11111111-1111-4111-8111-111111111111" },
					token: `yrd_${"a".repeat(43)}`,
					allowedBrandIds: ["stepfun"],
				}),
			},
		);

		expect(result).toEqual({
			deviceId: "11111111-1111-4111-8111-111111111111",
			deviceToken: `yrd_${"a".repeat(43)}`,
			allowedBrandIds: ["stepfun"],
		});
		expect(JSON.stringify(result)).not.toContain("browserVersion");
	});

	it("maps an invalid or consumed pairing to a generic authentication error", async () => {
		await expect(
			pairBrowserRunnerDevice(
				{ code: "yrp_invalid", ...heartbeat },
				{
					consumePairing: async () => {
						throw new BrowserRunnerDeviceError("Pairing code is invalid, expired, or already consumed");
					},
				},
			),
		).rejects.toMatchObject({ status: 401, message: "Valid pairing code required" });
	});

	it("updates coarse readiness for a paired device without returning its token", async () => {
		const result = await updateBrowserRunnerDeviceHeartbeat(
			{
				kind: "browser_extension",
				id: "11111111-1111-4111-8111-111111111111",
				market: "CN",
				locale: "zh-CN",
				timezone: "Asia/Shanghai",
				allowedBrandIds: ["stepfun"],
				supportedSurfaces: ["doubao.consumer_web", "deepseek.consumer_web"],
			},
			heartbeat,
			{
				heartbeatDevice: async () => ({
					id: "11111111-1111-4111-8111-111111111111",
					lastSeenAt: new Date("2026-08-16T10:00:00.000Z"),
				}),
				now: () => new Date("2026-08-16T10:00:00.000Z"),
			},
		);

		expect(result).toEqual({
			deviceId: "11111111-1111-4111-8111-111111111111",
			serverTime: "2026-08-16T10:00:00.000Z",
			featureVersion: "browser-extension.v1",
		});
		expect(JSON.stringify(result)).not.toMatch(/token|phone|account/i);
	});

	it("rejects the legacy host principal from the paired-device heartbeat", async () => {
		await expect(
			updateBrowserRunnerDeviceHeartbeat(
				{
					kind: "legacy_host",
					id: "cn-runner-1",
					market: "CN",
					locale: "zh-CN",
					timezone: "Asia/Shanghai",
				},
				heartbeat,
			),
		).rejects.toMatchObject({ status: 403 });
	});
});
