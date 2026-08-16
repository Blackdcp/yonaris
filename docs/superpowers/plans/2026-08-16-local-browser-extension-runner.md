# Local Browser Extension Runner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a platform administrator create and start a five-sample-per-Prompt Doubao/DeepSeek batch from the Portal, execute it through a paired Chrome extension on Windows or macOS, and persist answers plus 90-day HTML/JSON snapshots into the existing Elmo metric pipeline.

**Architecture:** Extend the existing frozen delivery batch and Browser Runner APIs with dynamically paired extension devices and two supported consumer-web surfaces. A Manifest V3 extension owns the device credential in its background worker, coordinates bounded tab pools, and delegates page interaction to origin-specific content adapters. Successful observations continue through `persistSuccessfulObservation` and the current response-snapshot archive; technical failures remain delivery failures.

**Tech Stack:** TypeScript 7, React 19, TanStack Start, Drizzle/PostgreSQL, Zod, Chrome Manifest V3 APIs, esbuild, Vitest, Node test runner, Playwright E2E, Biome, pnpm/turbo.

## Global Constraints

- Only a global platform administrator can invoke **Run now** or manage local collection devices.
- Customer accounts remain read-only.
- One run freezes every enabled Prompt in the selected Program and exactly five samples for each selected channel.
- Supported initial channels are `doubao.consumer_web` and `deepseek.consumer_web` only.
- Standard extension batches upload answer text, current-answer HTML, citations, query state, and metadata; they do not require original-site screenshots.
- Existing legacy Browser Runner batches retain their frozen two-artifact screenshot/page-snapshot contract.
- The default extension concurrency is five per channel with an adaptive hard range of one through ten.
- A server-side submit intent must be durable before page submission; after intent, the Prompt is never automatically resubmitted.
- Technical failures do not create `prompt_runs` and do not count as brand-not-mentioned.
- Existing Elmo metric formulas are unchanged.
- Response snapshots retain sanitized HTML/JSON for 90 days through the existing snapshot archive.
- No daily schedule, cron, hidden webpage API, automated login, CAPTCHA solving, proxy rotation, or fingerprint spoofing is introduced.
- Real Doubao or DeepSeek sites are never contacted by ordinary CI.

---

### Task 1: Shared extension protocol and task policy

**Files:**
- Create: `packages/lib/src/browser-extension-contract.ts`
- Create: `packages/lib/src/browser-extension-contract.test.ts`
- Modify: `packages/lib/package.json`
- Modify: `packages/lib/src/manual-observation-targets.ts`
- Modify: `packages/lib/src/manual-observation-targets.test.ts`
- Modify: `packages/lib/src/browser-runner-policy.ts`
- Modify: `packages/lib/src/browser-runner-policy.test.ts`

**Interfaces:**
- Produces: `BROWSER_EXTENSION_SURFACES`, `BrowserExtensionSurface`, `BrowserExtensionDeviceStatus`, `BrowserExtensionReadiness`, `BrowserExtensionClaim`, `browserExtensionCaptureRoute(surface)`, and `assertExtensionEvidenceProtocol(...)`.
- Consumed by: Tasks 3–10.

- [ ] **Step 1: Write failing contract tests**

```ts
import { describe, expect, it } from "vitest";
import {
  assertExtensionEvidenceProtocol,
  browserExtensionCaptureRoute,
  parseBrowserExtensionSurface,
} from "./browser-extension-contract";

describe("browser extension contract", () => {
  it.each([
    ["doubao.consumer_web", "browser_extension.doubao"],
    ["deepseek.consumer_web", "browser_extension.deepseek"],
  ] as const)("maps %s to %s", (surface, route) => {
    expect(parseBrowserExtensionSurface(surface)).toBe(surface);
    expect(browserExtensionCaptureRoute(surface)).toBe(route);
  });

  it("accepts HTML-only evidence for extension routes", () => {
    expect(() =>
      assertExtensionEvidenceProtocol({
        captureRouteKey: "browser_extension.deepseek",
        minimumArtifacts: 1,
        kinds: ["page_snapshot"],
      }),
    ).not.toThrow();
  });

  it("rejects screenshots as a standard extension requirement", () => {
    expect(() =>
      assertExtensionEvidenceProtocol({
        captureRouteKey: "browser_extension.doubao",
        minimumArtifacts: 2,
        kinds: ["page_snapshot", "screenshot"],
      }),
    ).toThrow(/exactly one page snapshot/i);
  });
});
```

- [ ] **Step 2: Run the tests and verify RED**

Run: `pnpm --filter @workspace/lib exec vitest run src/browser-extension-contract.test.ts`

Expected: FAIL because `browser-extension-contract.ts` and the new route keys do not exist.

- [ ] **Step 3: Implement the pure shared contract**

```ts
export const BROWSER_EXTENSION_SURFACES = ["doubao.consumer_web", "deepseek.consumer_web"] as const;
export type BrowserExtensionSurface = (typeof BROWSER_EXTENSION_SURFACES)[number];
export type BrowserExtensionCaptureRoute = "browser_extension.doubao" | "browser_extension.deepseek";

export function browserExtensionCaptureRoute(surface: BrowserExtensionSurface): BrowserExtensionCaptureRoute {
  return surface === "doubao.consumer_web" ? "browser_extension.doubao" : "browser_extension.deepseek";
}

export function assertExtensionEvidenceProtocol(input: {
  captureRouteKey: string;
  minimumArtifacts: number;
  kinds: readonly string[];
}): void {
  if (!input.captureRouteKey.startsWith("browser_extension.")) return;
  if (input.minimumArtifacts !== 1 || input.kinds.length !== 1 || input.kinds[0] !== "page_snapshot") {
    throw new Error("Browser extension completion requires exactly one page snapshot");
  }
}
```

