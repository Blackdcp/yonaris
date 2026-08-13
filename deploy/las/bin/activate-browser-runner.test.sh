#!/usr/bin/env bash

set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT_UNDER_TEST="$SCRIPT_DIR/activate-browser-runner.sh"
TEST_ROOT="$(mktemp -d)"
trap 'rm -rf -- "$TEST_ROOT"' EXIT

DEPLOY_ROOT="$TEST_ROOT/deploy"
SOURCE_ROOT="$TEST_ROOT/source"
MOCK_BIN="$TEST_ROOT/bin"
ENV_FILE="$DEPLOY_ROOT/.env"
COMPOSE_FILE="$SOURCE_ROOT/deploy/las/compose.yaml"
REQUEST_FILE="$SOURCE_ROOT/deploy/las/browser-runner-activation/requests/enable.json"
EVENT_LOG="$TEST_ROOT/events.log"
RELEASE_TAG="sha-3333333333333333333333333333333333333333"

mkdir -p -- "$DEPLOY_ROOT" "$(dirname -- "$COMPOSE_FILE")" "$(dirname -- "$REQUEST_FILE")" "$MOCK_BIN"
printf '{}\n' >"$COMPOSE_FILE"
printf '%s\n' "$RELEASE_TAG" >"$DEPLOY_ROOT/.release"
cat >"$ENV_FILE" <<'EOF'
APP_ENV_FILE=/opt/yonaris/.env
ADMIN_API_KEYS=admin-token
BROWSER_RUNNER_ENABLED=false
EOF
cat >"$REQUEST_FILE" <<'EOF'
{"schemaVersion":1,"operation":"enable-browser-runner","runnerId":"yonaris-cn-doubao-01","market":"CN","locale":"zh-CN","timezone":"Asia/Shanghai","bootstrapTtlSeconds":1800,"recipientKeyFingerprint":"fbee6383aa7952fc55c5da059ecf59ee8e469644781a34ecf40c4a408ec5b75c"}
EOF

cat >"$MOCK_BIN/python3" <<'EOF'
#!/usr/bin/env bash
printf '1800\n'
EOF
cat >"$MOCK_BIN/openssl" <<'EOF'
#!/usr/bin/env bash
if [[ "$*" == "rand -hex 32" ]]; then
	printf '%064d\n' 7
	exit 0
fi
exit 91
EOF
cat >"$MOCK_BIN/docker" <<'EOF'
#!/usr/bin/env bash
printf 'docker:%s\n' "$*" >>"$MOCK_EVENT_LOG"
call_count="$(grep -c '^docker:' "$MOCK_EVENT_LOG")"
if [[ "${MOCK_COMPOSE_FAIL:-false}" == true && "$call_count" == 1 ]]; then
	exit 88
fi
EOF
cat >"$MOCK_BIN/curl" <<'EOF'
#!/usr/bin/env bash
printf 'curl:%s\n' "$*" >>"$MOCK_EVENT_LOG"
[[ "${MOCK_HEALTH_FAIL:-false}" != true ]]
EOF
cat >"$MOCK_BIN/flock" <<'EOF'
#!/usr/bin/env bash
exit 0
EOF
cat >"$MOCK_BIN/mktemp" <<'EOF'
#!/usr/bin/env bash
if [[ "${MOCK_RECEIPT_WRITE_FAIL:-false}" == true && "$*" == *browser-runner-receipt* ]]; then
	link_path="${MOCK_RECEIPT_FULL_LINK:?}"
	ln -s /dev/full "$link_path"
	printf '%s\n' "$link_path"
	exit 0
fi
exec /usr/bin/mktemp "$@"
EOF
cat >"$MOCK_BIN/mv" <<'EOF'
#!/usr/bin/env bash
if [[ "${MOCK_RECEIPT_RENAME_FAIL:-false}" == true && "${*: -1}" == *.completed ]]; then
	exit 90
