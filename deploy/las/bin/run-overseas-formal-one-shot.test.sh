#!/usr/bin/env bash

set -Eeuo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
script_under_test="$script_dir/run-overseas-formal-one-shot.sh"
test_root="$(mktemp -d)"
trap 'rm -rf -- "$test_root"' EXIT
source_root="$test_root/source"
deploy_root="$test_root/deploy"
mock_bin="$test_root/bin"
request_file="$source_root/deploy/las/overseas-formal-runs/requests/request.json"
manifest_path="apps/worker/src/overseas-formal-run-requests/stepfun-us-chatgpt-1x-20260816.json"
release_tag="sha-5555555555555555555555555555555555555555"
event_log="$test_root/events.log"
mkdir -p "$source_root/deploy/las/bin" "$(dirname -- "$request_file")" "$(dirname -- "$source_root/$manifest_path")" "$deploy_root" "$mock_bin"

test_python=""
if command -v python3 >/dev/null 2>&1 && python3 -c 'import sys; raise SystemExit(0)' >/dev/null 2>&1; then
	test_python="$(command -v python3)"
elif [[ -x "/c/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe" ]]; then
	test_python="/c/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe"
else
	echo "A working Python 3 runtime is required for this test." >&2
	exit 1
fi

cat >"$mock_bin/python3" <<EOF
#!/usr/bin/env bash
exec "$test_python" "\$@"
EOF
cp "$script_under_test" "$source_root/deploy/las/bin/"
printf '{}\n' >"$source_root/deploy/las/compose.yaml"
printf 'APP_ENV_FILE=%s\n' "$deploy_root/.env" >"$deploy_root/.env"
printf '%s\n' "$release_tag" >"$deploy_root/.release"
printf '{}\n' >"$source_root/$manifest_path"
printf '%s\n' '{"schemaVersion":1,"operation":"run-overseas-formal-one-shot","requestId":"stepfun-us-chatgpt-1x-20260816","manifestPath":"apps/worker/src/overseas-formal-run-requests/stepfun-us-chatgpt-1x-20260816.json"}' >"$request_file"

cat >"$mock_bin/docker" <<'EOF'
#!/usr/bin/env bash
set -Eeuo pipefail
joined=" $* "
[[ "$joined" == *" ./src/run-overseas-formal-one-shot.ts --request-file ./src/overseas-formal-run-requests/stepfun-us-chatgpt-1x-20260816.json "* ]]
if [[ "$joined" == *" --status-only "* ]]; then mode=status-only; elif [[ "$joined" == *" --apply "* ]]; then mode=apply; else mode=dry-run; fi
printf '%s\n' "$mode" >>"$MOCK_EVENT_LOG"
printf '%s\n' 'provider raw response must stay private'
if [[ "$mode" == "apply" ]]; then
  if [[ "${MOCK_FAIL_APPLY:-false}" == true ]]; then
    printf '%s\n' '{"ok":false,"operation":"overseas_formal_one_shot","requestId":"stepfun-us-chatgpt-1x-20260816","action":"incomplete","scopeKey":"us-en-chatgpt-one-shot-20260816","channel":"chatgpt.consumer_web","plannedCalls":3,"completedCalls":0,"failedCalls":3,"runningCalls":0,"promptRunCount":0,"readySnapshots":0,"pendingSnapshots":0,"failedSnapshots":0,"executionFailures":3,"dailyAutomationEnabled":false,"code":"overseas_formal_one_shot_incomplete"}'
    exit 1
  fi
  printf '%s\n' '{"ok":true,"operation":"overseas_formal_one_shot","requestId":"stepfun-us-chatgpt-1x-20260816","action":"completed","scopeKey":"us-en-chatgpt-one-shot-20260816","channel":"chatgpt.consumer_web","plannedCalls":3,"completedCalls":3,"promptRunCount":3,"citationCount":7,"readySnapshots":3,"pendingSnapshots":0,"dailyAutomationEnabled":false}'
else
  printf '%s\n' "{\"ok\":true,\"operation\":\"overseas_formal_one_shot\",\"requestId\":\"stepfun-us-chatgpt-1x-20260816\",\"action\":\"$([[ \"$mode\" == status-only ]] && echo absent_read_only || echo would_create_and_run)\",\"scopeKey\":\"us-en-chatgpt-one-shot-20260816\",\"channel\":\"chatgpt.consumer_web\",\"plannedCalls\":3,\"dailyAutomationEnabled\":false}"
fi
EOF
cat >"$mock_bin/flock" <<'EOF'
#!/usr/bin/env bash
exit 0
EOF
chmod +x "$mock_bin/docker" "$mock_bin/flock"

output="$(env PATH="$mock_bin:$PATH" MOCK_EVENT_LOG="$event_log" DEPLOY_ROOT="$deploy_root" COMPOSE_FILE="$source_root/deploy/las/compose.yaml" ENV_FILE="$deploy_root/.env" bash "$source_root/deploy/las/bin/run-overseas-formal-one-shot.sh" "$release_tag" "$request_file")"
[[ "$(tr '\n' ' ' <"$event_log")" == "status-only dry-run apply " ]]
grep -Fq 'overseas formal apply: completed_calls=3 prompt_runs=3 ready_snapshots=3 citations=7 daily=false' <<<"$output"
if grep -Fq 'provider raw response' <<<"$output"; then
	echo "Overseas formal wrapper leaked raw provider output." >&2
	exit 1
fi

set +e
failed_output="$(env PATH="$mock_bin:$PATH" MOCK_EVENT_LOG="$event_log" MOCK_FAIL_APPLY=true DEPLOY_ROOT="$deploy_root" COMPOSE_FILE="$source_root/deploy/las/compose.yaml" ENV_FILE="$deploy_root/.env" bash "$source_root/deploy/las/bin/run-overseas-formal-one-shot.sh" "$release_tag" "$request_file" 2>&1)"
failed_status=$?
set -e
[[ "$failed_status" -ne 0 ]]
grep -Fq 'overseas formal apply incomplete: completed_calls=0 failed_calls=3 running_calls=0 prompt_runs=0 ready_snapshots=0 pending_snapshots=0 failed_snapshots=0 execution_failures=3 daily=false' <<<"$failed_output"
if grep -Fq 'provider raw response' <<<"$failed_output"; then
	echo "Overseas formal failure receipt leaked raw provider output." >&2
	exit 1
fi
echo "overseas formal one-shot mock tests passed"
