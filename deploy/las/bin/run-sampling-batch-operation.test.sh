#!/usr/bin/env bash

set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT_UNDER_TEST="$SCRIPT_DIR/run-sampling-batch-operation.sh"

if [[ ! -x "$SCRIPT_UNDER_TEST" ]]; then
	echo "Expected the explicit sampling batch operation script to exist and be executable." >&2
	exit 1
fi

TEST_ROOT="$(mktemp -d)"
trap 'rm -rf -- "$TEST_ROOT"' EXIT

SOURCE_ROOT="$TEST_ROOT/source"
MOCK_BIN="$TEST_ROOT/bin"
DEPLOY_ROOT="$TEST_ROOT/deploy"
COMPOSE_FILE="$SOURCE_ROOT/deploy/las/compose.yaml"
ENV_FILE="$DEPLOY_ROOT/.env"
REQUEST_FILE="$SOURCE_ROOT/deploy/las/sampling-batch-operations/requests/stepfun.json"
EVENT_LOG="$TEST_ROOT/events.log"
RELEASE_TAG="sha-4444444444444444444444444444444444444444"
MANIFEST_PATH="apps/worker/src/sampling-batch-requests/stepfun-cn-doubao-6x-20260816-v3.json"

if python3 --version >/dev/null 2>&1; then
	TEST_PYTHON="$(command -v python3)"
elif [[ -x /c/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe ]]; then
	# Git Bash on this workstation exposes only the Windows Store python3 stub.
	TEST_PYTHON="/c/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe"
else
	echo "A working Python 3 interpreter is required for this shell test." >&2
	exit 1
fi

mkdir -p -- "$(dirname -- "$COMPOSE_FILE")" "$(dirname -- "$REQUEST_FILE")" \
	"$SOURCE_ROOT/deploy/las/bin" \
	"$(dirname -- "$SOURCE_ROOT/$MANIFEST_PATH")" "$MOCK_BIN" "$DEPLOY_ROOT"
cp -- "$SCRIPT_UNDER_TEST" "$SOURCE_ROOT/deploy/las/bin/run-sampling-batch-operation.sh"
chmod +x "$SOURCE_ROOT/deploy/las/bin/run-sampling-batch-operation.sh"
printf '{}\n' >"$COMPOSE_FILE"
cat >"$ENV_FILE" <<EOF
APP_ENV_FILE=$ENV_FILE
EOF
printf '%s\n' "$RELEASE_TAG" >"$DEPLOY_ROOT/.release"
printf '{}\n' >"$SOURCE_ROOT/$MANIFEST_PATH"
cat >"$REQUEST_FILE" <<'EOF'
{"schemaVersion":1,"operation":"run-sampling-batch","requestId":"stepfun-cn-doubao-6x-20260816-v3","manifestPath":"apps/worker/src/sampling-batch-requests/stepfun-cn-doubao-6x-20260816-v3.json"}
EOF

cat >"$MOCK_BIN/docker" <<'EOF'
#!/usr/bin/env bash
set -Eeuo pipefail
joined=" $* "
expected=" --profile operations run --rm --no-deps -T account-ops node ./node_modules/tsx/dist/cli.mjs ./src/run-sampling-batch.ts --request-file ./src/sampling-batch-requests/stepfun-cn-doubao-6x-20260816-v3.json "
if [[ "$joined" != *"$expected"* ]]; then
	echo "Unexpected docker invocation." >&2
	exit 90
fi
if [[ "$joined" == *" --status-only "* ]]; then
	mode="status-only"
elif [[ "$joined" == *" --apply "* ]]; then
	mode="apply"
else
	mode="dry-run"
fi
printf '%s\n' "$mode" >>"$MOCK_EVENT_LOG"
if [[ "${MOCK_DOCKER_NOISE:-false}" == "true" ]]; then
	printf '%s\n' " Container yonaris-db-1 Running"
	printf '%s\n' " account-ops Pulling"
