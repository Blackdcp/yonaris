# Task 3 report: Onboarding and brand settings

## Status

DONE. Brand onboarding and every customer brand-settings surface are bilingual for `en | zh-CN`. The implementation localizes visible and accessible presentation while preserving submitted data, route identity, access control, and server behavior.

## Binding inputs

- Read `AGENTS.md` completely before task work.
- Read `.superpowers/sdd/2026-08-26-portal-ui-translation/task-3-brief.md` completely before task work.
- Reused the customer catalog, locale provider, route-head helpers, and stable Task 2 brand-creation error-code pattern already present on the branch.
- Starting HEAD: `53596611ca245b6d47be020ec69fc8502607ad0e` (`Require accessible fan-out info labels`).

## Audited production coverage

Fourteen production surfaces were audited: eight route boundaries and six component/control boundaries. This includes all six routes named in the brief plus their actual parent/access and shared-control paths.

### Route boundaries (8)

- `apps/web/src/routes/_authed/app/$brand.tsx`: localized the parent metadata used while the onboarding branch renders, preserving the raw brand name.
- `apps/web/src/routes/_authed/app/$brand/settings.tsx`: audited the write-access loader and `Outlet`; it has no visible copy and remains unchanged.
- `apps/web/src/routes/_authed/app/$brand/settings/brand.tsx`: localized head metadata, loading/not-found states, labels, placeholders, hints, tooltips, accessibility names, validation, pending/success/error states, and tag controls.
- `apps/web/src/routes/_authed/app/$brand/settings/competitors.tsx`: localized head metadata, loading/not-found states, warning, editor shell, pending/success/error states, and validation.
- `apps/web/src/routes/_authed/app/$brand/settings/prompts.tsx`: localized head metadata, measurement-scope heading/description, and the bounded legacy-scope display label without changing the stored scope name.
- `apps/web/src/routes/_authed/app/$brand/settings/members.tsx`: localized head metadata, invite controls, role display, member and invitation sections, dates, action/pending states, and safe errors.
- `apps/web/src/routes/_authed/app/$brand/settings/llms.tsx`: audited the explicit fail-closed route; it renders no UI and its `notFound()` behavior remains unchanged.
- `apps/web/src/routes/_authed/app/$brand/prompts/edit.tsx`: audited the compatibility redirect; it renders no UI and retains the exact route and brand parameter.

### Components and shared controls (6)

- `apps/web/src/components/brand-onboarding.tsx`
- `apps/web/src/components/competitors-editor.tsx`
- `apps/web/src/components/prompts-editor.tsx`
- `apps/web/src/components/prompts-list-editor.tsx`
- `apps/web/src/components/localized-tags-input.tsx`
- `packages/ui/src/components/tags-input.tsx`

The shared editors now localize empty, capacity, selection, table-header, label, placeholder, tooltip, validation, read-only, pending, and accessibility copy. `TagsInput` gained an optional caller-owned `ariaLabel`; the web localization wrapper also supplies the Chinese/English no-results label, in addition to its existing localized removal, capacity, entry-hint, and add-value labels.

### Catalog and errors

- Added 134 paired message IDs to `apps/web/src/i18n/catalogs/customer.ts` (268 English/Chinese entries): 14 `customer.*` IDs and 120 `settings.*` IDs.
- Added `apps/web/src/components/customer-settings-errors.ts`, which returns typed `MessageId` values from bounded exact server messages.
- Preserved both Task 2 stable codes, `BRAND_CREATION_FORBIDDEN` and `BRAND_CREATION_NOT_ALLOWED`, mapping them to `customer.new.error.notAllowed`.
- Recognized only the applicable bounded legacy outcomes for onboarding, brand update, Prompt automatic-scope/capacity/brand-not-found failures, unavailable team invitations, and self-removal.
- Every unrecognized thrown value maps to `common.error.unexpected`; arbitrary exception text is never rendered as primary UI copy.

## TDD evidence

### Initial RED

Before production edits, the two initial focused Chinese form files ran with:

```powershell
.\node_modules\.bin\vitest.cmd run --project=unit 'src/components/settings-editors-localization.test.tsx' 'src/routes/_authed/app/$brand/settings/-settings-localization.test.tsx'
```

- Test files: 2 failed.
- Tests: 23 total, 22 failed, 1 passed.
- The failures were product RED: hard-coded English or missing typed submission/error helpers. The already-green assertion was the combined permission, fail-closed LLM, and redirect-identity invariant.
- Test-only corrections made before counting RED were limited to the literal route path and the repository's actual `MAX_COMPETITORS = 100` constant.

Additional narrow RED checks were captured before their production fixes:

- Removing the exact automatic-Prompt-scope mapping made the bounded-error assertion fail by returning `common.error.unexpected`; restoring the exact map returned it to green.
- The parent `$brand` metadata assertion failed against the original English description before the localized route-head change.
- The shared tag-picker test failed 1/1 with `<span></span>` before `LocalizedTagsInput` supplied the localized no-results copy, then passed 1/1.

### Final GREEN

Focused Task 3 suite:

```powershell
.\node_modules\.bin\vitest.cmd run --project=unit 'src/components/localized-tags-input-localization.test.tsx' 'src/components/settings-editors-localization.test.tsx' 'src/routes/_authed/app/$brand/settings/-settings-localization.test.tsx'
```

- 3 files passed.
- 26 tests passed.

Relevant existing localization, mutation-limit, access, and Prompt-execution tests:

- 9 files passed.
- 68 tests passed.

Full final web unit suite:

- 99 files passed.
- 797 tests passed.
- Duration: 12.69 seconds.

## Verification

- `apps/web` TypeScript: `.\node_modules\.bin\tsc.cmd --noEmit` passed.
- Production build: `pnpm.cmd --filter @workspace/web build` passed and generated the Vite/Nitro output.
- Biome: checked all applicable changed Task 3 TypeScript/TSX inputs (15 files), with no fixes or diagnostics.
- `git diff --check`: exited 0; output contained only configured LF-to-CRLF working-copy notices.
- A scoped literal audit found no remaining visible hard-coded English JSX/placeholder/accessibility strings and no `err.message`/`error.message` presentation in the onboarding/settings production family.
- Build output contained the same pre-existing route-test discovery, Node browser-externalization, and missing-Sentry-token warnings; none affected the successful build.

## Data, role, route, and access invariants

Focused bilingual assertions prove that localization does not rewrite domain values:

- Onboarding sends the exact brand ID, brand name, and website/URL entered by the user in both locales.
- Brand settings send the exact brand ID, brand name, website, additional-domain array, and alias array in both locales.
- Competitor settings preserve competitor names, domain arrays, alias arrays, and brand identity in both locales; only the same pre-existing trim/cleanup boundary is used.
- Prompt settings preserve stored/new Prompt text, Prompt IDs, scope ID, enabled booleans, custom tags, and system-tag display data in both locales. Saved Prompt text remains disabled/read-only.
- Team invitations send the exact email and the stable `member | admin` role token in both locales. Stored `owner | admin | member` tokens receive localized display labels only; unknown role tokens are displayed literally rather than rewritten.
- Program market, locale, and timezone values were not touched.
- LLM provider/model keys and the LLM fail-closed route were not touched.
- The Prompt compatibility redirect remains `/app/$brand/settings/prompts` with the exact incoming brand parameter.
- Prompt save navigation remains `/app/$brand/visibility` with the exact `scope` search identity.
- Settings access continues to call `checkBrandWriteAccess(userId, brandId)` and throws `notFound()` when false; no permission predicate changed.
- No route ID, loader input, query key, analytics event identity, server function, database shape, or external-service behavior changed.

## Files and release metadata

Production/catalog files changed or added:

- `.changeset/translate-customer-portal.md`
- `apps/web/src/components/brand-onboarding.tsx`
- `apps/web/src/components/competitors-editor.tsx`
- `apps/web/src/components/customer-settings-errors.ts`
- `apps/web/src/components/localized-tags-input.tsx`
- `apps/web/src/components/prompts-editor.tsx`
- `apps/web/src/components/prompts-list-editor.tsx`
- `apps/web/src/i18n/catalogs/customer.ts`
- `apps/web/src/routes/_authed/app/$brand.tsx`
- `apps/web/src/routes/_authed/app/$brand/settings/brand.tsx`
- `apps/web/src/routes/_authed/app/$brand/settings/competitors.tsx`
- `apps/web/src/routes/_authed/app/$brand/settings/members.tsx`
- `apps/web/src/routes/_authed/app/$brand/settings/prompts.tsx`
- `packages/ui/src/components/tags-input.tsx`

Focused tests added:

- `apps/web/src/components/localized-tags-input-localization.test.tsx`
- `apps/web/src/components/settings-editors-localization.test.tsx`
- `apps/web/src/routes/_authed/app/$brand/settings/-settings-localization.test.tsx`

The existing `translate-customer-portal.md` patch Changeset already represented the same customer-portal localization release. Its summary was expanded to name onboarding and brand settings; a duplicate Changeset was not added.

No migration, service startup, external call, or server implementation change occurred.

## Self-review

