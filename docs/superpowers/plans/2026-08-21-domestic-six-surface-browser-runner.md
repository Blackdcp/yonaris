# Domestic Six-Surface Browser Runner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an administrator create one domestic batch and have the paired local Browser Runner execute Doubao, DeepSeek, Qwen, Kimi, Wenxin, and Yuanbao tasks sequentially, persisting answers, verifiable search evidence, citations, and bounded JPEG evidence.

**Architecture:** A shared six-surface registry in `@workspace/lib` becomes the source of truth for server validation, run-now planning, extension routing, labels, launch URLs, and adapter bindings. The extension keeps one common `ConsumerAdapter` state machine and registers one selector contract per provider; the coordinator continues to cross only one submit boundary at a time and continues after task-local failures. The first production release activates all six exact adapter versions together and is validated with one Prompt × six surfaces before a full batch.

**Tech Stack:** TypeScript 7, pnpm 11, Vitest 4, Chrome Manifest V3, TanStack Start, Drizzle ORM, PostgreSQL, Playwright E2E.

**Spec:** `docs/superpowers/specs/2026-08-21-domestic-six-surface-browser-runner-design.md`

## Global Constraints

- Surfaces and execution order are exactly Doubao, DeepSeek, Qwen, Kimi, Wenxin, and Yuanbao.
- One enabled Prompt creates one delivery task per selected surface and sample index; the administrator action selects all six surfaces by default.
- Consumer-site interaction runs only in the paired local Chrome extension; the production server never launches a consumer browser.
- A device crosses only one prompt-submit boundary at a time.
- A failed surface task never prevents the coordinator from attempting the remaining ready surfaces.
- Search state, queries, and citations are stored only when the current answer exposes verifiable evidence; data is never fabricated.
- The extension uploads exact answer text plus one JPEG bounded to the current prompt, answer, and completion controls; it does not upload arbitrary provider HTML.
- Post-submit uncertainty enters `needs_human` and is never automatically submitted a second time.
- Extension package version for this release is `0.3.0`.
- New adapter versions are `deepseek-web-20260821-localpc-v2`, `qwen-web-20260821-localpc-v1`, `kimi-web-20260821-localpc-v1`, `wenxin-web-20260821-localpc-v1`, and `yuanbao-web-20260821-localpc-v1`; Doubao remains `doubao-web-20260819-localpc-v8`.

---

### Task 1: Create the shared six-surface registry

**Files:**
- Create: `packages/lib/src/browser-extension-surfaces.ts`
- Modify: `packages/lib/package.json`
- Modify: `packages/lib/src/browser-extension-contract.ts`
- Modify: `packages/lib/src/browser-extension-contract.test.ts`
- Modify: `apps/browser-extension/src/contracts.ts`
- Test: `packages/lib/src/browser-extension-contract.test.ts`

**Interfaces:**
- Produces: `BROWSER_EXTENSION_SURFACE_DEFINITIONS`, `BROWSER_EXTENSION_SURFACES`, `BrowserExtensionSurface`, `BrowserExtensionCaptureRoute`, `browserExtensionSurfaceDefinition(surface)`, and `browserExtensionCaptureRoute(surface)`.
- Consumes: no new interfaces.

- [ ] **Step 1: Write failing registry tests**

Add tests asserting the exact ordered surface keys, labels, routes, launch origins, and adapter versions:

