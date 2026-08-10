# Database upgrade rehearsal

Run this before deploying migrations to LAS, using a recent production backup
and the exact immutable migration image for the candidate release:

```bash
bash deploy/las/bin/rehearse-db-upgrade.sh \
  /opt/yonaris/backups/yonaris-YYYYMMDDTHHMMSSZ.dump \
  --image ghcr.io/blackdcp/yonaris-db-migrate:sha-<40-character-git-sha>
```

The adjacent `.dump.sha256` file produced by `backup.sh` is required by
default. The rehearsal does not read `/opt/yonaris/.env`, use the `yonaris`
Compose project, or accept a caller-supplied database URL. It creates a unique,
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
