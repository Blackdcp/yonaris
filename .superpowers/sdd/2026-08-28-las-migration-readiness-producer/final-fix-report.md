# LAS migration-readiness producer final fix report

## Status

All three final-review findings are implemented. The producer/runtime cleanup
boundary, rehearsal evidence format, and fresh-bootstrap ordering now fail
closed. The dedicated producer and security slices passed on Windows Git Bash.
The runtime new-operation slice was time-bounded and its final attempt was
interrupted, so this report does not claim a completed runtime-slice GREEN run.

## Changes

### Runtime cleanup and success boundary

- Replaced the untracked `docker run --rm` migration process with a named,
  release-and-nonce-scoped container created before start and tracked after
  successful creation.
- Waits for and requires the migration container's exact exit status `0`.
- Cleanup attempts every owned migration/Postgres container, volume, and
  network even after an earlier cleanup failure.
- Every removal and every absence query is immediately reauthorized through the
  exact migration-readiness runtime tuple.
- Cleanup verifies absence through exact container/volume/network name filters.
- The runtime result is not written until cleanup succeeds; cleanup failure on
  an otherwise successful rehearsal returns nonzero and leaves no result.
- Earlier failure traps preserve the original nonzero status while still
  aggregating cleanup failures.

### Producer cleanup and publication boundary

- Split cleanup into publication-temporary cleanup and sensitive-work cleanup.
- Sensitive backup, returned-copy, and runtime-result work is recursively
  removed, the release work directory is removed, and both absences are checked
  before evidence staging or publication begins.
- Cleanup command failure is retained even if a later absence check succeeds.
- The EXIT trap retries safely on earlier failures, preserves the original
  failure status, and never turns a cleanup failure into readiness success.
- Success output is emitted only after durable verification and an explicit
  final no-op/idempotent cleanup check.

### Evidence format

- Runtime rehearsal results now contain exactly:

  ```text
  las-migration-rehearsal-runtime-v1 ok
  migration-exit-status 0
  completed-at-utc YYYY-MM-DDTHH:MM:SSZ
  ```

- The producer validates that format and copies the explicit exit status and
  UTC completion timestamp into the opaque, hash-bound rehearsal evidence.
- The readiness attestation remains exactly nine lines and continues to bind
  only the two evidence hashes.

### Fresh bootstrap ordering

- The runbook and README now require immutable tree materialization before the
  producer, then exact readiness verification, then portal runtime bootstrap.
- The security slice asserts that order inside the canonical predecessor
  section.

## TDD evidence

### RED

1. Runtime cleanup/tracking contract:

   ```text
   The migration rehearsal container is not tracked by name.
   ```

   Command: `RUNTIME_TEST_NEW_OPERATION_SLICE=yes bash deploy/las/bin/manage-las-runtime.test.sh`

2. Producer cleanup gate:

   ```text
   Producer published readiness before sensitive work cleanup succeeded.
   ```

   Command: `bash deploy/las/bin/produce-las-migration-readiness.test.sh`

3. Runtime evidence format:

   ```text
   Migration rehearsal result lacks the exact success status and UTC completion timestamp.
   ```

4. Producer evidence format:

   ```text
   The migration rehearsal result is invalid.
   ```

5. Fresh-bootstrap ordering contract:

   ```text
   Missing ordered security contract (fresh bootstrap migration-readiness order): /usr/local/libexec/yonaris-las/produce-las-migration-readiness \
   ```

   Command: `bash deploy/las/bin/artifact-output-language-security.test.sh`

### GREEN

- Dedicated producer slice exited `0`:

  ```text
  las-migration-readiness-v1 ok
  las-migration-readiness-v1 ok
  root-owned migration readiness producer tests passed
  ```

- Dedicated security/ordering slice exited `0`:

  ```text
  artifact output language security contract tests passed
  ```

- Fresh `bash -n deploy/las/bin/*.sh` exited `0` with no output.
- Fresh `git diff --check` exited `0`; Git emitted only its Windows LF/CRLF
  working-copy warnings for the two Markdown files.

## Runtime slice limitation and exact Linux verification

The Windows Git Bash runtime slice progressed through the new-operation cases
but exceeded the bounded window; the final bounded retry was interrupted at
controller direction. No runtime-slice pass is claimed. Run these exact
commands on Linux and retain their exit output:

```bash
RUNTIME_TEST_NEW_OPERATION_SLICE=yes bash deploy/las/bin/manage-las-runtime.test.sh
bash deploy/las/bin/produce-las-migration-readiness.test.sh
bash deploy/las/bin/artifact-output-language-security.test.sh
bash -n deploy/las/bin/*.sh
git diff --check
```

## Files

- `deploy/las/bin/manage-las-runtime.sh`
- `deploy/las/bin/manage-las-runtime.test.sh`
- `deploy/las/bin/produce-las-migration-readiness.sh`
- `deploy/las/bin/produce-las-migration-readiness.test.sh`
- `deploy/las/bin/artifact-output-language-security.test.sh`
- `deploy/las/ARTIFACT-OUTPUT-LANGUAGE-RUNBOOK.md`
- `deploy/las/README.md`
- `.superpowers/sdd/2026-08-28-las-migration-readiness-producer/final-fix-report.md`

## Self-review

- Confirmed cleanup flags are set only after successful ownership-establishing
  Docker creates, so a failed create does not delete a stale/foreign resource.
- Confirmed every cleanup removal and absence query uses the same adjacent
  runtime authorization path as rehearsal mutations.
- Confirmed cleanup continues after individual failures and an otherwise
  successful operation cannot produce a result after any cleanup error.
- Confirmed the producer removes and verifies sensitive work before the first
  evidence rename and preserves the existing partial-publication conflict
  behavior for failures after publication begins.
- Confirmed the completion timestamp is strict second-resolution UTC with a
  literal `Z`, and the migration status is derived from the named container's
  successful completion.
- Confirmed the nine-line verifier schema is unchanged.
- Confirmed no SSH dispatcher grammar, production variables, application code,
  dependency files, or production state changed.

## Concerns

- Linux CI/operator verification still needs to capture the runtime
  new-operation slice exit `0`; Windows did not return a complete result within
  the allowed window.
- Production execution still requires the separately reviewed root-owned
  off-host adapter, exact build digests, direct-root console access, and clear
  journals. No production action was attempted here.
