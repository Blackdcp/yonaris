import fs from "node:fs";
import path from "node:path";
import {
	type LiteralCategory,
	type LiteralClassification,
	PORTAL_LITERAL_CLASSIFICATIONS,
} from "./portal-language-audit-manifest";

export type CandidateKind =
	| "localized-key"
	| "jsx-text"
	| "text-prop"
	| "metadata-copy"
	| "toast-dialog-copy"
	| "template-prose"
	| "concatenated-prose"
	| "display-locale"
	| "status-capitalization"
	| "backward-compatible-default"
	| "raw-error-interpolation"
	| "raw-evidence-interpolation";

export type PortalLanguageCandidate = {
	file: string;
	kind: CandidateKind;
	value: string;
	occurrence: number;
	line: number;
};

type UnnumberedCandidate = Omit<PortalLanguageCandidate, "occurrence">;

const RAW_EVIDENCE_NAMES =
	/^(answerText|brandName|competitorName|domain|email|hash|id|locale|market|model|name|prompt|promptValue|provider|query|scopeId|timezone|url|value|version)$/;
const SHARED_COMPATIBILITY_FILES = new Set([
	"packages/ui/src/components/sidebar.tsx",
	"packages/ui/src/components/breadcrumb.tsx",
	"packages/ui/src/components/tags-input.tsx",
]);
const SHARED_DEFAULT_VALUES = new Set([
	"Add",
	"Displays the mobile sidebar.",
	"Maximum reached",
	"More",
	"No results.",
	"Search...",
	"Select...",
	"Sidebar",
	"Toggle Sidebar",
	"Type or paste to add a value",
	"breadcrumb",
]);
export type CrossPlanOwnership = {
	file: string;
	owner: "portal-output-languages";
	task: "Task 3" | "Task 4";
	reason: string;
};

/**
 * Exact production hand-off surfaces. The output-language plan owns replacing
 * every ambient UI-language dependency in these render/export paths with an
 * explicit outputLanguage. They remain known defects until that plan lands.
 */
export const CROSS_PLAN_OWNERSHIP: CrossPlanOwnership[] = [
	{
		file: "apps/web/src/routes/_authed/reports/index.tsx",
		owner: "portal-output-languages",
		task: "Task 3",
		reason: "Report operations and their output-language controls are owned by the output-language plan.",
	},
	{
		file: "apps/web/src/routes/_authed/reports/render/$reportId.tsx",
		owner: "portal-output-languages",
		task: "Task 4",
		reason: "Printable report content still consumes ambient UI language pending an explicit outputLanguage.",
	},
	...[
		"apps/web/src/components/prompt-chart-print.tsx",
		"apps/web/src/components/base-chart-print.tsx",
		"apps/web/src/components/chart-download-footer.tsx",
		"apps/web/src/components/chart-export-preview.tsx",
	].map(
		(file): CrossPlanOwnership => ({
			file,
			owner: "portal-output-languages",
			task: "Task 4",
			reason: "Printable/exported chart copy still consumes ambient UI language pending an explicit outputLanguage.",
		}),
	),
	...[
		"apps/web/src/components/base-chart.tsx",
		"apps/web/src/components/cached-prompt-chart.tsx",
		"apps/web/src/components/virtualized-prompt-list.tsx",
		"apps/web/src/components/prompts-display.tsx",
		"apps/web/src/routes/_authed/app/$brand/visibility.tsx",
		"apps/web/src/hooks/use-chart-export.tsx",
	].map(
		(file): CrossPlanOwnership => ({
			file,
			owner: "portal-output-languages",
			task: "Task 4",
			reason:
				"Connected chart-export propagation surface still derives output from ambient UI language pending explicit outputLanguage plumbing.",
		}),
	),
];

const REQUIRED_CROSS_PLAN_FILES = [
	"apps/web/src/routes/_authed/reports/index.tsx",
	"apps/web/src/routes/_authed/reports/render/$reportId.tsx",
	"apps/web/src/components/prompt-chart-print.tsx",
	"apps/web/src/components/base-chart-print.tsx",
	"apps/web/src/components/chart-download-footer.tsx",
	"apps/web/src/components/chart-export-preview.tsx",
	"apps/web/src/components/base-chart.tsx",
	"apps/web/src/components/cached-prompt-chart.tsx",
	"apps/web/src/components/virtualized-prompt-list.tsx",
	"apps/web/src/components/prompts-display.tsx",
	"apps/web/src/routes/_authed/app/$brand/visibility.tsx",
	"apps/web/src/hooks/use-chart-export.tsx",
] as const;

