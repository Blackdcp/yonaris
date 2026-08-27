# Response snapshot archive runbook

Yonaris response snapshots are immutable HTML and JSON answer records. They are not pixel screenshots of the provider UI. The customer application exposes the same read-only panel and downloads for Bright Data-backed overseas observations and Browser Runner domestic observations.

> **LAS production status: unsupported.** Keep
> `RESPONSE_SNAPSHOT_ENABLED=false`. Both former forced-command operations,
> `response-snapshot-activation` and `response-snapshot-backfill`, are
> permanently disabled. This document preserves the product/storage validation
> contract; it does not authorize host preparation, dotenv changes, Docker
> access, backfill, or deployment.

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

The current candidate activation script still needs to edit the runtime dotenv
and call Compose for its round-trip. Those capabilities are deliberately
unavailable to `yonaris-deploy`, and no equivalent fixed stable runtime-manager
operation exists. The retired `response-snapshot-activation` name is rejected
by the dispatcher and every policy parser and must never be root-authorized or
executed. Keep `RESPONSE_SNAPSHOT_ENABLED=false` and treat activation as
unsupported/fail closed.

Before enabling this feature, move host-directory preparation, strict dotenv
publication, restart, and the candidate Web/Worker write-read-delete probe into
enumerated root-owned stable operations bound to the active tree and five
digests. The candidate script may validate the immutable request but must never
receive the socket or dotenv. Any future capability requires a newly named,
separately reviewed stable operation and exact protocol rather than restoring
the retired request grammar. A missing object, policy line, active marker,
receipt, or stable probe must still fail closed. Direct execution of the
current prepare/check scripts is not an operational entrypoint.

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

Backfill is permanently absent from the current LAS production surface. The
existing candidate helper still reads the
runtime dotenv and invokes Compose, so adding a request or policy line would
not make it a supported production operation. The name
`response-snapshot-backfill` remains rejected. A newly named future stable
fixed operation may use the validation contract in
`response-snapshot-backfills/README.md`: exact sorted
run IDs, channels, end-exclusive UTC range, count, run fingerprint and reviewed
source SHA; dry-run before apply; and a write set limited to snapshot
metadata/outbox/files. Until that operation exists, do not add a production
request and do not grant the candidate helper a socket or dotenv.

After apply, sign in as the real StepFun customer and verify:

- legacy Doubao and DeepSeek runs are labelled `Historical reconstruction`, never native provider HTML;
- channel/model filters and all existing visibility, share-of-voice, citation and query values are unchanged;
- HTML/JSON/manifest downloads match their displayed hashes;
- expiry timestamps are stored in UTC and displayed in `Asia/Shanghai`;
- the durable redacted operation receipt exists before removing the one-shot request in a follow-up commit.

## External export

Customer users can download a bounded ZIP from the read-only product UI. The
checked-in host export script is validation logic, not a production root
entrypoint. Long-term host export is intentionally blocked until a reviewed,
fixed-argument stable operation binds the active immutable tree and receipt,
an exact brand and end-exclusive UTC range, and a root-owned destination on a
separate filesystem. Do not run the candidate script directly or grant it a
runtime socket.

That future operation must reject an existing destination and the live root.
Every gzip artifact must be decompressed within a fixed limit, verified against
its manifest, copied, re-hashed, fsynced, and accompanied by a redacted
receipt. A copy on the LAS system disk is not disaster recovery. Kodo or a
separately managed external disk is the durability boundary.

## Recovery

Do not copy files back into the live root while Web or Worker is running.
Recovery requires a separately reviewed root-local stable operation: disable
snapshot capture, stop both services through the runtime manager, verify the
external receipt and manifests, restore only to an empty prepared root, rerun
the read-only preflight, then redeploy. PostgreSQL snapshot metadata and the
filesystem archive must be restored from the same recovery point. Until that
operation exists, stop and escalate; do not recreate the old mutable-source
procedure.
