# Yonaris Site Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create one typed foundation for every public Yonaris route, bilingual fact, shell, SEO surface, and human/Agent representation.

**Architecture:** A route-family manifest classifies every current public route and owns canonical, navigation, indexing, sitemap, redirect, and Agent policy. Focused `content/site` modules hold bilingual facts with explicit claim status. Shared core/publication/utility shells and manifest-driven SEO replace the split Yonaris/Elmo identity. Machine documents and Markdown content negotiation reuse the current internal rewrite pattern.

**Tech Stack:** TypeScript 7, React 19, TanStack Start/Router, Vite 8, Vitest 4, Playwright 1.61, Tailwind CSS 4.

**Spec:** `docs/superpowers/specs/2026-08-22-full-site-rebuild-design.md`

## Global Constraints

- Category is `AI-native MarTech`; vision is `MarTech, rebuilt. For humans and agents.`
- Binding palette only: Ink `#0B1220`, Paper `#F6F4F1`, Slate `#1E2A39`, Stone `#8A95A3`, Mist `#DDE2E8`, Signal Orange `#FF6A00`, optional Blue Gray `#2F3E50`.
- Core canonicals are `/`, `/product`, `/approach`, `/research`, `/company`, `/geo`, `/diagnostic` and their approved Chinese counterparts.
- GEO is the first applied workflow, never the category ceiling.
- Do not publish Product Truth Graph, Commercial Feedback module, automatic remediation, causal attribution, universal real-time coverage, self-service execution, or the unaudited `0% → 93.3%` result.
- Every public route is classified; unreviewed legacy content remains crawlable but `noindex,follow` and outside the sitemap.
- Every core human canonical supports `Accept: text/markdown` from the same fact source as HTML and Agent documents.
- Keep `apps/web`, worker, database, portal authorization, status data acquisition, OpenAPI, RSS, and OG generation behavior unchanged.
- Never hand-edit `apps/www/src/routeTree.gen.ts`.
- Use TDD for each behavior.

---

### Task 1: Classify the complete public route surface

**Files:**
- Create: `apps/www/src/content/site/types.ts`
- Create: `apps/www/src/lib/site-manifest.ts`
- Create: `apps/www/src/lib/site-manifest.test.ts`
- Create: `apps/www/scripts/audit-site-manifest.ts`
- Modify: `apps/www/vitest.config.ts`
- Modify: `apps/www/package.json`

**Interfaces:**

```ts
export type Locale = "en" | "zh";
export type CorePageKey = "home" | "product" | "approach" | "research" | "company" | "geo" | "diagnostic";
export type AgentPageKey = Exclude<CorePageKey, "home">;
export type ClaimStatus = "current-software" | "managed-delivery" | "verified-evidence" | "illustrative" | "direction";
export interface FactualClaim { id: string; status: ClaimStatus; text: string; limitation?: string }
export type SiteRouteClass = "core" | "resource" | "utility" | "legacy" | "machine";
export type IndexPolicy = "index,follow" | "noindex,follow";
export const SITE_ROUTE_KEYS = [
  "home", "product", "approach", "research", "company", "geo", "diagnostic",
  "resources", "openSource", "privacy", "blog", "glossary", "docs", "status",
  "brand", "changelog", "roadmap", "aiSearch", "aeoFor", "aiVisibility",
  "agent", "llms", "sitemap", "robots", "rss", "api", "og", "repoActivity", "markdownInternal",
] as const;
export type SiteRouteKey = (typeof SITE_ROUTE_KEYS)[number];
export interface SiteRouteDefinition {
  key: SiteRouteKey;
  routeClass: SiteRouteClass;
  canonicals: Partial<Record<Locale, `/${string}`>>;
  patterns?: readonly `/${string}`[];
  navigation: readonly ("primary" | "footer" | "contextual" | "utility")[];
  indexPolicy: IndexPolicy;
  agentPath?: `/${string}`;
  sitemap: false | { priority: number; lastVerified?: `${number}-${number}-${number}` };
}
export interface RedirectRule { from: `/${string}`; to: `/${string}`; statusCode: 308 }
export const SITE_MANIFEST: readonly SiteRouteDefinition[];
export const SITE_REDIRECTS: readonly RedirectRule[];
export function getSiteRoute(key: SiteRouteKey): SiteRouteDefinition;
export function findSiteRoute(pathname: string): SiteRouteDefinition | undefined;
export function getCorePath(key: CorePageKey, locale: Locale): string;
export function getRedirect(pathname: string): RedirectRule | undefined;
export function getCoreLastVerified(key: CorePageKey): `${number}-${number}-${number}`;
```

