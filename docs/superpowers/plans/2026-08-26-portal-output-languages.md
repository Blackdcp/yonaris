# Report and Opportunity Output Languages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Opportunities, one-time reports, printable reports, and chart exports explicitly selectable and persistently isolated in English or Simplified Chinese, independent of UI and Program locale.

**Architecture:** Persist `output_language` with each generated artifact and thread the validated shared `OutputLanguage` through server, API, queue, cache, and rendering boundaries. Artifact-specific catalogs translate only generated/static presentation copy; raw evidence is preserved verbatim.

**Tech Stack:** TypeScript, React, TanStack Query/Start, Drizzle/PostgreSQL, pg-boss, Vitest, OpenAPI JSON.

**Spec:** `docs/superpowers/specs/2026-08-26-portal-bilingual-design.md`

## Global Constraints

- Implement after the shared language contract from `2026-08-26-portal-language-foundation.md`.
- `outputLanguage` is explicit and never inferred from `measurementScopes.locale`.
- Every new Portal/admin/customer/internal call site must pass an exact `outputLanguage`. At compatibility boundaries only, an omitted legacy Opportunity argument and an omitted legacy public report API field normalize to `en`; invalid values such as `zh`, `CN`, or `zh-SG` are always rejected. Portal forms never rely on omission.
- Existing report and Opportunity rows backfill to English.
- Opportunity generation remains platform-admin-only and scored-Program-only.
- Do not translate raw Prompts, answers, queries, citations, URLs, brand names, or competitor names.
- Do not apply migrations to a database.
- Roll out Chinese artifact writes in two phases behind `ARTIFACT_ZH_CN_ENABLED`, default `false`: first deploy an output-language-aware Web/Worker release and record it as rollback-compatible, then enable Chinese writes only when the rollback target is also recorded compatible. Once Chinese has been activated, never roll back to a pre-language runtime even if the flag is later disabled.
- Explicit artifact/export selections live in tab-scoped `sessionStorage` under surface-specific keys. Seed only when no valid stored value exists, persist immediately, and survive the UI-language switcher's full-page reload without adding locale routes or coupling to Program data.
- Keep the Portal document `<html lang>` tied to `uiLanguage`, but place every single-language artifact/render/export subtree under an exact `lang={outputLanguage}` boundary.
- Keep report/export surface discovery unconditional. Each exact discovered signature must be either deferred to this plan or, after implementation, moved to an exact resolved-surface attestation naming focused runtime/component evidence; source syntax never self-certifies resolution, and missing/stale/duplicate entries fail the Portal audit.

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

The test must also assert no occurrence of `measurement_scopes`, `locale`, or `market` is used to populate either column. Fail with an explicit missing-file assertion while `0032` is absent.

Pin the corresponding Drizzle/schema metadata as well: both fields are non-null with default `en`; both named checks allow exactly `en` and `zh-CN`; the old index is absent; and the replacement index contains `brand_id`, `scope_id`, `output_language`, `created_at` in that exact order. Assert the generated snapshot and journal contain the same defaults, checks, index ordering, `idx: 32`, and tag `0032_artifact_output_languages`.

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

Generate from `packages/lib` without applying the migration:

```powershell
& 'node_modules/.bin/drizzle-kit.CMD' generate --name artifact_output_languages
```

Do not run `drizzle-kit migrate`.

- [ ] **Step 4: Run the migration test and schema type check**

Extend `mode-compat-rewind.test.ts` and `.github/workflows/mode-compat.yaml` for the generated `0032` journal timestamp. Rewind must drop the new language-aware Opportunity index, both named checks, and both columns before continuing the existing scope rollback; it must not try to drop the already-replaced old index. The post-`0021` label list ends with `0032_artifact_output_languages`, the migration count is 33 before rewind and 22 after rewind, and the workflow recreates the `0021` Opportunity index.

Run from `packages/lib`:

```powershell
& 'node_modules/.bin/vitest.CMD' run src/db/migrations/artifact-output-languages.test.ts src/db/migrations/mode-compat-rewind.test.ts
& 'node_modules/.bin/tsc.CMD' --noEmit
& 'node_modules/.bin/drizzle-kit.CMD' check
```

- [ ] **Step 5: Commit**

