# Global Website Release 0/1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a contained global-English commercial website and Portal entry that replace every reachable English core page with a graphic, evidence-led experience, remove retired public/internal exposure, and leave the Chinese edition unchanged.

**Architecture:** Treat marketing (`apps/www`) and Portal (`apps/web`) as separate deployable products sharing one opaque public-output policy. Route English marketing pages through a new `global-en` edition registry and `.global-en` design namespace; keep every `/zh` route on the legacy bilingual implementation. Release 0 establishes source/artifact/image/live containment and a precise Portal public contract. Release 1 delivers all eight English commercial pages, an English-only diagnostic v2 boundary, truthful SEO/machine documents, and deployment gates.

**Tech Stack:** pnpm 11.5, Node.js 24, TypeScript 7, React 19, TanStack Start/Router, Vite 8, Vitest 4, Node test runner, Playwright 1.61, CSS, Zod 4, Nitro, Caddy/Nginx/Docker.

**Spec:** `docs/superpowers/specs/2026-08-24-global-website-edition-redesign.md`

## Global Constraints

- Work only in `E:\Yonaris\.worktrees\homepage-product-stage` on `codex/homepage-product-stage`.
- Use pnpm only. Do not run database migrations.
- Write a failing behavioral test before each production change, observe the expected failure, implement the minimum code, then rerun the focused test.
- Do not push, publish, deploy, or merge while the remote repository is publicly visible. Local commits are allowed.
- Do not expose retired first-party provenance, distribution, or positioning phrases in source, tests, build output, images, metadata, error envelopes, source maps, or live responses. Tests use neutral fixture phrases and opaque policy fingerprints.
- Keep legally required third-party notices isolated from public artifacts. Any exception inventory lives outside the repository and must contain fingerprint IDs, exact paths or artifact digests, legal basis, approver, and expiry.
- Do not modify Chinese page content, section order, visual DOM, diagnostic v1 payload, or privacy disclosure. Allowed Chinese differences are generated route code, English-independent timestamps, and explicit baseline fixture updates approved by the task reviewer.
- Do not invent customers, platforms, results, dates, response times, awards, certifications, retention promises, or legal claims. Product visuals are schema demonstrations with generic labels only.
- Every English page must have one H1, one main landmark, a static graphic baseline, keyboard-safe interactions, reduced-motion behavior, and a useful mobile composition.
- New English CSS selectors begin with `.global-en` or `[data-edition="global-en"]`; never append bare overrides to legacy page selectors.
- Portal public copy comes from one typed contract. Authenticated product copy may remain task-specific but must pass the same output policy.
- User-visible packages receive a changeset in the integration task.
- The SDD ledger is `.superpowers/sdd/2026-08-24-global-website-release-0-1/progress.md`, is gitignored by the skill workspace, and records only task/base/head/status, commands/results, opaque finding IDs with path/line, policy digest, timestamp, owner role, and external deployment prerequisites. It never records retired plaintext or lead data.
- Capture the Chinese DOM-text and screenshot baseline from commit `4e3ad82a` before the first shared `apps/www` production change. Every later task that touches `apps/www` reruns the freeze suite.

## Planned File Structure

```text
security/
  public-output-policy.v1.json
  public-output-surfaces.marketing.v1.json
  public-output-surfaces.portal.v1.json
scripts/
  lib/public-output-policy.mjs
  public-output-audit.mjs
  public-output-policy.test.mjs
apps/web/
  scripts/audit-public-surface.mjs
  scripts/audit-public-surface.test.mjs
  src/lib/portal-public-contract.ts
  src/lib/portal-public-contract.test.ts
  src/components/portal-public-shell.tsx
  src/components/portal-public-shell.test.tsx
apps/www/src/
  editions/
    types.ts
    registry.ts
    translation-equivalences.ts
    public-surface-registry.ts
    global-en/edition.ts
    zh-cn-legacy/edition.ts
  content/site/global-en/
    types.ts
    home.ts
    product.ts
    approach.ts
    research.ts
    company.ts
    geo.ts
    diagnostic.ts
    privacy.ts
  components/site/global-en/
    global-english-shell.tsx
    global-english-header.tsx
    global-english-footer.tsx
    graphic-frame.tsx
    pages/*.tsx
    visuals/*.tsx
  lib/
    global-english-analytics.ts
    global-english-diagnostic-schema.ts
    global-english-diagnostic-client.ts
    global-english-diagnostic-delivery.server.ts
  styles/global-en/
    core.css
    home.css
    product.css
    approach.css
    research.css
    company.css
    geo.css
    diagnostic.css
    privacy.css
  routes/api/diagnostic/global-en.ts
e2e/
  playwright.portal-public.config.ts
  portal-public-tests/portal-entry.spec.ts
```

The route files under `apps/www/src/routes/*.tsx` will import the new English pages. Files under `apps/www/src/routes/zh/*.tsx` continue to import the existing locale-aware pages.

---

## Task 1: Add the opaque public-output policy engine

**Files:**

- Create: `security/public-output-policy.v1.json`
- Create: `security/public-output-surfaces.marketing.v1.json`
- Create: `security/public-output-surfaces.portal.v1.json`
- Create: `security/public-output-release-manifest.schema.json`
- Create: `security/private-output-exceptions.schema.json`
- Create: `security/private-retired-route-probes.schema.json`
- Create: `security/public-output-release-manifest.v1.json`
- Create: `scripts/lib/public-output-policy.mjs`
- Create: `scripts/public-output-audit.mjs`
- Create: `scripts/public-output-policy.test.mjs`
- Create: `scripts/verify-public-output-release.mjs`
- Modify: `package.json`

**Interfaces:**

```ts
export interface Fingerprint {
  id: string;
  sha256: string;
  characters: number;
  tokens: number;
  severity: "block";
}

export interface Finding {
  id: string;
  severity: "block";
  surface: string;
  source: string;
  offset: number;
}

export declare function normalizePublicText(value: string): string;
export declare function tokenizePublicText(value: string): string[];
export declare function scanPublicText(input: {
  policy: { fingerprints: Fingerprint[] };
  surface: string;
  source: string;
  text: string;
}): Finding[];
export declare function scanPaths(input: {
  policyPath: string;
  inventoryPath: string;
  phase: "source" | "artifact" | "image-root";
  root: string;
}): Promise<Finding[]>;
```

The tracked release manifest contains SHA-256 digests for the policy plus both public surface inventories. At CI/deploy time, `verify-public-output-release.mjs` additionally compares `YONARIS_RETIRED_ROUTE_PROBE_SHA256` and `YONARIS_OUTPUT_EXCEPTION_SHA256` with their protected files and writes a private attestation to `YONARIS_RELEASE_ATTESTATION_FILE`; it never copies protected contents into build or public artifacts. The protected exception inventory is injected through `YONARIS_OUTPUT_EXCEPTION_FILE` and validates against this non-secret schema:

```ts
export interface PrivateOutputException {
  fingerprintId: string;
  exactPathSha256?: string;
  artifactSha256?: string;
  legalBasisReference: string;
  approvedByRole: "release-owner";
  approvedAt: `${number}-${number}-${number}T${string}Z`;
  expiresAt: `${number}-${number}-${number}T${string}Z`;
}
```

Policy entries use only this shape:

```json
{
  "id": "provenance_01",
  "sha256": "c34e8bafe33b7f1cb1335ff6a07a0b7efca46412ba91bb379a322099a285c442",
  "characters": 4,
  "tokens": 1,
  "severity": "block"
}
```

The complete initial fingerprint inventory is fixed for this release:

| ID | SHA-256 | Characters | Tokens |
|---|---|---:|---:|
| `provenance_01` | `c34e8bafe33b7f1cb1335ff6a07a0b7efca46412ba91bb379a322099a285c442` | 4 | 1 |
| `provenance_02` | `f0b7e42351bc34d2453e0465c175c291b5be3f88fe1b1f0a4fecfaa806d3659a` | 6 | 1 |
| `distribution_01` | `1ae64990e804a162b3728158b8f09fe90b2858acc74e9357ad5dedab65741c94` | 11 | 2 |
| `distribution_02` | `b829e805ab160bf10124b48da39c07eecc55bea7b9229820abbcc396ebf35cf1` | 10 | 1 |
| `distribution_03` | `16dc8ea1cf4807b0db5c890f39c970a66f240e2d28617c0a53a7c5e0c0c4cbf0` | 2 | 1 |
| `positioning_01` | `ebb9e574da5022b61ce52feb9b58cfd56054afc14427a158037e0633485b6584` | 22 | 3 |
| `positioning_02` | `8f10a6e6110709207aa45589b64b1436ee14bd490bf17da0e2ec6181df18e45a` | 13 | 2 |
| `positioning_03` | `712e4584a902fc71986b04a1d99feb8ad08be60702f5b53cd2d4fb604497a100` | 13 | 2 |
| `positioning_04` | `a73a5201e6244acfcd69f6d5ceb56d2e82ee9b31c28cc7b4881cad49a89e7adc` | 13 | 2 |
| `positioning_05` | `e34aed7a3c93d7b6fc0ac9039b0e4612bb7aba9a78a1c14d0d02be7b4cfd45cd` | 18 | 2 |
| `positioning_06` | `76ebb28a3fa59d97af5848250f953958279939c3de95022cca45698ab3129693` | 19 | 2 |
| `positioning_07` | `391b1fcbfe1f411b63fb97d41d691f45b77cb66cfa4a91cecc9d9a6525a44884` | 17 | 3 |
| `positioning_08` | `60772f3f951985315cd9e129db23a4384a01bff47f6871c6d16d68c336c5ba42` | 21 | 4 |
| `positioning_09` | `13fef948be33bd55157a607e8b1d5ae76d32d695e6b608ada49e937b4983275f` | 16 | 2 |

