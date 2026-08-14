# Unified Response Snapshot Archive Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为国内 Browser Runner 与海外 Bright Data 的每个成功 `prompt_run` 生成统一、只读、可校验的回答快照；HTML/JSON 在生产 LAS 独立目录压缩保存 90 天，客户只能读取自己品牌，并可按日期范围导出，同时保持 Elmo 所有指标公式和失败口径不变。

**Architecture:** 采集器只负责提供统一 `ResponseSnapshotDraft`。现有回答事务继续作为指标事实源，并在同一事务内预留一个 `pending` 快照记录；快照 bundle 在事务外构建，压缩后进入有严格大小与 24 小时 TTL 的 PostgreSQL outbox，再由同进程立即 flush 或维护任务重试到 `FilesystemResponseSnapshotStorage`。文件成功原子落盘后才把快照置为 `ready` 并删除 outbox。任何快照失败都不会回滚成功回答、重问 AI 或改变 M/S。客户 API 只按 snapshot UUID 查询并再次校验 brand 权限，永远不接受外部传入的 storage key。

**Tech Stack:** TypeScript 7, Node.js 24, Drizzle ORM/PostgreSQL 16, TanStack Start/React 19, Vitest, Node test runner, `linkedom`, gzip, Docker Compose, Bash, existing Yonaris worker/Browser Runner/Bright Data integrations.

## Global Constraints

- 不修改 `apps/web/src/lib/postgres-read.ts`、`apps/web/src/server/visibility.ts`、`apps/web/src/server/analysis.ts` 或 `packages/lib/src/report-metrics.ts` 的指标公式。
- 只有成功的 `prompt_run` 才能有快照。技术失败没有 `prompt_run`，也不能生成空快照。
- 快照状态与业务指标独立：`pending | ready | failed | expired` 都不能改变 `brandMentioned`、citations、queries、coverage 或 SoV。
- 国内沿用 Browser Runner；海外沿用 Bright Data Dataset/SERP，不切换为海外浏览器。
- 客户标准产物只有回答 HTML、规范 JSON 与 manifest；当前 Browser Runner 原始截图/page snapshot 继续作为短期内部执行证据，不进入客户标准快照。
- HTML 必须服务端清洗；禁止脚本、iframe、form、object、embed、可执行 SVG、事件属性、远程样式/字体/图片与主动网络请求。
- 存储根目录默认 `/var/lib/yonaris/response-snapshots/v1`，位于 release、Git 工作树和容器可写层之外；目录 `0700`、文件 `0600`，拒绝 symlink 和路径穿越。
- 标准保留期固定 90 天。70% 磁盘使用率告警；80% 时在提交 Prompt 之前暂停新的快照型任务，已获得的回答仍可收尾。
- outbox 只作为短期恢复材料：单快照压缩后最多 8 MiB，24 小时后仍无法落盘则删除 payload 并将快照标记为 `failed`；后续只能从已保存 run 重建，不能重问平台。
- 当前 StepFun 历史数据只能标记 `reconstructed_from_historical_run`，不能冒充当时保存的原生 HTML。
- 生产上线顺序固定为 migration -> web/worker 兼容代码 -> LAS 目录与挂载 -> feature enable -> StepFun backfill；滚动部署期间旧代码不能读取未迁移字段。
- 本期不增加原平台像素级截图、原站完整页面取证、Kodo 写入或任何付费截图套餐。

---

## File Map

### Shared contract and storage

- `packages/lib/src/response-snapshots/contract.ts`: v1 draft、canonical JSON、content source、hash/size contract。
- `packages/lib/src/response-snapshots/html.ts`: answer-only HTML sanitization and deterministic fallback renderer。
- `packages/lib/src/response-snapshots/storage.ts`: `ResponseSnapshotStorage` interface and backend selection。
- `packages/lib/src/response-snapshots/filesystem-storage.ts`: safe LAS filesystem implementation。
- Corresponding `*.test.ts` files: deterministic serialization, sanitization, atomic writes, symlink/path attacks, idempotency。
- `packages/lib/package.json`: explicit server-only exports。

### Database and orchestration

- `packages/lib/src/db/schema.ts`: snapshot revision, outbox, and access audit tables。
- `packages/lib/src/db/migrations/0022_response_snapshot_archive.sql` and `meta/*`: rolling-compatible migration。
- `packages/lib/src/db/response-snapshots.ts`: reserve/enqueue/claim/ready/fail/expire/query operations。
- `packages/lib/src/db/observations.ts`: optional pending snapshot reservation in the existing successful-answer transaction。
- `packages/lib/src/response-snapshots/service.ts`: prepare, enqueue, immediate flush, retry, and reconstruction orchestration。

### Capture integrations

- `packages/lib/src/providers/types.ts`: optional snapshot source on `ScrapeResult`。
- `packages/lib/src/providers/registry/brightdata.ts`: retain answer HTML before trimming provider payload。
- `packages/lib/src/providers/registry/brightdata.test.ts`: native HTML and structured fallback cases。
- `apps/worker/src/jobs/process-prompt.ts`: pre-submit capacity gate, snapshot reservation, post-persist enqueue/flush boundary。
- `apps/browser-runner/src/contracts.ts`, `broker-protocol.ts`, `remote-client.ts`: answer-container HTML transport。
- `apps/browser-runner/src/adapters/doubao-live.ts`, `deepseek-live.ts`: current answer container `outerHTML` extraction only。
- `apps/web/src/server/sampling-observation.ts`, `browser-runner-service.ts`: validate answer HTML and queue the standard snapshot after successful run persistence。

