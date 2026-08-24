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

const agentMarkdownTargets = new Map<string, string>([
	["/agent", "/llms.mdx/agent/index"],
	["/agent/", "/llms.mdx/agent/index"],
	["/agent/product", "/llms.mdx/agent/product"],
	["/agent/approach", "/llms.mdx/agent/approach"],
	["/agent/research", "/llms.mdx/agent/research"],
	["/agent/geo", "/llms.mdx/agent/geo"],
	["/agent/company", "/llms.mdx/agent/company"],
	["/agent/diagnostic", "/llms.mdx/agent/diagnostic"],
	["/zh/agent", "/llms.mdx/zh-agent/index"],
	["/zh/agent/", "/llms.mdx/zh-agent/index"],
	["/zh/agent/product", "/llms.mdx/zh-agent/product"],
	["/zh/agent/approach", "/llms.mdx/zh-agent/approach"],
	["/zh/agent/research", "/llms.mdx/zh-agent/research"],
	["/zh/agent/geo", "/llms.mdx/zh-agent/geo"],
	["/zh/agent/company", "/llms.mdx/zh-agent/company"],
	["/zh/agent/diagnostic", "/llms.mdx/zh-agent/diagnostic"],
	["/zh/agent/privacy", "/llms.mdx/zh-agent/privacy"],
]);

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

	const pathname = new URL(request.url).pathname;
	const canonical = coreCanonicalTargets.get(pathname);
	const agentTarget = agentMarkdownTargets.get(pathname);
	if (!canonical && !agentTarget) return { variesOnAccept: false };
	if (!isCoreMarkdownPreferred(request)) return { variesOnAccept: true };
	if (agentTarget) return { targetPath: agentTarget, variesOnAccept: true };

	return {
		targetPath: `/llms.mdx/site/${canonical?.locale}/${canonical?.key}`,
		variesOnAccept: true,
	};
}

export function rewriteMarkdownRequest(request: Request, targetPath: string): Request {
	const url = new URL(request.url);
	url.pathname = targetPath;
	return new Request(url, request);
}
