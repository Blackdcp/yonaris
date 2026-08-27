# Yonaris Site 06 Visual Fidelity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the simplified production Site 06 interpretation with a faithful, responsive React implementation of the approved whole-site visual source while preserving all content, machine-surface, form, SEO, and release contracts.

**Architecture:** Track the approved prototype inside the repository, then build a small vocabulary of visual-object components that preserve its cinematic fields, evidence sheets, workbenches, comparison stages, dual-reading stages, system field, replay stage, and Agent fact directory. English and Chinese pages compose those objects independently; route-specific scene markers and screenshot baselines prevent another generic-template collapse.

**Tech Stack:** React 19, TanStack Start SSR, TypeScript, CSS, Vitest, Playwright, axe-core, Caddy production smoke.

**Spec:** `docs/superpowers/specs/2026-08-27-yonaris-site-06-fidelity-design.md`

## Global Constraints

- Binding visual source: `E:/Yonaris/.superpowers/brainstorm/1950-1787739192/content/site-system-multipage-agent-06.html` until its exact snapshot is tracked by Task 1.
- Preserve exact category strings: `AI-native MarTech infrastructure built for decisions made by people and shaped by agents.` and `面向人类决策、由 Agent 共同塑造的 AI 原生营销科技基础设施。`
- Preserve existing routes, redirects, canonical/hreflang, robots, sitemap, content negotiation, Human/Agent fact identity, forms, email endpoint, privacy truthfulness, Caddy boundaries, and production release safety.
- H1 remains `clamp(38px, 4vw, 48px)`; H2 remains `clamp(29px, 3.3vw, 40px)`; maximum content width remains `1220px`.
- Orange is a focus colour. Only the high-intent form submit may be a filled orange control.
- No generic two-column hero may determine every route. No equal-size card wall, bento grid, numbered rail, decorative arrow glyph, dashboard mockup, fake metric, fake outcome, fake logo, upstream-origin claim, retired framework attribution, or Resources surface.
- Meaningful interaction must be keyboard operable and visibly responsive. Subtle continuous image/geometry motion is allowed only when `prefers-reduced-motion: reduce` produces a stable equivalent.
- Desktop acceptance widths are `1440` and `1280`; mobile acceptance widths are `390` and `360`.
- Every task follows RED → verify RED → GREEN → verify GREEN → refactor, and ends in an independently reviewable commit.

---

### Task 1: Track the approved source and build the visual-object foundation

**Files:**
- Create: `docs/design/site-06-reference/site-system-multipage-agent-06.html`
- Create: `docs/design/site-06-reference/README.md`
- Create: `docs/design/site-06-reference/assets/photo-office-unsplash-1497366811353.jpg`
- Create: `docs/design/site-06-reference/assets/photo-business-walk-pexels-8526452.jpg`
- Create: `docs/design/site-06-reference/assets/photo-lobby-pexels-18592586.jpg`
- Create: `docs/design/site-06-reference/assets/photo-evidence-unsplash-1450101499163.jpg`
- Create: `docs/design/site-06-reference/assets/photo-glass-meeting-pexels-3760089.jpg`
- Create: `docs/design/site-06-reference/assets/photo-warm-office-pexels-31771712.jpg`
- Create: `docs/design/site-06-reference/assets/photo-working-unsplash-1524758631624.jpg`
- Create: `apps/www/src/components/experience/shared/cinematic-field.tsx`
- Create: `apps/www/src/components/experience/shared/evidence-sheet.tsx`
- Create: `apps/www/src/components/experience/shared/comparison-stage.tsx`
- Create: `apps/www/src/components/experience/shared/dual-reading-stage.tsx`
- Create: `apps/www/src/components/experience/shared/visual-objects.test.tsx`
- Modify: `apps/www/src/components/experience/shared/site-06-foundation.test.tsx`
- Modify: `apps/www/src/styles/experience/site-06.css`
- Modify: `apps/www/src/styles.test.ts`
- Add: `apps/www/public/brand/site-06/evidence-room.jpg`
- Add: `apps/www/public/brand/site-06/glass-meeting.jpg`
- Add: `apps/www/public/brand/site-06/warm-office.jpg`
- Add: `apps/www/public/brand/site-06/working-session.jpg`

