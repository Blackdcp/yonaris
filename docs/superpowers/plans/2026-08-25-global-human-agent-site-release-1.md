# Yonaris Global Human + Agent Site Release 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the complete global English Yonaris site as a Bluefish-informed, Yonaris-branded product experience with visible Human/Agent companion routes, meaningful interaction, and no old-shell inner pages.

**Architecture:** Keep the existing TanStack Start route inventory and global-English edition boundary. Add typed experience content and focused interactive React components to the existing page-specific components; keep core facts in the current machine-fact layer. Convert `/agent` and `/agent/*` into branded semantic HTML for browser requests while extending the existing `Accept: text/markdown` negotiation so machine clients receive the same factual Markdown.

**Tech Stack:** Node.js 24, pnpm, TypeScript, React 19, TanStack Start/Router, CSS, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-08-25-yonaris-dual-audience-regional-website-redesign.md`

## Global Constraints

- Release 1 changes the global English edition only; Chinese Human pages remain unchanged until Release 2.
- Light surfaces use `/brand/logos/yonaris-wordmark-navy.png`; dark surfaces use `/brand/logos/yonaris-wordmark-white.png`.
- The exact palette is Ink `#0B1220`, Signal Orange `#FF6A00`, Paper `#F6F4F1`, Slate `#1E2A39`, Blue Gray `#2F3E50`, Stone `#8A95A3`, and Mist `#DDE2E8`.
- Bluefish informs only global Human design and interaction; competitor identity, copy, imagery, claims, and palette are not copied.
- Primary relevance is organized by the five shared AI-anxiety questions, never by job title.
- Every global core route receives the new shell and a page-specific visual anchor; a homepage-only release is forbidden.
- Human and Agent views derive identity, capability, evidence, limitation, and verification facts from one source.
- Unsupported customers, logos, platform counts, results, coverage claims, certifications, locations, response times, and delivery guarantees are forbidden.
- Demonstrations remain visibly labelled and cannot imply live observation or customer proof.
- Previously retired public routes remain retired, and the repository's restricted-marketing scan must pass.
- The shared lead pipeline is enabled in Release 1: English exposes only Name, Work email, and Company; Chinese exposes only 姓名、电话、公司; successful submission sends one server-side email to the configured marketing recipient.
- Every interaction has a semantic server-rendered initial state, keyboard and touch access, and a reduced-motion state.
- Use existing dependencies only. Use pnpm exclusively and do not weaken workspace supply-chain controls.
- Do not hand-edit `apps/www/src/routeTree.gen.ts`; allow the TanStack route generator to update it through the normal build/dev command and commit the generated result if it changes.

---

## File Structure

### New focused files

- `apps/www/src/content/site/global-en/experience.ts` — global buyer questions, product modules, evidence-journey steps, and page-specific interface copy.
- `apps/www/src/content/site/global-en/experience.test.ts` — content completeness, uniqueness, truth-boundary, and no-role-segmentation contracts.
- `apps/www/src/components/site/global-en/global-english-view-switch.tsx` — locale- and topic-preserving Human/Agent control.
- `apps/www/src/components/site/global-en/interactions/answer-studio.tsx` — interactive homepage question/answer/evidence/next-test composition.
- `apps/www/src/components/site/global-en/interactions/product-workbench.tsx` — module selector and shared product evidence workbench.
- `apps/www/src/components/site/global-en/interactions/evidence-journey.tsx` — Approach step selector and scroll-linked progressive enhancement.
- `apps/www/src/components/site/global-en/interactions/evidence-explorer.tsx` — Evidence annotations and reviewable ledger states.
- `apps/www/src/components/site/global-en/interactions/answer-relationship-map.tsx` — AI Visibility brand/answer/source relationship model.
- `apps/www/src/components/site/global-en/interactions/interactions.test.tsx` — server-rendered accessibility and initial-state contracts for every interactive figure.
- `apps/www/src/components/site/global-en/agent/global-agent-shell.tsx` — branded Agent navigation and Human companion link.
- `apps/www/src/components/site/global-en/agent/global-agent-pages.tsx` — Agent index and fact-page renderer driven by global machine facts.
- `apps/www/src/components/site/global-en/agent/global-agent-pages.test.tsx` — Agent/Human factual and navigation parity contracts.
- `apps/www/src/routes/llms[.]mdx.agent.ts` — internal Markdown index target used by Agent content negotiation.
- `apps/www/src/styles/global-en/agent.css` — Agent-specific information-density and responsive rules.
- `e2e/www-tests/global-english-r1.spec.ts` — full Release 1 route, interaction, accessibility, reduced-motion, and visual evidence suite.
- `.changeset/global-human-agent-release.md` — one user-facing patch note for `@workspace/www`.

### Existing files changed by responsibility

- Global content and metadata: `apps/www/src/content/site/global-en/index.ts`, `machine.ts`, `index.test.ts`, `apps/www/src/editions/global-en/edition.ts`, `edition.test.ts`.
- Global shell: `global-english-header.tsx`, `global-english-footer.tsx`, `global-english-shell.tsx`, `global-english-shell.test.tsx`.
- Page composition: all eight files under `apps/www/src/components/site/global-en/pages/` and `page-primitives.tsx`.
- Existing static visual primitives: `apps/www/src/components/site/global-en/visuals/visuals.tsx`.
- Human style system: `apps/www/src/styles/global-en/core.css`, `core.test.ts`, and `apps/www/src/styles.css`.
- Route section contracts: `apps/www/src/editions/registry.ts` and the global page tests.
- Agent route governance: `apps/www/src/content/site/types.ts`, `apps/www/src/lib/site-manifest.ts`, `site-manifest.test.ts`, `machine-documents.ts`, `machine-documents.test.ts`, `markdown-negotiation.ts`, and `markdown-negotiation.test.ts`.
- Agent routes: replace the current Markdown-only `apps/www/src/routes/agent/index.tsx` and six `*.ts` page routes with HTML-capable `*.tsx` route modules; keep the three permanent-redirect routes unchanged.
- Release verification: `e2e/www-tests/content-negotiation.spec.ts`, `e2e/www-tests/global-english-r0.spec.ts` (remove after R1 coverage exists), and `apps/www/scripts/smoke-marketing.mjs`.

---

### Task 1: Restore the brand shell and lock the global content contract

**Files:**
- Create: `apps/www/src/components/site/global-en/global-english-view-switch.tsx`
- Modify: `apps/www/src/content/site/global-en/index.ts`
- Modify: `apps/www/src/content/site/global-en/index.test.ts`
- Modify: `apps/www/src/editions/global-en/edition.ts`
- Modify: `apps/www/src/components/site/global-en/global-english-header.tsx`
- Modify: `apps/www/src/components/site/global-en/global-english-footer.tsx`
- Modify: `apps/www/src/components/site/global-en/global-english-shell.test.tsx`
- Modify: `apps/www/src/styles/global-en/core.css`

**Interfaces:**
- Produces: `globalAgentHref(key?: GlobalEnglishPageKey): string` and `GlobalEnglishViewSwitch({ activeKey, compact? })`.
- Produces: the approved global headline, bridge, supporting copy, and CTA labels in `GLOBAL_ENGLISH_CONTENT.home`.
- Consumes: existing `Logo`, `GlobalEnglishPageKey`, and stable canonical routes.

- [ ] **Step 1: Replace the old shell assertions with failing brand and reading-mode contracts**

Update `global-english-shell.test.tsx` so the main test includes these exact assertions:

