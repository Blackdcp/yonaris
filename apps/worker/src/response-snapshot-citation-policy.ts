import type { ResponseSnapshotDraft } from "@workspace/lib/response-snapshots/contract";

// Keep provider data within the immutable snapshot contract without weakening
// that contract. JavaScript string length is measured in UTF-16 code units.
const MAX_SNAPSHOT_CITATION_TITLE_LENGTH = 1_000;

export function normalizeResponseSnapshotCitationTitle(title: string | null | undefined): string | null {
	const normalized = title?.trim();
	if (!normalized) return null;
	if (normalized.length <= MAX_SNAPSHOT_CITATION_TITLE_LENGTH) return normalized;

	let bounded = normalized.slice(0, MAX_SNAPSHOT_CITATION_TITLE_LENGTH);
	const lastCodeUnit = bounded.charCodeAt(bounded.length - 1);
	if (lastCodeUnit >= 0xd800 && lastCodeUnit <= 0xdbff) {
		bounded = bounded.slice(0, -1);
	}
	return bounded;
}

export function normalizeResponseSnapshotCitations(
	citations: Array<{
		url: string;
		title?: string | null;
		domain: string;
		citationIndex: number;
	}>,
): ResponseSnapshotDraft["citations"] {
	return citations.map((citation) => ({
		url: citation.url,
		title: normalizeResponseSnapshotCitationTitle(citation.title),
		domain: citation.domain,
		citationIndex: citation.citationIndex,
	}));
}
