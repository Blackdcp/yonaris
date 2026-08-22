# Task 4 fix 1 report — meet the public shell contrast contract

## Scope

Corrected the Important visual findings and the manifest-authority Minor from Task 4 visual review 1 on base
`a86c5dd02ba7b68760f02c02ba306c41432583f4`.

- Kept Signal Orange visibly present in Paper-side focus while pairing it with a painted Ink edge above 3:1 contrast.
- Applied the dual treatment to header links/actions, the mobile trigger, the homepage domain input, Paper-tone marketing
  links, and the diagnostic form controls and submit action.
- Kept focused desktop navigation text Ink rather than changing small text to orange.
- Changed the illustrative diagnostic finding to Ink text while preserving its orange evidence rail.
- Raised the Paper-on-Ink and Slate-on-Mist meaningful small-text treatments above the 4.5:1 normal-text threshold.
- Derived the header home destination through `getCorePath("home", locale)`.
- Applied the two minimal visual-review refinements: desktop navigation/footer labels are 12px, and the open-menu diagnostic
  action uses an Ink fill with an orange border so it remains necessary and visible without competing with the hero action.

## Root cause and RED evidence

The existing suite was green before the correction:

- WWW tests: 68 passed across 8 files.
- Homepage Playwright: 12 passed.

The review findings mapped directly to computed styles rather than a rendering-engine discrepancy. A new focused Playwright
run failed both new contracts before production changes:

- Paper-side focus: Signal Orange against Paper measured `2.6155:1`; the desktop primary link also had no outline, and the
  domain form had no high-contrast outline.
- Illustrative diagnostic finding: `2.4955:1`.
- Paper/44 foundation index on Ink: `4.0702:1`.
- Paper/42 foundation label on Ink: `3.7966:1`.
- Slate/58 engagement note on Mist: `3.5016:1`.
- Paper-tone marketing-link focus edge: `2.3892:1`.
- Diagnostic input and submit focus edges: `2.3892:1` and `2.4514:1`.
- Slate/60 engagement outcome label on Mist: `3.6599:1`.

The browser regression reads rendered computed colors, composites translucent foregrounds over their real adjacent
backgrounds, calculates WCAG relative luminance independently, and checks representative focus states for a visible Signal
Orange component plus a painted high-contrast edge at `>= 3:1`. Hidden/default outline colors are excluded from the focus
contrast set, so an orange-only box shadow cannot produce a false positive.

A full-suite RED run also exposed a first-frame failure on the Product and diagnostic header links: Tailwind's
`transition-colors` briefly retained the global low-contrast outline color even though a later isolated sample saw Ink. The
header now uses the same non-transitioned Signal/Ink double-shadow treatment, so the contract holds from the first painted
focus frame.

## GREEN verification

- Focused contrast/focus Playwright: 2 passed.
- Full WWW suite: 68 passed across 8 files.
- Full homepage Playwright: 14 passed.
- WWW typecheck: passed.
- Focused Biome check for all changed `apps/www` source and CSS: passed with no diagnostics.
- WWW production build: passed.
- `git diff --check`: passed.

The existing Blog/Docs `createServerFn().inputValidator()` deprecation warnings and missing local Upstash configuration
warnings remained non-failing and are outside this fix.

## Visual QA

Recaptured and inspected full-page states after the correction:

- English homepage at 1440 × 900.
- Chinese homepage at 1440 × 900.
- English homepage at 390 × 844 with the mobile menu open after hydration.

The diagnostic finding remains anchored by Signal Orange without orange text on Paper. Dark-section labels are legible while
remaining subordinate, desktop navigation and footer labels remain restrained, the open mobile panel has no horizontal
overflow, and its Ink/orange diagnostic action no longer competes with the orange hero action.

## Review

An independent read-only check surfaced four gaps: focused navigation text needed an explicit normal-text contrast assertion;
Paper-tone marketing links and diagnostic form controls still had orange-only focus rings; the engagement outcome label was
still below 4.5:1; and the first focus helper included unpainted outline colors. The final implementation addresses each gap.
The Playwright contract tabs to the primary link and asserts its rendered text contrast is `>= 4.5:1`, samples the additional
Paper-side controls, includes the outcome label in the normal-text checks, and only credits actually painted indicator colors.