- [ ] **Step 1: Expand Vitest discovery and write the failing manifest tests**

Change Vitest include to `src/**/*.test.{ts,tsx}`. Test canonical uniqueness, all 14 bilingual core paths, primary navigation order, `indexPolicy`, Agent mappings, redirect target validity, no redirect cycles, and classification of every route pattern returned by a filesystem audit.

```ts
expect(getCorePath("product", "zh")).toBe("/zh/product");
expect(SITE_REDIRECTS).toContainEqual({ from: "/platform", to: "/product", statusCode: 308 });
expect(findSiteRoute("/ai-visibility-tools/elmo-vs-example")?.indexPolicy).toBe("noindex,follow");
```

Run `pnpm.cmd --filter @workspace/www test -- src/lib/site-manifest.test.ts`; expected FAIL because the manifest does not exist.

- [ ] **Step 2: Implement every route family**

Use `SITE_ROUTE_KEYS` as the compile-time authority and define `SITE_MANIFEST` with `as const satisfies readonly SiteRouteDefinition[]`; test that the two sets are identical so misspelled or missing keys fail. Classify 14 core canonicals; `/resources`, `/open-source`, `/privacy`; Blog/Glossary publication families; Docs/Status/Brand/Changelog utility families; Roadmap as noindex utility; AI Search/AEO/AI Visibility Tools legacy families; Agent/llms/sitemap/robots/RSS/API/OG/repo-activity/internal Markdown machine or utility families. Add approved company redirects plus old Agent redirects. Every core entry has the release-approved real verification date `2026-08-22`; `getCoreLastVerified()` derives from that manifest field. Tests validate ISO calendar dates on all seven core entries. Utilities and historical families omit `lastVerified` unless a later evidence-backed review supplies one.

- [ ] **Step 3: Add the audit script and verify GREEN**

`audit-site-manifest.ts` scans `src/routes` for `createFileRoute()` patterns, normalizes TanStack `$` segments to family matchers, and exits non-zero with the unclassified patterns. Add package script `audit:site-manifest`.

```powershell
pnpm.cmd --filter @workspace/www test -- src/lib/site-manifest.test.ts
pnpm.cmd --filter @workspace/www audit:site-manifest
```

- [ ] **Step 4: Commit**

```powershell
git add apps/www/vitest.config.ts apps/www/package.json apps/www/src/content/site/types.ts apps/www/src/lib/site-manifest* apps/www/scripts/audit-site-manifest.ts
git commit -m "classify the complete public site"
```

### Task 2: Split the bilingual fact model and enforce claim status

**Files:**
- Create: `apps/www/src/content/site/global.ts`
- Create: `apps/www/src/content/site/product.ts`
- Create: `apps/www/src/content/site/approach.ts`
- Create: `apps/www/src/content/site/research.ts`
- Create: `apps/www/src/content/site/company.ts`
- Create: `apps/www/src/content/site/geo.ts`
- Create: `apps/www/src/content/site/diagnostic.ts`
- Create: `apps/www/src/content/site/resources.ts`
- Create: `apps/www/src/content/site/index.ts`
- Create: `apps/www/src/content/site/content-parity.test.ts`
- Modify only after consumers move: `apps/www/src/lib/marketing-content.ts`
- Modify: `apps/www/src/lib/marketing-content.test.ts`

