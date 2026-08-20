# Domestic Structured Snapshot v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace domestic Browser Runner provider-DOM HTML uploads with strict structured completions, one locally cropped screenshot, and server-rendered Response Snapshot v2 archives while preserving all v1 reads.

**Architecture:** The extension extracts structured facts, crops a final-state screenshot locally, uploads it under the active lease, and completes with a strict v2 observation. LAS validates the screenshot and adapter binding, persists the observation, and renders deterministic Yonaris HTML/JSON/manifest artifacts. Existing v1 files, overseas collectors, leasing, metrics, and retention remain unchanged.

**Tech Stack:** TypeScript 7, Chrome Manifest V3 APIs, Zod 4, Vitest 4, Drizzle/PostgreSQL, Node gzip/filesystem storage, TanStack Start.

**Spec:** `docs/superpowers/specs/2026-08-20-domestic-structured-snapshot-v2-design.md`

## Global Constraints

- New domestic writes use `response-snapshot.v2` and `response-snapshot-html.v2`; v1 artifacts remain byte-for-byte readable.
- v2 completion contains no `answerHtml`, DOM HTML, DOM attributes, CSS, cookies, browser storage, or credentials.
- v2 requires exactly one JPEG screenshot from the same task and lease generation, quality 82, at most 2 MiB.
- Screenshot bytes stay in evidence artifacts; the v2 manifest references immutable ID/hash/media type/size without duplicating bytes.
- Metrics use the structured observation only.
- Doubao production approval remains v7 throughout implementation; DeepSeek remains unapproved.
- Overseas providers and Google AI Overview are out of scope.
- Never stage the unrelated mode-compat workflow, migration `0026`, its metadata, or mode-compat tests.

## File Structure

- `packages/lib/src/response-snapshots/{contract,html,storage,filesystem-storage}.ts`: v1/v2 archive contract and storage compatibility.
- `packages/lib/src/browser-extension-contract.ts`: version-aware screenshot evidence policy.
- `apps/web/src/server/{sampling-observation,browser-runner-service,browser-runner-snapshot-policy}.ts`: strict v2 completion and persistence.
- `apps/browser-extension/src/coordinator/screenshot.ts`: Chrome capture/crop/JPEG enforcement.
- `apps/browser-extension/src/{api-client,coordinator/task-runner}.ts`: ordered screenshot upload and v2 completion.
- Response Snapshot customer routes/DTOs: authorized screenshot metadata and download.

---

### Task 1: Response Snapshot v2 Pure Contract

**Files:**
- Modify: `packages/lib/src/response-snapshots/contract.ts`
- Modify: `packages/lib/src/response-snapshots/html.ts`
- Modify: `packages/lib/src/response-snapshots/contract.test.ts`
- Modify: `packages/lib/src/response-snapshots/html.test.ts`

**Interfaces:**
- Produces `ResponseSnapshotVisualEvidence`.
- Produces `ResponseSnapshotDraftV2` with `schemaVersion: "response-snapshot.v2"`, required `visualEvidence`, and `answerHtml?: never`.
- Keeps existing v1 draft calls source-compatible.

- [ ] **Step 1: Write the failing v2 tests**

Use a literal draft and the real bundle builder:

```ts
const bundle = prepareResponseSnapshotBundle({
  schemaVersion: "response-snapshot.v2",
  runId: "11111111-1111-4111-8111-111111111111",
  brandId: "ppio",
  scopeId: "22222222-2222-4222-8222-222222222222",
  promptId: "33333333-3333-4333-8333-333333333333",
  promptText: "推荐适合 AI 推理的 GPU 云服务",
  answerText: "以下是可选服务。",
  citations: [{ url: "https://example.com/a", title: "Source A", domain: "example.com", citationIndex: 0 }],
  webQueries: ["GPU 云推理服务"],
  queryAvailability: "available",
  brandMentioned: false,
  competitorsMentioned: [],
  channel: "doubao",
  modelVersion: "doubao-web-20260819-localpc-v8",
  market: "CN", locale: "zh-CN", timezone: "Asia/Shanghai",
  observedAt: "2026-08-20T01:02:03.000Z",
  captureMethod: "consumer_web_browser",
  contentSource: "rendered_from_structured_response",
  visualEvidence: {
    artifactId: "44444444-4444-4444-8444-444444444444",
    mediaType: "image/jpeg",
    sha256: "a".repeat(64),
    bytes: 12345,
  },
  adapterVersion: "doubao-web-20260819-localpc-v8",
  captureDiagnostics: { answerCount: 1, queryCount: 1, citationCount: 1, completionCount: 1 },
});
const json = JSON.parse(gunzipSync(bundle.jsonGzip).toString("utf8"));
expect(json.schemaVersion).toBe("response-snapshot.v2");
expect(json).not.toHaveProperty("answerHtml");
expect(json.visualEvidence.bytes).toBe(12345);
```

