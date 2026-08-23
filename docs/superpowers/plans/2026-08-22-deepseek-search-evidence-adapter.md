# DeepSeek Search Evidence Adapter Plan

**Evidence:** `docs/evidence/2026-08-22-domestic-search-evidence-probes.json`, `docs/evidence/2026-08-22-deepseek-yuanbao-search-evidence-followup.json`

## Qualification status

Qualified for a bounded DOM adapter after the read-only follow-up. Five completed conversation tabs exposed one accepted answer and a visible answer-scoped external citation marker `a[href] .ds-markdown-cite`. This proves search observed and visible direct citations. It does not expose a stable query-item boundary, so `queryAvailability` remains `unavailable` and `webQueries` remains empty.

## Bounded read-only follow-up

1. Load a completed conversation whose user and assistant turns are visibly present.
2. Record a redacted structural outline around the latest turn, including sibling/ancestor tag, class tokens, roles, and data-attribute names; never record text or HTML.
3. If the answer DOM remains fully hash-classed, record the response event names and JSON key names for the completed turn/search trace, with all values replaced by type/length/hash.
4. Require an exact latest-answer boundary before qualifying search state, query, or citation selectors.

## TDD implementation gate

- Bump `deepseek-web-20260821-localpc-v8` to `deepseek-web-20260822-localpc-v9` only after the follow-up report exists.
- Add a minimal redacted fixture reproducing the exact latest-turn boundary.
- Expected fallback before qualification: `webSearchObserved=null`, `queryAvailability="unknown"`, `webQueries=[]`; keep independently visible direct HTTP citations only.
- Focused command: `pnpm --filter @workspace/browser-extension test -- src/adapters/deepseek.test.ts src/adapters/search-evidence-adapter.test.ts`.
- Canary: one Prompt with search enabled; require one accepted answer and no `page_drift`.
- Production validation: ten Prompts; report search observed, query availability, citation count, and drift independently.
