# Browser Runner Unattended P0 Design

## Objective

Turn the domestic Browser Runner from an administrator-driven macro into a bounded unattended collector. After an administrator starts one scored batch, a paired and signed-in Chrome device should keep pulling work, isolate recoverable task failures, recover already-submitted answers without resending prompts, and settle the batch by the next-day cutoff even when some platforms remain unavailable.

The operating target for this release is not `70/70` at any cost. It is truthful, automatically settled data with no duplicated prompts and no single stalled platform blocking the other observations.

This design supersedes the administrator-only, one-error-stop portions of `2026-08-18-domestic-runner-recovery-design.md`. Its durable-submit and evidence-integrity rules remain binding.

## Scope

P0 includes four changes:

1. the extension service worker wakes every minute and checks for work while paired;
2. task-scoped failures no longer stop later tasks on the same surface, while platform-wide failures still open a circuit for that surface;
3. post-submit tasks receive two bounded, persisted, read-only recovery attempts in their original conversation;
4. the worker settles unresolved domestic Browser Runner batches at T+1 12:00 Asia/Shanghai, or at the measurement-window end when that is earlier.

Cross-surface parallel execution, automatic batch creation, operator notifications, and a redesigned exception console are deliberately out of scope for this P0. The existing global serial execution stays in place to avoid changing account-risk characteristics in the same release.

## Non-negotiable data rules

- A prompt is sent at most once per task after durable submit intent exists.
- Automatic post-submit recovery calls only the existing exact-task, exact-session recovery path. It must never call `submitOnce` or create a new conversation.
- A valid completed answer creates the normal observation, prompt run, sanitized answer HTML, canonical JSON, and visual evidence records.
- A technical failure creates no observation and no prompt run. It reduces coverage but must not become a brand non-mention.
- Existing successful observations are never rewritten when the batch settles.
- No timestamps, screenshots, HTML, or customer-visible evidence are backdated or fabricated.

## 1. Automatic work polling

The extension owns a `browser-runner-work` Chrome alarm with `delayInMinutes: 0.2` and `periodInMinutes: 1`. Installation/startup continues to ensure the heartbeat alarm and now also ensures the work alarm instead of clearing it as legacy state.

When the alarm fires, it calls the same coordinator entry point as `Check for work now`. The existing background-level ownership lock remains authoritative: if polling, manual recovery, or live qualification already owns the runner, the alarm is a no-op. An empty queue is a normal result and creates no notification.

The manual button remains available as an immediate diagnostic trigger, but normal collection must not depend on it.

## 2. Failure isolation and surface circuits

Execution remains serial across surfaces and within a surface. After each task result, the poller applies this disposition:

- `succeeded`: continue claiming the same surface;
- `retry_scheduled`: continue claiming; the server retry policy controls when that task is eligible again;
- `needs_human` with `response_timeout`, `post_submit_unknown`, `durable_submit_intent_requires_resume`, evidence/capture/upload/recovery errors, or any other unclassified task-local code: leave the journal for recovery and continue claiming later tasks on the same surface;
- `needs_human` with `signed_out`, `captcha`, `account_restricted`, `rate_limited`, or `page_drift`: open the circuit and stop this surface for the current poll; later surfaces still run;
- `incomplete`: stop this surface for the current poll to avoid a tight loop around an unknown local failure; the next work alarm retries the surface. Later surfaces still run.

The existing maximum of 100 claims per surface per poll remains as a hard loop bound. `rate_limited` also keeps the existing adaptive pool backoff.

## 3. Bounded post-submit recovery

The durable journal stores optional recovery metadata on each task:

- automatic recovery attempt count, constrained to `0..2`;
- the next eligible recovery time as an ISO timestamp.

Old journal entries without these fields remain valid and behave as zero attempts.

A task is automatically recoverable only when its journal is `needs_human` and its interrupted phase is `submit_intent`, `submitted`, `collected`, or `uploaded`. Pre-submit tasks, signed-out/captcha/account-restriction cases, terminal server tasks, and mismatched task/session identities are not automatically resubmitted or rebound.

Recovery attempt 1 becomes eligible two minutes after the journal entered `needs_human`. If it does not complete, attempt 2 becomes eligible ten minutes after attempt 1. The attempt counter and next eligible time are persisted before contacting the Portal, so a service-worker restart cannot create an infinite recovery loop. After two attempts the exact task remains visible for manual diagnosis until server settlement.

The coordinator runs due recoveries before claiming new work. One failed recovery must not abort other due recoveries or normal polling. A successful recovery removes the durable journal through the existing completion path.

## 4. T+1 truthful settlement

Worker maintenance runs every five minutes under an advisory lock. It finds domestic `browser_runner` batches whose automation started before the cutoff:

- normal cutoff: 12:00 Asia/Shanghai on the calendar day after `automationStartedAt`;
- effective cutoff: the earlier of that timestamp and the frozen measurement-window end.

Before settlement it reconciles expired leases. If any task still has a live unexpired claim, the worker skips that batch until the next maintenance tick rather than racing the device.

All remaining unresolved tasks become canonical technical terminal failures. Existing `needs_human` error codes and reasons are preserved; unresolved queued/available work receives `daily_cutoff_unresolved`. The worker records the normal terminal-failure/audit trail, runs the existing batch settlement calculation, and leaves completed successes unchanged.

The operation is idempotent: a settled batch is not changed on later ticks, and two workers cannot finalize the same batch concurrently.

## Operator experience after P0

The administrator starts the batch once. A paired Chrome device with logged-in platform tabs runs unattended. The operator intervenes only for login, CAPTCHA, account restriction, or confirmed page drift. If those conditions are not fixed, the batch still freezes truthfully by T+1 12:00 and reports reduced coverage instead of staying indefinitely in progress.

## Verification

The release must prove all of the following with focused tests before build/deploy:

- startup creates both alarms and the work alarm invokes polling without overlapping an active owner;
- a task-local retry/needs-human result does not prevent a later same-surface task from succeeding;
- the five platform-wide codes stop only their current surface;
- post-submit recovery never invokes submit, is delayed 2 minutes then 10 minutes, survives storage reload, and stops after two attempts;
- pre-submit journals are never automatically recovered;
- T+1 settlement preserves successes, writes no prompt run for failures, skips live leases, is idempotent, and respects the earlier measurement-window end;
- extension tests, focused library/worker tests, type checks, and production builds pass, apart from explicitly recorded pre-existing baseline failures.
