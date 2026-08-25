# Yonaris 90-Point Experience and Agent-Readable Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a production release that raises both regional Human experiences to the 90-point rubric, gives the China edition a native Chinese ToB narrative, and makes every Agent representation reliably discoverable and retrievable without 5xx negotiation failures.

**Architecture:** Keep the existing seven-topic route map and two regional shells. Build a single typed public-fact catalogue that renders Agent HTML, Markdown, and JSON-LD; add one reusable roving-tab hook for interactive scenes; then replace the weak Global and China chapters with evidence-led regional compositions. Human pages remain the indexed canonicals while Agent representations remain crawlable and explicitly linked.

**Tech Stack:** React 19, TypeScript 7, TanStack Start/Router, Nitro, CSS, Vitest, React DOM server rendering, pnpm, Docker/Caddy production deployment.

**Spec:** `docs/superpowers/specs/2026-08-25-experience-90-agent-readable-design.md`

## Global Constraints

- Global and China remain independently written editions, not translations.
- Human and Agent surfaces remain paired for all seven topics in both locales.
- The Yonaris wordmark and Signal Orange `#ff6a00` remain primary brand assets.
- Public output must not mention internal research references, implementation ancestry, prohibited origin/licensing language, or build-process commentary.
- No customer logos, performance figures, coverage counts, response-time promises, certifications, or case-study claims may be invented.
- Global lead fields remain name, work email, and company. China lead fields remain name, phone, and company.
- Retired publication and internal paths remain unavailable.
- Human pages remain `index,follow` self-canonicals; Agent HTML, Markdown, and JSON-LD remain crawlable `noindex,follow` alternatives and stay out of the Human sitemap.
- Mobile functional text is at least `0.75rem`, mobile body text is at least `0.875rem` with at least `1.4` line height, and mobile interactive targets are at least `44px` in both dimensions.
- State motion lasts `180ms` to `280ms`, explains a real state change, and has a static reduced-motion equivalent.
- The release is complete only after production deployment and live-domain verification.

---

### Task 1: Typed Agent Catalogue and Machine Documents

**Files:**
- Modify: `apps/www/src/content/experience/types.ts`
- Modify: `apps/www/src/content/experience/agent-facts.ts`
- Modify: `apps/www/src/components/experience/agent/agent-pages.tsx`
- Modify: `apps/www/src/styles/experience/agent.css`
- Modify: `apps/www/src/lib/machine-documents.ts`
- Modify: `apps/www/src/lib/seo.ts`
- Modify: `apps/www/src/components/experience/agent/agent-experience.test.tsx`
- Modify: `apps/www/src/lib/machine-documents.test.ts`
- Modify: `apps/www/src/editions/global-en/edition.test.ts`
- Modify: `apps/www/src/editions/zh-cn/edition.test.ts`

**Interfaces:**
- Consumes: `HumanPageKey`, `ExperienceLocale`, `siteHref(path)` and `getCoreLastVerified(key)`.
- Produces: `AgentTopic`, `AgentFactGroup`, and `AgentFact` with stable IDs; `agentMarkdownPath(locale, key)`; `agentCatalogPath(locale)`; `renderCoreMarkdown(key, locale)`; `renderAgentCatalog(locale)`; `machineDiscoveryLinks(locale, key)`; stable JSON-LD graph builders used by both edition heads and Task 2 routes.

- [ ] **Step 1: Write failing catalogue-contract tests**

Add assertions that every one of the fourteen locale/topic records has stable topic, group, and claim IDs; a language, summary, Human path, Agent path, Markdown path, review date, scope, reviewer, and at least one limitation. Assert that each claim has a visible value and an evidence URL equal to the paired Human page.

```ts
for (const locale of ["en", "zh"] as const) {
	for (const key of HUMAN_PAGE_KEYS) {
		const topic = getAgentTopic(locale, key);
		expect(topic.id).toBe(`${locale}.${key}`);
		expect(topic.agentPath).toBe(key === "home" ? `/${locale === "zh" ? "zh/" : ""}agent` : `/${locale === "zh" ? "zh/" : ""}agent/${key}`);
		const localePrefix = locale === "zh" ? "/zh" : "";
		expect(topic.markdownPath).toBe(
			key === "home" ? `${localePrefix}/agent/index.md` : `${localePrefix}/agent/${key}.md`,
		);
		expect(topic.lastReviewed).toMatch(/^\d{4}-\d{2}-\d{2}$/);
		expect(topic.scope.length).toBeGreaterThan(20);
		expect(topic.limitations.length).toBeGreaterThan(0);
		for (const group of topic.groups) {
			expect(group.id).toMatch(/^[a-z0-9.-]+$/);
			for (const fact of group.facts) {
				expect(fact.id).toMatch(new RegExp(`^${key}\\.`));
				expect(fact.value.trim()).not.toBe("");
				expect(fact.evidenceUrl).toBe(topic.humanPath);
			}
		}
	}
}
```

