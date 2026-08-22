# Domestic Search Evidence Qualification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce a safe, read-only, redacted evidence report from the six logged-in domestic platform tabs and establish the shared adapter boundary needed to implement exact per-platform search evidence collectors.

**Architecture:** Add a generic local-only probe command to the existing content script and expose it through an administrator-only extension action. The probe summarizes candidate search/source DOM structures without returning arbitrary answer text or raw HTML; its output becomes the evidence source for six exact platform adapter plans. In parallel, introduce a surface-specific search evidence adapter boundary that leaves existing answer and screenshot behavior unchanged.

**Tech Stack:** Chrome Manifest V3 extension, TypeScript, Vitest, LinkeDOM fixtures, existing ConsumerAdapter and DocumentDomPort.

**Spec:** `docs/superpowers/specs/2026-08-22-domestic-search-evidence-adapters-design.md`

## Global Constraints

- The probe is read-only: no Prompt submission, source-panel click, form fill, navigation, or network mutation.
- The probe output must not contain raw HTML, Prompt text, answer text, account identifiers, cookies, local storage, request bodies, or authorization data.
- Candidate text is represented only by normalized category, UTF-16 length, and SHA-256 hash.
- Only stable tag, class-token, ARIA-name, data-attribute-name, role, href-hostname, visibility, and relative answer position may leave the tab.
- The first plan does not guess provider selectors. Exact selector contracts are written only after the live report exists.
- Existing answer collection, v2 snapshots, and JPEG capture must remain unchanged.
- Search evidence drift must eventually degrade only the evidence component, not erase a valid answer.

---

### Task 1: Define the redacted local probe contract

**Files:**
- Create: `apps/browser-extension/src/adapters/evidence-probe.ts`
- Create: `apps/browser-extension/src/adapters/evidence-probe.test.ts`

**Interfaces:**
- Produces: `probeSearchEvidenceCandidates(document, input): Promise<SearchEvidenceProbeReport>`.
- Produces a serializable report with no raw DOM or text values.

- [ ] **Step 1: Write failing redaction and candidate tests**

Define the wished-for public types:

```ts
export type SearchEvidenceProbeInput = {
  surface: BrowserExtensionSurface;
  answerSelector: string;
  candidateTextPattern: string;
  maximumCandidates: number;
};

export type SearchEvidenceProbeCandidate = {
  relation: "inside_latest_answer" | "adjacent_to_latest_answer" | "page_other";
  tag: string;
  role: string | null;
  classTokens: string[];
  ariaNames: string[];
  dataAttributeNames: string[];
  hrefHostname: string | null;
  visible: boolean;
  textCategory: "search" | "source" | "citation" | "reference" | "unknown";
  textLength: number;
  textSha256: string;
};

export type SearchEvidenceProbeReport = {
  schemaVersion: 1;
  surface: BrowserExtensionSurface;
  adapterVersion: string;
  pageUrlShape: string;
  answerCount: number;
  candidates: SearchEvidenceProbeCandidate[];
  truncated: boolean;
};
```

Use a fixture containing a fake Prompt, answer, email address, bearer token, hidden source card, visible search button, citation anchor, sidebar source link, and data attributes. Assert serialized output does not contain any fixture text, email, token, raw href path/query, or data attribute value. Assert it retains only the citation hostname and approved structural names.

- [ ] **Step 2: Run the focused test and verify RED**

```powershell
pnpm --filter @workspace/browser-extension test -- src/adapters/evidence-probe.test.ts
```

Expected: module not found.

- [ ] **Step 3: Implement the probe**

Candidate discovery is bounded to:

- elements within the latest visible answer;
- the latest answer's previous and next element siblings;
- visible buttons, links, and elements whose visible text matches the caller's approved search/source/reference pattern;
- at most 200 candidates after deterministic document-order sorting.

Hash text with `crypto.subtle.digest("SHA-256", new TextEncoder().encode(normalizedText))`. Reduce URLs to `new URL(href).hostname`; invalid and non-HTTP(S) hrefs produce null. Return only attribute names beginning with `data-`, never values. Replace page URLs with `https://hostname/<segment-shape>?<sorted-query-key-names>`.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run the command from Step 2.

- [ ] **Step 5: Commit the probe contract**

```powershell
git add apps/browser-extension/src/adapters/evidence-probe.ts apps/browser-extension/src/adapters/evidence-probe.test.ts
git commit -m "add redacted domestic evidence probe"
```

### Task 2: Add a read-only content-script probe command

