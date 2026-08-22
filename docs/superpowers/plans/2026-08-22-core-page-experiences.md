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
- Create: `apps/www/src/components/site/pages/approach-page.tsx`
- Create: `apps/www/src/components/site/pages/evidence-loop.tsx`
- Create: `apps/www/src/routes/approach.tsx`
- Create: `apps/www/src/routes/zh/approach.tsx`
- Modify: `apps/www/src/styles/pages/approach.css`
- Create: `e2e/www-tests/approach.spec.ts`

**Interfaces:**

```ts
export type EvidenceLoopStepId = "frame" | "question-set" | "sample" | "compare" | "inspect" | "repeat";
export interface EvidenceLoopStep { id: EvidenceLoopStepId; title: string; summary: string; evidenceLabel: string; evidenceValue: string; claims: readonly FactualClaim[] }
export interface ApproachHomePreview { title: string; summary: string; steps: readonly [string, string, string] }
export function EvidenceLoop(props: { content: ApproachContent["loop"] }): React.ReactNode;
```

- [ ] **Step 1: Write RED content tests**

Assert headline `A repeatable evidence loop, not a generic score.` and its independently written Chinese equivalent, six steps in the exact order above, a three-step `homePreview`, `Repeated observations show change over time; they do not by themselves prove what caused the change.`, and Recursive Forest only as a working method. Run the focused Vitest test and observe FAIL.

- [ ] **Step 2: Write RED interaction tests**

Assert semantic `<ol>`, native buttons, `aria-current="step"`, roving focus, Up/Left and Down/Right without wrap, Home/End, sticky evidence on desktop/tablet, document-flow evidence on mobile, and no running motion under reduced motion.

- [ ] **Step 3: Implement content, loop, route, and layout**

All six steps remain in the DOM. Active state changes the adjacent record but does not hide essential copy. No SignalField or second animation system is added. Both route modules use `corePageHead("approach", locale)`.

- [ ] **Step 4: Verify and commit**

```powershell
pnpm.cmd --filter @workspace/www test -- src/content/site/approach.test.ts
pnpm.cmd --filter e2e exec playwright test --config playwright.www.config.ts www-tests/approach.spec.ts --project=chromium
pnpm.cmd --filter @workspace/www check-types
git add apps/www/src/content/site/approach* apps/www/src/components/site/pages/approach-page.tsx apps/www/src/components/site/pages/evidence-loop.tsx apps/www/src/routes/approach.tsx apps/www/src/routes/zh/approach.tsx apps/www/src/styles/pages/approach.css e2e/www-tests/approach.spec.ts
git commit -m "show the repeatable evidence loop"
```

### Task 3: Research — Research Ledger

**Files:**
- Modify: `apps/www/src/content/site/research.ts`
- Create: `apps/www/src/content/site/research.test.ts`
- Create: `apps/www/src/components/site/pages/research-page.tsx`
- Create: `apps/www/src/components/site/pages/research-ledger.tsx`
- Create: `apps/www/src/components/site/pages/metric-method-card.tsx`
- Create: `apps/www/src/routes/research.tsx`
- Create: `apps/www/src/routes/zh/research.tsx`
- Modify: `apps/www/src/styles/pages/research.css`
- Create: `e2e/www-tests/research.spec.ts`

**Interfaces:**

```ts
export type EvidenceAvailability<T> = { state: "known"; value: T } | { state: "unknown"; reason: string };
export interface MetricDefinition { id: "visibility" | "share-of-voice"; label: string; definition: string; numerator: string; denominator: string; limitation: string; claims: readonly FactualClaim[] }
export interface IllustrativeEvidenceRecord { status: "illustrative"; question: string; surface: string; observedAt: string; sampleCount: number; answer: string; citations: EvidenceAvailability<readonly string[]>; exposedQueries: EvidenceAvailability<readonly string[]>; findings: readonly string[]; unknowns: readonly string[]; claims: readonly FactualClaim[] }
export interface ResearchHomePreview { title: string; scope: string; denominator: string; limitation: string }
```

- [ ] **Step 1: Write RED metric and evidence tests**

Assert headline `Every finding should show its scope.` and its independently written Chinese equivalent. Assert Visibility denominator is all valid sampled answers in the active filter; SOV denominator is tracked-brand plus configured-competitor mentions in the same cohort. Require `homePreview`, question, surface, date, sample count, answer, citation state, query state, knowns, unknowns, and non-causality. Require every metric/evidence assertion to map to a statused `FactualClaim` with an explicit limitation. Reject `93.3%`, customer-result language, and unknown-as-no-search.

- [ ] **Step 2: Write RED route tests**

Assert the bilingual page renders the measurement design, two metric cards, visible Illustrative label, exact known/unknown states, no dashboard scorecard, no result claim, and no overflow at seven widths.

- [ ] **Step 3: Implement the ledger and page**

