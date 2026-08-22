# Wenxin Search Evidence Adapter Plan

**Evidence:** `docs/evidence/2026-08-22-domestic-search-evidence-probes.json`

## Qualified DOM boundary

- Accepted answer: `.conversation-flow-answer-container .ai-entry`
- Thinking/source block: `.ai-entry-block.ai-thinking-steps`
- Stable step header: `.step-header`
- Rendered answer/source markdown: `.ai-entry-block.ai-markdown .marklang`
- Direct citation: `.marklang a.marklang-link[href]`

The thinking block proves a provider tool/source trace exists, but the report did not expose stable query-item boundaries. Hashed `_...` classes are diagnostic only and are not approved selectors.

## TDD steps

1. Scope all evidence to exactly one latest `.ai-entry`.
2. A visible `.ai-entry-block.ai-thinking-steps` containing a source-classified `.step-header` means `webSearchObserved=true`; otherwise return unknown, not false.
3. Return `queryAvailability="unavailable"` until an exact query item or response key is qualified.
4. Extract only visible `.marklang a.marklang-link[href]` citations with visible non-empty titles.
5. Bump `wenxin-web-20260821-localpc-v7` to `wenxin-web-20260822-localpc-v8`.

Focused command: `pnpm --filter @workspace/browser-extension test -- src/adapters/wenxin.test.ts src/adapters/search-evidence-adapter.test.ts`.

Canary: one search-enabled Prompt. Production validation: ten Prompts with independent search/query/citation/drift counts.

