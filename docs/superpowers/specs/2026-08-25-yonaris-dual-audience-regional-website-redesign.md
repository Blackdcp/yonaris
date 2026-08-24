# Yonaris Dual-Audience Regional Website Redesign

**Status:** Approved design baseline pending implementation planning  
**Date:** 2026-08-25  
**Scope:** Global English marketing site, Chinese marketing site, and their Human/Agent companion surfaces

## 1. Decision

Rebuild the complete Yonaris public website as one brand system with two regional narratives and two reading modes.

- The global English edition borrows Bluefish's strengths in enterprise confidence, product architecture, product-led explanation, and meaningful interaction.
- The Chinese edition borrows 智推时代's strengths in market-context framing, decision clarity, delivery certainty, and the connection between Chinese-market understanding and global service capability.
- Both editions use one factual source rendered as a Human experience and an Agent-first fact view, following the strongest structural lesson from DeepLumen.
- Competitor visual identity, wording, claims, metrics, and customer proof are not copied.

This specification supersedes earlier marketing-site direction wherever that direction conflicts with the requirements below. Previously retired public sections remain retired. Restricted legacy terminology and positioning must not appear in public output, internal marketing content, route metadata, generated machine documents, comments, tests, fixtures, or deployment artifacts.

## 2. Non-Negotiable Brand Baseline

Yonaris identity is the starting point for every visual decision.

### Approved assets

- Light surfaces use `/brand/logos/yonaris-wordmark-navy.png`.
- Dark surfaces use `/brand/logos/yonaris-wordmark-white.png`.
- Header, footer, mobile navigation, diagnostic flow, and Agent index use the approved image wordmark rather than a text reconstruction.
- The existing `Logo` component is the shared renderer unless implementation review identifies an accessibility or sizing defect.

### Palette

| Token | Value | Role |
| --- | --- | --- |
| Ink | `#0B1220` | Primary dark surface, primary text, enterprise authority |
| Signal Orange | `#FF6A00` | Primary action, active state, evidence annotation, focus |
| Paper | `#F6F4F1` | Primary reading surface |
| Slate | `#1E2A39` | Secondary text and dark tonal layer |
| Blue Gray | `#2F3E50` | Supporting diagrams and interface depth |
| Stone | `#8A95A3` | Muted metadata |
| Mist | `#DDE2E8` | Rules, quiet fields, and secondary surfaces |

Orange is a signal, not a general background treatment. Competitor palettes, gradients, typography, and signature graphic motifs must not enter the Yonaris system.

## 3. Audience and Emotional Entry Point

The website does not segment its primary story by organizational role. The shared buyer is a person who feels uncertainty about how AI is changing discovery, comparison, recommendation, and brand understanding.

The five primary questions are:

1. Are AI systems recommending us?
2. Are they describing us accurately?
3. Why is a competitor being preferred?
4. Which available sources are shaping the answer?
5. What should we change and test next?

Role-specific examples may appear only after the shared problem is understood. Navigation, homepage modules, and conversion paths must not force a visitor to identify as a marketer, executive, product leader, or another role before seeing relevance.

## 4. Regional Positioning

### 4.1 Global English edition

The global edition presents Yonaris as an enterprise AI market intelligence platform with a reviewable evidence workflow.

**Hero headline:**

> AI is already answering questions about your brand.

**Hero bridge:**

> Know what it says—and what to change.

**Supporting copy:**

> Yonaris shows how AI describes, compares, and recommends your brand, which available sources shape the answer, and which next test deserves attention.

**Primary action:** `Request a diagnostic`  
**Secondary action:** `Explore the product`

Voice is direct, calm, enterprise-grade, and outcome-led. Methodological qualifications appear where they protect truth, not as repeated defensive copy. The edition should feel confident without unsupported scale claims.

### 4.2 Chinese edition

The Chinese edition is independently written for Chinese decision habits. It does not translate the English sentence structure.

**Hero headline:**

> 客户正在先问 AI，再认识你的品牌。

**Supporting copy:**

> 当 AI 开始替客户筛选、比较和推荐产品，品牌是否出现、如何被描述、为什么输给竞争对手，已经成为新的市场问题。Yonaris 帮助企业看清答案、找到依据，并决定下一步应该改变什么。

**Primary action:** `查看品牌在 AI 中的表现`  
**Secondary action:** `了解 Yonaris 如何工作`

The Chinese narrative follows `market change → business consequence → observable evidence → delivery process → result`. It avoids inflated idioms, unexplained category jargon, literal translations, and fear-driven sales language.

Global capability is expressed in context:

> 中国企业面对的已经不只是国内平台。Yonaris 同时观察中国与全球 AI 回答环境，帮助品牌在不同市场中保持清晰、准确且可验证的表达。

## 5. Human and Agent Architecture

The site is not two disconnected websites. It is one fact system with two reading densities and explicit companion routes.

### Route model

- Global Human: `/`, `/product`, `/approach`, `/research`, `/geo`, `/company`, `/diagnostic`, `/privacy`
- Global Agent index: `/agent`
- Global Agent companions: `/agent/product`, `/agent/approach`, `/agent/research`, `/agent/geo`, `/agent/company`, `/agent/diagnostic`, and supporting fact routes where justified
- Chinese Human: `/zh`, `/zh/product`, `/zh/approach`, `/zh/research`, `/zh/geo`, `/zh/company`, `/zh/diagnostic`, `/zh/privacy`
- Chinese Agent index: `/zh/agent`
- Chinese Agent companions mirror the Chinese Human route inventory

Every Human page provides a visible, context-preserving Agent link. Every Agent page links back to its Human counterpart. `Human / Agent` appears in desktop and mobile navigation and in the footer.

### Human experience

Human pages provide brand narrative, visual explanation, product simulation, evidence artifacts, and conversion. Core meaning remains real semantic text and never depends on image recognition, hover, or animation.

### Agent-first fact view

Agent pages remain branded and human-readable but use a denser structure:

1. Page purpose;
2. Yonaris definition and category;
3. Core capabilities;
4. Applicable scenarios;
5. Verifiable facts and evidence fields;
6. Boundaries, unavailable facts, and uncertainty;
7. Direct answers to common questions;
8. Human canonical and related pages;
9. Locale, last verified date, and content owner.

Companion pages declare the corresponding Human canonical. The Agent index and machine discovery documents make the companion graph discoverable without creating competing factual sources.

### Shared factual source

A typed content layer owns identity, capability, evidence policy, boundaries, links, locale availability, and verification metadata. English and Chinese narrative copy is written independently around that shared factual core. Structural parity is required; sentence-level translation parity is not.

## 6. Public Information Architecture

Stable canonical routes remain in place to reduce deployment and search risk.

| Route | Global label | Chinese label | Primary job | Page-specific visual anchor |
| --- | --- | --- | --- | --- |
| `/` | Home | 首页 | Establish the problem, product value, proof model, and next action | Interactive Answer Studio |
| `/product` | Product | 产品能力 | Demonstrate what the product does | Evidence Workbench with module switching |
| `/approach` | How it works | 服务方式 | Explain the operating and delivery process | Scroll-linked evidence path |
| `/research` | Evidence | 研究依据 | Establish measurement credibility | Evidence ledger and annotated record |
| `/geo` | AI Visibility | AI 可见度 | Explain the applied market workflow | Brand-answer-source relationship map |
| `/company` | Company | 关于我们 | Establish purpose, trust, and global service model | Regional service and responsibility map |
| `/diagnostic` | Diagnostic | 品牌诊断 | Convert a qualified visitor | Progressive request and scope preview |
| `/privacy` | Privacy | 隐私说明 | Explain handling in plain language | Restrained supporting-page composition |

Primary global navigation is `Product · How it works · Evidence · Company`. Primary Chinese navigation is `产品能力 · 服务方式 · 研究依据 · 关于我们`. Contextual AI visibility pages remain available through relevant sections and the footer rather than crowding primary navigation.

No still-public route may retain an obviously older shell after a regional release. A release is a complete regional slice, not a homepage-only restyle.

## 7. Page Designs

### 7.1 Home — Interactive Answer Studio

The hero places direct market language and conversion on the left and an interactive, semantic product composition on the right. The approved wordmark is present in the header.

The Answer Studio exposes the five audience questions from Section 3. Selecting one question updates four linked states:

1. AI answer representation;
2. comparison or presence finding;
3. available source evidence;
4. recommended next test.

The initial state communicates the complete idea without interaction. Keyboard controls, touch controls, and reduced-motion behavior are first-class. Demonstration content is visibly labelled and cannot imply live observation, a real customer result, or unsupported coverage.

The homepage sequence is:

1. Hero and Answer Studio;
2. verifiable capability and coverage statement;
3. the five AI-anxiety questions;
4. `Observe → Explain → Act → Measure` globally and `看见 → 判断 → 行动 → 验证` in China;
5. product-module preview;
6. Human/Agent fact-consistency explanation;
7. method, evidence, safety, and responsibility;
8. approved example or clearly labelled demonstration;
9. one strong diagnostic close.

### 7.2 Product — Evidence Workbench

