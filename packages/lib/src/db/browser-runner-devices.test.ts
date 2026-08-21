import { getTableConfig, PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { resolvePairingConsumption, validateDeviceHeartbeat } from "./browser-runner-devices";
import { browserRunnerDevices } from "./schema";

const NOW = new Date("2026-08-16T10:00:00.000Z");

describe("browser runner device pairing policy", () => {
	it("consumes a live pairing exactly once and rejects its expiry boundary", () => {
		expect(resolvePairingConsumption({ expiresAt: new Date("2026-08-16T10:01:00.000Z"), consumedAt: null }, NOW)).toBe(
			"consume",
		);
		expect(
			resolvePairingConsumption(
				{ expiresAt: new Date("2026-08-16T10:01:00.000Z"), consumedAt: new Date("2026-08-16T09:59:59.000Z") },
				NOW,
			),
		).toBe("reject");
		expect(resolvePairingConsumption({ expiresAt: new Date("2026-08-16T10:00:00.000Z"), consumedAt: null }, NOW)).toBe(
			"reject",
		);
	});

	it("accepts bounded coarse readiness for all seven Chrome surfaces", () => {
		expect(() =>
			validateDeviceHeartbeat({
				extensionVersion: "0.1.0",
				browserFamily: "chrome",
				browserVersion: "140.0.7339.81",
				platform: "windows",
				supportedSurfaces: [
					"doubao.consumer_web",
					"deepseek.consumer_web",
					"qwen.consumer_web",
					"kimi.consumer_web",
					"wenxin.consumer_web",
					"yuanbao.consumer_web",
					"zhipu.consumer_web",
				],
				readiness: {
					"doubao.consumer_web": {
						status: "ready",
						adapterVersion: "doubao-web-v1",
						activeConcurrency: 5,
					},
					"deepseek.consumer_web": {
						status: "signed_out",
						adapterVersion: "deepseek-web-v1",
						activeConcurrency: 0,
					},
					"qwen.consumer_web": { status: "unavailable", adapterVersion: "qwen-web-v1", activeConcurrency: 0 },
					"kimi.consumer_web": { status: "unavailable", adapterVersion: "kimi-web-v1", activeConcurrency: 0 },
					"wenxin.consumer_web": { status: "unavailable", adapterVersion: "wenxin-web-v1", activeConcurrency: 0 },
					"yuanbao.consumer_web": { status: "unavailable", adapterVersion: "yuanbao-web-v1", activeConcurrency: 0 },
					"zhipu.consumer_web": { status: "unavailable", adapterVersion: "zhipu-web-v1", activeConcurrency: 0 },
				},
			}),
		).not.toThrow();
	});

	it("declares database checks for one to seven registered surfaces", () => {
		const dialect = new PgDialect();
		const checks = Object.fromEntries(
			getTableConfig(browserRunnerDevices).checks.map((check) => [check.name, dialect.sqlToQuery(check.value).sql]),
		);

		expect(checks.browser_runner_devices_valid_surface_count).toMatch(/BETWEEN 1 AND 7/);
		for (const surface of [
			"doubao.consumer_web",
			"deepseek.consumer_web",
			"qwen.consumer_web",
			"kimi.consumer_web",
			"wenxin.consumer_web",
			"yuanbao.consumer_web",
			"zhipu.consumer_web",
		]) {
			expect(checks.browser_runner_devices_valid_surfaces).toContain(surface);
		}
	});

	it("rejects unsupported surfaces and readiness keys", () => {
		expect(() =>
			validateDeviceHeartbeat({
				extensionVersion: "0.1.0",
				browserFamily: "chrome",
				browserVersion: "140.0.7339.81",
				platform: "macos",
				supportedSurfaces: ["chatgpt.consumer_web"],
				readiness: {},
			}),
		).toThrow(/unsupported surface/i);
		expect(() =>
			validateDeviceHeartbeat({
				extensionVersion: "0.1.0",
				browserFamily: "chrome",
				browserVersion: "140.0.7339.81",
				platform: "macos",
				supportedSurfaces: ["deepseek.consumer_web"],
				readiness: {
					"doubao.consumer_web": {
						status: "ready",
						adapterVersion: "doubao-web-v1",
						activeConcurrency: 5,
					},
				},
			}),
		).toThrow(/readiness surface .* was not declared/i);
	});

	it("rejects non-Chrome clients, unsupported operating systems, and unsafe concurrency", () => {
		const valid = {
			extensionVersion: "0.1.0",
			browserFamily: "chrome",
			browserVersion: "140.0.7339.81",
			platform: "windows",
			supportedSurfaces: ["doubao.consumer_web"],
			readiness: {
				"doubao.consumer_web": {
					status: "ready",
					adapterVersion: "doubao-web-v1",
					activeConcurrency: 5,
				},
			},
		};

		expect(() => validateDeviceHeartbeat({ ...valid, browserFamily: "edge" })).toThrow(/Chrome/i);
		expect(() => validateDeviceHeartbeat({ ...valid, platform: "linux" })).toThrow(/Windows or macOS/i);
		expect(() =>
			validateDeviceHeartbeat({
				...valid,
				readiness: {
					"doubao.consumer_web": { ...valid.readiness["doubao.consumer_web"], activeConcurrency: 11 },
				},
			}),
		).toThrow(/concurrency.*between 0 and 10/i);
	});
});
