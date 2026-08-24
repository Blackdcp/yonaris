# Yonaris Core Page Experiences Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build six distinct bilingual core experiences—Home, Product, Approach, Research, Company, and GEO—that meet the approved global-company visual bar without inventing product maturity.

**Architecture:** Page truth lives in typed `content/site` modules. Each route owns a component under `components/site/pages` and a focused CSS file under `styles/pages`; pages share the SiteShell and VI but not one generic template. Product and Approach own the only stateful page interactions. Home is composed last from the other page modules so it cannot fork their facts.

**Tech Stack:** React 19, TypeScript 7, TanStack Start/Router, Tailwind CSS 4 plus plain scoped CSS, Vitest, Playwright 1.61.

**Spec:** `docs/superpowers/specs/2026-08-22-full-site-rebuild-design.md`

## Global Constraints

- Binding palette only: Ink `#0B1220`, Paper `#F6F4F1`, Slate `#1E2A39`, Stone `#8A95A3`, Mist `#DDE2E8`, Signal Orange `#FF6A00`, optional Blue Gray `#2F3E50`.
- Category: `AI-native MarTech`; vision: `MarTech, rebuilt. For humans and agents.`
- No gradients, AI neon, glassmorphism, generic floating cards, fake dashboards, fake customer data, or unaudited `0% → 93.3%`.
- All illustrative material visibly says `Illustrative` / `示例`; unknown is never rendered as absent.
- Product activities are not four products; GEO is the first applied workflow, not the company category ceiling.
- Essential content is visible at animation time zero and with reduced motion.
- Desktop and mobile are separately composed; test 320, 360, 390, 768, 1024, 1280, and 1440 CSS-pixel widths.
- Do not render a full route with TanStack `<Link>` through `renderToStaticMarkup`; truth uses pure content tests, route semantics and interaction use Playwright.
- Use TDD for every behavior.

---

### Task 0: Connect the public-site Playwright harness and CI

