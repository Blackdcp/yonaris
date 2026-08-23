# Site Governance and Release SDD Ledger

## Authoritative baseline

- Worktree: `E:\\Yonaris\\.worktrees\\homepage-product-stage`
- Branch: `codex/homepage-product-stage`
- Governance G2 exact base: `c517489a7707e612410f0edf77d7dbe1c69b3b28`
- Working tree was clean before G2 began.

## G1 — Canonical machine facts and supporting destinations

**Status:** Complete and independently reviewed.

The original ignored G1 report/preflight artifacts were not persisted into this visible SDD directory. Per the root-agent ruling, the authoritative evidence is the exact commit range `683a934..c517489`, the final implementer report, and a fresh G2 supporting-pages regression.

- Commits: `683a934`, `ab48137`, follow-up `c517489`
- Reported verification: supporting `11/11`; full unit `27 files / 214`; full public `152/152`; full visual `75/75`; WWW/E2E typecheck; site-manifest audit; authored Biome `11`; production build; diff check.
- Visual evidence: Resources and Open Source at `1440`, `390`, and `280` CSS px inspected.
- Review: one Important finding (Open Source 2×2 source-card grid), corrected in `c517489` to a single editorial ledger. Fresh supporting `11/11` and all three Open Source images re-inspected. Final review: `0 Critical / 0 Important / 0 Minor`.

## G2 — Publication and Utility shell migration

**Status:** Complete and independently reviewed.

Commits:

- `09b0f4b` — `feat(www): govern publication and utility surfaces`
- `e93c4d1` — `fix(www): fail closed on malformed status evidence`
- `937ec7b` — `fix(www): validate canonical status records`

Initial independent review: `0 Critical / 2 Important / 1 Minor`. Both Important findings and the Minor documentation mismatch were corrected under RED→GREEN in non-amended follow-up `e93c4d1`: malformed Status records now fail closed, and all Docs content buttons expose a 44px minimum target.

The first narrow re-review reported `0 Critical / 1 Important / 0 Minor`: the Status guard still accepted normalized impossible calendar dates and non-integer/unsafe producer measurements. A second isolated RED matrix now covers canonical ISO round trips plus fractional, negative, and unsafe mutations across all six numeric producer fields. The guard requires the producer's exact `Date#toISOString()` form and nonnegative safe integers. Second non-amended follow-up `937ec7b` was committed and independently re-reviewed.

Final narrow review of `e93c4d1..937ec7b`: `0 Critical / 0 Important / 0 Minor`; Ready for G3: **YES**. A fresh 20-record mutation probe discarded every impossible/noncanonical/fractional/negative/unsafe record and retained exact producer records as both objects and JSON strings.

The earlier G2 preflight artifact was not persisted. The root-agent message delivered on 2026-08-23 is the binding preflight final. Its scope and rulings are captured in `task-2-brief.md`.

### Execution checklist

- [x] Verify clean exact base and linked worktree isolation.
- [x] Read approved full-site spec and governance plan.
- [x] Read the binding G2 preflight and replacement G1 evidence.
- [x] Inspect all in-scope shells, layouts, routes, loaders, SEO, status/OG, brand assets, icon generator, manifests, styles, and existing QA.
- [x] Write focused shell/content/SEO/asset/status tests and observe expected RED.
- [x] Write site-governance browser/visual coverage and observe expected RED.
- [x] Implement Publication/Utility migration without touching G3 legacy families.
- [x] Run focused GREEN verification.
- [x] Inspect representative visual artifacts at `1440`, `390`, and `280` CSS px.
- [x] Run full G2 and G1 regression gates.
- [x] Request independent review; fix all Critical/Important findings through follow-up commits.

## G3 — Legacy AI/AEO/AI Visibility governance

**Status:** Complete, fully verified, independently reviewed, and recorded in the atomic G3 task commit.

