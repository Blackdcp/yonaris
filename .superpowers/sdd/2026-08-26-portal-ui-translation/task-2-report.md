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

## Fix Round 1 (2026-08-27)

### Status

DONE. All four Important review findings are fixed. This round adds caller-owned Optimize labels, binding Prompt-detail Query Fan-Out terminology, catalog-controlled brand-creation validation with stable server failure codes, and stale-data preservation during transient dashboard polling errors. The deferred sentence-fragment Minor was intentionally not addressed.

The original report's statement that no server behavior changed is refined for this round: the two existing brand-creation denial branches now expose stable machine-readable error codes, as required by the binding design, while their access predicates and allow/deny outcomes remain unchanged. No business operation, route contract, loader, database write shape, or external service behavior changed.

### Exact coverage and files

Nineteen implementation/config/test files changed in this round:

- Shared Optimize interface and live caller path: `packages/config/src/types.ts`, `packages/whitelabel/src/components/optimize-button.tsx`, `apps/web/src/components/chart-actions-footer.tsx`, `apps/web/src/i18n/catalogs/charts.ts`, `apps/web/src/components/visibility-localization.test.tsx`, and `apps/web/vitest.config.ts`.
- Prompt-detail terminology and real child rendering: `apps/web/src/i18n/catalogs/customer.ts`, `apps/web/src/components/fanout-sections.tsx`, `apps/web/src/routes/_authed/app/$brand/prompts/$promptId.tsx`, and `apps/web/src/routes/_authed/app/$brand/prompts/-prompt-history-localization.test.tsx`.
- New-customer validation and stable failures: `apps/web/src/lib/brand-settings.ts`, `apps/web/src/routes/_authed/app/new.tsx`, `apps/web/src/server/brands.ts`, and `apps/web/src/routes/_authed/app/-customer-entry-localization.test.tsx`.
- Cached-data polling behavior: `apps/web/src/routes/_authed/app/$brand/index.tsx`, `apps/web/src/routes/_authed/app/$brand/share-of-voice.tsx`, `apps/web/src/routes/_authed/app/$brand/citations.tsx`, `apps/web/src/routes/_authed/app/$brand/-overview-localization.test.tsx`, and `apps/web/src/routes/_authed/app/$brand/-analytics-localization.test.tsx`.

No additional Changeset was added because the existing Task 2 patch Changeset already covers this customer-portal translation feature on the same branch.

### Finding 1: live Optimize control

- `OptimizeButtonProps` now has an optional, typed `OptimizeButtonLabels` interface. The whitelabel package remains application-agnostic and keeps backward-compatible English fallbacks; it does not import web messages or read Program locale.
- `ChartActionsFooter` supplies localized `Optimize with {provider}` and `Optimize for {model}` messages from the UI-language provider.
- The existing deployment feature gate, optimization URL template interpolation, web-query fetch, click behavior, and window-opening actions are unchanged.
- The visibility test now traverses the real `CachedPromptChart -> ChartActionsFooter -> OptimizeButton` production path instead of mocking away the footer. It asserts Chinese visible copy while preserving literal provider `Optimizer 原名` and Prompt `Which AI IDE works in 中国?`.
- The first direct live-child attempt exposed duplicate React installations in the workspace test resolver and failed with an invalid-hook harness error. Adding Vitest React/ReactDOM deduplication repaired the harness. The resulting product RED was 1 failed and 3 passed: Chinese was expected but the live control rendered `Optimize with Optimizer 原名`. GREEN was 4/4.

### Finding 2: binding Query Fan-Out terminology

- English page/tab copy is `Query Fan-Out`.
- Chinese page/tab, group, item/query, and helper copy is exactly `AI 检索脉络`, `检索路径`, `衍生检索词`, and `查看 AI 为回答当前问题而展开的实际联网搜索词。`.
- Wrong Prompt-detail terms `联网检索词`, `提示词检索扩展`, and `检索词用词` were removed from production Prompt-detail messages. A targeted source audit finds those literals only in negative assertions.
- `InfoTip` now supports an optional caller-provided accessibility label and uses a semantic button, making the exact helper available to keyboard/screen-reader users without coupling the shared child to the catalog.
- The Prompt-detail test renders the real fan-out children, checks all binding terms, rejects all three wrong terms, and proves the raw observed query is unchanged even though the highlighter splits it across markup.
- RED was 1 failed and 4 passed with the old terminology. GREEN was 5/5.

### Finding 3: new-customer validation and failures

