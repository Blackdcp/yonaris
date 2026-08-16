import { describe, expect, it } from "vitest";
import { resolvePairingConsumption, validateDeviceHeartbeat } from "./browser-runner-devices";

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

	it("accepts bounded coarse readiness for the two approved Chrome surfaces", () => {
		expect(() =>
			validateDeviceHeartbeat({
				extensionVersion: "0.1.0",
				browserFamily: "chrome",
				browserVersion: "140.0.7339.81",
				platform: "windows",
				supportedSurfaces: ["doubao.consumer_web", "deepseek.consumer_web"],
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
				},
			}),
		).not.toThrow();
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
