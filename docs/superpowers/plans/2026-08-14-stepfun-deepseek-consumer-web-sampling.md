# StepFun DeepSeek Consumer-Web Sampling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Capture and publish one exact, comparable StepFun DeepSeek consumer-web cohort of three frozen prompts times six independent conversations, without changing Elmo metrics or enabling recurring execution.

**Architecture:** Add a local-PC-only DeepSeek capture path beside, but not inside, the production Doubao Browser Runner. It creates a reviewed immutable manifest, then a request-gated production operation validates and imports all 18 observations atomically into the existing `cn-zh-scored` scope as `model=deepseek`, `surfaceTargetKey=deepseek.consumer_web`, and `captureRouteKey=assisted_browser.generic`.

**Tech Stack:** TypeScript 7, Node.js 22, Playwright 1.61, Drizzle ORM/PostgreSQL, Node test runner through `tsx --test`, Bash, GitHub Actions, existing Yonaris observation/metric tables.

## Global Constraints

- Brand is exactly `stepfun`; scope is exactly `cn-zh-scored` with `CN`, `zh-CN`, `Asia/Shanghai`, and `scored` lane.
- Prompts are verbatim: `国内有哪些主流大模型公司？`, `国内有哪些大模型服务商？`, `阶跃星辰 StepFun 是一家什么公司？`.
- The cohort contains exactly six independent new conversations per prompt and exactly 18 valid completed observations.
- Public channel is `deepseek`; target is `deepseek.consumer_web`; capture route is `assisted_browser.generic`.
- Authentication, if required, uses a dedicated local DeepSeek sampling profile; credentials, cookies, storage state, QR codes, and phone numbers never enter manifests, logs, screenshots, Git, or production.
- Search uses the product default: `searchMode=native_auto`; `webSearchObserved` is `true` only with positive evidence, `false` only with an explicit no-search marker, otherwise `null`.
- Before durable submit intent, only a clearly transient navigation failure may retry once. After intent, automatic resend is forbidden; recovery uses the same retained conversation/profile.
- Technical failures never create `prompt_runs`. A valid answer without StepFun is successful and persists `brandMentioned=false`.
- Elmo Visibility, Share of Voice, Query Fan-Out, citation, opportunity, and report formulas are unchanged.
- The existing Doubao 18-run cohort and its repair-only importer are not modified by the DeepSeek import.
- Execution is foreground and explicit. No cron, timer, daily batch creator, long-running poller, or production DeepSeek Browser Runner service is added.
- Production import is request-gated, exact-manifest, idempotent, all-or-nothing, and verified before commit.

---

## File Map

- `apps/browser-runner/src/deepseek-capture-contract.ts`: frozen prompt/slot contract, reviewed-manifest types, strict parser, fingerprint and safe public summary.
- `apps/browser-runner/src/deepseek-capture-contract.test.ts`: exact 3×6, URL, evidence, secret-redaction, and duplicate-slot tests.
- `apps/browser-runner/src/adapters/deepseek-live.ts`: fail-closed DeepSeek page adapter and current-answer/search/citation extraction.
- `apps/browser-runner/src/adapters/deepseek-live.test.ts`: local HTML fixture tests for controls, completion, isolation, error states, and search tri-state.
- `apps/browser-runner/src/deepseek-local-capture.ts`: local login, read-only selector probe, one-prompt UAT, and exact-cohort foreground orchestration.
- `apps/browser-runner/src/deepseek-local-capture.test.ts`: exactly-once journal, retry boundary, UAT gate, incomplete cohort, and manifest assembly tests.
- `apps/browser-runner/src/deepseek-cli.ts`: CLI parsing and stdout-only redacted receipts.
- `apps/browser-runner/package.json`: `deepseek` command and new test files.
- `apps/worker/src/reviewed-consumer-cohort-policy.ts`: production-side immutable manifest parser and exact StepFun DeepSeek contract.
- `apps/worker/src/reviewed-consumer-cohort-policy.test.ts`: schema, identity, 3×6, URL, citation, query, and fingerprint tests.
- `apps/worker/src/import-reviewed-consumer-cohort.ts`: dry-run and atomic production import.
- `apps/worker/src/import-reviewed-consumer-cohort.test.ts`: transaction-plan/idempotency/postcondition policy tests.
- `apps/worker/package.json`: `import:consumer-cohort` command and test registration.
- `apps/worker/src/consumer-cohort-imports/stepfun-local-pc-deepseek-18-20260814.json`: generated only after the real 18-run capture is complete and reviewed.
- `deploy/las/bin/run-consumer-cohort-import.sh`: immutable-image dry-run/apply wrapper with redacted receipts and locking.
- `deploy/las/bin/run-consumer-cohort-import.test.sh`: wrapper contract and secret-output tests.
- `deploy/las/consumer-cohort-imports/README.md`: request lifecycle and operator recovery.
- `deploy/las/consumer-cohort-imports/request.example.json`: inert example outside `requests/`.
- `deploy/las/consumer-cohort-imports/workflow-static.test.sh`: workflow request-gate assertions.
- `.github/workflows/deploy-las.yaml`: request planner and post-deploy import job.

