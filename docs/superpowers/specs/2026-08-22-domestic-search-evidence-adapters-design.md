# Domestic Search Evidence Adapters Design

**Date:** 2026-08-22
**Status:** Approved in chat for specification
**Owner:** Yonaris

## Objective

Add real search-state, Fan-Out, and citation evidence collection to the six domestic browser surfaces that currently collect answers but have no structured search contract:

1. `deepseek.consumer_web`
2. `qwen.consumer_web`
3. `kimi.consumer_web`
4. `wenxin.consumer_web`
5. `yuanbao.consumer_web`
6. `zhipu.consumer_web`

Doubao remains the working reference implementation. Existing successful answer collection, v2 structured snapshots, and answer-bound JPEG capture must remain intact.

## Current Evidence

All six selector contracts set `searchUsed`, `searchNotUsed`, `queryItem`, and `searchEvidence` to `null`. Their citation selector is the generic `a[href^="http"]`. Consequently, search state is always `null`, Fan-Out is always empty, and citations include only links that happen to be direct anchors inside the accepted answer.

The completed production batch proves that submission, answer collection, v2 archive creation, and JPEG evidence work for all six surfaces. It does not prove search evidence completeness. The existing 70 observations cannot be retroactively completed because arbitrary provider HTML and browser network traffic were intentionally not uploaded.

## Evidence Contract

Each platform adapter returns one answer-bound evidence result:

```ts
type SearchEvidenceResult = {
  webSearchObserved: true | false | null;
  queryAvailability: "exposed" | "unavailable" | "not_searched" | "unknown";
  webQueries: string[];
  citations: Array<{ url: string; title: string }>;
  diagnostics: {
    extractorVersion: string;
    evidenceSource: "dom" | "network" | "dom_and_network" | "none";
    searchBlockCount: number;
    queryCandidateCount: number;
    citationCandidateCount: number;
  };
};
```

The wire and database representation remains compatible with the existing fields:

- `not_searched` maps to `webSearchObserved=false`, `webQueries=[]`;
- `exposed` maps to `webSearchObserved=true`, normalized queries;
- `unavailable` maps to `webSearchObserved=true`, `webQueries=["unavailable"]`;
- `unknown` maps to `webSearchObserved=null`, `webQueries=[]`.

`queryAvailability` and diagnostics are retained in the v2 snapshot so customer and administrator pages can distinguish a genuine zero from missing evidence. Genuine Fan-Out continues to exclude the sentinel and exact Prompt echoes.

## Local Qualification Probe

Before selectors are added, an administrator-only read-only probe runs against one completed answer in each already logged-in platform tab. It emits a local redacted report containing:

- current approved conversation URL shape;
- counts and visibility of candidate search controls, search blocks, query rows, source disclosures, source cards, and citation links;
- stable tag/class/ARIA/data-attribute fingerprints around those candidates;
- normalized visible text patterns with Prompt and answer content replaced by length/hash markers;
- whether opening a source disclosure changes only the current answer and can be reversed;
- whether query strings exist only in answer-bound network events.

The probe does not submit a Prompt, upload raw HTML, retain cookies, or copy arbitrary page text to the server. Any temporary local diagnostic artifact is deleted after selectors and minimal redacted fixtures are derived.

## Adapter Architecture

The common `ConsumerAdapter` remains responsible for submission, completion, answer identity, and snapshot capture. Search collection moves behind a surface-specific `SearchEvidenceAdapter` interface so platforms are not forced into Doubao's exact summary-count format.

Each platform implementation may use:

1. a scoped DOM extractor rooted at the accepted current answer;
2. a reversible source-panel disclosure scoped to that answer;
3. an answer-bound network evidence buffer when rendered DOM does not expose the query strings.

The common layer owns normalization, maximum counts and lengths, URL safety, deduplication, Prompt-echo classification, and conversion to the shared observation contract. Provider modules own only selectors and provider-specific interpretation.

Search status, queries, and citations are independent. A platform may expose citations while keeping query strings unavailable. A citation must not be discarded merely because Fan-Out is unavailable, and a visible search indicator must not fabricate citations.

## DOM Evidence Rules