**Interfaces:**

```ts
export interface CoreFacts { title: string; currentScope: string; claims: readonly FactualClaim[]; limitations: readonly string[] }
export interface CorePageContentMap { home: GlobalContent; product: ProductContent; approach: ApproachContent; research: ResearchContent; company: CompanyContent; geo: GeoContent; diagnostic: DiagnosticContent }
export function getCorePageContent<K extends CorePageKey>(key: K, locale: Locale): CorePageContentMap[K];
export function getCoreFacts(key: CorePageKey, locale: Locale): CoreFacts;
export function getGlobalContent(locale: Locale): GlobalContent;
export function getProductContent(locale: Locale): ProductContent;
export function getApproachContent(locale: Locale): ApproachContent;
export function getResearchContent(locale: Locale): ResearchContent;
export function getCompanyContent(locale: Locale): CompanyContent;
export function getGeoContent(locale: Locale): GeoContent;
export function getDiagnosticContent(locale: Locale): DiagnosticContent;
```

Each page module exports its content type, `pageEn`, `pageZh`, immutable locale record, and getter. Every top-level content object has `meta`, `currentScope`, `claims`, and `limitations`.

- [ ] **Step 1: Write failing deep-parity and truth tests**

```ts
for (const key of ["home", "product", "approach", "research", "company", "geo", "diagnostic"] as const) {
  expect(structureOf(getCorePageContent(key, "zh"))).toEqual(structureOf(getCorePageContent(key, "en")));
}
const serialized = JSON.stringify([getCorePageContent("product", "en"), getCorePageContent("research", "en")]);
for (const banned of ["Product Truth Graph", "Commercial Feedback", "0% → 93.3%", "automatic optimization"]) expect(serialized).not.toContain(banned);
```

Run `pnpm.cmd --filter @workspace/www test -- src/content/site/content-parity.test.ts`; expected FAIL.

- [ ] **Step 2: Implement independently written English/Chinese content**

Use stable claim IDs/statuses in both locales. Product reflects observable configured sampling and managed opportunities; Approach includes non-causality; Research contains only illustrative evidence; Company declares early service-led stage; GEO states the applied-workflow boundary; Diagnostic states confirmation-before-collection.

- [ ] **Step 3: Preserve compatibility while moving consumers and verify GREEN**

`marketing-content.ts` temporarily re-exports new types/getters while its old page data remains only for unmigrated consumers. Do not delete the facade until the integration plan proves zero consumers.

```powershell
pnpm.cmd --filter @workspace/www test -- src/content/site/content-parity.test.ts marketing-content.test.ts
```

- [ ] **Step 4: Commit**

```powershell
git add apps/www/src/content/site apps/www/src/lib/marketing-content.ts apps/www/src/lib/marketing-content.test.ts
git commit -m "model truthful bilingual site content"
```

### Task 3: Generate SEO, hreflang, and sitemap from the manifest

**Files:**
- Create: `apps/www/src/lib/site-seo.ts`
- Create: `apps/www/src/lib/site-seo.test.ts`
- Create: `apps/www/src/lib/sitemap.ts`
- Create: `apps/www/src/lib/sitemap.test.ts`
- Modify: `apps/www/src/lib/seo.ts`
- Modify: `apps/www/src/routes/sitemap[.]xml.ts`
- Modify: `apps/www/src/routes/robots[.]txt.ts`
- Modify during page migrations: all public route `head` definitions.

**Interfaces:**

```ts
export function corePageHead(pageKey: CorePageKey, locale: Locale): { meta: object[]; links: object[]; scripts?: object[] };
export function supportingPageHead(routeKey: Extract<SiteRouteKey, "resources" | "openSource" | "privacy">): { meta: object[]; links: object[] };
export function siteRouteHead(routeKey: SiteRouteKey, options: { canonicalPath: `/${string}`; title: string; description: string; locale?: Locale }): { meta: object[]; links: object[] };
export function routeRobotsMeta(routeKey: SiteRouteKey): { name: "robots"; content: IndexPolicy } | undefined;
export interface SitemapEntry { path: string; priority: number; lastVerified?: string; alternates?: readonly { hreflang: "en" | "zh-CN" | "x-default"; path: string }[] }
export function buildSitemapEntries(): readonly SitemapEntry[];
export function renderSitemap(origin: string): string;
```

