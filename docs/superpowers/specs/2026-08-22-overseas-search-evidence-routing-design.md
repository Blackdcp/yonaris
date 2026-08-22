# Overseas Search Evidence Routing Design

**Date:** 2026-08-22
**Status:** Approved in chat for specification
**Owner:** Yonaris

## Objective

Select an evidence-qualified execution provider for each overseas channel so a successful observation captures the answer, citations, explicit search state, and genuine Fan-Out whenever the channel exposes them. A provider that does not expose rewritten queries must report that limitation explicitly; the system must never substitute the original Prompt or generated guesses.

The channels in scope are:

1. `chatgpt.consumer_web`
2. `copilot.consumer_web`
3. `gemini.consumer_web`
4. `google_search.ai_mode`
5. `google_search.ai_overview`
6. `perplexity.consumer_web`

## Current Evidence

The production cohort uses BrightData for all six channels. Its ChatGPT dataset exposes `web_search_triggered` and `web_search_query`, which produced 58 genuine Fan-Out queries in 29 runs. The other BrightData payloads either omit rewritten queries or expose only the submitted Prompt:

- Copilot returns answers and sources without a query field.
- Gemini returns answers and citations without a query field.
- Google AI Mode returns answers and citations without a query field.
- Google AI Overview exposes the submitted Google query, not downstream rewritten queries.
- Perplexity exposes the submitted Prompt in `web_search_query`; the genuine Fan-Out filter correctly excludes it.

The provider layer already supports DataForSEO, OloStep, and Oxylabs, and production has credentials for all three. DataForSEO LLM responses can expose `fan_out_queries`; OloStep parsers can expose `search_queries`, `network_search_calls.search_queries`, or `search_model_queries`; Oxylabs parsers can expose `search_queries`, `related_queries`, or `web_search_queries`. Support differs by channel and must be demonstrated against live provider payloads rather than inferred from a parser's field list.

## Evidence Semantics

Every successful observation has two independent search fields:

- `webSearchObserved`: `true` only when the provider explicitly reports a search or the surface is intrinsically a search surface and returned answer-bound sources; `false` only when the provider explicitly reports no search; otherwise `null`.
- `webQueries`: an ordered, deduplicated list of provider-exposed queries. If a search is proven but query strings are unavailable, store the existing `unavailable` sentinel. If no search is proven, store an empty list.

The Fan-Out UI continues to exclude blank values, `unavailable`, and exact Prompt echoes. A Genuine Fan-Out query must be a query emitted by the same provider execution that produced the answer and must differ from the submitted Prompt after the existing normalization.

Citations must come from the same execution as the answer. Yonaris must not combine a BrightData answer with DataForSEO queries or citations from a separate call and present them as one observation.

## Provider Qualification Matrix

A dedicated, administrator-invoked qualification command runs one fixed non-brand Prompt against every supported `(channel, provider)` combination. It records a redacted capability report containing:

- provider, channel, capture route, and provider model/version;
- completion status and latency;
- non-empty answer check;
- explicit search-observed signal, if present;
- raw, exposed, and genuine query counts;
- citation count, unique domain count, and invalid citation count;
- response-shape fingerprint consisting only of JSON key paths and value types;
- provider submission identifier and raw-payload hash, without copying secrets into the report.

The initial matrix is:

| Channel | BrightData | DataForSEO | OloStep | Oxylabs |
|---|---:|---:|---:|---:|
| ChatGPT | yes | yes | yes | yes |
| Copilot | yes | no | yes | no |
| Gemini | yes | yes | yes | no |
| Google AI Mode | yes | yes | yes | yes |
| Google AI Overview | yes | yes | yes | yes |
| Perplexity | yes | yes | yes | yes |

Unsupported provider/channel combinations are skipped before any paid request. Qualification is a paid, explicit operation and never runs from health checks or application startup.

## Route Selection

Each channel receives one primary production route and one answer-capable fallback. The selection order is:

1. same-execution genuine Fan-Out plus valid citations and answer;
2. explicit query-unavailable signal plus valid citations and answer;
3. valid citations and answer with unknown search state;
4. answer only.

Reliability and channel fidelity remain gates: a route is not selected merely because it returns query-shaped strings. A candidate must pass five repeated canary calls with no Prompt echo mislabeled as Fan-Out, no malformed citation URL, and at least four successful observations. Provider cost and median latency are reported but do not override evidence correctness.

The chosen provider remains configuration-driven through the existing target registry. Route selection does not require a database migration. The provider result contract gains an optional explicit `webSearchObserved` field, and the worker persists it instead of leaving all overseas observations at `null`.

## Browser Fallback

If no configured provider exposes genuine rewritten queries for a channel, that channel remains correctly marked `searched / query unavailable` while a browser evidence collector is qualified. The browser fallback may read rendered search steps or answer-bound network events, but it must:

- bind evidence to the exact submitted Prompt and resulting answer;
- capture no cookies, authorization headers, request bodies, or unrelated browsing data;
- upload only normalized query strings, citation URL/title pairs, search state, answer text, and the standard snapshot payload;
- never infer a query from answer text or generate a likely query with an LLM.

The browser fallback is activated per channel only after a live qualification demonstrates stable evidence. It is not a prerequisite for deploying provider improvements on channels where DataForSEO, OloStep, or Oxylabs already expose genuine Fan-Out.

## Failure Handling

- An answer failure remains a failed provider call.
- Invalid query fields are ignored only when the execution can be represented honestly as query unavailable; malformed fields are included in qualification diagnostics.
- Invalid citation URLs are rejected individually and counted. A route fails qualification when rejection would materially change a provider-declared citation count.
- The BrightData Google AI Overview parser treats a successful HTTP response with unusable content as a structured parse failure with a provider-specific diagnostic, not as a successful observation.
- A fallback provider runs only under the existing execution retry policy. It does not merge data with the failed primary call.

## Rollout and Acceptance

1. Run the capability matrix once in production with one fixed Prompt.
2. Review the redacted report and select a primary/fallback route per channel.
3. Run five canary calls per selected route.
4. Deploy provider result persistence for `webSearchObserved` and the selected routes.
5. Run a 50-call cohort per channel and compare answer, citation, and Fan-Out completeness.

Acceptance requires:

- every successful run has a non-empty answer and ready response snapshot;
- search state is no longer `null` when the provider explicitly proves search/no-search;
- no exact Prompt echo appears as Genuine Fan-Out;
- every displayed Fan-Out query is present in the same run's raw provider payload;
- citations use safe canonical HTTP(S) URLs and remain tied to the same run;
- channels whose platform/provider does not expose query strings display `query unavailable`, not zero as if no search occurred.

## Non-Goals

- Generating synthetic Fan-Out queries.
- Combining fields from separate paid executions into one observation.
- Replacing all providers with browsers before qualifying existing provider capabilities.
- Retrospectively inventing queries for historical payloads that do not contain them.