Also assert rejection of missing evidence, non-JPEG media, invalid hash, zero/over-2-MiB size, wrong content source, and any v2 object containing `answerHtml`.

- [ ] **Step 2: Run and verify RED**

```powershell
pnpm.cmd --filter @workspace/lib test -- src/response-snapshots/contract.test.ts src/response-snapshots/html.test.ts
```

Expected: FAIL because the v2 draft and visual evidence do not exist.

- [ ] **Step 3: Implement the minimal discriminated contract**

```ts
export type ResponseSnapshotVisualEvidence = {
  artifactId: string;
  mediaType: "image/jpeg";
  sha256: string;
  bytes: number;
};

export type ResponseSnapshotDraftV2 = Omit<ResponseSnapshotDraft, "answerHtml" | "contentSource"> & {
  schemaVersion: "response-snapshot.v2";
  contentSource: "rendered_from_structured_response";
  visualEvidence: ResponseSnapshotVisualEvidence;
  adapterVersion: string;
  captureDiagnostics: { answerCount: 1; queryCount: number; citationCount: number; completionCount: 1 };
  answerHtml?: never;
};
```

The v2 HTML renderer accepts text and structured arrays only. Keep v1 serialization unchanged.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run the Step 2 command. Expected: PASS, including existing v1 determinism tests.

- [ ] **Step 5: Commit the slice**

```powershell
git add packages/lib/src/response-snapshots/contract.ts packages/lib/src/response-snapshots/html.ts packages/lib/src/response-snapshots/contract.test.ts packages/lib/src/response-snapshots/html.test.ts
git commit -m "feat: add structured response snapshot v2 contract"
```

### Task 2: v2 Manifest and Filesystem Compatibility

**Files:**
- Modify: `packages/lib/src/response-snapshots/storage.ts`
- Modify: `packages/lib/src/response-snapshots/filesystem-storage.ts`
- Modify: `packages/lib/src/response-snapshots/filesystem-storage.test.ts`
- Modify: `packages/lib/src/response-snapshots/service.test.ts`

**Interfaces:**
- Consumes the Task 1 bundle union.
- Produces a manifest parser for `.v1` and `.v2` while keeping the three existing stored files.

- [ ] **Step 1: Write failing v2 round-trip tests**

Store a literal v2 bundle in a temporary root; assert `put`, `head`, `get`, idempotent second `put`, and `createDownload`. Assert the parsed manifest carries the exact screenshot reference while a v1 fixture still round-trips.

- [ ] **Step 2: Run and verify RED**

```powershell
pnpm.cmd --filter @workspace/lib test -- src/response-snapshots/filesystem-storage.test.ts src/response-snapshots/service.test.ts
```

Expected: FAIL because `parseManifest` accepts only `.v1`.

- [ ] **Step 3: Implement versioned manifest parsing**

For v2, validate the external screenshot reference but do not read or copy image bytes. Preserve size caps, immutable conflict checks, and path containment.

- [ ] **Step 4: Verify GREEN and commit**

```powershell
pnpm.cmd --filter @workspace/lib test -- src/response-snapshots/filesystem-storage.test.ts src/response-snapshots/service.test.ts
git add packages/lib/src/response-snapshots/storage.ts packages/lib/src/response-snapshots/filesystem-storage.ts packages/lib/src/response-snapshots/filesystem-storage.test.ts packages/lib/src/response-snapshots/service.test.ts
git commit -m "feat: store response snapshot v2 manifests"
```

### Task 3: Strict Server Completion and Screenshot Policy