```tsx
expect(markup).toContain('src="/brand/logos/yonaris-wordmark-navy.png"');
expect(markup).toContain('src="/brand/logos/yonaris-wordmark-white.png"');
expect(markup).not.toContain("YONARIS<span");
expect(markup).toContain('aria-label="Reading mode"');
expect(markup).toContain('href="/agent/product"');
expect(markup).toContain('href="/product" aria-current="page"');
```

Update `index.test.ts` to require:

```ts
expect(GLOBAL_ENGLISH_CONTENT.home.headline).toBe("AI is already answering questions about your brand.");
expect(GLOBAL_ENGLISH_CONTENT.home.bridge).toBe("Know what it says—and what to change.");
expect(GLOBAL_ENGLISH_CONTENT.home.primaryAction).toBe("Request a diagnostic");
expect(GLOBAL_ENGLISH_CONTENT.home.secondaryAction).toBe("Explore the product");
expect(JSON.stringify(GLOBAL_ENGLISH_CONTENT)).not.toMatch(/for (CMOs|marketers|founders|sales teams)/i);
```

- [ ] **Step 2: Run the two focused tests and verify the expected failure**

Run:

```powershell
pnpm.cmd --filter @workspace/www exec vitest run --config vitest.config.ts src/content/site/global-en/index.test.ts src/components/site/global-en/global-english-shell.test.tsx
```

Expected: FAIL because `bridge` and action labels do not exist, the shell reconstructs the wordmark as text, and `/agent/product` is excluded.

- [ ] **Step 3: Implement the reading-mode path and control**

Create `global-english-view-switch.tsx` with this public contract:

```tsx
import type { GlobalEnglishPageKey } from "@/editions/global-en/edition";

const companionKeys = new Set<GlobalEnglishPageKey>([
	"product",
	"approach",
	"research",
	"geo",
	"company",
	"diagnostic",
]);

export function globalAgentHref(key?: GlobalEnglishPageKey): string {
	return key && companionKeys.has(key) ? `/agent/${key}` : "/agent";
}

export function GlobalEnglishViewSwitch({
	activeKey,
	compact = false,
}: {
	activeKey?: GlobalEnglishPageKey;
	compact?: boolean;
}) {
	return (
		<nav className={`global-en__view-switch${compact ? " global-en__view-switch--compact" : ""}`} aria-label="Reading mode">
			<a href={activeKey && activeKey !== "home" ? `/${activeKey}` : "/"} aria-current="page">Human</a>
			<a href={globalAgentHref(activeKey)}>Agent</a>
		</nav>
	);
}
```

Use `<Logo variant="navy" />` in the light header and `<Logo variant="white" />` in the dark footer. Place the view switch beside the locale control on desktop and inside the mobile navigation. Keep Customer sign in and the diagnostic CTA.

- [ ] **Step 4: Implement the approved content and metadata**

Set `GLOBAL_ENGLISH_CONTENT.home` to:

```ts
home: {
	headline: "AI is already answering questions about your brand.",
	bridge: "Know what it says—and what to change.",
	description:
		"Yonaris shows how AI describes, compares, and recommends your brand, which available sources shape the answer, and which next test deserves attention.",
	primaryAction: "Request a diagnostic",
	secondaryAction: "Explore the product",
	problem:
		"AI-mediated discovery creates a market question: whether your brand appears, how it is represented, and what evidence deserves action.",
},
```

Keep `globalEnglishPageHead("home")` derived from this source so title, description, Open Graph, Human HTML, and later Agent output cannot drift.

- [ ] **Step 5: Add shell styles without changing the palette**

In `core.css`, replace text-wordmark rules with image sizing and add the two-state control:

```css
.global-en__logo {
	display: inline-flex;
	align-items: center;
}
.global-en__logo img {
	display: block;
	width: clamp(8rem, 10vw, 10.5rem);
	height: auto;
}
.global-en__view-switch {
	display: inline-grid;
	grid-template-columns: repeat(2, auto);
	border: 1px solid color-mix(in srgb, var(--ge-ink) 18%, transparent);
}
.global-en__view-switch a {
	min-height: 2.75rem;
	padding: 0.7rem 0.85rem;
	display: inline-flex;
	align-items: center;
}
.global-en__view-switch a[aria-current="page"] {
	background: var(--ge-ink);
	color: var(--ge-paper);
}
```

Add the existing Signal Orange focus treatment to both switch links.

- [ ] **Step 6: Run the focused tests and commit the brand shell**

Run the Step 2 command. Expected: PASS.

Commit:

```powershell
git add apps/www/src/content/site/global-en apps/www/src/editions/global-en/edition.ts apps/www/src/components/site/global-en/global-english-header.tsx apps/www/src/components/site/global-en/global-english-footer.tsx apps/www/src/components/site/global-en/global-english-view-switch.tsx apps/www/src/components/site/global-en/global-english-shell.test.tsx apps/www/src/styles/global-en/core.css
git commit -m "restore the global Yonaris brand shell"
```

### Task 2: Build the global Answer Studio and rewrite the complete homepage

**Files:**
- Create: `apps/www/src/content/site/global-en/experience.ts`
- Create: `apps/www/src/content/site/global-en/experience.test.ts`
- Create: `apps/www/src/components/site/global-en/interactions/answer-studio.tsx`
- Create: `apps/www/src/components/site/global-en/interactions/interactions.test.tsx`
- Modify: `apps/www/src/components/site/global-en/pages/home-page.tsx`
- Modify: `apps/www/src/components/site/global-en/pages/page-primitives.tsx`
- Modify: `apps/www/src/editions/registry.ts`
- Modify: `apps/www/src/components/site/global-en/pages/global-english-pages.test.tsx`
- Modify: `apps/www/src/styles/global-en/core.css`

**Interfaces:**
- Produces: `GLOBAL_ANSWER_QUESTIONS`, `GlobalAnswerQuestionId`, and `getGlobalAnswerQuestion(id)`.
- Produces: `<AnswerStudio initialQuestion="recommended" />`.
- Consumes: `GraphicFrame` and the brand shell from Task 1.

- [ ] **Step 1: Write the failing five-question content test**

Create `experience.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { GLOBAL_ANSWER_QUESTIONS, getGlobalAnswerQuestion } from "./experience";

describe("global Answer Studio content", () => {
	it("covers the five approved buyer anxieties without role segmentation", () => {
		expect(GLOBAL_ANSWER_QUESTIONS.map(({ id }) => id)).toEqual([
			"recommended",
			"accurate",
			"competitor",
			"sources",
			"next-test",
		]);
		expect(new Set(GLOBAL_ANSWER_QUESTIONS.map(({ label }) => label)).size).toBe(5);
		for (const question of GLOBAL_ANSWER_QUESTIONS) {
			expect(question.answer.length).toBeGreaterThan(20);
			expect(question.evidence.length).toBeGreaterThan(20);
			expect(question.nextTest.length).toBeGreaterThan(20);
		}
		expect(JSON.stringify(GLOBAL_ANSWER_QUESTIONS)).not.toMatch(/CMO|marketer|sales team|founder/i);
		expect(getGlobalAnswerQuestion("recommended").label).toBe("Are we being recommended?");
	});
});
```

- [ ] **Step 2: Run the test and verify it fails because the experience model is missing**

Run:

```powershell
pnpm.cmd --filter @workspace/www exec vitest run --config vitest.config.ts src/content/site/global-en/experience.test.ts
```

Expected: FAIL with a missing `./experience` module.

- [ ] **Step 3: Implement the exact question model**

Create `experience.ts` with this type and five records:

```ts
export type GlobalAnswerQuestionId = "recommended" | "accurate" | "competitor" | "sources" | "next-test";

export interface GlobalAnswerQuestion {
	id: GlobalAnswerQuestionId;
	label: string;
	prompt: string;
	answer: string;
	evidence: string;
	finding: string;
	nextTest: string;
}

export const GLOBAL_ANSWER_QUESTIONS: readonly GlobalAnswerQuestion[] = [
	{
		id: "recommended",
		label: "Are we being recommended?",
		prompt: "Which brands would you recommend for this defined buying question?",
		answer: "Review whether the target brand appears, where it appears, and which alternatives frame the answer.",
		evidence: "Keep the configured market, language, surface, question, and observed answer together.",
		finding: "Presence is meaningful only inside the declared comparison scope.",
		nextTest: "Repeat the same question after one approved information change.",
	},
	{
		id: "accurate",
		label: "Are we described accurately?",
		prompt: "How does the answer explain the target brand and its product category?",
		answer: "Compare the observed description with approved product facts and the intended market narrative.",
		evidence: "Annotate supported statements, missing facts, category drift, and unresolved ambiguity.",
		finding: "The gap is the difference between the observed answer and a verifiable product fact.",
		nextTest: "Clarify one durable public fact and observe the same defined question again.",
	},
	{
		id: "competitor",
		label: "Why is a competitor being preferred?",
		prompt: "What comparison criteria make one configured alternative more suitable?",
		answer: "Inspect which criteria, descriptions, and evidence states frame the configured competitor comparison.",
		evidence: "Keep competitor cohort and question intent visible beside the answer excerpt.",
		finding: "A preference claim is bounded by the configured cohort and cannot stand as a universal ranking.",
		nextTest: "Test one missing comparison fact under the same cohort and observation conditions.",
	},
	{
		id: "sources",
		label: "Which sources shape the answer?",
		prompt: "Which available citations or exposed source signals accompany the answer?",
		answer: "Record the sources the surface exposes and preserve unknown states when no source is available.",
		evidence: "Separate visible citations, exposed queries, and unavailable evidence instead of inferring them.",
		finding: "Available evidence can explain part of an answer; absence of evidence is not evidence of absence.",
		nextTest: "Review whether one authoritative fact is clear and accessible on an approved public surface.",
	},
	{
		id: "next-test",
		label: "What should we change next?",
		prompt: "Which bounded information change deserves the next observation?",
		answer: "Connect one observed gap to one reviewable change instead of generating a generic optimization list.",
		evidence: "The answer, finding, owner, change, and repeat-observation conditions remain linked.",
		finding: "A useful recommendation identifies both the evidence boundary and the decision owner.",
		nextTest: "Approve one change, keep the scope stable, and compare the next observation without claiming causality.",
	},
];

export function getGlobalAnswerQuestion(id: GlobalAnswerQuestionId): GlobalAnswerQuestion {
	const question = GLOBAL_ANSWER_QUESTIONS.find((candidate) => candidate.id === id);
	if (!question) throw new Error(`Unknown global answer question: ${id}`);
	return question;
}
```

- [ ] **Step 4: Write the failing server-rendered accessibility test**

Append to `interactions.test.tsx`:

```tsx
const markup = renderToStaticMarkup(<AnswerStudio initialQuestion="recommended" />);
expect(markup).toContain('role="tablist"');
expect(markup.match(/role="tab"/g) ?? []).toHaveLength(5);
expect(markup).toContain('aria-selected="true"');
expect(markup).toContain('data-question="recommended"');
expect(markup).toContain("Interface demonstration — no customer or live observation data.");
```

Run the test and expect a missing component failure.

- [ ] **Step 5: Implement the Answer Studio interaction**

Create `answer-studio.tsx` as a stateful client component. Use `useState`, one `role="tablist"`, five `role="tab"` buttons, and a single `role="tabpanel"`. Arrow Left/Right/Home/End moves focus and selection. The panel renders labelled `Answer`, `Evidence`, `Finding`, and `Next test` fields from the selected record and sets `data-question={active.id}`. Keep the demonstration disclosure in `figcaption`.

The selection handler must use this bounded helper:

```tsx
function nextQuestion(current: GlobalAnswerQuestionId, key: string): GlobalAnswerQuestionId {
	const index = GLOBAL_ANSWER_QUESTIONS.findIndex(({ id }) => id === current);
	if (key === "Home") return GLOBAL_ANSWER_QUESTIONS[0].id;
	if (key === "End") return GLOBAL_ANSWER_QUESTIONS.at(-1)?.id ?? current;
	const delta = key === "ArrowRight" ? 1 : key === "ArrowLeft" ? -1 : 0;
	if (!delta) return current;
	return GLOBAL_ANSWER_QUESTIONS[(index + delta + GLOBAL_ANSWER_QUESTIONS.length) % GLOBAL_ANSWER_QUESTIONS.length].id;
}
```

- [ ] **Step 6: Recompose the homepage around the Bluefish-informed product story**

Replace the current Home sequence with these section IDs and titles in `registry.ts` and `home-page.tsx`:

```ts
home: [
	"hero",
	"market-shift",
	"buyer-questions",
	"operating-loop",
	"product-preview",
	"human-agent-parity",
	"evidence-boundary",
	"request-close",
],
```

The hero uses the Task 1 headline, bridge, description, primary CTA, `/product` secondary CTA, and `<AnswerStudio />`. The remaining page must include exactly one visual composition per section: market shift line, five-question selector summary, `Observe → Explain → Act → Measure` loop, module preview, Human/Agent companion map, and evidence boundary. Do not render the old four-output card stack.

- [ ] **Step 7: Style and verify the homepage state changes**

Add scoped CSS for a 5/7 desktop hero, vertical question rail, three-column Answer Studio, active Signal Orange marker, and mobile stacked panel. State transitions use only `opacity`, `transform`, `border-color`, and `background-color`, finish within 240ms, and are disabled under the existing reduced-motion query.

Run:

```powershell
pnpm.cmd --filter @workspace/www exec vitest run --config vitest.config.ts src/content/site/global-en/experience.test.ts src/components/site/global-en/interactions/interactions.test.tsx src/components/site/global-en/pages/global-english-pages.test.tsx
```

Expected: PASS.

- [ ] **Step 8: Commit the complete homepage slice**

```powershell
git add apps/www/src/content/site/global-en/experience.ts apps/www/src/content/site/global-en/experience.test.ts apps/www/src/components/site/global-en/interactions apps/www/src/components/site/global-en/pages/home-page.tsx apps/www/src/components/site/global-en/pages/page-primitives.tsx apps/www/src/components/site/global-en/pages/global-english-pages.test.tsx apps/www/src/editions/registry.ts apps/www/src/styles/global-en/core.css
git commit -m "build the global Answer Studio homepage"
```

### Task 3: Turn Product into one interactive evidence workbench

**Files:**
- Modify: `apps/www/src/content/site/global-en/experience.ts`
- Modify: `apps/www/src/content/site/global-en/experience.test.ts`
- Create: `apps/www/src/components/site/global-en/interactions/product-workbench.tsx`
- Modify: `apps/www/src/components/site/global-en/interactions/interactions.test.tsx`
- Modify: `apps/www/src/components/site/global-en/pages/product-page.tsx`
- Modify: `apps/www/src/components/site/global-en/visuals/visuals.tsx`
- Modify: `apps/www/src/editions/registry.ts`
- Modify: `apps/www/src/styles/global-en/core.css`

**Interfaces:**
- Produces: `GLOBAL_PRODUCT_MODULES`, `GlobalProductModuleId`, and `<ProductWorkbench initialModule="monitoring" />`.
- Consumes: the shared `GraphicFrame`, `ScopeRings`, and truth-boundary language.

