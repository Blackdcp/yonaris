# Yonaris Global Website Edition Redesign

**Status:** Proposed implementation specification

**Date:** 2026-08-24

**Scope:** Global English public edition, English Portal entry surface, and English public supporting surfaces
**Frozen scope:** The Chinese edition remains visually and editorially unchanged until a separate Chinese design is approved.

## 1. Decision

Rebuild the Yonaris global English website as an evidence-led commercial site rather than a typography-led company thesis.

The global edition keeps the existing Yonaris identity—Ink, Paper, Signal Orange, disciplined rules, and editorial restraint—but changes the design system from repeated oversized headlines into a complete visual narrative system. Every core page must have a distinct commercial job, a page-specific visual anchor, a meaningful explanatory graphic, and a proof artifact.

This specification supersedes the English-site portions of:

- `2026-08-21-yonaris-marketing-site-v2-design.md`;
- `2026-08-22-full-site-rebuild-design.md`;
- `2026-08-22-homepage-product-stage-design.md`.

It does not reopen the retired resource hub, source-distribution page, Blog, Docs, Glossary, Changelog, Roadmap, AI Visibility comparison, or other retired publication surfaces.

## 2. User Outcome

Within five seconds, an English-speaking visitor must understand:

1. Yonaris examines how AI systems represent and compare a brand within a defined market scope;
2. the result is reviewable answer evidence and a clearer next test, not an instant universal score;
3. Yonaris combines customer-visible software with team-operated collection and human review;
4. the next step is to request a focused diagnostic.

The shared emotional entry point is uncertainty, not job title: visitors know AI is changing market discovery and comparison, but cannot see how their brand is currently represented or what action deserves priority.

The public message resolves that uncertainty with evidence. It does not use fear language, promise universal coverage, or claim automated optimization.

## 3. Positioning and Voice

### Global edition proposition

**Headline:**

> Know how AI represents your brand—and what to do next.

**Supporting copy:**

> Yonaris shows how configured AI systems describe and compare your brand, which available sources appear behind the answers, and which next test deserves attention.

**Primary action:** `Request a diagnostic`

**Secondary action:** `See a sample`

### Voice rules

- Lead with buyer outcomes, then show evidence, then explain methodology.
- Prefer concrete verbs: observe, compare, inspect, trace, verify, decide.
- Use `configured`, `defined`, and `available` only where they prevent a false claim; do not repeat caveats in every card.
- State the current service-led delivery model once, clearly, near the product and request flow.
- Do not expose internal method names or implementation mechanics unless they materially help a buyer evaluate the service.
- Do not use fictional customer brands, invented customer results, unverified platform counts, unsupported global coverage, or customer-logo theatre.
- A demonstration is labelled once at its figure boundary and never presented as customer proof.

### Evidence and demonstration data policy

Every public artifact uses exactly one of these data classes:

1. **Approved public evidence** — a captured public answer or source record with a documented origin, collection time, permitted-use review, and no customer-confidential input;
2. **Approved de-identified evidence** — a real customer-derived record with written publication permission, privacy review, a re-identification check, and an expiry or re-review date;
3. **Schema-only demonstration** — generic labels such as `Target brand` and `Configured competitor A`, with authored structural content that is explicitly not described as collected, generated, measured, or observed.

Named fictional companies, fictional platforms or models, invented domains, synthetic performance numbers, a Yonaris self-diagnostic, and unapproved claims about real third-party brands are prohibited.

Schema-only figures use the boundary label `Interface demonstration — no customer or live observation data.` Approved evidence uses a data-class-specific disclosure. A private evidence register records the content owner, source, permission basis, review date, and permitted public surfaces. Customer-derived evidence requires product-owner and privacy/legal approval before it enters a build.

## 4. Public Information Architecture

Existing canonical paths remain stable during this edition so deployment and search risk stay bounded.

