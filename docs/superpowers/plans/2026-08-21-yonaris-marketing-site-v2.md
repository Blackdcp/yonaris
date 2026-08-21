# Yonaris Marketing Site V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a bilingual, brand-consistent Yonaris marketing site that explains the current product honestly, captures free diagnostic leads, and publishes the same product truth for humans and agents.

**Architecture:** A typed bilingual content module is the single source for React marketing pages, Markdown agent endpoints, SEO metadata, and sitemap routes. Shared shell and visual primitives render an Ink/Paper editorial system; English is the default route set and Chinese uses `/zh`. The free diagnostic remains infrastructure-light and transparently prepares an email instead of claiming server-side submission.

**Tech Stack:** React 19, TanStack Start/Router, TypeScript 7, Tailwind CSS 4, inline SVG, Vitest, Nitro, Vite 8.

**Spec:** `docs/superpowers/specs/2026-08-21-yonaris-marketing-site-v2-design.md`

## Global Constraints

- Use only verified claims from the supplied Yonaris product introduction and seed BP.
- Describe `AI-native MarTech` as the company category and GEO as the current commercial entry point.
- Do not describe Product Truth, Market Intent, Model Intelligence, and Commercial Feedback as four products.
- Do not describe roadmap capabilities as currently available.
- English is default at `/`; Chinese core pages live under `/zh`.
- Use Ink `#0B1220`, Paper `#F6F4F1`, Slate `#1E2A39`, Stone `#8A95A3`, Mist `#DDE2E8`, Signal Orange `#FF6A00`, and optional Blue Gray `#2F3E50`.
- The primary conversion is `Get a Free Diagnostic / 获取免费诊断`.
- Diagnostic email recipient is `black.dcp@outlook.com`.
- Never show a false lead-submission success state.
- Do not hand-edit `apps/www/src/routeTree.gen.ts`.

---

### Task 1: Bilingual Marketing Content Contract

**Files:**
- Create: `apps/www/src/lib/marketing-content.ts`
- Create: `apps/www/src/lib/marketing-content.test.ts`
- Modify: `apps/www/package.json`
- Modify: `pnpm-lock.yaml`

**Interfaces:**
- Produces: `Locale = "en" | "zh"`, `MARKETING_ROUTES`, `getMarketingContent(locale)`, `getLocalizedPath(path, locale)`, `buildDiagnosticMailto(input, locale)`, and `renderAgentDocument(section)`.
- Consumes: no new runtime services.

- [ ] **Step 1: Add the www test command and Vitest dev dependency**

Add `"test": "vitest run"` and `"vitest": "^4.1.10"` to `apps/www/package.json`, then run `pnpm.cmd install --lockfile-only` so the importer is recorded without changing supply-chain policy.

- [ ] **Step 2: Write failing content-contract tests**

Create tests that require:

```ts
expect(getMarketingContent("en").hero.title).toEqual(["MarTech, rebuilt.", "For humans and agents."]);
expect(getMarketingContent("zh").cta.primary).toBe("获取免费诊断");
expect(MARKETING_ROUTES.every((route) => route.en && route.zh)).toBe(true);
expect(renderAgentDocument("company")).toContain("AI-native MarTech");
expect(buildDiagnosticMailto(input, "en")).toContain("black.dcp%40outlook.com");
```

- [ ] **Step 3: Run the tests and confirm RED**

Run: `pnpm.cmd --filter @workspace/www test -- marketing-content.test.ts`

Expected: FAIL because `marketing-content.ts` does not exist.

- [ ] **Step 4: Implement the typed content source**

Create the exact exported types and functions named above. Encode the approved hero, Observe/Explain/Improve/Verify capabilities, four data foundations, five methodology steps, verified engagement scope, GEO entry-point language, navigation, page metadata, agent metadata, and diagnostic labels in both locales. Encode mail subject and body with `URLSearchParams`-safe `encodeURIComponent` values and return a `mailto:` URL.