---

### Task 1: Freeze and validate the DeepSeek capture contract

**Files:**
- Create: `apps/browser-runner/src/deepseek-capture-contract.ts`
- Create: `apps/browser-runner/src/deepseek-capture-contract.test.ts`
- Modify: `apps/browser-runner/package.json`

**Interfaces:**
- Produces: `STEPFUN_DEEPSEEK_PROMPTS`, `DeepSeekSlot`, `DeepSeekCapturedObservation`, `DeepSeekReviewedManifest`, `buildDeepSeekSlots()`, `parseDeepSeekReviewedManifest(value)`, and `deepSeekManifestFingerprint(manifest)`.
- `buildDeepSeekSlots(): readonly DeepSeekSlot[]` returns exactly 18 values in sample-major order with IDs `stepfun-local-pc-deepseek-20260814-01-p1-s1` through `...-18-p3-s6`.
- `parseDeepSeekReviewedManifest(value: unknown): DeepSeekReviewedManifest` accepts only the global contract above and strips unknown properties by reconstructing the returned object.

- [ ] **Step 1: Write failing contract tests**

```ts
import assert from "node:assert/strict";
import test from "node:test";
import {
  STEPFUN_DEEPSEEK_PROMPTS,
  buildDeepSeekSlots,
  parseDeepSeekReviewedManifest,
} from "./deepseek-capture-contract.js";

test("freezes the exact StepFun 3 by 6 DeepSeek matrix", () => {
  const slots = buildDeepSeekSlots();
  assert.equal(slots.length, 18);
  assert.deepEqual(STEPFUN_DEEPSEEK_PROMPTS, [
    "国内有哪些主流大模型公司？",
    "国内有哪些大模型服务商？",
    "阶跃星辰 StepFun 是一家什么公司？",
  ]);
  assert.deepEqual(new Set(slots.map(({ promptIndex, sampleIndex }) => `${promptIndex}:${sampleIndex}`)).size, 18);
});

test("rejects duplicate slots, non-DeepSeek URLs, missing evidence digests and secret-shaped fields", () => {
  assert.throws(() => parseDeepSeekReviewedManifest(invalidManifest), /exact reviewed 3 by 6 cohort/);
});
```

- [ ] **Step 2: Run the new test to verify RED**

Run: `pnpm --filter @workspace/browser-runner exec tsx --test src/deepseek-capture-contract.test.ts`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `deepseek-capture-contract.js`.

- [ ] **Step 3: Implement the strict contract**

```ts
export const STEPFUN_DEEPSEEK_PROMPTS = [
  "国内有哪些主流大模型公司？",
  "国内有哪些大模型服务商？",
  "阶跃星辰 StepFun 是一家什么公司？",
] as const;

export type DeepSeekCapturedObservation = {
  externalId: string;
  promptIndex: 1 | 2 | 3;
  sampleIndex: 1 | 2 | 3 | 4 | 5 | 6;
  promptText: string;
  answerText: string;
  observedAt: string;
  pageUrl: string;
  webSearchObserved: boolean | null;
  webQueries: string[];
  citations: Array<{ url: string; title: string; citationIndex: number }>;
  evidence: {
    screenshotSha256: string;
    pageSnapshotSha256: string;
  };
};
```

The parser must require `schemaVersion=1`, `importId=stepfun-local-pc-deepseek-18-20260814`, `brandId=stepfun`, `scopeKey=cn-zh-scored`, `model=deepseek`, `surfaceTargetKey=deepseek.consumer_web`, `captureRouteKey=assisted_browser.generic`, `sessionMode=dedicated_sampling_profile`, `searchMode=native_auto`, and exactly 18 unique slots. Conversation URLs must be clean HTTPS URLs on `chat.deepseek.com`; citation URLs must be HTTP(S); evidence SHA-256 values must be 64 lowercase hex characters. Reject object keys matching `/password|token|cookie|storage|phone|authorization/i` recursively.