- [ ] **Step 1: Add a failing four-module contract**

Append this expectation to `experience.test.ts`:

```ts
expect(GLOBAL_PRODUCT_MODULES.map(({ id }) => id)).toEqual([
	"monitoring",
	"narrative",
	"sources",
	"experiments",
]);
for (const module of GLOBAL_PRODUCT_MODULES) {
	expect(module.input).toBeTruthy();
	expect(module.artifact).toBeTruthy();
	expect(module.interpretation).toBeTruthy();
	expect(module.nextAction).toBeTruthy();
}
```

Run `experience.test.ts`; expected: FAIL because `GLOBAL_PRODUCT_MODULES` does not exist.

- [ ] **Step 2: Implement the module model**

Add this interface and four exact records to `experience.ts`:

```ts
export type GlobalProductModuleId = "monitoring" | "narrative" | "sources" | "experiments";

export interface GlobalProductModule {
	id: GlobalProductModuleId;
	label: string;
	input: string;
	artifact: string;
	interpretation: string;
	nextAction: string;
}

export const GLOBAL_PRODUCT_MODULES: readonly GlobalProductModule[] = [
	{ id: "monitoring", label: "Monitoring", input: "Defined questions and observation conditions", artifact: "Comparable answer records", interpretation: "See whether and where the brand appears", nextAction: "Choose the answer set that deserves review" },
	{ id: "narrative", label: "Narrative", input: "Approved brand and product facts", artifact: "Answer-to-fact annotations", interpretation: "Find accurate, missing, and drifting descriptions", nextAction: "Select one durable fact to clarify" },
	{ id: "sources", label: "Sources", input: "Available citations and exposed evidence states", artifact: "Known, unknown, and unavailable source record", interpretation: "Separate visible evidence from inference", nextAction: "Review one authoritative public fact" },
	{ id: "experiments", label: "Experiments", input: "One approved information change", artifact: "Same-scope repeat observation", interpretation: "Compare the next answer without claiming causality", nextAction: "Record the result and decide whether to continue" },
];
```

- [ ] **Step 3: Write the failing Product Workbench markup test**

Require four tabs, one selected state, one `data-module="monitoring"` panel, and the four labels `Input`, `Artifact`, `Interpretation`, and `Next action` in `interactions.test.tsx`.

- [ ] **Step 4: Implement Product Workbench and interactive scope rings**

Create `product-workbench.tsx` with the same keyboard tab behavior as Answer Studio. Render one shared workbench frame whose contents update from `GLOBAL_PRODUCT_MODULES`; do not render four independent feature cards. Update `ScopeRings` to accept `activeStep?: 0 | 1 | 2 | 3` and add a visible active marker without hiding the other three labels.

- [ ] **Step 5: Recompose the Product page**

Use this section contract:

```ts
product: ["scope-rings-hero", "evidence-workbench", "operating-loop", "responsibility-lanes", "request-close"],
```

Keep the approved dark scope-ring hero. Replace the static ledger-first page with `<ProductWorkbench />` in the first body section, then show `Observe → Explain → Act → Measure` and the System/Yonaris/Customer responsibility lanes. Remove the generic scope matrix because its dimensions now live inside the workbench input state.

- [ ] **Step 6: Style, run focused tests, and commit**

Run:

```powershell
pnpm.cmd --filter @workspace/www exec vitest run --config vitest.config.ts src/content/site/global-en/experience.test.ts src/components/site/global-en/interactions/interactions.test.tsx src/components/site/global-en/pages/global-english-pages.test.tsx
```

Expected: PASS.

Commit:

```powershell
git add apps/www/src/content/site/global-en/experience.ts apps/www/src/content/site/global-en/experience.test.ts apps/www/src/components/site/global-en/interactions/product-workbench.tsx apps/www/src/components/site/global-en/interactions/interactions.test.tsx apps/www/src/components/site/global-en/pages/product-page.tsx apps/www/src/components/site/global-en/visuals/visuals.tsx apps/www/src/editions/registry.ts apps/www/src/styles/global-en/core.css
git commit -m "make the global product workbench interactive"
```

### Task 4: Give How It Works a progressive evidence journey

**Files:**
- Modify: `apps/www/src/content/site/global-en/experience.ts`
- Create: `apps/www/src/components/site/global-en/interactions/evidence-journey.tsx`
- Modify: `apps/www/src/components/site/global-en/interactions/interactions.test.tsx`
- Modify: `apps/www/src/components/site/global-en/pages/approach-page.tsx`
- Modify: `apps/www/src/editions/registry.ts`
- Modify: `apps/www/src/styles/global-en/core.css`

**Interfaces:**
- Produces: `GLOBAL_EVIDENCE_JOURNEY` and `<EvidenceJourney />`.
- Consumes: the existing answer/evidence/next-test vocabulary and no-causality boundary.

- [ ] **Step 1: Write a failing journey contract**

Require these five stage IDs and responsibilities:

```ts
expect(GLOBAL_EVIDENCE_JOURNEY.map(({ id }) => id)).toEqual([
	"scope",
	"observe",
	"inspect",
	"act",
	"measure",
]);
for (const stage of GLOBAL_EVIDENCE_JOURNEY) {
	expect(stage.customer).toBeTruthy();
	expect(stage.yonaris).toBeTruthy();
	expect(stage.output).toBeTruthy();
}
```

- [ ] **Step 2: Implement the journey data and server-rendered component contract**

Each stage object has `{ id, number, label, customer, yonaris, output, reviewQuestion }`. `EvidenceJourney` renders a sticky ordered stage selector and five adjacent semantic `<article>` elements. The first stage is active in SSR. An `IntersectionObserver` may update the active marker after hydration, but all five articles remain in document flow.

- [ ] **Step 3: Add keyboard and no-scroll-jacking behavior**

Clicking or pressing Enter on a stage link uses the native `#approach-stage-{id}` anchor. Do not call `preventDefault` for wheel, touchmove, PageDown, Space, or arrow keys. IntersectionObserver only updates `aria-current="step"` and `data-active-step`; it never writes scroll position.

- [ ] **Step 4: Recompose the page and preserve the truth boundary**

Use:

```ts
approach: ["premise-hero", "evidence-journey", "review-artifacts", "repeat-observation-boundary", "request-close"],
```

The hero previews the five-stage path. The main journey shows customer input, Yonaris activity, output, and review question. The final dark section retains this exact statement: `Repeat observation supports comparison; it does not by itself prove causality.`

- [ ] **Step 5: Run focused tests and commit**

Run the interaction and global page tests. Expected: PASS with all five stage anchors present and ordered.

```powershell
git add apps/www/src/content/site/global-en/experience.ts apps/www/src/components/site/global-en/interactions/evidence-journey.tsx apps/www/src/components/site/global-en/interactions/interactions.test.tsx apps/www/src/components/site/global-en/pages/approach-page.tsx apps/www/src/editions/registry.ts apps/www/src/styles/global-en/core.css
git commit -m "build the global evidence journey"
```

### Task 5: Build distinct Evidence and AI Visibility inspection experiences

**Files:**
- Create: `apps/www/src/components/site/global-en/interactions/evidence-explorer.tsx`
- Create: `apps/www/src/components/site/global-en/interactions/answer-relationship-map.tsx`
- Modify: `apps/www/src/components/site/global-en/interactions/interactions.test.tsx`
- Modify: `apps/www/src/components/site/global-en/pages/research-page.tsx`
- Modify: `apps/www/src/components/site/global-en/pages/geo-page.tsx`
- Modify: `apps/www/src/editions/registry.ts`
- Modify: `apps/www/src/styles/global-en/core.css`

