#!/usr/bin/env bash

set -Eeuo pipefail
set +x
umask 077

if [[ $# -ne 2 ]]; then
	echo "Usage: $0 sha-<40-character-git-sha> <activation-request.json>" >&2
	exit 2
fi

release_tag="$1"
request_file="$2"
if [[ ! "$release_tag" =~ ^sha-[0-9a-f]{40}$ ]]; then
	echo "Refusing invalid immutable release tag." >&2
	exit 2
fi
if [[ -L "$request_file" || ! -f "$request_file" || ! -r "$request_file" ]]; then
	echo "Activation request must be a readable regular file." >&2
	exit 1
fi

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
SOURCE_ROOT="$(cd -- "$SCRIPT_DIR/../../.." && pwd)"
DEPLOY_ROOT="${DEPLOY_ROOT:-/opt/yonaris}"
COMPOSE_FILE="${COMPOSE_FILE:-$SOURCE_ROOT/deploy/las/compose.yaml}"
ENV_FILE="${ENV_FILE:-$DEPLOY_ROOT/.env}"
RELEASE_FILE="$DEPLOY_ROOT/.release"
RECEIPT_DIR="$DEPLOY_ROOT/response-snapshot-activation"
WEB_PORT="${WEB_PORT:-1515}"
HEALTH_ATTEMPTS="${RESPONSE_SNAPSHOT_HEALTH_ATTEMPTS:-45}"
FIXED_HOST_ROOT="/var/lib/yonaris/response-snapshots/v1"
FIXED_CONTAINER_ROOT="/var/lib/yonaris/response-snapshots/v1"
rollback_armed=false
rollback_in_progress=false
backup_file=''
candidate_file=''
receipt_candidate_file=''
receipt_file=''
receipt_committed=false
compose=()

activation_fail_safe() {
	local failure_status="$1"
	if [[ "$rollback_in_progress" == true ]]; then
		return "$failure_status"
	fi
	rollback_in_progress=true
	trap - ERR
	if [[ "$rollback_armed" == true ]]; then
		rollback_armed=false
		if [[ -n "$backup_file" && -f "$backup_file" ]]; then
			cp -p -- "$backup_file" "$ENV_FILE" >/dev/null 2>&1 || true
		fi
		if [[ ${#compose[@]} -gt 0 ]]; then
			IMAGE_TAG="$release_tag" "${compose[@]}" up -d --no-deps web worker >/dev/null 2>&1 || true
		fi
		if [[ "$receipt_committed" == true && -n "$receipt_file" ]]; then
			rm -f -- "$receipt_file" >/dev/null 2>&1 || true
		fi
	fi
	for temporary_file in "$candidate_file" "$receipt_candidate_file" "$backup_file"; do
		if [[ -n "$temporary_file" ]]; then
			rm -f -- "$temporary_file" >/dev/null 2>&1 || true
		fi
	done
	return "$failure_status"
}

trap 'failure_status=$?; activation_fail_safe "$failure_status"; exit "$failure_status"' ERR
trap 'failure_status=$?; activation_fail_safe "$failure_status"' EXIT

if [[ ! "$HEALTH_ATTEMPTS" =~ ^[1-9][0-9]*$ ]] || (( HEALTH_ATTEMPTS > 45 )); then
	echo "Response snapshot health attempts must be between 1 and 45." >&2
	exit 1
fi
for required_file in "$COMPOSE_FILE" "$ENV_FILE" "$RELEASE_FILE" \
	"$SCRIPT_DIR/prepare-response-snapshot-storage.sh" "$SCRIPT_DIR/check-response-snapshot-storage.sh"; do
	if [[ ! -f "$required_file" || ! -r "$required_file" ]]; then
		echo "Missing readable response snapshot activation prerequisite." >&2
		exit 1
	fi
done
if [[ "$(tr -d '[:space:]' <"$RELEASE_FILE")" != "$release_tag" ]]; then
	echo "Refusing response snapshot activation before the requested release is healthy." >&2
	exit 1
fi

mkdir -p -- "$RECEIPT_DIR"
chmod 700 -- "$RECEIPT_DIR"
exec 7>"$DEPLOY_ROOT/.response-snapshot-activation.lock"
if ! flock -n 7; then
	echo "Another response snapshot activation is running." >&2
	exit 1
fi

request_name="$(basename -- "$request_file")"
if [[ ! "$request_name" =~ ^[a-z0-9][a-z0-9._-]{0,95}\.json$ ]]; then
	echo "Refusing invalid response snapshot activation request filename." >&2
	exit 1
fi
request_hash="$(sha256sum -- "$request_file" | awk '{print $1}')"
if [[ ! "$request_hash" =~ ^[0-9a-f]{64}$ ]]; then
	echo "Could not calculate response snapshot activation request digest." >&2
	exit 1
fi

python3 - "$request_file" <<'PY'
import json, pathlib, sys

try:
    request = json.loads(pathlib.Path(sys.argv[1]).read_text(encoding="utf-8"))
except Exception as exc:
    raise SystemExit(f"Invalid response snapshot activation request: {exc}")
expected = {
    "schemaVersion": 1,
    "operation": "enable-response-snapshot-storage",
    "hostRoot": "/var/lib/yonaris/response-snapshots/v1",
    "containerRoot": "/var/lib/yonaris/response-snapshots/v1",
    "retentionDays": 90,
    "warnUsedPercent": 70,
    "stopUsedPercent": 80,
    "outboxTtlHours": 24,
}
if request != expected:
    raise SystemExit("Response snapshot activation request does not match the approved fixed contract.")
PY

receipt_file="$RECEIPT_DIR/${request_name%.json}.completed"
if [[ -f "$receipt_file" ]]; then
	if [[ "$(tr -d '[:space:]' <"$receipt_file")" != "$request_hash" ]]; then
		echo "Response snapshot activation receipt content differs; refusing replay." >&2
		exit 1
	fi
	for setting in \
		'RESPONSE_SNAPSHOT_ENABLED=true' \
		"RESPONSE_SNAPSHOT_HOST_ROOT=$FIXED_HOST_ROOT" \
		"RESPONSE_SNAPSHOT_ROOT=$FIXED_CONTAINER_ROOT" \
		'RESPONSE_SNAPSHOT_RETENTION_DAYS=90' \
		'RESPONSE_SNAPSHOT_WARN_USED_PERCENT=70' \
		'RESPONSE_SNAPSHOT_STOP_USED_PERCENT=80' \
		'RESPONSE_SNAPSHOT_OUTBOX_TTL_HOURS=24'; do
		grep -Fxq "$setting" "$ENV_FILE" || {
			echo "Response snapshot activation receipt exists but runtime state is not ready." >&2
			exit 1
		}
	done
	env \
		RESPONSE_SNAPSHOT_ENABLED=true \
		RESPONSE_SNAPSHOT_HOST_ROOT="$FIXED_HOST_ROOT" \
		RESPONSE_SNAPSHOT_ROOT="$FIXED_CONTAINER_ROOT" \
		DEPLOY_ROOT="$DEPLOY_ROOT" COMPOSE_FILE="$COMPOSE_FILE" ENV_FILE="$ENV_FILE" IMAGE_TAG="$release_tag" \
		bash "$SCRIPT_DIR/check-response-snapshot-storage.sh" --round-trip >/dev/null
	echo "Response snapshot storage activation already completed."
	exit 0
fi

compose=(docker compose --project-name yonaris --env-file "$ENV_FILE" --file "$COMPOSE_FILE")
if [[ "$(id -u)" == 0 ]]; then
	env RESPONSE_SNAPSHOT_HOST_ROOT="$FIXED_HOST_ROOT" \
		bash "$SCRIPT_DIR/prepare-response-snapshot-storage.sh" >/dev/null
else
	RESPONSE_SNAPSHOT_HOST_ROOT="$FIXED_HOST_ROOT" \
		RESPONSE_SNAPSHOT_ROOT="$FIXED_CONTAINER_ROOT" \
		IMAGE_TAG="$release_tag" "${compose[@]}" run --rm --no-deps -T --user 0:0 --entrypoint sh worker -ceu '
		storage_root=/var/lib/yonaris/response-snapshots/v1
		test ! -L "$storage_root"
		if test -e "$storage_root" && ! test -d "$storage_root"; then exit 1; fi
		install -d -o 1001 -g 1001 -m 0750 -- "$storage_root"
		test "$(stat -c %u:%g -- "$storage_root")" = 1001:1001
		test "$(stat -c %a -- "$storage_root")" = 750
	' >/dev/null
	env RESPONSE_SNAPSHOT_HOST_ROOT="$FIXED_HOST_ROOT" \
		bash "$SCRIPT_DIR/prepare-response-snapshot-storage.sh" --verify-only >/dev/null
fi

backup_file="$(mktemp --tmpdir="$(dirname -- "$ENV_FILE")" '.response-snapshot-env.backup.XXXXXX')"
candidate_file="$(mktemp --tmpdir="$(dirname -- "$ENV_FILE")" '.response-snapshot-env.candidate.XXXXXX')"
cp -p -- "$ENV_FILE" "$backup_file"
managed_keys='^(RESPONSE_SNAPSHOT_ENABLED|RESPONSE_SNAPSHOT_HOST_ROOT|RESPONSE_SNAPSHOT_ROOT|RESPONSE_SNAPSHOT_RETENTION_DAYS|RESPONSE_SNAPSHOT_WARN_USED_PERCENT|RESPONSE_SNAPSHOT_STOP_USED_PERCENT|RESPONSE_SNAPSHOT_OUTBOX_TTL_HOURS)='
awk -v pattern="$managed_keys" '$0 !~ pattern { print }' "$ENV_FILE" >"$candidate_file"
cat >>"$candidate_file" <<EOF
RESPONSE_SNAPSHOT_ENABLED=true
RESPONSE_SNAPSHOT_HOST_ROOT=$FIXED_HOST_ROOT
RESPONSE_SNAPSHOT_ROOT=$FIXED_CONTAINER_ROOT
RESPONSE_SNAPSHOT_RETENTION_DAYS=90
RESPONSE_SNAPSHOT_WARN_USED_PERCENT=70
RESPONSE_SNAPSHOT_STOP_USED_PERCENT=80
RESPONSE_SNAPSHOT_OUTBOX_TTL_HOURS=24
EOF
chmod --reference="$ENV_FILE" "$candidate_file"
chown --reference="$ENV_FILE" "$candidate_file"
mv -f -- "$candidate_file" "$ENV_FILE"
candidate_file=''
rollback_armed=true

IMAGE_TAG="$release_tag" "${compose[@]}" up -d --no-deps web worker >/dev/null
env \
	RESPONSE_SNAPSHOT_ENABLED=true \
	RESPONSE_SNAPSHOT_HOST_ROOT="$FIXED_HOST_ROOT" \
	RESPONSE_SNAPSHOT_ROOT="$FIXED_CONTAINER_ROOT" \
	DEPLOY_ROOT="$DEPLOY_ROOT" COMPOSE_FILE="$COMPOSE_FILE" ENV_FILE="$ENV_FILE" IMAGE_TAG="$release_tag" \
	bash "$SCRIPT_DIR/check-response-snapshot-storage.sh" --round-trip >/dev/null

web_ready=false
for _ in $(seq 1 "$HEALTH_ATTEMPTS"); do
	if curl --fail --silent --show-error --max-time 5 "http://127.0.0.1:${WEB_PORT}/" >/dev/null 2>&1; then
		web_ready=true
		break
	fi
	sleep 2
done
if [[ "$web_ready" != true ]]; then
	echo "Response snapshot activation health check failed; invoking fail-safe rollback." >&2
	exit 1
fi

if [[ -e "$receipt_file" || -L "$receipt_file" ]]; then
	echo "Response snapshot activation receipt path appeared concurrently; refusing ambiguous completion." >&2
	exit 1
fi
receipt_candidate_file="$(mktemp --tmpdir="$RECEIPT_DIR" '.response-snapshot-receipt.XXXXXX')"
printf '%s\n' "$request_hash" >"$receipt_candidate_file"
chmod 600 -- "$receipt_candidate_file"
sync -f -- "$receipt_candidate_file"
mv -- "$receipt_candidate_file" "$receipt_file"
receipt_candidate_file=''
receipt_committed=true
sync -f -- "$RECEIPT_DIR"
rm -f -- "$backup_file"
backup_file=''
rollback_armed=false
trap - ERR EXIT
echo "Response snapshot storage activation completed."