| Path | Navigation label | Page job |
| --- | --- | --- |
| `/` | Home | Explain the market problem, product outcome, evidence, operating model, and next action |
| `/product` | Product | Show current software, managed delivery, inputs, outputs, and customer-visible evidence |
| `/approach` | How it works | Explain one defined question moving through scope, collection, inspection, action, and repeat observation |
| `/research` | Evidence | Show measurement definitions, a truthful evidence record, comparison rules, and known limits |
| `/company` | Company | Establish company purpose, present operating model, verified identity, and contact trust |
| `/geo` | Contextual GEO page | Explain GEO as one applied workflow without making it the company category |
| `/diagnostic` | Request a diagnostic | Explain the deliverable and move a qualified visitor through a truthful request flow |
| `/privacy` | Privacy | Explain diagnostic data handling in plain English |

Primary navigation is:

`Product` · `How it works` · `Evidence` · `Company`

Header utilities are:

`Customer sign in` · `中文` · `Request a diagnostic`

GEO remains discoverable from Product, Evidence, footer, and relevant contextual links. It is not required in primary navigation.

The human footer does not link to `Agent`, `llms.txt`, Status, or machine documents. Approved machine documents may remain available through explicit noindex allowlists and must pass the versioned hashed public-output policy.

## 5. Shared Visual Direction: Editorial Evidence

### What remains

- Ink `#0B1220`, Paper `#F6F4F1`, Slate, Stone, Mist, and Signal Orange `#FF6A00`;
- restrained one-pixel rules, deliberate alignment, and asymmetrical editorial grids;
- real HTML text and accessible code-native figures;
- orange as evidence, active state, focus, and action;
- a mix of Paper and Ink surfaces where the background change has semantic purpose.

### What changes

- Display typography shrinks by roughly 20–30 percent from the current oversized system.
- No core page consists mainly of a hero and repeated text/rule sections.
- No two consecutive core sections may be text-only.
- No page repeats the same `large headline + list + horizontal rules` composition more than twice.
- Each core page has one hero visual, one explanatory visualization, and one proof artifact.
- Desktop product interfaces are redrawn into readable mobile narratives rather than scaled down.
- Dark sections are reserved for evidence inspection and focused contrast, not used as a repeating rhythm device.

### Visual grammar

The edition uses five related visual forms:

1. **Evidence windows** — answer, comparison, available-source, finding, and next-test artifacts;
2. **Scope fields** — concentric or bounded shapes that give defined meaning to market, question, surface, language, cohort, and time;
3. **Evidence paths** — lines connecting question, answer, visible source, finding, and next test;
4. **Ledgers and comparison fields** — denominators, records, before/after cohorts, and known/unknown states;
5. **Trust structures** — delivery sequence, verified service scope, team responsibility, and contact routes.

These are a family, not a template. Pages must not copy the homepage window or Product circles indiscriminately.

### Typography and responsive targets

- English H1: `clamp(3.5rem, 6vw, 6rem)`, with page-specific exceptions only when visual QA proves the phrase remains readable.
- H1 line height: approximately `0.96–1.02`.
- Lead copy: `1.125–1.25rem`, maximum 38rem.
- Long-form body measure: 60–70 characters.
- Main pages use four to seven bounded sections with a frozen page-specific order rather than an arbitrary long editorial scroll.
- Primary proof appears within the first 2.5 viewports.
- A primary conversion appears in the first viewport and again at the close, not after every section.
- At 390 CSS pixels, no image or code-native interface requires pinch zoom to read its primary labels.

## 6. Page Designs

### 6.1 Home — Market Evidence Window

The existing split-screen composition is retained because it successfully combines proposition and product-like evidence. Its content and behavior change.

#### Hero

Left:

- category line: `AI market evidence for brands`;
- approved headline and supporting copy;
- primary `Request a diagnostic` action;
- secondary `See a sample` action that scrolls to the homepage evidence-path sample in Release 1;
- no URL-in-query prefill field in the first release because it can leak submitted domains into edge and access logs.

Right:

