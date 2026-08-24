# Yonaris Site Governance and Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Converge every remaining public route into the Yonaris identity, install canonical redirects and index policy, then prove the complete bilingual human/Agent site is release-safe.

**Architecture:** Supporting pages use Resources, Publication, Utility, or Legacy Archive shells without rewriting all historical bodies. Canonical core routes and the single bilingual Privacy destination are already created by the page plans; this plan installs real 308 aliases, Resources/Open Source destinations, noindex/archive context, old-facade cleanup, production smoke, and final visual/behavior review.

**Tech Stack:** TanStack Start/Router, React 19, TypeScript 7, Vitest, Playwright, Node test runner, existing Docker marketing deployment.

**Spec:** `docs/superpowers/specs/2026-08-22-full-site-rebuild-design.md`

## Global Constraints

- Do not rewrite 31 Blog posts, 21 Docs pages, 28 Glossary pages, or 108 comparison bodies in this release.
- Unreviewed Blog/Glossary and all legacy AI Search/AEO/AI Visibility content are `noindex,follow` and absent from sitemap.
- AI Search/AEO display a visible legacy research context; AI Visibility Tools display a visible upstream Yonaris comparison archive context.
- Docs, Status, Brand, Changelog, RSS, OpenAPI, OG, and repo-activity functionality must remain operational.
- No public route may use old blue Docs-first navigation or present Yonaris as the Yonaris company.
- Redirects are real 308 responses and are tested with redirects disabled.
- Release smoke must check every core locale, same-origin asset, machine representation, redirect, index policy, and safe diagnostic failure without sending email.
- No push, merge, publish, DNS, or production deployment occurs under this plan without the finishing-branch/release gate.
- Use TDD for every behavior.

---

### Task 1: Publish Resources and Open Source destinations

**Files:**
- Create: `apps/www/src/components/site/pages/resources-page.tsx`
- Create: `apps/www/src/components/site/pages/open-source-page.tsx`
- Create: `apps/www/src/routes/resources.tsx`
- Create: `apps/www/src/routes/open-source.tsx`
- Create: `apps/www/src/content/site/resources.test.ts`
- Create: `e2e/www-tests/supporting-pages.spec.ts`

**Interfaces:**
- Consumes: `resources.ts`, SiteShell, UtilityShell, manifest, `supportingPageHead()`.
- Produces: `/resources` and `/open-source`. Consumes and links the existing `/privacy` route created by Diagnostic Acquisition Task 4.

- [ ] **Step 1: Write failing content and route tests**

Resources must link Research Notes, Docs, Glossary, Status, Brand, and Open Source. Open Source must explain the upstream Yonaris-compatible infrastructure, link repository/license/docs, and distinguish it from Yonaris company identity.

Run focused Vitest and Playwright; expected FAIL because the routes do not exist.

```powershell
pnpm.cmd --filter @workspace/www test -- src/content/site/resources.test.ts
pnpm.cmd --filter e2e exec playwright test --config playwright.www.config.ts www-tests/supporting-pages.spec.ts --project=chromium
```

- [ ] **Step 2: Implement the two destination pages**

Resources uses the publication index visual system and `supportingPageHead("resources")`. Open Source uses `UtilityShell section="open-source"`, visible identity context, and `supportingPageHead("openSource")`. No fake project metrics, stars, roadmap promises, or legal claims.

- [ ] **Step 3: Verify and commit**

```powershell
pnpm.cmd --filter @workspace/www test -- src/content/site/resources.test.ts
pnpm.cmd --filter e2e exec playwright test --config playwright.www.config.ts supporting-pages.spec.ts
git add apps/www/src/components/site/pages/resources-page.tsx apps/www/src/components/site/pages/open-source-page.tsx apps/www/src/routes/resources.tsx apps/www/src/routes/open-source.tsx apps/www/src/content/site/resources.test.ts e2e/www-tests/supporting-pages.spec.ts
git commit -m "publish supporting company resources"
```