- [ ] Add Node tests that use a neutral fixture policy generated from `retired phrase`, never a real retired phrase. Cover NFKC normalization, lowercase folding, zero-width removal, HTML entities, percent encoding, JavaScript escapes, slash/dash/underscore/whitespace folding, token-window hashing, safe substrings, deterministic findings, and redacted output.
- [ ] Run `pnpm exec node --test scripts/public-output-policy.test.mjs`; confirm failure because the module does not exist.
- [ ] Implement the normalization and hashing library. A finding exposes only `{id, severity, surface, source, offset}` and never matched text.
- [ ] Populate `security/public-output-policy.v1.json` with the approved opaque fingerprints from the specification audit. Include `policyVersion`, `normalizationVersion`, `ownerRole`, and surface classes; include no plaintext aliases.
- [ ] Define separate marketing and Portal inventories covering tracked source, `.output`, exported image roots, and runtime route classes.
- [ ] Implement the CLI with `source`, `artifact`, and `image-root` phases. Reject public exceptions; read optional legal exceptions only from `YONARIS_OUTPUT_EXCEPTION_FILE` outside the repository.
- [ ] Implement release-manifest generation/verification. The tracked manifest binds the policy and both public-surface inventories; the private deployment attestation binds the protected retired-route and legal-exception inventory digests. CI fails when any digest differs, the owner role is missing, a referenced protected file is missing, an exception fingerprint/path/artifact does not match, approval metadata is invalid, or `expiresAt` is not in the future.
- [ ] Add an ownership test proving only `release-owner` can approve a policy/exception change in the manifest contract. Record no human name or retired plaintext.
- [ ] Add root scripts `audit:public-output` and `test:public-output-policy`.
- [ ] Rerun the focused Node test and a neutral fixture CLI scan; confirm both pass and output remains redacted.
- [ ] Commit with `git commit -m "add the public output policy"`.

---

## Task 2: Remove orphan publication and distribution surfaces

**Files:**

- Delete: `packages/docs/**`
- Delete: `apps/cli/**`
- Delete: `apps/www/.source/**`
- Delete: `apps/www/source.config.ts`
- Delete: `apps/www/source.generated.ts`
- Delete: `apps/www/src/components/mdx.tsx`
- Delete: `apps/www/src/lib/blog.ts`
- Delete: `apps/www/src/components/ai-visibility-software-hub.tsx`
- Modify: `package.json`
- Modify: `pnpm-workspace.yaml`
- Modify: `pnpm-lock.yaml`
- Modify: `apps/www/package.json`
- Modify: `apps/www/vite.config.ts`
- Modify: `apps/www/src/server.ts`
- Modify: `docker/Dockerfile.www`
- Modify or delete: external contribution/funding templates and publication/CLI packaging workflows identified by the topology test
- Create: `apps/www/src/components/site/zh-cn-legacy-freeze.test.tsx`
- Create: `e2e/www-tests/zh-cn-legacy-freeze.spec.ts`
- Create: `e2e/www-tests/fixtures/zh-cn-legacy/dom-text.v1.json`
- Create: `e2e/www-tests/fixtures/zh-cn-legacy/allowed-differences.v1.json`
- Create: desktop/mobile snapshots under `e2e/www-tests/zh-cn-legacy-freeze.spec.ts-snapshots/`

- [ ] Before changing production files, write the Chinese freeze tests for `/zh`, `/zh/product`, `/zh/approach`, `/zh/research`, `/zh/company`, `/zh/geo`, and `/zh/diagnostic`. Capture normalized visible text, heading/section/link/form order, the v1 diagnostic field contract, and 1440×900 plus 390×844 screenshots from revision `4e3ad82a`.
- [ ] Set `allowed-differences.v1.json` to a closed list containing only stable IDs for build hash, current year, shared security changes, retired public-link removal, and reviewed hreflang removal; each entry uses `reviewerRole: "release-owner"`. No broad selector or regex exception is allowed.
- [ ] Run `pnpm --filter e2e exec playwright test --config playwright.www.config.ts www-tests/zh-cn-legacy-freeze.spec.ts` and `pnpm --filter @workspace/www exec vitest run --config vitest.config.ts src/components/site/zh-cn-legacy-freeze.test.tsx`; confirm the captured baseline passes before the first shared change.
- [ ] Add a package-topology test to `scripts/public-output-policy.test.mjs` asserting there is no workspace package for documentation publication or a distributable command-line application, and no production import of the removed content source system.
- [ ] Run the focused test; confirm it fails on the current workspace.
- [ ] Remove the orphan documentation publication package, its generated source files, its `apps/www` dependencies/plugins, and the stale `/docs` content-negotiation branch in `apps/www/src/server.ts`.
- [ ] Remove the distributable CLI package, root link/release scripts that expose it, dedicated packaging/release workflows, and external-contribution surfaces that contradict the proprietary distribution model.
- [ ] Preserve required dependency license files and third-party notices; move no first-party history into those files.
- [ ] Run `pnpm install --lockfile-only` to update the lockfile without switching package managers.
- [ ] Rerun the topology test, Chinese freeze suite, and `pnpm --filter @workspace/www check-types` to catch removed dependency consumers.
- [ ] Commit with `git commit -m "remove retired distribution surfaces"`.

---

## Task 3: Rename active first-party identifiers and scrub tracked history

**Files:**

- Modify: `turbo.json`
- Modify: `docker/Dockerfile`
- Modify: `docker/Dockerfile.www`
- Modify: `packages/config/src/constants.ts`
- Modify: active application code, deployment scripts, workflow files, tests, changelogs, plans, READMEs, and root instructions reported by `audit:public-output`
- Modify: `AGENTS.md`

**Runtime identifier cutover:**

```ts
export const YONARIS_ENCRYPTION_KEY = "YONARIS_ENCRYPTION_KEY" as const;
export const DEFAULT_DATABASE_NAME = "yonaris" as const;
```

- [ ] Run `pnpm audit:public-output -- --phase source` and save only opaque IDs/path/line findings in the SDD ledger; confirm it fails before cleanup.
- [ ] Add source-audit fixture tests proving production environment names, package metadata, comments, fixture text, deployment configuration, image labels, and runtime-user values are scanned while required external legal notices can be referenced only through the protected external exception inventory.
- [ ] Run the focused tests and observe the expected failures.
- [ ] Rename active first-party environment, database, image, runtime-user, config-directory, and application identifiers to Yonaris-owned values across code, Docker, deployment, tests, and workflows. Do not retain a plaintext compatibility alias.
- [ ] Record `YONARIS_ENCRYPTION_KEY must exist in production before deployment` in the local SDD ledger as a deployment prerequisite. Do not deploy or mutate production secrets in this task.
- [ ] Remove stale tracked changelogs/specs/plans that exist only to describe retired public/distribution behavior. Preserve this active plan and its approved specification; rewrite still-operative instructions in product language.
- [ ] Preserve required dependency licenses and isolate any approved legal exception outside the repository/public artifacts.
- [ ] Rerun `pnpm audit:public-output -- --phase source`; require zero findings.
- [ ] Run the Chinese freeze suite, `pnpm --filter @workspace/www check-types`, and `pnpm --filter @workspace/web check-types`.
- [ ] Commit with `git commit -m "rename active first party identifiers"`.

---

## Task 4: Establish the Portal public contract and entry shell

**Files:**

- Create: `apps/web/src/lib/portal-public-contract.ts`
- Create: `apps/web/src/lib/portal-public-contract.test.ts`
- Create: `apps/web/src/components/portal-public-shell.tsx`
- Create: `apps/web/src/components/portal-public-shell.test.tsx`
- Create: `apps/web/src/routes/api/manifest/index.test.ts`
- Modify: `apps/web/src/routes/__root.tsx`
- Modify: `apps/web/src/lib/route-head.ts`
- Modify: `apps/web/src/components/full-page-card.tsx`
- Modify: public/auth consumers of `FullPageCard`
- Modify: `apps/web/src/routes/api/manifest/index.ts`
- Modify: `e2e/tests/og-image.spec.ts`

**Contract:**

