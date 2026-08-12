# Doubao Native-Auto and Dedicated Sampling Session Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Safely execute one explicit StepFun Doubao batch containing 3 frozen prompts × 6 samples while retaining the original Elmo metric denominator and honestly recording Doubao's native search and dedicated-account session semantics.

**Architecture:** Add forward-only delivery/session/search protocol values and nullable search-observation metadata, then update the independent Browser Runner and admin workflow to use them. Keep the runner on the dedicated China host behind explicit feature gates, a human-provisioned sampling profile, Chromium sandboxing, and a one-shot batch command.

**Tech Stack:** TypeScript, PostgreSQL/Drizzle, TanStack Start, Node.js, Playwright Chromium, Ubuntu 24.04, AppArmor, systemd/nftables.

## Global Constraints

- Do not modify Elmo Visibility, Share of Voice, Opportunities, or report formulas.
- Technical failures never create `prompt_runs` and never become `brandMentioned=false`.
- Existing frozen batches are immutable and are never reinterpreted.
- `webSearchObserved=null` means unknown and must never be coerced to false.
- Login is human-only; never automate credentials, QR scanning, account creation, CAPTCHA solving, or anti-bot bypass.
- A durable submit intent must exist before the only prompt submission; post-intent recovery never resubmits.
- Formal execution is 3 prompts × 6 samples = 18 tasks on Doubao only.
- Each successful task requires exactly one PNG screenshot and one HTML page snapshot.
- The measurement timezone is `Asia/Shanghai`.
- There is no cron or daily schedule; execution starts explicitly and the live gate is disabled after delivery.

---

### Task 1: Add the native-auto search contract

**Files:**
- Modify: `packages/lib/src/delivery-manifest.ts`
- Modify: `packages/lib/src/db/schema.ts`
- Modify: `packages/lib/src/db/observations.ts`
- Create: `packages/lib/src/db/migrations/0021_native_auto_search.sql`
- Create: `packages/lib/src/db/migrations/meta/0021_snapshot.json`
- Modify: `packages/lib/src/db/migrations/meta/_journal.json`
- Modify: relevant Lib tests beside these modules

**Interfaces:**
- Produces `DeliverySearchRequirement = ... | "platform_default"`.
- Produces nullable `webSearchObserved: boolean | null` persistence on attempts and prompt runs.

- [ ] Write failing tests proving manifest slot/hash separation and nullable three-state persistence.
- [ ] Run the targeted tests and confirm failures are caused by missing protocol values/columns.
- [ ] Add the enum value, nullable columns, migration, and null-safe idempotency comparison.
- [ ] Run targeted Lib tests, Lib typecheck, Drizzle check, and confirm zero failures.

### Task 2: Update web protocol validation and administration

**Files:**
- Modify: `apps/web/src/server/sampling.ts`
- Modify: `apps/web/src/server/sampling-observation.ts`
- Modify: `apps/web/src/server/browser-runner-service.ts`
- Modify: `apps/web/src/components/sampling/sampling-batch-create-dialog.tsx`
- Modify: `apps/web/src/components/sampling/sampling-task-workbench.tsx`
- Modify: `apps/web/src/components/sampling/types.ts`
- Modify: relevant unit tests

**Interfaces:**
- Consumes `platform_default` and nullable `webSearchObserved` from Task 1.
- Produces `searchMode="native_auto"` runner completion validation.

- [ ] Write failing tests for Browser Runner create validation, unknown preservation, and manual/legacy rejection.
- [ ] Verify the targeted tests fail for the expected missing behavior.
- [ ] Lock new Doubao Browser Runner batches to `platform_default`; keep legacy/manual semantics unchanged.
- [ ] Add Used/Not used/Unknown handling for human recovery without defaulting to false.
- [ ] Run web targeted tests and typecheck with zero failures.

### Task 3: Add the dedicated sampling profile contract

**Files:**
- Modify: `packages/lib/src/delivery-manifest.ts`
- Modify: `packages/lib/src/db/schema.ts`
- Modify: `apps/web/src/server/sampling.ts`
- Modify: `apps/browser-runner/src/contracts.ts`
- Modify: `apps/browser-runner/src/adapters/doubao-live.ts`
- Create or modify: runner profile-identity and dedicated-profile tests

**Interfaces:**
- Produces `sessionRequirement="dedicated_sampling_profile"`.
- Produces a runner profile store that is manually logged in, sequentially reused, and task/session checked.

- [ ] Write failing tests for the new frozen session value, missing-profile rejection, wrong identity rejection, and new-conversation requirement.
- [ ] Verify all new tests fail for the intended missing behavior.
- [ ] Implement the minimum dedicated-profile lifecycle without automated login.
- [ ] Preserve exactly-once submit and same-session recovery rules.
- [ ] Run runner and web targeted tests plus typechecks with zero failures.

