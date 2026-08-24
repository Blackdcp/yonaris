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

For local extension runs, the archived HTML is the sanitized current answer container captured at observation time, accompanied by canonical JSON and hashes. It is intentionally not a whole-page provider DOM or pixel screenshot. The standard Doubao/DeepSeek extension contract uploads exactly one page-snapshot artifact; original-site screenshots remain a separately contracted forensic capability.

## Staged release order

Use this order for every production rollout:

1. deploy migration `0022_response_snapshot_archive` plus compatible Web/Worker code with `RESPONSE_SNAPSHOT_ENABLED=false`;
2. require empty-database and seeded-database migration replay, production backup/rehearsal, Web health and Worker stability to pass;
3. prepare the persistent host directory and pass the read-only plus candidate-image round-trip checks below;
4. set the fixed v1 environment values and redeploy Web/Worker;
5. verify one non-paid fixture snapshot end to end before allowing Bright Data or an explicitly started Browser Runner batch to reserve snapshots;
6. run any historical StepFun backfill only through a separate reviewed one-shot request.

The E2E fixture suite never calls Bright Data, Doubao, DeepSeek or another paid provider. It builds local deterministic bundles and proves that provider-native HTML, structured fallback HTML and domestic browser-answer HTML use the same customer component, authorization and export path.

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

After enablement, verify a fixture or already-saved run from an ordinary customer account:

- the LLM response card shows one read-only `Response snapshot` panel;
- the inline HTML loads inside the sandboxed same-origin iframe and makes no external request;
- downloaded HTML, JSON and manifest values match the SHA-256 values shown in the panel;
- a second tenant and an anonymous request cannot read the object;
- pending, failed and expired archive states do not change the response text or any Yonaris metric input.

## Operations

The `response-snapshot-maintenance` queue runs every five minutes. It retries bounded outbox work, reconstructs bounded stale reservations from already-saved runs without calling AI, deletes expired objects, and removes only verified unreferenced revision directories older than 24 hours. Its advisory lock prevents concurrent maintenance.

At 70% disk usage, investigate growth and export/archive older customer ranges. At 80%, new snapshot-enabled claims fail closed before a provider request; existing dashboard data remains readable.

## Historical StepFun backfill

Backfill is disabled unless a reviewed commit adds exactly one request under `response-snapshot-backfills/requests/`. Follow `response-snapshot-backfills/README.md`: enumerate the exact sorted run IDs, channels, end-exclusive UTC range, count, run fingerprint and reviewed source SHA. The production operation always executes dry-run before apply and writes only snapshot metadata/outbox/files; it never changes `prompt_runs`, citations, mentions, prompts, scopes or metric formulas.

After apply, sign in as the real StepFun customer and verify:

- legacy Doubao and DeepSeek runs are labelled `Historical reconstruction`, never native provider HTML;
- channel/model filters and all existing visibility, share-of-voice, citation and query values are unchanged;
- HTML/JSON/manifest downloads match their displayed hashes;
- expiry timestamps are stored in UTC and displayed in `Asia/Shanghai`;
- the durable redacted operation receipt exists before removing the one-shot request in a follow-up commit.

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
