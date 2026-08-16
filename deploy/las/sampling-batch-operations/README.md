# Explicit Sampling Batch Operations

This directory contains the reviewed contract for a one-time StepFun CN / Doubao batch operation. It does not schedule work and does not itself create a batch.

This release contains exactly one approved request under `requests/`: the StepFun v5 recovery batch. The deployment workflow validates that exact request, runs against the immutable deployed SHA under the production environment and SSH lock, checks status, dry-runs, then makes one idempotent `--apply` call.

The v5 identity is intentionally distinct from the incomplete v4 batch. It creates a fresh 18-slot cohort and never retries the post-submit v4 slot whose answer could not be recovered.

The worker uses its fixed idempotency key to make replays a no-op. Operation output is deliberately reduced to lifecycle-safe fields; it never relays prompt text, database connection data, or container output.
