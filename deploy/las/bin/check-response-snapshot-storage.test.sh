#!/usr/bin/env bash

set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT_UNDER_TEST="$SCRIPT_DIR/check-response-snapshot-storage.sh"
COMPOSE_FILE="$SCRIPT_DIR/../compose.yaml"
TEST_ROOT="$(mktemp -d)"
trap 'rm -rf -- "$TEST_ROOT"' EXIT

MOCK_BIN="$TEST_ROOT/bin"
SNAPSHOT_ROOT="$TEST_ROOT/snapshots"
ENV_FILE="$TEST_ROOT/.env"
DOCKER_LOG="$TEST_ROOT/docker.log"
mkdir -p "$MOCK_BIN" "$SNAPSHOT_ROOT"

cat >"$MOCK_BIN/stat" <<'EOF'
#!/usr/bin/env bash
case "$2" in
	%u:%g) printf '1001:1001\n' ;;
	%a) printf '750\n' ;;
	*) exec /usr/bin/stat "$@" ;;
esac
EOF

cat >"$MOCK_BIN/df" <<'EOF'
#!/usr/bin/env bash
printf 'Filesystem 1024-blocks Used Available Capacity Mounted on\n'
printf '/dev/mock 100000 20000 80000 %s%% /mock\n' "${MOCK_USED_PERCENT:-20}"
EOF

cat >"$MOCK_BIN/docker" <<'EOF'
#!/usr/bin/env bash
set -Eeuo pipefail
printf '<IMAGE_TAG=%s>' "${IMAGE_TAG:-}" >>"$MOCK_DOCKER_LOG"
printf '<%s>' "$@" >>"$MOCK_DOCKER_LOG"
printf '\n' >>"$MOCK_DOCKER_LOG"
if [[ " $* " == *" run "* ]]; then
	exit 0
fi
exit 91
EOF

chmod +x "$MOCK_BIN/stat" "$MOCK_BIN/df" "$MOCK_BIN/docker"

write_env() {
	cat >"$ENV_FILE" <<EOF
RESPONSE_SNAPSHOT_ENABLED=$1
RESPONSE_SNAPSHOT_HOST_ROOT=$SNAPSHOT_ROOT
RESPONSE_SNAPSHOT_ROOT=/var/lib/yonaris/response-snapshots/v1
RESPONSE_SNAPSHOT_RETENTION_DAYS=90
RESPONSE_SNAPSHOT_WARN_USED_PERCENT=70
RESPONSE_SNAPSHOT_STOP_USED_PERCENT=80
RESPONSE_SNAPSHOT_OUTBOX_TTL_HOURS=24
IMAGE_TAG=sha-stale-release
EOF
}

write_env false
: >"$DOCKER_LOG"
disabled="$(env PATH="$MOCK_BIN:$PATH" MOCK_DOCKER_LOG="$DOCKER_LOG" ENV_FILE="$ENV_FILE" COMPOSE_FILE="$COMPOSE_FILE" bash "$SCRIPT_UNDER_TEST")"
grep -Fqx 'response_snapshot_storage.status=disabled' <<<"$disabled"
test ! -s "$DOCKER_LOG"

write_env true
: >"$DOCKER_LOG"
ready="$(env PATH="$MOCK_BIN:$PATH" MOCK_DOCKER_LOG="$DOCKER_LOG" ENV_FILE="$ENV_FILE" COMPOSE_FILE="$COMPOSE_FILE" bash "$SCRIPT_UNDER_TEST")"
grep -Fqx 'response_snapshot_storage.status=OK' <<<"$ready"
grep -Fqx 'response_snapshot_storage.used_percent=20' <<<"$ready"
test ! -s "$DOCKER_LOG"

: >"$DOCKER_LOG"
round_trip="$(env PATH="$MOCK_BIN:$PATH" MOCK_DOCKER_LOG="$DOCKER_LOG" IMAGE_TAG=sha-requested-release ENV_FILE="$ENV_FILE" COMPOSE_FILE="$COMPOSE_FILE" bash "$SCRIPT_UNDER_TEST" --round-trip)"
grep -Fqx 'response_snapshot_storage.round_trip=verified' <<<"$round_trip"
grep -Fq '<IMAGE_TAG=sha-requested-release>' "$DOCKER_LOG"
! grep -Fq '<IMAGE_TAG=sha-stale-release>' "$DOCKER_LOG"
grep -Fq '<web>' "$DOCKER_LOG"
grep -Fq '<worker>' "$DOCKER_LOG"

set +e
env PATH="$MOCK_BIN:$PATH" MOCK_DOCKER_LOG="$DOCKER_LOG" MOCK_USED_PERCENT=80 ENV_FILE="$ENV_FILE" COMPOSE_FILE="$COMPOSE_FILE" \
	bash "$SCRIPT_UNDER_TEST" >"$TEST_ROOT/full.out" 2>"$TEST_ROOT/full.err"
full_status=$?
set -e
if [[ "$full_status" -eq 0 ]]; then
	echo "80 percent capacity was accepted." >&2
	exit 1
fi

sed -i 's/RESPONSE_SNAPSHOT_RETENTION_DAYS=90/RESPONSE_SNAPSHOT_RETENTION_DAYS=91/' "$ENV_FILE"
set +e
env PATH="$MOCK_BIN:$PATH" MOCK_DOCKER_LOG="$DOCKER_LOG" ENV_FILE="$ENV_FILE" COMPOSE_FILE="$COMPOSE_FILE" \
	bash "$SCRIPT_UNDER_TEST" >"$TEST_ROOT/config.out" 2>"$TEST_ROOT/config.err"
config_status=$?
set -e
if [[ "$config_status" -eq 0 ]]; then
	echo "Mutable v1 retention was accepted." >&2
	exit 1
fi

web_mounts="$(awk '/^  web:/{in_web=1} /^  worker:/{in_web=0} in_web{print}' "$COMPOSE_FILE")"
worker_mounts="$(awk '/^  worker:/{in_worker=1} in_worker{print}' "$COMPOSE_FILE")"
for mounts in "$web_mounts" "$worker_mounts"; do
	grep -Fq '${RESPONSE_SNAPSHOT_HOST_ROOT:-/var/lib/yonaris/response-snapshots/v1}:${RESPONSE_SNAPSHOT_ROOT:-/var/lib/yonaris/response-snapshots/v1}' <<<"$mounts"
done

echo "check response snapshot storage tests passed"
