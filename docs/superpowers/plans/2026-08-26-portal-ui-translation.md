# Complete Portal UI Translation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move every remaining customer, settings, administration, analytical, export-chrome, and accessibility string into complete English and Simplified Chinese catalogs, including Chinese-capable AI 检索脉络 analysis.

**Architecture:** Translation domains own separate catalog files (`customer`, `admin`, `charts`) and merge through the foundation catalog. Components consume `useI18n`; non-React helpers accept an explicit `UiLanguage` or translated label object. Program measurement locale remains raw business data and is formatted only for display.

**Tech Stack:** TypeScript, React 19, TanStack Start, Vitest, React DOM server rendering, `Intl` APIs.

**Spec:** `docs/superpowers/specs/2026-08-26-portal-bilingual-design.md`

## Global Constraints

- Implement after `2026-08-26-portal-language-foundation.md`.
- Preserve all route paths, query parameter names, filter IDs, analytics event names, role gates, and server behavior.
- Never choose UI messages from `measurementScopes.locale`.
- Never translate brand names, competitor names, Prompts, model answers, citations, URLs, or observed queries.
- Chinese Query Fan-Out terminology is exactly `AI 检索脉络`, `检索路径`, and `衍生检索词`.
- Each domain begins with a failing user-outcome render test.

---

### Task 1: Global shell, filters, charts, and app-agnostic UI labels

**Files:**
- Create: `apps/web/src/i18n/catalogs/charts.ts`
- Modify: `apps/web/src/i18n/catalog.ts`
- Modify: `apps/web/src/components/app-sidebar.tsx`
- Modify: `apps/web/src/components/nav-main.tsx`
- Modify: `apps/web/src/components/site-header.tsx`
- Modify: `apps/web/src/components/nav-user.tsx`
- Modify: `apps/web/src/components/measurement-scope-switcher.tsx`
- Modify: `apps/web/src/components/filter-bar.tsx`
- Modify: `apps/web/src/components/page-header.tsx`
- Modify: `apps/web/src/components/demo-mode-pill.tsx`
- Modify: `apps/web/src/components/pagination-controls.tsx`
- Modify: `apps/web/src/components/base-chart.tsx`
- Create: `apps/web/src/components/base-chart-localization.test.tsx`
- Modify: `apps/web/src/components/base-chart-print.tsx`
- Modify: `apps/web/src/components/prompt-chart-print.tsx`
- Modify: `apps/web/src/components/chart-export-preview.tsx`
- Modify: `apps/web/src/components/chart-download-footer.tsx`
- Modify: `packages/ui/src/components/sidebar.tsx`
- Modify: `packages/ui/src/components/breadcrumb.tsx`
- Modify: `packages/ui/src/components/tags-input.tsx`
- Modify: relevant existing component tests plus `apps/web/src/components/app-sidebar.test.tsx`

**Interfaces:**
- Produces caller-supplied shared UI labels and locale-aware date/number/chart formatting.

- [ ] **Step 1: Add failing bilingual shell/chart render tests**

Extend `app-sidebar.test.tsx` to render under both providers and assert `Overview`/`概览`, `Programs`/`项目`, and unchanged hrefs. Add a chart formatting test with a literal UTC date and verify output differs by `en` versus `zh-CN` while values stay equal.

- [ ] **Step 2: Run focused tests and confirm Chinese assertions fail**

Run from `apps/web`:

```powershell
& 'node_modules/.bin/vitest.CMD' run --project=unit src/components/app-sidebar.test.tsx src/components/base-chart-localization.test.tsx
```

- [ ] **Step 3: Move all visible shell/filter/chart strings to catalogs**

Use stable IDs under `navigation.*`, `filter.*`, `chart.*`, and `accessibility.*`. Replace browser-default `toLocaleDateString()`/`toLocaleString()` calls with the provider's resolved UI locale. Keep explicit business timezone arguments unchanged.

- [ ] **Step 4: Make shared UI labels caller-controlled**

Add optional label props with backward-compatible English defaults to shared package components. The web app passes translated `toggleSidebar`, `breadcrumb`, `more`, `removeTag`, `maximumReached`, and tag-entry hints. Do not import `apps/web` code from `packages/ui`.

- [ ] **Step 5: Run shell/chart/shared UI tests and type checks**

Expected: bilingual labels pass; navigation URLs and chart numeric data remain unchanged.

- [ ] **Step 6: Commit**

```powershell
git add apps/web/src/components apps/web/src/i18n packages/ui/src/components
git commit -m "Localize shared portal navigation and charts"
```

---

### Task 2: Customer overview and analytical pages