- one evidence window with four readable views: `Answer`, `Comparison`, `Available sources`, `Next test`;
- neutral product-grounded demonstration content, not a fictional customer and not a Yonaris category-conflict self-diagnostic;
- the exact figure-level disclosure `Interface demonstration — no customer or live observation data.` when the figure uses schema-only content;
- answer, evidence, interpretation, and next-test states visually distinct;
- a static default state that communicates the full concept without interaction.

#### Remaining sequence

1. **What changed:** AI is becoming part of market discovery and comparison.
2. **What Yonaris makes visible:** answer samples, comparison context, available sources, and next-test opportunities.
3. **One evidence path:** question → answer → available source → finding → next test.
4. **How delivery works now:** customer-visible workspace plus Yonaris-operated collection and human review.
5. **Evidence preview:** one policy-compliant record linking to the Release 1 Evidence foundation at `/research`.
6. **Request close:** what the diagnostic can clarify and what happens after submission.

The current public example that advertises the disagreement between the website and Portal is removed.

### 6.2 Product — Scope Rings and Evidence Workbench

The current concentric-circle composition is retained as the Product hero's structural visual. The rings gain explicit meaning and no longer act as decoration.

Four layers:

1. Define the scope;
2. Observe the answers;
3. Inspect the evidence;
4. Choose the next test.

Selecting or focusing a layer highlights the matching label and a concise output. The static state shows all four labels. Reduced-motion mode changes state without animated ring movement.

Below the hero, a product-grounded workbench presents:

- defined market scope;
- an approved answer sample, or a schema-only answer record that makes no collection claim;
- brand and configured-competitor context;
- available citation or query-evidence state;
- human-review and next-test state.

When an approved evidence record is unavailable, the schema-only workbench preserves the interface structure but replaces every observation-dependent value with an explicit state such as `No observation loaded` or `Not applicable in this interface demonstration`. Collection time, denominator, answer excerpt, citations, findings, and review status are not fabricated. Labels may define what a future approved record would contain, but they do not imply that collection, measurement, or review occurred.

The page explains customer-visible and Yonaris-operated responsibilities in a two-lane operating model. Coverage disclosure appears once beside the scope matrix rather than being repeated across every activity.

### 6.3 How It Works — Evidence Path

The current six-step dense editorial list becomes one four-step path:

1. Define the market question and observation conditions;
2. Collect and compare answer samples;
3. Inspect answers and available source evidence;
4. Choose one next test and repeat the same defined observation.

Desktop uses a horizontal or pinned evidence path with one artifact per step. Mobile uses a vertical sequence with the artifact directly below its step.

The page includes one visible non-causality statement near repeat observation. Internal working-method branding is removed from the main conversion narrative.

### 6.4 Evidence — Measurement Ledger

The `/research` path remains, but its navigation label is `Evidence`.

The page's hero visual is a measurement ledger showing:

- market and question scope;
- AI surface and collection time;
- valid sample denominator;
- answer excerpt;
- known and unknown evidence;
- one bounded finding.

These are reserved ledger fields, not mandatory fabricated values. Approved evidence may populate them; a schema-only demonstration renders observation-dependent fields as `No observation loaded` or `Not applicable in this interface demonstration` and explains the field definition without inventing a time, denominator, excerpt, source, or finding.

Supporting visuals are:

- metric anatomy for mention rate and configured-cohort share;
- a cohort comparison field showing why denominator changes matter;
- an answer → evidence → finding annotation.

The Release 1 Evidence foundation removes the current named fictional record and supplies the minimum trustworthy destination required by Home and primary navigation. It already renders the complete five-section contract: ledger schema, metric anatomy, a definition-only cohort-comparison field, answer-annotation schema, and limits/request close. Observation-dependent fields show explicit unpopulated states under the evidence-data policy.

Release 3 preserves the same section inventory while adding richer interaction, complete comparison explanations, and an approved public or de-identified evidence pack when one exists.

