# Yonaris Full-Site Rebuild Design

> Historical record: supporting, publication, documentation, and distribution routes proposed here were retired on 2026-08-24. Neutral placeholder identifiers below do not represent current routes or the current private operating model.

**Status:** Approved direction, implementation specification
**Date:** 2026-08-22
**Base:** `codex/homepage-product-stage` at `3ca34a8`
**Scope owner:** Yonaris public website (`apps/www`)

## 1. Objective

Rebuild `yonaris.com` as one coherent bilingual acquisition and product-exposure system for a global AI-native MarTech company.

The finished site must:

- explain Yonaris in five seconds without reducing it to a GEO utility;
- show what the company can actually do today without presenting an unfinished product as a mature self-serve SaaS;
- turn qualified interest into a reliably delivered free diagnostic request;
- give Product, Approach, Research, Company, GEO, and Diagnostic distinct jobs, content, visuals, and interactions;
- give people and agents the same canonical facts;
- resolve the current conflict between the new Yonaris marketing site and the predecessor-era website;
- preserve useful documentation and content without allowing legacy material to redefine the company.

The approved homepage Product Stage is a starting component, not the project boundary.

## 2. Current-State Findings

The repository currently exposes two sites on one domain:

1. Six bilingual Yonaris marketing route pairs using `MarketingShell`.
2. More than sixty route patterns using an older Navbar/Footer and predecessor-oriented content.

The audit found 164 public predecessor-brand references, a sitemap that lists only the new marketing routes while robots permits the entire legacy tree, and two unrelated navigation systems.

The portal is not a mock shell. Current production code supports:

- isolated customer workspaces and roles;
- brand identity, domains, aliases, competitors, Programs, and tracked prompts;
- configured answer sampling and operator-managed consumer-surface collection;
- mention-rate visibility, configured-cohort share of voice, citations, and exposed query fan-out;
- drill-down to individual responses and, on supported surfaces, archived evidence;
- operator-generated, human-reviewed opportunity recommendations.

It does not currently support a customer-facing Product Truth Graph, CRM or revenue feedback loop, autonomous remediation, causal attribution, universal real-time coverage, or complete public self-service onboarding. Reports and execution remain primarily operator-managed.

## 3. Positioning and Truth Model

### Category

**AI-native MarTech**

### Vision

**MarTech, rebuilt. For humans and agents.**

### Current product promise

**Make AI market answers observable.**
Yonaris captures how configured AI systems answer defined market questions and turns those samples into reviewable evidence: exact responses, brand and competitor mentions, cited sources, and provider-exposed search queries.

### GEO boundary

GEO is Yonaris's first applied workflow: observing and improving how AI systems discover, describe, compare, and recommend a brand. It is not the company's category ceiling.

### Claim statuses

Every externally visible product claim belongs to exactly one status:

- `current-software`: implemented customer-visible capability;
- `managed-delivery`: implemented but operated or reviewed by the Yonaris team;
- `verified-evidence`: supported by a publishable evidence pack;
- `illustrative`: simulated or explanatory and visibly labelled;
- `direction`: future intent, never written in present tense.

The status is represented in the content model and tests, even when the UI expresses it with natural language rather than badges.

### Prohibited claims

The public site must not claim:

- an implemented Product Truth Graph or Commercial Feedback product module;
- automatic content fixes, publishing, continuous agentic optimization, or causal lift attribution;
- real-time, universal, or all-model coverage;
- self-service workspace creation, report generation, or automated runs;
- an instant scan or score after submitting the diagnostic form;
- that unavailable citations or query fan-out prove no search occurred;
- the `0% → 93.3%` anonymous outcome until a publishable evidence pack is included in the repository and approved for release.

## 4. Information Architecture

### Primary bilingual site