```ts
export const PORTAL_PUBLIC_CONTRACT = {
  title: "Yonaris Portal",
  description:
    "Review configured AI answer samples, brand and competitor mentions, available source evidence, and reviewed next tests.",
  headline: "Review how AI represents your brand.",
  capabilities: [
    "Answer samples",
    "Competitor context",
    "Available source evidence",
    "Reviewed next tests",
  ],
} as const;

export function portalManifestName(brandName: string, isDefaultBrand: boolean): string {
  return isDefaultBrand ? PORTAL_PUBLIC_CONTRACT.title : `${brandName} Portal`;
}
```

- [ ] Write contract tests for exact title, description, headline, capability order, default manifest name, and white-label manifest name.
- [ ] Run `pnpm --filter @workspace/web exec vitest run --project=unit src/lib/portal-public-contract.test.ts`; confirm the missing module failure.
- [ ] Implement the typed contract and use it in root title/description/OG/Twitter metadata, route-head defaults, and the manifest handler.
- [ ] Refactor `FullPageCard` so brand title/capabilities are props. Add `PortalPublicShell` as the only public/auth wrapper supplying the public contract; generic post-auth uses must not inherit the public hero implicitly.
- [ ] Write static-render tests proving the shell renders the ordered capabilities, one main landmark, and no retired module labels. Test all public/auth entry consumers use the wrapper.
- [ ] Run the contract, shell, manifest, root-head, and OG focused tests; confirm they pass.
- [ ] Run `pnpm --filter @workspace/web check-types`.
- [ ] Commit with `git commit -m "align the Portal public entry"`.

---

## Task 5: Gate Portal source, artifacts, image contents, and live inventory

**Files:**

- Create: `apps/web/scripts/audit-public-surface.mjs`
- Create: `apps/web/scripts/audit-public-surface.test.mjs`
- Create: `e2e/playwright.portal-public.config.ts`
- Create: `e2e/portal-public-tests/portal-entry.spec.ts`
- Modify: `apps/web/package.json`
- Modify: `e2e/package.json`
- Modify: `apps/web/vite.config.ts`
- Modify: `docker/Dockerfile`
- Modify: `deploy/las/nginx/portal.yonaris.com.conf`
- Modify: `deploy/las/bin/deploy.sh`
- Modify: `.github/workflows/deploy-las.yaml`
- Modify: `.github/workflows/e2e.yaml`

**CLI:**

```text
node apps/web/scripts/audit-public-surface.mjs --phase source
node apps/web/scripts/audit-public-surface.mjs --phase artifact --root apps/web/.output
node apps/web/scripts/audit-public-surface.mjs --phase image-root --root C:\Users\user\AppData\Local\Temp\yonaris-portal-image-root
node apps/web/scripts/audit-public-surface.mjs --phase live --base-url https://portal.yonaris.com
```

- [ ] Add fixture-server tests for redirects, gzip and Brotli responses, HTML-discovered JS/CSS/manifest/icons/social images, CSS imports/URLs, `sourceMappingURL`, error envelopes, `.map` probes, missing content types, and opaque policy findings.
- [ ] Run `pnpm --filter @workspace/web exec node --test scripts/audit-public-surface.test.mjs`; confirm the missing script failure.
- [ ] Implement the Portal adapter on the shared policy engine. Runtime inventory includes `/`, login, register, forgot/reset-password, a random missing page, `/api/manifest`, `/robots.txt`, `/api/og`, and a random missing API path. Follow and scan redirect locations.
- [ ] Disable client and Nitro public source maps in `apps/web/vite.config.ts`. Add artifact and image-root assertions that no `.map` file exists and no output contains a blocked fingerprint.
- [ ] Add a no-auth Playwright configuration and entry test for title, description, headline, capabilities, manifest, robots, 404, API error, keyboard traversal, and a 390px viewport.
- [ ] Remove apex marketing ownership from `deploy/las/nginx/portal.yonaris.com.conf`; it may declare only `portal.yonaris.com`.
- [ ] Place the live audit in `deploy/las/bin/deploy.sh` after the new container health check and before the success marker/old-release cleanup, so nonzero audit status enters the existing rollback path.
- [ ] Add source, `.output`, image-root, and post-deploy live gates to workflows.
- [ ] Build Portal, run artifact audit, and run the fixture-server test. Confirm zero `.map` files and zero findings.
- [ ] Commit with `git commit -m "gate Portal public output"`.

---

## Task 6: Gate the Release 0 marketing public surface

**Files:**

- Create: `apps/www/scripts/audit-public-surface.mjs`
- Create: `apps/www/scripts/audit-public-surface.test.mjs`
- Create: `apps/www/src/components/site/release0-safe-home-page.tsx`
- Create: `apps/www/src/components/site/release0-safe-home-page.test.tsx`
- Create: `apps/www/src/components/site/release0-safe-diagnostic-page.tsx`
- Create: `apps/www/src/components/site/release0-safe-diagnostic-page.test.tsx`
- Create: `apps/www/src/components/site/release0-safe-privacy-page.tsx`
- Create: `apps/www/src/components/site/release0-safe-privacy-page.test.tsx`
- Create: `apps/www/src/lib/release0-global-privacy-boundary.ts`
- Create: `apps/www/src/lib/release0-global-privacy-boundary.test.ts`
- Create: `apps/www/src/lib/legacy-diagnostic-gate.server.ts`
- Create: `apps/www/src/lib/legacy-diagnostic-gate.server.test.ts`
- Modify: `apps/www/package.json`
- Modify: `apps/www/vite.config.ts`
- Modify: `apps/www/src/routes/index.tsx`
- Modify: `apps/www/src/routes/diagnostic.tsx`
- Modify: `apps/www/src/routes/privacy.tsx`
- Modify: `apps/www/src/routes/api/diagnostic.ts`
- Modify: `apps/www/src/lib/diagnostic-delivery.server.test.ts`
- Modify: `apps/www/src/routes/__root.tsx`
- Modify: `apps/www/src/content/site/global.ts`
- Modify: `apps/www/src/content/site/product.ts`
- Modify: `apps/www/src/content/site/approach.ts`
- Modify: `apps/www/src/content/site/research.ts`
- Modify: `apps/www/src/content/site/company.ts`
- Modify: `apps/www/src/content/site/geo.ts`
- Modify: `apps/www/src/content/site/diagnostic.ts`
- Modify: English content/render tests for the preceding modules
- Modify: `apps/www/src/components/not-found.tsx`
- Modify: `apps/www/src/lib/site-navigation.ts`
- Modify: `apps/www/src/lib/site-manifest.ts`
- Delete: `apps/www/src/routes/brand.tsx`
- Delete: `apps/www/src/routes/status.tsx`
- Modify: `apps/www/src/server.ts`
- Modify: `docker/Dockerfile.www`
- Modify: `deploy/las/caddy/yonaris-marketing.caddy`
- Modify: `apps/www/scripts/smoke-marketing.mjs`
- Modify: `apps/www/scripts/smoke-marketing.test.mjs`
- Modify: `apps/www/scripts/smoke-marketing-caddy.mjs`
- Modify: `apps/www/scripts/smoke-marketing-caddy.test.mjs`
- Modify: `.github/workflows/deploy-marketing.yaml`

**Marketing audit command:**

```text
node apps/www/scripts/audit-public-surface.mjs --phase source
node apps/www/scripts/audit-public-surface.mjs --phase artifact --root apps/www/.output
node apps/www/scripts/audit-public-surface.mjs --phase image-root --root C:\Users\user\AppData\Local\Temp\yonaris-marketing-image-root
node apps/www/scripts/audit-public-surface.mjs --phase live --base-url https://yonaris.com
```

