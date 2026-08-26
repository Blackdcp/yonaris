# Yonaris Site 06 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current marketing experience with the approved Site 06 visual, narrative, interaction, form, and Human/Agent system and ship it through the established production path.

**Architecture:** Keep the existing TanStack Start SSR, route contract, email delivery, content negotiation, and deployment gates. Replace the two legacy page skins with a shared Site 06 shell and focused interaction components, while English and Chinese retain independent copy modules. Human pages remain canonical; machine surfaces render the same fact records in alternate HTML, Markdown, and JSON-LD forms.

**Tech Stack:** React 19, TanStack Start/Router, Vite 8, TypeScript 7, CSS, Vitest, Playwright, Resend

**Spec:** `docs/superpowers/specs/2026-08-27-yonaris-site-06-design.md`

## Global Constraints

- The company category is exactly “AI-native MarTech infrastructure built for decisions made by people and shaped by agents”; Chinese meaning must remain equivalent.
- Keep canonical Human routes `/`, `/product`, `/approach`, `/geo`, `/company`, `/diagnostic`, `/privacy` and their `/zh` equivalents for this release.
- English and Chinese share one visual system but use independently written narrative.
- Use the existing Yonaris wordmarks and Site 06 colours: `#071724`, `#0d2232`, `#101a25`, `#43515d`, `#f2ede3`, `#fbf8f1`, `#ef5a1a`, `#c9874d`.
- Desktop H1 is `clamp(38px, 4vw, 48px)`; orange remains a focus accent and never becomes a large background field.
- No decorative arrow glyphs, numbered process rails, giant poster type, generic equal-card walls, fake metrics, fake customer outcomes, or internal implementation copy on customer pages.
- Every interactive state is keyboard reachable, uses correct ARIA, has visible focus, and respects `prefers-reduced-motion`.
- English lead form has exactly Name, Work email, Company; Chinese has exactly 姓名、电话、公司; success appears only after provider acceptance.
- Human pages are SSR-visible canonical pages. Machine HTML, Markdown, catalog, and JSON-LD use the same facts, evidence, boundaries, stable IDs, and real Human anchors.
- Do not claim guaranteed ranking, inclusion, retrieval, citation, real-time automation, or a customer result.
- Preserve all existing security controls, content negotiation, GET/HEAD contracts, redirects, and production deployment gates.

---

### Task 1: Shared Site 06 visual and interaction foundation

**Files:**
- Create: `apps/www/src/components/experience/shared/site-06-shell.tsx`
- Create: `apps/www/src/components/experience/shared/orbit-field.tsx`
- Create: `apps/www/src/components/experience/shared/reading-lens.tsx`
- Create: `apps/www/src/components/experience/shared/evidence-inspector.tsx`
- Create: `apps/www/src/components/experience/shared/review-switch.tsx`
- Create: `apps/www/src/components/experience/shared/site-06-foundation.test.tsx`
- Create: `apps/www/src/styles/experience/site-06.css`
- Modify: `apps/www/src/styles.css`
- Modify: `apps/www/src/styles.test.ts`

**Interfaces:**
- Produces `Site06Shell(props: { locale: "en" | "zh"; pageKey: HumanPageKey; children: ReactNode; tone?: "dark" | "paper" })`.
- Produces `OrbitField(props: { label: string; children: ReactNode; interactive?: boolean })`.
- Produces `ReadingLens(props: { locale: "en" | "zh"; records: readonly ReadingRecord[]; initialId: string })`, where `ReadingRecord` is `{ id: string; prompt: string; human: string; meaning: string; fact: string; evidence: string; boundary: string; stableId: string }`.
- Produces `EvidenceInspector(props: { records: readonly EvidenceRecord[]; initialId: string })`, where `EvidenceRecord` is `{ id: string; label: string; answer: ReactNode; source: string; boundary: string; effect: string }`.
- Produces `ReviewSwitch(props: { locale: "en" | "zh"; question: string; states: readonly ReviewRecord[]; initialId: string })`, where `ReviewRecord` is `{ id: string; label: string; answer: string; evidence: string; judgment: string; action: string }`.
- Tasks 2–4 consume these exports without duplicating their state or tab semantics.

