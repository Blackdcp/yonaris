# Yonaris Human Visual System Correction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the shared legacy Human-page composition with two genuinely regional Yonaris visual systems: a cinematic, product-led global edition and a conclusion-first, proof-led Chinese edition, while preserving brand assets, factual content, public routes, Agent views, and the locale-specific three-field lead forms.

**Architecture:** Keep the regional shells, route registry, content models, lead endpoint, and Agent fact layer. Replace the Human presentation layer through new regional page primitives, page-specific visual stages, and progressive interactions. Add structural visual-contract tests plus Playwright screenshot assertions so a release can no longer pass merely because screenshots were written to disk.

**Tech Stack:** Node.js 24, pnpm 11, TypeScript 7, React 19, TanStack Start/Router, CSS, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-08-25-yonaris-dual-audience-regional-website-redesign.md`

## Global Constraints

- Use the approved Yonaris wordmarks and Yonaris Ink, Paper, and Signal Orange; do not imitate competitor branding, claims, proof, images, or colors.
- The global Human edition follows a global enterprise-product pattern for cinematic staging, early platform architecture, product-led explanation, and outcome-to-proof pacing.
- The Chinese Human edition follows a China ToB decision pattern for conclusion-first scanning, explicit service-system explanation, delivery certainty, proof rhythm, and China-to-global capability framing.
- The Human/Agent dual-view principle governs only the visible relationship between the two modes and their reading-density separation.
- Every active page retains semantic text, keyboard access, touch access, reduced-motion support, and a meaningful non-interactive initial state.
- Preserve all existing routes, metadata, lead-field contracts, server-side mail delivery, Agent fact parity, and public-output policy.
- Apply the repository public-output policy to every source, build artifact, and page without restating prohibited origin or licensing vocabulary.
- Release order is global Human first, then Chinese Human, followed by a full dual-region audit.

---

### Task 1: Lock the corrected visual contracts

**Files:**
- Modify: `apps/www/src/components/site/global-en/pages/global-english-pages.test.tsx`
- Modify: `apps/www/src/components/site/zh-cn/pages/zh-pages.test.tsx`
- Modify: `e2e/www-tests/dual-region-release.spec.ts`
- Modify: `e2e/www-tests/helpers/core-site.ts`

**Interfaces:**
- Consumes: existing page renderers and Playwright site launcher.
- Produces: structural markers `data-visual-system="global-cinematic"` and `data-visual-system="zh-decision"`, page-stage markers, and screenshot assertions that compare against committed baselines.

- [ ] **Step 1: Write failing regional structural tests**

Add assertions equivalent to:

```tsx
expect(home).toContain('data-visual-system="global-cinematic"');
expect(home).toContain('data-stage="global-hero"');
expect(home).toContain('data-stage="operating-system"');
expect(home).not.toContain('class="global-en__section-head"');