- [ ] **Step 2: Run focused tests and capture the expected red state**

Run: `pnpm --filter @workspace/www test -- src/lib/machine-documents.test.ts src/components/experience/agent/agent-experience.test.tsx`

Expected: FAIL because `getAgentTopic`, stable IDs, typed facts, scope, limitations, and machine paths do not exist.

- [ ] **Step 3: Introduce the typed fact model and migrate all facts**

Define these exact public shapes in `types.ts` and make `AGENT_FACTS` satisfy them without type assertions that hide missing fields:

```ts
export interface AgentFact {
	readonly id: string;
	readonly value: string;
	readonly evidenceUrl: string;
}

export interface AgentFactGroup {
	readonly id: string;
	readonly title: string;
	readonly facts: readonly AgentFact[];
}

export interface AgentTopic {
	readonly id: string;
	readonly locale: ExperienceLocale;
	readonly language: "en" | "zh-CN";
	readonly title: string;
	readonly summary: string;
	readonly humanPath: string;
	readonly agentPath: string;
	readonly markdownPath: string;
	readonly lastReviewed: string;
	readonly reviewedBy: "Yonaris";
	readonly scope: string;
	readonly limitations: readonly string[];
	readonly groups: readonly AgentFactGroup[];
}
```

Use `2026-08-25` as the public review date. Keep limitations factual and bounded: observations depend on the selected question, market, language, time, and upstream surface; citations can only be shown when the observed answer exposes them; no wording promises rankings, traffic, recommendations, or automatic answer changes.

- [ ] **Step 4: Render equivalent Agent HTML and Markdown from the catalogue**

Make Agent HTML use one `article`, a metadata `dl`, `data-fact-group={group.id}`, and `data-claim-id={fact.id}`. Expose the Human canonical, Markdown document, JSON-LD catalogue, language, review date, reviewer, scope, and limitations visibly. Make Markdown follow this exact section order: H1, blockquote summary, metadata lines, `## Scope`, fact groups, `## Limitations`, `## Related`.

```ts
export function agentMarkdownPath(locale: ExperienceLocale, key: HumanPageKey): string;
export function agentCatalogPath(locale: ExperienceLocale): "/agent/catalog.json" | "/zh/agent/catalog.json";
export function getAgentTopic(locale: ExperienceLocale, key: HumanPageKey): AgentTopic;
export function renderAgentCatalog(locale: ExperienceLocale): string;
```

The short `llms.txt` directory must link directly to the fourteen `.md` documents, with an H1, a blockquote summary, H2 locale sections, and colon-separated link descriptions. `llms-full.txt` must render the same claim IDs and values as the HTML/Markdown catalogue.

- [ ] **Step 5: Build a stable connected JSON-LD graph and discovery head entries**

Replace page-varying Organization records with stable `@id` nodes. The graph must contain `Organization`, `WebSite`, the current Human `WebPage`, and an `ItemList` whose entries match visible Agent facts. Do not place `inLanguage` on `Organization`.

```ts
export function publicEntityGraph(options: {
	locale: ExperienceLocale;
	pageKey: HumanPageKey;
}): { type: "application/ld+json"; children: string };

export function machineDiscoveryLinks(locale: ExperienceLocale, pageKey: HumanPageKey) {
	return [
		{ rel: "alternate", type: "text/markdown", href: siteHref(agentMarkdownPath(locale, pageKey)) },
		{ rel: "alternate", type: "application/ld+json", href: siteHref(agentCatalogPath(locale)) },
		{ rel: "describedby", type: "text/plain", href: siteHref("/llms.txt") },
	] as const;
}
```

Add the discovery links and `publicEntityGraph` script to both Human edition heads. Agent route heads must include the paired Human canonical plus the same machine discovery links while preserving `noindex,follow`.

