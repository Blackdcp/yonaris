# Yonaris 0→1 Regional Website Rebuild

**Status:** Approved by the user's direct instruction to remove the current website burden, rebuild from a blank canvas, avoid intermediate confirmation, and ship both regional editions.

## 1. Decision

This is an architectural replacement, not a visual refresh.

The current Human website, its page primitives, its content hierarchy, its interaction grammar, and its explanatory language are retired. The new site keeps only:

- verified brand assets and brand colors;
- factual product capabilities that can be supported today;
- the regional lead-delivery API and its validation contract;
- routing, SEO, machine-readable delivery, deployment, and rollback infrastructure.

The selected approach is a clean-room marketing rebuild inside an isolated worktree. A stylesheet reskin and a component-by-component refactor were rejected because both would preserve the visible logic the user has explicitly rejected.

## 2. Customer promise

Yonaris helps brands understand and improve how AI answers the questions that shape discovery, comparison, and choice.

The Human site must answer four customer questions in this order:

1. What is changing in my market?
2. What is going wrong for my brand?
3. What can Yonaris help me see or change?
4. What should I do next?

Internal quality controls, website architecture, implementation status, proof caveats, and team reasoning are not a sales narrative. They may appear only where legally or operationally necessary, in compact language.

## 3. Audience model

The site does not segment visitors by job title or function. It organizes around five situations:

- the brand is absent when a buyer asks AI;
- AI describes the brand inaccurately or incompletely;
- competitors dominate recommendations and category framing;
- different markets receive different versions of the brand;
- the team cannot tell which change will improve the outcome.

“AI anxiety” remains an internal positioning lens. It is never shown as a customer label.

## 4. Two regional editions, not one translated site

### Global English: Signal Field

The global edition follows a global enterprise-product pattern: lead with the market shift and commercial value, pair emotion with product evidence, use a different composition for each chapter, and keep one clear conversion path.

Its own visual system is **Signal Field**:

- warm open space, deep Yonaris navy, and restrained orange signal accents;
- large but controlled editorial typography, not a repeated giant-title template;
- visual relationships between buyer questions, answers, brands, competitors, sources, markets, and change;
- product scenes that look usable rather than decorative dashboard mockups;
- page-specific visual protagonists: Answer Field, Product Lens, Change Path, Market Atlas, Company Constellation, and Contact Signal;
- motion that explains a relationship or state change, never ambient spectacle.

Voice rules:

- confident, concise, globally commercial;
- outcomes before mechanics;
- active verbs such as see, understand, improve, compare, and prove;
- no internal review vocabulary in Human sales copy;
- no unsupported scale, customer, real-time, coverage, or performance claims.

### Simplified Chinese: Brand Answer Command

The China edition follows a China ToB decision pattern: result-first communication, urgency without panic, higher information density, early trust, repeated action opportunities, and a concrete global-service story.

Its own visual system is **Brand Answer Command**:

- Yonaris navy, warm paper, and orange remain the brand anchors;
- stronger blocks, tighter rhythm, clearer labels, and more decision-oriented compositions than the global edition;
- each screen combines one conclusion, one graphic explanation, one deliverable or fact, and one next step;
- language sounds written for a Chinese business buyer, not translated from English;
- page-specific visual protagonists: AI Answer Flow, Brand Gap Console, Service Route, Global Market Bridge, Company Network, and Consultation Brief.

Voice rules:

- 10–18 Chinese characters for most headings;
- one judgment per sentence;
- lead with the customer situation, then the result;
- prefer 看见、说清、比较、改善、跟踪 over abstract technical nouns;
- describe global service as rebuilding questions for each target market, not translating a Chinese campaign;
- never expose internal audience labels, review instructions, or implementation explanations.

## 5. Human and Agent separation

Human and Agent experiences use explicit real routes and preserve locale and topic when switching.

Human pages own:

- market narrative;
- brand and product persuasion;
- visual explanation;
- conversion.

Agent pages own:

- concise verified company and product facts;
- canonical Human links;
- structured topic navigation;
- machine-readable endpoints.

Agent pages use a dense, restrained, machine-first surface with the Yonaris logo and a small orange signal. They do not inherit the Human marketing composition, and Human pages do not explain the site-governance decision.

## 6. Information architecture

### Global Human

- `/` — market shift, five customer situations, product story, global capability, lead form
- `/product` — continuous product journey: see, understand, improve, compare
- `/approach` — service relationship expressed as customer progress, not internal procedure
- `/geo` — market and language variation, global service capability
- `/company` — category conviction, operating capability, regional service model, contact
- `/diagnostic` — three-field lead form and a short expectation statement
- `/privacy` — concise contact-data handling

