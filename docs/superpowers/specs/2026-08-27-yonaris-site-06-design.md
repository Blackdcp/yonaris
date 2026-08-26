# Yonaris Site 06 Design Specification

**Status:** Approved for production implementation on 2026-08-27

**Approved visual source:** `E:/Yonaris/.superpowers/brainstorm/1950-1787739192/content/site-system-multipage-agent-06.html`

## Product position

Yonaris is **AI-native MarTech infrastructure built for decisions made by people and shaped by agents**.

The Chinese expression is **面向人类决策、由 Agent 共同塑造的 AI 原生营销科技基础设施**.

AI-answer observation is one entry into a wider system of market questions, company facts, public evidence, content and channels, customer behaviour, team action, and review. The site must not reduce the company to a single search tactic, a monitoring dashboard, or a one-off consulting report.

## Audience and narrative

The audience is not segmented by job title. It is anyone accountable for a brand, market, or growth decision who is anxious that AI may already be introducing, comparing, or misunderstanding the company before the first conversation.

English and Chinese share one design system but use different narrative logic.

- English starts with the buyer shortlist, inspectable evidence, reviewable decisions, and category clarity. It should feel like a global technology company, not a translated regional site.
- Chinese starts with immediate business anxiety, lost consideration, wrong positioning, wasted budget, and the need to turn uncertainty into an operating system. It should sound like a Chinese internet and growth team speaking plainly, not a translated strategy report.
- Global service capability is expressed through market, language, buying context, and evidence filters throughout the system. It is not framed as a dedicated inbound or outbound service story.

## Production route mapping

Keep the established route contract for the agile release. Navigation labels and page purpose change; permanent legacy URLs continue to redirect through the existing manifest.

| Purpose | English route | Chinese route |
| --- | --- | --- |
| Home / why now | `/` | `/zh` |
| Platform / system | `/product` | `/zh/product` |
| Evidence / worked breakdown | `/approach` | `/zh/approach` |
| Across markets | `/geo` | `/zh/geo` |
| Human + Agent | `/company` | `/zh/company` |
| Contact | `/diagnostic` | `/zh/diagnostic` |
| Privacy | `/privacy` | `/zh/privacy` |

Primary English navigation: **Platform · Evidence · Human + Agent · Contact**.

Primary Chinese navigation: **为什么现在 · 系统怎么运转 · 看一次拆解 · 预约沟通**.

Every desktop header and mobile menu must expose a clear **For people / For agents** or **人类阅读 / Agent 阅读** control. The Agent option links to the same topic in the machine-readable surface. It must be as visible as the locale switch, not hidden in the footer.

## Visual system

### Direction

The approved direction combines editorial restraint, cinematic business photography, physical evidence objects, and restrained technical geometry. It can learn from the confidence and pacing of the named overseas reference, but must not reproduce its grid, copy, image treatment, or page composition pixel-for-pixel.

### Tokens

- Deep navy: `#071724`
- Secondary navy: `#0d2232`
- Ink: `#101a25`
- Soft ink: `#43515d`
- Warm paper: `#f2ede3`
- Warm white: `#fbf8f1`
- Brand orange: `#ef5a1a`
- Warm amber: `#c9874d`
- Body family: Geist Sans with system Chinese fallbacks
- Editorial display family: Iowan Old Style / Baskerville / Times for selected quotations and evidence objects only
- Maximum content width: `1220px`

Orange is a focus colour, not a field colour. Use it for active underlines, a short rule, a selected phrase, a focus ring, or a single data point. No large orange panel, orange hero, or repeated orange buttons.

### Type and spacing

- Desktop H1: `clamp(38px, 4vw, 48px)`; never the oversized poster typography from previous versions.
- Desktop H2: `clamp(29px, 3.3vw, 40px)`.
- Body lead: about `18–19px`, `1.55–1.65` line height.
- Section spacing: normally `80–104px`, reduced on mobile.
- Copy width stays readable; no full-width paragraphs.

### Composition

- Real photography appears where it provides human and market context.
- A hero pairs a concise decision-focused statement with one understandable object or interaction.
- Evidence is represented as dossiers, documents, source annotations, baseline/retest records, and relationship diagrams—not generic dashboard chrome.
- Concentric circles appear only when they mean “one fact, several readings” or “one system, connected nodes”: home, Human + Agent, Chinese system, and fact reading. They are not a repeated decorative motif on every page.
- The logo uses the existing Yonaris wordmark assets and remains visible in every header and footer.

### Explicitly rejected patterns

- No numbered `01 / 02 / 03 / 04` process rails.
- No arrow glyphs used as decoration or button suffixes.
- No equal-size card wall, bento grid, repeated capsule tags, or dashboard mockup without a clear user meaning.
- No giant headline that dominates the viewport.
- No copy that explains internal methodology, implementation caveats, or the design process to a prospective customer.
- No fake customer outcomes, rankings, percentages, partner logos, or unnamed proof presented as real evidence.

## Interaction system

Interaction must change meaning, not merely animate the page.

1. **Reading lens** — Human and Agent tabs show the same canonical fact. Human mode adds decision context. Agent mode exposes Fact, Evidence, Boundary, and Stable ID. Arrow-key navigation and correct tab semantics are required.
2. **Evidence inspector** — Selecting a phrase in an observed answer changes the source, boundary, and buying effect shown beside it.
3. **Baseline / retest** — The same question remains fixed while evidence, judgment, and next action change. The page states that this is an illustrative method record, not a customer result.
4. **Chinese anxiety selector** — A set of plain-language anxieties changes the central diagnosis and business impact without routing users through roles or functions.
5. **System relationship map** — Market question, company fact, content and channels, AI and market observation, customer behaviour, and action and review are connected nodes. Selecting one explains what breaks if it is disconnected.
6. **Breakdown replay** — Baseline, break, action, and review states share one de-identified example and never pre-claim success.