The page does not claim to publish customer research until an approved evidence pack exists. Until then, its artifact is a schema-only demonstration grounded in actual product fields, with no named company, result, collection timestamp, platform claim, or implication that observation occurred.

### 6.5 GEO — Answer Entry Map

The GEO hero visual maps one brand moving through:

`Discovery` → `Description` → `Comparison` → `Available sources` → `Repeat observation`.

Each node answers one buyer question and exposes one evidence artifact. The page keeps a direct commercial tone, defines GEO once, and links upward to Product and Evidence.

It does not use a dense five-row capability table as the dominant composition. One compact service-scope matrix identifies only verified configurable dimensions: market, language, question set, supported surface, cohort, and observation period.

### 6.6 Company — Operating Model and Trust

The Company page moves from an abstract category manifesto to a verified company and delivery narrative.

Its hero uses restrained type plus one operating-model figure connecting:

`Customer question` → `Yonaris evidence workflow` → `Reviewable decision`.

The page contains:

- company purpose;
- current software-and-service operating model;
- verified company identity and business contact when available;
- team information only when supplied and approved;
- principles stated positively: evidence before conclusion, explicit scope, human review, and durable product facts;
- one route to the diagnostic.

If verified entity, team, location, or business-domain contact data is unavailable, the corresponding block is omitted. Nothing is invented. The public `black.dcp@outlook.com` address is removed from marketing display once the diagnostic route can reliably receive requests.

### 6.7 Diagnostic — Deliverable Preview and Request Timeline

Headline:

> Request a focused AI market diagnostic.

Before the form, the page shows a four-part deliverable preview:

1. scoped baseline;
2. selected answer and available-source evidence;
3. clearest information gaps;
4. reviewed next-test candidates.

The request flow remains compact:

1. website, brand, target market or region, target language, and decision question;
2. optional competitors, name, work email, consent, and review.

The CTA is `Submit diagnostic request`. The page states that submission begins a scope review and does not return an instant scan or score.

No response time, delivery SLA, retention duration, data location, or platform coverage is published until it is operationally and legally verified.

Failure handling does not expose the complete lead in a DOM `mailto:` URL. It offers a generic retry and a business contact route without embedding submitted form values.

### 6.8 Privacy and Supporting Surfaces

- `/privacy` uses plain English and a dedicated supporting-page composition.
- Before Release 1 accepts personal data, the privacy owner must verify the controller identity and contact, collected fields, processing purposes and applicable basis, delivery mechanism, processor categories, storage or transfer treatment, retention period or criteria, rights route, security contact, effective date, and the regions intentionally served. The notice must state those verified facts in plain English.
- If that minimum notice or the corresponding operational behavior is not verified, Release 1 does not enable form submission or marketing analytics for the affected region. Missing facts are a launch gate, not copy to omit.
- `/status` is removed from navigation, sitemap, canonical inventory, and indexable marketing. The marketing route returns the branded generic `404` until a reliable status product is separately approved; it is not redirected or represented as healthy.
- `/brand` returns the branded generic `404` with no redirect. Existing internal links, sitemap entries, and known downloadable references are audited before cutover. Approved logos required by the site remain available only at individually allowlisted asset paths.
- Retired publication routes continue to return the agreed retired response and remain absent from sitemap and navigation.

## 7. Portal Entry Alignment

The public Portal entry surface is part of the global brand experience and must be updated within the coordinated Release 0 train, using the independent deployments defined below.

### Metadata

- document title: `Yonaris Portal`;
- description: `Review configured AI answer samples, brand and competitor mentions, available source evidence, and reviewed next tests.`;
- manifest name: `Yonaris Portal`;
- no `AI Search Optimization`, `AI Visibility`, AEO, old module naming, or retired category terms.

### Sign-in surface

Headline:

> Review how AI represents your brand.

Four restrained capability labels:

- Answer samples;
- Competitor context;
- Available source evidence;
- Reviewed next tests.

The existing `Product Truth`, `Market Intent`, `Model Intelligence`, and `Commercial Feedback` labels are removed from the public sign-in surface.