### Task 2: Apply Publication, Utility, and Legacy Archive governance

**Files:**
- Modify: `apps/www/src/components/blog-post-layout.tsx`
- Modify: `apps/www/src/components/docs-page-layout.tsx`
- Modify: `apps/www/src/routes/blog/index.tsx`
- Modify: `apps/www/src/routes/blog/$.tsx`
- Modify: `apps/www/src/routes/glossary/index.tsx`
- Modify: `apps/www/src/routes/glossary/$slug.tsx`
- Modify: `apps/www/src/routes/ai-search/index.tsx`
- Modify: `apps/www/src/routes/ai-search/$slug.tsx`
- Modify: `apps/www/src/routes/aeo-for/index.tsx`
- Modify: `apps/www/src/routes/aeo-for/$slug.tsx`
- Modify: `apps/www/src/routes/ai-visibility-tools/index.tsx`
- Modify: `apps/www/src/routes/ai-visibility-tools/$slug.tsx`
- Modify: `apps/www/src/routes/ai-visibility-tools/alternatives/index.tsx`
- Modify: `apps/www/src/routes/ai-visibility-tools/alternatives/$slug.tsx`
- Modify: `apps/www/src/routes/ai-visibility-tools/category/index.tsx`
- Modify: `apps/www/src/routes/ai-visibility-tools/category/$slug.tsx`
- Modify: `apps/www/src/routes/ai-visibility-tools/category/open-source.tsx`
- Modify: `apps/www/src/routes/ai-visibility-tools/compare/index.tsx`
- Modify: `apps/www/src/routes/ai-visibility-tools/compare/$slug.tsx`
- Modify: `apps/www/src/routes/ai-visibility-tools/features/index.tsx`
- Modify: `apps/www/src/routes/ai-visibility-tools/features/$slug.tsx`
- Modify: `apps/www/src/routes/status.tsx`
- Modify: `apps/www/src/routes/brand.tsx`
- Modify: `apps/www/src/routes/changelog.tsx`
- Modify: `apps/www/src/routes/roadmap.tsx`
- Create: `e2e/www-tests/site-governance.spec.ts`

- [ ] **Step 1: Write the failing governance suite**

```ts
const policies = [
  { path: "/blog", robots: "noindex,follow", context: null },
  { path: "/glossary", robots: "noindex,follow", context: null },
  { path: "/ai-search", robots: "noindex,follow", context: "Legacy research archive" },
  { path: "/aeo-for", robots: "noindex,follow", context: "Legacy research archive" },
  { path: "/ai-visibility-tools", robots: "noindex,follow", context: "Upstream Yonaris comparison archive" },
];
```

Assert shared header/footer and exact robots meta on the family indexes plus one real dynamic Blog article, one Glossary slug, one AI Search slug, one AEO slug, and every AI Visibility nested template path. Assert visible archive context where required, Docs Open-source Documentation context, and live Status functionality. Expected RED against current mixed shells/policy.

```powershell
pnpm.cmd --filter e2e exec playwright test --config playwright.www.config.ts www-tests/site-governance.spec.ts --project=chromium
```

- [ ] **Step 2: Migrate publication and legacy families**

Blog/Glossary use PublicationShell and `noindex,follow`. AI Search/AEO use PublicationShell plus `LegacyArchiveContext kind="legacy-research"`. Every AI Visibility Tools template uses upstream comparison context and noindex. Every migrated route head calls `siteRouteHead()` with its manifest family key, concrete dynamic canonical path, and existing content title/description. Do not rewrite historical copy; the visible context prevents entity confusion.

- [ ] **Step 3: Migrate utility routes**

Docs, Status, Brand, Changelog use UtilityShell and `siteRouteHead()` with their existing metadata. Roadmap is preserved as open-source utility, `noindex,follow`, outside sitemap, and uses the same head helper. Preserve loaders, status data, search, markdown, and asset behavior.

- [ ] **Step 4: Verify and commit**

