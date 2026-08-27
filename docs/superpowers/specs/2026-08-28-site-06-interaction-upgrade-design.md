# Yonaris Site 06 Product Interaction Upgrade Design

**Status:** Approved for direct implementation and production release on 2026-08-28. The user explicitly requested self-review and no intermediate confirmation.

**Visual baseline:** `docs/superpowers/specs/2026-08-27-yonaris-site-06-fidelity-design.md`

**Product evidence sources:** deterministic fixtures and implemented surfaces in `apps/web/src/stories/analytics-fixtures.ts`, `apps/web/src/stories/overview.stories.tsx`, `apps/web/src/stories/share-of-voice.stories.tsx`, `apps/web/src/stories/opportunities.stories.tsx`, plus the implemented Query Fan-Out surface.

## Goal

Raise the production website from an editorial explanation of Yonaris to an editorial experience that demonstrates real Yonaris product states. Preserve Site 06's cinematic composition, restrained brand colour, localized English and Chinese narratives, and machine-readable Agent contracts while adding four missing layers:

1. a causal product workflow in the first viewport;
2. de-identified, faithful product surfaces tied to implemented capabilities;
3. a distinctive same-record Human/Agent transformation;
4. a stronger three-field conversion experience;
5. original Yonaris-owned generated imagery in place of stock photography.

## Non-goals

- Do not redesign Site 06 into a generic SaaS landing-page template.
- Do not add a 50/50 text-plus-dashboard hero, bento grid, equal card wall, decorative particle field, carousel, or oversized type spectacle.
- Do not copy Scrunch's lime scanner, particle reduction effect, exact spatial layout, or other identifying visual treatment.
- Do not invent capabilities, metrics, customer outcomes, customers, logos, citation counts, or query-engine coverage.
- Do not change public category language, indexing policy, Agent content-negotiation contracts, route topology, privacy behaviour, lead delivery, or the retired-route policy.
- Do not imply that a visible Agent marketing page itself guarantees indexing, ranking, retrieval, inclusion, or citation.

## Experience architecture

### 1. Homepage decision trace

The existing full-bleed cinematic hero remains the first visual object. Its right-side concentric geometry becomes a semantic decision trace rather than decoration.

The trace cycles through four real review states:

- **Observe:** current AI visibility, tracked prompts, evaluations, and review window;
- **Compare:** current share of voice and the tracked comparison set;
- **Inspect:** source or evidence boundary requiring review;
- **Decide:** a reviewable recommendation and comparable retest condition.

The central buying question remains fixed while the active ring, label, readout, and attached explanation change. Visitors can select every state directly. Automatic progression stops after direct interaction, pauses while off-screen, and is disabled under reduced motion. The English and Chinese experiences use the same interaction model but different localized decision framing.

Only values already present in deterministic product fixtures may appear as figures: 79% current visibility, 35% current share, 42 prompts, 3,120 evaluations in 30 days, and approximately one-day run frequency. All public examples are labelled as synthetic/de-identified sample workspace data, not benchmarks or customer results.

### 2. Faithful product proof

Add a reusable product proof scene with four selectable views:

- **Overview:** AI Visibility and Share of Voice with their 30-day trends plus prompts, evaluations, frequency, and last-updated metadata.
- **Share of Voice:** current share and a leaderboard using fixture totals; public brand names are replaced with `Your brand`, `Competitor A`, `Competitor B`, and `Competitor C`.
- **Opportunities:** document-style rows representing the implemented Creation, Existing Content, Outreach, and evidence expansion model. Copy is explicitly illustrative and does not promise outcomes.
- **Query Fan-Out:** the implemented page labels and prompt-to-query relationship. No unsupported aggregate figure is shown. A visible boundary states that coverage depends on the selected engine and observation target.

The scene behaves like a real working surface: keyboard-operable tabs, persistent active state within the page session, semantic panels, real labels, meaningful loading/state transitions, and no generic dashboard decoration. Product proof appears on both English and Chinese human surfaces with independent localized labels and examples. Chinese product evidence is not English prompt evidence wrapped in Chinese navigation.

### 3. Same-record Human/Agent transformation

Replace the existing literal tab switch with one continuous canonical record. The category fact stays fixed in the centre while a scrub control progressively exposes its public basis, scope boundary, stable identifier, review date, and representation links around the same wording.

