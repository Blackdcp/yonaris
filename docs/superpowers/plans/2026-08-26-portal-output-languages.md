# Report and Opportunity Output Languages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Opportunities, one-time reports, printable reports, and chart exports explicitly selectable and persistently isolated in English or Simplified Chinese, independent of UI and Program locale.

**Architecture:** Persist `output_language` with each generated artifact and thread the validated shared `OutputLanguage` through server, API, queue, cache, and rendering boundaries. Artifact-specific catalogs translate only generated/static presentation copy; raw evidence is preserved verbatim.

**Tech Stack:** TypeScript, React, TanStack Query/Start, Drizzle/PostgreSQL, pg-boss, Vitest, OpenAPI JSON.

**Spec:** `docs/superpowers/specs/2026-08-26-portal-bilingual-design.md`

## Global Constraints

- Implement after the shared language contract from `2026-08-26-portal-language-foundation.md`.
- `outputLanguage` is explicit and never inferred from `measurementScopes.locale`.
- Existing report API clients that omit the new field default to English.
- Existing report and Opportunity rows backfill to English.
- Opportunity generation remains platform-admin-only and scored-Program-only.
- Do not translate raw Prompts, answers, queries, citations, URLs, brand names, or competitor names.
- Do not apply migrations to a database.
- Roll out Chinese artifact writes in two phases behind `ARTIFACT_ZH_CN_ENABLED`, default `false`: first deploy an output-language-aware Web/Worker release and record it as rollback-compatible, then enable Chinese writes only when the rollback target is also recorded compatible. Once Chinese has been activated, never roll back to a pre-language runtime even if the flag is later disabled.
- Explicit artifact/export selections live in tab-scoped `sessionStorage` under surface-specific keys. Seed only when no valid stored value exists, persist immediately, and survive the UI-language switcher's full-page reload without adding locale routes or coupling to Program data.
- Keep the Portal document `<html lang>` tied to `uiLanguage`, but place every single-language artifact/render/export subtree under an exact `lang={outputLanguage}` boundary.

---

### Task 1: Persist artifact output languages

**Files:**
- Modify: `packages/lib/src/db/schema.ts`
- Create: `packages/lib/src/db/migrations/0032_artifact_output_languages.sql`
- Modify (generated): `packages/lib/src/db/migrations/meta/0032_snapshot.json`
- Modify (generated): `packages/lib/src/db/migrations/meta/_journal.json`
- Create: `packages/lib/src/db/migrations/artifact-output-languages.test.ts`
- Modify: `packages/lib/src/db/migrations/mode-compat-rewind.test.ts`
- Modify: `.github/workflows/mode-compat.yaml`

**Interfaces:**
- Produces: `reports.outputLanguage` and `brandOpportunities.outputLanguage`, both inferred as text and validated by DB checks.

- [ ] **Step 1: Write the failing migration contract test**

Assert the generated SQL contains literal defaults/checks for both tables, drops the old Opportunity index, and creates a language-aware index in this order:

```sql
("brand_id","scope_id","output_language","created_at")
```

The test must also assert no occurrence of `measurement_scopes.locale` or `market` is used to populate either column.

- [ ] **Step 2: Run the migration test and verify `0032` is absent**

Run from `packages/lib`: `& 'node_modules/.bin/vitest.CMD' run src/db/migrations/artifact-output-languages.test.ts`

- [ ] **Step 3: Add schema fields and generate migration artifacts**

Add non-null text columns with application defaults `en`. Generate the migration and ensure its relevant SQL is equivalent to:

```sql
ALTER TABLE "reports" ADD COLUMN "output_language" text DEFAULT 'en' NOT NULL;
ALTER TABLE "reports" ADD CONSTRAINT "reports_output_language_supported" CHECK ("output_language" IN ('en', 'zh-CN'));
ALTER TABLE "brand_opportunities" ADD COLUMN "output_language" text DEFAULT 'en' NOT NULL;
ALTER TABLE "brand_opportunities" ADD CONSTRAINT "brand_opportunities_output_language_supported" CHECK ("output_language" IN ('en', 'zh-CN'));
```

Replace `brand_opportunities_brand_scope_created_at_idx` with `brand_opportunities_brand_scope_language_created_at_idx` over the four specified columns.

- [ ] **Step 4: Run the migration test and schema type check**