- [ ] **Step 4: Run targeted tests and type-check**

Run: `pnpm --filter @workspace/browser-runner exec tsx --test src/deepseek-capture-contract.test.ts`

Expected: PASS.

Run: `pnpm --filter @workspace/browser-runner check-types`

Expected: exit 0.

- [ ] **Step 5: Register the test and commit**

```bash
git add apps/browser-runner/src/deepseek-capture-contract.ts apps/browser-runner/src/deepseek-capture-contract.test.ts apps/browser-runner/package.json
git commit -m "feat: freeze DeepSeek sampling contract"
```

---

### Task 2: Build the fail-closed DeepSeek page adapter

**Files:**
- Create: `apps/browser-runner/src/adapters/deepseek-live.ts`
- Create: `apps/browser-runner/src/adapters/deepseek-live.test.ts`
- Modify: `apps/browser-runner/package.json`

**Interfaces:**
- Consumes: `DeepSeekSlot` and `DeepSeekCapturedObservation` from Task 1.
- Produces: `DeepSeekSelectorContract`, `DeepSeekLiveSession`, `classifyDeepSeekPage(page)`, `classifyDeepSeekSearch({usedCount,notUsedCount})`, and `extractDeepSeekResponse(page, selectorContract)`.
- `DeepSeekLiveSession` exposes `openBlankConversation()`, `prepare()`, `submitOnce(prompt, onIntent)`, `confirmSubmission(prompt)`, `collectResponse()`, `captureEvidence()`, and `close()`.

- [ ] **Step 1: Add deterministic HTML-fixture tests**

Create fixtures in the test body with `page.setContent()` and cover:

Use explicit fixtures named `READY_HTML`, `LOGIN_HTML`, `CAPTCHA_HTML`, `RATE_LIMIT_HTML`, `TWO_COMPOSERS_HTML`, `TWO_ANSWERS_HTML`, `SEARCH_USED_HTML`, `SEARCH_NOT_USED_HTML`, `SEARCH_UNKNOWN_HTML`, and `SEARCH_CONFLICT_HTML`. Assert zero calls to the injected `submitAction` for all blocking fixtures, and assert the event sequence is exactly `["intent", "submit", "confirm"]` for `READY_HTML`.

```ts
test("maps reviewed search evidence without inventing false", () => {
  assert.equal(classifyDeepSeekSearch({ usedCount: 1, notUsedCount: 0 }), true);
  assert.equal(classifyDeepSeekSearch({ usedCount: 0, notUsedCount: 1 }), false);
  assert.equal(classifyDeepSeekSearch({ usedCount: 0, notUsedCount: 0 }), null);
  assert.throws(
    () => classifyDeepSeekSearch({ usedCount: 1, notUsedCount: 1 }),
    /page_drift/,
  );
});
```

- [ ] **Step 2: Run the adapter test to verify RED**

Run: `pnpm --filter @workspace/browser-runner exec tsx --test src/adapters/deepseek-live.test.ts`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `deepseek-live.js`.

- [ ] **Step 3: Implement the adapter with injected, reviewed selectors**

```ts
export type DeepSeekSelectorContract = {
  version: string;
  composer: string;
  send: string;
  newConversation: string;
  userMessage: string;
  answer: string;
  generating: string;
  loginWall: string;
  captcha: string;
  rateLimit: string;
  searchUsed: string | null;
  searchNotUsed: string | null;
  citationLink: string | null;
  queryItem: string | null;
};
```

Validate every selector as native CSS, at most 500 characters, and unique where it represents an action. Never use generic `button[type=submit]`, unrestricted `contenteditable`, longest-text fallback, or text guessing. Require the generating marker to be observed and later absent, then require the newest answer to remain unchanged for at least eight seconds. Keep the top-level origin exactly `https://chat.deepseek.com` and reject credentials, non-default ports, redirects off host, login walls, CAPTCHA, rate limits, and ambiguous controls.

- [ ] **Step 4: Run targeted adapter tests**

Run: `pnpm --filter @workspace/browser-runner exec tsx --test src/adapters/deepseek-live.test.ts`

Expected: all adapter fixture tests PASS and no real network request occurs.

- [ ] **Step 5: Run the Browser Runner suite and commit**

Run: `pnpm --filter @workspace/browser-runner test`

Expected: all non-POSIX tests pass; POSIX permission tests may be skipped on Windows only.