Extend manual observation targets with both `browser_extension.*` routes, restrict each route to its matching public surface, and preserve `browser_runner.doubao` for legacy batches.

- [ ] **Step 4: Run focused and full library tests**

Run:

```bash
pnpm --filter @workspace/lib exec vitest run src/browser-extension-contract.test.ts src/manual-observation-targets.test.ts src/browser-runner-policy.test.ts
pnpm --filter @workspace/lib test
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/lib/src/browser-extension-contract.ts packages/lib/src/browser-extension-contract.test.ts packages/lib/src/manual-observation-targets.ts packages/lib/src/manual-observation-targets.test.ts packages/lib/src/browser-runner-policy.ts packages/lib/src/browser-runner-policy.test.ts packages/lib/package.json
git commit -m "feat: define browser extension runner contract"
```

---

### Task 2: Device pairing and authorization persistence

**Files:**
- Modify: `packages/lib/src/db/schema.ts`
- Create: `packages/lib/src/db/browser-runner-devices.ts`
- Create: `packages/lib/src/db/browser-runner-devices.test.ts`
- Create: `packages/lib/src/db/migrations/0023_browser_extension_devices.sql`
- Create: `packages/lib/src/db/migrations/meta/0023_snapshot.json`
- Modify: `packages/lib/src/db/migrations/meta/_journal.json`
- Modify: `packages/lib/package.json`

**Interfaces:**
- Produces:
  - `createBrowserRunnerPairing(input): Promise<{ pairingId: string; code: string; expiresAt: Date }>`
  - `consumeBrowserRunnerPairing(input): Promise<{ device: BrowserRunnerDevice; token: string }>`
  - `authenticateBrowserRunnerDevice(token): Promise<AuthenticatedBrowserRunnerDevice | null>`
  - `heartbeatBrowserRunnerDevice(input): Promise<BrowserRunnerDevice>`
  - `listBrowserRunnerDevices(): Promise<BrowserRunnerDevice[]>`
  - `revokeBrowserRunnerDevice(input): Promise<void>`
- Consumed by: Task 3.

- [ ] **Step 1: Write repository policy tests before schema code**

```ts
import { describe, expect, it } from "vitest";
import { resolvePairingConsumption, validateDeviceHeartbeat } from "./browser-runner-devices";

describe("browser runner device pairing", () => {
  it("consumes a live pairing exactly once", () => {
    const now = new Date("2026-08-16T10:00:00.000Z");
    expect(resolvePairingConsumption({ expiresAt: new Date(now.getTime() + 60_000), consumedAt: null }, now)).toBe(
      "consume",
    );
    expect(
      resolvePairingConsumption(
        { expiresAt: new Date(now.getTime() + 60_000), consumedAt: new Date(now.getTime() - 1) },
        now,
      ),
    ).toBe("reject");
  });

  it("rejects unsupported heartbeat surfaces", () => {
    expect(() =>
      validateDeviceHeartbeat({
        extensionVersion: "0.1.0",
        browserFamily: "chrome",
        platform: "windows",
        supportedSurfaces: ["chatgpt.consumer_web"],
        readiness: {},
      }),
    ).toThrow(/unsupported surface/i);
  });
});
```

- [ ] **Step 2: Verify RED**

Run: `pnpm --filter @workspace/lib exec vitest run src/db/browser-runner-devices.test.ts`

Expected: FAIL because the repository module and tables do not exist.

- [ ] **Step 3: Add the tables and migration**

Add:

```ts
export const browserRunnerDevices = pgTable("browser_runner_devices", {
  id: uuid("id").defaultRandom().primaryKey().notNull(),
  displayName: text("display_name").notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  extensionVersion: text("extension_version"),
  browserFamily: text("browser_family"),
  platform: text("platform"),
  supportedSurfaces: text("supported_surfaces").array().notNull().default([]),
  readiness: json("readiness").notNull().default({}),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const browserRunnerDeviceBrands = pgTable("browser_runner_device_brands", {
  deviceId: uuid("device_id").references(() => browserRunnerDevices.id).notNull(),
  brandId: text("brand_id").references(() => brands.id).notNull(),
  assignedBy: text("assigned_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const browserRunnerPairings = pgTable("browser_runner_pairings", {
  id: uuid("id").defaultRandom().primaryKey().notNull(),
  codeHash: text("code_hash").notNull().unique(),
  displayName: text("display_name").notNull(),
  brandId: text("brand_id").references(() => brands.id).notNull(),
  createdBy: text("created_by").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  consumedAt: timestamp("consumed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
```

The SQL migration adds primary/foreign/unique indexes, restricts pairings to a 15-minute lifetime in repository code, and stores only SHA-256 token/code hashes. Clear secrets never enter database rows or logs.

- [ ] **Step 4: Implement transactional pairing and device repository functions**

Generate pairing codes with `randomBytes(24).toString("base64url")` and device tokens with `randomBytes(32).toString("base64url")`. Consume by locking the pairing row, verifying its hash, expiry, and unused state, inserting the device plus brand assignment, marking the pairing consumed, and returning the clear token once.

- [ ] **Step 5: Run schema and repository verification**

Run:

```bash
pnpm --filter @workspace/lib exec vitest run src/db/browser-runner-devices.test.ts
pnpm --filter @workspace/lib test
pnpm --filter @workspace/lib exec drizzle-kit check
```

Expected: all tests PASS and Drizzle prints `Everything's fine`.

