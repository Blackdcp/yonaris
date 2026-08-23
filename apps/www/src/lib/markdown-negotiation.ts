import { CORE_PAGE_KEYS } from "@/content/site";
import type { CorePageKey, Locale } from "@/content/site/types";
import { getCorePath } from "./site-manifest";

export interface MarkdownResolution {
	targetPath?: string;
	variesOnAccept: boolean;
}

const coreCanonicalTargets = new Map<string, { key: CorePageKey; locale: Locale }>(
	CORE_PAGE_KEYS.flatMap((key) =>
		(["en", "zh"] as const).map((locale) => [getCorePath(key, locale), { key, locale }] as const),
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

function isCoreMarkdownPreferred(request: Request): boolean {
	const accept = request.headers.get("Accept") ?? "";
	const markdown = mediaPreference(accept, "text/markdown");
	const html = mediaPreference(accept, "text/html");
	if (markdown.quality === 0) return false;
	if (markdown.quality !== html.quality) return markdown.quality > html.quality;
	if (markdown.specificity !== html.specificity) return markdown.specificity > html.specificity;
	return markdown.position < html.position;
}

export function resolveMarkdownRequest(request: Request): MarkdownResolution {
	if (request.method !== "GET" && request.method !== "HEAD") return { variesOnAccept: false };

	const canonical = coreCanonicalTargets.get(new URL(request.url).pathname);
	if (!canonical) return { variesOnAccept: false };
	if (!isCoreMarkdownPreferred(request)) return { variesOnAccept: true };

	return {
		targetPath: `/llms.mdx/site/${canonical.locale}/${canonical.key}`,
		variesOnAccept: true,
	};
}

export function rewriteMarkdownRequest(request: Request, targetPath: string): Request {
	const url = new URL(request.url);
	url.pathname = targetPath;
	return new Request(url, request);
}
