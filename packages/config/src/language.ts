export const CONTENT_LANGUAGES = ["en", "zh-CN"] as const;
export const UI_LANGUAGE_COOKIE_NAME = "yonaris_ui_language";
export type ContentLanguage = (typeof CONTENT_LANGUAGES)[number];
export type UiLanguage = ContentLanguage;
export type OutputLanguage = ContentLanguage;

export function isContentLanguage(value: unknown): value is ContentLanguage {
	return value === "en" || value === "zh-CN";
}

export function parseContentLanguage(value: unknown, fallback?: ContentLanguage): ContentLanguage {
	if (isContentLanguage(value)) return value;
	if (fallback !== undefined && value === undefined) return fallback;
	throw new Error("Unsupported language. Expected en or zh-CN.");
}
