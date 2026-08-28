# Database upgrade rehearsal

`rehearse-db-upgrade.sh` is an off-host or developer-workstation check. It is
not a production LAS entrypoint and must never receive the LAS Docker socket,
the production runtime dotenv, or write access to LAS evidence roots.

Run it from a clean checkout of the exact reviewed commit with an authenticated
recent backup and the exact migration registry digest:

```bash
bash deploy/las/bin/rehearse-db-upgrade.sh \
  /path/to/yonaris-YYYYMMDDTHHMMSSZ.dump \
  --image ghcr.io/blackdcp/yonaris-db-migrate@sha256:<64-hex-digest>
```

The adjacent reviewed `.dump.sha256` file is required by default. The helper
does not read `/etc/yonaris/las-runtime.env`, join the production Compose
project, or accept a caller-supplied database URL. It creates uniquely named,
labelled PostgreSQL 16 resources and a random localhost port; restores the
custom-format archive; runs the candidate migration image; and checks the
Drizzle migration count, timestamp, and SQL hash against the checkout.

Temporary Docker resources are removed on success or failure. Logs remain in
`/tmp/yonaris-db-upgrade-rehearsals` by default. Use `--keep` (or
`KEEP_REHEARSAL=true`) only for deliberate inspection of the isolated database;
the log records the exact resource names and safety label for reviewed cleanup.
For a checkout-only test, use `--local-pnpm` instead of `--image`. Mutable tags
and checksum-free backups require explicit override flags and are not release
evidence.

Production readiness is a separate root-only protocol. The reviewed stable
producer binds the immutable release to exactly four digests—Web, Worker,
migration, and PostgreSQL—performs the production backup, verifies its
separately administered off-host put/get round trip, runs the isolated
rehearsal through the stable runtime manager, and publishes immutable evidence.
The state manager accepts only the exact eight-line
`las-migration-readiness-v2` attestation under
`/etc/yonaris/las-migration-readiness-v2`, plus its matching root-owned backup
and rehearsal files under `/etc/yonaris/las-migration-evidence-v2`.

This developer helper is not that producer. Its log, checksum, or exit status
must not be copied, reformatted, renamed, or hashed into the production roots.
Do not apply a production migration unless the stable producer and state
manager both return exactly `las-migration-readiness-v2 ok` for the same
release and four-digest tuple. Follow
`ARTIFACT-OUTPUT-LANGUAGE-RUNBOOK.md` for the live producer, Portal bootstrap,
deploy, rollback, and fail-closed recovery ordering; never bypass that ordering
with raw Docker or Compose commands on the LAS host.
