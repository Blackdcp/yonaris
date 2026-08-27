# LAS Migration Readiness Producer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce trustworthy root-owned LAS migration readiness evidence from a live backup, verified off-host round trip, and isolated exact-image migration rehearsal.

**Architecture:** A new root-local stable producer validates an authorized six-digest tuple and orchestrates fixed operations in the existing rootless runtime manager. A separately installed, metadata-checked off-host adapter performs an idempotent upload/download round trip; only matching returned bytes permit atomic evidence publication.

**Tech Stack:** Bash 5, rootless Docker, PostgreSQL `pg_dump`/`pg_restore`, existing LAS stable bundle and shell contract-test harness.

**Spec:** `docs/superpowers/specs/2026-08-28-las-migration-readiness-producer-design.md`

## Global Constraints

- The producer is direct-root only and rejects `SUDO_USER`.
- Gate, deploy, candidate, Web, Worker, migration, and PostgreSQL containers never receive host Docker access or off-host credentials.
- The live database is backup source only; rehearsal always targets a disposable isolated database.
- Every image is selected by the exact authorized `sha256:` digest.
- Existing or conflicting evidence is never overwritten.
- `ARTIFACT_ZH_CN_ENABLED` remains `false` for the first compatible production release.

---

### Task 1: Fixed Runtime Backup and Rehearsal Operations

**Files:**
- Modify: `deploy/las/bin/manage-las-runtime.test.sh`
- Modify: `deploy/las/bin/manage-las-runtime.sh`

**Interfaces:**
- Consumes: `migration-backup <release> <web> <worker> <migrate> <postgres> <www> <absolute-output> migration-readiness-runtime-v1`
- Consumes: `migration-rehearse <release> <web> <worker> <migrate> <postgres> <www> <absolute-backup> <absolute-result> migration-readiness-runtime-v1`
- Produces: a non-empty PostgreSQL custom dump and a secret-free rehearsal result; both paths must be below `/var/lib/yonaris/migration-readiness-work-v1/<release>/`.

- [ ] **Step 1: Write failing runtime-manager tests**

Add real command-log assertions that require exact state authorization before every Docker mutation and reject paths outside the release work directory:

```bash
run_manager migration-backup "$RELEASE" "$WEB" "$WORKER" "$MIGRATE" "$POSTGRES" "$WWW" \
  "$WORK_ROOT/$RELEASE/database.dump" migration-readiness-runtime-v1
grep -Fq "state migration-readiness-runtime-authorization $RELEASE $WEB $WORKER $MIGRATE $POSTGRES $WWW" "$EVENT_LOG"
grep -Fq 'compose --project-name yonaris exec -T postgres pg_dump' "$DOCKER_LOG"

if run_manager migration-backup "$RELEASE" "$WEB" "$WORKER" "$MIGRATE" "$POSTGRES" "$WWW" \
  "$TEST_ROOT/outside.dump" migration-readiness-runtime-v1; then
  echo 'Unsafe migration backup output was accepted.' >&2
  exit 1
fi
```

Add rehearsal assertions for: exact Postgres and migration image digests; a unique internal network; no published ports; restore before migration; health verification; and cleanup after success or injected restore/migration failure.

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
bash deploy/las/bin/manage-las-runtime.test.sh
```

Expected: failure because `migration-backup` and `migration-rehearse` are not accepted operations.

- [ ] **Step 3: Implement minimal fixed operations**

Add strict path validation and the two exact operation branches. Both call:

```bash
state_attestation 'las-migration-readiness-runtime-authorization-v1 ok' \
  migration-readiness-runtime-authorization "$release_tag" \
  "$web" "$worker" "$migrate" "$postgres" "$www"
```

The backup branch uses the existing validated production Compose model and streams:

```bash
compose_portal "$tree" "$web" "$worker" "$migrate" "$postgres" \
  exec -T postgres pg_dump --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  --format custom --no-owner --no-acl
```

The rehearsal branch creates release-scoped Docker network/container/volume names, restores the supplied dump, runs `ghcr.io/blackdcp/yonaris-db-migrate@$migrate` with a rehearsal-only `DATABASE_URL`, verifies PostgreSQL health, writes the fixed result, and removes all temporary resources from an `EXIT` trap.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run `bash deploy/las/bin/manage-las-runtime.test.sh`.

Expected: exit 0 with backup, rehearsal, ordering, digest, path, and cleanup assertions green.

- [ ] **Step 5: Commit**

```bash
git add deploy/las/bin/manage-las-runtime.sh deploy/las/bin/manage-las-runtime.test.sh
git commit -m "feat: add fixed migration rehearsal runtime"
```

### Task 2: Root-owned Readiness Producer and State Authorization

**Files:**
- Create: `deploy/las/bin/produce-las-migration-readiness.test.sh`
- Create: `deploy/las/bin/produce-las-migration-readiness.sh`
- Modify: `deploy/las/bin/manage-las-release-state.test.sh`
- Modify: `deploy/las/bin/manage-las-release-state.sh`

**Interfaces:**
- Consumes: `produce-las-migration-readiness <release> <web> <worker> <migrate> <postgres> <www>` from a direct root console.
- Consumes off-host adapter: `/usr/local/libexec/yonaris-las/store-las-migration-backup put-get <release> <backup-sha256> <source> <returned-copy>`.
- Produces: `<release>.backup`, `<release>.rehearsal`, and the existing nine-line `<release>` attestation.

- [ ] **Step 1: Write failing producer and authorization tests**

Test direct-root enforcement, exact arguments, policy/tree binding, all pending-journal rejections, adapter metadata `0:0:755`, byte-changing round-trip rejection, runtime failure cleanup, atomic write failure, conflicting evidence rejection, and identical evidence idempotency. The success assertion is:

```bash
run_producer "$RELEASE" "$WEB" "$WORKER" "$MIGRATE" "$POSTGRES" "$WWW"
[[ "$(run_manager migration-readiness "$RELEASE" "$WEB" "$WORKER" "$MIGRATE" "$POSTGRES" "$WWW")" == \
  'las-migration-readiness-v1 ok' ]]