- Reviewed the complete scoped diff after formatting and the production children reached by each named route.
- Confirmed metadata uses `match.context?.uiLanguage ?? "en"` and never browser globals.
- Confirmed message interpolation is limited to presentation; raw names, URLs, Prompt text, tags, IDs, roles, and scope values remain source data.
- Confirmed legacy text matching is exact and bounded, while unknown text is non-disclosing generic UI.
- Confirmed the shared UI addition is optional/backward-compatible and all in-scope callers provide semantic accessible names.
- Confirmed the two no-visible-copy routes and the settings permission guard remain intentionally unchanged and are covered by invariant tests.
- Confirmed unrelated worktree content was preserved.

## Commit

- Planned imperative subject: `Translate onboarding and brand settings`.
- This report is committed with the implementation; the exact SHA is supplied in the final handoff because a Git commit cannot contain its own final hash.

## Concerns

None. The successful production build emitted only the pre-existing/local-environment warnings described above.

---

## Fix Round 1 — onboarding route, Wizard errors, and invite validation

### Status and review findings addressed

All three Important review findings are fixed:

1. The real `brand.onboarded === false` branch in `apps/web/src/routes/_authed/app/$brand/index.tsx` now localizes its intro and every visible/accessibility state reached through the actual `PromptWizard`.
2. Analyze, worker-status, and save failures now cross a bounded `MessageId` mapping boundary. Stable exact outcomes are localized and every unknown value becomes `common.error.unexpected`; raw provider, worker, database, and stack text is not rendered.
3. Team invite submission now owns required/invalid-email validation in the catalog, bypasses browser-native copy with `noValidate`, exposes described `aria-invalid` feedback, and still submits the exact email and stable `member | admin` token.

The two deferred Minor findings were intentionally not changed.

### Additional audited production coverage

The review audit added the route branch that the first implementation missed and followed every production child it reaches:

- `apps/web/src/routes/_authed/app/$brand/index.tsx`: not-onboarded route title, description, completion callback, and redirect-template boundary.
- `apps/web/src/components/prompt-wizard.tsx`: initial, analyzing, cancellation, timeout, analysis failure, review, identity-change/reanalysis, validation, saving, save failure, and save-complete states.
- `apps/web/src/components/competitors-editor.tsx`, `apps/web/src/components/prompts-list-editor.tsx`, `apps/web/src/components/localized-tags-input.tsx`, and `packages/ui/src/components/tags-input.tsx`: re-audited as reachable Wizard children; their Task 3 localized labels, placeholders, table/control copy, tooltips, validation, read-only states, and accessibility names remain in use.
- `apps/web/src/routes/_authed/app/$brand/settings/members.tsx`: invite field validation, feedback relationship, pending state, and exact payload boundary.

Thirty-four paired English/Chinese IDs were added: 32 `customer.onboardingWizard.*` IDs and two `settings.team.validation.*` IDs.

### Strict TDD evidence

#### RED

Before production edits, the deterministic unit/SSR command was:

```powershell
.\node_modules\.bin\vitest.cmd run --project=unit 'src/components/prompt-wizard-localization.test.tsx' 'src/routes/_authed/app/$brand/-overview-localization.test.tsx' 'src/routes/_authed/app/$brand/settings/-settings-localization.test.tsx'
```

- Test files: 3 failed.
- Tests: 26 total, 6 failed and 20 passed.
- Failures proved that the production `PromptWizardView` state boundary and submission builder did not exist; Wizard stable-error operations returned the generic ID; the actual not-onboarded route rendered `Research Brand Data`, its English description, and `Analyze brand`; and a blank invite was sent instead of returning catalog validation.
- A narrower invite-first RED was also captured at 1 failed / 15 passed: whitespace-only email returned `ok: true` and invoked the invite mutation.

An initial browser-story RED attempt failed before product assertions because Playwright could not launch in this sandbox (`browserType.launch: spawn EPERM`). An escalated retry remained pending for approval and was aborted rather than left open-ended. A scoped process audit found no newly created test/browser process. The test architecture was therefore switched to bounded node SSR/view-state assertions; the real route still renders the real Wizard rather than mocking it away.

#### GREEN

The same amended command finished with:

- Test files: 3 passed.
- Tests: 27 passed.
- Coverage includes Chinese route intro; Wizard initial, analyzing, cancellation, generic failure, review, reanalysis, validation, saving, labels, placeholders, accessibility names, stable failures, and arbitrary-error suppression; both-locale exact Wizard save values; team field validation; and both-locale exact invite email/role values.

Original Task 3 focused suite:

```powershell
.\node_modules\.bin\vitest.cmd run --project=unit 'src/components/localized-tags-input-localization.test.tsx' 'src/components/settings-editors-localization.test.tsx' 'src/routes/_authed/app/$brand/settings/-settings-localization.test.tsx'
```

- Test files: 3 passed.
- Tests: 27 passed.

Relevant localization, policy, role, mutation-limit, onboarding, and Prompt-execution regression group:

- Test files: 11 passed.
- Tests: 204 passed.

