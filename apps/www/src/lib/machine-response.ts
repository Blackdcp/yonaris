import type { Locale } from "@/content/site/types";
import { resolveRepresentation, rewriteMarkdownRequest } from "./markdown-negotiation";
import { siteHref } from "./site-origin";

export interface MachineLink {
	href: string;
	rel: string;
	type?: string;
	hrefLang?: string;
}

export type MachineLinkSet = readonly MachineLink[];

export interface MachineDocumentResponseOptions {
	language?: Locale | readonly Locale[];
	contentType?: "text/markdown; charset=utf-8" | "text/plain; charset=utf-8" | "application/ld+json; charset=utf-8";
	contentLocation?: string;
	links?: MachineLinkSet;
	status?: number;
}

const APPLICATION_VARY_HEADER = "X-Yonaris-Application-Vary";

function contentLanguageHeader(language: MachineDocumentResponseOptions["language"]): string {
	const languages: readonly Locale[] = typeof language === "string" ? [language] : (language ?? ["en"]);
	return languages.map((locale) => (locale === "zh" ? "zh-CN" : "en")).join(", ");
}

export function machineDocumentResponse(body: BodyInit | null, options: MachineDocumentResponseOptions = {}): Response {
	const headers = new Headers({
		"Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
		"Content-Language": contentLanguageHeader(options.language),
		"Content-Type": options.contentType ?? "text/markdown; charset=utf-8",
		"X-Robots-Tag": "noindex, follow",
	});
	appendVary(headers, "Accept");
	if (options.contentLocation) headers.set("Content-Location", options.contentLocation);
	if (options.links?.length) headers.set("Link", options.links.map(serializeLink).join(", "));

	return new Response(body, { status: options.status, headers });
}

export function notAcceptableResponse(): Response {
	const headers = new Headers();
	appendVary(headers, "Accept");
	return new Response(null, { status: 406, headers });
}

export async function negotiatedResponse(
	request: Request,
	fetchHandler: (request: Request) => Response | Promise<Response>,
): Promise<Response> {
	const representation = resolveRepresentation(request);
	let response: Response;
	if (representation.kind === "redirect") {
		response = new Response(null, { status: 307, headers: { Location: representation.location } });
	} else if (representation.kind === "not-acceptable") {
		response = notAcceptableResponse();
	} else {
		const routedRequest =
			representation.kind === "markdown" ? rewriteMarkdownRequest(request, representation.targetPath) : request;
		response = await fetchHandler(routedRequest);
	}

	if (representation.variesOnAccept) {
		appendVary(response.headers, "Accept");
	}
	preserveApplicationVary(response);
	return response;
}

function serializeLink(link: MachineLink): string {
	const parameters = [`rel="${link.rel}"`];
	if (link.type) parameters.push(`type="${link.type}"`);
	if (link.hrefLang) parameters.push(`hreflang="${link.hrefLang}"`);
	return `<${siteHref(link.href)}>; ${parameters.join("; ")}`;
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