**Files:**
- Create: `e2e/www-tests/helpers/core-site.ts`
- Create: `e2e/www-tests/helpers/core-site.spec.ts`
- Modify: `e2e/package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `e2e/playwright.www.config.ts`
- Modify: `e2e/tsconfig.json`
- Modify: `.gitignore`
- Modify: `.github/workflows/e2e.yaml`

**Interfaces:**
- Produces: exactly seven `CORE_ROUTE_PAIRS` (Home, Product, Approach, Research, Company, GEO, Diagnostic = fourteen URLs), `QA_VIEWPORTS`, `expectNoHorizontalOverflow()`, `expectNoRunningAnimations()`, `expectSignalFocusVisible()`, `runWcagAa()`, `captureQa()`.

- [ ] **Step 1: Prove the missing scripts**

```powershell
pnpm.cmd --filter e2e run test:www --list
```

Expected RED: `test:www` does not exist.

- [ ] **Step 2: Add deterministic public-site scripts and helpers**

```ts
export const QA_VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  wide: { width: 1280, height: 800 },
  tabletLandscape: { width: 1024, height: 768 },
  tabletPortrait: { width: 768, height: 1024 },
  mobile: { width: 390, height: 844 },
  mobileCompact: { width: 360, height: 800 },
  narrow: { width: 320, height: 740 },
} as const;
```

Add `@axe-core/playwright` as an E2E dev dependency. Add `test:www` with `--grep-invert @visual` and `test:www:visual` with `--grep @visual --workers=1`; visual tests use Playwright's explicit `tag: "@visual"` API. Include `www-tests/**/*.ts` in E2E type-checking and make the helper contract spec executable so broken helpers cannot pass as dead code.

Set top-level Playwright output to `test-results-www`. In the TypeScript config parse `process.env.WWW_E2E_PORT ?? "3001"`, use that same validated port for `baseURL`, and build the explicit command `pnpm --filter @workspace/www exec vite dev --host 127.0.0.1 --port ${port} --strictPort`; server reuse is opt-in rather than silently reusing an arbitrary local process. CI installs Chromium from the E2E package, runs public-site tests before Storybook, gives the expanded matrix enough timeout budget, uploads `e2e/test-results-www/` immediately on failure, and does not invoke Compose log dumping before its generated stack file exists.

`runWcagAa()` runs Axe against WCAG 2.0/2.1 A+AA and WCAG 2.2 AA tags and formats violation IDs, impact, targets, and help URLs. `expectSignalFocusVisible()` reaches the requested `Locator` through keyboard traversal, proves it is `document.activeElement`, composites RGBA indicator colors over the actual adjacent background, and requires both a visible Signal Orange component and a painted edge at least 3:1; translucent colors may not be treated as opaque. `expectNoHorizontalOverflow()` waits for fonts, hydration, and layout stability. `expectNoRunningAnimations()` establishes reduced motion before navigation and waits a render tick. `captureQa()` waits for fonts, hides the caret, disables screenshot-time animations, captures full-page, and writes collision-proof route/locale/viewport/state names directly beneath `test-results-www/visual-qa`, not a per-test `outputPath()` subdirectory.

- [ ] **Step 3: Verify GREEN and commit**

```powershell
pnpm.cmd --filter e2e run test:www --list
pnpm.cmd --filter e2e run test:www
pnpm.cmd --filter e2e run test:www:visual --list
git add e2e/package.json pnpm-lock.yaml e2e/playwright.www.config.ts e2e/tsconfig.json e2e/www-tests/helpers/core-site.ts e2e/www-tests/helpers/core-site.spec.ts .gitignore .github/workflows/e2e.yaml
git commit -m "connect public site browser testing"
```

### Task 1: Product — Evidence Workbench

**Files:**
- Modify: `apps/www/src/content/site/product.ts`
- Create: `apps/www/src/content/site/product.test.ts`
- Modify: `apps/www/src/content/site/content-parity.test.ts`
- Modify: `apps/www/src/lib/site-seo.test.ts`
- Create: `apps/www/src/components/site/pages/product-page.tsx`
- Create: `apps/www/src/components/site/pages/evidence-workbench.tsx`
- Create: `apps/www/src/routes/product.tsx`
- Create: `apps/www/src/routes/zh/product.tsx`
- Modify (generated, never hand-edit): `apps/www/src/routeTree.gen.ts`
- Modify: `apps/www/src/styles/pages/product.css`
- Create: `e2e/www-tests/product.spec.ts`

**Interfaces:**

```ts
export type ProductWorkbenchViewId = "scope" | "answer" | "sources" | "next-test";
export type ProductActivityId = "define-scope" | "observe-answer" | "inspect-evidence" | "choose-next-test";
export type ProductClaim = FactualClaim & { limitation: string };
export interface ProductWorkbenchUi { tabListLabel: string; illustrativeLabel: string; knownLabel: string; unknownLabel: string; currentSoftwareLabel: string; managedDeliveryLabel: string }
export interface ProductWorkbenchView {
  id: ProductWorkbenchViewId;
  tabLabel: string;
  title: string;
  description: string;
  status: "illustrative";
  claims: readonly ProductClaim[];
  fields: readonly ({ label: string; state: "known"; value: string } | { label: string; state: "unknown"; reason: string })[];
}
export interface ProductActivity { id: ProductActivityId; title: string; summary: string; claims: readonly ProductClaim[] }
export interface ProductHomePreview { title: string; summary: string; evidenceLabel: string; limitation: string; claims: readonly ProductClaim[] }
export function EvidenceWorkbench(props: { content: ProductContent["workbench"] }): React.ReactNode;
export function ProductPage(props: { locale: Locale }): React.ReactNode;
```

- [ ] **Step 1: Write the failing content truth test**

```ts
const content = getProductContent("en");
expect(content.headline).toBe("Make AI market answers observable.");
expect(getProductContent("zh").headline).toBe("让 AI 形成的市场答案变得可观察");
expect(content.activities.map((item) => item.id)).toEqual(["define-scope", "observe-answer", "inspect-evidence", "choose-next-test"]);
expect(content.workbench.views.map((view) => view.id)).toEqual(["scope", "answer", "sources", "next-test"]);
expect(content.homePreview).toMatchObject({ evidenceLabel: expect.any(String), limitation: expect.any(String) });
expect(content.workbench.views.flatMap((view) => view.fields).some((field) => field.state === "unknown" && "value" in field)).toBe(false);
for (const activity of content.activities) expect(activity.claims.every((claim) => claim.status && claim.limitation)).toBe(true);
for (const view of content.workbench.views) expect(view.claims.every((claim) => claim.status && claim.limitation)).toBe(true);
expect(content.homePreview.claims.every((claim) => claim.status && claim.limitation)).toBe(true);
expect(JSON.stringify(content)).toContain("Coverage depends on the providers");
expect(JSON.stringify(content)).toContain("unknown");
expect(JSON.stringify(content)).not.toContain("Product Truth Graph");
expect(content.claims.map((claim) => claim.text).join(" ")).not.toMatch(/\breal[- ]time\b/i);
```

Run `pnpm.cmd --filter @workspace/www exec vitest run --config vitest.config.ts src/content/site/product.test.ts`; expected FAIL because the finalized content shape is absent.

- [ ] **Step 2: Write the failing route and keyboard tests**

In `product.spec.ts`, expect `/product` and `/zh/product` to expose one H1, a visible Illustrative label, Customer workspace/Yonaris-operated split, contextual manifest-derived GEO/Diagnostic links, and a four-tab workbench. Use the shared Task 0 helpers across all seven QA viewports. The horizontal tablist uses automatic activation: exactly one `[role=tab]` has `tabIndex=0`; selected/unselected `aria-selected`, `aria-controls`, `tabpanel`/`aria-labelledby`, and the focusable active panel are reciprocal. Right/Left wrap, Home/End jump, click focuses and activates, and Tab exits the roving tablist to the active panel. Assert reduced motion, Signal+Ink focus, no horizontal overflow, readable mobile recomposition, and all four tabs visible at 1024px. Expected RED because `/product` is absent.

- [ ] **Step 3: Implement content, Workbench, page, route, and CSS**

The four views show: declared scope; one exact fictional sampled answer with illustrative surface/model/date; citations and exposed-query known/unknown states; one human-reviewed managed-delivery next test. Workbench UI labels are independently localized in content. Every externally visible activity, coverage, workspace, home-preview, and managed-delivery assertion renders from a `ProductClaim` record with required status and limitation; structural UI labels need no claim. Keep the illustrative sample separate from current-software/managed-delivery capability status. Unknown fields never carry a value or imply absence. Coverage explicitly depends on configured providers and consumer surfaces. Do not present sample data as live, self-service, causal, or autonomous. Include localized GEO and Diagnostic links derived with `getCorePath()`. Mount routes with `corePageHead("product", locale)` and align bilingual metadata with the new H1.

- [ ] **Step 4: Verify and commit**

```powershell
pnpm.cmd --filter @workspace/www exec vitest run --config vitest.config.ts src/content/site/product.test.ts
pnpm.cmd --filter e2e exec playwright test --config playwright.www.config.ts www-tests/product.spec.ts --project=chromium
pnpm.cmd --filter @workspace/www check-types
pnpm.cmd --filter @workspace/www build
git diff -- apps/www/src/routeTree.gen.ts
git add apps/www/src/content/site/product* apps/www/src/content/site/content-parity.test.ts apps/www/src/lib/site-seo.test.ts apps/www/src/components/site/pages/product-page.tsx apps/www/src/components/site/pages/evidence-workbench.tsx apps/www/src/routes/product.tsx apps/www/src/routes/zh/product.tsx apps/www/src/routeTree.gen.ts apps/www/src/styles/pages/product.css e2e/www-tests/product.spec.ts
git commit -m "build the product evidence workbench"
```

### Task 2: Approach — Evidence Loop

**Files:**
- Modify: `apps/www/src/content/site/approach.ts`
- Create: `apps/www/src/content/site/approach.test.ts`
- Modify: `apps/www/src/content/site/content-parity.test.ts`
- Create: `apps/www/src/components/site/pages/approach-page.tsx`
- Create: `apps/www/src/components/site/pages/evidence-loop.tsx`
- Create: `apps/www/src/routes/approach.tsx`
- Create: `apps/www/src/routes/zh/approach.tsx`
- Modify (generated only by the route build): `apps/www/src/routeTree.gen.ts`
- Modify: `apps/www/src/styles/pages/approach.css`
- Create: `e2e/www-tests/approach.spec.ts`
- Create: `.changeset/<approach-evidence-loop>.md`

**Interfaces:**

```ts
export type EvidenceLoopStepId = "frame" | "question-set" | "sample" | "compare" | "inspect" | "repeat";
export type ApproachClaim = FactualClaim & { limitation: string };
export interface EvidenceLoopStep { id: EvidenceLoopStepId; title: string; summary: string; evidenceLabel: string; evidenceValue: string; claimIds: readonly ApproachClaim["id"][] }
export interface ApproachHomePreview { title: string; summary: string; steps: readonly [string, string, string] }
export function EvidenceLoop(props: { content: ApproachContent["loop"] }): React.ReactNode;
```

- [ ] **Step 1: Write RED content tests**

Assert headline `A repeatable evidence loop, not a generic score.` and its independently written Chinese equivalent, six steps in the exact order above, a three-step `homePreview`, `Repeated observations show change over time; they do not by themselves prove what caused the change.`, and Recursive Forest only as a working method. Every externally visible scope, method, evidence, step, and Home-preview assertion must reference a stable `ApproachClaim` carrying both `status` and a non-empty `limitation`; the top-level claim registry contains those claims exactly once and EN/ZH use the same IDs/statuses while their labels and prose are independently localized. Generic evidence may be represented directly; anything that resembles a customer or product observation must be visibly illustrative. Assert absence of causal, autonomous, real-time, universal, `Product Truth Graph`, and unverified `0 → 93.3%` claims. Run the focused Vitest and parity tests and observe FAIL.

- [ ] **Step 2: Write RED interaction tests**

Assert semantic `<ol>`/`<li>` with six native buttons, exactly one roving `tabIndex=0`, `aria-current="step"`, reciprocal button `aria-controls` and evidence-panel `aria-labelledby`, auto activation, click-to-focus, Up/Left and Down/Right stopping at the ends without wrap, and Home/End. Essential step copy remains readable in the ordered document regardless of active state. Assert the evidence record is actually sticky below the site header at 768, 1024, 1280, and 1440 widths (including scroll-position behavior), returns to normal document flow at 320, 360, and 390 widths, passes Axe/WCAG AA in both locales and every active state, and leaves no running transition or animation when reduced motion is emulated before navigation and then the active state changes. Assert canonical/hreflang metadata and zero horizontal overflow at all seven widths.

- [ ] **Step 3: Implement content, loop, route, and layout**

All six steps remain in the DOM. Active state changes the adjacent record but does not hide essential copy. Use the established Paper/Ink/Mist/Stone/Signal Orange system and shared Paper focus treatment; do not add SignalField, a second animation system, or Product-style tabs. Desktop/tablet use the ordered process plus a sticky evidence record; mobile uses one linear reading flow. Both route modules use `corePageHead("approach", locale)`, every destination comes from the manifest, and the generated route tree is inspected rather than hand-edited. Do not modify the site manifest, shared shell, Task 0 helpers, Product experience, Agent documents, or legacy redirects. Add one short `@workspace/www` patch changeset for this user-facing page.

- [ ] **Step 4: Verify and commit**

```powershell
pnpm.cmd --filter @workspace/www exec vitest run src/content/site/approach.test.ts src/content/site/content-parity.test.ts
pnpm.cmd --filter e2e exec playwright test --config playwright.www.config.ts www-tests/approach.spec.ts --project=chromium
pnpm.cmd --filter @workspace/www check-types
pnpm.cmd --filter e2e check-types
pnpm.cmd --filter @workspace/www build
git diff --check
git add apps/www/src/content/site/approach* apps/www/src/content/site/content-parity.test.ts apps/www/src/components/site/pages/approach-page.tsx apps/www/src/components/site/pages/evidence-loop.tsx apps/www/src/routes/approach.tsx apps/www/src/routes/zh/approach.tsx apps/www/src/routeTree.gen.ts apps/www/src/styles/pages/approach.css e2e/www-tests/approach.spec.ts .changeset/<approach-evidence-loop>.md
git commit -m "show the repeatable evidence loop"
```

### Task 3: Research — Research Ledger

**Files:**
- Modify: `apps/www/src/content/site/research.ts`
- Create: `apps/www/src/content/site/research.test.ts`
- Modify: `apps/www/src/content/site/content-parity.test.ts`
- Create: `apps/www/src/components/site/pages/research-page.tsx`
- Create: `apps/www/src/components/site/pages/research-ledger.tsx`
- Create: `apps/www/src/components/site/pages/metric-method-card.tsx`
- Create: `apps/www/src/routes/research.tsx`
- Create: `apps/www/src/routes/zh/research.tsx`
- Modify (generated only by the route build): `apps/www/src/routeTree.gen.ts`
- Modify: `apps/www/src/styles/pages/research.css`
- Create: `e2e/www-tests/research.spec.ts`
- Create: `.changeset/auditable-research-ledger.md`

**Interfaces:**

```ts
export type EvidenceAvailability<T> = { state: "known"; value: T } | { state: "unknown"; reason: string };
export type ResearchClaim = FactualClaim & { limitation: string };
export interface ResearchItem { id: string; text: string }
export interface MetricDefinition { id: "visibility" | "share-of-voice"; label: string; definition: string; numerator: string; denominator: string; limitation: string; claimIds: readonly ResearchClaim["id"][] }
export interface IllustrativeEvidenceRecord { id: "illustrative-record-01"; status: "illustrative"; label: string; title: string; scope: string; observedAtIso: string; observedAtLabel: string; sampleCount: number; question: string; surface: string; answer: string; citations: EvidenceAvailability<readonly ResearchItem[]>; exposedQueries: EvidenceAvailability<readonly ResearchItem[]>; findings: readonly ResearchItem[]; unknowns: readonly ResearchItem[]; claimIds: readonly ResearchClaim["id"][] }
export interface ResearchHomePreview { title: string; scope: string; denominator: string; limitation: string; claimIds: readonly ResearchClaim["id"][] }
```

- [ ] **Step 1: Write RED metric and evidence tests**

Assert headline `Every finding should show its scope.` and its independently written Chinese equivalent. Assert Visibility numerator is valid sampled answers mentioning the tracked brand and its denominator is all valid sampled answers in the active declared filter; configured-cohort SOV numerator is tracked-brand mentions and its denominator is tracked-brand plus configured-competitor mentions in the same cohort. Require `homePreview`, question, surface, ISO date plus localized label, numeric sample count, answer, citation state, query state, findings, unknowns, and non-causality. Use stable EN/ZH claim IDs/statuses: `research-declared-scope`, `research-visibility-definition`, `research-configured-sov-definition`, and `research-repeat-observation` are `current-software`; `research-illustrative-record` is `illustrative`. Every claim has an explicit limitation, appears once in the top-level registry, and nested content references it by ID. V1 contains no `verified-evidence` or `direction` claim. Extend parity tests across metric IDs, claim references, item IDs, availability states, record status, and claim order. Reject percentages, customer-result assertions, lifts/rankings, causal claims, and unknown-as-no-search while allowing an explicit disclosure that no customer outcome is published.

- [ ] **Step 2: Write RED route tests**

Assert the bilingual page renders one H1, measurement design, two semantic metric `<article>` elements with `<dl>` fields, and one `<article data-record-status="illustrative">` with metadata `<dl>`, `<time dateTime>`, labelled answer, citations, exposed-query, findings, and unknown sections. The whole fictional record is visibly `Illustrative` / `示例`; citations use reserved `.example` domains and exposed queries are unknown with a reason stating that unavailable data does not establish that no search occurred. Known/Unknown is visible text, not color alone. There are no tabs, accordions, record selectors, dashboard charts, KPI tiles, scorecards, or hidden evidence states. Assert canonical/hreflang, Axe AA, reduced motion, CJK font/tracking/casing, and zero overflow in both locales at all seven widths. At 1024 assert real readable two-column grid geometry; at 768 and below assert one-column document order. Capture EN/ZH at 1440, 1024, 390, and 320.

- [ ] **Step 3: Implement the ledger and page**

Use a fictional company and visibly simulated data with `sampleCount: 1`. The page reads like an auditable record with one editorial hierarchy, not a KPI dashboard. Research is intentionally non-stateful; Product and Approach remain the stateful core experiences. Signal Orange is limited to rules, status markers, and focus; small text uses Ink/Slate. Both routes use `corePageHead("research", locale)`, links are manifest-derived, and the route tree is build-generated and inspected rather than hand-edited. Keep the site manifest, shared shell, Task 0 helpers, Product, Approach, Agent documents, and legacy redirects out of scope. Add one short `@workspace/www` patch changeset.

- [ ] **Step 4: Verify and commit**

```powershell
pnpm.cmd --filter @workspace/www exec vitest run src/content/site/research.test.ts src/content/site/content-parity.test.ts src/styles.test.ts
pnpm.cmd --filter e2e exec playwright test --config playwright.www.config.ts www-tests/research.spec.ts --project=chromium --grep-invert @visual
pnpm.cmd --filter e2e exec playwright test --config playwright.www.config.ts www-tests/research.spec.ts --project=chromium --grep @visual --workers=1
pnpm.cmd --filter @workspace/www check-types
pnpm.cmd --filter e2e check-types
pnpm.cmd --filter @workspace/www audit:site-manifest
pnpm.cmd --filter @workspace/www build
git diff --check
git add apps/www/src/content/site/research* apps/www/src/content/site/content-parity.test.ts apps/www/src/components/site/pages/research-* apps/www/src/components/site/pages/metric-method-card.tsx apps/www/src/routes/research.tsx apps/www/src/routes/zh/research.tsx apps/www/src/routeTree.gen.ts apps/www/src/styles/pages/research.css e2e/www-tests/research.spec.ts .changeset/auditable-research-ledger.md
git commit -m "publish an auditable research ledger"
```

### Task 4: Company — Category Thesis

**Files:**
- Modify: `apps/www/src/content/site/company.ts`
- Create: `apps/www/src/content/site/company.test.ts`
- Modify: `apps/www/src/content/site/content-parity.test.ts`
- Modify: `apps/www/src/lib/site-seo.test.ts`
- Create: `apps/www/src/components/site/pages/company-page.tsx`
- Create: `apps/www/src/components/site/pages/company-reader-field.tsx`
- Create: `apps/www/src/routes/company.tsx`
- Create: `apps/www/src/routes/zh/company.tsx`
- Modify (generated only by the route build): `apps/www/src/routeTree.gen.ts`
- Modify: `apps/www/src/styles/pages/company.css`
- Create: `e2e/www-tests/company.spec.ts`
- Create: `.changeset/company-category-thesis.md`

**Interfaces:**

```ts
export type CompanyReaderId = "human" | "agent";
export type CompanyClaim = FactualClaim & { limitation: string };
export interface CompanyReader { id: CompanyReaderId; label: string; summary: string; annotation: string }
export function CompanyReaderField(props: { locale: Locale; content: CompanyContent["marketShift"] }): React.ReactNode;
```

`CompanyContent` owns claim-backed `vision`, `stage`, `forest`, `privateOperatingModel`, and `currentScope`; a dual-reader `marketShift`; four prescriptive principles; and a contact close. Claims appear exactly once in the top-level registry and sections reference them by ID.

- [ ] **Step 1: Write RED truth tests**

Require exact category `AI-native MarTech`, H1 `MarTech, rebuilt. For humans and agents.`, and independently authored Chinese. Keep the sharp anchors `The market now has two readers.`, `A real platform. A service-led beginning.`, `Don’t enumerate every question. Build what generates the answers.`, `Foundation, not identity.`, and `Start with one question that matters.` with natural Chinese equivalents. State plainly that Yonaris is an early company delivering a real evidence product through a service-led model: configured evidence is customer-visible while parts of collection and recommendations remain Yonaris-operated and human-reviewed. Require stable EN/ZH reader/principle/claim IDs and statuses, every referenced claim resolving exactly once, and every claim carrying a non-empty limitation. Map `company-human-agent-direction` to `direction`, `company-service-led-stage` to `managed-delivery`, `company-evidence-platform` to `current-software`, `company-recursive-forest-method` to `managed-delivery`, and `company-private-operating-model` to `current-software`. Principles are prescriptive commitments, not certification claims. Require exact contact email `black.dcp@outlook.com`. Reject B2B-only, GEO-company, mature SaaS, autonomous, real-time, universal, Product Truth Graph, Commercial Feedback, invented customer/team/location/investor/funding/certification, and `0 → 93.3%` implications without rendering a defensive list of absent claims.

- [ ] **Step 2: Write RED route tests**

Assert one H1, logical headings, a labelled two-button Human/Agent group with exactly one `aria-pressed="true"`, native Enter/Space activation, click-to-focus, a restrained state-dependent annotation, and both essential reader descriptions visible in every state. The group has no tab semantics, no hidden thesis, no auto-advance, and no continuous animation. Assert visible stage disclosure, localized Diagnostic, and `mailto:black.dcp@outlook.com` links; canonical/hreflang/x-default; Signal+Paper focus on the Ink field; reduced-motion state change with no running animation; Axe AA and zero overflow in both reader states/locales at 320, 360, 390, 768, 1024, 1280, and 1440. Assert CJK-first font, natural tracking/casing, no forced `<br>`, and native visual captures at 1440, 1024, 390, and 320 for both locales.

- [ ] **Step 3: Implement thesis composition and route**

Use a near-full-height Paper hero with oversized type and a plain category label; a full-bleed Ink dual-reader field; honest stage and concise Recursive Forest sections; four ruled editorial principle rows (not cards); and a private-operating-model/contact close. Selection moves only a restrained orange hinge and supplemental annotation. Use only VI colors with no gradients, glass, neon, path/forest artwork, product UI, cards, social proof, metrics, or stock imagery. Mount both routes with `corePageHead("company", locale)`, derive paths from the manifest, generate/inspect the route tree, and keep the site manifest, shared shell, Task0 helpers, Product, Approach, Research, Agent documents, and redirects out of scope. Add one short `@workspace/www` patch changeset.

- [ ] **Step 4: Verify and commit**

```powershell
pnpm.cmd --filter @workspace/www exec vitest run --config vitest.config.ts src/content/site/company.test.ts src/content/site/content-parity.test.ts src/lib/site-seo.test.ts
pnpm.cmd --filter e2e exec playwright test --config playwright.www.config.ts www-tests/company.spec.ts --project=chromium --grep-invert @visual
pnpm.cmd --filter e2e exec playwright test --config playwright.www.config.ts www-tests/company.spec.ts --project=chromium --grep @visual --workers=1
pnpm.cmd --filter @workspace/www check-types
pnpm.cmd --filter e2e check-types
pnpm.cmd --filter @workspace/www audit:site-manifest
pnpm.cmd --filter @workspace/www build
git diff --check
git add apps/www/src/content/site/company* apps/www/src/content/site/content-parity.test.ts apps/www/src/lib/site-seo.test.ts apps/www/src/components/site/pages/company-page.tsx apps/www/src/components/site/pages/company-reader-field.tsx apps/www/src/routes/company.tsx apps/www/src/routes/zh/company.tsx apps/www/src/routeTree.gen.ts apps/www/src/styles/pages/company.css e2e/www-tests/company.spec.ts .changeset/company-category-thesis.md
git commit -m "state the Yonaris category thesis"
```

### Task 5: GEO — Applied Workflow

**Files:**
- Modify: `apps/www/src/content/site/geo.ts`
- Create: `apps/www/src/content/site/geo.test.ts`
- Modify: `apps/www/src/content/site/content-parity.test.ts`
- Modify: `apps/www/src/lib/site-seo.test.ts`
- Create: `apps/www/src/components/site/pages/geo-page.tsx`
- Create: `apps/www/src/components/site/pages/geo-applied-workflow.tsx`
- Modify: `apps/www/src/routes/geo.tsx`
- Modify: `apps/www/src/routes/zh/geo.tsx`
- Modify (generated only by the route build, if changed): `apps/www/src/routeTree.gen.ts`
- Modify: `apps/www/src/styles/pages/geo.css`
- Create: `e2e/www-tests/geo.spec.ts`
- Create: `.changeset/geo-evidence-workflow.md`

**Interfaces:**

```ts
export type GeoWorkflowStageId = "discovery" | "description" | "comparison" | "citation" | "verification";
export type GeoClaim = FactualClaim & { limitation: string };
export interface GeoWorkflowStage { id: GeoWorkflowStageId; title: string; question: string; observedSignal: string; boundedAction: string; claimIds: readonly GeoClaim["id"][] }
export interface GeoWorkflowUi { workflowLabel: string; observedSignalLabel: string; boundedActionLabel: string; capabilityContextLabel: string; currentSoftwareLabel: string; managedDeliveryLabel: string; limitationLabel: string }
export interface GeoEvidenceBoundary { title: string; summary: string; claimIds: readonly GeoClaim["id"][] }
```

- [ ] **Step 1: Write RED content tests**

Require the exact five-stage tuple above, H1 `GEO, grounded in evidence.` with independently authored Chinese `让 GEO 建立在证据之上`, the visible boundary `GEO is the first applied workflow—not Yonaris's category ceiling.`, and broader AI-native MarTech/Product/Diagnostic handoffs. Use one canonical claim registry with exact EN/ZH IDs/status/order and non-empty limitations: `geo-first-applied-workflow`, `geo-configured-sampling`, `geo-human-reviewed-verification`, and `geo-diagnostic-scope-confirmation` are `managed-delivery`; `geo-reviewable-answers`, `geo-configured-comparison`, and `geo-available-source-evidence` are `current-software`; `geo-broader-martech-direction` is `direction`. Every boundary, current-scope, stage, evidence, broader-category, and diagnostic assertion references resolvable IDs; no orphan/duplicate claims and no `illustrative`/`verified-evidence` statuses in V1. Assert configured-cohort, available-source, unknown-evidence, non-causality, human-review, and scope-confirmation boundaries. Reject ranking/traffic/guarantee, universal/all-model/real-time/continuous coverage, instant scan/score, self-service runs, automated fixes/publishing/optimization, causal lift, Product Truth Graph, unaudited `0 → 93.3%`, fake customers/live samples, and before/after results.