- [ ] **Step 5: Commit**

```powershell
git add packages/lib/src/db/schema.ts packages/lib/src/db/migrations .github/workflows/mode-compat.yaml
git diff --cached --name-only
git commit -m "Persist report and opportunity languages"
```

---

### Task 2: Isolate Opportunity reads, cache, and generation by language

**Files:**
- Modify: `apps/web/src/server/opportunities.ts`
- Modify: `apps/web/src/hooks/use-opportunities.tsx`
- Modify: `apps/web/src/hooks/use-opportunities.test.ts`
- Modify: `apps/web/src/server/opportunities-execution-boundary.test.ts`
- Modify: `apps/web/src/components/opportunities-generation-control.tsx`
- Modify: `apps/web/src/components/opportunities-generation-control.test.tsx`
- Modify: `apps/web/src/routes/_authed/admin/tools.tsx`
- Modify: `apps/web/src/routes/_authed/app/$brand/opportunities.tsx`
- Modify: `apps/web/src/components/opportunities-report.tsx`
- Modify: `apps/web/src/i18n/catalogs/admin.ts`
- Modify: `apps/web/src/i18n/catalogs/customer.ts`
- Add: shared tab-scoped artifact-language selection helper/tests.
- Modify: shared server configuration, LAS deploy/runbook/tests, and deployment environment examples for staged Chinese-output activation.
- Modify: `e2e/fixtures.ts`, `e2e/seed.ts`, and the scheduled language-smoke spec/support files.

**Interfaces:**
- `getOpportunitiesFn({ brandId, scopeId, outputLanguage })`.
- `generateOpportunitiesFn({ brandId, scopeId, outputLanguage })`.
- `opportunitiesKeys.detail(brandId, scopeId, outputLanguage)`.

- [ ] **Step 1: Extend tests before production changes**

Add literal cache-key assertions:

```ts
expect(opportunitiesKeys.detail("brand", "scope", "en")).not.toEqual(
	opportunitiesKeys.detail("brand", "scope", "zh-CN"),
);
```

In execution-boundary tests, prove:

- an English GET cannot return the newest Chinese row;
- a Chinese GET never uses a legacy null-scope English row;
- Chinese generation does not consider a six-day-old English row fresh;
- unauthorized generation is rejected before any read, write, or LLM call for both languages;
- related Prompt text remains byte-identical in Chinese output.

- [ ] **Step 2: Run tests and verify language arguments/columns are missing**

- [ ] **Step 3: Thread and persist `outputLanguage`**

Add `z.enum(["en", "zh-CN"])` to both server validators. Add language predicates to every current/latest/fallback query and insert. Include language in response metadata where the selector needs to display the loaded variant.

- [ ] **Step 4: Make the model prompt language-explicit**

Append exactly one selected instruction block:

```ts
const OUTPUT_LANGUAGE_GUIDANCE = {
	en: "Write every model-authored field in English.",
	"zh-CN": "所有由模型撰写的标题、摘要、理由、行动建议与注意事项均使用专业、自然的简体中文。原样保留相关 Prompt、品牌名、竞品名、URL 与引用证据。",
} satisfies Record<OutputLanguage, string>;
```

Do not translate `relatedPrompts` during enrichment.

- [ ] **Step 5: Add explicit admin and customer selectors**

Admin generation submits the selected language. Customer Opportunities has an independent artifact-language selector. Store each surface's exact token in tab-scoped `sessionStorage` (keyed by relevant brand/scope), seed only if absent, and preserve it across the UI language switcher's `window.location.reload()`. Selecting Chinese with no generated row shows the localized not-generated state and never triggers generation. Put loaded Opportunity artifact content under `lang={data.outputLanguage}` while selector/page chrome remains under UI language.

Gate every Chinese Opportunity write/generation boundary behind `ARTIFACT_ZH_CN_ENABLED` (default false), with a localized temporary-unavailable result and no DB/LLM side effect while disabled. Add LAS deployment compatibility markers so an activation attempt requires a previously healthy output-language-aware release, and every automatic rollback after activation may target only a recorded compatible release. Add shell/config contract tests and a two-phase activation/roll-forward runbook; the irreversible activation marker must survive later flag disablement.

- [ ] **Step 6: Run Opportunity tests and access-boundary tests**