- [ ] **Step 6: Run focused tests and commit**

Run: `pnpm --filter @workspace/www test -- src/lib/machine-documents.test.ts src/components/experience/agent/agent-experience.test.tsx src/editions/global-en/edition.test.ts src/editions/zh-cn/edition.test.ts`

Expected: PASS with all fourteen topics sharing stable IDs, equivalent values, discovery links, and valid JSON-LD graphs.

Commit:

```bash
git add apps/www/src/content/experience apps/www/src/components/experience/agent apps/www/src/styles/experience/agent.css apps/www/src/lib/machine-documents.ts apps/www/src/lib/seo.ts apps/www/src/editions
git commit -m "feat publish typed agent fact catalogue"
```

### Task 2: Stable Machine Routes and Correct HTTP Negotiation

**Files:**
- Create: `apps/www/src/routes/agent.$.ts`
- Create: `apps/www/src/routes/zh/agent.$.ts`
- Modify: `apps/www/src/lib/machine-response.ts`
- Modify: `apps/www/src/lib/markdown-negotiation.ts`
- Modify: `apps/www/src/server.ts`
- Modify: `apps/www/src/routes/llms[.]txt.ts`
- Modify: `apps/www/src/routes/llms-full[.]txt.ts`
- Modify: `apps/www/src/lib/machine-response.test.ts`
- Modify: `apps/www/src/lib/markdown-negotiation.test.ts`
- Modify: `apps/www/src/lib/machine-documents.test.ts`
- Modify: `apps/www/scripts/smoke-marketing.mjs`

**Interfaces:**
- Consumes: catalogue renderers and path helpers from Task 1.
- Produces: stable `.md` and `catalog.json` endpoints, `MachineLinkSet`, `machineDocumentResponse(body, options)`, `notAcceptableResponse()`, and a negotiation result that is exactly one of `html`, `markdown`, `redirect`, or `not-acceptable`.

- [ ] **Step 1: Add the full request matrix as failing tests**

For every Human and Agent canonical path, cover `GET` and `HEAD` with no explicit Accept, `*/*`, `text/html`, `text/markdown`, `text/*`, `text/markdown;q=0`, mixed q values, `application/json`, and `text/html;q=0,text/markdown;q=0`. Add trailing-slash assertions that canonical redirects happen before representation selection.

```ts
expect(resolveRepresentation(request("/agent/product", "text/*"))).toEqual({ kind: "markdown", targetPath: "/llms.mdx/agent/product", variesOnAccept: true });
expect(resolveRepresentation(request("/agent/product", "application/json"))).toEqual({ kind: "not-acceptable", variesOnAccept: true });
expect(resolveRepresentation(request("/agent/product", "text/markdown;q=0"))).toEqual({ kind: "not-acceptable", variesOnAccept: true });
expect(resolveRepresentation(request("/agent/product/", "text/markdown"))).toEqual({ kind: "redirect", location: "/agent/product", variesOnAccept: true });
```

Assert every response is below 500, `HEAD` has an empty body, and Markdown/JSON responses contain `Content-Language`, `Content-Location`, `Cache-Control`, `Vary: Accept`, `X-Robots-Tag`, and Link relations for canonical, alternate, locale peer, and describedby.

- [ ] **Step 2: Run focused tests and capture the expected red state**

Run: `pnpm --filter @workspace/www test -- src/lib/markdown-negotiation.test.ts src/lib/machine-response.test.ts src/lib/machine-documents.test.ts`

Expected: FAIL for `text/*`, unsupported media, q=0 handling, trailing-slash consistency, stable document URLs, and response Link headers.

- [ ] **Step 3: Replace the boolean preference with an explicit representation resolver**

Implement an exported discriminated union. A missing Accept and `*/*` select HTML; `text/*` selects Markdown for mapped content; explicit HTML wins ties; unsupported types return 406; q=0 never selects that representation; a mapped trailing slash returns a redirect before inspecting Accept.

```ts
export type RepresentationResolution =
	| { kind: "html"; variesOnAccept: true }
	| { kind: "markdown"; targetPath: string; variesOnAccept: true }
	| { kind: "redirect"; location: string; variesOnAccept: true }
	| { kind: "not-acceptable"; variesOnAccept: true }
	| { kind: "pass"; variesOnAccept: false };

export function resolveRepresentation(request: Request): RepresentationResolution;
```