**Interfaces:**
- Produces: `<EvidenceExplorer />` with explicit record-field selection.
- Produces: `<AnswerRelationshipMap />` with five inspectable nodes.
- Consumes: `GLOBAL_ENGLISH_MACHINE_FACTS.research`, `.geo`, and existing demonstration disclosure.

- [ ] **Step 1: Add failing semantic tests for both figures**

In `interactions.test.tsx`, require:

```tsx
const evidence = renderToStaticMarkup(<EvidenceExplorer />);
expect(evidence).toContain('aria-label="Evidence record fields"');
expect(evidence).toContain('data-field="scope"');
expect(evidence).toContain('data-field="unknowns"');
expect(evidence).toContain("No observation loaded");

const map = renderToStaticMarkup(<AnswerRelationshipMap />);
expect(map).toContain('aria-label="Answer relationship map"');
for (const node of ["Brand facts", "AI answer", "Configured alternatives", "Available sources", "Repeat observation"])
	expect(map).toContain(node);
```

- [ ] **Step 2: Implement Evidence Explorer**

Render a ledger beside a vertical field selector with `Scope`, `Question`, `Answer`, `Available sources`, `Finding`, and `Unknowns`. Selection highlights the corresponding row and displays a concise definition. Initial state is `scope`. Observation-dependent values stay `No observation loaded`, `Not applicable in this interface demonstration`, or `Awaiting human review`.

- [ ] **Step 3: Implement Answer Relationship Map**

Render the five nodes as real buttons around a central `AI answer` node on desktop and as an ordered vertical path on mobile. Selecting a node exposes one buyer question, one evidence artifact, and one boundary. Connection lines are CSS/SVG decoration with `aria-hidden="true"`; all meaning remains in text.

- [ ] **Step 4: Recompose both pages**

Evidence uses:

```ts
research: ["ledger-hero", "evidence-explorer", "metric-anatomy", "comparison-boundary", "limits-and-request-close"],
```

AI Visibility uses:

```ts
geo: ["entry-map-hero", "relationship-map", "applied-workflow", "configured-scope", "product-evidence-bridge", "request-close"],
```

Do not reuse the Homepage Answer Studio or Product scope rings on either page.

- [ ] **Step 5: Run tests and commit**

Run interaction, page, machine-fact, and section-order tests. Expected: PASS.

```powershell
git add apps/www/src/components/site/global-en/interactions/evidence-explorer.tsx apps/www/src/components/site/global-en/interactions/answer-relationship-map.tsx apps/www/src/components/site/global-en/interactions/interactions.test.tsx apps/www/src/components/site/global-en/pages/research-page.tsx apps/www/src/components/site/global-en/pages/geo-page.tsx apps/www/src/editions/registry.ts apps/www/src/styles/global-en/core.css
git commit -m "add global evidence inspection experiences"
```

### Task 6: Finish Company and ship the simple regional email lead forms

**Files:**
- Modify: `apps/www/src/components/site/global-en/interactions/interactions.test.tsx`
- Modify: `apps/www/src/components/site/global-en/pages/company-page.tsx`
- Modify: `apps/www/src/components/site/global-en/pages/diagnostic-page.tsx`
- Modify: `apps/www/src/components/site/global-en/pages/privacy-page.tsx`
- Modify: `apps/www/src/components/site/global-en/visuals/visuals.tsx`
- Modify: `apps/www/src/components/site/pages/diagnostic-form.tsx`
- Modify: `apps/www/src/components/site/pages/diagnostic-form.test.tsx`
- Modify: `apps/www/src/content/site/diagnostic.ts`
- Modify: `apps/www/src/content/site/diagnostic.test.ts`
- Modify: `apps/www/src/content/site/content-parity.test.ts`
- Modify: `apps/www/src/lib/diagnostic-schema.ts`
- Modify: `apps/www/src/lib/diagnostic-schema.test.ts`
- Modify: `apps/www/src/lib/diagnostic-client.test.ts`
- Modify: `apps/www/src/lib/diagnostic-delivery.server.ts`
- Modify: `apps/www/src/lib/diagnostic-delivery.server.test.ts`
- Modify: `apps/www/src/editions/registry.ts`
- Modify: `apps/www/src/styles/global-en/core.css`

**Interfaces:**
- Produces: `DIAGNOSTIC_VISIBLE_FIELDS`, a locale-discriminated `DiagnosticLead`, and a one-stage `<DiagnosticForm locale="en" | "zh" />`.
- Preserves: same-origin POST, strict payload parsing, honeypot, request-size limit, idempotency, rate limiting, confirmed delivery, truthful error, and retry behavior.
- Consumes: `MARKETING_LEAD_RECIPIENT`, `RESEND_API_KEY`, and `RESEND_FROM_EMAIL` only on the server.

- [ ] **Step 1: Replace the old lead-schema assertions with failing regional three-field contracts**

In `diagnostic-schema.test.ts`, define hand-written valid payloads and require the exact visible fields:

```ts
const englishLead = {
	locale: "en",
	name: "Ava Chen",
	email: "ava@acme.example",
	company: "Acme",
	companyUrl: "",
} as const;

const chineseLead = {
	locale: "zh",
	name: "陈安",
	phone: "+86 138 0013 8000",
	company: "示例公司",
	companyUrl: "",
} as const;

expect(DIAGNOSTIC_VISIBLE_FIELDS).toEqual({
	en: ["name", "email", "company"],
	zh: ["name", "phone", "company"],
});
expect(parseDiagnosticLead(englishLead)).toMatchObject({ success: true });
expect(parseDiagnosticLead(chineseLead)).toMatchObject({ success: true });
expect(parseDiagnosticLead({ ...englishLead, phone: "13800138000" }).success).toBe(false);
expect(parseDiagnosticLead({ ...chineseLead, email: "chen@example.cn" }).success).toBe(false);
```

Also require trimmed non-empty names and companies, valid English email, a Chinese phone containing 6–20 digits with only `+`, spaces, parentheses, or hyphens as separators, an empty honeypot, and rejection of unknown fields.

- [ ] **Step 2: Run the schema test and verify the intentional RED state**

```powershell
pnpm.cmd --filter @workspace/www exec vitest run --config vitest.config.ts src/lib/diagnostic-schema.test.ts
```

Expected: FAIL because the old schema still requires website, brand, market, question, competitors, email, and consent for both locales.

- [ ] **Step 3: Implement the locale-discriminated lead schema**

Replace the old scope/contact field model with:

```ts
export const DIAGNOSTIC_VISIBLE_FIELDS = {
	en: ["name", "email", "company"],
	zh: ["name", "phone", "company"],
} as const;

const sharedShape = {
	name: z.string().trim().min(1).max(120),
	company: z.string().trim().min(1).max(160),
	companyUrl: z.string().trim().max(0).default(""),
} as const;

const englishLeadSchema = z.strictObject({
	locale: z.literal("en"),
	...sharedShape,
	email: z.string().trim().min(1).max(254).pipe(z.email()),
});

const chineseLeadSchema = z.strictObject({
	locale: z.literal("zh"),
	...sharedShape,
	phone: z.string().trim().min(6).max(32).superRefine((value, context) => {
		if (!/^[+()\-\s\d]+$/.test(value) || (value.match(/\d/g) ?? []).length < 6 || (value.match(/\d/g) ?? []).length > 20)
			context.addIssue({ code: "custom", message: "invalid_phone" });
	}),
});

export const diagnosticLeadSchema = z.discriminatedUnion("locale", [englishLeadSchema, chineseLeadSchema]);
export type DiagnosticLead = z.output<typeof diagnosticLeadSchema>;
```