- [ ] **Step 2: Write RED route tests**

Assert one H1, logical headings, five semantic always-visible stages with observation/action/capability/limitation text, exact evidence/category boundaries, and manifest-derived localized Product, Company, and Diagnostic links. There are no main-page buttons, tabs, `aria-current="step"`, hidden workflow state, sticky record, accordion, selector, hooks, or second interaction system. Assert canonical/hreflang/x-default, shared Paper focus on contextual links, Axe AA in both locales at all seven QA widths, readable multi-column field geometry at 1024, complete linear lane order on mobile, no overflow, no running reduced-motion animation, and CJK-first typography/natural tracking/casing for every heading/label family. Capture both locales at 1440, 1024, 390, and 320.

- [ ] **Step 3: Implement the applied workflow**

Use a Paper hero with direct high-intent copy and one full-width Ink applied-evidence field with five continuous horizontal lanes. Desktop/tablet columns are stage/question → observed evidence → bounded next move → truthful capability context; mobile makes each lane a linear block without hiding content. One restrained Signal Orange rail/marker may connect lanes; small text stays Paper/Slate. No gradients, cards, fake dashboard, Product circles/tabs, Approach branch/sticky motif, or SignalField. Close by expanding to the broader AI-native MarTech category and stating that scope is confirmed before collection—no instant result. Derive destinations with `getCorePath()`, use `corePageHead("geo", locale)`, inspect generated routes, and keep manifest/shared shell/Task0/Product/Approach/Research/Company/Diagnostic/Agent/legacy files out of scope. Add one short `@workspace/www` patch changeset.

