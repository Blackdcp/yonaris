import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	getCookie: vi.fn(),
	getRequestHeaders: vi.fn(),
	setCookie: vi.fn(),
	resolveAuthSession: vi.fn(),
	update: vi.fn(),
	set: vi.fn(),
	where: vi.fn(),
	eq: vi.fn(),
	validator: undefined as { shape?: Record<string, unknown> } | undefined,
}));

vi.mock("@tanstack/react-start", () => ({
	createServerFn: () => ({
		handler: (handler: (args?: unknown) => unknown) => handler,
		validator: (validator: { shape?: Record<string, unknown> }) => {
			mocks.validator = validator;
			return { handler: (handler: (args: { data: unknown }) => unknown) => handler };
		},
	}),
}));

vi.mock("@tanstack/react-start/server", () => ({
	getCookie: mocks.getCookie,
	getRequestHeaders: mocks.getRequestHeaders,
	setCookie: mocks.setCookie,
}));

vi.mock("@workspace/lib/db/db", () => ({
	db: { update: mocks.update },
}));

vi.mock("@workspace/lib/db/schema", () => ({
	user: { id: "user.id" },
}));

vi.mock("drizzle-orm", () => ({ eq: mocks.eq }));

vi.mock("@/lib/auth/resolve-session", () => ({
	resolveAuthSession: mocks.resolveAuthSession,
}));

import { getUiLanguageFn, resolveUiLanguage, setUiLanguageFn, validateUiLanguageUpdate } from "./ui-language";

describe("UI language resolution", () => {
	it("prefers the saved user language", () => {
		expect(resolveUiLanguage({ saved: "zh-CN", cookie: "en", acceptLanguage: "en-US" })).toBe("zh-CN");
	});

	it("falls back to the language cookie", () => {
		expect(resolveUiLanguage({ saved: undefined, cookie: "zh-CN", acceptLanguage: "en-US" })).toBe("zh-CN");
	});

	it("maps Chinese browser preferences to simplified Chinese", () => {
		expect(resolveUiLanguage({ saved: undefined, cookie: undefined, acceptLanguage: "zh-SG,zh;q=0.9" })).toBe("zh-CN");
	});

	it("uses English for unsupported browser preferences", () => {
		expect(resolveUiLanguage({ saved: undefined, cookie: undefined, acceptLanguage: "fr-FR" })).toBe("en");
	});

	it.each([
		["en-US,en;q=0.9,zh-CN;q=0.8", "en"],
		["zh-CN,zh;q=0.9,en;q=0.8", "zh-CN"],
		["en;q=0.8,zh-CN;q=0.8", "en"],
		["zh-CN;q=0.8,en;q=0.8", "zh-CN"],
		["fr-FR,zh-CN;q=0.7,en;q=0.6", "zh-CN"],
		["*,en;q=0.7", "en"],
		["zh-CN;q=bogus,en;q=0.5", "en"],
		["zh-CN;q=0,en;q=0.5", "en"],
		["zh_XX,en;q=0.5", "en"],
	] as const)("negotiates %s as %s", (acceptLanguage, expected) => {
		expect(resolveUiLanguage({ acceptLanguage })).toBe(expected);
	});

	it.each([
		["zh-CN", "en-US", "zh-CN"],
		[undefined, "zh-SG,zh;q=0.9", "zh-CN"],
	] as const)(
		"uses cookie/browser recovery when session storage is unavailable",
		async (cookie, acceptLanguage, expected) => {
			vi.clearAllMocks();
			mocks.getRequestHeaders.mockReturnValue(new Headers({ "accept-language": acceptLanguage }));
			mocks.getCookie.mockReturnValue(cookie);
			mocks.resolveAuthSession.mockRejectedValue(new Error("session storage unavailable"));

			await expect(getUiLanguageFn()).resolves.toBe(expected);
		},
	);

	it("rejects unsupported user language updates", () => {
		expect(() => validateUiLanguageUpdate("CN")).toThrow("Unsupported language");
	});
});

describe("UI language write execution boundary", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.getRequestHeaders.mockReturnValue(new Headers({ cookie: "better-auth.session_token=signed-cookie" }));
		mocks.resolveAuthSession.mockResolvedValue({ user: { id: "session-user" } });
		mocks.update.mockReturnValue({ set: mocks.set });
		mocks.set.mockReturnValue({ where: mocks.where });
	});

	it("updates the authenticated session user without accepting a user id", async () => {
		await setUiLanguageFn({ data: { uiLanguage: "zh-CN" } });

		expect(mocks.resolveAuthSession).toHaveBeenCalledWith(expect.any(Headers));
		expect(mocks.eq).toHaveBeenCalledWith("user.id", "session-user");
		expect(mocks.set).toHaveBeenCalledWith({ uiLanguage: "zh-CN" });
		expect(mocks.validator?.shape).not.toHaveProperty("userId");
	});

	it("persists the cookie without a database write for an anonymous auth page", async () => {
		mocks.resolveAuthSession.mockResolvedValue(null);

		await setUiLanguageFn({ data: { uiLanguage: "zh-CN" } });

		expect(mocks.update).not.toHaveBeenCalled();
		expect(mocks.setCookie).toHaveBeenCalledWith(
			"yonaris_ui_language",
			"zh-CN",
			expect.objectContaining({ path: "/", sameSite: "lax" }),
		);
	});

	it("persists the cookie when authenticated session lookup is unavailable", async () => {
		mocks.resolveAuthSession.mockRejectedValue(new Error("session storage unavailable"));

		await expect(setUiLanguageFn({ data: { uiLanguage: "zh-CN" } })).resolves.toBe("zh-CN");

		expect(mocks.update).not.toHaveBeenCalled();
		expect(mocks.setCookie).toHaveBeenCalledWith("yonaris_ui_language", "zh-CN", {
			path: "/",
			sameSite: "lax",
			maxAge: 31_536_000,
			secure: false,
		});
	});
});