### Customer product

- `apps/web/src/server/response-snapshots.ts`: brand-scoped metadata/query service。
- `apps/web/src/routes/api/app/response-snapshots/$snapshotId.ts`: secure HTML/JSON/manifest view/download route。
- `apps/web/src/routes/api/app/response-snapshots/export.ts`: bounded streaming export for one customer brand/date range。
- `apps/web/src/server/customer-data-dto.ts`, `prompts.ts`: minimal snapshot status in prompt-run DTO。
- `apps/web/src/components/response-snapshot-panel.tsx`: common read-only viewer/download UI。
- `apps/web/src/routes/_authed/app/$brand/prompts/$promptId.tsx`: snapshot entry from each LLM response card。

### Maintenance and LAS operations

- `apps/worker/src/jobs/response-snapshot-maintenance.ts`: retry, expiry, orphan cleanup, telemetry。
- `apps/worker/src/handlers.ts`, `index.ts`, `package.json`: queue registration and tests。
- `apps/worker/src/backfill-response-snapshots.ts`: dry-run-first historical reconstruction/export CLI。
- `deploy/las/compose.yaml`, `env.example`, `bin/deploy.sh`: persistent host mount and release gates。
- `deploy/las/bin/prepare-response-snapshot-storage.sh`: root-owned host setup。
- `deploy/las/bin/check-response-snapshot-storage.sh`: read-only capacity/hash/status preflight。
- `deploy/las/bin/export-response-snapshots.sh`: operator-side verified copy/export helper。
- `deploy/las/RESPONSE-SNAPSHOT-RUNBOOK.md`: retention, backup, restore, capacity, migration and incident runbook。

---

### Task 1: Freeze the v1 snapshot contract and HTML safety boundary

**Files:**
- Create: `packages/lib/src/response-snapshots/contract.ts`
- Create: `packages/lib/src/response-snapshots/contract.test.ts`
- Create: `packages/lib/src/response-snapshots/html.ts`
- Create: `packages/lib/src/response-snapshots/html.test.ts`
- Modify: `packages/lib/package.json`

**Interfaces:**

```ts
export type ResponseSnapshotContentSource =
  | "native_answer_html"
  | "browser_answer_html"
  | "rendered_from_structured_response"
  | "reconstructed_from_historical_run";

export type ResponseSnapshotDraft = {
  runId: string;
  brandId: string;
  scopeId: string | null;
  promptId: string;
  promptText: string;
  answerText: string;
  answerHtml?: string;
  citations: Array<{ url: string; title: string | null; domain: string; citationIndex: number }>;
  webQueries: string[];
  queryAvailability: "available" | "unavailable" | "not_applicable";
  brandMentioned: boolean;
  competitorsMentioned: string[];
  channel: string;
  modelVersion: string;
  market: string;
  locale: string;
  timezone: string;
  observedAt: string;
  captureMethod: "brightdata_dataset" | "brightdata_serp" | "consumer_web_browser" | "historical_reconstruction";
  contentSource: ResponseSnapshotContentSource;
  sourcePayloadSha256?: string;
};
```

- [ ] **Step 1: Write RED contract tests**

Cover stable UTF-8 serialization, deterministic property ordering, NFKC-preserved user content, distinct HTML/JSON/manifest hashes, query `unavailable` not becoming `[]`, and new revision on changed content.

```ts
it("serializes the same semantic snapshot byte-for-byte", () => {
  const first = prepareResponseSnapshotBundle(validDraft());
  const second = prepareResponseSnapshotBundle(reorderedValidDraft());
  expect(first.jsonSha256).toBe(second.jsonSha256);
  expect(first.manifestSha256).toBe(second.manifestSha256);
});
```

- [ ] **Step 2: Run RED**

Run: `pnpm --filter @workspace/lib exec vitest run src/response-snapshots/contract.test.ts src/response-snapshots/html.test.ts`

Expected: FAIL because the modules do not exist.

- [ ] **Step 3: Implement strict normalization and deterministic bundle generation**

Use an explicit field-by-field object constructor; never canonicalize arbitrary provider objects. Encode JSON as UTF-8 with one trailing newline, render a complete static HTML document, gzip HTML/JSON independently, then build a small uncompressed `manifest.json` referencing both hashes and sizes. Enforce pre-compression caps: answer text 500,000 chars, answer HTML 4 MiB UTF-8, JSON 4 MiB, and total gzip payload 8 MiB.

- [ ] **Step 4: Implement allowlist HTML sanitization**

Parse with `linkedom`; retain only text and approved answer tags such as `p`, headings, `ul/ol/li`, `blockquote`, `pre/code`, `table` structure, `strong/em`, `br`, and `a[href]`. Rebuild nodes and attributes rather than mutating unknown markup. Keep only public HTTP(S) links with `rel="noopener noreferrer nofollow"`; remove inline style, class, id, `src`, `srcset`, `style`, SVG, MathML, comments and every `on*` attribute. Fallback HTML must use the same template and escaped structured content.

- [ ] **Step 5: Run GREEN and full lib tests**

Run: `pnpm --filter @workspace/lib exec vitest run src/response-snapshots/contract.test.ts src/response-snapshots/html.test.ts`

Run: `pnpm --filter @workspace/lib test`

