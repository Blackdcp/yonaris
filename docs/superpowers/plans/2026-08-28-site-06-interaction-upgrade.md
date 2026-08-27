# Site 06 Product Interaction Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the Site 06 production website with faithful product-state interaction, a same-record Human/Agent transformation, stronger three-field conversion, and original Yonaris imagery without regressing the approved editorial visual system or machine contracts.

**Architecture:** Add three focused shared React scenes—decision trace, product proof, and canonical-record transform—driven by a typed, de-identified content module. Integrate them into route-specific English and Chinese compositions, keep the existing SSR fact records and lead endpoint intact, and extend the Site 06 stylesheet rather than introducing a second visual system.

**Tech Stack:** React 19, TypeScript 7, TanStack Start, Vitest, Testing Library server rendering, CSS, Playwright-compatible browser smoke scripts, pnpm/Turbo.

**Spec:** `docs/superpowers/specs/2026-08-28-site-06-interaction-upgrade-design.md`

## Global Constraints

- Site 06 remains the binding visual baseline; no generic split hero, bento grid, equal card wall, particle field, carousel, oversized heading, arrow-glyph CTA, or pill system.
- Figures are limited to fixture-backed values: 79% visibility, 35% share, 42 prompts, 3,120 evaluations in 30 days, and approximately one-day frequency.
- Citations and Query Fan-Out show no unsupported aggregate counts.
- English and Chinese share component behaviour but use independent localized content.
- English lead fields remain Name, Work email, Company; Chinese lead fields remain 姓名、电话、公司.
- Agent routes, negotiation, SEO, sitemap, form delivery, privacy, and retired-route contracts must remain unchanged.
- Meaningful public facts remain present in SSR output; interaction is progressive enhancement.
- Reduced motion disables automatic state progression and scanning while preserving all information.
- No new runtime dependency or animation library.

---

### Task 1: Original imagery and credit-free cinematic primitive

**Files:**
- Create: `apps/www/public/brand/site-06/decision-room-original.png`
- Create: `apps/www/public/brand/site-06/glass-passage-original.png`
- Create: `apps/www/public/brand/site-06/working-session-original.png`
- Modify: `apps/www/src/components/experience/shared/cinematic-field.tsx`
- Modify: `apps/www/src/components/experience/global/global-pages.tsx`
- Modify: `apps/www/src/components/experience/china/china-pages.tsx`
- Test: `apps/www/src/components/experience/original-imagery.test.tsx`

**Interfaces:**
- Consumes: existing `CinematicFieldProps` and route compositions.
- Produces: optional `credit?: string` on `CinematicFieldProps`; three stable public asset paths.

- [ ] **Step 1: Write the failing asset/markup test**

```tsx
import { existsSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GlobalHomePage, GlobalGeoPage, GlobalDiagnosticPage } from "./global/global-pages";

describe("original Site 06 imagery", () => {
  it("ships original assets and no public stock-photo credit", () => {
    for (const file of ["decision-room-original.png", "glass-passage-original.png", "working-session-original.png"]) {
      expect(existsSync(new URL(`../../../public/brand/site-06/${file}`, import.meta.url))).toBe(true);
    }
    const markup = [GlobalHomePage(), GlobalGeoPage(), GlobalDiagnosticPage()]
      .map((page) => renderToStaticMarkup(page))
      .join("\n");
    expect(markup).not.toMatch(/Unsplash|Pexels|Photo:/i);
    expect(markup).toContain("/brand/site-06/decision-room-original.png");
  });
});
```

- [ ] **Step 2: Run the focused test and confirm it fails**

Run: `pnpm --filter @workspace/www test -- original-imagery.test.tsx`

Expected: FAIL because the three original assets and optional-credit rendering are not present.

- [ ] **Step 3: Copy the generated binaries and make credits optional**

Copy the three approved images from the generated-image session into the exact public paths. Change the cinematic primitive so it renders `<figcaption>` only when `credit` is non-empty. Replace every active Site 06 stock path and visible credit with the matching original asset.

- [ ] **Step 4: Run the focused test**

Run: `pnpm --filter @workspace/www test -- original-imagery.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

Run: `git add apps/www/public/brand/site-06 apps/www/src/components/experience/shared/cinematic-field.tsx apps/www/src/components/experience/global/global-pages.tsx apps/www/src/components/experience/china/china-pages.tsx apps/www/src/components/experience/original-imagery.test.tsx`

Run: `git commit -m "feat(www): replace Site 06 stock imagery"`

---

### Task 2: Typed, de-identified product demo content

**Files:**
- Create: `apps/www/src/content/experience/product-demo.ts`
- Test: `apps/www/src/content/experience/product-demo.test.ts`

**Interfaces:**
- Produces: `ProductDemoLocale`, `ProductDemoView`, `PRODUCT_DEMO`, and `productDemoFor(locale)`.
- Consumed by: `ProductProofScene` and `DecisionTraceScene`.

- [ ] **Step 1: Write the failing content-contract test**

```ts
import { describe, expect, it } from "vitest";
import { productDemoFor } from "./product-demo";

