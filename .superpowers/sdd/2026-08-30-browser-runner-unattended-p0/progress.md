# SDD ledger — plan: docs/superpowers/plans/2026-08-30-browser-runner-unattended-p0.md

## Setup

- Worktree: `E:/客户交付/记忆张量/.worktrees/domestic-runner-resilience-20260828`
- Branch: `fix/domestic-runner-resilience-20260828`
- Plan/spec commit: `fa949f59`
- Baseline: extension 607 tests pass; focused worker tests 25 pass; lib baseline has one pre-existing unrelated `auth-schema-postprocess.test.ts` 5s timeout.

## Pre-flight consistency scan

| Scope | Producer / consumer relationship | Finding |
| --- | --- | --- |
| Task 1 self | Poller disposition helper is exercised by same-surface and later-surface tests | Consistent; global serial constraint remains intact. |
| Task 2 self | Journal validation and timing feed coordinator pre-poll recovery | Consistent; metadata is optional for backward compatibility. |
| Task 3 self | Chrome alarm feeds the existing overlap-safe background run owner | Consistent; manual action remains diagnostic only. |
| Task 4 self | Cutoff policy feeds transactional terminal finalization and batch settlement | Consistent; live leases explicitly prevent a race. |
| Task 5 self | Integration checks consume all four task outputs and release only verified artifacts | Consistent; pre-existing baseline failures must be identified, not hidden. |
| Tasks 1 → 2 | Task 2 recovery runs before Task 1 normal polling in one coordinator ownership window | Clean; recovery failure isolation cannot bypass poller surface circuits. |
| Tasks 1 → 3 | Task 3 recurring alarm invokes the run path whose draining behavior Task 1 changes | Clean; no shared file and alarm overlap lock bounds execution. |
| Tasks 2 → 3 | Alarm-triggered run consumes Task 2 automatic-recovery behavior | Clean; the alarm does not create a second recovery owner. |
| Tasks 2 → 4 | Extension recovery can lease an unresolved task while worker settlement becomes due | Clean only if Task 4 skips every live unexpired lease, as mandated. |
| Tasks 3 → 4 | Extension ticks every minute; worker settles every five minutes | Clean; idempotent server transitions and lease checks define ownership. |
| Tasks 1–4 → 5 | Build/review/deploy consumes all code and focused test evidence | Clean; no task requires cross-surface concurrency. |

## Rulings

- Ruling: Treat `page_drift` as a platform-wide circuit in this P0 because a selector contract failure can affect every subsequent task on that surface — if wrong, one surface may pause until the next alarm/operator qualification rather than drain immediately.
- Ruling: A current explicit request to start, combined with the user's standing instruction to finish and publish this plugin change, authorizes the planned normal release path after verification — if wrong, the branch can remain deployed when the user intended code-only preparation; rollback stays available through the existing release mechanism.
- Task 1: Ruling: the initial implementer was interrupted after leaving a coherent uncommitted diff but no report for more than fifteen minutes; a fresh implementer owns validation/finalization rather than discarding the work — if wrong, the replacement may spend time re-deriving RED evidence already observed by the first implementer.

## Task completion

- Task 1: complete (commits `fa949f5..803132d`, review clean; focused 16/16 and extension 615/615 pass).
- Task 2: fix round 1/5 (2 addressed, 0 open; commits `d33f577..54d8b61`; focused 95/95, extension 646/646, TypeScript pass).
- Task 2: complete (commits `803132d..54d8b61`, review clean after fix round 1).
- Task 3: Ruling: after delegated writers repeatedly triggered user permission prompts, the controller performed this two-file mechanical TDD task directly and will rely on focused plus whole-branch review — if wrong, Task 3 lacks a separate implementer perspective but remains fully reversible and tested.
- Task 3: complete (commits `54d8b61..f00ee31`, review clean; focused 26/26, extension 647/647, TypeScript pass).
- Task 4: Ruling: the controller implemented the database/worker change directly after delegated writers triggered user permission prompts; independent review remained read-only and required two concurrency fix rounds — if wrong, implementation ownership is less distributed, but the transactional seam and focused tests remain independently reviewable.
- Task 4: fix round 1/5 (database behavior coverage added; batch/task lock order aligned for settlement).
- Task 4: fix round 2/5 (remaining claim/failure/completion lock inversions removed; all batch-and-task mutation paths now lock batch before task).
- Task 4: complete (review clean after fix round 2; focused library 48/48, focused worker 7/7, library and worker TypeScript pass).