- [ ] **Step 6: Commit**

```bash
git add packages/lib/src/db/schema.ts packages/lib/src/db/browser-runner-devices.ts packages/lib/src/db/browser-runner-devices.test.ts packages/lib/src/db/migrations/0023_browser_extension_devices.sql packages/lib/src/db/migrations/meta/0023_snapshot.json packages/lib/src/db/migrations/meta/_journal.json packages/lib/package.json
git commit -m "feat: persist paired browser runner devices"
```

---

### Task 3: Versioned device API and dynamic runner authentication

**Files:**
- Create: `apps/web/src/server/browser-runner-devices.ts`
- Create: `apps/web/src/server/browser-runner-devices.test.ts`
- Modify: `apps/web/src/server/browser-runner-auth.ts`
- Modify: `apps/web/src/server/browser-runner-auth.test.ts`
- Create: `apps/web/src/routes/api/internal/browser-runner/v1/pair.ts`
- Create: `apps/web/src/routes/api/internal/browser-runner/v1/device/heartbeat.ts`
- Modify: `apps/web/src/routes/api/internal/browser-runner/v1/tasks/claim.ts`
- Modify: `apps/web/src/routes/api/internal/browser-runner/v1/tasks/$taskId/heartbeat.ts`
- Modify: `apps/web/src/routes/api/internal/browser-runner/v1/tasks/$taskId/submit-intent.ts`
- Modify: `apps/web/src/routes/api/internal/browser-runner/v1/tasks/$taskId/submit-confirmed.ts`
- Modify: `apps/web/src/routes/api/internal/browser-runner/v1/tasks/$taskId/failure.ts`
- Modify: `apps/web/src/routes/api/internal/browser-runner/v1/tasks/$taskId/complete.ts`
- Modify: `apps/web/src/routes/api/internal/browser-runner/v1/tasks/$taskId/resume.ts`
- Modify (generated): `apps/web/src/routeTree.gen.ts`

**Interfaces:**
- Produces: async `requireBrowserRunner(request): Promise<BrowserRunnerPrincipal>` with legacy and paired-device principals.
- Produces HTTP:
  - `POST /api/internal/browser-runner/v1/pair`
  - `POST /api/internal/browser-runner/v1/device/heartbeat`
- Consumed by: Tasks 4, 7, and 10.

- [ ] **Step 1: Write failing auth and route tests**

```ts
it("authenticates a paired device and enforces its brand and surface capabilities", async () => {
  const principal = await authenticateRunnerRequest(requestWithBearer("device-secret"), {
    authenticateDevice: async () => ({
      id: "11111111-1111-4111-8111-111111111111",
      allowedBrandIds: ["stepfun"],
      supportedSurfaces: ["doubao.consumer_web", "deepseek.consumer_web"],
      revokedAt: null,
    }),
  });
  expect(principal.kind).toBe("browser_extension");
  expect(principal.allowedBrandIds).toEqual(["stepfun"]);
});

it("rejects a revoked device before parsing a task body", async () => {
  await expect(authenticateRunnerRequest(requestWithBearer("revoked"), dependencies)).rejects.toMatchObject({
    status: 401,
  });
});
```

Add route tests proving pairing codes are single-use, expired codes fail, heartbeat output contains no token, and compressed/oversized bodies retain the current fail-closed behavior.

- [ ] **Step 2: Verify RED**

Run: `pnpm --filter @workspace/web exec vitest run --project=unit src/server/browser-runner-devices.test.ts src/server/browser-runner-auth.test.ts`

Expected: FAIL because paired device auth and routes are absent.

- [ ] **Step 3: Implement paired principal authentication**

Use a prefixed bearer (`yrd_` plus 43 base64url characters) to distinguish device tokens without weakening constant-time hash comparison. Preserve the environment-token principal for legacy host batches. Return:

```ts
export type BrowserRunnerPrincipal =
  | { kind: "legacy_host"; id: string; market: "CN"; locale: "zh-CN"; timezone: "Asia/Shanghai" }
  | {
      kind: "browser_extension";
      id: string;
      market: "CN";
      locale: "zh-CN";
      timezone: "Asia/Shanghai";
      allowedBrandIds: readonly string[];
      supportedSurfaces: readonly BrowserExtensionSurface[];
    };
```

Every task route awaits authentication before parsing its body. Service methods assert the requested brand is assigned and requested surfaces are a subset of device capabilities.

- [ ] **Step 4: Implement pair and heartbeat routes**

Pair consumes `{ code, extensionVersion, browserFamily, platform, supportedSurfaces }` and returns `{ deviceId, deviceToken, allowedBrandIds }` once with `Cache-Control: no-store`. Heartbeat updates bounded coarse readiness only and returns server time plus the active feature version.

- [ ] **Step 5: Regenerate routes and verify**

Run:

```bash
pnpm --filter @workspace/web exec vitest run --project=unit src/server/browser-runner-devices.test.ts src/server/browser-runner-auth.test.ts src/routes/api/internal/browser-runner/v1/tasks/-claim.test.ts
pnpm --filter @workspace/web check-types
```

