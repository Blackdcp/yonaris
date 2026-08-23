# G5 Legacy Marketing Cleanup Report

Date: 2026-08-23
Worktree: `E:\\Yonaris\\.worktrees\\homepage-product-stage`
Exact base: `d67b00f23fca8c1a8adf03f435da27d452e84377`
Push/deploy: not performed

## Scanner RED to GREEN

The scanner fixture began RED at `0/6`: the absent CLI produced an ordinary nonzero child-process result while all six behavior assertions failed. After the scanner implementation, the same fixture suite passed `6/6`, covering untracked production files, complete/stable diagnostics, slash normalization, per-file/per-key redirect exemptions, exclusions, a retired definition with no consumer, and a cached path already deleted from the working tree.

Independent review then identified four binding legacy symbols missing from the future guard. A seventh fixture was added first and failed `6/7` because the scanner incorrectly exited `0`; after adding `HOME_FAQS`, `PRICING_FAQS`, `OFFSITE_FAQS`, and `getLocalizedPath`, the suite passed `7/7`. The deletion-before RED evidence was regenerated against the exact detached base with this final scanner.

The package command was separately observed RED before its script was registered:

```text
[ERR_PNPM_RECURSIVE_RUN_NO_SCRIPT] None of the selected packages has a "audit:legacy-marketing" script
```

After registration and before any legacy deletion, the final scanner produced the required repository RED below. This is the complete scanner output. All 117 violations are confined to the 21 approved retired production modules plus the three retired FAQ definitions removed from the otherwise retained `faqs.ts`; there is no live consumer outside the approved cleanup set.

