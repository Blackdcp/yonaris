# G3 Legacy AI/AEO/AI Visibility Governance Report

Date: 2026-08-23
Worktree: `E:\\Yonaris\\.worktrees\\homepage-product-stage`
Exact base: `937ec7b4f4dc5bb5ca8794cc8403e29c53f6c258`
Implementation commit: this atomic G3 commit; SHA is reported after creation
Push/deploy: not performed

## Delivered scope

- Governed exactly the 15 approved legacy templates: AI Search index/dynamic, AEO index/dynamic, and the 11 AI Visibility index/dynamic/directory/comparison/feature templates.
- Preserved the existing loaders, source datasets, valid dynamic bodies, related records, filtering, static open-source route priority, and every invalid-slug 404.
- Reused the reviewed Publication shell for AI Search and AEO with a visible `Legacy research archive` boundary before H1.
- Added one shared Legacy Archive shell/context for AI Visibility with visible `Upstream Elmo comparison archive` provenance before H1, the `2026-08-23` boundary date, current Product/GEO/Open Source destinations, and the upstream `elmohq/elmo` source.
- Reframed deep-scroll AI Search guidance, AEO product wording, supplier profiles, comparison records, and FAQ answers as dated source material rather than current Yonaris claims.
- Applied concrete canonicals and exact `noindex,follow` to every legacy route. The routes remain crawlable, are excluded from the sitemap, and emit no route-owned rich JSON-LD.
- Removed the misattributed `ELMO_LISTING` plus zero-consumer SoftwareApplication/comparison helpers without changing the root Yonaris Organization/WebSite identity.
- Replaced card-grid and legacy palette presentation with VI-token editorial registers, ruled ledgers, source profiles, tables, and filters. No gradient or background image is used.
- Added labeled keyboard-scroll regions with Signal focus, semantic filter buttons with `aria-pressed`, 44px controls/current-scope links, reduced-motion behavior, and seven-width overflow/Axe coverage.
- Restored the complete loader-derived feature-by-supplier directory matrix and retained recorded pricing, domains, and source URLs on pair and multi-comparison pages.
- Preserved recorded single-comparison pricing as well, including starting price, free-tier state, and enterprise-plan state beside the archived supplier profile.
- Removed the nondeterministic third-party supplier screenshot surface while retaining a visible recorded-source link and archive explanation.
- Completed the category-index H1→H2→H3 hierarchy and gave the archive-boundary and end-of-record navigation landmarks distinct accessible names.
- Kept server-rendered directory filters natively disabled until hydration attaches their handlers, then enabled them for interaction without a hydration mismatch.

## RED to GREEN evidence

Focused RED coverage was written before production migration and exposed the expected defects: missing route robots/canonicals/archive context, unreviewed rich JSON-LD at nested depths, the Elmo/Yonaris identity helper, incomplete dynamic-body preservation coverage, stale current-commercial wording, non-semantic comparison scrolling, filter state/target gaps, and the absent local deep-scroll archive boundaries.

Additional review-driven RED cases covered:

- every AI Visibility dynamic loader/body and real comparison row;
- root Organization/WebSite identity plus removal of the Elmo helper and all consumers;
- single, pair, multi, root-directory, and open-source scroll regions at `1440`, `390`, and `280` CSS px;
- actual filter state/result changes, 44px geometry, Signal focus, and reduced motion at all three interaction widths;
- exact local boundaries for recorded AI Search guidance, AEO wording, and archived FAQ answers;
- current-scope link gap/wrap/44px geometry;
- all six representative pages at the seven-width acceptance matrix.
- the complete root feature-by-supplier matrix, pair/multi pricing/domain/source facts, deterministic single-comparison source presentation, category heading order, and distinct scope-navigation landmarks.
- priced and free-tier single-comparison suppliers, plus deterministic SSR-disabled and post-hydration-enabled filter states.

Fresh final gates:

- Expanded focused legacy browser contract: `16/16` passed at four workers.
- Full WWW unit suite: `30 files / 227 tests` passed.
- Full public browser suite: `180/180` passed at four workers.
- Full visual browser suite: `114/114` passed at one worker.
- WWW TypeScript check: passed.
- E2E TypeScript check: passed.
- Site manifest audit: passed.
- Production WWW build: passed.
- Authored-file Biome check: `30 files` passed.
- Changeset status against `origin/main`: passed; the existing final full-site changeset remains reserved for the plan's release-review task.
- `git diff --check`: passed (Git's Windows line-ending warnings only).

The first full-public attempt accidentally passed runner arguments through pnpm after `--`, so Playwright used ten workers. The local Vite server then produced transient dynamic-module-fetch failures and one stalled width matrix. That run was stopped and discarded. The first correctly bounded four-worker run completed `172/173` and found one real issue: a 42rem comparison table contributed 168px of document-level overflow at 390px even though its inner region scrolled. Layout containment was added to the keyboard-scroll region, its internal scroll was preserved, and the focused seven-width/Axe matrix passed. After the first independent-review fixes, a fresh direct four-worker run completed `178/178`. A later full run, after adding the single-pricing regression, completed `178/179` and exposed an SSR hydration race: a filter click could arrive before React attached the handler. Native pre-hydration disabling plus an explicit raw-HTML/browser-state contract fixed the race. Stress verification passed `6/6`, and the final direct four-worker run completed `180/180`.

## Visual review

The six required representative routes were captured at `1440`, `390`, and `280` CSS px and all 18 images were inspected individually. The AI Search/AEO/archive-boundary and current-scope fixes were then regenerated and re-inspected at desktop and micro widths. Six additional Ahrefs-priced and HubSpot-free single-comparison images were captured and inspected at the same three widths. The final full visual gate regenerated all 18 required G3 artifacts and passed.

Persisted visual evidence directory:

`E:\\Yonaris\\.worktrees\\homepage-product-stage\\e2e\\test-results-www\\visual-qa`

Files:

1. `ai-search--en--desktop--legacy-governed--3e638c00b131.png`
2. `ai-search--en--mobile--legacy-governed--4e314adf56cc.png`
3. `ai-search--en--micro--legacy-governed--de0de455e3e2.png`
4. `aeo-for-agencies--en--desktop--legacy-governed--bd0341c76fec.png`
5. `aeo-for-agencies--en--mobile--legacy-governed--ad08add59548.png`
6. `aeo-for-agencies--en--micro--legacy-governed--74797fff38ef.png`
7. `ai-visibility-tools--en--desktop--legacy-governed--05bf38a9bd27.png`
8. `ai-visibility-tools--en--mobile--legacy-governed--e8fcf8f93d4b.png`
9. `ai-visibility-tools--en--micro--legacy-governed--02ccb43b564c.png`
10. `ai-visibility-tools-elmo-vs-profound--en--desktop--legacy-governed--6c56250483ad.png`
11. `ai-visibility-tools-elmo-vs-profound--en--mobile--legacy-governed--b0ba6a8ae4c1.png`
12. `ai-visibility-tools-elmo-vs-profound--en--micro--legacy-governed--acf2d447d896.png`
13. `ai-visibility-tools-compare-profound-vs-ahrefs-brand-radar-vs-hubspot-aeo-grader-vs-rankshift-vs-scrunch--en--desktop--legacy-governed--985cd0069849.png`
14. `ai-visibility-tools-compare-profound-vs-ahrefs-brand-radar-vs-hubspot-aeo-grader-vs-rankshift-vs-scrunch--en--mobile--legacy-governed--b7a4942a2f54.png`
15. `ai-visibility-tools-compare-profound-vs-ahrefs-brand-radar-vs-hubspot-aeo-grader-vs-rankshift-vs-scrunch--en--micro--legacy-governed--8a062dde2a0e.png`
16. `ai-visibility-tools-category-open-source--en--desktop--legacy-governed--82489adc8ecb.png`
17. `ai-visibility-tools-category-open-source--en--mobile--legacy-governed--5d86aecf0516.png`
18. `ai-visibility-tools-category-open-source--en--micro--legacy-governed--008f57f0c15c.png`

## Review status

The first independent review reported `0 Critical / 2 Important / 2 Minor`:

- Important: the root directory summarized away its per-feature supplier matrix, and pair/multi comparison profiles omitted recorded pricing/domain/source facts.
- Important: a remote lazy-loaded supplier screenshot made visual evidence nondeterministic and produced an empty screenshot area.
- Minor: the category index skipped from H1 to H3.
- Minor: the archive-boundary and end-of-record navigation landmarks shared the same accessible name.

All four findings were converted to focused RED regressions and fixed. The complete matrix and comparison facts are restored, the remote image dependency is removed while the source link remains, the heading hierarchy is complete, and the navigation names are distinct.

A first final re-review then reported one Important preservation gap: single-comparison pages omitted recorded free-tier and starting-price facts. A priced supplier and a free-tier supplier were added to the regression matrix, the archived facts were restored beside each supplier profile, and all six supplemental width captures were inspected. Narrow re-review returned `0 Critical / 0 Important / 0 Minor`.

The final full-public gate subsequently exposed the pre-hydration filter race described above. The deterministic SSR/browser regression and production guard were independently re-reviewed at `0 Critical / 0 Important / 0 Minor`. Final focused GREEN is `16/16`, all 18 required G3 captures were regenerated and individually inspected, full public is `180/180`, and full visual is `114/114`.
