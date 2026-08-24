# Yonaris Homepage Product Stage Implementation Plan

> **Superseded implementation plan — visual baseline only.** The approved Hero and Product Stage visual direction remain inputs to `2026-08-22-core-page-experiences.md`. Do not execute this plan's mailto-only diagnostic or old lower-page tasks. The full-site rebuild and `POST /api/diagnostic` contract are owned by the four `2026-08-22-*` full-site plans, especially `2026-08-22-diagnostic-acquisition.md`.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current Yonaris homepage hero with the approved bilingual Product Stage experience, delete the two rejected visual modules, and connect its domain entry to the existing honest diagnostic request flow.

**Architecture:** A focused `HomeHero` composes localized conversion copy and a semantic `MarketDiagnosticPreview`. The shared marketing content model separates the conversion headline from the long-term brand thesis, while the homepage-only shell variant supplies the light navigation. The hero submits a GET query to the existing diagnostic route; the route validates and forwards that query as an initial form value without introducing a backend or fake success state.

**Tech Stack:** React 19, TanStack Start/Router, TypeScript 7, Tailwind CSS 4, CSS transforms, Vitest, Playwright 1.61, Vite 8, Nitro.

**Spec:** `docs/superpowers/specs/2026-08-22-homepage-product-stage-design.md`

## Global Constraints

- Implement only in `E:\Yonaris\.worktrees\homepage-product-stage` on `codex/homepage-product-stage`.
- Preserve every unrelated user change in other worktrees.
- Use the approved Yonaris VI tokens only; do not revive the earlier Structured Paths hero.
- Completely delete the hero eyebrow/orange square and bottom three-column rail without replacements.
- Keep `Market evidence, built for teams and systems.` visible below the hero and in agent-readable content so the approved thesis and release smoke remain true.
- Keep every diagnostic example visibly labeled illustrative/simulated and free of customer claims.
- Keep the final diagnostic submission as the existing transparent `mailto:` flow.
- Do not hand-edit `apps/www/src/routeTree.gen.ts`.
- Add a patch changeset for `@workspace/www`.

---

### Task 1: Lock the New Content and Diagnostic Handoff Contracts

**Files:**
- Modify: `apps/www/src/lib/marketing-content.test.ts`
- Modify: `apps/www/src/lib/marketing-content.ts`
- Create: `apps/www/src/components/marketing/diagnostic-form.test.tsx`
- Modify: `apps/www/src/components/marketing/diagnostic-form.tsx`
- Modify: `apps/www/src/components/marketing/diagnostic-page.tsx`
- Modify: `apps/www/src/routes/diagnostic.tsx`
- Modify: `apps/www/src/routes/zh/diagnostic.tsx`
- Modify: `apps/www/vitest.config.ts`

- [ ] **Step 1: Write failing content assertions**

Require the bilingual conversion headline and explanation, a separate bilingual brand thesis, homepage navigation mapped to real routes, and localized metadata based on the conversion headline.

- [ ] **Step 2: Write a failing diagnostic prefill test**

Render `DiagnosticForm` to static markup with `initialWebsite="https://acme.example"` and require the website input to contain that value. Also require malformed or absent search values to resolve to an empty string.

- [ ] **Step 3: Run the focused tests and confirm RED**

Run:

```powershell
pnpm.cmd --filter @workspace/www test -- marketing-content.test.ts diagnostic-form.test.tsx
```

Expected: failure because the conversion copy, separated thesis, and initial website interface do not yet exist.

- [ ] **Step 4: Implement the smallest content and prefill changes**

Add typed home-hero/preview copy, retain the approved thesis separately, accept `initialWebsite` in `DiagnosticPage` and `DiagnosticForm`, and add `validateSearch` to both diagnostic routes. Do not add analytics or a submission API.

- [ ] **Step 5: Confirm GREEN and type safety**

Run:

```powershell
pnpm.cmd --filter @workspace/www test -- marketing-content.test.ts diagnostic-form.test.tsx
pnpm.cmd --filter @workspace/www check-types
```

- [ ] **Step 6: Commit**

