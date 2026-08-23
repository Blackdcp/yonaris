# Overseas Search Evidence Qualification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce a paid, explicit, redacted capability report for every supported overseas `(channel, provider)` route and persist explicit provider search-observed signals without inventing Fan-Out.

**Architecture:** Extend the provider result boundary with an optional observed-search signal, preserve it through the existing observation transaction, and add a guarded worker CLI that executes only validated provider/channel combinations. The CLI analyzes a provider result without printing raw answers or payload values, producing query/citation counts and a JSON key/type fingerprint that can drive a separate route-selection change.

**Tech Stack:** Node.js 24, TypeScript, Vitest, Node test runner, existing Yonaris provider registry, PostgreSQL observation persistence.

**Spec:** `docs/superpowers/specs/2026-08-22-overseas-search-evidence-routing-design.md`

## Global Constraints

- A Genuine Fan-Out query must be present in the same provider execution as the answer and differ from the submitted Prompt.
- Blank values, `unavailable`, and exact Prompt echoes are never Genuine Fan-Out.
- The qualification command is paid and must require an explicit acknowledgement before the first provider call.
- The report must not contain answer text, Prompt text, citation URLs, raw payload values, credentials, or authorization material.
- Unsupported provider/channel combinations must be rejected before a paid request.
- Provider output from separate executions must never be merged into one observation.
- No database migration is required for `web_search_observed`; the nullable column already exists.

---

### Task 1: Add an explicit observed-search provider result

**Files:**
- Modify: `packages/lib/src/providers/types.ts`
- Modify: `packages/lib/src/providers/registry/brightdata.ts`
- Modify: `packages/lib/src/providers/registry/brightdata.test.ts`
- Modify: `packages/lib/src/providers/registry/dataforseo.ts`
- Modify: `packages/lib/src/providers/registry/dataforseo.test.ts`
- Modify: `packages/lib/src/providers/registry/olostep.ts`
- Create: `packages/lib/src/providers/registry/olostep.test.ts`
- Modify: `packages/lib/src/providers/registry/oxylabs.ts`
- Modify: `packages/lib/src/providers/registry/oxylabs.test.ts`

**Interfaces:**
- Produces: `ScrapeResult.webSearchObserved?: boolean | null`.
- Consumes: provider-native explicit booleans, exposed queries, citations, and intrinsic search-surface identity.

- [ ] **Step 1: Write failing provider contract tests**

Add literal behavior cases proving:

```ts
expect(chatGptTriggered.webSearchObserved).toBe(true);
expect(chatGptNotTriggered.webSearchObserved).toBe(false);
expect(copilotWithoutNativeSignal.webSearchObserved).toBeNull();
expect(googleAiModeWithCitations.webSearchObserved).toBe(true);
expect(googleAiOverviewWithCitations.webSearchObserved).toBe(true);
expect(dataForSeoLlmWithFanOut.webSearchObserved).toBe(true);
expect(olostepWithSearchQueries.webSearchObserved).toBe(true);
expect(oxylabsWithSearchQueries.webSearchObserved).toBe(true);
```

The break caught is replacing explicit evidence with the requested `webSearch` flag, which would falsely label a provider call as observed search.

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```powershell
pnpm --filter @workspace/lib test -- src/providers/registry/brightdata.test.ts src/providers/registry/dataforseo.test.ts src/providers/registry/olostep.test.ts src/providers/registry/oxylabs.test.ts
```

Expected: assertions receive `undefined` because `ScrapeResult` and the provider adapters do not yet return `webSearchObserved`.

- [ ] **Step 3: Add the result field and evidence resolver**

Extend the interface exactly as follows:

```ts
export interface ScrapeResult {
  textContent: string;
  rawOutput: unknown;
  webQueries: string[];
  webSearchObserved?: boolean | null;
  citations: Citation[];
  modelVersion?: string;
  providerSubmissionId?: string;
  snapshotSource?: {
    captureMethod: "brightdata_dataset" | "brightdata_serp";
    contentSource: "native_answer_html" | "rendered_from_structured_response";
    answerHtml?: string;
    sourcePayloadSha256: string;
  };
}
```

Provider rules:

- BrightData ChatGPT uses `web_search_triggered` only when it is boolean.
- BrightData Google AI Mode/Overview returns `true` when answer-bound citations exist because those are intrinsic search surfaces.
- BrightData Copilot, Gemini, and Perplexity return `null` unless their payload adds an explicit boolean.
- DataForSEO LLM responses return `true` when `fan_out_queries` or citations exist, `false` only if the response contains an explicit false search signal, otherwise `null`.
- DataForSEO Google search surfaces return `true` when citations exist.
- OloStep and Oxylabs return `true` when exposed queries or citations prove search, otherwise `null`; they never infer false from an empty parser result.

- [ ] **Step 4: Run focused provider tests and verify GREEN**

Run the command from Step 2.

Expected: all focused provider tests pass and exact Prompt echoes remain unchanged in `webQueries` for read-time classification.

- [ ] **Step 5: Commit the provider contract**

```powershell
git add packages/lib/src/providers/types.ts packages/lib/src/providers/registry/brightdata.ts packages/lib/src/providers/registry/brightdata.test.ts packages/lib/src/providers/registry/dataforseo.ts packages/lib/src/providers/registry/dataforseo.test.ts packages/lib/src/providers/registry/olostep.ts packages/lib/src/providers/registry/olostep.test.ts packages/lib/src/providers/registry/oxylabs.ts packages/lib/src/providers/registry/oxylabs.test.ts
git commit -m "preserve provider search observation evidence"
```

### Task 2: Persist observed search through the worker transaction

**Files:**
- Modify: `apps/worker/src/jobs/process-prompt.ts`
- Modify: `apps/worker/src/jobs/process-overseas-run-call.test.ts`
- Modify: `apps/worker/src/jobs/process-prompt-snapshot-policy.ts`
- Modify: `apps/worker/src/jobs/process-prompt-snapshot-policy.test.ts`

**Interfaces:**
- Consumes: `ScrapeResult.webSearchObserved` from Task 1.
- Produces: `persistSuccessfulObservation({ webSearchObserved })` and snapshot query-availability semantics consistent with the stored sentinel.

- [ ] **Step 1: Write a failing persistence test**

Create a provider fixture returning:

```ts
{
  textContent: "Answer",
  rawOutput: { web_search_triggered: true },
  webSearchObserved: true,
  webQueries: ["expanded query"],
  citations: [{ url: "https://example.com/source", title: "Source", domain: "example.com", citationIndex: 0 }],
}
```

Assert that the argument received by the real observation persistence boundary contains `webSearchObserved: true`. Add a second case with `null` and assert it stays null rather than becoming the requested `webSearch=true`.

- [ ] **Step 2: Run the worker tests and verify RED**

```powershell
pnpm --filter @workspace/worker exec tsx --test src/jobs/process-overseas-run-call.test.ts src/jobs/process-prompt-snapshot-policy.test.ts
```

Expected: persistence arguments omit `webSearchObserved`.

- [ ] **Step 3: Thread the field through `process-prompt.ts`**

Destructure and pass the field without defaulting:

```ts
const {
  rawOutput,
  textContent,
  webSearchObserved,
  webQueries,
  citations: extractedCitations,
  modelVersion,
} = result;

await persistSuccessfulObservation({
  // existing fields
  webSearchObserved,
  webQueries,
});
```

Snapshot query availability continues to derive from `webQueries`: exposed values, the `unavailable` sentinel, or an empty array. Do not synthesize a query from `webSearchObserved=true`.

- [ ] **Step 4: Run focused worker tests and verify GREEN**

Run the command from Step 2.

- [ ] **Step 5: Commit persistence**

```powershell
git add apps/worker/src/jobs/process-prompt.ts apps/worker/src/jobs/process-overseas-run-call.test.ts apps/worker/src/jobs/process-prompt-snapshot-policy.ts apps/worker/src/jobs/process-prompt-snapshot-policy.test.ts
git commit -m "store overseas observed search state"
```

### Task 3: Build a redacted capability analyzer

**Files:**
- Create: `apps/worker/src/overseas-search-evidence-qualification.ts`
- Create: `apps/worker/src/overseas-search-evidence-qualification.test.ts`

**Interfaces:**
- Produces: `qualifyProviderResult(input: ProviderQualificationInput): ProviderQualificationResult`.
- Produces: `OVERSEAS_SEARCH_EVIDENCE_MATRIX`, the supported paid-call matrix.

- [ ] **Step 1: Write failing analyzer tests**

Define these public types in the test's wished-for API:

```ts
type ProviderQualificationInput = {
  channel: string;
  provider: string;
  captureRouteKey: string;
  prompt: string;
  latencyMs: number;
  result: ScrapeResult;
};

type ProviderQualificationResult = {
  channel: string;
  provider: string;
  captureRouteKey: string;
  latencyMs: number;
  answerPresent: boolean;
  webSearchObserved: boolean | null;
  rawQueryCount: number;
  exposedQueryCount: number;
  genuineQueryCount: number;
  citationCount: number;
  uniqueDomainCount: number;
  invalidCitationCount: number;
  responseShape: string[];
  providerSubmissionId: string | null;
  rawPayloadSha256: string;
};
```

Use literal fixtures to prove:

- `unavailable`, blank, duplicate, and Prompt-echo values do not increase `genuineQueryCount`;
- raw/exposed/genuine counts remain distinct;
- citation URLs and answer text never appear in serialized output;
- `responseShape` contains paths such as `$.web_search_query:array` and value types, never values;
- raw payload hashing is deterministic after JSON serialization;
- the matrix contains only combinations supported by each provider's `validateTarget` contract.

- [ ] **Step 2: Run analyzer tests and verify RED**

```powershell
pnpm --filter @workspace/worker exec tsx --test src/overseas-search-evidence-qualification.test.ts
```

Expected: module not found.

- [ ] **Step 3: Implement the pure analyzer**

Export:

```ts
export const OVERSEAS_SEARCH_EVIDENCE_PROMPT =
  "Compare current enterprise AI inference platforms using recent public sources.";

export const OVERSEAS_SEARCH_EVIDENCE_MATRIX = [
  { channel: "chatgpt.consumer_web", model: "chatgpt", provider: "brightdata" },
  { channel: "chatgpt.consumer_web", model: "chatgpt", provider: "dataforseo" },
  { channel: "chatgpt.consumer_web", model: "chatgpt", provider: "olostep" },
  { channel: "chatgpt.consumer_web", model: "chatgpt", provider: "oxylabs" },
  { channel: "copilot.consumer_web", model: "copilot", provider: "brightdata" },
  { channel: "copilot.consumer_web", model: "copilot", provider: "olostep" },
  { channel: "gemini.consumer_web", model: "gemini", provider: "brightdata" },
  { channel: "gemini.consumer_web", model: "gemini", provider: "dataforseo" },
  { channel: "gemini.consumer_web", model: "gemini", provider: "olostep" },
  { channel: "google_search.ai_mode", model: "google-ai-mode", provider: "brightdata" },
  { channel: "google_search.ai_mode", model: "google-ai-mode", provider: "dataforseo" },
  { channel: "google_search.ai_mode", model: "google-ai-mode", provider: "olostep" },
  { channel: "google_search.ai_mode", model: "google-ai-mode", provider: "oxylabs" },
  { channel: "google_search.ai_overview", model: "google-ai-overview", provider: "brightdata" },
  { channel: "google_search.ai_overview", model: "google-ai-overview", provider: "dataforseo" },
  { channel: "google_search.ai_overview", model: "google-ai-overview", provider: "olostep" },
  { channel: "google_search.ai_overview", model: "google-ai-overview", provider: "oxylabs" },
  { channel: "perplexity.consumer_web", model: "perplexity", provider: "brightdata" },
  { channel: "perplexity.consumer_web", model: "perplexity", provider: "dataforseo" },
  { channel: "perplexity.consumer_web", model: "perplexity", provider: "olostep" },
  { channel: "perplexity.consumer_web", model: "perplexity", provider: "oxylabs" },
] as const;
```

Use the existing `unavailable` constant and the Fan-Out normalization rule. Limit response-shape traversal to eight levels and 2,000 unique sorted paths so a pathological payload cannot exhaust memory.

- [ ] **Step 4: Run analyzer tests and verify GREEN**

Run the command from Step 2.

- [ ] **Step 5: Commit the analyzer**

```powershell
git add apps/worker/src/overseas-search-evidence-qualification.ts apps/worker/src/overseas-search-evidence-qualification.test.ts
git commit -m "analyze overseas provider evidence capability"
```

### Task 4: Add the guarded paid qualification command

**Files:**
- Create: `apps/worker/src/qualify-overseas-search-evidence.ts`
- Create: `apps/worker/src/qualify-overseas-search-evidence.test.ts`
- Modify: `apps/worker/package.json`