The interaction must communicate:

- people receive narrative context needed for judgment;
- agents receive the same fact with explicit structure and stable relationships;
- the underlying fact is not rewritten into a separate machine story;
- machine readability supports retrieval and inspection but does not guarantee external outcomes.

The component is keyboard-operable through a native range input and direct reading-mode buttons. Reduced motion receives the final explicit structure without animated scanning. The visual line uses Yonaris orange only as a focus boundary; it does not reproduce Scrunch's particle or token-reduction treatment.

### 4. Conversion

Keep exactly three visible fields:

- English: Name, Work email, Company.
- Chinese: 姓名、电话、公司.

The final CTA explains what the first conversation will do: frame one market question, determine whether it can be observed and evidenced, and identify a useful next action. This release does not add a hidden business-context field or change the submitted lead schema.

Validation, submission, failure, retry, and success remain accessible product states. Existing provider-backed email delivery and privacy logic remain unchanged. The filled orange control is reserved for the final submit action.

### 5. Original imagery

Use three original, generated, logo-free editorial images created for Yonaris:

- `decision-room-original.png`: full-bleed decision-room hero and other dark cinematic decision contexts;
- `glass-passage-original.png`: across-market and movement/context compositions;
- `working-session-original.png`: evidence review and contact/working-session compositions.

Remove visible stock-photo credits and replace all active Site 06 stock references. Do not publish generation prompts, source references, watermarks, or external photographer credits. The three assets must share the existing navy, architectural glass/stone, and restrained orange-reflection art direction.

## Localization

The visual system and component behaviour remain shared. Narrative purpose differs by locale:

- English leads with inspectability, market answers, evidence, comparison, and decision confidence in a global B2B register.
- Chinese leads with the anxiety of being absent, misrepresented, compared unfavourably, or unable to prove advanced capability. It uses natural Chinese internet and business language without translating the English information order sentence by sentence.
- Across-market capability is embedded as an operating condition of the system. It is not framed around customer origin or destination.
- Agent records remain fully localized and continue to represent the same canonical human facts.

## Interaction and accessibility contract

- All tab groups use semantic `role=tablist`, `role=tab`, `role=tabpanel`, `aria-selected`, roving focus or the existing accessible tab hook, and arrow-key navigation.
- Every state remains available in SSR or has an equivalent crawlable fact record beside the interaction. Product animation must never be the only carrier of public meaning.
- Automatic motion pauses while off-screen and after manual selection.
- `prefers-reduced-motion: reduce` removes automatic progression, scanner travel, line drawing, and breathing photography while leaving final content visible.
- Interaction controls have at least a 44px hit area, visible focus, and no hover-only information.
- Mobile preserves the cinematic field and causal sequence without shrinking a desktop dashboard below readable size.
- No horizontal overflow at 360, 390, 1280, or 1440 CSS pixels.

## Performance contract

- Use CSS and small React state transitions; do not add animation packages, canvas, continuous requestAnimationFrame loops, or video dependencies.
- Original images must be resized/compressed to responsive production formats with explicit dimensions and lazy loading outside the first viewport.
- Only the hero image may load eagerly.
- Product proof renders one panel at a time while its semantic summary remains in initial HTML.
- New client-side code must not break current build chunking or hydration.

## Acceptance and release

1. Unit tests verify product fixture accuracy, tab semantics, same-record invariance, exact form fields, original asset references, reduced-motion rules, and preserved Agent/SEO contracts.
2. Type checking, the full `@workspace/www` suite, production build, public-output audits, site-manifest audits, policy tests, and release verification pass.
3. Browser acceptance covers English and Chinese home, product, company, across-market, and contact routes at 1440, 1280, 390, and 360 widths.
4. Browser checks exercise every interactive state using mouse and keyboard, validate no console or hydration error, and repeat with reduced motion.
5. Final visual review confirms Site 06 composition remains intact, the new interactions demonstrate real product meaning, original images carry the visual narrative, and no rejected template pattern has returned.
6. Release review reports no Critical or Important issue.
7. Push the approved commit to the production branch and verify `https://yonaris.com` serves the new generation, assets, forms, and machine contracts.