Expected: tests and typecheck PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/server/browser-runner-devices.ts apps/web/src/server/browser-runner-devices.test.ts apps/web/src/server/browser-runner-auth.ts apps/web/src/server/browser-runner-auth.test.ts apps/web/src/routes/api/internal/browser-runner/v1 apps/web/src/routeTree.gen.ts
git commit -m "feat: authenticate paired browser extensions"
```

---

### Task 4: Generalize Browser Runner tasks to Doubao and DeepSeek

**Files:**
- Modify: `packages/lib/src/db/browser-runner.ts`
- Create: `packages/lib/src/db/browser-runner-extension.test.ts`
- Modify: `packages/lib/src/browser-runner-policy.ts`
- Modify: `apps/web/src/server/sampling-browser-runner-protocol.ts`
- Modify: `apps/web/src/server/sampling-browser-runner-protocol.test.ts`
- Modify: `apps/web/src/server/browser-runner-service.ts`
- Modify: `apps/web/src/server/browser-runner-service.test.ts`
- Modify: `apps/web/src/server/sampling-observation.ts`
- Modify: `apps/web/src/server/sampling-observation.test.ts`

**Interfaces:**
- `claimRunnerTask(input, principal)` supports a capability subset of Doubao and DeepSeek.
- `completeRunnerTask(taskId, input, principal)` validates one page-snapshot artifact for extension routes and two legacy artifacts for frozen host routes.
- Consumed by: Tasks 5, 7, and 10.

- [ ] **Step 1: Write failing protocol tests**

```ts
it("accepts one extension batch containing Doubao and DeepSeek", () => {
  expect(() =>
    assertSamplingBrowserRunnerProtocol("browser_runner", [
      {
        surfaceTargetKey: "doubao.consumer_web",
        captureRouteKey: "browser_extension.doubao",
        sessionRequirement: "dedicated_sampling_profile",
        searchRequirement: "platform_default",
      },
      {
        surfaceTargetKey: "deepseek.consumer_web",
        captureRouteKey: "browser_extension.deepseek",
        sessionRequirement: "dedicated_sampling_profile",
        searchRequirement: "platform_default",
      },
    ]),
  ).not.toThrow();
});

it("requires one page snapshot for extension completion", () => {
  expect(() =>
    assertBrowserRunnerEvidenceSelection(
      "browser_extension.deepseek",
      [{ id: "html", kind: "page_snapshot" }],
      ["html"],
    ),
  ).not.toThrow();
});
```

Add a DB policy test proving a device that declares only DeepSeek cannot claim a Doubao task, and a mixed-capability device claims both surfaces without touching legacy batches.

- [ ] **Step 2: Verify RED**

Run:

```bash
pnpm --filter @workspace/lib exec vitest run src/browser-runner-policy.test.ts
pnpm --filter @workspace/web exec vitest run --project=unit src/server/sampling-browser-runner-protocol.test.ts src/server/browser-runner-service.test.ts
```

Expected: FAIL because the protocol is Doubao-only and evidence is hard-coded to two artifacts.

- [ ] **Step 3: Generalize surface/route matching**

Replace hard-coded Doubao filters with exact approved pairs:

```ts
const EXTENSION_TARGETS = new Map([
  ["doubao.consumer_web", "browser_extension.doubao"],
  ["deepseek.consumer_web", "browser_extension.deepseek"],
]);
```

Claims use only surfaces present in both the request and authenticated principal. Claim responses choose the correct launch URL. Existing `browser_runner.doubao` claims remain available only to the legacy host principal.

- [ ] **Step 4: Make completion evidence route-aware**

For extension routes, require exactly one staged `page_snapshot` with UTF-8 HTML and no screenshot. For `browser_runner.doubao`, retain exactly one screenshot plus one page snapshot. Keep `answerHtml` mandatory in the complete payload and feed it to `buildBrowserRunnerResponseSnapshotDraft`.

- [ ] **Step 5: Verify focused and full tests**

Run:

```bash
pnpm --filter @workspace/lib test
pnpm --filter @workspace/web exec vitest run --project=unit src/server/sampling-browser-runner-protocol.test.ts src/server/browser-runner-service.test.ts src/server/sampling-observation.test.ts
pnpm --filter @workspace/web check-types
```

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/lib/src/db/browser-runner.ts packages/lib/src/browser-runner-policy.ts apps/web/src/server/sampling-browser-runner-protocol.ts apps/web/src/server/sampling-browser-runner-protocol.test.ts apps/web/src/server/browser-runner-service.ts apps/web/src/server/browser-runner-service.test.ts apps/web/src/server/sampling-observation.ts apps/web/src/server/sampling-observation.test.ts
git commit -m "feat: run Doubao and DeepSeek extension tasks"
```

---

### Task 5: Atomic administrator Run now orchestration

**Files:**
- Create: `apps/web/src/server/sampling-run-now-policy.ts`
- Create: `apps/web/src/server/sampling-run-now-policy.test.ts`
- Modify: `apps/web/src/server/sampling.ts`
- Create: `apps/web/src/server/sampling-run-now.test.ts`

**Interfaces:**
- Produces `planSamplingRunNow(input): SamplingRunNowPlan`.
- Produces platform-only server function `runSamplingNowFn`.
- Consumed by: Task 6.

- [ ] **Step 1: Write failing planning tests**

```ts
it("plans exactly five tasks per enabled prompt and selected channel", () => {
  const plan = planSamplingRunNow({
    promptIds: ["p1", "p2"],
    surfaces: ["doubao.consumer_web", "deepseek.consumer_web"],
    now: new Date("2026-08-16T08:00:00.000Z"),
  });
  expect(plan.samplesPerPrompt).toBe(5);
  expect(plan.taskCount).toBe(20);
  expect(new Set(plan.tasks.map((task) => `${task.promptId}:${task.surfaceTargetKey}:${task.sampleIndex}`)).size).toBe(20);
});

it("rejects customer identities even when they are brand owners", async () => {
  await expect(runSamplingNowAs(customerOwnerSession)).rejects.toThrow(/platform administrator/i);
});
```