- [ ] **Step 1: Write the failing shared-foundation test**

```tsx
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { OrbitField } from "./orbit-field";
import { ReadingLens } from "./reading-lens";

describe("Site 06 shared foundation", () => {
  it("renders one meaningful orbit and an accessible dual reading", () => {
    const lens = renderToStaticMarkup(<ReadingLens locale="en" initialId="scope" records={[{
      id: "scope", prompt: "What is the scope?", human: "Human context", meaning: "Decision meaning",
      fact: "Canonical fact", evidence: "Public company statement", boundary: "No outcome guarantee",
      stableId: "yonaris.scope.martech-system",
    }]} />);
    const orbit = renderToStaticMarkup(<OrbitField label="Shared public fact"><p>Fact</p></OrbitField>);
    expect(lens).toContain('role="tablist"');
    expect(lens).toContain("For people");
    expect(lens).toContain("For agents");
    expect(lens).toContain("Fact");
    expect(lens).toContain("Evidence");
    expect(lens).toContain("Boundary");
    expect(lens).toContain("Stable ID");
    expect(orbit.match(/data-orbit-ring=/g) ?? []).toHaveLength(3);
  });
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `pnpm --filter @workspace/www exec vitest run src/components/experience/shared/site-06-foundation.test.tsx`

Expected: FAIL because the Site 06 modules do not exist.

- [ ] **Step 3: Add the shared components with semantic state**

Implement the exact interfaces above. Use existing `useRovingTabs` for tab key handling. `OrbitField` renders exactly three rings and only applies pointer response when `interactive` is true. `Site06Shell` renders skip link, logo, locale-specific primary navigation, prominent Human/Agent switch, mobile navigation, one `main`, and footer.

- [ ] **Step 4: Add the failing style contract**

Add assertions to `styles.test.ts`:

```ts
it("locks the Site 06 visual limits and motion fallback", () => {
  const css = read("styles/experience/site-06.css");
  expect(css).toContain("--site-navy: #071724");
  expect(css).toContain("--site-orange: #ef5a1a");
  expect(css).toContain("font-size: clamp(38px, 4vw, 48px)");
  expect(css).toContain("@media (prefers-reduced-motion: reduce)");
  expect(css).not.toMatch(/animation(?:-iteration-count)?\s*:[^;{}]*\binfinite\b/i);
});
```

Run: `pnpm --filter @workspace/www exec vitest run src/styles.test.ts`

Expected: FAIL because `site-06.css` is not imported or does not yet contain the contract.

- [ ] **Step 5: Implement the shared CSS and verify GREEN**

Create scoped `.site-06` rules for the approved tokens, shell, cinematic hero, evidence document, orbit, tabs, focus states, desktop/mobile layouts, and reduced-motion overrides. Import it from `styles.css`. Run:

`pnpm --filter @workspace/www exec vitest run src/components/experience/shared/site-06-foundation.test.tsx src/styles.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/www/src/components/experience/shared apps/www/src/styles.css apps/www/src/styles/experience/site-06.css apps/www/src/styles.test.ts
git commit -m "build the shared Site 06 experience"
```

---

### Task 2: English Site 06 pages and approved photography

**Files:**
- Modify: `apps/www/src/content/experience/global-copy.ts`
- Modify: `apps/www/src/components/experience/global/global-pages.tsx`
- Modify: `apps/www/src/components/experience/global/global-shell.tsx`
- Replace: `apps/www/src/components/experience/global/global-scenes.tsx`
- Modify: `apps/www/src/components/experience/global/global-experience.test.tsx`
- Add: `apps/www/public/brand/site-06/conference-room.jpg`
- Add: `apps/www/public/brand/site-06/business-walk.jpg`
- Add: `apps/www/public/brand/site-06/glass-venue.jpg`
- Delete after consumers migrate: `apps/www/src/components/experience/global/global-home-review.tsx`
- Delete after CSS import removal: `apps/www/src/styles/experience/global.css`

**Interfaces:**
- Consumes all Task 1 components.
- Preserves `GLOBAL_PAGES: Record<HumanPageKey, () => ReactNode>` for route modules and generation tests.
- `GlobalShell` becomes a thin compatibility wrapper around `Site06Shell`.
- Produces `EN_READING_RECORDS`, `EN_PLATFORM_RECORDS`, and `EN_REVIEW_STATES` for Task 4 to reference when validating the machine fact source.

- [ ] **Step 1: Replace old English experience assertions with failing Site 06 outcomes**

The test must assert exact page identity and user-visible outcomes:

```tsx
it("publishes the approved English narrative on every primary page", () => {
  expect(text("home")).toContain("See what buyers are being told before the first conversation.");
  expect(text("product")).toContain("See what shaped the shortlist.");
  expect(text("approach")).toContain("Proof should be something your team can review.");
  expect(text("company")).toContain("The same company should remain clear to people and agents.");
  expect(text("diagnostic")).toContain("Tell us who to contact. We’ll begin with the buying decision.");
});