- [ ] Add fixture-server tests for the complete marketing inventory: every English and Chinese core route, privacy, random 404, robots, sitemap, registered machine publications, OG image, exact icon/logo paths, redirects, API error envelopes, cached response headers, HTML/CSS-discovered assets, encodings, and `.map` probes.
- [ ] Migrate the 26 exact retired-route probes currently embedded in smoke code into the protected external file referenced by `YONARIS_RETIRED_ROUTE_PROBE_FILE`. The tracked schema requires opaque IDs `retired_route_01` through `retired_route_26`, one absolute path per ID, and expected `404` or `410`; the actual paths never remain in tracked source, tests, plans, build output, or logs.
- [ ] Add Caddy/smoke tests proving every protected retired probe remains unavailable under trailing-slash, case, percent-encoded, `.md`/Markdown, and `Accept: text/markdown` variants; output uses only the opaque ID. Prove `/brand` and `/status` render the branded generic 404, broad `/brand/*` and obsolete asset exposure is rejected, and only individually enumerated icons/logos are served.
- [ ] Add an English-home containment test proving the public category-conflict/self-diagnostic example is absent before the Release 1 home cutover. The Chinese home remains on its existing component and may differ only by the approved removal of retired public links.
- [ ] Add English route-containment tests for Home, Product, How It Works, Evidence, GEO, Company, Diagnostic, Privacy, OG, and machine publications. They reject named fictional records, internal method branding, retired positioning, unsupported outcomes/coverage, obsolete CTAs, unpopulated observation fields that look measured, and unverified legal commitments. Privacy tests cover metadata, body, links, and disabled-state accuracy.
- [ ] Run the new audit, Caddy, smoke, safe-home, route-containment, site-manifest, and navigation tests; confirm they fail on the current public routes and inventory.
- [ ] Implement the marketing adapter with the shared opaque policy engine and the same redacted finding format as Portal.
- [ ] Remove `/brand` and `/status` from route files, canonical/indexable inventory, sitemap, header/footer, and Caddy. Keep only explicitly required first-party logo/icon asset paths.
- [ ] Remove human footer links to machine documents. Keep necessary machine publications discoverable only through their explicit machine registry and headers.
- [ ] Route only `/` to an English-specific Release 0 safe home page; `/zh` remains on the frozen `HomePage locale="zh"`. The safe page includes the figure disclosure `Interface demonstration — no customer or live observation data.` and contains no named company, platform, observation, metric, or timestamp. Task 9 deletes this interim page when the new home route lands.
- [ ] Route only English `/diagnostic` and `/privacy` to Release 0 fail-closed pages. English submission and global-English marketing analytics are disabled; the English v1 API payload is rejected with the generic unavailable response, while Chinese `/zh/diagnostic` and its v1 API behavior remain exactly as captured. Privacy states only that the affected features are unavailable pending verified disclosure and preserves the frozen Chinese disclosure without adding a legal promise.
- [ ] Implement the legacy API gate before delivery dispatch: strict `locale: "en"` v1 payloads return the generic `503 {"ok":false,"code":"unavailable"}` envelope and never call delivery; strict `locale: "zh"` payloads delegate to the unchanged v1 protocol/delivery path. Run `pnpm --filter @workspace/www exec vitest run --config vitest.config.ts src/lib/legacy-diagnostic-gate.server.test.ts src/lib/diagnostic-delivery.server.test.ts src/lib/diagnostic-api-protocol.test.ts` red before implementation and green after.
- [ ] Rewrite only the existing English content branches for all other reachable English pages so Release 0 has zero unsafe route. Do not change the shared page DOM or any Chinese content object. Observation-dependent examples become explicit unpopulated schema states.
- [ ] Remove stale marketing content negotiation and public assets that are not in the inventory. Ensure the final marketing image contains no public source maps or blocked fingerprint.
- [ ] Explicitly disable client and Nitro source maps in `apps/www/vite.config.ts`; test that `.output`, the exported image root, and HTTP `.map` probes contain/return none.
- [ ] Add source, artifact, image-root, and post-deploy live audits to the marketing deployment workflow before its success marker; a failure uses the existing rollback behavior.
- [ ] Build marketing locally, run artifact scan and complete smoke against the built server, then rerun source/Caddy tests and the Chinese freeze suite.
- [ ] Commit with `git commit -m "gate the marketing public surface"`.

---

## Task 7: Add the global-English edition registry and freeze Chinese behavior

**Files:**

- Create: `apps/www/src/editions/types.ts`
- Create: `apps/www/src/editions/registry.ts`
- Create: `apps/www/src/editions/registry.test.ts`
- Create: `apps/www/src/editions/translation-equivalences.ts`
- Create: `apps/www/src/editions/public-surface-registry.ts`
- Create: `apps/www/src/editions/global-en/edition.ts`
- Create: `apps/www/src/editions/zh-cn-legacy/edition.ts`
- Create: `apps/www/src/editions/zh-cn-legacy/edition.test.ts`
- Create: `apps/www/src/content/site/global-en/types.ts`
- Modify: `apps/www/src/lib/site-seo.ts`
- Modify: `apps/www/src/lib/sitemap.ts`
- Modify: `apps/www/src/lib/machine-documents.ts`
- Modify: `apps/www/src/lib/markdown-negotiation.ts`
- Modify: `apps/www/src/lib/site-navigation.ts`
- Modify: `apps/www/src/lib/site-manifest.ts`
- Modify: relevant SEO/sitemap/machine-document tests

**Edition model:**

```ts
export type SiteEdition = "global-en" | "zh-cn-legacy";
export type EditionPageRef = `${SiteEdition}:${string}`;

export const SITE_EDITIONS = {
  "global-en": { locale: "en", languageTag: "en", market: "global" },
  "zh-cn-legacy": { locale: "zh", languageTag: "zh-CN", market: "china" },
} as const;

export interface EditionPage {
  ref: EditionPageRef;
  editionId: SiteEdition;
  locale: "en" | "zh-CN";
  pathname: `/${string}`;
  intentId: string;
  publication: "published" | "draft";
  navigation: readonly ("primary" | "footer" | "utility" | "contextual")[];
  seo: {
    indexable: boolean;
    xDefault?: boolean;
    lastVerified?: `${number}-${number}-${number}`;
  };
  markdownPublicationId?: string;
}

export interface TranslationEquivalence {
  left: EditionPageRef;
  right: EditionPageRef;
  intentId: string;
  reviewedAt: `${number}-${number}-${number}`;
  reviewerRole: "release-owner";
}

export interface EditionDefinition {
  id: SiteEdition;
  home: EditionPageRef;
  pages: readonly EditionPage[];
  primaryNavigation: readonly EditionPageRef[];
  footerNavigation: readonly EditionPageRef[];
  localeFallbackHome: EditionPageRef;
  analyticsPolicy: "disabled" | "global-reviewed";
  diagnosticPolicy: "disabled" | "global-v2" | "legacy-v1";
}

export interface GlobalEnglishPageContract {
  key: CorePageKey | "privacy";
  canonicalPath: `/${string}`;
  title: string;
  description: string;
  sectionIds: readonly string[];
}

export declare function getEdition(id: SiteEdition): EditionDefinition;
export declare function getEditionPage(ref: EditionPageRef): EditionPage;
export declare function findPublishedEditionPage(pathname: string): EditionPage | undefined;
export declare function getEditionNavigation(
  id: SiteEdition,
  slot: EditionPage["navigation"][number],
): readonly EditionPage[];
export declare function getTranslationAlternate(ref: EditionPageRef): EditionPage | undefined;
export declare function resolveEditionSwitch(ref: EditionPageRef, target: SiteEdition): EditionPage;
export declare function getPublishedSitemapPages(): readonly EditionPage[];
```

The registry section order is exact:

```ts
export const GLOBAL_ENGLISH_SECTION_IDS = {
  home: ["hero", "what-changed", "visible-outputs", "evidence-path", "delivery-model", "evidence-preview", "request-close"],
  product: ["scope-rings-hero", "evidence-workbench", "responsibility-lanes", "scope-matrix", "request-close"],
  approach: ["premise-hero", "four-step-path", "step-artifacts", "repeat-observation-boundary", "request-close"],
  research: ["ledger-hero", "metric-anatomy", "cohort-comparison", "answer-annotation", "limits-and-request-close"],
  geo: ["entry-map-hero", "buyer-questions-and-artifacts", "applied-workflow", "scope-matrix", "product-evidence-bridge", "request-close"],
  company: ["operating-model-hero", "purpose-and-current-model", "verified-trust-slot", "principles", "diagnostic-close"],
  diagnostic: ["deliverable-hero", "request-timeline", "two-stage-form", "privacy-failure-and-alternate"],
  privacy: ["hero", "english-disclosure", "chinese-baseline"],
} as const;
```

- [ ] Write registry tests for edition identity, explicit route ownership, exact section IDs/order, canonical paths, unique page refs, an initially empty equivalence list, and edition switching to the target edition home when no reviewed equivalence exists.
- [ ] Extend the already-captured Chinese freeze tests to prove the edition registry still points every `/zh` route to its legacy component, emits no `data-edition="global-en"`, preserves claim IDs/statuses and privacy disclosure, and allows only reviewed hreflang removal.
- [ ] Run `pnpm --filter @workspace/www exec vitest run --config vitest.config.ts src/editions/registry.test.ts src/editions/zh-cn-legacy/edition.test.ts src/components/site/zh-cn-legacy-freeze.test.tsx`; confirm the new edition modules are missing while the committed Chinese baseline remains green.
- [ ] Implement the edition registry without changing `pageZh`, shared legacy page components, or `/zh` route imports.
- [ ] Update SEO and sitemap helpers to consume explicit published edition pages rather than `page key × locale`. No rewritten English page emits a Chinese alternate unless a reviewed `TranslationEquivalence` exists; English remains `x-default`. The visible language switch goes to `/zh` when no equivalence exists.
- [ ] Update machine documents so English facts derive from the global-English page contracts and Chinese facts derive from the frozen registry. Remove hard-coded document counts.
- [ ] Update Markdown negotiation to use an explicit published-page allowlist instead of a core-page/locale cross product. Human footer navigation does not expose machine documents.
- [ ] Preserve the Release 0 `brand` and `status` branded-404 classification; neither path becomes an edition page.
- [ ] Rerun edition, Chinese baseline, SEO, sitemap, and machine-document tests.
- [ ] Commit with `git commit -m "separate the global website edition"`.