Add tests for zero enabled Prompts, duplicate surfaces, unsupported surfaces, more than 10,000 tasks, idempotent retries, concurrent starts, and a device-offline batch remaining valid and waiting.

- [ ] **Step 2: Verify RED**

Run: `pnpm --filter @workspace/web exec vitest run --project=unit src/server/sampling-run-now-policy.test.ts src/server/sampling-run-now.test.ts`

Expected: FAIL because no Run now policy/function exists.

- [ ] **Step 3: Implement the pure plan**

The plan fixes:

```ts
export const SAMPLING_RUN_NOW_SAMPLES = 5;
export const SAMPLING_RUN_NOW_WINDOW_HOURS = 24;
```

It creates `platform_default`, `dedicated_sampling_profile`, `scored` tasks with route keys derived from Task 1 and a Beijing-time 24-hour measurement window beginning at request time.

- [ ] **Step 4: Implement idempotent create/freeze/start orchestration**

Add a `POST` server function accepting:

```ts
{
  brandId: string;
  scopeId: string;
  surfaces: BrowserExtensionSurface[];
  idempotencyKey: string;
}
```

It requires the feature flag and global platform-admin identity, reads all enabled Prompts from the selected manual scored Program, creates the exact task matrix, freezes, starts, then rereads the batch. If a concurrent retry advances the same idempotency key, return the current running batch; if any frozen identity differs, fail closed.

- [ ] **Step 5: Verify**

Run:

```bash
pnpm --filter @workspace/web exec vitest run --project=unit src/server/sampling-run-now-policy.test.ts src/server/sampling-run-now.test.ts
pnpm --filter @workspace/web test
pnpm --filter @workspace/web check-types
```

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/server/sampling-run-now-policy.ts apps/web/src/server/sampling-run-now-policy.test.ts apps/web/src/server/sampling-run-now.test.ts apps/web/src/server/sampling.ts
git commit -m "feat: start domestic sampling from the Portal"
```

---

### Task 6: Portal Run now and local device management UI

**Files:**
- Create: `apps/web/src/components/sampling/sampling-run-now-dialog.tsx`
- Create: `apps/web/src/components/sampling/sampling-run-now-dialog.test.tsx`
- Create: `apps/web/src/components/sampling/browser-runner-device-list.tsx`
- Create: `apps/web/src/components/sampling/browser-runner-device-list.test.tsx`
- Modify: `apps/web/src/components/sampling/types.ts`
- Modify: `apps/web/src/routes/_authed/admin/sampling/index.tsx`
- Create: `apps/web/src/routes/_authed/admin/sampling/devices.tsx`
- Modify (generated): `apps/web/src/routeTree.gen.ts`

**Interfaces:**
- Consumes `runSamplingNowFn`, pairing/list/revoke server functions, and current Sampling batch summaries.
- Produces platform-only **Run now** and **Local collection devices** experiences.

- [ ] **Step 1: Write failing rendering and interaction tests**

```tsx
it("shows the fixed five-sample task estimate", () => {
  const markup = renderToStaticMarkup(
    <SamplingRunNowDialog
      promptCount={60}
      availableSurfaces={["doubao.consumer_web", "deepseek.consumer_web"]}
      runnerOnline={true}
      onRun={async () => undefined}
    />,
  );
  expect(markup).toContain("60 × 2 × 5");
  expect(markup).toContain("600 tasks");
  expect(markup).not.toContain("samples per prompt");
});

it("renders an offline device as waiting rather than failed", () => {
  const markup = renderToStaticMarkup(<BrowserRunnerDeviceList devices={[offlineDevice]} />);
  expect(markup).toContain("Offline");
  expect(markup).toContain("Queued batches will wait");
});
```

Add tests that customer routes contain neither action, pairing codes are shown once with a copy action, revocation requires confirmation, and channel readiness uses no account PII.

- [ ] **Step 2: Verify RED**

Run: `pnpm --filter @workspace/web exec vitest run --project=unit src/components/sampling/sampling-run-now-dialog.test.tsx src/components/sampling/browser-runner-device-list.test.tsx`

Expected: FAIL because the components do not exist.

- [ ] **Step 3: Implement the Run now dialog**

Use the selected Program's enabled Prompt count, fixed five-sample copy, surface checkboxes, readiness badges, and exact task estimate. The primary action calls only `runSamplingNowFn`; it does not call create/freeze/start separately from the browser.

- [ ] **Step 4: Implement device management**

List device name, OS, Chrome version, extension version, last heartbeat, supported surfaces, coarse readiness, active concurrency, and revoke action. Add a pairing dialog that displays the single-use code and its 15-minute expiry without writing it to logs or query strings.

- [ ] **Step 5: Verify UI and routes**

Run:

```bash
pnpm --filter @workspace/web exec vitest run --project=unit src/components/sampling/sampling-run-now-dialog.test.tsx src/components/sampling/browser-runner-device-list.test.tsx src/components/sampling/sampling-batch-list.test.tsx
pnpm --filter @workspace/web check-types
```

Expected: tests and typecheck PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/sampling/sampling-run-now-dialog.tsx apps/web/src/components/sampling/sampling-run-now-dialog.test.tsx apps/web/src/components/sampling/browser-runner-device-list.tsx apps/web/src/components/sampling/browser-runner-device-list.test.tsx apps/web/src/components/sampling/types.ts apps/web/src/routes/_authed/admin/sampling/index.tsx apps/web/src/routes/_authed/admin/sampling/devices.tsx apps/web/src/routeTree.gen.ts
git commit -m "feat: add Run now and local device controls"
```

