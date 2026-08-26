import { createServerFn } from "@tanstack/react-start";
import { getCookie, getRequestHeaders, setCookie } from "@tanstack/react-start/server";
import { type UiLanguage, parseContentLanguage } from "@workspace/config/language";
import { db } from "@workspace/lib/db/db";
import { user } from "@workspace/lib/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { resolveAuthSession } from "@/lib/auth/resolve-session";

const UI_LANGUAGE_COOKIE = "yonaris_ui_language";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

type UiLanguageResolutionInput = {
	saved?: UiLanguage;
	cookie?: string;
	acceptLanguage?: string | null;
};

function parseOptionalUiLanguage(value: unknown): UiLanguage | undefined {
	try {
		return parseContentLanguage(value);
	} catch {
		return undefined;
	}
}

export function resolveUiLanguage({ saved, cookie, acceptLanguage }: UiLanguageResolutionInput): UiLanguage {
	if (saved) return saved;

	const cookieLanguage = parseOptionalUiLanguage(cookie);
	if (cookieLanguage) return cookieLanguage;

	if (
		acceptLanguage
			?.toLowerCase()
			.split(",")
			.some((language) => language.trim().startsWith("zh"))
	) {
		return "zh-CN";
	}

	return "en";
}

export function validateUiLanguageUpdate(value: unknown): UiLanguage {
	return parseContentLanguage(value);
}

export const getUiLanguageFn = createServerFn({ method: "GET" }).handler(async (): Promise<UiLanguage> => {
	const headers = getRequestHeaders();
	const session = await resolveAuthSession(headers);
	const saved = parseOptionalUiLanguage((session?.user as { uiLanguage?: unknown } | undefined)?.uiLanguage);

	return resolveUiLanguage({
		saved,
		cookie: getCookie(UI_LANGUAGE_COOKIE),
		acceptLanguage: headers.get("accept-language"),
	});
});

export const setUiLanguageFn = createServerFn({ method: "POST" })
	.validator(z.object({ uiLanguage: z.string() }))
	.handler(async ({ data }): Promise<UiLanguage> => {
		const uiLanguage = validateUiLanguageUpdate(data.uiLanguage);
		const session = await resolveAuthSession(getRequestHeaders());
		if (session) {
			await db.update(user).set({ uiLanguage }).where(eq(user.id, session.user.id));
		}
		setCookie(UI_LANGUAGE_COOKIE, uiLanguage, {
			path: "/",
			sameSite: "lax",
			maxAge: ONE_YEAR_SECONDS,
			secure: process.env.NODE_ENV === "production",
		});

		return uiLanguage;
	});