Remove the public mailto builder and hard-coded fallback recipient. Keep recipient selection entirely in `readDeliveryEnv`.

- [ ] **Step 4: Write failing delivery tests for both regional emails**

In `diagnostic-delivery.server.test.ts`, keep the real handler and inject only the external mail delivery boundary. Require one delivery call for each valid request and exact provider payload behavior:

```ts
expect(englishPayload.to).toEqual(["owner@example.com"]);
expect(englishPayload.reply_to).toBe("ava@acme.example");
expect(englishPayload.subject).toBe("Yonaris website lead / Acme");
expect(englishPayload.text).toContain("Name: Ava Chen");
expect(englishPayload.text).toContain("Work email: ava@acme.example");
expect(englishPayload.text).toContain("Company: Acme");

expect(chinesePayload.to).toEqual(["owner@example.com"]);
expect(chinesePayload).not.toHaveProperty("reply_to");
expect(chinesePayload.subject).toBe("Yonaris 官网留资 / 示例公司");
expect(chinesePayload.text).toContain("姓名: 陈安");
expect(chinesePayload.text).toContain("电话: +86 138 0013 8000");
expect(chinesePayload.text).toContain("公司: 示例公司");
```

Run the delivery test. Expected: FAIL because delivery still serializes the old scope payload and always reads `lead.email`.

- [ ] **Step 5: Implement provider-confirmed email delivery**

Update the provider payload to:

```ts
const payload = {
	from: input.env.RESEND_FROM_EMAIL,
	to: [input.env.MARKETING_LEAD_RECIPIENT],
	...(input.lead.locale === "en" ? { reply_to: input.lead.email } : {}),
	subject:
		input.lead.locale === "zh"
			? `Yonaris 官网留资 / ${oneLine(input.lead.company)}`
			: `Yonaris website lead / ${oneLine(input.lead.company)}`,
	text: diagnosticLeadEmailText(input.lead),
};
```

`diagnosticLeadEmailText` renders only Locale, Name, Work email or Phone, and Company. Keep header-injection normalization, timeout, idempotency header, and non-2xx failure handling unchanged.

- [ ] **Step 6: Write failing form and localized-content tests**

`diagnostic-form.test.tsx` must assert real rendered outcomes:

```tsx
const english = renderToStaticMarkup(<DiagnosticForm locale="en" />);
expect(english).toContain('name="name"');
expect(english).toContain('name="email"');
expect(english).toContain('name="company"');
expect(english).not.toContain('name="phone"');

const chinese = renderToStaticMarkup(<DiagnosticForm locale="zh" />);
expect(chinese).toContain('name="name"');
expect(chinese).toContain('name="phone"');
expect(chinese).toContain('name="company"');
expect(chinese).not.toContain('name="email"');
```

Both forms retain the hidden `companyUrl` honeypot, one privacy link, one submit button, one honest failure region, and one provider-confirmed success state. Content tests require concise locale-specific labels and disclosures and no two-stage progress copy.

- [ ] **Step 7: Implement the one-stage shared form and content**

Simplify `DiagnosticForm` to the locale's three visible fields plus the honeypot. Preserve the existing request identity, duplicate-click lock, abort-on-value-change behavior, `submitDiagnosticRequest`, confirmed success branch, and retry branch. Remove scope/contact stage transitions, consent checkbox, review list, and mailto fallback.

Use this locale-specific payload builder:

```ts
function leadInput(values: DiagnosticValues, locale: Locale): unknown {
	const shared = { locale, name: values.name, company: values.company, companyUrl: values.companyUrl };
	return locale === "en" ? { ...shared, email: values.email } : { ...shared, phone: values.phone };
}
```

The disclosure states that submission sends the provided details to Yonaris so the team can respond and links to `/privacy` for English or `/zh/privacy` when the Chinese privacy route is available; until that route ships, use the current localized privacy destination defined by the route manifest rather than a broken link.

Update `DiagnosticPage` to render the shared `<DiagnosticForm locale="en" />` inside a branded section with `data-graphic="lead-form"`. The current Chinese diagnostic page already consumes `<DiagnosticForm locale="zh" />`, so it receives the required three-field contract without adopting the global visual shell.

- [ ] **Step 8: Recompose Company around a responsibility and service map**

Replace the current empty trust slot with a visual map connecting `Customer question → Yonaris evidence workflow → Reviewable decision` and three responsibility lanes. Keep unverified entity/team/location blocks omitted. Present global service as configurable market and language scope, not universal coverage.

- [ ] **Step 9: Recompose Diagnostic and Privacy**

Diagnostic uses:

```ts
diagnostic: ["deliverable-hero", "lead-form", "request-timeline", "privacy-and-delivery"],
```

Privacy remains a restrained supporting page and explains the three submitted fields, response purpose, configured email delivery, and retry behavior in plain language. Do not turn Privacy into another marketing page or invent retention, transfer, controller, or legal-basis facts that have not been approved.

- [ ] **Step 10: Run the focused tests and commit**

Run:

```powershell
pnpm.cmd --filter @workspace/www exec vitest run --config vitest.config.ts src/lib/diagnostic-schema.test.ts src/lib/diagnostic-client.test.ts src/lib/diagnostic-delivery.server.test.ts src/components/site/pages/diagnostic-form.test.tsx src/content/site/diagnostic.test.ts src/content/site/content-parity.test.ts src/components/site/global-en/pages/global-english-pages.test.tsx
```

Expected: PASS with one English delivery, one Chinese delivery, exact regional fields, and honest success/failure behavior.

```powershell
git add apps/www/src/lib/diagnostic-schema.ts apps/www/src/lib/diagnostic-schema.test.ts apps/www/src/lib/diagnostic-client.test.ts apps/www/src/lib/diagnostic-delivery.server.ts apps/www/src/lib/diagnostic-delivery.server.test.ts apps/www/src/components/site/pages/diagnostic-form.tsx apps/www/src/components/site/pages/diagnostic-form.test.tsx apps/www/src/content/site/diagnostic.ts apps/www/src/content/site/diagnostic.test.ts apps/www/src/content/site/content-parity.test.ts apps/www/src/components/site/global-en/pages/company-page.tsx apps/www/src/components/site/global-en/pages/diagnostic-page.tsx apps/www/src/components/site/global-en/pages/privacy-page.tsx apps/www/src/components/site/global-en/visuals/visuals.tsx apps/www/src/editions/registry.ts apps/www/src/styles/global-en/core.css
git commit -m "simplify and enable regional website leads"
```

### Task 7: Convert global Agent routes into branded HTML with Markdown negotiation

**Files:**
- Create: `apps/www/src/components/site/global-en/agent/global-agent-shell.tsx`
- Create: `apps/www/src/components/site/global-en/agent/global-agent-pages.tsx`
- Create: `apps/www/src/components/site/global-en/agent/global-agent-pages.test.tsx`
- Create: `apps/www/src/styles/global-en/agent.css`
- Create: `apps/www/src/routes/llms[.]mdx.agent.ts`
- Replace: `apps/www/src/routes/agent/index.tsx`
- Replace: `apps/www/src/routes/agent/product.ts` with `product.tsx`
- Replace: `apps/www/src/routes/agent/approach.ts` with `approach.tsx`
- Replace: `apps/www/src/routes/agent/research.ts` with `research.tsx`
- Replace: `apps/www/src/routes/agent/geo.ts` with `geo.tsx`
- Replace: `apps/www/src/routes/agent/company.ts` with `company.tsx`
- Replace: `apps/www/src/routes/agent/diagnostic.ts` with `diagnostic.tsx`
- Modify: `apps/www/src/lib/markdown-negotiation.ts`
- Modify: `apps/www/src/lib/markdown-negotiation.test.ts`
- Modify: `apps/www/src/lib/machine-documents.ts`
- Modify: `apps/www/src/lib/machine-documents.test.ts`
- Modify: `apps/www/src/lib/site-manifest.ts`
- Modify: `apps/www/src/lib/site-manifest.test.ts`
- Modify: `apps/www/src/styles.css`

