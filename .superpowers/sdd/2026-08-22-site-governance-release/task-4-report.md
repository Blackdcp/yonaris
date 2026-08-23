# G4 Human Redirects and Governed Public 404 Report

Date: 2026-08-23
Worktree: `E:\\Yonaris\\.worktrees\\homepage-product-stage`
Exact base: `4e76ee5646eb3c5ce03b460ea23f6115e70e6cc2`
Implementation commit: this atomic G4 commit; SHA is reported after creation
Push/deploy: not performed

## Delivered scope

- Replaced exactly ten obsolete human page bodies with manifest-backed server `GET` handlers: `/platform`, `/features`, `/zh/platform`, `/methodology`, `/zh/methodology`, `/results`, `/zh/results`, `/vision`, `/pricing`, and `/off-site-aeo`.
- Each alias fails closed when its `SITE_REDIRECTS` rule is absent and delegates to the reviewed `permanentRedirectResponse` helper. No alias module retains a component, head metadata, JSON-LD, or duplicate destination constant.
- Preserved the exact bodyless `308` contract, relative `Location`, raw ordered/repeated/empty/percent-encoded query string, and canonical destination reachability. Redirect sources remain outside the sitemap and do not negotiate Markdown.
- Verified the three existing Agent aliases without modifying their reviewed handlers or the shared redirect helper.
- Replaced the old generic NotFound surface with a locale-aware `SiteShell` composition. Missing `/zh/...` paths use Chinese shell/copy/links; all other absent paths use English.
- Preserved a real HTTP `404`, exactly one header/footer/main/H1, exact `noindex,follow`, and no canonical or `og:url`. The root head required no change because the focused browser contract proved React/TanStack correctly resolves the not-found metadata.
- Exposed only Home, Product, Approach, Research, Diagnostic, and Resources from the 404 body, preserving locale for Chinese core routes while Resources uses its single English canonical.
- Added a square editorial ruled composition using only Yonaris VI tokens, with no cards, gradients, glows, background images, or ambient motion. Every body link meets the 44px target and Signal/Ink keyboard-focus contract.
- Added bilingual seven-width Axe, overflow, reduced-motion, target, focus, HTTP/head, sitemap, redirect, and deterministic visual acceptance coverage.

## RED to GREEN evidence

The focused redirect helper characterization passed immediately (`3/3`), proving the G1 helper already preserved repeated, empty, and percent-encoded query values and remained bodyless. It was therefore not modified.

The first correctly filtered browser run produced the intended behavior RED: `5 failed / 1 passed`. All ten human aliases still rendered legacy pages or otherwise failed the exact `308` contract; the old EN/ZH NotFound surface lacked the approved H1, link set, 44px targets, and Signal focus. The existing Agent alias verification was the sole pass, so those handlers remained untouched.

After implementation, the same nonvisual routing suite passed `6/6`, and the four focused native visual captures passed `4/4`. The complete G4 matrix proves:

- all ten human and three Agent aliases return bodyless `308` responses with lossless query strings;
- canonical destinations are live and aliases are absent from the sitemap;
- EN and ZH absent paths remain real `404` responses with exact head and shell ownership;
- both locales pass Axe A/AA, no-overflow, 44px, and reduced-motion checks at `1440`, `1280`, `1024`, `768`, `390`, `320`, and `280` CSS px;
- both Home escapes expose the composited Signal/Ink keyboard focus treatment.

Fresh final gates:

- Focused redirect helper: `3/3` passed.
- Focused routing/404 browser contract: `6/6` passed.
- Focused routing/404 visual contract: `4/4` passed.
- Full WWW unit suite: `30 files / 228 tests` passed.
- Full public browser suite: `186/186` passed at six workers.
- Full visual browser suite: `118/118` passed at one worker.
- WWW TypeScript check: passed.
- E2E TypeScript check: passed.
- Site manifest audit: passed.
- Production WWW build: passed.
- Authored-file Biome check: `14 files` passed.
- Changeset status against `origin/main`: passed; the existing full-site changeset remains reserved for the final release-review task.
- `git diff --check`: passed apart from Git's expected Windows line-ending notices.

Two initial full-public runs at the default ten workers each ended at `185/186` or `184/186` because different existing tests exhausted a 30-second budget under local Vite concurrency; one run also logged a simultaneous socket hang-up. The exact failed cases passed `2/2` immediately in a single-worker reproduction, and none involved G4 routes. The unchanged complete 186-test matrix then passed at six workers in 1.8 minutes. No product behavior, test threshold, or suite configuration was changed to hide the load artifact.

## Visual review

The required EN desktop (`1440`), mobile (`390`), and micro (`280`) artifacts plus the ZH mobile locale smoke were opened at native size and inspected individually. The desktop view holds the large editorial statement against a compact escape action and a ruled current-map register. The two mobile widths preserve hierarchy, readable line breaks, square geometry, and full-width primary escape without overflow. Chinese copy retains the same information hierarchy and a stable three-line title.

Persisted visual evidence directory:

`E:\\Yonaris\\.worktrees\\homepage-product-stage\\e2e\\test-results-www\\visual-qa`

Files:

1. `not-on-the-current-map--en--desktop--governed-404--237182f17072.png`
2. `not-on-the-current-map--en--mobile--governed-404--b4ab9e6dbfd1.png`
3. `not-on-the-current-map--en--micro--governed-404--f0ec582a1331.png`
4. `zh-not-on-the-current-map--zh--mobile--governed-404--f9a872fd0b4b.png`

## Review status

Independent final review returned PASS with `0 Critical / 0 Important (P0/P1/P2)`. The reviewer independently reran the complete G4 Playwright file (`10/10`), WWW unit suite (`30 files / 228 tests`), both typechecks, manifest audit, authored Biome, production build, and diff check, and opened all four G4 images. No review-driven code change was required.