- [ ] **Step 1: Write failing SEO and sitemap tests**

Assert core canonical/alternate pairs, `x-default`, `xmlns:xhtml`, reciprocal sitemap alternates, only approved `index,follow` entries, no machine/legacy/redirect URLs, and no fabricated `lastmod` for unverified utilities.

- [ ] **Step 2: Implement manifest-driven head and sitemap rendering**

Organization/WebSite structured data uses Yonaris only. Robots allows crawling and points to sitemap; every HTML page with `noindex,follow` emits the exact robots meta through `siteRouteHead()`/`routeRobotsMeta()`, never only through `Disallow` or an optional header. `siteRouteHead()` accepts the concrete canonical path for dynamic publication/legacy pages, preserves their content-specific title/description, and adds the manifest policy. Governance Task 2 mounts this helper on every migrated publication, utility, and legacy route.

- [ ] **Step 3: Verify and commit**

```powershell
pnpm.cmd --filter @workspace/www test -- src/lib/site-seo.test.ts src/lib/sitemap.test.ts
git add apps/www/src/lib/site-seo* apps/www/src/lib/sitemap* apps/www/src/lib/seo.ts apps/www/src/routes/sitemap* apps/www/src/routes/robots*
git commit -m "drive site discovery from the manifest"
```

### Task 4: Unify shells and isolate page CSS

**Files:**
- Create: `apps/www/src/components/site/site-header.tsx`
- Create: `apps/www/src/components/site/site-footer.tsx`
- Create: `apps/www/src/components/site/site-shell.tsx`
- Create: `apps/www/src/components/site/publication-shell.tsx`
- Create: `apps/www/src/components/site/utility-shell.tsx`
- Create: `apps/www/src/components/site/legacy-archive-context.tsx`
- Create: `apps/www/src/components/site/site-shell.test.tsx`
- Create: `apps/www/src/lib/site-navigation.ts`
- Create: `apps/www/src/styles/site-core.css`
- Create: `apps/www/src/styles/pages/home.css`
- Create: `apps/www/src/styles/pages/product.css`
- Create: `apps/www/src/styles/pages/approach.css`
- Create: `apps/www/src/styles/pages/research.css`
- Create: `apps/www/src/styles/pages/company.css`
- Create: `apps/www/src/styles/pages/geo.css`
- Create: `apps/www/src/styles/pages/diagnostic.css`
- Modify: `apps/www/src/components/marketing/marketing-shell.tsx`
- Modify: `apps/www/src/components/marketing/detail-page.tsx`
- Modify: `apps/www/src/components/marketing/diagnostic-form.tsx`
- Modify: `apps/www/src/components/marketing/diagnostic-page.tsx`
- Modify: `apps/www/src/components/marketing/home-page.tsx`
- Modify: `apps/www/src/components/marketing/marketing-link.tsx`
- Modify: `apps/www/src/components/marketing/section.tsx`
- Modify: `apps/www/src/components/navbar.tsx`
- Modify: `apps/www/src/components/footer.tsx`
- Modify: `apps/www/src/styles.css`
- Modify: `apps/www/src/styles.test.ts`
- Modify: `e2e/www-tests/homepage.spec.ts`

**Interfaces:**

