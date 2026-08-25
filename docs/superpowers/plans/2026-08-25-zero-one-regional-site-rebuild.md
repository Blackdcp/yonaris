# Zero-to-One Regional Website Rebuild Implementation Plan

> **Execution:** Use test-first implementation in the isolated `codex/zero-one-site-rebuild` worktree. Global, China, and Agent surfaces may be built in parallel only after the shared contracts are fixed.

**Goal:** Replace the complete public Yonaris website with independently designed global and China Human experiences plus a distinct Agent interface, remove the retired section and old visual/content systems, then deploy and verify the release.

**Architecture:** Keep TanStack Start routing, SEO, the lead-delivery endpoint, and deployment infrastructure. Replace the marketing component tree, content modules, and CSS entry with a new `components/experience`, `content/experience`, and `styles/experience` system. Human routes render regional page components; Agent and Markdown routes consume a compact verified-facts model.

**Stack:** React 19, TanStack Start, TypeScript, CSS, Vitest, Playwright smoke tooling, pnpm.

---

## Task 1: Establish the public-experience regression contract

**Files:**

- Create: `apps/www/src/components/experience/site-generation.test.tsx`
- Create: `apps/www/src/content/experience/copy-contract.test.ts`
- Modify: `apps/www/src/lib/site-manifest.test.ts`
- Modify: `apps/www/src/lib/sitemap.test.ts`

**Steps:**

1. Add tests that require seven global and seven China Human pages, a `zero-one` generation marker, a unique page scene, brand logo output, regional navigation, and exactly three visible contact fields.
2. Add a rendered-output deny list for the retired visual markers and internal-analysis language named in the design specification.
3. Add tests requiring the retired section to be absent from manifest, sitemap, primary/footer navigation, and machine topic indexes.
4. Run only the new and directly affected tests and confirm RED before implementation.

## Task 2: Create the new content and shared contracts

**Files:**

- Create: `apps/www/src/content/experience/types.ts`
- Create: `apps/www/src/content/experience/global-copy.ts`
- Create: `apps/www/src/content/experience/china-copy.ts`
- Create: `apps/www/src/content/experience/agent-facts.ts`
- Create: `apps/www/src/content/experience/index.ts`
- Rewrite: `apps/www/src/content/site/types.ts`
- Rewrite: `apps/www/src/content/site/index.ts`

**Steps:**

1. Define the supported Human page keys: home, product, approach, geo, company, diagnostic, privacy.
2. Write global copy in commercial English and China copy as native Chinese; do not translate one from the other.
3. Keep customer-situation language and supported product facts; remove internal review and implementation language.
4. Define concise Agent facts and canonical Human paths.
5. Run the copy-contract tests and confirm GREEN.

## Task 3: Build shared chrome and lead form

**Files:**

- Create: `apps/www/src/components/experience/shared/human-agent-link.tsx`
- Create: `apps/www/src/components/experience/shared/lead-form.tsx`
- Create: `apps/www/src/components/experience/shared/scene-controls.tsx`
- Create: `apps/www/src/styles/experience/base.css`
- Modify: `apps/www/src/components/logo.tsx`

**Steps:**

1. Preserve the real Yonaris wordmark in every header/footer.
2. Add topic-preserving Human/Agent links.
3. Move the existing submission state and server call into a new visual form.
4. Keep exactly name/email/company for global and 姓名/电话/公司 for China.
5. Add keyboard, focus, reduced-motion, and small-screen behavior.
6. Run targeted form and shared contract tests.

## Task 4: Build the global Signal Field experience

**Files:**

- Create: `apps/www/src/components/experience/global/global-shell.tsx`
- Create: `apps/www/src/components/experience/global/global-scenes.tsx`
- Create: `apps/www/src/components/experience/global/global-pages.tsx`
- Create: `apps/www/src/components/experience/global/global-experience.test.tsx`
- Create: `apps/www/src/styles/experience/global.css`

**Steps:**

1. Build sticky branded navigation and a compact Agent entry.
2. Build page-specific Answer Field, Product Lens, Change Path, Market Atlas, Company Constellation, Contact Signal, and Privacy Route scenes.
3. Make customer-controlled interactions keyboard accessible and useful without hover.
4. Implement all seven global pages with unique composition and customer-facing copy.
5. Verify desktop and stacked mobile rendering in component tests.