- [ ] **Step 5: Run the tests and confirm GREEN**

Run: `pnpm.cmd --filter @workspace/www test -- marketing-content.test.ts`

Expected: all marketing content tests pass.

- [ ] **Step 6: Commit**

```bash
git add apps/www/package.json pnpm-lock.yaml apps/www/src/lib/marketing-content.ts apps/www/src/lib/marketing-content.test.ts
git commit -m "add bilingual Yonaris marketing content"
```

### Task 2: Brand Shell and Visual Primitives

**Files:**
- Create: `apps/www/src/components/marketing/marketing-shell.tsx`
- Create: `apps/www/src/components/marketing/signal-field.tsx`
- Create: `apps/www/src/components/marketing/section.tsx`
- Create: `apps/www/src/components/marketing/marketing-link.tsx`
- Modify: `apps/www/src/styles.css`
- Modify: `apps/www/src/routes/__root.tsx`

**Interfaces:**
- Consumes: `Locale`, `getMarketingContent`, and `getLocalizedPath` from Task 1; existing `Logo` component.
- Produces: `MarketingShell`, `SignalField`, `MarketingSection`, `MarketingLink`, and brand CSS utility classes.

- [ ] **Step 1: Write a failing shell accessibility assertion in the content test**

Add a public-contract assertion that every primary navigation item has both locales and every CTA path maps to `/diagnostic` or `/zh/diagnostic`. Run the focused test and confirm the assertion fails until the navigation contract is complete.

- [ ] **Step 2: Implement the shell**

Build a sticky header with wordmark, desktop links, an accessible `<details>` mobile menu, language switch, and one orange diagnostic CTA. Build a footer with company definition, routes, email, copyright, and signature. Do not add dropdowns or client-side menu state.

- [ ] **Step 3: Implement graphic primitives**

`SignalField` renders deterministic inline SVG paths in three opacity levels, at most two orange evidence anchors, and short Paper markers. Expose `tone="ink" | "paper"` and `density="hero" | "section"`. `MarketingSection` owns the 12-column container and Ink/Paper tone. `MarketingLink` owns focus, arrow, and CTA variants.

- [ ] **Step 4: Replace marketing tokens and motion CSS**

Add `--yonaris-ink`, `--yonaris-paper`, `--yonaris-slate`, `--yonaris-stone`, `--yonaris-mist`, `--yonaris-signal`, and `--yonaris-blue-gray`. Add single-run copy/path reveal and reduced-motion rules. Preserve existing docs/Fumadocs variables so legacy pages remain readable.

- [ ] **Step 5: Make document language route-aware**

Update `__root.tsx` so `/zh` and `/zh/*` render `lang="zh-CN"`; all other pages render `lang="en"`. Remove the Titan One preload from the marketing critical path while preserving compatibility for legacy pages.

- [ ] **Step 6: Run type checking**

Run: `pnpm.cmd --filter @workspace/www check-types`

Expected: zero TypeScript errors.

- [ ] **Step 7: Commit**

```bash
git add apps/www/src/components/marketing apps/www/src/styles.css apps/www/src/routes/__root.tsx
git commit -m "build the Yonaris marketing design system"
```

### Task 3: English and Chinese Homepages

**Files:**
- Create: `apps/www/src/components/marketing/home-page.tsx`
- Modify: `apps/www/src/routes/index.tsx`
- Create: `apps/www/src/routes/zh/index.tsx`
- Delete: `apps/www/src/components/homepage.tsx`

**Interfaces:**
- Consumes: Task 1 content and Task 2 shell/primitives.
- Produces: `MarketingHomePage({ locale }: { locale: Locale })`.

- [ ] **Step 1: Extend content tests for visible homepage sections**

Assert that each locale provides non-empty hero, market shift, four capabilities, four foundations, five method steps, engagement scope, GEO entry point, and diagnostic close. Run and confirm RED for any missing section.

- [ ] **Step 2: Implement the shared homepage**

