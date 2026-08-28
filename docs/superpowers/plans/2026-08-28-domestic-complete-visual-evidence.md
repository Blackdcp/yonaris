# Domestic Complete Visual Evidence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan.

**Goal:** Capture the complete visible answer for domestic Browser Runner observations without broad browser permissions, while ensuring evidence failures never block an otherwise valid observation.

**Architecture:** Keep answer extraction authoritative and add a separate, best-effort visual-evidence pipeline. A content-script capture session scrolls the verified answer container and returns viewport crop instructions; the coordinator captures only visible tabs, crops every frame locally, optionally composes a primary long image, uploads bounded artifacts, and completes with an additive `browser-runner-observation.v3` manifest. The server accepts both v2 and v3, persists observations independently from evidence, and exposes complete/partial/unavailable evidence to customer views and snapshot exports.

**Tech Stack:** TypeScript 7, Chrome Manifest V3 APIs, Vitest, Zod, TanStack Start/React, Drizzle/PostgreSQL, pnpm.

**Spec:** `docs/superpowers/specs/2026-08-28-domestic-complete-visual-evidence-design.md`

## Global Constraints

- Do not request Chrome `debugger`, `cookies`, `webRequest`, or `<all_urls>` permissions.
- Never upload or persist an uncropped browser viewport.
- Preserve existing `browser-runner-observation.v2` completion behavior during rollout.
- Cap a session at 18 segments, 64 CSS px overlap, 2 captures/second, 1 MiB/segment, 4 MiB/composite, and 6 MiB total/task.
- Evidence capture/upload/composition failures must not call the task-failure endpoint or rerun the prompt.
- Preserve and restore the page scroll position and every temporary style mutation in a `finally` path.
- Ignore the pre-existing untracked `packages/lib/.auth-generator-test-ydaroU/` directory.

---

## Task 1: Add the v3 visual-evidence protocol

**Files:**

- Modify: `packages/lib/src/browser-extension-contract.ts`
- Modify: `packages/lib/src/browser-extension-contract.test.ts`
- Modify: `apps/browser-extension/src/coordinator/task-runner.ts`
- Modify: `apps/browser-extension/src/api-client.ts`
- Modify: `apps/browser-extension/src/api-client.test.ts`

- [ ] Add failing contract tests showing v3 accepts `complete`, `partial`, and `unavailable`, while rejecting duplicate IDs, count mismatches, invalid primary IDs, oversized artifacts, and aggregate payloads over 6 MiB.
- [ ] Run `packages/lib/node_modules/.bin/vitest.CMD run src/browser-extension-contract.test.ts` and confirm the new tests fail for the missing v3 validator.
- [ ] Add shared types:

```ts
export type BrowserRunnerVisualEvidence = {
  status: "complete" | "partial" | "unavailable";
  primaryArtifactId: string | null;
  segmentArtifactIds: string[];
  expectedSegmentCount: number;
  capturedSegmentCount: number;
};
```

- [ ] Implement a v3 validator that derives the ordered artifact union from `primaryArtifactId` plus `segmentArtifactIds`, checks role/count/size limits, and leaves the existing v2 assertion unchanged.
- [ ] Add failing API-client tests for ordered v3 artifact IDs, role-specific upload filenames, and a zero-artifact unavailable completion.
- [ ] Implement v3 request serialization and bounded JPEG uploads without changing credentials/origin policy.
- [ ] Re-run the two targeted test files and commit: `Add visual evidence v3 protocol`.

## Task 2: Build a reversible answer capture session

**Files:**

- Create: `apps/browser-extension/src/adapters/evidence-capture-session.ts`
- Create: `apps/browser-extension/src/adapters/evidence-capture-session.test.ts`
- Modify: `apps/browser-extension/src/adapters/contracts.ts`
- Modify: `apps/browser-extension/src/adapters/content-entry.ts`
- Modify: `apps/browser-extension/src/adapters/content-entry.test.ts`