**Files:**
- Modify: `packages/lib/src/browser-extension-contract.ts`
- Modify: `packages/lib/src/browser-extension-contract.test.ts`
- Modify: `apps/web/src/server/sampling-observation.ts`
- Modify: `apps/web/src/server/sampling-observation.test.ts`
- Modify: `apps/web/src/server/browser-runner-service.ts`
- Modify: `apps/web/src/server/browser-runner-service.test.ts`
- Modify: `apps/web/src/server/browser-runner-snapshot-policy.ts`
- Modify: `apps/web/src/server/browser-runner-snapshot-policy.test.ts`

**Interfaces:**
- Produces strict `browser-runner-observation.v2`.
- Produces version-aware evidence selection: v8 requires one screenshot; legacy v7 retains one page snapshot during rollout.
- Produces `buildBrowserRunnerResponseSnapshotDraftV2`.

- [ ] **Step 1: Write failing schema/policy/service tests**

```ts
expect(() => browserRunnerStructuredObservationSchema.parse({
  schemaVersion: "browser-runner-observation.v2",
  answerText: "Answer",
  answerHtml: "<p>must be rejected</p>",
  observedAt: "2026-08-20T01:02:03.000Z",
  pageUrl: "https://www.doubao.com/chat/123",
  sessionMode: "dedicated_sampling_profile",
  searchMode: "native_auto",
  evidenceArtifactIds: [screenshotId],
  citations: [], webQueries: [],
  captureDiagnostics: { answerCount: 1, queryCount: 0, citationCount: 0, completionCount: 1 },
})).toThrow();
```

Prove v8 accepts exactly one staged JPEG, rejects page snapshots/multiple artifacts, v7 remains compatible, and screenshot metadata reaches the v2 draft before observation persistence.

- [ ] **Step 2: Run and verify RED**

```powershell
pnpm.cmd --filter @workspace/lib test -- src/browser-extension-contract.test.ts
pnpm.cmd --filter @workspace/web test -- src/server/sampling-observation.test.ts src/server/browser-runner-service.test.ts src/server/browser-runner-snapshot-policy.test.ts
```

Expected: FAIL because current completion requires `answerHtml` and current extension policy requires a page snapshot.

- [ ] **Step 3: Implement the strict union**

Use separate strict legacy and v2 schemas; do not make `answerHtml` optional on a shared schema. Choose evidence policy using exact adapter version binding. Construct v2 with `contentSource: "rendered_from_structured_response"` and the staged screenshot metadata.

- [ ] **Step 4: Verify GREEN and commit**

Run the Step 2 commands, stage only the eight Task 3 files, and commit:

```powershell
git commit -m "feat: accept structured browser runner completions"
```

### Task 4: Local Crop, JPEG, and Evidence Upload

**Files:**
- Create: `apps/browser-extension/src/coordinator/screenshot.ts`
- Create: `apps/browser-extension/src/coordinator/screenshot.test.ts`
- Modify: `apps/browser-extension/src/adapters/contracts.ts`
- Modify: `apps/browser-extension/src/adapters/consumer-adapter.ts`
- Modify: `apps/browser-extension/src/coordinator/chrome-tabs.ts`
- Modify: `apps/browser-extension/src/coordinator/chrome-tabs.test.ts`
- Modify: `apps/browser-extension/src/coordinator/test-fixture.ts`
- Modify: `apps/browser-extension/manifest.json`

**Interfaces:**
- Produces `EvidenceViewportRect = { x, y, width, height, devicePixelRatio }`.
- Produces `captureCroppedJpeg(input): Promise<Uint8Array>`.
- Extends `RunnerTab.captureEvidence(rect): Promise<Uint8Array>`.

- [ ] **Step 1: Write failing crop and safety tests**

Use a deterministic 100×80 image fixture. Assert CSS rects are clamped to the viewport and scaled by device pixel ratio, zero/outside rectangles fail, JPEG quality is 82, output starts `FF D8 FF`, and output over `2 * 1024 * 1024` fails. Assert current Prompt/answer/action-group union includes search/citation content inside the answer and excludes a sidebar rectangle.

- [ ] **Step 2: Run and verify RED**

```powershell
pnpm.cmd --filter @workspace/browser-extension test -- src/coordinator/screenshot.test.ts src/coordinator/chrome-tabs.test.ts src/adapters/doubao.test.ts
```

Expected: FAIL because screenshot capture interfaces do not exist.

- [ ] **Step 3: Implement minimal local capture**

