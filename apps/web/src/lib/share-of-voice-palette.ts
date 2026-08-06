/**
 * Shared Share-of-Voice palette so the donut and the leaderboard colour each
 * brand identically — the brand in its blue, competitors from a fixed palette in
 * rank order, and the long tail in a neutral "others" grey.
 */
import { YONARIS_CHART_CATEGORICAL, YONARIS_CHART_FOCUS, YONARIS_CHART_NEUTRAL } from "@/brand/chart-theme";

export const BRAND_COLOR = YONARIS_CHART_FOCUS;
export const OTHERS_COLOR = YONARIS_CHART_NEUTRAL;
export const COMPETITOR_PALETTE = YONARIS_CHART_CATEGORICAL;

interface BrandLike {
	name: string;
	isBrand: boolean;
	mentions: number;
}

/**
 * Map each entry name to its colour, mirroring the donut's assignment order
 * (brand → BRAND_COLOR; the first `topN` competitors → palette; the rest →
 * OTHERS_COLOR). Entries with no mentions are skipped, matching the donut.
 */
export function shareOfVoiceColorMap(entries: BrandLike[], topN = 6): Map<string, string> {
	const map = new Map<string, string>();
	let competitorIdx = 0;
	for (const e of entries) {
		if (e.mentions <= 0) continue;
		if (e.isBrand) {
			map.set(e.name, BRAND_COLOR);
		} else if (competitorIdx < topN) {
			map.set(e.name, COMPETITOR_PALETTE[competitorIdx++ % COMPETITOR_PALETTE.length]);
		} else {
			map.set(e.name, OTHERS_COLOR);
		}
	}
	return map;
}
