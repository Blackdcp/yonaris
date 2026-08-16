#!/usr/bin/env bash

set -Eeuo pipefail
set +x
umask 077
raw_output=""

cleanup() {
	[[ -z "$raw_output" ]] || rm -f -- "$raw_output"
}
trap cleanup EXIT

if [[ $# -ne 2 || ! "$1" =~ ^sha-[0-9a-f]{40}$ ]]; then
	echo "Usage: $0 sha-<40-character-git-sha> <approved-request.json>" >&2
	exit 2
fi

release_tag="$1"
request_file="$2"
script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
source_root="$(cd -- "$script_dir/../../.." && pwd)"
deploy_root="${DEPLOY_ROOT:-/opt/yonaris}"
compose_file="${COMPOSE_FILE:-$source_root/deploy/las/compose.yaml}"
env_file="${ENV_FILE:-$deploy_root/.env}"
release_file="$deploy_root/.release"
request_root="$source_root/deploy/las/overseas-formal-runs/requests"
manifest_path="apps/worker/src/overseas-formal-run-requests/stepfun-us-chatgpt-1x-20260816.json"
request_id="stepfun-us-chatgpt-1x-20260816"

for prerequisite in "$compose_file" "$env_file" "$release_file" "$source_root/$manifest_path"; do
	[[ -f "$prerequisite" && -r "$prerequisite" && ! -L "$prerequisite" ]] || {
		echo "Missing readable overseas formal-run prerequisite." >&2
		exit 1
	}
done
[[ "$(tr -d '[:space:]' <"$release_file")" == "$release_tag" ]] || {
	echo "Refusing overseas formal run before the immutable release is healthy." >&2
	exit 1
}
[[ -f "$request_file" && -r "$request_file" && ! -L "$request_file" ]] || {
	echo "Overseas formal-run request must be a readable regular file." >&2
	exit 1
}
resolved_request="$(realpath -e -- "$request_file")"
resolved_root="$(realpath -e -- "$request_root")"
[[ "$(dirname -- "$resolved_request")" == "$resolved_root" ]] || {
	echo "Overseas formal-run request escaped the approved directory." >&2
	exit 1
}

python3 - "$resolved_request" "$manifest_path" <<'PY'
import json
import pathlib
import sys

request = json.loads(pathlib.Path(sys.argv[1]).read_text(encoding="utf-8"))
expected = {
    "schemaVersion": 1,
    "operation": "run-overseas-formal-one-shot",
    "requestId": "stepfun-us-chatgpt-1x-20260816",
    "manifestPath": sys.argv[2],
}
if request != expected:
    raise SystemExit("Overseas formal-run request does not match the approved fixed contract.")
PY

exec 8>"$deploy_root/.overseas-formal-one-shot.lock"
flock -n 8 || {
	echo "Another overseas formal run is already active." >&2
	exit 1
}

set -a
# shellcheck disable=SC1090
source "$env_file"
set +a
compose=(docker compose --project-name yonaris --env-file "$env_file" --file "$compose_file")
container_manifest="./src/overseas-formal-run-requests/$(basename -- "$manifest_path")"

run_mode() {
	local mode="$1"
	local status
	raw_output="$(mktemp)"
	set +e
	if [[ "$mode" == "dry-run" ]]; then
		IMAGE_TAG="$release_tag" "${compose[@]}" --profile operations run --rm --no-deps -T \
			account-ops node ./node_modules/tsx/dist/cli.mjs ./src/run-overseas-formal-one-shot.ts \
			--request-file "$container_manifest" >"$raw_output" 2>&1
	else
		IMAGE_TAG="$release_tag" "${compose[@]}" --profile operations run --rm --no-deps -T \
			account-ops node ./node_modules/tsx/dist/cli.mjs ./src/run-overseas-formal-one-shot.ts \
			--request-file "$container_manifest" "--$mode" >"$raw_output" 2>&1
	fi
	status=$?
	set -e
	python3 - "$mode" "$status" "$raw_output" "$request_id" <<'PY'
import json
import pathlib
import re
import sys

mode, raw_status, output_path, request_id = sys.argv[1:]
try:
    status = int(raw_status)
    lines = pathlib.Path(output_path).read_text(encoding="utf-8").splitlines()
    candidates = [json.loads(line) for line in lines if line.lstrip().startswith("{") and line.rstrip().endswith("}")]
    receipts = [
        candidate
        for candidate in candidates
        if candidate.get("operation") == "overseas_formal_one_shot"
        and candidate.get("requestId") == request_id
    ]
    payload = receipts[-1]
except Exception:
    raise SystemExit("Overseas formal account operation returned unexpected output; raw output was withheld.")
if payload.get("operation") != "overseas_formal_one_shot" or payload.get("requestId") != request_id:
    raise SystemExit("Overseas formal account operation returned an unexpected identity.")
if payload.get("scopeKey") != "us-en-chatgpt-one-shot-20260816" or payload.get("channel") != "chatgpt.consumer_web":
    raise SystemExit("Overseas formal account operation returned an unexpected measurement identity.")
if payload.get("plannedCalls") != 3 or payload.get("dailyAutomationEnabled") is not False:
    raise SystemExit("Overseas formal account operation exceeded the approved one-shot budget.")
if status != 0 or payload.get("ok") is not True:
    fields = [
        "completedCalls",
        "failedCalls",
        "runningCalls",
        "promptRunCount",
        "readySnapshots",
        "pendingSnapshots",
        "failedSnapshots",
        "executionFailures",
    ]
    if payload.get("action") != "incomplete" or payload.get("code") != "overseas_formal_one_shot_incomplete":
        raise SystemExit("Overseas formal account operation failed; raw output was withheld.")
    if any(not isinstance(payload.get(field), int) or payload[field] < 0 or payload[field] > 3 for field in fields):
        raise SystemExit("Overseas formal account operation returned an invalid failure diagnostic.")
    print(
        "overseas formal apply incomplete: "
        f"completed_calls={payload['completedCalls']} failed_calls={payload['failedCalls']} "
        f"running_calls={payload['runningCalls']} prompt_runs={payload['promptRunCount']} "
        f"ready_snapshots={payload['readySnapshots']} pending_snapshots={payload['pendingSnapshots']} "
        f"failed_snapshots={payload['failedSnapshots']} execution_failures={payload['executionFailures']} daily=false",
        file=sys.stderr,
    )
    raise SystemExit(1)
action = payload.get("action")
if mode in {"status-only", "dry-run"}:
    if action not in {"absent_read_only", "existing_read_only", "would_create_and_run"}:
        raise SystemExit("Overseas formal read-only operation returned an unexpected action.")
    print(f"overseas formal {mode}: action={action} planned_calls=3 daily=false")
else:
    if action != "completed" or payload.get("completedCalls") != 3 or payload.get("promptRunCount") != 3:
        raise SystemExit("Overseas formal run did not complete its exact three-call cohort.")
    if payload.get("readySnapshots") != 3 or payload.get("pendingSnapshots") != 0:
        raise SystemExit("Overseas formal run did not produce three ready response snapshots.")
    citations = payload.get("citationCount")
    if not isinstance(citations, int) or citations < 0:
        raise SystemExit("Overseas formal run returned an invalid citation count.")
    print(f"overseas formal apply: completed_calls=3 prompt_runs=3 ready_snapshots=3 citations={citations} daily=false")
PY
	rm -f -- "$raw_output"
	raw_output=""
}

run_mode status-only
run_mode dry-run
run_mode apply