**Interfaces:**
- Produces: `CinematicField`, `EvidenceSheet`, `ComparisonStage`, and `DualReadingStage` with semantic children/records and `data-scene-object` markers.
- Produces: CSS scene primitives `.site-06-cinematic`, `.site-06-evidence-sheet`, `.site-06-comparison-stage`, `.site-06-dual-stage` and reduced-motion behaviour.
- Consumes: existing `ReadingRecord`, `useRovingTabs`, category records, wordmarks, and the approved source asset directory.

- [ ] **Step 1: Copy the approved source into a tracked design-reference directory**

Copy the exact HTML and all seven photography files from the binding source directory. `README.md` records the original absolute source, SHA-256 of the HTML, filename mapping, photography credit/source IDs, and the rule that this directory is design reference only and is never served by the marketing app.

- [ ] **Step 2: Write failing visual-object tests**

Add real render tests that require semantic object identity and usable content:

```tsx
it("renders a cinematic field as layered media rather than a card", () => {
  const html = renderToStaticMarkup(
    <CinematicField image={{ src: "/brand/site-06/conference-room.jpg", alt: "Conference room" }}>
      <h1>Decision headline</h1>
      <EvidenceSheet label="Observed answer">Evidence body</EvidenceSheet>
    </CinematicField>,
  );
  expect(html).toContain('data-scene-object="cinematic-field"');
  expect(html).toContain('data-scene-object="evidence-sheet"');
  expect(html).toContain("Decision headline");
  expect(html).not.toContain("site-06-hero__media");
});

it("keeps one question fixed across a comparison", () => {
  const html = renderToStaticMarkup(<ComparisonStage {...literalComparisonFixture} />);
  expect(html.match(/Which company can support this decision/g)).toHaveLength(1);
  expect(html).toContain('role="tablist"');
  expect(html).toContain("Baseline");
  expect(html).toContain("Retest");
});
```

Update `styles.test.ts` so the mutation “remove the cinematic overlay, photo breathing motion, or reduced-motion override” fails. Replace the old blanket `animation-iteration-count: infinite` rejection with behaviour checks that require both the normal animation declaration and an explicit reduced-motion override.

- [ ] **Step 3: Run the focused tests and verify RED**

Run:

```powershell
pnpm --filter @workspace/www exec vitest run src/components/experience/shared/visual-objects.test.tsx src/components/experience/shared/site-06-foundation.test.tsx src/styles.test.ts
```

Expected: FAIL because the four scene components, new scene selectors, complete asset set, and revised motion contract do not exist.

- [ ] **Step 4: Implement the four visual objects and prototype-faithful CSS**

Implement semantic React components rather than `dangerouslySetInnerHTML`. Preserve the prototype's full-bleed photography, tonal overlay, evidence-sheet angle/depth, fine-line annotations, comparison geometry, dual-reading geometry, and responsive stacking. Use CSS custom properties for focal position and tonal overlays. Do not add route copy to shared components.

- [ ] **Step 5: Run focused tests and the full unit baseline**

Run:

```powershell
pnpm --filter @workspace/www exec vitest run src/components/experience/shared/visual-objects.test.tsx src/components/experience/shared/site-06-foundation.test.tsx src/styles.test.ts
pnpm --filter @workspace/www exec vitest run
```

Expected: all tests PASS with no warnings.

- [ ] **Step 6: Commit Task 1**

```powershell
git add docs/design/site-06-reference apps/www/public/brand/site-06 apps/www/src/components/experience/shared apps/www/src/styles/experience/site-06.css apps/www/src/styles.test.ts
git commit -m "build the faithful Site 06 visual objects"
```

### Task 2: Recompose every English Human route

**Files:**
- Modify: `apps/www/src/components/experience/global/global-pages.tsx`
- Modify: `apps/www/src/components/experience/global/global-scenes.tsx`
- Modify: `apps/www/src/components/experience/global/global-experience.test.tsx`
- Modify: `apps/www/src/content/experience/global-copy.ts`
- Modify: `apps/www/src/styles/experience/site-06.css`

**Interfaces:**
- Consumes: Task 1 visual objects and existing `EvidenceInspector`, `ReviewSwitch`, `ReadingLens`, `LeadForm`, and canonical fact records.
- Produces: seven English route scenes with unique `data-page-composition` values: `cinematic-orbit`, `evidence-workbench`, `comparison-field`, `dual-reading-field`, `market-editorial`, `contact-cinematic`, `privacy-editorial`.

- [ ] **Step 1: Replace generic-layout assertions with failing route-composition tests**

