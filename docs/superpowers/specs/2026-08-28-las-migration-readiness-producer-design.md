# LAS Migration Readiness Producer Design

## Goal

Add the smallest production-grade, root-owned mechanism that can prove an exact
LAS release is safe to deploy: create a consistent database backup, prove the
same bytes are durable off-host, restore them into an isolated database, run the
exact candidate migration image, and atomically emit the evidence already
required by `manage-las-release-state migration-readiness`.

## Scope

This change adds one stable migration-readiness producer and its fixed runtime
operations. It does not change Portal behavior, weaken the forced-command
boundary, expose Docker or production secrets to the gate/deploy identities,
enable Chinese artifact writes, or automatically turn on GitHub production
variables.

## Trust Boundary

The producer is installed with the other root-owned stable LAS programs and is
callable only from an authenticated root console. It rejects `SUDO_USER`, an
invalid release or digest tuple, a tuple not authorized by the active trust
policy, an unmaterialized candidate tree, pending release/Caddy/bundle journals,
and conflicting evidence for the same release.

The producer never executes candidate shell code. Docker access remains inside
`manage-las-runtime`; the producer may request only fixed backup, rehearsal,
cleanup, and verification operations with a validated release and exact image
digests. Temporary containers and volumes are network-isolated except for their
private rehearsal network, carry release-derived fixed names, and are removed on
success or failure.

## Backup and Off-host Durability

The runtime manager streams a PostgreSQL custom-format dump from the live
rootless production database into a newly created root-only staging file. The
producer verifies that the file is regular, single-link, non-empty, mode `0600`,
and has a stable SHA-256 digest.

Off-host storage is an operator-installed root-owned fixed adapter, configured
outside the repository. Its interface accepts the immutable local backup path,
the release, and the backup SHA-256, uploads idempotently under a release-scoped
object key, then downloads that object into a second new local file. Success is
accepted only when the downloaded file has the exact original digest. A status
code or remote metadata alone is insufficient.

No cloud credentials enter Git, the production dotenv, candidate containers,
or evidence files.

## Restore and Migration Rehearsal

The runtime manager creates a disposable PostgreSQL instance using the exact
authorized Postgres digest, restores the downloaded off-host copy, and runs the
exact authorized migration digest against it. It then verifies database health
and records a deterministic, secret-free rehearsal result containing the
release, all five authorized digests, backup digest, restored-copy digest,
migration exit status, and completion timestamp.

The live database is never used as the rehearsal target. Any backup, upload,
download, restore, migration, health, cleanup, metadata, or durability failure
fails closed and emits no readiness attestation.

## Evidence and Idempotency

On success, the producer writes two secret-free evidence files under
`/etc/yonaris/las-migration-evidence-v1` and the existing nine-line attestation
under `/etc/yonaris/las-migration-readiness-v1`. Final files are regular,
single-link, `root:root 0400`, created via same-filesystem temporary files,
`fsync`, atomic rename, and parent-directory `fsync`.

The attestation exactly matches the verifier's current schema:

1. `las-migration-readiness-v1`
2. release
3. web digest
4. worker digest
5. migration digest
6. PostgreSQL digest
7. www digest
8. SHA-256 of backup evidence
9. SHA-256 of rehearsal evidence

An identical completed invocation verifies and returns success without repeating
the backup. Existing malformed, partial, symlinked, multiply linked, or
conflicting evidence is never overwritten automatically.

## Installation and Release Flow

The stable-bundle installer includes and hash-binds the producer alongside the
dispatcher, guard, state manager, runtime manager, Caddy manager, and verifier.
Installation remains a root-console action; production SSH keeps only the
existing forced grammar.

The fastest release sequence is:

1. Install and verify the reviewed stable bundle from the candidate commit.
2. From the root console, run the producer for the exact six-digest tuple.
3. Run `manage-las-release-state migration-readiness` for the same tuple.
4. Bootstrap the first compatible predecessor if one does not exist.
5. Enable the existing GitHub deployment variables and deploy the immutable
   release with `ARTIFACT_ZH_CN_ENABLED=false`.
6. Verify Portal health and the compatible receipt; enable Chinese artifact
   writes only in the later one-way activation step.

## Tests and Acceptance

Shell contract tests must first fail before implementation exists, then cover:
exact argument grammar; root-local-only execution; policy and tree binding;
pending-journal rejection; stable backup digest; byte-for-byte off-host round
trip; isolated restore and exact migration digest; cleanup on every failure;
atomic evidence creation; conflict rejection; idempotent retry; and successful
consumption by the existing migration-readiness verifier.

Focused stable producer/runtime/installer/state tests and shell syntax checks
must pass. The already-green application test/build evidence is reused because
this change does not modify application code.