- [ ] Add failing DOM tests for selecting the narrowest scroll container, producing 64 px-overlapped capture steps, clamping at 18 frames, hiding only overlapping fixed/sticky elements, and restoring scroll/styles after success and failure.
- [ ] Run the two focused adapter tests and observe the new cases fail.
- [ ] Define `begin_evidence_capture`, `advance_evidence_capture`, and `end_evidence_capture` commands with opaque session IDs and viewport crop rectangles.
- [ ] Implement the session against the already-verified prompt and answer selectors. Return only geometry/state metadata—never pixels or unrelated DOM content.
- [ ] Guarantee cleanup in `end` and on any session replacement; restore the original scroll position and inline styles exactly.
- [ ] Re-run focused adapter tests and commit: `Add reversible answer capture sessions`.

## Task 3: Capture, crop, and compose bounded evidence

**Files:**

- Modify: `apps/browser-extension/src/coordinator/screenshot.ts`
- Modify: `apps/browser-extension/src/coordinator/screenshot.test.ts`
- Modify: `apps/browser-extension/src/coordinator/chrome-tabs.ts`
- Modify: `apps/browser-extension/src/coordinator/chrome-tabs.test.ts`
- Modify: `apps/browser-extension/src/coordinator/test-fixture.ts`

- [ ] Add failing screenshot tests for 1 MiB adaptive segment encoding, overlap removal during composition, 4 MiB composite enforcement, aggregate 6 MiB enforcement, and refusal to expose raw viewport bytes.
- [ ] Add failing tab-driver tests proving each capture verifies the same approved active tab, rate-limits to 2 captures/second, always ends the content session, and returns complete/partial/unavailable evidence rather than throwing after answer collection.
- [ ] Implement a `CapturedVisualEvidence` result containing ordered cropped segment JPEGs and an optional composite JPEG.
- [ ] Reuse `captureVisibleTab`; crop immediately, release decoded viewport resources, and retain only answer-region JPEG bytes.
- [ ] Compose segments without duplicate overlap. If a complete composite cannot fit, preserve all bounded segments and return `partial` instead of removing middle frames.
- [ ] Re-run focused coordinator tests and commit: `Capture bounded multi-part answer evidence`.

## Task 4: Make evidence best-effort in task execution

**Files:**

- Modify: `apps/browser-extension/src/coordinator/task-runner.ts`
- Modify: `apps/browser-extension/src/coordinator/task-runner.test.ts`
- Modify: `apps/browser-extension/src/coordinator/journal.ts`
- Modify: `apps/browser-extension/src/coordinator/journal.test.ts`
- Modify: `apps/browser-extension/src/api-client.ts`
- Modify: `apps/browser-extension/src/api-client.test.ts`

- [ ] Add failing runner tests showing capture failure, individual segment upload failure, and composite failure still call `completeTask`, never call `failTask`, never resubmit the prompt, close the tab, and clear the journal after server acceptance.
- [ ] Add a restart test showing `collected` can resume completion without moving the durable journal backwards.
- [ ] Run the focused runner/journal/API tests and confirm the new cases fail.
- [ ] Split the answer-collection `try/catch` from the evidence pipeline. Convert evidence exceptions to `unavailable` or `partial` completion metadata.
- [ ] Upload the primary and segments in deterministic order; include only successfully uploaded artifact IDs and consistent counts.
- [ ] Permit the journal to advance from `collected` to completion cleanup even when no artifact reaches `uploaded`.
- [ ] Re-run focused tests and commit: `Keep observations successful when evidence fails`.

## Task 5: Accept v3 on the server without weakening v2

**Files:**

- Modify: `apps/web/src/server/browser-runner-service.ts`
- Modify: `apps/web/src/server/browser-runner-service.test.ts`
- Modify: `apps/web/src/server/sampling-observation.ts`
- Modify: `apps/web/src/server/sampling-observation.test.ts`
- Modify: `apps/web/src/server/browser-runner-snapshot-policy.ts`
- Modify: `apps/web/src/server/browser-runner-snapshot-policy.test.ts`
- Modify: `packages/api-spec/src/openapi.json`