```ts
export function SiteHeader(props: { locale: Locale; activeKey?: CorePageKey }): React.ReactNode;
export function SiteFooter(props: { locale: Locale }): React.ReactNode;
export function SiteShell(props: { locale: Locale; activeKey?: CorePageKey; children: React.ReactNode; mainClassName?: string }): React.ReactNode;
export function PublicationShell(props: { section: "blog" | "glossary" | "ai-search" | "aeo-for"; children: React.ReactNode; archiveContext?: "legacy-research" }): React.ReactNode;
export function UtilityShell(props: { section: "docs" | "status" | "brand" | "changelog" | "roadmap" | "open-source"; children: React.ReactNode }): React.ReactNode;
export function LegacyArchiveContext(props: { kind: "legacy-research" | "upstream-comparison" }): React.ReactNode;
```

`SiteShell` owns the only `<main>` landmark. `PublicationShell` composes `LegacyArchiveContext`; the `/ai-visibility-tools/**` migration later uses the same primitive with `kind="upstream-comparison"`. `site-navigation.ts` derives canonical links from `SITE_MANIFEST`/`getCorePath()` and exposes the tested Portal constant `https://portal.yonaris.com`; it must not read legacy alias navigation from `marketing-content.ts`.

- [ ] **Step 1: Write failing rendered-shell and style-token tests**

Render `SiteHeader`/`SiteFooter` primitives without TanStack Link context and assert ordered primary canonical paths, secondary Portal, one visible diagnostic action per presentation, localized navigation, active page state, Resources/Open Source/Status/Privacy/Agent/llms footer links, and absence of Provider Status/Docs-first identity. Static-render zero-prop `Navbar`/`Footer` wrappers to prove router independence. Add Playwright RED behavior at 390px for Enter/Space opening, Escape close with focus restoration, link-selection close without relying on navigation, a 44px minimum trigger, and zero horizontal overflow. Replace stale homepage assertions for `/platform`, `/methodology`, `/results` with `/product`, `/approach`, `/research`; remove the obsolete dark-supporting-header contract and do not navigate to not-yet-created routes. Assert `styles.css` imports every focused stylesheet, Product Stage selectors live only in `pages/home.css`, and all first-party site CSS/marketing consumers contain no radial gradient or unapproved `surface/signal-strong` tokens.

- [ ] **Step 2: Implement shell primitives and compatibility wrappers**

Header uses plain anchors, semantic navigation, `aria-current`, a deterministically closed SSR mobile disclosure, Escape focus restoration, link-selection close, locale preservation, secondary Portal, and the sole visible primary diagnostic action in desktop/mobile presentations. Old zero-prop Navbar/Footer become English wrappers immediately. `MarketingShell` maps the legacy page keys `platform→product`, `methodology→approach`, and `results→research` without preserving alias hrefs. `styles.css` remains the Tailwind/third-party entry manifest; shared tokens/base/prose move to `site-core.css`, Product Stage selectors and their responsive/reduced-motion behavior move to `home.css`, and every existing consumer is migrated from Surface/Signal Strong to approved Paper/Mist/Signal Orange tokens. Keep shared shell CSS namespaced so Fumadocs and publication prose are not disturbed.

- [ ] **Step 3: Verify unit and homepage browser GREEN**

```powershell
pnpm.cmd --filter @workspace/www test -- src/components/site/site-shell.test.tsx src/styles.test.ts
pnpm.cmd --filter e2e exec playwright test --config playwright.www.config.ts homepage.spec.ts
```

- [ ] **Step 4: Commit**

```powershell
git add apps/www/src/components/site apps/www/src/components/marketing/detail-page.tsx apps/www/src/components/marketing/diagnostic-form.tsx apps/www/src/components/marketing/diagnostic-page.tsx apps/www/src/components/marketing/home-page.tsx apps/www/src/components/marketing/marketing-link.tsx apps/www/src/components/marketing/marketing-shell.tsx apps/www/src/components/marketing/section.tsx apps/www/src/components/navbar.tsx apps/www/src/components/footer.tsx apps/www/src/lib/site-navigation.ts apps/www/src/styles.css apps/www/src/styles/site-core.css apps/www/src/styles/pages apps/www/src/styles.test.ts e2e/www-tests/homepage.spec.ts
git commit -m "unify the public site shell"
```