The authenticated product is not redesigned in this edition except where a public-facing label or metadata leaks the retired positioning.

### Release topology and public boundary

Portal is the independently deployed `apps/web` product surface; the global marketing edition is the separately deployed `apps/www` surface. They do not share an image or atomic rollback.

Release 0 therefore has two ordered deployments:

1. deploy and production-verify the Portal public-entry correction, with its existing product rollback path;
2. deploy and production-verify the marketing containment correction, with the marketing rollback path.

The Release 1 commercial-entry cutover is blocked until Portal's public entry passes its Release 0 contract. A failed later Product-page release never requires rolling back a verified Portal correction.

Portal's public-surface inventory includes pre-auth HTML, JavaScript and CSS chunks, manifest, service worker and caches, icons and social metadata, robots, public error pages, authentication redirects and provider-facing pages, API error envelopes, response headers, and source-map behavior. Every item passes the same versioned hashed public-output policy as the marketing site.

## 8. Edition Architecture

The implementation introduces an edition boundary without designing the Chinese edition.

### Required model

- `global-en` owns English routes, navigation, footer, page composition, SEO, public machine publication, analytics policy, and diagnostic policy.
- `zh-cn-legacy` initially wraps the current Chinese output without editorial or visual changes.
- Shared public facts contain only claims that are true in both editions.
- English and Chinese page objects are no longer required to have identical structure, section order, fields, or claim-array shape.
- Translation relationships are explicit and optional. Hreflang is emitted only when two published pages serve equivalent intent.
- Shared components are leaf primitives—buttons, form fields, evidence records, focus behavior, spacing, and color tokens—not shared top-level page scripts.

The `apps/www` marketing edition remains one application, one image, and one atomic deployment for its English and frozen Chinese routes. Portal remains an independent deployment. Splitting English and Chinese marketing hosting is out of scope until independent release cadence, mainland hosting, or data-residency requirements justify it.

At Release 1, rewritten English pages do not automatically retain reciprocal hreflang with frozen Chinese pages. The default is to remove the pair until editorial review confirms equivalent intent; English remains `x-default`. The visible `中文` utility links to the Chinese homepage when no approved equivalent exists.

## 9. SEO, Machine Pages, and Public Boundary

- Keep current English canonical paths.
- Change navigation labels without changing routes.
- English remains `x-default`.
- Sitemap is generated from published edition routes, not `page keys × locales`.
- Machine pages are explicitly allowlisted and unlinked from the human footer.
- Marketing and Portal maintain separate public-surface inventories. Their client/server chunks, HTML, CSS, SVG, manifest, service-worker caches, robots, sitemap or route inventory, social metadata, auth and error surfaces, machine documents, API error envelopes, and response headers are scanned for retired provenance and positioning terms.
- First-party package metadata, runtime identifiers, build scripts, environment names, comments, fixtures, and deployment configuration are audited and renamed or removed when they retain retired provenance. The only exceptions are inventoried third-party legal notices that counsel or an ownership review confirms must remain.
- Source maps are not publicly served.
- Caddy uses an explicit route and asset allowlist; broad directory exposure is prohibited.
- The retired resource, source-distribution, Blog, Docs, Glossary, Changelog, Roadmap, and comparison routes remain out of sitemap and public navigation.
- A branded generic not-found response may replace the current zero-byte 404 only if it contains no retired-route names or provenance language.

The repository and container packages must remain private. Legally required third-party notices remain in the appropriate repository or distributed-software location and are excluded from public marketing output; they are not deleted by a keyword sweep.

### Executable public-output policy

Release 0 creates the versioned machine-readable policy `security/public-output-policy.v1.json`. It contains policy version, owner role, normalization version, target-surface classes, and denylist fingerprints; it contains no retired plaintext terms. Each fingerprint records an opaque ID, SHA-256 digest of the normalized phrase, normalized character length, token count, and severity.

