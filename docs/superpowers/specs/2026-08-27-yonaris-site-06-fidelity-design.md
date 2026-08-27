# Yonaris Site 06 Visual Fidelity Design Specification

**Status:** Approved for implementation on 2026-08-27 by the user's instruction to start after the production/prototype drift diagnosis.

**Binding visual source:** `E:/Yonaris/.superpowers/brainstorm/1950-1787739192/content/site-system-multipage-agent-06.html`

**Existing product/content contract:** `docs/superpowers/specs/2026-08-27-yonaris-site-06-design.md`

## Goal

Replace the simplified production interpretation of Site 06 with a faithful React implementation of the approved whole-site visual system. The production site may improve semantics, responsive behaviour, accessibility, content accuracy, and route integration, but it must not collapse the prototype's distinct page compositions into a generic hero, image card, and repeated evidence-card stack.

This is a visual-system correction, not a new positioning exercise. Existing approved English and Chinese narratives, category wording, Human/Agent facts, machine surfaces, forms, SEO, route contracts, privacy truthfulness, and release controls remain binding.

## Root-cause correction

The previous implementation treated the approved prototype as inspiration. It translated the prototype into a shared two-column `Hero`, rectangular media card, repeated evidence documents, and repeated tabs. Tests checked tokens, copy, accessibility, and route health but did not compare the rendered composition against the approved source.

For this implementation:

- The approved prototype is the composition source of truth.
- “Translate into React” means preserve the visual hierarchy and spatial relationships while replacing prototype-only state mutation with accessible React state.
- Reuse is allowed for typography, navigation, evidence rows, controls, and interaction state. Reuse must not make unrelated pages share the same composition.
- Route-specific scenes are first-class components. A generic `Hero` component may not determine every route's above-the-fold layout.
- The production visual acceptance set must be reviewed beside screenshots of the approved source at matching viewport widths.

## Visual grammar

### Binding tokens

- Deep navy: `#071724`
- Secondary navy: `#0d2232`
- Ink: `#101a25`
- Soft ink: `#43515d`
- Warm paper: `#f2ede3`
- Warm white: `#fbf8f1`
- Brand orange: `#ef5a1a`
- Warm amber: `#c9874d`
- Maximum content width: `1220px`
- H1: `clamp(38px, 4vw, 48px)`
- H2: `clamp(29px, 3.3vw, 40px)`

Orange remains a focus colour: active rule, selected phrase, focus ring, or one data point. The only filled orange control is the high-intent form submit. No orange field, orange hero, or repeated orange button system.

### Composition primitives

The production system must faithfully implement the prototype's visual roles, using React-friendly names if desired:

- **Cinematic field:** full-bleed business photography with navy tonal treatment, layered gradient, fine-line annotations, and restrained foreground copy. It is not a bordered image card.
- **Evidence sheet:** a physical paper/dossier object with hierarchy, source annotations, a selected phrase, and an attached reading note. It must read as an inspectable document, not dashboard chrome.
- **Trace workbench:** one observed answer connected to source, boundary, buying effect, and next action through visible spatial relationships.
- **Comparison stage:** one question remains fixed while baseline and retest evidence change.
- **Dual-reading stage:** one canonical fact occupies the centre; Human and Agent readings expose different context without changing the fact.
- **System field:** six connected nodes occupy a spatial relationship map. The selected node changes the explanation of what breaks when disconnected.
- **Replay stage:** one de-identified Chinese example moves between 基线、断点、行动、复核 without pre-claiming improvement.
- **Fact directory:** the Agent surface uses a question index, answer document, active fact anchor, and evidence inspector. It is visually and structurally distinct from the Human marketing pages.

Bordered records may be used when they represent a real document, source, or state. Equal-size card walls, generic bento grids, feature tiles, numbered rails, and repeated dashboard frames remain rejected.

## Route-specific compositions

### English

- **Home `/`:** cinematic navy field with full-bleed conference-room photography and the concentric Human/Agent claim reader from the approved source; subsequent sections alternate warm paper dossier, dark workbench, photographic comparison stage, and warm dual-reading bridge. The first viewport must not be a 50/50 text-plus-image-card grid, and the orbit reader must remain semantic rather than decorative.
- **Platform `/product`:** evidence-led photo head followed by the trace workbench. The inspectable answer, source, boundary, and buying effect are the primary visual object.
- **Evidence `/approach`:** cinematic business-walk field and a comparison stage that holds one question constant across baseline and retest.
- **Human + Agent `/company`:** dual-reading stage is above the fold and visually dominant. Category, purpose, and scope remain one canonical fact system.
- **Across markets `/geo`:** warm editorial/photo split connecting market, language, buying context, alternatives, and evidence conditions. It is not a generic product hero.
- **Contact `/diagnostic`:** dark photographic contact composition with concise decision copy and the three-field form integrated into the scene.
- **Privacy `/privacy`:** quiet warm-paper editorial document with strong typographic hierarchy. It intentionally avoids cinematic spectacle but still uses the 06 header, spacing, and evidence-line language.