Final full web unit suite:

- Test files: 100 passed.
- Tests: 804 passed.
- Duration: 12.93 seconds.

### Verification

- Final `apps/web` TypeScript: `.\node_modules\.bin\tsc.cmd --noEmit` passed.
- Production build: `pnpm.cmd --filter @workspace/web build` passed.
- Storybook static build: `pnpm.cmd --filter @workspace/web storybook:build` passed, including the real-route Chinese onboarding stories for initial, pending, failure, review/validation, and save-visible states.
- Browser interaction execution remains unavailable in this sandbox because Playwright process creation returns `spawn EPERM`; deterministic unit/SSR coverage and the successful Storybook compile are the bounded substitute.
- Biome: 10 changed TypeScript/TSX inputs passed with no fixes or diagnostics after formatting.
- `git diff --check`: exited 0; output contained only configured LF-to-CRLF working-copy warnings.
- Literal audit found no user-visible hard-coded English in the Wizard/route branch and no `err.message`, `error.message`, or raw worker-status rendering.
- The production build emitted only the same pre-existing route-test discovery, browser externalization, missing-Sentry-token, and bundle-size warnings.

### Error policy

Bounded mappings recognize only these stable exact values:

- Analyze/save permission: `Forbidden: Platform administrator access required` → `customer.onboardingWizard.error.notAllowed`.
- Worker status: `Brand analysis failed. Please try again.` → `customer.onboardingWizard.error.analysisFailed`.
- Save validation: `Website URL must use http or https` and `Website URL must have a valid hostname` → `customer.onboardingWizard.validation.websiteInvalid`.

Every other analyze exception, worker status string, or save exception maps to `common.error.unexpected`. Tests render the mapped Chinese failure state and prove arbitrary provider, SQL/worker, database, and stack evidence is absent. The Task 2 brand-creation code mappings remain unchanged.

### Value, role, job, route, and access invariants

- In both `en` and `zh-CN`, Wizard tests preserve the exact brand ID, brand name, website including path/query, additional domains, aliases, competitor names/domains/aliases, Prompt text, tags, and enabled token at the save boundary.
- In both locales, team invite tests preserve `invitee+中国@example.cn` and the exact stable `admin` role token. Validation inspects but never trims or rewrites the submitted valid email.
- The Wizard keeps the same analyze/cancel/status server functions, two-second polling interval, six-minute timeout, query key, worker suggestion mapping, analytics event identities, cache invalidations, router invalidation, completion callback, and redirect-template navigation.
- Existing competitor and Prompt filtering/trimming rules are unchanged; stored domain values outside those established rules are not translated.
- The not-onboarded predicate, route identity, brand parameter, permission predicates, and server behavior are unchanged.
- No Program market/locale/timezone, LLM key, migration, service, external call, or database shape changed.

### Files changed in Fix Round 1

Production/catalog:

- `apps/web/src/components/customer-settings-errors.ts`
- `apps/web/src/components/prompt-wizard.tsx`
- `apps/web/src/i18n/catalogs/customer.ts`
- `apps/web/src/routes/_authed/app/$brand/index.tsx`
- `apps/web/src/routes/_authed/app/$brand/settings/members.tsx`

Tests/story support:

- `apps/web/src/components/prompt-wizard-localization.test.tsx`
- `apps/web/src/routes/_authed/app/$brand/-overview-localization.test.tsx`
- `apps/web/src/routes/_authed/app/$brand/settings/-settings-localization.test.tsx`
- `apps/web/src/stories/overview.stories.tsx`
- `apps/web/src/stories/_mocks/server-onboarding.ts`

The existing customer-portal Changeset still accurately covers this corrective part of the same onboarding/settings localization slice, so no duplicate Changeset was added.

### Self-review

- Compared the pure submission builder field-for-field with the former inline payload construction; its filtering, fallback, and trimming behavior is unchanged.
- Confirmed all displayed Wizard errors are `MessageId` values and every raw exception/status input enters the bounded mapper.
- Confirmed labels and tag inputs have catalog-owned accessible names, and the invite error is related with `aria-describedby` only while present.
- Confirmed `noValidate` suppresses browser-locale validation while `type="email"` and `required` retain semantic input metadata.
- Re-read the complete production diff and re-ran final unit/type/build/format gates after the last test changes.

### Commit

- Planned imperative subject: `Fix onboarding wizard localization gaps`.
- This report is included with the implementation; the exact SHA is supplied in the final handoff because a Git commit cannot contain its own final hash.

### Fix Round 1 concerns

- Playwright-backed Story interactions could not execute in the managed sandbox because browser process creation is denied (`spawn EPERM`). The identical state/error/value requirements are covered by deterministic node tests, and the complete Storybook bundle builds successfully.