Render the eight approved sections. Use semantic headings, ordered method steps, definition lists for foundations, and actual links. Place the structured path field in the hero and a recursive branch motif in the method section. Keep all outcome copy sourced from `marketing-content.ts`.

- [ ] **Step 3: Implement localized route metadata**

Both routes must set localized title, description, canonical, reciprocal `hreflang` links (`en`, `zh-CN`, `x-default`), Open Graph locale, and Organization/WebSite JSON-LD.

- [ ] **Step 4: Remove the one-screen homepage**

Delete the old `homepage.tsx` after both routes use `MarketingHomePage`.

- [ ] **Step 5: Build and inspect generated routes**

Run: `pnpm.cmd --filter @workspace/www build`

Expected: Vite build exits 0 and the route generator includes `/zh` without manual edits.

- [ ] **Step 6: Commit**

```bash
git add apps/www/src/components/marketing/home-page.tsx apps/www/src/routes/index.tsx apps/www/src/routes/zh/index.tsx apps/www/src/components/homepage.tsx apps/www/src/routeTree.gen.ts
git commit -m "launch bilingual Yonaris homepages"
```

### Task 4: Platform, Methodology, Results, and GEO Pages

**Files:**
- Create: `apps/www/src/components/marketing/detail-page.tsx`
- Create: `apps/www/src/routes/platform.tsx`
- Create: `apps/www/src/routes/methodology.tsx`
- Create: `apps/www/src/routes/results.tsx`
- Create: `apps/www/src/routes/geo.tsx`
- Create: `apps/www/src/routes/zh/platform.tsx`
- Create: `apps/www/src/routes/zh/methodology.tsx`
- Create: `apps/www/src/routes/zh/results.tsx`
- Create: `apps/www/src/routes/zh/geo.tsx`

**Interfaces:**
- Consumes: `MarketingPageKey`, localized page content, shell, sections, links, and SignalField.
- Produces: `MarketingDetailPage({ locale, page })` for `platform | methodology | results | geo`.

- [ ] **Step 1: Add failing parity tests**

For every detail-page key, assert both locales have title, summary, at least two sections, localized canonical paths, and a diagnostic CTA. Run and confirm RED until all page records exist.

- [ ] **Step 2: Implement the detail-page renderer**

Render an Ink title region, Paper editorial sections, one evidence/sequence visualization appropriate to the page, and one diagnostic close. Do not create generic feature-card grids.

- [ ] **Step 3: Add eight thin route files**

Each route passes only locale and page key, then declares localized head metadata and reciprocal alternates. Results includes only verified anonymous evidence. GEO explicitly renders “Starting with GEO. Built for what comes next.”

- [ ] **Step 4: Run focused tests and type checking**

Run:

```bash
pnpm.cmd --filter @workspace/www test -- marketing-content.test.ts
pnpm.cmd --filter @workspace/www check-types
```

Expected: both commands exit 0.

- [ ] **Step 5: Commit**

```bash
git add apps/www/src/components/marketing/detail-page.tsx apps/www/src/routes/platform.tsx apps/www/src/routes/methodology.tsx apps/www/src/routes/results.tsx apps/www/src/routes/geo.tsx apps/www/src/routes/zh apps/www/src/routeTree.gen.ts
git commit -m "explain the Yonaris platform and method"
```

### Task 5: Transparent Free Diagnostic Flow

**Files:**
- Create: `apps/www/src/components/marketing/diagnostic-form.tsx`
- Create: `apps/www/src/routes/diagnostic.tsx`
- Create: `apps/www/src/routes/zh/diagnostic.tsx`
- Modify: `apps/www/src/lib/marketing-content.test.ts`

**Interfaces:**
- Consumes: `buildDiagnosticMailto`, localized form labels, and MarketingShell.
- Produces: `DiagnosticForm({ locale })` with required brand, website, key question, name, and email fields; optional market and competitors.

