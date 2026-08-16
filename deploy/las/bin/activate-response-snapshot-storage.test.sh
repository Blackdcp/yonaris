#!/usr/bin/env bash

set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT_UNDER_TEST="$SCRIPT_DIR/activate-response-snapshot-storage.sh"
TEST_ROOT="$(mktemp -d)"
trap 'rm -rf -- "$TEST_ROOT"' EXIT

DEPLOY_ROOT="$TEST_ROOT/deploy"
SOURCE_ROOT="$TEST_ROOT/source"
BIN_DIR="$SOURCE_ROOT/deploy/las/bin"
MOCK_BIN="$TEST_ROOT/mock-bin"
ENV_FILE="$DEPLOY_ROOT/.env"
COMPOSE_FILE="$SOURCE_ROOT/deploy/las/compose.yaml"
REQUEST_FILE="$SOURCE_ROOT/deploy/las/response-snapshot-activation/requests/enable.json"
EVENT_LOG="$TEST_ROOT/events.log"
RELEASE_TAG="sha-4444444444444444444444444444444444444444"

mkdir -p -- "$DEPLOY_ROOT" "$BIN_DIR" "$(dirname -- "$REQUEST_FILE")" "$MOCK_BIN"
cp -- "$SCRIPT_UNDER_TEST" "$BIN_DIR/activate-response-snapshot-storage.sh"
printf '{}\n' >"$COMPOSE_FILE"
printf '%s\n' "$RELEASE_TAG" >"$DEPLOY_ROOT/.release"
cat >"$ENV_FILE" <<'EOF'
APP_ENV_FILE=/opt/yonaris/.env
RESPONSE_SNAPSHOT_ENABLED=false
UNRELATED_SETTING=preserved
EOF
cat >"$REQUEST_FILE" <<'EOF'
{"schemaVersion":1,"operation":"enable-response-snapshot-storage","hostRoot":"/var/lib/yonaris/response-snapshots/v1","containerRoot":"/var/lib/yonaris/response-snapshots/v1","retentionDays":90,"warnUsedPercent":70,"stopUsedPercent":80,"outboxTtlHours":24}
EOF

cat >"$BIN_DIR/prepare-response-snapshot-storage.sh" <<'EOF'
#!/usr/bin/env bash
printf 'prepare:%s\n' "${RESPONSE_SNAPSHOT_HOST_ROOT:-}" >>"$MOCK_EVENT_LOG"
[[ "${MOCK_PREPARE_FAIL:-false}" != true ]]
EOF
cat >"$BIN_DIR/check-response-snapshot-storage.sh" <<'EOF'
#!/usr/bin/env bash
printf 'check:%s:%s\n' "${RESPONSE_SNAPSHOT_ENABLED:-}" "$*" >>"$MOCK_EVENT_LOG"
[[ "${MOCK_CHECK_FAIL:-false}" != true ]]
EOF
cat >"$MOCK_BIN/docker" <<'EOF'
#!/usr/bin/env bash
printf 'docker:%s\n' "$*" >>"$MOCK_EVENT_LOG"
count="$(grep -c '^docker:' "$MOCK_EVENT_LOG")"
if [[ "${MOCK_COMPOSE_FAIL:-false}" == true && "$count" == 1 ]]; then
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
cat >"$MOCK_BIN/python3" <<'EOF'
#!/usr/bin/env bash
cat >/dev/null
[[ "$1" == - && -f "$2" ]]
grep -Fq '"operation":"enable-response-snapshot-storage"' "$2"
EOF
chmod +x "$BIN_DIR"/*.sh "$MOCK_BIN"/*

run_activation() {
	env PATH="$MOCK_BIN:$PATH" MOCK_EVENT_LOG="$EVENT_LOG" DEPLOY_ROOT="$DEPLOY_ROOT" \
		COMPOSE_FILE="$COMPOSE_FILE" ENV_FILE="$ENV_FILE" RESPONSE_SNAPSHOT_HEALTH_ATTEMPTS=1 \
		MOCK_PREPARE_FAIL="${MOCK_PREPARE_FAIL:-false}" MOCK_CHECK_FAIL="${MOCK_CHECK_FAIL:-false}" \
		MOCK_COMPOSE_FAIL="${MOCK_COMPOSE_FAIL:-false}" MOCK_HEALTH_FAIL="${MOCK_HEALTH_FAIL:-false}" \
		bash "$BIN_DIR/activate-response-snapshot-storage.sh" "$RELEASE_TAG" "$REQUEST_FILE"
}

reset_fixture() {
	rm -rf -- "$DEPLOY_ROOT/response-snapshot-activation"
	cat >"$ENV_FILE" <<'EOF'
APP_ENV_FILE=/opt/yonaris/.env
RESPONSE_SNAPSHOT_ENABLED=false
UNRELATED_SETTING=preserved
EOF
	cp -p -- "$ENV_FILE" "$TEST_ROOT/original.env"
	: >"$EVENT_LOG"
}

assert_rolled_back() {
	local status="$1"
	[[ "$status" -ne 0 ]]
	cmp --silent "$TEST_ROOT/original.env" "$ENV_FILE"
	! find "$DEPLOY_ROOT" \( -name '.response-snapshot-env.*' -o -name '.response-snapshot-receipt.*' \) \
		-print -quit | grep -q .
	[[ "$(grep -c '^docker:' "$EVENT_LOG")" -ge 2 ]]
}

: >"$EVENT_LOG"
output="$(run_activation)"
grep -Fq 'Response snapshot storage activation completed.' <<<"$output"
grep -Fxq 'RESPONSE_SNAPSHOT_ENABLED=true' "$ENV_FILE"
grep -Fxq 'RESPONSE_SNAPSHOT_HOST_ROOT=/var/lib/yonaris/response-snapshots/v1' "$ENV_FILE"
grep -Fxq 'RESPONSE_SNAPSHOT_ROOT=/var/lib/yonaris/response-snapshots/v1' "$ENV_FILE"
grep -Fxq 'RESPONSE_SNAPSHOT_RETENTION_DAYS=90' "$ENV_FILE"
grep -Fxq 'RESPONSE_SNAPSHOT_WARN_USED_PERCENT=70' "$ENV_FILE"
grep -Fxq 'RESPONSE_SNAPSHOT_STOP_USED_PERCENT=80' "$ENV_FILE"
grep -Fxq 'RESPONSE_SNAPSHOT_OUTBOX_TTL_HOURS=24' "$ENV_FILE"
grep -Fxq 'UNRELATED_SETTING=preserved' "$ENV_FILE"
grep -Fq 'check:true:--round-trip' "$EVENT_LOG"

: >"$EVENT_LOG"
second_output="$(run_activation)"
grep -Fq 'already completed' <<<"$second_output"
! grep -q '^docker:' "$EVENT_LOG"
grep -Fq 'check:true:--round-trip' "$EVENT_LOG"

for failure in compose check health; do
	reset_fixture
	set +e
	case "$failure" in
		compose) MOCK_COMPOSE_FAIL=true run_activation >"$TEST_ROOT/$failure.out" 2>"$TEST_ROOT/$failure.err" ;;
		check) MOCK_CHECK_FAIL=true run_activation >"$TEST_ROOT/$failure.out" 2>"$TEST_ROOT/$failure.err" ;;
		health) MOCK_HEALTH_FAIL=true run_activation >"$TEST_ROOT/$failure.out" 2>"$TEST_ROOT/$failure.err" ;;
	esac
	status=$?
	set -e
	assert_rolled_back "$status"
done

echo 'response snapshot storage activation mock tests passed'