### Task 4: Enforce native-auto evidence classification in the adapter

**Files:**
- Modify: `apps/browser-runner/src/contracts.ts`
- Modify: `apps/browser-runner/src/run-batch.ts`
- Modify: `apps/browser-runner/src/assist.ts`
- Modify: `apps/browser-runner/src/remote-client.ts`
- Modify: `apps/browser-runner/src/adapters/doubao-live.ts`
- Modify: relevant fixtures and tests

**Interfaces:**
- Produces `searchMode="native_auto"` and `webSearchObserved=true|false|null`.

- [ ] Write failing tests for search-used, explicit no-search, unknown, and conflicting markers.
- [ ] Verify red tests.
- [ ] Scope approved markers to the newest answer; absence returns null, conflict returns page drift.
- [ ] Remove the search-off selector requirement from the native-auto path while retaining legacy forbidden support.
- [ ] Run runner tests, typecheck, and build with zero failures.

### Task 5: Make sandbox and host isolation a hard preflight

**Files:**
- Modify: `apps/browser-runner/src/adapters/doubao-live.ts`
- Create or modify: runner host-preflight code and tests
- Modify: `apps/browser-runner/README.md`
- Modify: `deploy/las/SAMPLING-DELIVERY-RUNBOOK.md`
- Create: checked-in host installation/preflight scripts under `deploy/browser-runner/`

**Interfaces:**
- Produces a non-zero preflight exit if Chromium is launched without its sandbox or if isolation checks fail.

- [ ] Write failing tests that inspect launch options and reject an unsandboxed browser.
- [ ] Verify red tests.
- [ ] Set `chromiumSandbox:true` and add the exact Ubuntu/AppArmor preflight.
- [ ] Split broker/browser OS identities or namespaces if control-plane and browser egress cannot be separated safely under one identity.
- [ ] Validate the scripts in a disposable/fixture mode before applying to Laoxu.

### Task 6: Deploy compatibility changes with execution disabled

**Files:**
- Modify only deployment workflow/path filters or environment registry files required by Tasks 1-5.

- [ ] Run full Lib, Web, Worker, and Browser Runner tests and builds.
- [ ] Run Drizzle migration checks and empty/seeded database migration smoke tests.
- [ ] Request an independent P0/P1 review and resolve findings.
- [ ] Commit and push an immutable SHA.
- [ ] Monitor CI and production deployment to terminal success.
- [ ] Verify production still returns disabled for Browser Runner execution before UAT.

### Task 7: Provision and validate Laoxu

**Files:**
- Operational state only on `111.62.212.49`; do not place credentials in Git.

- [ ] Apply the reviewed AppArmor, service identity, file-permission, and network-isolation configuration.
- [ ] Install the immutable runner SHA and verify its checksum.
- [ ] Run typecheck, tests, fixture smoke, sandbox smoke, and network-deny probes as the unprivileged runner identity.
- [ ] Create the dedicated encrypted profile directory and start a headed one-time login session without exposing credentials to Yonaris.
- [ ] Verify login state, new-conversation behavior, and profile identity; do not submit a formal prompt.

### Task 8: Complete a non-scored China-host UAT

- [ ] Create one observation-only `CN / zh-CN / Asia/Shanghai` batch with one non-sensitive prompt, Doubao, one sample, dedicated profile, and platform default search.
- [ ] Explicitly start the batch and run one one-shot runner command.
- [ ] Verify exactly one submitted user message, full answer capture, search three-state metadata, two attached artifacts, hashes, and successful customer projection.
- [ ] Confirm no metric formula changed and the observation did not enter the scored pool.

### Task 9: Run and verify the formal StepFun batch

- [ ] Freeze the exact three enabled StepFun prompts, Doubao only, six samples each, scored, Beijing-time window, dedicated profile, and platform default search.
- [ ] Record batch UUID, manifest hash, and exactly 18 frozen slots before starting.
- [ ] Explicitly start the batch and run the one-shot Laoxu runner until the automatic queue is drained.
- [ ] Resolve pre-submit human tasks without replacing frozen prompts; recover post-submit tasks only from the retained same session.
- [ ] Confirm terminal failures honestly if recovery is impossible; never create a replacement batch to hide them.
- [ ] Verify final counts, expected target 18 succeeded / 0 failed / 0 needs-human, exactly 36 attached artifacts, 18 prompt runs, and customer-visible results.
- [ ] Disable Browser Runner live execution, remove the Laoxu service token, stop foreground processes, and clean temporary probe/UAT assets while retaining required audit evidence.

## Self-review

- Every design requirement maps to a task.
- No task changes Elmo metric formulas.
- Forward-only search and session protocol values are explicit.
- Formal data cannot be written before the non-scored UAT and host isolation pass.
- The plan contains no unattended daily scheduling.