In `server.ts`, return `307` for `redirect`, `406` for `not-acceptable`, rewrite only `markdown`, and restore a single normalized `Vary` header. Preserve security headers on all outcomes.

- [ ] **Step 4: Add stable machine routes and response metadata**

The two splat routes accept only `index.md`, the six topic `.md` names, and `catalog.json`; any other splat returns 404. Markdown comes from `renderCoreMarkdown`, JSON comes from `renderAgentCatalog`, and `catalog.json` uses `application/ld+json; charset=utf-8`.

```ts
export interface MachineDocumentResponseOptions {
	language?: Locale | readonly Locale[];
	contentType?: "text/markdown; charset=utf-8" | "text/plain; charset=utf-8" | "application/ld+json; charset=utf-8";
	contentLocation?: string;
	links?: readonly { href: string; rel: string; type?: string; hrefLang?: string }[];
	status?: number;
}
```

Use `Cache-Control: public, max-age=300, stale-while-revalidate=3600`. Preserve `X-Robots-Tag: noindex, follow`. Ensure existing internal rewrite routes are not advertised and return a canonical Link to the public `.md` URL.

- [ ] **Step 5: Update machine directories and smoke coverage**

Make `llms.txt` link to every stable `.md` endpoint so a client using `Accept: */*` receives Markdown without knowing about negotiation. Extend the smoke script to fetch all fourteen Agent HTML URLs, all fourteen Markdown URLs, both catalogues, `llms.txt`, `llms-full.txt`, robots, and sitemap; reject any 5xx, invalid content type, wrong locale, missing canonical/discovery relation, malformed JSON, or missing claim ID.

- [ ] **Step 6: Run focused tests, build, smoke, and commit**

Run:

```bash
pnpm --filter @workspace/www test -- src/lib/markdown-negotiation.test.ts src/lib/machine-response.test.ts src/lib/machine-documents.test.ts
pnpm --filter @workspace/www check-types
pnpm --filter @workspace/www build
```

Expected: all commands exit 0 and the production build contains route entries for the stable `.md` and `.json` URLs.

Commit:

```bash
git add apps/www/src/lib apps/www/src/routes apps/www/src/server.ts apps/www/scripts/smoke-marketing.mjs
git commit -m "fix make agent representations reliably retrievable"
```

### Task 3: Shared Accessible Interaction System and Global 90-Point Experience

**Files:**
- Create: `apps/www/src/components/experience/shared/use-roving-tabs.ts`
- Create: `apps/www/src/components/experience/shared/use-roving-tabs.test.tsx`
- Create: `apps/www/src/components/experience/shared/scroll-progress.tsx`
- Modify: `apps/www/src/styles/experience/base.css`
- Modify: `apps/www/src/components/experience/global/global-scenes.tsx`
- Modify: `apps/www/src/components/experience/global/global-pages.tsx`
- Modify: `apps/www/src/content/experience/global-copy.ts`
- Modify: `apps/www/src/styles/experience/global.css`
- Modify: `apps/www/src/components/experience/global/global-experience.test.tsx`
- Modify: `apps/www/src/styles.test.ts`

**Interfaces:**
- Consumes: existing Global shell, `GLOBAL_COPY`, brand assets, and three-field Global lead form.
- Produces: `useRovingTabs<T>(items, active, onChange, prefix)`, `ScrollProgress`, five-state evidence-rich `AnswerFieldScene`, four-stage decision-record `ProductLensScene`, and reusable motion/type CSS tokens in `base.css` for both editions.

- [ ] **Step 1: Write failing accessibility and evidence tests**

Test the exported pure keyboard resolver for ArrowLeft, ArrowRight, Home, and End, including wraparound. Use server-rendered scene assertions to verify each tab gets a unique `id`, the active tab gets `tabIndex=0`, inactive tabs get `-1`, and every panel has `aria-labelledby` pointing back to its tab. The browser run in Task 5 verifies that focus follows selection in a real DOM.

Extend Global static markup tests to require:

```ts
expect(home.match(/data-evidence-item=/g)).toHaveLength(5);
expect(home).toContain("Selected buyer question");
expect(home).toContain("Complete answer");
expect(home).toContain("Brand and alternatives");
expect(home).toContain("Visible citations");
expect(home).toContain("Next review item");
expect(product.match(/data-decision-field=/g)).toHaveLength(16);
expect(product).toContain('data-decision-field="input"');
expect(product).toContain('data-decision-field="evidence"');
expect(product).toContain('data-decision-field="decision"');
expect(product).toContain('data-decision-field="action"');
```

