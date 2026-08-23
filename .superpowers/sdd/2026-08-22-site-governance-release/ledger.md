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