Exact base: `937ec7b4f4dc5bb5ca8794cc8403e29c53f6c258`.

Exactly 15 legacy templates now use governed Publication/Legacy Archive shells while preserving their source data, loaders, valid bodies, filtering, static route priority, and invalid-slug 404 behavior. Every route has a concrete canonical, exact `noindex,follow`, sitemap exclusion, crawlable robots behavior, visible provenance/current-scope boundaries, and no route-owned rich JSON-LD. The misattributed Elmo listing/helper surface was removed without changing the root Yonaris identity.

The AI Visibility archive uses one shared shell/context and locally frames deep-scroll comparison/FAQ content as recorded upstream material. All directory, table, filter, current-scope, focus, motion, and `280–1440` accessibility/overflow contracts are covered by the new legacy governance browser suite. The complete loader-derived feature-by-supplier matrix, single/pair/multi pricing/domain/source facts, category heading order, and distinct navigation landmarks are preserved. The nondeterministic remote supplier screenshot surface was removed while retaining a visible recorded-source link. Directory filters remain natively disabled through SSR and the first client render, then become enabled only after hydration attaches their handlers.

Initial independent review: `0 Critical / 2 Important / 2 Minor`. Every finding was covered by a failing regression before its fix. A subsequent re-review found one Important single-comparison pricing omission; priced and free-tier regressions now preserve those archived facts. The final full-public run then exposed a pre-hydration filter race; the SSR-disabled/post-hydration-enabled contract and production guard close it deterministically. Both narrow follow-up reviews returned `0 Critical / 0 Important / 0 Minor`.

Final gates: expanded focused legacy `16/16`; full unit `30 files / 227`; full public `180/180` at four workers; full visual `114/114` at one worker; WWW/E2E types; manifest; production build; authored Biome `30`; changeset status against `origin/main`; diff check. All 18 required G3 images plus six supplemental priced/free-tier single-comparison images were inspected individually.

### Execution checklist

- [x] Verify clean exact base and linked worktree isolation.
- [x] Read the approved full-site spec, governance plan, G2 report, ledger, and binding G3 preflight.
- [x] Audit the complete 15-template route/data/loader/SEO/layout surface.
- [x] Write focused content/SEO/route/layout/accessibility/visual contracts and observe expected RED.
- [x] Migrate AI Search/AEO to reviewed Publication governance.
- [x] Migrate all AI Visibility templates to one Legacy Archive governance system.
- [x] Preserve dynamic/static route behavior and source data while removing route rich schema and Elmo identity helpers.
- [x] Inspect all 18 required visual artifacts at `1440`, `390`, and `280` CSS px.
- [x] Run focused, full unit/type/build/manifest/public/visual/Biome/diff gates.
- [x] Complete independent final review and record the disposition.
- [x] Create the exact-file atomic G3 commit without push/deploy or G4 redirects.

## G4 — Human redirects and governed public 404

**Status:** Complete, fully verified, independently reviewed, and ready for the atomic G4 commit.

Exact base: `4e76ee5646eb3c5ce03b460ea23f6115e70e6cc2`.

The approved design is already complete, so the brainstorming approval gate is satisfied by the explicit G4 implementation dispatch. This is bounded execution of Governance plan Task 3 under the later binding preflight.

Exactly ten human aliases now use manifest-backed, bodyless server `GET` `308` responses with relative locations and lossless query preservation; the three existing Agent aliases and shared helper remained verify-only. The governed NotFound surface uses the locale-aware SiteShell, a real `404`, exact `noindex,follow`, no canonical or `og:url`, six approved destinations, and a square VI editorial ruled composition across the full bilingual seven-width accessibility matrix.

Focused RED was `5 failed / 1 passed`: all missing human redirect and NotFound behaviors failed while the reviewed Agent redirects passed. Focused GREEN is helper `3/3`, routing/nonvisual `6/6`, and G4 visuals `4/4`. Final gates are WWW unit `30 files / 228`, full public `186/186` at six workers, full visual `118/118` at one worker, both typechecks, manifest, production build, authored Biome, changeset status, and diff check. Four native G4 captures were inspected individually.