- [ ] **Step 1: Add failing mail-payload tests**

Test English and Chinese subjects, multiline body labels, Unicode, ampersands, required contact details, and recipient. Confirm RED for incomplete encoding.

- [ ] **Step 2: Implement mail payload generation**

Return `mailto:black.dcp@outlook.com?subject=...&body=...` with every value encoded. Do not log field values to analytics.

- [ ] **Step 3: Implement the accessible form**

Use native inputs, textarea, labels, required attributes, and `type="url"`/`type="email"`. On submit, validate via the browser, set `window.location.href` to the generated mailto URL, and keep a visible disclosure: “This opens your email client. Nothing is sent until you send the email.” No success message appears.

- [ ] **Step 4: Add localized diagnostic routes and metadata**

Render expected output: baseline perception versus competitors, key scenario performance, important sources and gaps, and three priority recommendations.

- [ ] **Step 5: Run tests and type checking**

Run:

```bash
pnpm.cmd --filter @workspace/www test -- marketing-content.test.ts
pnpm.cmd --filter @workspace/www check-types
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add apps/www/src/components/marketing/diagnostic-form.tsx apps/www/src/routes/diagnostic.tsx apps/www/src/routes/zh/diagnostic.tsx apps/www/src/lib/marketing-content.test.ts apps/www/src/routeTree.gen.ts
git commit -m "add the free diagnostic request flow"
```

### Task 6: Human and Agent Views from One Fact Source

**Files:**
- Create: `apps/www/src/components/marketing/agent-index.tsx`
- Create: `apps/www/src/routes/agent/index.tsx`
- Create: `apps/www/src/routes/agent/company.ts`
- Create: `apps/www/src/routes/agent/platform.ts`
- Create: `apps/www/src/routes/agent/methodology.ts`
- Create: `apps/www/src/routes/agent/results.ts`
- Modify: `apps/www/src/routes/llms[.]txt.ts`
- Modify: `apps/www/src/routes/llms-full[.]txt.ts`
- Modify: `apps/www/src/lib/marketing-content.test.ts`

**Interfaces:**
- Consumes: `renderAgentDocument(section)` and shared route/content records.
- Produces: human-visible `/agent`, four `text/markdown; charset=utf-8` endpoints, concise `/llms.txt`, and complete `/llms-full.txt`.

- [ ] **Step 1: Add failing agent contract tests**

Assert each section includes `Canonical human URL`, `Current scope`, `English aliases`, `Chinese aliases`, `Last updated`, and only claims present in shared content. Confirm RED.

- [ ] **Step 2: Implement the agent index**

Render a sparse Ink interface with a factual company definition, endpoint list, content negotiation note, and links to human canonical pages. The visual design may evoke a terminal index but must use Yonaris typography and no fake command interactions.

- [ ] **Step 3: Implement Markdown endpoints**

Return rendered documents with `Content-Type: text/markdown; charset=utf-8` and `Cache-Control: public, max-age=300`. Use the same facts as human pages.

- [ ] **Step 4: Replace llms files**

`llms.txt` becomes a concise index; `llms-full.txt` concatenates company, platform, methodology, and results documents. Remove inherited self-hosted Elmo/GEO-only positioning from both.

- [ ] **Step 5: Run tests and build**

Run:

```bash
pnpm.cmd --filter @workspace/www test -- marketing-content.test.ts
pnpm.cmd --filter @workspace/www build
```

Expected: all tests pass and build exits 0.

- [ ] **Step 6: Commit**

```bash
git add apps/www/src/components/marketing/agent-index.tsx apps/www/src/routes/agent apps/www/src/routes/llms[.]txt.ts apps/www/src/routes/llms-full[.]txt.ts apps/www/src/lib/marketing-content.test.ts apps/www/src/routeTree.gen.ts
git commit -m "publish Yonaris facts for agents"
```

### Task 7: SEO, Sitemap, and Release Smoke