Run: `pnpm --filter @workspace/lib exec tsc --noEmit`

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add packages/lib/src/response-snapshots packages/lib/package.json
git commit -m "feat: define response snapshot contract"
```

---

### Task 2: Add rolling-compatible snapshot metadata, revisions, outbox and audit schema

**Files:**
- Modify: `packages/lib/src/db/schema.ts`
- Create: `packages/lib/src/db/migrations/0022_response_snapshot_archive.sql`
- Create: `packages/lib/src/db/migrations/meta/0022_snapshot.json`
- Modify: `packages/lib/src/db/migrations/meta/_journal.json`
- Create: `packages/lib/src/db/response-snapshots.schema.test.ts`

**Schema:**

- `response_snapshots`: one immutable revision row with `promptRunId`, `brandId`, nullable `scopeId`, `promptId`, positive `revision`, `isCurrent`, `status`, nullable backend/key until ready, source/capture/schema/template identifiers, hashes, original/compressed byte counts, failure code, created/ready/failed/expires timestamps.
- Unique `(prompt_run_id, revision)` and partial unique current revision per `prompt_run_id`.
- Ready rows require backend/key/all hashes/sizes/`readyAt`; failed rows require stable `failureCode`; expired rows retain hashes/metadata but no readable storage contract.
- `response_snapshot_outbox`: one row per pending revision with three bounded bytea payloads, retry count, next attempt, created/expiry timestamps; total payload check at 8 MiB.
- `response_snapshot_access_events`: snapshot, brand, actor user ID, `view_html | download_html | download_json | download_manifest | export`, timestamp. It stores no storage key, URL query or response content.

- [ ] **Step 1: Write RED schema tests**

Assert unique current revision, ready-state completeness, 8 MiB outbox check, `expiresAt = observedAt + 90 days` input policy, and foreign-key linkage to run/brand/scope/prompt.

- [ ] **Step 2: Generate migration and verify RED/GREEN**

Implement schema first, then run the repository migration generator according to the existing Drizzle workflow. Review the SQL manually: only additive enums/tables/indexes/FKs/checks; no prompt-run update or destructive backfill.

Run: `pnpm --filter @workspace/lib exec drizzle-kit check`

Run: `pnpm --filter @workspace/lib exec vitest run src/db/response-snapshots.schema.test.ts`

Expected: pass and `Everything's fine`.

- [ ] **Step 3: Add migration smoke coverage**

Extend the existing deploy migration smoke path so both empty database and seeded 0021 database advance to 0022. The test must prove existing prompt runs and Elmo aggregate inputs remain byte-for-byte unchanged.

- [ ] **Step 4: Commit**

```bash
git add packages/lib/src/db/schema.ts packages/lib/src/db/migrations packages/lib/src/db/response-snapshots.schema.test.ts
git commit -m "feat: add response snapshot archive schema"
```

---

### Task 3: Implement the filesystem storage adapter

**Files:**
- Create: `packages/lib/src/response-snapshots/storage.ts`
- Create: `packages/lib/src/response-snapshots/filesystem-storage.ts`
- Create: `packages/lib/src/response-snapshots/filesystem-storage.test.ts`
- Modify: `packages/lib/package.json`

**Interfaces:**

```ts
export interface ResponseSnapshotStorage {
  put(bundle: PreparedResponseSnapshotBundle): Promise<StoredResponseSnapshot>;
  get(storageKey: string, asset: "html" | "json" | "manifest"): Promise<ResponseSnapshotAsset>;
  head(storageKey: string): Promise<StoredResponseSnapshot | null>;
  delete(storageKey: string): Promise<void>;
  createDownload(storageKey: string, asset: "html" | "json" | "manifest"): Promise<ResponseSnapshotDownload>;
}
```

- [ ] **Step 1: Write RED filesystem tests**

Use `mkdtemp`. Cover `0700/0600`, same-filesystem temp files, file `fsync`, atomic rename, parent directory `fsync`, idempotent identical put, hash conflict, partial write cleanup, missing parent, root `/` rejection, `..`, absolute-key injection, symlink root/intermediate leaf, and sibling-attempt safety.

- [ ] **Step 2: Run RED**

Run: `pnpm --filter @workspace/lib exec vitest run src/response-snapshots/filesystem-storage.test.ts`

Expected: FAIL because the adapter does not exist.

- [ ] **Step 3: Implement storage**

Generate the key internally from validated IDs and UTC observed month:

```text
<brand-id>/<yyyy>/<mm>/<run-id>/r<revision>/
```

Only the adapter converts that opaque key to a path. Use `lstat` on every existing component, reject symbolic links, open temporary files with exclusive create, write and fsync all three files, rename HTML/JSON first and manifest last, then fsync the revision directory. `head()` validates manifest hashes and sizes before returning ready.

- [ ] **Step 4: Run GREEN on Windows and Linux**

Run the targeted suite locally; add the permission/symlink assertions to Linux CI where Windows cannot prove POSIX mode semantics.

- [ ] **Step 5: Commit**

```bash
git add packages/lib/src/response-snapshots/storage.ts packages/lib/src/response-snapshots/filesystem-storage.ts packages/lib/src/response-snapshots/filesystem-storage.test.ts packages/lib/package.json
git commit -m "feat: store response snapshots on filesystem"
```

---

### Task 4: Build reservation, outbox and failure-safe flush orchestration

**Files:**
- Create: `packages/lib/src/db/response-snapshots.ts`
- Create: `packages/lib/src/db/response-snapshots.test.ts`
- Create: `packages/lib/src/response-snapshots/service.ts`
- Create: `packages/lib/src/response-snapshots/service.test.ts`
- Modify: `packages/lib/src/db/observations.ts`
- Modify: `packages/lib/src/db/observations.persistence.test.ts`
- Modify: `packages/lib/package.json`