Add source-string tests for `--motion-state: 220ms`, the reduced-motion query, the mobile functional text floor, 44px targets, and absence of continuous decorative keyframes.

- [ ] **Step 2: Run focused tests and capture the expected red state**

Run: `pnpm --filter @workspace/www test -- src/components/experience/shared/use-roving-tabs.test.tsx src/components/experience/global/global-experience.test.tsx src/styles.test.ts`

Expected: FAIL because the shared hook, evidence rail, sixteen decision fields, and new motion/type tokens do not exist.

- [ ] **Step 3: Implement the roving-tab hook and meaningful motion primitives**

```ts
export function useRovingTabs<T extends string>(options: {
	items: readonly T[];
	active: T;
	onChange: (next: T) => void;
	idPrefix: string;
}) {
	return {
		getTabProps(item: T, index: number): React.ButtonHTMLAttributes<HTMLButtonElement>,
		getPanelProps(item: T): React.HTMLAttributes<HTMLElement>,
	};
}

export function resolveRovingTabIndex(
	length: number,
	currentIndex: number,
	key: "ArrowLeft" | "ArrowRight" | "Home" | "End",
): number;
```

Arrow keys wrap; Home selects the first; End selects the last; focus follows selection. Use it for `ProductLensScene` and all other true Global tablists. Add `ScrollProgress` once in the Global shell. Set `--motion-state: 220ms` and `--motion-route: 260ms`; animate only active content opacity/translate and state-route stroke movement. Under `prefers-reduced-motion: reduce`, set durations to `0.01ms` and ensure every final state is immediately legible.

- [ ] **Step 4: Upgrade the Global homepage into a live decision artefact**

Expand every buyer-question state to include `answer`, `presence`, `comparison`, `citations`, and `nextAction`. Render those fields in an `aria-live="polite"` decision pane and visually connect the active question to the changed readout. Add the five-item evidence rail immediately after the hero. All examples must be explicitly labelled illustrative and may not imply customer evidence.

Keep one primary promise and CTA: a focused AI-answer review. Remove repeated prose cards that say the same thing as the scene.

- [ ] **Step 5: Upgrade Product and supporting Global pages**

Each Product stage must render exactly four named fields: input, evidence, decision, and next action. Approach must show input/output for each stage; Markets must change a concrete question, category frame, named-alternative frame, and review focus when the lens changes; Company must show scoped questions, full-answer review, explicit market context, and repeatable checks as procurement boundaries; Contact must state what the first conversation determines and that no prepared report is required.

Do not add logos, metrics, coverage counts, response-time promises, or unverifiable proof.

- [ ] **Step 6: Enforce responsive detail quality**

At `max-width: 640px`, set functional metadata and controls to at least `0.75rem`, body copy to at least `0.875rem/1.4`, and buttons/links to at least `44px`. Preserve the editorial desktop hierarchy at 1024 and 1440 widths and eliminate all horizontal overflow at 390, 768, 1024, and 1440.

- [ ] **Step 7: Run focused tests, build, and commit**

Run:

```bash
pnpm --filter @workspace/www test -- src/components/experience/shared/use-roving-tabs.test.tsx src/components/experience/global/global-experience.test.tsx src/styles.test.ts
pnpm --filter @workspace/www check-types
pnpm --filter @workspace/www build
```

Expected: all commands exit 0; the Global markup exposes evidence/decision fields and the tab tests cover all keyboard keys.

Commit:

```bash
git add apps/www/src/components/experience/shared apps/www/src/components/experience/global apps/www/src/content/experience/global-copy.ts apps/www/src/styles/experience/base.css apps/www/src/styles/experience/global.css apps/www/src/styles.test.ts
git commit -m "feat elevate global evidence experience"
```

### Task 4: Native China ToB Narrative and Operational Interaction Design

**Files:**
- Modify: `apps/www/src/content/experience/china-copy.ts`
- Modify: `apps/www/src/components/experience/china/china-scenes.tsx`
- Modify: `apps/www/src/components/experience/china/china-pages.tsx`
- Modify: `apps/www/src/styles/experience/china.css`
- Modify: `apps/www/src/components/experience/china/china-experience.test.tsx`
- Modify: `apps/www/src/content/experience/copy-contract.test.ts`

