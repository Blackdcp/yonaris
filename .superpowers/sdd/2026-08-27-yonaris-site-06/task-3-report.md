# Task 3 Report: Chinese Site 06 local narrative and interactions

## Status

Implemented and verified the seven canonical Chinese Human routes on the shared Site 06 foundation.

Implementation commit: `d616fd9d` (`rebuild the Chinese marketing experience`)

## RED evidence

Command:

```text
pnpm --filter @workspace/www exec vitest run src/components/experience/china/china-experience.test.tsx
```

Observed before production changes:

```text
Test Files  1 failed (1)
Tests       7 failed (7)
```

The failures were the intended missing behavior: the previous home did not use the approved anxiety-led H1, the product did not expose the six-node system, the approach lacked the four-state replay contract, the site retained origin/destination market framing, legacy navigation and `zero-one` generation markers, and rendered numbered rails and decorative arrow glyphs.

The first post-implementation run left one test failing because the rejection expression also matched the truthful phrase `不保证排名`. The assertion was narrowed to reject positive guarantee language while preserving required limitations.

## GREEN evidence

Focused integration command:

```text
pnpm --filter @workspace/www exec vitest run src/components/experience/china/china-experience.test.tsx src/components/experience/site-generation.test.tsx src/styles.test.ts
```

Result:

```text
Test Files  3 passed (3)
Tests       21 passed (21)
```

Fresh full verification before commit:

```text
pnpm --filter @workspace/www test
pnpm --filter @workspace/www check-types
pnpm exec biome check apps/www/src/content/experience/china-copy.ts apps/www/src/content/experience/copy-contract.test.ts apps/www/src/components/experience/china/china-pages.tsx apps/www/src/components/experience/china/china-scenes.tsx apps/www/src/components/experience/china/china-shell.tsx apps/www/src/components/experience/china/china-experience.test.tsx apps/www/src/components/experience/site-generation.test.tsx apps/www/src/styles.test.ts
git diff --check
pnpm --filter @workspace/www build
```

Results:

- Full suite: 29 test files passed, 149 tests passed.
- TypeScript: `tsc --noEmit` passed.
- Targeted Biome: 8 files checked with no findings.
- Diff check: passed; only Git line-ending notices were emitted.
- Production build: passed for client, SSR, and Nitro node-server output.

## Files changed

- `apps/www/src/content/experience/china-copy.ts`
  - Replaced the prior role-adjacent and origin/destination content model with anxiety, system-node, breakdown replay, dual-reading, cross-market condition, contact, and privacy copy.
- `apps/www/src/components/experience/china/china-pages.tsx`
  - Rebuilt all seven Chinese routes using the Site 06 composition, approved photos, canonical navigation targets, shared form, and independently written Chinese narrative.
- `apps/www/src/components/experience/china/china-scenes.tsx`
  - Replaced the retired scenes with the five-state anxiety selector, six-node relationship map, four-state breakdown replay, shared Human/Agent readings, and market-condition record.
- `apps/www/src/components/experience/china/china-shell.tsx`
  - Reduced the wrapper to `Site06Shell locale="zh"` compatibility.
- `apps/www/src/components/experience/china/china-experience.test.tsx`
  - Added rendered behavior assertions for narrative, tab semantics, routes, form fields, and rejected grammar.
- `apps/www/src/content/experience/copy-contract.test.ts`
  - Migrated only the stale Chinese assertions to the approved Site 06 content contract; English assertions were unchanged.
- `apps/www/src/components/experience/site-generation.test.tsx`
  - Migrated the Chinese generation expectation from `zero-one` scenes to the shared `site-06` contract without weakening English checks.
- `apps/www/src/styles/experience/site-06.css`
  - Added the minimum shared styling needed for the anxiety selector and system relationship map, including mobile form-link targets.
- `apps/www/src/styles.test.ts`
  - Replaced retired China stylesheet checks with Site 06 integration and interaction styling checks; English and Agent assertions remain.
- `apps/www/src/styles/experience/china.css`
  - Deleted after every Chinese consumer moved to Site 06.

## Self-review

- Confirmed `CHINA_PAGES` preserves all seven `HumanPageKey` entries and canonical paths.
- Confirmed the primary Chinese navigation is exactly 为什么现在、系统怎么运转、看一次拆解、预约沟通.
- Confirmed every rendered route has one H1, a visible Human/Agent switch, locale switch, and Yonaris wordmark through `Site06Shell`.
- Confirmed anxiety, system, replay, and reading interactions use roving tab semantics with one active tab and keyboard-compatible relationships.
- Confirmed the home starts with business anxiety and contains no title-based audience segmentation.
- Confirmed the system explains the decision or budget consequence of a disconnected node without claiming real-time automation.
- Confirmed the replay is explicitly illustrative and records 已变化、未变化、无法归因 without claiming improvement.
- Confirmed cross-market content changes market conditions rather than defining customers by where they come from or go to.
- Confirmed the Chinese lead form has exactly 姓名、电话、公司 plus the hidden abuse field.
- Confirmed no rendered Chinese page contains decorative arrow glyphs, numbered rails, invented customer outcomes, or the retired origin/destination story.
- Confirmed the orbit motif is limited to the Chinese system and dual fact reading.
- The production build touched `apps/www/src/routeTree.gen.ts` metadata even though no route changed. Its working-tree blob matched `HEAD` (`8749a6b6…`), the index was refreshed without staging a content change, and the task worktree was confirmed clean.
- A separate reviewer agent was not used because the task brief explicitly prohibited subagents; review was performed directly against the binding design specification and rendered-contract tests.

## Concerns

- The production build emits the repository's general Vite warning that one client chunk exceeds 500 kB after minification. The build succeeds, and this task does not add a new dependency or a separate Chinese visual bundle.
- No browser screenshot pass was part of the Task 3 command contract. Responsive and reduced-motion behavior remains owned by the already-approved shared Site 06 CSS and its tests.