Activate and re-verify the claimed tab, call `chrome.tabs.captureVisibleTab(windowId, { format: "jpeg", quality: 82 })`, crop through `OffscreenCanvas`, and re-verify active tab/window after capture. Add no debugger, downloads, history, cookies, or broad network permissions.

- [ ] **Step 4: Verify GREEN and commit**

```powershell
pnpm.cmd --filter @workspace/browser-extension test -- src/coordinator/screenshot.test.ts src/coordinator/chrome-tabs.test.ts src/adapters/doubao.test.ts
pnpm.cmd --filter @workspace/browser-extension check-types
pnpm.cmd --filter @workspace/browser-extension build
git add apps/browser-extension/src/coordinator/screenshot.ts apps/browser-extension/src/coordinator/screenshot.test.ts apps/browser-extension/src/adapters/contracts.ts apps/browser-extension/src/adapters/consumer-adapter.ts apps/browser-extension/src/coordinator/chrome-tabs.ts apps/browser-extension/src/coordinator/chrome-tabs.test.ts apps/browser-extension/src/coordinator/test-fixture.ts apps/browser-extension/manifest.json
git commit -m "feat: capture cropped browser runner evidence"
```

### Task 5: Extension v2 Task Flow

**Files:**
- Modify: `apps/browser-extension/src/api-client.ts`
- Modify: `apps/browser-extension/src/api-client.test.ts`
- Modify: `apps/browser-extension/src/coordinator/task-runner.ts`
- Modify: `apps/browser-extension/src/coordinator/task-runner.test.ts`
- Modify: `apps/browser-extension/src/coordinator/test-fixture.ts`
- Modify: `apps/browser-extension/src/coordinator/extension-coordinator.test.ts`

**Interfaces:**
- Replaces `uploadSnapshot(claim, html)` with `uploadEvidence(claim, screenshot)`.
- Sends `observation.schemaVersion = "browser-runner-observation.v2"` and no `answerHtml`.

- [ ] **Step 1: Write failing ordering/payload tests**

Assert the real runner event order is:

```ts
[
  "record-submit-intent", "submit", "confirm-submitted", "collect",
  "capture-screenshot", "upload-screenshot", "complete-v2", "close",
]
```

Assert the completion body has structured fields, diagnostics, one screenshot ID, and no `answerHtml`. Screenshot/crop/upload failure must not call complete and must use existing post-submit recovery without a second Prompt.

- [ ] **Step 2: Run and verify RED**

```powershell
pnpm.cmd --filter @workspace/browser-extension test -- src/api-client.test.ts src/coordinator/task-runner.test.ts src/coordinator/extension-coordinator.test.ts
```

Expected: FAIL because the runner uploads HTML and sends `answerHtml`.

- [ ] **Step 3: Implement the ordered v2 flow**

After collect, capture the answer bounds, upload JPEG with `X-Yonaris-Evidence-Kind: screenshot`, and submit its artifact ID. Delete `buildResponseSnapshotHtml` and provider-HTML upload calls from the v2 path.

- [ ] **Step 4: Verify GREEN and commit**

Run focused tests plus extension full tests/types/build. Stage only Task 5 files and commit:

```powershell
git commit -m "feat: complete domestic tasks with structured evidence"
```

### Task 6: Customer Visual Evidence Read Path

**Files:**
- Modify: `packages/lib/src/db/schema.ts`
- Create: the next sequential migration through repository migration tooling
- Modify: `packages/lib/src/db/response-snapshots.ts`
- Modify: `apps/web/src/routes/api/app/response-snapshots/-snapshot.ts`
- Modify: `apps/web/src/routes/api/app/response-snapshots/-snapshot.test.ts`
- Modify: customer Response Snapshot DTO/component files imported by that route
- Modify: `e2e/tests/response-snapshots.spec.ts`

**Interfaces:**
- Produces optional `visualEvidence` on the customer snapshot DTO.
- Produces a brand/scope-authorized screenshot download action.

- [ ] **Step 1: Write failing authorization/compatibility tests**

Create literal v1/v2 fixtures. Assert v1 returns `visualEvidence: null`; v2 returns JPEG metadata; correct membership downloads exact bytes; wrong brand/scope, expired artifact, missing attachment, and guessed artifact ID fail without leaking existence.