- [ ] **Step 4: Verify and commit**

```powershell
pnpm.cmd --filter @workspace/www exec vitest run src/content/site/geo.test.ts src/content/site/content-parity.test.ts src/lib/site-seo.test.ts src/styles.test.ts
pnpm.cmd --filter e2e exec playwright test --config playwright.www.config.ts www-tests/geo.spec.ts --project=chromium --grep-invert @visual
pnpm.cmd --filter e2e exec playwright test --config playwright.www.config.ts www-tests/geo.spec.ts --project=chromium --grep @visual --workers=1
pnpm.cmd --filter @workspace/www check-types
pnpm.cmd --filter e2e check-types
pnpm.cmd --filter @workspace/www audit:site-manifest
pnpm.cmd --filter @workspace/www build
git diff --check
git add apps/www/src/content/site/geo* apps/www/src/content/site/content-parity.test.ts apps/www/src/lib/site-seo.test.ts apps/www/src/components/site/pages/geo-* apps/www/src/routes/geo.tsx apps/www/src/routes/zh/geo.tsx apps/www/src/routeTree.gen.ts apps/www/src/styles/pages/geo.css e2e/www-tests/geo.spec.ts .changeset/geo-evidence-workflow.md
git commit -m "frame GEO as the first applied workflow"
```

