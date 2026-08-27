# Task 3 report — Chinese Human route recomposition

Date: 27 August 2026

Worktree: `E:\Yonaris\.worktrees\site-production-06`

Branch: `codex/site-production-06`

Required base: `2bde7398`

## Sources reviewed before implementation

The following sources were read in full before production files were edited:

- `.superpowers/sdd/2026-08-27-yonaris-site-06-fidelity/task-3-brief.md`
- `docs/superpowers/specs/2026-08-27-yonaris-site-06-fidelity-design.md`
- `docs/superpowers/plans/2026-08-27-yonaris-site-06-fidelity.md`
- `docs/design/site-06-reference/site-system-multipage-agent-06.html`
- all approved Chinese desktop and mobile screenshots in `C:\Users\user\.codex\visualizations\2026\08\10\019fec31-4f56-72d3-8476-ba90669ad5d9\site06-approved-source`

The worktree and branch were verified before editing, and `git merge-base HEAD codex/site-production-06` / `git rev-parse HEAD` resolved to the required base `2bde7398` at task start.

## Implementation outcome

The seven Chinese Human routes now use distinct, route-specific Site 06 compositions:

- `/zh`: cinematic photo hero, single public-purpose reading orbit, dark five-state business-anxiety selector, source trace, photographic market bridge, expandable public Fact/Evidence/Boundary/Stable-ID records, and one restrained close.
- `/zh/product`: photographic hero with the binding five-label relationship preview followed by the six-node interactive system field.
- `/zh/approach`: photographic breakdown preview followed by one four-state example replayed through 基线、断点、行动、复核.
- `/zh/company`: dark Human/Agent dual-reading field, warm category/purpose/scope canonical record, editorial machine-readability explanation, and restrained dark close.
- `/zh/geo`: warm market editorial/photo, five-condition ledger, supporting evidence lines, canonical market-context record, and restrained dark close.
- `/zh/diagnostic`: near-viewport photographic contact composition with exactly 姓名、电话、公司, a transparent square submit control with an orange bottom edge, and the existing provider-backed/SSR form behavior. The canonical contact fact remains machine-readable but does not create a visible aside.
- `/zh/privacy`: concise warm privacy editorial tied to the three Chinese contact fields.

The exact canonical category remains:

`面向人类决策、由 Agent 共同塑造的 AI 原生营销科技基础设施。`

All public company records use the 27 August 2026 canonical facts rather than prototype scaffolding.

## TDD evidence

### Baseline

Before implementation, the existing China and lead-form suites passed 15 tests.

### RED 1 — route recomposition

New route-composition tests were added first for:

- seven unique Chinese composition identifiers;
- locally written anxiety copy and five accessible anxiety tabs;
- binding five-label product preview before a six-node interactive field;
- one four-state breakdown example;
- Human/Agent readings of the same canonical fact;
- exact Chinese navigation/category/form contracts;
- removal of the retired generic hero, numbered/arrow grammar, and outcome promises;
- distinct desktop/mobile spatial behavior.

The first focused run failed 12 targeted assertions because the production routes still exposed the previous generic composition.

### GREEN 1 — route scenes

The route-specific page and scene implementations made the focused China/form run pass. CSS behavior assertions were also introduced RED-first before the responsive spatial rules were implemented.

### RED 2 — source-fidelity audit

A second focused audit added assertions for binding source details. The run failed four tests because:

- the Chinese Home photo incorrectly inherited the English `center 72%` focal rule and the warm fact bridge was static;
- Company lacked the warm category/purpose/scope record and close;
- GEO lacked supporting evidence lines and a close;
- Diagnostic rendered the canonical fact as a visible aside.

The implementation then changed Home to the binding `center center` focal position, made its three public records expandable, added the required Company and GEO sequences, and converted the Diagnostic fact to screen-reader-only machine-readable content.

### RED 3 — mobile capture defect

Capture review prompted a CSS contract assertion for Chinese lead-track minimum width and heading wrapping. It failed before the track/wrapping rules were added, then passed after implementation.

### Systematic-debugging evidence

An intermediate full-suite run exposed one Human/Agent parity failure. The failure was traced to canonical semantic targets having been changed from `<article>` records during recomposition, rather than to copy drift. Restoring stable `<article>` fact targets (and the exact privacy fact value) resolved the focused parity suite without weakening the assertion.

## Final verification evidence

Run from `E:\Yonaris\.worktrees\site-production-06` after all edits:

```text
pnpm --filter @workspace/www exec vitest run src/components/experience/china/china-experience.test.tsx src/components/experience/shared/lead-form.test.tsx
Test Files  2 passed (2)
Tests       26 passed (26)

pnpm --filter @workspace/www exec vitest run src/components/experience/china/china-experience.test.tsx src/components/experience/site-generation.test.tsx src/content/experience/category-contract.test.tsx
Test Files  3 passed (3)
Tests       25 passed (25)

pnpm --filter @workspace/www exec vitest run
Test Files  32 passed (32)
Tests       196 passed (196)

pnpm --filter @workspace/www check-types
$ tsc --noEmit

pnpm --filter @workspace/www build
client, SSR, and Nitro production builds completed successfully

git diff --check
passed (line-ending conversion notices only; no whitespace errors)
```

The production build retained the pre-existing informational warning that the main minified chunk exceeds 500 kB; it did not fail the build.

## Visual verification evidence

Fresh captures were made against the production route code at desktop and mobile widths and compared with the approved Chinese sources. The review set is stored outside the repository at:

`C:\Users\user\.codex\visualizations\2026\08\10\019fec31-4f56-72d3-8476-ba90669ad5d9\task3-review`

Reviewed captures include Home, Product, Approach, Company, GEO, and Diagnostic. Home and Diagnostic received additional true 390 px Chrome DevTools Protocol captures after a Windows headless `--window-size` minimum-window artifact was identified. CDP measurements confirmed `innerWidth`, document client width, and document scroll width were all 390 px, with no horizontal page overflow.

Visual review confirmed:

- Chinese Home uses the approved default-center crop and begins cinematic then dark anxiety selector;
- Product preserves the five-label preview before the six-node field;
- Approach preserves one example through the four states;
- Diagnostic stays near-viewport and does not expose a separate fact aside;
- form fields stack as three editorial rows and the submit control is transparent, square, and orange-edged;
- Company and GEO now continue through their required record/evidence/close sequences.

## Files changed

- `apps/www/src/components/experience/china/china-experience.test.tsx`
- `apps/www/src/components/experience/china/china-pages.tsx`
- `apps/www/src/components/experience/china/china-scenes.tsx`
- `apps/www/src/content/experience/china-copy.ts`
- `apps/www/src/styles/experience/site-06.css`
- `.superpowers/sdd/2026-08-27-yonaris-site-06-fidelity/task-3-report.md`

## Remaining risks

- The exhaustive cross-browser screenshot matrix and production-runtime smoke pass remain the responsibility of the later repository-wide fidelity/verification task; this task performed Chrome desktop and true 390 px mobile review.
- The production shell intentionally does not reproduce the prototype-only review banner. Header/footer details remain governed by the shared Site 06 production shell contract.
- The existing main-chunk-size warning remains; no new build failure or route-specific regression was observed.

No push or deployment was performed.