- [ ] **Step 2: Run and verify RED**

```powershell
pnpm.cmd --filter @workspace/web test -- src/routes/api/app/response-snapshots/-snapshot.test.ts
```

Expected: FAIL because the DTO has no visual evidence.

- [ ] **Step 3: Implement the authorized join**

Resolve only through `response_snapshots.prompt_run_id -> prompt_runs.observation_attempt_id -> evidence_artifacts.observation_attempt_id`, requiring attached screenshot and identical brand/scope. Add `view_screenshot` and `download_screenshot` access actions. Generate a new migration; do not edit unrelated migration `0026`.

- [ ] **Step 4: Verify GREEN and commit**

Run focused web/lib DB tests and the Response Snapshot E2E spec. Stage only Task 6 files and commit:

```powershell
git commit -m "feat: expose response snapshot visual evidence"
```

### Task 7: Integrated Gates Without Production Activation

**Files:**
- Modify: `e2e/tests/browser-extension-runner.spec.ts`
- Modify: `e2e/tests/response-snapshots.spec.ts`
- Do not change the approved Doubao/DeepSeek adapter versions.

**Interfaces:**
- Verifies v2 transport/archive behavior while production stays on v7.

- [ ] **Step 1: Write the failing integrated scenario**

Simulate exact v8 binding, stage one JPEG, complete structured data, and assert one observation/run, correct citations/queries, ready v2 HTML/JSON/manifest, no `answerHtml`, attached screenshot, customer authorization, and default production rejection of a real v8 claim.

- [ ] **Step 2: Run and verify RED**

```powershell
pnpm.cmd --filter @workspace/e2e check-types
pnpm.cmd exec playwright test e2e/tests/browser-extension-runner.spec.ts e2e/tests/response-snapshots.spec.ts
```

Expected: the new scenario fails at the first unwired v2 boundary.

- [ ] **Step 3: Add only missing integration wiring**

Do not flip the allowlist, package a release ZIP, create production tasks, or modify DeepSeek selectors.

- [ ] **Step 4: Run full verification**

```powershell
pnpm.cmd --filter @workspace/browser-extension test
pnpm.cmd --filter @workspace/browser-extension check-types
pnpm.cmd --filter @workspace/browser-extension build
pnpm.cmd --filter @workspace/lib test
pnpm.cmd --filter @workspace/web test
pnpm.cmd --filter @workspace/web check-types
pnpm.cmd --filter @workspace/e2e check-types
pnpm.cmd exec biome check apps/browser-extension/src apps/web/src/server packages/lib/src/response-snapshots packages/lib/src/browser-extension-contract.ts e2e/tests/browser-extension-runner.spec.ts e2e/tests/response-snapshots.spec.ts
git diff --check
```

Expected: all pass; approved Doubao remains v7; DeepSeek remains unapproved.

- [ ] **Step 5: Commit integration coverage**

```powershell
git add e2e/tests/browser-extension-runner.spec.ts e2e/tests/response-snapshots.spec.ts
git commit -m "test: verify domestic structured snapshot v2 flow"
```

### Task 8: Separate Live Qualification and Canary Runbook

**Files:**
- Create: `docs/superpowers/plans/2026-08-20-doubao-v8-live-qualification-and-canary.md`
- No production source change until the runbook is reviewed.

**Interfaces:**
- Consumes exact built extension bytes from Tasks 1–7.
- Produces qualification receipt, package SHA-256, zero-active-task gate, and 1×1 canary acceptance evidence.

- [ ] **Step 1: Bind exact artifact and selectors**

Record extension/adapter version, package SHA-256, source commit, permissions, and answer/search/query/citation/completion relationships.

- [ ] **Step 2: Define no-write qualification**

Use an existing completed Doubao conversation with zero click/fill/submit; verify structured extraction and screenshot crop bounds.

- [ ] **Step 3: Define activation/rollback**

Require zero active/claimed/needs-human/post-submit tasks, approve only the qualified v8, wait for v8 ready heartbeat, run 1 Prompt × 1 sample, verify answer/Fan-Out/Citations/JPEG/v2 snapshot, and roll back to v7 on mismatch without resubmitting.

- [ ] **Step 4: Review before remote write**

Deployment, allowlist flip, pairing, live Prompt, and production batch execution require separate explicit review.