### Task 6: Home — Compose the whole site after its destinations exist

**Files:**
- Move: `apps/www/src/components/marketing/home-page.tsx` → `apps/www/src/components/site/pages/home-page.tsx`
- Move: `apps/www/src/components/marketing/home-hero.tsx` → `apps/www/src/components/site/pages/home-hero.tsx`
- Move: `apps/www/src/components/marketing/market-diagnostic-preview.tsx` → `apps/www/src/components/site/pages/home-diagnostic-preview.tsx`
- Create: `apps/www/src/components/site/pages/home-narrative.tsx`
- Modify: `apps/www/src/content/site/global.ts`
- Create: `apps/www/src/content/site/home.test.ts`
- Modify: `apps/www/src/routes/index.tsx`
- Modify: `apps/www/src/routes/zh/index.tsx`
- Modify: `apps/www/src/styles/pages/home.css`
- Modify: `e2e/www-tests/homepage.spec.ts`

**Interfaces:**
- Consumes: `product.homePreview`, `approach.homePreview`, `research.homePreview`, `diagnostic.homeOffer`.

- [ ] **Step 1: Write RED content and composition tests**

Assert approved Hero copy remains; the visible opening still states the `AI-native MarTech` category and `MarTech, rebuilt. For humans and agents.` vision without restoring the rejected pill/eyebrow treatment. Assert all illustrative preview copy moved into `content/site/global.ts`, lower stages are Product → Approach → Research → Diagnostic, canonical links are used, and foundations/outcome/standalone GEO/company anchor sections are gone. The category/vision may appear as a concise typographic bridge in `HomeNarrative`, not as a duplicate Company section.

