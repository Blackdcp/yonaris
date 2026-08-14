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
	echo "Usage: $0 sha-<40-character-git-sha> <reviewed-import-request.json>" >&2
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
REQUEST_DIR="$SOURCE_ROOT/deploy/las/reviewed-consumer-cohort-imports/requests"
MANIFEST_PATH="apps/worker/src/reviewed-consumer-cohorts/stepfun-local-pc-deepseek-18-20260814.json"
MANIFEST_FILE="$SOURCE_ROOT/$MANIFEST_PATH"
REQUEST_ID="stepfun-local-pc-deepseek-18-20260814"
MANIFEST_FINGERPRINT="413d278402848c4bb0d569d4a1a2291a220d43fe755b6be81d5e82f6aaa1eeda"

for required_file in "$COMPOSE_FILE" "$ENV_FILE" "$RELEASE_FILE" "$MANIFEST_FILE" "$request_file"; do
	if [[ ! -f "$required_file" || ! -r "$required_file" || -L "$required_file" ]]; then
		echo "Missing readable reviewed consumer import prerequisite." >&2
		exit 1
	fi
done
if [[ "$(tr -d '[:space:]' <"$RELEASE_FILE")" != "$release_tag" ]]; then
	echo "Refusing reviewed consumer import before the immutable release is healthy." >&2
	exit 1
fi

request_root="$(realpath -e -- "$REQUEST_DIR")"
resolved_request="$(realpath -e -- "$request_file")"
if [[ "$(dirname -- "$resolved_request")" != "$request_root" ]]; then
	echo "Reviewed import request must be a direct checked-in file." >&2
	exit 1
fi

python3 - "$resolved_request" "$MANIFEST_FILE" "$MANIFEST_PATH" "$REQUEST_ID" "$MANIFEST_FINGERPRINT" <<'PY'
import hashlib
import json
import pathlib
import sys

request_path, manifest_path, expected_manifest_path, request_id, expected_fingerprint = sys.argv[1:]
request = json.loads(pathlib.Path(request_path).read_text(encoding="utf-8"))
expected_request = {
    "schemaVersion": 1,
    "operation": "import-reviewed-consumer-cohort",
    "requestId": request_id,
    "manifestPath": expected_manifest_path,
    "manifestFingerprint": expected_fingerprint,
}
if request != expected_request:
    raise SystemExit("Reviewed import request does not match the fixed contract.")
