export const LITERAL_CATEGORIES = [
	"localized-key",
	"raw-evidence",
	"machine-token",
	"proper-noun",
	"developer-only",
	"shared-backward-compatible-default",
	"cross-plan-owner",
] as const;

export type LiteralCategory = (typeof LITERAL_CATEGORIES)[number];

export type LiteralClassification = {
	file: string;
	kind: string;
	value: string;
	occurrence: number;
	category: LiteralCategory;
	reason: string;
};

/**
 * Exact, reviewed residuals only. Localized catalog calls and syntax-bound raw
 * evidence interpolations are classified deterministically by the collector.
 * This list deliberately accepts no globs, directory entries, or regexes.
 */
export const PORTAL_LITERAL_CLASSIFICATIONS: LiteralClassification[] = [
	{
		file: "apps/web/src/routes/__root.tsx",
		kind: "metadata-copy",
		value: "width=device-width, initial-scale=1",
		occurrence: 1,
		category: "machine-token",
		reason: "Exact viewport metadata directive is parsed by the browser and is not display copy.",
	},
	{
		file: "apps/web/src/routes/auth/login.tsx",
		kind: "jsx-text",
		value: "demo",
		occurrence: 1,
		category: "machine-token",
		reason: "Literal demo credential shown only in demo mode and submitted byte-identically.",
	},
	{
		file: "apps/web/src/components/word-cloud.tsx",
		kind: "text-prop",
		value: `\`\${it.term} · \${formatNumber(it.count)}\``,
		occurrence: 1,
		category: "raw-evidence",
		reason: "Tooltip combines the raw query term with a locale-formatted count and a neutral separator.",
	},
	{
		file: "apps/web/src/routes/_authed/admin/tools.tsx",
		kind: "jsx-text",
		value: "POST /api/v1/tools/analyze",
		occurrence: 1,
		category: "developer-only",
		reason: "HTTP method and endpoint are developer-facing API reference evidence.",
	},
	{
		file: "apps/web/src/routes/_authed/app/new.tsx",
		kind: "text-prop",
		value: "Acme",
		occurrence: 1,
		category: "proper-noun",
		reason: "Example company proper noun remains unchanged in both UI languages.",
	},
	{
		file: "apps/web/src/components/site-header.tsx",
		kind: "status-capitalization",
		value: "segment.charAt(0).toUpperCase()",
		occurrence: 1,
		category: "machine-token",
		reason:
			"Defensive unknown-segment fallback; the route registration gate requires every reachable segment to have a localized key.",
	},
];