```powershell
pnpm.cmd --filter e2e exec playwright test --config playwright.www.config.ts site-governance.spec.ts
pnpm.cmd --filter @workspace/www check-types
git add apps/www/src/components/blog-post-layout.tsx apps/www/src/components/docs-page-layout.tsx apps/www/src/routes/blog apps/www/src/routes/glossary apps/www/src/routes/ai-search apps/www/src/routes/aeo-for apps/www/src/routes/ai-visibility-tools apps/www/src/routes/status.tsx apps/www/src/routes/brand.tsx apps/www/src/routes/changelog.tsx apps/www/src/routes/roadmap.tsx e2e/www-tests/site-governance.spec.ts
git commit -m "govern the legacy public site"
```

### Task 3: Install permanent route aliases and old Agent redirects

**Files:**
- Create: `apps/www/src/lib/permanent-redirect.ts`
- Create: `apps/www/src/lib/permanent-redirect.test.ts`
- Create: `e2e/www-tests/site-routing.spec.ts`
- Modify: `apps/www/src/routes/platform.tsx`
- Modify: `apps/www/src/routes/features.tsx`
- Modify: `apps/www/src/routes/zh/platform.tsx`
- Modify: `apps/www/src/routes/methodology.tsx`
- Modify: `apps/www/src/routes/zh/methodology.tsx`
- Modify: `apps/www/src/routes/results.tsx`
- Modify: `apps/www/src/routes/zh/results.tsx`
- Modify: `apps/www/src/routes/vision.tsx`
- Modify: `apps/www/src/routes/pricing.tsx`
- Modify: `apps/www/src/routes/off-site-aeo.tsx`
- Modify: `apps/www/src/routes/agent/platform.ts`
- Modify: `apps/www/src/routes/agent/methodology.ts`
- Modify: `apps/www/src/routes/agent/results.ts`
- Modify: `apps/www/src/components/not-found.tsx`

**Interfaces:**

```ts
export function permanentRedirect(from: string): never {
  const rule = getRedirect(from);
  if (!rule) throw new Error(`No permanent redirect registered for ${from}`);
  throw redirect({ to: rule.to, statusCode: 308 });
}
```

- [ ] **Step 1: Write failing pure and HTTP redirect tests**

Assert every alias resolves to an existing canonical and `permanentRedirect()` refuses undeclared paths. Playwright request tests use `maxRedirects: 0` and assert exact status/location for company and Agent aliases.

```powershell
pnpm.cmd --filter @workspace/www test -- src/lib/permanent-redirect.test.ts
pnpm.cmd --filter e2e exec playwright test --config playwright.www.config.ts www-tests/site-routing.spec.ts --project=chromium
```

Expected RED is an old route body or non-308 response, never a test syntax failure.

- [ ] **Step 2: Replace old page bodies with manifest-backed redirects**

Activate only after destination routes exist. Remove old page metadata/content so no alias can render a duplicate page.

- [ ] **Step 3: Verify and commit**

```powershell
pnpm.cmd --filter @workspace/www test -- src/lib/permanent-redirect.test.ts
pnpm.cmd --filter e2e exec playwright test --config playwright.www.config.ts site-routing.spec.ts
git add apps/www/src/lib/permanent-redirect* apps/www/src/routes/platform.tsx apps/www/src/routes/features.tsx apps/www/src/routes/zh/platform.tsx apps/www/src/routes/methodology.tsx apps/www/src/routes/zh/methodology.tsx apps/www/src/routes/results.tsx apps/www/src/routes/zh/results.tsx apps/www/src/routes/vision.tsx apps/www/src/routes/pricing.tsx apps/www/src/routes/off-site-aeo.tsx apps/www/src/routes/agent/platform.ts apps/www/src/routes/agent/methodology.ts apps/www/src/routes/agent/results.ts apps/www/src/components/not-found.tsx e2e/www-tests/site-routing.spec.ts
git commit -m "retire duplicate public routes"
```