- The form now uses `noValidate` so catalog-owned UI feedback is authoritative while retaining semantic `required` attributes.
- Pure client validation covers required and bounded brand name, required/bounded website, and valid URL/domain syntax. Field errors are typed message IDs rendered with `aria-invalid` and `aria-describedby`.
- The server's existing two creation-denial branches now throw shared stable codes `BRAND_CREATION_FORBIDDEN` and `BRAND_CREATION_NOT_ALLOWED`. The client localizes these bounded outcomes and maps every other thrown value to `common.error.unexpected`, never exposing arbitrary backend detail.
- The test submits blank/invalid field values, verifies exact Chinese catalog feedback and that the server is not called, covers a bounded denial and generic fallback, and proves valid `StepFun 原名` plus `evidence.example.cn/path?q=CN` reach the server unchanged.
- Initial RED was 4 failed and 2 passed because `noValidate` and the validation submission boundary did not exist. The first GREEN was 6/6. Tightening the bounded failure from human exception text to the binding stable code produced a second expected RED of 1 failed and 5 passed, followed by GREEN 6/6 after the shared producer/consumer code was implemented.

### Finding 4: stale cached polling data

- Dashboard renders a full error only when the specific errored query has no corresponding brand, summary, or Share-of-Voice data.
- Share of Voice renders a full error only for `isError && !data`.
- Citations renders a full error only for a resolved scope with an error and no citation data.
- Literal cached-data-plus-error tests cover all three route families: Dashboard keeps `42%`, `35%`, `1,234`, and its exact series; Share of Voice keeps `StepFun 原名`, `DeepSeek 原名`, and `80%`; Citations keeps `Raw Evidence 标题`, `evidence.example`, and its exact URL. Separate no-data error tests retain localized Chinese copy.
- RED was 3 failed and 12 passed across the overview/analytics files because all three routes replaced cached data. GREEN was 15/15.

### Final GREEN and quality evidence

- Amended five-file review suite: 5 files passed, 30 tests passed, 5.32 seconds.
- Original Task 2 ten-file suite: 10 files passed, 49 tests passed, 5.65 seconds.
- Full `apps/web` unit suite: 95 files passed, 769 tests passed, 12.41 seconds.
- `packages/config` tests: 4 files passed, 25 tests passed, 309 milliseconds.
- Direct TypeScript checks for `packages/config`, `packages/whitelabel`, and `packages/local`: passed.
- `apps/web` `tsc --noEmit`: passed.
- Production Vite/Nitro build: passed. Output contains only the same two pre-existing route-test discovery warnings, missing-Sentry-token notices, and native-builder informational warning.
- Biome and `git diff --check`: passed for the round's changed source/test files; Git reports only configured LF-to-CRLF notices.

`packages/deployment` has no typecheck script, and its standalone `tsc -p packages/deployment/tsconfig.json --noEmit` is not a healthy independent check: its existing `lib: ["esnext"]` configuration transitively includes the whitelabel browser component and reports the pre-existing `window` DOM-global errors. The directly changed config/whitelabel packages and the web application that consumes deployment all typecheck successfully.

### Evidence, route, access, and scope invariants

- Raw brand/competitor/provider names, Prompt text, observed queries, domain inputs, citation titles/domains/URLs, metric values, chart series, model keys, and href/query identity remain literal in the amended tests.
- Optimize labels are the only live-control change; feature gates, templates, URLs, fetch parameters, and actions are untouched.
- Brand-creation denial predicates, authentication, admin/deployment gates, valid submitted values, server call shape, route ID, navigation params, analytics event name, and database work are unchanged. Only the two user-visible denial representations became stable codes.
- Dashboard/SOV/Citations query keys, polling behavior, and server calls are unchanged; only presentation precedence now favors valid cached data over a transient error flag.
- The separate Query Fan-Out route/analysis remains Task 5 and was not modified. Only the in-scope Prompt-detail page and genuinely required shared child were changed.
- No Task 3 onboarding/settings work, Opportunity output-language persistence, migration, service startup, or external call was performed.

### Self-review

- Reviewed the complete 19-file diff after formatting and corrected the whitelabel English fallback to preserve the prior empty-provider rendering behavior.
- Confirmed shared package labels are optional and caller-owned, and package/web typechecks enforce the interface.
- Confirmed binding Chinese terms are exact and rejected terms are absent from production Prompt-detail copy.
- Confirmed form feedback uses typed semantic catalog IDs and arbitrary exception text cannot reach the UI.
- Confirmed every changed polling route distinguishes cached data from absent data.
- Confirmed the deferred sentence-fragment Minor remains untouched.

### Commit