Add literal expectations for all seven page renderers:

```tsx
const compositions = {
  home: "cinematic-orbit",
  product: "evidence-workbench",
  approach: "comparison-field",
  company: "dual-reading-field",
  geo: "market-editorial",
  diagnostic: "contact-cinematic",
  privacy: "privacy-editorial",
} as const;

for (const [route, composition] of Object.entries(compositions)) {
  it(`${route} has its own approved composition`, () => {
    const html = renderEnglishRoute(route);
    expect(html).toContain(`data-page-composition="${composition}"`);
  });
}

it("does not route every page through the old generic hero", () => {
  const pages = Object.keys(compositions).map(renderEnglishRoute);
  expect(pages.filter((html) => html.includes("site-06-hero__media"))).toHaveLength(0);
});
```

Add behaviour tests proving Product changes source/boundary/buying effect, Approach holds one question across baseline/retest, Company exposes the dual-reading control above its first section boundary, and Diagnostic still renders exactly three visible fields.

- [ ] **Step 2: Run English tests and verify RED**

Run:

```powershell
pnpm --filter @workspace/www exec vitest run src/components/experience/global/global-experience.test.tsx src/components/experience/shared/lead-form.test.tsx
```

Expected: FAIL because current pages share the generic `Hero` and do not publish route-specific composition identity.

- [ ] **Step 3: Implement the English route compositions**

Recompose each route according to the spec. Keep approved prospect-facing copy and exact category wording. Split private route components inside `global-pages.tsx` or focused neighbouring files when a scene exceeds one responsibility; do not create another universal page template. Use the complete approved photo set with explicit focal positions. Keep existing evidence semantics and form delivery unchanged.

- [ ] **Step 4: Run English tests and typecheck**

Run:

```powershell
pnpm --filter @workspace/www exec vitest run src/components/experience/global/global-experience.test.tsx src/components/experience/shared/lead-form.test.tsx src/components/experience/site-generation.test.tsx
pnpm --filter @workspace/www check-types
```

Expected: English routes preserve exact H1/copy, form fields, and assets; typecheck exits 0. Raw production smoke remains in Task 5, where the production server lifecycle is owned by the release gate.

- [ ] **Step 5: Commit Task 2**

```powershell
git add apps/www/src/components/experience/global apps/www/src/content/experience/global-copy.ts apps/www/src/styles/experience/site-06.css
git commit -m "recompose the English Site 06 experience"
```

### Task 3: Recompose every Chinese Human route

**Files:**
- Modify: `apps/www/src/components/experience/china/china-pages.tsx`
- Modify: `apps/www/src/components/experience/china/china-scenes.tsx`
- Modify: `apps/www/src/components/experience/china/china-experience.test.tsx`
- Modify: `apps/www/src/content/experience/china-copy.ts`
- Modify: `apps/www/src/styles/experience/site-06.css`

**Interfaces:**
- Consumes: Task 1 visual objects, existing `EvidenceInspector`, `ReadingLens`, `ReviewSwitch`, `LeadForm`, and canonical Chinese facts.
- Produces: seven Chinese route scenes with unique `data-page-composition` values: `cinematic-anxiety`, `system-field`, `breakdown-replay`, `dual-reading-field-zh`, `market-editorial-zh`, `contact-cinematic-zh`, `privacy-editorial-zh`.

- [ ] **Step 1: Write failing Chinese route-composition and interaction tests**

Require all seven composition markers and these customer-visible behaviours:

```tsx
it("keeps the relationship preview before the six-node system field", () => {
  const html = renderToStaticMarkup(<ChinaProductPage />);
  expect(html).toContain('data-page-composition="system-field"');
  expect(html).toContain('data-scene-object="relationship-preview"');
  expect(html).toContain('data-scene-object="system-field"');
  expect(html).toContain("市场问题");
  expect(html).toContain("行动与复核");
  expect(html.indexOf('data-scene-object="relationship-preview"')).toBeLessThan(
    html.indexOf('data-scene-object="system-field"'),
  );
});

it("keeps one example through 基线、断点、行动、复核", () => {
  const html = renderToStaticMarkup(<ChinaApproachPage />);
  expect(html).toContain('data-page-composition="breakdown-replay"');
  for (const label of ["基线", "断点", "行动", "复核"]) expect(html).toContain(label);
  expect(html).toContain("无法归因");
});
```

