#!/usr/bin/env bash

set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT_UNDER_TEST="$SCRIPT_DIR/audit-overseas-formal-readiness.sh"
TEST_ROOT="$(mktemp -d)"
trap 'rm -rf -- "$TEST_ROOT"' EXIT

DEPLOY_ROOT="$TEST_ROOT/deploy"
SOURCE_ROOT="$TEST_ROOT/source"
BIN_DIR="$SOURCE_ROOT/deploy/las/bin"
MOCK_BIN="$TEST_ROOT/mock-bin"
ENV_FILE="$DEPLOY_ROOT/.env"
COMPOSE_FILE="$SOURCE_ROOT/deploy/las/compose.yaml"
RELEASE_TAG="sha-5555555555555555555555555555555555555555"

if python3 --version >/dev/null 2>&1; then
	TEST_PYTHON="$(command -v python3)"
elif [[ -x /c/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe ]]; then
	TEST_PYTHON="/c/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe"
else
	echo "A working Python 3 interpreter is required for this shell test." >&2
	exit 1
fi

mkdir -p -- "$DEPLOY_ROOT" "$BIN_DIR" "$MOCK_BIN"
cp -- "$SCRIPT_UNDER_TEST" "$BIN_DIR/audit-overseas-formal-readiness.sh"
printf '{}\n' >"$COMPOSE_FILE"
printf '%s\n' "$RELEASE_TAG" >"$DEPLOY_ROOT/.release"
printf 'APP_ENV_FILE=%s\n' "$ENV_FILE" >"$ENV_FILE"

cat >"$MOCK_BIN/docker" <<'EOF'
#!/usr/bin/env bash
if [[ "${MOCK_AUDIT_FAIL:-false}" == true ]]; then
	echo 'SUPERSECRET provider-token-value' >&2
	exit 71
fi
cat <<'JSON'
{"ok":true,"operation":"overseas_formal_readiness","brand":{"name":"StepFun","enabled":true,"enabledModelPolicy":"all","enabledModelCount":null},"source":{"scopeKey":"cn-zh-scored","enabled":true,"executionPolicy":"manual_only","promptCount":3,"exactPromptMatchCount":3},"targets":[{"model":"chatgpt","webSearch":true,"surfaceTargetKey":"chatgpt.consumer_web","captureRouteKey":"brightdata.chatgpt_dataset"}],"oneShot":{"promptCount":3,"targetCount":1,"samplesPerPrompt":1,"totalCalls":3,"maxCalls":18,"dailyAutomationEnabled":false},"dailyIfEnabled":{"runsPerPrompt":5,"callsPerCycle":15,"cadenceHours":24},"responseSnapshotsEnabled":true,"readyForOneShot":true,"blockers":[]}
JSON
EOF
cat >"$MOCK_BIN/flock" <<'EOF'
#!/usr/bin/env bash
exit 0
EOF
printf '#!/usr/bin/env bash\nexec %q "$@"\n' "$TEST_PYTHON" >"$MOCK_BIN/python3"
chmod +x "$MOCK_BIN/docker" "$MOCK_BIN/flock" "$MOCK_BIN/python3" "$BIN_DIR/audit-overseas-formal-readiness.sh"

output="$(
	env PATH="$MOCK_BIN:$PATH" DEPLOY_ROOT="$DEPLOY_ROOT" COMPOSE_FILE="$COMPOSE_FILE" ENV_FILE="$ENV_FILE" \
		bash "$BIN_DIR/audit-overseas-formal-readiness.sh" "$RELEASE_TAG"
)"
grep -Fq 'overseas readiness: ready=true prompts=3 targets=1 one_shot_calls=3 daily_calls_per_cycle=15 cadence_hours=24 snapshots=true' <<<"$output"
grep -Fq 'overseas target: model=chatgpt surface=chatgpt.consumer_web route=brightdata.chatgpt_dataset web_search=true' <<<"$output"
! grep -Fq 'SUPERSECRET' <<<"$output"

set +e
failure_output="$(
	env PATH="$MOCK_BIN:$PATH" DEPLOY_ROOT="$DEPLOY_ROOT" COMPOSE_FILE="$COMPOSE_FILE" ENV_FILE="$ENV_FILE" \
		MOCK_AUDIT_FAIL=true bash "$BIN_DIR/audit-overseas-formal-readiness.sh" "$RELEASE_TAG" 2>&1
)"
failure_status=$?
set -e
[[ "$failure_status" -ne 0 ]]
grep -Fq 'Overseas formal readiness audit failed; raw output was withheld.' <<<"$failure_output"
! grep -Fq 'SUPERSECRET' <<<"$failure_output"

echo 'overseas formal readiness audit shell tests passed'
