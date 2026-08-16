#!/usr/bin/env bash

set -Eeuo pipefail
set +x
umask 077
audit_output_file=""

cleanup_audit_output() {
	if [[ -n "$audit_output_file" ]]; then
		rm -f -- "$audit_output_file"
	fi
}
trap cleanup_audit_output EXIT

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
for required_file in "$COMPOSE_FILE" "$ENV_FILE" "$RELEASE_FILE"; do
	if [[ ! -f "$required_file" || ! -r "$required_file" ]]; then
		echo "Missing readable overseas readiness prerequisite." >&2
		exit 1
	fi
done
if [[ "$(tr -d '[:space:]' <"$RELEASE_FILE")" != "$release_tag" ]]; then
	echo "Refusing overseas readiness audit before the requested release is healthy." >&2
	exit 1
fi

exec 8>"$DEPLOY_ROOT/.overseas-formal-readiness.lock"
if ! flock -n 8; then
	echo "Another overseas readiness audit is running." >&2
	exit 1
fi

audit_output_file="$(mktemp)"
compose=(docker compose --project-name yonaris --env-file "$ENV_FILE" --file "$COMPOSE_FILE")
set +e
IMAGE_TAG="$release_tag" "${compose[@]}" --profile operations run --rm --no-deps -T \
	account-ops node ./node_modules/tsx/dist/cli.mjs ./src/audit-overseas-formal-readiness.ts \
	>"$audit_output_file" 2>&1
audit_status=$?
set -e

if ! python3 - "$audit_status" "$audit_output_file" <<'PY'
import json
import pathlib
import re
import sys

status = int(sys.argv[1])
try:
    lines = pathlib.Path(sys.argv[2]).read_text(encoding="utf-8").splitlines()
    candidates = [line for line in lines if line.lstrip().startswith("{") and line.rstrip().endswith("}")]
    payload = json.loads(candidates[-1])
except Exception:
    raise SystemExit(1)
if status != 0 or not isinstance(payload, dict):
    raise SystemExit(1)

expected_top = {
    "ok", "operation", "brand", "source", "targets", "oneShot", "dailyIfEnabled",
    "responseSnapshotsEnabled", "readyForOneShot", "blockers",
}
if set(payload) != expected_top or payload.get("ok") is not True or payload.get("operation") != "overseas_formal_readiness":
    raise SystemExit(1)
brand = payload.get("brand")
source = payload.get("source")
one_shot = payload.get("oneShot")
daily = payload.get("dailyIfEnabled")
targets = payload.get("targets")
blockers = payload.get("blockers")
if not all(isinstance(item, dict) for item in (brand, source, one_shot, daily)):
    raise SystemExit(1)
if set(brand) != {"name", "enabled", "enabledModelPolicy", "enabledModelCount"}:
    raise SystemExit(1)
if brand.get("name") != "StepFun" or not isinstance(brand.get("enabled"), bool):
    raise SystemExit(1)
if brand.get("enabledModelPolicy") not in {"all", "none", "selected"}:
    raise SystemExit(1)
if brand.get("enabledModelCount") is not None and not isinstance(brand.get("enabledModelCount"), int):
    raise SystemExit(1)
if set(source) != {"scopeKey", "enabled", "executionPolicy", "promptCount", "exactPromptMatchCount"}:
    raise SystemExit(1)
if source.get("scopeKey") != "cn-zh-scored" or source.get("executionPolicy") not in {"legacy", "manual_only", "automatic"}:
    raise SystemExit(1)
if set(one_shot) != {"promptCount", "targetCount", "samplesPerPrompt", "totalCalls", "maxCalls", "dailyAutomationEnabled"}:
    raise SystemExit(1)
if set(daily) != {"runsPerPrompt", "callsPerCycle", "cadenceHours"}:
    raise SystemExit(1)
if not isinstance(targets, list) or len(targets) > 6 or one_shot.get("targetCount") != len(targets):
    raise SystemExit(1)
if one_shot.get("promptCount") != 3 or one_shot.get("samplesPerPrompt") != 1 or one_shot.get("maxCalls") != 18:
    raise SystemExit(1)
if one_shot.get("dailyAutomationEnabled") is not False:
    raise SystemExit(1)
for field in ("totalCalls",):
    if not isinstance(one_shot.get(field), int) or isinstance(one_shot.get(field), bool):
        raise SystemExit(1)
for field in ("runsPerPrompt", "callsPerCycle"):
    if not isinstance(daily.get(field), int) or isinstance(daily.get(field), bool):
        raise SystemExit(1)
if not isinstance(daily.get("cadenceHours"), (int, float)) or isinstance(daily.get("cadenceHours"), bool):
    raise SystemExit(1)
if not isinstance(payload.get("responseSnapshotsEnabled"), bool) or not isinstance(payload.get("readyForOneShot"), bool):
    raise SystemExit(1)
allowed_blockers = {
    "brand_disabled", "source_scope_disabled", "prompt_identity_mismatch", "brightdata_not_configured",
    "no_brightdata_targets", "response_snapshots_disabled", "one_shot_call_cap_exceeded",
}
if not isinstance(blockers, list) or any(item not in allowed_blockers for item in blockers):
    raise SystemExit(1)
safe = re.compile(r"^[a-z0-9][a-z0-9._-]{0,119}$")
for target in targets:
    if set(target) != {"model", "webSearch", "surfaceTargetKey", "captureRouteKey"}:
        raise SystemExit(1)
    if not all(isinstance(target.get(field), str) and safe.fullmatch(target[field]) for field in ("model", "surfaceTargetKey", "captureRouteKey")):
        raise SystemExit(1)
    if not isinstance(target.get("webSearch"), bool):
        raise SystemExit(1)

lower = lambda value: str(value).lower()
print(
    "overseas readiness: "
    f"ready={lower(payload['readyForOneShot'])} prompts={one_shot['promptCount']} "
    f"targets={one_shot['targetCount']} one_shot_calls={one_shot['totalCalls']} "
    f"daily_calls_per_cycle={daily['callsPerCycle']} cadence_hours={daily['cadenceHours']} "
    f"snapshots={lower(payload['responseSnapshotsEnabled'])}"
)
for target in targets:
    print(
        f"overseas target: model={target['model']} surface={target['surfaceTargetKey']} "
        f"route={target['captureRouteKey']} web_search={lower(target['webSearch'])}"
    )
if blockers:
    print(f"overseas blockers: {','.join(blockers)}")
PY
then
	echo "Overseas formal readiness audit failed; raw output was withheld." >&2
	exit 1
fi

rm -f -- "$audit_output_file"
audit_output_file=""