fi
exec /bin/mv "$@"
EOF
chmod +x "$MOCK_BIN"/*

run_activation() {
	env PATH="$MOCK_BIN:$PATH" MOCK_EVENT_LOG="$EVENT_LOG" DEPLOY_ROOT="$DEPLOY_ROOT" \
		COMPOSE_FILE="$COMPOSE_FILE" ENV_FILE="$ENV_FILE" BROWSER_RUNNER_HEALTH_ATTEMPTS=1 \
		MOCK_HEALTH_FAIL="${MOCK_HEALTH_FAIL:-false}" MOCK_COMPOSE_FAIL="${MOCK_COMPOSE_FAIL:-false}" \
		MOCK_RECEIPT_WRITE_FAIL="${MOCK_RECEIPT_WRITE_FAIL:-false}" \
		MOCK_RECEIPT_FULL_LINK="$DEPLOY_ROOT/browser-runner-activation/.browser-runner-receipt.full" \
		MOCK_RECEIPT_RENAME_FAIL="${MOCK_RECEIPT_RENAME_FAIL:-false}" \
		bash "$SCRIPT_UNDER_TEST" "$RELEASE_TAG" "$REQUEST_FILE"
}

reset_activation_fixture() {
	rm -rf -- "$DEPLOY_ROOT/browser-runner-activation"
	cat >"$ENV_FILE" <<'EOF'
APP_ENV_FILE=/opt/yonaris/.env
ADMIN_API_KEYS=admin-token
BROWSER_RUNNER_ENABLED=false
EOF
	cp -p -- "$ENV_FILE" "$TEST_ROOT/original.env"
	: >"$EVENT_LOG"
}

assert_failed_activation_rolled_back() {
	local status="$1"
	if [[ "$status" -eq 0 ]]; then
		echo 'Failure injection unexpectedly committed activation.' >&2
		exit 1
	fi
	cmp --silent "$TEST_ROOT/original.env" "$ENV_FILE" || {
		echo 'Failed activation did not restore the environment byte-for-byte.' >&2
		exit 1
	}
	if find "$DEPLOY_ROOT" \( -name '.browser-runner-env.*' -o -name '.browser-runner-receipt.*' \) -print -quit | grep -q .; then
		echo 'Failed activation leaked a candidate or backup containing sensitive state.' >&2
		exit 1
	fi
	if [[ "$(grep -c '^docker:' "$EVENT_LOG")" -lt 2 ]]; then
		echo 'Failed activation did not attempt to restore the prior web configuration.' >&2
		exit 1
	fi
}

: >"$EVENT_LOG"
output="$(run_activation)"
grep -Fq 'Browser Runner activation completed.' <<<"$output"
if grep -Fq '0000000000000000000000000000000000000000000000000000000000000007' <<<"$output"; then
	echo 'Activation leaked the generated token.' >&2
	exit 1
fi
grep -Fxq 'BROWSER_RUNNER_ENABLED=true' "$ENV_FILE"
grep -Fxq 'BROWSER_RUNNER_ID=yonaris-cn-doubao-01' "$ENV_FILE"
grep -Fxq 'BROWSER_RUNNER_MARKET=CN' "$ENV_FILE"
grep -Fxq 'BROWSER_RUNNER_LOCALE=zh-CN' "$ENV_FILE"
grep -Fxq 'BROWSER_RUNNER_TIMEZONE=Asia/Shanghai' "$ENV_FILE"
grep -Fxq 'BROWSER_RUNNER_API_TOKEN=0000000000000000000000000000000000000000000000000000000000000007' "$ENV_FILE"
grep -Eq '^BROWSER_RUNNER_BOOTSTRAP_EXPIRES_AT=[0-9TZ:.-]+$' "$ENV_FILE"

: >"$EVENT_LOG"
second_output="$(run_activation)"
grep -Fq 'already completed' <<<"$second_output"
if [[ -s "$EVENT_LOG" ]]; then
	echo 'Idempotent replay restarted production services.' >&2
	exit 1
fi

reset_activation_fixture
set +e
MOCK_HEALTH_FAIL=true run_activation >"$TEST_ROOT/fail.out" 2>"$TEST_ROOT/fail.err"
status=$?
set -e
assert_failed_activation_rolled_back "$status"
if find "$DEPLOY_ROOT/browser-runner-activation" -name '*.completed' -print -quit | grep -q .; then
	echo 'Failed activation wrote a completed receipt.' >&2
	exit 1
fi

reset_activation_fixture
set +e
MOCK_COMPOSE_FAIL=true run_activation >"$TEST_ROOT/compose-fail.out" 2>"$TEST_ROOT/compose-fail.err"
status=$?
set -e
assert_failed_activation_rolled_back "$status"

reset_activation_fixture
receipt_path="$DEPLOY_ROOT/browser-runner-activation/enable.completed"
mkdir -p -- "$receipt_path"
set +e
run_activation >"$TEST_ROOT/receipt-path-fail.out" 2>"$TEST_ROOT/receipt-path-fail.err"
status=$?
set -e
assert_failed_activation_rolled_back "$status"

reset_activation_fixture
set +e
MOCK_RECEIPT_WRITE_FAIL=true run_activation >"$TEST_ROOT/receipt-write-fail.out" 2>"$TEST_ROOT/receipt-write-fail.err"
status=$?
set -e
assert_failed_activation_rolled_back "$status"

reset_activation_fixture
set +e
MOCK_RECEIPT_RENAME_FAIL=true run_activation >"$TEST_ROOT/receipt-rename-fail.out" 2>"$TEST_ROOT/receipt-rename-fail.err"
status=$?
set -e
assert_failed_activation_rolled_back "$status"

if grep -R -Fq '0000000000000000000000000000000000000000000000000000000000000007' "$TEST_ROOT"/*.out "$TEST_ROOT"/*.err; then
	echo 'Activation failure output leaked the generated token.' >&2
	exit 1
fi

echo 'browser runner activation mock tests passed'