```

Add a state-manager test that accepts only the exact authorized policy/tree tuple and prints:

```text
las-migration-readiness-runtime-authorization-v1 ok
```

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```bash
bash deploy/las/bin/produce-las-migration-readiness.test.sh
bash deploy/las/bin/manage-las-release-state.test.sh
```

Expected: producer file/operation missing failures.

- [ ] **Step 3: Implement state authorization and producer**

Add the fixed state operation:

```text
migration-readiness-runtime-authorization <release> <web> <worker> <migrate> <postgres> <www>
```

It validates the forced boundary, empty journals, immutable release tree, exact `deploy` policy tuple, and absence of conflicting readiness evidence.

Implement the producer with a global LAS lock, root-only work directory, fixed runtime-manager and adapter paths, stable SHA-256 checks before and after off-host transfer, and same-filesystem atomic publication. Evidence contains no dotenv values or database contents, only release/digest/result metadata.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run both commands from Step 2.

Expected: exit 0; the existing verifier consumes the newly produced evidence.

- [ ] **Step 5: Commit**

```bash
git add deploy/las/bin/produce-las-migration-readiness.sh deploy/las/bin/produce-las-migration-readiness.test.sh deploy/las/bin/manage-las-release-state.sh deploy/las/bin/manage-las-release-state.test.sh
git commit -m "feat: produce durable migration readiness evidence"
```

### Task 3: Stable Bundle Binding and Production Runbook

**Files:**
- Modify: `deploy/las/bin/install-las-stable-bundle.test.sh`
- Modify: `deploy/las/bin/install-las-stable-bundle.sh`
- Modify: `deploy/las/bin/artifact-output-language-security.test.sh`
- Modify: `deploy/las/ARTIFACT-OUTPUT-LANGUAGE-RUNBOOK.md`
- Modify: `deploy/las/README.md`

**Interfaces:**
- Produces root launcher: `/usr/local/libexec/yonaris-las/produce-las-migration-readiness`.
- Preserves the production SSH grammar unchanged.

- [ ] **Step 1: Write failing installer/security tests**

Require the producer in `PROGRAMS`, `LABELS`, `ENTRYPOINT_PATHS`, exact directory listings, hash validation, immutable generation rotation, and hardlink/symlink rejection. Require the security test to prove the dispatcher never exposes the producer.

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```bash
bash deploy/las/bin/install-las-stable-bundle.test.sh
bash deploy/las/bin/artifact-output-language-security.test.sh
```

Expected: failure because the stable bundle does not include the producer.

- [ ] **Step 3: Bind the producer and update operator commands**

Add the producer to the stable bundle arrays and trust-policy hashes. Replace the runbook's “producer unavailable” blocker with the exact root-console sequence:

```bash
/usr/local/libexec/yonaris-las/produce-las-migration-readiness \
  sha-<40> sha256:<web> sha256:<worker> sha256:<migrate> sha256:<postgres> sha256:<www>
/usr/local/libexec/yonaris-las/manage-las-release-state migration-readiness \
  sha-<40> sha256:<web> sha256:<worker> sha256:<migrate> sha256:<postgres> sha256:<www>
```

Document the mandatory root-owned off-host adapter installation and its upload/download byte-equality contract.

- [ ] **Step 4: Run focused tests and syntax checks**

Run:

```bash
bash deploy/las/bin/install-las-stable-bundle.test.sh
bash deploy/las/bin/artifact-output-language-security.test.sh
bash -n deploy/las/bin/*.sh
git diff --check
```

Expected: all commands exit 0.

- [ ] **Step 5: Commit**

```bash
git add deploy/las/bin/install-las-stable-bundle.sh deploy/las/bin/install-las-stable-bundle.test.sh deploy/las/bin/artifact-output-language-security.test.sh deploy/las/ARTIFACT-OUTPUT-LANGUAGE-RUNBOOK.md deploy/las/README.md
git commit -m "docs: enable reviewed LAS migration readiness flow"
```

### Task 4: Release Verification and Production Handoff

**Files:**
- No source changes expected.

**Interfaces:**
- Consumes: reviewed stable producer commit and production root/off-host configuration.
- Produces: exact readiness verifier success and a deployable immutable release.

- [ ] **Step 1: Run the bounded LAS verification set**

Run the three focused suites from Tasks 1-3 plus `manage-las-release-state.test.sh`; do not repeat unrelated application suites already green for commit `01f256ca`.

- [ ] **Step 2: Verify repository state**

Run `git status --short`, `git diff --check`, and `git log -4 --oneline`.

Expected: clean tree, no whitespace errors, and the design plus three implementation commits present.

- [ ] **Step 3: Install and execute from production root console**

Install the reviewed stable bundle and fixed off-host adapter, run the producer and verifier with the exact registry digests emitted by the build, then perform the existing canonical predecessor/bootstrap sequence. Do not proceed if the off-host returned-copy digest differs or any journal is pending.

- [ ] **Step 4: Deploy and probe**

Push/integrate the reviewed commit through the chosen Git workflow, enable `LAS_DEPLOY_ENABLED` and `LAS_FORCED_COMMAND_ENABLED` only after the forced probe passes, deploy with Chinese writes disabled, and verify `https://portal.yonaris.com/` plus authenticated language preference, report generation, and Opportunity generation surfaces.