**Files:**
- Modify: `apps/browser-extension/src/adapters/content-entry.ts`
- Modify: `apps/browser-extension/src/adapters/content-entry.test.ts`
- Modify: `apps/browser-extension/src/surface-registry.ts`
- Modify: `apps/browser-extension/src/surface-registry.test.ts`

**Interfaces:**
- Adds adapter command: `{ kind: "yonaris_adapter", action: "inspect_search_candidates" }`.
- Returns: `SearchEvidenceProbeReport` from Task 1.

- [ ] **Step 1: Write failing command tests**

For every non-Doubao domestic surface, use a real content listener fixture and assert:

- the command resolves the active surface definition from the current URL;
- it calls no `click`, `fill`, `submit_once`, or `open_new_conversation` path;
- it rejects a URL that is outside the surface's approved conversation rule;
- it returns the exact redacted report from Task 1;
- Doubao is accepted by the generic command without invoking the existing qualification write path.

- [ ] **Step 2: Run content and registry tests and verify RED**

```powershell
pnpm --filter @workspace/browser-extension test -- src/adapters/content-entry.test.ts src/surface-registry.test.ts
```

Expected: `inspect_search_candidates` is rejected by `isAdapterCommand`.

- [ ] **Step 3: Implement the command**

Add a surface definition field:

```ts
probeTextPattern: string;
```

Use one conservative multilingual pattern for the first probe:

```ts
"搜索|联网|资料|来源|引用|参考|网页|search|source|citation|reference"
```

The command validates the live URL before and after `adapter.preflight()`, requires the exact URL to remain unchanged, then calls `probeSearchEvidenceCandidates`. It does not modify readiness.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run the command from Step 2.

- [ ] **Step 5: Commit the content command**

```powershell
git add apps/browser-extension/src/adapters/content-entry.ts apps/browser-extension/src/adapters/content-entry.test.ts apps/browser-extension/src/surface-registry.ts apps/browser-extension/src/surface-registry.test.ts
git commit -m "expose read-only search evidence inspection"
```

### Task 3: Expose an administrator-only probe action in the extension

**Files:**
- Modify: `apps/browser-extension/src/background.ts`
- Modify: `apps/browser-extension/src/background.test.ts`
- Modify: `apps/browser-extension/src/popup.ts`
- Modify: `apps/browser-extension/src/popup.test.ts`
- Modify: `apps/browser-extension/src/popup.html`

**Interfaces:**
- Adds runtime message: `{ type: "browser-runner:inspect-active-search-evidence" }`.
- Returns: `{ ok: true, report: SearchEvidenceProbeReport } | { ok: false, error: string }`.

- [ ] **Step 1: Write failing background and popup tests**

Tests prove:

- exactly one active supported conversation tab is required;
- the background forwards only `inspect_search_candidates` to that tab;
- no readiness, runner journal, task claim, evidence upload, or heartbeat state is changed;
- the popup renders a compact report summary and a `Copy redacted report` button;
- copied JSON does not contain raw HTML or text values;
- error messages distinguish no supported tab, multiple matching tabs, URL drift, and probe rejection.

- [ ] **Step 2: Run popup/background tests and verify RED**

```powershell
pnpm --filter @workspace/browser-extension test -- src/background.test.ts src/popup.test.ts
```

Expected: the runtime message and popup action are absent.

- [ ] **Step 3: Implement the action**

The popup label is `Inspect active search evidence (read only)`. Display only:

- surface and adapter version;
- page URL shape;
- answer and candidate counts;
- candidate relation/category/tag/role/class/attribute names/hostname;
- a copy button for the already-redacted report.

Do not display or copy candidate text hashes by default in the visible summary; hashes remain in copied JSON for fixture correlation.

- [ ] **Step 4: Run focused tests and type checking**

```powershell
pnpm --filter @workspace/browser-extension test -- src/background.test.ts src/popup.test.ts
pnpm --filter @workspace/browser-extension check-types
```

- [ ] **Step 5: Commit the administrator action**

```powershell
git add apps/browser-extension/src/background.ts apps/browser-extension/src/background.test.ts apps/browser-extension/src/popup.ts apps/browser-extension/src/popup.test.ts apps/browser-extension/src/popup.html
git commit -m "add administrator evidence inspection"
```

### Task 4: Add the surface-specific search evidence adapter boundary