const CROSS_PLAN_FILES = new Map(
	CROSS_PLAN_OWNERSHIP.map((entry) => [entry.file, `${entry.owner} ${entry.task}: ${entry.reason}`] as const),
);

function normalizedValue(value: string) {
	return value.replace(/\s+/g, " ").trim();
}

export function collectPortalLanguageCandidatesFromSource(file: string, source: string): PortalLanguageCandidate[] {
	const collected: UnnumberedCandidate[] = [];
	const normalizedFile = file.replaceAll("\\", "/");
	const add = (index: number, kind: CandidateKind, value: string) => {
		const normalized = normalizedValue(value);
		if (!normalized) return;
		collected.push({
			file: normalizedFile,
			kind,
			value: normalized,
			line: source.slice(0, index).split("\n").length,
		});
	};

	const scan = (pattern: RegExp, kind: CandidateKind, group = 1) => {
		for (const match of source.matchAll(pattern)) add(match.index, kind, match[group] ?? match[0]);
	};
	scan(/\b(?:t|translate)\(\s*["']([^"']+)["']/g, "localized-key");
	for (const match of source.matchAll(/>([^<>\n]*\S[^<>\n]*)</g)) {
		if (
			!/[{};]/.test(match[1]) &&
			!/\b(?:return|const|let|function|Promise)\b/.test(match[1]) &&
			!/(?:=|0)\s*\d*\s*&&|\bstring\)\s*:\s*Record/.test(match[1])
		) {
			add(match.index, "jsx-text", match[1]);
		}
	}
	scan(
		/\b(?:alt|aria-label|description|emptyText|label|placeholder|subtitle|title|tooltip)\s*=\s*["']([^"']+)["']/g,
		"text-prop",
	);
	scan(
		/\b(?:alt|aria-label|description|emptyText|label|placeholder|subtitle|title|tooltip)\s*=\s*\{\s*(`[^`]*`)\s*\}/g,
		"text-prop",
	);
	scan(/\b(?:title|description|content|emptyText|message)\s*:\s*["']([^"']+)["']/g, "metadata-copy");
	scan(
		/\b(?:toast\.(?:error|success|warning)|alert|confirm|prompt)\(\s*(["'][^"']+["']|`[^`]+`)/g,
		"toast-dialog-copy",
	);
	for (const match of source.matchAll(/\{\s*(`[^`]*\$\{[^`]+`)[\s,)]*\}/g)) {
		const staticText = match[1]
			.replace(/\$\{[^}]+\}/g, "")
			.replaceAll("`", "")
			.trim();
		const looksLikeCss =
			/(?:^|\s)(?:bg|border|cursor|flex|font|gap|grid|h|hover|inline|items|justify|m|p|rounded|shadow|sm|text|transition|w)-/.test(
				staticText,
			);
		if (
			!looksLikeCss &&
			(/^[A-Z][A-Za-z]+/.test(staticText) || /[A-Za-z\u3400-\u9fff]+\s+[A-Za-z\u3400-\u9fff]+/.test(staticText))
		) {
			add(match.index, "template-prose", match[1]);
		}
	}
	for (const match of source.matchAll(/\{\s*([^{}\n;]*["'][^{}\n;]*\+[^{}\n;]*)\s*\}/g)) {
		if (
			!/\b(?:href|rel|type)\s*:/.test(match[1]) &&
			/['"][^'"]*[A-Za-z\u3400-\u9fff][^'"]*\s+[^'"]*['"]/.test(match[1])
		) {
			add(match.index, "concatenated-prose", match[1]);
		}
	}
	scan(/[\w.()]+\.toLocale(?:DateString|String|TimeString)\([^)]*\)/g, "display-locale", 0);
	scan(/(?:["'][^"']+["']|[\w.]+)\.charAt\(0\)\.toUpperCase\(\)/g, "status-capitalization", 0);
	scan(/\{\s*([\w.]+\.message)\s*\}/g, "raw-error-interpolation");
	for (const match of source.matchAll(/\{\s*([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)?)\s*\}/g)) {
		const expression = match[1];
		const name = expression.split(".").at(-1) ?? "";
		if (RAW_EVIDENCE_NAMES.test(name)) add(match.index, "raw-evidence-interpolation", expression);
	}
	if (SHARED_COMPATIBILITY_FILES.has(normalizedFile)) {
		scan(
			/\b(?:addValueText|emptyText|entryHintText|label|maximumReachedText|mobileDescription|mobileTitle|moreLabel|placeholder|searchPlaceholder)\s*=\s*["']([^"']+)["']/g,
			"backward-compatible-default",
		);
		scan(/\bremoveTagLabel\s*=\s*\([^)]*\)\s*=>\s*(`[^`]+`)/g, "backward-compatible-default");
	}

	const occurrences = new Map<string, number>();
	return collected.map((candidate) => {
		const key = `${candidate.file}\0${candidate.kind}\0${candidate.value}`;
		const occurrence = (occurrences.get(key) ?? 0) + 1;
		occurrences.set(key, occurrence);
		return { ...candidate, occurrence };
	});
}

function exactKey(value: { file: string; kind: string; value: string; occurrence: number }) {
	return `${value.file}\0${value.kind}\0${value.value}\0${value.occurrence}`;
}

function automaticClassification(candidate: PortalLanguageCandidate): LiteralClassification | undefined {
	let category: LiteralCategory | undefined;
	let reason: string | undefined;
	if (candidate.kind === "localized-key") {
		category = "localized-key";
		reason = "Catalog message ID resolved through the active UI-language provider.";
	} else if (candidate.kind === "raw-evidence-interpolation") {
		category = "raw-evidence";
		reason = "Syntax-bound domain/evidence value must remain byte-identical across UI languages.";
	} else if (candidate.kind === "backward-compatible-default") {
		category = "shared-backward-compatible-default";
		reason = "Shared package default retained for external callers; portal call sites supply localized labels.";
	} else if (CROSS_PLAN_FILES.has(candidate.file)) {
		category = "cross-plan-owner";
		reason = CROSS_PLAN_FILES.get(candidate.file);
	} else if (candidate.kind === "metadata-copy" && /^[a-z][\w-]*(?:\.[\w-]+)+$/.test(candidate.value)) {
		category = "localized-key";
		reason = "Exact catalog message ID retained in a typed UI-copy mapping.";
	} else if (
		SHARED_COMPATIBILITY_FILES.has(candidate.file) &&
		candidate.kind === "text-prop" &&
		SHARED_DEFAULT_VALUES.has(candidate.value)
	) {
		category = "shared-backward-compatible-default";
		reason = "Shared package default retained for external callers; portal call sites supply localized labels.";
	} else if (
		/^(?:\d+|[#%:|—–-]|&mdash;|[A-Z]{2}|[a-z]{2}-[A-Za-z]{2}|SHA-\d+)$/.test(candidate.value) ||
		/^(?:https?:\/\/|chrome:\/\/)/.test(candidate.value) ||
		/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(candidate.value) ||
		/^[A-Za-z_]+\/[A-Za-z_./-]+$/.test(candidate.value) ||
		/^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/.test(candidate.value) ||
		/^[a-z]+_[a-z_]+$/.test(candidate.value) ||
		/^[A-Za-z][\w.-]*=[^\s=]+$/.test(candidate.value) ||
		!/\p{L}|\p{N}/u.test(candidate.value) ||
		(candidate.kind === "metadata-copy" && candidate.value === "website")
	) {
		category = "machine-token";
		reason = "Machine-readable token, code, route, locale, or neutral symbol is intentionally invariant.";
	}
	return category && reason ? { ...candidate, category, reason } : undefined;
}

export function validateExactClassifications(
	candidates: PortalLanguageCandidate[],
	manifest: LiteralClassification[],
): string[] {
	const errors: string[] = [];
	const manifestByKey = new Map<string, LiteralClassification>();
	for (const entry of manifest) {
		if (/[*?{}[\]]/.test(entry.file) || entry.file.endsWith("/")) {
			errors.push(`broad matcher is forbidden: ${entry.file}`);
			continue;
		}
		if (!entry.reason.trim()) errors.push(`classification reason is empty: ${entry.file}`);
		const key = exactKey(entry);
		if (manifestByKey.has(key)) errors.push(`duplicate classification: ${entry.file} ${entry.value}`);
		manifestByKey.set(key, entry);
	}

	const candidateKeys = new Set(candidates.map(exactKey));
	for (const candidate of candidates) {
		if (!automaticClassification(candidate) && !manifestByKey.has(exactKey(candidate))) {
			errors.push(
				`unclassified ${candidate.kind}: ${candidate.file}:${candidate.line} occurrence ${candidate.occurrence} ${JSON.stringify(candidate.value)}`,
			);
		}
	}
	for (const entry of manifest) {
		if (!candidateKeys.has(exactKey(entry))) {
			errors.push(`stale classification: ${entry.file} occurrence ${entry.occurrence} ${JSON.stringify(entry.value)}`);
		}
	}
	return errors;
}

function walkTsx(directory: string): string[] {
	return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		const absolute = path.join(directory, entry.name);
		if (entry.isDirectory()) return walkTsx(absolute);
		if (!entry.name.endsWith(".tsx") || /\.(test|stories)\.tsx$/.test(entry.name)) return [];
		return [absolute];
	});
}

function routeHeaderErrors(repositoryRoot: string) {
	const errors: string[] = [];
	const siteHeader = fs.readFileSync(path.join(repositoryRoot, "apps/web/src/components/site-header.tsx"), "utf8");
	const mappingBlock = siteHeader.match(/const PAGE_NAME_IDS[^=]*=\s*{([\s\S]*?)};/)?.[1] ?? "";
	const mapped = new Set(
		[...mappingBlock.matchAll(/(?:["']([^"']+)["']|([A-Za-z][\w-]*))\s*:/g)].map((match) => match[1] ?? match[2]),
	);
	mapped.add("reports");

	for (const file of walkTsx(path.join(repositoryRoot, "apps/web/src/routes"))) {
		const source = fs.readFileSync(file, "utf8");
		for (const match of source.matchAll(/createFileRoute\(["']([^"']+)["']\)/g)) {
			const route = match[1];
			if (!route.startsWith("/_authed/")) continue;
			const parts = route.split("/").filter(Boolean);
			const adminIndex = parts.indexOf("admin");
			const appIndex = parts.indexOf("app");
			const segment =
				adminIndex >= 0
					? parts[adminIndex + 1]
					: appIndex >= 0 && parts[appIndex + 1] !== "new"
						? parts[appIndex + 2]
						: "";
			if (!segment || segment.startsWith("$")) continue;
			if (!mapped.has(segment)) errors.push(`route relies on unknown header fallback: ${route} (${segment})`);
		}
	}
	return errors;
}

function sharedCallsiteErrors(repositoryRoot: string) {
	const errors: string[] = [];
	const appSidebar = fs.readFileSync(path.join(repositoryRoot, "apps/web/src/components/app-sidebar.tsx"), "utf8");
	if (
		!/<Sidebar[\s\S]*?mobileTitle=\{t\(["']accessibility\.sidebarTitle["']\)\}[\s\S]*?mobileDescription=\{t\(["']accessibility\.sidebarDescription["']\)\}/.test(
			appSidebar,
		)
	) {
		errors.push("untranslated shared callsite: AppSidebar mobile title/description");
	}
	const siteHeader = fs.readFileSync(path.join(repositoryRoot, "apps/web/src/components/site-header.tsx"), "utf8");
	if (!/<SidebarTrigger[^>]*label=\{t\(["']accessibility\.toggleSidebar["']\)\}/.test(siteHeader)) {
		errors.push("untranslated shared callsite: SidebarTrigger label");
	}
	if (
		!/<Breadcrumb[^>]*label=\{t\(["']accessibility\.breadcrumb["']\)\}[^>]*moreLabel=\{t\(["']accessibility\.more["']\)\}/.test(
			siteHeader,
		)
	) {
		errors.push("untranslated shared callsite: Breadcrumb labels");
	}
	const localizedTags = fs.readFileSync(
		path.join(repositoryRoot, "apps/web/src/components/localized-tags-input.tsx"),
		"utf8",
	);
	for (const required of ["emptyText", "removeTagLabel", "maximumReachedText", "entryHintText", "addValueText"]) {
		if (!localizedTags.includes(`${required}={`)) errors.push(`untranslated shared callsite: TagsInput ${required}`);
	}
	return errors;
}

function chromeExtensionResidueErrors(repositoryRoot: string) {
	const manifestPath = path.join(repositoryRoot, "apps/browser-extension/manifest.json");
	const manifestSource = fs.readFileSync(manifestPath, "utf8");
	const manifest = JSON.parse(manifestSource) as Record<string, unknown>;
	const errors: string[] = [];
	if (Object.hasOwn(manifest, "commands")) {
		errors.push("Chrome extension command residue: manifest.json still registers commands");
	}
	for (const obsoleteCopy of ["Open Yonaris sidebar", "Toggle Yonaris sidebar"]) {
		if (manifestSource.includes(obsoleteCopy)) {
			errors.push(`Chrome extension command residue: ${JSON.stringify(obsoleteCopy)}`);
		}
	}
	return errors;
}

export function validateCrossPlanOwnership(
	repositoryRoot: string,
	entries: CrossPlanOwnership[] = CROSS_PLAN_OWNERSHIP,
) {
	const errors: string[] = [];
	const entriesByFile = new Map<string, CrossPlanOwnership>();
	for (const entry of entries) {
		if (/[*?{}[\]]/.test(entry.file) || entry.file.endsWith("/")) {
			errors.push(`broad cross-plan matcher is forbidden: ${entry.file}`);
			continue;
		}
		if (!entry.owner.trim()) errors.push(`cross-plan owner is empty: ${entry.file}`);
		if (!entry.task.trim()) errors.push(`cross-plan task is empty: ${entry.file}`);
		if (!entry.reason.trim()) errors.push(`cross-plan reason is empty: ${entry.file}`);
		if (entriesByFile.has(entry.file)) errors.push(`duplicate cross-plan ownership: ${entry.file}`);
		entriesByFile.set(entry.file, entry);
		if (!fs.existsSync(path.join(repositoryRoot, entry.file))) {
			errors.push(`stale cross-plan ownership: ${entry.file}`);
		}
	}
	for (const requiredFile of REQUIRED_CROSS_PLAN_FILES) {
		if (!entriesByFile.has(requiredFile)) errors.push(`missing cross-plan ownership: ${requiredFile}`);
	}
	return errors;
}

export function runPortalLanguageAudit() {
	const repositoryRoot = path.resolve(import.meta.dirname, "../../..");
	const roots = [
		path.join(repositoryRoot, "apps/web/src/routes"),
		path.join(repositoryRoot, "apps/web/src/components"),
	];
	const files = roots.flatMap(walkTsx);
	files.push(
		path.join(repositoryRoot, "packages/ui/src/components/sidebar.tsx"),
		path.join(repositoryRoot, "packages/ui/src/components/breadcrumb.tsx"),
		path.join(repositoryRoot, "packages/ui/src/components/tags-input.tsx"),
	);
	const candidates = files.flatMap((absolute) => {
		const file = path.relative(repositoryRoot, absolute).replaceAll("\\", "/");
		return collectPortalLanguageCandidatesFromSource(file, fs.readFileSync(absolute, "utf8"));
	});
	const auto = candidates
		.map(automaticClassification)
		.filter((entry): entry is LiteralClassification => Boolean(entry));
	const errors = [
		...validateExactClassifications(candidates, PORTAL_LITERAL_CLASSIFICATIONS),
		...routeHeaderErrors(repositoryRoot),
		...sharedCallsiteErrors(repositoryRoot),
		...chromeExtensionResidueErrors(repositoryRoot),
		...validateCrossPlanOwnership(repositoryRoot),
	];
	return {
		filesAudited: files.length,
		candidates,
		classifications: [...auto, ...PORTAL_LITERAL_CLASSIFICATIONS],
		crossPlanOwnership: CROSS_PLAN_OWNERSHIP,
		errors,
	};
}