fi
if [[ "$mode" == "status-only" && "${MOCK_BATCH_EXISTS:-false}" != "true" ]]; then
	if [[ -n "${MOCK_STATUS_ERROR_CODE:-}" ]]; then
		printf '{"ok":false,"code":"%s","message":"withheld"}\n' "$MOCK_STATUS_ERROR_CODE"
		exit 1
	fi
	printf '%s\n' '{"ok":false,"code":"batch_not_found","message":"The fixed batch is absent; status-only mode will not create it"}'
	exit 1
fi
if [[ "${MOCK_BATCH_EXISTS:-false}" == "true" ]]; then
	printf '%s\n' '{"ok":true,"requestId":"stepfun-cn-doubao-6x-20260816-v3","idempotencyKey":"sampling:stepfun:cn-zh-scored:doubao:6x:2026-08-16-v3","action":"existing_noop","batchId":"batch-1","brandId":"brand-1","brandName":"StepFun","scopeId":"scope-1","scopeKey":"cn-zh-scored","status":"in_progress","automationStatus":"running","plannedTaskCount":18,"succeededTaskCount":0,"failedTaskCount":0,"measurementWindow":{"startsAt":"2026-08-15T16:00:00.000Z","endsAt":"2026-08-23T15:59:59.000Z"},"timezone":"Asia/Shanghai"}'
	exit 0
fi
case "$mode" in
	status-only) printf '%s\n' '{"ok":true,"requestId":"stepfun-cn-doubao-6x-20260816-v3","idempotencyKey":"sampling:stepfun:cn-zh-scored:doubao:6x:2026-08-16-v3","action":"existing_noop","batchId":"batch-1","brandId":"brand-1","brandName":"StepFun","scopeId":"scope-1","scopeKey":"cn-zh-scored","status":"in_progress","automationStatus":"running","plannedTaskCount":18,"succeededTaskCount":0,"failedTaskCount":0,"measurementWindow":{"startsAt":"2026-08-15T16:00:00.000Z","endsAt":"2026-08-23T15:59:59.000Z"},"timezone":"Asia/Shanghai"}' ;;
	dry-run) printf '%s\n' '{"ok":true,"requestId":"stepfun-cn-doubao-6x-20260816-v3","idempotencyKey":"sampling:stepfun:cn-zh-scored:doubao:6x:2026-08-16-v3","action":"would_create_freeze_start","batchId":null,"brandId":"brand-1","brandName":"StepFun","scopeId":"scope-1","scopeKey":"cn-zh-scored","status":"absent","automationStatus":null,"plannedTaskCount":18,"succeededTaskCount":0,"failedTaskCount":0,"measurementWindow":{"startsAt":"2026-08-15T16:00:00.000Z","endsAt":"2026-08-23T15:59:59.000Z"},"timezone":"Asia/Shanghai"}' ;;
	apply) printf '%s\n' '{"ok":true,"requestId":"stepfun-cn-doubao-6x-20260816-v3","idempotencyKey":"sampling:stepfun:cn-zh-scored:doubao:6x:2026-08-16-v3","action":"created_frozen_started","batchId":"batch-1","brandId":"brand-1","brandName":"StepFun","scopeId":"scope-1","scopeKey":"cn-zh-scored","status":"in_progress","automationStatus":"running","plannedTaskCount":18,"succeededTaskCount":0,"failedTaskCount":0,"measurementWindow":{"startsAt":"2026-08-15T16:00:00.000Z","endsAt":"2026-08-23T15:59:59.000Z"},"timezone":"Asia/Shanghai"}' ;;
esac
EOF

cat >"$MOCK_BIN/flock" <<'EOF'
#!/usr/bin/env bash
set -Eeuo pipefail
[[ "$#" -eq 2 && "$1" == "-n" && "$2" == "8" ]]
EOF
printf '#!/usr/bin/env bash\nexec %q "$@"\n' "$TEST_PYTHON" >"$MOCK_BIN/python3"
chmod +x "$MOCK_BIN/docker" "$MOCK_BIN/flock" "$MOCK_BIN/python3"