**Files:**
- Create: `apps/web/src/i18n/catalogs/customer.ts`
- Modify: `apps/web/src/i18n/catalog.ts`
- Modify routes:
  - `apps/web/src/routes/_authed/app/index.tsx`
  - `apps/web/src/routes/_authed/app/new.tsx`
  - `apps/web/src/routes/_authed/app/$brand/index.tsx`
  - `apps/web/src/routes/_authed/app/$brand/programs.tsx`
  - `apps/web/src/routes/_authed/app/$brand/visibility.tsx`
  - `apps/web/src/routes/_authed/app/$brand/share-of-voice.tsx`
  - `apps/web/src/routes/_authed/app/$brand/citations.tsx`
  - `apps/web/src/routes/_authed/app/$brand/opportunities.tsx`
  - `apps/web/src/routes/_authed/app/$brand/prompts/index.tsx`
  - `apps/web/src/routes/_authed/app/$brand/prompts/$promptId.tsx`
- Modify customer components used by those routes, including:
  - `customer-programs-view.tsx`, `measurement-scope-provision-dialog.tsx`, `visibility-*`, `share-of-voice-*`, `citations-display.tsx`, all `components/citations/*.tsx`, `opportunities-report.tsx`, `prompt-list.tsx`, `prompt-history.tsx`, and snapshot/history controls.
- Modify or add focused route/component tests.

**Interfaces:**
- Produces complete `customer.*`, `program.*`, `visibility.*`, `voice.*`, `citation.*`, `opportunity.*`, and `prompt.*` message IDs.

- [ ] **Step 1: Add failing representative customer render tests**

Render one data-present and one empty/error state per route family in Chinese. Assert labels and helper copy are Chinese while fixture brand names, Prompt text, URLs, model names, market (`CN`), Program locale (`zh-CN`), and timezone remain byte-identical.

- [ ] **Step 2: Run the new tests and verify English-only failures**

Use the direct Vitest command with the exact modified test files.

- [ ] **Step 3: Translate route heads and visible page states**

For every listed route, localize title, description, headings, tabs, table columns, badges, filters, button states, dialogs, validation, loading, empty, error, tooltip, and accessibility copy. Route head helpers accept explicit UI language from route context rather than browser globals.

- [ ] **Step 4: Translate all customer child components**

Replace raw display strings with catalog IDs. Replace status-token capitalization with explicit status-label maps so `completed`, `failed`, `scored`, and other API tokens render correctly in both languages without changing stored values.

- [ ] **Step 5: Run customer tests and mutation-check evidence preservation**

Temporarily reason through these mutations: translating a Prompt, changing a Program locale, changing an href, or changing a query key must fail at least one test. Add a literal assertion where a realistic mutation is unprotected.

- [ ] **Step 6: Commit**

```powershell
git add apps/web/src/i18n apps/web/src/routes/_authed/app apps/web/src/components
git commit -m "Translate the customer portal experience"
```

---

### Task 3: Onboarding and brand settings

**Files:**
- Modify: `apps/web/src/components/brand-onboarding.tsx`
- Modify routes:
  - `apps/web/src/routes/_authed/app/$brand/settings/brand.tsx`
  - `apps/web/src/routes/_authed/app/$brand/settings/competitors.tsx`
  - `apps/web/src/routes/_authed/app/$brand/settings/prompts.tsx`
  - `apps/web/src/routes/_authed/app/$brand/settings/members.tsx`
  - `apps/web/src/routes/_authed/app/$brand/settings/llms.tsx`
  - `apps/web/src/routes/_authed/app/$brand/prompts/edit.tsx`
- Modify prompt/editor/team/settings components reached by those routes.
- Modify: `apps/web/src/i18n/catalogs/customer.ts`
- Add focused settings/onboarding tests.

**Interfaces:**
- Consumes the customer catalog and stable localized error mapping.

- [ ] **Step 1: Write failing bilingual form tests**

For Chinese, assert labels, placeholders, save/pending/success states, and permission/read-only copy. For both languages, assert submitted domain values and member roles remain unchanged.

- [ ] **Step 2: Run and observe failures for hard-coded English**

- [ ] **Step 3: Translate all listed forms and stable error outcomes**

Map known server failure codes to message IDs. For legacy endpoints still returning only text, recognize a bounded exact set and otherwise show `common.unexpectedError`; never expose arbitrary English exceptions as the primary localized UI.

- [ ] **Step 4: Run settings tests and type checks**

- [ ] **Step 5: Commit**

```powershell
git add apps/web/src/routes/_authed/app apps/web/src/components apps/web/src/i18n/catalogs/customer.ts
git commit -m "Translate onboarding and brand settings"
```

---

### Task 4: Platform administration and sampling operations

**Files:**
- Create: `apps/web/src/i18n/catalogs/admin.ts`
- Modify: `apps/web/src/i18n/catalog.ts`
- Modify routes:
  - `apps/web/src/routes/_authed/admin/index.tsx`
  - `apps/web/src/routes/_authed/admin/access.tsx`
  - `apps/web/src/routes/_authed/admin/workflows.tsx`
  - `apps/web/src/routes/_authed/admin/tools.tsx`
  - `apps/web/src/routes/_authed/admin/sampling/index.tsx`
  - `apps/web/src/routes/_authed/admin/sampling/devices.tsx`
  - `apps/web/src/routes/_authed/admin/sampling/$taskId.tsx`