describe("public product demo content", () => {
  it("uses only fixture-backed headline figures", () => {
    const en = productDemoFor("en");
    expect(en.overview).toMatchObject({ visibility: 79, share: 35, prompts: 42, evaluations: 3120 });
    expect(en.shareOfVoice.rows.map((row) => row.brand)).toEqual(["Your brand", "Competitor A", "Competitor B", "Competitor C"]);
  });

  it("localizes the Chinese evidence rather than wrapping English prompts", () => {
    const zh = productDemoFor("zh");
    expect(zh.labels.sampleWorkspace).toContain("示例工作区");
    expect(zh.queryFanOut.prompt).toMatch(/[\u4e00-\u9fff]/u);
    expect(zh.queryFanOut.prompt).not.toContain("What should");
  });
});
```

- [ ] **Step 2: Run and confirm the module is missing**

Run: `pnpm --filter @workspace/www test -- product-demo.test.ts`

Expected: FAIL because `product-demo.ts` does not exist.

- [ ] **Step 3: Implement the immutable content model**

Define exact types for labels, overview metrics, share-of-voice rows, opportunity rows, and query fan-out lines. Store English and Chinese examples independently. Include explicit sample-data and coverage-boundary copy in both locales.

- [ ] **Step 4: Run the content tests**

Run: `pnpm --filter @workspace/www test -- product-demo.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

Run: `git add apps/www/src/content/experience/product-demo.ts apps/www/src/content/experience/product-demo.test.ts`

Run: `git commit -m "feat(www): add deidentified product demo contract"`

---

### Task 3: Faithful product proof scene

**Files:**
- Create: `apps/www/src/components/experience/shared/product-proof-scene.tsx`
- Test: `apps/www/src/components/experience/shared/product-proof-scene.test.tsx`

**Interfaces:**
- Consumes: `productDemoFor(locale)` and existing `useRovingTabs` from `use-roving-tabs.ts`.
- Produces: `ProductProofScene({ locale, compact? }: { locale: ExperienceLocale; compact?: boolean })`.

- [ ] **Step 1: Write the failing semantic-render test**

```tsx
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ProductProofScene } from "./product-proof-scene";

describe("ProductProofScene", () => {
  it("renders real product labels, safe values, and accessible views", () => {
    const html = renderToStaticMarkup(<ProductProofScene locale="en" />);
    expect(html).toContain('role="tablist"');
    expect(html).toContain("AI Visibility");
    expect(html).toContain("Share of Voice Leaderboard");
    expect(html).toContain("3,120");
    expect(html).toContain("Query Fan-Out");
    expect(html).toContain("Sample workspace");
    expect(html).not.toMatch(/customer result|guaranteed|benchmark/i);
  });
});
```

- [ ] **Step 2: Run and confirm the component is missing**

Run: `pnpm --filter @workspace/www test -- product-proof-scene.test.tsx`

Expected: FAIL because the component does not exist.

- [ ] **Step 3: Implement the scene**

Use accessible tabs for Overview, Share of Voice, Opportunities, and Query Fan-Out. Render square, ledger-like product structure with no floating card wall. Keep all panel summaries in the React tree and use `hidden`/tabpanel semantics to preserve SSR text.

- [ ] **Step 4: Run the focused tests**

Run: `pnpm --filter @workspace/www test -- product-proof-scene.test.tsx product-demo.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

Run: `git add apps/www/src/components/experience/shared/product-proof-scene.tsx apps/www/src/components/experience/shared/product-proof-scene.test.tsx`

Run: `git commit -m "feat(www): add faithful product proof scene"`

---

### Task 4: Causal homepage decision trace

**Files:**
- Create: `apps/www/src/components/experience/shared/decision-trace-scene.tsx`
- Test: `apps/www/src/components/experience/shared/decision-trace-scene.test.tsx`

**Interfaces:**
- Consumes: `productDemoFor(locale)`, `useRovingTabs`, `ExperienceLocale`.
- Produces: `DecisionTraceScene({ locale }: { locale: ExperienceLocale })`.

- [ ] **Step 1: Write the failing invariant and SSR test**

```tsx
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DecisionTraceScene } from "./decision-trace-scene";