- [ ] **Step 2: Write RED route tests**

Retain existing semantic preview, initial/final/reduced-motion visibility, GET diagnostic handoff, mobile menu, 390px text readability, and domain-filled tests. Add stage-order and 320/360/390/768/1024/1280/1440 overflow assertions.

- [ ] **Step 3: Move and recompose without changing the approved Hero direction**

Remove the radial gradient from `home.css`. Home lower sections consume page previews instead of copying their facts. The final diagnostic offer remains full-width and routes to the localized diagnostic. Home routes use `corePageHead("home", locale)`.

- [ ] **Step 4: Verify and commit**

```powershell
pnpm.cmd --filter @workspace/www test -- src/content/site/home.test.ts
pnpm.cmd --filter e2e exec playwright test --config playwright.www.config.ts www-tests/homepage.spec.ts --project=chromium
pnpm.cmd --filter @workspace/www check-types
git add apps/www/src/components/site/pages/home-* apps/www/src/content/site/global.ts apps/www/src/content/site/home.test.ts apps/www/src/routes/index.tsx apps/www/src/routes/zh/index.tsx apps/www/src/styles/pages/home.css e2e/www-tests/homepage.spec.ts
git commit -m "compose the homepage from the core site"
```

### Task 7: Capture and inspect the complete core visual matrix

