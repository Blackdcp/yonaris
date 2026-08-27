import fs from "node:fs";
import path from "node:path";
import type {
	CallExpression,
	Expression,
	FunctionLikeDeclaration,
	JsxAttributeName,
	JsxOpeningLikeElement,
	Node,
	PropertyName,
	SourceFile,
} from "typescript/unstable/ast";
import * as tsAst from "typescript/unstable/ast";
import * as tsIs from "typescript/unstable/ast/is";
import { isBindingElement, isIdentifier, isJsxExpression } from "typescript/unstable/ast/is";
import { createVirtualFileSystem } from "typescript/unstable/fs";
import { API } from "typescript/unstable/sync";
import { type LiteralClassification, PORTAL_LITERAL_CLASSIFICATIONS } from "./portal-language-audit-manifest";

const ts = { ...tsAst, ...tsIs };

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
	| "rendered-identifier";

export type CandidateRegion = "raw-detail";

export type PortalLanguageCandidate = {
	file: string;
	kind: CandidateKind;
	value: string;
	occurrence: number;
	line: number;
	region?: CandidateRegion;
	rawDetailLabelled?: boolean;
	catalogResolved?: boolean;
};

type UnnumberedCandidate = Omit<PortalLanguageCandidate, "occurrence">;

const DISPLAY_ATTRIBUTE_NAMES = new Set([
	"alt",
	"aria-label",
	"children",
	"content",
	"description",
	"emptyText",
	"entryHintText",
	"label",
	"maximumReachedText",
	"message",
	"mobileDescription",
	"mobileTitle",
	"moreLabel",
	"placeholder",
	"searchPlaceholder",
	"subtitle",
	"title",
	"tooltip",
]);
const NON_DISPLAY_JSX_ATTRIBUTE_NAMES = new Set([
	"as",
	"asChild",
	"align",
	"autoComplete",
	"barCategoryGap",
	"brandId",
	"chartHeight",
	"chartType",
	"checked",
	"className",
	"cols",
	"color",
	"data",
	"dataKey",
	"defaultChecked",
	"defaultColor",
	"defaultOpen",
	"defaultSource",
	"defaultValue",
	"disabled",
	"domain",
	"download",
	"editLink",
	"executionMode",
	"fill",
	"form",
	"formAction",
	"height",
	"heartbeatError",
	"hidden",
	"href",
	"htmlFor",
	"id",
	"iconClassName",
	"indicator",
	"key",
	"k",
	"legendType",
	"lookback",
	"margin",
	"max",
	"maxLength",
	"messageId",
	"method",
	"min",
	"minLength",
	"minPointSize",
	"multiple",
	"name",
	"nameKey",
	"open",
	"optimizationUrlTemplate",
	"orientation",
	"parentName",
	"params",
	"pattern",
	"percentageMode",
	"readOnly",
	"ref",
	"rel",
	"required",
	"radius",
	"role",
	"rows",
	"search",
	"selected",
	"selectedModel",
	"side",
	"sideOffset",
	"size",
	"scopeId",
	"src",
	"stackId",
	"step",
	"stroke",
	"strokeDasharray",
	"strokeWidth",
	"style",
	"surface",
	"tabIndex",
	"tab",
	"target",
	"textClassName",
	"tickFormatter",
	"to",
	"type",
	"value",
	"variant",
	"vertical",
	"width",
	"wordmarkClassName",
	"evidenceArtifactsError",
]);
const DISPLAY_PROPERTY_NAMES = new Set([
	"content",
	"description",
	"emptyText",
	"label",
	"message",
	"subtitle",
	"title",
]);
const SHARED_COMPATIBILITY_FILES = new Set([
	"packages/ui/src/components/sidebar.tsx",
	"packages/ui/src/components/breadcrumb.tsx",
	"packages/ui/src/components/tags-input.tsx",
]);
const SHARED_DEFAULT_NAMES = new Set([
	"addValueText",
	"emptyText",
	"entryHintText",
	"label",
	"maximumReachedText",
	"mobileDescription",
	"mobileTitle",
	"moreLabel",
	"placeholder",
	"searchPlaceholder",
	"removeTagLabel",
]);
const APPROVED_RAW_DETAIL_MESSAGE_IDS = new Set([
	"admin.raw.errorDetails",
	"admin.raw.executionDetails",
	"sampling.raw.errorDetails",
	"sampling.raw.executionDetails",
]);

type CrossPlanSignatureKind =
	| "ambient-ui-language"
	| "output-component"
	| "output-hook"
	| "output-copy"
	| "output-language-binding";

export type CrossPlanOwnership = {
	file: string;
	kind: CrossPlanSignatureKind;
	value: string;
	occurrence: number;
	owner: "portal-output-languages";
	task: "Task 2" | "Task 3" | "Task 4";
	reason: string;
};

export type CrossPlanResolution = {
	file: string;
	kind: CrossPlanSignatureKind;
	value: string;
	occurrence: number;
	owner: "portal-output-languages";
	task: "Task 2" | "Task 3" | "Task 4";
	resolution: "explicit-output-language";
	evidence: string;
	runtimeTest: string;
};

function taskResolution(
	task: CrossPlanResolution["task"],
	file: string,
	kind: CrossPlanSignatureKind,
	value: string,
	evidence: string,
	runtimeTest: string,
	occurrence = 1,
): CrossPlanResolution {
	return {
		file,
		kind,
		value,
		occurrence,
		owner: "portal-output-languages",
		task,
		resolution: "explicit-output-language",
		evidence,
		runtimeTest,
	};
}

function task4Resolution(
	file: string,
	kind: CrossPlanSignatureKind,
	value: string,
	evidence: string,
	runtimeTest: string,
	occurrence = 1,
): CrossPlanResolution {
	return taskResolution("Task 4", file, kind, value, evidence, runtimeTest, occurrence);
}

function task2Resolution(
	file: string,
	kind: CrossPlanSignatureKind,
	value: string,
	evidence: string,
	runtimeTest: string,
	occurrence = 1,
): CrossPlanResolution {
	return taskResolution("Task 2", file, kind, value, evidence, runtimeTest, occurrence);
}

/** No output-language surface remains deferred after Task 4. */
export const CROSS_PLAN_OWNERSHIP: CrossPlanOwnership[] = [];

/** Task 2/3/4 replaces deferred entries with exact reviewed attestations. */
export const CROSS_PLAN_RESOLUTIONS: CrossPlanResolution[] = [
	{
		file: "apps/web/src/routes/_authed/reports/index.tsx",
		kind: "ambient-ui-language",
		value: "useI18n",
		occurrence: 1,
		owner: "portal-output-languages",
		task: "Task 3",
		resolution: "explicit-output-language",
		evidence: "Reports page chrome and operations copy remain bound to the ambient Portal UI language.",
		runtimeTest: "apps/web/src/routes/_authed/reports/index-output-language-browser-runtime.browser.test.tsx",
	},
	{
		file: "apps/web/src/routes/_authed/reports/index.tsx",
		kind: "output-language-binding",
		value: "buildReportCreateInput",
		occurrence: 1,
		owner: "portal-output-languages",
		task: "Task 3",
		resolution: "explicit-output-language",
		evidence: "Report creation binds only the resolved explicit artifact-language selection into the server input.",
		runtimeTest: "apps/web/src/routes/_authed/reports/index-output-language-browser-runtime.browser.test.tsx",
	},
	{
		file: "apps/web/src/routes/_authed/reports/index.tsx",
		kind: "output-language-binding",
		value: "renderReport",
		occurrence: 1,
		owner: "portal-output-languages",
		task: "Task 3",
		resolution: "explicit-output-language",
		evidence: "Each history item derives its artifact-language label from that report's persisted outputLanguage.",
		runtimeTest: "apps/web/src/routes/_authed/reports/index-output-language-transition.test.ts",
	},
	{
		file: "apps/web/src/routes/_authed/reports/render/$reportId.tsx",
		kind: "output-language-binding",
		value: "validateReportRenderSearch",
		occurrence: 1,
		owner: "portal-output-languages",
		task: "Task 4",
		resolution: "explicit-output-language",
		evidence:
			"The render route accepts only exact en or zh-CN overrides and otherwise falls back to persisted language.",
		runtimeTest: "apps/web/src/routes/_authed/reports/render/report-render-language.test.tsx",
	},
	{
		file: "apps/web/src/routes/_authed/reports/render/$reportId.tsx",
		kind: "output-copy",
		value: "getReportCopy",
		occurrence: 1,
		owner: "portal-output-languages",
		task: "Task 4",
		resolution: "explicit-output-language",
		evidence: "Printable report metadata resolves its title from the selected artifact language.",
		runtimeTest: "apps/web/src/routes/_authed/reports/render/report-render-language.test.tsx",
	},
	{
		file: "apps/web/src/routes/_authed/reports/render/$reportId.tsx",
		kind: "ambient-ui-language",
		value: "useI18n",
		occurrence: 1,
		owner: "portal-output-languages",
		task: "Task 4",
		resolution: "explicit-output-language",
		evidence: "Ambient Portal UI language supplies only the screen selector labels outside the artifact root.",
		runtimeTest: "apps/web/src/routes/_authed/reports/render/report-render-language.test.tsx",
	},
	{
		file: "apps/web/src/routes/_authed/reports/render/$reportId.tsx",
		kind: "output-copy",
		value: "getReportCopy",
		occurrence: 2,
		owner: "portal-output-languages",
		task: "Task 4",
		resolution: "explicit-output-language",
		evidence: "Route-owned printable copy and formatters resolve from the selected artifact language.",
		runtimeTest: "apps/web/src/routes/_authed/reports/render/report-render-language.test.tsx",
	},
	{
		file: "apps/web/src/routes/_authed/reports/render/$reportId.tsx",
		kind: "output-language-binding",
		value: "setOutputLanguage",
		occurrence: 1,
		owner: "portal-output-languages",
		task: "Task 4",
		resolution: "explicit-output-language",
		evidence:
			"The screen selector writes only a validated render-query override and never mutates UI or Program preferences.",
		runtimeTest: "apps/web/src/routes/_authed/reports/render/report-render-language.test.tsx",
	},
	{
		file: "apps/web/src/routes/_authed/reports/render/$reportId.tsx",
		kind: "output-component",
		value: "PromptChartPrint",
		occurrence: 1,
		owner: "portal-output-languages",
		task: "Task 4",
		resolution: "explicit-output-language",
		evidence: "The route passes the exact selected token and raw run evidence to the real printable chart component.",
		runtimeTest: "apps/web/src/routes/_authed/reports/render/report-render-language-browser-runtime.browser.test.tsx",
	},
	task4Resolution(
		"apps/web/src/components/prompt-chart-print.tsx",
		"ambient-ui-language",
		"useI18n",
		"Ambient UI language is only the backward-compatible fallback when no artifact language prop is supplied.",
		"apps/web/src/components/chart-surface-localization.test.tsx",
	),
	task4Resolution(
		"apps/web/src/components/prompt-chart-print.tsx",
		"output-component",
		"ChartDownloadFooter",
		"The first printable empty-state footer receives the resolved artifact language.",
		"apps/web/src/components/chart-surface-localization.test.tsx",
		1,
	),
	task4Resolution(
		"apps/web/src/components/prompt-chart-print.tsx",
		"output-component",
		"ChartDownloadFooter",
		"The no-mention footer receives the resolved artifact language.",
		"apps/web/src/components/chart-surface-localization.test.tsx",
		2,
	),
	task4Resolution(
		"apps/web/src/components/prompt-chart-print.tsx",
		"output-component",
		"BaseChartPrint",
		"Printable chart data and formatters receive the resolved artifact language without changing metrics.",
		"apps/web/src/components/chart-surface-localization.test.tsx",
	),
	task4Resolution(
		"apps/web/src/components/prompt-chart-print.tsx",
		"output-component",
		"ChartDownloadFooter",
		"The populated printable chart footer receives the resolved artifact language.",
		"apps/web/src/components/chart-surface-localization.test.tsx",
		3,
	),
	task4Resolution(
		"apps/web/src/components/prompt-chart-print.tsx",
		"output-language-binding",
		"PromptChartPrint",
		"The printable chart root binds lang, copy, and formatting to its explicit artifact language.",
		"apps/web/src/components/chart-surface-localization.test.tsx",
	),
	task4Resolution(
		"apps/web/src/components/prompt-chart-print.tsx",
		"output-copy",
		"getReportCopy",
		"Report chart static copy comes from the explicit report catalog while raw entities remain unchanged.",
		"apps/web/src/components/chart-surface-localization.test.tsx",
	),
	task4Resolution(
		"apps/web/src/components/base-chart-print.tsx",
		"ambient-ui-language",
		"useI18n",
		"Ambient UI formatting is retained only for callers that omit the optional artifact language.",
		"apps/web/src/components/chart-surface-localization.test.tsx",
	),
	task4Resolution(
		"apps/web/src/components/base-chart-print.tsx",
		"output-language-binding",
		"BaseChartPrint",
		"Print chart empty copy, percentages, and nested lang use the explicit artifact language.",
		"apps/web/src/components/chart-surface-localization.test.tsx",
	),
	task4Resolution(
		"apps/web/src/components/base-chart-print.tsx",
		"output-copy",
		"getReportCopy",
		"Print chart formatters resolve from the report-specific language catalog.",
		"apps/web/src/components/chart-surface-localization.test.tsx",
	),
	task4Resolution(
		"apps/web/src/components/chart-download-footer.tsx",
		"ambient-ui-language",
		"useI18n",
		"Ambient UI copy is only the compatibility fallback for non-artifact callers.",
		"apps/web/src/components/chart-surface-localization.test.tsx",
	),
	task4Resolution(
		"apps/web/src/components/chart-download-footer.tsx",
		"output-language-binding",
		"ChartDownloadFooter",
		"Printable download controls accept and bind the explicit artifact language.",
		"apps/web/src/components/chart-surface-localization.test.tsx",
	),
	task4Resolution(
		"apps/web/src/components/chart-download-footer.tsx",
		"output-copy",
		"getReportCopy",
		"Printable download title and progress copy resolve from the explicit report catalog.",
		"apps/web/src/components/chart-surface-localization.test.tsx",
	),
	task4Resolution(
		"apps/web/src/components/chart-export-preview.tsx",
		"output-component",
		"BaseChart",
		"The PNG preview passes its required explicit language into every visible chart formatter.",
		"apps/web/src/components/chart-export-output-language.browser.test.tsx",
	),
	task4Resolution(
		"apps/web/src/components/chart-export-preview.tsx",
		"output-language-binding",
		"ChartExportPreview",
		"The PNG preview root binds lang and static copy to the explicit export language.",
		"apps/web/src/components/chart-surface-localization.test.tsx",
	),
	task4Resolution(
		"apps/web/src/components/chart-export-preview.tsx",
		"output-copy",
		"getReportCopy",
		"PNG visibility and logo accessibility copy comes from the explicit artifact catalog.",
		"apps/web/src/components/chart-surface-localization.test.tsx",
	),
	task4Resolution(
		"apps/web/src/components/base-chart.tsx",
		"ambient-ui-language",
		"useI18n",
		"Live dashboard charts still use ambient UI language when no artifact language is supplied.",
		"apps/web/src/components/base-chart-localization.test.tsx",
	),
	task4Resolution(
		"apps/web/src/components/base-chart.tsx",
		"output-language-binding",
		"BaseChart",
		"PNG chart dates, values, labels, and nested lang prefer the explicit artifact language.",
		"apps/web/src/components/base-chart-localization.test.tsx",
	),
	task4Resolution(
		"apps/web/src/components/base-chart.tsx",
		"output-copy",
		"getReportCopy",
		"Explicit PNG chart formatting resolves through the report-language formatter boundary.",
		"apps/web/src/components/base-chart-localization.test.tsx",
	),
	task4Resolution(
		"apps/web/src/components/cached-prompt-chart.tsx",
		"ambient-ui-language",
		"useI18n",
		"Dashboard card chrome and live chart summaries intentionally remain in Portal UI language.",
		"apps/web/src/components/visibility-localization.test.tsx",
	),
	task4Resolution(
		"apps/web/src/components/cached-prompt-chart.tsx",
		"output-hook",
		"useChartExport",
		"The dashboard card passes only the resolved artifact selection into the PNG export hook.",
		"apps/web/src/components/chart-export-output-language.browser.test.tsx",
	),
	task4Resolution(
		"apps/web/src/components/cached-prompt-chart.tsx",
		"output-component",
		"BaseChart",
		"The on-screen BaseChart intentionally omits artifact language so dashboard chrome follows UI language.",
		"apps/web/src/components/chart-export-output-language.browser.test.tsx",
	),
	task4Resolution(
		"apps/web/src/components/cached-prompt-chart.tsx",
		"output-language-binding",
		"CachedPromptChart",
		"The card requires a resolved selection for export while preserving live UI language and raw entities.",
		"apps/web/src/components/visibility-localization.test.tsx",
	),
	task4Resolution(
		"apps/web/src/components/chart-actions-footer.tsx",
		"output-language-binding",
		"ChartActionsFooter",
		"The dashboard footer exposes the explicit selector and disables export until storage resolution.",
		"apps/web/src/components/chart-export-output-language.browser.test.tsx",
	),
	task4Resolution(
		"apps/web/src/components/chart-export-language-selector.tsx",
		"output-language-binding",
		"ChartExportLanguageSelector",
		"The native selector accepts only exact language tokens and persists changes through its supplied setter.",
		"apps/web/src/components/chart-export-output-language.browser.test.tsx",
	),
	task4Resolution(
		"apps/web/src/components/chart-export-language-selector.tsx",
		"ambient-ui-language",
		"useI18n",
		"Only the selector label and option chrome follow Portal UI language; its selected value is independent.",
		"apps/web/src/components/chart-export-output-language.browser.test.tsx",
	),
	task4Resolution(
		"apps/web/src/components/virtualized-prompt-list.tsx",
		"output-component",
		"CachedPromptChart",
		"Every virtualized chart receives the same resolved scope selection and setter.",
		"apps/web/src/components/chart-export-output-language.browser.test.tsx",
	),
	task4Resolution(
		"apps/web/src/components/virtualized-prompt-list.tsx",
		"output-language-binding",
		"VirtualizedPromptList",
		"The virtual list makes artifact language an explicit required boundary independent from prompts and metrics.",
		"apps/web/src/components/virtualized-prompt-list-output-language.test.tsx",
	),
	task4Resolution(
		"apps/web/src/components/prompts-display.tsx",
		"ambient-ui-language",
		"useI18n",
		"Visibility page chrome remains localized from the ambient UI language.",
		"apps/web/src/components/dashboard-chart-export-language-propagation.test.tsx",
	),
	task4Resolution(
		"apps/web/src/components/prompts-display.tsx",
		"output-component",
		"VirtualizedPromptList",
		"The resolved scope selection is propagated explicitly into the virtualized chart list.",
		"apps/web/src/components/chart-export-output-language.browser.test.tsx",
	),
	task4Resolution(
		"apps/web/src/components/prompts-display.tsx",
		"output-hook",
		"useArtifactLanguageSelection",
		"Dashboard export selection is session-scoped by exact surface, brand, and scope; UI is first-seed only.",
		"apps/web/src/components/chart-export-output-language.browser.test.tsx",
	),
	task4Resolution(
		"apps/web/src/components/prompts-display.tsx",
		"output-language-binding",
		"ChartSection",
		"ChartSection receives the resolved selection rather than deriving artifact language from UI or Program locale.",
		"apps/web/src/components/dashboard-chart-export-language-propagation.test.tsx",
	),
	task4Resolution(
		"apps/web/src/routes/_authed/app/$brand/visibility.tsx",
		"ambient-ui-language",
		"useI18n",
		"The Visibility route keeps all page chrome bound to Portal UI language.",
		"apps/web/src/routes/_authed/app/$brand/-analytics-localization.test.tsx",
	),
	task4Resolution(
		"apps/web/src/routes/_authed/app/$brand/visibility.tsx",
		"output-component",
		"PromptsDisplay",
		"The route declares the exact visibility-chart-export surface without supplying a locale-derived artifact token.",
		"apps/web/src/components/chart-export-output-language.browser.test.tsx",
	),
	task4Resolution(
		"apps/web/src/hooks/use-chart-export.tsx",
		"output-component",
		"ChartExportPreview",
		"The off-screen PNG preview receives the exact selection captured for the export request.",
		"apps/web/src/hooks/use-chart-export-output-language.test.tsx",
	),
	task4Resolution(
		"apps/web/src/hooks/use-chart-export.tsx",
		"output-language-binding",
		"useChartExport",
		"The hook requires an explicit language and binds it to both preview data and the html2canvas capture root.",
		"apps/web/src/hooks/use-chart-export-output-language.test.tsx",
	),
	...(
		[
			["ChartActionsFooter", 1],
			["ChartActionsFooter", 2],
		] satisfies Array<[string, number]>
	).map(([value, occurrence]) =>
		task4Resolution(
			"apps/web/src/components/cached-prompt-chart.tsx",
			"output-component",
			value,
			"The dashboard chart child stays in the live UI subtree while export language remains an explicit independent prop.",
			"apps/web/src/components/visibility-localization.test.tsx",
			occurrence,
		),
	),
	task4Resolution(
		"apps/web/src/components/chart-actions-footer.tsx",
		"ambient-ui-language",
		"useI18n",
		"Footer chrome follows Portal UI language while its artifact selector and download gate use explicit output language.",
		"apps/web/src/components/chart-export-output-language.browser.test.tsx",
	),
	...["ChartExportLanguageSelector"].map((value) =>
		task4Resolution(
			"apps/web/src/components/chart-actions-footer.tsx",
			"output-component",
			value,
			"The production chart footer child is rendered under the resolved artifact selector and download gating boundary.",
			"apps/web/src/components/chart-export-output-language.browser.test.tsx",
		),
	),
	...["PromptsContent", "ChartSection"].map((value) =>
		task4Resolution(
			"apps/web/src/components/prompts-display.tsx",
			"output-component",
			value,
			"The dashboard visibility child participates in the explicit scope selection propagation without changing UI chrome.",
			"apps/web/src/components/dashboard-chart-export-language-propagation.test.tsx",
		),
	),
	task2Resolution(
		"apps/web/src/routes/_authed/app/$brand/opportunities.tsx",
		"ambient-ui-language",
		"useI18n",
		"Customer Opportunity page chrome stays in Portal UI language beside its independent artifact selection.",
		"apps/web/src/routes/_authed/app/$brand/opportunities-output-language.test.tsx",
	),
	task2Resolution(
		"apps/web/src/components/opportunities-generation-control.tsx",
		"ambient-ui-language",
		"useI18n",
		"Admin Opportunity controls keep visible chrome in UI language while generation uses the explicit artifact token.",
		"apps/web/src/components/opportunities-generation-control.test.tsx",
	),
	...["OpportunityCard"].map((value) =>
		task2Resolution(
			"apps/web/src/components/opportunities-report.tsx",
			"output-component",
			value,
			"The Opportunity artifact child renders inside the persisted report-language root without translating raw evidence.",
			"apps/web/src/components/opportunities-report.test.tsx",
		),
	),
	{
		file: "apps/web/src/components/opportunities-generation-control.tsx",
		kind: "output-hook",
		value: "useArtifactLanguageSelection",
		occurrence: 1,
		owner: "portal-output-languages",
		task: "Task 2",
		resolution: "explicit-output-language",
		evidence: "The generation control resolves and submits the tab-scoped artifact language.",
		runtimeTest: "apps/web/src/components/chart-export-output-language.browser.test.tsx",
	},
	{
		file: "apps/web/src/routes/_authed/app/$brand/opportunities.tsx",
		kind: "output-hook",
		value: "useArtifactLanguageSelection",
		occurrence: 1,
		owner: "portal-output-languages",
		task: "Task 2",
		resolution: "explicit-output-language",
		evidence: "The customer route resolves its independent tab-scoped artifact language before reading.",
		runtimeTest: "apps/web/src/components/chart-export-output-language.browser.test.tsx",
	},
	{
		file: "apps/web/src/routes/_authed/app/$brand/opportunities.tsx",
		kind: "output-component",
		value: "OpportunitiesReport",
		occurrence: 1,
		owner: "portal-output-languages",
		task: "Task 2",
		resolution: "explicit-output-language",
		evidence: "The customer route passes the persisted response language into the report artifact boundary.",
		runtimeTest: "apps/web/src/routes/_authed/app/$brand/opportunities-output-language.test.tsx",
	},
	{
		file: "apps/web/src/components/opportunities-report.tsx",
		kind: "output-language-binding",
		value: "OpportunitiesReport",
		occurrence: 1,
		owner: "portal-output-languages",
		task: "Task 2",
		resolution: "explicit-output-language",
		evidence: "The report root binds static artifact copy and formatting to its explicit output language.",
		runtimeTest: "apps/web/src/components/opportunities-report.test.tsx",
	},
	{
		file: "apps/web/src/components/opportunities-report.tsx",
		kind: "output-language-binding",
		value: "OpportunityCard",
		occurrence: 1,
		owner: "portal-output-languages",
		task: "Task 2",
		resolution: "explicit-output-language",
		evidence: "Each Opportunity card binds its static drill-down copy and counts to the explicit output language.",
		runtimeTest: "apps/web/src/components/opportunities-report.test.tsx",
	},
	{
		file: "apps/web/src/hooks/use-opportunities.tsx",
		kind: "output-language-binding",
		value: "useOpportunities",
		occurrence: 1,
		owner: "portal-output-languages",
		task: "Task 2",
		resolution: "explicit-output-language",
		evidence: "The hook binds the explicit output language into both its cache key and customer read request.",
		runtimeTest: "apps/web/src/hooks/use-opportunities.test.ts",
	},
];