Product modules are Monitoring, Narrative, Sources, and Experiments. Chinese labels are written for clarity rather than kept as untranslated interface jargon.

Changing a module updates one shared workbench rather than revealing generic feature cards. Each state shows its input, observable artifact, interpretation, and possible next action. The workbench provides a static complete state when scripts are unavailable.

### 7.3 How It Works — Evidence Path

The page follows one decision question through scope, observation, evidence inspection, action, and repeat measurement. Desktop may use a pinned or scroll-linked path; mobile becomes a vertical sequence with each artifact adjacent to its explanation.

The Chinese page additionally states what the customer supplies, what Yonaris does, what the customer receives, and where human review occurs.

### 7.4 Evidence — Evidence Ledger

The page shows how a claim earns trust: scope, question, surface, time, denominator where relevant, answer excerpt, available sources, finding, unknowns, and review state. Empty or unavailable fields are explicit and are never filled with invented values.

Research and methodology can be filtered by buyer question, but filtering must not obscure the foundational measurement definitions.

### 7.5 AI Visibility — Relationship Map

The page connects brand facts, AI answers, competitors, available sources, and repeated observation. It defines the applied workflow in plain language and connects it upward to the broader Yonaris product rather than presenting it as an isolated service category.

### 7.6 Company — Trust and Global Service

The global edition emphasizes purpose, operating model, evidence principles, and verified company facts. The Chinese edition explains local-market understanding and global service capability through one concrete service map. Entity, team, office, customer, and certification claims appear only when approved evidence exists.

### 7.7 Diagnostic — Progressive Scope Preview

The visitor enters a brand website, market, language, and decision question. The interface previews the proposed diagnostic scope before submission. It does not claim that an automatic report or universal score has already been generated.

Failure states are honest, preserve entered data locally where safe, and offer retry or a verified business-contact route without placing submitted private data in a URL.

## 8. Visual and Interaction System

The site uses the approved Yonaris identity to create richer compositions without becoming decorative theatre.

### Visual grammar

- Evidence windows for answers, comparisons, sources, findings, and next tests;
- scope fields for market, language, question set, surface, and time;
- evidence paths connecting question to action;
- relationship maps connecting brand, answer, competitor, and source;
- ledgers for reviewable records and boundaries;
- service maps for regional and Human/Agent responsibility.

Every core page has one unique visual protagonist. No two consecutive core sections are text-only. No page repeats the same `headline + paragraph + outlined cards` composition as its dominant rhythm.

### Meaningful interaction

- Homepage question selection updates the Answer Studio;
- Product tabs update one consistent workbench;
- Approach scroll progression advances one evidence path;
- evidence annotations expand through click, tap, keyboard, or focus;
- Human/Agent switching preserves locale and page topic;
- diagnostic steps preserve state and expose validation clearly.

Entrance motion never hides essential content at time zero. There is no continuous ambient animation. Reduced-motion mode preserves every state change without spatial animation.

### Responsive behavior

Mobile is recomposed, not scaled down. Complex desktop figures become progressive vertical narratives, module controls become swipe-safe and keyboard-safe selectors, and all primary actions remain at least 44 CSS pixels high. No primary label requires pinch zoom at 390 CSS pixels.

## 9. Content Standards

### Shared rules

- Lead with a market reality or buyer outcome, then evidence, then method.
- Prefer concrete verbs such as see, compare, inspect, trace, verify, decide, test, and measure.
- Do not repeat caveats in every card; place each boundary beside the claim it qualifies.
- Do not invent customer names, logos, quotes, platform counts, results, locations, certifications, or delivery guarantees.
- Demonstrations are labelled once at the figure boundary and cannot resemble customer proof.
- Every page answers what changed, why it matters, what Yonaris does, what evidence appears, and what the visitor should do next.

### Chinese writing rules

- Use conclusion-first Chinese syntax and short declarative sentences.
- Avoid inflated four-character slogans and empty transformation language.
- Introduce specialist terminology only after the business problem is clear.
- State deliverables, process, and responsibility explicitly.
- Express global capability through concrete market coverage and service behavior rather than a standalone boast.

### English writing rules

- Use confident enterprise language without category theatre.
- Prefer product and outcome vocabulary over repeated methodological defensiveness.
- Keep headlines compact and product modules scannable.
- Use evidence boundaries precisely where claims could otherwise overreach.

## 10. Data Flow and Failure Handling

1. The route manifest defines locale pairs, Human/Agent pairs, navigation, index policy, redirects, and sitemap behavior.
2. Shared factual modules define identity, capabilities, boundaries, verification dates, and evidence metadata.
3. Independent regional narrative modules compose those facts into English and Chinese Human pages.
4. Agent renderers expose the same facts through concise semantic pages and machine documents.
5. Automated parity checks compare required factual fields across each paired Human and Agent route.