**Files:**
- Create: `e2e/www-tests/core-pages-visual.spec.ts`
- Create: `e2e/www-tests/accessibility.spec.ts`
- Create output only: `e2e/test-results-www/visual-qa/**`
- Modify as defects require: the focused component, content, test, and page CSS files.

- [ ] **Step 1: Implement the visual matrix**

Capture all 14 EN/ZH core URLs at 1440×900, 1024×768, 390×844, and 320×740. Capture Product states `scope`, `answer`, `sources`, `next-test`; Approach steps 01, 04, 06; Home mobile `full`, `nav-open`, `domain-filled`; and Diagnostic EN/ZH `scope`, `contact`, `submitting`, `success`, and `failure-with-mailto` states. Reuse the deterministic Diagnostic route mocks and helpers from Plan 3; do not send a real lead. Plan 3 proves the Diagnostic state machine first, while this task folds those artifacts into the one complete core visual matrix.

In `accessibility.spec.ts`, run `runWcagAa()` on all 14 core routes in both the default desktop and 390px layouts, plus open mobile navigation, every Product tab, representative Approach steps, and Diagnostic scope/contact/success/failure states. Keyboard through the shared header, mobile menu, Product tabs, Approach controls, and Diagnostic fields/actions; use `expectSignalFocusVisible()` on each control family. This is the deterministic WCAG-AA/focus gate; screenshots remain the typography/composition review rather than the only contrast check.