function normalizedValue(value: string) {
	return value.replace(/\s+/g, " ").trim();
}

function propertyNameText(name: PropertyName | JsxAttributeName): string | undefined {
	if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) return name.text;
	if (ts.isJsxNamespacedName(name)) return `${name.namespace.text}:${name.name.text}`;
	return undefined;
}

function callName(node: CallExpression): string | undefined {
	if (ts.isIdentifier(node.expression)) return node.expression.text;
	if (ts.isPropertyAccessExpression(node.expression)) {
		return `${node.expression.expression.getText()}.${node.expression.name.text}`;
	}
	return undefined;
}

function hasTrueRawDetailAttribute(opening: JsxOpeningLikeElement): boolean {
	for (const property of opening.attributes.properties) {
		if (!ts.isJsxAttribute(property) || propertyNameText(property.name) !== "data-raw-detail") continue;
		if (!property.initializer) return true;
		if (ts.isStringLiteral(property.initializer)) return property.initializer.text === "true";
		return isJsxExpression(property.initializer) && property.initializer.expression?.kind === ts.SyntaxKind.TrueKeyword;
	}
	return false;
}

function rawDetailMarker(node: Node): import("typescript/unstable/ast").JsxElement | JsxOpeningLikeElement | undefined {
	for (let current: Node | undefined = node; current; current = current.parent) {
		if (ts.isJsxElement(current) && hasTrueRawDetailAttribute(current.openingElement)) return current;
		if (ts.isJsxSelfClosingElement(current) && hasTrueRawDetailAttribute(current)) return current;
	}
	return undefined;
}

function candidateRegion(node: Node): CandidateRegion | undefined {
	return rawDetailMarker(node) ? "raw-detail" : undefined;
}

function expressionContainsStringSyntax(node: Node): boolean {
	let found = false;
	const visit = (child: Node) => {
		if (ts.isStringLiteral(child) || ts.isNoSubstitutionTemplateLiteral(child) || ts.isTemplateExpression(child)) {
			found = true;
			return;
		}
		if (!found) child.forEachChild(visit);
	};
	visit(node);
	return found;
}

function expressionContainsJsxSyntax(node: Node): boolean {
	let found = false;
	const visit = (child: Node) => {
		if (ts.isJsxElement(child) || ts.isJsxFragment(child) || ts.isJsxSelfClosingElement(child)) {
			found = true;
			return;
		}
		if (!found) child.forEachChild(visit);
	};
	visit(node);
	return found;
}

function isControlOnlyExpression(node: Node): boolean {
	let current = node;
	for (let parent = current.parent; parent; parent = parent.parent) {
		if (
			(ts.isBinaryExpression(parent) &&
				parent.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken &&
				parent.left === current) ||
			(ts.isConditionalExpression(parent) && parent.condition === current) ||
			(ts.isIfStatement(parent) && parent.expression === current) ||
			(ts.isWhileStatement(parent) && parent.expression === current) ||
			(ts.isDoStatement(parent) && parent.expression === current)
		) {
			return true;
		}
		if (ts.isJsxExpression(parent)) return false;
		if (!ts.isExpression(parent)) return false;
		current = parent;
	}
	return false;
}

type LexicalBindings = {
	declarations: ReadonlyMap<string, readonly Node[]>;
	sourceFile: SourceFile;
};

function declarationName(node: Node): string | undefined {
	if (ts.isVariableDeclaration(node) || ts.isParameterDeclaration(node) || isBindingElement(node)) {
		return node.name && ts.isIdentifier(node.name) ? node.name.text : undefined;
	}
	if (
		ts.isImportSpecifier(node) ||
		ts.isImportClause(node) ||
		ts.isNamespaceImport(node) ||
		ts.isFunctionDeclaration(node) ||
		ts.isEnumDeclaration(node) ||
		ts.isInterfaceDeclaration(node) ||
		ts.isTypeAliasDeclaration(node)
	) {
		return node.name?.text;
	}
	return undefined;
}

function declarationScope(node: Node): Node | undefined {
	if (ts.isImportSpecifier(node) || ts.isImportClause(node) || ts.isNamespaceImport(node)) return node.getSourceFile();
	if (ts.isParameterDeclaration(node) || (isBindingElement(node) && ts.isParameterDeclaration(node.parent))) {
		for (let current = node.parent; current; current = current.parent) {
			if (ts.isFunctionLikeDeclaration(current)) return current;
		}
	}
	for (let current = node.parent; current; current = current.parent) {
		if (ts.isBlock(current) || ts.isSourceFile(current) || ts.isFunctionLikeDeclaration(current)) return current;
	}
	return undefined;
}

function collectLexicalBindings(sourceFile: SourceFile): LexicalBindings {
	const declarations = new Map<string, Node[]>();
	const visit = (node: Node) => {
		const name = declarationName(node);
		if (name) declarations.set(name, [...(declarations.get(name) ?? []), node]);
		node.forEachChild(visit);
	};
	visit(sourceFile);
	return { declarations, sourceFile };
}

function lexicalDeclaration(identifier: import("typescript/unstable/ast").Identifier, bindings: LexicalBindings) {
	const candidates = bindings.declarations.get(identifier.text) ?? [];
	const referenceScopes: Node[] = [];
	for (let current: Node | undefined = identifier.parent; current; current = current.parent) {
		if (ts.isBlock(current) || ts.isSourceFile(current) || ts.isFunctionLikeDeclaration(current)) {
			referenceScopes.push(current);
		}
	}
	return candidates
		.filter((candidate) => {
			const scope = declarationScope(candidate);
			if (!scope || !referenceScopes.includes(scope)) return false;
			return true;
		})
		.sort((left, right) => {
			const leftDepth = referenceScopes.indexOf(declarationScope(left) as Node);
			const rightDepth = referenceScopes.indexOf(declarationScope(right) as Node);
			return leftDepth - rightDepth || right.pos - left.pos;
		})[0];
}

function declarationInitializer(node: Node): Expression | undefined {
	if (ts.isVariableDeclaration(node) || ts.isParameterDeclaration(node)) return node.initializer;
	if (isBindingElement(node)) {
		if (node.initializer) return node.initializer;
		for (let current = node.parent; current && !ts.isFunctionLikeDeclaration(current); current = current.parent) {
			if (ts.isVariableDeclaration(current)) return current.initializer;
		}
	}
	return undefined;
}

function importModule(node: Node): string | undefined {
	for (let current: Node | undefined = node; current; current = current.parent) {
		if (ts.isImportDeclaration(current) && ts.isStringLiteral(current.moduleSpecifier)) {
			return current.moduleSpecifier.text;
		}
	}
	return undefined;
}

function importedBindingMatches(
	identifier: import("typescript/unstable/ast").Identifier,
	bindings: LexicalBindings,
	exportedName: string,
	modulePattern: RegExp,
) {
	const declaration = lexicalDeclaration(identifier, bindings);
	return (
		declaration !== undefined &&
		ts.isImportSpecifier(declaration) &&
		(declaration.propertyName?.text ?? declaration.name.text) === exportedName &&
		modulePattern.test(importModule(declaration) ?? "")
	);
}

function localizedTranslatorKind(
	identifier: import("typescript/unstable/ast").Identifier,
	bindings: LexicalBindings,
): "t" | "translate" | undefined {
	if (importedBindingMatches(identifier, bindings, "translate", /(?:^|\/)i18n\/catalog$/u)) return "translate";
	const declaration = lexicalDeclaration(identifier, bindings);
	if (!declaration) return undefined;
	if (isBindingElement(declaration)) {
		const externalName = declaration.propertyName
			? propertyNameText(declaration.propertyName)
			: declaration.name && ts.isIdentifier(declaration.name)
				? declaration.name.text
				: undefined;
		if (externalName !== "t") return undefined;
		const initializer = declarationInitializer(declaration);
		return initializer !== undefined &&
			ts.isCallExpression(initializer) &&
			ts.isIdentifier(initializer.expression) &&
			importedBindingMatches(initializer.expression, bindings, "useI18n", /(?:^|\/)i18n\/provider$/u)
			? "t"
			: undefined;
	}
	return undefined;
}

function isLocalizedCall(node: CallExpression, bindings: LexicalBindings): boolean {
	return ts.isIdentifier(node.expression) && localizedTranslatorKind(node.expression, bindings) !== undefined;
}

function localizedCallMessageId(node: CallExpression, bindings: LexicalBindings): string | undefined {
	if (!ts.isIdentifier(node.expression)) return undefined;
	const kind = localizedTranslatorKind(node.expression, bindings);
	const id = node.arguments[kind === "translate" ? 1 : 0];
	return kind !== undefined && id && (ts.isStringLiteral(id) || ts.isNoSubstitutionTemplateLiteral(id))
		? id.text
		: undefined;
}

function isCanonicalLocalizedRawDetail(opening: JsxOpeningLikeElement, bindings: LexicalBindings): boolean {
	return (
		ts.isIdentifier(opening.tagName) &&
		importedBindingMatches(opening.tagName, bindings, "LocalizedRawDetail", /^@\/components\/localized-raw-detail$/u)
	);
}

function canonicalRawDetailHasApprovedLabel(
	opening: JsxOpeningLikeElement,
	catalogMessageIds: ReadonlySet<string> | undefined,
): boolean {
	const label = opening.attributes.properties.find(
		(attribute) => ts.isJsxAttribute(attribute) && propertyNameText(attribute.name) === "labelId",
	);
	return Boolean(
		label &&
			ts.isJsxAttribute(label) &&
			label.initializer &&
			ts.isStringLiteral(label.initializer) &&
			APPROVED_RAW_DETAIL_MESSAGE_IDS.has(label.initializer.text) &&
			(catalogMessageIds?.has(label.initializer.text) ?? false),
	);
}

function isLocalizedRawDetailImplementation(node: Node, normalizedFile: string): boolean {
	if (normalizedFile !== "apps/web/src/components/localized-raw-detail.tsx") return false;
	for (let current: Node | undefined = node; current; current = current.parent) {
		if (ts.isFunctionDeclaration(current)) return current.name?.text === "LocalizedRawDetail";
	}
	return false;
}