**Interfaces:**

```ts
type SnapshotReservation = { snapshotId: string; revision: number; expiresAt: Date };

reserveResponseSnapshotInTransaction(tx, runIdentity): Promise<SnapshotReservation>;
enqueuePreparedResponseSnapshot(reservation, bundle): Promise<void>;
flushResponseSnapshot(snapshotId, storage): Promise<"ready" | "already_ready" | "retry_later">;
flushPendingResponseSnapshots({ limit, storage }): Promise<FlushReceipt>;
expireResponseSnapshots({ before, limit, storage }): Promise<ExpiryReceipt>;
```

- [ ] **Step 1: Write RED state-machine tests**

Cover pending reservation in the same successful-answer transaction, exact-one reservation per run, enqueue idempotency by hashes, conflicting content creating revision 2 instead of overwriting revision 1, `FOR UPDATE SKIP LOCKED` worker claims, file success before DB ready, file failure retaining outbox, outbox TTL -> failed, expiry delete -> expired, and deletion failure -> still inaccessible but retryable.

- [ ] **Step 2: Add an optional reservation to successful observation persistence**

`persistSuccessfulObservation` receives `reserveResponseSnapshot?: boolean`. When true it creates the prompt run and one empty `pending` revision in the existing DB transaction and returns `snapshotReservation`. It does not serialize HTML, gzip data or touch the filesystem inside that transaction.

```ts
type PersistSuccessfulObservationResult = {
  id: string;
  createdAt: Date;
  evidenceRefs: EvidenceArtifactReference[];
  snapshotReservation: SnapshotReservation | null;
};
```

The metric transaction test must prove a reservation rollback follows the run rollback, while later file/outbox failures cannot mutate the already-succeeded attempt/run.

- [ ] **Step 3: Implement prepare/enqueue/flush boundaries**

Callers pass the in-memory draft only after `persistSuccessfulObservation` succeeds. `recordResponseSnapshot()` catches contract/sanitization failures, stores a stable failed code where possible, and never throws back into observation failure handling. Immediate flush is best effort; maintenance owns durable retries. A pending row with no outbox for more than five minutes is rebuilt from the stored run as a new `reconstructed_from_historical_run` revision, never by querying the AI channel.

- [ ] **Step 4: Run GREEN**

Run: `pnpm --filter @workspace/lib exec vitest run src/db/response-snapshots.test.ts src/response-snapshots/service.test.ts src/db/observations.persistence.test.ts`

Run: `pnpm --filter @workspace/lib test`

Run: `pnpm --filter @workspace/lib exec tsc --noEmit`

- [ ] **Step 5: Commit**

```bash
git add packages/lib/src/db/response-snapshots* packages/lib/src/response-snapshots/service* packages/lib/src/db/observations* packages/lib/package.json
git commit -m "feat: queue and flush response snapshots"
```

---

### Task 5: Preserve Bright Data answer HTML and create overseas snapshots

**Files:**
- Modify: `packages/lib/src/providers/types.ts`
- Modify: `packages/lib/src/providers/registry/brightdata.ts`
- Create: `packages/lib/src/providers/registry/brightdata.test.ts`
- Create: `apps/worker/src/jobs/process-prompt-snapshot-policy.ts`
- Create: `apps/worker/src/jobs/process-prompt-snapshot-policy.test.ts`
- Modify: `apps/worker/src/jobs/process-prompt.ts`
- Modify: `apps/worker/package.json`

- [ ] **Step 1: Write RED provider tests**

Extract a pure `toBrightDataScrapeResult(payload, options)` seam. Fixtures must prove:

- `answer_html` wins over `answer_section_html` and is tagged `native_answer_html`.
- `answer_section_html` is accepted when `answer_html` is absent.
- `response_raw` is not assumed to be safe HTML.
- no native HTML produces `rendered_from_structured_response` while retaining the exact answer/citations/query availability.
- the large HTML field remains absent from customer `rawOutput` and is available only through the snapshot draft.
- SERP/AIO uses the fallback source and records unavailable query expansion honestly.

- [ ] **Step 2: Extend `ScrapeResult`**

```ts
export interface ScrapeResult {
  // existing fields
  snapshotSource?: {
    captureMethod: "brightdata_dataset" | "brightdata_serp";
    contentSource: "native_answer_html" | "rendered_from_structured_response";
    answerHtml?: string;
    sourcePayloadSha256?: string;
  };
}
```

Hash the provider payload before removing oversized/internal fields, but never expose or archive the entire raw provider record in the customer snapshot.

- [ ] **Step 3: Integrate worker persistence without changing failure semantics**

Before `claimObservationAttempt` and before `provider.run`, call the capacity gate only when snapshot capture is enabled for this target. After provider success, call `persistSuccessfulObservation({ reserveResponseSnapshot: true })`. Then run `recordResponseSnapshot()` in a separate `try/catch` that cannot reach `markObservationFailed`. The provider is never called again for a snapshot error.

- [ ] **Step 4: Prove metrics are unchanged**

Add tests with ready, pending and failed snapshot states over the same prompt-run fixture and assert identical visibility/SoV/fan-out/citation inputs and outputs.

- [ ] **Step 5: Run GREEN and commit**

Run: `pnpm --filter @workspace/lib exec vitest run src/providers/registry/brightdata.test.ts`