---

## Task 8: Build the global-English shell and graphic design system

**Files:**

- Create: `apps/www/src/components/site/global-en/global-english-shell.tsx`
- Create: `apps/www/src/components/site/global-en/global-english-header.tsx`
- Create: `apps/www/src/components/site/global-en/global-english-footer.tsx`
- Create: `apps/www/src/components/site/global-en/graphic-frame.tsx`
- Create: `apps/www/src/components/site/global-en/global-english-shell.test.tsx`
- Create: `apps/www/src/styles/global-en/core.css`
- Create: `apps/www/src/styles/global-en/core.test.ts`
- Modify: `apps/www/src/styles.css`

**Shell contract:**

```tsx
<div className="global-en" data-edition="global-en">
  <GlobalEnglishHeader />
  <main id="main-content">{children}</main>
  <GlobalEnglishFooter />
</div>
```

- [ ] Write static-render tests for skip link, one main landmark, English navigation labels, diagnostic CTA, Portal link, footer route allowlist, active state, mobile menu semantics, and continued Release 0 branded-404 behavior for `/brand` and `/status`.
- [ ] Extend style-policy tests to reject any new selector not rooted at `.global-en` or `[data-edition="global-en"]`; retain no-gradient/raw-color rules; require mobile and `prefers-reduced-motion` blocks.
- [ ] Run the focused shell/style/public-boundary tests and observe missing-file/old-shell failures.
- [ ] Implement a restrained editorial system: warm paper and ink surfaces, high-contrast dark evidence bands, orange as an operational accent, hairline grids, numbered micro-labels, wide display typography, compact mono labels, and no decorative gradient.
- [ ] Implement reusable graphic primitives as semantic HTML/CSS: `GraphicFrame`, `ScopeRings`, `EvidenceLedger`, `SignalMap`, `WorkflowRail`, and `ResponsibilityMatrix`. All content remains readable without animation or JavaScript.
- [ ] Implement the global header/footer without changing shared `SiteHeader`/`SiteFooter`. Footer exposes only live commercial/legal destinations; no resource board, source/distribution, brand-kit, or status destination.
- [ ] Verify the shell does not reintroduce Release 0 retired links or broad assets.
- [ ] Run shell/style/public-boundary tests plus `pnpm --filter @workspace/www check-types`.
- [ ] Commit with `git commit -m "build the global English design system"`.

---

## Task 9: Replace the English home page with the evidence-led commercial journey

**Files:**

- Create: `apps/www/src/content/site/global-en/home.ts`
- Create: `apps/www/src/content/site/global-en/home.test.ts`
- Create: `apps/www/src/components/site/global-en/pages/home-page.tsx`
- Create: `apps/www/src/components/site/global-en/pages/home-page.test.tsx`
- Create: `apps/www/src/components/site/global-en/visuals/answer-diagnostic-window.tsx`
- Create: `apps/www/src/styles/global-en/home.css`
- Modify: `apps/www/src/routes/index.tsx`
- Modify: `apps/www/src/styles.css`
- Delete: `apps/www/src/components/site/release0-safe-home-page.tsx`
- Delete: `apps/www/src/components/site/release0-safe-home-page.test.tsx`

**Page spine:**

```text
Hero → What changed → Visible outputs → Evidence path → Delivery model → Evidence preview → Request close
```

**Hero message:**

```text
Eyebrow: AI market evidence for brands
H1: Know how AI represents your brand—and what to do next.
Body: Yonaris shows how configured AI systems describe and compare your brand, which available sources appear behind the answers, and which next test deserves attention.
Primary CTA: Request a diagnostic
Secondary CTA: See a sample
```

- [ ] Write content tests for exact section order, one anxiety-led buyer problem, visible deliverables, managed-delivery boundary, schema-demo labels, factual claim states, and internal CTA paths.
- [ ] Write static-render tests for one H1/main, seven sections, CTA order, accessible diagnostic window, static no-script completeness, no role segmentation, and no unsupported outcome language.
- [ ] Run `pnpm --filter @workspace/www exec vitest run --config vitest.config.ts src/content/site/global-en/home.test.ts src/components/site/global-en/pages/home-page.test.tsx`; confirm the new page is missing and the English route still renders the Release 0 safe page.
- [ ] Implement the split hero with a product-window visual modeled on the approved reference: Answer, Comparison, Available sources, and Next test views; generic structural labels; and distinct answer/evidence/interpretation/next-test states. Mark the figure exactly `Interface demonstration — no customer or live observation data.` and include no named external company/platform/result.
- [ ] Implement the remaining graphic sections using scope rings, an output stack, a four-step evidence rail, a responsibility matrix, and an annotated evidence preview. Avoid repeating the same card grid in adjacent sections.
- [ ] Switch only `apps/www/src/routes/index.tsx` to the new page and global-English metadata. Leave `/zh` unchanged.
- [ ] Add mobile compositions that preserve graphic meaning rather than hiding the visual, and a reduced-motion static state.
- [ ] Run home content/render/style/SEO tests and `pnpm --filter @workspace/www check-types`.
- [ ] Rerun the Chinese freeze suite; require no unallowlisted difference.
- [ ] Commit with `git commit -m "replace the global home page"`.

---

## Task 10: Establish the Release 1 English Evidence foundation

**Files:**

- Create: `apps/www/src/content/site/global-en/research.ts`
- Create: `apps/www/src/content/site/global-en/research.test.ts`
- Create: `apps/www/src/components/site/global-en/pages/research-page.tsx`
- Create: `apps/www/src/components/site/global-en/pages/research-page.test.tsx`
- Create: `apps/www/src/components/site/global-en/visuals/evidence-ledger.tsx`
- Create: `apps/www/src/styles/global-en/research.css`
- Modify: `apps/www/src/routes/research.tsx`
- Modify: `apps/www/src/styles.css`

- [ ] Write failing tests for the exact section spine, metric definitions, denominator disclosure, time/scope labels, comparison boundaries, annotation states, limitations, and CTA.
- [ ] Write render tests for one H1/main, a ledger table with real headers, accessible metric anatomy, non-color-only states, and visible limitations.
- [ ] Run `pnpm --filter @workspace/www exec vitest run --config vitest.config.ts src/content/site/global-en/research.test.ts src/components/site/global-en/pages/research-page.test.tsx`; confirm the missing content/page failures.
- [ ] Implement the complete five-section Release 1 foundation as static, truthful schema: ledger hero, metric anatomy, definition-only cohort comparison, answer-annotation schema, and limits/request close. Observation-dependent fields render `No observation loaded` or `Not applicable in this interface demonstration`; no collection time, denominator, excerpt, source, finding, named company, or platform is fabricated.
- [ ] Switch only the English `/research` route to the new page and metadata.
- [ ] Rerun the same Vitest command, the Chinese freeze suite, and `pnpm --filter @workspace/www check-types`; require all green.
- [ ] Commit with `git commit -m "replace the global evidence page"`.

---

## Task 11: Contain and stage the Release 1 English Product page

**Files:**

- Create: `apps/www/src/content/site/global-en/product.ts`
- Create: `apps/www/src/content/site/global-en/product.test.ts`
- Create: `apps/www/src/components/site/global-en/pages/product-page.tsx`
- Create: `apps/www/src/components/site/global-en/pages/product-page.test.tsx`
- Create: `apps/www/src/components/site/global-en/visuals/evidence-workbench.tsx`
- Create: `apps/www/src/styles/global-en/product.css`
- Modify: `apps/www/src/routes/product.tsx`
- Modify: `apps/www/src/styles.css`

- [ ] Write failing tests for `scope-rings-hero → evidence-workbench → responsibility-lanes → scope-matrix → request-close`, explicit deliverables, configured-scope language, source-availability language, reviewed-next-test language, and no autonomous-optimization promise.
- [ ] Render-test the dark hero with concentric rings and numbered steps, semantic workbench labels, responsibility lanes, scope matrix headers, and a complete static default.
- [ ] Run `pnpm --filter @workspace/www exec vitest run --config vitest.config.ts src/content/site/global-en/product.test.ts src/components/site/global-en/pages/product-page.test.tsx`; confirm the missing content/page failures.
- [ ] Implement the Release 1 static hero pattern approved by the user: large operational H1 on a dark field, restrained concentric rings, and a numbered four-step rail: define scope, observe answers, inspect available evidence, choose the next reviewed test. Rich focus/selection interaction belongs to the later Release 2 plan.
- [ ] Implement the workbench as a schema-only semantic illustration, not live telemetry. Separate system output, Yonaris review, and customer decision lanes; observation fields use explicit unpopulated states.
- [ ] Switch only English `/product`, add contained responsive styles, then rerun the same Vitest command, the Chinese freeze suite, and `pnpm --filter @workspace/www check-types`.
- [ ] Commit with `git commit -m "replace the global product page"`.

