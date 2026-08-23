# Task 4 report — unify shells and isolate page CSS

## Scope

Implemented Foundation Task 4 only from base `39267fae48e6ede7ef9c148fd4c78f09f493b583`.

- Added manifest-derived, router-independent `SiteHeader`, `SiteFooter`, and `SiteShell` primitives.
- Added publication, utility, and legacy archive context primitives for later route-family migration.
- Kept zero-prop `Navbar` and `Footer` compatibility wrappers for existing consumers.
- Mapped legacy marketing page keys to typed canonical `CorePageKey` active states without retaining alias navigation hrefs.
- Split shared tokens/base/prose, Product Stage styles, and future page-focused styles while preserving third-party import order.
- Migrated every current marketing consumer away from the removed Surface and Signal Strong aliases.
- Did not create future canonical route pages or change marketing facts.

## RED evidence

Baseline before Task 4 changes:

- `pnpm.cmd --filter @workspace/www test` — 56 tests passed.

Task 4 RED:

- Focused WWW command failed on the absent `site-navigation`/site-shell modules and four missing CSS split/token contracts.
- Homepage Playwright failed 3 of 12 tests: English and Chinese navigation still emitted legacy aliases, and the mobile shell had no button disclosure contract.
- The failures matched the intended missing behavior rather than an existing baseline regression.

## GREEN evidence

- Focused shell/style command — 68 tests passed across 8 files.
- Full WWW suite — 68 tests passed across 8 files.
- Homepage Playwright — 12 tests passed, including Enter/Space opening, Escape close and focus restoration, close-on-selection with navigation prevented, 44px trigger sizing, and zero overflow at 390px.
- WWW typecheck — passed.
- Task 4 Biome check — passed with no diagnostics.
- WWW production build — passed.
- Static scans found no first-party marketing/CSS use of `radial-gradient`, `--yonaris-surface`, or `--yonaris-signal-strong`.

## Visual QA

Inspected full-page captures for:

- English homepage at 1440 × 900.
- Chinese homepage at 1440 × 900.
- English homepage at 390 × 844 with the mobile disclosure open.

The shared header/footer align with the existing Product Stage in both locales. The mobile panel stays inside the viewport, exposes canonical navigation, Portal, locale switching, and one header diagnostic action, and does not introduce horizontal overflow. Paper, Mist, Ink, and Signal Orange remain visually distinct after the gradient and alias removal.

## Risks and follow-up boundaries

- The build and dev server continue to report existing `createServerFn().inputValidator()` deprecation warnings in Blog and Docs, plus missing local Upstash configuration warnings. They do not fail Task 4 verification and are outside this task.
- Canonical Product, Approach, Research, and Company pages are intentionally not created here; tests verify hrefs without navigating to those future routes.
- Publication and utility primitives are ready, while route-by-route adoption remains owned by the later governance migration. Existing routes receive the new identity immediately through the compatibility wrappers.