| Navigation | English canonical | Chinese canonical | Responsibility |
| --- | --- | --- | --- |
| Home | `/` | `/zh` | Category, value, product proof, method preview, research preview, conversion |
| Product | `/product` | `/zh/product` | Current software, managed delivery, inputs, outputs, boundaries |
| Approach | `/approach` | `/zh/approach` | Repeatable evidence loop and Recursive Forest working method |
| Research | `/research` | `/zh/research` | Measurement definitions, evidence records, public findings, limitations |
| Company | `/company` | `/zh/company` | Category thesis, company stage, principles, Yonaris/removed-distribution-route relationship |
| GEO | `/geo` | `/zh/geo` | High-intent applied workflow without redefining the company |
| Diagnostic | `/diagnostic` | `/zh/diagnostic` | Offer scope, request flow, delivery expectations, submission |

Primary navigation contains Product, Approach, Research, and Company. GEO appears contextually in Product and the footer. The single persistent primary action is Get a Free Diagnostic / 获取免费诊断. A restrained `Portal` utility link appears in the desktop header and mobile menu, visually secondary to the diagnostic action.

### Resource and utility site

| Route | Policy |
| --- | --- |
| `/resources` | New index for Research Notes, Docs, Glossary, Status, Brand, and removed-distribution-route |
| `/removed-distribution-route` | New page explaining the removed-distribution-route infrastructure, upstream identity, license, and its relationship to Yonaris |
| `/docs/**` | Retain functionality; wrap with a branded utility header and explicit removed-distribution-route Documentation context |
| `/status` | Retain operational functionality; migrate to branded utility shell |
| `/brand` | Retain assets; migrate to the shared visual system |
| `/changelog` | Retain only as an removed-distribution-route product resource; migrate shell |
| `/blog/**` | Keep accessible in a new publication shell; temporarily `noindex` until each article passes identity and fact review |
| `/glossary/**` | Keep accessible in the publication shell; temporarily `noindex` until reviewed |
| `/ai-search/**` and `/aeo-for/**` | Keep accessible as a clearly labelled legacy research archive; temporarily `noindex` |
| `/ai-visibility-tools/**` | Keep accessible only as a predecessor comparison archive; add archive context and `noindex` |

### Redirects

Permanent redirects preserve links while eliminating duplicate company pages:

- `/platform` and `/features` → `/product`
- `/zh/platform` → `/zh/product`
- `/methodology` → `/approach`
- `/zh/methodology` → `/zh/approach`
- `/results` → `/research`
- `/zh/results` → `/zh/research`
- `/vision` → `/company`
- `/pricing` → `/diagnostic`
- `/off-site-aeo` → `/geo`
- homepage `#company` links → `/company` or `/zh/company`

The old paths remain out of the sitemap after redirects are installed.

## 5. Shared Visual System

### Binding VI palette

- Ink `#0B1220`
- Paper `#F6F4F1`
- Slate `#1E2A39`
- Stone `#8A95A3`
- Mist `#DDE2E8`
- Signal Orange `#FF6A00`
- Secondary Blue Gray `#2F3E50` only when a second dark level is necessary

No gradients, AI-neon effects, glassmorphism, or unapproved accent colors. Orange identifies actions, active evidence, and focus; it is not background decoration.

### Typography and layout

- Geist Sans remains the licensed, available UI/display face until an Aeonik license and web files exist.
- Chinese uses the existing CJK system fallback with locale-specific line breaking and no mechanical English tracking values.
- Core pages use a maximum content width of 90rem and a consistent 12-column desktop grid.
- Resource reading layouts use a narrower 68–76ch measure.
- Mobile is independently composed. Desktop canvases are never scaled or cropped into mobile layouts.

### Page-specific art direction

The pages share tokens and interface discipline, not one repeated template:

- **Home — Product Stage:** retain the approved outcome-led hero and diagnostic preview; replace the generic sections below it with a shorter product → method → research → diagnostic narrative.
- **Product — Evidence Workbench:** a large code-native product surface with Scope, Answer, Sources, and Next Test views. The data is illustrative and labelled. Copy beside each state maps to current software or managed delivery.
- **Approach — Evidence Loop:** a pinned, keyboard-operable sequence that follows one market question through scope, question set, sampling, evidence inspection, bounded intervention, and repeat observation.
- **Research — Research Ledger:** an editorial measurement surface with scope, date, sample count, metric denominator, redacted answer evidence, findings, and unknowns. It must look like an auditable record, not a dashboard scorecard.
- **Company — Category Thesis:** restrained typography and deliberate negative space. It explains the market shift, company thesis, present stage, operating principles, and removed-distribution-route relationship without product cards or invented social proof.
- **GEO — Applied Workflow:** a direct high-intent page mapping discovery, description, comparison, citation, and verification to the broader market-evidence system.
- **Diagnostic — Working Session:** a progressive request flow with clear deliverables and operational trust, not a generic contact form.
- **Resources — Publication System:** consistent masthead, taxonomy, metadata, reading progress, and related content; no generic SaaS cards.

### Motion

- At most one meaningful interactive or motion system per core page.
- Entrance motion never hides essential content at time zero.
- No continuous ambient animation.
- All behavior respects `prefers-reduced-motion` and remains understandable without animation.

## 6. Page Contracts

### Home

The homepage answers, in order:

1. What category is Yonaris and why does it matter now?
2. What observable problem does it solve?
3. What can a buyer see in the product today?
4. How does the evidence loop work?
5. What public evidence or methodology can be inspected?
6. What happens when a visitor requests a diagnostic?

The approved hero remains. The four intelligence foundations and unaudited outcome statistic are removed from the main narrative. Below the hero, one compact product proof links to Product, one evidence-loop preview links to Approach, one research record links to Research, and one full-width diagnostic offer closes the page.

### Product

Headline contract:

> Make AI market answers observable.

The workflow is presented as four activities, not four products:

1. **Define the scope** — brand identity, competitor cohort, market, language, timezone, and tracked questions.
2. **Observe the answer** — repeated samples through configured providers and managed consumer-surface workflows.
3. **Inspect the evidence** — mention-rate, configured-cohort share of voice, individual responses, citations, and exposed query rewrites.
4. **Choose the next test** — human-reviewed, evidence-grounded opportunities.

The page includes a visible coverage disclosure: availability depends on the configured Program and some surfaces do not expose sources or search queries.

It includes a clear split between Customer workspace and Yonaris-operated execution so visitors understand the managed product stage.

### Approach

Headline contract:

> A repeatable evidence loop, not a generic score.

Steps:

1. Frame one market and one decision question.
2. Build a reviewed branded and non-branded question set.
3. Sample named AI surfaces under a declared scope.
4. Compare mentions, competitor share, citations, and available fan-out.
5. Inspect underlying answers before drawing conclusions.
6. Make a bounded intervention and repeat the same defined test.

The page states that repeated observation shows change over time but does not independently prove causation. Recursive Forest is described as a working method, not an already implemented graph architecture.

### Research

Headline contract:

> Every finding should show its scope.

V1 contains:

- a plain-language measurement design;
- exact definitions and denominators for visibility and share of voice;
- one clearly labelled illustrative evidence record containing question, surface, date, answer, citations, exposed queries, and known/unknown states;
- guidance for before/after cohort comparison;
- a prominent non-causality limitation.

No unverified customer result, logo, quote, or anonymized statistic is published. The page can later accept verified evidence packs through the content model without redesign.

### Company

The page contains:

- AI-native MarTech category and `MarTech, rebuilt. For humans and agents.` vision;
- the shift from human-only journeys to AI-mediated discovery, comparison, and selection;
- the current company stage: an early, service-led product with a real evidence platform;
- the Yonaris / Recursive Forest brand thesis in a concise form;
- operating principles: evidence over theatre, declared scope, human review, and durable product truth;
- an explicit explanation that retired implementation details are not the Yonaris company identity;
- contact and diagnostic actions.