### Task 5: Generate machine documents and extend existing Markdown rewrites

**Execution dependency:** Run this task after Plans 2 and 3 have created all fourteen core human route modules. Tasks 1–4 of this plan run first; Task 5 is the foundation's integration tail.

**Files:**
- Create: `apps/www/src/lib/machine-documents.ts`
- Create: `apps/www/src/lib/machine-documents.test.ts`
- Create: `apps/www/src/lib/markdown-negotiation.ts`
- Create: `apps/www/src/lib/markdown-negotiation.test.ts`
- Create: `apps/www/src/routes/agent/product.ts`
- Create: `apps/www/src/routes/agent/approach.ts`
- Create: `apps/www/src/routes/agent/research.ts`
- Create: `apps/www/src/routes/agent/geo.ts`
- Create: `apps/www/src/routes/agent/diagnostic.ts`
- Create: `apps/www/src/routes/llms[.]mdx.site.$.ts`
- Create: `e2e/www-tests/content-negotiation.spec.ts`
- Modify: `apps/www/src/routes/agent/index.tsx`
- Modify: `apps/www/src/routes/agent/company.ts`
- Modify: `apps/www/src/routes/llms[.]txt.ts`
- Modify: `apps/www/src/routes/llms-full[.]txt.ts`
- Modify: `apps/www/src/server.ts`

**Interfaces:**

```ts
export function renderCoreMarkdown(key: CorePageKey, locale: Locale): string;
export function renderAgentDocument(key: AgentPageKey): string;
export function renderAgentIndex(): string;
export function renderLlmsIndex(): string;
export function renderLlmsFull(): string;
export interface MarkdownResolution { targetPath?: string; variesOnAccept: boolean }
export function resolveMarkdownRequest(request: Request): MarkdownResolution;
```

- [ ] **Step 1: Write failing machine-parity tests**

Require each Agent document to include human canonical, both locale URLs, last verified, current scope, and limitations. Its date must equal `getCoreLastVerified(key)`; no renderer owns a second date literal. Require `/agent` index and llms to list all 14 human canonicals with `zh-CN` metadata and all six Agent docs. Assert the manifest registers legacy Agent 308 rules; Plan 4 owns the old route-file redirect implementation.

- [ ] **Step 2: Write failing negotiation tests**

Test `/`, `/zh`, all 14 core canonicals, HTML preference, Markdown preference, `Vary: Accept` on both negotiated variants, old aliases not rewritten, and Docs `.md`/`.mdx` regression.

- [ ] **Step 3: Implement machine renderers and hidden site Markdown route**

The hidden route `/llms.mdx/site/{locale}/{pageKey}` returns `text/markdown; charset=utf-8`. `server.ts` extends its existing Docs rewrite logic to map Markdown-preferred core requests to that route, then passes through the normal TanStack handler and security headers. Do not short-circuit the handler.

- [ ] **Step 4: Verify and commit**

```powershell
pnpm.cmd --filter @workspace/www test -- src/lib/machine-documents.test.ts src/lib/markdown-negotiation.test.ts
pnpm.cmd --filter e2e exec playwright test --config playwright.www.config.ts content-negotiation.spec.ts
pnpm.cmd --filter @workspace/www check-types
git add apps/www/src/lib/machine-documents* apps/www/src/lib/markdown-negotiation* apps/www/src/routes/agent apps/www/src/routes/llms* apps/www/src/server.ts e2e/www-tests/content-negotiation.spec.ts
git commit -m "publish canonical human and agent facts"
```

## Plan 1 Acceptance

- All 61 current route patterns classify into a named policy.
- Core bilingual facts, claim status, navigation, SEO, sitemap, Agent, llms, and Markdown originate from shared authorities.
- Shared shell primitives remove the dual-identity navigation before route-by-route migration.
- No prohibited claim is present in serialized core content.
- Markdown negotiation preserves Docs and uses the existing rewrite/security pipeline.
