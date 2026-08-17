# Overseas Bright Data Run Now Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a platform-admin Portal action that runs every enabled Prompt in an eligible overseas Program five times on all selected Bright Data channels, persists existing Elmo observations and HTML/JSON snapshots, and shows auditable progress without scheduling another run.

**Architecture:** A fixed six-channel registry plans a frozen overseas cohort. New cohort and call-slot tables are the database source of truth and dispatch outbox; deterministic pg-boss jobs execute individual slots through the existing Bright Data provider and observation/snapshot pipeline. Portal server functions authorize, plan, dispatch, and read progress, while a dedicated UI card defaults all six channels on.

**Tech Stack:** TypeScript, React, TanStack Start server functions, Drizzle ORM/PostgreSQL, pg-boss, Vitest, Node test runner, Bright Data provider adapters, existing response-snapshot filesystem storage.

## Global Constraints

- Exactly six version-controlled Bright Data channels: ChatGPT, Perplexity, Gemini, Copilot, Google AI Mode, and Google AI Overview.
- Exactly five samples per Prompt/channel; one cohort may contain at most 10,000 calls.
- Eligible Programs are enabled, scored, manual-only, and explicit non-China market/locale Programs compatible with the selected routes.
- Only global platform administrators may create or dispatch cohorts; customers remain read-only.
- One click is one cohort and never creates a recurring schedule.
- Existing Elmo metric formulas must not change; technical failures create no `prompt_run`.
- Every successful Bright Data observation continues to produce the existing answer/citation/query data and HTML/JSON response snapshot when snapshot capture is enabled.
- A paid-submission intent is durable before provider invocation; generic retries never reissue an uncertain paid call.
- Do not modify or delete unrelated untracked local browser profiles, run artifacts, or recovery scripts.

---

### Task 1: Fixed overseas channel registry and planner

**Files:**
- Create: `apps/web/src/server/overseas-run-now-policy.ts`
- Test: `apps/web/src/server/overseas-run-now-policy.test.ts`

**Interfaces:**
- Produces: `OVERSEAS_RUN_NOW_CHANNELS`, `OverseasRunNowChannelKey`, `planOverseasRunNow(input)`.
- `planOverseasRunNow` returns `{ manifest, manifestFingerprint, calls, callCount, samplesPerChannel: 5 }` where every call contains frozen Prompt identity, model config, surface/capture identity, and sample index.

- [ ] **Step 1: Write failing planner tests**

Cover exact registry ordering and identities, all-six default selection, `10 × 6 × 5 = 300`, five unique samples per Prompt/channel, duplicate rejection, non-China scope requirement, route localization, and 10,000-call cap.

```ts
expect(plan.calls).toHaveLength(300);
expect(new Set(plan.calls.map((call) => call.identity))).toHaveSize(300);
expect(plan.channels.map(({ key }) => key)).toEqual([
  "chatgpt",
  "perplexity",
  "gemini",
  "copilot",
  "google-ai-mode",
  "google-ai-overview",
]);
```

- [ ] **Step 2: Run the tests and verify RED**

Run: `pnpm --filter @workspace/web exec vitest run src/server/overseas-run-now-policy.test.ts`

Expected: FAIL because the policy module does not exist.

- [ ] **Step 3: Implement the minimal fixed registry and deterministic planner**

Use the existing `resolveObservationTarget` and `assertObservationRouteSupportsScope` functions. Canonically sort Prompts by ID and channels by registry order. Hash canonical JSON with SHA-256. Reject any model/provider/route not exactly registered as Bright Data.

- [ ] **Step 4: Run the focused tests and verify GREEN**