- Modify all production `apps/web/src/components/sampling/*.tsx` files and admin-only controls reached by the routes.
- Modify relevant admin/sampling tests.

**Interfaces:**
- Produces `admin.*`, `sampling.*`, `workflow.*`, and `providerTool.*` messages.

- [ ] **Step 1: Write failing admin-shell and operation-state tests**

Render customer list, provider tools, device list, batch list, and task workbench in Chinese. Assert action labels and statuses are Chinese while IDs, provider/surface keys, market, locale, timezone, hashes, and evidence payloads remain unchanged.

- [ ] **Step 2: Run focused tests and confirm English-only failures**

- [ ] **Step 3: Translate every listed route and sampling component**

Translate human descriptions and controls, not execution manifests, raw errors in developer detail panels, or evidence contents. Stable status enums use explicit bilingual label maps.

- [ ] **Step 4: Run admin/sampling tests and access-boundary tests**

Verify a platform admin still sees the same tools and a report-only operator still sees no extra administration links.

- [ ] **Step 5: Commit**

```powershell
git add apps/web/src/routes/_authed/admin apps/web/src/components/sampling apps/web/src/i18n
git commit -m "Translate platform administration"
```

---

### Task 5: AI 检索脉络 copy and CJK analysis

**Files:**
- Modify: `apps/web/src/routes/_authed/app/$brand/query-fan-out.tsx`
- Modify: `apps/web/src/components/fanout-sections.tsx`
- Modify: `apps/web/src/lib/fanout-analysis.ts`
- Modify: `apps/web/src/lib/__tests__/fanout-analysis.test.ts`
- Add: `apps/web/src/routes/_authed/app/$brand/query-fan-out.test.tsx`
- Modify: `apps/web/src/i18n/catalogs/customer.ts`

**Interfaces:**
- Produces locale-independent `tokenizeQueryText(text): string[]` behavior supporting Latin, numeric, Han, and mixed input.

- [ ] **Step 1: Write failing Chinese and mixed-script analysis tests**

Use literal fixtures:

```ts
expect(tokenizeQueryText("适合家庭出游的新能源 SUV")).toEqual(["适合", "家庭", "出游", "的", "新能源", "suv"]);
expect(tokenizeQueryText("2026 北京 30万 SUV 推荐")).toEqual(["2026", "北京", "30", "万", "suv", "推荐"]);
```

When runtime segmentation groups Han words differently, inject the segmenter dependency in the pure helper and assert the deterministic fallback separately. Add a render test asserting exact approved Chinese labels and unchanged raw queries.

- [ ] **Step 2: Run tests and confirm current Latin-only tokenizer fails**

- [ ] **Step 3: Implement mixed-script segmentation**

Use `Intl.Segmenter("zh-CN", { granularity: "word" })` for Han runs and a deterministic per-Han-character fallback. Normalize Latin tokens to lowercase but never rewrite the displayed raw query. Update highlighting to work without whitespace-only splitting.

- [ ] **Step 4: Localize every page/section label and state**

Chinese page title/sidebar/breadcrumb: `AI 检索脉络`; group: `检索路径`; query: `衍生检索词`; helper: `查看 AI 为回答当前问题而展开的实际联网搜索词。` English remains `Query Fan-Out` and its existing precise explanation.

- [ ] **Step 5: Run all fan-out tests**

Expected: legacy 20 tests plus new Chinese/mixed/render tests pass.

- [ ] **Step 6: Commit**

```powershell
git add apps/web/src/routes/_authed/app/$brand/query-fan-out.tsx apps/web/src/components/fanout-sections.tsx apps/web/src/lib/fanout-analysis.ts apps/web/src/lib/__tests__/fanout-analysis.test.ts apps/web/src/i18n
git commit -m "Add Chinese AI retrieval-path analysis"
```

---

### Task 6: Translation coverage audit and browser smoke tests

**Files:**
- Create: `e2e/portal-language.spec.ts`
- Modify only uncovered production files identified by the audit.

- [ ] **Step 1: Audit production TSX for remaining user-visible English**

Review every non-test TSX file under `apps/web/src/routes`, `apps/web/src/components`, and the three shared UI files. Classify each remaining literal as machine-stable, raw evidence, proper noun, or a localization defect. Fix every defect in its owning domain catalog.

- [ ] **Step 2: Add focused bilingual E2E outcomes**

Cover same-URL switching on login, a customer overview, one Chinese Program viewed in English UI, one English Program viewed in Chinese UI, an admin page, and AI 检索脉络. Assert the language switch does not change `scope`, route, or displayed raw evidence.

- [ ] **Step 3: Run affected unit/component suites, type checks, and E2E smoke**

Use direct binaries in this environment. Record any E2E fixture/environment limitation separately from code failures.

- [ ] **Step 4: Commit corrections and E2E coverage**

```powershell
git add apps/web e2e/portal-language.spec.ts packages/ui
git commit -m "Verify complete bilingual portal coverage"
```
