/* biome-ignore-all lint/suspicious/noTemplateCurlyInString: mutation fixtures intentionally contain template syntax */
import { describe, expect, it } from "vitest";
import {
	CROSS_PLAN_OWNERSHIP,
	CROSS_PLAN_RESOLUTIONS,
	type CrossPlanOwnership,
	type CrossPlanResolution,
	collectExistingRuntimeTests,
	collectPortalLanguageCandidatesFromSource,
	runPortalLanguageAudit,
	validateCrossPlanOwnership,
	validateCrossPlanOwnershipFromSources,
	validateExactClassifications,
	validateRawDetailMarkerOwnershipFromSources,
	validateRouteHeadersFromSources,
	validateSharedCallsitesFromSources,
} from "../../scripts/portal-language-audit";
import type { LiteralClassification } from "../../scripts/portal-language-audit-manifest";

describe("portal UI-language literal audit", () => {
	it("collects every contracted visible-literal family from syntax rather than English-only matching", () => {
		const source = `
			export function Sample({ error, rawValue }: { error: Error; rawValue: string }) {
				const status = "pending".charAt(0).toUpperCase();
				toast.error("Could not save");
				return <section title="Visible title" aria-label={\`Raw value \${rawValue}\`}>
					<h1>Plain heading</h1>
					<p>{\`Template \${rawValue}\`}</p>
					<span>{"Joined " + rawValue}</span>
					<time>{new Date().toLocaleDateString("en-US")}</time>
					<div data-raw-detail="true"><pre>{error.message}</pre></div>
				</section>;
			}
		`;

		const candidates = collectPortalLanguageCandidatesFromSource("sample.tsx", source);

		expect(candidates.map(({ kind }) => kind)).toEqual(
			expect.arrayContaining([
				"jsx-text",
				"text-prop",
				"toast-dialog-copy",
				"template-prose",
				"concatenated-prose",
				"display-locale",
				"status-capitalization",
				"raw-error-interpolation",
			]),
		);
		expect(candidates).toContainEqual(
			expect.objectContaining({ kind: "text-prop", value: `\`Raw value \${rawValue}\`` }),
		);
	});

	it("collects AST-visible expression, conditional, logical, property, and indirect error forms", () => {
		const source = [
			"const rawFailure = getFailure();",
			'const item = { label: "Windows", description: condition ? "macOS" : "Linux" };',
			'toast.error(condition ? "Could not save" : fallbackMessage);',
			'export const x = <section title={condition ? "Visible title" : fallbackTitle}',
			"aria-label={condition && `Raw ${rawValue}`}>",
			'{"Visible expression"}',
			'{condition ? "First branch" : "Second branch"}',
			"{condition && indirectCopy}",
			'<div data-raw-detail="true"><pre>{rawFailure}</pre></div>',
			"</section>;",
		].join("\n");

		const candidates = collectPortalLanguageCandidatesFromSource("sample.tsx", source);
		const signatures = candidates.map(({ kind, value, region }) => `${kind}:${value}:${region ?? "none"}`);

		expect(signatures).toEqual(
			expect.arrayContaining([
				"jsx-text:Visible expression:none",
				"jsx-text:First branch:none",
				"jsx-text:Second branch:none",
				"rendered-identifier:indirectCopy:none",
				"metadata-copy:Windows:none",
				"metadata-copy:macOS:none",
				"metadata-copy:Linux:none",
				"toast-dialog-copy:Could not save:none",
				"toast-dialog-copy:fallbackMessage:none",
				"text-prop:Visible title:none",
				"text-prop:fallbackTitle:none",
				"text-prop:`Raw ${rawValue}`:none",
				"raw-error-interpolation:rawFailure:raw-detail",
			]),
		);
	});

	it("does not auto-accept generic identifiers, token-like text, or unresolved catalog calls", () => {
		const candidates = collectPortalLanguageCandidatesFromSource(
			"sample.tsx",
			`export const x = <>{name}{value}{id}<p>provider.consumer_web</p>{t("missing.catalog.id")}</>;`,
		);
		const errors = validateExactClassifications(candidates, []);

		for (const value of ["name", "value", "id", "provider.consumer_web", "missing.catalog.id"]) {
			expect(errors).toEqual(expect.arrayContaining([expect.stringContaining(value)]));
		}

		const catalogCollisions = collectPortalLanguageCandidatesFromSource(
			"sample.tsx",
			`export const x = <><p>auth.login.title</p><p>{citation.title}</p></>;`,
			{ catalogMessageIds: new Set(["auth.login.title", "citation.title"]) },
		);
		const collisionErrors = validateExactClassifications(catalogCollisions, []);
		for (const value of ["auth.login.title", "citation.title"]) {
			expect(collisionErrors).toEqual(expect.arrayContaining([expect.stringContaining(value)]));
		}
	});

	it("traces visible string bindings so hard-coded copy mutations stale exact classifications", () => {
		const before = collectPortalLanguageCandidatesFromSource(
			"sample.tsx",
			`const copy = "Hardcoded English"; export const x = <p>{copy}</p>;`,
		);
		const hardcoded = before.find((candidate) => candidate.value === "Hardcoded English");
		expect(hardcoded).toBeDefined();
		const exact = before.map<LiteralClassification>((candidate) => ({
			...candidate,
			category: "proper-noun",
			reason: "Mutation fixture.",
		}));
		const after = collectPortalLanguageCandidatesFromSource(
			"sample.tsx",
			`const copy = "Changed hard-coded copy"; export const x = <p>{copy}</p>;`,
		);
		const errors = validateExactClassifications(after, exact);
		expect(errors).toEqual(expect.arrayContaining([expect.stringContaining("Changed hard-coded copy")]));
		expect(errors).toEqual(expect.arrayContaining([expect.stringContaining("stale classification")]));
	});

	it("requires imported translator provenance and resolves lexical aliases without shadow or cycle false greens", () => {
		const catalogMessageIds = new Set(["auth.login.title"]);
		const real = collectPortalLanguageCandidatesFromSource(
			"real.tsx",
			`import { useI18n as importedHook } from "@/i18n/provider";
			 export function Real() { const { t: tr } = importedHook(); return <p>{tr("auth.login.title")}</p>; }`,
			{ catalogMessageIds },
		);
		expect(real).toContainEqual(
			expect.objectContaining({ kind: "localized-key", value: "auth.login.title", catalogResolved: true }),
		);
		const direct = collectPortalLanguageCandidatesFromSource(
			"direct.tsx",
			`import { translate as catalogTranslate } from "@/i18n/catalog";
			 export const x = <p>{catalogTranslate("en", "auth.login.title")}</p>;`,
			{ catalogMessageIds },
		);
		expect(direct).toContainEqual(
			expect.objectContaining({ kind: "localized-key", value: "auth.login.title", catalogResolved: true }),
		);

		for (const source of [
			`function t() { return "fake"; } export const x = <p>{t("auth.login.title")}</p>;`,
			`function translate() { return "fake"; } export const x = <p>{translate("en", "auth.login.title")}</p>;`,
			`import type { MessageId } from "@/i18n/catalog";
			 function t(_id: MessageId) { return "fake"; } export const x = <p>{t("auth.login.title")}</p>;`,
			`import { useI18n } from "@/i18n/provider";
			 const { t } = useI18n(); function Sample() { const t = () => "fake"; return <p>{t("auth.login.title")}</p>; }`,
		]) {
			const candidates = collectPortalLanguageCandidatesFromSource("fake.tsx", source, { catalogMessageIds });
			expect(validateExactClassifications(candidates, [])).toEqual(
				expect.arrayContaining([expect.stringContaining("auth.login.title")]),
			);
		}

		const lexical = collectPortalLanguageCandidatesFromSource(
			"lexical.tsx",
			`const copy = "Outer copy"; const alias = copy;
			 function Inner() { const copy = "Inner copy"; return <><p>{copy}</p><p>{alias}</p></>; }
			 const combined = flag ? \`Template \${name}\` : "Fallback " + name;
			 let first = second; let second = first;
			 export const x = <><Inner /><p>{combined}</p><p>{first}</p></>;`,
		);
		expect(lexical).toEqual(expect.arrayContaining([expect.objectContaining({ value: "Inner copy" })]));
		expect(lexical).toEqual(expect.arrayContaining([expect.objectContaining({ value: "Outer copy" })]));
		expect(lexical).toEqual(expect.arrayContaining([expect.objectContaining({ value: "`Template ${name}`" })]));
		expect(lexical).toEqual(expect.arrayContaining([expect.objectContaining({ value: '"Fallback " + name' })]));
		expect(lexical).toEqual(expect.arrayContaining([expect.objectContaining({ value: "first" })]));
		expect(lexical).not.toContainEqual(expect.objectContaining({ value: "copy" }));
		expect(lexical).not.toContainEqual(expect.objectContaining({ value: "alias" }));
	}, 15_000);

	it("collects hard-coded copy from visible sequence, array, and children expressions", () => {
		const catalogMessageIds = new Set(["auth.login.title"]);
		const candidates = collectPortalLanguageCandidatesFromSource(
			"visible-branches.tsx",
			`import { useI18n } from "@/i18n/provider";
			 export function VisibleBranches() { const { t } = useI18n(); return <>
			 <p>{(t("auth.login.title"), "Sequence hard-coded English")}</p>
			 <p>{[t("auth.login.title"), "Array hard-coded English"]}</p>
			 <Widget children="Children hard-coded English" />
			 </>; }`,
			{ catalogMessageIds },
		);
		const errors = validateExactClassifications(candidates, []);

		for (const value of ["Sequence hard-coded English", "Array hard-coded English", "Children hard-coded English"]) {
			expect(errors).toEqual(expect.arrayContaining([expect.stringContaining(value)]));
		}
	});

	it("collects mixed JSX branches, display props, qualified dialogs, local property copy, and satisfies wrappers", () => {
		const sources = [
			`export const x = <>{flag ? <i>Safe</i> : "Hardcoded fallback"}</>;`,
			`export const x = <p>{flag ? <i /> : "Hardcoded nested fallback"}</p>;`,
			`export const x = <p>{render(flag ? <i /> : "Hardcoded call fallback")}</p>;`,
			`export const x = <p>{render(<i />, "Hardcoded second argument")}</p>;`,
			`export const x = <><EmptyState message="Hardcoded message" content={"Hardcoded content"} /></>;`,
			`const caption = "Hardcoded caption"; export const x = <Widget helpText="Hardcoded help" caption={caption} value="machine-value" />;`,
			`export function ask() { window.confirm("Window hardcoded"); globalThis.confirm("Global hardcoded"); }`,
			`const COPY = { empty: "Hardcoded empty" }; export const x = <p>{COPY.empty}</p>;`,
			`enum COPY { empty = "Hardcoded enum empty" } export const x = <p>{COPY.empty}</p>;`,
			`const title = "Hardcoded title"; export const route = { head: () => ({ meta: [{ title }] }) };`,
			`export const x = <p>{("Visible satisfies" satisfies string)}</p>;`,
		];
		const candidates = sources.flatMap((source, index) =>
			collectPortalLanguageCandidatesFromSource(`structural-${index}.tsx`, source),
		);
		const errors = validateExactClassifications(candidates, []);
		for (const value of [
			"Hardcoded fallback",
			"Hardcoded nested fallback",
			"Hardcoded call fallback",
			"Hardcoded second argument",
			"Hardcoded message",
			"Hardcoded content",
			"Hardcoded help",
			"Hardcoded caption",
			"Window hardcoded",
			"Global hardcoded",
			"Hardcoded empty",
			"Hardcoded enum empty",
			"Hardcoded title",
			"Visible satisfies",
		]) {
			expect(errors).toEqual(expect.arrayContaining([expect.stringContaining(value)]));
		}
		expect(candidates).not.toContainEqual(expect.objectContaining({ value: "machine-value" }));
	});

	it("traces object destructuring to the exact hard-coded property source", () => {
		const before = collectPortalLanguageCandidatesFromSource(
			"object-binding.tsx",
			`const COPY = { empty: "Hardcoded empty" }; const { empty } = COPY; export const x = <p>{empty}</p>;`,
		);
		const exact = before.map<LiteralClassification>((candidate) => ({
			...candidate,
			category: "proper-noun",
			reason: "Exact mutation fixture.",
		}));
		const after = collectPortalLanguageCandidatesFromSource(
			"object-binding.tsx",
			`const COPY = { empty: "Changed empty" }; const { empty } = COPY; export const x = <p>{empty}</p>;`,
		);
		const errors = validateExactClassifications(after, exact);

		expect(before).toEqual(expect.arrayContaining([expect.objectContaining({ value: "Hardcoded empty" })]));
		expect(errors).toEqual(expect.arrayContaining([expect.stringContaining("Changed empty")]));
		expect(errors).toEqual(expect.arrayContaining([expect.stringContaining("stale classification")]));
	});

	it("collects later assignments to visible literal bindings", () => {
		const before = collectPortalLanguageCandidatesFromSource(
			"assigned-copy.tsx",
			`let copy = "Old hard-coded"; copy = "New hard-coded"; export function X() { return <p>{copy}</p>; }`,
		);
		const exact = before.map<LiteralClassification>((candidate) => ({
			...candidate,
			category: "proper-noun",
			reason: "Exact assignment mutation fixture.",
		}));
		const after = collectPortalLanguageCandidatesFromSource(
			"assigned-copy.tsx",
			`let copy = "Old hard-coded"; copy = "Changed hard-coded"; export function X() { return <p>{copy}</p>; }`,
		);
		const errors = validateExactClassifications(after, exact);

		expect(before).toEqual(expect.arrayContaining([expect.objectContaining({ value: "New hard-coded" })]));
		expect(errors).toEqual(expect.arrayContaining([expect.stringContaining("Changed hard-coded")]));
		expect(errors).toEqual(expect.arrayContaining([expect.stringContaining("stale classification")]));
	});

	it("pins the exact shared component owners and callsites", () => {
		const sidebarSource = `import { useI18n } from "@/i18n/provider";
			import { Sidebar } from "@workspace/ui/components/sidebar";
			export function AppSidebar() { const { t } = useI18n(); return <>
			<Sidebar mobileTitle={t("accessibility.sidebarTitle")} mobileDescription={t("accessibility.sidebarDescription")} />
			</>; }`;
		const headerSource = `import { useI18n } from "@/i18n/provider";
			import { SidebarTrigger } from "@workspace/ui/components/sidebar";
			import { Breadcrumb } from "@workspace/ui/components/breadcrumb";
			export function SiteHeader() { const { t } = useI18n(); return <>
			<SidebarTrigger label={t("accessibility.toggleSidebar")} />
			<Breadcrumb label={t("accessibility.breadcrumb")} moreLabel={t("accessibility.more")} />
			</>; }`;
		const tagsSource = `import { useI18n } from "@/i18n/provider";
			import { TagsInput } from "@workspace/ui/components/tags-input";
			export function LocalizedTagsInput() { const { t } = useI18n(); return <>
			<TagsInput emptyText={t("customer.filters.noResults")}
			 removeTagLabel={(tag) => t("accessibility.removeTag", { tag })}
			 maximumReachedText={t("filter.maximumReached")} entryHintText={t("filter.entryHint")}
			 addValueText={t("filter.addValue")} />
			</>; }`;
		const sources = [
			{ component: "AppSidebar", source: sidebarSource },
			{ component: "SiteHeader", source: headerSource },
			{ component: "LocalizedTagsInput", source: tagsSource },
		];
		expect(validateSharedCallsitesFromSources(sources)).toEqual([]);
		const missingOwner = sidebarSource.replace("AppSidebar", "SidebarSurrogate");
		expect(
			validateSharedCallsitesFromSources([{ component: "AppSidebar", source: missingOwner }, ...sources.slice(1)]),
		).toEqual(expect.arrayContaining([expect.stringContaining("imported Sidebar")]));
		const missingCallsite = sidebarSource.replaceAll("Sidebar", "Panel");
		expect(
			validateSharedCallsitesFromSources([{ component: "AppSidebar", source: missingCallsite }, ...sources.slice(1)]),
		).toEqual(expect.arrayContaining([expect.stringContaining("imported Sidebar")]));
	});

	it("rejects every static route segment that can reach the visible breadcrumb fallback", () => {
		const siteHeader = `const PAGE_NAME_IDS = { settings: "navigation.settings", brand: "navigation.brand" };`;
		const errors = validateRouteHeadersFromSources(siteHeader, [
			{
				file: "billing.tsx",
				source: `export const Route = createFileRoute("/_authed/app/$brand/settings/billing")({});`,
			},
		]);

		expect(errors).toEqual(expect.arrayContaining([expect.stringContaining("billing")]));
	});

	it("accepts raw error evidence only inside an explicitly labelled raw-detail region", () => {
		const unlabelled = collectPortalLanguageCandidatesFromSource(
			"sample.tsx",
			`export const x = <pre>{rawFailure}</pre>;`,
		);
		const markerOnly = collectPortalLanguageCandidatesFromSource(
			"sample.tsx",
			`export const x = <section data-raw-detail="true"><pre>{rawFailure}</pre></section>;`,
		);
		const labelled = collectPortalLanguageCandidatesFromSource(
			"labelled.tsx",
			`import { LocalizedRawDetail as Detail } from "@/components/localized-raw-detail";
			 export function X() { return <Detail labelId="admin.raw.errorDetails" detail={rawFailure} />; }`,
			{ catalogMessageIds: new Set(["admin.raw.errorDetails"]) },
		);
		const falseLabels = [
			`<section><p>{t("error.unexpected.subtitle")}</p><pre data-raw-detail>{error.message}</pre></section>`,
			`<section><p>{t("error.unexpected.subtitle")}</p><p>{t("error.unexpected.subtitle")}</p><pre data-raw-detail>{error.message}</pre></section>`,
			`<section><pre data-raw-detail><span>{t("admin.raw.errorDetails")}</span>{error.message}</pre></section>`,
			`<section><p>{t("error.unexpected.subtitle")}</p>{false && <p>{t("admin.raw.errorDetails")}</p>}<pre data-raw-detail>{error.message}</pre></section>`,
			`<section><pre data-raw-detail aria-label={t("admin.raw.errorDetails")}>{error.message}</pre></section>`,
			`<section><p hidden>{t("admin.raw.errorDetails")}</p><pre data-raw-detail>{error.message}</pre></section>`,
			`<section><p aria-hidden="true">{t("admin.raw.errorDetails")}</p><pre data-raw-detail>{error.message}</pre></section>`,
			`<section><p className="hidden">{t("admin.raw.errorDetails")}</p><pre data-raw-detail>{error.message}</pre></section>`,
			`<section><p className={"hidden"}>{t("admin.raw.errorDetails")}</p><pre data-raw-detail>{error.message}</pre></section>`,
			`<section><p style={{ display: "none" }}>{t("admin.raw.errorDetails")}</p><pre data-raw-detail>{error.message}</pre></section>`,
			`<section><p aria-hidden={true as const}>{t("admin.raw.errorDetails")}</p><pre data-raw-detail>{error.message}</pre></section>`,
			`<section><p>{t("admin.raw.errorDetails")}{t("error.unexpected.subtitle")}</p><pre data-raw-detail>{error.message}</pre></section>`,
			`<section><p>{t("admin.raw.errorDetails")}</p>{t("error.unexpected.subtitle")}<pre data-raw-detail>{error.message}</pre></section>`,
			`<LocalizedRawDetail labelId="admin.raw.errorDetails" detail={error.message} />`,
		].map((body, index) =>
			collectPortalLanguageCandidatesFromSource(
				`false-label-${index}.tsx`,
				`import { useI18n } from "@/i18n/provider";
				 function LocalizedRawDetail(props: unknown) { return null; }
				 export function X() { const { t } = useI18n(); return ${body}; }`,
				{ catalogMessageIds: new Set(["admin.raw.errorDetails", "error.unexpected.subtitle"]) },
			),
		);
		falseLabels.push(
			collectPortalLanguageCandidatesFromSource(
				"wrong-module.tsx",
				`import { LocalizedRawDetail } from "@/components/raw-detail-barrel";
				 export const x = <LocalizedRawDetail labelId="admin.raw.errorDetails" detail={error.message} />;`,
				{ catalogMessageIds: new Set(["admin.raw.errorDetails"]) },
			),
			collectPortalLanguageCandidatesFromSource(
				"translated-detail.tsx",
				`import { LocalizedRawDetail } from "@/components/localized-raw-detail";
				 import { useI18n } from "@/i18n/provider";
				 export function X() { const { t } = useI18n(); return <LocalizedRawDetail labelId="admin.raw.errorDetails" detail={t("admin.raw.errorDetails")} />; }`,
				{ catalogMessageIds: new Set(["admin.raw.errorDetails"]) },
			),
			collectPortalLanguageCandidatesFromSource(
				"translated-detail-alias.tsx",
				'import { LocalizedRawDetail } from "@/components/localized-raw-detail"; import { useI18n } from "@/i18n/provider"; export function X() { const { t } = useI18n(); const detail = t("admin.raw.errorDetails"); return <LocalizedRawDetail labelId="admin.raw.errorDetails" detail={detail} />; }',
				{ catalogMessageIds: new Set(["admin.raw.errorDetails"]) },
			),
			collectPortalLanguageCandidatesFromSource(
				"translated-detail-nested.tsx",
				'import { LocalizedRawDetail } from "@/components/localized-raw-detail"; import { useI18n } from "@/i18n/provider"; export function X() { const { t } = useI18n(); return <LocalizedRawDetail labelId="admin.raw.errorDetails" detail={format(t("admin.raw.errorDetails"))} />; }',
				{ catalogMessageIds: new Set(["admin.raw.errorDetails"]) },
			),
			collectPortalLanguageCandidatesFromSource(
				"wrong-label.tsx",
				'import { LocalizedRawDetail } from "@/components/localized-raw-detail"; export const x = <LocalizedRawDetail labelId="wrong.raw.label" detail={error.message} />;',
				{ catalogMessageIds: new Set(["admin.raw.errorDetails"]) },
			),
			collectPortalLanguageCandidatesFromSource(
				"dynamic-label.tsx",
				'import { LocalizedRawDetail } from "@/components/localized-raw-detail"; export const x = <LocalizedRawDetail labelId={dynamicLabel} detail={error.message} />;',
				{ catalogMessageIds: new Set(["admin.raw.errorDetails"]) },
			),
			collectPortalLanguageCandidatesFromSource(
				"missing-label.tsx",
				'import { LocalizedRawDetail } from "@/components/localized-raw-detail"; export const x = <LocalizedRawDetail detail={error.message} />;',
				{ catalogMessageIds: new Set(["admin.raw.errorDetails"]) },
			),
		);
		const unlabelledExact: LiteralClassification = {
			file: "sample.tsx",
			kind: "raw-error-interpolation",
			value: "rawFailure",
			occurrence: 1,
			category: "raw-evidence",
			reason: "Explicitly labelled raw diagnostic detail.",
		};
		const markerOnlyExact = { ...unlabelledExact };
		const labelledCandidate = labelled.find((candidate) => candidate.kind === "raw-error-interpolation");
		const labelledExact: LiteralClassification[] = labelledCandidate
			? [{ ...labelledCandidate, category: "raw-evidence", reason: "Visible localized raw-detail label." }]
			: [];

		for (const category of ["raw-evidence", "domain-value", "machine-token", "localized-key"] as const) {
			expect(validateExactClassifications(unlabelled, [{ ...unlabelledExact, category }])).toEqual(
				expect.arrayContaining([expect.stringContaining("raw error lacks labelled raw-detail region")]),
			);
		}
		expect(validateExactClassifications(markerOnly, [markerOnlyExact])).toEqual(
			expect.arrayContaining([expect.stringContaining("visible localized label")]),
		);
		expect(validateExactClassifications(labelled, labelledExact)).toEqual([]);
		for (const candidates of falseLabels) {
			const exact = candidates
				.filter((candidate) => candidate.kind === "raw-error-interpolation")
				.map<LiteralClassification>((candidate) => ({
					...candidate,
					category: "raw-evidence",
					reason: "Generic, dead, attribute-only, or in-marker copy cannot label raw detail.",
				}));
			expect(validateExactClassifications(candidates, exact).join("\n")).toMatch(
				/raw (?:error lacks labelled raw-detail region|detail lacks visible localized label)/u,
			);
		}

		for (const value of ["error.message", "caughtError", "getFailure()", "failure.message.stack.cause"]) {
			const hazard = collectPortalLanguageCandidatesFromSource("hazard.tsx", `export const x = <pre>{${value}}</pre>;`);
			const candidate = hazard.find((entry) => entry.value === value);
			expect(candidate).toEqual(expect.objectContaining({ kind: "raw-error-interpolation" }));
			const exact = candidate
				? [{ ...candidate, category: "domain-value" as const, reason: "Must not bypass the raw-region gate." }]
				: [];
			expect(validateExactClassifications(hazard, exact)).toEqual(
				expect.arrayContaining([expect.stringContaining("raw error lacks labelled raw-detail region")]),
			);
		}
		expect(
			validateExactClassifications(
				labelled,
				labelledExact.map((entry) => ({ ...entry, category: "machine-token" })),
			),
		).toEqual(expect.arrayContaining([expect.stringContaining("labelled raw hazard must use raw-evidence")]));
	}, 15_000);

	it("allows the raw marker only in the exact canonical component implementation", () => {
		const canonical = {
			file: "apps/web/src/components/localized-raw-detail.tsx",
			source: `export function LocalizedRawDetail({ detail }) { return <pre data-raw-detail>{detail}</pre>; }`,
		};
		expect(validateRawDetailMarkerOwnershipFromSources([canonical])).toEqual([]);
		expect(
			validateRawDetailMarkerOwnershipFromSources([
				canonical,
				{ file: "apps/web/src/example.tsx", source: `export const x = <pre data-raw-detail>{error}</pre>;` },
			]),
		).toEqual(expect.arrayContaining([expect.stringContaining("outside canonical component")]));
	});

	it("traces raw state setters and later assignments to rendered values", () => {
		for (const source of [
			`export function X() { const [error, setError] = useState(null); try { run(); } catch (caught) { setError(caught instanceof Error ? caught.message : String(caught)); } return <p>{error}</p>; }`,
			`export function X() { let error = null; try { run(); } catch (caught) { error = caught.message; } return <p>{error}</p>; }`,
		]) {
			const candidates = collectPortalLanguageCandidatesFromSource("raw-assignment.tsx", source);
			const manifest = candidates.map<LiteralClassification>((candidate) => ({
				...candidate,
				category: "domain-value",
				reason: "Raw setter/assignment must remain syntax-enforced.",
			}));
			expect(candidates).toEqual(
				expect.arrayContaining([expect.objectContaining({ kind: "raw-error-interpolation", value: "error" })]),
			);
			expect(validateExactClassifications(candidates, manifest)).toEqual(
				expect.arrayContaining([expect.stringContaining("raw error lacks labelled raw-detail region")]),
			);
		}
	});

	it("enforces nested raw hazards independently of their outer visible-copy classification", () => {
		for (const source of [
			"export const x = <p>{`Failure: ${error.message}`}</p>;",
			'export const x = <p>{"Failure: " + error.message}</p>;',
			"export const x = <p>{format(error.message)}</p>;",
		]) {
			const candidates = collectPortalLanguageCandidatesFromSource("nested-raw.tsx", source);
			const classifications = candidates.map<LiteralClassification>((candidate) => ({
				...candidate,
				category: "domain-value",
				reason: "Outer copy must not hide nested raw evidence.",
			}));
			expect(candidates).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						kind: "raw-error-interpolation",
						value: "error.message",
					}),
				]),
			);
			expect(validateExactClassifications(candidates, classifications)).toEqual(
				expect.arrayContaining([expect.stringContaining("raw error lacks labelled raw-detail region")]),
			);
		}
	});

	it("traces raw aliases, catch parameters, stringification, and mixed JSX arms to the visible sink region", () => {
		for (const [source, expectedValue] of [
			[`const display = error.message; export const x = <p>{display}</p>;`, "display"],
			[`try { run(); } catch (error) { x = <p>{error}</p>; }`, "error"],
			[`export const x = <p>{String(error)}</p>;`, "String(error)"],
			[`export const x = <>{flag ? <i>Safe</i> : error.message}</>;`, "error.message"],
		] as const) {
			const candidates = collectPortalLanguageCandidatesFromSource("raw-flow.tsx", source);
			expect(candidates).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						kind: "raw-error-interpolation",
						value: expectedValue,
						region: undefined,
					}),
				]),
			);
		}

		const labelled = collectPortalLanguageCandidatesFromSource(
			"raw-flow.tsx",
			`const display = error.message; export const x = <pre data-raw-detail>{display}</pre>;`,
		);
		expect(labelled).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					kind: "raw-error-interpolation",
					value: "display",
					region: "raw-detail",
				}),
			]),
		);
	});

	it("rejects unclassified candidates, stale entries, and broad matchers", () => {
		const candidates = collectPortalLanguageCandidatesFromSource("sample.tsx", "export const x = <p>Visible copy</p>;");
		const exact: LiteralClassification = {
			file: "sample.tsx",
			kind: "jsx-text",
			value: "Visible copy",
			occurrence: 1,
			category: "proper-noun",
			reason: "Controlled exact fixture.",
		};

		expect(validateExactClassifications(candidates, [])).toEqual(
			expect.arrayContaining([expect.stringContaining("unclassified")]),
		);
		expect(validateExactClassifications([], [exact])).toEqual(
			expect.arrayContaining([expect.stringContaining("stale")]),
		);
		expect(validateExactClassifications(candidates, [{ ...exact, file: "apps/web/src/**" }])).toEqual(
			expect.arrayContaining([expect.stringContaining("broad matcher")]),
		);

		const proseWithEquals = collectPortalLanguageCandidatesFromSource(
			"sample.tsx",
			"export const x = <p>Status = Ready</p>;",
		);
		expect(validateExactClassifications(proseWithEquals, [])).toEqual(
			expect.arrayContaining([expect.stringContaining("unclassified")]),
		);
	});

	it("keeps every completed output-language surface assigned to an exact runtime-backed resolution", () => {
		const repositoryRoot = new URL("../../../..", import.meta.url).pathname.replace(/^\/(.:)/, "$1");
		expect(validateCrossPlanOwnership(repositoryRoot)).toEqual([]);
		expect(CROSS_PLAN_OWNERSHIP).toEqual([]);
		expect(CROSS_PLAN_RESOLUTIONS).toHaveLength(60);
		const previouslyResolved = [
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
				evidence:
					"The route passes the exact selected token and raw run evidence to the real printable chart component.",
				runtimeTest:
					"apps/web/src/routes/_authed/reports/render/report-render-language-browser-runtime.browser.test.tsx",
			},
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
		expect(CROSS_PLAN_RESOLUTIONS).toEqual(expect.arrayContaining(previouslyResolved));
		expect(
			collectExistingRuntimeTests(
				repositoryRoot,
				CROSS_PLAN_RESOLUTIONS.map((resolution) => resolution.runtimeTest),
			),
		).toEqual(
			new Set([
				"apps/web/src/routes/_authed/reports/index-output-language-browser-runtime.browser.test.tsx",
				"apps/web/src/routes/_authed/reports/index-output-language-transition.test.ts",
				"apps/web/src/routes/_authed/reports/render/report-render-language.test.tsx",
				"apps/web/src/routes/_authed/reports/render/report-render-language-browser-runtime.browser.test.tsx",
				"apps/web/src/components/chart-surface-localization.test.tsx",
				"apps/web/src/components/base-chart-localization.test.tsx",
				"apps/web/src/components/visibility-localization.test.tsx",
				"apps/web/src/components/chart-export-output-language.browser.test.tsx",
				"apps/web/src/components/virtualized-prompt-list-output-language.test.tsx",
				"apps/web/src/components/dashboard-chart-export-language-propagation.test.tsx",
				"apps/web/src/routes/_authed/app/$brand/-analytics-localization.test.tsx",
				"apps/web/src/hooks/use-chart-export-output-language.test.tsx",
				"apps/web/src/components/opportunities-generation-control.test.tsx",
				"apps/web/src/routes/_authed/app/$brand/opportunities-output-language.test.tsx",
				"apps/web/src/components/opportunities-report.test.tsx",
				"apps/web/src/hooks/use-opportunities.test.ts",
			]),
		);
		const exactSignatures = CROSS_PLAN_RESOLUTIONS.map(
			(entry) => `${entry.file} ${entry.kind} ${entry.value} occurrence ${entry.occurrence}`,
		);
		expect(new Set(exactSignatures).size).toBe(CROSS_PLAN_RESOLUTIONS.length);
		const withoutAnyResolution = validateCrossPlanOwnership(repositoryRoot, [], []);
		for (const entry of CROSS_PLAN_RESOLUTIONS) {
			expect(withoutAnyResolution).toContain(
				`unregistered output-language dependency: ${entry.file} ${entry.kind} ${entry.value} occurrence ${entry.occurrence}`,
			);
			expect(entry.owner).toBe("portal-output-languages");
			expect(entry.resolution).toBe("explicit-output-language");
			expect(entry.evidence.length).toBeGreaterThan(20);
		}
		const withoutAnyReportResolution = validateCrossPlanOwnership(repositoryRoot, [], []);
		for (const value of ["useI18n", "buildReportCreateInput", "renderReport"]) {
			expect(withoutAnyReportResolution).toEqual(
				expect.arrayContaining([
					expect.stringContaining(
						`unregistered output-language dependency: apps/web/src/routes/_authed/reports/index.tsx`,
					),
				]),
			);
			expect(withoutAnyReportResolution.some((error) => error.includes(` ${value} occurrence 1`))).toBe(true);
		}
		expect(CROSS_PLAN_RESOLUTIONS.filter((entry) => entry.task === "Task 4").length).toBeGreaterThan(30);

		const incomplete = [
			{
				file: "apps/web/src/components/missing-output-surface.tsx",
				owner: "",
				task: "",
				reason: "",
			} as unknown as CrossPlanOwnership,
		];
		const errors = validateCrossPlanOwnership(repositoryRoot, incomplete);
		expect(errors).toEqual(expect.arrayContaining([expect.stringContaining("cross-plan owner is empty")]));
		expect(errors).toEqual(expect.arrayContaining([expect.stringContaining("cross-plan task is empty")]));
		expect(errors).toEqual(expect.arrayContaining([expect.stringContaining("stale or missing cross-plan ownership")]));
	}, 15_000);

	it("loads non-discovery src modules into the exact runtime dependency and mock universe", () => {
		const repositoryRoot = new URL("../../../..", import.meta.url).pathname.replace(/^\/(.:)/, "$1");
		const mockedContextResolution: CrossPlanResolution = {
			file: "apps/web/src/contexts/chart-data-context.tsx",
			kind: "output-component",
			value: "ChartDataProvider",
			occurrence: 1,
			owner: "portal-output-languages",
			task: "Task 4",
			resolution: "explicit-output-language",
			evidence: "Mutation-only resolution proves contexts participate in exact runtime mock attestation.",
			runtimeTest: "apps/web/src/components/dashboard-chart-export-language-propagation.test.tsx",
		};

		expect(validateCrossPlanOwnership(repositoryRoot, [], [mockedContextResolution])).toContain(
			"cross-plan resolution runtime mock cuts exact source/symbol: apps/web/src/contexts/chart-data-context.tsx ChartDataProvider apps/web/src/components/dashboard-chart-export-language-propagation.test.tsx",
		);
	});

	it("requires exact deferred or resolved registry entries for every discovered output dependency", () => {
		const exact: CrossPlanOwnership = {
			file: "apps/web/src/components/sample-print.tsx",
			kind: "ambient-ui-language",
			value: "useI18n",
			occurrence: 1,
			owner: "portal-output-languages",
			task: "Task 4",
			reason: "Explicit output-language propagation remains deferred.",
		};
		const unresolved = [
			{
				file: exact.file,
				source:
					'import { useI18n } from "@/i18n/provider"; export function SamplePrint() { useI18n(); return <p data-output-language="fixture" />; }',
			},
		];

		expect(validateCrossPlanOwnershipFromSources(unresolved, [exact])).toEqual([]);
		const opportunityErrors = validateCrossPlanOwnershipFromSources(
			[
				{
					file: "apps/web/src/routes/_authed/admin/tools.tsx",
					source:
						'import { useI18n } from "@/i18n/provider"; import { OpportunitiesGenerationControl } from "@/components/opportunities-generation-control"; export function ToolsPage() { useI18n(); return <OpportunitiesGenerationControl />; }',
				},
				{
					file: "apps/web/src/components/opportunities-generation-control.tsx",
					source:
						'import { useI18n } from "@/i18n/provider"; import { useArtifactLanguageSelection } from "@/hooks/use-artifact-language-selection"; export function OpportunitiesGenerationControl() { useI18n(); useArtifactLanguageSelection("opportunities-admin", "brand", "scope", "en"); return <p />; }',
				},
				{
					file: "apps/web/src/routes/_authed/app/$brand/opportunities.tsx",
					source:
						'import { useI18n } from "@/i18n/provider"; import { useArtifactLanguageSelection } from "@/hooks/use-artifact-language-selection"; import { OpportunitiesReport } from "@/components/opportunities-report"; export function Page() { useI18n(); useArtifactLanguageSelection("opportunities-customer", "brand", "scope", "en"); return <OpportunitiesReport outputLanguage="en" />; }',
				},
				{
					file: "apps/web/src/components/opportunities-report.tsx",
					source:
						'export function OpportunitiesReport({ outputLanguage }: { outputLanguage: "en" | "zh-CN" }) { return <section lang={outputLanguage} />; }',
				},
			],
			[],
		);
		expect(opportunityErrors).toEqual(
			expect.arrayContaining([
				expect.stringContaining(
					"apps/web/src/components/opportunities-generation-control.tsx output-hook useArtifactLanguageSelection occurrence 1",
				),
				expect.stringContaining(
					"apps/web/src/routes/_authed/app/$brand/opportunities.tsx output-hook useArtifactLanguageSelection occurrence 1",
				),
				expect.stringContaining(
					"apps/web/src/routes/_authed/app/$brand/opportunities.tsx output-component OpportunitiesReport occurrence 1",
				),
			]),
		);
		expect(opportunityErrors.filter((error) => error.includes("ambient-ui-language useI18n"))).toHaveLength(2);
		expect(
			validateCrossPlanOwnershipFromSources([{ file: exact.file, source: "export const x = <p />;" }], [exact]),
		).toEqual(expect.arrayContaining([expect.stringContaining("stale or missing")]));
		expect(validateCrossPlanOwnershipFromSources(unresolved, [exact, exact])).toEqual(
			expect.arrayContaining([expect.stringContaining("duplicate")]),
		);
		expect(validateCrossPlanOwnershipFromSources(unresolved, [{ ...exact, file: "apps/web/src/**" }])).toEqual(
			expect.arrayContaining([expect.stringContaining("broad")]),
		);
		expect(
			validateCrossPlanOwnershipFromSources(
				[
					{
						file: "apps/web/src/components/new-output.tsx",
						source: "export function NewOutput({ outputLanguage }) { return <NovelPrint />; }",
					},
				],
				[],
			),
		).toEqual(expect.arrayContaining([expect.stringContaining("unregistered output-language dependency")]));
		for (const source of [
			'import { PromptsDisplay } from "@/components/prompts-display"; export function ArbitraryRoot({ outputLanguage }) { return <PromptsDisplay outputLanguage={outputLanguage} />; }',
			'import { useI18n } from "@/i18n/provider"; export function ArbitrarySurface() { useI18n(); return <p data-output-language="fixture" />; }',
			'import { BaseChart } from "./base-chart"; export function ArbitraryPreview({ outputLanguage }) { return <BaseChart outputLanguage={outputLanguage} />; }',
		]) {
			expect(
				validateCrossPlanOwnershipFromSources([{ file: "apps/web/src/components/connected-output.tsx", source }], []),
			).toEqual(expect.arrayContaining([expect.stringContaining("unregistered output-language dependency")]));
		}
		expect(
			validateCrossPlanOwnershipFromSources(
				[
					{
						file: "apps/web/src/components/new-output.tsx",
						source:
							"export function NewOutput({ outputLanguage }) { useOutputI18n(outputLanguage); return <NovelPrint outputLanguage={outputLanguage} />; }",
					},
				],
				[],
			),
		).toEqual(expect.arrayContaining([expect.stringContaining("output-component NovelPrint")]));
		expect(
			validateCrossPlanOwnershipFromSources(
				[
					{
						file: "apps/web/src/components/ui-bound-output.tsx",
						source:
							"export function UiBoundOutput({ uiLanguage }) { return <NovelPrint outputLanguage={uiLanguage} />; }",
					},
				],
				[],
			),
		).toEqual(expect.arrayContaining([expect.stringContaining("output-component NovelPrint")]));
		expect(
			validateCrossPlanOwnershipFromSources(
				[
					{
						file: "apps/web/src/components/ui-bound-export.tsx",
						source: "export function UiBoundExport({ uiLanguage }) { useChartExport({ outputLanguage: uiLanguage }); }",
					},
				],
				[],
			),
		).toEqual(expect.arrayContaining([expect.stringContaining("output-hook useChartExport")]));
		expect(
			validateCrossPlanOwnershipFromSources(
				[
					{
						file: "apps/web/src/components/fake-export.tsx",
						source:
							"function useChartExport() {} export function SampleOutput({ outputLanguage }) { useChartExport({ outputLanguage }); return <p />; }",
					},
				],
				[],
			),
		).toEqual(expect.arrayContaining([expect.stringContaining("output-hook useChartExport")]));
		expect(
			validateCrossPlanOwnershipFromSources(
				[
					{
						file: "apps/web/src/components/logged-output-language.tsx",
						source:
							"export function SampleOutput({ outputLanguage }) { console.log({ outputLanguage }); return <p />; }",
					},
				],
				[],
			),
		).toEqual(expect.arrayContaining([expect.stringContaining("output-language-binding SampleOutput")]));
		expect(
			validateCrossPlanOwnershipFromSources(
				[
					{
						file: "apps/web/src/components/intrinsic-output-language.tsx",
						source:
							"export function SampleOutput({ outputLanguage }) { return <div outputLanguage={outputLanguage} />; }",
					},
				],
				[],
			),
		).toEqual(expect.arrayContaining([expect.stringContaining("output-language-binding SampleOutput")]));
		expect(
			validateCrossPlanOwnershipFromSources(
				[
					{
						file: "apps/web/src/components/aliased-ui-output.tsx",
						source:
							"export function AliasedOutput({ uiLanguage }) { const outputLanguage = uiLanguage; return <NovelPrint outputLanguage={outputLanguage} />; }",
					},
				],
				[],
			),
		).toEqual(expect.arrayContaining([expect.stringContaining("output-component NovelPrint")]));
		expect(
			validateCrossPlanOwnershipFromSources(
				[
					{
						file: "apps/web/src/components/unknown-output.tsx",
						source:
							"export function SampleOutput({ outputLanguage }) { return <NovelPrint outputLanguage={outputLanguage} />; }",
					},
				],
				[],
			),
		).toEqual(expect.arrayContaining([expect.stringContaining("output-component NovelPrint")]));
		expect(
			validateCrossPlanOwnershipFromSources(
				[
					{
						file: "apps/web/src/components/imported-output.tsx",
						source:
							'import { BaseChartPrint as Printable } from "./base-chart-print"; export function SampleOutput({ outputLanguage }) { return <Printable outputLanguage={outputLanguage} />; }',
					},
				],
				[],
			),
		).toEqual(expect.arrayContaining([expect.stringContaining("output-component Printable")]));
		for (const [file, expression] of [
			["void-copy.tsx", "void copy"],
			["event-handler.tsx", "undefined"],
			["non-copy-logical.tsx", 'copy && "Hardcoded"'],
		] as const) {
			const rendered =
				file === "event-handler.tsx" ? "<button onClick={() => copy}>Hardcoded</button>" : `<p>{${expression}}</p>`;
			expect(
				validateCrossPlanOwnershipFromSources(
					[
						{
							file: `apps/web/src/components/${file}`,
							source: `import { getReportCopy } from "@/i18n/report-copy";
							 export function SampleOutput({ outputLanguage }) {
							 const copy = getReportCopy(outputLanguage); return ${rendered}; }`,
						},
					],
					[],
				),
			).toEqual(expect.arrayContaining([expect.stringContaining("output-language-binding SampleOutput")]));
		}
		for (const expression of ["copy.title", "flag && copy.title", "format(copy.title)"]) {
			expect(
				validateCrossPlanOwnershipFromSources(
					[
						{
							file: "apps/web/src/components/visible-copy.tsx",
							source: `import { getReportCopy } from "@/i18n/report-copy";
							 export function SampleOutput({ outputLanguage }) {
							 const copy = getReportCopy(outputLanguage); return <p>{${expression}}</p>; }`,
						},
					],
					[],
				),
			).toEqual(expect.arrayContaining([expect.stringContaining("output-copy getReportCopy")]));
		}
		expect(
			validateCrossPlanOwnershipFromSources(
				[
					{
						file: "apps/web/src/components/destructured-output.tsx",
						source:
							'import { BaseChartPrint } from "./base-chart-print"; export function SampleOutput(props) { const { outputLanguage: language } = props; return <BaseChartPrint outputLanguage={language} />; }',
					},
				],
				[],
			),
		).toEqual(expect.arrayContaining([expect.stringContaining("output-component BaseChartPrint")]));
		expect(
			validateCrossPlanOwnershipFromSources(
				[
					{
						file: "apps/web/src/components/true-output-alias.tsx",
						source:
							'import { BaseChartPrint } from "./base-chart-print"; export function SampleOutput({ outputLanguage }) { const uiLanguage = outputLanguage; return <BaseChartPrint outputLanguage={uiLanguage} />; }',
					},
				],
				[],
			),
		).toEqual(expect.arrayContaining([expect.stringContaining("output-component BaseChartPrint")]));
		expect(
			validateCrossPlanOwnershipFromSources(
				[
					{
						file: "apps/web/src/components/shadowed-output.tsx",
						source:
							'import { BaseChartPrint } from "./base-chart-print"; export function SampleOutput({ outputLanguage, uiLanguage }) { { const outputLanguage = uiLanguage; return <BaseChartPrint outputLanguage={outputLanguage} />; } }',
					},
				],
				[],
			),
		).toEqual(expect.arrayContaining([expect.stringContaining("output-component BaseChartPrint")]));
		expect(
			validateCrossPlanOwnershipFromSources(
				[
					{
						file: "apps/web/src/components/arbitrary-output-object.tsx",
						source:
							'import { BaseChartPrint } from "./base-chart-print"; export function SampleOutput({ outputLanguage }) { const settings = { outputLanguage }; const unrelated = { outputLanguage: "en" }; return <BaseChartPrint outputLanguage={unrelated.outputLanguage} data-settings={settings} />; }',
					},
				],
				[],
			),
		).toEqual(expect.arrayContaining([expect.stringContaining("output-language-binding SampleOutput")]));
		expect(
			validateCrossPlanOwnershipFromSources(
				[
					{
						file: "apps/web/src/components/i18n-locale-output.tsx",
						source:
							'import { useI18n } from "@/i18n/provider"; import { BaseChartPrint } from "./base-chart-print"; export function SampleOutput() { const { locale: outputLanguage } = useI18n(); return <BaseChartPrint outputLanguage={outputLanguage} />; }',
					},
				],
				[],
			),
		).toEqual(expect.arrayContaining([expect.stringContaining("output-component BaseChartPrint")]));
		expect(
			validateCrossPlanOwnershipFromSources(
				[
					{
						file: "apps/web/src/components/imported-export.tsx",
						source:
							'import { useChartExport as exportChart } from "@/hooks/use-chart-export"; export function SampleOutput({ outputLanguage }) { exportChart({ outputLanguage }); return <p />; }',
					},
				],
				[],
			),
		).toEqual(expect.arrayContaining([expect.stringContaining("output-hook useChartExport")]));
		expect(
			validateCrossPlanOwnershipFromSources(
				[
					{
						file: "apps/web/src/components/output-i18n-rendered.tsx",
						source:
							'import { useOutputI18n } from "@/i18n/output-i18n"; export function SampleOutput({ outputLanguage }) { const { t } = useOutputI18n(outputLanguage); return <p>{t("report.title")}</p>; }',
					},
				],
				[],
			),
		).toEqual(expect.arrayContaining([expect.stringContaining("output-copy useOutputI18n")]));
		for (const [file, source] of [
			[
				"apps/web/src/components/parser-only.tsx",
				'import { parseReportRenderLanguage } from "@/i18n/report-language"; export function SampleOutput({ outputLanguage }) { parseReportRenderLanguage(outputLanguage); return <p />; }',
			],
			[
				"apps/web/src/components/copy-discarded.tsx",
				'import { getReportCopy } from "@/i18n/report-copy"; export function SampleOutput({ outputLanguage }) { getReportCopy(outputLanguage); return <p />; }',
			],
		] as const) {
			expect(validateCrossPlanOwnershipFromSources([{ file, source }], [])).toEqual(
				expect.arrayContaining([expect.stringContaining("output-language-binding SampleOutput")]),
			);
		}
		expect(
			validateCrossPlanOwnershipFromSources(
				[
					{
						file: "apps/web/src/components/copy-rendered.tsx",
						source:
							'import { getReportCopy } from "@/i18n/report-copy"; export function SampleOutput({ outputLanguage }) { const copy = getReportCopy(outputLanguage); return <p>{copy.title}</p>; }',
					},
				],
				[],
			),
		).toEqual(expect.arrayContaining([expect.stringContaining("output-copy getReportCopy")]));
		expect(
			validateCrossPlanOwnershipFromSources(
				[
					{
						file: "apps/web/src/components/unused-output-language.tsx",
						source: "export function SampleOutput({ outputLanguage }) { return <p />; }",
					},
				],
				[],
			),
		).toEqual(expect.arrayContaining([expect.stringContaining("output-language-binding SampleOutput")]));
		expect(
			validateCrossPlanOwnershipFromSources(
				[
					{
						file: "apps/web/src/components/rendered-output-language.tsx",
						source: "export const SampleOutput = ({ outputLanguage }) => <p>{outputLanguage}</p>;",
					},
				],
				[],
			),
		).toEqual(expect.arrayContaining([expect.stringContaining("output-language-binding SampleOutput")]));
		expect(
			validateCrossPlanOwnershipFromSources(
				[
					{
						file: "apps/web/src/components/resolved-output-language.tsx",
						source:
							'import { getReportCopy } from "@/i18n/report-copy"; import { BaseChartPrint } from "./base-chart-print"; export function SampleOutput({ outputLanguage }) { const copy = getReportCopy(outputLanguage); return <BaseChartPrint outputLanguage={outputLanguage} title={copy.title} />; }',
					},
				],
				[],
			),
		).toEqual(expect.arrayContaining([expect.stringContaining("output-copy getReportCopy")]));

		const resolvedFile = "apps/web/src/components/attested-output.tsx";
		const resolvedSource =
			'import { BaseChartPrint as Printable } from "./base-chart-print"; export function SampleOutput({ outputLanguage }) { return <Printable outputLanguage={outputLanguage} />; }';
		const runtimeTest = "e2e/tests/portal-language.spec.ts";
		const knownRuntimeTests = new Set([runtimeTest]);
		const repositoryRoot = new URL("../../../..", import.meta.url).pathname.replace(/^\/(.:)/, "$1");
		expect(collectExistingRuntimeTests(repositoryRoot, [runtimeTest])).toEqual(knownRuntimeTests);
		const resolutions: CrossPlanResolution[] = [
			{
				file: resolvedFile,
				kind: "output-language-binding",
				value: "SampleOutput",
				occurrence: 1,
				owner: "portal-output-languages",
				task: "Task 4",
				resolution: "explicit-output-language",
				evidence: "Reviewed explicit output-language boundary.",
				runtimeTest,
			},
			{
				file: resolvedFile,
				kind: "output-component",
				value: "Printable",
				occurrence: 1,
				owner: "portal-output-languages",
				task: "Task 4",
				resolution: "explicit-output-language",
				evidence: "Reviewed explicit output-language boundary.",
				runtimeTest,
			},
		];
		expect(
			validateCrossPlanOwnershipFromSources(
				[{ file: resolvedFile, source: resolvedSource }],
				[],
				resolutions,
				knownRuntimeTests,
			),
		).toEqual([]);
		expect(
			validateCrossPlanOwnershipFromSources(
				[{ file: resolvedFile, source: resolvedSource }],
				[],
				resolutions.slice(1),
				knownRuntimeTests,
			),
		).toEqual(expect.arrayContaining([expect.stringContaining("output-language-binding SampleOutput")]));
		expect(
			validateCrossPlanOwnershipFromSources(
				[{ file: resolvedFile, source: resolvedSource }],
				[],
				[{ ...resolutions[0], value: "MissingSurface" } as CrossPlanResolution],
				knownRuntimeTests,
			),
		).toEqual(expect.arrayContaining([expect.stringContaining("stale or missing cross-plan resolution")]));

		for (const [invalidRuntimeTest, expectedError] of [
			["apps/web/src/i18n/missing-output-language.spec.ts", "does not name an existing regular file"],
			["C:/repo/e2e/tests/output-language.spec.ts", "must be repo-relative"],
			["../e2e/tests/output-language.spec.ts", "must not contain . or .. segments"],
			["e2e/tests/*.spec.ts", "must not contain glob syntax"],
			["e2e/tests/output-language.ts", "must use an allowed test suffix"],
			["e2e\\tests\\output-language.spec.ts", "must use POSIX separators"],
			["e2e/tests/./output-language.spec.ts", "must not contain . or .. segments"],
			["e2e//tests/output-language.spec.ts", "must be normalized"],
		] as const) {
			const invalidResolutions = resolutions.map((resolution) => ({ ...resolution, runtimeTest: invalidRuntimeTest }));
			expect(
				validateCrossPlanOwnershipFromSources(
					[{ file: resolvedFile, source: resolvedSource }],
					[],
					invalidResolutions,
					knownRuntimeTests,
				),
			).toEqual(expect.arrayContaining([expect.stringContaining(expectedError)]));
		}
	}, 20_000);

	it("follows arbitrary local artifact component names and aliases from an output-language root", () => {
		for (const [rootSource, resolvedRootSource] of [
			[
				'import { ArtifactCanvas as Canvas } from "./artifact-canvas"; export function OutputRoot({ outputLanguage }) { return <Canvas />; }',
				'import { ArtifactCanvas as Canvas } from "./artifact-canvas"; export function OutputRoot({ outputLanguage }) { return <Canvas outputLanguage={outputLanguage} />; }',
			],
			[
				'import { ArtifactCanvas } from "./artifact-canvas"; const CanvasAlias = ArtifactCanvas; export function OutputRoot({ outputLanguage }) { return <CanvasAlias />; }',
				'import { ArtifactCanvas } from "./artifact-canvas"; const CanvasAlias = ArtifactCanvas; export function OutputRoot({ outputLanguage }) { return <CanvasAlias outputLanguage={outputLanguage} />; }',
			],
		] as const) {
			const child = {
				file: "apps/web/src/components/artifact-canvas.tsx",
				source:
					'export function ArtifactCanvas({ outputLanguage }: { outputLanguage: "en" | "zh-CN" }) { return <div lang={outputLanguage} />; }',
			};
			const errors = validateCrossPlanOwnershipFromSources(
				[
					{
						file: "apps/web/src/components/output-root.tsx",
						source: rootSource,
					},
					child,
				],
				[],
			);

			expect(errors).toEqual(
				expect.arrayContaining([expect.stringMatching(/output-component Canvas(?:Alias)? occurrence 1/u)]),
			);
			expect(errors).toContain(
				`missing outputLanguage propagation: apps/web/src/components/output-root.tsx OutputRoot -> ${rootSource.includes("CanvasAlias") ? "CanvasAlias" : "Canvas"}`,
			);
			expect(
				validateCrossPlanOwnershipFromSources(
					[{ file: "apps/web/src/components/output-root.tsx", source: resolvedRootSource }, child],
					[],
				).some((error) => error.startsWith("missing outputLanguage propagation:")),
			).toBe(false);
		}
	});

	it("records only language-carrying, required, and connecting component edges", () => {
		const errors = validateCrossPlanOwnershipFromSources(
			[
				{
					file: "apps/web/src/components/semantic-output-root.tsx",
					source:
						'import { ArtifactCanvas } from "./semantic-artifact-canvas"; import { HistoryButton, TextHighlighter } from "./incidental-chrome"; export function SemanticOutputRoot({ outputLanguage }) { return <section lang={outputLanguage}><ArtifactCanvas outputLanguage={outputLanguage} /><TextHighlighter /><HistoryButton /></section>; }',
				},
				{
					file: "apps/web/src/components/semantic-artifact-canvas.tsx",
					source:
						'export function ArtifactCanvas({ outputLanguage }: { outputLanguage: "en" | "zh-CN" }) { return <div lang={outputLanguage} />; }',
				},
				{
					file: "apps/web/src/components/incidental-chrome.tsx",
					source:
						'export function TextHighlighter() { return <mark />; } export function HistoryButton() { return <button type="button" />; }',
				},
			],
			[],
		);
		expect(errors).toEqual(
			expect.arrayContaining([expect.stringContaining("output-component ArtifactCanvas occurrence 1")]),
		);
		expect(errors.some((error) => /output-component (?:TextHighlighter|HistoryButton)/u.test(error))).toBe(false);
	});

	it("resolves default, barrel, and namespace component aliases before checking language handoff", () => {
		const child = {
			file: "apps/web/src/components/artifact-surface.tsx",
			source:
				'export default function ArtifactSurface({ outputLanguage }: { outputLanguage: "en" | "zh-CN" }) { return <section lang={outputLanguage} />; } export { ArtifactSurface };',
		};
		const fixtures = [
			{
				root: 'import ArtifactCanvas from "./artifact-barrel"; export function CanvasHost({ outputLanguage }) { return <ArtifactCanvas />; }',
				barrel: 'export { default } from "./artifact-surface";',
				alias: "ArtifactCanvas",
			},
			{
				root: 'import { CanvasAlias as ArtifactCanvas } from "./artifact-barrel"; export function CanvasHost({ outputLanguage }) { return <ArtifactCanvas />; }',
				barrel: 'export { ArtifactSurface as CanvasAlias } from "./artifact-surface";',
				alias: "ArtifactCanvas",
			},
			{
				root: 'import * as surfaces from "./artifact-surface"; const ArtifactCanvas = surfaces.ArtifactSurface; export function CanvasHost({ outputLanguage }) { return <ArtifactCanvas />; }',
				barrel: "export {};",
				alias: "ArtifactCanvas",
			},
		] as const;

		for (const fixture of fixtures) {
			const errors = validateCrossPlanOwnershipFromSources(
				[
					{ file: "apps/web/src/components/canvas-host.tsx", source: fixture.root },
					{ file: "apps/web/src/components/artifact-barrel.ts", source: fixture.barrel },
					child,
				],
				[],
			);
			expect(errors).toContain(
				`missing outputLanguage propagation: apps/web/src/components/canvas-host.tsx CanvasHost -> ${fixture.alias}`,
			);
			expect(errors).toEqual(
				expect.arrayContaining([expect.stringContaining(`output-component ${fixture.alias} occurrence 1`)]),
			);
		}

		const wrappedErrors = validateCrossPlanOwnershipFromSources(
			[
				{
					file: "apps/web/src/components/wrapped-host.tsx",
					source:
						'import { ArtifactSurface as ArtifactCanvas } from "./wrapped-surface"; export function WrappedHost({ outputLanguage }) { return <ArtifactCanvas />; }',
				},
				{
					file: "apps/web/src/components/wrapped-surface.tsx",
					source:
						'import { forwardRef, memo } from "react"; export const ArtifactSurface = memo(forwardRef(({ outputLanguage }: { outputLanguage: "en" | "zh-CN" }, ref) => <section ref={ref} lang={outputLanguage} />));',
				},
			],
			[],
		);
		expect(wrappedErrors).toContain(
			"missing outputLanguage propagation: apps/web/src/components/wrapped-host.tsx WrappedHost -> ArtifactCanvas",
		);
		expect(wrappedErrors).toEqual(
			expect.arrayContaining([expect.stringContaining("output-component ArtifactCanvas occurrence 1")]),
		);

		const cyclicBarrelErrors = validateCrossPlanOwnershipFromSources(
			[
				{
					file: "apps/web/src/components/cyclic-host.tsx",
					source:
						'import { ArtifactCanvas } from "./barrel-a"; export function CyclicHost({ outputLanguage }) { return <ArtifactCanvas />; }',
				},
				{ file: "apps/web/src/components/barrel-a.ts", source: 'export * from "./barrel-b";' },
				{
					file: "apps/web/src/components/barrel-b.ts",
					source: 'export * from "./barrel-a"; export { ArtifactSurface as ArtifactCanvas } from "./artifact-surface";',
				},
				child,
			],
			[],
		);
		expect(cyclicBarrelErrors).toContain(
			"missing outputLanguage propagation: apps/web/src/components/cyclic-host.tsx CyclicHost -> ArtifactCanvas",
		);
	});

	it("resolves required outputLanguage through imported and wrapped component prop types", () => {
		const host = (importSource: string) => ({
			file: "apps/web/src/components/typed-host.tsx",
			source: `${importSource} export function TypedHost({ outputLanguage }) { return <ArtifactCanvas />; }`,
		});
		const propsSources = [
			{
				file: "apps/web/src/components/base-artifact-props.ts",
				source: 'export interface BaseArtifactProps { outputLanguage: "en" | "zh-CN" }',
			},
			{
				file: "apps/web/src/components/artifact-props.ts",
				source:
					'import type { BaseArtifactProps } from "./base-artifact-props"; export interface ArtifactProps extends BaseArtifactProps {}',
			},
		];
		const fixtures = [
			{
				importSource: 'import { ArtifactCanvas } from "./typed-artifact";',
				artifact:
					'import type { ArtifactProps } from "./artifact-props"; export function ArtifactCanvas({ outputLanguage }: ArtifactProps) { return <section lang={outputLanguage} />; }',
			},
			{
				importSource: 'import { ArtifactCanvas } from "./typed-artifact";',
				artifact:
					'import type { ArtifactProps } from "./artifact-props"; export const ArtifactCanvas: React.FC<ArtifactProps> = (props) => <section lang={props.outputLanguage} />;',
			},
			{
				importSource: 'import { ArtifactCanvas } from "./typed-artifact";',
				artifact:
					'import type { ArtifactProps } from "./artifact-props"; export const ArtifactCanvas = memo<ArtifactProps>((props) => <section lang={props.outputLanguage} />);',
			},
			{
				importSource: 'import { ArtifactCanvas } from "./typed-artifact";',
				artifact:
					'import type { ArtifactProps } from "./artifact-props"; export const ArtifactCanvas = forwardRef<HTMLElement, ArtifactProps>((props, ref) => <section ref={ref} lang={props.outputLanguage} />);',
			},
			{
				importSource: 'import ArtifactCanvas from "./typed-artifact";',
				artifact:
					'import type { ArtifactProps } from "./artifact-props"; export default function ({ outputLanguage }: ArtifactProps) { return <section lang={outputLanguage} />; }',
			},
			{
				importSource: 'import ArtifactCanvas from "./typed-artifact";',
				artifact:
					'import type { ArtifactProps } from "./artifact-props"; export default memo<ArtifactProps>((props) => <section lang={props.outputLanguage} />);',
			},
		] as const;

		for (const fixture of fixtures) {
			const errors = validateCrossPlanOwnershipFromSources(
				[
					host(fixture.importSource),
					{ file: "apps/web/src/components/typed-artifact.tsx", source: fixture.artifact },
					...propsSources,
				],
				[],
			);
			expect(errors, `${fixture.artifact}\n${errors.join("\n")}`).toContain(
				"missing outputLanguage propagation: apps/web/src/components/typed-host.tsx TypedHost -> ArtifactCanvas",
			);
		}
	});

	it("requires each runtime attestation to reach its exact source and belong to its Vitest project", () => {
		const productionFile = "apps/web/src/components/attested-output.tsx";
		const runtimeTest = "apps/web/src/components/attested-output.test.tsx";
		const productionSource =
			"export const Route = configure({ component: AttestedOutput }); export function AttestedOutput({ outputLanguage }) { return <div lang={outputLanguage} />; } export function Unrelated() { return null; }";
		const resolution: CrossPlanResolution = {
			file: productionFile,
			kind: "output-language-binding",
			value: "AttestedOutput",
			occurrence: 1,
			owner: "portal-output-languages",
			task: "Task 4",
			resolution: "explicit-output-language",
			evidence: "The real component binds the explicit output language at its artifact root.",
			runtimeTest,
		};
		const vitestConfig = `import { defineConfig as configureVitest } from "vitest/config";
			export default configureVitest({
			test: { projects: [
				{ test: { name: "unit", include: ["src/**/*.test.tsx"], exclude: ["src/**/*.browser.test.tsx"] } }
			] }
		});`;
		const validate = (testSource: string, testFile = runtimeTest) =>
			validateCrossPlanOwnershipFromSources(
				[
					{ file: productionFile, source: productionSource },
					{ file: testFile, source: testSource },
					{ file: "apps/web/vitest.config.ts", source: vitestConfig },
				],
				[],
				[{ ...resolution, runtimeTest: testFile }],
				new Set([testFile]),
			);

		expect(validate('import { Unrelated } from "./attested-output"; void Unrelated;')).toEqual(
			expect.arrayContaining([expect.stringContaining("does not reach exact source/symbol")]),
		);
		expect(validate('import { AttestedOutput as Output } from "./attested-output"; void Output;')).toEqual([]);
		expect(validate('import { Route } from "./attested-output"; void Route;')).toEqual([]);
		expect(validate('import * as output from "./attested-output"; void output.AttestedOutput;')).toEqual([]);
		expect(
			validateCrossPlanOwnershipFromSources(
				[
					{ file: productionFile, source: productionSource },
					{
						file: "apps/web/src/components/attested-barrel.ts",
						source: 'export { AttestedOutput as Output } from "./attested-output";',
					},
					{
						file: runtimeTest,
						source: 'import { Output } from "./attested-barrel"; void Output;',
					},
					{ file: "apps/web/vitest.config.ts", source: vitestConfig },
				],
				[],
				[resolution],
				new Set([runtimeTest]),
			),
		).toEqual([]);
		expect(
			validateCrossPlanOwnershipFromSources(
				[
					{ file: productionFile, source: productionSource },
					{
						file: runtimeTest,
						source: 'import { AttestedOutput } from "./attested-output"; void AttestedOutput;',
					},
				],
				[],
				[resolution],
				new Set([runtimeTest]),
			),
		).toEqual(expect.arrayContaining([expect.stringContaining("Vitest project configuration is unavailable")]));
		expect(
			validate(
				'import { vi } from "vitest"; vi.mock("./attested-output", () => ({ AttestedOutput: () => null })); import { AttestedOutput } from "./attested-output"; void AttestedOutput;',
			),
		).toEqual(expect.arrayContaining([expect.stringContaining("mock cuts exact source/symbol")]));
		expect(
			validate(
				'import { vi as mocker } from "vitest"; mocker.mock("./attested-output", () => ({ AttestedOutput: () => null })); import { AttestedOutput } from "./attested-output"; void AttestedOutput;',
			),
		).toEqual(expect.arrayContaining([expect.stringContaining("mock cuts exact source/symbol")]));
		expect(
			validate(
				'import { vi as mocker } from "vitest"; mocker.mock("./attested-output", async () => ({ ...(await mocker.importActual("./attested-output")), Unrelated: () => null })); import { AttestedOutput } from "./attested-output"; void AttestedOutput;',
			),
		).toEqual([]);
		expect(
			validate(
				'import * as vt from "vitest"; vt.vi.mock("./attested-output", () => ({ AttestedOutput: () => null })); import { AttestedOutput } from "./attested-output"; void AttestedOutput;',
			),
		).toEqual(expect.arrayContaining([expect.stringContaining("mock cuts exact source/symbol")]));
		expect(
			validate(
				'import { vi } from "vitest"; const mocker = vi; mocker.mock("./attested-output", () => ({ AttestedOutput: () => null })); import { AttestedOutput } from "./attested-output"; void AttestedOutput;',
			),
		).toEqual(expect.arrayContaining([expect.stringContaining("mock cuts exact source/symbol")]));
		expect(
			validate(
				'const vi = { mock() {} }; vi.mock("./attested-output", () => ({ AttestedOutput: () => null })); import { AttestedOutput } from "./attested-output"; void AttestedOutput;',
			),
		).toEqual([]);
		expect(
			validate(
				'import { vi } from "vitest"; function decoy(vi) { vi.mock("./attested-output", () => ({ AttestedOutput: () => null })); } void decoy; import { AttestedOutput } from "./attested-output"; void AttestedOutput;',
			),
		).toEqual([]);
		expect(
			validate(
				'import { vi } from "vitest"; vi.mock("./attested-output", async () => ({ ...(await vi.importActual("./attested-output")), Unrelated: () => null })); import { AttestedOutput } from "./attested-output"; void AttestedOutput;',
			),
		).toEqual([]);
		expect(
			validate(
				'import { vi } from "vitest"; vi.mock("./attested-output", async () => ({ ...(await vi.importActual("./attested-output")), AttestedOutput: () => null })); import { AttestedOutput } from "./attested-output"; void AttestedOutput;',
			),
		).toEqual(expect.arrayContaining([expect.stringContaining("mock cuts exact source/symbol")]));
		const decoyConfig = `const decoy = { name: "unit", include: ["src/**/*.test.tsx"] };
			export default defineConfig({ test: { projects: [] } });`;
		expect(
			validateCrossPlanOwnershipFromSources(
				[
					{ file: productionFile, source: productionSource },
					{
						file: runtimeTest,
						source: 'import { AttestedOutput } from "./attested-output"; void AttestedOutput;',
					},
					{ file: "apps/web/vitest.config.ts", source: decoyConfig },
				],
				[],
				[resolution],
				new Set([runtimeTest]),
			),
		).toEqual(expect.arrayContaining([expect.stringContaining("Vitest project configuration is unavailable")]));
		const localDefineConfigDecoy = `function defineConfig(value) { return value; }
			export default defineConfig({ test: { projects: [
				{ test: { name: "unit", include: ["src/**/*.test.tsx"] } }
			] } });`;
		expect(
			validateCrossPlanOwnershipFromSources(
				[
					{ file: productionFile, source: productionSource },
					{
						file: runtimeTest,
						source: 'import { AttestedOutput } from "./attested-output"; void AttestedOutput;',
					},
					{ file: "apps/web/vitest.config.ts", source: localDefineConfigDecoy },
				],
				[],
				[resolution],
				new Set([runtimeTest]),
			),
		).toEqual(expect.arrayContaining([expect.stringContaining("Vitest project configuration is unavailable")]));

		const parentFile = "apps/web/src/components/attested-parent.tsx";
		const childResolution: CrossPlanResolution = {
			...resolution,
			file: parentFile,
			kind: "output-component",
			value: "AttestedOutput",
		};
		const validateMockedDependency = (
			parentImport: string,
			runtimeSource: string,
			extraSources: Array<{ file: string; source: string }> = [],
		) =>
			validateCrossPlanOwnershipFromSources(
				[
					{ file: productionFile, source: productionSource },
					{
						file: parentFile,
						source: `${parentImport} export function AttestedParent({ outputLanguage }) { return <AttestedOutput outputLanguage={outputLanguage} />; }`,
					},
					...extraSources,
					{ file: runtimeTest, source: runtimeSource },
					{ file: "apps/web/vitest.config.ts", source: vitestConfig },
				],
				[],
				[childResolution],
				new Set([runtimeTest]),
			);
		expect(
			validateMockedDependency(
				'import { AttestedOutput } from "./attested-output";',
				'import { vi } from "vitest"; vi.mock("./attested-output", () => ({ AttestedOutput: () => null })); import { AttestedParent } from "./attested-parent"; void AttestedParent;',
			),
		).toEqual(expect.arrayContaining([expect.stringContaining("mock cuts exact source/symbol")]));
		expect(
			validateMockedDependency(
				'import { AttestedOutput } from "./attested-barrel";',
				'import { vi } from "vitest"; vi.mock("./attested-barrel", () => ({ AttestedOutput: () => null })); import { AttestedParent } from "./attested-parent"; void AttestedParent;',
				[
					{
						file: "apps/web/src/components/attested-barrel.ts",
						source: 'export { AttestedOutput } from "./attested-output";',
					},
				],
			),
		).toEqual(expect.arrayContaining([expect.stringContaining("mock cuts exact source/symbol")]));
		expect(
			validate(
				'import { AttestedOutput } from "./attested-output"; void AttestedOutput;',
				"apps/web/src/components/attested-output.browser.test.tsx",
			),
		).toEqual(expect.arrayContaining([expect.stringContaining("is not included in corresponding Vitest project")]));
	});

	it("discovers output surfaces conservatively regardless of dead flow, mutation, slots, aliases, or apparent binding", () => {
		const fixtures = [
			{
				file: "dead-jsx.tsx",
				source:
					'import { BaseChartPrint } from "./base-chart-print"; export function SampleOutput({ outputLanguage }) { const discarded = <BaseChartPrint outputLanguage={outputLanguage} />; return <p />; }',
				expected: "output-component BaseChartPrint",
			},
			{
				file: "dead-return.tsx",
				source:
					'import { BaseChartPrint } from "./base-chart-print"; export function SampleOutput({ outputLanguage }) { if (false) return <BaseChartPrint outputLanguage={outputLanguage} />; return <p />; }',
				expected: "output-component BaseChartPrint",
			},
			{
				file: "dead-hook.tsx",
				source:
					'import { useChartExport } from "@/hooks/use-chart-export"; export function SampleOutput({ outputLanguage }) { if (false) useChartExport({ outputLanguage }); return <p />; }',
				expected: "output-hook useChartExport",
			},
			{
				file: "reassigned.tsx",
				source:
					'import { BaseChartPrint } from "./base-chart-print"; export function SampleOutput({ outputLanguage, uiLanguage }) { let language = outputLanguage; language = uiLanguage; return <BaseChartPrint outputLanguage={language} />; }',
				expected: "output-component BaseChartPrint",
			},
			{
				file: "destructured-slot.tsx",
				source:
					'import { getReportCopy } from "@/i18n/report-copy"; export function SampleOutput({ outputLanguage }) { const copy = getReportCopy(outputLanguage); const [visible, hidden] = ["English only", copy.title]; return <p>{visible}</p>; }',
				expected: "output-copy getReportCopy",
			},
			{
				file: "non-copy-property.tsx",
				source:
					'import { getReportCopy } from "@/i18n/report-copy"; export function SampleOutput({ outputLanguage }) { const copy = getReportCopy(outputLanguage); return <p>{copy.title.length}</p>; }',
				expected: "output-copy getReportCopy",
			},
			{
				file: "local-alias.tsx",
				source:
					'import { BaseChartPrint } from "./base-chart-print"; const Artifact = BaseChartPrint; export function SampleOutput({ outputLanguage }) { return <Artifact outputLanguage={outputLanguage} />; }',
				expected: "output-component Artifact",
			},
			{
				file: "barrel-alias.tsx",
				source:
					'import { BaseChartPrint as Artifact } from "@/components"; export function SampleOutput({ outputLanguage }) { return <Artifact outputLanguage={outputLanguage} />; }',
				expected: "output-component Artifact",
			},
			{
				file: "hoc-alias.tsx",
				source:
					'import { memo } from "react"; import { BaseChartPrint } from "./base-chart-print"; const Artifact = memo(BaseChartPrint); export function SampleOutput({ outputLanguage }) { return <Artifact outputLanguage={outputLanguage} />; }',
				expected: "output-component Artifact",
			},
			{
				file: "namespace-copy.tsx",
				source:
					'import * as reportCopy from "@/i18n/report-copy"; export function Artifact(props) { return <p>{reportCopy.getReportCopy(props.outputLanguage).title}</p>; }',
				expected: "output-copy getReportCopy",
			},
		];

		for (const fixture of fixtures) {
			expect(
				validateCrossPlanOwnershipFromSources(
					[{ file: `apps/web/src/components/${fixture.file}`, source: fixture.source }],
					[],
				),
			).toEqual(expect.arrayContaining([expect.stringContaining(fixture.expected)]));
		}
	});

	it("does not file-wide exempt an unrelated literal in an output-language-owned file", () => {
		const candidates = collectPortalLanguageCandidatesFromSource(
			"apps/web/src/components/base-chart-print.tsx",
			"export const x = <p>New unrelated literal</p>;",
		);

		expect(validateExactClassifications(candidates, [])).toEqual(
			expect.arrayContaining([expect.stringContaining("New unrelated literal")]),
		);
	});

	it("keeps the current portal tree, route headers, and shared compatibility call sites classified", () => {
		const result = runPortalLanguageAudit();
		const categoryCounts = result.classifications.reduce<Record<string, number>>((counts, entry) => {
			counts[entry.category] = (counts[entry.category] ?? 0) + 1;
			return counts;
		}, {});
		console.info(
			`[portal-language-audit] files=${result.filesAudited} candidates=${result.candidates.length} classifications=${result.classifications.length} categories=${JSON.stringify(categoryCounts)}`,
		);

		expect(result.errors, result.errors.join("\n")).toEqual([]);
		expect(result.filesAudited).toBeGreaterThan(100);
		expect(result.candidates.length).toBeGreaterThan(100);
		expect(result.classifications.length).toBeGreaterThan(0);
	}, 20_000);
});