---

## Task 12: Contain and stage the Release 1 English How It Works page

**Files:**

- Create: `apps/www/src/content/site/global-en/approach.ts`
- Create: `apps/www/src/content/site/global-en/approach.test.ts`
- Create: `apps/www/src/components/site/global-en/pages/approach-page.tsx`
- Create: `apps/www/src/components/site/global-en/pages/approach-page.test.tsx`
- Create: `apps/www/src/components/site/global-en/visuals/evidence-path.tsx`
- Create: `apps/www/src/styles/global-en/approach.css`
- Modify: `apps/www/src/routes/approach.tsx`
- Modify: `apps/www/src/styles.css`

- [ ] Write failing tests for `premise-hero → four-step-path → step-artifacts → repeat-observation-boundary → request-close`, the difference between observation and proof, required artifacts, review ownership, and repeat limits.
- [ ] Render-test a visible four-step path, artifact handoffs, customer/Yonaris decision boundary, keyboard-safe annotations, and reduced-motion state.
- [ ] Run `pnpm --filter @workspace/www exec vitest run --config vitest.config.ts src/content/site/global-en/approach.test.ts src/components/site/global-en/pages/approach-page.test.tsx`; confirm the missing content/page failures.
- [ ] Implement a complete static evidence path rather than four identical cards. Each step shows input, artifact, review question, and owner. Pinned/interactive path behavior belongs to the later Release 2 plan.
- [ ] Implement the repeat boundary with a loop diagram that explicitly ends at a reviewed decision rather than promising continuous autonomous improvement.
- [ ] Switch only English `/approach`; rerun the same Vitest command, the Chinese freeze suite, and `pnpm --filter @workspace/www check-types`.
- [ ] Commit with `git commit -m "replace the global approach page"`.

---

## Task 13: Contain and stage the Release 1 English GEO page

**Files:**

- Create: `apps/www/src/content/site/global-en/geo.ts`
- Create: `apps/www/src/content/site/global-en/geo.test.ts`
- Create: `apps/www/src/components/site/global-en/pages/geo-page.tsx`
- Create: `apps/www/src/components/site/global-en/pages/geo-page.test.tsx`
- Create: `apps/www/src/components/site/global-en/visuals/market-question-map.tsx`
- Create: `apps/www/src/styles/global-en/geo.css`
- Modify: `apps/www/src/routes/geo.tsx`
- Modify: `apps/www/src/styles.css`

- [ ] Write failing tests for `entry-map-hero → buyer-questions-and-artifacts → applied-workflow → scope-matrix → product-evidence-bridge → request-close`, global service capability, locale/market configuration, evidence availability, and no universal coverage claim.
- [ ] Render-test the market map as accessible regions/questions/artifacts, not a decorative world map or fabricated heatmap.
- [ ] Run `pnpm --filter @workspace/www exec vitest run --config vitest.config.ts src/content/site/global-en/geo.test.ts src/components/site/global-en/pages/geo-page.test.tsx`; confirm the missing content/page failures.
- [ ] Implement a complete static question-led entry map: Discovery → Description → Comparison → Available sources → Repeat observation. Each node shows one buyer question and one artifact state. Show multilingual/configured scope without implying every country or model is covered; richer Release 2 interaction is out of scope.
- [ ] Add workflow, scope matrix, bridge to broader market intelligence, and close.
- [ ] Switch only English `/geo`; rerun the same Vitest command, the Chinese freeze suite, and `pnpm --filter @workspace/www check-types`.
- [ ] Commit with `git commit -m "replace the global GEO page"`.

---

## Task 14: Contain and stage the Release 1 English Company page

**Files:**

- Create: `apps/www/src/content/site/global-en/company.ts`
- Create: `apps/www/src/content/site/global-en/company.test.ts`
- Create: `apps/www/src/components/site/global-en/pages/company-page.tsx`
- Create: `apps/www/src/components/site/global-en/pages/company-page.test.tsx`
- Create: `apps/www/src/components/site/global-en/visuals/operating-model.tsx`
- Create: `apps/www/src/styles/global-en/company.css`
- Modify: `apps/www/src/routes/company.tsx`
- Modify: `apps/www/src/styles.css`

- [ ] Write failing tests for `operating-model-hero → purpose-and-current-model → verified-trust-slot → principles → diagnostic-close`, accurate operating stage, managed-delivery model, privacy/security boundary, and no fabricated people/customer/history.
- [ ] Render-test operating model lanes, trust artifact slots, principles, contact route, and one H1/main.
- [ ] Run `pnpm --filter @workspace/www exec vitest run --config vitest.config.ts src/content/site/global-en/company.test.ts src/components/site/global-en/pages/company-page.test.tsx`; confirm the missing content/page failures.
- [ ] Implement a compact Release 1 company narrative focused on why the operating model exists for AI-uncertain teams. Its static figure is `Customer question → Yonaris evidence workflow → Reviewable decision`; use evidence artifacts, not a fabricated team gallery or logo wall. Richer trust data belongs to Release 3 when verified.
- [ ] Render the trust slot only from verified repository facts. If no verified certification/customer reference exists, show process controls and limitations instead.
- [ ] Switch only English `/company`; rerun the same Vitest command, the Chinese freeze suite, and `pnpm --filter @workspace/www check-types`.
- [ ] Commit with `git commit -m "replace the global company page"`.

---

## Task 15: Version the English diagnostic, privacy, and analytics boundary

**Files:**

- Create: `apps/www/src/content/site/global-en/diagnostic.ts`
- Create: `apps/www/src/content/site/global-en/privacy.ts`
- Create: `apps/www/src/lib/global-english-diagnostic-schema.ts`
- Create: `apps/www/src/lib/global-english-diagnostic-schema.test.ts`
- Create: `apps/www/src/lib/global-english-diagnostic-client.ts`
- Create: `apps/www/src/lib/global-english-diagnostic-client.test.ts`
- Create: `apps/www/src/lib/global-english-diagnostic-delivery.server.ts`
- Create: `apps/www/src/lib/global-english-diagnostic-delivery.server.test.ts`
- Create: `apps/www/src/lib/global-english-analytics.ts`
- Create: `apps/www/src/lib/global-english-analytics.test.ts`
- Create: `apps/www/src/lib/global-english-privacy-gate.ts`
- Create: `apps/www/src/lib/global-english-privacy-gate.server.ts`
- Create: `apps/www/src/lib/global-english-privacy-gate.test.ts`
- Create: `security/privacy-gate-config.schema.json`
- Create: `apps/www/src/components/site/global-en/pages/diagnostic-page.tsx`
- Create: `apps/www/src/components/site/global-en/pages/diagnostic-page.test.tsx`
- Create: `apps/www/src/components/site/global-en/pages/privacy-page.tsx`
- Create: `apps/www/src/components/site/global-en/pages/privacy-page.test.tsx`
- Create: `apps/www/src/components/site/global-en/global-english-diagnostic-form.tsx`
- Create: `apps/www/src/components/site/global-en/global-english-diagnostic-form.test.tsx`
- Create: `apps/www/src/routes/api/diagnostic/global-en.ts`
- Create: `apps/www/src/styles/global-en/diagnostic.css`
- Create: `apps/www/src/styles/global-en/privacy.css`
- Delete: `apps/www/src/components/site/release0-safe-diagnostic-page.tsx`
- Delete: `apps/www/src/components/site/release0-safe-diagnostic-page.test.tsx`
- Delete: `apps/www/src/components/site/release0-safe-privacy-page.tsx`
- Delete: `apps/www/src/components/site/release0-safe-privacy-page.test.tsx`
- Delete: `apps/www/src/lib/release0-global-privacy-boundary.ts`
- Delete: `apps/www/src/lib/release0-global-privacy-boundary.test.ts`
- Modify: `apps/www/src/routes/__root.tsx`
- Modify: `apps/www/src/lib/posthog.ts`
- Modify: `apps/www/src/lib/posthog.test.ts`
- Modify: `apps/www/src/routes/diagnostic.tsx`
- Modify: `apps/www/src/routes/privacy.tsx`
- Modify: `apps/www/src/styles.css`
- Modify: `deploy/las/caddy/yonaris-marketing.caddy`
- Modify: `apps/www/scripts/smoke-marketing-caddy.test.mjs`

**English v2 payload:**

```ts
const globalEnglishDiagnosticLeadSchema = z.object({
  edition: z.literal("global-en"),
  formVersion: z.literal("r1"),
  website: z.string(),
  brand: z.string(),
  market: z.string(),
  targetLanguage: z.string(),
  question: z.string(),
  competitors: z.string(),
  name: z.string(),
  email: z.string().email(),
  consent: z.literal(true),
  companyUrl: z.string(),
}).strict();
```

**Diagnostic public contract:**

```text
H1: Request a focused AI market diagnostic.
Deliverable: Scoped baseline → Selected answer and available-source evidence → Clearest information gaps → Reviewed next-test candidates
Primary action: Submit diagnostic request
Confirmation boundary: Submission begins a scope review; it does not return an instant scan or score.
```

