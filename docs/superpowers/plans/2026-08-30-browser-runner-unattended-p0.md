# Browser Runner Unattended P0 Implementation Plan

**Spec:** `docs/superpowers/specs/2026-08-30-browser-runner-unattended-p0-design.md`

**Goal:** Make a started domestic Browser Runner batch continue and settle without repeated operator clicks while preserving exact-session recovery and truthful failures.

## Global Constraints

- Keep execution globally serial in P0; do not introduce cross-surface concurrency.
- Never resend a prompt after durable submit intent. Automatic recovery is exact-task, exact-session, post-submit, and read-only.
- Technical failures create no observation or prompt run and do not count as brand non-mentions.
- Work alarm values are exactly `delayInMinutes: 0.2` and `periodInMinutes: 1`.
- Platform-wide circuit codes are exactly `signed_out`, `captcha`, `account_restricted`, `rate_limited`, and `page_drift`.
- Automatic post-submit recovery has at most two attempts, eligible after 2 minutes and then 10 minutes, with its counter and next time persisted before the attempt.
- T+1 cutoff is next calendar day at 12:00 Asia/Shanghai, capped by an earlier frozen measurement-window end; never race a live unexpired task lease.
- Preserve unrelated worktree changes and untracked operational files.
- Use test-driven development: add focused failing tests, confirm RED, implement the minimum behavior, then confirm GREEN.

## Task 1: Isolate task-local failures inside a surface

**Files:**

- Modify: `apps/browser-extension/src/coordinator/poller.ts`
- Modify: `apps/browser-extension/src/coordinator/poller.test.ts`

**Steps:**

1. Add tests proving `retry_scheduled` and task-local `needs_human` results continue to a later task on the same surface.
2. Add table tests proving each of the five platform-wide codes stops only the current surface while a later surface still drains.
3. Add an `incomplete` test proving the current surface stops for this poll and the next surface continues.
4. Run the focused test and confirm the new tests fail against the old first-error-stop implementation.
5. Introduce one pure result-disposition helper and minimally update the loop.
6. Re-run `poller.test.ts` and the full extension test suite.

## Task 2: Add bounded persisted post-submit auto-recovery

**Files:**

- Modify: `apps/browser-extension/src/contracts.ts`
- Modify: `apps/browser-extension/src/storage.ts`
- Modify: `apps/browser-extension/src/storage.test.ts`
- Modify: `apps/browser-extension/src/coordinator/journal.ts`
- Modify: `apps/browser-extension/src/coordinator/journal.test.ts`
- Modify: `apps/browser-extension/src/coordinator/extension-coordinator.ts`
- Modify: `apps/browser-extension/src/coordinator/extension-coordinator.test.ts`

**Steps:**

1. Add backward-compatible optional recovery metadata to `TaskJournalEntry` and strict storage validation for attempt count `0..2` and ISO next-at timestamps.
2. Add journal tests for the first due time at needs-human +2 minutes, persisting attempt 1 before work, scheduling attempt 2 for +10 minutes, and refusing a third attempt.
3. Add coordinator tests proving due post-submit journals use the existing recovery path, do not submit, survive a failed attempt, do not block other work, and ignore pre-submit journals.
4. Run the focused tests and confirm RED.
5. Implement journal eligibility/attempt recording and coordinator pre-poll recovery without duplicating the manual exact-session logic.
6. Re-run focused tests and the full extension suite.

## Task 3: Restore the recurring work alarm

**Files:**

- Modify: `apps/browser-extension/src/background.ts`
- Modify: `apps/browser-extension/src/background.test.ts`

**Steps:**

1. Replace the legacy-clear assertions with tests for the exact recurring work alarm values.
2. Add tests proving a work alarm calls the existing run path, an empty queue is silent, and overlapping polling/manual recovery/qualification remains a no-op.
3. Run `background.test.ts` and confirm RED.
4. Ensure the work alarm on install/startup and route it to the overlap-safe run function.
5. Re-run the focused test and full extension suite.

## Task 4: Settle unresolved domestic batches at T+1

**Files:**

- Modify or add focused Browser Runner maintenance code under `packages/lib/src/db/`
- Modify or add its focused tests under `packages/lib/src/db/`
- Add: `apps/worker/src/jobs/browser-runner-maintenance.ts`
- Add: `apps/worker/src/jobs/browser-runner-maintenance.test.ts`
- Modify: `apps/worker/src/handlers.ts`
- Modify: `apps/worker/src/index.ts`

**Steps:**

1. Add pure cutoff tests for next-day 12:00 Asia/Shanghai and the earlier measurement-window end.
2. Add database behavior tests proving successful tasks stay unchanged, unresolved tasks become canonical technical failures without prompt runs, live leases skip settlement, and repeated execution is idempotent.
3. Add worker tests for the five-minute job, advisory lock, and result logging.
4. Run focused tests and confirm RED.
5. Implement the smallest transactional finalizer by reusing existing Browser Runner terminal-failure and settlement primitives.
6. Register and schedule the maintenance job every five minutes.
7. Re-run focused library/worker tests.

## Task 5: Integrate, review, and release

**Files:** all P0 changes and release documentation only.

**Steps:**

1. Run the full extension suite, focused library/worker suites, type checks, and production builds. Record any pre-existing unrelated failure separately.
2. Review the full branch against the spec, especially duplicate-submit prevention, lease races, and technical-failure metric integrity.
3. Fix any release-blocking findings and repeat focused verification.
4. Produce the extension package and deploy the server/worker through the repository's existing release path.
5. Verify production health, worker registration, and the extension version before declaring the P0 live.