it("keeps rejected template patterns out of the English site", () => {
  const output = keys.map(markupFor).join("\n");
  expect(output).not.toMatch(/[↗→]/);
  expect(output).not.toMatch(/>0[1-9]</);
  expect(output).not.toContain("Explore global markets");
});
```

Retain assertions for skip link, one `main`, two wordmarks, same-topic locale switch, exactly three visible lead fields, and truthful illustrative labels.

- [ ] **Step 2: Run the English test and verify RED**

Run: `pnpm --filter @workspace/www exec vitest run src/components/experience/global/global-experience.test.tsx`

Expected: FAIL on old copy, old arrows, old numbered rails, and missing Site 06 interactions.

- [ ] **Step 3: Copy the approved photography**

Copy the three binary files from the approved prototype directory into `apps/www/public/brand/site-06/` with the filenames in the Files block. Do not alter or regenerate the wordmark. Record credits in an unobtrusive caption in the page that uses each image.

- [ ] **Step 4: Rebuild English home, Platform, Evidence, and Human + Agent**

Translate the approved prototype into React rather than embedding its HTML. Home uses the cinematic conference-room hero, dual-reading orbit, buying-question evidence document, case file, baseline/retest, and contact close. Product uses the dossier plus `EvidenceInspector`. Approach uses business-walk photography plus `ReviewSwitch`. Company uses `ReadingLens` for category, purpose, and scope and links to the corresponding Agent surface.

- [ ] **Step 5: Rebuild English across-markets, contact, and privacy pages**

The across-markets page treats market/language/context as system conditions, not a customer-origin story. Contact renders `LeadForm locale="en"` and no extra visible fields. Privacy remains factual and compact. Every page retains one H1, page data markers, and conversion path.

- [ ] **Step 6: Remove retired English visual files and verify GREEN**

Remove imports and files listed for deletion only after no references remain. Run:

`pnpm --filter @workspace/www exec vitest run src/components/experience/global/global-experience.test.tsx src/components/experience/site-generation.test.tsx src/styles.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/www/src/content/experience/global-copy.ts apps/www/src/components/experience/global apps/www/src/styles/experience apps/www/public/brand/site-06
git commit -m "rebuild the English marketing experience"
```

---

### Task 3: Chinese Site 06 local narrative and interactions

**Files:**
- Modify: `apps/www/src/content/experience/china-copy.ts`
- Modify: `apps/www/src/components/experience/china/china-pages.tsx`
- Modify: `apps/www/src/components/experience/china/china-shell.tsx`
- Replace: `apps/www/src/components/experience/china/china-scenes.tsx`
- Modify: `apps/www/src/components/experience/china/china-experience.test.tsx`
- Delete after CSS import removal: `apps/www/src/styles/experience/china.css`

**Interfaces:**
- Consumes Task 1 components and Task 2 shared assets.
- Preserves `CHINA_PAGES` with all seven `HumanPageKey` entries.
- `ChinaShell` becomes a thin compatibility wrapper around `Site06Shell`.
- Produces Chinese anxiety records, system-node records, breakdown replay records, and dual-reading records as independently written content.

- [ ] **Step 1: Write failing Chinese narrative and interaction assertions**

```tsx
it("starts from Chinese business anxiety instead of roles", () => {
  const home = render("home");
  expect(home).toContain("AI 正在替客户认识你、比较你，也可能误解你。");
  for (const phrase of ["没进备选", "核心优势被说偏", "竞品先被推荐", "预算不知道该投哪里", "结论失效"])
    expect(home).toContain(phrase);
  expect(home).not.toMatch(/市场总监|品牌负责人|创始人|销售团队/);
});