**Fail-closed privacy gate:**

The production configuration lives outside the repository at `YONARIS_PRIVACY_GATE_FILE`, its digest must equal `YONARIS_PRIVACY_GATE_SHA256`, and it validates against `security/privacy-gate-config.schema.json`:

```ts
export interface VerifiedPrivacyGateConfig {
  schemaVersion: 1;
  reviewedByRole: "privacy-owner";
  reviewReference: string;
  effectiveDate: `${number}-${number}-${number}`;
  servedRegions: readonly string[];
  publicNotice: {
    controllerIdentity: string;
    controllerContact: string;
    collectedFields: readonly string[];
    purposes: readonly { code: string; disclosure: string; applicableBasis: string }[];
    deliveryMechanism: string;
    processorCategories: readonly string[];
    storageAndTransferTreatment: string;
    retentionPeriodOrCriteria: string;
    rightsRoute: `https://${string}`;
    securityContact: string;
    effectiveDate: `${number}-${number}-${number}`;
    intentionallyServedRegions: readonly string[];
  };
  facts: {
    controllerIdentityAndContact: true;
    collectedFields: true;
    purposesAndApplicableBasis: true;
    deliveryMechanism: true;
    processorCategories: true;
    storageAndTransferTreatment: true;
    retentionPeriodOrCriteria: true;
    rightsRoute: true;
    securityContact: true;
  };
  operations: {
    diagnosticDeliveryMatchesNotice: true;
    analyticsMatchesNotice: true;
    rightsRouteVerified: true;
    retentionOperationVerified: true;
  };
  analyticsProvider: "posthog" | "none";
  diagnosticSubmissionEnabled: boolean;
  marketingAnalyticsEnabled: boolean;
  businessContactUrl?: `https://${string}`;
}

export declare function resolveRequestRegion(request: Request, deployment: {
  trustProxyRegionHeader: boolean;
}): string | "unknown";
```

The public notice values are plain text or HTTPS URLs, length-limited, and rendered without HTML injection. `publicNotice.intentionallyServedRegions` must equal the gate's `servedRegions`; the rendered `/privacy` disclosure is tested field-by-field against this verified input. Missing file, digest mismatch, invalid schema, missing value, false operation check, unserved/unknown region, or provider mismatch produces the same public state: diagnostic submission disabled and global-English marketing analytics disabled.

**Analytics allowlist:**

```ts
export const GLOBAL_ENGLISH_BROWSER_EVENT_NAMES = [
  "diagnostic_cta_view",
  "diagnostic_cta_click",
  "sample_view",
  "diagnostic_start",
  "diagnostic_scope_complete",
  "diagnostic_submit",
  "diagnostic_confirmed",
  "diagnostic_failure",
] as const;

export interface GlobalEnglishBrowserEventProperties {
  edition: "global-en";
  formVersion: "r1";
  pageKey: "home" | "product" | "approach" | "research" | "geo" | "company" | "diagnostic";
  ctaLocation?: "header" | "hero" | "sample" | "close" | "form";
  viewportClass: "mobile" | "tablet" | "desktop";
  campaignClass: "none" | "owned" | "paid" | "partner" | "unknown";
  referrerClass: "direct" | "search" | "social" | "referral" | "unknown";
}

export const GLOBAL_ENGLISH_REVIEW_EVENT_NAMES = [
  "diagnostic_scope_accepted",
  "diagnostic_scope_declined",
  "diagnostic_meeting_booked",
] as const;

export type GlobalEnglishReviewOutcome = "pending" | "qualified" | "unqualified" | "meeting_booked";
```

- [ ] Write schema tests for exact v2 fields, target language, normalization, size limits, honeypot, consent, unknown-field rejection, and complete separation from the Chinese/v1 schema.
- [ ] Write client/server tests preserving same-origin, same-site, JSON, 20 KiB, UUID idempotency, trusted-IP rate limit, timeout, and `202 {ok:true}` confirmation behavior. The new route is `/api/diagnostic/global-en`; the existing `/api/diagnostic` remains byte-for-byte compatible for Chinese.
- [ ] Write failure tests proving no submitted lead value appears in a `mailto:` URL, URL query, logs, analytics, or error response. Unconfirmed state shows retry and only a verified generic business-contact link when configured.
- [ ] Write privacy-gate tests for every required disclosure value, fact, and operation above, digest verification, effective date, matching served-region lists, safe plain-text/URL parsing, and fail-closed behavior. Render `/privacy` from a neutral verified fixture and compare every visible disclosure field to the protected input. If any value or matching operation is unverified, form submission and marketing analytics are disabled for the affected region; do not fill missing facts with assumptions.
- [ ] Write `resolveRequestRegion` tests for trusted-proxy served, trusted-proxy unserved, missing, malformed, and direct-client-spoofed headers. Only a deployment-enabled `X-Yonaris-Region` inserted by the trusted Caddy boundary is accepted; `unknown` is always disabled and the form's target-market field never participates in this decision.
- [ ] Write browser analytics tests for the eight exact funnel event names and exact property allowlist above, enumeration validation, query stripping before initialization, no email/domain/question/brand/website/idempotency/raw URL, no `identifyByEmail`, and no events from Chinese components. For `global-en`, PostHog is the only permitted provider when the gate says `posthog`; the Plausible script/proxy path is not initialized or called. Each allowed event is sent at most once.
- [ ] Write server review-event tests for the three exact event names, controlled outcome/reason codes, a server-generated random analytics ID unrelated to submitted values, transition deduplication, and no arbitrary properties. Emit no review event until the approved lead record and verified retention rule are configured.
- [ ] Run `pnpm --filter @workspace/www exec vitest run --config vitest.config.ts src/lib/global-english-diagnostic-schema.test.ts src/lib/global-english-diagnostic-client.test.ts src/lib/global-english-diagnostic-delivery.server.test.ts src/lib/global-english-analytics.test.ts src/lib/global-english-privacy-gate.test.ts src/components/site/global-en/global-english-diagnostic-form.test.tsx src/components/site/global-en/pages/diagnostic-page.test.tsx src/components/site/global-en/pages/privacy-page.test.tsx`; confirm all new boundaries are missing while the existing v1 diagnostic/privacy tests remain green in their own focused run.
- [ ] Implement the English content and two-stage form with target language. Preserve abort-on-edit, idempotency fingerprinting, focus management, 10-second client timeout, and confirmed/unconfirmed state semantics.
- [ ] Add a dedicated v2 URL test for `/diagnostic?website=https%3A%2F%2Fexample.invalid`: the global-English form does not read, render, store, log, or submit the query value and removes disallowed query parameters before analytics. The frozen `/zh/diagnostic` v1 prefill behavior remains exactly as captured.
- [ ] Implement the v2 server route and delivery module without changing the v1 route/schema/delivery. Reuse protocol utilities only when reuse cannot alter v1 behavior.
- [ ] Implement `/diagnostic` as `deliverable-hero → request-timeline → two-stage-form → privacy-failure-and-alternate`. The hero includes the four-part deliverable preview: scoped baseline; selected answer and available-source evidence; clearest information gaps; reviewed next-test candidates. State that submission begins scope review and does not return an instant scan or score.
- [ ] Implement one server-side gate loader. Both the v2 delivery route and sanitized root bootstrap consume its result; no client-controlled value can enable either feature. Modify `apps/www/src/routes/__root.tsx` so global-English analytics initialize PostHog only when the verified gate allows it and never initialize Plausible for that edition. Chinese keeps its frozen analytics behavior unless a shared security change is explicitly allowlisted.
- [ ] Update `deploy/las/caddy/yonaris-marketing.caddy` and its policy tests so the trusted Cloudflare path replaces `X-Yonaris-Region` from the validated country header and the direct path replaces it with `unknown`; both strip client-supplied copies before proxying.
- [ ] Implement `/privacy` with a verified English disclosure and the existing Chinese disclosure imported directly from the legacy privacy content. Keep Chinese IDs, text, order, language tag, and return path exact.
- [ ] Switch only English diagnostic/privacy routes, add contained styles, and rerun v1 plus v2 diagnostic/privacy/analytics suites.
- [ ] Rerun the Chinese freeze suite and `pnpm --filter @workspace/www check-types`.
- [ ] Commit with `git commit -m "version the global diagnostic journey"`.

---

## Task 16: Integrate, visually verify, and prepare the agile release

**Files:**

- Create: `.changeset/global-website-release.md`
- Modify: `apps/www/scripts/audit-public-surface.mjs`
- Modify: `apps/www/scripts/audit-public-surface.test.mjs`
- Create: `e2e/www-tests/global-english-journey.spec.ts`
- Create: `e2e/www-tests/global-english-accessibility.spec.ts`
- Create: `deploy/las/bin/deploy-portal-public-entry.sh`
- Create: `deploy/las/bin/deploy-portal-public-entry.test.sh`
- Create: `deploy/las/bin/release-global-website.sh`
- Create: `deploy/las/bin/release-global-website.test.sh`
- Create: `deploy/las/GLOBAL-WEBSITE-RELEASE-RUNBOOK.md`
- Create: `.github/workflows/deploy-portal-public-entry.yaml`
- Create: `docs/release-evidence/global-website/commercial-comprehension.md`
- Create: `docs/release-evidence/global-website/accessibility-performance.md`
- Create: `docs/release-evidence/global-website/funnel-baseline.md`
- Create: `scripts/validate-global-release-evidence.mjs`
- Create: `scripts/validate-global-release-evidence.test.mjs`
- Modify: `apps/www/package.json`
- Modify: `e2e/package.json`
- Modify: `.github/workflows/deploy-las.yaml`
- Modify: `.github/workflows/deploy-marketing.yaml`
- Modify: `deploy/las/bin/deploy.sh`
- Modify: `deploy/las/bin/deploy-marketing.sh`
- Modify: `deploy/las/bin/deploy-marketing.test.sh`

**Changeset:**

```md
---
"@workspace/www": minor
"@workspace/web": patch
---