run_operation() {
	env PATH="$MOCK_BIN:$PATH" MOCK_EVENT_LOG="$EVENT_LOG" DEPLOY_ROOT="$DEPLOY_ROOT" \
		COMPOSE_FILE="$COMPOSE_FILE" ENV_FILE="$ENV_FILE" \
		bash "$SOURCE_ROOT/deploy/las/bin/run-sampling-batch-operation.sh" "$RELEASE_TAG" "$REQUEST_FILE"
}

: >"$EVENT_LOG"
set +e
first_output="$(run_operation 2>&1)"
first_status=$?
set -e
if [[ "$first_status" -ne 0 ]]; then
	echo "$first_output" >&2
	exit "$first_status"
fi
[[ "$(tr '\n' ' ' <"$EVENT_LOG")" == "status-only dry-run apply " ]]
grep -Fq 'sampling batch status: absent' <<<"$first_output"
grep -Fq 'sampling batch dry-run:' <<<"$first_output"
grep -Fq 'sampling batch apply:' <<<"$first_output"
if grep -Fq 'The fixed batch is absent' <<<"$first_output"; then
	echo "The operation leaked raw account-ops output." >&2
	exit 1
fi

: >"$EVENT_LOG"
noisy_output="$(MOCK_DOCKER_NOISE=true MOCK_BATCH_EXISTS=true run_operation)"
[[ "$(tr '\n' ' ' <"$EVENT_LOG")" == "status-only dry-run apply " ]]
grep -Fq 'sampling batch status: existing' <<<"$noisy_output"
if grep -Fq 'account-ops Pulling' <<<"$noisy_output"; then
	echo "The operation leaked docker progress output." >&2
	exit 1
fi

: >"$EVENT_LOG"
status_error_output=''
if status_error_output="$(MOCK_STATUS_ERROR_CODE=existing_batch_conflict run_operation 2>&1)"; then
	echo "A status-only operation error unexpectedly succeeded." >&2
	exit 1
fi
grep -Fq 'Sampling batch status check failed: code=existing_batch_conflict' <<<"$status_error_output"
if grep -Fq 'withheld' <<<"$status_error_output"; then
	echo "The operation leaked the raw status error message." >&2
	exit 1
fi

: >"$EVENT_LOG"
second_output="$(MOCK_BATCH_EXISTS=true run_operation)"
[[ "$(tr '\n' ' ' <"$EVENT_LOG")" == "status-only dry-run apply " ]]
grep -Fq 'sampling batch status: existing' <<<"$second_output"
if [[ "$(grep -cx 'apply' "$EVENT_LOG")" -ne 1 ]]; then
	echo "A replay did not make exactly one idempotent apply call." >&2
	exit 1
fi

cp -- "$REQUEST_FILE" "$REQUEST_FILE.bak"
sed -i 's/run-sampling-batch/not-approved/' "$REQUEST_FILE"
set +e
run_operation >"$TEST_ROOT/invalid.out" 2>"$TEST_ROOT/invalid.err"
invalid_status=$?
set -e
if [[ "$invalid_status" -eq 0 ]]; then
	echo "A changed request unexpectedly passed the fixed schema contract." >&2
	exit 1
fi
grep -Fq 'does not match the approved fixed contract' "$TEST_ROOT/invalid.err"
mv -- "$REQUEST_FILE.bak" "$REQUEST_FILE"

printf '%s\n' 'sha-1111111111111111111111111111111111111111' >"$DEPLOY_ROOT/.release"
set +e
run_operation >"$TEST_ROOT/release.out" 2>"$TEST_ROOT/release.err"
release_status=$?
set -e
if [[ "$release_status" -eq 0 ]]; then
	echo "A mismatched release marker unexpectedly reached account-ops." >&2
	exit 1
fi
grep -Fq 'before the requested immutable release is healthy' "$TEST_ROOT/release.err"

echo 'sampling batch operation mock tests passed'
