import type { UiLanguage } from "@workspace/config/language";
import { authCatalog } from "./catalogs/auth";
import { commonCatalog } from "./catalogs/common";

const englishCatalog = {
	...commonCatalog.english,
	...authCatalog.english,
};

const chineseCatalog = {
	...commonCatalog.chinese,
	...authCatalog.chinese,
};

const catalogs = {
	en: englishCatalog,
	"zh-CN": chineseCatalog,
} as const satisfies Record<UiLanguage, Record<keyof typeof englishCatalog, string>>;

export type MessageId = keyof typeof englishCatalog;
export type MessageValues = Readonly<Record<string, string | number>>;

function interpolate(message: string, values?: MessageValues): string {
	let missingValue = false;
	const interpolated = message.replace(/\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (_placeholder, name: string) => {
		const value = values?.[name];
		if (value !== undefined) return String(value);

		if (process.env.NODE_ENV !== "production") {
			throw new Error(`Missing value for "${name}"`);
		}

		missingValue = true;
		return "";
	});

	return missingValue ? englishCatalog["common.error.unexpected"] : interpolated;
}

export function translate(locale: UiLanguage, id: MessageId, values?: MessageValues): string {
	const message = catalogs[locale][id] ?? catalogs.en[id];
	if (message === undefined) throw new Error(`Missing message for "${id}"`);
	return interpolate(message, values);
}

export function formatDate(locale: UiLanguage, value: Date | number, options?: Intl.DateTimeFormatOptions): string {
	return new Intl.DateTimeFormat(locale, { timeZone: "UTC", ...options }).format(value);
}

export function formatNumber(locale: UiLanguage, value: number, options?: Intl.NumberFormatOptions): string {
	return new Intl.NumberFormat(locale, options).format(value);
}

export function formatList(locale: UiLanguage, values: readonly string[], options?: Intl.ListFormatOptions): string {
	return new Intl.ListFormat(locale, options).format(values);
}