Launch the contained global-English website journey and align the Portal public entry.
```

- [ ] Extend the Release 0 marketing adapter tests for the final edition registry. Inventory every English/Chinese published route, privacy, random 404, robots, sitemap, explicit machine documents, OG image, exact icon/logo allowlist, redirects, API error envelopes, HTML/CSS-discovered assets, and `.map` probes.
- [ ] Add the global-English Playwright journey at 1440×900, 1024×768, and 390×844, plus 320×740 for Home, Product, and Diagnostic. Every English page has one H1/main, exact ordered section IDs, a meaningful hero, an explanatory visualization, a proof artifact except legal pages, no two consecutive text-only sections, primary proof within 2.5 initial viewports, hero height at most `110svh`, working internal CTAs, keyboard/focus/reduced-motion semantics, no horizontal overflow, no console error, no blocked request, and no unsupported public route. Confirm Chinese baseline content and screenshots remain stable.
- [ ] Add `@axe-core/playwright` and Lighthouse CI as development-only verification dependencies. Write WCAG AA/keyboard tests for every English core route and a Lighthouse configuration for Home, Product, Evidence, and Diagnostic. First run must fail on an intentional fixture violation before running against production code.
- [ ] Run focused unit suites after each integration adjustment.
- [ ] Run `pnpm --filter @workspace/www check-types` and `pnpm --filter @workspace/web check-types`.
- [ ] Run `pnpm --filter @workspace/www build` and `pnpm --filter @workspace/web build`.
- [ ] Run marketing and Portal artifact audits against their final `.output` directories. Confirm zero blocked fingerprints and zero public source maps.
- [ ] Start each built app locally, run its complete live inventory/smoke, and then stop it cleanly.
- [ ] Capture local screenshots for every English page at 1440×900, 1024×768, and 390×844; also capture Home, Product, and Diagnostic at 320×740. Inspect every image for hierarchy, crop, overlap, `110svh`, proof placement, consecutive text-only sections, repeated card grids, unreadable graphic labels, and mobile loss of meaning. Iterate until each core page includes a meaningful hero visual, explanatory visualization, and proof artifact.
- [ ] Run the accessibility suite and Lighthouse CI. Record truthful local measurements in `docs/release-evidence/global-website/accessibility-performance.md`; do not mark the p75 LCP/CLS/INP production fields complete until production evidence exists.
- [ ] Run the public-output source audit over all tracked and untracked non-ignored files. Confirm zero findings. Run `git diff --check` and inspect `git status -sb`.
- [ ] Request a whole-branch code review against the specification and resolve all important findings with new failing tests.
- [ ] Implement and test a no-migration Portal public-entry deploy script. It changes only the Portal web image, runs health plus full production inventory before recording success, and restores the previous web image on failure; it never invokes database migration or worker changes.
- [ ] Implement and fixture-test `release-global-website.sh` with explicit immutable SHA inputs: `PORTAL_R0_SHA`, `MARKETING_R0_SHA`, and `MARKETING_R1_SHA`. It refuses to start unless the GitHub repository and every referenced GHCR package report `private`, the policy/release-manifest digests match, the protected route/exception inventories validate, and production secret/gate preflight passes.
- [ ] Encode the authorized release order: deploy Portal R0 through `.github/workflows/deploy-portal-public-entry.yaml` → wait for production Portal policy/live/Playwright evidence and immutable image digest → deploy marketing R0 through `.github/workflows/deploy-marketing.yaml` → wait for its production audit and digest → only then deploy marketing R1. A nonzero gate invokes that product's existing rollback, records the failed stage, and prevents every later stage.
- [ ] Create release-evidence templates with no invented values. The commercial-comprehension gate requires at least six English-speaking decision-makers across roles and at least five successes for each of the four comprehension questions. The production technical gate requires WCAG AA plus p75 LCP <2.5s, CLS <0.1, and INP <200ms from an approved measurement source.
- [ ] Create a privacy-safe fourteen-day funnel report contract owned by `release-owner`: submitted, qualified, and meeting-booked counts/rates; controlled reason codes; no identity/free text. The first production fourteen days establish a baseline and do not invent an improvement target. `validate-global-release-evidence.mjs` blocks the claim that Release 1 is complete until the dated report and privacy audit are present.
- [ ] Add the changeset and commit with `git commit -m "prepare the global website release"`.
- [ ] Before external mutation, verify the remote repository and all container packages are private and the production `YONARIS_ENCRYPTION_KEY`, privacy gate, protected route probes, and legal-exception inventory are configured. If any gate is false—including the repository's current public state—stop before push/deploy, report the precise blocker, and keep the verified local release ready. When all gates are true, use the ordered release script; never use the migration-bearing general Portal deploy path for this release.

## Final Verification Matrix

| Gate | Command | Required result |
|---|---|---|
| Policy engine | `pnpm test:public-output-policy` | Pass; redacted findings only |
| Source containment | `pnpm audit:public-output -- --phase source` | Zero findings |
| English content | `pnpm --filter @workspace/www exec vitest run --config vitest.config.ts src/content/site/global-en src/components/site/global-en` | Pass |
| Chinese unit freeze | `pnpm --filter @workspace/www exec vitest run --config vitest.config.ts src/components/site/zh-cn-legacy-freeze.test.tsx src/editions/zh-cn-legacy/edition.test.ts` | Pass; approved differences only |
| Chinese DOM/visual freeze | `pnpm --filter e2e exec playwright test --config playwright.www.config.ts www-tests/zh-cn-legacy-freeze.spec.ts` | Pass at both frozen viewports; approved differences only |
| Diagnostic v1/v2 | `pnpm --filter @workspace/www exec vitest run --config vitest.config.ts src/lib/diagnostic-*.test.ts src/lib/global-english-diagnostic-*.test.ts src/components/site/pages/diagnostic-form.test.tsx src/components/site/global-en/global-english-diagnostic-form.test.tsx` | Pass |
| Marketing type/build | `pnpm --filter @workspace/www check-types` then `pnpm --filter @workspace/www build` | Pass |
| Portal unit/type/build | `pnpm --filter @workspace/web test` then `pnpm --filter @workspace/web check-types` then `pnpm --filter @workspace/web build` | Pass |
| Final artifacts | marketing and Portal `--phase artifact` audits | Zero findings and zero `.map` files |
| Local runtime | both live inventory/smoke commands | Every public surface passes |
| Visual QA | global-English Playwright plus inspected screenshots, followed by the Chinese DOM/visual freeze command above | All required viewport contracts pass; Chinese unchanged |
| Accessibility | `pnpm --filter e2e exec playwright test --config playwright.www.config.ts www-tests/global-english-accessibility.spec.ts` | No WCAG AA/keyboard serious or critical violation |
| Lab performance | Lighthouse CI command registered in `e2e/package.json` | Local budgets pass and measurements are recorded truthfully |
| Release evidence | `pnpm exec node scripts/validate-global-release-evidence.mjs --phase prelaunch` | Technical and six-person comprehension evidence valid before completion claim |
| External visibility | `gh` repository/package visibility preflight in `release-global-website.sh` | Repository and all images are private |
| Ordered rollout | `deploy/las/bin/release-global-website.test.sh` then authorized script | Portal R0 → marketing R0 → marketing R1; digest/live evidence at each gate |
| Fourteen-day baseline | `pnpm exec node scripts/validate-global-release-evidence.mjs --phase day14` | Privacy-safe submitted/qualified/meeting-booked baseline recorded |
| Repository hygiene | `git diff --check` and `git status -sb` | Clean diff; only intended branch commits |

The code is launch-ready when local, privacy, visibility, and ordered-rollout preflights pass. The release is complete only when the final review is clean, the ordered production deployment succeeds, production accessibility/performance evidence is recorded, the six-person comprehension gate passes, and the fourteen-day privacy-safe funnel baseline is validated.