---

### Task 7: Manifest V3 extension scaffold, pairing, and API client

**Files:**
- Create: `apps/browser-extension/package.json`
- Create: `apps/browser-extension/tsconfig.json`
- Create: `apps/browser-extension/manifest.json`
- Create: `apps/browser-extension/scripts/build.ts`
- Create: `apps/browser-extension/src/contracts.ts`
- Create: `apps/browser-extension/src/storage.ts`
- Create: `apps/browser-extension/src/storage.test.ts`
- Create: `apps/browser-extension/src/api-client.ts`
- Create: `apps/browser-extension/src/api-client.test.ts`
- Create: `apps/browser-extension/src/background.ts`
- Create: `apps/browser-extension/src/popup.html`
- Create: `apps/browser-extension/src/popup.ts`
- Create: `apps/browser-extension/src/popup.css`
- Modify: `pnpm-lock.yaml`

**Interfaces:**
- Produces `DeviceStorage`, `BrowserRunnerApiClient`, the Manifest V3 background entry, and the popup pairing/status UI.
- Consumed by: Tasks 8–10.

- [ ] **Step 1: Add the test-only package scaffold**

Create `package.json` and `tsconfig.json` before production source so the RED tests can run:

```json
{
  "name": "@workspace/browser-extension",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "check-types": "tsc --noEmit",
    "build": "tsx scripts/build.ts"
  },
  "devDependencies": {
    "@types/chrome": "^0.1.31",
    "esbuild": "^0.28.1",
    "tsx": "^4.23.1",
    "typescript": "^7.0.2",
    "vitest": "^4.1.10"
  }
}
```

- [ ] **Step 2: Write failing storage and API tests**

```ts
test("never sends the device token to a non-Portal origin", async () => {
  const calls: Request[] = [];
  const client = new BrowserRunnerApiClient({
    baseUrl: "https://portal.yonaris.com",
    token: "yrd_secret",
    fetch: async (request) => {
      calls.push(request);
      return Response.json({ serverTime: "2026-08-16T00:00:00.000Z" });
    },
  });
  await client.heartbeat(readyHeartbeat);
  expect(calls[0]?.url).toBe("https://portal.yonaris.com/api/internal/browser-runner/v1/device/heartbeat");
  expect(calls[0]?.headers.get("Authorization")).toBe("Bearer yrd_secret");
});

test("persists only device configuration and task journal metadata", async () => {
  await storage.saveJournal({ taskId: "task-1", phase: "submitted", answerText: undefined });
  expect(JSON.stringify(await storage.dump())).not.toContain("answerText");
});
```

- [ ] **Step 3: Verify RED**

Run: `pnpm --filter @workspace/browser-extension test`

Expected: FAIL because the package and source files do not exist.

- [ ] **Step 4: Implement the extension build and least-privilege manifest**

Use Manifest V3 with permissions `storage`, `alarms`, `tabs`, `scripting`, and `notifications`; host permissions are limited to `https://portal.yonaris.com/*`, `https://*.doubao.com/*`, and `https://chat.deepseek.com/*`. Build service worker, popup, and content scripts with esbuild into `dist/` and copy a deterministic manifest without inline or remote code.

- [ ] **Step 5: Implement pairing, token storage, heartbeat, and task API**

The popup accepts a pairing code and Portal base URL, exchanges it once, then stores `{ deviceId, deviceToken, allowedBrandIds }` in `chrome.storage.local`. The API client sets `redirect: "error"`, `Cache-Control: no-store`, bounded timeouts, and the bearer header only for the exact configured Portal origin.

- [ ] **Step 6: Verify extension package**

Run:

```bash
pnpm install --lockfile-only
pnpm --filter @workspace/browser-extension test
pnpm --filter @workspace/browser-extension check-types
pnpm --filter @workspace/browser-extension build
```

Expected: tests, typecheck, and build PASS; `dist/manifest.json` has no wildcard all-URL permission.

- [ ] **Step 7: Commit**

```bash
git add apps/browser-extension pnpm-lock.yaml
git commit -m "feat: scaffold paired browser extension runner"
```

---

### Task 8: Doubao and DeepSeek content adapters

**Files:**
- Create: `apps/browser-extension/src/adapters/contracts.ts`
- Create: `apps/browser-extension/src/adapters/dom-port.ts`
- Create: `apps/browser-extension/src/adapters/doubao.ts`
- Create: `apps/browser-extension/src/adapters/doubao.test.ts`
- Create: `apps/browser-extension/src/adapters/deepseek.ts`
- Create: `apps/browser-extension/src/adapters/deepseek.test.ts`
- Create: `apps/browser-extension/src/adapters/content-entry.ts`
- Create: `apps/browser-extension/src/selector-contracts/doubao-web-v1.json`
- Create: `apps/browser-extension/src/selector-contracts/deepseek-web-v1.json`

**Interfaces:**
- Produces `ConsumerWebAdapter`, `CollectedAnswer`, `createDoubaoAdapter(port)`, and `createDeepSeekAdapter(port)`.
- Consumed by: Task 9.

- [ ] **Step 1: Write failing adapter fixture tests**