It does not invent locations, team biographies, investors, customers, security certifications, or funding status.

### GEO

The page captures GEO-intent search demand while moving the visitor upward into the broader category. It explains:

- when a brand enters an answer;
- how it is described and compared;
- which exposed sources shape the answer;
- what can be changed and retested;
- why the same evidence system extends beyond GEO.

It never promises rankings, traffic, universal visibility, or automated optimization.

### Diagnostic

Offer contract:

> Give us one brand, one market, and one question that matters. Yonaris confirms the measurement scope before collecting evidence.

The flow has two compact stages:

1. Website, brand, market/category, and one decision question.
2. Competitors, name, work email, consent/disclosure, and review.

The visitor sees the likely output before submitting: a scoped baseline, selected answer/source evidence, the clearest gaps, and three next tests, subject to confirmation by the Yonaris team.

Submission uses a same-origin server endpoint and Resend. Required runtime values are:

- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `MARKETING_LEAD_RECIPIENT`, configured as `black.dcp@outlook.com` in production

The endpoint validates with a shared schema, rejects the honeypot field, checks same-origin requests, applies a coarse per-IP process rate limit, and sends no submitted data to client analytics. On success the UI presents an explicit confirmation. On configuration or delivery failure it presents an honest error and a prefilled email fallback; it never displays a false success state.

A concise `/privacy` page documents the diagnostic fields collected, email delivery, purpose, and contact route. No retention duration or legal promise is invented.

## 7. Human and Agent Parity

One structured content source generates the factual core for both surfaces.

Machine-facing deliverables:

- `/agent` indexes all core human pages, both locales, and machine documents.
- `/agent/company`, `/agent/product`, `/agent/approach`, `/agent/research`, `/agent/geo`, and `/agent/diagnostic` provide scoped English Markdown.
- Chinese human routes are listed with language metadata in `/llms.txt` and `/llms-full.txt`.
- Every core human canonical supports negotiated `Accept: text/markdown`, matching the content-negotiation mechanism already used by the site. Tests compare its factual fields and limitations with the corresponding HTML page and Agent document.
- Each machine document states its human canonical, locale availability, last verified date, current scope, and limitations.
- Sitemap and hreflang are generated from the same site manifest rather than hand-maintained arrays.

Important content remains real text in the human HTML. Agent parity does not mean hiding the primary claims inside screenshots or JSON-LD.

## 8. Component and Data Architecture

### Site manifest

A typed manifest becomes the authority for:

- route key and class (`core`, `resource`, `utility`, `legacy`, `machine`);
- English and Chinese canonical paths;
- navigation presence;
- index policy;
- redirects;
- agent document mapping;
- sitemap priority and actual last-verified date.

Navigation, footer, sitemap, hreflang, Agent index, and llms files consume this manifest.

### Content model

Split the current monolithic marketing content into focused bilingual modules:

- global/category content;
- product;
- approach;
- research;
- company;
- GEO;
- diagnostic;
- resource navigation.

Each module exports a typed English source and an independently written Chinese equivalent. Tests enforce structural parity but not word-for-word translation.

### Shells

- `SiteShell`: core bilingual pages.
- `PublicationShell`: Blog, Glossary, AI Search, and AEO articles.
- `UtilityShell`: Docs, Status, Brand, and Changelog.
- `LegacyArchiveContext`: explicit predecessor context for unreviewed comparison content.

The old Navbar and Footer become compatibility wrappers around shared header/footer primitives so every reachable public page immediately presents Yonaris consistently.

### Page composition

Core pages use page-specific components, not one `DetailPage` template with swapped strings. Shared primitives are limited to the site shell, section container, CTA, typography, evidence metadata, and accessibility behavior.

## 9. SEO and Legacy Governance

