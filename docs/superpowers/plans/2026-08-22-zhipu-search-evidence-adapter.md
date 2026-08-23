# Zhipu Search Evidence Adapter Plan

**Evidence:** `docs/evidence/2026-08-22-domestic-search-evidence-probes.json`, `docs/evidence/2026-08-22-zhipu-inline-citation-followup.json`

## Qualified DOM boundary

- Accepted answer: `[id^="row-answer-"].answer .answer-content-wrap`
- Adjacent tool trace: `.advance-thinking .advance-thinking-area`
- Source tool result: `.tool-result-content .sources-tab-container`
- Source label: `.sources-tab-container .source-text`
- Answer citation item: `.source-item[data-url][data-id][data-group-key]`
- Answer citation title: `.source-item-num-name`
- Rendered direct citation fallback: `.answer-content-wrap a[href]`

The source tool trace is adjacent to, not inside, the accepted answer. A trusted read-only disclosure confirmed that its drawer reports 12 candidate search results. Separately, the accepted answer contains 14 rendered citation occurrences with provider `data-url`, `data-id`, and `data-group-key`; these represent the sources actually cited by the answer and canonicalize to fewer unique URLs. Query item boundaries were not exposed.

## TDD steps

1. Bind the source trace only when it is the approved adjacent sibling group of the latest answer turn.
2. Exactly one bound `.tool-result-content .sources-tab-container` means `webSearchObserved=true`, `queryAvailability="unavailable"`.
3. Reject page-wide or older-turn source panels.
4. Extract rendered answer-scoped structured citation items plus independently valid direct anchors, with HTTP(S), no credentials, and visible non-empty titles.
5. Keep search-result counts distinct from answer citation counts; canonicalize and deduplicate final citations by URL.
6. Keep queries unavailable until a separate provider query boundary is qualified.
7. Bump the surface contract to `zhipu-web-20260822-localpc-v4` and evidence extractor to `zhipu-search-evidence-20260822-v2`.

Focused command: `pnpm --filter @workspace/browser-extension test -- src/adapters/zhipu.test.ts src/adapters/search-evidence-adapter.test.ts`.

Canary: one search-enabled Prompt. Production validation: ten Prompts, with source-panel binding failures reported separately from valid answers.
