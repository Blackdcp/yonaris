#!/usr/bin/env bash

set -Eeuo pipefail
set +x
umask 077

if [[ $# -ne 1 ]]; then
	echo "Usage: $0 sha-<40-character-git-sha>" >&2
	exit 2
fi

release_tag="$1"
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
IMPORT_FILE="$SOURCE_ROOT/apps/worker/src/local-demo-imports/stepfun-local-pc-doubao-18-20260814.json"
CONTAINER_IMPORT_FILE="./src/local-demo-imports/stepfun-local-pc-doubao-18-20260814.json"

for required_file in "$COMPOSE_FILE" "$ENV_FILE" "$RELEASE_FILE" "$IMPORT_FILE"; do
	if [[ ! -f "$required_file" || ! -r "$required_file" || -L "$required_file" ]]; then
		echo "Missing readable local demo import prerequisite." >&2
		exit 1
	fi
done
if [[ "$(tr -d '[:space:]' <"$RELEASE_FILE")" != "$release_tag" ]]; then
	echo "Refusing local demo import before the requested immutable release is healthy." >&2
	exit 1
fi

python3 - "$IMPORT_FILE" <<'PY'
import json
import pathlib
import sys

payload = json.loads(pathlib.Path(sys.argv[1]).read_text(encoding="utf-8"))
expected = {
    "schemaVersion": 1,
    "importId": "stepfun-local-pc-doubao-demo-20260814",
    "brandNameExact": "StepFun",
    "scopeKeyExact": "cn-zh-scored",
    "surfaceTargetKey": "doubao.consumer_web",
    "captureRouteKey": "browser_runner.doubao",
    "sessionMode": "dedicated_sampling_profile",
    "searchMode": "native_auto",
    "source": "local_pc_demo",
}
for key, value in expected.items():
    if payload.get(key) != value:
        raise SystemExit("Local demo import does not match the approved fixed contract.")
observations = payload.get("observations")
if not isinstance(observations, list) or len(observations) != 18:
    raise SystemExit("Local demo import must contain exactly 18 observations.")
by_prompt = {1: 0, 2: 0, 3: 0}
for item in observations:
    by_prompt[item.get("promptIndex")] = by_prompt.get(item.get("promptIndex"), 0) + 1
    if not str(item.get("externalId", "")).startswith("stepfun-local-pc-demo-20260814-"):
        raise SystemExit("Local demo import contains an unexpected external id.")
if by_prompt != {1: 6, 2: 6, 3: 6}:
    raise SystemExit("Local demo import must contain six observations per prompt.")
PY

exec 8>"$DEPLOY_ROOT/.local-demo-import.lock"
if ! flock -n 8; then
	echo "Another Yonaris local demo import is already running." >&2
	exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a
compose=(docker compose --project-name yonaris --env-file "$ENV_FILE" --file "$COMPOSE_FILE")

run_mode() {
	local mode="$1"
	local output_file
	local command_status
	output_file="$(mktemp)"
	set +e
	if [[ "$mode" == "dry-run" ]]; then
		IMAGE_TAG="$release_tag" "${compose[@]}" --profile operations run --rm --no-deps -T \
			account-ops node ./node_modules/tsx/dist/cli.mjs ./src/import-local-demo-observations.ts \
			--request-file "$CONTAINER_IMPORT_FILE" >"$output_file" 2>&1
	else
		IMAGE_TAG="$release_tag" "${compose[@]}" --profile operations run --rm --no-deps -T \
			account-ops node ./node_modules/tsx/dist/cli.mjs ./src/import-local-demo-observations.ts \
			--request-file "$CONTAINER_IMPORT_FILE" --apply >"$output_file" 2>&1
	fi
	command_status=$?
	set -e
	python3 - "$mode" "$command_status" "$output_file" <<'PY'
import json
import pathlib
import sys

mode, command_status, output_path = sys.argv[1:]
command_status = int(command_status)
lines = pathlib.Path(output_path).read_text(encoding="utf-8").splitlines()
pathlib.Path(output_path).unlink(missing_ok=True)
json_lines = [line for line in lines if line.lstrip().startswith("{") and line.rstrip().endswith("}")]
if not json_lines:
    raise SystemExit("Local demo import returned unexpected output; raw output was withheld.")
payload = json.loads(json_lines[-1])
if command_status != 0:
    code = payload.get("code")
    if isinstance(code, str) and code.replace("_", "").replace("-", "").isalnum() and len(code) <= 80:
        raise SystemExit(f"Local demo import failed: code={code}")
    raise SystemExit("Local demo import failed; raw output was withheld.")
if mode == "dry-run":
    if payload.get("status") != "dry_run" or payload.get("total") != 18:
        raise SystemExit("Local demo import dry-run did not validate the fixed 18 observations.")
    print("local demo import dry-run: valid 18")
else:
    if payload.get("status") != "applied" or payload.get("total") != 18:
        raise SystemExit("Local demo import apply did not confirm 18 observations.")
    imported = payload.get("imported")
    duplicates = payload.get("duplicates")
    in_progress = payload.get("inProgress")
    if in_progress != 0 or (imported + duplicates) != 18:
        raise SystemExit("Local demo import did not reach a terminal state for all 18 observations.")
    print(f"local demo import apply: imported={imported} duplicates={duplicates}")
    default_scope = payload.get("defaultScope")
    diagnostic = payload.get("visibilityDiagnostic")
    if not isinstance(default_scope, dict) or default_scope.get("key") != "cn-zh-scored":
        raise SystemExit("Local demo import did not promote the expected default scope.")
    if not isinstance(diagnostic, dict):
        raise SystemExit("Local demo import did not return visibility diagnostics.")
    total_runs = diagnostic.get("totalRuns")
    brand_mentions = diagnostic.get("brandMentionedRuns")
    distinct_prompts = diagnostic.get("distinctPrompts")
    if total_runs != 18 or brand_mentions != 12 or distinct_prompts != 3:
        raise SystemExit("Local demo import visibility diagnostics did not match the reviewed 18-run dataset.")
    print(
        "local demo import visibility: "
        f"defaultScope={default_scope.get('key')} totalRuns={total_runs} "
        f"brandMentionedRuns={brand_mentions} distinctPrompts={distinct_prompts}"
    )
PY
}

run_mode dry-run
run_mode apply