The scanner applies Unicode NFKC normalization, case folding, zero-width removal, HTML/URL/common JavaScript escape decoding, separator and whitespace folding, and compact-form comparison. It scans first-party source, package metadata, generated client/server code, static assets, container contents, cached pre-auth Portal output, HTTP responses, and common textual encodings.

The Release Owner owns policy changes and records the policy digest in the release manifest. A protected, non-public exception inventory references only fingerprint IDs, exact file or artifact digests, legal basis, approver, and expiry; it does not repeat retired plaintext. Only required third-party legal notices may receive an exception. CI fails on a missing policy, digest mismatch, expired exception, unapproved hit, or any hit in a public artifact.

## 10. Analytics and Privacy

The global marketing edition uses one privacy-reviewed analytics path. Diagnostic field values never enter analytics, URLs, cookies, local storage, or event properties.

Required funnel events:

- `diagnostic_cta_view`;
- `diagnostic_cta_click`;
- `sample_view`;
- `diagnostic_start`;
- `diagnostic_scope_complete`;
- `diagnostic_submit`;
- `diagnostic_confirmed`;
- `diagnostic_failure`.

Reviewed downstream outcomes are:

- `pending` — a valid submission is awaiting human scope review;
- `qualified` — the brand and decision question are real, the requested market, language, and surface fit the currently approved delivery scope, and a reviewer accepts a follow-up;
- `unqualified` — spam, invalid identity, unsupported scope, consumer-only request, or no actionable brand decision;
- `meeting_booked` — a qualified request reaches a scheduled commercial conversation.

The post-submission measurement contract adds `diagnostic_scope_accepted`, `diagnostic_scope_declined`, and `diagnostic_meeting_booked`. Identity and free text remain only in the approved lead system. The first fourteen-day baseline reports submitted, qualified, and meeting-booked counts and rates, not CTA clicks alone.

Browser funnel events allow only: edition, form version, page key, CTA location, viewport class, and anonymous campaign/referrer classification after URL sanitization.

Server-side review events allow only: edition, form version, event outcome, a controlled non-free-text reason code, and a server-generated random submission analytics ID. That ID is never derived from email, domain, IP address, or any submitted field; its mapping exists only in the approved lead record and follows the verified retention rule. It is used to deduplicate status transitions and calculate submitted-to-qualified and qualified-to-meeting rates. Browser and server schemas are separately validated, and neither accepts arbitrary properties.

Marketing analytics and authenticated-Portal analytics remain separate. Existing PostHog and Plausible paths are reviewed so the global public site does not run overlapping identity systems or contradict its privacy notice.

## 11. Release Sequence

### Release 0 — Public-surface containment

- repository and container package visibility made private by the owner;
- inherited first-party identifiers and orphan build inputs audited, removed, or renamed; required third-party notices isolated from public output and recorded in a private exception inventory;
- Portal title, manifest, description, public sign-in labels, and complete pre-auth public-surface inventory aligned and production-verified through its independent deployment;
- human footer stops linking Status, Agent, and llms files;
- public `/brand` route returns the agreed branded `404` and broad brand-asset exposure is removed;
- broken Status surface returns the agreed branded `404` and is removed from public navigation/indexing;
- homepage category-conflict demonstration removed;
- versioned hashed public-output policy and protected legal-exception inventory activated;
- source, Portal, marketing output, container, response, cache, and asset scans pass.

### Release 1 — Commercial entry

- global edition shell and navigation;
- rebuilt English Home;
- minimum compliant English Evidence foundation so `See a sample`, the homepage evidence preview, and primary navigation never enter the old fictional record;
- minimum English containment pass for every other route reachable from the new header, footer, or Release 1 content—Product, How It Works, GEO, and Company—removing named fictional records, internal method branding, retired positioning, unsupported claims, and obsolete CTAs before those pages receive their full later redesign;
- rebuilt English Diagnostic;
- corrected English Privacy and verified minimum data-handling notice before form or analytics activation;
- global typography and responsive foundations;
- privacy-safe conversion events;
- frozen Chinese routes pass their pre-release DOM-text and screenshot baselines; approved differences are limited to build hashes, current-year output, shared security changes, retired public links, and explicitly reviewed hreflang removal.

