# LAS Runtime Production Gates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the LAS production forced-command and rootless runtime path fail closed unless an exact policy tuple, durable migration-readiness evidence, activation state, runtime environment, and transition journal all agree.

**Architecture:** Keep candidate release code outside the Docker/runtime trust boundary. The root dispatcher owns protocol validation and transition sequencing; the stable runtime manager independently validates root-owned state and environment immediately before each Docker mutation. Legacy post-deploy operations are removed from the production SSH/workflow surface rather than partially supported.

**Tech Stack:** Bash, embedded Python 3 validators, Docker Compose JSON contracts, GitHub Actions YAML, shell behavior fixtures, Node `node:test` workflow assertions.

**Spec:** `docs/superpowers/specs/2026-08-26-portal-bilingual-design.md`

**Current production gate:** This repository has no trustworthy producer for
the root-owned migration backup/rehearsal attestation consumed by
`migration-readiness`. The verifier schema must not be treated as an operator
recipe and evidence must never be hand-written or synthesized from the
checkout-only rehearsal helper. Until a reviewed stable producer performs the
backup, verifies off-host durability, rehearses the exact migration digest, and
emits the attestation, production migration, bootstrap, and deployment remain
blocked regardless of the implementation status below.

## Global Constraints

- Do not deploy, fetch production state, or commit from this worker.
- Do not expose Docker socket/configuration or runtime secrets to `yonaris-gate` or `yonaris-deploy`.
- Do not modify the state manager, bundle installer, forced-command verifier, guard/policy installer, or Caddy manager in this slice; consume their reviewed fixed interfaces.
- Every Docker mutation requires an exact root-owned authorization check immediately before the mutation.
- Preserve the five-digest tuple: Web, Worker, Migrate, Postgres, WWW.
- Candidate, gate, and deploy identities never receive either Docker socket or the runtime dotenv; Docker operations exist only as enumerated fixed operations in the root-owned stable runtime manager.
- Legal Git paths may contain spaces, `$`, `[` and `]`; reject traversal components, symlinks, submodules/gitlinks, and unsupported object modes instead of imposing a shell-safe filename allowlist.
- The eleven legacy candidate-side operation names stay permanently absent from dispatcher, policy, and production workflow surfaces. A future capability requires a newly named stable operation and exact protocol.

---

### Task 1: Close legacy forced-command and workflow surfaces

**Files:**
- Modify: `deploy/las/bin/dispatch-las-command.test.sh`
- Modify: `deploy/las/bin/dispatch-las-command.sh`
- Modify: `.github/workflows/deploy-las.yaml`
- Modify: `deploy/las/bin/marketing-workflow.test.mjs`

**Interfaces:**
- Produces: the exact production grammar `probe`, `deploy`, `marketing-preflight`, `marketing-deploy`, and `marketing-verify` only.
- Coordinates: guard/policy operation allowlists are removed by the owning worker.

- [x] Add behavior/contract assertions that each legacy operation is rejected before authorization/materialization/candidate execution and absent from the runnable workflow surface.
- [x] Run the dispatcher and workflow tests and verify they fail on the old grammar/jobs.
- [x] Remove legacy grammar and release-script execution; any retained workflow
      regression stub must be guarded by literal `if: ${{ false }}` and remain
      independently rejected by dispatcher/policy parsers.
- [x] Re-run focused tests and verify the stable production surface is exact.

### Task 2: Enforce a production-grade stable runtime dotenv contract

**Files:**
- Modify: `deploy/las/bin/manage-las-runtime.test.sh`
- Modify: `deploy/las/bin/manage-las-runtime.sh`

**Interfaces:**
- Produces: strict data-only validation for required fields, placeholders, UUID/base64/boolean/enum/range contracts, Postgres URL agreement, and provider-specific credentials.

- [x] Add table-driven invalid-env fixtures and assert the Docker event log remains empty.
- [x] Run the runtime test and verify the new invalid cases expose the old boundary gap.
- [x] Implement strict parsing without evaluating or printing secret values.
- [x] Re-run the runtime test and verify all invalid configurations fail before Docker access.

### Task 3: Bind deploy mutations to readiness, activation, and the pending tuple

**Files:**
- Modify: `deploy/las/bin/dispatch-las-command.test.sh`
- Modify: `deploy/las/bin/dispatch-las-command.sh`
- Modify: `deploy/las/bin/manage-las-runtime.test.sh`
- Modify: `deploy/las/bin/manage-las-runtime.sh`

**Interfaces:**
- Consumes: root state-manager fixed operations for migration readiness, exact pending tuple verification, and bootstrap authorization.
- Produces: dispatcher checks before `begin`, plus runtime-manager checks before every `pull`, `up`, or migration run.
- Exact state grammar: `migration-readiness <release> <web> <worker> <migrate> <postgres> <www>`, `pending-runtime-tuple <portal|marketing> <release> <five digests>`, `pending-rollback-runtime-tuple <portal|marketing> <predecessor> <five digests>`, and direct-root `bootstrap-runtime-authorization <portal|marketing> <release> <five digests>`.
- Exact runtime bootstrap grammar: `bootstrap-portal-deploy <release> <five digests> portal-bootstrap-runtime-v1` and `bootstrap-marketing-deploy <release> <five digests> marketing-bootstrap-runtime-v1`; both remain unusable in production until migration readiness has a trustworthy producer.