```text
Legacy marketing audit found 117 violation(s):
apps/www/src/components/community.tsx:1 [retired-source] Retired source definition must be deleted
apps/www/src/components/contact-form.tsx:1 [retired-source] Retired source definition must be deleted
apps/www/src/components/cta.tsx:1 [retired-source] Retired source definition must be deleted
apps/www/src/components/customer-logos.tsx:1 [retired-source] Retired source definition must be deleted
apps/www/src/components/faq.tsx:1 [retired-source] Retired source definition must be deleted
apps/www/src/components/features.tsx:1 [retired-source] Retired source definition must be deleted
apps/www/src/components/hero.tsx:1 [retired-source] Retired source definition must be deleted
apps/www/src/components/marketing/detail-page.tsx:1 [retired-source] Retired source definition must be deleted
apps/www/src/components/marketing/detail-page.tsx:2 [retired-identifier] getMarketingContent
apps/www/src/components/marketing/detail-page.tsx:3 [retired-identifier] getMarketingDetailPage
apps/www/src/components/marketing/detail-page.tsx:5 [retired-identifier] MarketingDetailPageKey
apps/www/src/components/marketing/detail-page.tsx:6 [retired-import] Import resolves to apps/www/src/lib/marketing-content.ts
apps/www/src/components/marketing/detail-page.tsx:6 [retired-module-name] marketing-content
apps/www/src/components/marketing/detail-page.tsx:7 [retired-identifier] MarketingLink
apps/www/src/components/marketing/detail-page.tsx:7 [retired-import] Import resolves to apps/www/src/components/marketing/marketing-link.tsx
apps/www/src/components/marketing/detail-page.tsx:8 [retired-identifier] MarketingShell
apps/www/src/components/marketing/detail-page.tsx:8 [retired-import] Import resolves to apps/www/src/components/marketing/marketing-shell.tsx
apps/www/src/components/marketing/detail-page.tsx:9 [retired-identifier] MarketingSection
apps/www/src/components/marketing/detail-page.tsx:9 [retired-import] Import resolves to apps/www/src/components/marketing/section.tsx
apps/www/src/components/marketing/detail-page.tsx:10 [retired-identifier] SignalField
apps/www/src/components/marketing/detail-page.tsx:10 [retired-import] Import resolves to apps/www/src/components/marketing/signal-field.tsx
apps/www/src/components/marketing/detail-page.tsx:12 [retired-identifier] MarketingDetailPageKey
apps/www/src/components/marketing/detail-page.tsx:13 [retired-identifier] getMarketingContent
apps/www/src/components/marketing/detail-page.tsx:16 [retired-page-key] results
apps/www/src/components/marketing/detail-page.tsx:41 [retired-page-key] methodology
apps/www/src/components/marketing/detail-page.tsx:58 [retired-page-key] platform
apps/www/src/components/marketing/detail-page.tsx:93 [retired-identifier] MarketingDetailPage
apps/www/src/components/marketing/detail-page.tsx:93 [retired-identifier] MarketingDetailPageKey
apps/www/src/components/marketing/detail-page.tsx:94 [retired-identifier] getMarketingContent
apps/www/src/components/marketing/detail-page.tsx:95 [retired-identifier] getMarketingDetailPage
apps/www/src/components/marketing/detail-page.tsx:99 [retired-identifier] MarketingShell
apps/www/src/components/marketing/detail-page.tsx:100 [retired-identifier] MarketingSection
apps/www/src/components/marketing/detail-page.tsx:106 [retired-identifier] SignalField
apps/www/src/components/marketing/detail-page.tsx:117 [retired-identifier] MarketingSection
apps/www/src/components/marketing/detail-page.tsx:119 [retired-identifier] MarketingSection
apps/www/src/components/marketing/detail-page.tsx:135 [retired-identifier] MarketingSection
apps/www/src/components/marketing/detail-page.tsx:138 [retired-identifier] MarketingSection
apps/www/src/components/marketing/detail-page.tsx:163 [retired-identifier] MarketingSection
apps/www/src/components/marketing/detail-page.tsx:166 [retired-identifier] MarketingSection
apps/www/src/components/marketing/detail-page.tsx:175 [retired-identifier] MarketingLink
apps/www/src/components/marketing/detail-page.tsx:177 [retired-identifier] MarketingLink
apps/www/src/components/marketing/detail-page.tsx:180 [retired-identifier] MarketingSection
apps/www/src/components/marketing/detail-page.tsx:181 [retired-identifier] MarketingShell
apps/www/src/components/marketing/marketing-link.tsx:1 [retired-source] Retired source definition must be deleted
apps/www/src/components/marketing/marketing-link.tsx:20 [retired-identifier] MarketingLink
apps/www/src/components/marketing/marketing-shell.tsx:1 [retired-source] Retired source definition must be deleted
apps/www/src/components/marketing/marketing-shell.tsx:3 [retired-identifier] MarketingPageKey
apps/www/src/components/marketing/marketing-shell.tsx:3 [retired-import] Import resolves to apps/www/src/lib/marketing-content.ts
apps/www/src/components/marketing/marketing-shell.tsx:3 [retired-module-name] marketing-content
apps/www/src/components/marketing/marketing-shell.tsx:8 [retired-identifier] MarketingPageKey
apps/www/src/components/marketing/marketing-shell.tsx:19 [retired-identifier] MarketingPageKey
apps/www/src/components/marketing/marketing-shell.tsx:21 [retired-identifier] MarketingShell
apps/www/src/components/marketing/section.tsx:1 [retired-source] Retired source definition must be deleted
apps/www/src/components/marketing/section.tsx:15 [retired-identifier] MarketingSection
apps/www/src/components/marketing/section.tsx:29 [retired-identifier] SectionIntro
apps/www/src/components/marketing/signal-field.tsx:1 [retired-source] Retired source definition must be deleted
apps/www/src/components/marketing/signal-field.tsx:7 [retired-identifier] SignalField
apps/www/src/components/off-site-aeo.tsx:1 [retired-source] Retired source definition must be deleted
apps/www/src/components/pricing.tsx:1 [retired-source] Retired source definition must be deleted
apps/www/src/components/pricing.tsx:3 [retired-import] Import resolves to apps/www/src/components/waitlist-form.tsx
apps/www/src/components/pricing.tsx:4 [retired-import] Import resolves to apps/www/src/components/contact-form.tsx
apps/www/src/components/quickstart-block.tsx:1 [retired-source] Retired source definition must be deleted
apps/www/src/components/stats.tsx:1 [retired-source] Retired source definition must be deleted
apps/www/src/components/testimonial.tsx:1 [retired-source] Retired source definition must be deleted
apps/www/src/components/testimonial.tsx:2 [retired-import] Import resolves to apps/www/src/components/customer-logos.tsx
apps/www/src/components/waitlist-form.tsx:1 [retired-source] Retired source definition must be deleted
apps/www/src/lib/faqs.ts:9 [retired-identifier] HOME_FAQS
apps/www/src/lib/faqs.ts:38 [retired-identifier] PRICING_FAQS
apps/www/src/lib/faqs.ts:63 [retired-identifier] OFFSITE_FAQS
apps/www/src/lib/github-stars.ts:1 [retired-source] Retired source definition must be deleted
apps/www/src/lib/marketing-content.ts:1 [retired-source] Retired source definition must be deleted
apps/www/src/lib/marketing-content.ts:29 [retired-identifier] MarketingPageKey
apps/www/src/lib/marketing-content.ts:29 [retired-page-key] methodology
apps/www/src/lib/marketing-content.ts:29 [retired-page-key] platform
apps/www/src/lib/marketing-content.ts:29 [retired-page-key] results
apps/www/src/lib/marketing-content.ts:30 [retired-identifier] MarketingDetailPageKey
apps/www/src/lib/marketing-content.ts:30 [retired-identifier] MarketingPageKey
apps/www/src/lib/marketing-content.ts:32 [retired-identifier] MarketingRoute
apps/www/src/lib/marketing-content.ts:33 [retired-identifier] MarketingPageKey
apps/www/src/lib/marketing-content.ts:49 [retired-identifier] MarketingSectionContent
apps/www/src/lib/marketing-content.ts:56 [retired-identifier] DetailPageContent
apps/www/src/lib/marketing-content.ts:61 [retired-identifier] MarketingSectionContent
apps/www/src/lib/marketing-content.ts:72 [retired-identifier] DiagnosticPreviewContent
apps/www/src/lib/marketing-content.ts:78 [retired-identifier] MARKETING_ROUTES
apps/www/src/lib/marketing-content.ts:78 [retired-identifier] MarketingRoute
apps/www/src/lib/marketing-content.ts:80 [retired-page-key] platform
apps/www/src/lib/marketing-content.ts:81 [retired-page-key] methodology
apps/www/src/lib/marketing-content.ts:82 [retired-page-key] results
apps/www/src/lib/marketing-content.ts:114 [retired-identifier] DiagnosticPreviewContent
apps/www/src/lib/marketing-content.ts:322 [retired-identifier] DetailPageContent
apps/www/src/lib/marketing-content.ts:322 [retired-identifier] MarketingPageKey
apps/www/src/lib/marketing-content.ts:325 [retired-identifier] MarketingContent
apps/www/src/lib/marketing-content.ts:327 [retired-identifier] MarketingContent
apps/www/src/lib/marketing-content.ts:512 [retired-identifier] getMarketingContent
apps/www/src/lib/marketing-content.ts:512 [retired-identifier] MarketingContent
apps/www/src/lib/marketing-content.ts:516 [retired-identifier] DetailPageContent
apps/www/src/lib/marketing-content.ts:516 [retired-identifier] getMarketingDetailPage
apps/www/src/lib/marketing-content.ts:516 [retired-identifier] MarketingDetailPageKey
apps/www/src/lib/marketing-content.ts:517 [retired-identifier] getMarketingContent
apps/www/src/lib/marketing-content.ts:520 [retired-identifier] getLocalizedPath
apps/www/src/lib/marketing-content.ts:522 [retired-identifier] MARKETING_ROUTES
apps/www/src/lib/marketing-content.ts:530 [retired-identifier] getMarketingNavigation
apps/www/src/lib/marketing-content.ts:530 [retired-identifier] MarketingPageKey
apps/www/src/lib/marketing-content.ts:531 [retired-identifier] getMarketingContent
apps/www/src/lib/marketing-content.ts:532 [retired-identifier] MARKETING_ROUTES
apps/www/src/lib/marketing-content.ts:547 [retired-identifier] getMarketingPageMeta
apps/www/src/lib/marketing-content.ts:547 [retired-identifier] MarketingPageKey
apps/www/src/lib/marketing-content.ts:548 [retired-identifier] getMarketingContent
apps/www/src/lib/marketing-content.ts:549 [retired-identifier] MARKETING_ROUTES
apps/www/src/lib/marketing-seo.ts:1 [retired-identifier] getMarketingPageMeta
apps/www/src/lib/marketing-seo.ts:1 [retired-identifier] MarketingPageKey
apps/www/src/lib/marketing-seo.ts:1 [retired-import] Import resolves to apps/www/src/lib/marketing-content.ts
apps/www/src/lib/marketing-seo.ts:1 [retired-module-name] marketing-content
apps/www/src/lib/marketing-seo.ts:1 [retired-source] Retired source definition must be deleted
apps/www/src/lib/marketing-seo.ts:4 [retired-identifier] marketingPageHead
apps/www/src/lib/marketing-seo.ts:4 [retired-identifier] MarketingPageKey
apps/www/src/lib/marketing-seo.ts:5 [retired-identifier] getMarketingPageMeta
```

