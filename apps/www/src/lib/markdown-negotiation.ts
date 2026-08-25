import { HUMAN_PAGE_KEYS, type HumanPageKey } from "@/content/experience/types";
import type { Locale } from "@/content/site/types";

export type RepresentationResolution =
	| { kind: "html"; variesOnAccept: true }
	| { kind: "markdown"; targetPath: string; variesOnAccept: true }
	| { kind: "redirect"; location: string; variesOnAccept: true }
	| { kind: "not-acceptable"; variesOnAccept: true }
	| { kind: "pass"; variesOnAccept: false };

function humanPath(key: HumanPageKey, locale: Locale): string {
	if (locale === "en") return key === "home" ? "/" : `/${key}`;
	return key === "home" ? "/zh" : `/zh/${key}`;
}

function agentPath(key: HumanPageKey, locale: Locale): string {
	if (locale === "en") return key === "home" ? "/agent" : `/agent/${key}`;
	return key === "home" ? "/zh/agent" : `/zh/agent/${key}`;
}

const representationTargets = new Map<string, string>(
	HUMAN_PAGE_KEYS.flatMap((key) =>
		(["en", "zh"] as const).flatMap((locale) => [
			[humanPath(key, locale), `/llms.mdx/site/${locale}/${key}`] as const,
			[
				agentPath(key, locale),
				`/llms.mdx/${locale === "en" ? "agent" : "zh-agent"}/${key === "home" ? "index" : key}`,
			] as const,
		]),
	),
);

interface MediaPreference {
	quality: number;
	position: number;
	specificity: number;
}

function mediaPreference(accept: string, target: string): MediaPreference {
	const [targetType] = target.split("/");
	let best: MediaPreference = { quality: 0, position: Number.POSITIVE_INFINITY, specificity: -1 };

	for (const [position, range] of accept.split(",").entries()) {
		const [rawMediaType, ...parameters] = range.trim().toLowerCase().split(";");
		const qualityParameter = parameters.find((parameter) => parameter.trim().startsWith("q="));
		const parsedQuality = qualityParameter ? Number(qualityParameter.trim().slice(2)) : 1;
		const quality = Number.isFinite(parsedQuality) && parsedQuality >= 0 && parsedQuality <= 1 ? parsedQuality : 0;
		const specificity =
			rawMediaType === target ? 2 : rawMediaType === `${targetType}/*` ? 1 : rawMediaType === "*/*" ? 0 : -1;
		if (specificity < 0) continue;
		if (
			specificity > best.specificity ||
			(specificity === best.specificity && quality > best.quality) ||
			(specificity === best.specificity && quality === best.quality && position < best.position)
		) {
			best = { quality, position, specificity };
		}
	}

	return best;
}

function preferredRepresentation(accept: string | null): "html" | "markdown" | "not-acceptable" {
	if (!accept?.trim()) return "html";

	const markdown = mediaPreference(accept, "text/markdown");
	const html = mediaPreference(accept, "text/html");
	if (markdown.quality === 0 && html.quality === 0) return "not-acceptable";
	if (markdown.quality !== html.quality) return markdown.quality > html.quality ? "markdown" : "html";
	if (markdown.specificity !== html.specificity) return markdown.specificity > html.specificity ? "markdown" : "html";
	if (html.specificity === 1) return "markdown";
	return "html";
}

export function resolveRepresentation(request: Request): RepresentationResolution {
	if (request.method !== "GET" && request.method !== "HEAD") return { kind: "pass", variesOnAccept: false };

	const url = new URL(request.url);
	const pathname = url.pathname;
	if (pathname.length > 1 && pathname.endsWith("/")) {
		const canonicalPath = pathname.slice(0, -1);
		if (representationTargets.has(canonicalPath)) {
			return { kind: "redirect", location: `${canonicalPath}${url.search}`, variesOnAccept: true };
		}
	}

	const targetPath = representationTargets.get(pathname);
	if (!targetPath) return { kind: "pass", variesOnAccept: false };

	const kind = preferredRepresentation(request.headers.get("Accept"));
	if (kind === "markdown") return { kind, targetPath, variesOnAccept: true };
	return { kind, variesOnAccept: true };
}

export function rewriteMarkdownRequest(request: Request, targetPath: string): Request {
	const url = new URL(request.url);
	url.pathname = targetPath;
	return new Request(url, request);
}