Subtle photo movement, state cross-fades, and circle response may add life. They must stop under `prefers-reduced-motion`, preserve keyboard access, and never delay content. Avoid decorative scroll reveals, particle fields, auto-advancing carousels, or movement with no informational purpose.

## Page content contract

### English home

- Kicker: “AI-native MarTech infrastructure built for decisions made by people and shaped by agents.”
- H1: “See what buyers are being told before the first conversation.”
- Lead: “Yonaris makes the questions, evidence and comparisons behind an AI-shaped shortlist visible—so your team can act on the decision, not chase another visibility score.”
- Follow with an interactive buying-question dossier, an inspectable market-answer case file, baseline/retest evidence, the dual-reading fact, and one contact invitation.

### English Platform (`/product`)

- H1: “See what shaped the shortlist.”
- Start with one buying question and let the user select a phrase to inspect Source, Boundary, and Buying effect.
- Show a physical answer dossier in the hero, not a software dashboard.

### English Evidence (`/approach`)

- H1: “Proof should be something your team can review.”
- Keep question, answer, source material, recommendation, and retest in one record.
- Baseline/retest is the core interaction.

### English Human + Agent (`/company`)

- H1: “The same company should remain clear to people and agents.”
- Use the shared claim selector for category, purpose, and scope.
- Explain that machine-readable structure is editorial discipline and stable public evidence, not a decorative switch that guarantees retrieval.

### English Contact (`/diagnostic`)

- H1: “Tell us who to contact. We’ll begin with the buying decision.”
- Exactly three visible fields: Name, Work email, Company.

### Chinese home

- H1: “AI 正在替客户认识你、比较你，也可能误解你。”
- Speak to anxiety in business language: 没进备选、核心优势被说偏、竞品先被推荐、预算不知道该投哪里、模型变化后结论失效.
- Explain that the goal is not more exposure but connecting “为什么选你” to evidence and then to observable customer behaviour.
- Show one Human/Agent dual reading in the main page flow.

### Chinese system (`/zh/product`)

- H1: “不是再做一层内容，而是重建品牌被理解的基础设施。”
- The relationship map is the hero and primary interaction.
- The system nodes are 市场问题、品牌事实、内容与渠道、AI 与市场观测、客户行为、行动与复核.
- Do not imply a real-time automation capability that is not publicly verified.

### Chinese breakdown (`/zh/approach`)

- Label: “公开方法演示 · 示例场景，不代表客户结果。”
- H1: “从一句 AI 答案，追到真正影响选择的那个断点。”
- The replay states are 基线、断点、行动、复核. The last state records 已变化、未变化、无法归因; it never promises improvement.

### Chinese Contact (`/zh/diagnostic`)

- H1: “带一道你最不想让 AI 答错的问题来。”
- Exactly three visible fields: 姓名、电话、公司.

### Across markets and privacy

- Across-markets pages express the same system across market, language, category wording, alternatives, and evidence conditions. They do not define the customer by origin or destination.
- Privacy pages remain truthful and concise, share the 06 visual system, and do not invent retention periods or legal promises without verified policy input.

## Lead delivery

- Reuse the existing server-validated, idempotent delivery endpoint and provider integration.
- Keep the hidden abuse field but exactly three visible fields per locale.
- A successful UI state appears only after the provider accepts the request.
- Success and error copy speak to the customer, not about transport internals.
- Do not expose a personal fallback email in normal page copy. On failure, preserve values and offer retry.

## Human and machine contract

- Every Human route renders its meaningful text in the initial SSR response.
- Human pages remain the canonical, indexable pages. Machine surfaces are alternate representations of the same facts, not a competing site and not cloaking.
- Each public fact has one source record, a stable ID, a visible Human anchor, evidence/source language, and a boundary.
- JSON-LD `@id` and fact URLs resolve to real anchors. Markdown and catalog output use the same facts and wording.
- Canonical, `en`, `zh-CN`, and `x-default` links are emitted server-side and remain mutually consistent.
- Site map, robots policy, content negotiation, GET/HEAD behaviour, and raw-response smoke tests remain intact.
- No page claims that its structure guarantees ranking, inclusion, retrieval, or citation.

## Assets

Copy the three approved prototype photographs into `apps/www/public/brand/site-06/` with descriptive names. Preserve source credits in a discreet caption or project asset note:

- conference room: Nastuh Abootalebi / Unsplash
- business people walking: Mikhail Nilov / Pexels
- glass business venue: Zerrin Velizade / Pexels

Use existing wordmark and icon assets. Do not redraw or replace the Yonaris logo.

## Quality and release acceptance

- Existing `apps/www` type check and test baseline remains green.
- New tests fail first for the 06 copy, interactions, shared design markers, stable fact anchors, form field contract, and rejected patterns.
- Raw SSR smoke confirms meaningful page copy, one H1, canonical/hreflang, JSON-LD, machine links, and the expected language on every core route.
- Desktop widths `1440` and `1280`; mobile widths `390` and `360`; no horizontal overflow.
- Keyboard-only navigation reaches every control, tabs move with arrow keys, focus is visible, and reduced motion is honoured.
- Source and rendered output contain no retired framework attribution, public code-sharing claims, or retired content-section naming.
- All public pages use the Yonaris logo and the approved colour system.
- Build, focused unit tests, production smoke, and visual browser review pass before push.