- Only approved core, utility, and reviewed resource URLs enter the sitemap.
- Temporary legacy and unreviewed resource pages receive `noindex,follow` and remain out of the sitemap.
- Redirected routes emit real permanent redirects rather than canonical-only hints.
- Sitemap includes reciprocal English/Chinese alternates for core pages and real last-verified dates.
- Organization and WebSite structured data use Yonaris only.
- Retired archive pages identify predecessor material without presenting it as the company.
- No route keeps old blue navigation, Docs-first CTA, or predecessor company footer.

## 10. Accessibility, Responsive Behavior, and Performance

- WCAG AA contrast for all normal text and controls.
- Keyboard-operable header, menus, Workbench tabs, Evidence Loop, and form.
- Visible focus treatment using Signal Orange without turning body copy orange.
- Semantic landmarks, one H1 per page, logical heading order, labelled figures, and live regions for form status.
- No horizontal overflow at 320, 360, 390, 768, 1024, 1280, and 1440 CSS pixels.
- Core content remains visible before, during, and after entrance motion and with reduced motion.
- Illustrative product surfaces use HTML/CSS rather than heavyweight screenshots where interaction or text accessibility matters.
- Decorative images are lazy-loaded; the hero's primary text and action do not wait on imagery.
- Existing docs/status functionality and content negotiation remain operational.

## 11. Verification and Acceptance

### Content and truth tests

- Route manifest has unique canonicals, complete bilingual pairs, and valid redirect targets.
- Human and Agent documents derive from the same factual modules.
- Prohibited claims and the unaudited `0% → 93.3%` result are absent from core marketing output.
- All illustrative surfaces expose a visible `Illustrative` / `示例` label.
- Legacy pages have the expected redirect, archive context, or `noindex` policy.

### Interaction tests

- Primary navigation reaches real pages and preserves locale.
- Mobile navigation is keyboard accessible and closes predictably.
- Product Workbench and Approach Evidence Loop work with mouse, keyboard, and reduced motion.
- Homepage domain handoff prefills the diagnostic in both languages.
- Diagnostic validation fails before network submission, a successful server response shows confirmation, a failed response shows the email fallback, and no configuration produces a fake success.
- Core Markdown/Agent routes expose canonical and limitation metadata.

### Visual QA

Capture and inspect every core page in English and Chinese at:

- desktop 1440×900;
- tablet 1024×768;
- mobile 390×844;
- narrow mobile 320×740 for critical conversion paths.

The QA set includes full-page captures and interaction-state captures for Product, Approach, and Diagnostic.

### Regression suite

- `pnpm.cmd --filter @workspace/www test`
- `pnpm.cmd --filter @workspace/www check-types`
- `pnpm.cmd --filter @workspace/www build`
- dedicated `playwright.www.config.ts` core-site suite
- production marketing smoke that follows redirects, validates both locales, requests every local HTML asset, verifies machine endpoints, and exercises diagnostic failure behavior without sending a real email

## 12. Out of Scope

- Changing `apps/web`, worker sampling, database schema, or portal authorization.
- Inventing a Product Truth Graph, CRM integration, billing flow, customer self-service, or autonomous execution.
- Rewriting every legacy Blog, Docs, Glossary, or comparison article in this release. They are governed through the new shell and index policy until reviewed.
- Publishing customer names, logos, quotes, security claims, or the anonymous outcome statistic without a release-approved evidence pack.
- Adding pricing before stable public commercial terms exist.
- Replacing the Yonaris wordmark or VI palette.

## 13. Definition of Done

The project is complete only when:

1. every public URL is assigned to the new core, publication, utility, redirect, or legacy-archive system;
2. every core English page has a complete Chinese counterpart;
3. Product, Approach, Research, Company, GEO, and Diagnostic each have a distinct visual and interaction model;
4. the diagnostic request reaches the configured recipient or reports an honest failure with fallback;
5. no reachable page presents the predecessor as the Yonaris company or uses the old Docs-first navigation;
6. sitemap, hreflang, Agent documents, and llms files agree with the human site;
7. all automated checks and the complete multi-viewport visual QA pass;
8. the final branch receives a clean independent whole-site review.