Run: `pnpm --filter @workspace/worker exec tsx --test src/jobs/process-prompt-snapshot-policy.test.ts`

Run: `pnpm --filter @workspace/worker check-types`

```bash
git add packages/lib/src/providers apps/worker/src/jobs/process-prompt* apps/worker/package.json
git commit -m "feat: archive Bright Data answer snapshots"
```

---

### Task 6: Carry answer-container HTML through the domestic Browser Runner

**Files:**
- Modify: `apps/browser-runner/src/contracts.ts`
- Modify: `apps/browser-runner/src/broker-protocol.ts`
- Modify: `apps/browser-runner/src/broker-protocol.test.ts`
- Modify: `apps/browser-runner/src/remote-client.ts`
- Modify: `apps/browser-runner/src/remote-client.test.ts`
- Modify: `apps/browser-runner/src/adapters/doubao-live.ts`
- Modify: `apps/browser-runner/src/adapters/doubao-live.test.ts`
- Modify: `apps/browser-runner/src/adapters/deepseek-live.ts`
- Modify: `apps/browser-runner/src/adapters/deepseek-live.test.ts`
- Modify: `apps/web/src/server/sampling-observation.ts`
- Modify: `apps/web/src/server/sampling-observation.test.ts`
- Modify: `apps/web/src/server/browser-runner-auth.ts`
- Modify: `apps/web/src/server/browser-runner-auth.test.ts`
- Modify: `apps/web/src/server/browser-runner-service.ts`
- Modify: `apps/web/src/server/browser-runner-service.test.ts`

- [ ] **Step 1: Write RED transport and adapter tests**

Add `answerHtml` to `SurfaceResponse`, capped at 2 MiB UTF-8 bytes. Each adapter must obtain `outerHTML` from the exact same newest answer locator whose text was accepted. Tests must reject old-answer HTML, full-page HTML, multiple answer ambiguity, oversized HTML, and answer HTML whose normalized text does not match the accepted `answerText`.

- [ ] **Step 2: Propagate through broker and remote payload**

The browser process sends answer HTML through the existing authenticated Unix-socket/runner API path; it does not write to the LAS archive and never receives a storage credential. Keep the existing screenshot/page_snapshot evidence protocol unchanged. Raise only the completion route's bounded JSON limit from 2 MiB to 6 MiB, retain streaming enforcement and compression rejection, and keep every other internal route at 1 MiB. Add boundary tests at exactly 6 MiB and 6 MiB + 1 byte.

- [ ] **Step 3: Queue the standard snapshot after Browser Runner success**

The web completion service reserves the snapshot with the run, persists the valid observation and delivery completion, then queues `consumer_web_browser` + `browser_answer_html`. Snapshot errors return a successful completion with snapshot `pending/failed`; they must not call `recordBrowserRunnerFailure`, reopen the profile or resubmit the prompt.

- [ ] **Step 4: Gate claims before prompt submission at 80%**

`claimRunnerTask` checks storage capacity before `claimBrowserRunnerTask`. If blocked it returns a stable 503/queue-waiting error and does not allocate a lease. Existing already-claimed tasks may complete and enqueue their captured response.

- [ ] **Step 5: Run GREEN and commit**

Run: `pnpm --filter @workspace/browser-runner test`

Run: `pnpm --filter @workspace/browser-runner check-types`

Run: `pnpm --filter @workspace/web exec vitest run --project=unit src/server/sampling-observation.test.ts src/server/browser-runner-service.test.ts`

Run: `pnpm --filter @workspace/web check-types`

```bash
git add apps/browser-runner/src apps/web/src/server/sampling-observation* apps/web/src/server/browser-runner-auth* apps/web/src/server/browser-runner-service*
git commit -m "feat: archive domestic browser answers"
```

---

### Task 7: Add customer-safe metadata and authenticated asset delivery

**Files:**
- Create: `apps/web/src/server/response-snapshots.ts`
- Create: `apps/web/src/server/response-snapshots.test.ts`
- Create: `apps/web/src/server/response-snapshot-http.ts`
- Create: `apps/web/src/server/response-snapshot-http.test.ts`
- Create: `apps/web/src/routes/api/app/response-snapshots/$snapshotId.ts`
- Modify: `apps/web/src/routeTree.gen.ts`
- Modify: `apps/web/src/server/customer-data-dto.ts`
- Modify: `apps/web/src/server/customer-data-dto.test.ts`
- Modify: `apps/web/src/server/prompts.ts`

- [ ] **Step 1: Write RED authorization and DTO tests**

Cover own-brand ready access, cross-brand 404, anonymous redirect/401, report-operator denial, global admin diagnostic access, expired 410, pending 409, failed 404-safe response, and storage-key/provider/capture-route omission from every customer DTO.

- [ ] **Step 2: Extend prompt-run DTO minimally**

```ts
export interface CustomerPromptRunDto {
  id: string;
  // existing public fields
  snapshot: null | {
    id: string;
    status: "pending" | "ready" | "failed" | "expired";
    contentSource: ResponseSnapshotContentSource | null;
    createdAt: string;
    expiresAt: string;
    htmlSha256: string | null;
    jsonSha256: string | null;
  };
}
```

The list query left-joins only the current revision. It never selects storage backend/key, provider payload, runner ID or internal error message.

- [ ] **Step 3: Implement one route with an asset allowlist**

Accept only `asset=html|json|manifest` and `download=0|1`; derive brand and storage key from DB after auth. HTML inline response headers:

```text
Cache-Control: private, no-store
Content-Security-Policy: sandbox; default-src 'none'; style-src 'unsafe-inline'; img-src data:; frame-ancestors 'self'
Content-Type: text/html; charset=utf-8
X-Content-Type-Options: nosniff
ETag: "<sha256>"
```

Downloads use a safe fixed filename and RFC 5987 disposition. Every successful view/download inserts an audit event. Do not accept range paths or raw filenames in this release.

- [ ] **Step 4: Run GREEN and route generation**

Run: `pnpm --filter @workspace/web exec vitest run --project=unit src/server/response-snapshots.test.ts src/server/response-snapshot-http.test.ts src/server/customer-data-dto.test.ts`

Run: `pnpm --filter @workspace/web check-types`

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/server/response-snapshot* apps/web/src/server/customer-data-dto* apps/web/src/server/prompts.ts apps/web/src/routes/api/app/response-snapshots apps/web/src/routeTree.gen.ts
git commit -m "feat: expose customer response snapshots"
```

---

### Task 8: Add the unified read-only customer viewer

**Files:**
- Create: `apps/web/src/components/response-snapshot-panel.tsx`
- Create: `apps/web/src/components/response-snapshot-panel.test.tsx`
- Modify: `apps/web/src/routes/_authed/app/$brand/prompts/$promptId.tsx`
- Modify: `apps/web/src/hooks/use-prompt-runs-only.tsx`

- [ ] **Step 1: Write RED component tests**

Cover domestic and overseas ready snapshots with identical UI, source labels, retention date, hashes, inline sandboxed preview, HTML/JSON/manifest download buttons, and explicit pending/failed/expired states. Ensure no edit/delete/extend-retention action appears for customer users.

- [ ] **Step 2: Implement the panel**

Add `回答快照` under each LLM Response card. Use a sandboxed iframe pointed at the authenticated HTML route; never inject snapshot HTML with `dangerouslySetInnerHTML` into the Portal document. Label the four source kinds honestly, especially historical reconstruction.

- [ ] **Step 3: Run GREEN, Storybook and accessibility checks**

Run: `pnpm --filter @workspace/web exec vitest run --project=unit src/components/response-snapshot-panel.test.tsx`

Run: `pnpm --filter @workspace/web test:storybook`

Run: `pnpm --filter @workspace/web check-types`

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/response-snapshot-panel* apps/web/src/routes/_authed/app/$brand/prompts/$promptId.tsx apps/web/src/hooks/use-prompt-runs-only.tsx
git commit -m "feat: show customer response snapshots"
```

---

### Task 9: Add bounded customer export

**Files:**
- Create: `apps/web/src/server/response-snapshot-export.ts`
- Create: `apps/web/src/server/response-snapshot-export.test.ts`
- Create: `apps/web/src/routes/api/app/response-snapshots/export.ts`
- Modify: `apps/web/src/routeTree.gen.ts`
- Modify: `apps/web/src/routes/_authed/app/$brand/prompts/$promptId.tsx`
- Modify: `apps/web/package.json`
- Modify: `pnpm-lock.yaml`

- [ ] **Step 1: Write RED export policy tests**

Allow only one authorized brand, Beijing-local start/end dates inside the 90-day retention horizon, maximum 31 days per archive, ready/current revisions only, and a preflight sum below 2 GiB. Reject cross-brand rows, expired files, arbitrary storage keys, path-like names and simultaneous duplicate exports by the same actor.

- [ ] **Step 2: Stream ZIP without staging another full copy**

Move `archiver` and its types to the correct runtime dependency boundary. Stream directories as `<observed-date>/<channel>/<run-id>/snapshot.html|snapshot.json|manifest.json`; gunzip each stored asset while streaming. Never buffer the full archive or write it to the container layer. Record one export audit event with count and date range.

- [ ] **Step 3: Add customer controls**

Provide date-range export from the response area with estimated object count/bytes. If 31 days or 2 GiB is exceeded, instruct the user to split by month; do not silently truncate.

- [ ] **Step 4: Run GREEN and commit**

Run: `pnpm --filter @workspace/web exec vitest run --project=unit src/server/response-snapshot-export.test.ts`

Run: `pnpm --filter @workspace/web check-types`

```bash
git add apps/web/src/server/response-snapshot-export* apps/web/src/routes/api/app/response-snapshots/export.ts apps/web/src/routeTree.gen.ts apps/web/src/routes/_authed/app/$brand/prompts/$promptId.tsx apps/web/package.json pnpm-lock.yaml
git commit -m "feat: export customer response snapshots"
```

---

### Task 10: Add maintenance, retry, retention and capacity gates

**Files:**
- Create: `apps/worker/src/jobs/response-snapshot-maintenance.ts`
- Create: `apps/worker/src/jobs/response-snapshot-maintenance-policy.ts`
- Create: `apps/worker/src/jobs/response-snapshot-maintenance-policy.test.ts`
- Modify: `apps/worker/src/handlers.ts`
- Modify: `apps/worker/src/index.ts`
- Modify: `apps/worker/package.json`
- Modify: `packages/config/src/env-registry.ts`
- Modify: `apps/web/src/env.d.ts`
- Modify: `turbo.json`

- [ ] **Step 1: Write RED policy tests**

Cover 69% normal, 70% warn, 79% warn, 80% stop-new-claims, invalid/statfs-failure fail closed for new snapshot-enabled work, immediate flush retries, 24-hour outbox failure, 90-day end-exclusive expiry, and per-run idempotency.

