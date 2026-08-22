# Qwen Search Evidence Adapter Plan

**Evidence:**

- `docs/evidence/2026-08-22-domestic-search-evidence-probes.json`
- `docs/evidence/2026-08-22-domestic-controlled-disclosure-followup.json`

## Qualified DOM boundary

- Latest turn: `.chat-round.last-message-item`
- Answer wrapper: `.chat-answers-card-wrap`
- Search/source indicator outside the current inner answer selector: `.reference-wrap-iEjeb3 .search-content-iMifAk`

The controlled disclosure follow-up qualified a provider-owned source portal. Each visible source row has
`data-click-extra` JSON with `url`, `ref_url`, and `title`. The panel still exposes no distinct provider rewrite
query item.

## TDD steps

1. Add a Qwen adapter scoped to exactly one visible `.chat-round.last-message-item` and exactly one `.chat-answers-card-wrap`.
2. Treat exactly one visible `.reference-wrap-iEjeb3 .search-content-iMifAk` in that turn as `webSearchObserved=true`, `queryAvailability="unavailable"`.
3. With no indicator, return `webSearchObserved=null`, not `false`, until a provider-native no-search marker is observed.
4. Open the current turn's source control, accept only newly visible rows with all three semantic logging attributes,
   parse strict `data-click-extra` JSON, and restore the panel.
5. Require visible row text plus safe absolute HTTP(S) `url` and non-empty `title`; reject partial or unsafe metadata.
6. Keep provider rewrites unavailable; source titles are Citations, not Fan-Out queries.
7. Bump `qwen-web-20260822-localpc-v7` to `qwen-web-20260822-localpc-v8`.

Focused command: `pnpm --filter @workspace/browser-extension test -- src/adapters/qwen.test.ts src/adapters/search-evidence-adapter.test.ts`.

Canary: one search-enabled Prompt; require the indicator to remain inside the latest turn. Production validation: ten Prompts, reporting search state, unavailable/exposed queries, citations, and drift separately.
