import { createHash } from "node:crypto";
import type { DeepSeekCapturedObservation } from "./deepseek-capture-contract.js";

const POSITIVE_SEARCH_MARKER = /已阅读\s+\d+\s*个网页/u;
const MARKER_TITLE = /^-\d+$/;

export function reviewDeepSeekObservationEvidence(
	observation: DeepSeekCapturedObservation,
	screenshot: Buffer,
	pageSnapshot: Buffer,
): DeepSeekCapturedObservation {
	if (
		sha256(screenshot) !== observation.evidence.screenshotSha256 ||
		sha256(pageSnapshot) !== observation.evidence.pageSnapshotSha256
	) {
		throw new Error("DeepSeek evidence digest mismatch");
	}
	const html = pageSnapshot.toString("utf8");
	if (!POSITIVE_SEARCH_MARKER.test(html)) {
		throw new Error("DeepSeek positive search evidence is missing");
	}
	const capturedUrls = new Set<string>();
	for (const match of html.matchAll(/\bhref=(["'])(.*?)\1/giu)) {
		try {
			capturedUrls.add(new URL(decodeHtmlAttribute(match[2] ?? "")).href);
		} catch {
			// Non-HTTP and relative links are not reviewed citations.
		}
	}
	const citations = observation.citations.map((citation) => {
		if (!capturedUrls.has(new URL(citation.url).href)) {
			throw new Error("DeepSeek citation is absent from captured HTML");
		}
		return {
			...citation,
			title: MARKER_TITLE.test(citation.title.trim())
				? new URL(citation.url).hostname.replace(/^www\./, "").toLowerCase()
				: citation.title,
		};
	});
	return {
		...observation,
		webSearchObserved: true,
		webQueries: [...observation.webQueries],
		citations,
	};
}

function sha256(value: Buffer): string {
	return createHash("sha256").update(value).digest("hex");
}

function decodeHtmlAttribute(value: string): string {
	return value
		.replaceAll("&amp;", "&")
		.replaceAll("&quot;", '"')
		.replaceAll("&#39;", "'")
		.replaceAll("&lt;", "<")
		.replaceAll("&gt;", ">");
}