```bash
git add apps/browser-runner/src/adapters/deepseek-live.ts apps/browser-runner/src/adapters/deepseek-live.test.ts apps/browser-runner/package.json
git commit -m "feat: add DeepSeek consumer web adapter"
```

---

### Task 3: Add local UAT and exact 18-run foreground capture

**Files:**
- Create: `apps/browser-runner/src/deepseek-local-capture.ts`
- Create: `apps/browser-runner/src/deepseek-local-capture.test.ts`
- Create: `apps/browser-runner/src/deepseek-cli.ts`
- Modify: `apps/browser-runner/package.json`
- Modify: `apps/browser-runner/README.md`

**Interfaces:**
- Consumes: Task 1 slot/manifest types and Task 2 `DeepSeekLiveSession`.
- Produces: `runDeepSeekUat(options)`, `runDeepSeekCohort(options)`, and CLI commands `login-window`, `probe-selectors`, `uat-once`, and `run-cohort`.
- The cohort runner writes private per-slot journals/evidence under the explicit `--state-dir` and writes a reviewed manifest only when all 18 slots are valid.

- [ ] **Step 1: Write orchestration RED tests with an in-memory fake session**

Define a test-only `RecordingDeepSeekSessionFactory` implementing the Task 2 session interface. It accepts a map from external ID to the exact outcomes `success`, `pre_submit_navigation_once`, or `post_submit_unknown`, and exposes immutable counters for blank conversations, intents, submissions, confirmations, and collected answers.

```ts
test("never resubmits after a durable intent", async () => {
  const sessions = new RecordingDeepSeekSessionFactory({
    "stepfun-local-pc-deepseek-20260814-01-p1-s1": "post_submit_unknown",
  });
  const receipt = await runDeepSeekCohort(validOptions({ sessions }));
  assert.equal(sessions.intentCount, 1);
  assert.equal(sessions.submitCount, 1);
  assert.equal(receipt.status, "incomplete");
  assert.equal(receipt.needsHuman, 1);
  assert.equal(receipt.manifestPath, null);
});
```

Add separate assertions that a successful factory records 18 blank conversations, 18 intents, 18 submissions, and 18 answers; one pre-submit navigation error causes two opens but one submission for that slot; a missing/mismatched UAT fingerprint rejects before opening a page; and `JSON.stringify(publicReceipt)` contains none of the 3 prompts, answers, profile paths, `password`, `token`, `cookie`, or `storage`.

- [ ] **Step 2: Run orchestration tests to verify RED**

Run: `pnpm --filter @workspace/browser-runner exec tsx --test src/deepseek-local-capture.test.ts`

Expected: FAIL because `deepseek-local-capture.js` is missing.

- [ ] **Step 3: Implement the foreground workflow**

Use an append-only private journal with events `slot_started`, `submit_intent`, `prompt_submitted`, `response_captured`, `needs_human`, and `cohort_completed`; store only prompt SHA-256 in the journal. Use `O_EXCL` plus `fsync` for intent. A UAT marker must contain the selector-contract SHA-256, browser major, successful test timestamp, and dedicated-profile identity hash; it must not contain prompt/answer text or session data.

`run-cohort` must refuse to start if the UAT marker is absent/mismatched, if an existing slot has an unresolved post-intent state, or if the output manifest path already exists with a different fingerprint. It may resume only untouched pre-submit slots and same-session post-submit recovery; it may not delete an intent marker to retry.

- [ ] **Step 4: Add CLI parsing and safe receipts**

```json
{
  "status": "complete",
  "planned": 18,
  "captured": 18,
  "needsHuman": 0,
  "manifestFingerprint": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "manifestPath": "C:\\reviewed-output\\stepfun-local-pc-deepseek-18-20260814.json"
}
```

The fingerprint in this example is test-fixture data only; real output is always computed from the canonical reviewed manifest.

The only headed command that may collect a login is `login-window`; it performs no automated input and never prints page content. `probe-selectors` is read-only. `uat-once` submits the fixed non-scored text `请仅回复：测试通过。` at most once per fresh UAT marker. `run-cohort` is foreground and exits after this cohort.

- [ ] **Step 5: Run tests, type-check, and build**

Run: `pnpm --filter @workspace/browser-runner test`

Expected: all tests pass.

Run: `pnpm --filter @workspace/browser-runner check-types`

Expected: exit 0.