function isResolvedBuildTitle(
	node: CallExpression,
	bindings: LexicalBindings,
	catalogMessageIds: ReadonlySet<string> | undefined,
) {
	if (!ts.isIdentifier(node.expression)) return false;
	const symbol = importedSymbol(node.expression, bindings);
	if (symbol?.exportedName !== "buildTitle" || !/(?:^|\/)lib\/route-head$/u.test(symbol.module)) return false;
	const first = node.arguments[0];
	if (!first || !ts.isCallExpression(unwrapExpression(first))) return false;
	const id = localizedCallMessageId(unwrapExpression(first) as CallExpression, bindings);
	return id !== undefined && (catalogMessageIds?.has(id) ?? false);
}

type CandidateOptions = { catalogMessageIds?: ReadonlySet<string> };

type SourceInput = { file: string; source: string };

function normalizedVirtualPath(value: string) {
	const normalized = value.replaceAll("\\", "/");
	return /^[A-Z]:/.test(normalized) ? normalized[0].toLowerCase() + normalized.slice(1) : normalized;
}

function withParsedSources<T>(inputs: SourceInput[], callback: (files: Map<string, SourceFile>) => T): T {
	const virtualToInput = new Map<string, string>();
	const virtualFiles: Record<string, string> = {};
	for (const [index, input] of inputs.entries()) {
		const extension = input.file.endsWith(".ts") ? ".ts" : ".tsx";
		const virtual = normalizedVirtualPath(
			path.resolve(process.cwd(), ".portal-language-audit-virtual", `${index}${extension}`),
		);
		virtualFiles[virtual] = input.source;
		virtualToInput.set(virtual, input.file);
	}
	const api = new API({ cwd: process.cwd(), fs: createVirtualFileSystem(virtualFiles) });
	try {
		const snapshot = api.updateSnapshot({ openFiles: [...virtualToInput.keys()] });
		const parsed = new Map<string, SourceFile>();
		for (const [virtual, inputFile] of virtualToInput) {
			const project = snapshot.getDefaultProjectForFile(virtual) ?? snapshot.getProjects()[0];
			const sourceFile = project?.program.getSourceFile(virtual);
			if (!sourceFile) throw new Error(`TypeScript compiler API did not parse ${inputFile}`);
			parsed.set(inputFile, sourceFile);
		}
		return callback(parsed);
	} finally {
		api.close();
	}
}

function requiredSourceFile(parsed: Map<string, SourceFile>, file: string) {
	const sourceFile = parsed.get(file);
	if (!sourceFile) throw new Error(`Missing parsed TypeScript source for ${file}`);
	return sourceFile;
}

function isSyntacticallyRawError(expression: Expression) {
	const unwrapped = unwrapExpression(expression);
	if (ts.isIdentifier(unwrapped)) {
		return /^(?:caught(?:Error|Failure)?|raw(?:Error|Failure|Detail|Message|Output|Response|ErrorDetail))$/iu.test(
			unwrapped.text,
		);
	}
	if (ts.isPropertyAccessExpression(unwrapped)) {
		if (/^(?:error|errors|failedReason|failureReason)$/u.test(unwrapped.name.text)) return true;
		return (
			/^(?:message|stack|cause|detail)$/u.test(unwrapped.name.text) &&
			/(?:error|failure|caught|raw)/iu.test(unwrapped.expression.getText())
		);
	}
	if (ts.isElementAccessExpression(unwrapped)) {
		const argument = unwrapped.argumentExpression;
		return Boolean(
			argument &&
				(ts.isStringLiteral(argument) || ts.isNoSubstitutionTemplateLiteral(argument)) &&
				/^(?:error|errors|message|stack|cause|detail|failedReason|failureReason)$/u.test(argument.text),
		);
	}
	if (ts.isCallExpression(unwrapped)) {
		const name = callName(unwrapped)?.split(".").at(-1);
		return (
			name !== undefined &&
			/^(?:(?:get|read|load|format)?raw(?:error|failure|detail|message|output|response|errorDetail)|(?:get|read|load|format)?(?:error|failure|caughtError))$/iu.test(
				name,
			)
		);
	}
	return false;
}

function isCatchBinding(declaration: Node) {
	return ts.isVariableDeclaration(declaration) && ts.isCatchClause(declaration.parent);
}

function enclosingFunctionOrSource(node: Node): Node {
	for (let current: Node | undefined = node.parent; current; current = current.parent) {
		if (ts.isFunctionLikeDeclaration(current) || ts.isSourceFile(current)) return current;
	}
	return node.getSourceFile();
}

function stateSetterDeclaration(declaration: Node): Node | undefined {
	if (!isBindingElement(declaration) || !ts.isArrayBindingPattern(declaration.parent)) return undefined;
	const index = declaration.parent.elements.indexOf(declaration);
	if (index !== 0) return undefined;
	const variable = declaration.parent.parent;
	if (!ts.isVariableDeclaration(variable) || !variable.initializer) return undefined;
	const initializer = unwrapExpression(variable.initializer);
	if (!ts.isCallExpression(initializer)) return undefined;
	const call = ts.isIdentifier(initializer.expression) ? initializer.expression.text : callName(initializer);
	if (call !== "useState" && !call?.endsWith(".useState")) return undefined;
	const setter = declaration.parent.elements[1];
	return setter && isBindingElement(setter) ? setter : undefined;
}

function assignedValueExpressions(declaration: Node, bindings: LexicalBindings): Expression[] {
	const values: Expression[] = [];
	const setter = stateSetterDeclaration(declaration);
	const root = enclosingFunctionOrSource(declaration);
	const visit = (node: Node) => {
		if (
			ts.isBinaryExpression(node) &&
			node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
			ts.isIdentifier(unwrapExpression(node.left)) &&
			lexicalDeclaration(unwrapExpression(node.left) as import("typescript/unstable/ast").Identifier, bindings) ===
				declaration
		) {
			values.push(node.right);
		}
		if (
			setter &&
			ts.isCallExpression(node) &&
			ts.isIdentifier(node.expression) &&
			lexicalDeclaration(node.expression, bindings) === setter &&
			node.arguments[0]
		) {
			values.push(node.arguments[0]);
		}
		node.forEachChild(visit);
	};
	visit(root);
	return values;
}

function expressionProducesRawValue(
	expression: Expression,
	bindings: LexicalBindings,
	visiting = new Set<Node>(),
): boolean {
	const unwrapped = unwrapExpression(expression);
	if (isSyntacticallyRawError(unwrapped)) return true;
	if (ts.isIdentifier(unwrapped)) {
		const declaration = lexicalDeclaration(unwrapped, bindings);
		if (!declaration || visiting.has(declaration)) return false;
		if (isCatchBinding(declaration)) return true;
		const initializer = declarationInitializer(declaration);
		visiting.add(declaration);
		const raw =
			(initializer ? expressionProducesRawValue(initializer, bindings, visiting) : false) ||
			assignedValueExpressions(declaration, bindings).some((value) =>
				expressionProducesRawValue(value, bindings, visiting),
			);
		visiting.delete(declaration);
		return raw;
	}
	if (
		ts.isCallExpression(unwrapped) &&
		ts.isIdentifier(unwrapped.expression) &&
		unwrapped.expression.text === "String" &&
		lexicalDeclaration(unwrapped.expression, bindings) === undefined
	) {
		const value = unwrapped.arguments[0];
		return Boolean(
			value &&
				((ts.isIdentifier(unwrapExpression(value)) && /(?:error|failure|caught|raw)/iu.test(value.getText())) ||
					expressionProducesRawValue(value, bindings, visiting)),
		);
	}
	if (ts.isConditionalExpression(unwrapped)) {
		return (
			expressionProducesRawValue(unwrapped.whenTrue, bindings, visiting) ||
			expressionProducesRawValue(unwrapped.whenFalse, bindings, visiting)
		);
	}
	if (ts.isBinaryExpression(unwrapped)) {
		if (
			unwrapped.operatorToken.kind === ts.SyntaxKind.CommaToken ||
			unwrapped.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken
		) {
			return expressionProducesRawValue(unwrapped.right, bindings, visiting);
		}
		return (
			expressionProducesRawValue(unwrapped.left, bindings, visiting) ||
			expressionProducesRawValue(unwrapped.right, bindings, visiting)
		);
	}
	if (ts.isTemplateExpression(unwrapped)) {
		return unwrapped.templateSpans.some((span) => expressionProducesRawValue(span.expression, bindings, visiting));
	}
	return false;
}

function expressionIsRawHazard(expression: Expression, bindings: LexicalBindings, visiting = new Set<Node>()) {
	const unwrapped = unwrapExpression(expression);
	if (isSyntacticallyRawError(unwrapped) || ts.isIdentifier(unwrapped)) {
		return expressionProducesRawValue(unwrapped, bindings, visiting);
	}
	return (
		ts.isCallExpression(unwrapped) &&
		ts.isIdentifier(unwrapped.expression) &&
		unwrapped.expression.text === "String" &&
		expressionProducesRawValue(unwrapped, bindings, visiting)
	);
}

function expressionProducesLocalizedCopy(
	expression: Expression,
	bindings: LexicalBindings,
	visiting = new Set<Node>(),
): boolean {
	const unwrapped = unwrapExpression(expression);
	if (ts.isCallExpression(unwrapped) && isLocalizedCall(unwrapped, bindings)) return true;
	if (ts.isIdentifier(unwrapped)) {
		const declaration = lexicalDeclaration(unwrapped, bindings);
		if (!declaration || visiting.has(declaration)) return false;
		visiting.add(declaration);
		const initializer = declarationInitializer(declaration);
		const localized =
			(initializer ? expressionProducesLocalizedCopy(initializer, bindings, visiting) : false) ||
			assignedValueExpressions(declaration, bindings).some((value) =>
				expressionProducesLocalizedCopy(value, bindings, visiting),
			);
		visiting.delete(declaration);
		return localized;
	}
	if (ts.isConditionalExpression(unwrapped)) {
		return (
			expressionProducesLocalizedCopy(unwrapped.whenTrue, bindings, visiting) ||
			expressionProducesLocalizedCopy(unwrapped.whenFalse, bindings, visiting)
		);
	}
	if (ts.isBinaryExpression(unwrapped)) {
		return (
			expressionProducesLocalizedCopy(unwrapped.left, bindings, visiting) ||
			expressionProducesLocalizedCopy(unwrapped.right, bindings, visiting)
		);
	}
	if (ts.isTemplateExpression(unwrapped)) {
		return unwrapped.templateSpans.some((span) => expressionProducesLocalizedCopy(span.expression, bindings, visiting));
	}
	if (ts.isCallExpression(unwrapped)) {
		return unwrapped.arguments.some((argument) => expressionProducesLocalizedCopy(argument, bindings, visiting));
	}
	return false;
}

function syntacticRawErrorExpressions(expression: Expression, bindings: LexicalBindings): Expression[] {
	const hazards: Expression[] = [];
	const seen = new Set<Node>();
	const visit = (node: Node) => {
		if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
			const symbol = importedSymbol(node.expression, bindings);
			if (
				symbol?.exportedName === "customerSettingsErrorMessageId" &&
				/(?:^|\/)components\/customer-settings-errors$/u.test(symbol.module)
			) {
				return;
			}
		}
		if (ts.isExpression(node)) {
			const unwrapped = unwrapExpression(node);
			if (expressionIsRawHazard(unwrapped, bindings)) {
				if (!seen.has(unwrapped)) {
					seen.add(unwrapped);
					hazards.push(unwrapped);
				}
				return;
			}
		}
		node.forEachChild(visit);
	};
	visit(expression);
	return hazards;
}

function isWithinStableUiErrorMapper(node: Node, bindings: LexicalBindings): boolean {
	for (let current: Node | undefined = node.parent; current; current = current.parent) {
		if (ts.isCallExpression(current) && ts.isIdentifier(current.expression)) {
			const symbol = importedSymbol(current.expression, bindings);
			return Boolean(
				symbol?.exportedName === "customerSettingsErrorMessageId" &&
					/(?:^|\/)components\/customer-settings-errors$/u.test(symbol.module),
			);
		}
		if (ts.isStatement(current) || ts.isJsxExpression(current)) return false;
	}
	return false;
}

function isTraceableVisibleStringExpression(expression: Expression): boolean {
	const unwrapped = unwrapExpression(expression);
	if (
		ts.isStringLiteral(unwrapped) ||
		ts.isNoSubstitutionTemplateLiteral(unwrapped) ||
		ts.isTemplateExpression(unwrapped)
	) {
		return true;
	}
	if (ts.isConditionalExpression(unwrapped)) {
		return (
			isTraceableVisibleStringExpression(unwrapped.whenTrue) || isTraceableVisibleStringExpression(unwrapped.whenFalse)
		);
	}
	if (ts.isBinaryExpression(unwrapped)) {
		return isTraceableVisibleStringExpression(unwrapped.left) || isTraceableVisibleStringExpression(unwrapped.right);
	}
	return false;
}

function staticPropertyInitializer(
	expression: Expression,
	property: string | number,
	bindings: LexicalBindings,
	visiting: Set<Node>,
): Expression | undefined {
	const unwrapped = unwrapExpression(expression);
	if (ts.isObjectLiteralExpression(unwrapped) && typeof property === "string") {
		const member = unwrapped.properties.find(
			(candidate) => ts.isPropertyAssignment(candidate) && propertyNameText(candidate.name) === property,
		);
		return member && ts.isPropertyAssignment(member) ? member.initializer : undefined;
	}
	if (ts.isArrayLiteralExpression(unwrapped) && typeof property === "number") {
		const member = unwrapped.elements[property];
		return member && !ts.isSpreadElement(member) ? member : undefined;
	}
	if (!ts.isIdentifier(unwrapped)) return undefined;
	const declaration = lexicalDeclaration(unwrapped, bindings);
	if (!declaration || visiting.has(declaration)) return undefined;
	if (ts.isEnumDeclaration(declaration) && typeof property === "string") {
		return declaration.members.find((member) => propertyNameText(member.name) === property)?.initializer;
	}
	const initializer = declarationInitializer(declaration);
	if (!initializer) return undefined;
	visiting.add(declaration);
	const projected = staticPropertyInitializer(initializer, property, bindings, visiting);
	visiting.delete(declaration);
	return projected;
}

function bindingElementVisibleStringSource(
	declaration: import("typescript/unstable/ast").BindingElement,
	bindings: LexicalBindings,
	visiting: Set<Node>,
): Expression | undefined {
	const pattern = declaration.parent;
	if (!ts.isObjectBindingPattern(pattern) && !ts.isArrayBindingPattern(pattern)) return undefined;
	const variable = pattern.parent;
	if (!ts.isVariableDeclaration(variable) || !variable.initializer) return undefined;
	const property = ts.isObjectBindingPattern(pattern)
		? declaration.propertyName
			? propertyNameText(declaration.propertyName)
			: declaration.name && ts.isIdentifier(declaration.name)
				? declaration.name.text
				: undefined
		: pattern.elements.indexOf(declaration);
	if (property === undefined || (typeof property === "number" && property < 0)) return undefined;
	const initializer = staticPropertyInitializer(variable.initializer, property, bindings, visiting);
	return initializer ? staticVisibleStringSource(initializer, bindings, visiting) : undefined;
}

function staticVisibleStringSource(
	expression: Expression,
	bindings: LexicalBindings,
	visiting = new Set<Node>(),
): Expression | undefined {
	const unwrapped = unwrapExpression(expression);
	if (isTraceableVisibleStringExpression(unwrapped)) return unwrapped;
	if (ts.isPropertyAccessExpression(unwrapped) || ts.isElementAccessExpression(unwrapped)) {
		const property = ts.isPropertyAccessExpression(unwrapped)
			? unwrapped.name.text
			: unwrapped.argumentExpression &&
					(ts.isStringLiteral(unwrapped.argumentExpression) ||
						ts.isNoSubstitutionTemplateLiteral(unwrapped.argumentExpression))
				? unwrapped.argumentExpression.text
				: undefined;
		const object = unwrapExpression(unwrapped.expression);
		if (!property || !ts.isIdentifier(object)) return undefined;
		const declaration = lexicalDeclaration(object, bindings);
		if (!declaration || visiting.has(declaration)) return undefined;
		let initializer: Expression | undefined;
		if (ts.isEnumDeclaration(declaration)) {
			initializer = declaration.members.find((member) => propertyNameText(member.name) === property)?.initializer;
		} else {
			const objectInitializer = declarationInitializer(declaration);
			const objectLiteral = objectInitializer && unwrapExpression(objectInitializer);
			if (objectLiteral && ts.isObjectLiteralExpression(objectLiteral)) {
				const member = objectLiteral.properties.find(
					(candidate) => ts.isPropertyAssignment(candidate) && propertyNameText(candidate.name) === property,
				);
				if (member && ts.isPropertyAssignment(member)) initializer = member.initializer;
			}
		}
		if (!initializer) return undefined;
		visiting.add(declaration);
		const source = staticVisibleStringSource(initializer, bindings, visiting);
		visiting.delete(declaration);
		return source;
	}
	if (!ts.isIdentifier(unwrapped)) return undefined;
	const declaration = lexicalDeclaration(unwrapped, bindings);
	if (!declaration || visiting.has(declaration)) return undefined;
	if (isBindingElement(declaration)) {
		visiting.add(declaration);
		const projected = bindingElementVisibleStringSource(declaration, bindings, visiting);
		visiting.delete(declaration);
		if (projected) return projected;
	}
	const initializer = declarationInitializer(declaration);
	if (!initializer) return undefined;
	visiting.add(declaration);
	const source = staticVisibleStringSource(initializer, bindings, visiting);
	visiting.delete(declaration);
	return source;
}