**Interfaces:**
- Consumes: `useRovingTabs` and motion tokens from Task 3, current China shell, brand assets, and exact name/phone/company lead form.
- Produces: independently written China copy and scene states following `客户的新入口 → 生意风险 → 可核对证据 → 摸底输出 → 下一步优先级`.

- [ ] **Step 1: Replace old-copy assertions with failing native-narrative tests**

Require the approved headline and business-risk sequence while rejecting the old cautious phrases and unsupported promises.

```ts
expect(home).toContain("客户开始问 AI，品牌的第一解释权还在你手里吗？");
expect(home).toContain("没进候选池");
expect(home).toContain("核心卖点被说偏");
expect(home).toContain("竞品占了答案位");
expect(home).toContain("出海后定位漂移");
expect(home).toContain("问题范围");
expect(home).toContain("答案快照");
expect(home).toContain("竞品差距");
expect(home).toContain("优先级清单");
expect(home).toContain("预约一次 AI 品牌摸底");
expect(product).toContain("圈定问题");
expect(product).toContain("拆答案");
expect(product).toContain("找掉点");
expect(product).toContain("做复盘");
expect(approach).toContain("先做品牌体检，再定 GEO 打法");
expect(approach).toContain("生成式搜索和 AI 答案中的品牌表现");
expect(company).toContain("不卖玄学排名，先把 AI 怎么说你查清楚");
expect(rendered).not.toMatch(/保证排名|保证推荐|自动改变|全网覆盖|流量承诺/);
```

Assert the form still contains exactly name, phone, and company and no email field.

- [ ] **Step 2: Run focused tests and capture the expected red state**

Run: `pnpm --filter @workspace/www test -- src/components/experience/china/china-experience.test.tsx src/content/experience/copy-contract.test.ts src/components/experience/shared/lead-form.test.tsx`

Expected: FAIL because the approved headline, four risk labels, evidence outputs, service proposition, and direct company statement are absent.

- [ ] **Step 3: Rewrite the seven China pages as an independent edition**

Use these page purposes:

1. Home converts AI anxiety into four concrete business risks and a four-item diagnostic output.
2. Product shows one reviewable meeting artefact through 圈定问题 / 拆答案 / 找掉点 / 做复盘.
3. Approach explains GEO at first mention and routes by the business problem, not job title.
4. Geo starts from the China-market baseline and adds only a defined target country/language/buyer context; include “出海不是翻译官网，而是重做一遍当地品类心智。”
5. Company leads with “不卖玄学排名，先把 AI 怎么说你查清楚” and immediately lists scope and limits.
6. Diagnostic promises only a scope-setting first conversation and keeps three fields.
7. Privacy stays plain and avoids marketing slang.

Use at most two local terms per screen and explain the operational meaning in the surrounding sentence. Do not turn the edition into a keyword wall.

- [ ] **Step 4: Make every China scene a diagnostic control, not a carousel**

Apply `useRovingTabs` to `AiAnswerFlow`, `BrandGapConsole`, `ServiceRoute`, and `GlobalMarketBridge`. A state change must update both the observed result and the priority/action field. Add stable `data-output-field="scope|answer|gap|priority"` markers so tests and crawlers can distinguish the output structure.

Reserve orange full-width chapters for decision and conversion sections. Keep rounded command surfaces, visible status chips, dashboard-like output lists, and restrained 220ms state transitions. Use intentional Chinese line breaks and never apply aggressive negative tracking to Chinese headlines.

- [ ] **Step 5: Enforce China responsive and accessibility quality**

At mobile sizes, keep all controls at least 44px, all functional labels at least `0.75rem`, all body copy at least `0.875rem/1.4`, and the active output directly below its controls. Ensure the mobile navigation contains same-topic Human/Agent and locale links and no horizontal overflow.

- [ ] **Step 6: Run focused tests, build, and commit**

Run:

```bash
pnpm --filter @workspace/www test -- src/components/experience/china/china-experience.test.tsx src/content/experience/copy-contract.test.ts src/components/experience/shared/lead-form.test.tsx src/components/experience/shared/use-roving-tabs.test.tsx
pnpm --filter @workspace/www check-types
pnpm --filter @workspace/www build
```

