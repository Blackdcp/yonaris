# Yuanbao Search Evidence Adapter Plan

**Evidence:** `docs/evidence/2026-08-22-domestic-search-evidence-probes.json`, `docs/evidence/2026-08-22-deepseek-yuanbao-search-evidence-followup.json`

## Qualification status

Qualified for a bounded DOM adapter after the read-only follow-up. The accepted answer contains a visible `.hyc-common-markdown__ref-list`, while the global `.yb-common-nav__tool` search control remains explicitly excluded. This proves search observed. The visible list does not expose a stable query-item or citation-URL boundary, so queries remain unavailable and only independently visible direct HTTP links are collected as citations.

## Bounded follow-up

1. Inspect an existing answer known to have used Yuanbao web search, or run one authorized canary Prompt with the search mode explicitly enabled.
2. Capture only redacted answer-relative DOM structure and response event/key names.
3. Require an exact latest `.agent-chat__bubble--ai .agent-chat__speech-card__text` boundary and distinguish provider search trace from the global navigation search button.
4. If the page exposes no query/source DOM, record `network_probe_required: true` and key names/types only.

## TDD gate

- Keep current fallback: `webSearchObserved=null`, `queryAvailability="unknown"`, `webQueries=[]`, visible direct citations only.
- Bump `yuanbao-web-20260821-localpc-v6` to `yuanbao-web-20260822-localpc-v7` only after evidence exists.
- Focused command: `pnpm --filter @workspace/browser-extension test -- src/adapters/yuanbao.test.ts src/adapters/search-evidence-adapter.test.ts`.
- Canary: one Prompt. Production validation: ten Prompts after the one-Prompt evidence gate passes.