### Task 4: Remove old marketing facades after zero-consumer proof

**Files:**
- Create: `apps/www/scripts/audit-legacy-consumers.mjs`
- Create: `apps/www/scripts/audit-legacy-consumers.test.mjs`
- Modify: `apps/www/package.json`
- Modify or delete after search: `apps/www/src/lib/marketing-content.ts`
- Modify or delete after search: `apps/www/src/lib/marketing-content.test.ts`
- Modify or delete after search: `apps/www/src/lib/marketing-seo.ts`
- Delete after route migration: `apps/www/src/components/marketing/detail-page.tsx`
- Modify or delete after shell migration: `apps/www/src/components/marketing/marketing-shell.tsx`
- Delete after Home migration: `apps/www/src/components/marketing/home-page.tsx`
- Delete after Home migration: `apps/www/src/components/marketing/home-hero.tsx`
- Delete after Home migration: `apps/www/src/components/marketing/market-diagnostic-preview.tsx`
- Delete after Diagnostic migration: `apps/www/src/components/marketing/diagnostic-page.tsx`
- Delete after Diagnostic migration: `apps/www/src/components/marketing/diagnostic-form.tsx`
- Modify only if the audit still finds a consumer: the exact tracked file named in the failing audit output; add that path to this task's ledger before editing it.

- [ ] **Step 1: Add a failing legacy-consumer audit**

Create `audit-legacy-consumers.mjs` and its Node test. It obtains tracked plus untracked nonignored candidates with `git ls-files --cached --others --exclude-standard -- apps/www/src`, filters to production `.ts`/`.tsx`, and explicitly excludes `*.test.*`, `*.spec.*`, and `routeTree.gen.ts`. It scans those exact files and fails with every path and line when imports or identifiers reference `MarketingDetailPage`, old `MARKETING_ROUTES`, old `MARKETING_SITEMAP_PATHS`, `marketing-seo`, or old page keys `platform|methodology|results` outside the exact redirect route allowlist. The fixture test must prove an untracked forbidden consumer is caught, an allowed redirect is accepted, and generated/test fixtures are excluded. Add package script `audit:legacy-marketing`.

```powershell
node --test apps/www/scripts/audit-legacy-consumers.test.mjs
pnpm.cmd --filter @workspace/www audit:legacy-marketing
```

The fixture test turns GREEN when the scanner is correct; the repository audit must remain RED until Step 2 moves the reported consumers.

- [ ] **Step 2: Move remaining consumers, then delete or reduce facades**

Run the audit before editing and record its complete path list. Migrate each named consumer to `content/site`, `site-seo`, `site-manifest`, or `diagnostic-schema`; then delete the five obsolete marketing page/form files above. Keep a facade only when a non-marketing utility truly needs a stable type; it must re-export new site modules and contain no copy, routes, sitemap arrays, or claim logic. Rerun the audit and require zero forbidden consumers before deleting or reducing the facades.

- [ ] **Step 3: Verify and commit**

```powershell
pnpm.cmd --filter @workspace/www audit:site-manifest
pnpm.cmd --filter @workspace/www audit:legacy-marketing
node --test apps/www/scripts/audit-legacy-consumers.test.mjs
pnpm.cmd --filter @workspace/www test
pnpm.cmd --filter @workspace/www check-types
git add apps/www/scripts/audit-legacy-consumers.mjs apps/www/scripts/audit-legacy-consumers.test.mjs apps/www/package.json apps/www/src/lib/marketing-content.ts apps/www/src/lib/marketing-content.test.ts apps/www/src/lib/marketing-seo.ts apps/www/src/components/marketing/detail-page.tsx apps/www/src/components/marketing/marketing-shell.tsx apps/www/src/components/marketing/home-page.tsx apps/www/src/components/marketing/home-hero.tsx apps/www/src/components/marketing/market-diagnostic-preview.tsx apps/www/src/components/marketing/diagnostic-page.tsx apps/www/src/components/marketing/diagnostic-form.tsx
git commit -m "remove the split marketing foundation"
```

