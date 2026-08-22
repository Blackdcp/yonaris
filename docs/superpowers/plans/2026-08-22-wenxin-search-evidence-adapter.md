# Wenxin Search Evidence Adapter Plan

**Evidence:**

- `docs/evidence/2026-08-22-domestic-search-evidence-probes.json`
- `docs/evidence/2026-08-22-domestic-controlled-disclosure-followup.json`

## Qualified DOM boundary

- Accepted answer: `.conversation-flow-answer-container .ai-entry`
- Thinking/source block: `.ai-entry-block.ai-thinking-steps`
- Stable disclosure: `.root-header`
- Search tool marker: `.cos-icon-search`
- Rendered answer/source markdown: `.ai-entry-block.ai-markdown .marklang`
- Direct citation: `.marklang a.marklang-link[href]`
- Source row: `[data-long-press-ext-info][data-long-press-menu][data-long-press-menu-buttons]`

The controlled disclosure follow-up qualified `data-long-press-ext-info` JSON with `link` and `linkTitle` for each
visible source row. It did not expose stable query-item boundaries. Hashed `_...` classes remain diagnostic only.

## TDD steps

1. Scope all evidence to exactly one latest `.ai-entry`.
2. Open the unique visible `.root-header` and require `.cos-icon-search` plus visible structured source rows before
   reporting `webSearchObserved=true`; otherwise return unknown, not false.
3. Return `queryAvailability="unavailable"` until an exact query item or response key is qualified.
4. Merge visible direct links with strict `link`/`linkTitle` metadata from the revealed source rows, then restore the
   thinking trace.
5. Bump `wenxin-web-20260822-localpc-v8` to `wenxin-web-20260822-localpc-v9`.

Focused command: `pnpm --filter @workspace/browser-extension test -- src/adapters/wenxin.test.ts src/adapters/search-evidence-adapter.test.ts`.

Canary: one search-enabled Prompt. Production validation: ten Prompts with independent search/query/citation/drift counts.