it("renders the system and public breakdown contracts", () => {
  const system = render("product");
  for (const node of ["市场问题", "品牌事实", "内容与渠道", "AI 与市场观测", "客户行为", "行动与复核"])
    expect(system).toContain(node);
  const breakdown = render("approach");
  expect(breakdown).toContain("公开方法演示 · 示例场景，不代表客户结果。");
  expect(breakdown).toContain("已变化");
  expect(breakdown).toContain("未变化");
  expect(breakdown).toContain("无法归因");
});
```

Also assert no arrow glyphs, numbered step rails, origin/destination service framing, role segmentation, or invented result language.

- [ ] **Step 2: Run the Chinese test and verify RED**

Run: `pnpm --filter @workspace/www exec vitest run src/components/experience/china/china-experience.test.tsx`

Expected: FAIL on old narrative, old dual-track markets, arrows, and numbered panels.

- [ ] **Step 3: Rebuild the Chinese home and system page**

Home uses the approved H1, anxiety selector, business-impact core, evidence connection, Human/Agent reading, and concise contact close. Product uses the six-node relationship map as its hero and primary interaction. The copy must explain why a disconnected node wastes budget or breaks a decision, without describing internal design or unverified automation.

- [ ] **Step 4: Rebuild breakdown, Human + Agent, and across-markets pages**

Approach uses the de-identified four-state replay. Company uses the same canonical facts as the English category/purpose/scope records with Chinese decision context. Across-markets changes only market, language, local category wording, alternatives, and evidence conditions; it does not identify the customer by where the company is entering from or going to.

- [ ] **Step 5: Rebuild Chinese contact and privacy pages**

Contact uses “带一道你最不想让 AI 答错的问题来。” and `LeadForm locale="zh"`. Privacy stays factual and concise. Keep exactly three visible fields and the hidden abuse field.

- [ ] **Step 6: Remove the retired Chinese CSS and verify GREEN**

Run:

`pnpm --filter @workspace/www exec vitest run src/components/experience/china/china-experience.test.tsx src/components/experience/site-generation.test.tsx src/styles.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/www/src/content/experience/china-copy.ts apps/www/src/components/experience/china apps/www/src/styles/experience
git commit -m "rebuild the Chinese marketing experience"
```

---

### Task 4: Canonical facts, Agent surfaces, SEO, and customer-facing form copy

**Files:**
- Modify: `apps/www/src/content/experience/agent-facts.ts`
- Modify: `apps/www/src/content/experience/copy-contract.test.ts`
- Modify: `apps/www/src/components/experience/agent/agent-pages.tsx`
- Modify: `apps/www/src/components/experience/agent/agent-experience.test.tsx`
- Modify: `apps/www/src/styles/experience/agent.css`
- Modify: `apps/www/src/lib/machine-documents.ts`
- Modify: `apps/www/src/lib/machine-documents.test.ts`
- Modify: `apps/www/src/lib/seo.ts`
- Modify: `apps/www/src/components/experience/shared/lead-form.tsx`
- Modify: `apps/www/src/components/experience/shared/lead-form.test.tsx`
- Modify: `AGENTS.md`

**Interfaces:**
- Uses the category, purpose, and scope facts exported by the Human content source; no separate wording fork.
- `buildAgentEntityGraph` keeps its public signature but item `@id`/`url` resolve to `${humanPath}#${fact.id}`.
- Agent HTML renders `id={fact.id}` on every public fact and links evidence to the same Human anchor.
- Lead delivery schema, endpoint, idempotency, rate limit, and provider call signatures remain unchanged.

