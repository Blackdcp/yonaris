# Task 5 report — exhaustive Site 06 visual gate and whole-branch proof

Date: 27 August 2026

Worktree: `E:\Yonaris\.worktrees\site-production-06`

Branch: `codex/site-production-06`

Task start HEAD: `67eb82d8`

Initial Task 5 implementation commit: `c5a7223d193d6fe7deba67c659cf6a516a89c63c`

## Outcome

Task 5 adds a marketing-owned, production-rendered visual gate and closes the independent-review findings without changing `e2e/**`, package manifests, or the lockfile.

`apps/www/scripts/site-06-visual-matrix.mjs`:

- loads `@playwright/test`.chromium through `createRequire()` anchored to `e2e/package.json`;
- drives one serial production Chromium against explicit loopback only;
- captures the literal 28-route production matrix at 1440, 1280, 390, and 360;
- writes exactly 156 production artifacts: 112 first views, 24 full pages, and 20 reduced-motion spots;
- records route, locale, surface, viewport, composition, scene markers, and an explicit direct/derived prototype mapping for every artifact;
- requires every route-specific scene to be present, visible, and non-zero in production geometry;
- checks H1 bounds, retired generic-hero absence, overflow, photo crops, exact three-field forms without submission, route-specific endings, unique IDs, Agent noindex/four markers/inner directory, state changes, and reduced-motion cancellation;
- requires exactly one visible Human mode and locale control at all four widths, a controlled desktop header height, and non-overlapping brand/locale/menu geometry at 390 and 360;
- verifies the immutable external source SHA-256 before opening a read-only loopback reference server;
- captures 60 additional source artifacts for ten binding views (40 first views and 20 full pages), writes a 60-pair manifest/index, and renders same-width source-versus-production evidence.

The production count remains exactly 156. Reference and pair evidence is additional, ignored review material.

## Fidelity provenance

The immutable binding remains the external source:

`E:\Yonaris\.superpowers\brainstorm\1950-1787739192\content\site-system-multipage-agent-06.html`

Verified SHA-256: `e26b204b528481ddd3274d4a546f1a9acd02a0f7f5e94de80b1070a1d05b46da`.

The runner renders that exact external file and its adjacent assets. The repository copy under `docs/design/site-06-reference` is an audit-safe review derivative, not the binding. `source-manifest.json` records both SHA values and limits the derivative to non-structural safety wording and factual credit corrections. No unsafe original bytes were restored or copied into the repository.

The current repository derivative HTML SHA-256 is `2825795608f670b468a412b362c3640270418634fffe307c0fcc8d045be283c1`.

## Receiving-review TDD evidence

The follow-up began with focused RED evidence:

- Node runner tests: 7 passed / 4 failed because exact header, scene geometry, immutable-reference, and contact-contrast contracts did not exist;
- localized app tests: 51 passed / 5 failed because Resend processing, retention/deletion, Pavel Danilyuk credit, and the source manifest were absent;
- mobile header geometry: a real 360/390 failure showed locale and menu occupying the same box and overlapping by exactly `2376px²`.

GREEN repairs and mutation coverage:

1. Header visibility now uses equal selector specificity at base, 1050, and 720 breakpoints. Desktop exposes one mode and one locale without wrapping; mobile assigns brand, locale, and menu separate grid areas. The real production matrix enforces no pairwise overlap.
2. Scene assertions now fail for hidden, zero-size, or replaced route scenes. The focused browser mutation test proves all three failure modes turn RED.
3. The immutable-source SHA, ten direct reference views, 60-artifact reference plan, 60 same-width pairs, and explicit mapping for all 28 production routes are unit-bound.
4. English and Chinese privacy pages and canonical Agent facts now state that Resend is the email processor, the form is sent to Yonaris only to understand/respond to the request, retention is limited to a reasonably necessary period, and deletion is requested through the public contact route. No personal email appears in the public privacy copy.
5. The Pexels 8526452 credit is corrected to Pavel Danilyuk in English, Chinese, and the review derivative.
6. Contact-scene evidence text was repaired locally from the AA edge to 82% white and 0.75rem; the global palette was not lightened.

Final focused result: `node --test apps/www/scripts/site-06-visual-matrix.test.mjs` — 11/11 passed.

Final app result: `pnpm --filter @workspace/www exec vitest run` — 32 files, 212/212 passed.

## Governed photography

The business-walk reference and production JPEGs had APP1/APP13 metadata removed without re-encoding:

- original SHA-256: `48ab7f4a441249c76ebbd7a102f336fd267e295c4e35e06f24640afdbd2fa01f`;
- derivative SHA-256: `db995fb32f261fcecdd4d6b60688764bbbdc36ed440b2961fb068a840200e390`;
- dimensions: 1800 × 2696 before and after;
- compressed-scan SHA-256: `9be312203205f9ff5db7bc492b0e7c84c6ac52546dc6882f8abe2533eb5d2c15` before and after;
- no remaining APP/COM metadata;
- review and production copies are byte-identical, so decoded pixels are unchanged.