function visibleStringOrigins(
	expression: Expression,
	bindings: LexicalBindings,
): { sources: Expression[]; hasUnknownAssignment: boolean } {
	const sources: Expression[] = [];
	let hasUnknownAssignment = false;
	const addSource = (candidate: Expression | undefined) => {
		if (candidate && !sources.some((source) => source.pos === candidate.pos && source.end === candidate.end)) {
			sources.push(candidate);
		}
	};
	addSource(staticVisibleStringSource(expression, bindings));
	const unwrapped = unwrapExpression(expression);
	if (ts.isIdentifier(unwrapped)) {
		const declaration = lexicalDeclaration(unwrapped, bindings);
		if (declaration) {
			for (const assigned of assignedValueExpressions(declaration, bindings)) {
				const source = staticVisibleStringSource(assigned, bindings);
				if (source) addSource(source);
				else hasUnknownAssignment = true;
			}
		}
	}
	return { sources, hasUnknownAssignment };
}

export function collectPortalLanguageCandidatesFromSource(
	file: string,
	source: string,
	options: CandidateOptions = {},
): PortalLanguageCandidate[] {
	const normalizedFile = file.replaceAll("\\", "/");
	return withParsedSources([{ file: normalizedFile, source }], (parsed) =>
		collectPortalLanguageCandidatesFromAst(normalizedFile, requiredSourceFile(parsed, normalizedFile), options),
	);
}

function collectPortalLanguageCandidatesFromAst(
	normalizedFile: string,
	sourceFile: SourceFile,
	options: CandidateOptions,
): PortalLanguageCandidate[] {
	const collected: UnnumberedCandidate[] = [];
	const collectedIdentities = new Set<string>();
	const lexicalBindings = collectLexicalBindings(sourceFile);

	const add = (
		node: Node,
		kind: CandidateKind,
		value: string,
		extra: Partial<Pick<UnnumberedCandidate, "region" | "rawDetailLabelled" | "catalogResolved">> = {},
	) => {
		const normalized = normalizedValue(value);
		if (!normalized) return;
		if (kind === "raw-error-interpolation" && isControlOnlyExpression(node)) return;
		const identity = `${node.pos}\0${node.end}\0${kind}\0${normalized}`;
		if (collectedIdentities.has(identity)) return;
		collectedIdentities.add(identity);
		collected.push({
			file: normalizedFile,
			kind,
			value: normalized,
			line: sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1,
			catalogResolved: false,
			...extra,
		});
	};
	const canonicalRawDetailBoundary = (node: Node) => {
		let detailAttribute: import("typescript/unstable/ast").JsxAttribute | undefined;
		let opening: JsxOpeningLikeElement | undefined;
		for (let current: Node | undefined = node.parent; current; current = current.parent) {
			if (ts.isJsxAttribute(current) && propertyNameText(current.name) === "detail") detailAttribute = current;
			if (ts.isJsxOpeningElement(current) || ts.isJsxSelfClosingElement(current)) {
				opening = current;
				break;
			}
		}
		if (!detailAttribute || !opening || !isCanonicalLocalizedRawDetail(opening, lexicalBindings)) return false;
		const expression =
			detailAttribute.initializer &&
			isJsxExpression(detailAttribute.initializer) &&
			detailAttribute.initializer.expression
				? detailAttribute.initializer.expression
				: undefined;
		return (
			canonicalRawDetailHasApprovedLabel(opening, options.catalogMessageIds) &&
			(!expression || !expressionProducesLocalizedCopy(expression, lexicalBindings))
		);
	};
	const rawCandidateExtra = (node: Node) => {
		const canonicalBoundary = canonicalRawDetailBoundary(node);
		return {
			region: canonicalBoundary ? ("raw-detail" as const) : candidateRegion(node),
			rawDetailLabelled: canonicalBoundary || isLocalizedRawDetailImplementation(node, normalizedFile),
		};
	};
	const addCanonicalRawDetail = (expression: Expression, approvedLabel: boolean) => {
		const hazards = syntacticRawErrorExpressions(expression, lexicalBindings);
		const values = hazards.length > 0 ? hazards : [expression];
		const translatedDetail = expressionProducesLocalizedCopy(expression, lexicalBindings);
		for (const value of values) {
			add(value, "raw-error-interpolation", value.getText(sourceFile), {
				region: "raw-detail",
				rawDetailLabelled: approvedLabel && !translatedDetail,
			});
		}
	};

	const scalarKind = (context: "jsx" | "prop" | "metadata" | "toast"): CandidateKind => {
		if (context === "prop") return "text-prop";
		if (context === "metadata") return "metadata-copy";
		if (context === "toast") return "toast-dialog-copy";
		return "jsx-text";
	};

	const addExpression = (expression: Expression, context: "jsx" | "prop" | "metadata" | "toast") => {
		if (
			ts.isParenthesizedExpression(expression) ||
			ts.isAsExpression(expression) ||
			ts.isTypeAssertion(expression) ||
			ts.isNonNullExpression(expression) ||
			ts.isAwaitExpression(expression) ||
			ts.isSatisfiesExpression(expression)
		) {
			addExpression(expression.expression, context);
			return;
		}
		if (ts.isArrowFunction(expression) && ts.isExpression(expression.body)) {
			addExpression(expression.body, context);
			return;
		}
		if (ts.isConditionalExpression(expression)) {
			addExpression(expression.whenTrue, context);
			addExpression(expression.whenFalse, context);
			return;
		}
		if (ts.isArrayLiteralExpression(expression)) {
			for (const element of expression.elements) {
				if (!ts.isSpreadElement(element)) addExpression(element, context);
			}
			return;
		}
		if (ts.isBinaryExpression(expression)) {
			if (expression.operatorToken.kind === ts.SyntaxKind.CommaToken) {
				addExpression(expression.right, context);
				return;
			}
			if (expression.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) {
				addExpression(expression.right, context);
				return;
			}
			if (
				expression.operatorToken.kind === ts.SyntaxKind.BarBarToken ||
				expression.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken
			) {
				addExpression(expression.left, context);
				addExpression(expression.right, context);
				return;
			}
			if (expression.operatorToken.kind === ts.SyntaxKind.PlusToken) {
				for (const hazard of syntacticRawErrorExpressions(expression, lexicalBindings)) {
					add(hazard, "raw-error-interpolation", hazard.getText(sourceFile), rawCandidateExtra(hazard));
				}
				if (expressionContainsStringSyntax(expression)) {
					add(
						expression,
						context === "jsx" ? "concatenated-prose" : scalarKind(context),
						expression.getText(sourceFile),
					);
				}
			}
			return;
		}
		const kind = scalarKind(context);
		const rawHazards = syntacticRawErrorExpressions(expression, lexicalBindings);
		for (const hazard of rawHazards) {
			add(hazard, "raw-error-interpolation", hazard.getText(sourceFile), rawCandidateExtra(hazard));
		}
		if (rawHazards.includes(unwrapExpression(expression))) return;
		if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)) {
			add(expression, kind, expression.text);
			return;
		}
		if (ts.isNumericLiteral(expression)) {
			add(expression, kind, expression.text);
			return;
		}
		if (ts.isTemplateExpression(expression)) {
			add(expression, context === "jsx" ? "template-prose" : kind, expression.getText(sourceFile));
			return;
		}
		if (ts.isCallExpression(expression) && isLocalizedCall(expression, lexicalBindings)) return;
		if (
			ts.isCallExpression(expression) &&
			isResolvedBuildTitle(expression, lexicalBindings, options.catalogMessageIds)
		) {
			return;
		}
		if (ts.isCallExpression(expression)) {
			const target = unwrapExpression(expression.expression);
			if ((ts.isArrowFunction(target) || ts.isFunctionExpression(target)) && expressionContainsJsxSyntax(target.body)) {
				return;
			}
			if (expression.arguments.some((argument) => expressionContainsJsxSyntax(argument))) {
				for (const argument of expression.arguments) {
					if (syntacticRawErrorExpressions(argument, lexicalBindings).length === 0) addExpression(argument, context);
				}
				return;
			}
		}
		if (ts.isJsxElement(expression) || ts.isJsxFragment(expression) || ts.isJsxSelfClosingElement(expression)) return;
		if (ts.isIdentifier(expression) && expression.text === "undefined") return;
		if (
			ts.isIdentifier(expression) ||
			ts.isPropertyAccessExpression(expression) ||
			ts.isElementAccessExpression(expression)
		) {
			const origins = visibleStringOrigins(expression, lexicalBindings);
			if (origins.sources.length > 0 || origins.hasUnknownAssignment) {
				for (const staticSource of origins.sources) addExpression(staticSource, context);
				if (origins.hasUnknownAssignment) {
					add(
						expression,
						context === "jsx" ? "rendered-identifier" : scalarKind(context),
						expression.getText(sourceFile),
					);
				}
				return;
			}
		}
		if (
			ts.isIdentifier(expression) ||
			ts.isPropertyAccessExpression(expression) ||
			ts.isElementAccessExpression(expression) ||
			ts.isCallExpression(expression)
		) {
			const region = candidateRegion(expression);
			if (region) {
				add(expression, "raw-error-interpolation", expression.getText(sourceFile), rawCandidateExtra(expression));
				return;
			}
			if (context !== "jsx") {
				add(expression, kind, expression.getText(sourceFile));
				return;
			}
			add(expression, "rendered-identifier", expression.getText(sourceFile));
		}
	};

	const visit = (node: Node) => {
		if (ts.isJsxText(node)) add(node, "jsx-text", node.text);
		if (ts.isJsxExpression(node) && node.expression && !ts.isJsxAttribute(node.parent)) {
			addExpression(node.expression, "jsx");
		}
		if (ts.isJsxAttribute(node)) {
			const name = propertyNameText(node.name);
			let opening: JsxOpeningLikeElement | undefined;
			for (let current: Node | undefined = node.parent; current; current = current.parent) {
				if (ts.isJsxOpeningElement(current) || ts.isJsxSelfClosingElement(current)) {
					opening = current;
					break;
				}
			}
			const canonicalRawDetail = opening !== undefined && isCanonicalLocalizedRawDetail(opening, lexicalBindings);
			if (canonicalRawDetail && name === "detail") {
				if (node.initializer && isJsxExpression(node.initializer) && node.initializer.expression) {
					addCanonicalRawDetail(
						node.initializer.expression,
						canonicalRawDetailHasApprovedLabel(opening as JsxOpeningLikeElement, options.catalogMessageIds),
					);
				} else if (node.initializer && ts.isStringLiteral(node.initializer)) {
					add(node.initializer, "raw-error-interpolation", node.initializer.text, {
						region: "raw-detail",
						rawDetailLabelled: canonicalRawDetailHasApprovedLabel(
							opening as JsxOpeningLikeElement,
							options.catalogMessageIds,
						),
					});
				}
				return;
			}
			if (canonicalRawDetail && name === "labelId") {
				if (
					node.initializer &&
					ts.isStringLiteral(node.initializer) &&
					APPROVED_RAW_DETAIL_MESSAGE_IDS.has(node.initializer.text) &&
					(options.catalogMessageIds?.has(node.initializer.text) ?? false)
				) {
					return;
				}
			}
			if (canonicalRawDetail && name === "variant") return;
			const tagName = opening !== undefined ? opening.tagName.getText(sourceFile) : "";
			const customComponent = /^[A-Z]/u.test(tagName) || tagName.includes(".");
			const excluded =
				name !== undefined &&
				(NON_DISPLAY_JSX_ATTRIBUTE_NAMES.has(name) ||
					name.startsWith("data-") ||
					name.startsWith("on") ||
					(name.startsWith("aria-") && !DISPLAY_ATTRIBUTE_NAMES.has(name)));
			if (name && node.initializer) {
				const knownDisplay = DISPLAY_ATTRIBUTE_NAMES.has(name);
				if (ts.isStringLiteral(node.initializer) && (knownDisplay || (customComponent && !excluded))) {
					add(node.initializer, "text-prop", node.initializer.text);
				} else if (isJsxExpression(node.initializer) && node.initializer.expression) {
					const expression = node.initializer.expression;
					const unknownExpressionContainsLiteral =
						expressionContainsStringSyntax(expression) ||
						syntacticRawErrorExpressions(expression, lexicalBindings).length > 0 ||
						visibleStringOrigins(expression, lexicalBindings).sources.length > 0;
					if (knownDisplay || (customComponent && !excluded && unknownExpressionContainsLiteral)) {
						addExpression(expression, "prop");
					}
				}
			}
		}
		if (ts.isPropertyAssignment(node)) {
			const name = propertyNameText(node.name);
			if (name && DISPLAY_PROPERTY_NAMES.has(name) && !isWithinStableUiErrorMapper(node, lexicalBindings)) {
				addExpression(node.initializer, "metadata");
			}
		}
		if (ts.isShorthandPropertyAssignment(node)) {
			const name = propertyNameText(node.name);
			let metadataContext = false;
			for (let current: Node | undefined = node.parent; current; current = current.parent) {
				if (ts.isPropertyAssignment(current)) {
					const ancestorName = propertyNameText(current.name);
					if (ancestorName === "head" || ancestorName === "meta" || ancestorName === "metadata") {
						metadataContext = true;
						break;
					}
				}
				if (ts.isSourceFile(current)) break;
			}
			if (metadataContext && name && DISPLAY_PROPERTY_NAMES.has(name) && ts.isIdentifier(node.name)) {
				addExpression(node.name, "metadata");
			}
		}
		if (ts.isCallExpression(node)) {
			const name = callName(node);
			if (isLocalizedCall(node, lexicalBindings)) {
				const id = localizedCallMessageId(node, lexicalBindings);
				if (id) {
					const idNode =
						node.arguments[
							localizedTranslatorKind(
								node.expression as import("typescript/unstable/ast").Identifier,
								lexicalBindings,
							) === "translate"
								? 1
								: 0
						];
					if (idNode)
						add(idNode, "localized-key", id, { catalogResolved: options.catalogMessageIds?.has(id) ?? false });
				}
			}
			if (
				name &&
				/^(?:toast\.(?:error|success|warning)|(?:(?:window|globalThis)\.)?(?:alert|confirm|prompt))$/.test(name)
			) {
				const message = node.arguments[0];
				if (message) addExpression(message, "toast");
			}
			if (
				ts.isPropertyAccessExpression(node.expression) &&
				["toLocaleDateString", "toLocaleString", "toLocaleTimeString"].includes(node.expression.name.text)
			) {
				add(node, "display-locale", node.getText(sourceFile));
			}
			if (
				ts.isPropertyAccessExpression(node.expression) &&
				node.expression.name.text === "toUpperCase" &&
				ts.isCallExpression(node.expression.expression) &&
				ts.isPropertyAccessExpression(node.expression.expression.expression) &&
				node.expression.expression.expression.name.text === "charAt"
			) {
				add(node, "status-capitalization", node.getText(sourceFile));
			}
		}
		if (SHARED_COMPATIBILITY_FILES.has(normalizedFile) && isBindingElement(node)) {
			const name = node.name && isIdentifier(node.name) ? node.name.text : undefined;
			if (name && SHARED_DEFAULT_NAMES.has(name) && node.initializer) {
				const before = collected.length;
				addExpression(node.initializer, "prop");
				for (let index = before; index < collected.length; index += 1) {
					collected[index].kind = "backward-compatible-default";
				}
			}
		}
		node.forEachChild(visit);
	};
	visit(sourceFile);

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

export function automaticClassification(candidate: PortalLanguageCandidate): LiteralClassification | undefined {
	if (candidate.kind !== "localized-key" || !candidate.catalogResolved) return undefined;
	return {
		...candidate,
		category: "localized-key",
		reason: "Exact catalog message ID resolved from the maintained bilingual catalogs.",
	};
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
		if (candidate.kind === "localized-key" && !candidate.catalogResolved) {
			errors.push(`unresolved catalog id: ${candidate.file}:${candidate.line} ${JSON.stringify(candidate.value)}`);
			continue;
		}
		const classification = manifestByKey.get(exactKey(candidate));
		if (!automaticClassification(candidate) && !classification) {
			errors.push(
				`unclassified ${candidate.kind}: ${candidate.file}:${candidate.line} occurrence ${candidate.occurrence} ${JSON.stringify(candidate.value)}`,
			);
		}
		if (
			classification?.category === "raw-evidence" &&
			candidate.kind === "rendered-identifier" &&
			/(?:error|failure|caught|detail)/i.test(candidate.value)
		) {
			errors.push(
				`raw evidence outside labelled raw-detail region: ${candidate.file}:${candidate.line} ${JSON.stringify(candidate.value)}`,
			);
		}
		if (candidate.kind === "raw-error-interpolation" && candidate.region !== "raw-detail") {
			errors.push(`raw error lacks labelled raw-detail region: ${candidate.file}:${candidate.line}`);
		}
		if (
			candidate.kind === "raw-error-interpolation" &&
			candidate.region === "raw-detail" &&
			!candidate.rawDetailLabelled
		) {
			errors.push(`raw detail lacks visible localized label: ${candidate.file}:${candidate.line}`);
		}
		if (
			candidate.kind === "raw-error-interpolation" &&
			candidate.region === "raw-detail" &&
			classification?.category !== "raw-evidence"
		) {
			errors.push(`labelled raw hazard must use raw-evidence: ${candidate.file}:${candidate.line}`);
		}
	}
	for (const entry of manifest) {
		if (!candidateKeys.has(exactKey(entry))) {
			errors.push(`stale classification: ${entry.file} occurrence ${entry.occurrence} ${JSON.stringify(entry.value)}`);
		}
	}
	return errors;
}

function walkSourceFiles(directory: string): string[] {
	return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		const absolute = path.join(directory, entry.name);
		if (entry.isDirectory()) return walkSourceFiles(absolute);
		if (!/\.tsx?$/.test(entry.name) || /\.(test|stories)\.tsx?$/.test(entry.name)) return [];
		return [absolute];
	});
}