expect(zhHome).toContain('data-visual-system="zh-decision"');
expect(zhHome).toContain('data-stage="market-command"');
expect(zhHome).toContain('data-stage="delivery-proof"');
expect(zhHome).not.toContain('class="zh-site__section-head"');
```

- [ ] **Step 2: Run the focused Vitest files and verify RED**

Run:

```powershell
pnpm.cmd --filter @workspace/www exec vitest run --config vitest.config.ts src/components/site/global-en/pages/global-english-pages.test.tsx src/components/site/zh-cn/pages/zh-pages.test.tsx
```

Expected: FAIL because the new visual-system and stage markers do not exist and the legacy section-head classes still render.

- [ ] **Step 3: Replace screenshot capture-only coverage with comparison coverage**

Add a helper with this behavior:

```ts
export async function expectVisualBaseline(page: Page, name: string): Promise<void> {
	await expect(page).toHaveScreenshot(name, {
		animations: "disabled",
		caret: "hide",
		fullPage: true,
		maxDiffPixelRatio: 0.015,
	});
}
```

Call it for desktop global and Chinese Human home pages after font readiness and reduced-motion stabilization. Retain `captureQa` only for debugging artifacts.

- [ ] **Step 4: Run the focused E2E test and verify RED**

Run:

```powershell
pnpm.cmd --filter e2e exec playwright test www-tests/dual-region-release.spec.ts --project=chromium --grep "visual baseline"
```

Expected: FAIL because committed corrected baselines do not yet exist.

- [ ] **Step 5: Commit the failing contracts**

```powershell
git add apps/www/src/components/site/global-en/pages/global-english-pages.test.tsx apps/www/src/components/site/zh-cn/pages/zh-pages.test.tsx e2e/www-tests/dual-region-release.spec.ts e2e/www-tests/helpers/core-site.ts
git commit -m "test: lock regional human visual systems"
```

---

### Task 2: Build the global cinematic composition system

**Files:**
- Modify: `apps/www/src/components/site/global-en/global-english-shell.tsx`
- Modify: `apps/www/src/components/site/global-en/pages/page-primitives.tsx`
- Modify: `apps/www/src/styles/global-en/core.css`
- Test: `apps/www/src/components/site/global-en/pages/global-english-pages.test.tsx`
- Test: `apps/www/src/styles/global-en/core.test.ts`

**Interfaces:**
- Consumes: existing global header, footer, wordmark, content, actions, and visual children.
- Produces: `GlobalHeroStage`, `GlobalStoryStage`, and `GlobalCloseStage` semantics through the existing exports, with the global shell marked `data-visual-system="global-cinematic"`.

- [ ] **Step 1: Extend the failing tests with composition rules**

Assert that the rendered edition contains an immersive stage, a short thesis rail, an Ink product stage, and no numbered legacy section-head wrapper:

```tsx
expect(markup).toContain('data-visual-system="global-cinematic"');
expect(markup).toContain('data-tone="ink"');
expect(markup).toContain('data-layout="editorial-stage"');
expect(markup).not.toContain('global-en__section-number');
```

Add CSS-contract assertions for `min-height: min(56rem, 88svh)`, `position: sticky`, `prefers-reduced-motion`, and the approved color tokens.

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```powershell
pnpm.cmd --filter @workspace/www exec vitest run --config vitest.config.ts src/components/site/global-en/pages/global-english-pages.test.tsx src/styles/global-en/core.test.ts
```

Expected: FAIL on missing composition markers and CSS rules.

- [ ] **Step 3: Recompose the global primitives**

Keep the exported function names to avoid route churn, but change their rendered contracts:

```tsx
<section data-stage="global-hero" data-layout="editorial-stage">...</section>
<section data-stage="story" data-tone={dark ? "ink" : "paper"}>...</section>
```

Move numbering into a compact progress rail instead of a left document column. Give every visual child a stage well and let copy width vary by page.

- [ ] **Step 4: Replace the global CSS composition**

Implement:

- immersive hero height and controlled asymmetry;
- Paper-to-Ink stage transitions;
- oversized headlines with readable measure;
- layered product surfaces using borders, glow, blur, and Signal Orange focus states;
- sticky progressive stages only where content supports them;
- mobile vertical sequencing without clipping;
- reduced-motion fallbacks.

Remove the shared `0.88fr / 1.12fr` hero formula and repeated equal-card rhythm from the primary narrative.

- [ ] **Step 5: Run the focused tests and verify GREEN**

Run the Task 2 Vitest command. Expected: PASS.

- [ ] **Step 6: Commit the global composition system**

```powershell
git add apps/www/src/components/site/global-en/global-english-shell.tsx apps/www/src/components/site/global-en/pages/page-primitives.tsx apps/www/src/styles/global-en/core.css apps/www/src/components/site/global-en/pages/global-english-pages.test.tsx apps/www/src/styles/global-en/core.test.ts
git commit -m "feat: build global cinematic human system"
```

---

### Task 3: Rebuild the global Human pages and interactions

**Files:**
- Modify: all files in `apps/www/src/components/site/global-en/pages/`
- Modify: all files in `apps/www/src/components/site/global-en/interactions/`
- Modify: `apps/www/src/content/site/global-en/experience.ts`
- Modify: `apps/www/src/styles/global-en/core.css`
- Test: `apps/www/src/components/site/global-en/pages/global-english-pages.test.tsx`
- Test: `apps/www/src/components/site/global-en/interactions/interactions.test.tsx`

**Interfaces:**
- Consumes: factual content, page registry, `GraphicFrame`, and global visual primitives.
- Produces: distinct visual protagonists for Home, Product, Approach, Evidence, Answer Presence, Company, Diagnostic, and Privacy.

- [ ] **Step 1: Write failing page-protagonist tests**

Require these page-specific stages:

```ts
const protagonists = {
	home: "answer-orbit",
	product: "operating-system",
	approach: "evidence-path",
	research: "evidence-ledger",
	geo: "answer-constellation",
	company: "responsibility-field",
	diagnostic: "diagnostic-brief",
	privacy: "privacy-route",
};
```

Require Home to expose `Observe`, `Explain`, `Act`, and `Measure` above the second fold and Approach to expose a non-hijacking scroll-progress marker.

- [ ] **Step 2: Run the global page and interaction tests and verify RED**

Run:

```powershell
pnpm.cmd --filter @workspace/www exec vitest run --config vitest.config.ts src/components/site/global-en/pages/global-english-pages.test.tsx src/components/site/global-en/interactions/interactions.test.tsx
```

Expected: FAIL because the new protagonist and progressive-interaction contracts are missing.

- [ ] **Step 3: Rebuild Home around one product thesis**

Compose the opening as one oversized proposition plus an `answer-orbit` product stage. Follow immediately with an early `Observe → Explain → Act → Measure` architecture, then move through buyer anxiety, product proof, evidence boundary, Human/Agent parity, and the three-field CTA. Eliminate the repeated six-section document rhythm.

- [ ] **Step 4: Rebuild the remaining global routes**

Give each page one dominant visual protagonist and no more than two supporting visual systems. Keep copy concise enough that the visual carries part of the explanation. Reuse facts, not layouts.

- [ ] **Step 5: Upgrade interactions**

Add progressive state changes driven by explicit controls and intersection state where meaningful. Do not autoplay essential content, lock scrolling, or hide required facts behind hover. Keep tab semantics for keyboard accessibility but render the active state as a spatial product transition rather than a table swap.

- [ ] **Step 6: Run focused tests and verify GREEN**

Run the Task 3 Vitest command. Expected: PASS.

- [ ] **Step 7: Commit the global page rebuild**

```powershell
git add apps/www/src/components/site/global-en apps/www/src/content/site/global-en/experience.ts apps/www/src/styles/global-en/core.css
git commit -m "feat: rebuild global human product story"
```

---

### Task 4: Verify and publish the global release slice

**Files:**
- Modify: `e2e/www-tests/dual-region-release.spec.ts`
- Create: Playwright baseline images under the existing snapshot directory.

**Interfaces:**
- Consumes: completed global Human edition and production build.
- Produces: deterministic desktop and mobile global screenshots plus route, accessibility, interaction, brand, and policy evidence.

- [ ] **Step 1: Build the website**

```powershell
pnpm.cmd --filter @workspace/www build
```

Expected: exit 0.

- [ ] **Step 2: Run global unit and policy tests**

```powershell
pnpm.cmd --filter @workspace/www test
pnpm.cmd run test:public-output-policy
pnpm.cmd run audit:public-output
```

Expected: all commands pass and the public-output audit contains no prohibited origin or licensing language.

- [ ] **Step 3: Generate and inspect the new global screenshot baselines**

```powershell
pnpm.cmd --filter e2e exec playwright test www-tests/dual-region-release.spec.ts --project=chromium --grep "global visual baseline" --update-snapshots
```

Inspect desktop and mobile images for hierarchy, brand asset, no clipping, no legacy split-panel composition, and meaningful above-fold product evidence.

- [ ] **Step 4: Re-run the global baseline without update mode**

Run the same command without `--update-snapshots`. Expected: PASS.

- [ ] **Step 5: Push the global slice**

```powershell
git add e2e/www-tests
git commit -m "test: approve global human visual baseline"
git push origin codex/homepage-product-stage
```

Expected: push succeeds and the deployment workflow begins.

---

### Task 5: Build the Chinese decision-system composition

**Files:**
- Modify: `apps/www/src/components/site/zh-cn/zh-shell.tsx`
- Modify: `apps/www/src/components/site/zh-cn/zh-page-primitives.tsx`
- Modify: `apps/www/src/styles/zh-cn/core.css`
- Test: `apps/www/src/components/site/zh-cn/pages/zh-pages.test.tsx`
- Test: `apps/www/src/styles/zh-cn/core.test.ts`

**Interfaces:**
- Consumes: approved Chinese wordmark, navigation, section navigation, content model, and graphic children.
- Produces: a Chinese shell marked `data-visual-system="zh-decision"` plus command, system, delivery, proof, and contact stages.

- [ ] **Step 1: Extend failing Chinese composition tests**

Require `data-stage="market-command"`, `data-stage="service-system"`, `data-stage="delivery-proof"`, and `data-stage="global-capability"`; reject the old numbered left-column wrapper and the global hero ratio.

- [ ] **Step 2: Run focused Chinese tests and verify RED**

```powershell
pnpm.cmd --filter @workspace/www exec vitest run --config vitest.config.ts src/components/site/zh-cn/pages/zh-pages.test.tsx src/styles/zh-cn/core.test.ts
```

Expected: FAIL on the new regional composition contract.

- [ ] **Step 3: Recompose Chinese primitives**

Keep semantic section order and exported names, but render a conclusion band, compact supporting judgment, visual model, and concrete output region. Use denser hierarchy without shrinking labels or recreating the global page frame.

- [ ] **Step 4: Replace Chinese CSS composition**

Implement a centered market-command hero, explicit horizontal system maps, layered service/delivery surfaces, strong proof bands, China/global comparison, persistent but unobtrusive contact access, and a compact mobile decision sequence. Retain Yonaris Ink, Paper, and Signal Orange.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run the Task 5 Vitest command. Expected: PASS.

- [ ] **Step 6: Commit the Chinese composition system**

```powershell
git add apps/www/src/components/site/zh-cn/zh-shell.tsx apps/www/src/components/site/zh-cn/zh-page-primitives.tsx apps/www/src/styles/zh-cn/core.css apps/www/src/components/site/zh-cn/pages/zh-pages.test.tsx apps/www/src/styles/zh-cn/core.test.ts
git commit -m "feat: build chinese decision-led human system"
```

---

### Task 6: Rebuild the Chinese Human pages and interactions

**Files:**
- Modify: `apps/www/src/components/site/zh-cn/pages/index.tsx`
- Modify: `apps/www/src/components/site/zh-cn/zh-interactions.tsx`
- Modify: `apps/www/src/content/site/zh-cn/experience.ts`
- Modify: `apps/www/src/styles/zh-cn/core.css`
- Test: `apps/www/src/components/site/zh-cn/pages/zh-pages.test.tsx`
- Test: `apps/www/src/components/site/zh-cn/zh-interactions.test.tsx`

**Interfaces:**
- Consumes: Chinese factual content, delivery stages, product modules, market contexts, and corrected regional primitives.
- Produces: distinct page protagonists and a Chinese executive decision sequence across all active Human routes.

- [ ] **Step 1: Write failing route-sequence and interaction tests**

Require Home to present `市场变化 → 五个核心问题 → 服务系统 → 交付产物 → 中国企业全球服务能力 → 人/Agent 同源 → 留资`, and require product, approach, research, answer presence, and company pages to expose page-specific visual anchors.

- [ ] **Step 2: Run focused Chinese page and interaction tests and verify RED**

```powershell
pnpm.cmd --filter @workspace/www exec vitest run --config vitest.config.ts src/components/site/zh-cn/pages/zh-pages.test.tsx src/components/site/zh-cn/zh-interactions.test.tsx
```

Expected: FAIL because the delivery-proof and page-protagonist contracts are missing.

- [ ] **Step 3: Rebuild the Chinese Home decision journey**

Lead with the judgment that customers ask AI before they know the brand. Make the business risk concrete, show the service system, show exactly what gets delivered and reviewed, demonstrate China/global configuration, explain Human/Agent parity, and end with the three-field form route. Avoid role-based segmentation and avoid translating the global section rhythm.

- [ ] **Step 4: Rebuild the remaining Chinese routes**

Give every page a clear conclusion in the first viewport, a labelled operating model, a concrete artifact preview, an explicit boundary, and one next action. Keep visual density higher than the global edition while preserving whitespace between decision groups.

- [ ] **Step 5: Upgrade Chinese interactions**

Preserve accessible controls while turning tab changes into visible shifts across answer, judgment, evidence, output, and boundary regions. Make the China/global switch alter a labelled market map, not only a paragraph.

- [ ] **Step 6: Run focused tests and verify GREEN**

Run the Task 6 Vitest command. Expected: PASS.

- [ ] **Step 7: Commit the Chinese page rebuild**

```powershell
git add apps/www/src/components/site/zh-cn apps/www/src/content/site/zh-cn/experience.ts apps/www/src/styles/zh-cn/core.css
git commit -m "feat: rebuild chinese human decision journey"
```

---

### Task 7: Verify, baseline, and publish the dual-region release

**Files:**
- Modify: `e2e/www-tests/dual-region-release.spec.ts`
- Create: Chinese desktop/mobile Playwright baseline images under the existing snapshot directory.

**Interfaces:**
- Consumes: completed global and Chinese Human editions, Agent views, lead endpoint, and production deployment workflow.
- Produces: one verified commit on `origin/codex/homepage-product-stage` ready for the user to close or merge manually.

- [ ] **Step 1: Run the full relevant unit suite**

```powershell
pnpm.cmd --filter @workspace/www test
```

Expected: PASS with no warnings or unhandled errors.

- [ ] **Step 2: Run build and public-surface audits**

```powershell
pnpm.cmd --filter @workspace/www build
pnpm.cmd run test:public-output-policy
pnpm.cmd run audit:public-output
```

Expected: PASS; no public-output policy violations, competitor names, unsupported proof, or unapproved lead fields appear in public output.

- [ ] **Step 3: Generate and inspect Chinese visual baselines**

```powershell
pnpm.cmd --filter e2e exec playwright test www-tests/dual-region-release.spec.ts --project=chromium --grep "Chinese visual baseline" --update-snapshots
```

Inspect desktop and mobile images for Chinese hierarchy, proof rhythm, clear service path, correct logo, no global-layout reuse, no clipping, and readable typography.

- [ ] **Step 4: Run the dual-region E2E suite without snapshot updates**

```powershell
pnpm.cmd --filter e2e exec playwright test www-tests/dual-region-release.spec.ts --project=chromium
```

Expected: PASS for routes, interactions, accessibility, mobile, reduced motion, form fields, Agent links, and screenshots.

- [ ] **Step 5: Verify the final diff and prohibited terms**

```powershell
git diff --check
pnpm.cmd run audit:public-output
git status -sb
```

Expected: clean diff check; the public-output audit passes; only intended files are changed.

- [ ] **Step 6: Commit and push the Chinese release**

```powershell
git add -A
git commit -m "feat: ship distinct regional human experiences"
git push origin codex/homepage-product-stage
```

Expected: push succeeds.

- [ ] **Step 7: Verify production after deployment**

Check the production commit and open global/Chinese desktop and mobile routes. Confirm correct wordmarks, new regional first folds, working Human/Agent navigation, only three fields per locale, and successful mail delivery when deployment credentials are configured.