### Chinese

- **Home `/zh`:** cinematic business-walk field with the localized concentric Human/Agent claim reader, followed immediately by the dark anxiety selector. It must feel commercially urgent and locally written, not like the English hero translated into Chinese.
- **System `/zh/product`:** the six-node system field is the hero and primary interaction. It cannot be replaced by a tab row above a generic record.
- **Breakdown `/zh/approach`:** the replay stage is the primary visual object and keeps the same de-identified example through 基线、断点、行动、复核.
- **Human + Agent `/zh/company`:** a prominent dual-reading field explains the same public fact for people and agents. The mode control appears in the first viewport.
- **Across markets `/zh/geo`:** editorial/photo composition uses Chinese buying-language differences and evidence conditions without framing customers by origin or destination.
- **Contact `/zh/diagnostic`:** localized dark contact composition with exactly 姓名、电话、公司.
- **Privacy `/zh/privacy`:** quiet Chinese editorial document, not an English layout with translated paragraphs.

## Interaction and motion

Interaction must change meaning and also provide perceptible visual response.

- Evidence phrases change the attached source, boundary, buying effect, and active annotation.
- Baseline/retest and Chinese replay changes animate the document state with a short cross-fade and positional transition.
- The dual-reading stage changes both visible information hierarchy and the surrounding reading geometry.
- The system field moves focus and connecting-line emphasis to the selected node.
- Agent fact anchors update the evidence inspector and stable fact context.
- Photography may use a subtle 16–24 second breathing scale; technical geometry may drift by a few pixels. These motions stop under `prefers-reduced-motion: reduce`.
- No auto-advancing carousel, decorative scroll-reveal system, particle field, or movement that delays content.

The prior blanket rejection of all infinite animation is removed. The correct rule is that no meaning, navigation, or readability depends on animation, and reduced-motion users receive a stable layout.

## Responsive behaviour

- Desktop acceptance widths: `1440` and `1280`.
- Mobile acceptance widths: `390` and `360`.
- Cinematic photography remains contextual on mobile instead of becoming a tiny card; crops use explicit focal positions.
- Spatial scenes linearize in a deliberate reading order while preserving their object identity.
- Human/Agent and locale controls remain prominent in the mobile menu.
- No horizontal overflow, clipped controls, inaccessible off-screen content, or poster-sized headings.

## Assets

Use the complete approved prototype photography set rather than the prior three-image subset. Copy the following binaries from the binding source directory into `apps/www/public/brand/site-06/` with stable descriptive filenames:

- `photo-office-unsplash-1497366811353.jpg`
- `photo-business-walk-pexels-8526452.jpg`
- `photo-lobby-pexels-18592586.jpg`
- `photo-evidence-unsplash-1450101499163.jpg`
- `photo-glass-meeting-pexels-3760089.jpg`
- `photo-warm-office-pexels-31771712.jpg`
- `photo-working-unsplash-1524758631624.jpg`

Keep the existing Yonaris wordmark. Do not redraw or replace the logo. Preserve photography credits in a discreet repository asset note or visually subordinate caption without turning attribution into page content.

## Preserved product contracts

- Exact English category: `AI-native MarTech infrastructure built for decisions made by people and shaped by agents.`
- Exact Chinese category: `面向人类决策、由 Agent 共同塑造的 AI 原生营销科技基础设施。`
- Human pages remain canonical and indexable; Agent HTML, Markdown, and JSON-LD remain alternate representations of the same facts.
- Every meaningful Human fact remains in initial SSR output with stable anchors, evidence/source language, and boundaries.
- English form fields remain Name, Work email, Company. Chinese form fields remain 姓名、电话、公司. Accepted submissions continue through the existing provider-backed email endpoint.
- Resources and retired public surfaces remain unavailable. No public upstream-origin claim, retired framework attribution, fake metric, fake logo, or fake customer result may appear.
- Existing routes, redirects, robots, sitemap, content negotiation, canonical/hreflang, GET/HEAD behaviour, and deployment safety remain intact.

## Visual acceptance contract

1. Render the binding prototype and production routes at the four acceptance widths.
2. Capture matching top-of-page and full-page screenshots for the English, Chinese, and Agent route sets.
3. Review side by side for composition, image role, type hierarchy, colour balance, spacing rhythm, interaction affordance, and route distinctness.
4. Automated browser tests must verify route-specific scene identity instead of only generic `.site-06-hero` presence.
5. At least these production selectors or equivalent semantic scene markers must be independently present: cinematic field, evidence sheet, trace workbench, comparison stage, dual-reading stage, system field, replay stage, and fact directory.
6. An intentional mutation replacing a route-specific scene with the generic two-column hero must fail at least one automated test.
7. The acceptance screenshots must be generated with normal motion preferences for visual review and repeated with reduced motion for accessibility checks.
8. Release only after a reviewer compares the production captures to the binding source and reports no Critical or Important visual-fidelity drift.
