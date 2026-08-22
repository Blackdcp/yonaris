# Zhipu Search Evidence Adapter Plan

**Evidence:** `docs/evidence/2026-08-22-domestic-search-evidence-probes.json`

## Qualified DOM boundary

- Accepted answer: `[id^="row-answer-"].answer .answer-content-wrap`
- Adjacent tool trace: `.advance-thinking .advance-thinking-area`
- Source tool result: `.tool-result-content .sources-tab-container`
- Source label: `.sources-tab-container .source-text`
- Rendered direct citation fallback: `.answer-content-wrap a[href]`

The source tool trace is adjacent to, not inside, the accepted answer. It was collapsed in the report. Query item boundaries were not exposed. The report was truncated, but latest-answer and adjacent candidates were prioritized before truncation.

## TDD steps

1. Bind the source trace only when it is the approved adjacent sibling group of the latest answer turn.
2. Exactly one bound `.tool-result-content .sources-tab-container` means `webSearchObserved=true`, `queryAvailability="unavailable"`.
3. Reject page-wide or older-turn source panels.
4. Extract only rendered direct answer citations with HTTP(S), no credentials, and visible non-empty titles.
5. Add a bounded disclosure/network probe before extracting queries from the collapsed source area.
6. Bump `zhipu-web-20260822-localpc-v2` to `zhipu-web-20260822-localpc-v3`.

Focused command: `pnpm --filter @workspace/browser-extension test -- src/adapters/zhipu.test.ts src/adapters/search-evidence-adapter.test.ts`.

Canary: one search-enabled Prompt. Production validation: ten Prompts, with source-panel binding failures reported separately from valid answers.