- [ ] Add failing server tests for all three v3 states, ordered selection, primary/segment ownership, v2 exact-one compatibility, and zero-artifact completion only when v3 says unavailable.
- [ ] Run the focused service and observation tests and observe failure.
- [ ] Extend the Zod schema with a discriminated v2/v3 observation union. Validate declared IDs against uploaded artifacts and reject foreign, duplicated, missing, oversized, or wrongly typed artifacts.
- [ ] Persist the answer even when v3 evidence is unavailable. Attach any valid v3 artifacts in declared order and derive a primary visual reference only for complete evidence.
- [ ] Update snapshot policy so absence/partial evidence is a documented visual-evidence state rather than a failed observation.
- [ ] Update the internal OpenAPI schema additively.
- [ ] Re-run focused server tests and commit: `Accept partial browser visual evidence`.

## Task 6: Preserve all evidence in snapshots and customer views

**Files:**

- Modify: `packages/lib/src/response-snapshots/contract.ts`
- Modify: `packages/lib/src/response-snapshots/contract.test.ts`
- Modify: `packages/lib/src/response-snapshots/filesystem-storage.ts`
- Modify: `packages/lib/src/response-snapshots/filesystem-storage.test.ts`
- Modify: `apps/web/src/server/prompts.ts`
- Modify: `apps/web/src/server/customer-data-dto.ts`
- Modify: `apps/web/src/server/customer-data-dto.test.ts`
- Modify: `apps/web/src/server/response-snapshots.ts`
- Modify: `apps/web/src/server/response-snapshots.test.ts`
- Modify: `apps/web/src/components/response-snapshot-panel.tsx`
- Modify: `apps/web/src/components/response-snapshot-panel.test.tsx`

- [ ] Add failing snapshot tests proving v2 manifests still load, v3 complete/partial/unavailable manifests round-trip, ZIP exports contain composite plus every segment, and artifact order is stable.
- [ ] Add failing DTO/component tests for `完整证据`, `部分证据（n/m）`, and `暂无视觉证据`, with segments visible in order and no broken screenshot link when unavailable.
- [ ] Implement additive snapshot manifest fields and parsing while preserving existing v2 archives.
- [ ] Query all screenshot artifacts attached to the observation attempt, authorize each through the snapshot/brand/scope relationship, and serve only those declared by the manifest.
- [ ] Render a long-image primary view for complete evidence and an ordered segment gallery for partial evidence; keep raw account/profile chrome outside all artifacts.
- [ ] Re-run the focused snapshot/DTO/component tests and commit: `Show complete and partial visual evidence`.

## Task 7: Package and verify the release

**Files:**

- Create: `.changeset/<generated-name>.md`
- Verify: `apps/browser-extension/manifest.json`
- Verify: `apps/browser-extension/dist/**`
- Verify: `apps/web/public/downloads/**`

- [ ] Add a changeset covering the browser extension, web customer evidence display, and response snapshot export behavior.
- [ ] Run the focused regression suites from Tasks 1–6.
- [ ] Run browser extension type-check and build:

```powershell
pnpm.cmd --filter @workspace/browser-extension check-types
pnpm.cmd --filter @workspace/browser-extension build
```

- [ ] Confirm the built manifest contains no new broad permissions and package the extension through the existing web script.
- [ ] Run web/lib type checks or the narrowest available workspace checks covering changed files.
- [ ] Inspect `git diff --check`, `git status -sb`, and the final diff; ensure the unrelated auth-generator directory remains untouched.
- [ ] Commit: `Document complete domestic visual evidence`.
- [ ] Use `superpowers:verification-before-completion`, then `superpowers:finishing-a-development-branch` for final handoff.
