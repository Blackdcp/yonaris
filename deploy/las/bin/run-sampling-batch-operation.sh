#!/usr/bin/env bash

set -Eeuo pipefail
# Sampling batch operations use the production Compose environment. Never let
# inherited tracing disclose credentials, prompt text, or container output.
set +x
umask 077
operation_output_file=""

cleanup_operation_output() {
	if [[ -n "$operation_output_file" ]]; then
		rm -f -- "$operation_output_file"
	fi
}
trap cleanup_operation_output EXIT

if [[ $# -ne 2 ]]; then
	echo "Usage: $0 sha-<40-character-git-sha> <sampling-batch-request.json>" >&2
	exit 2
fi

release_tag="$1"
request_file="$2"
if [[ ! "$release_tag" =~ ^sha-[0-9a-f]{40}$ ]]; then
	echo "Refusing invalid immutable release tag." >&2
	exit 2
fi

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
SOURCE_ROOT="$(cd -- "$SCRIPT_DIR/../../.." && pwd)"
DEPLOY_ROOT="${DEPLOY_ROOT:-/opt/yonaris}"
COMPOSE_FILE="${COMPOSE_FILE:-$SOURCE_ROOT/deploy/las/compose.yaml}"
ENV_FILE="${ENV_FILE:-$DEPLOY_ROOT/.env}"
RELEASE_FILE="$DEPLOY_ROOT/.release"
REQUEST_DIR="$SOURCE_ROOT/deploy/las/sampling-batch-operations/requests"
MANIFEST_PATH="apps/worker/src/sampling-batch-requests/stepfun-cn-doubao-6x-20260813.json"
MANIFEST_FILE="$SOURCE_ROOT/$MANIFEST_PATH"
REQUEST_ID="stepfun-cn-doubao-6x-20260813"
IDEMPOTENCY_KEY="sampling:stepfun:cn-zh-scored:doubao:6x:2026-08-13"

if [[ -L "$request_file" || ! -f "$request_file" || ! -r "$request_file" ]]; then
	echo "Sampling batch request must be a readable regular file." >&2
	exit 1
fi
if [[ ! -f "$MANIFEST_FILE" || ! -r "$MANIFEST_FILE" ]]; then
	echo "The fixed sampling batch manifest is not readable in this immutable release." >&2
	exit 1
fi
for required_file in "$COMPOSE_FILE" "$ENV_FILE" "$RELEASE_FILE"; do
	if [[ ! -f "$required_file" || ! -r "$required_file" ]]; then
		echo "Missing readable sampling batch operation prerequisite." >&2
		exit 1
	fi
done
if [[ "$(tr -d '[:space:]' <"$RELEASE_FILE")" != "$release_tag" ]]; then
	echo "Refusing sampling batch operation before the requested immutable release is healthy." >&2
	exit 1
fi

request_root="$(realpath -e -- "$REQUEST_DIR")"
resolved_request="$(realpath -e -- "$request_file")"
if [[ "$(dirname -- "$resolved_request")" != "$request_root" ]]; then
	echo "Sampling batch request must be a direct checked-in file in the approved request directory." >&2
	exit 1
fi
request_name="$(basename -- "$resolved_request")"
if [[ ! "$request_name" =~ ^[a-z0-9][a-z0-9._-]{0,95}\.json$ ]]; then
	echo "Refusing invalid sampling batch request filename." >&2
	exit 1
fi

python3 - "$resolved_request" "$REQUEST_ID" "$MANIFEST_PATH" <<'PY'
import json
import pathlib
import sys

path, request_id, manifest_path = sys.argv[1:]
try:
    request = json.loads(pathlib.Path(path).read_text(encoding="utf-8"))
except Exception as exc:
    raise SystemExit(f"Invalid sampling batch request: {exc}")
expected = {
    "schemaVersion": 1,
    "operation": "run-sampling-batch",
    "requestId": request_id,
    "manifestPath": manifest_path,
}
if request != expected:
    raise SystemExit("Sampling batch request does not match the approved fixed contract.")
PY

exec 8>"$DEPLOY_ROOT/.sampling-batch-ops.lock"
if ! flock -n 8; then
	echo "Another Yonaris sampling batch operation is already running." >&2
	exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a
compose=(docker compose --project-name yonaris --env-file "$ENV_FILE" --file "$COMPOSE_FILE")
container_manifest="./src/sampling-batch-requests/$(basename -- "$MANIFEST_PATH")"

run_mode() {
	local mode="$1"
	local output_file
	local command_status
	output_file="$(mktemp)"
	operation_output_file="$output_file"
	set +e
	if [[ "$mode" == "dry-run" ]]; then
		IMAGE_TAG="$release_tag" "${compose[@]}" --profile operations run --rm --no-deps -T \
			account-ops node ./node_modules/tsx/dist/cli.mjs ./src/run-sampling-batch.ts \
			--request-file "$container_manifest" >"$output_file" 2>&1
	else
		IMAGE_TAG="$release_tag" "${compose[@]}" --profile operations run --rm --no-deps -T \
			account-ops node ./node_modules/tsx/dist/cli.mjs ./src/run-sampling-batch.ts \
			--request-file "$container_manifest" "--$mode" >"$output_file" 2>&1
	fi
	command_status=$?
	set -e
	python3 - "$mode" "$command_status" "$output_file" "$REQUEST_ID" "$IDEMPOTENCY_KEY" <<'PY'
import json
import pathlib
import sys

mode, command_status, output_path, request_id, idempotency_key = sys.argv[1:]
try:
    command_status = int(command_status)
    lines = pathlib.Path(output_path).read_text(encoding="utf-8").splitlines()
    json_lines = [line for line in lines if line.lstrip().startswith("{") and line.rstrip().endswith("}")]
    if not json_lines:
        raise ValueError("missing json output")
    payload = json.loads(json_lines[-1])
    if not isinstance(payload, dict):
        raise ValueError("non-object output")
except Exception:
    raise SystemExit("Sampling batch account operation returned unexpected output; raw output was withheld.")

if mode == "status-only" and command_status != 0:
    if payload == {
        "ok": False,
        "code": "batch_not_found",
        "message": "The fixed batch is absent; status-only mode will not create it",
    }:
        print("sampling batch status: absent")
        raise SystemExit(0)
    raise SystemExit("Sampling batch status check failed; raw output was withheld.")

if command_status != 0 or payload.get("ok") is not True:
    raise SystemExit("Sampling batch account operation failed; raw output was withheld.")
if payload.get("requestId") != request_id or payload.get("idempotencyKey") != idempotency_key:
    raise SystemExit("Sampling batch account operation returned an unexpected identity.")
if payload.get("plannedTaskCount") != 18:
    raise SystemExit("Sampling batch account operation did not confirm the fixed 18-slot plan.")
action = payload.get("action")
status = payload.get("status")
automation_status = payload.get("automationStatus")
allowed_statuses = {"absent", "draft", "frozen", "in_progress", "completed", "cancelled"}
allowed_automation_statuses = {None, "not_started", "running", "needs_human", "settled"}
if status not in allowed_statuses or automation_status not in allowed_automation_statuses:
    raise SystemExit("Sampling batch account operation returned an invalid lifecycle status.")
if mode == "status-only":
    if action != "existing_noop":
        raise SystemExit("Sampling batch status check unexpectedly proposed a mutation.")
    print("sampling batch status: existing")
elif mode == "dry-run":
    if action not in {"would_create_freeze_start", "existing_noop"}:
        raise SystemExit("Sampling batch dry-run returned an unexpected action.")
    print(f"sampling batch dry-run: action={action} status={status} planned=18")
elif mode == "apply":
    if action not in {"created_frozen_started", "existing_noop"}:
        raise SystemExit("Sampling batch apply returned an unexpected action.")
    print(f"sampling batch apply: action={action} status={status} planned=18")
else:
    raise SystemExit("Sampling batch operation received an invalid mode.")
PY
	rm -f -- "$output_file"
	operation_output_file=""
}

# A missing fixed identity is expected before the one-shot starts. Every later
# stage is checked before the single apply call; the worker's fixed idempotency
# key makes a workflow replay a no-op rather than a second batch.
run_mode "status-only"
run_mode "dry-run"
run_mode "apply"