function walkTsx(directory: string): string[] {
	return walkSourceFiles(directory).filter((file) => file.endsWith(".tsx"));
}

function collectCatalogMessageIds(repositoryRoot: string) {
	const ids = new Set<string>();
	const directory = path.join(repositoryRoot, "apps/web/src/i18n/catalogs");
	const inputs = walkSourceFiles(directory).map((file) => ({ file, source: fs.readFileSync(file, "utf8") }));
	return withParsedSources(inputs, (parsed) => {
		for (const { file } of inputs) {
			const sourceFile = requiredSourceFile(parsed, file);
			const visit = (node: Node) => {
				if (ts.isPropertyAssignment(node)) {
					const name = propertyNameText(node.name);
					if (name?.includes(".")) ids.add(name);
				}
				node.forEachChild(visit);
			};
			visit(sourceFile);
		}
		return ids;
	});
}

export function validateRouteHeadersFromSources(siteHeaderSource: string, routeSources: SourceInput[]) {
	const siteHeaderFile = "apps/web/src/components/site-header.tsx";
	const inputs = [{ file: siteHeaderFile, source: siteHeaderSource }, ...routeSources];
	return withParsedSources(inputs, (parsed) => {
		const sourceFile = requiredSourceFile(parsed, siteHeaderFile);
		const mapped = new Set<string>(["reports"]);
		const visitHeader = (node: Node) => {
			if (
				ts.isVariableDeclaration(node) &&
				ts.isIdentifier(node.name) &&
				node.name.text === "PAGE_NAME_IDS" &&
				node.initializer &&
				ts.isObjectLiteralExpression(node.initializer)
			) {
				for (const property of node.initializer.properties) {
					if (ts.isPropertyAssignment(property)) {
						const name = propertyNameText(property.name);
						if (name) mapped.add(name);
					}
				}
			}
			node.forEachChild(visitHeader);
		};
		visitHeader(sourceFile);
		const errors: string[] = [];
		for (const { file } of routeSources) {
			const routeSource = requiredSourceFile(parsed, file);
			const visitRoute = (node: Node) => {
				if (ts.isCallExpression(node) && callName(node) === "createFileRoute") {
					const argument = node.arguments[0];
					if (
						!argument ||
						(!ts.isStringLiteral(argument) && !ts.isNoSubstitutionTemplateLiteral(argument)) ||
						!argument.text.startsWith("/_authed/")
					)
						return;
					const parts = argument.text.split("/").filter(Boolean);
					const adminIndex = parts.indexOf("admin");
					const appIndex = parts.indexOf("app");
					const displayedSegments: string[] = [];
					if (adminIndex >= 0 && parts[adminIndex + 1]) displayedSegments.push(parts[adminIndex + 1]);
					if (appIndex >= 0 && parts[appIndex + 1] !== "new") {
						const pageSegment = parts[appIndex + 2];
						if (pageSegment) displayedSegments.push(pageSegment);
						if (pageSegment === "settings" && parts[appIndex + 3]) displayedSegments.push(parts[appIndex + 3]);
					}
					for (const segment of displayedSegments) {
						if (!segment.startsWith("$") && !mapped.has(segment)) {
							errors.push(`route relies on unknown header fallback: ${argument.text} (${segment})`);
						}
					}
				}
				node.forEachChild(visitRoute);
			};
			visitRoute(routeSource);
		}
		return errors;
	});
}

function routeHeaderErrors(repositoryRoot: string) {
	const siteHeaderPath = path.join(repositoryRoot, "apps/web/src/components/site-header.tsx");
	const routeFiles = walkTsx(path.join(repositoryRoot, "apps/web/src/routes"));
	return validateRouteHeadersFromSources(
		fs.readFileSync(siteHeaderPath, "utf8"),
		routeFiles.map((file) => ({ file, source: fs.readFileSync(file, "utf8") })),
	);
}

type SharedCallsiteSource = { component: string; source: string };

function hasOwnedSharedCallsite(sourceFile: SourceFile, ownerName: string, component: string, modulePattern: RegExp) {
	const lexicalBindings = collectLexicalBindings(sourceFile);
	let owner: FunctionLikeDeclaration | undefined;
	const findOwner = (node: Node) => {
		if (ts.isFunctionDeclaration(node) && node.name?.text === ownerName) owner = node;
		if (!owner) node.forEachChild(findOwner);
	};
	findOwner(sourceFile);
	if (!owner) return false;
	let found = false;
	const visit = (node: Node) => {
		if (found) return;
		if (node !== owner && ts.isFunctionLikeDeclaration(node)) return;
		if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
			if (
				ts.isIdentifier(node.tagName) &&
				importedBindingMatches(node.tagName, lexicalBindings, component, modulePattern)
			) {
				found = true;
			}
		}
		node.forEachChild(visit);
	};
	visit(owner);
	return found;
}

export function validateSharedCallsitesFromSources(sources: SharedCallsiteSource[]) {
	const requirements = [
		["AppSidebar", "Sidebar", /@workspace\/ui\/components\/sidebar$/u],
		["SiteHeader", "SidebarTrigger", /@workspace\/ui\/components\/sidebar$/u],
		["SiteHeader", "Breadcrumb", /@workspace\/ui\/components\/breadcrumb$/u],
		["LocalizedTagsInput", "TagsInput", /@workspace\/ui\/components\/tags-input$/u],
	] as const;
	return withParsedSources(
		sources.map((source, index) => ({ file: `${index}-${source.component}.tsx`, source: source.source })),
		(parsed) => {
			const errors: string[] = [];
			for (const [owner, component, modulePattern] of requirements) {
				const ownerIndex = sources.findIndex((source) => source.component === owner);
				const found =
					ownerIndex >= 0
						? hasOwnedSharedCallsite(
								requiredSourceFile(parsed, `${ownerIndex}-${owner}.tsx`),
								owner,
								component,
								modulePattern,
							)
						: false;
				if (!found) {
					errors.push(`missing owned shared component: ${owner} must render imported ${component}`);
				}
			}
			return errors;
		},
	);
}

function sharedCallsiteErrors(repositoryRoot: string) {
	return validateSharedCallsitesFromSources([
		{
			component: "AppSidebar",
			source: fs.readFileSync(path.join(repositoryRoot, "apps/web/src/components/app-sidebar.tsx"), "utf8"),
		},
		{
			component: "SiteHeader",
			source: fs.readFileSync(path.join(repositoryRoot, "apps/web/src/components/site-header.tsx"), "utf8"),
		},
		{
			component: "LocalizedTagsInput",
			source: fs.readFileSync(path.join(repositoryRoot, "apps/web/src/components/localized-tags-input.tsx"), "utf8"),
		},
	]);
}

type RawDetailMarkerSource = { file: string; source: string };

export function validateRawDetailMarkerOwnershipFromSources(sources: RawDetailMarkerSource[]) {
	const canonicalFile = "apps/web/src/components/localized-raw-detail.tsx";
	return withParsedSources(sources, (parsed) => {
		const errors: string[] = [];
		let canonicalMarkers = 0;
		for (const { file } of sources) {
			const sourceFile = requiredSourceFile(parsed, file);
			const visit = (node: Node) => {
				if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && hasTrueRawDetailAttribute(node)) {
					if (file === canonicalFile && isLocalizedRawDetailImplementation(node, file)) {
						canonicalMarkers += 1;
					} else {
						errors.push(`legacy raw-detail marker outside canonical component: ${file}`);
					}
				}
				node.forEachChild(visit);
			};
			visit(sourceFile);
		}
		if (canonicalMarkers !== 1) {
			errors.push(`canonical LocalizedRawDetail must own exactly one raw marker; found ${canonicalMarkers}`);
		}
		return errors;
	});
}

function rawDetailMarkerOwnershipErrors(repositoryRoot: string, files: string[]) {
	return validateRawDetailMarkerOwnershipFromSources(
		files.map((absolute) => ({
			file: path.relative(repositoryRoot, absolute).replaceAll("\\", "/"),
			source: fs.readFileSync(absolute, "utf8"),
		})),
	);
}

function chromeExtensionResidueErrors(repositoryRoot: string) {
	const manifestPath = path.join(repositoryRoot, "apps/browser-extension/manifest.json");
	const manifestSource = fs.readFileSync(manifestPath, "utf8");
	const manifest = JSON.parse(manifestSource) as Record<string, unknown>;
	const errors: string[] = [];
	if (Object.hasOwn(manifest, "commands"))
		errors.push("Chrome extension command residue: manifest.json still registers commands");
	for (const obsoleteCopy of ["Open Yonaris sidebar", "Toggle Yonaris sidebar"]) {
		if (manifestSource.includes(obsoleteCopy))
			errors.push(`Chrome extension command residue: ${JSON.stringify(obsoleteCopy)}`);
	}
	return errors;
}

type CollectedCrossPlanSignature = Pick<CrossPlanOwnership, "file" | "kind" | "value" | "occurrence">;
type DiscoveredCrossPlanSignature = CollectedCrossPlanSignature & {
	discoverable: boolean;
	dependencyImport?: ImportedSymbol & { importerFile: string };
	dependencyOwnerKey?: string;
	ownerKey?: string;
};

function unwrapExpression(expression: Expression): Expression {
	if (ts.isParenthesizedExpression(expression)) return unwrapExpression(expression.expression);
	if (ts.isAssertionExpression(expression)) return unwrapExpression(expression.expression);
	if (ts.isNonNullExpression(expression)) return unwrapExpression(expression.expression);
	if (ts.isSatisfiesExpression(expression)) return unwrapExpression(expression.expression);
	return expression;
}

type ImportedSymbol = { exportedName: string; module: string };

function importedExpressionSymbol(
	expression: Expression,
	bindings: LexicalBindings,
	visiting = new Set<Node>(),
): ImportedSymbol | undefined {
	const unwrapped = unwrapExpression(expression);
	if (ts.isIdentifier(unwrapped)) return importedSymbol(unwrapped, bindings, visiting);
	if (ts.isPropertyAccessExpression(unwrapped) && ts.isIdentifier(unwrapped.expression)) {
		const declaration = lexicalDeclaration(unwrapped.expression, bindings);
		if (declaration && ts.isNamespaceImport(declaration)) {
			const module = importModule(declaration);
			return module ? { exportedName: unwrapped.name.text, module } : undefined;
		}
	}
	return undefined;
}

function importedSymbol(
	identifier: import("typescript/unstable/ast").Identifier,
	bindings: LexicalBindings,
	visiting = new Set<Node>(),
): ImportedSymbol | undefined {
	const declaration = lexicalDeclaration(identifier, bindings);
	if (!declaration || visiting.has(declaration)) return undefined;
	if (ts.isImportClause(declaration)) {
		const module = importModule(declaration);
		return module ? { exportedName: "default", module } : undefined;
	}
	if (ts.isImportSpecifier(declaration)) {
		const module = importModule(declaration);
		return module ? { exportedName: declaration.propertyName?.text ?? declaration.name.text, module } : undefined;
	}
	if (ts.isNamespaceImport(declaration)) {
		const module = importModule(declaration);
		return module ? { exportedName: "*", module } : undefined;
	}
	const initializer = declarationInitializer(declaration);
	if (!initializer) return undefined;
	const unwrapped = unwrapExpression(initializer);
	visiting.add(declaration);
	const symbol = ts.isCallExpression(unwrapped)
		? unwrapped.arguments.map((argument) => importedExpressionSymbol(argument, bindings, visiting)).find(Boolean)
		: importedExpressionSymbol(unwrapped, bindings, visiting);
	visiting.delete(declaration);
	return symbol;
}

function importedCallSymbol(node: CallExpression, bindings: LexicalBindings): ImportedSymbol | undefined {
	return importedExpressionSymbol(node.expression, bindings);
}

function externalBindingName(node: Node): string | undefined {
	if (isBindingElement(node)) {
		return node.propertyName
			? propertyNameText(node.propertyName)
			: node.name && ts.isIdentifier(node.name)
				? node.name.text
				: undefined;
	}
	if (ts.isParameterDeclaration(node) && ts.isIdentifier(node.name)) return node.name.text;
	return undefined;
}

type ParsedCrossPlanSource = { file: string; sourceFile: SourceFile };

type ComponentOwner = {
	declaration: Node;
	file: string;
	key: string;
	name: string;
	functions: FunctionLikeDeclaration[];
};

type LocalComponentEdge = {
	from: string;
	imported?: ImportedSymbol;
	to?: string;
	node: JsxOpeningLikeElement;
	carriesOutputLanguage: boolean;
};

type OutputComponentGraph = {
	componentDependencies: ReadonlyMap<JsxOpeningLikeElement, { imported?: ImportedSymbol; ownerKey?: string }>;
	connectedFunctions: ReadonlySet<FunctionLikeDeclaration>;
	outputComponentNodes: ReadonlySet<JsxOpeningLikeElement>;
	missingOutputLanguageHandoffs: readonly string[];
};

function normalizedModulePath(value: string) {
	return path.posix.normalize(value.replaceAll("\\", "/"));
}

function isLocalWebModule(module: string) {
	return module.startsWith("./") || module.startsWith("../") || module.startsWith("@/");
}

function resolveLocalModuleFile(importer: string, module: string, knownFiles: ReadonlySet<string>) {
	if (!isLocalWebModule(module)) return undefined;
	const base = module.startsWith("@/")
		? `apps/web/src/${module.slice(2)}`
		: path.posix.join(path.posix.dirname(importer), module);
	const normalized = normalizedModulePath(base);
	for (const candidate of [
		normalized,
		`${normalized}.tsx`,
		`${normalized}.ts`,
		`${normalized}/index.tsx`,
		`${normalized}/index.ts`,
	]) {
		if (knownFiles.has(candidate)) return candidate;
	}
	return undefined;
}

function namedFunctionOwnerDeclaration(node: FunctionLikeDeclaration): Node | undefined {
	if (ts.isFunctionDeclaration(node) && (node.name || /^\s*export\s+default\b/u.test(node.getText()))) return node;
	let current: Node = node;
	for (let parent = current.parent; parent; parent = parent.parent) {
		if (ts.isVariableDeclaration(parent) && parent.name && ts.isIdentifier(parent.name)) return parent;
		if (ts.isExportAssignment(parent)) return parent;
		if (ts.isFunctionLikeDeclaration(parent) || ts.isBlock(parent) || ts.isSourceFile(parent)) break;
		current = parent;
	}
	return ts.isFunctionExpression(node) && node.name ? node : undefined;
}

function ownerDeclarationName(node: Node): string | undefined {
	if (ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node)) {
		return node.name?.text ?? (/^\s*export\s+default\b/u.test(node.getText()) ? "default" : undefined);
	}
	if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) return node.name.text;
	if (ts.isExportAssignment(node)) return "default";
	return undefined;
}

function jsxCarriesOutputLanguage(node: JsxOpeningLikeElement) {
	return node.attributes.properties.some(
		(attribute) =>
			ts.isJsxAttribute(attribute) &&
			["outputLanguage", "outputLanguageResolved", "onOutputLanguageChange"].includes(
				propertyNameText(attribute.name) ?? "",
			),
	);
}

function jsxHasExplicitOutputLanguage(node: JsxOpeningLikeElement) {
	return node.attributes.properties.some(
		(attribute) => ts.isJsxAttribute(attribute) && propertyNameText(attribute.name) === "outputLanguage",
	);
}

function functionDeclaresNamedParameter(node: FunctionLikeDeclaration, expectedName: string) {
	let found = false;
	const collect = (name: Node) => {
		if (found) return;
		if (ts.isIdentifier(name)) {
			found = name.text === expectedName;
			return;
		}
		if (!ts.isObjectBindingPattern(name) && !ts.isArrayBindingPattern(name)) return;
		for (const element of name.elements) {
			if (!isBindingElement(element)) continue;
			if (externalBindingName(element) === expectedName) {
				found = true;
				return;
			}
			if (element.name) collect(element.name);
		}
	};
	for (const parameter of node.parameters) collect(parameter.name);
	return found;
}

type OutputTypeSource = {
	bindings: LexicalBindings;
	file: string;
	sourceFile: SourceFile;
};

type OutputTypeContext = {
	knownFiles: ReadonlySet<string>;
	sourceByFile: ReadonlyMap<string, OutputTypeSource>;
};

type ResolvedOutputType = OutputTypeSource & { node: Node };

function resolveExportedOutputType(
	file: string | undefined,
	exportedName: string,
	context: OutputTypeContext,
	visiting = new Set<string>(),
): ResolvedOutputType | undefined {
	if (!file) return undefined;
	const key = `${file}\0${exportedName}`;
	if (visiting.has(key)) return undefined;
	const source = context.sourceByFile.get(file);
	if (!source) return undefined;
	visiting.add(key);
	try {
		for (const statement of source.sourceFile.statements) {
			if (
				(ts.isInterfaceDeclaration(statement) || ts.isTypeAliasDeclaration(statement)) &&
				statement.name.text === exportedName &&
				/^\s*export\b/u.test(statement.getText(source.sourceFile))
			) {
				return { ...source, node: statement };
			}
			if (!ts.isExportDeclaration(statement)) continue;
			const module =
				statement.moduleSpecifier && ts.isStringLiteral(statement.moduleSpecifier)
					? statement.moduleSpecifier.text
					: undefined;
			const targetFile = module ? resolveLocalModuleFile(file, module, context.knownFiles) : undefined;
			if (!statement.exportClause) {
				const resolved = resolveExportedOutputType(targetFile, exportedName, context, visiting);
				if (resolved) return resolved;
				continue;
			}
			if (!ts.isNamedExports(statement.exportClause)) continue;
			for (const specifier of statement.exportClause.elements) {
				if (specifier.name.text !== exportedName) continue;
				const sourceName = specifier.propertyName?.text ?? specifier.name.text;
				if (targetFile) {
					const resolved = resolveExportedOutputType(targetFile, sourceName, context, visiting);
					if (resolved) return resolved;
					continue;
				}
				const local = source.bindings.declarations
					.get(sourceName)
					?.find((node) => ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node));
				if (local) return { ...source, node: local };
			}
		}
		return undefined;
	} finally {
		visiting.delete(key);
	}
}