Run: `pnpm --filter @workspace/browser-runner build`

Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add apps/browser-runner/src/deepseek-local-capture.ts apps/browser-runner/src/deepseek-local-capture.test.ts apps/browser-runner/src/deepseek-cli.ts apps/browser-runner/package.json apps/browser-runner/README.md
git commit -m "feat: add one-shot DeepSeek capture workflow"
```

---

### Task 4: Validate the reviewed production manifest independently

**Files:**
- Create: `apps/worker/src/reviewed-consumer-cohort-policy.ts`
- Create: `apps/worker/src/reviewed-consumer-cohort-policy.test.ts`
- Modify: `apps/worker/package.json`

**Interfaces:**
- Produces: `parseReviewedConsumerCohort(value)`, `assertReviewedConsumerCohortSet(observations)`, `reviewedConsumerCohortFingerprint(manifest)`, `buildReviewedConsumerSourceKey(observation)`, and `assertNoConsumerCohortSecrets(value)`.
- The worker parser is independent of the Browser Runner parser so compromised/local capture code cannot weaken production validation.

- [ ] **Step 1: Write worker-side RED tests**

Cover exact literals, exact prompt texts, `3×6`, exact external IDs, unique source keys, durable DeepSeek conversation URLs, nonempty valid answers, nullable search observation, contiguous citations, HTTP(S) query/citation details, SHA-256 evidence digests, no secret-shaped keys, and rejection of a 19th row.

```ts
test("rejects a manifest that can mutate the Doubao cohort", () => {
  assert.throws(
    () => parseReviewedConsumerCohort({ ...VALID, model: "doubao" }),
    /DeepSeek contract/,
  );
});
```

- [ ] **Step 2: Run to verify RED**

Run: `pnpm --filter @workspace/worker exec tsx --test src/reviewed-consumer-cohort-policy.test.ts`

Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement an exact reconstructed DTO parser**

Do not import the local Browser Runner parser. Recompute the canonical JSON fingerprint inside the worker, reject unknown top-level and observation properties, reject answers equal to their prompts, and cap answer length at 500,000 characters, queries at 32 per run, citations at 100 per run, query/title at 2,000 characters, and URL at 10,000 characters.

- [ ] **Step 4: Run worker tests and type-check**

Run: `pnpm --filter @workspace/worker exec tsx --test src/reviewed-consumer-cohort-policy.test.ts`

Expected: PASS.

Run: `pnpm --filter @workspace/worker check-types`

Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add apps/worker/src/reviewed-consumer-cohort-policy.ts apps/worker/src/reviewed-consumer-cohort-policy.test.ts apps/worker/package.json
git commit -m "feat: validate reviewed consumer cohorts"
```

---

### Task 5: Import all 18 DeepSeek observations in one transaction

**Files:**
- Create: `apps/worker/src/reviewed-consumer-cohort-import-policy.ts`
- Create: `apps/worker/src/reviewed-consumer-cohort-import-policy.test.ts`
- Create: `apps/worker/src/import-reviewed-consumer-cohort.ts`
- Modify: `apps/worker/package.json`

**Interfaces:**
- Consumes: `parseReviewedConsumerCohort()` and the existing schema tables `measurementScopes`, `prompts`, `observationAttempts`, `promptRuns`, and `citations`.
- Produces: `buildReviewedConsumerImportPlan(input)`, `assertReviewedConsumerPostcondition(input)`, and CLI `pnpm --filter @workspace/worker import:consumer-cohort -- --request-file MANIFEST_PATH [--apply]`.
- Receipt is `{status,total,inserted,unchanged,diagnostic,manifestFingerprint}` and never includes answer text, URLs, prompts, credentials, or DB identifiers.

- [ ] **Step 1: Write import policy RED tests**

```ts
test("rejects partial or extra existing cohorts", () => {
  assert.throws(
    () => buildReviewedConsumerImportPlan({ manifest: VALID_MANIFEST, existing: VALID_EXISTING.slice(0, 17) }),
    /partial existing cohort/,
  );
  assert.throws(
    () => buildReviewedConsumerImportPlan({ manifest: VALID_MANIFEST, existing: [...VALID_EXISTING, EXTRA_DEEPSEEK_RUN] }),
    /extra DeepSeek run/,
  );
});

test("keeps Doubao outside the DeepSeek write set", () => {
  const plan = buildReviewedConsumerImportPlan({ manifest: VALID_MANIFEST, existing: VALID_EXISTING });
  assert.equal(plan.actions.some((action) => action.model === "doubao"), false);
  assert.equal(plan.unchanged, 18);
});
```

- [ ] **Step 2: Run to verify RED**