- [ ] **Step 2: Run and inspect every native-size image**

```powershell
pnpm.cmd --filter e2e run test:www:visual
```

Open every PNG with `view_image`. For each orphan, overlap, hidden control, illegible label, contrast problem, or overflow: add a failing browser assertion, observe RED, make the focused fix, and rerun the affected state plus the full visual matrix.

- [ ] **Step 3: Run the complete core regression and commit**

```powershell
pnpm.cmd --filter @workspace/www test
pnpm.cmd --filter e2e run test:www
pnpm.cmd --filter e2e run test:www:visual
pnpm.cmd --filter @workspace/www check-types
git add e2e/www-tests/core-pages-visual.spec.ts e2e/www-tests/accessibility.spec.ts
git commit -m "complete core site visual QA"
```

If visual/accessibility REDs required focused fixes, append only the exact component/content/CSS/test paths recorded in the SDD ledger; never stage the whole application tree.

## Plan 2 Acceptance

- Product, Approach, Research, Company, GEO, and Home are not one template with swapped text.
- Product and Approach interactions meet the keyboard and reduced-motion contracts.
- Every evidence surface is labelled and truth-bounded.
- Home consumes, rather than duplicates, facts from the rest of the site.
- English and Chinese pass all seven overflow widths and the four-viewport visual review.
