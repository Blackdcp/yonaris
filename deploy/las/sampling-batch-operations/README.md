# Explicit Sampling Batch Operations

This directory contains the reviewed contract machinery for explicit one-time Sampling batch operations. It does not schedule work and does not itself create a batch.

The `requests/` directory is intentionally empty in the Browser Extension release. The retired StepFun CN / Doubao six-sample request used the legacy host Runner route and must not start during deployment. Administrators now create domestic runs explicitly from Portal and execute them through a paired local browser extension.

If a future release intentionally carries an approved one-time request, the deployment workflow validates that exact request, runs against the immutable deployed SHA under the production environment and SSH lock, checks status, dry-runs, then makes one idempotent `--apply` call.

The worker uses its fixed idempotency key to make replays a no-op. Operation output is deliberately reduced to lifecycle-safe fields; it never relays prompt text, database connection data, or container output.
