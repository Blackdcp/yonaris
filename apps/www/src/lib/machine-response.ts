import type { Locale } from "@/content/site/types";

interface MachineDocumentResponseOptions {
	language?: Locale | readonly Locale[];
	contentType?: "text/markdown; charset=utf-8" | "text/plain; charset=utf-8";
}

const APPLICATION_VARY_HEADER = "X-Yonaris-Application-Vary";

function contentLanguageHeader(language: MachineDocumentResponseOptions["language"]): string {
	const languages: readonly Locale[] = typeof language === "string" ? [language] : (language ?? ["en"]);
	return languages.map((locale) => (locale === "zh" ? "zh-CN" : "en")).join(", ");
}

export function machineDocumentResponse(body: BodyInit | null, options: MachineDocumentResponseOptions = {}): Response {
	return new Response(body, {
		headers: {
			"Cache-Control": "public, max-age=300",
			"Content-Language": contentLanguageHeader(options.language),
			"Content-Type": options.contentType ?? "text/markdown; charset=utf-8",
			"X-Robots-Tag": "noindex, follow",
		},
	});
}

export function appendVary(headers: Headers, dimension: string): void {
	const existing = (headers.get("Vary") ?? "")
		.split(",")
		.map((value) => value.trim())
		.filter(Boolean);
	if (!existing.some((value) => value.toLowerCase() === dimension.toLowerCase())) existing.push(dimension);
	headers.set("Vary", existing.join(", "));
}

/**
 * H3 gives headers prepared by Nitro's public-asset middleware precedence over
 * headers returned by the application. Carry the application's complete Vary
 * value through that merge so the final Nitro response can restore it.
 */
export function preserveApplicationVary(response: Response): void {
	const vary = response.headers.get("Vary");
	if (vary) response.headers.set(APPLICATION_VARY_HEADER, vary);
}

export function restoreApplicationVary(response: Response): void {
	const applicationVary = response.headers.get(APPLICATION_VARY_HEADER);
	response.headers.delete(APPLICATION_VARY_HEADER);
	if (!applicationVary) return;

	for (const dimension of applicationVary
		.split(",")
		.map((value) => value.trim())
		.filter(Boolean)) {
		appendVary(response.headers, dimension);
	}
}
