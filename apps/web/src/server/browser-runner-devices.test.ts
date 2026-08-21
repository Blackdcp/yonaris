import { BROWSER_EXTENSION_SURFACES } from "@workspace/lib/browser-extension-contract";
import { BrowserRunnerDeviceError } from "@workspace/lib/db/browser-runner-devices";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	browserRunnerDeviceHeartbeatSchema,
	pairBrowserRunnerDevice,
	projectEffectiveBrowserRunnerReadiness,
	updateBrowserRunnerDeviceHeartbeat,
} from "./browser-runner-devices";

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

	it("accepts one paired device advertising every registered browser surface", () => {
		const readiness = Object.fromEntries(
			BROWSER_EXTENSION_SURFACES.map((surface) => [
				surface,
				{ status: "ready", adapterVersion: `${surface}-v1`, activeConcurrency: 1 },
			]),
		);

		expect(
			browserRunnerDeviceHeartbeatSchema.safeParse({
				...heartbeat,
				supportedSurfaces: [...BROWSER_EXTENSION_SURFACES],
				readiness,
			}).success,
		).toBe(true);
	});

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
				readySurfaces: ["doubao.consumer_web"],
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

	it("lets an authenticated two-surface device advertise the current six-surface capability set", async () => {
		const expandedHeartbeat = {
			...heartbeat,
			extensionVersion: "0.3.0",
			supportedSurfaces: [...BROWSER_EXTENSION_SURFACES],
			readiness: {},
		};
		const heartbeatDevice = vi.fn(async () => ({
			id: "11111111-1111-4111-8111-111111111111",
		}));

		await expect(
			updateBrowserRunnerDeviceHeartbeat(
				{
					kind: "browser_extension",
					id: "11111111-1111-4111-8111-111111111111",
					market: "CN",
					locale: "zh-CN",
					timezone: "Asia/Shanghai",
					allowedBrandIds: ["ppio"],
					supportedSurfaces: ["doubao.consumer_web", "deepseek.consumer_web"],
					readySurfaces: [],
				},
				expandedHeartbeat,
				{ heartbeatDevice },
			),
		).resolves.toMatchObject({ deviceId: "11111111-1111-4111-8111-111111111111" });
		expect(heartbeatDevice).toHaveBeenCalledWith({
			deviceId: "11111111-1111-4111-8111-111111111111",
			heartbeat: expandedHeartbeat,
		});
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

	it("keeps the production-approved v8 readiness effective", () => {
		expect(
			projectEffectiveBrowserRunnerReadiness(
				{
					"doubao.consumer_web": {
						status: "ready",
						adapterVersion: "doubao-web-20260821-localpc-v9",
						activeConcurrency: 5,
					},
					"deepseek.consumer_web": {
						status: "ready",
						adapterVersion: "deepseek-web-20260814-uat1",
						activeConcurrency: 1,
					},
				},
				["doubao.consumer_web", "deepseek.consumer_web"],
			),
		).toEqual({
			"doubao.consumer_web": {
				status: "ready",
				adapterVersion: "doubao-web-20260821-localpc-v9",
				activeConcurrency: 5,
			},
			"deepseek.consumer_web": {
				status: "adapter_incompatible",
				adapterVersion: "deepseek-web-20260814-uat1",
				activeConcurrency: 0,
			},
		});
	});

	it("marks the retired v7 readiness adapter_incompatible after activation", () => {
		expect(
			projectEffectiveBrowserRunnerReadiness(
				{
					"doubao.consumer_web": {
						status: "ready",
						adapterVersion: "doubao-web-20260818-localpc-v7",
						activeConcurrency: 1,
					},
					"deepseek.consumer_web": {
						status: "unavailable",
						adapterVersion: "deepseek-web-20260814-uat1",
						activeConcurrency: 0,
					},
				},
				["doubao.consumer_web", "deepseek.consumer_web"],
			),
		).toEqual({
			"doubao.consumer_web": {
				status: "adapter_incompatible",
				adapterVersion: "doubao-web-20260818-localpc-v7",
				activeConcurrency: 0,
			},
			"deepseek.consumer_web": {
				status: "unavailable",
				adapterVersion: "deepseek-web-20260814-uat1",
				activeConcurrency: 0,
			},
		});
	});
});