## Final verification

The final live audit is GREEN and the final fixture suite is `7/7`. The cleanup deleted exactly the 21 audit-proven retired production modules and the colocated obsolete `marketing-content.test.ts`, reduced `faqs.ts` to `FaqItem` plus `DIRECTORY_FAQS`, and removed only the zero-consumer signal selectors/keyframe from `site-core.css`.

The preflight classified `.marketing-display` as removable, but the post-G4 tree proved a live governed 404 consumer in `components/not-found.tsx`. A focused stylesheet assertion was deliberately made RED (`1/5` failed) and returned GREEN (`5/5`) after restoring the exact selector. Retaining it is the only ruling consistent with the later binding protections for G4 and zero visual change.

Final gates:

- Scanner fixture: `7/7`.
- Live legacy audit: GREEN, no retired consumers.
- WWW unit: `29 files / 219 tests`.
- WWW and E2E typechecks: GREEN.
- Site manifest audit: GREEN.
- Production build: GREEN (`3407` modules transformed).
- Public Playwright: `186/186` at four workers. An earlier frozen-state run hit one Vite `socket hang up` and four dependent failures; those four passed `4/4` in isolated one-worker reproduction, then the clean full rerun passed.
- Unchanged visual Playwright: `118/118` at one worker; no snapshots were updated.
- Authored Biome, diff check, required zero legacy grep, and removed-selector grep: GREEN.

Independent review initially reported one Important scanner-coverage gap for the four legacy symbols above. That gap was closed through the seventh RED/GREEN fixture and exact-base RED regeneration. The final narrow re-review returned PASS: the reviewer confirmed all four guards, `7/7` fixtures, live audit GREEN, exactly `117` ordered base diagnostics, clean scanner/Biome/diff/zero-grep evidence, and no remaining P0/P1/P2. `.marketing-display` retention was explicitly approved as necessary to preserve the governed 404.
