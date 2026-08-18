# Reviewed response snapshot backfills

Production is inert while this directory contains only `*.example.json` files and no `requests/` directory. To run a backfill, first deploy the code and schema with snapshot capture disabled. Then create a separate reviewed commit containing exactly one file in `requests/`.

The request must enumerate the exact sorted run IDs, approved brand, end-exclusive UTC observation window, exact channels, expected count, a SHA-256 fingerprint calculated from the existing run/prompt/scope/citation identities, and the immutable source commit SHA reviewed for the operation. PPIO requests additionally require `sourceFailureCode` to be exactly `snapshot_contract_invalid`.

The operation always performs a dry-run before apply. It uses a per-brand advisory lock and chunks of 100. Its only database write set is `response_snapshots` and `response_snapshot_outbox`; it never updates observations, prompt runs, citations, prompts, scopes, or metrics. A failed chunk can be safely rerun.

After a successful production operation, retain the durable receipt under `/opt/yonaris/operation-receipts/response-snapshot-backfills/`, verify the customer view and hashes, then remove the one-shot request in a follow-up commit.