Expected: all commands exit 0; the China edition contains the approved story, preserves form fields, supports keyboard tabs, and contains no unsupported claims.

Commit:

```bash
git add apps/www/src/content/experience/china-copy.ts apps/www/src/components/experience/china apps/www/src/styles/experience/china.css apps/www/src/content/experience/copy-contract.test.ts
git commit -m "feat localize china brand diagnosis story"
```

### Task 5: Whole-Site Visual, Crawl, Policy, and Production Release

**Files:**
- Modify: `apps/www/scripts/smoke-marketing.mjs`
- Modify: `apps/www/scripts/smoke-marketing-caddy.mjs`
- Modify: `apps/www/src/styles.test.ts`
- Create: `docs/verification/zero-one-site-rebuild-release.md`
- Modify only if a verified defect requires it: files changed by Tasks 1–4

**Interfaces:**
- Consumes: all Human, Agent, Markdown, JSON-LD, form, interaction, and CSS outputs from Tasks 1–4.
- Produces: automated release evidence, production image/marker, pushed `main`, and live-domain verification.

- [ ] **Step 1: Add failing release-policy coverage for the new contract**

Extend smoke and policy checks to assert:

```text
14 Human HTML URLs: 200, indexable, self-canonical, hreflang, Markdown/JSON-LD/describedby links
14 Agent HTML URLs: 200, noindex-follow, Human canonical, stable fact IDs, visible scope and limitations
14 Markdown URLs: 200 text/markdown, noindex-follow, locale, claim IDs, canonical/discovery Link headers
2 catalogue URLs: 200 application/ld+json, parseable connected graph, stable Organization/WebSite/WebPage/ItemList IDs
Accept matrix and trailing slash matrix: no 5xx
Retired publication and internal rewrite URLs: unavailable or canonicalized as policy defines
Lead forms: Global name/email/company; China name/phone/company
Public-output scan: no internal references, implementation commentary, forbidden ancestry/licensing language, or unpublished evidence claims
```

- [ ] **Step 2: Run full local verification and fix only evidenced failures**

Run:

```bash
pnpm --filter @workspace/www test
pnpm --filter @workspace/www check-types
pnpm --filter @workspace/www build
pnpm --filter @workspace/www audit:legacy-marketing
pnpm --filter @workspace/www audit:site-manifest
git diff --check
```

Expected: 0 failures. If a command fails, first isolate the cause with the smallest relevant test, add or retain a regression assertion, make the minimum correction, rerun the focused command, then rerun this full list.

- [ ] **Step 3: Run browser and visual QA at four viewports**

Start the built server and use browser automation to capture every Human page at 390, 768, 1024, and 1440 CSS pixels plus representative Agent pages in both locales. For every capture, assert `document.documentElement.scrollWidth <= window.innerWidth`, functional text floors, 44px mobile targets, visible keyboard focus, correct tab focus/selection, no content collision, and no truncated CTA/form state.

Run axe WCAG 2 A/AA and 2.1 AA on all fourteen Human pages and representative Agent pages. Expected: zero serious or critical violations.

- [ ] **Step 4: Perform a strict 90-point design review**

Score all eight rubric dimensions from the spec using screenshot and interaction evidence. A release candidate passes only if the total is at least 90 and both `Trust, evidence, and buying confidence` and `Product comprehension and actionability` score at least 14/15. Record the score and concrete evidence in `docs/verification/zero-one-site-rebuild-release.md`.

- [ ] **Step 5: Commit the release evidence**

```bash
git add apps/www/scripts apps/www/src/styles.test.ts docs/verification/zero-one-site-rebuild-release.md
git commit -m "test verify regional experience release"
```

- [ ] **Step 6: Integrate, push, deploy, and verify production**

Confirm the branch is clean and ahead only by reviewed commits. Fast-forward the authorized production branch, push it, build an immutable image tagged with the full commit SHA, deploy through the existing Caddy/Docker path, and verify the live release marker equals that SHA.

Repeat the complete live-domain matrix from Step 1, the four representative viewport checks from Step 3, the lead-form validation checks, robots/sitemap/llms checks, and the public-output scan against `https://yonaris.com`.

Expected: live Human pages return 200 and remain indexable; Agent HTML/Markdown/JSON-LD return 200 and noindex-follow; no Accept or trailing-slash request returns 5xx; every locale switch and Human/Agent pair resolves to the same topic; the release marker equals the deployed commit.