Run: `pnpm --filter @workspace/worker exec tsx --test src/reviewed-consumer-cohort-import-policy.test.ts`

Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement the pure import plan and postcondition checks**

An existing cohort is valid only when all 18 attempts and runs exist, every identity and stored manifest fingerprint matches, and all answer/search/query/citation fields match. A zero-row cohort may be inserted. Any partial or mismatched cohort fails before mutation.

- [ ] **Step 4: Implement dry-run and atomic apply**

The CLI must parse and hash the full file before connecting. `--apply` opens one transaction, acquires `pg_advisory_xact_lock(hashtext('reviewed-consumer-cohort:stepfun-local-pc-deepseek-18-20260814'))`, locks the exact brand/scope/prompts/import rows, validates the complete pre-state, then inserts 18 attempts, 18 prompt runs, and all citations. Derive `brandMentioned` with the existing mention analyzer and persist `webSearchEnabled=true`, `webSearchObserved` as the manifest tri-state, `provider=consumer_web`, `version=deepseek-consumer-web-20260814`, and capture metadata containing only the reviewed provenance/fingerprint.

Before commit, query by exact import ID/provider/version and assert: 18 succeeded attempts, 18 runs, 3 prompt IDs, manifest-specific query total, citation total, and derived brand-mention total. Any failure rolls back the transaction. Do not change the default scope and do not update/delete any Doubao row.

- [ ] **Step 5: Prove transaction rollback and idempotency with repository tests**

Use a fake transaction gateway that records planned writes and throws before postcondition. Assert zero committed writes. Then run the same exact manifest twice: first receipt `inserted=18, unchanged=0`; second receipt `inserted=0, unchanged=18`.

- [ ] **Step 6: Run full worker verification**

Run: `pnpm --filter @workspace/worker test`

Expected: all worker tests pass.

Run: `pnpm --filter @workspace/worker check-types`

Expected: exit 0.

- [ ] **Step 7: Commit**

```bash
git add apps/worker/src/reviewed-consumer-cohort-import-policy.ts apps/worker/src/reviewed-consumer-cohort-import-policy.test.ts apps/worker/src/import-reviewed-consumer-cohort.ts apps/worker/package.json
git commit -m "feat: atomically import reviewed consumer cohorts"
```

---

### Task 6: Add a request-gated production import operation

**Files:**
- Create: `deploy/las/bin/run-consumer-cohort-import.sh`
- Create: `deploy/las/bin/run-consumer-cohort-import.test.sh`
- Create: `deploy/las/consumer-cohort-imports/README.md`
- Create: `deploy/las/consumer-cohort-imports/request.example.json`
- Create: `deploy/las/consumer-cohort-imports/workflow-static.test.sh`
- Modify: `.github/workflows/deploy-las.yaml`

**Interfaces:**
- Request schema is exactly `{schemaVersion:1,operation:"import-reviewed-consumer-cohort",requestId:"stepfun-local-pc-deepseek-18-20260814",manifestPath:"apps/worker/src/consumer-cohort-imports/stepfun-local-pc-deepseek-18-20260814.json",manifestFingerprint:FINGERPRINT}`, where `FINGERPRINT` is the exact canonical 64-lowercase-hex value returned by both validators.
- Wrapper accepts positional arguments named `RELEASE_TAG` and `REQUEST_PATH`: `run-consumer-cohort-import.sh RELEASE_TAG REQUEST_PATH`.

- [ ] **Step 1: Write shell and workflow static RED tests**

The tests must assert: no request means the job is skipped; more than one request fails planning; request filename and exact JSON are checked before SSH; the remote checkout SHA equals `RELEASE_SHA`; the wrapper holds its own lock; dry-run occurs before apply; raw stdout/stderr go to a `0600` temporary file; only numeric/fingerprint diagnostics reach logs; and the temp file is deleted by an EXIT trap.

- [ ] **Step 2: Run to verify RED**

Run: `bash deploy/las/bin/run-consumer-cohort-import.test.sh`

Expected: FAIL because the wrapper is missing.

Run: `bash deploy/las/consumer-cohort-imports/workflow-static.test.sh`

Expected: FAIL because the workflow planner/job is missing.

- [ ] **Step 3: Implement the wrapper**

The wrapper must resolve the request and manifest inside the immutable checkout, reject symlinks/non-regular files, confirm the request fingerprint equals the worker dry-run fingerprint, then use the deployed `account-ops` image with the exact release tag. Apply only after the dry-run receipt reports 18 valid observations.

- [ ] **Step 4: Implement the workflow request plan and execution job**