- [ ] **Step 1: Write failing canonical-fact and Agent-anchor tests**

```tsx
it("renders stable facts without template rails", () => {
  const html = renderAgent("en", "company");
  expect(html).toContain('id="yonaris.category.ai-native-martech"');
  expect(html).toContain("AI-native MarTech infrastructure built for decisions made by people and shaped by agents");
  expect(html).not.toMatch(/[↗→↳]/);
  expect(html).not.toMatch(/>0[1-9]</);
});
```

Add a machine-document assertion that every fact ListItem `@id` begins with the Human canonical plus `#`, and that `SITE_URL` is the only configured origin source.

- [ ] **Step 2: Run Agent and machine tests and verify RED**

Run: `pnpm --filter @workspace/www exec vitest run src/components/experience/agent/agent-experience.test.tsx src/lib/machine-documents.test.ts src/content/experience/copy-contract.test.ts`

Expected: FAIL because old facts, agent-only fragment IDs, and old visual rails remain.

- [ ] **Step 3: Align fact records and machine outputs**

Rewrite public fact groups around category, purpose, system scope, evidence discipline, market context, delivery boundary, and contact/privacy. Human and machine outputs must use one record per fact. Replace the hard-coded origin with the same canonical origin builder used by `seo.ts`. Add real fact IDs to Agent HTML and Human evidence anchors. Keep Agent HTML/machine responses as alternate `noindex,follow` representations of the canonical Human page.

- [ ] **Step 4: Rebuild the Agent visual surface in Site 06 language**

Remove numbered directory rails and decorative arrows. Use a readable fact directory, strong Human/Agent return control, meaningful orbit only on the fact reading, and the same navy/paper/orange hierarchy. Retain language, scope, review date, source, boundary, Markdown, catalog, GET/HEAD, and content negotiation affordances.

- [ ] **Step 5: Write failing customer-facing lead-copy tests**

```tsx
it("keeps lead feedback simple and does not expose a personal fallback address", () => {
  const failed = renderLead({ locale: "en", submission: "unconfirmed" });
  expect(failed).toContain("We couldn’t send that yet. Your details are still here—please try again.");
  expect(failed).not.toContain("mailto:");
  expect(failed).not.toMatch(/[↗→]/);
});
```

Run: `pnpm --filter @workspace/www exec vitest run src/components/experience/shared/lead-form.test.tsx`

Expected: FAIL on transport-oriented copy, personal fallback address, and arrow suffix.

- [ ] **Step 6: Simplify form feedback without changing delivery truth**

Use “Thanks. We received your request and will be in touch.” / “已收到，我们会尽快联系你。” only after the existing confirmed result. Failure preserves entered values and offers retry. Remove the personal fallback address and transport implementation explanation from normal UI. Keep exactly three visible fields and current server validation.

- [ ] **Step 7: Remove stale internal positioning from the repository guide**

Update `AGENTS.md` so its product description matches the approved category and current app layout. Do not rename runtime compatibility identifiers in this website release; do not mention third-party project ancestry or public code-sharing positioning.

- [ ] **Step 8: Verify GREEN and commit**

Run:

`pnpm --filter @workspace/www exec vitest run src/components/experience/agent/agent-experience.test.tsx src/lib/machine-documents.test.ts src/content/experience/copy-contract.test.ts src/components/experience/shared/lead-form.test.tsx`

Expected: PASS.

```bash
git add AGENTS.md apps/www/src/content/experience apps/www/src/components/experience/agent apps/www/src/components/experience/shared/lead-form.tsx apps/www/src/components/experience/shared/lead-form.test.tsx apps/www/src/styles/experience/agent.css apps/www/src/lib/machine-documents.ts apps/www/src/lib/machine-documents.test.ts apps/www/src/lib/seo.ts
git commit -m "align public facts and lead delivery copy"
```

---

### Task 5: Production integration, browser acceptance, and release gates