**Files:**
- Modify: `apps/www/src/lib/seo.ts`
- Modify: `apps/www/src/routes/sitemap[.]xml.ts`
- Modify: `apps/www/src/routes/robots[.]txt.ts`
- Modify: `apps/www/scripts/smoke-marketing.mjs`
- Create: `apps/www/scripts/smoke-marketing.test.mjs`

**Interfaces:**
- Consumes: marketing route/content records.
- Produces: localized SEO helpers, complete sitemap, AI crawler directives, and multi-route release smoke.

- [ ] **Step 1: Write failing sitemap and smoke tests**

Extract the expected marketing paths into exported pure data. Assert all English, Chinese, and agent routes appear once. Add a local HTTP fixture test where a required route or stylesheet returns 404 and assert the smoke script fails.

- [ ] **Step 2: Update SEO helpers**

Set the site description to the approved AI-native MarTech definition. Add a helper returning canonical, `en`, `zh-CN`, and `x-default` link records for a route pair. Update Organization schema without unsupported maturity or customer claims.

- [ ] **Step 3: Update sitemap and robots**

Include core human and agent paths. Preserve existing crawler access and sitemap declaration. Add explicit `Allow` entries for `/agent/`, `/llms.txt`, and `/llms-full.txt` without blocking any AI user agent.

- [ ] **Step 4: Harden release smoke**

Require `MarTech, rebuilt.`, `For humans and agents.`, `/zh`, `/diagnostic`, `/agent`, `/agent/company`, and `/llms.txt`. Continue crawling every same-origin HTML and CSS asset. Assert route content types and required localized text.

- [ ] **Step 5: Run script tests, type check, and production build**

Run:

```bash
node --test apps/www/scripts/smoke-marketing.test.mjs
pnpm.cmd --filter @workspace/www test
pnpm.cmd --filter @workspace/www check-types
pnpm.cmd --filter @workspace/www build
```

Expected: all commands exit 0.

- [ ] **Step 6: Commit**

```bash
git add apps/www/src/lib/seo.ts apps/www/src/routes/sitemap[.]xml.ts apps/www/src/routes/robots[.]txt.ts apps/www/scripts/smoke-marketing.mjs apps/www/scripts/smoke-marketing.test.mjs
git commit -m "align marketing SEO and release checks"
```

### Task 8: Production-Image and Visual Verification

**Files:**
- Modify only files proven necessary by verification failures.

**Interfaces:**
- Consumes: the complete marketing implementation and existing `docker/Dockerfile.www`.
- Produces: a verified release candidate and visual QA evidence in `.codex-tmp/` only.

- [ ] **Step 1: Build the exact production image**

Run:

```bash
docker build --target www -f docker/Dockerfile.www -t yonaris-www:marketing-v2 .
```

Expected: Docker build exits 0.

- [ ] **Step 2: Run the exact image and smoke it**

Run the image on `127.0.0.1:15161`, execute `node apps/www/scripts/smoke-marketing.mjs http://127.0.0.1:15161/`, and stop the container in a guaranteed cleanup block.

- [ ] **Step 3: Capture desktop and mobile screenshots**

Capture `/`, `/zh`, `/platform`, `/diagnostic`, and `/agent` at 1440×900, 390×844, and 320×700. Verify no horizontal overflow, orphan Chinese punctuation, obscured CTA, accidental purple/blue gradients, fake dashboards, or path overlaps with critical copy.

- [ ] **Step 4: Run final repository checks**

Run:

```bash
pnpm.cmd --filter @workspace/www test
pnpm.cmd --filter @workspace/www check-types
pnpm.cmd --filter @workspace/www build
git diff --check origin/main...HEAD
git status -sb
```

Expected: tests, type check, and build pass; diff check is empty; only intended commits are ahead of `origin/main`.

- [ ] **Step 5: Commit any verification fixes**

If verification required code changes, commit only the touched marketing files with subject `polish the Yonaris marketing experience`. If no changes were required, do not create an empty commit.