## Task 5: Build the China Brand Answer Command experience

**Files:**

- Create: `apps/www/src/components/experience/china/china-shell.tsx`
- Create: `apps/www/src/components/experience/china/china-scenes.tsx`
- Create: `apps/www/src/components/experience/china/china-pages.tsx`
- Create: `apps/www/src/components/experience/china/china-experience.test.tsx`
- Create: `apps/www/src/styles/experience/china.css`

**Steps:**

1. Build a denser, decision-oriented China navigation and mobile consultation CTA.
2. Build page-specific AI Answer Flow, Brand Gap Console, Service Route, Global Market Bridge, Company Network, Consultation Brief, and Privacy Path scenes.
3. Organize content by concrete customer situations, not roles or company size.
4. Explain China-market and China-to-global service as two related but distinct paths.
5. Implement all seven China pages and test the native copy and interactions.

## Task 6: Replace Agent and machine-readable surfaces

**Files:**

- Create: `apps/www/src/components/experience/agent/agent-pages.tsx`
- Create: `apps/www/src/components/experience/agent/agent-experience.test.tsx`
- Create: `apps/www/src/styles/experience/agent.css`
- Rewrite: `apps/www/src/lib/machine-documents.ts`
- Modify: `apps/www/src/lib/markdown-negotiation.ts`
- Modify: `apps/www/src/routes/agent/**`
- Modify: `apps/www/src/routes/zh/agent/**`
- Modify: `apps/www/src/routes/llms[.]mdx.agent.$.ts`
- Modify: `apps/www/src/routes/llms[.]mdx.zh-agent.$.ts`

**Steps:**

1. Create a machine-first directory with concise facts, canonical links, and locale/topic navigation.
2. Keep Agent visuals intentionally distinct from Human pages while retaining the wordmark and orange signal.
3. Remove retired topic routes from Agent and Markdown routing.
4. Add a privacy topic to the global Agent surface.
5. Verify HTML Agent pages and negotiated Markdown both resolve.

## Task 7: Rewire routes and delete the retired website systems

**Files:**

- Rewrite: `apps/www/src/routes/{index,product,approach,geo,company,diagnostic,privacy}.tsx`
- Rewrite: `apps/www/src/routes/zh/{index,product,approach,geo,company,diagnostic,privacy}.tsx`
- Delete: `apps/www/src/routes/research.tsx`
- Delete: `apps/www/src/routes/zh/research.tsx`
- Delete: retired Agent research routes
- Rewrite: `apps/www/src/editions/**`
- Rewrite: `apps/www/src/lib/site-manifest.ts`
- Rewrite: `apps/www/src/lib/site-navigation.ts`
- Rewrite: `apps/www/src/styles.css`
- Delete: retired `components/site` Human/Agent trees after the new routes no longer import them
- Delete: retired marketing content modules and old page styles after import verification

**Steps:**

1. Point every supported route at the new experience components and metadata.
2. Remove the retired section from routing, manifest, redirects, sitemap, navigation, and machine indexes.
3. Import only Tailwind plus the four new experience stylesheets.
4. Use import/search checks to prove no route or stylesheet references the retired trees.
5. Delete the retired trees and their design-locking tests.
6. Regenerate the TanStack route tree through the normal build command.

## Task 8: Verify, review, ship, and probe production

**Files:**

- Modify: browser smoke expectations and screenshot artifacts only where required
- Add: one package changeset for the public website replacement

**Steps:**

1. Run targeted component/content/form tests.
2. Run the complete `@workspace/www` test command.
3. Run type checking and the production marketing build.
4. Run browser smoke tests at desktop and mobile widths and inspect screenshots for every Human route plus both Agent indexes.
5. Run public-output policy and release audits.
6. Request a final independent code review and resolve any actionable findings.
7. Commit atomic milestones, merge the release branch into `main` without rewriting history, and push both branches.
8. Watch the deployment workflow to completion.
9. Probe every live route, removed route, form UI, Agent index, sitemap, robots, and machine-readable endpoint.
10. Report the deployed commit, workflow URL, route status, verification counts, and any external configuration blocker that cannot be solved from repository code.