**Interfaces:**
- Produces CLI: `pnpm --filter @workspace/worker qualify:overseas-search-evidence`.
- Requires: `OVERSEAS_SEARCH_EVIDENCE_QUALIFICATION_ACK=paid-21-calls-2026-08-22`.
- Prints: one NDJSON result per matrix entry and one final summary.

- [ ] **Step 1: Write failing CLI-policy tests**

Extract `assertQualificationAcknowledged(env)` and `runQualificationMatrix(deps)` into the qualification module. Tests prove:

```ts
expect(() => assertQualificationAcknowledged({})).toThrow(/21 paid calls/);
expect(() => assertQualificationAcknowledged({
  OVERSEAS_SEARCH_EVIDENCE_QUALIFICATION_ACK: "paid-21-calls-2026-08-22",
})).not.toThrow();
```

Use provider fakes only at the paid network boundary and assert real NDJSON objects contain no raw result. Prove validation happens before `provider.run`, matrix execution is sequential, and one provider failure emits a failed row without stopping later candidates.

- [ ] **Step 2: Run the CLI-policy tests and verify RED**

```powershell
pnpm --filter @workspace/worker exec tsx --test src/qualify-overseas-search-evidence.test.ts
```

Expected: acknowledgement and matrix runner exports do not exist.

- [ ] **Step 3: Implement the command**

The CLI must:

1. check the exact acknowledgement;
2. resolve the existing observation target/capture route for each matrix entry;
3. require `provider.isConfigured()` and `provider.validateTarget(...) === null`;
4. call `provider.run(model, fixedPrompt, { webSearch: true })` sequentially;
5. analyze the result with Task 3;
6. print only the redacted report;
7. set a non-zero exit code when any candidate fails, after all candidates have been attempted.

Add the package script:

```json
"qualify:overseas-search-evidence": "tsx src/qualify-overseas-search-evidence.ts"
```

- [ ] **Step 4: Run CLI-policy tests and type checking**

```powershell
pnpm --filter @workspace/worker exec tsx --test src/qualify-overseas-search-evidence.test.ts
pnpm --filter @workspace/worker check-types
```

Expected: tests and type checking pass. Do not run the paid CLI during this step.

- [ ] **Step 5: Commit the guarded command**

```powershell
git add apps/worker/src/qualify-overseas-search-evidence.ts apps/worker/src/qualify-overseas-search-evidence.test.ts apps/worker/src/overseas-search-evidence-qualification.ts apps/worker/package.json
git commit -m "add guarded overseas provider qualification"
```

### Task 5: Execute qualification and write the route-selection follow-up

**Files:**
- Create after execution: `docs/evidence/2026-08-22-overseas-search-evidence-capabilities.json`
- Create after execution: `docs/superpowers/plans/2026-08-22-overseas-search-evidence-route-selection.md`

**Interfaces:**
- Consumes: exact production build containing Tasks 1-4 and configured provider credentials.
- Produces: redacted capability matrix and an exact route/canary plan based on observed fields.

- [ ] **Step 1: Deploy Tasks 1-4 without changing production routes**

Use the existing LAS deployment workflow and verify the deployed commit, Web health, and Worker health. No `SCRAPE_TARGETS` change is included in this deployment.

- [ ] **Step 2: Execute the paid matrix once**

Run inside the Worker container with the exact acknowledgement. Capture stdout as the evidence JSON; never redirect environment output or raw provider payloads.

Expected: 21 candidate rows plus one summary. A failed candidate is evidence, not a reason to rerun immediately.

- [ ] **Step 3: Validate and commit the redacted evidence report**

Before committing, assert the report contains none of:

- the fixed Prompt text;
- `answerText`, citation URLs, cookies, authorization strings, or provider credentials;
- raw payload objects or payload values.

Commit only counts, booleans, hashes, latency, provider submission IDs, and JSON key/type paths.

- [ ] **Step 4: Write the exact route-selection plan**

For each of the six channels, name one primary and one fallback from the report and include five-call canary acceptance criteria. If no candidate exposes genuine queries, the plan must name that channel's browser fallback as a separate task rather than claiming Fan-Out is solved.

- [ ] **Step 5: Commit evidence and follow-up plan**

```powershell
git add docs/evidence/2026-08-22-overseas-search-evidence-capabilities.json docs/superpowers/plans/2026-08-22-overseas-search-evidence-route-selection.md
git commit -m "record overseas provider evidence capability"
```
