# Task 5 report — exhaustive Site 06 visual gate and whole-branch proof

Date: 27 August 2026

Worktree: `E:\Yonaris\.worktrees\site-production-06`

Branch: `codex/site-production-06`

Task start HEAD: `6baabe64`

## Outcome

Task 5 adds a marketing-owned production visual-matrix runner and closes the remaining whole-branch fidelity defects without changing `e2e/**`, package manifests, or the lockfile.

`apps/www/scripts/site-06-visual-matrix.mjs`:

- loads `@playwright/test`.chromium through `createRequire()` anchored to `e2e/package.json`;
- drives one serial production Chromium against loopback only;
- captures the literal 28-route matrix at 1440, 1280, 390, and 360;
- writes exactly 156 artifacts: 112 first views, 24 full pages, and 20 reduced-motion spots;
- records route, locale, surface, viewport, composition, and scene markers in `manifest.json`;
- asserts route-specific composition/scene identity, H1 bounds, no retired generic hero, no overflow, mobile mode/locale access, photo crops, form shape/no submission, route endings, unique IDs, Agent noindex/four markers/inner directory, pointer and keyboard state changes, and reduced-motion cancellation;
- writes a grouped, fully loadable review index.

Focused runner tests are in `apps/www/scripts/site-06-visual-matrix.test.mjs` and pass 7/7.

## TDD evidence

The runner began RED with a missing module. Subsequent focused RED/GREEN cycles covered:

1. serialized URL handling instead of passing a URL object to Playwright;
2. binding the crop probe to the production CinematicField image;
3. literal scene-object selectors for recomposed interactions;
4. a grouped, non-lazy, locally loadable contact index;
5. the exact 28-route / 156-artifact capture plan;
6. loopback-only argument parsing and e2e-anchored Chromium resolution;
7. no-visual-drift compatibility hooks for the new Product trace, Comparison, dual-reading, System, and Replay roots;
8. English dual-reading accessible aliases while retaining approved visible copy;
9. Home fixed Human/Agent claim interaction coverage.

The final runner test result is 7 tests passed.

### Production drift repaired

- Added semantic compatibility hooks that preserve the recomposed DOM and visuals while keeping keyboard/geometry contracts observable: `.site-06-inspector`, `.site-06-review`, `.site-06-reading`, and `data-system-map`.
- Scoped legacy CSS away from recomposed roots so those hooks do not reapply retired layouts.
- Corrected Human-page AA contrast locally instead of globally washing out the palette. Representative post-fix ratios are: Home record label 7.41; Product kicker 7.19; Approach label/details 6.28; Company prompt 6.28; Chinese System status 6.28; Chinese Replay kicker 6.53, inactive tab 6.99, and paper kicker 6.03.
- Preserved the approved Home fixed Human/Agent claim reader, Chinese six-position System orbit, CinematicField image, and arrow-free 404 instead of satisfying incompatible old selectors.

### Public-output safety cleanup

The first source audit reported three opaque findings: one in the tracked prototype and one in each byte-identical warm-office JPEG. No policy, inventory, or exception was weakened.

- The prototype footer received one neutral, non-structural sentence correction. The reviewed binding HTML SHA-256 is now `A0B95BF8100874A3D33DFF8406259073A3CD9819CB3AA7A2B58326A82F481A2B` and the reference README records the safety-cleaned snapshot.
- A metadata-only JPEG strip proved the opaque image match lived in the entropy stream: the finding offset moved by exactly the 130 removed APP1 bytes and remained present.
- Chromium canvas generated quality candidates at 1.0, .995, .99, .985, .98, .97, and .95. Quality 1.0/.995 exceeded the scanner normalization limit; .99/.985 were the highest audit-clean output and were byte-identical. Quality .97 independently reproduced the opaque finding, so it was rejected.
- The selected q=.99 asset is 1800 × 1200, has no APP/COM metadata, and both reference/marketing copies have SHA-256 `F2332EC8C09034426234A5A05F392B27D72A0AB1390E919623E80449509FC259`.
- Decoded comparison against the original measured mean absolute channel error 0.2476605, RMS error 0.6412289, and maximum channel delta 19. The side-by-side visual review found no perceptible difference.
- A foundation RED/GREEN contract binds the new HTML SHA, image SHA, dimensions, metadata-free container, scan SHA, and byte-identical copies.

## Visual evidence

Ignored capture root:

`.superpowers/sdd/2026-08-27-yonaris-site-06-fidelity/task-5-captures`

Final counts from both filesystem and manifest:

- first-view: 112;
- full-page: 24;
- reduced-motion: 20;
- total PNG files: 156;
- total manifest artifacts: 156;
- routes: 28;
- viewports: 1440, 1280, 390, 360.