```powershell
git add packages/lib/src/db/schema.ts packages/lib/src/db/migrations/0032_artifact_output_languages.sql packages/lib/src/db/migrations/meta/0032_snapshot.json packages/lib/src/db/migrations/meta/_journal.json packages/lib/src/db/migrations/artifact-output-languages.test.ts packages/lib/src/db/migrations/mode-compat-rewind.test.ts .github/workflows/mode-compat.yaml
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
- Create: `apps/web/src/lib/artifact-language-selection.ts`
- Create: `apps/web/src/lib/artifact-language-selection.test.ts`
- Create: `apps/web/src/hooks/use-artifact-language-selection.tsx`
- Create: `apps/web/src/hooks/use-artifact-language-selection.test.tsx`
- Modify: `apps/web/src/components/opportunities-generation-control.tsx`
- Modify: `apps/web/src/components/opportunities-generation-control.test.tsx`
- Modify: `apps/web/src/components/task-4-live-language-state.test.tsx`
- Modify: `apps/web/src/routes/_authed/admin/tools.tsx`
- Modify: `apps/web/src/routes/_authed/app/$brand/opportunities.tsx`
- Create: `apps/web/src/routes/_authed/app/$brand/opportunities-output-language.test.tsx`
- Modify: `apps/web/src/components/opportunities-report.tsx`
- Create: `apps/web/src/components/opportunities-report.test.tsx`
- Modify: `apps/web/src/lib/opportunities-empty-state.ts`
- Modify: `apps/web/src/lib/opportunities-empty-state.test.ts`
- Modify: `apps/web/src/i18n/catalogs/admin.ts`
- Modify: `apps/web/src/i18n/catalogs/customer.ts`
- Create: `packages/config/src/artifact-output-language.ts`
- Create: `packages/config/src/artifact-output-language.test.ts`
- Modify: `packages/config/package.json`
- Modify: `packages/config/src/env-registry.ts`
- Modify: `packages/config/src/env-registry.test.ts`
- Modify: `apps/web/src/env.d.ts`
- Modify: `turbo.json`
- Create: `deploy/las/artifact-output-language-compatible`
- Modify: `deploy/las/bin/deploy.sh`
- Create: `deploy/las/bin/guard-artifact-output-release.sh`
- Create: `deploy/las/bin/guard-artifact-output-release.test.sh`
- Modify: `deploy/las/env.example`
- Create: `deploy/las/ARTIFACT-OUTPUT-LANGUAGE-RUNBOOK.md`
- Modify: `deploy/las/README.md`
- Modify: `.github/workflows/mode-compat.yaml`
- Modify: `.github/workflows/deploy-las.yaml`
- Modify: `apps/web/scripts/portal-language-audit.ts`
- Modify: `apps/web/scripts/portal-language-audit-manifest.ts`
- Modify: `apps/web/src/i18n/portal-language-audit.test.ts`
- Modify: `e2e/fixtures.ts`
- Modify: `e2e/seed.ts`
- Modify: `e2e/tests/portal-language.spec.ts`
- Modify: `scripts/e2e-language-smoke-contract.test.mjs`
- Create: `.changeset/select-opportunity-output-language.md` as an `@workspace/web` patch changeset for explicit Opportunity output-language selection.

**Interfaces:**
- New callers use `getOpportunitiesFn({ brandId, scopeId, outputLanguage })` and `generateOpportunitiesFn({ brandId, scopeId, outputLanguage })`; each server validator uses `z.enum(["en", "zh-CN"]).default("en")` solely to normalize a legacy omitted argument to English.
- `opportunitiesKeys.detail(brandId, scopeId, outputLanguage)`.
- Every `OpportunitiesResponse`, including empty and temporarily unavailable results, returns the normalized `outputLanguage`.
- `useArtifactLanguageSelection(surface, brandId, scopeId, seedLanguage)` returns `{ outputLanguage, isResolved, setOutputLanguage }`; consumers do not issue a query or mutation until `isResolved` is true.

**Implementation hazards closed by this task:**

- Prompt guidance alone cannot guarantee byte-identical raw Prompts. Enrichment must resolve a model-returned related Prompt back to the canonical digest entry and emit the digest's exact original `value`; unmatched model strings are discarded rather than displayed or persisted as evidence.
- The Portal audit currently accepts only Task 3/4 ownership, does not discover Opportunity components or the artifact-selection hook, and accepts an arbitrary non-empty `runtimeTest`. Extend it for Task 2, discover the exact Opportunity surfaces below, and require each runtime-test path to exist as a focused test file.
- A repository-local `deploy.sh` cannot prevent an operator from checking out a pre-language commit and executing its older script. Install and use a stable host-side guard, invoke it in the workflow before checkout, and fail closed after activation when the guard is missing.
- The existing `opportunities-empty-state` files, config export/registry declarations, Turbo/env declarations, audit files, shell-test registration, live-language regression test, and changeset are required even though the earlier short file list omitted them.

- [ ] **Step 1: Write the RED server, validator, cache, and gate contracts**

Add literal cache-key assertions:

```ts
expect(opportunitiesKeys.detail("brand", "scope", "en")).not.toEqual(
	opportunitiesKeys.detail("brand", "scope", "zh-CN"),
);
```

Make the `createServerFn` test double actually parse with the supplied Zod schema; a test double that drops the validator cannot certify this boundary. Then prove:

- an English GET cannot return the newest Chinese row;
- a Chinese GET never uses a legacy null-scope English row;
- Chinese generation does not consider an approximately six-day-old English row fresh and does not use it as the insufficient-data or LLM-failure fallback;
- omitted legacy Opportunity language normalizes to `en`, while `zh`, `CN`, and `zh-SG` fail validation before authentication or database access;
- unauthorized generation is rejected before scope resolution, database reads/writes, digest reads, or LLM calls for both languages;
- with `ARTIFACT_ZH_CN_ENABLED` missing, `false`, or invalid, authorized Chinese POST returns a stable `temporarily-unavailable` reason and the requested output language before scope resolution, database, or LLM work;
- authorization precedes the Chinese gate so an unauthorized caller cannot use it to probe feature state;
- disabling the gate never hides an already persisted Chinese row from GET;
- every successful insert includes the exact selected output language and every response, including empty results, carries the normalized language;
- English and Chinese generation prompts each contain exactly one selected language-guidance block;
- related Prompt text is canonicalized back to the byte-identical digest Prompt before insert/response, and an unmatched model string is not displayed or persisted;
- scoped, legacy, fresh-cache, insufficient-data, and failed-generation paths all assert the exact Drizzle equality predicates rather than relying only on queued mock results.

Add shared-config RED tests proving only exact `"true"` enables Chinese writes; missing, empty, `false`, `TRUE`, and arbitrary values remain fail-closed. Deployment validation separately rejects any non-`true|false` configured value.

- [ ] **Step 2: Run tests and verify language arguments/columns are missing**

Run from `apps/web`:

```powershell
& 'node_modules/.bin/vitest.CMD' run --project=unit src/hooks/use-opportunities.test.ts src/server/opportunities-execution-boundary.test.ts
```

Run from `packages/config`:

```powershell
& 'node_modules/.bin/vitest.CMD' run src/artifact-output-language.test.ts src/env-registry.test.ts
```

Verify failures show the missing language key, predicates, response metadata, validator default/rejections, gate, and canonical Prompt behavior rather than fixture or module-resolution errors.

- [ ] **Step 3: Thread language through validators, reads, freshness, fallbacks, inserts, and cache**

Normalize the server-boundary value once and use only that value afterward. Both scoped GET and generation-current queries must include:

```ts
and(
	eq(brandOpportunities.brandId, data.brandId),
	eq(brandOpportunities.scopeId, data.scopeId),
	eq(brandOpportunities.outputLanguage, outputLanguage),
)
```

Run the legacy null-scope fallback only for `outputLanguage === "en"`; its query must explicitly contain `eq(brandOpportunities.outputLanguage, "en")`. Extend the defensive scope predicate to compare report/request language as well as scope. A differently languaged row must be unusable even if a test double or unexpected database result returns it.

All freshness checks and the insufficient-data/LLM-failure fallback operate only on that same-language `latest`. Insert `{ brandId, scopeId, outputLanguage, report, model }`. Return `outputLanguage` on current, generated, not-generated, insufficient-data, and temporary-unavailable results.

Change the hook and key to require an explicit normalized language from new callers. Admin generation success invalidates or sets only `opportunitiesKeys.detail(brandId, scopeId, outputLanguage)`; it must not invalidate the other language.

- [ ] **Step 4: Add the shared default-off Chinese-write gate before side effects**

Create the shared server-only config helper and register/export `ARTIFACT_ZH_CN_ENABLED` through `packages/config`, `turbo.json`, and `apps/web/src/env.d.ts`. The POST order is fixed:

1. Zod normalization/validation;
2. authenticated session;
3. platform-admin authorization;
4. Chinese-write gate;
5. Program ownership and scored-role resolution;
6. database/digest reads;
7. LLM;
8. insert.

GET is never gated. Map the typed temporary-unavailable reason to localized admin/customer copy rather than returning server-localized prose.

- [ ] **Step 5: Make the model prompt language-explicit and canonicalize raw evidence**

Append exactly one selected instruction block:

```ts
const OUTPUT_LANGUAGE_GUIDANCE = {
	en: "Write every model-authored field in English.",
	"zh-CN": "所有由模型撰写的标题、摘要、理由、行动建议与注意事项均使用专业、自然的简体中文。原样保留相关 Prompt、品牌名、竞品名、URL 与引用证据。",
} satisfies Record<OutputLanguage, string>;
```

Do not translate `relatedPrompts` during enrichment. Build the lookup as normalized model text to `{ id, value }`, but emit the matched digest `value` exactly. Discard unmatched model strings. Citation title/domain/URL, brand and competitor names, and Prompt values never pass through UI or artifact-copy translation.

- [ ] **Step 6: Write the RED tab-storage, selector, render-boundary, and empty-state tests**

Use exact surface keys:

```text
yonaris:artifact-output-language:v1:opportunities-admin:<encoded-brand>:<encoded-scope>
yonaris:artifact-output-language:v1:opportunities-customer:<encoded-brand>:<encoded-scope>
```

Prove valid stored values survive a remount and an English/Chinese UI reload, missing or invalid values are immediately seeded, a selection is immediately persisted, brand/scope/surface keys are independent, and SSR/no-window or a `sessionStorage` `SecurityError` fails safely. Never use cookie, `localStorage`, locale routes, URL parameters, or Program data for this selection.

Component/route tests must prove:

- admin submit contains `{ brandId, scopeId, outputLanguage }` and restores the per-brand/scope token;
- the Task 6 `LocalizedRawDetail` behavior remains intact after the control changes;
- the customer selector issues only GET reads, and selecting a missing Chinese variant shows the localized not-generated state without invoking POST;
- no query runs until the tab selection is resolved, avoiding a hydration-time request for a transient UI-language seed;
- UI English/artifact Chinese and UI Chinese/artifact English render artifact static/model copy in the artifact language;
- the document/page chrome remains on UI language while the exact Opportunity artifact root has `lang={data.outputLanguage}`;
- Prompt, URL, brand, and competitor substrings are byte-identical across both artifact renders;
- `not_generated`, `insufficient-data`, and `temporarily-unavailable` remain distinct in both UI languages.

- [ ] **Step 7: Implement explicit admin/customer selectors and the nested artifact boundary**

Admin generation submits the selected language. Customer Opportunities has an independent artifact-language selector. Store each surface's exact token in tab-scoped `sessionStorage` (keyed by relevant brand/scope), seed only if absent, and preserve it across the UI language switcher's `window.location.reload()`. Selecting Chinese with no generated row shows the localized not-generated state and never triggers generation. Put loaded Opportunity artifact content under `lang={data.outputLanguage}` while selector/page chrome remains under UI language.

Within `OpportunitiesReport`, select static headings, descriptions, empty drill-down labels, counts, and disclaimer from the explicit artifact language rather than ambient `useI18n()`. The raw evidence exceptions remain verbatim beneath the artifact's primary language boundary.

- [ ] **Step 8: Extend Portal discovery and register exact Task 2 resolutions**

Extend `CrossPlanOwnership.task` and `CrossPlanResolution.task` to accept `Task 2`. Teach discovery to recognize `OpportunitiesReport`, `OpportunitiesGenerationControl`, and `useArtifactLanguageSelection`. A resolution's `runtimeTest` must be a normalized, exact, existing test-file path; broad paths/globs, missing files, stale signatures, and ownership/resolution duplicates remain fatal.

After the production bindings exist, register these exact occurrence-1 resolutions with `owner: "portal-output-languages"`, `task: "Task 2"`, and `resolution: "explicit-output-language"`:

| File | Kind | Value | Focused runtime test |
|---|---|---|---|
| `apps/web/src/routes/_authed/admin/tools.tsx` | `output-component` | `OpportunitiesGenerationControl` | `apps/web/src/components/opportunities-generation-control.test.tsx` |
| `apps/web/src/components/opportunities-generation-control.tsx` | `output-hook` | `useArtifactLanguageSelection` | `apps/web/src/components/opportunities-generation-control.test.tsx` |
| `apps/web/src/routes/_authed/app/$brand/opportunities.tsx` | `output-hook` | `useArtifactLanguageSelection` | `apps/web/src/routes/_authed/app/$brand/opportunities-output-language.test.tsx` |
| `apps/web/src/routes/_authed/app/$brand/opportunities.tsx` | `output-component` | `OpportunitiesReport` | `apps/web/src/routes/_authed/app/$brand/opportunities-output-language.test.tsx` |
| `apps/web/src/components/opportunities-report.tsx` | `output-language-binding` | `OpportunitiesReport` | `apps/web/src/components/opportunities-report.test.tsx` |
| `apps/web/src/components/opportunities-report.tsx` | `output-language-binding` | `OpportunityCard` | `apps/web/src/components/opportunities-report.test.tsx` |
| `apps/web/src/hooks/use-opportunities.tsx` | `output-language-binding` | `useOpportunities` | `apps/web/src/hooks/use-opportunities.test.ts` |

Run discovery and fail rather than silently broadening the registry if implementation creates any additional signature; add each real extra surface as its own exact reviewed resolution.

- [ ] **Step 9: Implement and RED-test the LAS durable compatibility guard**

Use these exact durable states:

```text
candidate capability: deploy/las/artifact-output-language-compatible
healthy receipts:     $DEPLOY_ROOT/artifact-output-languages/compatible-releases/sha-<40>
irreversible marker:  $DEPLOY_ROOT/artifact-output-languages/zh-cn-activated
stable host guard:    $DEPLOY_ROOT/bin/guard-artifact-output-release.sh
```

The candidate capability file contains exactly one LF-terminated token, `artifact-output-language-v1`; the workflow and stable guard reject any other content.

The two-phase contract is:

1. deploy an output-language-aware release with `ARTIFACT_ZH_CN_ENABLED=false`;
2. only after Web/Worker health succeeds, atomically write its compatible receipt and install/update the stable host guard;
3. before a later `true` deployment starts a runtime, require the candidate capability and a healthy compatible receipt for the `.release` rollback target, then atomically create the irreversible marker;
4. never remove the marker when the flag is later disabled;
5. while the marker exists, an automatic rollback may target only a recorded compatible release, and a roll-forward candidate must carry the exact capability manifest.

The workflow must run the installed host guard after fetching the requested SHA but before checkout. If the irreversible marker exists and the stable guard is absent/unreadable, fail closed. The guard inspects the candidate manifest from the fetched Git object, so checking out a pre-language commit cannot replace the guard before it decides. The runbook must require workflow/stable-guard entry for manual rollbacks; direct execution of an old checked-out deployment script is forbidden operationally.

Shell RED tests cover: healthy Phase 1 receipt; activation without a healthy predecessor fails before Docker/database work; marker creation and later flag-disable survival; invalid flag rejection before side effects; automatic rollback only to a recorded-compatible predecessor; pre-language candidate rejection before checkout/start; atomic marker/receipt write failures; missing guard after activation; and idempotent repeat deployment. Register the shell test in CI.

- [ ] **Step 10: Run focused Opportunity, selector, audit, config, and LAS tests**

Run the relevant `apps/web` unit tests, `packages/config` tests, Portal language audit, and the new Bash guard contract. Confirm the exact Task 2 signatures above are resolutions rather than deferred ownership and no Task 6 raw-detail behavior regressed.

- [ ] **Step 11: Add deterministic non-provider E2E fixtures and the four language combinations**

Seed one English and one Chinese `brand_opportunities` row for the same fixed language-smoke brand and Program, using fixed UUIDs and fixed `created_at` values. Give them distinguishable static/model-authored copy but byte-identical `relatedPrompts[].text`, Prompt ID, citation title/domain/URL, brand, and competitor raw values. Explicitly include `brand_opportunities` in the E2E reset list even though brand truncation currently cascades.

Keep `ARTIFACT_ZH_CN_ENABLED=false` in this scheduled non-provider project so the suite proves Chinese reads remain available while writes are gated. Exercise:

- UI `en` / artifact `en`;
- UI `zh-CN` / artifact `en`;
- UI `en` / artifact `zh-CN`;
- UI `zh-CN` / artifact `zh-CN`.

For each relevant combination assert document `<html lang>` equals UI language, the nested Opportunity root `lang` equals artifact language, static and model copy are distinguishable and correct, and raw Prompt/URL evidence is byte-identical. Change UI language through the real full-page reload and prove the tab-scoped artifact token survives. Use the second language-smoke Program, which receives no Opportunity rows, for the read-only not-generated case; intercept/assert that no generation POST or provider work occurs. Extend `scripts/e2e-language-smoke-contract.test.mjs` to pin the deterministic rows and assertions.

- [ ] **Step 12: Commit slice 1 — server/cache/config isolation**

Only after the current Task 6 working tree is committed, stage the exact server/cache/config files and commit:

```powershell
git add -- apps/web/src/server/opportunities.ts apps/web/src/server/opportunities-execution-boundary.test.ts apps/web/src/hooks/use-opportunities.tsx apps/web/src/hooks/use-opportunities.test.ts packages/config/src/artifact-output-language.ts packages/config/src/artifact-output-language.test.ts packages/config/package.json packages/config/src/env-registry.ts packages/config/src/env-registry.test.ts apps/web/src/env.d.ts turbo.json
git diff --cached --name-only
git commit -m "Isolate opportunity variants by language"
```

- [ ] **Step 13: Commit slice 2 — selectors/render/audit**

Stage the storage helper/hook, Opportunity UI/routes/catalogs/empty-state/tests, Task 6 live-language regression, and the three Portal audit files. Preserve the already-committed `LocalizedRawDetail` integration. Commit:

```powershell
git add -- apps/web/src/lib/artifact-language-selection.ts apps/web/src/lib/artifact-language-selection.test.ts apps/web/src/hooks/use-artifact-language-selection.tsx apps/web/src/hooks/use-artifact-language-selection.test.tsx apps/web/src/components/opportunities-generation-control.tsx apps/web/src/components/opportunities-generation-control.test.tsx apps/web/src/components/task-4-live-language-state.test.tsx apps/web/src/routes/_authed/admin/tools.tsx 'apps/web/src/routes/_authed/app/$brand/opportunities.tsx' 'apps/web/src/routes/_authed/app/$brand/opportunities-output-language.test.tsx' apps/web/src/components/opportunities-report.tsx apps/web/src/components/opportunities-report.test.tsx apps/web/src/lib/opportunities-empty-state.ts apps/web/src/lib/opportunities-empty-state.test.ts apps/web/src/i18n/catalogs/admin.ts apps/web/src/i18n/catalogs/customer.ts apps/web/scripts/portal-language-audit.ts apps/web/scripts/portal-language-audit-manifest.ts apps/web/src/i18n/portal-language-audit.test.ts
git diff --cached --name-only
git commit -m "Persist opportunity language selections"
```

- [ ] **Step 14: Commit slice 3 — LAS irreversible activation**

Stage only the LAS manifest, stable guard/deploy scripts/tests, env/runbook/README, and the two workflow files. Commit:

```powershell
git add -- deploy/las/artifact-output-language-compatible deploy/las/bin/deploy.sh deploy/las/bin/guard-artifact-output-release.sh deploy/las/bin/guard-artifact-output-release.test.sh deploy/las/env.example deploy/las/ARTIFACT-OUTPUT-LANGUAGE-RUNBOOK.md deploy/las/README.md .github/workflows/mode-compat.yaml .github/workflows/deploy-las.yaml
git diff --cached --name-only
git commit -m "Guard Chinese artifact activation"
```

- [ ] **Step 15: Commit slice 4 — E2E and product changeset**

Stage only E2E fixtures/seed/spec/contract support and the new `@workspace/web` patch changeset. Reuse the language-smoke project scheduled by Task 6; do not rewrite or accidentally stage unrelated Task 6 files. Commit:

```powershell
git add -- e2e/fixtures.ts e2e/seed.ts e2e/tests/portal-language.spec.ts scripts/e2e-language-smoke-contract.test.mjs .changeset/select-opportunity-output-language.md
git diff --cached --name-only
git commit -m "Verify bilingual opportunity artifacts"
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

After focused UI/runtime tests prove the route's explicit output-language behavior, move its exact audit signature from deferred ownership to the resolved-surface registry. Do not let adding an `outputLanguage` prop/call suppress independent discovery.

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

For every completed print/export link in the production chain, replace the exact deferred-ownership signature with an exact resolved-surface attestation naming its focused propagation test. Unregistered or stale signatures remain fatal even when similarly named props/calls exist elsewhere in the file.

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
