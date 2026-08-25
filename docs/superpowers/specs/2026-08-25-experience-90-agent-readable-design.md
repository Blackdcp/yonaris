# Yonaris 90-Point Experience and Agent-Readable Website Design

## Objective

Upgrade the released Global and China websites from a visually coherent but lightly evidenced experience into a credible, high-fidelity enterprise website, while making the Agent surface reliably discoverable and machine-readable.

This release keeps the current regional route map and brand foundation. It changes the quality of the experience: proof, interaction detail, regional narrative, machine contracts, and verification.

## Non-negotiable constraints

- Global and China remain independently written editions, not translations.
- Human and Agent surfaces remain paired for all seven topics in both locales.
- The Yonaris wordmark and Signal Orange `#ff6a00` remain primary brand assets.
- Public output must not mention internal research references, implementation ancestry, prohibited origin/licensing language, or build-process commentary.
- No customer logos, performance figures, coverage counts, response-time promises, certifications, or case-study claims may be invented.
- Global lead fields remain name, work email, and company. China lead fields remain name, phone, and company.
- Retired publication and internal paths remain unavailable.
- The release is complete only after production deployment and live-domain verification.

## Verified baseline

The current release already provides server-rendered Human and Agent HTML, localized routes, bidirectional Human/Agent links, `Accept: text/markdown` negotiation, `llms.txt`, `llms-full.txt`, responsive layouts, branded code-native scenes, semantic navigation, form validation, and a reduced-motion baseline.

The gaps are specific:

1. Global scenes look polished but behave more like conceptual illustrations than decision artefacts.
2. The first 1.5 screens do not contain enough verifiable product evidence or procurement reassurance.
3. Mobile metadata and scene labels are too small.
4. Interactive tabs do not implement the complete keyboard tab pattern.
5. China copy is cautious to the point of understating business value and does not sound native to Chinese internet and ToB decision culture.
6. Agent pages can be fetched, but discovery links, stable Markdown URLs, structured entity data, fact identity, scope, and response negotiation are incomplete.
7. Several valid or harmless `Accept` variants and trailing-slash combinations can produce a 5xx response.

## Chosen approach

Use an evidence-led experience upgrade rather than surface polish or another route-level rebuild.

- Keep the current regional shells and route inventory.
- Replace abstract/repetitive chapters with inspectable decision artefacts and explicit output boundaries.
- Add restrained, state-driven motion that explains changes in the active scene.
- Rewrite the China edition around business-entry language and Chinese ToB purchase logic.
- Promote Agent content into a typed fact catalogue rendered consistently as HTML, Markdown, and JSON-LD.
- Keep Human pages as the search canonicals. Agent and machine representations remain crawlable and linked, but do not compete with Human pages in search results.

## 90-point acceptance model

The score is a release rubric, not an automated scientific measurement.

| Dimension | Weight | Baseline | Release target |
| --- | ---: | ---: | ---: |
| Positioning and first-screen value | 15 | 10 | 14 |
| Trust, evidence, and buying confidence | 15 | 5 | 14 |
| Product comprehension and actionability | 15 | 9 | 14 |
| Visual hierarchy and system coherence | 15 | 13 | 15 |
| Information architecture and conversion | 10 | 8 | 9 |
| Responsive reading quality | 10 | 8 | 9 |
| Interaction and motion quality | 10 | 5 | 7 |
| Accessibility and performance resilience | 10 | 7 | 8 |
| **Total** | **100** | **65** | **90** |

The target requires all of the following observable outcomes:

- Within 1.5 screens of each homepage, visitors encounter a concrete review artefact or factual description of what a review contains.
- Product pages show one end-to-end path from question to answer evidence to review priority to recheck.
- All scene tabs support click, focus, ArrowLeft/ArrowRight, Home, and End.
- Active scene content has a meaningful 180–280ms transition and a reduced-motion equivalent.
- Mobile functional text is at least `0.75rem`; mobile body text is at least `0.875rem` with at least `1.4` line height.
- All interactive targets are at least 44×44 CSS pixels at mobile sizes.
- No horizontal overflow at 390, 768, 1024, and 1440 CSS pixels.
- Agent requests never return 5xx for valid `Accept` headers or harmless trailing slashes.

## Global experience design

### Homepage

The homepage keeps the large editorial proposition and answer-field composition. The scene becomes a decision artefact:

- Each selected buyer question changes the answer excerpt, brand presence, comparison frame, visible citations, and next review action.
- The active state is visually connected through one signal path, not only changed text.
- Immediately after the hero, an evidence rail states what every scoped review contains: selected question, complete answer, brand and alternatives, visible citations, and a next-review item.
- The five anxiety states remain, but their cards gain clearer focus/hover hierarchy and no longer carry unreadably small labels.
- Conversion language converges on one promise: request a focused AI-answer review.

### Product

The existing four-stage lens becomes a complete walkthrough:

1. Observe the selected answer.
2. Compare the brand and alternatives.
3. Review visible citations and information gaps.
4. Recheck the same scope and inspect changes.

Each stage exposes an input, evidence, decision, and next action. The secondary text-card wall becomes one coherent decision record.

### Approach, markets, company, and contact

- Approach shows the exact input and output of every stage.
- Markets changes examples when language, category, and alternative lenses change.
- Company provides procurement reassurance through verifiable working boundaries rather than invented proof: scoped questions, full-answer review, explicit market context, and repeatable checks.
- Contact explains what the first conversation determines and what the visitor does not need to prepare. The form stays at three visible fields.

### Motion and detail system

- Add a thin brand-orange scroll progress signal.
- Animate only state changes and meaningful signal paths.
- Use a shared easing curve and duration tokens.
- Give active panels a short opacity/translate transition and route lines a short draw transition.
- Enhance hover/focus states with depth, border, and signal movement; never hide meaning behind hover.
- Preserve a fully static, immediately legible reduced-motion state.

## China experience and narrative

### Narrative model

Every core section follows one Chinese ToB sequence:

`客户的新入口 → 可能损失的生意判断 → 可以核对的证据 → 一次摸底会得到什么 → 下一步优先级`

The edition uses familiar internet-business language without becoming a jargon wall. Useful phrases include AI 搜索入口、候选池、品牌心智、答案位、竞品对标、掉点、品牌摸底、优先级、复盘 and 出海本地化. A screen may use one or two such terms; the surrounding sentence must explain the concrete meaning.

The edition must not promise rankings, traffic, recommendation outcomes, universal platform coverage, or automatic changes to third-party answers.

### Homepage story

1. Hero: “客户开始问 AI，品牌的第一解释权还在你手里吗？”
2. Lead: define Yonaris as an AI brand-performance diagnostic view, then name the four questions: entering the shortlist, accurate selling points, competitive framing, and cross-market positioning.
3. Risk chapter: 没进候选池 / 核心卖点被说偏 / 竞品占了答案位 / 出海后定位漂移.
4. Evidence chapter: 问题范围 / 答案快照 / 竞品差距 / 优先级清单.
5. Market chapter: “出海不是翻译官网，而是重做一遍当地品类心智。”
6. CTA: “预约一次 AI 品牌摸底”.

### Product and service story

- Product headline: focus on why a brand fails to enter the shortlist, not on generic exposure.
- Product stages: 圈定问题 / 拆答案 / 找掉点 / 做复盘.
- Product output: a reviewable artefact a team can use in a meeting, not an unexplained score.
- Service headline: “先做品牌体检，再定 GEO 打法。” The first GEO mention explains it as brand performance in generative search/AI answers.
- Service routes are problem-led: brand absent from the shortlist, inaccurate description, competitor advantage in the answer, and cross-market position drift.

### Market, company, contact, and privacy

- Market content begins with the Chinese-market baseline, then expands only to a defined target country/language and buying context.
- Company uses the direct proposition “不卖玄学排名，先把 AI 怎么说你查清楚”, followed immediately by precise scope and limits.
- Contact promises only an initial scope-setting conversation, not a report or response SLA that is not operationally guaranteed.
- Privacy remains sober and plain; marketing slang is not used on the privacy page.

### Visual language

The China edition remains denser and more operational than Global:

- Rounded command surfaces, clear status chips, bolder section labels, and dashboard-like output lists.
- Strong orange chapters are reserved for decisions and conversion, not decoration.
- Scene changes animate the result and priority fields so the interaction reads as diagnosis rather than a carousel.
- Typography uses Chinese line breaks intentionally; large headlines avoid excessive negative tracking and mobile metadata remains readable.

## Agent-native publishing contract

### Search and crawl strategy

- Human pages: `index,follow`, self-canonical, hreflang pairs, primary sitemap entries.
- Agent HTML: crawlable, `noindex,follow`, canonical relationship to the paired Human page, and explicit machine alternatives.
- Markdown and JSON-LD: crawlable, `X-Robots-Tag: noindex, follow`, linked from Human and Agent HTML, not included in the Human sitemap.
- `robots.txt` continues to allow crawling and advertises the sitemap.

