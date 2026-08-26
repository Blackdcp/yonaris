import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	betterAuth: vi.fn(),
	getAuthoritativeSessionFromCtx: vi.fn(),
}));

vi.mock("better-auth", () => ({ betterAuth: mocks.betterAuth }));
vi.mock("better-auth/api", () => ({
	APIError: class TestAPIError extends Error {
		status: string;

		constructor(status: string, options?: { message?: string }) {
			super(options?.message);
			this.status = status;
		}
	},
	createAuthMiddleware: (handler: (context: unknown) => unknown) => handler,
	getAuthoritativeSessionFromCtx: mocks.getAuthoritativeSessionFromCtx,
}));
vi.mock("better-auth/adapters/drizzle", () => ({ drizzleAdapter: vi.fn(() => "adapter") }));
vi.mock("better-auth/plugins", () => ({
	admin: vi.fn(() => ({ id: "admin" })),
	customSession: vi.fn(() => ({ id: "custom-session" })),
	organization: vi.fn(() => ({ id: "organization" })),
}));
vi.mock("better-auth/tanstack-start", () => ({
	tanstackStartCookies: vi.fn(() => ({ id: "tanstack-start-cookies" })),
}));
vi.mock("@better-auth/sso", () => ({ sso: vi.fn(() => ({ id: "sso" })) }));
vi.mock("../db/db", () => ({ db: {} }));
vi.mock("../db/schema", () => ({}));
vi.mock("./permissions", () => ({ ac: {}, adminRole: {}, userRole: {} }));

import { createAuth } from "./server";

type CapturedAuthOptions = {
	user?: {
		additionalFields?: {
			uiLanguage?: {
				validator?: { input?: { safeParse: (value: unknown) => { success: boolean } } };
			};
		};
	};
	databaseHooks?: {
		user?: {
			create?: {
				before?: (
					user: Record<string, unknown>,
					context: { path?: string; getCookie?: (name: string) => string | null } | null,
				) => Promise<false | undefined | { data: Record<string, unknown> }>;
			};
		};
	};
	hooks?: {
		before?: (context: { path: string; body?: Record<string, unknown> }) => Promise<void>;
	};
};

function capturedOptions(): CapturedAuthOptions {
	return mocks.betterAuth.mock.calls.at(-1)?.[0] as CapturedAuthOptions;
}

function callbackContext(path: string, cookie: string) {
	const cookies = Object.fromEntries(
		cookie.split(";").map((entry) => {
			const [name, ...value] = entry.trim().split("=");
			return [name, value.join("=")];
		}),
	);
	return {
		path,
		getCookie: (name: string) => cookies[name] ?? null,
	};
}

describe("Better Auth UI language boundary", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.stubEnv("APP_URL", "https://portal.example.com");
		vi.stubEnv("BETTER_AUTH_SECRET", "test-secret");
		mocks.betterAuth.mockImplementation((options) => options);
	});

	it("validates sign-up and self-update input as the exact supported language union", () => {
		createAuth();
		const validator = capturedOptions().user?.additionalFields?.uiLanguage?.validator?.input;

		expect(validator?.safeParse("en").success).toBe(true);
		expect(validator?.safeParse("zh-CN").success).toBe(true);
		expect(validator?.safeParse("zh").success).toBe(false);
		expect(validator?.safeParse("CN").success).toBe(false);
	});

	it.each(["/callback/google", "/sso/callback/auth0-whitelabel"])(
		"seeds a new %s user from the validated anonymous language cookie",
		async (path) => {
			const deploymentHook = vi.fn(async () => ({ data: { role: "user" } }));
			createAuth({ databaseHooks: { user: { create: { before: deploymentHook } } } });
			const beforeCreate = capturedOptions().databaseHooks?.user?.create?.before;

			const result = await beforeCreate?.(
				{ email: "new@example.com", uiLanguage: "en" },
				callbackContext(path, "other=value; yonaris_ui_language=zh-CN"),
			);

			expect(deploymentHook).toHaveBeenCalledOnce();
			expect(result).toEqual({
				data: expect.objectContaining({ role: "user", uiLanguage: "zh-CN" }),
			});
		},
	);

	it("ignores an invalid callback cookie instead of persisting it", async () => {
		createAuth();
		const beforeCreate = capturedOptions().databaseHooks?.user?.create?.before;

		const result = await beforeCreate?.(
			{ email: "new@example.com", uiLanguage: "en" },
			callbackContext("/callback/google", "yonaris_ui_language=zh"),
		);

		expect(result).toEqual({
			data: expect.objectContaining({ uiLanguage: "en" }),
		});
	});

	it("blocks an admin from changing another user's language", async () => {
		mocks.getAuthoritativeSessionFromCtx.mockResolvedValue({ user: { id: "admin-user" } });
		createAuth();
		const beforeRequest = capturedOptions().hooks?.before;

		await expect(
			beforeRequest?.({
				path: "/admin/update-user",
				body: { userId: "target-user", data: { uiLanguage: "zh-CN" } },
			}),
		).rejects.toMatchObject({ status: "FORBIDDEN" });
	});

	it("allows a current user to change their own valid language through the admin route", async () => {
		mocks.getAuthoritativeSessionFromCtx.mockResolvedValue({ user: { id: "current-user" } });
		createAuth();
		const beforeRequest = capturedOptions().hooks?.before;

		await expect(
			beforeRequest?.({
				path: "/admin/update-user",
				body: { userId: "current-user", data: { uiLanguage: "zh-CN" } },
			}),
		).resolves.toBeUndefined();
	});

	it("rejects an unsupported language even for a current-user admin update", async () => {
		mocks.getAuthoritativeSessionFromCtx.mockResolvedValue({ user: { id: "current-user" } });
		createAuth();
		const beforeRequest = capturedOptions().hooks?.before;

		await expect(
			beforeRequest?.({
				path: "/admin/update-user",
				body: { userId: "current-user", data: { uiLanguage: "zh" } },
			}),
		).rejects.toMatchObject({ status: "BAD_REQUEST" });
	});
});
