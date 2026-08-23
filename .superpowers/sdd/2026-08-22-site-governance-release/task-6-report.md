# G6 Marketing Release Governance Report

Date: 2026-08-23
Worktree: `E:\\Yonaris\\.worktrees\\homepage-product-stage`
Exact base: `f6134b19fe1f69e47c4603212d55c496215f97c3`
Push/deploy/production mutation: not performed

## Result

G6 replaces the permissive marketing release boundary with an exact, tested Caddy and deployment state machine. The public policy is method-specific and fail-closed; the diagnostic IP boundary distinguishes reviewed Cloudflare peers from direct peers without global trust; all other proxy branches scrub both identity headers. The final route policy is exercised against the exact `linux/amd64` marketing image and the digest-pinned Caddy `2.6.2` runtime with its internal CA trusted through `NODE_EXTRA_CA_CERTS`.

The shared deploy preflight is filesystem-, process-, and network-side-effect free in verify-only mode and validates only the exact immutable tag and mail configuration. Normal deployment and explicit rollback bind the immutable app, complete predecessor/candidate Caddyfiles, and marker transitions. Recovery paths cover Caddy exit 75, marker write failure, rollback marker-pending convergence, unrelated Caddy drift, and tampered backups. The installer rehashes staged restore bytes before validation and live replacement.

The GitHub workflow builds and loads one exact image, smokes it directly and behind pinned Caddy, pushes only that tested image, runs remote preflight before source mutation, checks out and verifies the exact release SHA, deploys under the source lock, then verifies marker, image, apex, Portal, Status, and Changelog.

## Verification evidence

- Deployment fixture: all preflight, failure, recovery, and durable rollback checks passed.
- Installer fixture: `33/33` passed.
- Workflow fixture: `4/4` passed.
- Caddy/static/helper Node fixtures: `21/21` passed.
- Caddy policy Vitest: `5/5` passed as part of WWW unit.
- WWW unit: `30 files / 224 tests` passed.
- WWW typecheck: passed.
- Site manifest audit: passed.
- Production build: passed.
- Fresh direct image smoke: `60 routes / 13 redirects / 91 same-origin assets` passed.
- Fresh digest-pinned Caddy integration smoke: passed; no owned container, network, or volume remained.
- Independent Critical-only review: PASS, no remaining Critical.

## Deferred follow-up

The approved release-MVP timebox defers two non-blocking hardening items: replace host-side origin health `--insecure` calls with a vendored, immutable Cloudflare Origin CA trust root; and add the exhaustive destination-by-destination failure-injection matrix for durable installer metadata. These are recorded follow-ups, not silent omissions.

Production remains blocked until `RESEND_API_KEY`, exact `RESEND_FROM_EMAIL`, and exact `MARKETING_LEAD_RECIPIENT` are configured directly on the host and `--verify-only` reports all three names as valid. No secret value was read or printed.