function typeRequiresOutputLanguage(
	typeNode: Node | undefined,
	source: OutputTypeSource,
	context: OutputTypeContext,
	visiting = new Set<string>(),
): boolean {
	if (!typeNode) return false;
	const visitKey = `${source.file}\0${typeNode.kind}\0${typeNode.pos}\0${typeNode.end}`;
	if (visiting.has(visitKey)) return false;
	visiting.add(visitKey);
	if (ts.isTypeLiteralNode(typeNode) || ts.isInterfaceDeclaration(typeNode)) {
		const requiredMember = typeNode.members.some(
			(member) =>
				ts.isPropertySignatureDeclaration(member) &&
				propertyNameText(member.name) === "outputLanguage" &&
				!member
					.getText()
					.slice(0, Math.max(0, member.getText().indexOf(":")))
					.includes("?"),
		);
		const inherited = ts.isInterfaceDeclaration(typeNode)
			? (typeNode.heritageClauses ?? []).some((clause) =>
					clause.types.some((heritage) => typeRequiresOutputLanguage(heritage, source, context, visiting)),
				)
			: false;
		visiting.delete(visitKey);
		return requiredMember || inherited;
	}
	if (ts.isTypeAliasDeclaration(typeNode)) {
		const required = typeRequiresOutputLanguage(typeNode.type, source, context, visiting);
		visiting.delete(visitKey);
		return required;
	}
	if (ts.isImportClause(typeNode) || ts.isImportSpecifier(typeNode)) {
		const module = importModule(typeNode);
		const targetFile = module ? resolveLocalModuleFile(source.file, module, context.knownFiles) : undefined;
		const exportedName = ts.isImportClause(typeNode) ? "default" : (typeNode.propertyName?.text ?? typeNode.name.text);
		const resolved = resolveExportedOutputType(targetFile, exportedName, context);
		const required = resolved ? typeRequiresOutputLanguage(resolved.node, resolved, context, visiting) : false;
		visiting.delete(visitKey);
		return required;
	}
	if (ts.isIdentifier(typeNode)) {
		const required = typeRequiresOutputLanguage(
			lexicalDeclaration(typeNode, source.bindings),
			source,
			context,
			visiting,
		);
		visiting.delete(visitKey);
		return required;
	}
	if (ts.isTypeReferenceNode(typeNode)) {
		const declaration = ts.isIdentifier(typeNode.typeName)
			? lexicalDeclaration(typeNode.typeName, source.bindings)
			: undefined;
		const required =
			typeRequiresOutputLanguage(declaration, source, context, visiting) ||
			(typeNode.typeArguments ?? []).some((argument) =>
				typeRequiresOutputLanguage(argument, source, context, visiting),
			);
		visiting.delete(visitKey);
		return required;
	}
	if (ts.isExpressionWithTypeArguments(typeNode)) {
		const required =
			typeRequiresOutputLanguage(typeNode.expression, source, context, visiting) ||
			(typeNode.typeArguments ?? []).some((argument) =>
				typeRequiresOutputLanguage(argument, source, context, visiting),
			);
		visiting.delete(visitKey);
		return required;
	}
	if (ts.isIntersectionTypeNode(typeNode) || ts.isUnionTypeNode(typeNode)) {
		const required = typeNode.types.some((part) => typeRequiresOutputLanguage(part, source, context, visiting));
		visiting.delete(visitKey);
		return required;
	}
	if (ts.isParenthesizedTypeNode(typeNode)) {
		const required = typeRequiresOutputLanguage(typeNode.type, source, context, visiting);
		visiting.delete(visitKey);
		return required;
	}
	visiting.delete(visitKey);
	return false;
}

function functionRequiresOutputLanguage(
	node: FunctionLikeDeclaration,
	owner: ComponentOwner,
	source: OutputTypeSource,
	context: OutputTypeContext,
) {
	if (
		node.parameters.some((parameter) => {
			if (
				ts.isIdentifier(parameter.name) &&
				parameter.name.text === "outputLanguage" &&
				parameter.questionToken === undefined &&
				parameter.initializer === undefined
			) {
				return true;
			}
			return typeRequiresOutputLanguage(parameter.type, source, context);
		})
	) {
		return true;
	}
	if (
		ts.isVariableDeclaration(owner.declaration) &&
		typeRequiresOutputLanguage(owner.declaration.type, source, context)
	) {
		return true;
	}
	for (
		let current: Node | undefined = node.parent;
		current && current !== owner.declaration.parent;
		current = current.parent
	) {
		if (
			ts.isCallExpression(current) &&
			(current.typeArguments ?? []).some((argument) => typeRequiresOutputLanguage(argument, source, context))
		) {
			return true;
		}
		if (current === owner.declaration) break;
	}
	return false;
}

function buildOutputComponentGraph(
	discoverySources: ParsedCrossPlanSource[],
	symbolSources: ParsedCrossPlanSource[] = discoverySources,
): OutputComponentGraph {
	const normalizedDiscoverySources = discoverySources.map(({ file, sourceFile }) => ({
		file: normalizedModulePath(file),
		sourceFile,
		bindings: collectLexicalBindings(sourceFile),
	}));
	const normalizedSymbolSources = symbolSources.map(({ file, sourceFile }) => ({
		file: normalizedModulePath(file),
		sourceFile,
		bindings: collectLexicalBindings(sourceFile),
	}));
	const knownFiles = new Set(normalizedSymbolSources.map(({ file }) => file));
	const sourceByFile = new Map(normalizedSymbolSources.map((source) => [source.file, source]));
	const owners = new Map<string, ComponentOwner>();
	const ownerByFunction = new Map<FunctionLikeDeclaration, string>();
	const ownerByDeclaration = new Map<Node, string>();
	const ownerByFileAndName = new Map<string, Map<string, string>>();

	for (const { file, sourceFile } of normalizedSymbolSources) {
		const visit = (node: Node) => {
			if (ts.isFunctionLikeDeclaration(node)) {
				const declaration = namedFunctionOwnerDeclaration(node);
				const name = declaration ? ownerDeclarationName(declaration) : undefined;
				if (declaration && name) {
					const key = `${file}\0${declaration.pos}\0${name}`;
					const owner = owners.get(key) ?? { declaration, file, key, name, functions: [] };
					if (!owner.functions.includes(node)) owner.functions.push(node);
					owners.set(key, owner);
					ownerByFunction.set(node, key);
					ownerByDeclaration.set(declaration, key);
					const names = ownerByFileAndName.get(file) ?? new Map<string, string>();
					names.set(name, key);
					ownerByFileAndName.set(file, names);
				}
			}
			node.forEachChild(visit);
		};
		visit(sourceFile);
	}
	const outputTypeContext: OutputTypeContext = { knownFiles, sourceByFile };
	const requiredOutputLanguageOwners = new Set<string>();
	for (const owner of owners.values()) {
		const source = sourceByFile.get(owner.file);
		if (source && owner.functions.some((fn) => functionRequiresOutputLanguage(fn, owner, source, outputTypeContext))) {
			requiredOutputLanguageOwners.add(owner.key);
		}
	}

	const enclosingOwner = (node: Node): string | undefined => {
		for (let current: Node | undefined = node.parent; current; current = current.parent) {
			if (ts.isFunctionLikeDeclaration(current)) {
				const owner = ownerByFunction.get(current);
				if (owner) return owner;
			}
		}
		return undefined;
	};

	const declarationTarget = (
		declaration: Node | undefined,
		file: string,
		bindings: LexicalBindings,
		visiting = new Set<Node>(),
		visitingExports = new Set<string>(),
	): string | undefined => {
		if (!declaration || visiting.has(declaration)) return undefined;
		const direct = ownerByDeclaration.get(declaration);
		if (direct) return direct;
		visiting.add(declaration);
		if (ts.isImportClause(declaration) || ts.isImportSpecifier(declaration)) {
			const module = importModule(declaration);
			const targetFile = module ? resolveLocalModuleFile(file, module, knownFiles) : undefined;
			const exportedName = ts.isImportClause(declaration)
				? "default"
				: (declaration.propertyName?.text ?? declaration.name.text);
			const target = resolveExportedOwner(targetFile, exportedName, visitingExports);
			visiting.delete(declaration);
			return target;
		}
		const initializer = declarationInitializer(declaration);
		if (initializer) {
			const unwrapped = unwrapExpression(initializer);
			const imported = importedExpressionSymbol(unwrapped, bindings);
			if (imported && isLocalWebModule(imported.module)) {
				const target = resolveExportedOwner(
					resolveLocalModuleFile(file, imported.module, knownFiles),
					imported.exportedName,
					visitingExports,
				);
				visiting.delete(declaration);
				return target;
			}
			if (ts.isIdentifier(unwrapped)) {
				const target = declarationTarget(
					lexicalDeclaration(unwrapped, bindings),
					file,
					bindings,
					visiting,
					visitingExports,
				);
				visiting.delete(declaration);
				return target;
			}
			if (ts.isCallExpression(unwrapped)) {
				for (const argument of unwrapped.arguments) {
					const importedArgument = importedExpressionSymbol(argument, bindings);
					if (importedArgument && isLocalWebModule(importedArgument.module)) {
						const target = resolveExportedOwner(
							resolveLocalModuleFile(file, importedArgument.module, knownFiles),
							importedArgument.exportedName,
							visitingExports,
						);
						if (target) {
							visiting.delete(declaration);
							return target;
						}
					}
					if (!ts.isIdentifier(argument)) continue;
					const target = declarationTarget(
						lexicalDeclaration(argument, bindings),
						file,
						bindings,
						visiting,
						visitingExports,
					);
					if (target) {
						visiting.delete(declaration);
						return target;
					}
				}
			}
		}
		visiting.delete(declaration);
		return undefined;
	};

	const resolveExportedOwner = (
		file: string | undefined,
		exportedName: string,
		visiting = new Set<string>(),
	): string | undefined => {
		if (!file) return undefined;
		const exportKey = `${file}\0${exportedName}`;
		if (visiting.has(exportKey)) return undefined;
		const source = sourceByFile.get(file);
		if (!source) return undefined;
		visiting.add(exportKey);
		try {
			for (const statement of source.sourceFile.statements) {
				const statementOwner = ownerByDeclaration.get(statement);
				const statementText = statement.getText(source.sourceFile);
				if (
					statementOwner &&
					(/^\s*export\s+default\b/u.test(statementText)
						? exportedName === "default"
						: /^\s*export\b/u.test(statementText) && ownerDeclarationName(statement) === exportedName)
				) {
					return statementOwner;
				}
				if (ts.isVariableStatement(statement) && /^\s*export\b/u.test(statementText)) {
					for (const declaration of statement.declarationList.declarations) {
						if (!ts.isIdentifier(declaration.name) || declaration.name.text !== exportedName) continue;
						const target =
							ownerByDeclaration.get(declaration) ??
							declarationTarget(declaration, file, source.bindings, new Set(), visiting);
						if (target) return target;
					}
				}
				if (ts.isExportAssignment(statement) && exportedName === "default") {
					const direct = ownerByDeclaration.get(statement);
					if (direct) return direct;
					const expression = unwrapExpression(statement.expression);
					if (ts.isIdentifier(expression)) {
						const target = declarationTarget(
							lexicalDeclaration(expression, source.bindings),
							file,
							source.bindings,
							new Set(),
							visiting,
						);
						if (target) return target;
					}
					if (ts.isCallExpression(expression)) {
						for (const argument of expression.arguments) {
							if (!ts.isIdentifier(argument)) continue;
							const target = declarationTarget(
								lexicalDeclaration(argument, source.bindings),
								file,
								source.bindings,
								new Set(),
								visiting,
							);
							if (target) return target;
						}
					}
				}
				if (!ts.isExportDeclaration(statement)) continue;
				const module =
					statement.moduleSpecifier && ts.isStringLiteral(statement.moduleSpecifier)
						? statement.moduleSpecifier.text
						: undefined;
				const targetFile = module ? resolveLocalModuleFile(file, module, knownFiles) : undefined;
				if (!statement.exportClause) {
					const target = resolveExportedOwner(targetFile, exportedName, visiting);
					if (target) return target;
					continue;
				}
				if (!ts.isNamedExports(statement.exportClause)) continue;
				for (const specifier of statement.exportClause.elements) {
					if (specifier.name.text !== exportedName) continue;
					const sourceName = specifier.propertyName?.text ?? specifier.name.text;
					if (targetFile) {
						const target = resolveExportedOwner(targetFile, sourceName, visiting);
						if (target) return target;
						continue;
					}
					const direct = ownerByFileAndName.get(file)?.get(sourceName);
					if (direct) return direct;
					const declaration = source.bindings.declarations.get(sourceName)?.[0];
					const target = declarationTarget(declaration, file, source.bindings, new Set(), visiting);
					if (target) return target;
				}
			}
			return undefined;
		} finally {
			visiting.delete(exportKey);
		}
	};

	const localComponentTarget = (
		node: JsxOpeningLikeElement,
		file: string,
		bindings: LexicalBindings,
	): { imported?: ImportedSymbol; local: boolean; target?: string } => {
		if (ts.isIdentifier(node.tagName) && !/^\p{Lu}/u.test(node.tagName.text)) return { local: false };
		const symbol = importedExpressionSymbol(node.tagName as Expression, bindings);
		if (symbol) {
			if (!isLocalWebModule(symbol.module)) return { local: false };
			const targetFile = resolveLocalModuleFile(file, symbol.module, knownFiles);
			return {
				imported: symbol,
				local: true,
				target: resolveExportedOwner(targetFile, symbol.exportedName),
			};
		}
		if (ts.isIdentifier(node.tagName)) {
			const declaration = lexicalDeclaration(node.tagName, bindings);
			const module = declaration ? importModule(declaration) : undefined;
			if (module && !isLocalWebModule(module)) return { local: false };
			const target = declarationTarget(declaration, file, bindings);
			if (target) return { local: true, target };
			if (module && isLocalWebModule(module)) return { local: true };
			return { local: declaration === undefined };
		}
		return { local: false };
	};

	const edges: LocalComponentEdge[] = [];
	const fullRoots = new Set<string>();
	const selectiveRoots = new Set<string>();
	const selectionRoots = new Set<string>();
	for (const { file, sourceFile, bindings } of normalizedDiscoverySources) {
		for (const owner of owners.values()) {
			if (owner.file !== file) continue;
			for (const fn of owner.functions) {
				if (functionDeclaresNamedParameter(fn, "exportLanguageSurface")) selectiveRoots.add(owner.key);
				if (
					semanticOutputLanguageParameterDeclarations(fn).length > 0 ||
					semanticFunctionUsesOutputLanguageMember(fn, bindings)
				) {
					fullRoots.add(owner.key);
				}
			}
		}
		const visit = (node: Node) => {
			const owner = enclosingOwner(node);
			if (owner && ts.isCallExpression(node)) {
				if (semanticIsImportedArtifactLanguageProducer(node, bindings)) selectionRoots.add(owner);
				if (semanticIsImportedChartExport(node, bindings) || semanticIsImportedOutputProducer(node, bindings)) {
					fullRoots.add(owner);
				}
			}
			if (owner && (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node))) {
				if (jsxCarriesOutputLanguage(node)) selectiveRoots.add(owner);
				if (
					node.attributes.properties.some((attribute) => {
						if (!ts.isJsxAttribute(attribute)) return false;
						const name = propertyNameText(attribute.name);
						if (name === "data-output-language") return true;
						return name === "lang" && /outputLanguage/iu.test(attribute.initializer?.getText() ?? "");
					})
				) {
					fullRoots.add(owner);
				}
				if (
					node.attributes.properties.some(
						(attribute) => ts.isJsxAttribute(attribute) && propertyNameText(attribute.name) === "exportLanguageSurface",
					)
				) {
					selectiveRoots.add(owner);
				}
				const target = localComponentTarget(node, file, bindings);
				if (target.local) {
					edges.push({
						from: owner,
						imported: target.imported,
						to: target.target,
						node,
						carriesOutputLanguage: jsxCarriesOutputLanguage(node),
					});
				}
			}
			node.forEachChild(visit);
		};
		visit(sourceFile);
	}

	const outgoing = new Map<string, LocalComponentEdge[]>();
	const incoming = new Map<string, LocalComponentEdge[]>();
	for (const edge of edges) {
		outgoing.set(edge.from, [...(outgoing.get(edge.from) ?? []), edge]);
		if (edge.to) incoming.set(edge.to, [...(incoming.get(edge.to) ?? []), edge]);
	}
	const outputComponentNodes = new Set<JsxOpeningLikeElement>();
	const componentDependencies = new Map<JsxOpeningLikeElement, { imported?: ImportedSymbol; ownerKey?: string }>();
	for (const edge of edges) {
		componentDependencies.set(edge.node, { imported: edge.imported, ownerKey: edge.to });
	}
	const semanticOwnerKeys = new Set([
		...fullRoots,
		...selectiveRoots,
		...selectionRoots,
		...requiredOutputLanguageOwners,
	]);
	const reachableFromSemantic = new Set(semanticOwnerKeys);
	const forwardQueue = [...semanticOwnerKeys];
	for (let index = 0; index < forwardQueue.length; index += 1) {
		const owner = forwardQueue[index];
		if (!owner) continue;
		for (const edge of outgoing.get(owner) ?? []) {
			if (!edge.to || reachableFromSemantic.has(edge.to)) continue;
			reachableFromSemantic.add(edge.to);
			forwardQueue.push(edge.to);
		}
	}
	const canReachSemantic = new Set(semanticOwnerKeys);
	const reverseQueue = [...semanticOwnerKeys];
	for (let index = 0; index < reverseQueue.length; index += 1) {
		const owner = reverseQueue[index];
		if (!owner) continue;
		for (const edge of incoming.get(owner) ?? []) {
			if (canReachSemantic.has(edge.from)) continue;
			canReachSemantic.add(edge.from);
			reverseQueue.push(edge.from);
		}
	}
	const connectedOwnerKeys = new Set(semanticOwnerKeys);
	for (const edge of edges) {
		const targetsRequiredOwner = edge.to ? requiredOutputLanguageOwners.has(edge.to) : false;
		const connectsSemanticOwners = edge.to
			? reachableFromSemantic.has(edge.from) && canReachSemantic.has(edge.to)
			: false;
		const unresolvedSemanticChild = !edge.to && semanticOwnerKeys.has(edge.from);
		if (!edge.carriesOutputLanguage && !targetsRequiredOwner && !connectsSemanticOwners && !unresolvedSemanticChild) {
			continue;
		}
		outputComponentNodes.add(edge.node);
		connectedOwnerKeys.add(edge.from);
		if (edge.to) connectedOwnerKeys.add(edge.to);
	}
	const connectedFunctions = new Set<FunctionLikeDeclaration>();
	for (const key of connectedOwnerKeys) {
		const owner = owners.get(key);
		if (!owner) continue;
		for (const fn of owner.functions) connectedFunctions.add(fn);
	}
	const missingOutputLanguageHandoffs = edges.flatMap((edge) => {
		if (
			!edge.to ||
			!requiredOutputLanguageOwners.has(edge.to) ||
			selectionRoots.has(edge.to) ||
			jsxHasExplicitOutputLanguage(edge.node)
		) {
			return [];
		}
		const parent = owners.get(edge.from);
		return parent
			? [`missing outputLanguage propagation: ${parent.file} ${parent.name} -> ${edge.node.tagName.getText()}`]
			: [];
	});
	return { componentDependencies, connectedFunctions, outputComponentNodes, missingOutputLanguageHandoffs };
}

