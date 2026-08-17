#!/usr/bin/env bash

set -Eeuo pipefail
set +x
umask 077

operation_output=""
cleanup() {
	if [[ -n "$operation_output" ]]; then
		rm -f -- "$operation_output"
	fi
}
trap cleanup EXIT

if [[ $# -ne 2 ]]; then
	echo "Usage: $0 sha-<40-character-git-sha> <program-locale-repair-request.json>" >&2
	exit 2
fi

release_tag="$1"
request_file="$2"
if [[ ! "$release_tag" =~ ^sha-[0-9a-f]{40}$ ]]; then
	echo "Refusing invalid immutable release tag." >&2
	exit 2
fi

SCRIPT_DIR="$(cd -- "$(dirname -- "$0")" && pwd)"
SOURCE_ROOT="$(cd -- "$SCRIPT_DIR/../../.." && pwd)"
DEPLOY_ROOT="${DEPLOY_ROOT:-/opt/yonaris}"
COMPOSE_FILE="${COMPOSE_FILE:-$SOURCE_ROOT/deploy/las/compose.yaml}"
ENV_FILE="${ENV_FILE:-$DEPLOY_ROOT/.env}"
RELEASE_FILE="$DEPLOY_ROOT/.release"
REQUEST_DIR="$SOURCE_ROOT/deploy/las/program-locale-repairs/requests"
MANIFEST_PATH="apps/worker/src/program-locale-repair-requests/ppio-cn-zh-20260817.json"
MANIFEST_FILE="$SOURCE_ROOT/$MANIFEST_PATH"
REQUEST_ID="ppio-cn-zh-20260817"

for required_file in "$COMPOSE_FILE" "$ENV_FILE" "$RELEASE_FILE" "$MANIFEST_FILE" "$request_file"; do
	if [[ ! -f "$required_file" || ! -r "$required_file" || -L "$required_file" ]]; then
		echo "Missing readable Program locale repair prerequisite." >&2
		exit 1
	fi
done
if [[ "$(tr -d '[:space:]' <"$RELEASE_FILE")" != "$release_tag" ]]; then
	echo "Refusing Program locale repair before the immutable release is healthy." >&2
	exit 1
fi

request_root="$(realpath -e -- "$REQUEST_DIR")"
resolved_request="$(realpath -e -- "$request_file")"
if [[ "$(dirname -- "$resolved_request")" != "$request_root" ]]; then
	echo "Program locale repair request must be a direct checked-in file." >&2
	exit 1
fi

python3 - "$resolved_request" "$MANIFEST_FILE" "$MANIFEST_PATH" "$REQUEST_ID" <<'PY'
import json
import pathlib
import sys

request_path, manifest_path, expected_manifest_path, request_id = sys.argv[1:]
request = json.loads(pathlib.Path(request_path).read_text(encoding="utf-8"))
expected_request = {
    "schemaVersion": 1,
    "operation": "repair-program-locale",
    "requestId": request_id,
    "manifestPath": expected_manifest_path,
}
if request != expected_request:
    raise SystemExit("Program locale repair request does not match the fixed contract.")

manifest = json.loads(pathlib.Path(manifest_path).read_text(encoding="utf-8"))
expected_manifest = {
    "schemaVersion": 1,
    "requestId": request_id,
    "brand": {"nameExact": "PPIO", "websiteExact": "https://ppio.com/"},
    "customer": {"emailExact": "ppio@admin.com", "roleExact": "owner"},
    "program": {
        "nameExact": "China Market",
        "marketExact": "CN",
        "localeFrom": "zn-CN",
        "localeTo": "zh-CN",
        "timezoneExact": "Asia/Shanghai",
        "evaluationRoleExact": "scored",
        "manualOnlyExact": True,
        "enabledExact": True,
    },
}
for key, value in expected_manifest.items():
    if manifest.get(key) != value:
        raise SystemExit("Program locale repair manifest does not match the fixed contract.")
prompts = manifest.get("prompts", {}).get("enabledTextsExact")
if not isinstance(prompts, list) or len(prompts) != 10 or len(set(prompts)) != 10:
    raise SystemExit("Program locale repair manifest must contain exactly 10 unique prompts.")
PY

exec 8>"$DEPLOY_ROOT/.program-locale-repair.lock"
if ! flock -n 8; then
	echo "Another Program locale repair is already running." >&2
	exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a
container_manifest="./src/program-locale-repair-requests/$(basename -- "$MANIFEST_PATH")"

run_mode() {
	local mode="$1"
	local command_status
	operation_output="$(mktemp)"
	set +e
	if [[ "$mode" == "dry-run" ]]; then
		IMAGE_TAG="$release_tag" docker compose --project-name yonaris --env-file "$ENV_FILE" --file "$COMPOSE_FILE" \
			--profile operations run --rm --no-deps -T account-ops \
			node ./node_modules/tsx/dist/cli.mjs ./src/repair-program-locale.ts \
			--request-file "$container_manifest" >"$operation_output" 2>&1
	else
		IMAGE_TAG="$release_tag" docker compose --project-name yonaris --env-file "$ENV_FILE" --file "$COMPOSE_FILE" \
			--profile operations run --rm --no-deps -T account-ops \
			node ./node_modules/tsx/dist/cli.mjs ./src/repair-program-locale.ts \
			--request-file "$container_manifest" "--$mode" >"$operation_output" 2>&1
	fi
	command_status=$?
	set -e
	python3 - "$mode" "$command_status" "$operation_output" "$REQUEST_ID" <<'PY'
import json
import pathlib
import sys

mode, status, output_path, request_id = sys.argv[1:]
lines = pathlib.Path(output_path).read_text(encoding="utf-8").splitlines()
json_lines = [line for line in lines if line.lstrip().startswith("{") and line.rstrip().endswith("}")]
if not json_lines:
    raise SystemExit("Program locale repair returned unexpected output; raw output was withheld.")
payload = json.loads(json_lines[-1])
if int(status) != 0:
    code = payload.get("code")
    if isinstance(code, str) and code.replace("_", "").isalnum() and len(code) <= 80:
        raise SystemExit(f"Program locale repair failed: code={code}")
    raise SystemExit("Program locale repair failed; raw output was withheld.")
if payload.get("ok") is not True or payload.get("requestId") != request_id:
    raise SystemExit("Program locale repair returned an unexpected identity.")
if payload.get("locale") != "zh-CN" or payload.get("promptCount") != 10 or payload.get("historyCount") != 0:
    raise SystemExit("Program locale repair returned incomplete verification.")
action = payload.get("action")
if mode == "status-only":
    if action not in {"repair_required", "unchanged"}:
        raise SystemExit("Program locale status-only returned an unexpected action.")
    print(f"program locale status: action={action} locale=zh-CN prompts=10")
elif mode == "dry-run":
    if action not in {"would_repair", "unchanged"}:
        raise SystemExit("Program locale dry-run returned an unexpected action.")
    print(f"program locale dry-run: action={action} locale=zh-CN prompts=10")
else:
    if action not in {"repaired", "unchanged"}:
        raise SystemExit("Program locale apply returned an unexpected action.")
    print(f"program locale apply: action={action} locale=zh-CN prompts=10")
PY
	rm -f -- "$operation_output"
	operation_output=""
}

run_mode "status-only"
run_mode "dry-run"
run_mode "apply"
