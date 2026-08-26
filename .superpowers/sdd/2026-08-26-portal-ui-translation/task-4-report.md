# Task 4 report — platform administration and sampling operations

## Outcome

Task 4 translates the platform-administration and sampling-operations experience into Simplified Chinese through the shared typed UI catalog. The implementation covers every named route, every production sampling component, and the reachable Opportunity-generation provider control without changing authorization, protocol data, or execution behavior.

- Audited production surfaces: **18** (7 routes, 10 sampling components, 1 reachable provider control).
- Production surfaces changed: **17**. `sampling-scope-provision-dialog.tsx` was audited and remains unchanged because it is a copy-free wrapper around an already localized control.
- Typed bilingual catalog entries: **565** message IDs, present in both English and Simplified Chinese.
- Focused Task 4 tests: **11 files / 64 tests**.
- Full web unit suite after implementation: **103 files / 830 tests**.

## Scoped production files

### Typed catalog

- `apps/web/src/i18n/catalogs/admin.ts` — new paired English/Chinese catalog for `admin.*`, `sampling.*`, `workflow.*`, and `providerTool.*` messages.
- `apps/web/src/i18n/catalog.ts` — composes `adminCatalog` into the application catalog, preserving compile-time message-ID and interpolation-key checking.

### Seven named routes

- `apps/web/src/routes/_authed/admin/index.tsx`
- `apps/web/src/routes/_authed/admin/access.tsx`
- `apps/web/src/routes/_authed/admin/workflows.tsx`
- `apps/web/src/routes/_authed/admin/tools.tsx`
- `apps/web/src/routes/_authed/admin/sampling/index.tsx`
- `apps/web/src/routes/_authed/admin/sampling/devices.tsx`
- `apps/web/src/routes/_authed/admin/sampling/$taskId.tsx`

All route heads, page context, descriptions, customer/access forms, workflow controls, provider tools, filters, tables, status copy, loading/empty/error/pending states, dialogs, tooltips, and accessibility copy are localized.

### Ten production sampling components

- `apps/web/src/components/sampling/browser-runner-device-list.tsx`
- `apps/web/src/components/sampling/browser-runner-extension-install.tsx`
- `apps/web/src/components/sampling/overseas-run-now-dialog.tsx`
- `apps/web/src/components/sampling/sampling-batch-card.tsx`
- `apps/web/src/components/sampling/sampling-batch-create-dialog.tsx`
- `apps/web/src/components/sampling/sampling-batch-list.tsx`
- `apps/web/src/components/sampling/sampling-run-now-dialog.tsx`
- `apps/web/src/components/sampling/sampling-status-badge.tsx`
- `apps/web/src/components/sampling/sampling-task-workbench.tsx`
- `apps/web/src/components/sampling/sampling-scope-provision-dialog.tsx` — audited; no local human-facing copy, so no edit was needed.

### Reachable admin-only control

- `apps/web/src/components/opportunities-generation-control.tsx` — localizes Program selection, validation, pending/success/insufficient-data/error states, and preserves raw generation errors separately.
- The existing admin sidebar/access predicates were audited. No production authorization or navigation predicate was changed.

## Tests

Modified:

- `apps/web/src/components/app-sidebar.test.tsx`
- `apps/web/src/components/opportunities-generation-control.test.tsx`
- `apps/web/src/components/sampling/browser-runner-device-list.test.tsx`
- `apps/web/src/components/sampling/browser-runner-extension-install.test.tsx`
- `apps/web/src/components/sampling/overseas-run-now-dialog.test.tsx`
- `apps/web/src/components/sampling/sampling-batch-list.test.tsx`
- `apps/web/src/components/sampling/sampling-run-now-dialog.test.tsx`
- `apps/web/src/components/sampling/sampling-task-workbench.test.tsx`

Added:

- `apps/web/src/components/sampling/sampling-batch-create-dialog.test.tsx`
- `apps/web/src/routes/_authed/admin/-admin-localization.test.tsx`
- `apps/web/src/routes/_authed/admin/sampling/-sampling-routes-localization.test.tsx`