Independent final review reran the complete G4 file (`10/10`), unit/types/manifest/Biome/build/diff, and opened every G4 image. Result: `0 Critical / 0 Important`; PASS. No review-driven code change was required.

### Preflight consistency and interface scan

| Producer / consumer | Shared file or interface | Finding / ruling |
| --- | --- | --- |
| G1 Agent redirects / G4 human redirects | `permanentRedirectResponse`, `getRedirect`, three Agent alias handlers | Older plan asks G4 to create/replace these, but the base already contains correct bodyless query-preserving handlers. **Ruling:** verify only; change only under a failing regression. Replacing them without evidence risks breaking reviewed Agent behavior. |
| G4 aliases / G5 legacy-consumer audit | ten legacy human route modules and manifest redirect allowlist | Compatible: G4 removes legacy bodies and leaves only manifest-backed server handlers; G5 can then treat the exact redirect allowlist as intentional. |
| G4 redirects / G6 release smoke | `SITE_REDIRECTS`, HTTP response contract | Compatible: G4 owns runtime 308 behavior; G6 consumes the same manifest and must not hand-copy mappings. |
| G4 404 / root document SEO | root default `og:url`, route-specific heads, router not-found status | Potential collision: a root fallback can leak `og:url` into 404 while indexed routes provide their own head. **Ruling:** write the HTTP/head RED first and make only the smallest proven root-head change. A wrong change could affect metadata on routes without their own head. |
| G4 404 / shared shell | `SiteShell` owns the sole `<main>`, header, and footer | Compatible: `NotFound` must render sections directly inside `SiteShell`, not nest another main or legacy Navbar/Footer. |
| G4 visual QA / existing G2-G3 suites | `styles.css`, Playwright output root | Compatible: add one focused VI stylesheet and routing suite; keep analytics isolated and visual output under the existing ignored root. |

### Execution checklist

- [x] Verify exact clean base and linked-worktree isolation.
- [x] Read AGENTS, approved spec/plan, ledger, G3 report, and binding G4 preflight.
- [x] Read mandatory Superpowers workflow, TDD, testing, review, and verification instructions.
- [x] Dispatch the fresh implementer with the binding brief and exact report path.
- [x] Observe focused unit/browser RED for all aliases and governed 404.
- [x] Implement minimal redirect and 404 GREEN without changing verify-only Agent behavior.
- [x] Capture and inspect required 404 visual evidence.
- [x] Run full unit/public/visual/type/manifest/build/Biome/diff gates.
- [x] Complete independent review and fix every Critical/Important finding.
- [x] Commit the exact G4 scope without push/deploy.

## G5 — Split marketing foundation cleanup

**Status:** Complete, fully verified, independently reviewed, and ready for the atomic G5 commit.

Exact base: `d67b00f23fca8c1a8adf03f435da27d452e84377`.

A repository-aware scanner now enumerates cached and untracked `apps/www/src` files through the exact NUL-delimited Git contract, audits only existing production TypeScript, and emits stable normalized path/line diagnostics for retired definitions, imports, identifiers, helpers, types, module names, and page keys. Its seven fixture cases cover untracked files, multiple violations, deterministic ordering, slash normalization, exact redirect exemptions, generated/test exclusions, retired definitions, and cached deletions.

The final scanner recorded `117` violations against the exact deletion-before base. They proved the approved cleanup boundary: 21 retired production modules, the colocated obsolete marketing-content test, and three dead FAQ collections. The live post-cleanup audit is GREEN. `faqs.ts` now retains only `FaqItem` and `DIRECTORY_FAQS`; only zero-consumer signal selectors and their keyframe were removed from `site-core.css`.