- Planned imperative subject: `Fix customer portal localization gaps`
- The exact SHA is supplied in the final handoff because a Git commit cannot contain its own final hash.

### Concerns

No product concern. The standalone deployment tsconfig limitation and production-build warnings above are pre-existing repository/local-environment constraints; the affected shared packages and full application verification are green.

## Fix Round 2 (2026-08-27)

### Status

DONE. The `InfoTip` accessibility regression is fixed at the typed shared boundary and every production caller now supplies a semantic localized accessible name. This round supersedes Fix Round 1's optional-label statement: `InfoTip.label` is required, so future unlabeled callers fail TypeScript compilation.

### Exact coverage and files

- `apps/web/src/components/fanout-sections.tsx`: requires `label` and reuses the active localized word-change helper as the Query Words button name.
- `apps/web/src/i18n/catalogs/customer.ts`: adds six paired semantic accessibility messages for Query Fan-Out statistics, Prompt Fan-Out, and Top Queries.
- `apps/web/src/routes/_authed/app/$brand/query-fan-out.tsx`: supplies localized names for all four metric `InfoTip` buttons plus Prompt Fan-Out and Top Queries without changing tooltip children or visible route copy.
- `apps/web/src/routes/_authed/app/$brand/-fanout-accessibility-localization.test.tsx`: new bilingual live-route caller coverage across all three Query Fan-Out tabs.
- `apps/web/src/routes/_authed/app/$brand/prompts/-prompt-history-localization.test.tsx`: adds bilingual Prompt-detail accessible-name assertions through the real fan-out child.

The report is the sixth changed file. The existing Task 2 Changeset continues to cover this fix on the same branch.

### TDD RED/GREEN evidence

- RED command rendered the new Query Fan-Out route test and existing Prompt-detail test before any production change.
- RED result: 1 file failed and 1 passed; 2 tests failed and 5 passed. Both English and Chinese route cases found exactly five live `cursor-help` buttons, but every accessible name was `null`. Prompt-detail's one previously labeled button passed, proving the failure was the omitted-caller regression rather than the test harness.
- Minimal GREEN made `InfoTip.label` required, reused the shared word-help translation, and supplied six exact typed catalog messages at the Query Fan-Out callers.
- First GREEN: 2 files passed, 7 tests passed, 1.13 seconds.
- Post-format affected fanout/Prompt-detail suite: 3 files passed, 27 tests passed, 1.16 seconds.

The new route test renders `fanout`, `top-queries`, and `words` in both `en` and `zh-CN`. Each render queries every live `InfoTip` button's `aria-label`-defined accessible name: four metric names plus the active tab's Prompt Fan-Out, Top Queries, or localized word-change helper name. The Prompt-detail test independently queries its exact helper name in both locales.

### Final verification

- Amended six-file Task 2 review suite: 6 files passed, 32 tests passed, 6.62 seconds.
- Original Task 2 ten-file suite: 10 files passed, 49 tests passed, 6.20 seconds.
- `apps/web` `tsc --noEmit`: passed; this compile proves no production `InfoTip` caller can omit the now-required prop.
- Biome checked the five changed code/test files with no remaining diagnostics after one formatting fix.
- `git diff --check`: passed with only configured LF-to-CRLF notices.

### Evidence and scope invariants

- The accessibility test keeps literal `Raw Prompt 中国` and `raw observed query 中国` visible through the real route children.
- Query Fan-Out's visible English title, descriptions, tooltips, tabs, columns, and other presentation copy are unchanged; only non-visible `aria-label` values vary by UI language.
- No route ID, search/tab key, href, query key, data fixture shape, server call, hook behavior, analysis function, raw observed query, or Prompt value changed.
- The Query Fan-Out route file is touched only because it owns the previously unlabeled callers; Task 5 analysis/localization work was not preempted.
- No migration, service startup, external call, access gate, onboarding/settings, or Opportunity output-language behavior changed.

### Self-review

- `git grep` confirms every production `<InfoTip>` call supplies `label`.
- The route test does not mock `InfoTip`, `fanout-sections`, Tabs, Tooltip, word cloud, or progress-bar children; it exercises the real button boundary and all active-tab call sites.
- Accessible labels are caller-specific typed catalog messages, not a generic fallback and not Program-locale-derived.
- Existing tooltip children remain unchanged, so mouse/keyboard tooltip content and visible Task 5 copy are preserved.

### Commit

- Planned imperative subject: `Require accessible fan-out info labels`
- The exact SHA is supplied in the final handoff because a Git commit cannot contain its own final hash.

### Concerns

None.