Run: `pnpm --filter @workspace/web exec vitest run src/server/overseas-run-now-policy.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit Task 1**

```bash
git add apps/web/src/server/overseas-run-now-policy.ts apps/web/src/server/overseas-run-now-policy.test.ts
git commit -m "feat: plan overseas Bright Data cohorts"
```

### Task 2: Cohort and call-slot database model

**Files:**
- Modify: `packages/lib/src/db/schema.ts`
- Create: `packages/lib/src/db/overseas-runs.ts`
- Test: `packages/lib/src/db/overseas-runs.test.ts`
- Create: `packages/lib/src/db/migrations/0024_overseas_run_now.sql`
- Create: `packages/lib/src/db/migrations/meta/0024_snapshot.json`
- Modify: `packages/lib/src/db/migrations/meta/_journal.json`

**Interfaces:**
- Produces: `createOverseasRunCohort`, `getOverseasRunCohort`, `listOverseasRunCohorts`, `claimOverseasRunCall`, `recordOverseasPaidIntent`, `completeOverseasRunCall`, `failOverseasRunCall`, `summarizeOverseasRunCohort`.
- Cohort statuses: `dispatch_pending | running | completed`.
- Call statuses: `queued | running | succeeded | failed`.

- [ ] **Step 1: Write failing repository policy tests**

Assert one transaction creates a cohort and all frozen calls, `(brand_id, idempotency_key)` uniqueness returns the exact existing manifest only, `(cohort_id, prompt_id, surface_target_key, sample_index)` is unique, and progress is derived from call states.

```ts
expect(summary).toEqual({ planned: 300, queued: 250, running: 10, succeeded: 35, failed: 5 });
```

- [ ] **Step 2: Run tests and verify RED**

Run: `pnpm --filter @workspace/lib exec vitest run src/db/overseas-runs.test.ts`

Expected: FAIL because schema/repository exports do not exist.

- [ ] **Step 3: Add schema and migration**

Create `overseas_run_cohorts` with brand/scope foreign keys, idempotency key, manifest JSON/fingerprint, status, creator, timestamps, and unique brand/idempotency constraint. Create `overseas_run_calls` with frozen Prompt text, model/provider/web-search, surface/capture route, sample index, status, paid intent, provider submission ID, observation attempt/run IDs, bounded failure fields, and timestamps.

- [ ] **Step 4: Implement row-locking repository transitions**

All transitions use exact current-state predicates. `recordOverseasPaidIntent` is the only transition allowed before provider invocation. A call with paid intent can never return to `queued`. Finalizing the final nonterminal call updates the cohort to `completed` in the same transaction.

- [ ] **Step 5: Generate and validate Drizzle metadata**

Run: `pnpm --filter @workspace/lib exec drizzle-kit generate --custom --name overseas_run_now`

Keep the reviewed SQL and generated snapshot/journal chain at migration `0024`.

- [ ] **Step 6: Run repository tests, lib typecheck, and Drizzle check**

Run:

```bash
pnpm --filter @workspace/lib exec vitest run src/db/overseas-runs.test.ts
pnpm --filter @workspace/lib check-types
pnpm --filter @workspace/lib exec drizzle-kit check
```

Expected: all pass.

- [ ] **Step 7: Commit Task 2**

```bash
git add packages/lib/src/db/schema.ts packages/lib/src/db/overseas-runs.ts packages/lib/src/db/overseas-runs.test.ts packages/lib/src/db/migrations
git commit -m "feat: persist overseas run cohorts"
```

### Task 3: Deterministic pg-boss dispatch

**Files:**
- Create: `apps/web/src/server/overseas-run-dispatch.ts`
- Test: `apps/web/src/server/overseas-run-dispatch.test.ts`
- Modify: `apps/web/src/lib/boss-client.ts`
- Modify: `apps/worker/src/index.ts`

**Interfaces:**
- Produces: queue name `process-overseas-run-call` and `dispatchOverseasRunCalls(cohortId)`.
- Job payload: `{ cohortId: string; callId: string }`.
- Deterministic singleton key: `overseas-run-call-${callId}`.

- [ ] **Step 1: Write failing dispatch tests**

Test that only queued calls without a durable job are sent, repeated dispatch sends no duplicate singleton job, partial send failure leaves the cohort dispatch-pending, and a later dispatch sends only missing calls.

- [ ] **Step 2: Run tests and verify RED**

Run: `pnpm --filter @workspace/web exec vitest run src/server/overseas-run-dispatch.test.ts`

- [ ] **Step 3: Implement deterministic dispatch and queue registration**

Use pg-boss singleton keys, `retryLimit: 0`, and a bounded job expiry. Do not mutate paid intent during dispatch. Return `{ planned, dispatched, alreadyDispatched, failed }`.

- [ ] **Step 4: Run focused tests and web/worker typechecks**

```bash
pnpm --filter @workspace/web exec vitest run src/server/overseas-run-dispatch.test.ts
pnpm --filter @workspace/web check-types
pnpm --filter @workspace/worker check-types
```

- [ ] **Step 5: Commit Task 3**

```bash
git add apps/web/src/server/overseas-run-dispatch.ts apps/web/src/server/overseas-run-dispatch.test.ts apps/web/src/lib/boss-client.ts apps/worker/src/index.ts
git commit -m "feat: dispatch overseas run calls"
```

### Task 4: Overseas worker call execution

**Files:**
- Create: `apps/worker/src/jobs/process-overseas-run-call.ts`
- Test: `apps/worker/src/jobs/process-overseas-run-call.test.ts`
- Modify: `apps/worker/src/handlers.ts`
- Modify: `apps/worker/src/jobs/process-prompt.ts`
- Modify: `packages/lib/src/providers/types.ts`
- Modify: `packages/lib/src/providers/registry/brightdata.ts`
- Modify: `packages/lib/src/providers/registry/brightdata.test.ts`

**Interfaces:**
- Consumes: `{ cohortId, callId }`, repository transitions, and the frozen call config.
- Produces: one succeeded/failed call slot and existing observation, `prompt_run`, citations, queries, and response snapshot records.
- Extract from `process-prompt.ts`: an actor-neutral `executeModelIteration` that accepts an already-claimed observation attempt and never schedules another job.

- [ ] **Step 1: Write failing worker tests**

Cover all six fixture targets, paid intent preceding provider invocation, no invocation for completed/running/paid-uncertain calls, valid no-mention success, technical failure without `prompt_run`, snapshot success, snapshot retry-later, and one call failure not throwing a cohort-wide retry.

- [ ] **Step 2: Run tests and verify RED**

Run: `pnpm --filter @workspace/worker exec vitest run src/jobs/process-overseas-run-call.test.ts`

- [ ] **Step 3: Extract the existing single-iteration core without changing scheduled behavior**

Keep `processPromptJob` scheduling and target selection unchanged. The extracted core must preserve mention analysis, citations, query fan-out, raw output, model version, observation persistence, and response-snapshot behavior.

- [ ] **Step 4: Implement the call handler**

Claim the frozen slot, create/claim its stable observation attempt, persist paid intent, invoke exactly the frozen Bright Data target once, persist the observation, store the provider submission ID exposed by the provider result, and terminally update the call. Extend `ScrapeResult` with an optional opaque `providerSubmissionId`; Bright Data dataset snapshots populate it, while SERP responses may omit it. Any error after paid intent is recorded as failed and is not thrown to pg-boss for replay.

- [ ] **Step 5: Run worker focused/full tests and typecheck**

```bash
pnpm --filter @workspace/worker exec vitest run src/jobs/process-overseas-run-call.test.ts src/jobs/process-prompt-snapshot-policy.test.ts
pnpm --filter @workspace/worker test
pnpm --filter @workspace/worker check-types
```

- [ ] **Step 6: Commit Task 4**

```bash
git add apps/worker/src/jobs/process-overseas-run-call.ts apps/worker/src/jobs/process-overseas-run-call.test.ts apps/worker/src/jobs/process-prompt.ts apps/worker/src/handlers.ts packages/lib/src/providers/types.ts packages/lib/src/providers/registry/brightdata.ts packages/lib/src/providers/registry/brightdata.test.ts
git commit -m "feat: execute overseas Bright Data calls"
```

### Task 5: Platform-admin server functions and readiness

**Files:**
- Create: `apps/web/src/server/overseas-run-now.ts`
- Test: `apps/web/src/server/overseas-run-now.test.ts`
- Modify: `apps/web/src/server/sampling.ts`
- Modify: `packages/config/src/env-registry.ts`
- Modify: `apps/web/src/env.d.ts`
- Modify: `turbo.json`
- Modify: `deploy/las/env.example`

**Interfaces:**
- Produces: `listOverseasRunNowProgramsFn`, `getOverseasRunNowReadinessFn`, `runOverseasNowFn`, `listOverseasRunCohortsFn`, `redispatchOverseasRunFn`.
- Input: `{ brandId, scopeId, channelKeys, idempotencyKey }`.

- [ ] **Step 1: Write failing authorization/readiness/orchestration tests**

Reject customer, report operator, impersonated session, China Program, disabled/non-scored/automatic Program, unknown channel, missing Bright Data credential, incompatible route, and snapshot-capacity blocker. Assert PPIO's eligible Program returns 10 Prompts and six ready channels in the configured fixture.

- [ ] **Step 2: Run tests and verify RED**

Run: `pnpm --filter @workspace/web exec vitest run src/server/overseas-run-now.test.ts`

- [ ] **Step 3: Implement server policy and feature flag**

Add `OVERSEAS_RUN_NOW_ENABLED`, default false in the example. The server checks the flag, platform-admin identity, Bright Data credential, exact Program identity, route localization, and response-snapshot configuration before transactionally creating the cohort.

- [ ] **Step 4: Implement idempotent create/list/redispatch functions**

Create from the frozen planner, call deterministic dispatch after commit, and return database-derived progress. The idempotency mismatch path fails closed. Listing is read-only; redispatch sends only missing queued jobs.

- [ ] **Step 5: Run focused tests and web typecheck**

```bash
pnpm --filter @workspace/web exec vitest run src/server/overseas-run-now.test.ts
pnpm --filter @workspace/web check-types
```

- [ ] **Step 6: Commit Task 5**

```bash
git add apps/web/src/server/overseas-run-now.ts apps/web/src/server/overseas-run-now.test.ts apps/web/src/server/sampling.ts packages/config/src/env-registry.ts apps/web/src/env.d.ts turbo.json deploy/las/env.example
git commit -m "feat: expose overseas run now APIs"
```

### Task 6: Portal overseas card and progress

**Files:**
- Create: `apps/web/src/components/sampling/overseas-run-now-dialog.tsx`
- Test: `apps/web/src/components/sampling/overseas-run-now-dialog.test.tsx`
- Create: `apps/web/src/components/sampling/overseas-run-list.tsx`
- Test: `apps/web/src/components/sampling/overseas-run-list.test.tsx`
- Modify: `apps/web/src/components/sampling/types.ts`
- Modify: `apps/web/src/routes/_authed/admin/sampling/index.tsx`

**Interfaces:**
- Displays the six fixed channels, all selected by default, and `Prompt count × selected channels × 5`.
- Displays cohort progress and a `Resume dispatch` action only when dispatch is pending.

- [ ] **Step 1: Write failing render/interaction tests**

Assert six labels, default selection, PPIO `10 × 6 × 5 = 300`, deselection math, disabled unavailable channels with reasons, one submit while busy, progress states, per-channel totals, and no overseas action for customer routes.

- [ ] **Step 2: Run tests and verify RED**

Run: `pnpm --filter @workspace/web exec vitest run src/components/sampling/overseas-run-now-dialog.test.tsx src/components/sampling/overseas-run-list.test.tsx`

- [ ] **Step 3: Implement the card and progress list**

Keep domestic UI unchanged. Use separate headings **Domestic browser run** and **Overseas Bright Data run**. Generate one idempotency key per click and retain it until the server responds.

- [ ] **Step 4: Wire the platform Sampling route**

Load eligible overseas Programs, readiness, and recent cohorts for the selected brand. After create or redispatch, invalidate/reload only the overseas data and keep the domestic batch filters intact.

- [ ] **Step 5: Run focused tests and web typecheck**

```bash
pnpm --filter @workspace/web exec vitest run src/components/sampling/overseas-run-now-dialog.test.tsx src/components/sampling/overseas-run-list.test.tsx
pnpm --filter @workspace/web check-types
```

- [ ] **Step 6: Commit Task 6**

```bash
git add apps/web/src/components/sampling apps/web/src/routes/_authed/admin/sampling/index.tsx
git commit -m "feat: add overseas run now to Portal"
```

### Task 7: Deployment gates and integrated acceptance

**Files:**
- Modify: `.github/workflows/e2e.yaml`
- Modify: `.github/workflows/deploy-las.yaml`
- Create: `deploy/las/bin/audit-overseas-run-now-readiness.sh`
- Test: `deploy/las/bin/audit-overseas-run-now-readiness.test.sh`
- Modify: `deploy/las/README.md`
- Create: `e2e/tests/overseas-run-now.spec.ts`

**Interfaces:**
- Production readiness audit reports only coarse channel readiness and never prints credentials/dataset IDs.
- E2E uses a stub provider and temporary database; it never calls Bright Data.

- [ ] **Step 1: Write failing shell and E2E contract tests**

Shell fixtures cover disabled flag, missing credential, unavailable snapshot storage, and six-channel ready output. E2E covers platform-only visibility, 300-slot creation for a seeded 10-Prompt Program, progress update via stub worker, dashboard channel filters, and ready HTML/JSON snapshot access.

- [ ] **Step 2: Run tests and verify RED**

```bash
bash deploy/las/bin/audit-overseas-run-now-readiness.test.sh
pnpm -C e2e exec playwright test tests/overseas-run-now.spec.ts --project=fixtures
```

- [ ] **Step 3: Implement readiness audit and workflow gates**

Deploy migration/web/worker first with `OVERSEAS_RUN_NOW_ENABLED=false`. The readiness step must pass before an explicit production configuration change enables the Portal action. CI provider execution remains stub-only.

- [ ] **Step 4: Run E2E, shell tests, and production builds**

```bash
bash deploy/las/bin/audit-overseas-run-now-readiness.test.sh
pnpm -C e2e exec tsc --noEmit
pnpm -C e2e exec playwright test tests/overseas-run-now.spec.ts --project=fixtures
pnpm --filter @workspace/web build
pnpm --filter @workspace/worker build
```

- [ ] **Step 5: Commit Task 7**

```bash
git add .github/workflows/e2e.yaml .github/workflows/deploy-las.yaml deploy/las e2e/tests/overseas-run-now.spec.ts
git commit -m "test: gate overseas run now deployment"
```

### Task 8: Final verification, review, deployment, and PPIO run

**Files:**
- Review all files changed by Tasks 1–7.

**Interfaces:**
- Produces a production release with the feature initially disabled, a passed readiness receipt, an explicit enablement, a five-call smoke cohort, and then one PPIO 300-call cohort.

- [ ] **Step 1: Run complete verification**

```bash
pnpm --filter @workspace/lib test
pnpm --filter @workspace/lib check-types
pnpm --filter @workspace/web test
pnpm --filter @workspace/web check-types
pnpm --filter @workspace/worker test
pnpm --filter @workspace/worker check-types
pnpm --filter @workspace/lib exec drizzle-kit check
git diff --check
```

- [ ] **Step 2: Perform security/release review**

Verify platform authorization, no customer mutation path, no credential output, exact six-channel registry, paid-intent ordering, no uncertain replay, one-shot behavior, migration compatibility, snapshot retention, and unchanged Elmo metric files.

- [ ] **Step 3: Push and monitor immutable deployment**

Push the reviewed commit, monitor image builds, migrations, E2E, readiness, and deployment health. Do not enable the feature if any gate is red.

- [ ] **Step 4: Enable and run a five-call smoke cohort**

Use one non-sensitive Prompt, ChatGPT only, and the fixed five samples. Verify five successful observations and five ready response snapshots before full execution.

- [ ] **Step 5: Run the PPIO full cohort once**

Select PPIO → `Global Market` → all six channels. Confirm `10 × 6 × 5 = 300`, start once, and monitor until all calls are terminal.

- [ ] **Step 6: Verify production results**

Confirm per-channel totals, success coverage, Visibility denominator, competitor mentions, citations, query fan-out, and ready HTML/JSON snapshots from the PPIO customer read-only dashboard. Record the production run/cohort IDs and actual Bright Data invoice usage without exposing credentials.