function semanticIsImportedChartExport(node: CallExpression, bindings: LexicalBindings) {
	const symbol = importedCallSymbol(node, bindings);
	return symbol?.exportedName === "useChartExport";
}

function semanticIsImportedArtifactLanguageSelection(node: CallExpression, bindings: LexicalBindings) {
	return importedCallSymbol(node, bindings)?.exportedName === "useArtifactLanguageSelection";
}

function semanticIsImportedArtifactLanguageProducer(node: CallExpression, bindings: LexicalBindings) {
	const exportedName = importedCallSymbol(node, bindings)?.exportedName;
	return exportedName === "useArtifactLanguageSelection" || exportedName === "resolveArtifactLanguageSelection";
}

function semanticIsImportedOutputProducer(node: CallExpression, bindings: LexicalBindings) {
	const symbol = importedCallSymbol(node, bindings);
	if (!symbol) return false;
	return symbol.exportedName === "getReportCopy" || symbol.exportedName === "useOutputI18n";
}

function semanticOutputLanguageParameterDeclarations(node: FunctionLikeDeclaration): Node[] {
	const values: Node[] = [];
	const collect = (name: Node) => {
		if (!ts.isObjectBindingPattern(name) && !ts.isArrayBindingPattern(name)) return;
		for (const element of name.elements) {
			if (!isBindingElement(element)) continue;
			if (externalBindingName(element) === "outputLanguage") values.push(element);
			if (element.name) collect(element.name);
		}
	};
	for (const parameter of node.parameters) {
		if (ts.isIdentifier(parameter.name) && parameter.name.text === "outputLanguage") values.push(parameter);
		else collect(parameter.name);
	}
	return values;
}

function semanticFunctionUsesOutputLanguageMember(node: FunctionLikeDeclaration, bindings: LexicalBindings) {
	if (!node.body) return false;
	const parameterDeclarations = new Set<Node>();
	for (const parameter of node.parameters) {
		if (ts.isIdentifier(parameter.name)) parameterDeclarations.add(parameter);
	}
	let found = false;
	const visit = (child: Node) => {
		if (found) return;
		if (
			ts.isPropertyAccessExpression(child) &&
			child.name.text === "outputLanguage" &&
			ts.isIdentifier(child.expression) &&
			parameterDeclarations.has(lexicalDeclaration(child.expression, bindings) as Node)
		) {
			found = true;
			return;
		}
		child.forEachChild(visit);
	};
	visit(node.body);
	return found;
}

function functionDisplayName(node: FunctionLikeDeclaration, sourceFile: SourceFile) {
	if ("name" in node && node.name && ts.isIdentifier(node.name)) return node.name.text;
	if (ts.isVariableDeclaration(node.parent) && ts.isIdentifier(node.parent.name)) return node.parent.name.text;
	return node.getText(sourceFile).slice(0, 40);
}

function nodeUsesConnectedOutputFunction(node: Node, graph: OutputComponentGraph) {
	for (let current: Node | undefined = node; current; current = current.parent) {
		if (ts.isFunctionLikeDeclaration(current) && graph.connectedFunctions.has(current)) return true;
	}
	return false;
}

function collectCrossPlanSignatures(
	file: string,
	sourceFile: SourceFile,
	graph: OutputComponentGraph,
): DiscoveredCrossPlanSignature[] {
	const bindings = collectLexicalBindings(sourceFile);
	const values: Array<Omit<DiscoveredCrossPlanSignature, "occurrence">> = [];
	const add = (
		node: Node,
		kind: CrossPlanSignatureKind,
		value: string,
		discoverable: boolean,
		dependencyOwnerKey?: string,
		dependencyImport?: ImportedSymbol,
	) => {
		let ownerDeclaration: Node | undefined;
		for (let current: Node | undefined = node; current; current = current.parent) {
			if (!ts.isFunctionLikeDeclaration(current)) continue;
			ownerDeclaration = namedFunctionOwnerDeclaration(current);
			if (ownerDeclaration) break;
		}
		const ownerName = ownerDeclaration ? ownerDeclarationName(ownerDeclaration) : undefined;
		values.push({
			file,
			kind,
			value,
			discoverable,
			dependencyImport: dependencyImport ? { ...dependencyImport, importerFile: file } : undefined,
			dependencyOwnerKey,
			ownerKey:
				ownerDeclaration && ownerName
					? `${normalizedModulePath(file)}\0${ownerDeclaration.pos}\0${ownerName}`
					: undefined,
		});
	};
	const visit = (node: Node) => {
		if (ts.isFunctionLikeDeclaration(node)) {
			const outputParameters = semanticOutputLanguageParameterDeclarations(node);
			if (outputParameters.length > 0 || semanticFunctionUsesOutputLanguageMember(node, bindings)) {
				add(node, "output-language-binding", functionDisplayName(node, sourceFile), true);
			}
		}
		if (ts.isCallExpression(node)) {
			const name = callName(node);
			if (
				ts.isIdentifier(node.expression) &&
				importedBindingMatches(node.expression, bindings, "useI18n", /(?:^|\/)i18n\/provider$/u) &&
				nodeUsesConnectedOutputFunction(node, graph)
			) {
				add(node, "ambient-ui-language", "useI18n", true, undefined, importedCallSymbol(node, bindings));
			}
			const chartExportCall = semanticIsImportedChartExport(node, bindings);
			if (chartExportCall || name === "useChartExport") {
				add(node, "output-hook", "useChartExport", true, undefined, importedCallSymbol(node, bindings));
			}
			if (semanticIsImportedArtifactLanguageSelection(node, bindings)) {
				add(node, "output-hook", "useArtifactLanguageSelection", true, undefined, importedCallSymbol(node, bindings));
			}
			if (semanticIsImportedOutputProducer(node, bindings)) {
				const imported = importedCallSymbol(node, bindings);
				add(node, "output-copy", imported?.exportedName ?? name ?? "output-copy", true, undefined, imported);
			}
		}
		if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
			const name = node.tagName.getText(sourceFile);
			if (graph.outputComponentNodes.has(node)) {
				const dependency = graph.componentDependencies.get(node);
				add(node, "output-component", name, true, dependency?.ownerKey, dependency?.imported);
			}
		}
		node.forEachChild(visit);
	};
	visit(sourceFile);
	const occurrences = new Map<string, number>();
	return values.map((value) => {
		const key = `${value.file}\0${value.kind}\0${value.value}`;
		const occurrence = (occurrences.get(key) ?? 0) + 1;
		occurrences.set(key, occurrence);
		return { ...value, occurrence };
	});
}

function crossPlanSignatureKey(entry: CollectedCrossPlanSignature) {
	return `${entry.file}\0${entry.kind}\0${entry.value}\0${entry.occurrence}`;
}

const ALLOWED_RUNTIME_TEST_SUFFIX = /\.(?:test|spec)\.tsx?$/u;

function runtimeTestPathSyntaxError(runtimeTest: string): string | undefined {
	if (!runtimeTest.trim()) return "must not be empty";
	if (runtimeTest !== runtimeTest.trim()) return "must be normalized";
	if (runtimeTest.includes("\\")) return "must use POSIX separators";
	if (path.posix.isAbsolute(runtimeTest) || path.win32.isAbsolute(runtimeTest)) return "must be repo-relative";
	if (/[*?{}[\]]/u.test(runtimeTest)) return "must not contain glob syntax";
	const segments = runtimeTest.split("/");
	if (segments.includes(".") || segments.includes("..")) return "must not contain . or .. segments";
	if (segments.includes("") || path.posix.normalize(runtimeTest) !== runtimeTest) return "must be normalized";
	if (!ALLOWED_RUNTIME_TEST_SUFFIX.test(runtimeTest)) return "must use an allowed test suffix";
	return undefined;
}

export function collectExistingRuntimeTests(repositoryRoot: string, runtimeTests: Iterable<string>) {
	const root = path.resolve(repositoryRoot);
	const knownRuntimeTests = new Set<string>();
	for (const runtimeTest of new Set(runtimeTests)) {
		if (runtimeTestPathSyntaxError(runtimeTest)) continue;
		const absolute = path.resolve(root, ...runtimeTest.split("/"));
		if (!absolute.startsWith(`${root}${path.sep}`)) continue;
		try {
			if (fs.lstatSync(absolute).isFile()) knownRuntimeTests.add(runtimeTest);
		} catch {
			// Missing and inaccessible paths stay absent so the registry validation fails closed.
		}
	}
	return knownRuntimeTests;
}

type VitestProjectPatterns = { name: string; include: string[]; exclude: string[] };

function objectPropertyInitializer(node: Node, name: string): Node | undefined {
	if (!ts.isObjectLiteralExpression(node)) return undefined;
	for (const property of node.properties) {
		if (ts.isPropertyAssignment(property) && propertyNameText(property.name) === name) return property.initializer;
	}
	return undefined;
}

function stringArrayValues(node: Node | undefined) {
	if (!node || !ts.isArrayLiteralExpression(node)) return [];
	return node.elements.flatMap((element) => (ts.isStringLiteral(element) ? [element.text] : []));
}

function collectVitestProjectPatterns(sourceFile: SourceFile): VitestProjectPatterns[] {
	const defaultExport = sourceFile.statements.find(ts.isExportAssignment);
	if (!defaultExport || defaultExport.isExportEquals) return [];
	const expression = unwrapExpression(defaultExport.expression);
	if (!ts.isCallExpression(expression)) return [];
	const configFactory = importedExpressionSymbol(expression.expression, collectLexicalBindings(sourceFile));
	if (configFactory?.module !== "vitest/config" || configFactory.exportedName !== "defineConfig") return [];
	const config = expression.arguments[0];
	if (!config || !ts.isObjectLiteralExpression(config)) return [];
	const test = objectPropertyInitializer(config, "test");
	const projects = test ? objectPropertyInitializer(test, "projects") : undefined;
	if (!projects || !ts.isArrayLiteralExpression(projects)) return [];
	return projects.elements.flatMap((project) => {
		if (!ts.isObjectLiteralExpression(project)) return [];
		const projectTest = objectPropertyInitializer(project, "test");
		if (!projectTest) return [];
		const name = objectPropertyInitializer(projectTest, "name");
		const include = stringArrayValues(objectPropertyInitializer(projectTest, "include"));
		if (!name || !ts.isStringLiteral(name) || include.length === 0) return [];
		return [
			{
				name: name.text,
				include,
				exclude: stringArrayValues(objectPropertyInitializer(projectTest, "exclude")),
			},
		];
	});
}

function globPatternMatches(pattern: string, file: string) {
	let expression = "^";
	for (let index = 0; index < pattern.length; index += 1) {
		const character = pattern[index];
		if (character === "*" && pattern[index + 1] === "*" && pattern[index + 2] === "/") {
			expression += "(?:.*/)?";
			index += 2;
			continue;
		}
		if (character === "*" && pattern[index + 1] === "*") {
			expression += ".*";
			index += 1;
			continue;
		}
		if (character === "*") {
			expression += "[^/]*";
			continue;
		}
		if (character === "?") {
			expression += "[^/]";
			continue;
		}
		expression += /[\\^$.*+?()[\]{}|]/u.test(character ?? "") ? `\\${character}` : character;
	}
	return new RegExp(`${expression}$`, "u").test(file);
}

type RuntimeDeclaration = {
	bindings: LexicalBindings;
	file: string;
	key: string;
	name: string;
	node: Node;
};

function runtimeDeclarationName(node: Node): string | undefined {
	if (ts.isFunctionDeclaration(node)) return node.name?.text;
	if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) return node.name.text;
	return undefined;
}

function importDeclarationIsTypeOnly(node: Node) {
	if (ts.isImportSpecifier(node) && node.isTypeOnly) return true;
	for (let current: Node | undefined = node; current; current = current.parent) {
		if (ts.isImportClause(current)) return /^\s*type\b/u.test(current.getText());
	}
	return false;
}

type RuntimeMockPolicy = {
	hasActual: boolean;
	module: string;
	overriddenExports: ReadonlySet<string>;
};

function isVitestViExpression(expression: Expression, bindings: LexicalBindings): boolean {
	const unwrapped = unwrapExpression(expression);
	const symbol = importedExpressionSymbol(unwrapped, bindings);
	return symbol?.module === "vitest" && symbol.exportedName === "vi";
}

function isVitestViMethodCall(node: CallExpression, method: "importActual" | "mock", bindings: LexicalBindings) {
	const callee = unwrapExpression(node.expression);
	return (
		ts.isPropertyAccessExpression(callee) &&
		callee.name.text === method &&
		isVitestViExpression(callee.expression, bindings)
	);
}

function runtimeMockPolicies(sourceFile: SourceFile): RuntimeMockPolicy[] {
	const policies: RuntimeMockPolicy[] = [];
	const bindings = collectLexicalBindings(sourceFile);
	const visit = (node: Node) => {
		if (
			ts.isCallExpression(node) &&
			isVitestViMethodCall(node, "mock", bindings) &&
			node.arguments[0] &&
			ts.isStringLiteral(node.arguments[0])
		) {
			const module = node.arguments[0].text;
			const factory = node.arguments[1];
			let hasActual = false;
			const overriddenExports = new Set<string>();
			const inspectFactory = (child: Node) => {
				if (
					ts.isCallExpression(child) &&
					isVitestViMethodCall(child, "importActual", bindings) &&
					child.arguments[0] &&
					ts.isStringLiteral(child.arguments[0]) &&
					child.arguments[0].text === module
				) {
					hasActual = true;
				}
				if (
					ts.isPropertyAssignment(child) ||
					ts.isMethodDeclaration(child) ||
					ts.isShorthandPropertyAssignment(child)
				) {
					const name = propertyNameText(child.name);
					if (name) overriddenExports.add(name);
				}
				child.forEachChild(inspectFactory);
			};
			if (factory) inspectFactory(factory);
			policies.push({ hasActual, module, overriddenExports });
		}
		node.forEachChild(visit);
	};
	visit(sourceFile);
	return policies;
}

