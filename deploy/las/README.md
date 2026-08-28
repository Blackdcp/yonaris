# Yonaris Portal on Qiniu LAS

This directory defines the Portal-only LAS release boundary. It deploys the
Portal web process, worker, database migration image, and PostgreSQL on the
isolated rootless runtime. The public website has its own release lifecycle and
is not an LAS capability.

Production remains fail closed until the root-owned stable bundle, trust
policy, immutable Git object store, runtime dotenv, migration evidence, and
canonical predecessor have all been independently verified. Keep the GitHub
deployment gate disabled while any prerequisite is incomplete.

## Production contract

- `portal.yonaris.com` reaches the Portal process on `127.0.0.1:1515`.
- PostgreSQL is private to the isolated runtime network.
- A release tuple contains exactly four registry digests: web, worker,
  migration, and PostgreSQL.
- New durable compatibility receipts use
  `/etc/yonaris/las-compatible-releases-v3/sha-<40>` and the token
  `artifact-output-language-receipt-v3`.
- Existing receipts under `/etc/yonaris/las-compatible-releases-v2/` are
  accepted only as read-only rollback compatibility evidence. New operations
  must never create, edit, rename, or replace a v2 receipt.
- The stable Caddy manager exposes only `verify-boundary`. It verifies the
  root-owned proxy boundary and must not install, activate, reload, or roll back
  proxy configuration.

The v3 receipt has exactly six newline-terminated lines:

```text
artifact-output-language-receipt-v3
release sha-<40-lowercase-hex>
web-sha256 sha256:<64-lowercase-hex>
worker-sha256 sha256:<64-lowercase-hex>
migrate-sha256 sha256:<64-lowercase-hex>
postgres-sha256 sha256:<64-lowercase-hex>
```

A valid legacy v2 receipt has the former seventh digest line. Readers may
validate it and project its first four digests for rollback, but the fifth
digest does not reintroduce another release surface.

## Runtime environment

Copy `deploy/las/env.example` to the root-owned canonical runtime dotenv and
replace every placeholder. The stable parser treats the file as data: unknown
or duplicate keys, executable syntax, unsafe unquoted metacharacters, symlinks,
and malformed quoting fail before runtime access.

`RESEND_API_KEY` and `RESEND_FROM_EMAIL` are Portal transactional-email
settings. Use a domain-scoped sending key and a sender on a verified domain.
They do not grant a second deployment capability.

Keep `ARTIFACT_ZH_CN_ENABLED=false` until the one-way activation procedure in
`ARTIFACT-OUTPUT-LANGUAGE-RUNBOOK.md` is complete. Keep retired runtime feature
flags at their documented false values.

## Trust and release inputs

Production consumes only an exact, reviewed Git object already present in the
root-owned bare object store. The forced dispatcher has no network credential
and never fetches a missing object. Root materialization rejects symlinks,
gitlinks, traversal, special objects, and mutable release-tree content.

Trust-policy release entries bind one release SHA and the four exact digests.
Mutable image tags are not release authorization. The active stable-bundle
generation, verifier, dispatcher, state manager, runtime manager, Caddy
boundary verifier, migration-readiness producer, and installer must all match
the hashes in the root-owned bundle policy.

The supported forced protocol is intentionally small:

```text
yonaris-las-v1 probe
yonaris-las-v1 deploy sha-<40> sha256:<web> sha256:<worker> sha256:<migrate> sha256:<postgres>
yonaris-las-v1 rollback sha-<40> sha256:<web> sha256:<worker> sha256:<migrate> sha256:<postgres>
```

An unsupported operation, extra argument, malformed digest, missing immutable
object, absent policy entry, pending journal, stale bundle pointer, or failed
boundary verification must fail closed before runtime mutation.

## First Portal-only production migration

Perform the migration from an authenticated root console in a maintenance
window. Do not improvise paths, receipts, attestations, or policy lines.

1. Disable deployment workflows and record the active Portal release, running
   container digests, database backup identity, stable-bundle generation, and
   any valid v2 compatibility receipt.
2. Verify that the public website is independently serving production traffic.
   Its cutover and rollback belong to that separate release system.
3. Import the exact reviewed Portal-only commit into the root-owned object
   store, materialize it, and install a stable bundle whose policy binds the
   same four digests.
4. Run the root verifier. It must call both the runtime and Caddy managers in
   `verify-boundary` mode and must reject every pending transition.
5. Produce and validate migration-readiness evidence for the exact release and
   four-digest tuple. Off-host backup durability and rehearsal evidence must
   already exist.
6. Deploy the Portal tuple. The state manager writes the pending journal before
   the runtime manager pulls or switches an image.
7. Verify database migration state, exact running image digests, private
   PostgreSQL isolation, and Portal health through both the loopback origin and
   external hostname.
8. Atomically publish the v3 receipt and active Portal marker, fsync their
   parent directories, then clear the pending journal last.
9. Run `probe` and the full root verifier again before re-enabling the workflow.

If any verification fails, stop. An unverified runtime switch is not a
completed release and must retain its journal for deterministic recovery.

## Deployment and rollback ordering

For an ordinary deploy, the state manager must authorize and materialize the
candidate, validate its four-digest policy and migration evidence, persist the
pending journal, authorize the runtime mutation, verify the exact running
digests and health, write the v3 receipt and active marker, and clear the
journal last.

Rollback uses a predecessor selected from the root-owned policy and a valid
receipt. Prefer a v3 receipt. A validated v2 receipt may be read only to recover
the predecessor's first four digests. The state manager must persist a rollback
journal before mutation, materialize the exact predecessor tree, restore the
four images, verify schema compatibility and Portal health, atomically restore
the active marker, and clear the journal last. It must not rewrite the legacy
receipt during this process.

If the live state is ambiguous, keep workflows disabled and the journal intact.
Inspect the actual image digests and immutable trees, then invoke only the
reviewed root reconciliation path. Never delete or edit a journal, fabricate a
receipt, edit a release marker, use a mutable checkout as production input, or
expose a runtime socket or dotenv to a service account.

## Database rehearsal

Use `DB-UPGRADE-REHEARSAL.md` for the off-host rehearsal. That helper is not a
production entrypoint and cannot produce root trust evidence by itself. A
production database change remains blocked until the stable evidence producer
binds the exact backup, rehearsal result, immutable release, and four digests.
