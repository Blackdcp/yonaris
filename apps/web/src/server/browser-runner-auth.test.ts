import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
	authenticateRunnerRequest,
	type BrowserRunnerHttpError,
	browserRunnerEnabled,
	parseBrowserRunnerJson,
	requireBrowserRunner,
} from "./browser-runner-auth";

const token = "runner-token-that-is-longer-than-thirty-two-characters";

describe("Browser Runner machine authentication", () => {
	beforeEach(() => {
		vi.stubEnv("BROWSER_RUNNER_ENABLED", "true");
		vi.stubEnv("BROWSER_RUNNER_API_TOKEN", token);
		vi.stubEnv("BROWSER_RUNNER_ID", "cn-runner-1");
		vi.stubEnv("BROWSER_RUNNER_MARKET", "CN");
		vi.stubEnv("BROWSER_RUNNER_LOCALE", "zh-CN");
		vi.stubEnv("BROWSER_RUNNER_TIMEZONE", "Asia/Shanghai");
		vi.stubEnv("ADMIN_API_KEYS", "admin-token-that-is-distinct-and-long-enough");
	});

	afterEach(() => vi.unstubAllEnvs());

	it("derives a CN legacy-host principal from server configuration rather than request input", async () => {
		expect(browserRunnerEnabled()).toBe(true);
		const principal = await requireBrowserRunner(
			new Request("https://portal.example/api/internal/browser-runner/v1/tasks/claim", {
				headers: { Authorization: `Bearer ${token}` },
			}),
		);
		expect(principal).toEqual({
			kind: "legacy_host",
			id: "cn-runner-1",
			market: "CN",
			locale: "zh-CN",
			timezone: "Asia/Shanghai",
		});
	});

	it("authenticates a paired device and preserves its brand and surface capabilities", async () => {
		const deviceToken = `yrd_${"a".repeat(43)}`;
		const principal = await authenticateRunnerRequest(
			new Request("https://portal.example/api/internal/browser-runner/v1/tasks/claim", {
				headers: { Authorization: `Bearer ${deviceToken}` },
			}),
			{
				authenticateDevice: async (receivedToken) => {
					expect(receivedToken).toBe(deviceToken);
					return {
						id: "11111111-1111-4111-8111-111111111111",
						allowedBrandIds: ["stepfun"],
						supportedSurfaces: ["doubao.consumer_web", "deepseek.consumer_web"],
						readiness: {
							"doubao.consumer_web": {
								status: "ready",
								adapterVersion: "doubao-web-20260819-localpc-v8",
								activeConcurrency: 0,
							},
							"deepseek.consumer_web": {
								status: "ready",
								adapterVersion: "deepseek-web-stale",
								activeConcurrency: 0,
							},
						},
						revokedAt: null,
					};
				},
			},
		);

		expect(principal).toEqual({
			kind: "browser_extension",
			id: "11111111-1111-4111-8111-111111111111",
			market: "CN",
			locale: "zh-CN",
			timezone: "Asia/Shanghai",
			allowedBrandIds: ["stepfun"],
			supportedSurfaces: ["doubao.consumer_web", "deepseek.consumer_web"],
			readySurfaces: ["doubao.consumer_web"],
		});
	});

	it("keeps an unqualified DeepSeek adapter out of ready surfaces even when the client reports ready", async () => {
		const deviceToken = `yrd_${"c".repeat(43)}`;
		const principal = await authenticateRunnerRequest(
			new Request("https://portal.example/api/internal/browser-runner/v1/tasks/claim", {
				headers: { Authorization: `Bearer ${deviceToken}` },
			}),
			{
				authenticateDevice: async () => ({
					id: "11111111-1111-4111-8111-111111111111",
					allowedBrandIds: ["stepfun"],
					supportedSurfaces: ["deepseek.consumer_web"],
					readiness: {
						"deepseek.consumer_web": {
							status: "ready",
							adapterVersion: "deepseek-web-20260814-uat1",
							activeConcurrency: 0,
						},
					},
					revokedAt: null,
				}),
			},
		);

		expect(principal).toMatchObject({ readySurfaces: [] });
	});

	it("keeps the production-approved Doubao v8 adapter in ready surfaces", async () => {
		const principal = await authenticateRunnerRequest(
			new Request("https://portal.example/api/internal/browser-runner/v1/tasks/claim", {
				headers: { Authorization: `Bearer yrd_${"d".repeat(43)}` },
			}),
			{
				authenticateDevice: async () => ({
					id: "11111111-1111-4111-8111-111111111111",
					allowedBrandIds: ["stepfun"],
					supportedSurfaces: ["doubao.consumer_web"],
					readiness: {
						"doubao.consumer_web": {
							status: "ready",
							adapterVersion: "doubao-web-20260819-localpc-v8",
							activeConcurrency: 0,
						},
					},
					revokedAt: null,
				}),
			},
		);

		expect(principal).toMatchObject({ readySurfaces: ["doubao.consumer_web"] });
	});

	it("rejects a revoked paired device before any task body is parsed", async () => {
		await expect(
			authenticateRunnerRequest(
				new Request("https://portal.example/api/internal/browser-runner/v1/tasks/claim", {
					headers: { Authorization: `Bearer yrd_${"b".repeat(43)}` },
				}),
				{
					authenticateDevice: async () => ({
						id: "11111111-1111-4111-8111-111111111111",
						allowedBrandIds: ["stepfun"],
						supportedSurfaces: ["deepseek.consumer_web"],
						readiness: {},
						revokedAt: new Date("2026-08-16T10:00:00.000Z"),
					}),
				},
			),
		).rejects.toMatchObject({ status: 401 });
	});

	it("fails closed when the runner token is reused as an admin key or localization is not exact", async () => {
		vi.stubEnv("ADMIN_API_KEYS", `admin-other,${token}`);
		expect(browserRunnerEnabled()).toBe(false);
		await expect(
			requireBrowserRunner(
				new Request("https://portal.example/api/internal/browser-runner/v1/tasks/claim", {
					headers: { Authorization: `Bearer ${token}` },
				}),
			),
		).rejects.toMatchObject({ status: 503 });
		vi.stubEnv("ADMIN_API_KEYS", "admin-other");
		vi.stubEnv("BROWSER_RUNNER_TIMEZONE", "UTC");
		expect(browserRunnerEnabled()).toBe(false);
	});

	it("fails closed with 503 when explicitly disabled", async () => {
		vi.stubEnv("BROWSER_RUNNER_ENABLED", "false");
		await expect(
			requireBrowserRunner(
				new Request("https://portal.example/api/internal/browser-runner/v1/tasks/claim", {
					headers: { Authorization: `Bearer ${token}` },
				}),
			),
		).rejects.toMatchObject({ status: 503 });
	});

	it("bounds JSON before parsing and rejects client-authored identity fields", async () => {
		const schema = z.object({ brandId: z.string() }).strict();
		await expect(
			parseBrowserRunnerJson(
				new Request("https://portal.example/internal", {
					method: "POST",
					headers: { "Content-Length": String(1024 * 1024 + 1) },
					body: "{}",
				}),
				schema,
			),
		).rejects.toMatchObject({ status: 413 } satisfies Partial<BrowserRunnerHttpError>);

		await expect(
			parseBrowserRunnerJson(
				new Request("https://portal.example/internal", {
					method: "POST",
					body: JSON.stringify({ brandId: "stepfun", runnerId: "spoofed" }),
				}),
				schema,
			),
		).rejects.toMatchObject({ status: 400 } satisfies Partial<BrowserRunnerHttpError>);
	});

	it("allows a complete-only 6 MiB ceiling without widening the 1 MiB default", async () => {
		const schema = z.object({ answer: z.string() }).strict();
		const answer = "阶".repeat(400_000);
		const body = JSON.stringify({ answer });
		expect(new TextEncoder().encode(body).byteLength).toBeGreaterThan(1024 * 1024);
		await expect(
			parseBrowserRunnerJson(new Request("https://portal.example/internal", { method: "POST", body }), schema),
		).rejects.toMatchObject({ status: 413 });
		await expect(
			parseBrowserRunnerJson(new Request("https://portal.example/internal", { method: "POST", body }), schema, {
				maxBytes: 6 * 1024 * 1024,
			}),
		).resolves.toEqual({ answer });

		const envelopeBytes = new TextEncoder().encode('{"answer":""}').byteLength;
		const exactBody = JSON.stringify({ answer: "x".repeat(6 * 1024 * 1024 - envelopeBytes) });
		await expect(
			parseBrowserRunnerJson(
				new Request("https://portal.example/internal", { method: "POST", body: exactBody }),
				schema,
				{
					maxBytes: 6 * 1024 * 1024,
				},
			),
		).resolves.toHaveProperty("answer");
		const oversizedBody = JSON.stringify({ answer: "x".repeat(6 * 1024 * 1024 - envelopeBytes + 1) });
		await expect(
			parseBrowserRunnerJson(
				new Request("https://portal.example/internal", { method: "POST", body: oversizedBody }),
				schema,
				{ maxBytes: 6 * 1024 * 1024 },
			),
		).rejects.toMatchObject({ status: 413 });
	});
});