function runtimeTestAttestationErrors(
	sources: ParsedCrossPlanSource[],
	resolutions: CrossPlanResolution[],
	actualSignatures: ReadonlyMap<string, DiscoveredCrossPlanSignature>,
): string[] {
	const normalizedSources = sources.map(({ file, sourceFile }) => ({
		file: normalizedModulePath(file),
		sourceFile,
		bindings: collectLexicalBindings(sourceFile),
	}));
	const sourceByFile = new Map(normalizedSources.map((source) => [source.file, source.sourceFile]));
	const parsedByFile = new Map(normalizedSources.map((source) => [source.file, source]));
	const knownFiles = new Set(sourceByFile.keys());
	const vitestConfig = sourceByFile.get("apps/web/vitest.config.ts");
	const projects = vitestConfig ? collectVitestProjectPatterns(vitestConfig) : [];
	const declarations = new Map<string, RuntimeDeclaration>();
	const declarationKeyByNode = new Map<Node, string>();
	const declarationsByFileAndName = new Map<string, Map<string, string>>();
	for (const source of normalizedSources) {
		const visit = (node: Node) => {
			const declarationNode = ts.isFunctionLikeDeclaration(node) ? (namedFunctionOwnerDeclaration(node) ?? node) : node;
			const name = runtimeDeclarationName(declarationNode) ?? ownerDeclarationName(declarationNode);
			if (name) {
				const key = `${source.file}\0${declarationNode.pos}\0${name}`;
				declarations.set(key, { bindings: source.bindings, file: source.file, key, name, node: declarationNode });
				declarationKeyByNode.set(declarationNode, key);
				declarationKeyByNode.set(node, key);
				const named = declarationsByFileAndName.get(source.file) ?? new Map<string, string>();
				named.set(name, key);
				declarationsByFileAndName.set(source.file, named);
			}
			node.forEachChild(visit);
		};
		visit(source.sourceFile);
	}

	const declarationTarget = (
		declaration: Node | undefined,
		file: string,
		bindings: LexicalBindings,
		visiting = new Set<Node>(),
		visitingExports = new Set<string>(),
	): Set<string> => {
		if (!declaration || visiting.has(declaration) || importDeclarationIsTypeOnly(declaration)) return new Set();
		const direct = declarationKeyByNode.get(declaration);
		if (direct) return new Set([direct]);
		visiting.add(declaration);
		try {
			if (ts.isImportClause(declaration) || ts.isImportSpecifier(declaration)) {
				const module = importModule(declaration);
				const targetFile = module ? resolveLocalModuleFile(file, module, knownFiles) : undefined;
				const exportedName = ts.isImportClause(declaration)
					? "default"
					: (declaration.propertyName?.text ?? declaration.name.text);
				return resolveRuntimeExport(targetFile, exportedName, visitingExports);
			}
			const initializer = declarationInitializer(declaration);
			if (!initializer) return new Set();
			const imported = importedExpressionSymbol(initializer, bindings);
			if (imported && isLocalWebModule(imported.module)) {
				return resolveRuntimeExport(
					resolveLocalModuleFile(file, imported.module, knownFiles),
					imported.exportedName,
					visitingExports,
				);
			}
			if (ts.isIdentifier(unwrapExpression(initializer))) {
				return declarationTarget(
					lexicalDeclaration(unwrapExpression(initializer) as import("typescript/unstable/ast").Identifier, bindings),
					file,
					bindings,
					visiting,
					visitingExports,
				);
			}
			return new Set();
		} finally {
			visiting.delete(declaration);
		}
	};

	const resolveRuntimeExport = (
		file: string | undefined,
		exportedName: string,
		visiting = new Set<string>(),
	): Set<string> => {
		if (!file) return new Set();
		const exportKey = `${file}\0${exportedName}`;
		if (visiting.has(exportKey)) return new Set();
		const source = parsedByFile.get(file);
		if (!source) return new Set();
		visiting.add(exportKey);
		try {
			for (const statement of source.sourceFile.statements) {
				const statementText = statement.getText(source.sourceFile);
				if (ts.isFunctionDeclaration(statement) && /^\s*export\b/u.test(statementText)) {
					const name = statement.name?.text;
					const matches = /^\s*export\s+default\b/u.test(statementText)
						? exportedName === "default"
						: name === exportedName;
					const key = declarationKeyByNode.get(statement);
					if (matches && key) return new Set([key]);
				}
				if (ts.isVariableStatement(statement) && /^\s*export\b/u.test(statementText)) {
					for (const declaration of statement.declarationList.declarations) {
						if (!ts.isIdentifier(declaration.name) || declaration.name.text !== exportedName) continue;
						const key = declarationKeyByNode.get(declaration);
						if (key) return new Set([key]);
					}
				}
				if (ts.isExportAssignment(statement) && exportedName === "default") {
					const expression = unwrapExpression(statement.expression);
					if (ts.isIdentifier(expression)) {
						return declarationTarget(
							lexicalDeclaration(expression, source.bindings),
							file,
							source.bindings,
							new Set(),
							visiting,
						);
					}
				}
				if (!ts.isExportDeclaration(statement) || statement.isTypeOnly) continue;
				const module =
					statement.moduleSpecifier && ts.isStringLiteral(statement.moduleSpecifier)
						? statement.moduleSpecifier.text
						: undefined;
				const targetFile = module ? resolveLocalModuleFile(file, module, knownFiles) : undefined;
				if (!statement.exportClause) {
					const targets = resolveRuntimeExport(targetFile, exportedName, visiting);
					if (targets.size > 0) return targets;
					continue;
				}
				if (!ts.isNamedExports(statement.exportClause)) continue;
				for (const specifier of statement.exportClause.elements) {
					if (specifier.isTypeOnly || specifier.name.text !== exportedName) continue;
					const sourceName = specifier.propertyName?.text ?? specifier.name.text;
					if (targetFile) {
						const targets = resolveRuntimeExport(targetFile, sourceName, visiting);
						if (targets.size > 0) return targets;
						continue;
					}
					const key = declarationsByFileAndName.get(file)?.get(sourceName);
					if (key) return new Set([key]);
				}
			}
			return new Set();
		} finally {
			visiting.delete(exportKey);
		}
	};

	const referencedTargets = (
		node: Node,
		file: string,
		bindings: LexicalBindings,
		rootDeclarationKey?: string,
	): Set<string> => {
		const targets = new Set<string>();
		const addTargets = (values: Iterable<string>) => {
			for (const value of values) targets.add(value);
		};
		const visit = (child: Node) => {
			if (child !== node) {
				const nestedKey = declarationKeyByNode.get(child);
				if (nestedKey && nestedKey !== rootDeclarationKey) {
					targets.add(nestedKey);
					return;
				}
			}
			if (ts.isImportDeclaration(child) || ts.isExportDeclaration(child)) return;
			if (ts.isPropertyAccessExpression(child)) {
				const imported = importedExpressionSymbol(child, bindings);
				if (imported && isLocalWebModule(imported.module)) {
					addTargets(
						resolveRuntimeExport(resolveLocalModuleFile(file, imported.module, knownFiles), imported.exportedName),
					);
					return;
				}
			}
			if (ts.isIdentifier(child)) {
				const declaration = lexicalDeclaration(child, bindings);
				if (declaration && !importDeclarationIsTypeOnly(declaration)) {
					const imported = importedSymbol(child, bindings);
					if (imported && imported.exportedName !== "*" && isLocalWebModule(imported.module)) {
						addTargets(
							resolveRuntimeExport(resolveLocalModuleFile(file, imported.module, knownFiles), imported.exportedName),
						);
					} else {
						const key = declarationKeyByNode.get(declaration);
						if (key) targets.add(key);
					}
				}
			}
			child.forEachChild(visit);
		};
		visit(node);
		return targets;
	};

	const dependencies = new Map<string, Set<string>>();
	for (const declaration of declarations.values()) {
		const targets = referencedTargets(declaration.node, declaration.file, declaration.bindings, declaration.key);
		targets.delete(declaration.key);
		dependencies.set(declaration.key, targets);
	}

	const errors: string[] = [];
	for (const resolution of resolutions) {
		const runtimeTest = normalizedModulePath(resolution.runtimeTest);
		if (!sourceByFile.has(runtimeTest)) continue;
		if (projects.length === 0) {
			errors.push(
				`cross-plan resolution Vitest project configuration is unavailable: ${resolution.file} ${resolution.runtimeTest}`,
			);
		} else if (runtimeTest.startsWith("apps/web/")) {
			const relativeTest = runtimeTest.slice("apps/web/".length);
			const expectedProject = /\.browser\.test\.tsx?$/u.test(relativeTest) ? "browser-runtime" : "unit";
			const matchingProjects = projects
				.filter((project) => project.include.some((pattern) => globPatternMatches(pattern, relativeTest)))
				.filter((project) => !project.exclude.some((pattern) => globPatternMatches(pattern, relativeTest)))
				.map((project) => project.name);
			if (!matchingProjects.includes(expectedProject)) {
				errors.push(
					`cross-plan resolution runtime test is not included in corresponding Vitest project ${expectedProject}: ${resolution.file} ${resolution.runtimeTest}`,
				);
			}
		}

		const target = normalizedModulePath(resolution.file);
		const runtimeSource = parsedByFile.get(runtimeTest);
		const mockPolicies = (runtimeSource ? runtimeMockPolicies(runtimeSource.sourceFile) : []).flatMap((policy) => {
			const targetFile = resolveLocalModuleFile(runtimeTest, policy.module, knownFiles);
			return targetFile ? [{ ...policy, targetFile }] : [];
		});
		const mockCutsExport = (policy: (typeof mockPolicies)[number], exportedName: string) =>
			!policy.hasActual || policy.overriddenExports.has(exportedName);
		const signature = actualSignatures.get(crossPlanSignatureKey(resolution));
		const dependencyImport = signature?.dependencyImport;
		const dependencyImportFile = dependencyImport
			? resolveLocalModuleFile(dependencyImport.importerFile, dependencyImport.module, knownFiles)
			: undefined;
		const relevantMockCut = mockPolicies.some(
			(policy) =>
				(policy.targetFile === target && mockCutsExport(policy, resolution.value)) ||
				(policy.targetFile === dependencyImportFile &&
					dependencyImport !== undefined &&
					mockCutsExport(policy, dependencyImport.exportedName)),
		);
		if (relevantMockCut) {
			errors.push(
				`cross-plan resolution runtime mock cuts exact source/symbol: ${resolution.file} ${resolution.value} ${resolution.runtimeTest}`,
			);
		}
		const targetOwner = signature?.ownerKey;
		const requiredTargets = new Set<string>();
		if (targetOwner) requiredTargets.add(targetOwner);
		if (signature?.dependencyOwnerKey) requiredTargets.add(signature.dependencyOwnerKey);
		if (dependencyImport && dependencyImportFile) {
			for (const dependency of resolveRuntimeExport(dependencyImportFile, dependencyImport.exportedName)) {
				requiredTargets.add(dependency);
			}
		}
		const blockedTargets = new Set<string>();
		for (const policy of mockPolicies) {
			if (!policy.hasActual) {
				for (const declaration of declarations.values()) {
					if (declaration.file === policy.targetFile) blockedTargets.add(declaration.key);
				}
				continue;
			}
			for (const exportedName of policy.overriddenExports) {
				for (const dependency of resolveRuntimeExport(policy.targetFile, exportedName)) {
					blockedTargets.add(dependency);
				}
			}
		}
		const roots = runtimeSource
			? referencedTargets(runtimeSource.sourceFile, runtimeTest, runtimeSource.bindings)
			: new Set<string>();
		for (const root of blockedTargets) roots.delete(root);
		const visited = new Set(roots);
		const queue = [...roots];
		for (
			let index = 0;
			index < queue.length && [...requiredTargets].some((required) => !visited.has(required));
			index += 1
		) {
			const current = queue[index];
			if (!current) continue;
			for (const dependency of dependencies.get(current) ?? []) {
				const declaration = declarations.get(dependency);
				if (!declaration || blockedTargets.has(dependency) || visited.has(dependency)) continue;
				visited.add(dependency);
				queue.push(dependency);
			}
		}
		if (requiredTargets.size === 0 || [...requiredTargets].some((required) => !visited.has(required))) {
			errors.push(
				`cross-plan resolution runtime test does not reach exact source/symbol: ${resolution.file} ${resolution.value} ${resolution.runtimeTest}`,
			);
		}
	}
	return errors;
}

export function validateCrossPlanOwnership(
	repositoryRoot: string,
	entries: CrossPlanOwnership[] = CROSS_PLAN_OWNERSHIP,
	resolutions: CrossPlanResolution[] = CROSS_PLAN_RESOLUTIONS,
) {
	const roots = [
		path.join(repositoryRoot, "apps/web/src/routes"),
		path.join(repositoryRoot, "apps/web/src/components"),
		path.join(repositoryRoot, "apps/web/src/hooks"),
	];
	const discoveryFiles = roots.flatMap(walkSourceFiles);
	const symbolFiles = walkSourceFiles(path.join(repositoryRoot, "apps/web/src"));
	const knownRuntimeTests = collectExistingRuntimeTests(
		repositoryRoot,
		resolutions.map((resolution) => resolution.runtimeTest),
	);
	const runtimeTestFiles = [...knownRuntimeTests].map((file) => path.resolve(repositoryRoot, ...file.split("/")));
	const vitestConfig = path.join(repositoryRoot, "apps/web/vitest.config.ts");
	const evidenceFiles = [...new Set([...symbolFiles, ...runtimeTestFiles, vitestConfig])];
	const inputs = evidenceFiles.map((file) => ({ file, source: fs.readFileSync(file, "utf8") }));
	return withParsedSources(inputs, (parsed) => {
		const sources = discoveryFiles.map((absolute) => ({
			file: path.relative(repositoryRoot, absolute).replaceAll("\\", "/"),
			sourceFile: requiredSourceFile(parsed, absolute),
		}));
		const attestationSources = evidenceFiles.map((absolute) => ({
			file: path.relative(repositoryRoot, absolute).replaceAll("\\", "/"),
			sourceFile: requiredSourceFile(parsed, absolute),
		}));
		return validateCrossPlanOwnershipFromAsts(sources, entries, resolutions, knownRuntimeTests, attestationSources);
	});
}

export function validateCrossPlanOwnershipFromSources(
	sources: SourceInput[],
	entries: CrossPlanOwnership[] = [],
	resolutions: CrossPlanResolution[] = [],
	knownRuntimeTests: ReadonlySet<string> = new Set(),
) {
	return withParsedSources(sources, (parsed) => {
		const parsedSources = sources.map(({ file }) => ({ file, sourceFile: requiredSourceFile(parsed, file) }));
		const productionSources = parsedSources.filter(
			({ file }) =>
				!ALLOWED_RUNTIME_TEST_SUFFIX.test(file) && normalizedModulePath(file) !== "apps/web/vitest.config.ts",
		);
		return validateCrossPlanOwnershipFromAsts(
			productionSources,
			entries,
			resolutions,
			knownRuntimeTests,
			parsedSources,
		);
	});
}

function validateCrossPlanOwnershipFromAsts(
	sources: Array<{ file: string; sourceFile: SourceFile }>,
	entries: CrossPlanOwnership[],
	resolutions: CrossPlanResolution[],
	knownRuntimeTests: ReadonlySet<string>,
	attestationSources: ParsedCrossPlanSource[] = sources,
) {
	const errors: string[] = [];
	const registry = new Map<string, CrossPlanOwnership | CrossPlanResolution>();
	for (const entry of entries) {
		if (/[*?{}[\]]/.test(entry.file) || entry.file.endsWith("/")) {
			errors.push(`broad cross-plan matcher is forbidden: ${entry.file}`);
			continue;
		}
		if (!entry.owner.trim()) errors.push(`cross-plan owner is empty: ${entry.file}`);
		if (!entry.task.trim()) errors.push(`cross-plan task is empty: ${entry.file}`);
		if (!entry.reason.trim()) errors.push(`cross-plan reason is empty: ${entry.file}`);
		const key = crossPlanSignatureKey(entry);
		if (registry.has(key)) errors.push(`duplicate cross-plan ownership: ${entry.file} ${entry.value}`);
		registry.set(key, entry);
	}
	for (const resolution of resolutions) {
		if (/[*?{}[\]]/.test(resolution.file) || resolution.file.endsWith("/")) {
			errors.push(`broad cross-plan matcher is forbidden: ${resolution.file}`);
			continue;
		}
		if (!resolution.owner.trim()) errors.push(`cross-plan resolution owner is empty: ${resolution.file}`);
		if (!resolution.task.trim()) errors.push(`cross-plan resolution task is empty: ${resolution.file}`);
		if (!resolution.evidence.trim()) errors.push(`cross-plan resolution evidence is empty: ${resolution.file}`);
		const runtimeTestSyntaxError = runtimeTestPathSyntaxError(resolution.runtimeTest);
		if (runtimeTestSyntaxError) {
			errors.push(
				`cross-plan resolution runtime test ${runtimeTestSyntaxError}: ${resolution.file} ${resolution.runtimeTest}`,
			);
		} else if (!knownRuntimeTests.has(resolution.runtimeTest)) {
			errors.push(
				`cross-plan resolution runtime test does not name an existing regular file: ${resolution.file} ${resolution.runtimeTest}`,
			);
		}
		const key = crossPlanSignatureKey(resolution);
		if (registry.has(key)) errors.push(`duplicate cross-plan registry entry: ${resolution.file} ${resolution.value}`);
		registry.set(key, resolution);
	}

	const actual = new Map<string, DiscoveredCrossPlanSignature>();
	const symbolSources = attestationSources.filter(
		({ file }) => !ALLOWED_RUNTIME_TEST_SUFFIX.test(file) && normalizedModulePath(file) !== "apps/web/vitest.config.ts",
	);
	const outputComponentGraph = buildOutputComponentGraph(sources, symbolSources);
	errors.push(...outputComponentGraph.missingOutputLanguageHandoffs);
	for (const { file, sourceFile } of sources) {
		for (const signature of collectCrossPlanSignatures(file, sourceFile, outputComponentGraph)) {
			const key = crossPlanSignatureKey(signature);
			actual.set(key, signature);
			if (!registry.has(key)) {
				errors.push(
					`unregistered output-language dependency: ${file} ${signature.kind} ${signature.value} occurrence ${signature.occurrence}`,
				);
			}
		}
	}
	for (const [key, entry] of registry) {
		if (!actual.has(key)) {
			const registryKind = "resolution" in entry ? "resolution" : "ownership";
			errors.push(
				`stale or missing cross-plan ${registryKind}: ${entry.file} ${entry.kind} ${entry.value} occurrence ${entry.occurrence}`,
			);
		}
	}
	errors.push(...runtimeTestAttestationErrors(attestationSources, resolutions, actual));
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
	const catalogMessageIds = collectCatalogMessageIds(repositoryRoot);
	const sourceInputs = files.map((file) => ({ file, source: fs.readFileSync(file, "utf8") }));
	const candidates = withParsedSources(sourceInputs, (parsed) =>
		files.flatMap((absolute) => {
			const file = path.relative(repositoryRoot, absolute).replaceAll("\\", "/");
			return collectPortalLanguageCandidatesFromAst(file, requiredSourceFile(parsed, absolute), { catalogMessageIds });
		}),
	);
	const auto = candidates
		.map(automaticClassification)
		.filter((entry): entry is LiteralClassification => Boolean(entry));
	const errors = [
		...validateExactClassifications(candidates, PORTAL_LITERAL_CLASSIFICATIONS),
		...routeHeaderErrors(repositoryRoot),
		...sharedCallsiteErrors(repositoryRoot),
		...rawDetailMarkerOwnershipErrors(repositoryRoot, files),
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