manifest = json.loads(pathlib.Path(manifest_path).read_text(encoding="utf-8"))
canonical = json.dumps(manifest, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
if hashlib.sha256(canonical).hexdigest() != expected_fingerprint:
    raise SystemExit("Reviewed manifest fingerprint mismatch.")
expected = {
    "schemaVersion": 1,
    "importId": request_id,
    "brandId": "stepfun",
    "scopeKey": "cn-zh-scored",
    "market": "CN",
    "locale": "zh-CN",
    "timezone": "Asia/Shanghai",
    "evaluationRole": "scored",
    "model": "deepseek",
    "surfaceTargetKey": "deepseek.consumer_web",
    "captureRouteKey": "assisted_browser.generic",
    "sessionMode": "dedicated_sampling_profile",
    "searchMode": "native_auto",
}
for key, value in expected.items():
    if manifest.get(key) != value:
        raise SystemExit("Reviewed manifest does not match the fixed DeepSeek contract.")
observations = manifest.get("observations")
if not isinstance(observations, list) or len(observations) != 18:
    raise SystemExit("Reviewed manifest must contain exactly 18 observations.")
for index, item in enumerate(observations):
    prompt_index = index % 3 + 1
    sample_index = index // 3 + 1
    external_id = f"stepfun-local-pc-deepseek-20260814-{index + 1:02d}-p{prompt_index}-s{sample_index}"
    if (
        item.get("externalId") != external_id
        or item.get("promptIndex") != prompt_index
        or item.get("sampleIndex") != sample_index
        or item.get("webSearchObserved") is not True
    ):
        raise SystemExit("Reviewed manifest slot identity or search evidence is invalid.")
    if not item.get("answerText") or not isinstance(item.get("citations"), list) or not item["citations"]:
        raise SystemExit("Reviewed manifest contains incomplete answer or citation detail.")
PY

exec 8>"$DEPLOY_ROOT/.reviewed-consumer-import.lock"
if ! flock -n 8; then
	echo "Another reviewed consumer import is already running." >&2
	exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a
container_manifest="./src/reviewed-consumer-cohorts/$(basename -- "$MANIFEST_PATH")"

run_mode() {
	local mode="$1"
	local command_status
	operation_output="$(mktemp)"
	set +e
	if [[ "$mode" == "dry-run" ]]; then
		IMAGE_TAG="$release_tag" docker compose --project-name yonaris --env-file "$ENV_FILE" --file "$COMPOSE_FILE" \
			--profile operations run --rm --no-deps -T account-ops \
			node ./node_modules/tsx/dist/cli.mjs ./src/import-reviewed-consumer-cohort.ts \
			--request-file "$container_manifest" >"$operation_output" 2>&1
	else
		IMAGE_TAG="$release_tag" docker compose --project-name yonaris --env-file "$ENV_FILE" --file "$COMPOSE_FILE" \
			--profile operations run --rm --no-deps -T account-ops \
			node ./node_modules/tsx/dist/cli.mjs ./src/import-reviewed-consumer-cohort.ts \
			--request-file "$container_manifest" --apply >"$operation_output" 2>&1
	fi
	command_status=$?
	set -e
	python3 - "$mode" "$command_status" "$operation_output" "$MANIFEST_FINGERPRINT" <<'PY'
import json
import pathlib
import sys

mode, status, output_path, fingerprint = sys.argv[1:]
lines = pathlib.Path(output_path).read_text(encoding="utf-8").splitlines()
json_lines = [line for line in lines if line.lstrip().startswith("{") and line.rstrip().endswith("}")]
if not json_lines:
    raise SystemExit("Reviewed consumer import returned unexpected output; raw output was withheld.")
payload = json.loads(json_lines[-1])
if int(status) != 0:
    code = payload.get("code")
    if isinstance(code, str) and code.replace("_", "").isalnum() and len(code) <= 80:
        raise SystemExit(f"Reviewed consumer import failed: code={code}")
    raise SystemExit("Reviewed consumer import failed; raw output was withheld.")
if payload.get("total") != 18 or payload.get("manifestFingerprint") != fingerprint:
    raise SystemExit("Reviewed consumer import returned an unexpected cohort identity.")
if mode == "dry-run":
    if payload.get("status") != "dry_run":
        raise SystemExit("Reviewed consumer import dry-run failed.")
    print("reviewed consumer import dry-run: valid 18")
else:
    if payload.get("status") != "applied" or payload.get("lifecycle") not in {"inserted", "unchanged"}:
        raise SystemExit("Reviewed consumer import apply did not reach a terminal state.")
    diagnostic = payload.get("diagnostic")
    if not isinstance(diagnostic, dict) or diagnostic.get("totalRuns") != 18 or diagnostic.get("distinctPrompts") != 3:
        raise SystemExit("Reviewed consumer import diagnostics are incomplete.")
    if diagnostic.get("webSearchObservedRuns") != 18 or diagnostic.get("totalCitations", 0) <= 0:
        raise SystemExit("Reviewed consumer import structured detail diagnostics are incomplete.")
    print(
        "reviewed consumer import complete: "
        f"lifecycle={payload.get('lifecycle')} totalRuns={diagnostic.get('totalRuns')} "
        f"brandMentionedRuns={diagnostic.get('brandMentionedRuns')} "
        f"totalQueries={diagnostic.get('totalQueries')} totalCitations={diagnostic.get('totalCitations')}"
    )
PY
	rm -f -- "$operation_output"
	operation_output=""
}

run_mode dry-run
run_mode apply
