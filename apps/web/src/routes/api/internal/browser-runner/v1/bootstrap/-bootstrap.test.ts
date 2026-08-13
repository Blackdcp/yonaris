import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({
	createFileRoute: () => (options: unknown) => options,
}));

import { Route as BootstrapRoute } from "../bootstrap";
import { Route as StatusRoute } from "./status";

type GetHandler = (input: { request: Request }) => Promise<Response>;
type MockRoute = { server: { handlers: { GET: GetHandler } } };

const token = "0123456789abcdef".repeat(4);

describe("Browser Runner bootstrap HTTP contract", () => {
	beforeEach(() => {
		vi.stubEnv("BROWSER_RUNNER_ENABLED", "true");
		vi.stubEnv("BROWSER_RUNNER_API_TOKEN", token);
		vi.stubEnv("BROWSER_RUNNER_ID", "yonaris-cn-doubao-01");
		vi.stubEnv("BROWSER_RUNNER_MARKET", "CN");
		vi.stubEnv("BROWSER_RUNNER_LOCALE", "zh-CN");
		vi.stubEnv("BROWSER_RUNNER_TIMEZONE", "Asia/Shanghai");
		vi.stubEnv("ADMIN_API_KEYS", "different-admin-token");
		vi.stubEnv("BROWSER_RUNNER_BOOTSTRAP_EXPIRES_AT", new Date(Date.now() + 15 * 60_000).toISOString());
	});

	afterEach(() => vi.unstubAllEnvs());

	it("serves only an encrypted no-store envelope without bearer authentication", async () => {
		const response = await get(BootstrapRoute, "/bootstrap");
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(response.headers.get("Cache-Control")).toBe("no-store");
		expect(Object.keys(body).sort()).toEqual(["algorithm", "ciphertext", "expiresAt", "keyFingerprint", "runnerId"]);
		expect(JSON.stringify(body)).not.toContain(token);
	});

	it("fails closed while the feature is disabled", async () => {
		vi.stubEnv("BROWSER_RUNNER_ENABLED", "false");
		const response = await get(BootstrapRoute, "/bootstrap");
		expect(response.status).toBe(503);
		expect(response.headers.get("Cache-Control")).toBe("no-store");
	});

	it("exposes readiness only to the dedicated bearer principal", async () => {
		const unauthorized = await get(StatusRoute, "/bootstrap/status");
		expect(unauthorized.status).toBe(401);

		const response = await get(StatusRoute, "/bootstrap/status", token);
		expect(response.status).toBe(200);
		expect(response.headers.get("Cache-Control")).toBe("no-store");
		expect(await response.json()).toEqual({
			ready: true,
			runner: {
				id: "yonaris-cn-doubao-01",
				locale: "zh-CN",
				market: "CN",
				timezone: "Asia/Shanghai",
			},
		});
	});
});

async function get(route: unknown, pathname: string, bearer?: string): Promise<Response> {
	const handler = (route as MockRoute).server.handlers.GET;
	return handler({
		request: new Request(`https://portal.example.test/api/internal/browser-runner/v1${pathname}`, {
			headers: bearer ? { Authorization: `Bearer ${bearer}` } : undefined,
		}),
	});
}