**Files:**
- Modify: `apps/browser-extension/src/adapters/contracts.ts`
- Create: `apps/browser-extension/src/adapters/search-evidence-adapter.ts`
- Create: `apps/browser-extension/src/adapters/search-evidence-adapter.test.ts`
- Modify: `apps/browser-extension/src/adapters/consumer-adapter.ts`
- Modify: `apps/browser-extension/src/adapters/test-fixture.ts`
- Modify: `apps/browser-extension/src/adapters/dom-port.ts`
- Modify: `apps/browser-extension/src/adapters/doubao.ts`
- Modify: `apps/browser-extension/src/adapters/doubao.test.ts`
- Modify: `apps/browser-extension/src/api-client.ts`
- Modify: `apps/browser-extension/src/api-client.test.ts`
- Modify: `apps/web/src/server/sampling-observation.ts`
- Modify: `apps/web/src/server/sampling-observation.test.ts`
- Modify: `apps/web/src/server/browser-runner-snapshot-policy.ts`
- Modify: `apps/web/src/server/browser-runner-snapshot-policy.test.ts`
- Modify: `packages/lib/src/response-snapshots/contract.ts`
- Modify: `packages/lib/src/response-snapshots/contract.test.ts`

**Interfaces:**
- Produces: `SearchEvidenceAdapter` and `SearchEvidenceResult` from the approved design.
- Changes: `createConsumerAdapter(port, contract, evidenceAdapter?)`.
- Preserves: Doubao's existing counted structured extractor through a compatibility adapter.

- [ ] **Step 1: Write failing shared-boundary tests**

Use a real `ConsumerAdapter` plus `FixtureDomPort` to assert:

```ts
expect(collected.webSearchObserved).toBeNull();
expect(collected.webQueries).toEqual([]);
expect(collected.citations).toEqual([{ url: "https://example.com", title: "Visible source" }]);
```

when the injected evidence adapter returns `queryAvailability: "unknown"` but an independently valid citation. Add cases mapping `not_searched`, `unavailable`, and `exposed` to the existing observation fields. Add a regression proving an evidence adapter exception preserves the accepted answer and returns unknown evidence rather than throwing a post-submit task failure.

- [ ] **Step 2: Run shared adapter tests and verify RED**

```powershell
pnpm --filter @workspace/browser-extension test -- src/adapters/search-evidence-adapter.test.ts src/adapters/doubao.test.ts
```

Expected: the adapter interface is absent and current evidence exceptions fail collection.

- [ ] **Step 3: Implement the boundary**

Define:

```ts
export type SearchEvidenceResult = {
  webSearchObserved: boolean | null;
  queryAvailability: "exposed" | "unavailable" | "not_searched" | "unknown";
  webQueries: string[];
  citations: CollectedCitation[];
  diagnostics: {
    extractorVersion: string;
    evidenceSource: "dom" | "network" | "dom_and_network" | "none";
    searchBlockCount: number;
    queryCandidateCount: number;
    citationCandidateCount: number;
  };
};

export interface SearchEvidenceAdapter {
  readonly version: string;
  read(context: SearchEvidenceReadContext): Promise<SearchEvidenceResult>;
}
```

`SearchEvidenceReadContext` exposes the accepted answer element, document, approved visibility/text readers, and a scoped disclosure helper. It does not expose storage, cookies, or arbitrary extension APIs.

Normalize and validate the result in the shared layer. Add `queryAvailability` and `searchEvidenceDiagnostics` to `CollectedAnswer`; serialize them through `api-client.ts` into the strict `browser-runner-observation.v2` schema. Extend `captureDiagnostics` with the five approved search-evidence diagnostic fields, and persist those fields in `ResponseSnapshotCaptureDiagnostics`.

Extend the v2 snapshot `queryAvailability` contract so it can retain `not_searched` and `unknown` in addition to `available`, `unavailable`, and `not_applicable`. Map adapter values exactly:

```ts
const snapshotAvailability = {
  exposed: "available",
  unavailable: "unavailable",
  not_searched: "not_searched",
  unknown: "unknown",
} as const;
```

The legacy v1 path keeps its current three-value behavior. When `read()` throws, retain independently validated legacy direct citations, set search observed to null and queries to empty, set v2 query availability to `unknown`, and record `evidenceSource: "none"`. Do not change screenshot capture ordering.

- [ ] **Step 4: Adapt Doubao and verify no behavior change**

Wrap the existing `readStructuredSearchEvidence` path in a Doubao `SearchEvidenceAdapter`. Existing exact summary count, query, citation, disclosure, and screenshot-restore tests must pass unchanged.

- [ ] **Step 5: Run focused tests and type checking**