describe("DecisionTraceScene", () => {
  it("keeps one question while exposing all four review states in SSR", () => {
    const html = renderToStaticMarkup(<DecisionTraceScene locale="en" />);
    expect(html.match(/Which partner can support this decision/g)?.length).toBe(1);
    for (const label of ["Observe", "Compare", "Inspect", "Decide"]) expect(html).toContain(label);
    expect(html).toContain("79%");
    expect(html).toContain("35%");
    expect(html).toContain("Sample workspace");
  });
});
```

- [ ] **Step 2: Run and confirm the component is missing**

Run: `pnpm --filter @workspace/www test -- decision-trace-scene.test.tsx`

Expected: FAIL because the component does not exist.

- [ ] **Step 3: Implement direct and automatic state control**

Use a semantic tab list for four states. Keep all state facts in SSR panels. Add automatic progression only after hydration, only while the scene is visible, only when reduced motion is false, and stop it permanently after direct visitor selection. Concentric geometry must carry labelled Observation, Comparison, Evidence, and Decision relationships.

- [ ] **Step 4: Run the focused test**

Run: `pnpm --filter @workspace/www test -- decision-trace-scene.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

Run: `git add apps/www/src/components/experience/shared/decision-trace-scene.tsx apps/www/src/components/experience/shared/decision-trace-scene.test.tsx`

Run: `git commit -m "feat(www): add causal decision trace"`

---

### Task 5: Same-record Human/Agent transform

**Files:**
- Create: `apps/www/src/components/experience/shared/canonical-record-transform.tsx`
- Test: `apps/www/src/components/experience/shared/canonical-record-transform.test.tsx`

**Interfaces:**
- Consumes: canonical category records from `canonical-public-facts.ts` and `ExperienceLocale`.
- Produces: `CanonicalRecordTransform({ locale, compact? }: { locale: ExperienceLocale; compact?: boolean })`.

- [ ] **Step 1: Write the failing same-fact invariant test**

```tsx
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CanonicalRecordTransform } from "./canonical-record-transform";

describe("CanonicalRecordTransform", () => {
  it("renders the canonical fact once and attaches source, boundary, identity and review metadata", () => {
    const html = renderToStaticMarkup(<CanonicalRecordTransform locale="en" />);
    const fact = "AI-native MarTech infrastructure built for decisions made by people and shaped by agents.";
    expect(html.split(fact)).toHaveLength(2);
    for (const label of ["Public basis", "Boundary", "Stable identity", "Review date"]) expect(html).toContain(label);
    expect(html).toContain('type="range"');
    expect(html).not.toContain("token reduction");
  });
});
```

- [ ] **Step 2: Run and confirm the component is missing**

Run: `pnpm --filter @workspace/www test -- canonical-record-transform.test.tsx`

Expected: FAIL because the component does not exist.

- [ ] **Step 3: Implement one continuous record**

Render one central category fact. Use a native range control to reveal surrounding metadata without duplicating the fact into Human and Agent cards. Add direct Human/Agent reading buttons using the same progress model. Announce the current reading structure with `aria-live` and expose the final explicit state under reduced motion.

- [ ] **Step 4: Run the focused test**

Run: `pnpm --filter @workspace/www test -- canonical-record-transform.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

Run: `git add apps/www/src/components/experience/shared/canonical-record-transform.tsx apps/www/src/components/experience/shared/canonical-record-transform.test.tsx`

Run: `git commit -m "feat(www): transform one record for people and agents"`

---

### Task 6: Route integration, conversion context, and Site 06 styling

**Files:**
- Modify: `apps/www/src/components/experience/global/global-pages.tsx`
- Modify: `apps/www/src/components/experience/china/china-pages.tsx`
- Modify: `apps/www/src/components/experience/shared/lead-form.tsx`
- Modify: `apps/www/src/styles/experience/site-06.css`
- Modify: `apps/www/src/components/experience/global/global-experience.test.tsx`
- Modify: `apps/www/src/components/experience/china/china-experience.test.tsx`
- Modify: `apps/www/src/styles.test.ts`
- Test: `apps/www/src/components/experience/site-06-interaction-integration.test.tsx`

**Interfaces:**
- Consumes: `DecisionTraceScene`, `ProductProofScene`, `CanonicalRecordTransform`, existing `LeadForm`.
- Produces: fully integrated EN/ZH routes while preserving the existing lead request schema.

- [ ] **Step 1: Write the failing route integration test**

```tsx
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GlobalHomePage, GlobalProductPage, GlobalCompanyPage, GlobalDiagnosticPage } from "./global/global-pages";
import { ChinaHomePage, ChinaProductPage, ChinaCompanyPage, ChinaDiagnosticPage } from "./china/china-pages";

