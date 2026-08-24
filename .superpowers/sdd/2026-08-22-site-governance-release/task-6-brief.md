# Governance Task 6 — Caddy, deploy safety, rollback, and release gates

## Entry gate and authority

- Start from clean `f6134b19fe1f69e47c4603212d55c496215f97c3`.
- This brief supersedes the older governance-plan Task 5 deployment text wherever they differ.
- Read the approved full-site specification, governance plan, ledger, Task 5 report, and `task-6-preflight.md` before editing.
- Use strict TDD, systematic debugging, verification-before-completion, and independent review.
- Do not mutate production, DNS, GitHub, Resend, or send a real lead in this task.
- Do not read or print secret values. Production verification may report only present/missing.

## Refreshed production facts (read-only, 2026-08-23)

- Production Caddy is `2.6.2`, `x86_64`, active, and config-valid.
- The live apex block is byte-identical to the repository active fragment with SHA256:
  `6F1F6DD9F3CE91318D037F0E0328EAC4C41BDD90FB942835204408CA669F09C4`.
- Reviewed predecessor hashes:
  - redirect: `2F645156DB46E9584CD47AD825804256D928757E462F31EA57391A11CDCC36D3`
  - v1: `1B4580FED8750A61B8468B00D2852F1DC8CB8CF1B1D5587EFFE5519C5C230D67`
  - v2/current: `6F1F6DD9F3CE91318D037F0E0328EAC4C41BDD90FB942835204408CA669F09C4`
- Current marketing image/release marker is `sha-c6fc3e8cdbe6cfe4204a756549e9598150c44f66`; apex and Portal are 200.
- Production `/opt/yonaris/.env` is mode 600 and owned by `yonaris-deploy`; these variables are currently missing/nonblank=no:
  - `RESEND_API_KEY`
  - `RESEND_FROM_EMAIL`
  - `MARKETING_LEAD_RECIPIENT`
- Current public and origin `/api/diagnostic` are 404.
- Hidden paths that must remain 404 include `/llms.mdx/site/*`, `/llms.mdx/docs/*`, `/api/repo-activity/refresh`, bare `/api`, and unspecified APIs.
- Current Caddy incorrectly blocks public OpenAPI, search, RSS, repo SVG, author images, logo, and several utility routes even though origin serves them.
- Current old image returns 500 for direct-origin `/status` and `/changelog`; final release health must require both to be 200.
- Cloudflare DNS and proxying are healthy. Do not change DNS.

## Files and predecessor preservation

- Copy the current active repository fragment byte-for-byte to:
  `deploy/las/caddy/yonaris-marketing-v2.caddy`.
- Test that the v2 copy retains SHA256 `6F1F...09C4`.
- Create/update the final active fragment and deployment tests/scripts according to the repository plan and current file layout.
- Never rewrite the reviewed predecessor snapshots to make a test pass.

## Exact public route and method policy

GET/HEAD allowlist:

- All 14 bilingual core canonicals: `/`, `/zh`, Product, Approach, Research, Company, GEO, Diagnostic in EN/ZH.
- `/privacy`; retired supporting and publication routes are excluded.
- `/blog`, `/blog/*`, `/glossary`, `/glossary/*`, `/docs`, `/docs/*`.
- `/status`, `/brand`, `/changelog`, `/roadmap`.
- `/ai-search`, `/ai-search/*`, `/aeo-for`, `/aeo-for/*`, `/ai-visibility-tools`, `/ai-visibility-tools/*`.
- `/agent`, `/agent/*`, `/llms.txt`, `/llms-full.txt`.
- `/robots.txt`, `/sitemap.xml`, `/blog/rss.xml`, `/og.png`, `/og/*`, `/repo-activity.svg`.
- All 13 manifest redirect sources.
- `/assets/*`, `/brand/*`, `/icons/*`, `/authors/*`.
- `/apple-touch-icon.png`, `/favicon.ico`, `/site.webmanifest`, `/recordranks-logo.svg`.

API policy must be method-specific:

- POST `/api/diagnostic`.
- GET/HEAD `/api/openapi.json`.
- GET/HEAD `/api/search`.
- GET/HEAD `/api/plausible/js/script`.
- POST `/api/plausible/event`.

Do not replace these with broad `/api/*`, `/zh/*`, or `/diagnostic/*` matchers. Every unspecified path/method is a direct 404.

## Diagnostic client-IP trust boundary

Matcher ordering:

1. Diagnostic POST from a trusted Cloudflare socket peer.
2. Diagnostic POST from a non-Cloudflare direct peer.
3. Other exact public APIs/routes.
4. Final 404.

Trusted Cloudflare branch:

- `remote_ip` must be restricted to the reviewed 15 IPv4 and 7 IPv6 Cloudflare CIDRs.
- Delete any incoming `X-Yonaris-Client-IP`.
- Rebuild `X-Yonaris-Client-IP` from `CF-Connecting-IP`.
- Delete the original `CF-Connecting-IP` before upstream.

Direct branch:

- Delete incoming `X-Yonaris-Client-IP` and `CF-Connecting-IP`.
- Set internal `X-Yonaris-Client-IP` to `{http.request.remote.host}`.

Other upstream traffic:

- Delete both identity headers.
- Do not set an internal identity header.

Do not change shared Caddy global `trusted_proxies`. Preserve application `node:net.isIP()` validation; invalid identity becomes `unknown`.

## Caddy 2.6.2 integration smoke

Pin exactly, with `--platform linux/amd64`:

`docker.io/library/caddy:2.6.2-alpine@sha256:7992b931b7da3cf0840dd69ea74b2c67d423faf03408da8abdc31b7590a239a7`

The isolated Caddy smoke must:

- Use the already-built exact marketing image; do not rebuild it.
- Use an isolated Docker network and temporary directory.
- Replace only candidate TLS/upstream lines for the test harness.
- Use `tls internal`.
- Copy the Caddy internal CA out of the container and trust it through `NODE_EXTRA_CA_CERTS`.
- Never use `-k`, `--insecure`, disabled TLS verification, or a mutable/latest Caddy image.
- Exercise the real matcher/proxy configuration.
- Prove two trusted Cloudflare client identities become two distinct upstream identities.
- Prove a non-trusted socket peer cannot spoof either identity header and upstream sees only the socket peer.
- Clean every container, network, CA, and temp artifact in `finally`, including forced-failure tests.

Diagnostic integration smoke must use a schema-valid full envelope with only the honeypot non-empty. It must assert exactly:

- HTTP 400.
- JSON `{ "ok": false, "code": "invalid_request" }`.

403, 404, and 503 are failures. This smoke must not query Resend or send mail.

## Installer state machine

The Caddy installer must:

- Accept only reviewed redirect, v1, v2 predecessor hashes and the final-current hash.
- Treat final-current as idempotent but still validate and run full health.
- Reject unknown live blocks before validate/write/reload/health and make zero mutations.
- Save the complete live Caddyfile before editing.
- Validate candidate, atomically install, reload, then run full health.
- On validate/reload/health failure, restore the complete backup, validate it, and reload it.
- If restore or reload cannot be confirmed, exit 75 and preserve a mode-700 recovery directory.
- Return success only after every health check succeeds.

Health must include:

- Stable homepage category/vision copy.
- Representative core, resource, utility, and legacy pages.
- `/status` and `/changelog` returning 200.
- Agent and llms surfaces.
- OpenAPI, search, RSS, repo SVG, and static logo.
- A 308 checked without following redirects.
- Hidden/internal paths returning 404.
- Portal returning 200.
- Diagnostic honeypot returning the exact 400 JSON response.

## Secret preflight and normal deployment

`deploy-marketing.sh --verify-only <immutable sha-tag>` must:

- Accept only an immutable `sha-...` tag.
- Execute `set +x` before reading environment.
- Validate `RESEND_API_KEY` non-empty and non-placeholder.
- Require exact `RESEND_FROM_EMAIL=Yonaris <diagnostic@yonaris.com>`.
- Require exact `MARKETING_LEAD_RECIPIENT=black.dcp@outlook.com`.
- Output only variable names and status; never values.
- With an existing read-only deploy root, perform zero mkdir, lock, temp, marker, Docker, curl, Caddy, Resend, or network calls.
- Make no filesystem mutation.

Normal deploy must call the identical preflight before its first mutation.

Transactional failure behavior:

- App start or port-1516 health failure restores the marker's previous immutable image.
- Caddy validate/reload/health failure first confirms complete Caddy rollback, then restores the app.
- If Caddy rollback is not confirmed, exit 75, keep the healthy candidate app, and preserve recovery material.
- Update the release marker only after app and Caddy gates succeed.
- Marker update failure is exit 75, never success.

## Required post-success rollback

Transactional rollback during deploy is insufficient. Before the live switch, persist a mode-700 durable rollback bundle containing at least:

- Complete pre-release Caddyfile.
- Previous immutable app image tag.
- Predecessor/candidate hashes or identifiers needed to bind the bundle to the release.

Explicit rollback mode must:

- Reject marker/bundle/current-candidate mismatch without mutation.
- Switch to the predecessor app first and verify `127.0.0.1:1516`.
- Atomically restore the complete predecessor Caddyfile.
- Validate and reload Caddy.
- Verify apex and Portal.
- Restore the release marker last.
- On app failure, leave current Caddy untouched.
- On Caddy restore/reload failure, leave the healthy candidate app running, exit 75, and preserve mode-700 recovery material.

Tests must cover a successful release followed by explicit rollback, not only rollback inside a failed deployment.

## Workflow ordering and immutability

Required order:

1. Policy, shell, and smoke fixtures.
2. Build/load exact linux/amd64 image once.
3. Direct image smoke.
4. Digest-pinned Caddy integration smoke.
5. Push that exact built image; no second build.
6. Remote `--verify-only` before source lock/mutation.
7. Source lock, fetch, exact SHA checkout, and SHA verification.
8. Normal deploy, which repeats preflight.
9. App health.
10. Caddy install and full health.
11. Release marker update.

Actions and images must be pinned immutably. Do not use a mutable Caddy tag.

## TDD and completion gates

- Start from policy/shell/smoke fixture RED; implement minimal GREEN.
- Tests must include forced failure and cleanup paths, unknown-state zero-write, idempotence, exact route/method behavior, trusted/untrusted IP behavior, verify-only side-effect detection, transactional rollback, post-success rollback, status/changelog health, and workflow ordering.
- Run shell syntax and policy tests, fixture suites, Docker direct smoke, digest-pinned Caddy integration smoke, production build, site unit/types/manifest/public/visual gates as required by the governance plan, Biome/diff/status checks, and supply-chain scans.
- Request independent review and fix every Critical/Important finding through follow-up commits; do not amend.
- Commit locally only. Do not push or deploy.

## Release sequencing and the external blocker

- Complete and independently review G6 code first.
- Later merge `origin/main` normally (no rebase/force), then rerun all gates.
- The feature branch may be pushed before secrets because it does not deploy production.
- Only when code, merge, Docker/Caddy, and full-site gates are green and production release is ready, ask the user to configure Resend directly in `/opt/yonaris/.env`; never ask them to paste the key into chat.
- Until the three variables are configured and `--verify-only` is green, production release remains blocked.