```powershell
git add apps/www/src/lib/marketing-content.ts apps/www/src/lib/marketing-content.test.ts apps/www/src/components/marketing/diagnostic-form.tsx apps/www/src/components/marketing/diagnostic-form.test.tsx apps/www/src/components/marketing/diagnostic-page.tsx apps/www/src/routes/diagnostic.tsx apps/www/src/routes/zh/diagnostic.tsx apps/www/vitest.config.ts
git commit -m "connect the homepage diagnostic handoff"
```

### Task 2: Build the Product Stage Homepage

**Files:**
- Create: `apps/www/src/components/marketing/home-hero.tsx`
- Create: `apps/www/src/components/marketing/market-diagnostic-preview.tsx`
- Modify: `apps/www/src/components/marketing/home-page.tsx`
- Modify: `apps/www/src/components/marketing/marketing-shell.tsx`
- Modify: `apps/www/src/styles.css`
- Create: `e2e/playwright.www.config.ts`
- Create: `e2e/www-tests/homepage.spec.ts`

- [ ] **Step 1: Write the browser contract first**

Test English and Chinese headlines, visible illustrative disclosure, absence of the rejected eyebrow/rail labels, real navigation targets, domain handoff, mobile menu, and zero horizontal overflow at 390px.

- [ ] **Step 2: Run the browser test and confirm RED**

Run:

```powershell
pnpm.cmd --dir e2e exec playwright test --config playwright.www.config.ts
```

Expected: the old dark hero fails the new headline, visual-proof, and absence assertions.

- [ ] **Step 3: Implement Product Stage components**

Create a semantic HTML/CSS diagnostic window and the two-column hero. Make the homepage shell Paper-toned while preserving the existing dark shell on supporting pages. Replace the current hero and delete the homepage three-column market-shift rail; keep the long-term brand thesis in the `#company` section below.

- [ ] **Step 4: Implement responsive and reduced-motion CSS**

At desktop preserve the 470px/remaining-width product stage; at mobile stack the answer and readout without scaling the desktop interface. Add focus states and ensure no horizontal overflow.

- [ ] **Step 5: Confirm GREEN**

Run:

```powershell
pnpm.cmd --dir e2e exec playwright test --config playwright.www.config.ts
pnpm.cmd --filter @workspace/www test
pnpm.cmd --filter @workspace/www check-types
```

- [ ] **Step 6: Commit**

```powershell
git add apps/www/src/components/marketing/home-hero.tsx apps/www/src/components/marketing/market-diagnostic-preview.tsx apps/www/src/components/marketing/home-page.tsx apps/www/src/components/marketing/marketing-shell.tsx apps/www/src/styles.css e2e/playwright.www.config.ts e2e/www-tests/homepage.spec.ts
git commit -m "build the Product Stage homepage"
```

### Task 3: Release Contract and Visual Verification

**Files:**
- Create: `.changeset/quiet-markets-shape.md`
- Modify only files proven necessary by verification.

- [ ] **Step 1: Add the patch changeset**

Record the bilingual Product Stage homepage and diagnostic prefill for `@workspace/www`.

- [ ] **Step 2: Run the release checks**

Run:

```powershell
node --test apps/www/scripts/smoke-marketing.test.mjs
pnpm.cmd --filter @workspace/www test
pnpm.cmd --filter @workspace/www check-types
pnpm.cmd --filter @workspace/www build
```

- [ ] **Step 3: Capture and inspect required views**

Use the standalone Playwright server to capture English and Chinese screenshots at 1440×900, 1280×800, 1024×768, 390×844, and 360×800. Check the explicit-removal list, diagnostic disclosure, natural Chinese wrapping, menu, form handoff, and horizontal overflow.

- [ ] **Step 4: Review the complete branch**

Run a final independent code review against the spec, then:

```powershell
git diff --check origin/main...HEAD
git status -sb
```

- [ ] **Step 5: Commit verification fixes and changeset**

```powershell
git add .changeset apps/www e2e
git commit -m "polish the Yonaris homepage release"
```

Do not push or deploy in this task. Present the verified local preview to the user first.