describe("Site 06 interaction integration", () => {
  it("adds the three new scene identities to both localized sites", () => {
    const en = [GlobalHomePage(), GlobalProductPage(), GlobalCompanyPage()]
      .map((page) => renderToStaticMarkup(page))
      .join("\n");
    const zh = [ChinaHomePage(), ChinaProductPage(), ChinaCompanyPage()]
      .map((page) => renderToStaticMarkup(page))
      .join("\n");
    for (const html of [en, zh]) {
      expect(html).toContain('data-scene-object="decision-trace"');
      expect(html).toContain('data-scene-object="product-proof"');
      expect(html).toContain('data-scene-object="canonical-record-transform"');
    }
  });

  it("keeps exactly three visible fields in each contact form", () => {
    const en = renderToStaticMarkup(<GlobalDiagnosticPage />);
    const zh = renderToStaticMarkup(<ChinaDiagnosticPage />);
    expect(en.match(/data-lead-field=/g)).toHaveLength(3);
    expect(zh.match(/data-lead-field=/g)).toHaveLength(3);
  });
});
```

- [ ] **Step 2: Run and confirm integration fails**

Run: `pnpm --filter @workspace/www test -- site-06-interaction-integration.test.tsx`

Expected: FAIL because the new scene identities are not integrated.

- [ ] **Step 3: Integrate route-specific compositions**

Keep the existing Site 06 section order and replace only the weak interaction surfaces. Add decision trace to both localized home cinematic fields, product proof to home/product routes, and canonical-record transform to home/company routes. Preserve every canonical fact anchor and existing machine link.

- [ ] **Step 4: Improve the CTA without adding a field**

Keep visible fields and the submitted schema unchanged. Add concise locale-specific expectation copy around the form. Do not change provider delivery, privacy request behaviour, retry preservation, or analytics sanitization.

- [ ] **Step 5: Implement unified styling**

Extend `site-06.css` with square, document-led product states, semantic concentric traces, one-record reveal, responsive linearization, visible focus, and reduced-motion rules. Preserve the binding token values and route-specific compositions. Orange remains limited to active rules, one data series, focus, and final submit.

- [ ] **Step 6: Run route, style, form, Agent, and machine tests**

Run: `pnpm --filter @workspace/www test -- site-06-interaction-integration.test.tsx global-experience.test.tsx china-experience.test.tsx styles.test.ts site-generation.test.tsx machine-documents.test.ts markdown-negotiation.test.ts diagnostic-delivery.server.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit**

Run: `git add apps/www/src/components/experience apps/www/src/styles/experience/site-06.css apps/www/src/styles.test.ts`

Run: `git commit -m "feat(www): integrate Site 06 product interactions"`

---

### Task 7: Full verification, visual review, and production release

**Files:**
- Modify if acceptance exposes a defect: only files already listed in Tasks 1–6.
- Generate locally but do not commit: acceptance screenshots and browser logs.

**Interfaces:**
- Consumes: complete interaction upgrade.
- Produces: release commit and verified production deployment.

- [ ] **Step 1: Run formatter/lint and type checking**

Run: `pnpm exec biome check --config-path=biome.json apps/www/src`

Run: `pnpm --filter @workspace/www check-types`

Expected: both exit 0.

- [ ] **Step 2: Run the complete website suite and build**

Run: `pnpm --filter @workspace/www test`

Run: `pnpm --filter @workspace/www build`

Expected: 0 failures and a successful production bundle.

- [ ] **Step 3: Run release and policy audits**

Run: `pnpm --filter @workspace/www audit:legacy-marketing`

Run: `pnpm --filter @workspace/www audit:site-manifest`

Run: `pnpm audit:public-output`

Run: `pnpm test:public-output-policy`

Run: `pnpm verify:public-output-release`

Expected: no retired public surface, no forbidden public output, and all route/manifests valid.

- [ ] **Step 4: Run browser acceptance**

Start the production build locally. Exercise EN/ZH home, product, company, markets, contact, privacy, and Agent routes at 1440, 1280, 390, and 360. For each new scene, activate every tab using mouse and keyboard; scrub the canonical record; submit only against a mocked/local endpoint; repeat with reduced motion. Assert zero page errors, hydration errors, horizontal overflow, clipped focus, or hidden public meaning.

- [ ] **Step 5: Perform two independent reviews**

Dispatch a spec-compliance reviewer and a visual/interaction-quality reviewer. Both compare the rendered site against the 2026-08-27 fidelity baseline and the 2026-08-28 interaction spec. Fix every Critical or Important finding and repeat the affected verification.

- [ ] **Step 6: Verify clean release diff and commit any acceptance fixes**

Run: `git status -sb`

Run: `git diff --check`

Run: `git diff --stat origin/main...HEAD`

Expected: only intended Site 06 interaction, asset, test, spec, and plan changes; no visual-companion files, generated screenshots, environment files, dependency changes, or customer data.

- [ ] **Step 7: Push and verify production**

Push the release branch using the repository's established production workflow. Confirm `https://yonaris.com` serves the new original assets and scene markers, EN/ZH forms retain their exact field contracts, Resources remains unavailable, and Human/Agent machine contracts still negotiate correctly.
