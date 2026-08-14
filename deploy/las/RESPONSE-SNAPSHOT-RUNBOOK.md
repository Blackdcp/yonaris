# Response snapshot archive runbook

Yonaris response snapshots are immutable HTML and JSON answer records. They are not pixel screenshots of the provider UI. The customer application exposes the same read-only panel and downloads for Bright Data-backed overseas observations and Browser Runner domestic observations.

## Fixed v1 contract

- retention: 90 days from `observedAt`, with an end-exclusive expiry boundary;
- warning: 70% filesystem usage;
- stop new snapshot-enabled claims: 80% filesystem usage;
- outbox TTL: 24 hours;
- live storage: `/var/lib/yonaris/response-snapshots/v1` on the LAS host and in both Web and Worker containers;
- ownership/mode: UID/GID `1001:1001`, mode `0750`;
- the directory is outside immutable release images and PostgreSQL volumes.

Snapshot failure never changes `prompt_runs`, visibility, share of voice, citations or query fan-out. A successful AI observation remains successful while its archive is shown as pending/failed when storage is unavailable.

## Prepare and enable

Keep `RESPONSE_SNAPSHOT_ENABLED=false` until all checks pass.

```bash
sudo env RESPONSE_SNAPSHOT_HOST_ROOT=/var/lib/yonaris/response-snapshots/v1 \
  bash /opt/yonaris/source/deploy/las/bin/prepare-response-snapshot-storage.sh

env DEPLOY_ROOT=/opt/yonaris \
  ENV_FILE=/opt/yonaris/.env \
  COMPOSE_FILE=/opt/yonaris/source/deploy/las/compose.yaml \
  bash /opt/yonaris/source/deploy/las/bin/check-response-snapshot-storage.sh
```

Set the exact six response snapshot variables shown in `env.example`, restart Web and Worker through the immutable deployment, and require the deployment's `--round-trip` probe to pass. The probe writes through the candidate Web image, reads and deletes through the candidate Worker image, and never creates a database record.

## Operations

The `response-snapshot-maintenance` queue runs every five minutes. It retries bounded outbox work, reconstructs bounded stale reservations from already-saved runs without calling AI, deletes expired objects, and removes only verified unreferenced revision directories older than 24 hours. Its advisory lock prevents concurrent maintenance.

At 70% disk usage, investigate growth and export/archive older customer ranges. At 80%, new snapshot-enabled claims fail closed before a provider request; existing dashboard data remains readable.

## External export

Customer users can download a bounded ZIP from the read-only product UI. For long-term custody outside LAS, mount a separate disk or Kodo-backed filesystem and run:

```bash
sudo env RESPONSE_SNAPSHOT_HOST_ROOT=/var/lib/yonaris/response-snapshots/v1 \
  bash /opt/yonaris/source/deploy/las/bin/export-response-snapshots.sh \
  --brand stepfun --from 2026-08-01 --to 2026-08-31 \
  --destination /mnt/external/stepfun-2026-08
```

The destination must not exist, must be outside the live root, and must be on a different filesystem. Every gzip artifact is decompressed within a fixed limit, verified against its manifest, copied, re-hashed, fsynced, and accompanied by a redacted receipt. A copy on the LAS system disk is not disaster recovery. Kodo or a separately managed external disk is the durability boundary.

## Recovery

Do not copy files back into the live root while Web or Worker is running. First disable snapshot capture, stop both services, verify the external receipt and manifests, restore only to an empty prepared root, rerun the read-only preflight, then redeploy. PostgreSQL snapshot metadata and the filesystem archive must be restored from the same recovery point.