- [ ] **Step 2: Add validated configuration**

```text
RESPONSE_SNAPSHOT_ENABLED=false
RESPONSE_SNAPSHOT_ROOT=/var/lib/yonaris/response-snapshots/v1
RESPONSE_SNAPSHOT_RETENTION_DAYS=90
RESPONSE_SNAPSHOT_WARN_USED_PERCENT=70
RESPONSE_SNAPSHOT_STOP_USED_PERCENT=80
RESPONSE_SNAPSHOT_OUTBOX_TTL_HOURS=24
```

Only `ENABLED` is a rollout gate; production validation requires the fixed 90/70/80/24 values in v1 rather than accepting customer-specific overrides.

- [ ] **Step 3: Register a non-paid maintenance queue**

Schedule `response-snapshot-maintenance` every five minutes in UTC. Each run uses an advisory lock, flushes at most 50 pending outboxes, repairs at most 20 orphan pending reservations from stored run data, expires at most 500 objects, and deletes only verified unreferenced filesystem directories older than 24 hours. It never creates or schedules a prompt job.

- [ ] **Step 4: Add telemetry**

Record counts/bytes by brand/channel/month, pending age, failed code, expired bytes, disk percentage, and cleanup failure to logs/Sentry without prompt text, answer text, path, token or storage key.

- [ ] **Step 5: Run GREEN and commit**

Run: `pnpm --filter @workspace/worker exec tsx --test src/jobs/response-snapshot-maintenance-policy.test.ts`

Run: `pnpm --filter @workspace/worker test`

Run: `pnpm --filter @workspace/worker check-types`

```bash
git add apps/worker/src/jobs/response-snapshot-maintenance* apps/worker/src/handlers.ts apps/worker/src/index.ts apps/worker/package.json packages/config/src/env-registry.ts apps/web/src/env.d.ts turbo.json
git commit -m "feat: maintain response snapshot retention"
```

---

### Task 11: Persist and protect the LAS snapshot directory

**Files:**
- Modify: `deploy/las/compose.yaml`
- Modify: `deploy/las/env.example`
- Modify: `deploy/las/bin/deploy.sh`
- Create: `deploy/las/bin/prepare-response-snapshot-storage.sh`
- Create: `deploy/las/bin/prepare-response-snapshot-storage.test.sh`
- Create: `deploy/las/bin/check-response-snapshot-storage.sh`
- Create: `deploy/las/bin/check-response-snapshot-storage.test.sh`
- Create: `deploy/las/bin/export-response-snapshots.sh`
- Create: `deploy/las/RESPONSE-SNAPSHOT-RUNBOOK.md`
- Modify: `.github/workflows/deploy-las.yaml`

- [ ] **Step 1: Write RED shell/static tests**

Assert the host path is absolute, not `/`, not under `/opt/yonaris/releases`, root-owned setup resolves to UID/GID 1001, mode is exact, symlinks fail, web/worker mounts point at the same host root, container path matches runtime env, and feature enable fails before a writable/readable round-trip probe.

- [ ] **Step 2: Add compose mounts**

Mount `${RESPONSE_SNAPSHOT_HOST_ROOT}` read-write into both web and worker at `${RESPONSE_SNAPSHOT_ROOT}` because Bright Data writes from worker and Browser Runner completion writes from web. Keep it outside named Postgres volumes and outside immutable images. Do not mount it into browser-runner page processes.

- [ ] **Step 3: Add deploy preflight**

Before migration, validate directory safety and free space read-only. After migration and before runtime switch, run a candidate-image storage round trip with a random non-production key and delete only that verified probe. Deployment must refuse `RESPONSE_SNAPSHOT_ENABLED=true` if either container cannot access the same directory.

- [ ] **Step 4: Add export/backup operator path**

`export-response-snapshots.sh` copies a requested brand/date range to an explicitly named external destination, verifies every manifest/hash, fsyncs the destination and writes a redacted receipt. It must refuse a destination inside the live root and must not pretend a same-disk copy is disaster recovery. The runbook documents external disk/Kodo copy as the durability boundary.

- [ ] **Step 5: Run shell and deployment smoke GREEN**

Run: `bash deploy/las/bin/prepare-response-snapshot-storage.test.sh`

Run: `bash deploy/las/bin/check-response-snapshot-storage.test.sh`

Run: `bash -n deploy/las/bin/prepare-response-snapshot-storage.sh deploy/las/bin/check-response-snapshot-storage.sh deploy/las/bin/export-response-snapshots.sh deploy/las/bin/deploy.sh`

Run the existing empty/seeded migration smoke and Docker build. No production SSH or feature enable occurs in this task.

- [ ] **Step 6: Commit**

```bash
git add deploy/las .github/workflows/deploy-las.yaml
git commit -m "feat: provision LAS response snapshot storage"
```

---

### Task 12: Backfill existing StepFun runs without touching metrics

**Files:**
- Create: `apps/worker/src/backfill-response-snapshots.ts`
- Create: `apps/worker/src/backfill-response-snapshots-policy.ts`
- Create: `apps/worker/src/backfill-response-snapshots-policy.test.ts`
- Modify: `apps/worker/package.json`
- Create: `deploy/las/bin/run-response-snapshot-backfill.sh`
- Create: `deploy/las/bin/run-response-snapshot-backfill.test.sh`
- Create: `deploy/las/response-snapshot-backfills/request.example.json`
- Create: `deploy/las/response-snapshot-backfills/README.md`
- Modify: `.github/workflows/deploy-las.yaml`