```ts
test("DeepSeek extracts only the answer created after this task", async () => {
  const port = fixturePort({ beforeAnswers: [oldAnswer], afterAnswers: [oldAnswer, currentAnswer] });
  const adapter = createDeepSeekAdapter(port);
  await adapter.openNewConversation();
  await adapter.prepare("Prompt A");
  await adapter.submitOnce("Prompt A");
  await adapter.confirmSubmitted("Prompt A");
  expect(await adapter.collectCurrentAnswer()).toMatchObject({ answerText: "Current answer" });
});

test("Doubao fails closed when new conversation is ambiguous", async () => {
  const adapter = createDoubaoAdapter(fixturePort({ newConversationMatches: 2 }));
  await expect(adapter.openNewConversation()).rejects.toMatchObject({ code: "page_drift" });
});

test("neither search marker records unknown rather than false", async () => {
  const answer = await createDeepSeekAdapter(fixturePort({ searchUsed: false, explicitNoSearch: false })).collectCurrentAnswer();
  expect(answer.webSearchObserved).toBeNull();
});
```

Add tests for signed-out, CAPTCHA/challenge, rate limit, unique composer, exact user-message confirmation, streaming completion, short valid answers, no brand mention, citations, visible query fan-out, and answer-container HTML bounds.

- [ ] **Step 2: Verify RED**

Run: `pnpm --filter @workspace/browser-extension exec vitest run src/adapters/doubao.test.ts src/adapters/deepseek.test.ts`

Expected: FAIL because adapters do not exist.

- [ ] **Step 3: Implement the DOM-port abstraction and adapters**

Content scripts translate real DOM operations into a narrow port. Selector contracts carry an explicit adapter version and approved stable selectors. Adapters count answer containers before submission, require the exact frozen user message, wait for an approved completion state plus stable text, then return only the new current answer container.

- [ ] **Step 4: Enforce output privacy**

Remove scripts, forms, iframe/object/embed nodes, event attributes, remote styles, and non-answer ancestors before sending HTML. Do not read or transmit cookies, local storage, account labels, sidebar history, or unrelated page text.

- [ ] **Step 5: Verify adapters and build**

Run:

```bash
pnpm --filter @workspace/browser-extension test
pnpm --filter @workspace/browser-extension check-types
pnpm --filter @workspace/browser-extension build
```

Expected: all tests and build PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/browser-extension/src/adapters apps/browser-extension/src/selector-contracts
git commit -m "feat: automate Doubao and DeepSeek conversations"
```

---

### Task 9: Adaptive tab coordinator and exactly-once recovery

**Files:**
- Create: `apps/browser-extension/src/coordinator/concurrency.ts`
- Create: `apps/browser-extension/src/coordinator/concurrency.test.ts`
- Create: `apps/browser-extension/src/coordinator/journal.ts`
- Create: `apps/browser-extension/src/coordinator/journal.test.ts`
- Create: `apps/browser-extension/src/coordinator/task-runner.ts`
- Create: `apps/browser-extension/src/coordinator/task-runner.test.ts`
- Create: `apps/browser-extension/src/coordinator/poller.ts`
- Create: `apps/browser-extension/src/coordinator/poller.test.ts`
- Modify: `apps/browser-extension/src/background.ts`
- Modify: `apps/browser-extension/src/popup.ts`

**Interfaces:**
- Produces `AdaptiveSurfacePool`, `DurableTaskJournal`, `runClaimedTask`, and `pollStartedWork`.
- Consumed by: Task 10.

- [ ] **Step 1: Write failing concurrency tests**

```ts
test("starts at five and stays within one through ten", () => {
  const pool = new AdaptiveSurfacePool({ initial: 5, minimum: 1, maximum: 10 });
  expect(pool.current).toBe(5);
  for (let index = 0; index < 20; index += 1) pool.recordStableSuccess();
  expect(pool.current).toBe(10);
  pool.recordRateLimit();
  expect(pool.current).toBeLessThan(10);
  expect(pool.current).toBeGreaterThanOrEqual(1);
});

test("a durable submit intent prevents automatic resubmission after restart", async () => {
  const journal = journalWith({ taskId: "task-1", phase: "submit_intent" });
  const adapter = countingAdapter();
  await runClaimedTask(claim, { journal, adapter, api });
  expect(adapter.submitCount).toBe(0);
  expect(api.markedNeedsHuman).toBe(true);
});
```

Add tests for interleaving Prompts, separate channel pools, browser restart, service-worker suspension, pre-submit retry once, post-submit same-tab recovery, a lost tab becoming needs-human, another channel continuing, and local answer cleanup after durable acceptance.

- [ ] **Step 2: Verify RED**

Run: `pnpm --filter @workspace/browser-extension exec vitest run src/coordinator/concurrency.test.ts src/coordinator/journal.test.ts src/coordinator/task-runner.test.ts src/coordinator/poller.test.ts`

Expected: FAIL because coordinator modules do not exist.

- [ ] **Step 3: Implement adaptive pools and fair ordering**

Use separate pools keyed by surface. Begin at five. Increase only after a stable success window, decrease immediately on rate-limit evidence, and apply bounded exponential cooldown. Order queued claims by sample index then rotate Prompt IDs so identical samples do not burst together.

- [ ] **Step 4: Implement durable task phases**

Persist only:

```ts
type TaskJournalEntry = {
  taskId: string;
  batchId: string;
  surface: BrowserExtensionSurface;
  tabId: number;
  runnerSessionId: string;
  phase: "claimed" | "prepared" | "submit_intent" | "submitted" | "collected" | "uploaded";
  promptSha256: string;
  updatedAt: string;
};
```

No answer or HTML remains in storage after successful upload. Service-worker resume inspects this phase before acting and never calls `submitOnce` after `submit_intent`.

- [ ] **Step 5: Connect alarms, tabs, popup status, and notifications**

Use `chrome.alarms` for polling/heartbeat, `chrome.tabs` for controlled background tabs, and extension notifications for signed-out/challenge states. Browser closure simply stops heartbeats; the server leaves work queued or safely leased until expiry.

- [ ] **Step 6: Verify full extension package**

Run:

```bash
pnpm --filter @workspace/browser-extension test
pnpm --filter @workspace/browser-extension check-types
pnpm --filter @workspace/browser-extension build
```

Expected: all tests and build PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/browser-extension/src/coordinator apps/browser-extension/src/background.ts apps/browser-extension/src/popup.ts
git commit -m "feat: coordinate adaptive browser sampling"
```