Retain tests for locally written anxiety copy, exact Chinese category, prominent Agent mode, and exactly 姓名、电话、公司 on the contact form.

- [ ] **Step 2: Run Chinese tests and verify RED**

Run:

```powershell
pnpm --filter @workspace/www exec vitest run src/components/experience/china/china-experience.test.tsx src/components/experience/shared/lead-form.test.tsx
```

Expected: FAIL because the system relationship is currently represented by a generic orbit/tab record and the routes share generic hero composition.

- [ ] **Step 3: Implement the Chinese-specific compositions**

Build a real spatial `SystemField` and `ReplayStage` in `china-scenes.tsx`, with accessible controls and stable reading order. Recompose home around anxiety, not role; keep Chinese business language and commercial urgency. Use the shared design grammar at English quality without translating the English layout. Preserve factual boundaries and do not imply real-time automation.

- [ ] **Step 4: Run Chinese tests, whole unit suite, and typecheck**

Run:

```powershell
pnpm --filter @workspace/www exec vitest run src/components/experience/china/china-experience.test.tsx src/components/experience/site-generation.test.tsx src/content/experience/category-contract.test.tsx
pnpm --filter @workspace/www exec vitest run
pnpm --filter @workspace/www check-types
```

Expected: all tests PASS with no old generic hero requirement restored.

- [ ] **Step 5: Commit Task 3**

```powershell
git add apps/www/src/components/experience/china apps/www/src/content/experience/china-copy.ts apps/www/src/styles/experience/site-06.css
git commit -m "recompose the Chinese Site 06 experience"
```

### Task 4: Rebuild the Agent fact directory and finish meaningful motion

**Files:**
- Modify: `apps/www/src/components/experience/agent/agent-pages.tsx`
- Modify: `apps/www/src/components/experience/agent/agent-experience.test.tsx`
- Modify: `apps/www/src/styles/experience/agent.css`
- Modify: `apps/www/src/styles/experience/site-06.css`
- Modify: `apps/www/src/components/experience/shared/site-06-shell.tsx`
- Modify: `apps/www/src/components/experience/shared/site-06-foundation.test.tsx`

**Interfaces:**
- Consumes: canonical public fact records and stable Human/Markdown/JSON-LD route mappings.
- Produces: a distinct `data-page-composition="fact-directory"` Agent surface with question index, answer document, fact anchors, evidence inspector, and stable record navigation.

- [ ] **Step 1: Write failing Agent-directory and motion tests**

```tsx
it("renders a fact directory instead of the Human page stack", () => {
  const html = renderAgentRoute("home", "en");
  expect(html).toContain('data-page-composition="fact-directory"');
  expect(html).toContain('data-scene-object="question-index"');
  expect(html).toContain('data-scene-object="fact-inspector"');
  expect(html).toContain("Stable ID");
  expect(html).not.toContain('data-page-composition="cinematic-orbit"');
});
```

Add a stylesheet behaviour test requiring normal-mode photo/geometry motion and reduced-motion cancellation. Keep keyboard tests for question, fact, and Human/Agent mode controls.

- [ ] **Step 2: Run Agent/foundation tests and verify RED**

Run:

```powershell
pnpm --filter @workspace/www exec vitest run src/components/experience/agent/agent-experience.test.tsx src/components/experience/shared/site-06-foundation.test.tsx src/styles.test.ts
```

Expected: FAIL because the current Agent page lacks the prototype's directory/inspector composition and normal-mode motion contract.

- [ ] **Step 3: Implement the fact directory and motion details**

Use semantic buttons, headings, `aria-current`, visible focus, real anchors, and initial SSR facts. Do not claim the visual surface guarantees retrieval. Motion must be subtle, never move text, never auto-advance state, and stop under reduced motion. Keep the Human/Agent switch as prominent as the locale switch on desktop and mobile.

- [ ] **Step 4: Run Agent, SEO, and machine-surface verification**

Run:

```powershell
pnpm --filter @workspace/www exec vitest run src/components/experience/agent/agent-experience.test.tsx src/components/experience/shared/site-06-foundation.test.tsx src/components/experience/site-generation.test.tsx src/content/experience/category-contract.test.tsx
pnpm --filter @workspace/www exec vitest run
pnpm --filter @workspace/www check-types
```

Expected: all Human/Agent fact identity and visual tests PASS.

- [ ] **Step 5: Commit Task 4**