Extend the scheduled non-provider language-smoke project with deterministic English and Chinese Opportunity rows. Assert both UI/artifact cross-combinations, exact nested `lang`, distinguishable static/model copy, and byte-identical raw Prompt/URL evidence without invoking generation.

- [ ] **Step 7: Commit**

```powershell
git add apps/web/src/server/opportunities.ts apps/web/src/hooks apps/web/src/components/opportunities* apps/web/src/routes/_authed apps/web/src/i18n packages/config/src deploy/las e2e/fixtures.ts e2e/seed.ts e2e/tests e2e/package.json
git diff --cached --name-only
git commit -m "Generate opportunities in the selected language"
```

---

### Task 3: Thread report language through Portal, API, database, and queue

**Files:**
- Modify: `apps/web/src/server/reports.ts`
- Modify: `apps/web/src/routes/_authed/reports/index.tsx`
- Modify: `apps/web/src/routes/api/v1/reports/index.ts`
- Modify: `apps/web/src/routes/api/v1/reports/$reportId.ts`
- Modify: `apps/web/src/lib/job-scheduler.ts`
- Modify: `apps/web/src/server/reports-execution-boundary.test.ts`
- Modify: `apps/worker/src/jobs/generate-report.ts`
- Modify: `apps/worker/src/report-worker.ts`
- Modify: `apps/worker/src/database-report-request.ts`
- Modify: `apps/worker/src/database-report-request.test.ts`
- Modify: `apps/worker/package.json`
- Modify: `pnpm-lock.yaml` when dependency metadata changes.
- Modify: `packages/api-spec/src/openapi.json`
- Modify: `e2e/bruno/reports`, `e2e/fixtures.ts`, `e2e/seed.ts`, and scheduled language-smoke tests/support.
- Add or modify API contract tests adjacent to the report routes.

**Interfaces:**
- `createReportFn` input adds required Portal `outputLanguage`; public API schema accepts optional `outputLanguage` defaulting to `en`.
- `ReportJobData` carries `outputLanguage: OutputLanguage`.
- Report list/detail responses include `outputLanguage`.

- [ ] **Step 1: Write failing request/queue/API tests**

Assert a Portal Chinese request inserts `zh-CN` and queues the exact same value. Assert API omission inserts/queues `en`. Assert `zh`, `CN`, and `zh-SG` receive validation errors. Assert OpenAPI exposes enum `['en', 'zh-CN']` and default `en`.

- [ ] **Step 2: Run tests and verify the new property is rejected or dropped**

- [ ] **Step 3: Implement report persistence and queue threading**

Add the field to validators, `NewReport`, selects/responses, `sendReportJob`, `ReportJobData`, worker logs/receipts, and database report request compatibility. The worker may use language only as artifact metadata; it must not rewrite manual Prompts or measured answers.

- [ ] **Step 4: Add the explicit Portal report language selector**

Place it in the report creation form with English/简体中文 choices. Persist the exact selection in the shared tab-scoped session helper so the UI language switcher's full reload does not reseed it; resetting the form keeps the explicit choice. Submit independently of current UI language. Translate the report-operations page title, field labels, helper copy, statuses, loading/empty/error states, and action labels through the admin UI catalog; this UI copy follows `uiLanguage`, while the selected report artifact follows `outputLanguage`. Extend the default-off Chinese-write gate to Portal/API report creation and queueing; legacy English remains available while disabled.

- [ ] **Step 5: Run web/worker/API tests**

If any worker test file is added, register it in the worker package's normal `test` script (or replace the explicit list with proven cross-platform discovery) and prove `pnpm --filter @workspace/worker test` executes it; root Turbo/CI must not rely on a bespoke manual command.

Use Vitest for web/API and `tsx --test` for Node test suites in `apps/worker`.

- [ ] **Step 6: Commit**

```powershell
git add apps/web apps/worker packages/api-spec e2e/bruno/reports e2e/fixtures.ts e2e/seed.ts e2e/tests e2e/package.json pnpm-lock.yaml
git diff --cached --name-only
git commit -m "Carry report language through generation"
```

---

### Task 4: Bilingual printable report and explicit render override

