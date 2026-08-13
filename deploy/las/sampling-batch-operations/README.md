# Explicit Sampling Batch Operations

This directory contains the reviewed contract for a one-time StepFun CN / Doubao batch operation. It does not schedule work and does not itself create a batch.

The `requests/` directory is intentionally absent from this release. A production batch is considered approved only when a separate release adds exactly one regular JSON file under `requests/`, using the exact shape in `request.example.json`. The deployment workflow validates that request, runs against the immutable deployed SHA under the production environment and SSH lock, checks status, dry-runs, then makes one idempotent `--apply` call.

The worker uses its fixed idempotency key to make replays a no-op. Operation output is deliberately reduced to lifecycle-safe fields; it never relays prompt text, database connection data, or container output.