Add `consumer_cohort_import_plan` and `consumer-cohort-import`. The execution job needs `deploy` success, a single approved request, the production environment, the existing SSH secret setup, the source deployment lock, exact source SHA verification, and the wrapper command. Keep `requests/` absent until Task 8.

- [ ] **Step 5: Run shell/static checks**

Run: `bash -n deploy/las/bin/run-consumer-cohort-import.sh`

Expected: exit 0.

Run: `bash deploy/las/bin/run-consumer-cohort-import.test.sh`

Expected: PASS.

Run: `bash deploy/las/consumer-cohort-imports/workflow-static.test.sh`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add .github/workflows/deploy-las.yaml deploy/las/bin/run-consumer-cohort-import.sh deploy/las/bin/run-consumer-cohort-import.test.sh deploy/las/consumer-cohort-imports/README.md deploy/las/consumer-cohort-imports/request.example.json deploy/las/consumer-cohort-imports/workflow-static.test.sh
git commit -m "feat: gate reviewed cohort imports"
```

---

### Task 7: Perform the real local DeepSeek UAT and capture 18 observations

**Files:**
- Create after successful capture: `apps/worker/src/consumer-cohort-imports/stepfun-local-pc-deepseek-18-20260814.json`
- Keep private/untracked: operator profile, screenshots, HTML snapshots, journals, and login state under a dedicated state directory outside Git.

**Interfaces:**
- Consumes: the `deepseek` CLI from Task 3.
- Produces: the immutable reviewed manifest accepted by both independent parsers.

- [ ] **Step 1: Create a fresh private state directory and open the login window**

Run on the local PC with an explicit absolute state path:

```powershell
pnpm --filter @workspace/browser-runner deepseek -- login-window --state-dir C:\Users\user\AppData\Local\Yonaris\DeepSeekSampling
```

Expected: a headed Chromium window opens `https://chat.deepseek.com`; the command performs no automated login input and prints no page content.

- [ ] **Step 2: Complete login manually only if DeepSeek requires it**

The operator enters the dedicated account in that browser window. No credential is pasted into Codex, terminal, source code, manifest, or logs.

- [ ] **Step 3: Run the read-only selector probe**

```powershell
pnpm --filter @workspace/browser-runner deepseek -- probe-selectors --state-dir C:\Users\user\AppData\Local\Yonaris\DeepSeekSampling
```

Expected: a redacted JSON report containing counts/booleans and selector candidates only; zero prompt submissions.

- [ ] **Step 4: Approve the selector contract in local environment configuration and run one non-scored UAT**

```powershell
pnpm --filter @workspace/browser-runner deepseek -- uat-once --state-dir C:\Users\user\AppData\Local\Yonaris\DeepSeekSampling
```

Expected: exactly one `请仅回复：测试通过。` submission, a completed answer, screenshot/page snapshot, and a durable UAT marker bound to the selector fingerprint. If it reaches login/CAPTCHA/rate-limit/page-drift or uncertain post-submit state, stop; do not delete the intent or resend.

- [ ] **Step 5: Run the exact 18-slot cohort in the foreground**

```powershell
pnpm --filter @workspace/browser-runner deepseek -- run-cohort --state-dir C:\Users\user\AppData\Local\Yonaris\DeepSeekSampling --output E:\Yonaris\elmo-release-20260811\apps\worker\src\consumer-cohort-imports\stepfun-local-pc-deepseek-18-20260814.json
```

Expected: `planned=18`, `captured=18`, `needsHuman=0`; exactly 18 user submissions; a new blank conversation before every submission; no daily process left running.

- [ ] **Step 6: Independently validate the real manifest and evidence**

Run: `pnpm --filter @workspace/browser-runner exec tsx src/deepseek-cli.ts validate-manifest --file apps/worker/src/consumer-cohort-imports/stepfun-local-pc-deepseek-18-20260814.json`

Expected: exact 18-slot fingerprint receipt.

Run: `pnpm --filter @workspace/worker import:consumer-cohort -- --request-file apps/worker/src/consumer-cohort-imports/stepfun-local-pc-deepseek-18-20260814.json`

Expected: dry-run reports exact DeepSeek contract and 18 valid rows without connecting to production or mutating a DB.

- [ ] **Step 7: Review quality without changing source answers**

Check that every answer is nonempty and not a prompt echo, all conversation URLs are durable DeepSeek URLs, citations/queries are scoped to the current answer, search unknowns remain `null`, and all evidence digests match local files. Mark a bad slot needs-human and recover the same conversation; never edit an answer to improve StepFun visibility.