**Files:**
- Create: `apps/web/src/i18n/report-copy.ts`
- Create: `apps/web/src/i18n/report-copy.test.ts`
- Modify: `apps/web/src/routes/_authed/reports/render/$reportId.tsx`
- Add: `apps/web/src/routes/_authed/reports/render/report-render-language.test.tsx`
- Modify: `apps/web/src/components/prompt-chart-print.tsx`
- Modify: `apps/web/src/components/base-chart-print.tsx`
- Modify: `apps/web/src/components/chart-download-footer.tsx`
- Modify: `apps/web/src/components/chart-export-preview.tsx`
- Modify: `apps/web/src/hooks/use-chart-export.tsx`
- Modify: dashboard chain `VisibilityPage → PromptsDisplay/ChartSection → VirtualizedPromptList → CachedPromptChart` and its tests/stories/mocks.
- Modify: `e2e/fixtures.ts`, `e2e/seed.ts`, and scheduled language-smoke tests/support.

**Interfaces:**
- Produces: `getReportCopy(outputLanguage)`, `parseReportRenderLanguage(value, persisted)`, and explicit chart/print `outputLanguage` props.

- [ ] **Step 1: Write failing bilingual copy and evidence-preservation tests**

Assert representative report labels (`AI Share of Voice Report` / `AI 声量份额报告`), date formatting, status/recommendation copy, and chart labels. Render the same raw fixture twice and assert Prompt, answer, query, citation URL, brand, and competitor substrings are identical in both outputs.

- [ ] **Step 2: Run and verify the Chinese report assertions fail**

- [ ] **Step 3: Implement report-specific copy and validated override**

The persisted report language is default. Accept only `?outputLanguage=en` or `?outputLanguage=zh-CN`; invalid values fall back to the persisted value and never affect UI preference or Program locale. Add a compact output-language control suitable for screen/print (hidden in print media).

- [ ] **Step 4: Replace every static report/print/export label and explicit `en-US` formatter**

Pass selected output language to every print/export child. Use `Intl` with explicit language and existing timezone behavior. Do not modify metric calculations in `packages/lib/src/report-metrics.ts`.

Set `lang={selectedOutputLanguage}` on the printable artifact root and every chart export preview/capture root. Keep surrounding Portal chrome and the document root on `uiLanguage`; set `Content-Language` only on an HTTP response that contains one single-language artifact, never on mixed-language list responses.

For dashboard export, reuse the tab-scoped selection helper with a surface/brand/scope-specific key. Persist immediately so the explicit export token survives the UI language switcher's full reload; do not merely hold mount-time React state.

- [ ] **Step 5: Run report-copy/render/chart tests**

Seed deterministic completed English and Chinese report artifacts for the scheduled non-provider browser project. Exercise the real printable render route and validated override in both languages; assert exact artifact title/copy, nested `lang`, and byte-identical raw Prompt/query evidence without queueing or provider work.

- [ ] **Step 6: Commit**

```powershell
git add apps/web/src/i18n/report-copy* apps/web/src/routes/_authed/reports apps/web/src/routes/_authed/app apps/web/src/components apps/web/src/hooks/use-chart-export.tsx e2e/fixtures.ts e2e/seed.ts e2e/tests e2e/package.json
git diff --cached --name-only
git commit -m "Render reports and exports bilingually"
```

---

### Task 5: Output-language verification

**Files:**
- Modify only files required by verified failures.

- [ ] **Step 1: Run all Opportunity, report, migration, worker, API, and chart tests**

- [ ] **Step 2: Run type checks for `apps/web`, `apps/worker`, `packages/lib`, `packages/config`, and `packages/api-spec` where configured**

- [ ] **Step 3: Build affected web and worker packages using direct package binaries when pnpm's install gate is unavailable**

- [ ] **Step 4: Inspect the final diff for forbidden coupling**

Search changed files for any assignment or default from `measurementScopes.locale` to `uiLanguage` or `outputLanguage`. Verify raw evidence fields are never passed through translation functions.

Verify real remount/reload tests for Opportunity, report-form, and dashboard-export selections; assert artifact subtree `lang` values in both cross-language combinations. Verify the default-off gate prevents every Chinese write before side effects, activation requires a compatible rollback target, and the irreversible activation marker prevents later rollback to a pre-language runtime.

Verify the scheduled browser suite renders seeded Opportunities and printable reports in both languages without provider calls, and verify every new worker test is reached by the package's normal `test` command used by Turbo/CI.

- [ ] **Step 5: Commit verified corrections without amending earlier commits**