If the failing audit named additional tracked consumers, append only those exact paths to this `git add`; never stage the whole `apps/www/src` tree.

### Task 5: Expand production smoke and whole-site parity tests

**Files:**
- Modify: `apps/www/scripts/smoke-marketing.mjs`
- Modify: `apps/www/scripts/smoke-marketing.test.mjs`
- Create: `apps/www/scripts/smoke-marketing-caddy.mjs`
- Create: `apps/www/scripts/smoke-marketing-caddy.test.mjs`
- Create: `apps/www/src/lib/caddy-policy.test.ts`
- Modify: `apps/www/package.json`
- Modify: `e2e/package.json`
- Create: `e2e/www-tests/human-agent-parity.spec.ts`
- Create: `deploy/las/caddy/yonaris-marketing-v2.caddy`
- Create: `deploy/las/caddy/cloudflare-ip-ranges.json`
- Modify: `deploy/las/caddy/yonaris-marketing.caddy`
- Modify: `deploy/las/caddy/yonaris-marketing.test.mjs`
- Modify: `deploy/las/bin/install-marketing-caddy.sh`
- Modify: `deploy/las/bin/install-marketing-caddy.test.sh`
- Modify: `.github/workflows/deploy-marketing.yaml`

- [ ] **Step 1: Write failing smoke, Caddy-policy, and human/Agent parity fixtures**

Require: 14 core HTML canonicals; every declared redirect with manual redirect; sitemap namespace/alternates; Agent/llms; `Accept: text/markdown`; legacy noindex/context; every local HTML/CSS/font/image asset; diagnostic invalid/honeypot failure that cannot reach Resend. Current smoke must fail these additions.

```powershell
node --test apps/www/scripts/smoke-marketing.test.mjs apps/www/scripts/smoke-marketing-caddy.test.mjs
pnpm.cmd --filter @workspace/www test -- src/lib/caddy-policy.test.ts
pnpm.cmd --filter e2e exec playwright test --config playwright.www.config.ts www-tests/human-agent-parity.spec.ts --project=chromium
```

Expected RED is missing route/proxy/parity coverage and the absent Caddy-backed smoke helper, never a fixture or import error.

- [ ] **Step 2: Implement redirect-aware, asset-closure smoke**

Keep the existing same-origin asset collector. Add `redirect: "manual"` for redirects and separate content-type/copy assertions. The Caddy-backed Diagnostic probe must be valid at every envelope layer: public `Origin: https://yonaris.com`, `Sec-Fetch-Site: same-origin`, `Content-Type: application/json`, identity encoding, and a valid UUID `Idempotency-Key`. Its lead body is otherwise schema-valid and differs only by a filled honeypot. Assert direct `400` JSON with `{ ok: false, code: "invalid_request" }`, proving Caddy origin reconstruction and header forwarding work while rejection still occurs before environment lookup or email delivery. A 403 or other generic failure must fail the smoke. Include RSS, OpenAPI, nested OG, and repo-activity endpoints in the route closure.

Copy the pre-rebuild `yonaris-marketing.caddy` byte-for-byte to `yonaris-marketing-v2.caddy` before changing the active fragment. Build the final public path set from the manifest contract: all core/resource/utility/publication/legacy canonicals and patterns, every redirect source, Agent/llms/sitemap/robots/RSS/OpenAPI/OG/repo-activity/API endpoints, and static asset families are proxied; `/llms.mdx/site/*` and other internal-only routes stay blocked. `caddy-policy.test.ts` imports `SITE_MANIFEST`/`SITE_REDIRECTS`, reads the fragment, and proves that contract rather than relying on a hand-copied subset.

