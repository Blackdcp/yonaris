# Yuanbao Search Evidence Adapter Plan

**Evidence:** `docs/evidence/2026-08-22-domestic-search-evidence-probes.json`, `docs/evidence/2026-08-22-deepseek-yuanbao-search-evidence-followup.json`, `docs/evidence/2026-08-22-yuanbao-source-carousel-followup.json`

## Qualification status

Qualified for a bounded DOM adapter after the read-only follow-ups. The accepted answer contains visible `.hyc-common-markdown__ref-list` markers, while the global `.yb-common-nav__tool` search control remains explicitly excluded. Each marker exposes an ordered `data-idx-list`. A controlled hover disclosure creates a provider-owned source carousel whose `data-idx` values exactly follow that order; ordinary button clicks advance and restore the carousel. Strict `data-url` plus the provider title card now qualify citations. Query terms remain unavailable because no separate provider query boundary was exposed.

## Bounded follow-up

1. Require one visible indexed trigger per visible reference list in the accepted answer.
2. Open each trigger with provider hover events, cycle every ordered source index, and restore the first source before closing.
3. Reject the entire extraction on any missing index, carousel ambiguity, source mutation, invalid URL, or missing title; never upload a partial list.
4. Keep query availability `unavailable` until a separately qualified provider-query boundary exists.

## TDD gate

- Preserve the generic fallback only when no visible answer-scoped search marker exists.
- Bump the qualified surface contract to `yuanbao-web-20260822-localpc-v8` and evidence extractor to `yuanbao-search-evidence-20260822-v2`.
- Focused command: `pnpm --filter @workspace/browser-extension test -- src/adapters/yuanbao.test.ts src/adapters/search-evidence-adapter.test.ts`.
- Canary: one Prompt. Production validation: ten Prompts after the one-Prompt evidence gate passes.
