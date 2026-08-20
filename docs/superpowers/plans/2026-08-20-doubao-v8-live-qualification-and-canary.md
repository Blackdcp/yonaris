# Doubao v8 Live Qualification and 1×1 Canary Runbook

## Purpose

Qualify and activate the structured Doubao Browser Runner without uploading provider DOM HTML. The candidate sends only structured observation fields plus one locally cropped JPEG of the current task region. DeepSeek stays unapproved throughout this runbook.

This runbook does not authorize a production task until the read-only qualification, exact-package binding, empty-queue gate, and activation deployment have all passed.

## Fixed evidence boundary

The screenshot must contain only the current task union:

- the submitted Prompt;
- the final answer, including search and citation cards inside that answer;
- the completion/action group bound to that answer.

It must exclude sidebar/history, account controls, composer/input, unrelated turns, page chrome, and any other conversation. Full answer retention comes from structured JSON and Yonaris-rendered HTML; the screenshot records only the visible viewport intersection of the approved task union.

## Stage 0 — Freeze the candidate

Before opening Doubao, record:

- source commit SHA;
- extension version and manifest version;
- Doubao adapter version `doubao-web-20260819-localpc-v8`;
- selector-contract file SHA-256;
- built ZIP SHA-256 and byte size;
- every ZIP entry name and digest;
- host permissions and extension permissions;
- production server allowlist (must still approve v7 here);
- DeepSeek approval (must remain absent).

Rebuild from a clean worktree. Any source, generated bundle, manifest, readiness migration, or selector change invalidates the receipt and requires a new package plus a new live qualification.

## Stage 1 — Zero-write read-only qualification

Use an existing completed Doubao conversation. Do not click, fill, submit, expand a source card, create a task, or call a provider.

The extension must verify, on the exact packaged bytes:

1. the live URL is one exact approved conversation URL before and after preflight;
2. there is exactly one current answer candidate;
3. the current Prompt and answer belong to the same turn;
4. the answer has no visible generating marker;
5. the completion/action group is proven to belong to that answer using a live-qualified group selector and strict relationship, not a generic descendant wrapper;
6. the search summary count exactly equals the final deduplicated query and citation counts;
7. every citation has visible text and an approved canonical HTTP(S) URL;
8. structured `answerText`, queries, citations, and diagnostics contain no provider HTML;
9. the evidence rectangle contains the fixed task union and excludes the sidebar, composer, other turns, and account chrome;
10. local JPEG crop is valid, at most 2 MiB, and its recorded hash matches the bytes;
11. the page DOM and URL are unchanged after inspection.

Save a qualification receipt containing counts, selectors, structural relationships, crop coordinates, device pixel ratio, JPEG hash/size, before/after URL, timestamp, browser version, package hash, and `click/fill/submit = 0`.

Fail closed and keep v8 `unavailable` for any ambiguity, drift, missing visible title, duplicate completion marker, count mismatch, hidden-text ambiguity, URL change, or screenshot-boundary violation.

## Stage 2 — Adversarial browser probes

Run the reviewed Chromium fixture matrix against the exact candidate bundle. It must preserve visible content and reject hidden evidence for at least:

- CSS visibility, opacity, transparent text/fill/stroke/shadow, content visibility, masks, filters, and fully collapsed clip paths;
- overflow and paint-containment clipping, transformed clipping ancestors, offscreen insets, and viewport scrolling;
- `display: contents`, line breaks, paragraphs, lists, tables, preformatted text, and multi-rect text nodes;
- comments and non-element/non-text nodes;
- hidden citation links and over-limit URLs;
- backface-hidden and degenerate path combinations;
- mixed visible/hidden text ranges without uploading the hidden portion.

Any unresolved case that can add invisible text/URLs to structured output, or remove visible answer text while still completing successfully, blocks activation.

## Stage 3 — Empty-queue activation gate

Immediately before changing the server allowlist, verify read-only production state:

- no Doubao task is `available`, `claimed`, `needs_human`, or post-submit;
- no active Doubao delivery batch can allocate work;
- no stale v7 lease or manual-recovery journal can resume;
- the target device reports v8 locally qualified but is not yet an effective ready surface under the v7 server allowlist;
- the candidate source/ZIP/package hashes still match Stage 0.

Do not press **Work Now** during deployment or rolling restart.

## Stage 4 — Minimal activation change

The activation change must be limited to:

- change Doubao's approved adapter from v7 to exact v8;
- update approval assertions and E2E fixtures to send the explicit v8 adapter version;
- keep the v7 omission-window code unchanged so it automatically stops applying when approved version is not v7;
- keep DeepSeek unapproved;
- keep claim, resume, heartbeat, submit-intent, submit-confirmed, and completion adapter binding mandatory.

Do not combine activation with selector edits, migration changes, unrelated UI work, historical deletion, or a new task batch.

After deployment, require a successful device heartbeat that projects exact v8 as ready before creating any task.

## Stage 5 — One-Prompt, one-sample canary

Create one dedicated scored canary Program with one Prompt and one Doubao sample. No other surface or sample is included.

Acceptance requires all of the following:

- exactly one task and one observation attempt;
- exactly one `prompt_run` and one current ready `response_snapshot`;
- exactly one attached JPEG screenshot for the same task, lease generation, observation attempt, brand, and Scope;
- snapshot schema `response-snapshot.v2` and template `response-snapshot-html.v2`;
- no `answerHtml` in completion, JSON, manifest, raw output, or evidence upload;
- structured Prompt, answer, search state, queries, citations, and counts match the live completed answer;
- JPEG SHA-256, byte size, and magic bytes match storage;
- customer identity can view/download the JPEG through the snapshot route;
- cross-brand, wrong-Scope, anonymous, expired, missing, duplicate, and guessed evidence access fail closed;
- screenshot view/download access audit events are present;
- Fan-Out and Citations pages reflect only the canary's structured values;
- no second Prompt submission occurred during retry/recovery.

Stop after this one task and review the receipt before authorizing a larger cohort.

## Rollback

Rollback is triggered by any adapter drift, task-region crop error, hidden/private data in structured output, count mismatch, screenshot mismatch, duplicate observation, customer authorization leak, or post-submit recovery anomaly.

1. Mark the local Doubao surface unavailable and confirm the unavailable heartbeat on the server.
2. Stop new work allocation; do not cancel a post-submit task until its durable state is inspected.
3. Revert the Doubao server approval from v8 to v7.
4. Confirm omitted/v7/v8 claim and resume behavior matches the restored policy.
5. Preserve the failed canary's structured receipt and JPEG for incident analysis; do not rerun the Prompt automatically.
6. Any fix changes package bytes, so rebuild, rehash, and restart from Stage 0.

## Explicit non-goals

- no full-page screenshot;
- no provider raw HTML upload;
- no DeepSeek activation;
- no production bulk run;
- no historical-record deletion;
- no Google AI Overview execution or paid-provider call.