Fresh review sheets:

- `.superpowers/sdd/2026-08-27-yonaris-site-06-fidelity/task-5-review/contact-first-view.png`
- `.superpowers/sdd/2026-08-27-yonaris-site-06-fidelity/task-5-review/contact-full-page.png`
- `.superpowers/sdd/2026-08-27-yonaris-site-06-fidelity/task-5-review/contact-reduced-motion.png`
- `.superpowers/sdd/2026-08-27-yonaris-site-06-fidelity/task-5-review/warm-office-original-vs-q099.png`

All four were inspected with `view_image` after the final production build and final 156 capture run.

### Review by locale and surface

- English Human: Home fixed claim, Product dossier/trace, Approach comparison, Company dual reading, editorial GEO, contact, and privacy remain distinct; local contrast repairs did not change composition or wrapping.
- Chinese Human: cinematic anxiety, six-position System field, Breakdown replay, Company dual reading, market editorial, contact, and privacy remain distinct at desktop and true 390/360; no extra generic closing stack was found.
- English Agent: all seven fact directories retain first-view inner records, noindex, canonical, Markdown, JSON-LD, and llms markers.
- Chinese Agent: all seven localized fact directories retain the same machine contracts without English leakage.
- Reduced motion: all 20 spots preserve content and show no running photo, orbit, or state-entry animation.

## Existing read-only e2e

Exact command:

`pnpm --filter e2e exec playwright test --config playwright.www.config.ts www-tests/dual-region-release.spec.ts www-tests/content-negotiation.spec.ts www-tests/site-routing.spec.ts --workers=1`

Result: 41 tests completed, 27 passed, and exactly 14 approved stale assertions failed. There was no fifteenth failure:

- seven Chinese Markdown cases require the English `Language:` label;
- one Agent/llms index case requires the former Human-canonical label;
- one Home interaction requires the rejected three-record Category/Purpose/Scope reader;
- one Chinese System geometry assertion requires a rejected two-row desktop grid;
- one reduced-motion assertion requires the retired `.site-06-hero__media img` selector;
- three governed-404 assertions require the explicitly rejected arrow suffix.

Replacement contracts are covered by localized app tests, the visual matrix, and a focused current 404 proof. The arrow-free English and Chinese Home links are visible, use `/` and `/zh`, accept focus, expose a 2px solid outline, and render the orange 5px focus perimeter.

## Final verification

- `node --test apps/www/scripts/site-06-visual-matrix.test.mjs` — 7/7 passed.
- `pnpm --filter @workspace/www exec vitest run` — 32 files, 210 tests passed.
- `pnpm --filter @workspace/www check-types` — passed.
- `pnpm exec tsc -p e2e/tsconfig.json --noEmit` — passed.
- production build with `VITE_SITE_URL=https://yonaris.com` and blank analytics — passed; only the existing >500 kB chunk advisory remained.
- final `site-06-visual-matrix.mjs` run — 156/156 passed.
- focused four-width Human axe run — passed with no violations.
- `pnpm audit:public-output` — `[]`.
- artifact audit of `apps/www/.output/public` — `[]`.
- image-root audit of `apps/www/public/brand/site-06` — `[]`.
- `pnpm test:public-output-policy` — 36/36 passed.
- `pnpm verify:public-output-release` — passed.
- `pnpm --filter @workspace/www audit:site-manifest` — all route patterns classified.
- `pnpm --filter @workspace/www audit:legacy-marketing` — no retired consumers.
- deployment/Caddy helper tests — 22/22 passed.
- Caddy policy Vitest — 5/5 passed.
- immutable local image `yonaris-www:task5-6baabe64` built successfully after one transient registry-reset retry.
- direct image smoke — 49 routes, 13 redirects, 51 same-origin assets passed; 904 Accept/trailing-slash cases checked.
- `node apps/www/scripts/smoke-marketing-caddy.mjs yonaris-www:task5-6baabe64` — passed.
- retired/open-distribution wording scan of public and implementation files — no marketing-content hit; technical Caddy/Plausible upstream variables and prohibition tests only.
- Resources/retired surfaces — 404 contract passed in raw production and pinned Caddy smoke.
- `git diff --check` — passed.

## Remaining risks

- Fourteen read-only e2e assertions remain intentionally stale and are documented above; changing production to satisfy them would reintroduce rejected localization, layout, selector, or glyph behavior.
- The selected warm-office asset is larger than its source (626,760 bytes versus 292,942 bytes). It is retained as a governed public brand asset but is not referenced by a current route, so it does not increase current route payloads.
- The production bundle continues to emit the pre-existing >500 kB advisory.
- No push or deployment was performed in Task 5.