**Interfaces:**
- Produces: `<GlobalAgentIndexPage />` and `<GlobalAgentFactPage pageKey={AgentPageKey} />`.
- Produces: `globalAgentPageHead(pageKey?: AgentPageKey)`, with `noindex,follow` and the paired Human canonical.
- Produces: default HTML at `/agent` and `/agent/{key}`.
- Preserves: `Accept: text/markdown` at the same paths, `llms.txt`, `llms-full.txt`, and Human canonical negotiation.

- [ ] **Step 1: Write failing Human/Agent parity tests**

Create `global-agent-pages.test.tsx` with these contracts:

```tsx
for (const key of ["product", "approach", "research", "geo", "company", "diagnostic"] as const) {
	const markup = renderToStaticMarkup(<GlobalAgentFactPage pageKey={key} />);
	const facts = GLOBAL_ENGLISH_MACHINE_FACTS[key];
	expect(markup).toContain('data-edition="global-agent-en"');
	expect(markup).toContain('src="/brand/logos/yonaris-wordmark-navy.png"');
	expect(markup).toContain(`href="/${key}"`);
	expect(markup).toContain(facts.title);
	expect(markup).toContain(facts.currentScope);
	for (const claim of facts.claims) expect(markup).toContain(claim.text);
	for (const limitation of facts.limitations) expect(markup).toContain(limitation);
}
```

Require the Agent index to link all six companion pages and all eight global Human pages, and to label the active mode as Agent.

- [ ] **Step 2: Extend content negotiation tests before changing routes**

Add these cases to `markdown-negotiation.test.ts`:

```ts
expect(resolveMarkdownRequest(request("/agent", "text/markdown"))).toEqual({
	targetPath: "/llms.mdx/agent",
	variesOnAccept: true,
});
expect(resolveMarkdownRequest(request("/agent/product", "text/markdown"))).toEqual({
	targetPath: "/llms.mdx/site/en/product",
	variesOnAccept: true,
});
expect(resolveMarkdownRequest(request("/agent/product", "text/html"))).toEqual({ variesOnAccept: true });
```

Run both new test files. Expected: FAIL because the HTML components and Agent negotiation do not exist.

- [ ] **Step 3: Implement the branded Agent shell**

`GlobalAgentShell` renders the navy Logo on Paper, a visible `Human / Agent` control with Agent active, a `中文` language link to the existing `/zh` destination, and a compact fact-navigation list. Do not link to the unavailable `/zh/agent` route until Release 2.

Export this metadata helper from `global-agent-pages.tsx`:

```tsx
export function globalAgentPageHead(pageKey?: AgentPageKey) {
	const humanPath = pageKey ? getCorePath(pageKey, "en") : "/";
	const title = pageKey ? `${GLOBAL_ENGLISH_MACHINE_FACTS[pageKey].title} · Agent view | Yonaris` : "Yonaris Agent fact map";
	return {
		meta: [
			{ title },
			{ name: "robots", content: "noindex,follow" },
		],
		links: [{ rel: "canonical", href: siteHref(humanPath) }],
	};
}
```

Each fact page renders, in this order:

```tsx
<header>{/* Page purpose and Human canonical */}</header>
<section aria-labelledby="current-scope">{facts.currentScope}</section>
<section aria-labelledby="capabilities">{/* facts.claims */}</section>
<section aria-labelledby="boundaries">{/* facts.limitations */}</section>
<nav aria-label="Related facts">{/* six Agent companions */}</nav>
<footer>{/* locale and getCoreLastVerified(pageKey) */}</footer>
```

- [ ] **Step 4: Replace Markdown-only route handlers with HTML route components**

Each route module uses the existing key directly:

```tsx
export const Route = createFileRoute("/agent/product")({
	head: () => globalAgentPageHead("product"),
	component: () => <GlobalAgentFactPage pageKey="product" />,
});
```

`/agent` renders `<GlobalAgentIndexPage />` and uses `globalAgentPageHead()` without a page key. Remove the old unconditional `machineDocumentResponse` handlers from these seven public routes. Keep permanent Agent aliases unchanged.

- [ ] **Step 5: Extend negotiation and add the internal Agent-index document**

Add a map for `/agent` and the six companion paths in `markdown-negotiation.ts`. Default browser requests return HTML; Markdown-preferred GET/HEAD requests rewrite to `/llms.mdx/agent` or the existing `/llms.mdx/site/en/{key}` targets. Create `llms[.]mdx.agent.ts` to return `machineDocumentResponse(renderAgentIndex(), { language: "en" })`.

Update the machine route manifest so `/llms.mdx/agent` is covered by `markdownInternal.patterns`. Keep public Agent pages `noindex,follow` and outside the sitemap while making them visible in Human navigation.

- [ ] **Step 6: Style the Agent information surface**

Add `agent.css` and import it after `core.css`. Use the same palette and Logo, a maximum reading width of 78rem, a left fact directory at desktop, one-column order on mobile, and Signal Orange only for active mode, section index, focus, and verification marks. Do not reuse the Human cinematic hero or Bluefish-informed page rhythm.

- [ ] **Step 7: Run focused tests and commit**

Run:

```powershell
pnpm.cmd --filter @workspace/www exec vitest run --config vitest.config.ts src/components/site/global-en/agent/global-agent-pages.test.tsx src/lib/markdown-negotiation.test.ts src/lib/machine-documents.test.ts src/lib/site-manifest.test.ts src/components/site/global-en/global-english-shell.test.tsx
```

Expected: PASS.

Commit all replaced and generated route files together:

```powershell
git add apps/www/src/components/site/global-en/agent apps/www/src/routes/agent apps/www/src/routes/llms[.]mdx.agent.ts apps/www/src/lib/markdown-negotiation.ts apps/www/src/lib/markdown-negotiation.test.ts apps/www/src/lib/machine-documents.ts apps/www/src/lib/machine-documents.test.ts apps/www/src/lib/site-manifest.ts apps/www/src/lib/site-manifest.test.ts apps/www/src/styles/global-en/agent.css apps/www/src/styles.css apps/www/src/routeTree.gen.ts
git commit -m "publish the branded global Agent view"
```

### Task 8: Add release-level interaction, accessibility, responsive, and visual acceptance

**Files:**
- Create: `e2e/www-tests/global-english-r1.spec.ts`
- Delete: `e2e/www-tests/global-english-r0.spec.ts`
- Modify: `e2e/www-tests/content-negotiation.spec.ts`
- Modify: `apps/www/scripts/smoke-marketing.mjs`
- Modify: `apps/www/src/styles/global-en/core.test.ts`

**Interfaces:**
- Produces: one Playwright gate for eight Human routes plus seven Agent routes.
- Produces: smoke expectations in which Agent routes are HTML by default and Markdown when preferred.

- [ ] **Step 1: Write the failing Release 1 route and brand test**

The new E2E fixture uses these Human headlines:

```ts
const humanPages = [
	{ path: "/", headline: "AI is already answering questions about your brand.", graphic: "answer-studio" },
	{ path: "/product", headline: "Make AI market answers observable.", graphic: "scope-rings" },
	{ path: "/approach", headline: "Move from uncertainty to a reviewable next test.", graphic: "evidence-journey" },
	{ path: "/research", headline: "Evidence needs a scope, denominator, and boundary.", graphic: "evidence-explorer" },
	{ path: "/geo", headline: "See where your brand enters an AI answer.", graphic: "answer-relationship-map" },
	{ path: "/company", headline: "Evidence before conclusion.", graphic: "operating-model" },
	{ path: "/diagnostic", headline: "Request a focused AI market diagnostic.", graphic: "lead-form" },
	{ path: "/privacy", headline: "Privacy facts must be verified before collection starts.", graphic: "privacy-flow" },
] as const;
```

For every Human route, require one navy Logo in the header, one white Logo in the footer, `/agent` or the topic companion in the reading-mode control, one H1, one main, and the page-specific visual.

- [ ] **Step 2: Add failing Answer Studio and Product Workbench interaction tests**

Use role-based locators. Select `Why is a competitor being preferred?`, assert `data-question="competitor"`, then use ArrowRight and assert `sources`. On Product, select `Sources`, assert the workbench changes to `data-module="sources"`, and keyboard-select `Experiments`.

- [ ] **Step 3: Add failing Approach, Diagnostic, and Human/Agent tests**

- Approach: activate the `Inspect` stage and assert the corresponding article is current without checking scroll position.
- Diagnostic: intercept the external email-provider boundary in the server test, submit Name, Work email, and Company through the browser, assert exactly one `/api/diagnostic` request with the three visible fields plus honeypot, and show success only after a `202` response. Add the Chinese payload assertion for Name, Phone, and Company in the shared form suite.
- Human/Agent: from `/product`, follow Agent to `/agent/product`, verify the Agent mode is active and `Current scope` is visible, then follow Human back to `/product`.

- [ ] **Step 4: Update content-negotiation and smoke expectations**

Change Agent checks from unconditional Markdown to dual behavior:

```ts
const html = await request.get("/agent/product", { headers: { Accept: "text/html" } });
expect(html.headers()["content-type"]).toContain("text/html");
const markdown = await request.get("/agent/product", { headers: { Accept: "text/markdown" } });
expect(markdown.headers()["content-type"]).toContain("text/markdown");
expect(await markdown.text()).toContain("Human canonical: https://yonaris.com/product");
```

In `smoke-marketing.mjs`, move `/agent` and six companions from `MACHINE_ROUTES` into a new `AGENT_HTML_ROUTES`, include them in readable HTML and asset checks, and add an explicit Markdown-preferred loop over those routes.

- [ ] **Step 5: Add viewport, WCAG, reduced-motion, and visual evidence loops**

At minimum, run all Human routes at 1440×900 and 390×844 through `expectNoHorizontalOverflow` and `runWcagAa`. Run representative `/`, `/product`, `/approach`, `/agent`, and `/agent/product` at 320×740. With reduced motion, call `expectNoRunningAnimations` for all Human and Agent routes.

Add `@visual` captures with `captureQa` for every Human route at desktop and mobile plus Agent index and Agent Product at both viewports. Capture Answer Studio's `competitor`, Product's `sources`, and Diagnostic's validation, submitting, and confirmed-success states as named interaction states.

- [ ] **Step 6: Run the targeted Playwright gate and fix only Release 1 failures**

Run:

```powershell
pnpm.cmd exec playwright test --config=e2e/playwright.www.config.ts global-english-r1.spec.ts content-negotiation.spec.ts
```

Expected: PASS. Inspect every generated visual artifact; a technically passing but visually broken state fails this step.

- [ ] **Step 7: Run the CSS contract and commit the release gate**

Run:

```powershell
pnpm.cmd --filter @workspace/www exec vitest run --config vitest.config.ts src/styles/global-en/core.test.ts
```

Expected: PASS with edition scoping, approved palette usage, responsive rules, and reduced-motion rules intact.

Commit:

```powershell
git add e2e/www-tests/global-english-r1.spec.ts e2e/www-tests/global-english-r0.spec.ts e2e/www-tests/content-negotiation.spec.ts apps/www/scripts/smoke-marketing.mjs apps/www/src/styles/global-en/core.test.ts
git commit -m "add the global website release gate"
```

### Task 9: Complete the user-facing release record and push the verified branch

**Files:**
- Create: `.changeset/global-human-agent-release.md`
- Verify: all files changed by Tasks 1–8

**Interfaces:**
- Produces: a reviewable branch containing the complete global regional slice.
- Does not modify: Chinese Human page components or authenticated product behavior.

- [ ] **Step 1: Add the required user-facing changeset**

Create exactly:

```md
---
"@workspace/www": patch
---

Rebuild the global website with Yonaris branding, product-led interactions, and paired Human and Agent views.
```

- [ ] **Step 2: Run the focused unit verification**

```powershell
pnpm.cmd --filter @workspace/www exec vitest run --config vitest.config.ts src/content/site/global-en src/components/site/global-en src/lib/markdown-negotiation.test.ts src/lib/machine-documents.test.ts src/lib/site-manifest.test.ts src/styles/global-en/core.test.ts
```

Expected: PASS with no skipped Release 1 contract.

- [ ] **Step 3: Run the marketing type check and production build**

```powershell
pnpm.cmd --filter @workspace/www check-types
pnpm.cmd --filter @workspace/www build
```

Expected: both commands exit 0. If the route generator changes `apps/www/src/routeTree.gen.ts`, review and include only the expected Agent HTML/internal Markdown route changes.

- [ ] **Step 4: Re-run the Release 1 Playwright gate after the production build**

```powershell
pnpm.cmd exec playwright test --config=e2e/playwright.www.config.ts global-english-r1.spec.ts content-negotiation.spec.ts site-routing.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Run the restricted-marketing and route audits**

```powershell
pnpm.cmd --filter @workspace/www audit:legacy-marketing
pnpm.cmd --filter @workspace/www audit:site-manifest
```

Expected: both exit 0 with no restricted marketing content, reopened retired route, or manifest disagreement.

- [ ] **Step 6: Commit the changeset and any reviewed generated route tree**

```powershell
git add .changeset/global-human-agent-release.md apps/www/src/routeTree.gen.ts
git commit -m "record the global website release"
```

If `routeTree.gen.ts` is unchanged, add only the changeset. Do not create an empty commit.

- [ ] **Step 7: Confirm a clean worktree and push the branch**

```powershell
git status -sb
git log -8 --oneline
git push origin codex/homepage-product-stage
```

Expected: clean worktree after the push and the remote branch updated to the final verified commit. Report the commit hash and branch name so the user can perform the deployment setting they requested.

---

## Release 1 Acceptance Summary

Release 1 may be presented as ready only when all of the following are true:

1. The approved Yonaris wordmark assets appear in every global Human and Agent shell.
2. The global homepage, Product, Approach, Evidence, AI Visibility, Company, Diagnostic, and Privacy pages all use the new regional design system.
3. Answer Studio, Product Workbench, Evidence Journey, Evidence Explorer, Relationship Map, regional lead forms, and Human/Agent switching pass keyboard, touch, reduced-motion, and mobile checks.
4. `/agent` and six companion routes return branded HTML to browser requests and the paired Markdown facts when `text/markdown` is preferred.
5. Human and Agent factual fields remain sourced from the same content modules.
6. No unsupported proof or restricted marketing content enters HTML, metadata, Markdown, tests, or built assets.
7. The focused unit suite, type check, production build, Playwright gate, audits, and branch push all succeed.