- [ ] **Step 1: Write RED backfill policy tests**

Default is dry-run. Require exact brand/date/run filters, immutable source SHA, existing successful prompt run, matching prompt/brand/scope/citations identity, no duplicate current snapshot, and `contentSource=reconstructed_from_historical_run`. Snapshot generation must be the only write set; reject any plan that updates `prompt_runs`, `citations`, `observation_attempts`, scopes or metric tables.

- [ ] **Step 2: Implement idempotent chunked backfill**

Read prompt run + prompt + scope + citations in stable order, render the same v1 fallback HTML, reserve/enqueue/flush each run with an idempotency hash, and emit only counts/hashes in stdout. Use chunks of 100 and a per-brand advisory lock. A failed chunk is safe to rerun and never changes a previous revision.

- [ ] **Step 3: Add inert request gate**

Keep only `request.example.json` in Git. A production backfill requires a separate reviewed request commit, exact brand `stepfun`, explicit UTC date range, expected run count/fingerprint and production environment approval. Successful execution writes a durable receipt; no recurring job remains.

- [ ] **Step 4: Run GREEN and commit**

Run: `pnpm --filter @workspace/worker exec tsx --test src/backfill-response-snapshots-policy.test.ts`

Run: `pnpm --filter @workspace/worker test`

Run: `pnpm --filter @workspace/worker check-types`

```bash
git add apps/worker/src/backfill-response-snapshots* apps/worker/package.json deploy/las/bin/run-response-snapshot-backfill* deploy/las/response-snapshot-backfills .github/workflows/deploy-las.yaml
git commit -m "feat: backfill historical response snapshots"
```

---

### Task 13: End-to-end verification and staged release

**Files:**
- Create: `e2e/tests/response-snapshots.spec.ts`
- Modify: `e2e/seed.ts`
- Modify: `.github/workflows/deploy-las.yaml`
- Modify: `deploy/las/RESPONSE-SNAPSHOT-RUNBOOK.md`

- [ ] **Step 1: Add fixture-only E2E**

Seed one overseas native-HTML run, one overseas rendered fallback run, one domestic browser-answer run, one pending run, one expired run and a second tenant. Prove:

- the same customer component renders domestic/overseas snapshots;
- own-brand HTML/JSON downloads pass their hashes;
- cross-tenant and anonymous fetches fail;
- sanitized HTML cannot execute script or issue network requests;
- pending/failed/expired states are explicit;
- a snapshot failure leaves visibility/SoV/citation/query outputs unchanged;
- range export contains only authorized ready/current artifacts.

No CI test calls Bright Data, Doubao, DeepSeek or any paid provider.

- [ ] **Step 2: Run full validation**

Run:

```bash
pnpm --filter @workspace/lib test
pnpm --filter @workspace/lib exec tsc --noEmit
pnpm --filter @workspace/worker test
pnpm --filter @workspace/worker check-types
pnpm --filter @workspace/browser-runner test
pnpm --filter @workspace/browser-runner check-types
pnpm --filter @workspace/web test
pnpm --filter @workspace/web check-types
pnpm --filter @workspace/web build
pnpm -C e2e exec tsc --noEmit
pnpm -C e2e exec playwright test tests/response-snapshots.spec.ts
pnpm --filter @workspace/lib exec drizzle-kit check
git diff --check
```

Expected: all pass; Windows-only POSIX skips are covered by Linux CI.

- [ ] **Step 3: Deploy inert schema/code first**

Keep `RESPONSE_SNAPSHOT_ENABLED=false`. Verify build images, empty/seeded migration replay, production backup/rehearsal/live migration, web/worker health, and no snapshot task creation.

- [ ] **Step 4: Prepare storage and enable capture**

On LAS, run the root-owned prepare script, read-only capacity preflight, and candidate-image round trip. Update env with the fixed v1 configuration, restart web/worker, then verify a single non-paid fixture snapshot through the customer page. Only after this passes may Bright Data or started Browser Runner work create snapshots.

- [ ] **Step 5: Backfill and verify StepFun**

Run reviewed dry-run for the exact existing StepFun runs, review expected count/fingerprint, apply once, then verify from the real customer account:

- Doubao and DeepSeek entries show `历史重建` until future native browser snapshots exist;
- HTML/JSON/manifest hashes match downloaded files;
- model/channel filters and all existing dashboard metrics remain unchanged;
- 90-day expiry dates use `Asia/Shanghai` only for display; DB timestamps remain UTC.

- [ ] **Step 6: Commit final E2E/runbook changes**

```bash
git add e2e .github/workflows/deploy-las.yaml deploy/las/RESPONSE-SNAPSHOT-RUNBOOK.md
git commit -m "test: verify response snapshot archive"
```

---

## Definition of Done

- Every new successful Bright Data or supported domestic Browser Runner run has exactly one current snapshot revision or an explicit pending/failed state.
- Snapshot generation, storage and expiry cannot alter Elmo metric inputs or cause an AI re-query.
- Customer users can view/download/export only their brand's ready, unexpired snapshots; no customer mutation exists.
- HTML is deterministic, sanitized, sandboxed and hash-verifiable; JSON records honest source/query availability.
- LAS storage survives image/release rollback, is separate from PostgreSQL, and is protected by 70/80% gates plus a 90-day cleanup path.
- Existing StepFun data can be reconstructed without changing prompt runs, citations, mentions, scopes or formulas.
- The repository contains no production backfill request, no new daily capture scheduler and no paid-provider call in tests.