- [x] Add failing fixtures for missing/mismatched readiness evidence, missing activation env flags after the one-way marker, missing/mismatched journals, and non-policy bootstrap tuples.
- [x] Verify each failure occurs before the first Docker event.
- [x] Add dispatcher pre-`begin` checks and pass only exact fixed evidence context to the runtime manager.
- [x] Add runtime-side rechecks immediately before each mutation, with separate root-local portal and marketing bootstrap grammar that requires marker absence and the full authorized tuple.
- [x] Re-run focused tests and verify valid normal, rollback, and bootstrap paths while all mismatches remain mutation-free.

### Task 4: Make marketing rollback restore runtime before Caddy

**Files:**
- Modify: `deploy/las/bin/dispatch-las-command.test.sh`
- Modify: `deploy/las/bin/dispatch-las-command.sh`

**Interfaces:**
- Produces: failed marketing deployment restores and verifies the predecessor runtime before any Caddy rollback/reconcile.

- [x] Add an ordered event-log assertion for both runtime-deploy and Caddy-activate failure paths.
- [x] Run and verify the old runtime-deploy failure order is rejected.
- [x] Reorder predecessor runtime restoration/verification, Caddy rollback, and state reconciliation.
- [x] Re-run the ordered behavior tests.

### Task 5: Close legacy deploy and E2E Compose contracts

**Files:**
- Modify: `deploy/las/bin/deploy-bootstrap-owner.test.sh`
- Modify: `deploy/las/bin/deploy.sh`
- Modify: `scripts/e2e-compose-topology.test.mjs`
- Modify: `.github/workflows/e2e.yaml`

**Interfaces:**
- Produces: explicit Postgres digest contract in the legacy deploy script and syntactically valid test-only digest/env inputs for the base Compose E2E model.

- [x] Add failing source/Compose assertions for the fifth digest and deterministic E2E inputs.
- [x] Run focused tests and verify the missing contracts fail.
- [x] Apply the smallest legacy fail-closed contract and test-only workflow env correction.
- [x] Re-run shell/Node tests, `bash -n`, YAML parse, and `git diff --check` for this slice.

### Task 6: Bind queued dispatch to the launcher's active bundle generation

**Files:**
- Modify: `deploy/las/bin/dispatch-las-command.test.sh`
- Add: `deploy/las/bin/dispatch-las-bundle-pointer-race.test.sh`
- Modify: `deploy/las/bin/install-las-stable-bundle.test.sh`
- Modify: `deploy/las/bin/dispatch-las-command.sh`

**Interfaces:**
- Consumes: the fixed launcher's inherited `LAS_STABLE_BUNDLE_DIR`, the exact
  root-owned active pointer, and the common installer/dispatcher inode lock.
- Produces: shared-lock probe validation and exclusive-lock mutation
  serialization, with a complete pointer/verifier/journal/activation recheck
  after the non-atomic shared-to-exclusive conversion.

- [x] Add a cross-process fixture in which a request pins the candidate, waits
      behind installer ownership, then observes the pointer rolled back to the
      predecessor.
- [x] Require both probe and deploy to reject the stale pin with exit 75 before
      any verifier, state, runtime, or Caddy peer is reached.
- [x] Acquire the shared lock before privileged peer access, require canonical
      pointer bytes to equal the inherited pin, and run the pinned verifier.
- [x] Convert normal operations to exclusive mode and repeat the complete
      locked boundary before any fetch, materialization, journal, Docker, or
      Caddy mutation.
- [x] Re-run the race fixture and full dispatcher behavior suite.

### Task 7: Make every root Git read offline and close bundle-journal races

**Files:**
- Modify: `deploy/las/bin/{dispatch-las-command,guard-artifact-output-release,install-las-trust-policy,install-las-stable-bundle,manage-las-release-state}.sh`
- Modify: their focused shell behavior tests and the LAS operator docs.

**Interfaces:**
- Produces: one fail-closed root Git invariant: no lazy fetch, credential
  helper/prompt, network protocol, remote/partial-clone/include configuration,
  alternate object database, or promisor pack.
- Produces: locked dispatcher rejection of bundle journal/temp/pointer-temp
  state while preserving installer-owned postverification and recovery.

- [x] Add remote, partial-clone, promisor, alternate, and missing-object
      fixtures and verify rejection before privileged mutation.
- [x] Add a kill-after-pointer fixture and require the pinned forced reader to
      exit 75 without reaching a stable peer.
- [x] Apply the same offline Git wrapper/store validation to every root reader;
      make per-blob materialization failure explicit.
- [x] Keep bundle-pending detection in dispatcher lock revalidation, not the
      generic verifier used by installer postverification.
- [x] Re-run focused suites and shell syntax checks.