Keep proxy trust site-scoped instead of altering the shared server's global Caddy options. Check in `cloudflare-ip-ranges.json` as the exact IPv4/IPv6 sets read from Cloudflare's official `https://www.cloudflare.com/ips-v4` and `/ips-v6` endpoints on `2026-08-22`. The fragment defines a first `@cloudflarePublic` matcher combining the public path set with `remote_ip` equal to that reviewed set; its proxy removes incoming `X-Yonaris-Client-IP`, derives a replacement from Cloudflare's `CF-Connecting-IP`, then removes the raw Cloudflare header upstream. A second fallback public matcher handles every non-Cloudflare socket peer, removes both incoming headers, and sets the internal header from `{http.request.remote.host}`. The application therefore gets per-visitor separation behind a verified Cloudflare peer, while direct-origin clients cannot choose a bucket. The policy test requires exact range equality with the JSON snapshot, strict branch order, header removal/replacement, a valid-IP guard in the handler, and no global change to unrelated Caddy sites.

Refactor `install-marketing-caddy.sh` to accept a list of reviewed predecessor fragments. It accepts legacy redirect, v1, and the exact v2 snapshot, refuses every unknown live block, remains idempotent, validates/reloads/rolls back with its recovery directory guarantees, and checks stable final copy (`See how AI is shaping your market.`) plus representative core, resource, utility, legacy, machine, redirect, and Portal responses through Caddy. Extend the shell harness for v2→final, every older reviewed predecessor, unknown-state refusal, health failure rollback, and no emergency-backup loss.

`smoke-marketing-caddy.mjs` is the checked orchestration boundary for CI and final QA. Given an already-built image ref, it creates unique Docker networks and a temporary candidate Caddyfile, changes only the reviewed TLS directive to `tls internal` and upstream to the app's network alias, and runs that exact app image plus a digest-pinned official Caddy image. After Caddy is ready, the helper copies `/data/caddy/pki/authorities/local/root.crt` from the Caddy container into its private temporary directory; the isolated smoke container mounts that certificate read-only and sets `NODE_EXTRA_CA_CERTS` before running `smoke-marketing.mjs` against `https://yonaris.com/` through the Caddy network alias. It never disables TLS verification.

The same helper runs an exact proxy-identity harness with a tiny local header-echo upstream: a fixture peer attached inside one reviewed Cloudflare CIDR sends two valid `CF-Connecting-IP` values and must produce two distinct internal client identities; an untrusted-network peer sends changing spoofed `CF-Connecting-IP` and `X-Yonaris-Client-IP` values and must always resolve to its unchanged socket peer. The harness extracts the same matcher/proxy directives used by the candidate fragment, not a second hand-written policy. The helper owns all containers, networks, copied CA, and temp paths and removes them in `finally`, including on forced route, identity, and TLS failures. Its fixture test proves exact replacements, unexpected-fragment refusal, CA copy/mount, spoof cases, and cleanup command execution. The workflow calls this helper before pushing the image.

- [ ] **Step 3: Add human/Agent parity browser checks**

For Home and `/zh`, compare visible category/current-scope/limitation facts with negotiated Markdown and verify `/agent` indexes those canonicals. For Product, Approach, Research, Company, GEO, and Diagnostic, compare HTML with negotiated Markdown and the corresponding Agent document. Do not compare formatting or translations word-for-word.

- [ ] **Step 4: Verify and commit**

```powershell
node --test apps/www/scripts/smoke-marketing.test.mjs
node --test apps/www/scripts/smoke-marketing-caddy.test.mjs
pnpm.cmd --filter @workspace/www test -- src/lib/caddy-policy.test.ts
node --test deploy/las/caddy/yonaris-marketing.test.mjs
bash deploy/las/bin/install-marketing-caddy.test.sh
pnpm.cmd --filter e2e exec playwright test --config playwright.www.config.ts www-tests/human-agent-parity.spec.ts --project=chromium
git add apps/www/scripts/smoke-marketing.mjs apps/www/scripts/smoke-marketing.test.mjs apps/www/scripts/smoke-marketing-caddy.mjs apps/www/scripts/smoke-marketing-caddy.test.mjs apps/www/src/lib/caddy-policy.test.ts apps/www/package.json e2e/package.json e2e/www-tests/human-agent-parity.spec.ts deploy/las/caddy/yonaris-marketing-v2.caddy deploy/las/caddy/cloudflare-ip-ranges.json deploy/las/caddy/yonaris-marketing.caddy deploy/las/caddy/yonaris-marketing.test.mjs deploy/las/bin/install-marketing-caddy.sh deploy/las/bin/install-marketing-caddy.test.sh .github/workflows/deploy-marketing.yaml
git commit -m "prove the complete marketing surface"
```