---

### Task 10: Integrated snapshot, metric, and release gates

**Files:**
- Create: `e2e/tests/browser-extension-runner.spec.ts`
- Modify: `e2e/fixtures.ts`
- Modify: `e2e/seed.ts`
- Create: `apps/web/src/server/browser-extension-metric-regression.test.ts`
- Create: `apps/web/src/server/browser-extension-snapshot.test.ts`
- Modify: `.github/workflows/deploy-las.yaml`
- Create: `deploy/las/BROWSER-EXTENSION-RUNNER-RUNBOOK.md`
- Modify: `deploy/las/RESPONSE-SNAPSHOT-RUNBOOK.md`

**Interfaces:**
- Verifies the complete product flow with fake consumer surfaces and the real Portal/database/snapshot pipeline.
- Produces a versioned extension ZIP build artifact for operator installation; it does not enable automatic scheduling.

- [ ] **Step 1: Write failing end-to-end and regression tests**

```ts
test("platform admin starts a two-channel five-sample run and customer sees snapshots", async ({ adminPage, customerPage }) => {
  await adminPage.goto("/admin/sampling");
  await adminPage.getByRole("button", { name: "Run now" }).click();
  await adminPage.getByLabel("Doubao").check();
  await adminPage.getByLabel("DeepSeek").check();
  await expect(adminPage.getByText("3 × 2 × 5 = 30 tasks")).toBeVisible();
  await adminPage.getByRole("button", { name: "Start 30 tasks" }).click();
  await fakeExtension.drainStartedBatch();
  await customerPage.goto("/app/stepfun/prompts");
  await expect(customerPage.getByText("Response snapshot")).toBeVisible();
});
```

Add assertions that 30 successes produce 30 runs and 30 ready snapshots, a technical failure produces no run, a valid no-mention answer lowers Visibility, a snapshot failure does not alter Visibility, and a customer cannot call pairing or Run now server functions.

- [ ] **Step 2: Verify RED**

Run:

```bash
pnpm --filter @workspace/web exec vitest run --project=unit src/server/browser-extension-metric-regression.test.ts src/server/browser-extension-snapshot.test.ts
pnpm -C e2e exec playwright test tests/browser-extension-runner.spec.ts --project=fixtures
```

Expected: FAIL because the fake extension fixture and complete integrated flow do not exist.

- [ ] **Step 3: Add the fake extension integration fixture**

The fixture pairs through the real API, heartbeats, claims the exact frozen task matrix, records submit intent/confirmation, uploads one HTML page-snapshot artifact per task, and completes with deterministic Doubao/DeepSeek answers. It never opens real third-party sites.

- [ ] **Step 4: Add workflow release gates**

Build and test `@workspace/browser-extension` in E2E CI, scan `dist/manifest.json` for forbidden wildcard permissions, and upload `yonaris-browser-extension-<sha>.zip` as a build artifact. Do not deploy or activate it automatically. Add `apps/browser-extension/**` to the deployment workflow path filter so server/extension contract-only fixes receive the full gate.

- [ ] **Step 5: Write the operator runbook**

Document install, pairing, platform login, one-Prompt non-scored UAT, 30-task StepFun pilot, pause/resume, device revocation, adapter-version mismatch, and rollback. Explicitly state that daily scheduling remains disabled and that real-site UAT requires ordinary human login without CAPTCHA bypass.

- [ ] **Step 6: Run full verification**

Run:

```bash
pnpm --filter @workspace/lib test
pnpm --filter @workspace/web test
pnpm --filter @workspace/web check-types
pnpm --filter @workspace/browser-extension test
pnpm --filter @workspace/browser-extension check-types
pnpm --filter @workspace/browser-extension build
pnpm --filter @workspace/worker test
pnpm --filter @workspace/worker check-types
pnpm -C e2e exec tsc --noEmit
pnpm -C e2e exec playwright test --list --project=fixtures
pnpm --filter @workspace/lib exec drizzle-kit check
git diff --check
```

Expected: every command exits 0; extension tests contain zero failures; Drizzle reports a valid migration chain; Playwright lists the new fixture test.

- [ ] **Step 7: Commit**

```bash
git add e2e apps/web/src/server/browser-extension-metric-regression.test.ts apps/web/src/server/browser-extension-snapshot.test.ts .github/workflows/deploy-las.yaml deploy/las/BROWSER-EXTENSION-RUNNER-RUNBOOK.md deploy/las/RESPONSE-SNAPSHOT-RUNBOOK.md
git commit -m "test: gate local browser extension sampling"
```

---

## Plan self-review

- Every product requirement in the approved design maps to a task above.
- Device identity, brand scope, surface capability, task lease, tab identity, and snapshot identity are independently validated.
- The extension never receives database access or a Portal admin credential.
- Five-sample parity with overseas execution is fixed in policy and not user-configurable.
- Legacy Doubao host batches and their two-artifact evidence contract remain compatible.
- Standard extension batches store no screenshots.
- Exactly-once submission and failure/metric semantics are covered before real-site UAT.
- No task introduces recurring scheduling.
- The final gate builds an installable extension artifact but does not automatically activate it.
