# Yonaris Homepage Product Stage Design

## Decision

Implement the approved A direction, “Product Stage,” as the bilingual homepage for Yonaris. The page uses the existing Yonaris VI colors but the composition is product-led: a quiet Paper stage, a direct market-perception proposition, and one inspectable diagnostic example.

This is a bounded implementation, not another visual exploration.

## Explicit removals

- Remove the orange square and `AI market evidence` eyebrow above the hero headline.
- Remove the three-column `Observe the answer / Trace the evidence / Find the opening` rail below the hero.
- Do not replace either removal with a badge, icon, label, metric, feature list, or decorative object.
- Preserve the negative space created by those removals.

## Five-second contract

Without scrolling, a visitor must be able to identify:

1. the outcome: `See how AI is shaping your market.` / `看清 AI 如何塑造你的市场`;
2. what Yonaris observes: how AI describes, compares, and sources a brand;
3. the next action: `Get a Free Diagnostic` / `获取免费诊断`;
4. one clearly labeled illustrative diagnostic showing the observation-to-finding chain.

The longer approved thesis, `Market evidence, built for teams and systems.`, remains visible below the first screen and in machine-readable company content. It is not restored as a hero eyebrow.

## Visual system

- Paper `#F6F4F1` is the primary homepage stage.
- Ink `#0B1220` is the primary type and action color.
- Slate `#1E2A39`, Stone `#8A95A3`, and Mist `#DDE2E8` provide hierarchy and rules.
- Signal Orange `#FF6A00` is reserved for the diagnostic action and a small number of evidence/focus marks.
- No purple/blue AI gradient, glassmorphism, glowing orb, random generative line field, fake customer logo, or unsupported metric.
- Typography remains Geist and CJK system sans. The hero obtains authority through scale, rhythm, and alignment rather than a display gimmick.

## Desktop composition

At 1440 × 900:

- light homepage header, approximately 76px high, within a 1320px stage;
- left narrative column approximately 470px;
- right diagnostic window at least 600px;
- gap approximately 70px;
- hero begins approximately 78px below the header and retains generous open space beneath the conversion row;
- headline uses `clamp(58px, 5.5vw, 86px)`, line height near `.98`, with natural wrapping;
- domain entry is a real GET form to the localized diagnostic route;
- the diagnostic window is semantic HTML/CSS, not an image, and carries `Illustrative diagnostic / 示例诊断` visibly.

The diagnostic example expresses a public-surface mismatch, not a customer result:

1. a buying question;
2. an illustrative AI answer;
3. the company’s broader public narrative;
4. the observed category drift;
5. cited public surfaces;
6. an interpretation and next move.

## Mobile composition

At 390 × 844 and 360 × 800:

- the header is 64px with a compact native-details menu;
- the headline, explanation, and domain action appear before the product evidence;
- the domain input and action stack vertically;
- the diagnostic window becomes a readable vertical narrative; it is never scaled down as a desktop screenshot;
- the desktop diagnostic rail is hidden and the answer/readout content is reordered into one column;
- no horizontal overflow is permitted.

## Content and factual boundaries

- English headline: `See how AI is shaping your market.`
- Chinese headline: `看清 AI 如何塑造你的市场` with no terminal punctuation and no forced line break.
- English explanation: `Yonaris reveals how AI describes and compares your brand, which sources shape the answer, and where the market narrative can move.`
- Chinese explanation: `Yonaris 揭示 AI 如何描述与比较你的品牌、哪些信息源正在影响答案，以及市场叙事还能向哪里生长`
- The homepage input navigates to the existing transparent diagnostic request and pre-fills `website` through the query string.
- The final submission remains a user-sent email to `black.dcp@outlook.com`; the homepage must not claim that a lead was stored or a report was generated automatically.
- The diagnostic preview must not contain customer names, customer outcomes, live telemetry, or claims of model coverage.

## Navigation

Homepage navigation labels are `Product`, `Approach`, `Research`, and `Company` (localized in Chinese) and link only to real destinations:

- Product → `/platform` or `/zh/platform`
- Approach → `/methodology` or `/zh/methodology`
- Research → `/results` or `/zh/results`
- Company → the localized homepage `#company` section

The header and hero use a single diagnostic conversion label. Language links preserve the corresponding homepage.

## Accessibility and motion

- All controls are at least 44px high.
- Inputs have real labels, even when visually hidden.
- The product preview uses `<figure>`, `<figcaption>`, `<nav aria-label>`, and `<article>` where appropriate.
- Keyboard focus is visible on Paper and Ink.
- Any entrance motion runs once and is disabled under `prefers-reduced-motion: reduce`.
- Core meaning is real text in the initial HTML and does not depend on animation, hover, or image recognition.

## Acceptance views

Verify at minimum:

- English: 1440 × 900, 1280 × 800, 1024 × 768, 390 × 844;
- Chinese: 1440 × 900, 390 × 844, 360 × 800;
- `/diagnostic?website=https%3A%2F%2Fexample.com` and its Chinese counterpart pre-fill the website field;
- no hero eyebrow or orange-square label;
- no three-column hero rail or replacement module;
- no cropped diagnostic content, orphan Chinese punctuation, or horizontal overflow.