```ts
expect(BROWSER_EXTENSION_SURFACES).toEqual([
  "doubao.consumer_web",
  "deepseek.consumer_web",
  "qwen.consumer_web",
  "kimi.consumer_web",
  "wenxin.consumer_web",
  "yuanbao.consumer_web",
]);
expect(browserExtensionCaptureRoute("yuanbao.consumer_web")).toBe("browser_extension.yuanbao");
expect(browserExtensionSurfaceDefinition("kimi.consumer_web").launchUrl).toBe("https://www.kimi.com/");
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run: `pnpm --filter @workspace/lib test -- browser-extension-contract.test.ts`

Expected: FAIL because the four new surface definitions and exported registry do not exist.

- [ ] **Step 3: Implement the data-only registry**

Create a single `as const` registry with this shape:

```ts
export const BROWSER_EXTENSION_SURFACE_DEFINITIONS = [
  { key: "doubao.consumer_web", label: "Doubao", captureRoute: "browser_extension.doubao", launchUrl: "https://www.doubao.com/chat/", adapterVersion: "doubao-web-20260819-localpc-v8" },
  { key: "deepseek.consumer_web", label: "DeepSeek", captureRoute: "browser_extension.deepseek", launchUrl: "https://chat.deepseek.com/", adapterVersion: "deepseek-web-20260814-uat1" },
  { key: "qwen.consumer_web", label: "Qwen", captureRoute: "browser_extension.qwen", launchUrl: "https://www.qianwen.com/", adapterVersion: "qwen-web-20260821-localpc-v1" },
  { key: "kimi.consumer_web", label: "Kimi", captureRoute: "browser_extension.kimi", launchUrl: "https://www.kimi.com/", adapterVersion: "kimi-web-20260821-localpc-v1" },
  { key: "wenxin.consumer_web", label: "Wenxin", captureRoute: "browser_extension.wenxin", launchUrl: "https://yiyan.baidu.com/", adapterVersion: "wenxin-web-20260821-localpc-v1" },
  { key: "yuanbao.consumer_web", label: "Yuanbao", captureRoute: "browser_extension.yuanbao", launchUrl: "https://yuanbao.tencent.com/", adapterVersion: "yuanbao-web-20260821-localpc-v1" },
] as const;
```

Derive all unions, guards, capture-route lookup, and label/URL lookup from this array. Export the module from `packages/lib/package.json`. Replace the duplicate two-surface declaration in the extension with imports/re-exports from `@workspace/lib/browser-extension-surfaces`.

- [ ] **Step 4: Run focused tests and type checks**

Run:

```powershell
pnpm --filter @workspace/lib test -- browser-extension-contract.test.ts
pnpm --filter @workspace/browser-extension check-types
```

Expected: PASS.

- [ ] **Step 5: Commit the registry**

```powershell
git add packages/lib/src/browser-extension-surfaces.ts packages/lib/src/browser-extension-contract.ts packages/lib/src/browser-extension-contract.test.ts packages/lib/package.json apps/browser-extension/src/contracts.ts
git commit -m "feat: define six browser runner surfaces"
```

### Task 2: Expand the database and server policy to six surfaces

**Files:**
- Create: `packages/lib/src/db/migrations/0028_browser_runner_six_surfaces.sql`
- Create: `packages/lib/src/db/migrations/meta/0028_snapshot.json`
- Modify: `packages/lib/src/db/migrations/meta/_journal.json`
- Modify: `packages/lib/src/db/schema.ts`
- Modify: `packages/lib/src/db/browser-runner-devices.test.ts`
- Modify: `packages/lib/src/browser-runner-policy.test.ts`
- Modify: `apps/web/src/server/browser-runner-auth.test.ts`
- Modify: `apps/web/src/server/browser-runner-service.test.ts`

**Interfaces:**
- Consumes: `BROWSER_EXTENSION_SURFACES` and per-surface adapter versions from Task 1.
- Produces: PostgreSQL constraints accepting one to six unique supported surfaces and service policy capable of validating all six exact routes and versions.

- [ ] **Step 1: Add failing database and service tests**

Test that a heartbeat containing all six surfaces is accepted, duplicates/unknown values are rejected, and an approved adapter can claim only its matching surface:

```ts
expect(() => validateSupportedSurfaces([...BROWSER_EXTENSION_SURFACES])).not.toThrow();
expect(() => validateSupportedSurfaces(["qwen.consumer_web", "qwen.consumer_web"])).toThrow(/duplicate/i);
expect(isCurrentBrowserExtensionAdapterVersionBindingSatisfied("kimi.consumer_web", "kimi-web-20260821-localpc-v1")).toBe(true);
```

- [ ] **Step 2: Run focused tests and confirm RED**

Run:

```powershell
pnpm --filter @workspace/lib test -- browser-runner-devices.test.ts browser-runner-policy.test.ts
pnpm --filter @workspace/web test -- browser-runner-auth.test.ts browser-runner-service.test.ts
```

Expected: FAIL on the two-surface count and unsupported route/version checks.

- [ ] **Step 3: Add the migration and schema constraints**

The migration must drop and recreate only these checks:

```sql
ALTER TABLE browser_runner_devices DROP CONSTRAINT browser_runner_devices_valid_surface_count;
ALTER TABLE browser_runner_devices DROP CONSTRAINT browser_runner_devices_valid_surfaces;
ALTER TABLE browser_runner_devices ADD CONSTRAINT browser_runner_devices_valid_surface_count CHECK (cardinality(supported_surfaces) BETWEEN 1 AND 6);
ALTER TABLE browser_runner_devices ADD CONSTRAINT browser_runner_devices_valid_surfaces CHECK (
  supported_surfaces <@ ARRAY[
    'doubao.consumer_web','deepseek.consumer_web','qwen.consumer_web',
    'kimi.consumer_web','wenxin.consumer_web','yuanbao.consumer_web'
  ]::text[]
);
```

Mirror those exact constraints in `schema.ts`. Generate the matching Drizzle snapshot and journal entry based on committed `0027`; do not edit or replay prior migrations.

- [ ] **Step 4: Replace route/version branches with registry lookups**

Build `CAPTURE_ROUTES`, approved adapter mappings, structured evidence mappings, and omission-window policy from the shared registry. The v7 omission window remains Doubao-only and becomes inactive when its approved version differs.

- [ ] **Step 5: Run focused tests and commit**

Run the commands from Step 2 plus `pnpm --filter @workspace/lib test -- browser-extension-contract.test.ts`.

Expected: PASS.

```powershell
git add packages/lib/src/db/migrations/0028_browser_runner_six_surfaces.sql packages/lib/src/db/migrations/meta/0028_snapshot.json packages/lib/src/db/migrations/meta/_journal.json packages/lib/src/db/schema.ts packages/lib/src/db/browser-runner-devices.test.ts packages/lib/src/browser-runner-policy.test.ts apps/web/src/server/browser-runner-auth.test.ts apps/web/src/server/browser-runner-service.test.ts packages/lib/src/browser-extension-contract.ts packages/lib/src/browser-extension-contract.test.ts
git commit -m "feat: authorize six browser runner surfaces"
```

### Task 3: Make Run Now create one ordered six-surface batch

**Files:**
- Modify: `apps/web/src/server/sampling-run-now-policy.ts`
- Modify: `apps/web/src/server/sampling-run-now-policy.test.ts`
- Modify: `apps/web/src/server/sampling.ts`
- Modify: `apps/web/src/server/sampling-run-now.test.ts`
- Modify: `apps/web/src/components/sampling/sampling-run-now-dialog.tsx`
- Modify: `apps/web/src/components/sampling/sampling-run-now-dialog.test.tsx`
- Modify: `apps/web/src/components/sampling/browser-runner-device-list.tsx`
- Modify: `apps/web/src/components/sampling/browser-runner-device-list.test.tsx`

**Interfaces:**
- Consumes: ordered registry and capture-route lookup from Task 1.
- Produces: `planSamplingRunNow({ prompts, surfaces, samplesPerPrompt, now })` where the domestic quick action defaults to six surfaces and `samplesPerPrompt: 1` for the one-pass monitoring action.

- [ ] **Step 1: Add failing one-click batch tests**

Assert one Prompt creates exactly six tasks in registry order, ten Prompts create sixty tasks, duplicate surfaces fail, and the dialog submits all six by default:

```ts
const plan = planSamplingRunNow({ prompts: [{ id: "p1", value: "Prompt" }], surfaces: BROWSER_EXTENSION_SURFACES, samplesPerPrompt: 1, now });
expect(plan.tasks.map((task) => task.surfaceTargetKey)).toEqual(BROWSER_EXTENSION_SURFACES);
expect(plan.taskCount).toBe(6);
```

- [ ] **Step 2: Run focused tests and confirm RED**

Run:

```powershell
pnpm --filter @workspace/web test -- sampling-run-now-policy.test.ts sampling-run-now.test.ts sampling-run-now-dialog.test.tsx
```

Expected: FAIL because the existing plan fixes samples at five and only knows two surfaces.

- [ ] **Step 3: Generalize the plan and UI**

Replace the hard-coded two-route union with `BrowserExtensionCaptureRoute`; accept `samplesPerPrompt: 1 | 5` and make the primary domestic-monitoring button pass `1`. Render labels from the registry. Keep the existing multi-sample path available only where it is already exposed; do not silently change stored historical batches.

- [ ] **Step 4: Run tests and commit**

Run the Step 2 suite plus `pnpm --filter @workspace/web check-types`.

Expected: PASS.

```powershell
git add apps/web/src/server/sampling-run-now-policy.ts apps/web/src/server/sampling-run-now-policy.test.ts apps/web/src/server/sampling.ts apps/web/src/server/sampling-run-now.test.ts apps/web/src/components/sampling/sampling-run-now-dialog.tsx apps/web/src/components/sampling/sampling-run-now-dialog.test.tsx apps/web/src/components/sampling/browser-runner-device-list.tsx apps/web/src/components/sampling/browser-runner-device-list.test.tsx
git commit -m "feat: create six-surface domestic batches"
```

### Task 4: Define six-surface extension routes without duplicated switches

**Files:**
- Create: `apps/browser-extension/src/surface-registry.ts`
- Create: `apps/browser-extension/src/surface-registry.test.ts`
- Modify: `apps/browser-extension/manifest.json`
- Modify: `apps/browser-extension/package.json`
- Modify: `apps/browser-extension/src/manifest.test.ts`
- Modify: `apps/browser-extension/src/api-client.ts`
- Modify: `apps/browser-extension/src/api-client.test.ts`
- Modify: `apps/browser-extension/src/coordinator/chrome-tabs.ts`
- Modify: `apps/browser-extension/src/coordinator/chrome-tabs.test.ts`
- Modify: `apps/browser-extension/src/coordinator/test-fixture.ts`

**Interfaces:**
- Consumes: shared definitions from Task 1.
- Produces: `extensionSurfaceDefinition(surface)` with `launchUrl`, `approvedUrl(url)`, and exact Manifest V3 match patterns. Adapter factory registration is added in Task 7 after all factories exist.

- [ ] **Step 1: Add failing routing tests**

Test that every registry surface has a launch URL, approved origin, content-script match, claim route, and exact adapter version. Unknown or credential-bearing URLs must fail closed.

```ts
for (const surface of BROWSER_EXTENSION_SURFACES) {
  const definition = extensionSurfaceDefinition(surface);
  expect(definition.approvedUrl(new URL(definition.launchUrl))).toBe(true);
}
```

- [ ] **Step 2: Run tests and confirm RED**

Run:

```powershell
pnpm --filter @workspace/browser-extension test -- surface-registry.test.ts manifest.test.ts api-client.test.ts chrome-tabs.test.ts
```

Expected: FAIL on all four new surfaces and existing binary branches.

- [ ] **Step 3: Implement registry-based routing**

Set package and manifest version to `0.3.0`. Add host/content-script patterns for official origins:

```json
[
  "https://www.qianwen.com/*",
  "https://www.kimi.com/*",
  "https://yiyan.baidu.com/*",
  "https://yuanbao.tencent.com/*"
]
```

Replace ternaries in claim parsing, tab opening/attachment, URL validation, and fixtures with `extensionSurfaceDefinition(surface)`.

- [ ] **Step 4: Run tests and commit**

Run the Step 2 suite and `pnpm --filter @workspace/browser-extension check-types`.

Expected: PASS after Tasks 5–7 supply all factories.

```powershell
git add apps/browser-extension/manifest.json apps/browser-extension/package.json apps/browser-extension/src/surface-registry.ts apps/browser-extension/src/surface-registry.test.ts apps/browser-extension/src/manifest.test.ts apps/browser-extension/src/api-client.ts apps/browser-extension/src/api-client.test.ts apps/browser-extension/src/coordinator/chrome-tabs.ts apps/browser-extension/src/coordinator/chrome-tabs.test.ts apps/browser-extension/src/coordinator/test-fixture.ts
git commit -m "feat: route six surfaces in browser runner"
```

### Task 5: Upgrade DeepSeek to the structured observation contract

**Files:**
- Modify: `apps/browser-extension/src/selector-contracts/deepseek-web-v1.json`
- Modify: `apps/browser-extension/src/adapters/deepseek.ts`
- Modify: `apps/browser-extension/src/adapters/deepseek.test.ts`
- Modify: `apps/browser-extension/src/adapters/deepseek-dom-fixture.test.ts`

**Interfaces:**
- Produces: `deepSeekSelectorContract` version `deepseek-web-20260821-localpc-v2` and `createDeepSeekAdapter(port)`.
- Consumes: `SelectorContract`, `ConsumerAdapter`, and structured observation/JPEG behavior already used by Doubao.

- [ ] **Step 1: Add failing DeepSeek contract tests**

Use a sanitized DOM fixture containing one user turn, one completed answer, completion controls, a visible source link, and a generating-state negative case. Assert answer text, URL/title citation, and non-null evidence rectangle; keep `webSearchObserved: null` and `webQueries: []` unless DeepSeek exposes verifiable search terms.

- [ ] **Step 2: Run focused tests and confirm RED**

Run: `pnpm --filter @workspace/browser-extension test -- deepseek.test.ts deepseek-dom-fixture.test.ts`

Expected: FAIL on version and completion/screenshot boundary.

- [ ] **Step 3: Update the selector contract**

Use semantic selectors constrained to the current answer. Configure direct visible HTTP citation links only when they are genuinely present. Do not add a search-evidence contract without a fixture proving search summary, queries, and citations belong to the same completed answer.

- [ ] **Step 4: Run tests and commit**

Run the focused suite and extension type check.

```powershell
git add apps/browser-extension/src/selector-contracts/deepseek-web-v1.json apps/browser-extension/src/adapters/deepseek.ts apps/browser-extension/src/adapters/deepseek.test.ts apps/browser-extension/src/adapters/deepseek-dom-fixture.test.ts
git commit -m "feat: collect structured DeepSeek observations"
```

### Task 6: Add Qwen and Kimi adapters

**Files:**
- Create: `apps/browser-extension/src/selector-contracts/qwen-web-v1.json`
- Create: `apps/browser-extension/src/selector-contracts/kimi-web-v1.json`
- Create: `apps/browser-extension/src/adapters/qwen.ts`
- Create: `apps/browser-extension/src/adapters/kimi.ts`
- Create: `apps/browser-extension/src/adapters/qwen.test.ts`
- Create: `apps/browser-extension/src/adapters/kimi.test.ts`
- Create: `apps/browser-extension/src/adapters/qwen-dom-fixture.test.ts`
- Create: `apps/browser-extension/src/adapters/kimi-dom-fixture.test.ts`

**Interfaces:**
- Produces: `qwenSelectorContract`, `kimiSelectorContract`, `createQwenAdapter(port)`, and `createKimiAdapter(port)`.
- Consumes: `createConsumerAdapter(port, contract)`.

- [ ] **Step 1: Add RED fixtures for both platforms**

For each platform, create fixtures for signed-in composer readiness, new-conversation control, one exact user Prompt, a completed answer, generating state, visible citations when exposed, and an answer-bound screenshot rectangle. Assert any absent provider search terms remain `webSearchObserved: null` with an empty query list.

- [ ] **Step 2: Run focused tests and confirm RED**

Run:

```powershell
pnpm --filter @workspace/browser-extension test -- qwen.test.ts qwen-dom-fixture.test.ts kimi.test.ts kimi-dom-fixture.test.ts
```

Expected: FAIL because adapter modules/contracts do not exist.

- [ ] **Step 3: Implement data-only contracts and thin factories**

Each factory must remain exactly:

```ts
export function createQwenAdapter(port: ConsumerDomPort): ConsumerWebAdapter {
  return createConsumerAdapter(port, qwenSelectorContract);
}
```

Use official launch URLs, strict conversation URL patterns, semantic controls, and current-answer boundaries. Provider-specific DOM actions require a named hook and a dedicated failing test; do not branch on surface inside `ConsumerAdapter`.

- [ ] **Step 4: Run focused tests and commit**

Run the Step 2 suite and extension type check.

```powershell
git add apps/browser-extension/src/selector-contracts/qwen-web-v1.json apps/browser-extension/src/selector-contracts/kimi-web-v1.json apps/browser-extension/src/adapters/qwen.ts apps/browser-extension/src/adapters/kimi.ts apps/browser-extension/src/adapters/qwen.test.ts apps/browser-extension/src/adapters/kimi.test.ts apps/browser-extension/src/adapters/qwen-dom-fixture.test.ts apps/browser-extension/src/adapters/kimi-dom-fixture.test.ts
git commit -m "feat: add Qwen and Kimi browser adapters"
```

### Task 7: Add Wenxin and Yuanbao adapters

**Files:**
- Create: `apps/browser-extension/src/selector-contracts/wenxin-web-v1.json`
- Create: `apps/browser-extension/src/selector-contracts/yuanbao-web-v1.json`
- Create: `apps/browser-extension/src/adapters/wenxin.ts`
- Create: `apps/browser-extension/src/adapters/yuanbao.ts`
- Create: `apps/browser-extension/src/adapters/wenxin.test.ts`
- Create: `apps/browser-extension/src/adapters/yuanbao.test.ts`
- Create: `apps/browser-extension/src/adapters/wenxin-dom-fixture.test.ts`
- Create: `apps/browser-extension/src/adapters/yuanbao-dom-fixture.test.ts`
- Modify: `apps/browser-extension/src/surface-registry.ts`
- Modify: `apps/browser-extension/src/surface-registry.test.ts`
- Modify: `apps/browser-extension/src/adapters/content-entry.ts`
- Modify: `apps/browser-extension/src/adapters/content-entry.test.ts`

**Interfaces:**
- Produces: `wenxinSelectorContract`, `yuanbaoSelectorContract`, `createWenxinAdapter(port)`, `createYuanbaoAdapter(port)`, and a complete six-surface `createAdapter(port)` registration in `extensionSurfaceDefinition(surface)`.
- Consumes: `createConsumerAdapter(port, contract)`.

- [ ] **Step 1: Add RED fixtures for both platforms**

Use the same fixture matrix as Task 6 and add an explicit model/surface assertion for Yuanbao so a DeepSeek model choice inside Yuanbao is still stored as `yuanbao.consumer_web`, not `deepseek.consumer_web`.

- [ ] **Step 2: Run focused tests and confirm RED**

Run:

```powershell
pnpm --filter @workspace/browser-extension test -- wenxin.test.ts wenxin-dom-fixture.test.ts yuanbao.test.ts yuanbao-dom-fixture.test.ts
```

Expected: FAIL because adapter modules/contracts do not exist.

- [ ] **Step 3: Implement contracts and factories**

Keep login, CAPTCHA, account restriction, generating, and completion selectors explicit for each provider. A citation is accepted only when its URL and non-empty visible title occur inside the accepted current answer. Import all six adapter factories into `surface-registry.ts`, add `contract` and `createAdapter(port)` to every registry entry, and replace content-entry's Doubao/DeepSeek switch with the registry factory.

- [ ] **Step 4: Run focused tests and commit**

Run the Step 2 suite and extension type check.

```powershell
git add apps/browser-extension/src/selector-contracts/wenxin-web-v1.json apps/browser-extension/src/selector-contracts/yuanbao-web-v1.json apps/browser-extension/src/adapters/wenxin.ts apps/browser-extension/src/adapters/yuanbao.ts apps/browser-extension/src/adapters/wenxin.test.ts apps/browser-extension/src/adapters/yuanbao.test.ts apps/browser-extension/src/adapters/wenxin-dom-fixture.test.ts apps/browser-extension/src/adapters/yuanbao-dom-fixture.test.ts apps/browser-extension/src/surface-registry.ts apps/browser-extension/src/surface-registry.test.ts apps/browser-extension/src/adapters/content-entry.ts apps/browser-extension/src/adapters/content-entry.test.ts
git commit -m "feat: add Wenxin and Yuanbao browser adapters"
```

### Task 8: Enforce global sequential execution and six-surface failure continuation

**Files:**
- Modify: `apps/browser-extension/src/coordinator/extension-coordinator.ts`
- Modify: `apps/browser-extension/src/coordinator/extension-coordinator.test.ts`
- Modify: `apps/browser-extension/src/coordinator/poller.ts`
- Modify: `apps/browser-extension/src/coordinator/poller.test.ts`
- Modify: `apps/browser-extension/src/coordinator/concurrency.ts`
- Modify: `apps/browser-extension/src/coordinator/concurrency.test.ts`
- Modify: `apps/browser-extension/src/coordinator/stale-recovery.test.ts`
- Modify: `apps/browser-extension/src/background.ts`
- Modify: `apps/browser-extension/src/background.test.ts`
- Modify: `apps/browser-extension/src/heartbeat.ts`
- Modify: `apps/browser-extension/src/heartbeat.test.ts`
- Modify: `apps/browser-extension/src/surface-readiness.ts`
- Modify: `apps/browser-extension/src/storage.test.ts`

**Interfaces:**
- Consumes: registry order and adapter versions from Tasks 1 and 4–7.
- Produces: one global task loop that polls in registry order, executes at most one task at a time, and returns `Record<BrowserExtensionSurface, SurfacePollSummary>`.

- [ ] **Step 1: Add failing six-surface sequencing tests**

Queue one claim for each surface, make Kimi fail pre-submit, and record submit entry/exit events:

```ts
expect(maximumObservedSubmitConcurrency).toBe(1);
expect(attemptedSurfaces).toEqual(BROWSER_EXTENSION_SURFACES);
expect(summary.bySurface["kimi.consumer_web"].retryScheduled).toBe(1);
expect(summary.bySurface["wenxin.consumer_web"].succeeded).toBe(1);
```

- [ ] **Step 2: Run focused tests and confirm RED**

Run:

```powershell
pnpm --filter @workspace/browser-extension test -- concurrency.test.ts poller.test.ts extension-coordinator.test.ts background.test.ts heartbeat.test.ts storage.test.ts
```

Expected: FAIL because pools, summaries, labels, and readiness only cover two surfaces and polling stops after one surface failure.

- [ ] **Step 3: Derive state from the registry and serialize execution**

Initialize pools and empty summaries with `Object.fromEntries(BROWSER_EXTENSION_SURFACES.map(...))`. Poll ready surfaces in registry order. Await each claimed task before asking for the next surface. Preserve existing journal reconciliation and `needs_human` behavior.

- [ ] **Step 4: Run focused tests and commit**

Run the Step 2 suite plus extension type check.

```powershell
git add apps/browser-extension/src/coordinator/extension-coordinator.ts apps/browser-extension/src/coordinator/extension-coordinator.test.ts apps/browser-extension/src/coordinator/poller.ts apps/browser-extension/src/coordinator/poller.test.ts apps/browser-extension/src/coordinator/concurrency.ts apps/browser-extension/src/coordinator/concurrency.test.ts apps/browser-extension/src/coordinator/stale-recovery.test.ts apps/browser-extension/src/background.ts apps/browser-extension/src/background.test.ts apps/browser-extension/src/heartbeat.ts apps/browser-extension/src/heartbeat.test.ts apps/browser-extension/src/surface-readiness.ts apps/browser-extension/src/storage.test.ts
git commit -m "feat: run six browser surfaces sequentially"
```

### Task 9: Render six-surface status and generic read-only checks

**Files:**
- Modify: `apps/browser-extension/src/popup.html`
- Modify: `apps/browser-extension/src/popup.ts`
- Modify: `apps/browser-extension/src/popup.css`
- Modify: `apps/browser-extension/src/popup-css.test.ts`
- Create: `apps/browser-extension/src/popup.test.ts`
- Modify: `apps/browser-extension/src/background.ts`
- Modify: `apps/browser-extension/src/background.test.ts`
- Rename: `apps/browser-extension/src/doubao-qualification-client.ts` to `apps/browser-extension/src/surface-qualification-client.ts`
- Rename: `apps/browser-extension/src/doubao-qualification-client.test.ts` to `apps/browser-extension/src/surface-qualification-client.test.ts`

**Interfaces:**
- Produces: `qualifyAndRecordActiveSurfaceTab(surface, storage, gateway, publisher)` and a popup row generated for every registry definition.
- Consumes: `StructuredSearchQualification` for structured surfaces and preflight-only readiness for surfaces without a verifiable search block.

- [ ] **Step 1: Add failing popup and qualification tests**

Assert six ordered rows, registry-derived labels, one generic check action, per-surface summary counts, and no hard-coded Doubao/DeepSeek union in popup types. Active unsupported tabs must produce an actionable message without changing readiness.

- [ ] **Step 2: Run focused tests and confirm RED**

Run:

```powershell
pnpm --filter @workspace/browser-extension test -- popup.test.ts popup-css.test.ts surface-qualification-client.test.ts background.test.ts
```

Expected: FAIL because the popup contains two static rows and a Doubao-only checker.

- [ ] **Step 3: Implement registry-driven UI and qualification**

Create channel rows with `data-surface` and a status element. The checker detects the active tab using the extension registry, runs the provider's read-only preflight, and runs structured search qualification only when the contract defines `searchEvidence`. It must never call `openNewConversation`, `fill`, or `submitOnce`.

- [ ] **Step 4: Run tests and commit**

Run the Step 2 suite plus extension type check.

```powershell
git add apps/browser-extension/src/popup.html apps/browser-extension/src/popup.ts apps/browser-extension/src/popup.css apps/browser-extension/src/popup-css.test.ts apps/browser-extension/src/popup.test.ts apps/browser-extension/src/background.ts apps/browser-extension/src/background.test.ts apps/browser-extension/src/surface-qualification-client.ts apps/browser-extension/src/surface-qualification-client.test.ts
git rm apps/browser-extension/src/doubao-qualification-client.ts apps/browser-extension/src/doubao-qualification-client.test.ts
git commit -m "feat: show six browser runner surfaces"
```

### Task 10: Prove the strict observation and screenshot path for every surface

**Files:**
- Modify: `apps/web/src/server/sampling-observation.test.ts`
- Modify: `apps/web/src/server/browser-runner-snapshot-policy.test.ts`
- Modify: `apps/browser-extension/src/coordinator/screenshot.test.ts`
- Modify: `apps/browser-extension/src/coordinator/task-runner.test.ts`
- Modify: `apps/web/src/server/browser-runner-service.test.ts`
- Modify: `e2e/tests/browser-extension-runner.spec.ts`
- Modify: `e2e/tests/response-snapshots.spec.ts`

**Interfaces:**
- Consumes: strict structured observation schema, exact adapter binding, evidence upload session binding, and six surface factories.
- Produces: integration proof from six claims through local collection and JPEG upload to ready response snapshot/customer download.

- [ ] **Step 1: Add failing integration matrix**

Parameterize the existing successful Browser Runner E2E by all six registry entries. For each row, inject a completed content-script result with exact prompt/answer/adapter version, upload one JPEG, complete the task, and assert a ready `response-snapshot.v2` whose visual evidence is authorized for the owning customer.

- [ ] **Step 2: Run targeted E2E and confirm RED**

Run:

```powershell
pnpm --filter e2e test:e2e -- browser-extension-runner.spec.ts response-snapshots.spec.ts
```

Expected: FAIL on four unsupported routes before Tasks 1–9 are complete.

- [ ] **Step 3: Align strict observation metadata**

Ensure the server uses the registry surface key, capture route, exact adapter version, `dedicated_sampling_profile`, and one JPEG. Keep citation title/URL validation and response-snapshot v2 recovery identical across all surfaces.

- [ ] **Step 4: Run integration and commit**

Run the Step 2 suite plus:

```powershell
pnpm --filter @workspace/browser-extension test -- screenshot.test.ts task-runner.test.ts
pnpm --filter @workspace/web test -- sampling-observation.test.ts browser-runner-snapshot-policy.test.ts browser-runner-service.test.ts
```

Expected: PASS.

```powershell
git add apps/web/src/server/sampling-observation.test.ts apps/web/src/server/browser-runner-snapshot-policy.test.ts apps/browser-extension/src/coordinator/screenshot.test.ts apps/browser-extension/src/coordinator/task-runner.test.ts apps/web/src/server/browser-runner-service.test.ts e2e/tests/browser-extension-runner.spec.ts e2e/tests/response-snapshots.spec.ts
git commit -m "test: cover six-surface browser runner flow"
```

### Task 11: Verify, package, deploy, and run the one-by-six canary

**Files:**
- Create: `apps/web/public/downloads/yonaris-browser-extension.zip`
- Create: `apps/web/public/downloads/yonaris-browser-extension.json`
- Create: `docs/runbooks/ppio-domestic-six-surface-canary-20260821.md`

**Interfaces:**
- Consumes: completed Tasks 1–10.
- Produces: deterministic `0.3.0` extension artifact, production revision, and recorded one-Prompt × six-surface canary outcome.

- [ ] **Step 1: Run all verification gates**

Run:

```powershell
pnpm --filter @workspace/browser-extension test
pnpm --filter @workspace/browser-extension check-types
pnpm --filter @workspace/browser-extension build
pnpm --filter @workspace/lib test
pnpm --filter @workspace/web test
pnpm --filter @workspace/web check-types
pnpm --filter @workspace/worker test
pnpm --filter @workspace/worker check-types
pnpm --filter e2e exec tsc --noEmit
pnpm --filter e2e test:e2e -- browser-extension-runner.spec.ts response-snapshots.spec.ts
pnpm exec biome check --config-path=biome.json apps/browser-extension packages/lib/src/browser-extension-surfaces.ts packages/lib/src/browser-extension-contract.ts apps/web/src/server/sampling-run-now-policy.ts
git diff --check
```

Expected: all commands exit 0.

- [ ] **Step 2: Build the exact package twice**

Run the extension build and package script twice from clean `dist`, recording SHA-256 and ZIP entry lists. The two ZIP hashes and entry lists must match exactly.

- [ ] **Step 3: Commit the release artifact and runbook**

The runbook records source SHA, extension version, ZIP SHA-256, migration number, production deploy run, device ID, Prompt ID, and a table with one row per surface containing task ID, terminal state, answer bytes, query count, citation count, snapshot status, and screenshot bytes.

```powershell
git add apps/web/public/downloads/yonaris-browser-extension.zip apps/web/public/downloads/yonaris-browser-extension.json docs/runbooks/ppio-domestic-six-surface-canary-20260821.md
git commit -m "release: package six-surface browser runner"
```

- [ ] **Step 4: Deploy and perform the production canary**

Deploy the committed revision, install the exact ZIP on the paired local computer, confirm the device heartbeat lists all six surfaces and exact adapter versions, then use the administrator action to create one Prompt × six tasks. Press **Check for work now** once and allow the local extension to attempt all six sequentially.

- [ ] **Step 5: Record the outcome without hiding failures**

Update the runbook with all six terminal results. A selector drift or signed-out task is an explicit per-surface canary failure; it does not invalidate successful surfaces and becomes the next provider-specific fix. Do not describe a surface as production-ready until its task has a persisted answer and ready snapshot.

- [ ] **Step 6: Commit canary evidence**

```powershell
git add docs/runbooks/ppio-domestic-six-surface-canary-20260821.md
git commit -m "docs: record six-surface production canary"
```