The containment pass is not a temporary text-only shell. Each affected page renders every ordered section slot in the Section 12 contract with concise approved content, its new H1 and page job, a static default version of the eventual hero figure, policy-compliant artifacts or explicit unpopulated states, a working diagnostic path, corrected metadata, and the new shell. Release 2 or 3 enriches those same sections with interaction, explanatory depth, approved proof, and responsive refinement; it does not reveal a previously hidden legacy page or add a surprise section.

### Release 2 — Product and method

- Product scope rings and workbench;
- How It Works evidence path;
- GEO answer-entry map;
- Portal-to-Product links and the independent Portal public-entry contract reverified in production.

### Release 3 — Proof and trust

- complete Evidence ledger and cohort-comparison visual;
- Company operating model and verified trust data;
- approved real or redacted evidence artifact when available;
- complete route, SEO, machine-output, responsive, accessibility, and production review.

Each release is independently deployable and reversible. Work does not wait for all four releases before producing a public improvement.

Implementation planning follows the same boundaries: Release 0 and Release 1 form the first launch plan; Release 2 and Release 3 each receive a separate plan after the preceding production gate passes. This prevents later page work from delaying the commercial-entry release.

## 12. Testing and Acceptance

### Behavioral contracts

- Edition routes, navigation, footer, SEO, sitemap, and machine publication validate independently.
- Chinese legacy output does not acquire English section order, labels, or styling changes; DOM-text snapshots and reference screenshots are captured from the exact pre-release production revision, with an explicit allowed-difference file.
- Rewritten English routes emit no reciprocal Chinese hreflang unless an editorial equivalence record exists.
- Portal's complete pre-auth public-surface inventory contains no retired positioning or provenance and serves no public source maps.
- Diagnostic validation, submission, confirmation, retry, idempotency, and PII exclusion are tested.
- Diagnostic submission and analytics remain disabled wherever the minimum verified privacy contract is incomplete.
- No human navigation links to machine documents or unavailable Status.
- `/brand` and `/status` return the branded `404`, publish no canonical, and remain absent from sitemap and robots allowlists.
- Retired routes remain unavailable under trailing-slash, case, encoded, Markdown, and negotiated-content variants.

### Visual contracts

The ordered page inventory is an acceptance contract. Sections may not be added, removed, or reordered during implementation without a specification amendment.

| Page | Ordered section inventory | Default hero/figure state | Mobile transformation |
| --- | --- | --- | --- |
| Home | Hero → What changed → Visible outputs → Evidence path → Delivery model → Evidence preview → Request close | `Answer` view visible; all four view labels and the complete conclusion readable without interaction | Copy, actions, then evidence window; views become an accessible segmented sequence; evidence path stacks vertically |
| Product | Scope-rings hero → Evidence workbench → Responsibility lanes → Scope matrix → Request close | All four rings labelled; `Define the scope` active; one output summary visible | Rings become four selectable rows; workbench becomes ordered evidence cards; lanes stack with ownership labels retained |
| How It Works | Premise hero → Four-step path → Step artifacts → Repeat-observation boundary → Request close | Full four-step path visible with step 1 artifact open | Vertical numbered path; each artifact follows its step; no pinned scrolling |
| Evidence | Ledger hero → Metric anatomy → Cohort comparison → Answer annotation → Limits and request close | One schema-only record with known and unknown states visible | Ledger becomes labelled key/value groups; comparison keeps denominator before result; annotation stacks in reading order |
| GEO | Entry-map hero → Buyer questions and artifacts → Applied workflow → Scope matrix → Product/Evidence bridge and close | All five nodes visible with `Discovery` selected | Nodes become an ordered accordion with a static summary; matrix becomes labelled cards |
| Company | Operating-model hero → Purpose and current model → Verified trust slot → Principles → Diagnostic close | Complete three-node operating model visible | Figure becomes a vertical sequence; unverified trust slot is omitted rather than rendered empty |
| Diagnostic | Deliverable hero → Request timeline → Two-stage form → Privacy, failure, and alternate route | Four-part deliverable preview and stage 1 visible | Deliverables stack above form; one field per row; error summary precedes fields |

