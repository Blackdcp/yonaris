import { createServerFn } from "@tanstack/react-start";
import { getCookie, getRequestHeaders, setCookie } from "@tanstack/react-start/server";
import { type UiLanguage, parseContentLanguage, UI_LANGUAGE_COOKIE_NAME } from "@workspace/config/language";
import { db } from "@workspace/lib/db/db";
import { user } from "@workspace/lib/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { resolveAuthSession } from "@/lib/auth/resolve-session";

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

	const candidates = (acceptLanguage ?? "")
		.split(",")
		.map((entry, index) => {
			const parts = entry.trim().split(";");
			if (parts.length > 2) return undefined;
			const range = parts[0]?.trim();
			if (!range || (range !== "*" && !/^[A-Za-z]{1,8}(?:-[A-Za-z0-9]{1,8})*$/.test(range))) {
				return undefined;
			}

			let quality = 1;
			if (parts[1] !== undefined) {
				const match = /^q\s*=\s*(0(?:\.\d{0,3})?|1(?:\.0{0,3})?)$/i.exec(parts[1].trim());
				if (!match) return undefined;
				quality = Number(match[1]);
			}
			if (quality === 0) return undefined;

			return { index, quality, range: range.toLowerCase() };
		})
		.filter((candidate): candidate is NonNullable<typeof candidate> => candidate !== undefined)
		.sort((left, right) => right.quality - left.quality || left.index - right.index);

	for (const candidate of candidates) {
		if (candidate.range === "*") continue;
		const primaryLanguage = candidate.range.split("-")[0];
		if (primaryLanguage === "zh") return "zh-CN";
		if (primaryLanguage === "en") return "en";
	}

	return "en";
}

export function validateUiLanguageUpdate(value: unknown): UiLanguage {
	return parseContentLanguage(value);
}

export const getUiLanguageFn = createServerFn({ method: "GET" }).handler(async (): Promise<UiLanguage> => {
	const headers = getRequestHeaders();
	let saved: UiLanguage | undefined;
	try {
		const session = await resolveAuthSession(headers);
		saved = parseOptionalUiLanguage((session?.user as { uiLanguage?: unknown } | undefined)?.uiLanguage);
	} catch {
		// Recovery pages must still resolve a presentation language when invalid
		// boot configuration makes authentication storage unavailable.
	}

	return resolveUiLanguage({
		saved,
		cookie: getCookie(UI_LANGUAGE_COOKIE_NAME),
		acceptLanguage: headers.get("accept-language"),
	});
});

export const setUiLanguageFn = createServerFn({ method: "POST" })
	.validator(z.object({ uiLanguage: z.string() }))
	.handler(async ({ data }): Promise<UiLanguage> => {
		const uiLanguage = validateUiLanguageUpdate(data.uiLanguage);
		let session: Awaited<ReturnType<typeof resolveAuthSession>> = null;
		try {
			session = await resolveAuthSession(getRequestHeaders());
		} catch {
			// The presentation preference must remain writable on auth recovery
			// pages even when authoritative session storage is unavailable.
		}
		if (session) {
			await db.update(user).set({ uiLanguage }).where(eq(user.id, session.user.id));
		}
		setCookie(UI_LANGUAGE_COOKIE_NAME, uiLanguage, {
			path: "/",
			sameSite: "lax",
			maxAge: ONE_YEAR_SECONDS,
			secure: process.env.NODE_ENV === "production",
		});

		return uiLanguage;
	});
