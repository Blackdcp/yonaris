import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
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

	it("derives a CN principal from server configuration rather than request input", () => {
		expect(browserRunnerEnabled()).toBe(true);
		const principal = requireBrowserRunner(
			new Request("https://portal.example/api/internal/browser-runner/v1/tasks/claim", {
				headers: { Authorization: `Bearer ${token}` },
			}),
		);
		expect(principal).toEqual({ id: "cn-runner-1", market: "CN", locale: "zh-CN", timezone: "Asia/Shanghai" });
	});

	it("fails closed when the runner token is reused as an admin key or localization is not exact", () => {
		vi.stubEnv("ADMIN_API_KEYS", `admin-other,${token}`);
		expect(browserRunnerEnabled()).toBe(false);
		expect(() =>
			requireBrowserRunner(
				new Request("https://portal.example/api/internal/browser-runner/v1/tasks/claim", {
					headers: { Authorization: `Bearer ${token}` },
				}),
			),
		).toThrow(expect.objectContaining({ status: 503 }));
		vi.stubEnv("ADMIN_API_KEYS", "admin-other");
		vi.stubEnv("BROWSER_RUNNER_TIMEZONE", "UTC");
		expect(browserRunnerEnabled()).toBe(false);
	});

	it("fails closed with 503 when explicitly disabled", () => {
		vi.stubEnv("BROWSER_RUNNER_ENABLED", "false");
		expect(() =>
			requireBrowserRunner(
				new Request("https://portal.example/api/internal/browser-runner/v1/tasks/claim", {
					headers: { Authorization: `Bearer ${token}` },
				}),
			),
		).toThrow(expect.objectContaining({ status: 503 }));
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
