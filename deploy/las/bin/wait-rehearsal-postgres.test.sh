#!/usr/bin/env bash

set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT_UNDER_TEST="$SCRIPT_DIR/wait-rehearsal-postgres.sh"
TEST_ROOT="$(mktemp -d)"
trap 'rm -rf -- "$TEST_ROOT"' EXIT

MOCK_BIN="$TEST_ROOT/bin"
DOCKER_LOG="$TEST_ROOT/docker.log"
LOG_COUNT="$TEST_ROOT/log-count"
PSQL_COUNT="$TEST_ROOT/psql-count"
CONTAINER='yonaris-upgrade-rehearsal-db-20260811T070000Z-123-456'

mkdir -p "$MOCK_BIN"
printf '0\n' >"$LOG_COUNT"
printf '0\n' >"$PSQL_COUNT"

cat >"$MOCK_BIN/docker" <<'EOF'
#!/usr/bin/env bash
set -Eeuo pipefail
printf '<%s>' "$1" >>"$MOCK_DOCKER_LOG"
printf ' <%s>' "${@:2}" >>"$MOCK_DOCKER_LOG"
printf '\n' >>"$MOCK_DOCKER_LOG"

case "$1" in
  logs)
    if [[ "${2:-}" == --tail ]]; then
      printf 'mock PostgreSQL logs\n'
      exit 0
    fi
    count="$(<"$MOCK_LOG_COUNT")"
    count=$((count + 1))
    printf '%s\n' "$count" >"$MOCK_LOG_COUNT"
    if [[ "${MOCK_READY_MODE:-eventual}" == eventual && "$count" -ge 2 ]]; then
      printf 'PostgreSQL init process complete; ready for start up.\n'
    else
      printf 'PostgreSQL initialization in progress.\n'
    fi
    ;;
  exec)
    count="$(<"$MOCK_PSQL_COUNT")"
    count=$((count + 1))
    printf '%s\n' "$count" >"$MOCK_PSQL_COUNT"
    if [[ "$count" -eq 1 ]]; then
      exit 1
    fi
    printf 'yonaris_rehearsal\n'
    ;;
  *)
    echo "Unexpected Docker invocation" >&2
    exit 91
    ;;
esac
EOF

cat >"$MOCK_BIN/sleep" <<'EOF'
#!/usr/bin/env bash
set -Eeuo pipefail
exit 0
EOF

chmod +x "$MOCK_BIN/docker" "$MOCK_BIN/sleep"

run_waiter() {
  env \
    PATH="$MOCK_BIN:$PATH" \
    MOCK_DOCKER_LOG="$DOCKER_LOG" \
    MOCK_LOG_COUNT="$LOG_COUNT" \
    MOCK_PSQL_COUNT="$PSQL_COUNT" \
    MOCK_READY_MODE="${1:-eventual}" \
    REHEARSAL_POSTGRES_READY_ATTEMPTS="${2:-4}" \
    REHEARSAL_POSTGRES_READY_INTERVAL_SECONDS=0 \
    bash "$SCRIPT_UNDER_TEST" "$CONTAINER"
}

: >"$DOCKER_LOG"
success_output="$(run_waiter eventual 4)"
grep -Fq 'Isolated PostgreSQL initialization completed.' <<<"$success_output"
if [[ "$(<"$LOG_COUNT")" -ne 3 || "$(<"$PSQL_COUNT")" -ne 2 ]]; then
  echo "Readiness did not wait for both the init marker and a stable exact-database connection." >&2
  exit 1
fi
grep -Fq '<exec>' "$DOCKER_LOG"
grep -Fq '<--dbname> <yonaris_rehearsal>' "$DOCKER_LOG"
grep -Fq "<--command> <select current_database();>" "$DOCKER_LOG"
if grep -Fq '<pg_isready>' "$DOCKER_LOG"; then
  echo "Readiness regressed to pg_isready, which races official-image initialization." >&2
  exit 1
fi

printf '0\n' >"$LOG_COUNT"
printf '0\n' >"$PSQL_COUNT"
: >"$DOCKER_LOG"
set +e
run_waiter never 2 >"$TEST_ROOT/timeout.out" 2>"$TEST_ROOT/timeout.err"
timeout_status=$?
set -e
if [[ "$timeout_status" -ne 1 ]]; then
  echo "Missing initialization marker did not fail closed." >&2
  exit 1
fi
grep -Fq 'did not finish initialization' "$TEST_ROOT/timeout.err"
if [[ "$(<"$PSQL_COUNT")" -ne 0 ]]; then
  echo "The waiter queried PostgreSQL before official-image initialization completed." >&2
  exit 1
fi

set +e
env PATH="$MOCK_BIN:$PATH" bash "$SCRIPT_UNDER_TEST" arbitrary-container \
  >"$TEST_ROOT/invalid.out" 2>"$TEST_ROOT/invalid.err"
invalid_status=$?
set -e
if [[ "$invalid_status" -ne 2 ]]; then
  echo "Unsafe rehearsal container name did not fail closed." >&2
  exit 1
fi

echo "wait-rehearsal-postgres mock tests passed"
