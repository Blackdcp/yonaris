# Response snapshot activation validation fixtures

The former `response-snapshot-activation` forced-command operation is
permanently rejected by the LAS dispatcher and policy parsers. Requests in this
directory are historical validation fixtures, not production authorization.
Keep `RESPONSE_SNAPSHOT_ENABLED=false`; do not restore the workflow call, add a
policy line, edit the canonical runtime dotenv, or expose a Docker socket to
the candidate helper.

Any future activation needs a new operation name, reviewed stable fixed
arguments, and a new exact protocol bound to the active immutable release and
five-digest receipt. Re-enabling the retired name is not supported.
