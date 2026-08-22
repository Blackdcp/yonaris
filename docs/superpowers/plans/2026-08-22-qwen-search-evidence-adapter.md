# Qwen Search Evidence Adapter Plan

**Evidence:** `docs/evidence/2026-08-22-domestic-search-evidence-probes.json`

## Qualified DOM boundary

- Latest turn: `.chat-round.last-message-item`
- Answer wrapper: `.chat-answers-card-wrap`
- Search/source indicator outside the current inner answer selector: `.reference-wrap-iEjeb3 .search-content-iMifAk`

The live report contained no citation anchor hostname and no distinct query item. Therefore only the search-used indicator is qualified; query and citation extraction require a bounded network/card probe.

## TDD steps

1. Add a Qwen adapter scoped to exactly one visible `.chat-round.last-message-item` and exactly one `.chat-answers-card-wrap`.
2. Treat exactly one visible `.reference-wrap-iEjeb3 .search-content-iMifAk` in that turn as `webSearchObserved=true`, `queryAvailability="unavailable"`.
3. With no indicator, return `webSearchObserved=null`, not `false`, until a provider-native no-search marker is observed.
4. Keep visible direct HTTP anchors through the shared citation fallback; do not infer citations from non-anchor cards.
5. Add a read-only response/card probe for query and citation key names before extending the result.
6. Bump `qwen-web-20260821-localpc-v6` to `qwen-web-20260822-localpc-v7`.

Focused command: `pnpm --filter @workspace/browser-extension test -- src/adapters/qwen.test.ts src/adapters/search-evidence-adapter.test.ts`.

Canary: one search-enabled Prompt; require the indicator to remain inside the latest turn. Production validation: ten Prompts, reporting search state, unavailable/exposed queries, citations, and drift separately.