**Files:**
- Modify: `apps/www/src/components/experience/site-generation.test.tsx`
- Modify: `apps/www/src/lib/site-navigation.test.ts`
- Modify: `apps/www/src/lib/site-manifest.test.ts` only if approved navigation labels require it
- Modify: `e2e/www-tests/dual-region-release.spec.ts`
- Modify: `apps/www/scripts/smoke-marketing.mjs`
- Generated by TanStack tooling: `apps/www/src/routeTree.gen.ts`
- Create: `.changeset/site-06-marketing.md`

**Interfaces:**
- All seven route pairs remain server-rendered and release-gated.
- Production smoke validates raw HTML, not hydrated DOM only.
- Browser acceptance covers one meaningful interaction on English home/product/approach/company and Chinese home/product/approach, both contact forms, visible Human/Agent control, mobile overflow, and reduced motion.

- [ ] **Step 1: Update integration tests first and verify RED**

Add exact release assertions:

```ts
await expect(page.getByRole("heading", { level: 1, name: "See what buyers are being told before the first conversation." })).toBeVisible();
await page.getByRole("link", { name: "Platform" }).click();
await expect(page.getByRole("heading", { level: 1, name: "See what shaped the shortlist." })).toBeVisible();
await page.goto(`${baseURL}/zh`);
await expect(page.getByRole("heading", { level: 1, name: "AI 正在替客户认识你、比较你，也可能误解你。" })).toBeVisible();
```

The smoke script must validate every core route pair, one H1, exact `lang`, canonical, `en`/`zh-CN`/`x-default`, JSON-LD parseability, machine alternate links, and no rejected template glyphs in raw HTML.

Run the focused integration test command documented by the package; expected initial result is FAIL until selectors and generated route output match the rebuilt pages.

- [ ] **Step 2: Generate routes and make integration tests pass**

Run `pnpm --filter @workspace/www build` once to regenerate the route tree. Fix only genuine integration gaps revealed by the updated tests. Do not restore old data markers solely to satisfy obsolete assertions.

- [ ] **Step 3: Run focused unit, type, build, and raw-response verification**

Run in order:

1. `pnpm --filter @workspace/www exec vitest run`
2. `pnpm --filter @workspace/www check-types`
3. `pnpm --filter @workspace/www build`
4. Start `pnpm --filter @workspace/www start` with production-like `VITE_SITE_URL` and required non-secret placeholders.
5. Run `node apps/www/scripts/smoke-marketing.mjs http://127.0.0.1:3001`.

Expected: all tests pass, type check exits 0, build exits 0, smoke exits 0.

- [ ] **Step 4: Run browser visual and interaction acceptance**

At widths 1440, 1280, 390, and 360, capture English home/product/approach/company/contact and Chinese home/product/approach/contact. Verify:

- zero horizontal overflow;
- logo visible in header and footer;
- no headline exceeds the approved scale;
- orange appears only as a restrained accent;
- every interactive state changes meaningful content;
- keyboard tabs and focus order work;
- the Human/Agent control is prominent;
- reduced motion disables photo/orbit movement;
- forms show exactly three visible fields.

- [ ] **Step 5: Run public-output and release-policy gates**

Run existing repository commands:

1. `pnpm audit:public-output`
2. `pnpm test:public-output-policy`
3. `pnpm verify:public-output-release`

Expected: all exit 0 with no retired attribution or retired public sections in generated output.

- [ ] **Step 6: Add changeset and commit**

Create `.changeset/site-06-marketing.md`:

```md
---
"@workspace/www": patch
---

Rebuild the bilingual Yonaris marketing experience for people and agents.
```

```bash
git add apps/www e2e/www-tests/dual-region-release.spec.ts .changeset/site-06-marketing.md
git commit -m "verify the Site 06 production release"
```

- [ ] **Step 7: Push and observe the established deployment**

Push `codex/site-production-06` to `origin`, use the repository’s established marketing deployment workflow, and observe its checks to completion. Verify production GET and HEAD responses for `/`, `/product`, `/company`, `/zh`, `/zh/product`, `/agent/company.md`, `/agent/catalog.json`, `/robots.txt`, and `/sitemap.xml`. Do not report publication complete until the live site returns the new copy and assets.

