# Browser Runner activation validation fixtures

The former `browser-runner-activation` forced-command operation is permanently
rejected by the LAS dispatcher and policy parsers. Requests in this directory
are historical validation fixtures, not a production queue. Keep
`BROWSER_RUNNER_ENABLED=false` on LAS; do not restore the workflow call, add a
policy line, or expose the runtime dotenv or Docker socket to candidate code.

A future Runner capability requires a new operation name, an independently
reviewed stable boundary, and a new exact protocol. Re-enabling the retired
operation is not supported.