### China Human

- `/zh` — customer change, four concrete problems, product/service result, global capability, lead form
- `/zh/product` — product journey centered on actual questions and answer differences
- `/zh/approach` — problem-led service options and what customers receive
- `/zh/geo` — China-market service and China-to-global delivery
- `/zh/company` — local understanding, global capability, factual company positioning
- `/zh/diagnostic` — 姓名、电话、公司
- `/zh/privacy` — concise contact-data handling

The Resources/Research section and its localized and Agent routes are removed from navigation, sitemap, machine indexes, and public routing. Legacy result links redirect to the most relevant product page rather than reviving that section.

## 7. Page experiences

Every Human page must contain a meaningful graphical or interactive element. Text-only chapters and repeated “headline + numbered section + generic card grid” layouts are prohibited.

### Global home

- Hero: “Your next customer may never search. They’ll ask.”
- Interactive Answer Field: switch among buyer questions and watch brand, competitor, and answer signals recompose.
- Situation rail: missing, misrepresented, displaced, fragmented, uncertain.
- Product movement: See → Understand → Improve → Compare.
- Market bridge and direct lead form.

### Global product

- Sticky product lens on desktop; stacked interactive scenes on mobile.
- Four customer actions with a different UI state for each.
- Output language describes decisions, not records or controls.

### Global approach

- A change path from question to improved market expression.
- Customer progress is the headline of each stage.
- Collaboration details are secondary and compact.

### Global markets

- Interactive market atlas with language/market switching.
- Show that buyer context changes the question and answer.
- Do not imply universal platform or geographic coverage.

### China home

- Hero combines a direct market statement with a live AI Answer Flow.
- Four situations: 搜不到、说不准、竞品更靠前、出海后说法不一致.
- Brand Gap Console demonstrates one complete question-to-action story.
- China/global dual-track capability and a three-field consultation form.

### China product and service

- Product page follows one real customer question through comparison and improvement.
- Service page is organized by customer situation, not team role or company size.
- Each service story states the situation, Yonaris help, customer outcome, and next step.

### Regional contact and privacy

- Global form fields: name, work email, company.
- China form fields: 姓名、电话、公司.
- Inline validation, submitting, success, and retry states.
- Delivery remains server-side; no personal values enter analytics, local storage, or URLs.

## 8. Interaction and accessibility

- Sticky navigation keeps the logo and primary CTA visible.
- Human/Agent switching uses ordinary links and preserves the current topic when possible.
- Interactive scenes are button-controlled and keyboard accessible.
- Hover enhances but never reveals required content.
- Motion timings: 180–260ms for UI state, 500–800ms for chapter entry.
- Reduced-motion preferences remove nonessential animation.
- Desktop scrollytelling becomes a vertical sequence or accordion on small screens.
- Mobile receives a persistent consultation CTA without covering form controls.
- Focus states use the Yonaris orange signal and meet visible contrast requirements.

## 9. Deletion boundary

The following visible systems must not survive in generated Human HTML:

- `global-cinematic`, `zh-decision`, `editorial-stage`, `decision-canvas`;
- old `global-en__*` and `zh-site__*` hero, section, decision, close, and graphic structures;
- old evidence-, parity-, repeat-observation-, and boundary-oriented section IDs;
- old page protagonists and the generic page primitive components;
- customer-visible phrases centered on review status, configured scope, denominators, boundaries, implementation states, demonstration disclaimers, internal ownership, or causal-proof defense.

Only short, necessary privacy and form disclosures are exempt.

## 10. Verification contract

Before release:

- all Human routes render the new generation marker and a page-specific visual scene;
- global and China pages have independently written headings and navigation labels;
- old visual markers and internal-analysis phrases are absent from rendered Human output;
- the removed section returns 404 and is absent from sitemap and machine indexes;
- every header and footer renders the Yonaris logo;
- both forms render exactly three visible lead fields and retain delivery-state behavior;
- all Human/Agent topic links resolve;
- desktop and mobile screenshots are reviewed route by route;
- targeted unit tests, browser smoke tests, production build, and public-output policy checks pass;
- the deployed site is probed after the release workflow completes.

## 11. Regional design principles

- Global enterprise-product pattern — commercial narrative, varied compositions, product scrollytelling, and a consistent CTA.
- China ToB decision pattern — result-first sequence, information density, trust rhythm, and global-service visualization.
- Human/Agent dual-view principle — explicit Human/Agent routes, factual alignment, and visual separation by reading mode.

The rebuild applies these principles through Yonaris's own identity and factual system. It does not copy external copy, brand assets, metrics, illustrations, or interface designs.
