# PPIO Program Locale Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Correct the existing PPIO China Market Program locale in place while failing closed on any identity or execution-history mismatch.

**Architecture:** A pure policy module validates a fixed request and computes `repair` versus `unchanged`. A worker CLI loads and locks production rows, performs the one-column update inside a serializable transaction, and returns a sanitized receipt. A production-only workflow job executes the fixed request after successful deployment.

**Tech Stack:** TypeScript, Drizzle ORM, PostgreSQL, Node test runner, Bash, GitHub Actions.

## Global Constraints

- Do not create a Program, prompt, task, batch, attempt, run, or evidence record.
- Do not modify prompt text, tags, scope identity fields other than locale, or customer authentication state.
- Accept only `zn-CN` as the repair source and `zh-CN` as the destination; `zh-CN` is idempotent.
- Refuse mutation when any execution-history row references the scope.
- The production request is fixed to PPIO, `ppio@admin.com`, China Market, and the approved ten prompts.

---

### Task 1: Strict repair policy

**Files:**
- Create: `apps/worker/src/program-locale-repair-policy.ts`
- Create: `apps/worker/src/program-locale-repair-policy.test.ts`

**Interfaces:**
- Produces: `parseProgramLocaleRepairRequest(value)`, `assessProgramLocaleRepair(input)`, and `ProgramLocaleRepairError`.

- [ ] **Step 1: Write failing tests** for exact manifest keys, prompt set, customer owner identity, history refusal, `zn-CN -> repair`, and `zh-CN -> unchanged`.
- [ ] **Step 2: Run** `pnpm --filter @workspace/worker exec tsx --test src/program-locale-repair-policy.test.ts` and confirm failures are caused by the missing policy module.
- [ ] **Step 3: Implement the minimal pure policy** with literal expected values and fail-closed branches.
- [ ] **Step 4: Re-run the targeted tests** and require zero failures.

### Task 2: Transactional worker operation

**Files:**
- Create: `apps/worker/src/repair-program-locale.ts`
- Modify: `apps/worker/package.json`
- Create: `apps/worker/src/program-locale-repair-requests/ppio-cn-zh-20260817.json`

**Interfaces:**
- Consumes: Task 1 policy.
- Produces: CLI modes `--status-only`, default dry-run, and `--apply`; JSON receipt `{status, action, promptCount, historyCount, locale}`.

- [ ] **Step 1: Add a failing repository/transaction test** proving a history row prevents update and a valid cohort updates exactly one scope row.
- [ ] **Step 2: Run the test and confirm RED** against the absent operation.
- [ ] **Step 3: Implement one serializable transaction** with advisory lock, row locks, preflight, update, and postcondition queries.
- [ ] **Step 4: Add the package script and fixed request**, then run worker typecheck and tests.

### Task 3: Production workflow operation

**Files:**
- Create: `deploy/las/bin/run-program-locale-repair.sh`
- Create: `deploy/las/bin/run-program-locale-repair.test.sh`
- Create: `deploy/las/program-locale-repairs/requests/ppio-cn-zh-20260817.json`
- Modify: `.github/workflows/deploy-las.yaml`

**Interfaces:**
- Consumes: Task 2 CLI and fixed manifest.
- Produces: one production job after deploy, guarded by exact release SHA and request selection.

- [ ] **Step 1: Write a failing shell test** for status-only, dry-run, apply ordering, release mismatch, and sanitized output.
- [ ] **Step 2: Run it and confirm RED** because the helper does not exist.
- [ ] **Step 3: Implement the helper and workflow plan/job** following existing one-shot operation patterns.
- [ ] **Step 4: Run shell tests, workflow/static validation, worker tests, typecheck, Biome, and diff check.**

### Task 4: Release and production verification

**Files:** No additional source files.

- [ ] **Step 1: Commit, push, and open a PR.**
- [ ] **Step 2: Require all CI gates green, merge, and monitor the production deploy and repair job.**
- [ ] **Step 3: Verify the sanitized receipt reports exactly one repaired scope and ten unchanged prompts.**
- [ ] **Step 4: Open Portal Sampling Operations for PPIO and verify `China Market`, `CN / zh-CN / Asia/Shanghai`, ten prompts, and an eligible `Run now` Program without creating a batch.**
