# Yonaris Marketing Site V2 Design

## Objective

Rebuild yonaris.com into a bilingual lead-generation and category-building site for an early-stage AI-native MarTech company. The site must explain the current commercial product truthfully, establish a category larger than GEO, make Yonaris legible to both people and agents, and convert qualified visitors into free diagnostic requests.

## Positioning

- Company category: **AI-native MarTech**.
- Brand thesis: **MarTech, rebuilt. For humans and agents.**
- Current commercial entry point: GEO and AI-market perception diagnosis.
- Long-term direction: a marketing system that learns from product truth, market intent, model intelligence, and commercial feedback.
- The four intelligence labels are data foundations, not four products.
- Recursive Forest is Yonaris's methodology and technical architecture, not a second product brand.
- The site must not describe roadmap capabilities as available products.
- The site must not limit Yonaris to B2B. The current proof can come from complex buying decisions without defining the total addressable category.

## Audience and Conversion

Primary audiences are marketing leaders, brand leaders, founders, and innovation teams trying to understand how AI systems affect discovery and buying decisions. Secondary audiences are analysts, investors, partners, search engines, and autonomous agents.

The single primary conversion is **Get a Free Diagnostic / 获取免费诊断**. The diagnostic collects:

- brand name;
- website;
- market or category;
- known competitors;
- one important question the visitor expects AI to answer;
- contact name and email.

V1 prepares a complete email addressed to `black.dcp@outlook.com` and explicitly tells the visitor that their email client will open and that nothing is sent until they send it. The site must never display a false success state or imply that a lead was stored when it was not.

## Information Architecture

English is the default at `/`; Chinese lives under `/zh`. Every core English page has a Chinese counterpart and reciprocal `hreflang` metadata.

### Human pages

| English | Chinese | Purpose |
| --- | --- | --- |
| `/` | `/zh` | Category, product story, proof, and conversion |
| `/platform` | `/zh/platform` | What Yonaris can do today |
| `/methodology` | `/zh/methodology` | Recursive Forest and the evidence loop |
| `/results` | `/zh/results` | A real, anonymized engagement and measured outcomes |
| `/geo` | `/zh/geo` | GEO as the current entry point, not the company boundary |
| `/diagnostic` | `/zh/diagnostic` | Free diagnostic request flow |

Existing documentation, status, blog, glossary, and legacy discovery pages remain reachable but are removed from the primary marketing navigation. No new pricing, customer-logo, or solution pages are created.

### Agent pages

- `/agent` is a sparse human-visible index explaining that Yonaris publishes the same facts in an agent-oriented form.
- `/agent/company`, `/agent/platform`, `/agent/methodology`, and `/agent/results` return concise Markdown with canonical human URLs, bilingual aliases, evidence scope, and last-updated metadata.
- `/llms.txt` becomes the concise agent index for the new company and product truth.
- `/llms-full.txt` is generated from the same structured marketing content instead of inherited documentation copy.
- `robots.txt`, `sitemap.xml`, JSON-LD, canonical URLs, and language alternates make the relationship explicit.

## Shared Content Model

All new human and agent pages consume a typed, bilingual source in `apps/www/src/lib/marketing-content.ts`. The source owns:

- locale-aware navigation and calls to action;
- the company definition and category;
- the hero thesis;
- four current capabilities: Observe, Explain, Improve, Verify;
- the intelligence loop and its four data foundations;
- Recursive Forest methodology steps;
- the current GEO entry-point explanation;
- anonymized engagement facts and results;
- diagnostic labels and disclosure copy;
- agent page descriptions and last-updated date.

Shared content prevents translation drift and prevents agent pages from making claims not visible on the human site.

## Page Design

### Global shell

The header contains the Yonaris wordmark, Platform, Methodology, Results, GEO, Agent View, a language switch, and the diagnostic CTA. On mobile, navigation opens as a simple full-width list with no nested menus. The footer contains the category definition, core routes, direct contact email, legal copyright, and the signature “Finite truths. Recursive growth.”

### Homepage

