# Kimi Search Evidence Adapter Plan

**Evidence:**

- `docs/evidence/2026-08-22-domestic-search-evidence-probes.json`
- `docs/evidence/2026-08-22-domestic-controlled-disclosure-followup.json`

## Qualified DOM boundary

- Accepted answer: `.segment-content-box`
- Search tool block: `.toolcall-container.toolcall-web_search`
- Tool title: `.toolcall-title-name-text`
- Collapsed tool body: `.toolcall-content .toolcall-content-text`
- Citation marker: `a.pua-ref-cite-tag.pua-ref-cite-tag--text[data-site-name][href]`

The search block is exact. The collapsed body contains query/source material, but the read-only probe did not expose stable query-item boundaries. Citation anchors may be hidden when their source block is collapsed; hidden anchors must not be uploaded.

## TDD steps

1. Add a Kimi adapter scoped to the accepted `.segment-content-box` only.
2. Exactly one `.toolcall-container.toolcall-web_search` means `webSearchObserved=true`.
3. Until query boundaries are qualified, return `queryAvailability="unavailable"` and `webQueries=[]`.
4. Extract only rendered citation anchors matching the literal selector above. Require an HTTP(S) URL without credentials and a non-empty visible title or rendered provider label; never use a hidden `data-site-name` value by itself.
5. No search block returns `webSearchObserved=null` until a provider-native no-search marker is observed.
6. Add a bounded controlled-disclosure/network probe for query item boundaries; restore the UI before screenshot capture.
7. A controlled live disclosure qualified exactly one visible `.toolcall-title-container-text` as the provider search
   argument; it was distinct from the latest user Prompt. Preserve it as an exposed query and reject ambiguous or
   overlong values.
8. Bump `kimi-web-20260822-localpc-v11` to `kimi-web-20260822-localpc-v12`.

Focused command: `pnpm --filter @workspace/browser-extension test -- src/adapters/kimi.test.ts src/adapters/search-evidence-adapter.test.ts`.

Canary: one search-enabled Prompt with at least one rendered citation. Production validation: ten Prompts; require exact latest-answer scoping and separate query-unavailable from extraction drift.