Post-G4 proof overruled the stale instruction to remove `.marketing-display`: the governed 404 consumes it, a focused stylesheet assertion failed without it, and restoring the exact selector returned the suite GREEN. The retained selector preserves the protected G4 surface and the zero-visual-delta contract. No snapshot was updated.

Final gates: scanner fixture `7/7`; WWW unit `29 files / 219`; public Playwright `186/186` at four workers; unchanged visual Playwright `118/118` at one worker; WWW/E2E typechecks; manifest; production build; authored Biome; diff check; zero legacy grep. Independent review's sole Important finding—the missing FAQ/localized-path identifier guard—was closed through a focused RED/GREEN fixture and exact-base RED regeneration. Final narrow re-review returned PASS with no remaining P0/P1/P2.

### Execution checklist

- [x] Verify exact clean base and linked-worktree isolation.
- [x] Read AGENTS, approved spec/plan, ledger, G4 report, and binding G5 preflight.
- [x] Implement scanner fixtures first and observe the absent-scanner RED.
- [x] Capture the complete repository RED before deleting any proven legacy source.
- [x] Delete only audit-proven retired files and reduce FAQ/CSS surfaces without visual change.
- [x] Run live scanner GREEN plus full unit/type/build/manifest/public/visual/Biome/diff/zero-grep gates.
- [x] Complete independent review and close every Critical/Important finding through RED/GREEN.
- [x] Commit the exact G5 scope without amend, push, deploy, or G6 work.

## G6 — Marketing release governance

**Status:** Code-complete, minimally release-verified, and Critical-only independently reviewed; no production action was performed.

Exact base: `f6134b19fe1f69e47c4603212d55c496215f97c3`.

The production Caddy policy is now an exact method-aware allowlist with five reviewed proxy branches, a terminal 404, thirteen query-preserving redirects, and a Cloudflare-bound diagnostic identity path proven against pinned Caddy `2.6.2` on `linux/amd64`. The byte-identical v2 predecessor is preserved at its reviewed SHA-256.

Marketing deploys now share one side-effect-free secret preflight, persist a mode-700 hash-bound rollback bundle, bind the complete Caddyfile, recover explicit Caddy-75 and marker-pending states, and update the immutable release marker last. The installer accepts only reviewed predecessor states, stages and rehashes the exact restore bytes, validates before replacement, and fails closed on unconfirmed recovery. The workflow pins every action/image, builds once, smokes the exact image directly and through Caddy, preflights before source mutation, verifies the exact release SHA, and closes on apex, Portal, Status, and Changelog health.

Final release-MVP gates: deploy fixture GREEN; installer `33/33`; workflow `4/4`; Caddy/helper Node `21/21`; WWW unit `30 files / 224`; WWW typecheck; manifest; production build; fresh direct image smoke `60 routes / 13 redirects / 91 assets`; fresh pinned-Caddy integration smoke; no residual owned Docker resources. Independent Critical-only review returned PASS with no remaining Critical finding.

Strict production Origin-CA verification in the host installer and the exhaustive durable-metadata failure-injection matrix are explicitly deferred follow-ups under the approved release-MVP timebox. Production remains externally blocked until the three exact Resend variables are configured and `--verify-only` succeeds.

### Execution checklist

- [x] Preserve and verify the reviewed v2 Caddy predecessor byte-for-byte.
- [x] Implement exact route/method, proxy, diagnostic identity, redirect, and terminal-404 policy.
- [x] Prove the policy through direct-image and digest-pinned Caddy runtime smoke.
- [x] Implement side-effect-free preflight plus transactional deploy, recovery, and post-success rollback.
- [x] Implement reviewed-state Caddy install/restore with complete-file hash binding.
- [x] Pin and order the build/test/push/preflight/deploy/post-deploy workflow.
- [x] Run the approved release-MVP gates and complete Critical-only review.
- [x] Commit locally without push, deployment, production reload, DNS mutation, or real lead delivery.