This prevents machine representations from competing with Human pages while allowing agents to discover and retrieve them.

### Stable endpoints

For each locale and topic, expose a stable Markdown URL:

- `/agent/index.md`, `/agent/product.md`, `/agent/approach.md`, `/agent/geo.md`, `/agent/company.md`, `/agent/diagnostic.md`, `/agent/privacy.md`
- Equivalent `/zh/agent/*.md` URLs.

Expose one structured catalogue per locale:

- `/agent/catalog.json`
- `/zh/agent/catalog.json`

The catalogue uses `application/ld+json; charset=utf-8` and a stable entity graph.

### Discovery links

Human and Agent responses advertise:

- paired Human canonical: `rel="canonical"`
- Markdown representation: `rel="alternate"; type="text/markdown"`
- locale fact catalogue: `rel="alternate"; type="application/ld+json"`
- root machine directory: `rel="describedby"` pointing to `/llms.txt`

The same relations appear as HTML `<link>` entries and HTTP `Link` response headers where applicable.

`llms.txt` remains short and links directly to stable Markdown documents. `llms-full.txt` remains a complete combined reference.

### Typed fact model

All renderers consume one typed catalogue. Every topic contains:

- stable topic ID
- locale and language
- title and concise summary
- paired Human path and Agent path
- last-reviewed date
- scope statement
- limitations statement when relevant
- fact groups with stable group IDs
- facts with stable claim IDs, plain-language values, and a paired Human evidence URL

Stable IDs prevent headings or wording changes from changing fact identity.

### HTML semantics

- Agent pages use one `article` and ordered topic navigation.
- Metadata is represented with a definition list.
- Fact groups expose stable `data-fact-group` and `data-claim-id` values.
- Canonical, Markdown, JSON-LD, language, and last-reviewed values are visible in a compact document header.
- Interactive navigation keeps descriptive ARIA labels and 44px mobile targets.

### JSON-LD graph

The catalogue and page heads use stable `@id` values for:

- Yonaris `Organization`
- Yonaris `WebSite`
- each Human `WebPage`
- each topic’s `ItemList` of public facts
- relevant `Service` nodes only where the page visibly describes that service

Every structured claim must also be represented visibly on the corresponding Human or Agent page. No unsupported rating, review, award, customer, price, availability, or performance data is added.

### HTTP correctness

- `Accept: text/markdown` and `Accept: text/*` may select Markdown.
- Browser HTML requests select HTML.
- `Accept: */*` remains HTML to avoid surprising generic programmatic clients.
- Requests that accept neither HTML nor Markdown return `406`, never `500`.
- Harmless trailing slash variants redirect to the canonical path before content negotiation.
- Negotiated responses preserve `Vary: Accept`.
- Machine responses include `Content-Type`, `Content-Language`, `Cache-Control`, and their canonical/alternate `Link` relations.

## Testing and verification

### Unit and integration

- Red tests first for keyboard tab behavior, active-panel IDs, and focus movement.
- Red tests first for new China headlines, outputs, and prohibited overclaims.
- Red tests first for stable claim IDs, locale metadata, JSON-LD graph shape, Markdown links, and `llms.txt` v2 shape.
- Red tests first for `text/*`, `text/markdown;q=0`, unsupported media types, and trailing-slash negotiation.

### Browser and visual

- Desktop and mobile interaction tests for every interactive scene family.
- Keyboard-only run for navigation, tabs, language switch, Human/Agent switch, and lead form.
- 390, 768, 1024, and 1440 viewport screenshots for all Human and representative Agent pages.
- Axe WCAG 2 A/AA and 2.1 AA checks with zero serious/critical violations.
- No horizontal overflow and no text below the mobile minimums.

### Machine and production

- Fetch all Human HTML, Agent HTML, Markdown, and JSON-LD endpoints with realistic crawler headers.
- Validate JSON parsing, JSON-LD context/type/IDs, canonical relations, languages, dates, and claim IDs.
- Validate `robots.txt`, sitemap, `llms.txt`, and `llms-full.txt` after deployment.
- Re-run public-output and retired-route policies.
- Verify the production release marker and immutable image tag, then repeat the live-domain crawl matrix.

## Release order

1. Agent negotiation and typed fact model, because 5xx and ambiguous discovery are correctness issues.
2. Shared tab keyboard behavior and state transitions.
3. China copy and page-level story rewrite.
4. Global evidence and end-to-end decision artefacts.
5. Responsive polish, visual QA, review, production deployment, and live verification.
