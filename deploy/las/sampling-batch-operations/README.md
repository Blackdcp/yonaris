# Explicit Sampling batch validation

This directory preserves reviewed validation machinery for historical one-time
Sampling requests. It does not schedule work or authorize production access.
The former `sampling-batch-operation` forced-command operation is permanently
rejected by the LAS dispatcher and policy parsers.

The `requests/` directory is intentionally empty. The retired StepFun CN /
Doubao six-sample request used the legacy host Runner route and must not start
during deployment. Administrators create domestic runs explicitly in Portal
and execute them through a paired local browser extension.

Do not add a production request or policy line, restore the old workflow call,
or expose the runtime dotenv or Docker socket to the candidate helper. A future
one-time Sampling capability requires a new operation name, a newly reviewed
stable fixed-argument manager path, and a new exact protocol bound to the
active immutable release and its five-digest receipt.

Any replacement must retain the fixed idempotency and redacted-output
requirements: replays are no-ops, and output never relays prompt text, database
connection data, secrets, or container output. Re-enabling the retired name is
not supported.