- Only the accepted current answer and its explicitly bound search/source UI may contribute evidence.
- Hidden templates, earlier conversations, sidebars, recommendations, ads, account UI, and unrelated page chrome are excluded.
- A disclosure may be clicked only after answer completion, must be unique within the current answer, and must be restored before screenshot capture.
- Search-used and search-not-used signals must be mutually exclusive. Zero or multiple conflicting signals produce `unknown`.
- Query strings preserve DOM order, are normalized and deduplicated, and remain in the raw observation even when an exact Prompt echo is later excluded from Genuine Fan-Out.
- Citation URLs must be absolute HTTP(S), contain no credentials, remain within the existing length limit, and have a non-empty visible title.
- Redirect wrappers are resolved only when the destination is available from a page-owned attribute or a bounded HTTP redirect check; secrets and transient authorization parameters are never persisted.

## Network Evidence Rules

Network capture is enabled only for a platform whose qualification proves the query is not available in answer-bound DOM. A minimal main-world observer starts before Prompt submission and keeps an in-memory buffer for the active task only.

It may retain:

- normalized search query strings;
- public citation URL/title pairs;
- a provider conversation/request identifier used only to bind events to the current task;
- event timestamps and type names for diagnostics.

It must discard request/response bodies after extracting approved fields and must never retain cookies, authorization headers, local storage, account identifiers, telemetry payloads, or unrelated requests. The buffer is cleared on task completion, navigation, error, extension restart, or task identity change.

DOM and network evidence may be combined only when both are bound to the same submitted task. If binding is ambiguous, the result is `unknown`; the adapter does not guess.

## Failure Isolation

Evidence extraction failure must not erase an otherwise valid answer. The task persists the answer, v2 snapshot, and JPEG with `webSearchObserved=null`, no partial queries, the citations that independently passed validation, and an evidence diagnostic explaining the unavailable component.

A task remains `needs_human` only when answer identity, conversation identity, completion state, or screenshot boundary is ambiguous. Search-selector drift alone becomes a visible data-completeness diagnostic rather than a post-submit task failure.

When a provider-declared query/citation count exists, a count mismatch rejects that component atomically; it does not upload a partial list as complete.

## Testing

Each platform receives minimal redacted DOM fixtures derived from the live probe. Tests exercise the real shared extractor and cover:

- explicit search used, explicit no-search, and unknown state;
- exposed queries, query-unavailable, Prompt echo, duplicates, malformed and oversized values;
- visible/collapsed citations, unsafe URLs, redirects, duplicate URLs, and empty titles;
- earlier-answer and page-chrome contamination;
- disclosure open/restore behavior;
- network task binding, buffer clearing, and sensitive-field rejection where network evidence is required;
- evidence drift preserving the accepted answer and marking only the evidence component unknown;
- unchanged v2 snapshot/JPEG behavior.

Every platform adapter version is bumped independently. Server approval, extension readiness, claim, resume, upload, and completion remain exact-version bound.

## Rollout and Acceptance

Platforms are qualified and activated independently in this order: DeepSeek, Qwen, Kimi, Wenxin, Yuanbao, Zhipu. The order starts with the highest current citation volume and keeps the remaining surface work isolated.

For each platform:

1. run the read-only local probe against a completed answer;
2. add a failing redacted fixture test;
3. implement the minimum DOM extractor and, only if necessary, network observer;
4. build and package the exact extension;
5. run one production canary Prompt;
6. inspect answer, search state, queries, citations, v2 snapshot, and JPEG;
7. run the ten-Prompt China Program after the canary passes.

Acceptance per platform requires:

- answer submission and collection remain successful;
- every result has a ready v2 snapshot and attached JPEG;
- search state is true/false when the page provides evidence and null only with an explicit diagnostic;
- every displayed Fan-Out query is present in the accepted answer's DOM or bound network evidence;
- exact Prompt echoes are not counted as Genuine Fan-Out;
- citations are bound to the current answer and use safe canonical URLs;
- a search-evidence selector drift does not lose the answer;
- no arbitrary provider HTML or sensitive browser data is uploaded.

## Historical Data

The existing 70-run batch remains an accurate answer/snapshot archive. Direct citations already stored remain available, but absent search evidence is not backfilled from screenshots or generated heuristics. After each adapter is activated, a new ten-Prompt run supplies comparable complete evidence.

## Non-Goals

- Uploading arbitrary raw provider HTML.
- Capturing the entire browser page, account sidebar, or unrelated conversations.
- Generating synthetic Fan-Out queries from the answer or Prompt.
- Treating a Prompt echo as a rewritten query.
- Blocking all domestic platforms until every adapter is complete.