1. **Hero — category and thesis.** Ink background. Eyebrow: “AI-NATIVE MARTECH”. Headline: “MarTech, rebuilt. / For humans and agents.” Supporting copy: “Yonaris helps brands understand and improve how they are discovered, interpreted, compared, and chosen in an AI-mediated market.” Primary CTA: free diagnostic. Secondary text link: Agent View.
2. **The new market surface.** Paper background. Explain that discovery, comparison, and shortlisting increasingly happen inside AI-mediated journeys before a traditional click.
3. **What Yonaris does now.** Four editorial columns: Observe, Explain, Improve, Verify. These are operating capabilities, not product SKUs.
4. **The intelligence foundation.** Show Product Truth, Market Intent, Model Intelligence, and Commercial Feedback as a connected learning loop, explicitly labeled as foundations rather than products.
5. **Method.** Explain the Recursive Forest sequence: establish product truth, generate real market questions, observe multi-model responses and sources, improve gaps, and repeat the same tests.
6. **Evidence.** Present the anonymized engagement from the product introduction: 6 entities, 30 fact cards, 24 buying questions, 8 platforms, and 768 answer samples. Only verified outcome numbers from the supplied materials may appear.
7. **GEO entry point.** Heading: “Starting with GEO. Built for what comes next.” Explain that GEO is the first commercial application of the broader system.
8. **Diagnostic close.** Ink background with expected diagnostic output and a direct route to the request form.

### Supporting pages

Supporting pages reuse the same shell and visual language. Each has one job and one conversion path. Platform focuses on current capabilities. Methodology focuses on the evidence loop. Results focuses on the one verified engagement. GEO captures high-intent search demand without redefining the company. Diagnostic contains the transparent email-preparation form.

## Visual System

The supplied Yonaris identity board is the governing reference.

- Ink `#0B1220`
- Paper `#F6F4F1`
- Slate `#1E2A39`
- Stone `#8A95A3`
- Mist `#DDE2E8`
- Signal Orange `#FF6A00`
- Optional Blue Gray `#2F3E50`

The homepage uses an Ink hero and Paper editorial sections. Signal Orange stays below approximately three percent of the visible color area and marks evidence, focus, and primary action only. No purple-blue AI gradients, glassmorphism, glowing orbs, robots, particles, dashboard theatre, or unsupported customer logos appear.

Structured Paths are the primary graphic language. Lines begin as separate facts, converge through conditions and context, and exit as clearer evidence or action. Orange evidence anchors and short white condition markers are sparse and meaningful. Motion runs once on entry and respects `prefers-reduced-motion`.

Typography uses the available Geist Sans and Geist Mono assets, with `PingFang SC`, `Microsoft YaHei`, and system fallbacks for Chinese. Display text is tightly composed but Chinese punctuation and phrases must not produce orphan characters. The layout uses a 12-column desktop grid, restrained 1px rules, minimal radius, and generous negative space.

## SEO and Agent Contracts

- Default English pages and `/zh` counterparts declare canonical and reciprocal language-alternate links.
- Each core page has localized title, description, Open Graph locale, and structured data.
- Organization schema describes Yonaris as an AI-native MarTech company. It does not claim product maturity, pricing, awards, or customers that are not public.
- `sitemap.xml` includes every new human and agent route.
- Agent Markdown includes a canonical human URL and a visible statement of current scope.
- The current `llms.txt` wording that defines Yonaris as a self-hosted AI visibility platform is removed.

## Accessibility and Performance

- Text and interactive controls meet WCAG AA contrast.
- Focus states are visible on Ink and Paper backgrounds.
- Tap targets are at least 44px.
- Navigation, language switching, forms, and disclosures work with keyboard and screen readers.
- Hero motion is decorative and disabled under reduced-motion preferences.
- The marketing image build must serve every local CSS, JS, font, image, manifest, and icon referenced by the rendered HTML.
- The site avoids additional client-heavy visualization libraries and renders the brand paths as lightweight inline SVG.

## Verification

- Unit tests validate bilingual route parity, agent content derivation, the diagnostic email payload, and sitemap entries.
- Type checking and the production Vite build must pass.
- The release smoke test must assert the new hero copy, both locales, agent endpoints, diagnostic route, and all same-origin assets.
- Desktop and mobile screenshots must be visually inspected at 1440×900, 390×844, and 320×700.
- Production verification must check `https://yonaris.com/`, `/zh`, `/agent`, `/llms.txt`, and `https://portal.yonaris.com/` after deployment.
