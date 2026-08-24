# Doubao Native-Auto and Dedicated Sampling Session Design

Date: 2026-08-13

## Decision

Yonaris will run new Doubao Browser Runner batches using an explicit `platform_default` search requirement and a `dedicated_sampling_profile` session requirement. The runner records the execution mode as `native_auto` and records actual search evidence separately as `webSearchObserved: true | false | null`.

This is a forward-only protocol. Existing `forbidden`, `anonymous_clean`, and manual batches are not migrated, reinterpreted, or completed through the new protocol.

## Why this change is required

The China-host UAT established two facts:

1. Doubao allowed the anonymous page to load but displayed a login wall when the prompt was submitted. A formal batch therefore cannot truthfully claim `anonymous_clean`.
2. Doubao may invoke web search automatically when it detects search intent. The absence of a visible source block does not prove that search was forbidden.

The failed UAT was isolated and never entered Yonaris. It is not a failed brand mention and does not affect StepFun metrics.

## Metric invariants

The Yonaris metric formula remains unchanged:

- `N`: frozen task slots in the delivery manifest.
- `S`: successful observations persisted as `prompt_runs`.
- `M`: successful observations where `brandMentioned=true`.
- Visibility remains `M / S`.
- Technical failures, login walls, CAPTCHAs, page drift, and capture failures do not create `prompt_runs`; they lower `S / N` coverage only.
- A valid answer that does not mention StepFun is persisted successfully with `brandMentioned=false` and lowers `M / S`.

`webSearchObserved` is metadata. It must not participate in Visibility, Share of Voice, or Opportunities formulas.

## Frozen search protocol

New values:

- Delivery task: `searchRequirement="platform_default"`.
- Successful runner observation: `searchMode="native_auto"`.
- Actual evidence: `webSearchObserved=true | false | null`.

Semantics:

- `true`: the approved adapter found a positive, response-scoped search-used marker.
- `false`: the approved adapter found an explicit response-scoped no-search marker.
- `null`: neither state can be proven. This is valid and must not be coerced to `false`.
- Conflicting positive and negative markers are page drift and require human review.

For compatibility, the existing non-null `webSearchEnabled` field is `true` for `native_auto`, because the platform is allowed to search. New nullable database columns retain the actual three-state observation.

## Dedicated sampling profile

`dedicated_sampling_profile` means a company-controlled account used only for sampling. It is not `anonymous_clean` and must never be presented as such.

Rules:

- A human performs the first login. The runner never enters credentials, scans a QR code, creates an account, bypasses a CAPTCHA, or changes account security settings.
- The authenticated profile is stored only on the encrypted China runner host with `0700` directories and `0600` identity markers.
- The account is not used for normal browsing, personal chats, or other customers.
- Tasks execute sequentially. Each task opens a new empty conversation and submits the frozen prompt exactly once.
- The runner validates the profile identity and the frozen task/session identity before submit or resume.
- Missing, replaced, symlinked, or mismatched profile state fails closed.
- A post-submit interruption may only recover the original answer from the same durable session. It may not resend the prompt.

## Browser and host isolation

Formal execution requires all of the following:

- Ubuntu 24.04 on the dedicated Laoxu China host.
- Chromium sandbox explicitly enabled; a launch that falls back to `--no-sandbox` is a hard failure.
- AppArmor/user-namespace policy approved for the exact Playwright Chromium binary.
- The browser cannot reach RFC1918, loopback, link-local, cloud metadata, database, Redis, Docker socket, or management networks.
- The runner control client uses a dedicated service credential. The page never receives the credential in headers, storage, JavaScript, screenshots, or traces.
- The runner remains disabled until the selector contract and China-host UAT pass.

If the existing single-process Node/Chromium layout cannot enforce different network permissions for browser and control traffic, deployment must split the control broker and browser into separate OS identities or network namespaces before formal execution.

## Adapter approval

The adapter remains fail-closed until a non-scored China-host UAT proves:

- approved Doubao top-level URL;
- unique visible composer;
- dedicated profile is logged in;
- exact new-conversation behavior;
- exactly one prompt submission;
- the new user message appears;
- a new answer node appears and reaches a verified completion state;
- full answer, citations, final URL, PNG screenshot, and HTML snapshot are captured;
- search evidence is classified as true, false, or unknown without guessing;
- no CAPTCHA or page drift is bypassed.

The approved selector contract and browser build are hashed into a versioned DOM fingerprint. Approval is specific to that fingerprint and must be repeated after material page drift.

## Formal StepFun run

After migration, deployment, host isolation, login setup, and the non-scored UAT succeed, create one new scored batch:

- Brand: StepFun.
- Program: `cn-zh-scored` (`CN / zh-CN / Asia/Shanghai`).
- Prompts: the three enabled Chinese prompts frozen in the scope.
- Surface: Doubao only.
- Samples per prompt: 6.
- Total frozen tasks: 18.
- Session: `dedicated_sampling_profile`.
- Search: `platform_default`.
- Start: explicit operator action only; no cron or daily schedule.

The final delivery is acceptable only when all 18 tasks are terminal and the result is disclosed honestly. The target is 18 succeeded tasks and 36 attached artifacts. Any terminal technical failure makes the batch `Incomplete`; it is not rewritten as a negative brand mention.

## Rollout and rollback

Rollout order:

1. Deploy the backward-compatible database and web changes with creation disabled.
2. Install and validate the updated runner on Laoxu without production credentials.
3. Configure the dedicated profile through a one-time human login.
4. Run one non-scored UAT.
5. Enable new batch creation, freeze the 18-task scored batch, and explicitly start it.
6. Verify database counts, evidence hashes, coverage, and customer UI.
7. Disable live execution and remove the service credential from Laoxu after the run.

Rollback never deletes or rewrites frozen batches, attempts, evidence, or successful observations. Application rollback may leave the additive migration in place.
