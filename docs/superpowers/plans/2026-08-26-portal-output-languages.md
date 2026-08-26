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

---

### Task 1: Persist artifact output languages

**Files:**
- Modify: `packages/lib/src/db/schema.ts`
- Create: `packages/lib/src/db/migrations/0032_artifact_output_languages.sql`
- Modify (generated): `packages/lib/src/db/migrations/meta/0032_snapshot.json`
- Modify (generated): `packages/lib/src/db/migrations/meta/_journal.json`
- Create: `packages/lib/src/db/migrations/artifact-output-languages.test.ts`

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
git add packages/lib/src/db/schema.ts packages/lib/src/db/migrations
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

Admin generation submits the selected language. Customer Opportunities has an independent artifact-language selector; initialize from UI language only on first render, then keep its state/query key independent. Selecting Chinese with no generated row shows the localized not-generated state and never triggers generation.

- [ ] **Step 6: Run Opportunity tests and access-boundary tests**

- [ ] **Step 7: Commit**

```powershell
git add apps/web/src/server/opportunities.ts apps/web/src/hooks apps/web/src/components/opportunities* apps/web/src/routes/_authed apps/web/src/i18n
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
- Modify: `packages/api-spec/src/openapi.json`
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

Place it in the report creation form with English/简体中文 choices. It is controlled by form state and submitted independently of current UI language. Resetting the form keeps the user's last explicit choice during the session. Translate the report-operations page title, field labels, helper copy, statuses, loading/empty/error states, and action labels through the admin UI catalog; this UI copy follows `uiLanguage`, while the selected report artifact follows `outputLanguage`.

- [ ] **Step 5: Run web/worker/API tests**

Use Vitest for web/API and `tsx --test` for Node test suites in `apps/worker`.

- [ ] **Step 6: Commit**

```powershell
git add apps/web apps/worker packages/api-spec
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

**Interfaces:**
- Produces: `getReportCopy(outputLanguage)`, `parseReportRenderLanguage(value, persisted)`, and explicit chart/print `outputLanguage` props.

- [ ] **Step 1: Write failing bilingual copy and evidence-preservation tests**

Assert representative report labels (`AI Share of Voice Report` / `AI 声量份额报告`), date formatting, status/recommendation copy, and chart labels. Render the same raw fixture twice and assert Prompt, answer, query, citation URL, brand, and competitor substrings are identical in both outputs.

- [ ] **Step 2: Run and verify the Chinese report assertions fail**

- [ ] **Step 3: Implement report-specific copy and validated override**

The persisted report language is default. Accept only `?outputLanguage=en` or `?outputLanguage=zh-CN`; invalid values fall back to the persisted value and never affect UI preference or Program locale. Add a compact output-language control suitable for screen/print (hidden in print media).

- [ ] **Step 4: Replace every static report/print/export label and explicit `en-US` formatter**

Pass selected output language to every print/export child. Use `Intl` with explicit language and existing timezone behavior. Do not modify metric calculations in `packages/lib/src/report-metrics.ts`.

- [ ] **Step 5: Run report-copy/render/chart tests**

- [ ] **Step 6: Commit**

```powershell
git add apps/web/src/i18n/report-copy* apps/web/src/routes/_authed/reports apps/web/src/components apps/web/src/hooks/use-chart-export.tsx
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

- [ ] **Step 5: Commit verified corrections without amending earlier commits**
