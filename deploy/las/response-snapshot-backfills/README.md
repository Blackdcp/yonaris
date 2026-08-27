# Reviewed response snapshot backfill validation

This directory is a validation-contract archive, not a production queue. The
former `response-snapshot-backfill` forced-command operation is permanently
rejected by the LAS dispatcher and policy parsers. Do not create a production
`requests/` directory, add a policy line, restore its workflow call, or expose
the runtime dotenv or Docker socket to the candidate helper.

Historical request fixtures bind exact sorted run IDs, an approved brand,
end-exclusive UTC window, channels, expected count, source commit, and a
fingerprint of existing run/prompt/scope/citation identities. PPIO fixtures
also require `sourceFailureCode=snapshot_contract_invalid`.

Those constraints remain requirements for tests and any future replacement:
dry-run before apply, a per-brand advisory lock, chunks of 100, and a database
write set limited to `response_snapshots` and `response_snapshot_outbox`.
Observations, prompt runs, citations, prompts, scopes, and metrics must remain
unchanged.

A replacement requires a new operation name, stable fixed arguments,
root-owned durable evidence, and an exact protocol bound to the active
immutable release and five-digest receipt. Re-enabling the retired operation or
its old `/opt/yonaris/operation-receipts` path is not supported.