### Task 6: Final whole-site verification and independent review

**Files:**
- Create output only: `e2e/test-results-www/visual-qa/**`
- Modify: `.changeset/quiet-markets-shape.md`
- Modify only after a new failing regression identifies the defect: any exact in-scope application, route, server, script, Docker, `deploy/las`, workflow, or E2E file implicated by the failing check, plus its focused regression test. Record the path and failure in the SDD ledger before editing.

- [ ] **Step 1: Run fresh complete verification**

```powershell
pnpm.cmd --filter @workspace/www audit:site-manifest
pnpm.cmd --filter @workspace/www test
pnpm.cmd --filter @workspace/www check-types
pnpm.cmd --filter @workspace/www build
node --test apps/www/scripts/smoke-marketing.test.mjs
pnpm.cmd --filter e2e run test:www
pnpm.cmd --filter e2e run test:www:analytics
pnpm.cmd --filter e2e run test:www:visual
docker build --file docker/Dockerfile.www --target www --tag yonaris-www:full-site-review .
node apps/www/scripts/smoke-marketing-caddy.mjs yonaris-www:full-site-review
pnpm.cmd changeset status --since=origin/main
```

This is the production-build smoke through the candidate Caddy policy; `smoke-marketing-caddy.mjs` is the checked `try/finally` owner, and `smoke-marketing.test.mjs` remains the deterministic fixture test.

- [ ] **Step 2: Inspect every visual artifact and core interaction state**

Use `view_image` at native size. Any defect gets a failing regression test before a fix. Rerun the full visual matrix after the final fix.

- [ ] **Step 3: Request an independent whole-branch review**

Generate a review package from the branch merge base through HEAD. Reviewer checks the approved spec, all four plans, truth boundary, security, accessibility, responsive behavior, route governance, human/Agent parity, and deployment smoke. Fix every Critical/Important finding through the subagent review loop.

- [ ] **Step 4: Commit the final verified fixes**

```powershell
git status --short
# Stage only the exact regression test and focused implementation files changed in response to review.
git add .changeset/quiet-markets-shape.md
git commit -m "finish the Yonaris full site rebuild"
```

Expand the existing `@workspace/www` patch changeset from the superseded homepage-only sentence to the complete bilingual site rebuild, route governance, human/Agent parity, and reliable diagnostic delivery. Do not create an empty commit when review requires no code changes; if the changeset is the only final diff, commit it by itself.

## Plan 4 Acceptance

- Every public URL is core, resource, utility, redirect, or visibly contextualized legacy archive.
- No reachable page uses the old company identity or unreviewed indexing policy.
- All redirects, machine representations, sitemap entries, assets, and safe diagnostic failure paths are smoke-tested.
- Complete automated and visual QA pass, followed by a clean independent whole-branch review.

## Cross-Plan Execution Order

Execute the approved plan set in this dependency order:

1. Site Foundation Tasks 1–4.
2. Core Page Task 0, then Product, Approach, Research, Company, and GEO Tasks 1–5.
3. Diagnostic Acquisition Tasks 1–4.
4. Core Page Home Task 6, after it can consume Product/Approach/Research/Diagnostic preview exports.
5. Site Foundation Task 5, after all fourteen core human routes exist.
6. Core Page Visual Task 7.
7. Site Governance and Release Tasks 1–6.

No task starts while the preceding task has an unresolved Critical or Important review finding.