The earlier warm-office safety derivative remains 1800 × 1200 and byte-identical between review and production copies with SHA-256 `f2332ec8c09034426234a5a05f392b27d72a0ab1390e919623e80449509fc259`. Chromium q=.99 was the highest scanner-clean candidate; decoded comparison measured mean absolute channel error `0.2476605`, RMS `0.6412289`, and maximum channel delta `19`. The source, artifact, and image-root audits remain zero-finding.

## Visual evidence

Ignored capture root:

`.superpowers/sdd/2026-08-27-yonaris-site-06-fidelity/task-5-captures`

Fresh manifest counts:

- production `manifest.json`: 112 first-view + 24 full-page + 20 reduced-motion = 156;
- immutable-source `reference-manifest.json`: 40 first-view + 20 full-page = 60;
- `pair-manifest.json`: 60 same-width pairs;
- production routes: 28;
- widths: 1440, 1280, 390, 360;
- binding SHA in both reference and pair manifests: `e26b204b528481ddd3274d4a546f1a9acd02a0f7f5e94de80b1070a1d05b46da`.

Readable pair sheets regenerated after the final mobile fix:

- `reference-pairs/contact-first-1440.png`
- `reference-pairs/contact-first-view-1280.png`
- `reference-pairs/contact-first-390.png`
- `reference-pairs/contact-first-view-360.png`
- `reference-pairs/contact-full-page-1440.png`
- `reference-pairs/contact-full-page-390.png`

Each sheet contains ten labelled pairs and is 1440 × 4528, avoiding the unreadable scaling of the retained 1440 × 26428 aggregate sheet. All six were inspected with `view_image`; the 390 and 360 production Home captures were also inspected at original size. The final mobile header presents separate brand, locale, and menu targets, and no new Critical/Important composition drift was found.

Review by locale and surface:

- English Human: Home fixed claim, Product dossier/trace, Approach comparison, Company dual reading, GEO editorial, contact, and privacy remain distinct.
- Chinese Human: cinematic anxiety, six-position System field, Breakdown replay, Company dual reading, market editorial, contact, and privacy remain distinct; no generic closing stack was introduced.
- English and Chinese Agent: all directories keep first-view inner records, noindex, canonical, Markdown, JSON-LD, and llms markers.
- Reduced motion: all 20 production spots preserve content with no running photo, orbit, or state-entry animation.

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

Current contracts cover the intended behavior: localized machine labels, fixed Human/Agent Home reading, six-node System pointer/keyboard operation with mobile touch geometry/no overflow, reduced-motion cancellation on the real cinematic/orbit scenes, and arrow-free EN/ZH Home links with correct href, keyboard reachability, and visible focus.

## Final verification

- `node --test apps/www/scripts/site-06-visual-matrix.test.mjs` — 11/11 passed.
- `pnpm --filter @workspace/www exec vitest run` — 32 files, 212/212 passed.
- `pnpm --filter @workspace/www check-types` — passed.
- `pnpm exec tsc -p e2e/tsconfig.json --noEmit` — passed.
- production build with `VITE_SITE_URL=https://yonaris.com` and blank analytics — passed; only the existing >500 kB chunk advisory remained.
- fresh visual matrix — 156/156 production, 60/60 immutable-source reference, and 60/60 pairs passed.
- `pnpm audit:public-output` — `[]`.
- `node scripts/public-output-audit.mjs --phase artifact --root apps/www/.output/public` — `[]`.
- `node scripts/public-output-audit.mjs --phase image-root --root apps/www/public/brand/site-06` — `[]`.
- `pnpm test:public-output-policy` — 36/36 passed.
- `pnpm verify:public-output-release` — passed.
- `pnpm --filter @workspace/www audit:site-manifest` — all route patterns classified.
- `pnpm --filter @workspace/www audit:legacy-marketing` — no retired consumers.
- deployment/Caddy helper tests — 22/22 passed.
- Caddy policy Vitest — 5/5 passed.
- local image `yonaris-www:task5-followup` built successfully.
- raw production and direct-image smoke — 49 routes, 13 redirects, 51 same-origin assets, and 904 Accept/trailing-slash cases passed.
- `node apps/www/scripts/smoke-marketing-caddy.mjs yonaris-www:task5-followup` — passed.
- retired upstream/open-distribution wording search across production public/implementation paths — no hit.
- Resources and other retired surfaces — 404 contract passed in raw production, direct-image, and pinned Caddy smoke.
- read-only e2e — 27 passed / exactly 14 approved stale / no additional failure.
- `git diff --check` — run immediately before commit.

## Remaining risks

- Fourteen read-only e2e assertions remain intentionally stale; changing production to satisfy them would reintroduce rejected localization, layout, selector, or glyph behavior.
- The external binding path is machine-specific by design. The runner fails closed on its SHA; a new machine must provision that reviewed source at the recorded path before regenerating reference evidence.
- The selected warm-office derivative is larger than its source, but it is not referenced by a current route and does not increase current route payloads.
- The production bundle continues to emit the pre-existing >500 kB advisory.
- No push or deployment was performed.