The tests cover Chinese customer lists and tenant creation, access invitation/revocation, workflows, provider tools, browser device management and extension setup, batch creation/list/filtering, immediate dispatch, overseas cohorts, task workbench operations, route heads, data/empty/loading/error/pending states, and admin/report/customer access boundaries. Assertions also verify that raw IDs, status/provider/surface keys, prompts, evidence metadata and payloads, and developer error details remain byte-identical (allowing only React's required HTML escaping in serialized markup).

## Enum and raw-data policy

Stable stored values are never converted by capitalization or underscore replacement. Typed explicit message maps cover:

- customer workspace and public/legacy roles;
- sampling batch and task statuses;
- sampling result and automation statuses;
- Browser Runner readiness statuses;
- overseas cohort statuses;
- frozen session, search, and evaluation requirements;
- workflow recent-job, prompt-job status, and prompt-job activity labels.

Raw values remain protocol values and are not localized: stored status/action/provider/surface keys; IDs and hashes; prompts and manifests; market; Program locale/timezone; device/browser identities; route/search/query IDs; evidence payloads; and analytics inputs. Human operational descriptions are translated, while raw error text, Runner details, execution logs, evidence receipts, and protocol identifiers are shown in visibly labelled raw-detail `<pre>`/`<code>` regions without mutation. The Browser Runner lease token continues not to be rendered.

No `.capitalize` styling or underscore-to-space token transformation remains in the scoped production surfaces.

## Access and server invariants

- Platform administrators retain the customer, access, workflow, provider-tool, sampling, device, batch, task, and Opportunity-generation controls they had before this task.
- Report-only and customer roles gain no routes, controls, mutations, or provider execution capability.
- No server, service, API, database, migration, policy, protocol, or analytics file changed.
- Query keys, route/search parsing, request payload shapes, server functions, authorization predicates, mutation targets, evidence handling, and execution ordering are unchanged.
- The only view-model typing adjustment accepts the server's existing `Date | string` values; it does not transform or write data.
- No service was started and no external call was made.

## TDD evidence

### Baseline

- `pnpm.cmd --filter @workspace/web test`
- Result before Task 4 tests: **100 files / 804 tests passed**.

### RED, captured before production edits

- Focused command ran the 11 Task 4 test files.
- Result: **10 failing files; 25 intentional localization failures; 39 existing/invariant passes; 64 total tests**.
- Failures were Chinese render/operation expectations only; there were no import, setup, or fixture failures.
- The RED families covered customer/admin access, workflows, provider tools, device/batch/task operations, data/empty/error/pending states, raw-data identity, and authorization boundaries.

### GREEN

- Focused Task 4 suite: **11 files / 64 tests passed**.
- Existing execution/access-boundary suite: **21 files / 212 tests passed**. It covers customer/platform boundaries, Opportunity execution, sampling evidence/execution/timezone, Browser Runner authentication/bootstrap/claim/devices/service/snapshots, overseas dispatch/policy, sampling protocol/evidence HTTP/observation/run/scope provisioning.
- Full web unit suite: **103 files / 830 tests passed**.
- `pnpm.cmd --filter @workspace/web check-types`: passed.
- `pnpm.cmd --filter @workspace/web build`: passed.
- Task-scoped Biome check: **30 source/test files checked with zero diagnostics**.
- `git diff --check`: passed.

The repository-wide web lint command was also run. It reports the existing baseline outside Task 4: **15 errors, 191 warnings, and 9 infos** in unrelated files; no scoped Task 4 file is listed. Production build warnings are likewise pre-existing route-test discovery, browser externalization, and absent Sentry upload-token warnings.

## Changeset and commit

- Changeset: `.changeset/translate-platform-administration.md` (`@workspace/web` patch).
- Commit subject: `Translate platform administration`.
- The authoritative commit hash is supplied in the task handoff (a commit cannot embed its own final hash).

## Self-review

- Re-audited all 18 scoped production surfaces after implementation.
- Re-searched the scope for capitalization and underscore replacement of stored tokens; none remain.
- Confirmed the catalog contains 565 paired IDs and typecheck validates composition/interpolation.
- Reviewed the diff for server, authorization, query-key, payload, and raw-data changes; none were introduced.
- Confirmed raw identifiers and developer evidence are separated from translated prose.
- Confirmed task-scoped Biome and whitespace checks are clean after formatting.

## Concerns

- No Task 4 functional or access concern remains.
- Repository-wide lint is not globally green because of the documented pre-existing diagnostics outside this task; Task 4 files are clean.
- The successful build emits documented pre-existing warnings, but no Task 4 build error.