If a fact is unavailable, the public surface omits the unsupported block or states the boundary. It never substitutes a placeholder that appears factual. If interaction code fails, every component retains a meaningful default state. If a paired locale or Agent route is missing, the build fails rather than silently linking to the wrong language or topic.

## 11. Agile Release Plan

### Release 1 — Complete global slice

- Restore approved logo assets everywhere in the global shell;
- establish the brand-token and component baseline;
- rebuild every active global core page in Section 6;
- ship `/agent` and all required global Agent companions;
- include the Answer Studio, Product module switcher, Evidence Path, and Human/Agent switching;
- complete desktop, mobile, route, content, and production smoke checks;
- deploy without waiting for the Chinese edition.

### Release 2 — Complete Chinese slice

- ship independently written Chinese content for every core route;
- ship `/zh/agent` and its companion routes;
- add Chinese-market decision framing, delivery clarity, contact path, and global service explanation;
- complete the same visual and machine-parity checks;
- deploy as soon as the regional slice passes.

### Release 3 — Evidence-backed enrichment

- add approved customer proof, report samples, platform coverage facts, and richer product demonstrations only when release-approved evidence exists;
- improve interaction depth without changing the approved information architecture;
- do not delay Releases 1 or 2 while waiting for optional proof assets.

## 12. Verification and Acceptance

### Brand checks

- Approved navy and white wordmarks render in the correct contexts on every Human and Agent shell.
- No header or footer reconstructs the wordmark with text.
- All rendered colors resolve to the approved palette or documented accessible mixtures of those tokens.

### Route and content checks

- Every active public route has a declared regional release state.
- Human/Agent links preserve locale and topic.
- Paired pages share identity, capability, boundary, evidence, and verification facts.
- Navigation, footer, sitemap, canonical relationships, and machine discovery files agree.
- Retired routes and restricted terminology are absent from navigation, content, metadata, generated output, and deploy artifacts.

### Interaction checks

- Answer Studio, Product Workbench, Evidence Path, Human/Agent switching, mobile navigation, and Diagnostic work by mouse, touch, and keyboard.
- Complete meaning is visible with JavaScript unavailable and with reduced motion enabled.
- Form validation, success, delivery failure, and retry states are truthful.

### Visual QA

Inspect every core Human page and representative Agent pages at:

- 1440 × 900;
- 1024 × 768;
- 390 × 844;
- 320 × 740 for navigation and diagnostic paths.

Visual acceptance requires a distinct page-specific visual anchor, no horizontal overflow, readable interface labels, consistent brand identity, and no old-shell island inside a released region.

### Targeted technical verification

- marketing-site content and route tests;
- Human/Agent parity tests;
- TypeScript check for the marketing package;
- marketing-site production build;
- focused Playwright core-route and interaction suite;
- production smoke over all released HTML routes, redirects, local assets, language pairs, and Agent endpoints.

## 13. Out of Scope

- Redesigning the authenticated product application beyond public entry consistency;
- inventing customer evidence, pricing, coverage guarantees, or company facts;
- changing the Yonaris wordmark or approved palette;
- reopening retired publication sections;
- creating separate, independently maintained Human and Agent content stores;
- delaying a complete regional release for optional advanced animation or unavailable proof assets.

## 14. Definition of Done

The redesign is complete when:

1. every active global and Chinese public page uses the approved Yonaris logo, palette, shell, and content standards;
2. each core page has a distinct job, visual anchor, and meaningful interaction or evidence artifact;
3. English and Chinese read as independently authored regional editions;
4. the site addresses AI anxiety before optional role-specific detail;
5. every Human page has an accurate Agent companion and both derive from one factual source;
6. no released region contains a homepage-only redesign or an old-shell inner page;
7. all approved route, content, interaction, visual, build, and production checks pass;
8. the global slice is deployed first and the Chinese slice follows as the next complete release.

## 15. Reference Sites and Borrowing Boundary

- Bluefish: <https://www.bluefishai.com/> — enterprise hierarchy, platform architecture, and product-led interaction only.
- 智推时代: <https://www.zhituishidai.com/> — Chinese-market framing, delivery clarity, and global-service narrative only.
- DeepLumen: <https://www.deeplumen.com/> and <https://www.deeplumen.com/agent/> — explicit Human/Agent relationship and machine-first companion structure only.

Yonaris retains its own identity, product truth, visual language, and evidence standards throughout.
