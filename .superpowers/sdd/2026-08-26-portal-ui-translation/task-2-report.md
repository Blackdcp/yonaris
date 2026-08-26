# Task 2 report: Customer overview and analytical pages

## Status

DONE. The customer portal routes and their child-component families are bilingual for `en | zh-CN`, with raw customer evidence and route/query identity preserved. No migration, external service, access-control, loader, or server behavior was changed.

## Binding inputs read

- `E:\Yonaris\.worktrees\yonaris-site-v2\AGENTS.md` (read completely before task work)
- `E:\Yonaris\.worktrees\yonaris-site-v2\.superpowers\sdd\2026-08-26-portal-ui-translation\task-2-brief.md` (read completely before task work)
- `E:\Yonaris\.worktrees\yonaris-site-v2\docs\superpowers\specs\2026-08-26-portal-bilingual-design.md`, specifically the binding `Product decisions` and `Translation coverage` sections

## Delivered coverage

### Release metadata

- Added `.changeset/translate-customer-portal.md`, a patch Changeset for `@workspace/web` as required by `AGENTS.md` for user-facing changes.

### Catalog

- Created `apps/web/src/i18n/catalogs/customer.ts` and composed it through `apps/web/src/i18n/catalog.ts`; the existing SSR provider/context and runtime architecture are unchanged.
- Added 431 paired English/Chinese message IDs (862 locale entries): `customer.*` 55, `program.*` 62, `visibility.*` 33, `voice.*` 25, `citation.*` 118, `opportunity.*` 32, `prompt.*` 64, and the prompt-detail snapshot child family `snapshot.*` 42.
- Catalog copy covers heads, page descriptions, data/loading/empty/error states, filters, tabs, columns, badges, explicit status labels, actions, dialogs, validation, tooltips, placeholders, charts, pagination, and accessibility labels.

### Routes (10/10 named in the brief)

- `apps/web/src/routes/_authed/app/index.tsx`
- `apps/web/src/routes/_authed/app/new.tsx`
- `apps/web/src/routes/_authed/app/$brand/index.tsx`
- `apps/web/src/routes/_authed/app/$brand/programs.tsx`
- `apps/web/src/routes/_authed/app/$brand/visibility.tsx`
- `apps/web/src/routes/_authed/app/$brand/share-of-voice.tsx`
- `apps/web/src/routes/_authed/app/$brand/citations.tsx`
- `apps/web/src/routes/_authed/app/$brand/opportunities.tsx`
- `apps/web/src/routes/_authed/app/$brand/prompts/index.tsx`
- `apps/web/src/routes/_authed/app/$brand/prompts/$promptId.tsx`

All ten route heads now use explicit `match.context?.uiLanguage ?? "en"`; none reads browser globals. Visible data, loading, empty, and safe generic error presentation is localized throughout the route families.

### Production child components (24)

- Customer/program/filter families: `customer-programs-view.tsx`, `measurement-scope-provision-dialog.tsx`, and `filtered-list-shell.tsx`.
- Visibility/share-of-voice/chart families: `visibility-bar.tsx`, `trend-chart.tsx`, `share-of-voice-donut.tsx`, and `cached-prompt-chart.tsx`.
- Prompt/history/snapshot families: `prompts-display.tsx`, `prompt-order-dropdown.tsx`, `history-button.tsx`, `response-snapshot-panel.tsx`, and the Prompt-detail-required shared child `fanout-sections.tsx`.
- Opportunity family: `opportunities-report.tsx` plus `apps/web/src/lib/opportunities-empty-state.ts`.
- Citation family: `citations-display.tsx` and all ten `components/citations/*.tsx` children (`content-gaps-card`, `google-shopping-card`, `recent-changes-card`, `reddit-card`, `shared`, `stats-cards`, `top-domains-card`, `top-urls-card`, `track-domain-popover`, and `trend-area-chart`).

Explicit maps translate stored status/source/change tokens such as `completed`, `failed`, `scored`, snapshot states, citation change types, and source types. Stored tokens are not capitalized, translated, or mutated.

### Focused test files (10)

- `apps/web/src/components/customer-programs-view.test.tsx`
- `apps/web/src/components/response-snapshot-panel.test.tsx`
- `apps/web/src/components/citations-display-localization.test.tsx`
- `apps/web/src/components/customer-trend-chart-localization.test.tsx`
- `apps/web/src/components/measurement-scope-provision-dialog.test.tsx`
- `apps/web/src/components/visibility-localization.test.tsx`
- `apps/web/src/routes/_authed/app/-customer-entry-localization.test.tsx`
- `apps/web/src/routes/_authed/app/$brand/-overview-localization.test.tsx`
- `apps/web/src/routes/_authed/app/$brand/-analytics-localization.test.tsx`
- `apps/web/src/routes/_authed/app/$brand/prompts/-prompt-history-localization.test.tsx`

The four new route-adjacent tests use the `-` route-ignore prefix so they do not enter TanStack route discovery.

## TDD evidence

### RED

Before production localization, the direct ten-file focused command produced:

- Test files: 10 failed
- Tests: 28 expected localization failures and 12 already-green identity/invariant assertions (40 total)
- Failure character: Chinese render/head expectations encountered English-only or missing localized output; after correcting test mocks, there were no setup or harness failures
- Duration: about 2.15 seconds