No hero exceeds `110svh` at the required desktop or mobile capture sizes. No section uses scroll-jacking or requires a pinned dwell to reveal its primary meaning. Every interactive figure's default state carries the complete core proposition, and interaction only adds detail.

Capture and inspect all English core pages at:

- 1440 × 900;
- 1024 × 768;
- 390 × 844;
- 320 × 740 for Home, Product, and Diagnostic.

Required outcomes:

- one meaningful hero visual on every core page;
- one explanatory visualization and one proof artifact on every core page except utility/legal pages;
- no two consecutive text-only sections;
- no unreadable scaled desktop UI on mobile;
- primary proof within 2.5 viewports;
- no horizontal overflow;
- keyboard, focus, reduced-motion, and semantic figure behavior remain usable.

### Commercial comprehension

In a moderated test with at least six English-speaking decision-makers across roles:

- at least five can explain the Yonaris offer within ten seconds;
- at least five understand the diagnostic is reviewed rather than instant;
- at least five can name two expected outputs;
- at least five understand that market, language, surfaces, and observation conditions define the scope.

### Technical targets

- LCP below 2.5 seconds at the 75th percentile;
- CLS below 0.1;
- INP below 200 milliseconds;
- WCAG AA contrast and keyboard access for all core interactions;
- no public source maps;
- zero policy-fingerprint hits in public responses and assets, and zero unapproved hits in first-party source or build inputs;
- no navigation dead ends or zero-byte error response on links the site itself publishes.

The first fourteen production days establish the English funnel baseline. Improvement targets are set from measured qualified-diagnostic behavior rather than invented before launch.

## 13. Non-Goals

- No Chinese copy, information-architecture, typography, form, or visual redesign.
- No retired resource hub, source-distribution page, Blog, Docs, Glossary, Changelog, Roadmap, or comparison-content revival.
- No authenticated product redesign beyond public metadata or labels that leak retired positioning.
- No pricing page.
- No unverified customer proof, supported-platform matrix, response SLA, company biography, legal promise, or security certification.
- No new visual dependency or heavyweight charting library when code-native SVG, HTML, and CSS are sufficient.
- No removal of legally required third-party notices without an ownership and licensing review.

## 14. Definition of Done

The global edition is complete when:

1. every English core page has a distinct commercial job and page-specific visual narrative;
2. Home and Product preserve the two approved visual strengths while correcting their content and making their graphics meaningful;
3. every other core page adds a meaningful hero visual, explanatory graphic, and proof artifact;
4. the English site explains the offer, operating model, evidence, and next action without relying on abstract company language;
5. Release 1 forms a complete commercial path—Home, inline sample, compliant Evidence foundation, Diagnostic, confirmation, and Privacy—with no link into an unrevised fictional artifact;
6. Portal, metadata, footer, supporting pages, machine output, auth/error surfaces, service-worker caches, and public assets no longer contradict or expose retired positioning;
7. every published evidence artifact has an approved data class and private evidence-register record;
8. the form and analytics activate only after the minimum privacy facts and operations are verified for the served region;
9. first-party source, package metadata, configuration, tests, and deployment inputs contain no retired provenance identifiers outside an approved private legal-notice exception inventory;
10. the Chinese edition remains frozen for later independent design and passes its documented baseline with only allowlisted differences;
11. each release passes its behavioral, visual, public-boundary, accessibility, and production smoke gates;
12. the deployed funnel measures submitted, qualified, and meeting-booked diagnostic behavior without collecting submitted field values in analytics.