- [ ] **Step 8: Commit only the reviewed manifest**

```bash
git add apps/worker/src/consumer-cohort-imports/stepfun-local-pc-deepseek-18-20260814.json
git commit -m "data: add reviewed StepFun DeepSeek cohort"
```

---

### Task 8: Import and verify the cohort in production

**Files:**
- Create: `deploy/las/consumer-cohort-imports/requests/stepfun-local-pc-deepseek-18-20260814.json`
- Remove after confirmed production success: the same request file.

**Interfaces:**
- Consumes: immutable reviewed manifest and request-gated workflow.
- Produces: 18 production `prompt_runs` plus citations/query details under `model=deepseek` and a verified customer model filter.

- [ ] **Step 1: Run the complete local release gate**

Run: `pnpm --filter @workspace/browser-runner test`

Run: `pnpm --filter @workspace/browser-runner check-types`

Run: `pnpm --filter @workspace/worker test`

Run: `pnpm --filter @workspace/worker check-types`

Run: `pnpm --filter @workspace/web test`

Run: `pnpm --filter @workspace/web check-types`

Run: `git diff --check`

Expected: all commands pass; only documented Windows POSIX permission skips are allowed.

- [ ] **Step 2: Add the exact request using the manifest fingerprint**

```json
{
  "schemaVersion": 1,
  "operation": "import-reviewed-consumer-cohort",
  "requestId": "stepfun-local-pc-deepseek-18-20260814",
  "manifestPath": "apps/worker/src/consumer-cohort-imports/stepfun-local-pc-deepseek-18-20260814.json",
  "manifestFingerprint": "$FINGERPRINT_FROM_BOTH_VALIDATORS"
}
```

`$FINGERPRINT_FROM_BOTH_VALIDATORS` denotes the runtime value copied verbatim from the two successful validation receipts; the JSON file contains that 64-character value, not the dollar-prefixed name. It is not hand-computed or truncated.

- [ ] **Step 3: Commit and push the approved one-shot request**

```bash
git add deploy/las/consumer-cohort-imports/requests/stepfun-local-pc-deepseek-18-20260814.json
git commit -m "ops: import StepFun DeepSeek cohort"
git push origin release/yonaris-20260811:main
```

- [ ] **Step 4: Monitor the exact deployment SHA to terminal success**

Require green image builds, migration/mode smoke, unit tests, Storybook, Playwright, Bruno, sampling, worker processing, immutable production deploy, worker health, import dry-run, and import apply. The import receipt must report 18 DeepSeek rows and the manifest-specific query/citation/mention totals. Do not claim success if deployment is skipped or only the image builds pass.

- [ ] **Step 5: Verify production data read-only**

Verify model-specific DB diagnostics for `stepfun`, `cn-zh-scored`, and `deepseek`: exactly 18 runs, exactly three prompts, six samples per prompt, correct query/citation totals, no extra import IDs, and the existing Doubao totals unchanged. Then verify the customer UI exposes `All models`, `Doubao`, and `DeepSeek` and that Visibility, Share of Voice, Query Fan-Out, Citations, and prompt details respond to the DeepSeek filter.

- [ ] **Step 6: Remove the one-shot request and confirm no recurring execution remains**

```bash
git rm deploy/las/consumer-cohort-imports/requests/stepfun-local-pc-deepseek-18-20260814.json
git commit -m "ops: retire completed DeepSeek import request"
git push origin release/yonaris-20260811:main
```

Verify the next workflow plans `has_request=false`; no cron, poller, DeepSeek service, or additional prompt run is created. The manifest remains as the immutable reviewed data record.

---

## Final Verification Checklist

- [ ] `git status --short` contains no staged or tracked private profile/evidence files.
- [ ] Browser Runner and worker test/type-check/build gates are green.
- [ ] Exactly 18 real DeepSeek conversations were submitted; the UAT prompt is excluded from scored data.
- [ ] Every scored row has a valid answer, durable DeepSeek URL, actual search tri-state, and matching evidence digests.
- [ ] Technical failures, retries before submit, and human-handling records created no negative `prompt_runs`.
- [ ] Production import is either all 18 or zero; an exact rerun is unchanged; partial/mismatched cohorts fail closed.
- [ ] Doubao remains 18 runs with 48 queries and 271 citations after the DeepSeek import.
- [ ] Elmo formulas have no diff and model filtering separates Doubao from DeepSeek.
- [ ] The production request is retired and there is no recurring DeepSeek execution.
