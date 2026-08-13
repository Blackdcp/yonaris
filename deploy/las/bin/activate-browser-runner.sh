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
RECEIPT_DIR="$DEPLOY_ROOT/browser-runner-activation"
WEB_PORT="${WEB_PORT:-1515}"
HEALTH_ATTEMPTS="${BROWSER_RUNNER_HEALTH_ATTEMPTS:-45}"
EXPECTED_RUNNER_ID="yonaris-cn-doubao-01"
EXPECTED_FINGERPRINT="fbee6383aa7952fc55c5da059ecf59ee8e469644781a34ecf40c4a408ec5b75c"
rollback_armed=false
rollback_in_progress=false
backup_file=''
candidate_file=''
receipt_candidate_file=''
receipt_committed=false
receipt_file=''
token=''
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
			IMAGE_TAG="$release_tag" "${compose[@]}" up -d --no-deps web >/dev/null 2>&1 || true
		fi
		if [[ "$receipt_committed" == true && -n "$receipt_file" ]]; then
			rm -f -- "$receipt_file" >/dev/null 2>&1 || true
		fi
	fi
	for sensitive_file in "$candidate_file" "$receipt_candidate_file" "$backup_file"; do
		if [[ -n "$sensitive_file" ]]; then
			rm -f -- "$sensitive_file" >/dev/null 2>&1 || true
		fi
	done
	token=''
	return "$failure_status"
}

trap 'failure_status=$?; activation_fail_safe "$failure_status"; exit "$failure_status"' ERR
trap 'failure_status=$?; activation_fail_safe "$failure_status"' EXIT

if [[ ! "$HEALTH_ATTEMPTS" =~ ^[1-9][0-9]*$ ]] || (( HEALTH_ATTEMPTS > 45 )); then
	echo "Browser Runner health attempts must be between 1 and 45." >&2
	exit 1
fi
for required_file in "$COMPOSE_FILE" "$ENV_FILE" "$RELEASE_FILE"; do
	if [[ ! -f "$required_file" || ! -r "$required_file" ]]; then
		echo "Missing readable Browser Runner activation prerequisite." >&2
		exit 1
	fi
done
if [[ "$(tr -d '[:space:]' <"$RELEASE_FILE")" != "$release_tag" ]]; then
	echo "Refusing Browser Runner activation before the requested release is healthy." >&2
	exit 1
fi

mkdir -p -- "$RECEIPT_DIR"
chmod 700 -- "$RECEIPT_DIR"
exec 7>"$DEPLOY_ROOT/.browser-runner-activation.lock"
if ! flock -n 7; then
	echo "Another Browser Runner activation is running." >&2
	exit 1
fi

request_name="$(basename -- "$request_file")"
if [[ ! "$request_name" =~ ^[a-z0-9][a-z0-9._-]{0,95}\.json$ ]]; then
	echo "Refusing invalid Browser Runner activation request filename." >&2
	exit 1
fi
request_hash="$(sha256sum -- "$request_file" | awk '{print $1}')"
if [[ ! "$request_hash" =~ ^[0-9a-f]{64}$ ]]; then
	echo "Could not calculate Browser Runner activation request digest." >&2
	exit 1
fi

ttl_seconds="$(python3 - "$request_file" "$EXPECTED_RUNNER_ID" "$EXPECTED_FINGERPRINT" <<'PY'
import json, pathlib, sys

path, runner_id, fingerprint = sys.argv[1:]
try:
    request = json.loads(pathlib.Path(path).read_text(encoding="utf-8"))
except Exception as exc:
    raise SystemExit(f"Invalid Browser Runner activation request: {exc}")
expected = {
    "schemaVersion": 1,
    "operation": "enable-browser-runner",
    "runnerId": runner_id,
    "market": "CN",
    "locale": "zh-CN",
    "timezone": "Asia/Shanghai",
    "bootstrapTtlSeconds": 1800,
    "recipientKeyFingerprint": fingerprint,
}
if request != expected:
    raise SystemExit("Browser Runner activation request does not match the approved fixed contract.")
print(request["bootstrapTtlSeconds"])
PY
)"
if [[ "$ttl_seconds" != 1800 ]]; then
	echo "Browser Runner activation request returned an invalid bootstrap TTL." >&2
	exit 1
fi

