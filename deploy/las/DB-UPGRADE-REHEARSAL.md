# Database upgrade rehearsal

This standalone script is an off-host or developer-workstation rehearsal only;
it is not a production LAS entrypoint and must not receive either LAS Docker
socket or the runtime dotenv. Run it from a clean checkout of the exact reviewed
commit, using an authenticated copy of a recent backup and the exact migration
registry digest:

```bash
bash deploy/las/bin/rehearse-db-upgrade.sh \
  /path/to/yonaris-YYYYMMDDTHHMMSSZ.dump \
  --image ghcr.io/blackdcp/yonaris-db-migrate@sha256:<64-hex-digest>
```

The adjacent reviewed `.dump.sha256` file is required by default. The rehearsal
does not read the production runtime dotenv, use the production Compose project,
or accept a caller-supplied database URL. It creates a unique,
labelled PostgreSQL 16 container, volume, network, and random localhost port;
restores the custom-format archive; runs the candidate migration image; and
checks the Drizzle migration count, timestamp, and SQL hash against the current
checkout.

All temporary Docker resources are removed on success or failure. Logs remain
in `/tmp/yonaris-db-upgrade-rehearsals` by default. Use `--keep` (or
`KEEP_REHEARSAL=true`) only when an operator intentionally needs to inspect the
isolated database; the log prints the exact resource names and safety label
needed for later cleanup.

For a local checkout-only test, replace `--image ...` with `--local-pnpm`.
Mutable image tags and backups without checksums require separate explicit
override flags and should not be used for a release decision.

The forced production dispatcher does not call this checkout-owned helper.
Production backup/rehearsal remains blocked until an audited fixed-argument
stable runtime operation binds the active immutable tree, its five-digest
receipt, a root-owned backup, and the exact migration digest. Do not work around
that gap by running this script on LAS or exposing a runtime socket to
`yonaris-deploy`.

The root state manager verifies a nine-line migration-readiness attestation and
the hashes of separate backup/rehearsal evidence, but this repository has no
trustworthy producer for those files. This developer helper is not that
producer and its log or exit status must not be copied, reformatted, or hashed
into `/etc/yonaris/las-migration-readiness-v1` or
`/etc/yonaris/las-migration-evidence-v1`. Until a reviewed stable producer
performs the real backup, off-host durability check, and rehearsal and emits
the evidence, do not apply the migration or run a production deployment.