The four route test files had their original non-prefixed names during RED and were renamed with `-` after implementation to avoid route-generator warnings; their test contents were unchanged by that rename.

### GREEN

Final focused command:

```powershell
pnpm --filter @workspace/web test -- --reporter=dot 'src/components/customer-programs-view.test.tsx' 'src/components/response-snapshot-panel.test.tsx' 'src/components/citations-display-localization.test.tsx' 'src/components/customer-trend-chart-localization.test.tsx' 'src/components/measurement-scope-provision-dialog.test.tsx' 'src/components/visibility-localization.test.tsx' 'src/routes/_authed/app/-customer-entry-localization.test.tsx' 'src/routes/_authed/app/$brand/-overview-localization.test.tsx' 'src/routes/_authed/app/$brand/-analytics-localization.test.tsx' 'src/routes/_authed/app/$brand/prompts/-prompt-history-localization.test.tsx'
```

- Test files: 10 passed
- Tests: 40 passed
- Duration: 1.98 seconds

Final broader verification:

- `pnpm --filter @workspace/web test`: 95 files passed, 760 tests passed, 12.10 seconds.
- The package has no `typecheck` script (`pnpm --filter @workspace/web typecheck` correctly reported `ERR_PNPM_RECURSIVE_RUN_NO_SCRIPT`); its actual typecheck command, `pnpm --filter @workspace/web check-types`, ran `tsc --noEmit` and passed.
- `pnpm --filter @workspace/web build -- --logLevel error`: passed and produced the Nitro node-server build. Output contained only the two pre-existing non-prefixed language-test discovery warnings plus expected missing-Sentry-token/native-builder informational warnings.
- `node_modules/.bin/biome.CMD check <all 47 task files>`: checked 47 files with no fixes or diagnostics.
- `git diff --check`: exited 0; Git emitted only configured LF-to-CRLF working-copy notices.

Baseline before Task 2 was also green: 87 files and 731 tests passed.

## Literal mutation-protection evidence

Focused assertions deliberately prove that translation does not rewrite source evidence or navigation identity:

- Customer entry: raw brand `StepFun 原名` and its exact brand href.
- Programs: raw name `StepFun China scored`, slug `cn-zh-scored`, market `CN`, Program locale `zh-CN`, timezone `Asia/Shanghai`, measurement-source ID/name, and example identity values.
- Visibility: raw Prompt text, provider/model key, prompt deep link, and `tab=web-queries` query identity.
- Share of voice: raw brand and competitor/entity names; only the aggregate UI label `Others` is localized.
- Citations: raw citation title, domain, URL, Prompt, observed query, product name, Reddit title/URL, and deep links.
- Opportunities: raw generated title, summary, rationale, risks, Prompt text, citations/URLs, and drill-down hrefs.
- Prompt history/detail: raw Prompt, model answer, observed query, model/version keys, competitor names, tags, snapshot hashes, and asset URLs.
- Response snapshots: exact screenshot/HTML/JSON/manifest query URLs, channel keys, model keys, hashes, and artifact payload text.
- Prompt list redirect: exact route ID and parameter/query identity.

These tests would fail under the requested realistic mutations: translating a Prompt, changing a Program locale, rewriting an href, or changing a query key.

## Route, access, and server invariants

- Existing route IDs, href shapes, query keys, loader inputs, redirects, brand parameters, access gates, and server calls are unchanged.
- No brand/competitor name, Prompt, model answer, citation, URL, observed query, model/provider key, market code, Program locale/timezone, ID, or stored status token is translated or mutated.
- Unknown error objects render safe generic localized copy and do not disclose backend exception text.
- Display dates continue through the existing UTC-safe localization provider; the response-snapshot panel retains its explicit product-owned `Asia/Shanghai` display semantics.
- Query Fan-Out route/analysis was not modified. Only `fanout-sections.tsx`, which is a child rendered by the in-scope Prompt detail route, was localized.
- Brand onboarding/settings were not modified. The existing not-onboarded `PromptWizard` branch remains owned by Task 3.
- Opportunity output language, generation, and persistence were not changed; only existing customer-facing Opportunity presentation was localized.
- No migration, database mutation, API contract change, service startup, or external-service call occurred.

## Self-review

- Reviewed all 47 application/test task files after formatting and confirmed the product diff is limited to the named routes, genuinely required children, the customer catalog, the localized Opportunity empty helper, and focused tests; the only additional files are the required Changeset and this report.
- Confirmed both locales expose identical typed catalog keys and that all 431 message IDs typecheck through the existing catalog architecture.
- Confirmed statuses and API tokens use explicit label maps rather than token capitalization.
- Confirmed raw evidence remains literal in JSX/tests and URLs/hrefs/query keys remain constructed from their original values.
- Confirmed the collapsed Opportunity drill-down remains hidden until selected while its generated evidence is never transformed.
- Confirmed unrelated worktree content was preserved and no Task 3 or Task 5 route was preempted.

## Commit

- Required subject: `Translate the customer portal experience`
- This report is committed with the implementation; the exact SHA is supplied in the final handoff because a Git commit cannot contain its own final hash.

## Concerns

None. Production-build warnings are pre-existing/local-environment warnings and did not affect the successful build.
