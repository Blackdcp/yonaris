# Domestic Six-Surface Browser Runner Design

**Date:** 2026-08-21
**Status:** Approved in chat for specification
**Owner:** Yonaris

## Objective

One administrator action starts a domestic monitoring batch across six consumer-web platforms. The paired Browser Runner on the administrator's local computer executes every task sequentially, captures the result, and uploads it into Yonaris.

The six supported surfaces are, in execution order:

1. `doubao.consumer_web` — 豆包
2. `deepseek.consumer_web` — DeepSeek
3. `qwen.consumer_web` — 千问
4. `kimi.consumer_web` — Kimi
5. `wenxin.consumer_web` — 文心
6. `yuanbao.consumer_web` — 腾讯元宝

For `N` enabled prompts, one full batch contains `N × 6` delivery tasks.

## Operator Workflow

The Sampling Tasks administrator page exposes one primary action: **Run domestic six-platform monitoring**. All six surfaces are selected by default. The action creates one delivery batch and returns immediately to the batch progress view.

The local Browser Runner then:

1. claims the next available task in the fixed surface order;
2. opens or reuses the platform's dedicated browser tab;
3. verifies that the account, composer, send control, and conversation state are usable;
4. opens a new conversation and submits the exact prompt once;
5. waits for the current answer to complete;
6. collects structured evidence and an answer-bound JPEG screenshot;
7. uploads the observation and marks the task complete;
8. continues to the next task regardless of whether the previous task succeeded or failed.

Only one browser task may cross the submit boundary at a time on a device. The server queues and stores work; all consumer-site interaction happens on the paired local computer.

## Shared Surface Registry

A single shared registry is the source of truth for all six surfaces. Each entry contains:

- surface key, customer label, capture route, and launch URL;
- extension host permission and approved conversation URL rule;
- adapter version and server approval binding;
- selector contract file;
- display and polling order;
- screenshot and structured-observation protocol.

Server, web UI, extension coordinator, readiness storage, task schemas, launch URL validation, and tests consume this registry instead of maintaining independent two-surface switch statements.

The capture routes are:

- `browser_extension.doubao`
- `browser_extension.deepseek`
- `browser_extension.qwen`
- `browser_extension.kimi`
- `browser_extension.wenxin`
- `browser_extension.yuanbao`

The browser-runner device database constraint is migrated from two supported surfaces to all six.

## Adapter Architecture

All surfaces use the existing `ConsumerAdapter` state machine and `DocumentDomPort`. Each platform supplies one data-only selector contract plus a thin adapter registration. A contract defines:

- launch and conversation URLs;
- composer, send, and new-conversation controls;
- user and assistant message boundaries;
- completion and generating markers;
- login, CAPTCHA, rate-limit, and restricted-account signals;
- optional structured search block, query, citation, and disclosure selectors.

Provider-specific imperative code is permitted only when a page cannot be represented by the common contract, such as a reversible source-panel disclosure. Such hooks remain scoped to the current answer and must restore page state before screenshot capture.

## Observation Contract

Every successful task persists:

- exact prompt and answer text;
- model/surface identity and adapter version;
- `webSearchEnabled` and observed search state;
- exposed search queries in DOM order;
- citations with canonical URL and visible title;
- mention and competitor measurements derived by the server after upload;
- one bounded JPEG containing the current prompt, current answer, and bound completion controls.

The extension does not upload arbitrary raw provider HTML. Search queries or citations are recorded only when the current answer exposes verifiable DOM evidence. Missing or ambiguous evidence is represented as unavailable or as a task failure; it is never fabricated.

## Failure Isolation

Failures are task-local. Signed-out sessions, CAPTCHA, rate limiting, selector drift, response timeout, upload failure, and post-submit uncertainty are stored with an explicit failure stage and code. A failed task does not stop the batch or block another platform.

Pre-submit failures may be retried according to the existing retry policy. Post-submit uncertainty enters `needs_human` and is never submitted automatically a second time. The batch completes when every task is terminal.

## Browser Runner UI

The popup shows one row for each of the six surfaces with readiness and current-work state. It also shows a batch-level summary and the last actionable error. The existing manual Doubao read-only checker becomes a generic **Check open platform page** action selected from the active supported tab.

The device heartbeat publishes readiness for all six surfaces. A signed-out or drifting surface remains visible and does not prevent other ready surfaces from running.

## Release Strategy

The first release activates all six surfaces together. It includes shared contracts, task routing, server adapter bindings, the six-row popup, the database constraint migration, the exact packaged extension, and production deployment.

This release does not wait for six independent pre-production qualification rounds. After deployment, one prompt is run across all six surfaces as the production canary. Any selector mismatch becomes a visible task failure and is fixed per platform without reverting working surfaces. Once the six-way canary is terminal, the administrator can start the normal full prompt batch.

Existing Doubao fixes for apex-domain injection, sidebar shortcuts, current completion controls, nested-scroll search evidence, and reversible source-panel expansion are included in the same release.

## Verification

Before packaging:

- unit tests cover the shared registry and all six adapter contracts;
- coordinator tests prove global sequential execution and failure continuation;
- server tests prove six-surface task creation, claim, version binding, completion, and readiness;
- structured observation and screenshot contract tests run for every structured adapter;
- extension, library, web, worker, and E2E type checks pass;
- the extension is built deterministically and the packaged artifact hash is recorded.

After deployment:

- confirm the production database and web revision;
- install the exact packaged extension on the paired local computer;
- confirm a six-surface heartbeat;
- run one prompt across all six platforms;
- inspect answers, queries, citations, screenshots, and failure records in Yonaris;
- repair provider-specific selector drift, then run the full batch.

## Non-Goals

- Running consumer-site browsers on the production server.
- Parallel prompt submission across local tabs.
- Fabricating Fan-Out or citation data when a provider does not expose it.
- Capturing the entire browser window, account sidebar, or unrelated conversations.
- Replacing the existing overseas provider execution system.
