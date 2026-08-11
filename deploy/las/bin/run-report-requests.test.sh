#!/usr/bin/env bash

set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT_UNDER_TEST="$SCRIPT_DIR/run-report-requests.sh"
TEST_ROOT="$(mktemp -d)"
trap 'rm -rf -- "$TEST_ROOT"' EXIT

SOURCE_ROOT="$TEST_ROOT/source"
MOCK_BIN="$TEST_ROOT/bin"
DEPLOY_ROOT="$TEST_ROOT/deploy"
COMPOSE_FILE="$SOURCE_ROOT/deploy/las/compose.yaml"
ENV_FILE="$DEPLOY_ROOT/.env"
REQUEST_DIR="$SOURCE_ROOT/apps/worker/src/report-requests"
EVENT_LOG="$TEST_ROOT/events.log"
RELEASE_TAG="sha-2222222222222222222222222222222222222222"

mkdir -p "$SOURCE_ROOT/deploy/las/bin" "$REQUEST_DIR" "$MOCK_BIN" "$DEPLOY_ROOT"
sed 's/\r$//' "$SCRIPT_UNDER_TEST" >"$SOURCE_ROOT/deploy/las/bin/run-report-requests.sh"
printf '{}\n' >"$COMPOSE_FILE"
cat >"$ENV_FILE" <<EOF
APP_ENV_FILE=$ENV_FILE
EOF
printf '%s\n' "$RELEASE_TAG" >"$DEPLOY_ROOT/.release"

cat >"$MOCK_BIN/docker" <<'EOF'
#!/usr/bin/env bash
set -Eeuo pipefail
joined=" $* "
if [[ "$joined" != *" --profile operations run --rm --no-deps -T account-ops node ./node_modules/tsx/dist/cli.mjs ./src/run-database-report.ts --request-file ./src/report-requests/request.json "* ]]; then
	echo "Unexpected docker invocation." >&2
	exit 90
fi
if [[ "$joined" != *" --apply "* && "$joined" != *" --status-only "* ]]; then
	echo "Missing execution mode." >&2
	exit 91
fi
printf 'docker:%s\n' "$*" >>"$MOCK_EVENT_LOG"
printf '{"status":"completed","reportId":"00000000-0000-4000-8000-000000000001"}\n'
EOF

cat >"$MOCK_BIN/flock" <<'EOF'
#!/usr/bin/env bash
set -Eeuo pipefail
if [[ "$#" -eq 2 && "$1" == -n && "$2" == 8 ]]; then
	exit 0
fi
echo "Unexpected flock invocation." >&2
exit 92
EOF

chmod +x "$SOURCE_ROOT/deploy/las/bin/run-report-requests.sh" "$MOCK_BIN/docker" "$MOCK_BIN/flock"

run_requests() {
	env \
		PATH="$MOCK_BIN:$PATH" \
		DEPLOY_ROOT="$DEPLOY_ROOT" \
		COMPOSE_FILE="$COMPOSE_FILE" \
		ENV_FILE="$ENV_FILE" \
		MOCK_EVENT_LOG="$EVENT_LOG" \
		bash "$SOURCE_ROOT/deploy/las/bin/run-report-requests.sh" "$RELEASE_TAG"
}

cat >"$REQUEST_DIR/request.json" <<'EOF'
{"schemaVersion":1,"requestId":"request","reportId":"00000000-0000-4000-8000-000000000001"}
EOF

: >"$EVENT_LOG"
first_output="$(run_requests)"
grep -Fq 'Executing approved report request: request.json' <<<"$first_output"
grep -Fq ' --apply' "$EVENT_LOG"
if grep -Fq ' --status-only' "$EVENT_LOG"; then
	echo "First execution unexpectedly used status-only mode." >&2
	exit 1
fi
receipt="$DEPLOY_ROOT/report-ops/request.started"
if [[ ! -f "$receipt" ]]; then
	echo "First execution did not create a durable receipt." >&2
	exit 1
fi

: >"$EVENT_LOG"
second_output="$(run_requests)"
grep -Fq 'checking status only: request.json' <<<"$second_output"
grep -Fq ' --status-only' "$EVENT_LOG"
if grep -Fq ' --apply' "$EVENT_LOG"; then
	echo "Receipt replay unexpectedly used apply mode." >&2
	exit 1
fi

printf ' ' >>"$REQUEST_DIR/request.json"
: >"$EVENT_LOG"
set +e
run_requests >"$TEST_ROOT/mismatch.out" 2>"$TEST_ROOT/mismatch.err"
mismatch_status=$?
set -e
if [[ "$mismatch_status" -eq 0 ]]; then
	echo "Changed request content unexpectedly reused an existing receipt." >&2
	exit 1
fi
grep -Fq 'receipt exists with different content' "$TEST_ROOT/mismatch.err"
if [[ -s "$EVENT_LOG" ]]; then
	echo "Changed request content reached account-ops." >&2
	exit 1
fi

rm -f -- "$REQUEST_DIR/request.json"
: >"$EVENT_LOG"
empty_output="$(run_requests)"
grep -Fq 'No approved database report requests' <<<"$empty_output"
if [[ -s "$EVENT_LOG" ]]; then
	echo "Empty request set invoked account-ops." >&2
	exit 1
fi

printf '%s\n' 'sha-1111111111111111111111111111111111111111' >"$DEPLOY_ROOT/.release"
set +e
run_requests >"$TEST_ROOT/release.out" 2>"$TEST_ROOT/release.err"
release_status=$?
set -e
if [[ "$release_status" -eq 0 ]]; then
	echo "Mismatched release marker unexpectedly allowed report operations." >&2
	exit 1
fi
grep -Fq 'before the requested immutable release is healthy' "$TEST_ROOT/release.err"

printf '%s\n' "$RELEASE_TAG" >"$DEPLOY_ROOT/.release"
cat >"$REQUEST_DIR/request.json" <<'EOF'
{"schemaVersion":1,"requestId":"request","reportId":"00000000-0000-4000-8000-000000000001"}
EOF
cp -- "$REQUEST_DIR/request.json" "$REQUEST_DIR/second.json"
set +e
run_requests >"$TEST_ROOT/multiple.out" 2>"$TEST_ROOT/multiple.err"
multiple_status=$?
set -e
if [[ "$multiple_status" -eq 0 ]]; then
	echo "Multiple report requests unexpectedly passed the per-release budget." >&2
	exit 1
fi
grep -Fq 'Exactly one approved report request' "$TEST_ROOT/multiple.err"

echo "report request operation mock tests passed"