```powershell
git add apps/www/src/components/experience/agent apps/www/src/components/experience/shared/site-06-shell.tsx apps/www/src/styles/experience
git commit -m "build the Site 06 Agent fact directory"
```

### Task 5: Add visual-fidelity gates, complete responsive QA, and release

**Files:**
- Create: `e2e/www-tests/site-06-fidelity.spec.ts`
- Create: `e2e/www-tests/site-06-fidelity.spec.ts-snapshots/*`
- Modify: `e2e/www-tests/dual-region-release.spec.ts`
- Modify: `apps/www/scripts/smoke-marketing.mjs`
- Modify: `.changeset/site-06-marketing.md`

**Interfaces:**
- Consumes: all route-specific `data-page-composition` and `data-scene-object` markers from Tasks 1–4.
- Produces: committed desktop/mobile screenshot baselines and a release gate that fails if route-specific compositions collapse back into one generic template.

- [ ] **Step 1: Write failing production-browser fidelity tests**

Use a literal route matrix and assert composition identity, media role, heading size, no generic hero card, prominent mode control, no overflow, and interaction state change:

```ts
for (const fixture of fidelityRoutes) {
  test(`${fixture.path} preserves its approved composition`, async ({ page }) => {
    await page.goto(fixture.path);
    await expect(page.locator(`[data-page-composition="${fixture.composition}"]`)).toHaveCount(1);
    await expect(page.locator("h1")).toHaveCSS("font-size", fixture.desktopH1);
    await expect(page.locator(".site-06-hero__media")).toHaveCount(0);
    await expect(page).toHaveScreenshot(fixture.snapshot, {
      animations: "disabled",
      caret: "hide",
      fullPage: false,
    });
  });
}
```

Use separate projects/fixtures at `1440`, `1280`, `390`, and `360`. Screenshot the first viewport for every visible route and full pages for English home, Chinese home, Product/System, Evidence/Breakdown, Human + Agent, Contact, and Agent home.

- [ ] **Step 2: Run the new browser test and verify RED**

Run the production server through Playwright `webServer`, then:

```powershell
pnpm exec playwright test --config e2e/playwright.config.ts e2e/www-tests/site-06-fidelity.spec.ts --project=chromium
```

Expected before baselines/last fixes: FAIL on absent baseline screenshots or any remaining composition, responsive, or interaction mismatch.

- [ ] **Step 3: Generate and inspect the screenshot matrix**

Render the tracked approved prototype and production pages at matching widths. Compare side by side for composition, image role, type hierarchy, colour balance, spacing rhythm, interaction affordance, and route distinctness. Update production code, not expectations, for genuine drift. Generate final Playwright baselines only after visual review.

- [ ] **Step 4: Run the complete release gate**

Run:

```powershell
pnpm --filter @workspace/www exec vitest run
pnpm --filter @workspace/www check-types
pnpm exec tsc -p e2e/tsconfig.json --noEmit
pnpm --filter @workspace/www build
pnpm exec playwright test --config e2e/playwright.config.ts e2e/www-tests/dual-region-release.spec.ts e2e/www-tests/site-06-fidelity.spec.ts --project=chromium
pnpm --filter @workspace/www smoke:marketing:caddy
pnpm audit:public-output
pnpm test:public-output-policy
pnpm verify:public-output-release
pnpm --filter @workspace/www audit:site-manifest
pnpm --filter @workspace/www audit:legacy-marketing
node --test deploy/las/bin/marketing-workflow.test.mjs deploy/las/caddy/yonaris-marketing.test.mjs apps/www/scripts/smoke-marketing-caddy.test.mjs
pnpm --filter @workspace/www exec vitest run src/lib/caddy-policy.test.ts
git diff --check
```

Expected: all PASS; no large new bundle warning beyond the existing advisory.

- [ ] **Step 5: Commit Task 5**

```powershell
git add e2e/www-tests apps/www/scripts .changeset/site-06-marketing.md
git commit -m "verify the faithful Site 06 release"
```

- [ ] **Step 6: Review, push, deploy, and verify production**

Run a whole-branch review against this plan and spec. After Critical and Important findings are resolved, push the feature branch and `main`, observe `.github/workflows/deploy-marketing.yaml`, then verify public English/Chinese/Agent pages, assets, forms without sending a real lead, canonical/hreflang, machine content types, Resources 404, restricted brand paths, release marker, source SHA, image SHA, and healthy container.