Use a fictional company and visibly simulated data. The page reads like an auditable record with one editorial hierarchy, not a KPI dashboard. Both routes use `corePageHead("research", locale)`.

- [ ] **Step 4: Verify and commit**

```powershell
pnpm.cmd --filter @workspace/www test -- src/content/site/research.test.ts
pnpm.cmd --filter e2e exec playwright test --config playwright.www.config.ts www-tests/research.spec.ts --project=chromium
pnpm.cmd --filter @workspace/www check-types
git add apps/www/src/content/site/research* apps/www/src/components/site/pages/research-* apps/www/src/components/site/pages/metric-method-card.tsx apps/www/src/routes/research.tsx apps/www/src/routes/zh/research.tsx apps/www/src/styles/pages/research.css e2e/www-tests/research.spec.ts
git commit -m "publish an auditable research ledger"
```

### Task 4: Company — Category Thesis

**Files:**
- Modify: `apps/www/src/content/site/company.ts`
- Create: `apps/www/src/content/site/company.test.ts`
- Create: `apps/www/src/components/site/pages/company-page.tsx`
- Create: `apps/www/src/routes/company.tsx`
- Create: `apps/www/src/routes/zh/company.tsx`
- Modify: `apps/www/src/styles/pages/company.css`
- Create: `e2e/www-tests/company.spec.ts`

- [ ] **Step 1: Write RED truth tests**

Require category, vision, AI-mediated market shift, `early, service-led product with a real evidence platform`, concise Recursive Forest thesis, evidence-over-theatre/declared-scope/human-review/durable-product-truth principles, open-source relationship, contact, and diagnostic. Require each externally visible stage, capability, and open-source relationship assertion to resolve to a stable `FactualClaim` with status and limitation from `content/site/company.ts`. Reject invented locations, team biographies, investors, customers, certifications, and funding status.

- [ ] **Step 2: Write RED route tests**

Assert the page has one H1, no cards or fake social proof, visible stage disclosure, links to `/open-source` and localized diagnostic, natural Chinese breaks, and zero overflow at seven widths.

- [ ] **Step 3: Implement thesis composition and route**

Use large type, deliberate negative space, one short orange rule, and no product UI. Mount both routes with `corePageHead("company", locale)`.

- [ ] **Step 4: Verify and commit**

```powershell
pnpm.cmd --filter @workspace/www test -- src/content/site/company.test.ts
pnpm.cmd --filter e2e exec playwright test --config playwright.www.config.ts www-tests/company.spec.ts --project=chromium
pnpm.cmd --filter @workspace/www check-types
git add apps/www/src/content/site/company* apps/www/src/components/site/pages/company-page.tsx apps/www/src/routes/company.tsx apps/www/src/routes/zh/company.tsx apps/www/src/styles/pages/company.css e2e/www-tests/company.spec.ts
git commit -m "state the Yonaris category thesis"
```

### Task 5: GEO — Applied Workflow

**Files:**
- Modify: `apps/www/src/content/site/geo.ts`
- Create: `apps/www/src/content/site/geo.test.ts`
- Create: `apps/www/src/components/site/pages/geo-page.tsx`
- Create: `apps/www/src/components/site/pages/geo-applied-workflow.tsx`
- Modify: `apps/www/src/routes/geo.tsx`
- Modify: `apps/www/src/routes/zh/geo.tsx`
- Modify: `apps/www/src/styles/pages/geo.css`
- Create: `e2e/www-tests/geo.spec.ts`

**Interfaces:**

```ts
export type GeoWorkflowStageId = "discovery" | "description" | "comparison" | "citation" | "verification";
export interface GeoWorkflowStage { id: GeoWorkflowStageId; title: string; observedSignal: string; boundedAction: string; claims: readonly FactualClaim[] }
```

- [ ] **Step 1: Write RED content tests**

Require all five stages, the phrase `GEO is the first applied workflow`, and the broader AI-native MarTech link. Reject ranking, traffic, universal visibility, and automated-optimization claims.

- [ ] **Step 2: Write RED route tests**

Assert one H1, a static five-stage workflow, exact evidence boundary, localized diagnostic CTA, no second interaction system, and no overflow at seven widths.

- [ ] **Step 3: Implement the applied workflow**

Use one structured field with observation/action pairs. GEO has direct high-intent copy but closes by expanding to AI-mediated markets. Both route modules use `corePageHead("geo", locale)`.

- [ ] **Step 4: Verify and commit**

```powershell
pnpm.cmd --filter @workspace/www test -- src/content/site/geo.test.ts
pnpm.cmd --filter e2e exec playwright test --config playwright.www.config.ts www-tests/geo.spec.ts --project=chromium
pnpm.cmd --filter @workspace/www check-types
git add apps/www/src/content/site/geo* apps/www/src/components/site/pages/geo-* apps/www/src/routes/geo.tsx apps/www/src/routes/zh/geo.tsx apps/www/src/styles/pages/geo.css e2e/www-tests/geo.spec.ts
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