```powershell
pnpm --filter @workspace/browser-extension test -- src/adapters/search-evidence-adapter.test.ts src/adapters/doubao.test.ts src/adapters/doubao-search-evidence.test.ts
pnpm --filter @workspace/browser-extension check-types
pnpm --filter @workspace/web test -- src/server/sampling-observation.test.ts src/server/browser-runner-snapshot-policy.test.ts
pnpm --filter @workspace/lib test -- src/response-snapshots/contract.test.ts
```

- [ ] **Step 6: Commit the adapter boundary**

```powershell
git add apps/browser-extension/src/adapters/contracts.ts apps/browser-extension/src/adapters/search-evidence-adapter.ts apps/browser-extension/src/adapters/search-evidence-adapter.test.ts apps/browser-extension/src/adapters/consumer-adapter.ts apps/browser-extension/src/adapters/test-fixture.ts apps/browser-extension/src/adapters/dom-port.ts apps/browser-extension/src/adapters/doubao.ts apps/browser-extension/src/adapters/doubao.test.ts apps/browser-extension/src/api-client.ts apps/browser-extension/src/api-client.test.ts apps/web/src/server/sampling-observation.ts apps/web/src/server/sampling-observation.test.ts apps/web/src/server/browser-runner-snapshot-policy.ts apps/web/src/server/browser-runner-snapshot-policy.test.ts packages/lib/src/response-snapshots/contract.ts packages/lib/src/response-snapshots/contract.test.ts
git commit -m "separate domestic search evidence adapters"
```

### Task 5: Run six live read-only probes and write exact adapter plans

**Files:**
- Create after probing: `docs/evidence/2026-08-22-domestic-search-evidence-probes.json`
- Create after probing: `docs/superpowers/plans/2026-08-22-deepseek-search-evidence-adapter.md`
- Create after probing: `docs/superpowers/plans/2026-08-22-qwen-search-evidence-adapter.md`
- Create after probing: `docs/superpowers/plans/2026-08-22-kimi-search-evidence-adapter.md`
- Create after probing: `docs/superpowers/plans/2026-08-22-wenxin-search-evidence-adapter.md`
- Create after probing: `docs/superpowers/plans/2026-08-22-yuanbao-search-evidence-adapter.md`
- Create after probing: `docs/superpowers/plans/2026-08-22-zhipu-search-evidence-adapter.md`

**Interfaces:**
- Consumes: exact packaged extension containing Tasks 1-4 and six logged-in completed conversation tabs.
- Produces: six exact selector/network evidence plans with no guessed selectors.

- [ ] **Step 1: Build and package the exact diagnostic extension**

Run targeted extension tests, type checking, and the deterministic build. Record the extension version and package SHA-256. Install that exact unpacked/package artifact on the paired local computer.

- [ ] **Step 2: Inspect one completed answer per surface**

For DeepSeek, Qwen, Kimi, Wenxin, Yuanbao, and Zhipu, activate exactly one approved conversation tab and invoke `Inspect active search evidence (read only)`. Copy the six redacted reports into one JSON array. Do not submit new Prompts during this step.

- [ ] **Step 3: Review privacy and structural completeness**

Reject the report if it contains arbitrary visible text, raw HTML, URL paths/query values, account identifiers, or secrets. Confirm each candidate required to select a search indicator/source panel is represented by structural names. If a platform has no DOM candidate for query text, record `network_probe_required: true` for that surface; do not guess a selector.

- [ ] **Step 4: Commit the redacted evidence report**

```powershell
git add docs/evidence/2026-08-22-domestic-search-evidence-probes.json
git commit -m "record domestic search evidence structures"
```

- [ ] **Step 5: Write six exact per-platform TDD plans**

Each plan must contain literal selectors or a literal network event schema derived from the report, a minimal redacted DOM/network fixture, the expected search-state/query/citation result, adapter version bump, exact focused test command, one-Prompt canary, and ten-Prompt production validation. A platform with insufficient probe evidence remains unapproved and gets a bounded additional read-only probe task rather than an invented implementation.

- [ ] **Step 6: Commit the exact adapter plans**

```powershell
git add docs/superpowers/plans/2026-08-22-deepseek-search-evidence-adapter.md docs/superpowers/plans/2026-08-22-qwen-search-evidence-adapter.md docs/superpowers/plans/2026-08-22-kimi-search-evidence-adapter.md docs/superpowers/plans/2026-08-22-wenxin-search-evidence-adapter.md docs/superpowers/plans/2026-08-22-yuanbao-search-evidence-adapter.md docs/superpowers/plans/2026-08-22-zhipu-search-evidence-adapter.md
git commit -m "plan qualified domestic search adapters"
```