receipt_file="$RECEIPT_DIR/${request_name%.json}.completed"
if [[ -f "$receipt_file" ]]; then
	if [[ "$(tr -d '[:space:]' <"$receipt_file")" != "$request_hash" ]]; then
		echo "Browser Runner activation receipt content differs; refusing replay." >&2
		exit 1
	fi
	if grep -Fxq 'BROWSER_RUNNER_ENABLED=true' "$ENV_FILE" && \
		grep -Fxq "BROWSER_RUNNER_ID=$EXPECTED_RUNNER_ID" "$ENV_FILE" && \
		grep -Eq '^BROWSER_RUNNER_API_TOKEN=[0-9a-f]{64}$' "$ENV_FILE"; then
		echo "Browser Runner activation already completed."
		exit 0
	fi
	echo "Browser Runner activation receipt exists but runtime state is not ready." >&2
	exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

token="$(openssl rand -hex 32)"
if [[ ! "$token" =~ ^[0-9a-f]{64}$ ]]; then
	echo "OpenSSL did not return a valid Browser Runner credential." >&2
	exit 1
fi
IFS=',' read -r -a admin_keys <<<"${ADMIN_API_KEYS:-}"
for admin_key in "${admin_keys[@]}"; do
	if [[ "${admin_key//[[:space:]]/}" == "$token" ]]; then
		echo "Generated Browser Runner credential collides with an administrator credential." >&2
		exit 1
	fi
done

expires_epoch="$(( $(date -u +%s) + ttl_seconds ))"
expires_at="$(date -u -d "@$expires_epoch" '+%Y-%m-%dT%H:%M:%S.000Z')"
backup_file="$(mktemp --tmpdir="$(dirname -- "$ENV_FILE")" '.browser-runner-env.backup.XXXXXX')"
candidate_file="$(mktemp --tmpdir="$(dirname -- "$ENV_FILE")" '.browser-runner-env.candidate.XXXXXX')"
cp -p -- "$ENV_FILE" "$backup_file"

managed_keys='^(BROWSER_RUNNER_ENABLED|BROWSER_RUNNER_API_TOKEN|BROWSER_RUNNER_ID|BROWSER_RUNNER_MARKET|BROWSER_RUNNER_LOCALE|BROWSER_RUNNER_TIMEZONE|BROWSER_RUNNER_BOOTSTRAP_EXPIRES_AT)='
awk -v pattern="$managed_keys" '$0 !~ pattern { print }' "$ENV_FILE" >"$candidate_file"
cat >>"$candidate_file" <<EOF
BROWSER_RUNNER_ENABLED=true
BROWSER_RUNNER_API_TOKEN=$token
BROWSER_RUNNER_ID=$EXPECTED_RUNNER_ID
BROWSER_RUNNER_MARKET=CN
BROWSER_RUNNER_LOCALE=zh-CN
BROWSER_RUNNER_TIMEZONE=Asia/Shanghai
BROWSER_RUNNER_BOOTSTRAP_EXPIRES_AT=$expires_at
EOF
chmod --reference="$ENV_FILE" "$candidate_file"
chown --reference="$ENV_FILE" "$candidate_file"
compose=(docker compose --project-name yonaris --env-file "$ENV_FILE" --file "$COMPOSE_FILE")
mv -f -- "$candidate_file" "$ENV_FILE"
candidate_file=''
rollback_armed=true

IMAGE_TAG="$release_tag" "${compose[@]}" up -d --no-deps web >/dev/null

web_ready=false
for _ in $(seq 1 "$HEALTH_ATTEMPTS"); do
	if curl --fail --silent --show-error --max-time 5 "http://127.0.0.1:${WEB_PORT}/" >/dev/null 2>&1; then
		web_ready=true
		break
	fi
	sleep 2
done
if [[ "$web_ready" != true ]]; then
	echo "Browser Runner activation health check failed; invoking fail-safe rollback." >&2
	exit 1
fi

if [[ -e "$receipt_file" || -L "$receipt_file" ]]; then
	echo "Browser Runner activation receipt path appeared concurrently; refusing ambiguous completion." >&2
	exit 1
fi
receipt_candidate_file="$(mktemp --tmpdir="$RECEIPT_DIR" '.browser-runner-receipt.XXXXXX')"
printf '%s\n' "$request_hash" >"$receipt_candidate_file"
chmod 600 -- "$receipt_candidate_file"
sync -f -- "$receipt_candidate_file"
mv -- "$receipt_candidate_file" "$receipt_file"
receipt_candidate_file=''
receipt_committed=true
sync -f -- "$RECEIPT_DIR"
rm -f -- "$backup_file"
backup_file=''
token=''
rollback_armed=false
trap - ERR EXIT
echo "Browser Runner activation completed."
