#!/usr/bin/env bash

set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
DISPATCHER_SOURCE="$SCRIPT_DIR/dispatch-las-command.sh"
REPO_ROOT="$(cd -- "$SCRIPT_DIR/../../.." && pwd)"
PORTAL_WORKFLOW="$REPO_ROOT/.github/workflows/deploy-las.yaml"
MARKETING_WORKFLOW="$REPO_ROOT/.github/workflows/deploy-marketing.yaml"
TEST_ROOT="$(mktemp -d)"
trap 'rm -rf -- "$TEST_ROOT"' EXIT

for contract in \
	"SOURCE_GIT_DIR='/var/lib/yonaris/las-objects.git'" \
	'/usr/bin/git --no-replace-objects' \
	"GIT_NO_REPLACE_OBJECTS='1'" \
	'core.hooksPath=/dev/null' \
	'protocol.ext.allow=never' \
	'RELEASE_TREE_ROOT=' \
	"BUNDLE_TOKEN='yonaris-las-stable-bundle-v1'" \
	"ACTIVE_BUNDLE_POINTER='/etc/yonaris/las-stable-bundle-active-v1'" \
	'active_bundle_pin_is_current' \
	'/usr/bin/flock --shared --wait 1800 9' \
	'/usr/bin/flock --exclusive --wait 1800 9' \
	'state_manager begin portal' \
	'state_manager begin marketing' \
	'state_manager rollback-evidence marketing' \
	"state_attestation 'las-migration-readiness-v1 ok' migration-readiness" \
	'runtime_manager portal-preflight' \
	'runtime_manager portal-deploy' \
	'runtime_manager portal-verify' \
	'runtime_manager marketing-deploy' \
	'runtime_manager marketing-verify' \
	'caddy_manager prepare' \
	'caddy_manager activate' \
	'caddy_manager rollback' \
	'((marketing_status == 1))'; do
	grep -Fq -- "$contract" "$DISPATCHER_SOURCE"
done
for forbidden in '/usr/bin/sudo' 'git checkout' 'git reset' 'git clean' 'git_clean fetch' \
	'SOURCE_REPOSITORY=' 'bash -s' 'run_release_script' '/usr/sbin/runuser' \
	'DOCKER_HOST=' 'DOCKER_CONFIG=' 'XDG_RUNTIME_DIR='; do
	if grep -Fq -- "$forbidden" "$DISPATCHER_SOURCE"; then
		echo "Stable root dispatcher contains forbidden primitive: $forbidden" >&2
		exit 1
	fi
done

for legacy_operation in \
	report-operations overseas-formal-readiness local-demo-import \
	overseas-formal-one-shot response-snapshot-activation sampling-batch-operation \
	reviewed-consumer-cohort-import program-locale-repair program-import \
	response-snapshot-backfill browser-runner-activation; do
	if grep -Eq "^[[:space:]]*${legacy_operation//-/\\-}([[:space:]|)])" "$DISPATCHER_SOURCE"; then
		echo "Stable production dispatcher still accepts legacy operation: $legacy_operation" >&2
		exit 1
	fi
done

begin_line="$(grep -nF 'state_manager begin portal' "$DISPATCHER_SOURCE" | head -n 1 | cut -d: -f1)"
run_line="$(grep -nF 'runtime_manager portal-deploy "$release_tag"' "$DISPATCHER_SOURCE" | head -n 1 | cut -d: -f1)"
complete_line="$(grep -nF 'state_manager complete portal' "$DISPATCHER_SOURCE" | head -n 1 | cut -d: -f1)"
readiness_line="$(grep -nF "state_attestation 'las-migration-readiness-v1 ok' migration-readiness" "$DISPATCHER_SOURCE" | head -n 1 | cut -d: -f1)"
[[ -n "$readiness_line" && -n "$begin_line" && -n "$run_line" && -n "$complete_line" && \
	"$readiness_line" -lt "$begin_line" && "$begin_line" -lt "$run_line" && "$run_line" -lt "$complete_line" ]]

marketing_begin_line="$(grep -nF 'state_manager begin marketing' "$DISPATCHER_SOURCE" | head -n 1 | cut -d: -f1)"
prepare_line="$(grep -nF 'caddy_manager prepare' "$DISPATCHER_SOURCE" | head -n 1 | cut -d: -f1)"
prepare_reconcile_line="$(grep -nF 'state_manager reconcile marketing "$release_tag" rollback' "$DISPATCHER_SOURCE" | head -n 1 | cut -d: -f1)"
marketing_runtime_line="$(grep -nF 'runtime_manager marketing-deploy "$release_tag"' "$DISPATCHER_SOURCE" | head -n 1 | cut -d: -f1)"
[[ -n "$marketing_begin_line" && -n "$prepare_line" && -n "$prepare_reconcile_line" && \
	-n "$marketing_runtime_line" && "$marketing_begin_line" -lt "$prepare_line" && \
	"$prepare_line" -lt "$prepare_reconcile_line" && "$prepare_reconcile_line" -lt "$marketing_runtime_line" ]]

mapfile -t marketing_restore_lines < <(grep -nF 'runtime_manager marketing-rollback "$active_marketing_release"' "$DISPATCHER_SOURCE" | cut -d: -f1)
mapfile -t caddy_rollback_lines < <(grep -nF 'caddy_manager rollback "$release_tag" "$active_marketing_release"' "$DISPATCHER_SOURCE" | cut -d: -f1)
[[ "${#marketing_restore_lines[@]}" -eq 2 && "${#caddy_rollback_lines[@]}" -eq 2 ]]
for index in 0 1; do
	[[ "${marketing_restore_lines[$index]}" -lt "${caddy_rollback_lines[$index]}" ]] || {
		echo 'Marketing rollback must restore and verify predecessor runtime before Caddy rollback.' >&2
		exit 1
	}
done

# Verifier, journal, and activation checks are centralized inside the locked
# boundary. Probe calls it under the shared lock; ordinary operations call it
# once shared and again after their non-atomic exclusive-lock conversion.
[[ "$(grep -cF 'validate_locked_dispatch_boundary' "$DISPATCHER_SOURCE")" -eq 4 ]]
[[ "$(grep -cF 'verify_forced_boundary' "$DISPATCHER_SOURCE")" -eq 2 ]]
[[ "$(grep -cF 'reconcile_pending_transition' "$DISPATCHER_SOURCE")" -eq 2 ]]

for workflow in "$PORTAL_WORKFLOW" "$MARKETING_WORKFLOW"; do
	grep -Fq '"yonaris-las-v1 probe"' "$workflow"
	if grep -Eq 'bash -s|<<.?(REMOTE|EOF)|env RELEASE_SHA=' "$workflow"; then
		echo "Workflow regained an unrestricted remote shell: $workflow" >&2
		exit 1
	fi
done

# Exercise protocol rejection, the clean probe, and pending-journal fail-closed
# behavior without touching Git, Docker, a network, or production paths.
STABLE_DIRECTORY="$TEST_ROOT/usr/local/libexec/yonaris-las"
DISPATCHER="$STABLE_DIRECTORY/dispatch-las-command"
STATE_MANAGER="$STABLE_DIRECTORY/manage-las-release-state"
ROOT_VERIFIER="$TEST_ROOT/usr/local/sbin/verify-yonaris-las-forced-command"
ETC_ROOT="$TEST_ROOT/etc/yonaris"
MOCK_BIN="$TEST_ROOT/mock-bin"
EVENT_LOG="$TEST_ROOT/events.log"
STATUS_FILE="$TEST_ROOT/status"
CONTROL_LOCK_DIRECTORY="$TEST_ROOT/run/lock/yonaris"
REAL_STAT="$(command -v stat)"
REAL_READLINK="$(command -v readlink)"
REAL_GIT="$(command -v git)"
mkdir -p "$STABLE_DIRECTORY" "$(dirname -- "$ROOT_VERIFIER")" "$MOCK_BIN" \
	"$CONTROL_LOCK_DIRECTORY" "$ETC_ROOT"
printf '%s\n' clear >"$STATUS_FILE"

cat >"$ROOT_VERIFIER" <<'STUB'
#!/usr/bin/env bash
[[ "$#" -eq 0 ]]
printf 'verify\n' >>"$DISPATCH_TEST_EVENT_LOG"
STUB
cat >"$STATE_MANAGER" <<'STUB'
#!/usr/bin/env bash
[[ "$#" -eq 1 && "$1" == status ]] || exit 92
printf 'status\n' >>"$DISPATCH_TEST_EVENT_LOG"
cat "$DISPATCH_TEST_STATUS_FILE"
STUB
cat >"$MOCK_BIN/id" <<'STUB'
#!/usr/bin/env bash
case "$*" in
	-u) printf '0\n' ;;
	'-u yonaris-deploy') printf '1001\n' ;;
	*) exit 2 ;;
esac
STUB
cat >"$MOCK_BIN/stat" <<'STUB'
#!/usr/bin/env bash
path="${@: -1}"
case "$path" in
	*/manage-las-release-state | */verify-yonaris-las-forced-command) printf '0:0:755\n' ;;
	*/run/lock/yonaris) printf '0:0:700\n' ;;
	*) exec "$REAL_STAT" "$@" ;;
esac
STUB
cat >"$MOCK_BIN/readlink" <<'STUB'
#!/usr/bin/env bash
exec "$REAL_READLINK" "$@"
STUB
cat >"$MOCK_BIN/flock" <<'STUB'
#!/usr/bin/env bash
if [[ " $* " == *' --exclusive '* && -n "${DISPATCH_TEST_PENDING_ON_EXCLUSIVE:-}" ]]; then
	touch "$DISPATCH_TEST_PENDING_ON_EXCLUSIVE"
fi
exit 0
STUB
chmod +x "$ROOT_VERIFIER" "$STATE_MANAGER" "$MOCK_BIN"/*

sed \
	-e "s#/usr/local/libexec/yonaris-las#$STABLE_DIRECTORY#g" \
	-e "s#/usr/local/sbin/verify-yonaris-las-forced-command#$ROOT_VERIFIER#g" \
	-e "s#/etc/yonaris#$ETC_ROOT#g" \
	-e "s#/run/lock/yonaris#$CONTROL_LOCK_DIRECTORY#g" \
	-e "s#/usr/bin/id#$MOCK_BIN/id#g" \
	-e "s#/usr/bin/stat#$MOCK_BIN/stat#g" \
	-e "s#/usr/bin/readlink#$MOCK_BIN/readlink#g" \
	-e "s#/usr/bin/flock#$MOCK_BIN/flock#g" \
	"$DISPATCHER_SOURCE" >"$DISPATCHER"
chmod 0755 "$DISPATCHER"

run_dispatch() {
	local command="$1"
	env -i PATH='/usr/bin:/bin' HOME='/nonexistent' \
		SSH_ORIGINAL_COMMAND="$command" \
		DISPATCH_TEST_EVENT_LOG="$EVENT_LOG" DISPATCH_TEST_STATUS_FILE="$STATUS_FILE" \
		DISPATCH_TEST_PENDING_ON_EXCLUSIVE="${DISPATCH_TEST_PENDING_ON_EXCLUSIVE:-}" \
		REAL_STAT="$REAL_STAT" REAL_READLINK="$REAL_READLINK" \
		/bin/bash --noprofile --norc -p "$DISPATCHER"
}

set +e
rejection="$(run_dispatch true 2>&1)"
rejection_status=$?
set -e
[[ "$rejection_status" == 2 && "$rejection" == 'Refusing non-protocol LAS SSH command.' ]]
[[ ! -e "$EVENT_LOG" ]]

legacy_commands=(
	"yonaris-las-v1 report-operations sha-1111111111111111111111111111111111111111"
	"yonaris-las-v1 overseas-formal-readiness sha-1111111111111111111111111111111111111111"
	"yonaris-las-v1 local-demo-import sha-1111111111111111111111111111111111111111"
	"yonaris-las-v1 overseas-formal-one-shot sha-1111111111111111111111111111111111111111 request.json"
	"yonaris-las-v1 response-snapshot-activation sha-1111111111111111111111111111111111111111 request.json"
	"yonaris-las-v1 sampling-batch-operation sha-1111111111111111111111111111111111111111 request.json"
	"yonaris-las-v1 reviewed-consumer-cohort-import sha-1111111111111111111111111111111111111111 request.json"
	"yonaris-las-v1 program-locale-repair sha-1111111111111111111111111111111111111111 request.json"
	"yonaris-las-v1 program-import sha-1111111111111111111111111111111111111111 request.json"
	"yonaris-las-v1 response-snapshot-backfill sha-1111111111111111111111111111111111111111 request.json"
	"yonaris-las-v1 browser-runner-activation sha-1111111111111111111111111111111111111111 request.json"
)
for legacy_command in "${legacy_commands[@]}"; do
	rm -f -- "$EVENT_LOG"
	set +e
	legacy_output="$(run_dispatch "$legacy_command" 2>&1)"
	legacy_status=$?
	set -e
	[[ "$legacy_status" == 2 && "$legacy_output" == 'Refusing non-protocol LAS SSH command.' ]] || {
		echo "Legacy forced operation did not fail at the protocol boundary: $legacy_command" >&2
		exit 1
	}
	[[ ! -e "$EVENT_LOG" ]] || {
		echo "Legacy forced operation reached a privileged helper: $legacy_command" >&2
		exit 1
	}
done

probe="$(run_dispatch 'yonaris-las-v1 probe')"
[[ "$probe" == 'yonaris-las-probe-v1 ok' ]]
[[ "$(printf '%s\n' verify status)" == "$(cat "$EVENT_LOG")" ]]

# Bundle-install journal/temp state is part of the dispatch boundary, but not of
# the generic verifier: the installer must still be able to postverify its own
# candidate while its durable journal exists.
bundle_pending_paths=(
	"$ETC_ROOT/las-stable-bundle-pending-v1"
	"$ETC_ROOT/.las-stable-bundle-pending-v1.new"
	"$ETC_ROOT/.las-stable-bundle-active-v1.active.new"
)
for pending_path in "${bundle_pending_paths[@]}"; do
	: >"$pending_path"
	rm -f -- "$EVENT_LOG"
	set +e
	run_dispatch 'yonaris-las-v1 probe' >"$TEST_ROOT/bundle-pending.out" \
		2>"$TEST_ROOT/bundle-pending.err"
	bundle_pending_status=$?
	set -e
	[[ "$bundle_pending_status" -eq 75 ]]
	grep -Fq 'stable-bundle installation state is pending' "$TEST_ROOT/bundle-pending.err"
	[[ ! -e "$EVENT_LOG" ]] || {
		echo "Pending stable-bundle path reached a privileged peer: $pending_path" >&2
		exit 1
	}
	rm -f -- "$pending_path"
done

# flock conversion is non-atomic. If a bundle journal appears while an ordinary
# command upgrades its shared lock, exclusive revalidation stops before Git or
# any second privileged-peer pass.
rm -f -- "$EVENT_LOG"
DISPATCH_TEST_PENDING_ON_EXCLUSIVE="$ETC_ROOT/las-stable-bundle-pending-v1"
set +e
run_dispatch 'yonaris-las-v1 deploy sha-1111111111111111111111111111111111111111 sha256:1111111111111111111111111111111111111111111111111111111111111111 sha256:2222222222222222222222222222222222222222222222222222222222222222 sha256:3333333333333333333333333333333333333333333333333333333333333333 sha256:4444444444444444444444444444444444444444444444444444444444444444' \
	>"$TEST_ROOT/exclusive-bundle-pending.out" 2>"$TEST_ROOT/exclusive-bundle-pending.err"
exclusive_bundle_pending_status=$?
set -e
unset DISPATCH_TEST_PENDING_ON_EXCLUSIVE
[[ "$exclusive_bundle_pending_status" -eq 75 ]]
[[ "$(printf '%s\n' verify status)" == "$(cat "$EVENT_LOG")" ]]
rm -f -- "$ETC_ROOT/las-stable-bundle-pending-v1"

printf '%s\n' \
	'las-transition-v2' \
	'surface portal' \
	'candidate sha-1111111111111111111111111111111111111111' \
	'predecessor sha-2222222222222222222222222222222222222222' \
	'operation deploy' \
	'web-sha256 sha256:1111111111111111111111111111111111111111111111111111111111111111' \
	'worker-sha256 sha256:2222222222222222222222222222222222222222222222222222222222222222' \
	'migrate-sha256 sha256:3333333333333333333333333333333333333333333333333333333333333333' \
	'postgres-sha256 sha256:4444444444444444444444444444444444444444444444444444444444444444' \
	'www-sha256 sha256:5555555555555555555555555555555555555555555555555555555555555555' \
	'caddy-before none' \
	'caddy-after none' \
	'caddy-backup none' \
	>"$STATUS_FILE"
set +e
run_dispatch 'yonaris-las-v1 probe' >"$TEST_ROOT/pending.out" 2>"$TEST_ROOT/pending.err"
pending_status=$?
run_dispatch 'yonaris-las-v1 deploy sha-1111111111111111111111111111111111111111 sha256:1111111111111111111111111111111111111111111111111111111111111111 sha256:2222222222222222222222222222222222222222222222222222222222222222 sha256:3333333333333333333333333333333333333333333333333333333333333333 sha256:4444444444444444444444444444444444444444444444444444444444444444' \
	>"$TEST_ROOT/pending-deploy.out" 2>"$TEST_ROOT/pending-deploy.err"
pending_deploy_status=$?
set -e
[[ "$pending_status" == 75 && "$pending_deploy_status" == 75 ]]
grep -Fq 'ordinary forced operations fail closed' "$TEST_ROOT/pending.err"
grep -Fq 'ordinary forced operations fail closed' "$TEST_ROOT/pending-deploy.err"

# The sudoers boundary removes startup hooks before this script; the root
# dispatcher also launches every child with env-i/protected Bash.
bash_env_marker="$TEST_ROOT/bash-env-executed"
printf 'touch %q\n' "$bash_env_marker" >"$TEST_ROOT/bash-env"
printf '%s\n' clear >"$STATUS_FILE"
env BASH_ENV="$TEST_ROOT/bash-env" /usr/bin/env -i PATH='/usr/bin:/bin' \
	SSH_ORIGINAL_COMMAND='yonaris-las-v1 probe' \
	DISPATCH_TEST_EVENT_LOG="$EVENT_LOG" DISPATCH_TEST_STATUS_FILE="$STATUS_FILE" \
	REAL_STAT="$REAL_STAT" REAL_READLINK="$REAL_READLINK" \
	/bin/bash --noprofile --norc -p "$DISPATCHER" >/dev/null
[[ ! -e "$bash_env_marker" ]]

# Exercise the real marketing failure branch with isolated stable helpers.  The
# runtime helper models its own restore+verify contract as two distinct events;
# Caddy must not roll back until both have completed, and durable reconciliation
# must remain last.
ROLLBACK_STATE_ROOT="$TEST_ROOT/rollback/var/lib/yonaris"
ROLLBACK_ETC_ROOT="$TEST_ROOT/rollback/etc/yonaris"
ROLLBACK_LOCK_DIRECTORY="$TEST_ROOT/rollback/run/lock/yonaris"
ROLLBACK_SOURCE_GIT="$ROLLBACK_STATE_ROOT/las-objects.git"
ROLLBACK_TREES="$ROLLBACK_STATE_ROOT/las-release-trees"
ROLLBACK_DISPATCHER="$TEST_ROOT/rollback-dispatch"
ROLLBACK_EVENT_LOG="$STABLE_DIRECTORY/rollback-events.log"
ROLLBACK_MODE="$STABLE_DIRECTORY/rollback-mode"
ROLLBACK_GIT="$MOCK_BIN/git"
ROLLBACK_FLOCK="$MOCK_BIN/flock"
CANDIDATE_RELEASE='sha-1111111111111111111111111111111111111111'
PORTAL_RELEASE_VALUE='sha-2222222222222222222222222222222222222222'
MARKETING_RELEASE_VALUE='sha-3333333333333333333333333333333333333333'
WEB='sha256:1111111111111111111111111111111111111111111111111111111111111111'
WORKER='sha256:2222222222222222222222222222222222222222222222222222222222222222'
MIGRATE='sha256:3333333333333333333333333333333333333333333333333333333333333333'
POSTGRES='sha256:4444444444444444444444444444444444444444444444444444444444444444'
WWW='sha256:5555555555555555555555555555555555555555555555555555555555555555'

mkdir -p \
	"$ROLLBACK_SOURCE_GIT" "$ROLLBACK_TREES/$CANDIDATE_RELEASE" \
	"$ROLLBACK_TREES/$PORTAL_RELEASE_VALUE" "$ROLLBACK_TREES/$MARKETING_RELEASE_VALUE" \
	"$ROLLBACK_ETC_ROOT/las-compatible-releases-v2" "$ROLLBACK_LOCK_DIRECTORY"
git init --bare --quiet "$ROLLBACK_SOURCE_GIT"
printf '%s\n' "$PORTAL_RELEASE_VALUE" >"$ROLLBACK_ETC_ROOT/las-active-portal-release-v1"
printf '%s\n' "$MARKETING_RELEASE_VALUE" >"$ROLLBACK_ETC_ROOT/las-active-marketing-release-v1"
printf '%s\n' \
	'artifact-output-language-receipt-v2' \
	"release $PORTAL_RELEASE_VALUE" \
	'web-sha256 sha256:6666666666666666666666666666666666666666666666666666666666666666' \
	'worker-sha256 sha256:7777777777777777777777777777777777777777777777777777777777777777' \
	'migrate-sha256 sha256:8888888888888888888888888888888888888888888888888888888888888888' \
	'postgres-sha256 sha256:9999999999999999999999999999999999999999999999999999999999999999' \
	'www-sha256 sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' \
	>"$ROLLBACK_ETC_ROOT/las-compatible-releases-v2/$PORTAL_RELEASE_VALUE"
printf '%s\n' \
	'artifact-output-language-receipt-v2' \
	"release $MARKETING_RELEASE_VALUE" \
	'web-sha256 sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' \
	'worker-sha256 sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc' \
	'migrate-sha256 sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd' \
	'postgres-sha256 sha256:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' \
	'www-sha256 sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff' \
	>"$ROLLBACK_ETC_ROOT/las-compatible-releases-v2/$MARKETING_RELEASE_VALUE"

cat >"$ROOT_VERIFIER" <<'STUB'
#!/usr/bin/env bash
[[ "$#" -eq 0 ]]
STUB
cat >"$STABLE_DIRECTORY/guard-artifact-output-release" <<'STUB'
#!/usr/bin/env bash
[[ "$1" == candidate && "$2" == sha-1111111111111111111111111111111111111111 && "$3" == marketing-deploy ]] || exit 91
printf '%s\n' 'release-digests-v1 sha-1111111111111111111111111111111111111111 marketing-deploy sha256:1111111111111111111111111111111111111111111111111111111111111111 sha256:2222222222222222222222222222222222222222222222222222222222222222 sha256:3333333333333333333333333333333333333333333333333333333333333333 sha256:4444444444444444444444444444444444444444444444444444444444444444 sha256:5555555555555555555555555555555555555555555555555555555555555555'
STUB
cat >"$STATE_MANAGER" <<'STUB'
#!/usr/bin/env bash
set -Eeuo pipefail
event_log="$(cd -- "$(dirname -- "$0")" && pwd)/rollback-events.log"
case "$1" in
	status) printf '%s\n' clear ;;
	materialize | rollback-evidence) ;;
	begin)
		[[ "$2" == marketing ]] || exit 92
		printf '%s\n' state-begin >>"$event_log"
		;;
	reconcile)
		[[ "$2" == marketing && "$4" == rollback ]] || exit 93
		printf '%s\n' state-reconcile >>"$event_log"
		;;
	*) exit 94 ;;
esac
STUB
cat >"$STABLE_DIRECTORY/manage-las-runtime" <<'STUB'
#!/usr/bin/env bash
set -Eeuo pipefail
stable_directory="$(cd -- "$(dirname -- "$0")" && pwd)"
event_log="$stable_directory/rollback-events.log"
mode="$(cat "$stable_directory/rollback-mode")"
case "$1" in
	marketing-deploy)
		if [[ "$mode" == runtime-failure ]]; then
			printf '%s\n' candidate-deploy-failed >>"$event_log"
			exit 1
		fi
		printf '%s\n' candidate-deployed >>"$event_log"
		;;
	marketing-rollback)
		[[ "$2" == sha-3333333333333333333333333333333333333333 ]] || exit 95
		printf '%s\n' predecessor-restored >>"$event_log"
		printf '%s\n' predecessor-verified >>"$event_log"
		;;
	*) exit 96 ;;
esac
STUB
cat >"$STABLE_DIRECTORY/manage-las-caddy" <<'STUB'
#!/usr/bin/env bash
set -Eeuo pipefail
stable_directory="$(cd -- "$(dirname -- "$0")" && pwd)"
event_log="$stable_directory/rollback-events.log"
mode="$(cat "$stable_directory/rollback-mode")"
case "$1" in
	prepare) printf '%s\n' caddy-prepared >>"$event_log" ;;
	activate)
		[[ "$mode" == caddy-failure ]] || exit 98
		printf '%s\n' caddy-activate-failed >>"$event_log"
		exit 1
		;;
	rollback) printf '%s\n' caddy-rollback >>"$event_log" ;;
	*) exit 97 ;;
esac
STUB
cat >"$ROLLBACK_GIT" <<'STUB'
#!/usr/bin/env bash
set -Eeuo pipefail
if [[ " $* " == *' config --local --no-includes --name-only --get-regexp '* ]]; then
	exec '__REAL_GIT__' "$@"
fi
printf '%s\n' git-object-read >>'__GIT_READ_LOG__'
[[ "${GIT_NO_LAZY_FETCH:-}" == 1 && "${GIT_TERMINAL_PROMPT:-}" == 0 && \
	"${GIT_ASKPASS:-}" == /bin/false && "${SSH_ASKPASS:-}" == /bin/false && \
	" $* " == *' -c credential.helper= '* && \
	" $* " == *' -c protocol.allow=never '* ]] || exit 93
[[ ! -e '__GIT_MISSING__' ]] || exit 94
exit 0
STUB
sed -i \
	-e "s#__REAL_GIT__#$REAL_GIT#g" \
	-e "s#__GIT_READ_LOG__#$TEST_ROOT/rollback-git-reads.log#g" \
	-e "s#__GIT_MISSING__#$TEST_ROOT/rollback-git-missing#g" \
	"$ROLLBACK_GIT"
cat >"$ROLLBACK_FLOCK" <<'STUB'
#!/usr/bin/env bash
exit 0
STUB
cat >"$MOCK_BIN/stat" <<'STUB'
#!/usr/bin/env bash
path="${@: -1}"
case "$path" in
	*/verify-yonaris-las-forced-command | */guard-artifact-output-release | */manage-las-release-state | */manage-las-runtime | */manage-las-caddy) printf '0:0:755\n' ;;
	*/rollback/var/lib/yonaris) printf '0:0:711\n' ;;
	*/las-objects.git) printf '0:0:700\n' ;;
	*/las-release-trees/sha-*) printf '0:0:555\n' ;;
	*/las-active-portal-release-v1 | */las-active-marketing-release-v1 | */las-compatible-releases-v2/sha-*) printf '0:0:644\n' ;;
	*/rollback/run/lock/yonaris) printf '0:0:700\n' ;;
	*) exec "$REAL_STAT" "$@" ;;
esac
STUB
chmod +x "$ROOT_VERIFIER" "$STATE_MANAGER" "$STABLE_DIRECTORY/guard-artifact-output-release" \
	"$STABLE_DIRECTORY/manage-las-runtime" "$STABLE_DIRECTORY/manage-las-caddy" \
	"$ROLLBACK_GIT" "$ROLLBACK_FLOCK" "$MOCK_BIN/stat"

sed \
	-e "s#/usr/local/libexec/yonaris-las#$STABLE_DIRECTORY#g" \
	-e "s#/usr/local/sbin/verify-yonaris-las-forced-command#$ROOT_VERIFIER#g" \
	-e "s#/var/lib/yonaris#$ROLLBACK_STATE_ROOT#g" \
	-e "s#/etc/yonaris#$ROLLBACK_ETC_ROOT#g" \
	-e "s#/run/lock/yonaris#$ROLLBACK_LOCK_DIRECTORY#g" \
	-e "s#/usr/bin/id#$MOCK_BIN/id#g" \
	-e "s#/usr/bin/stat#$MOCK_BIN/stat#g" \
	-e "s#/usr/bin/readlink#$MOCK_BIN/readlink#g" \
	-e "s#/usr/bin/git#$ROLLBACK_GIT#g" \
	-e "s#/usr/bin/flock#$ROLLBACK_FLOCK#g" \
	"$DISPATCHER_SOURCE" >"$ROLLBACK_DISPATCHER"
chmod 0755 "$ROLLBACK_DISPATCHER"

# A forced command rejects repository-local network configuration before the
# first object read or durable/runtime/Caddy mutation.
git --git-dir="$ROLLBACK_SOURCE_GIT" config remote.audit.url \
	'https://git.invalid/yonaris.git'
: >"$ROLLBACK_EVENT_LOG"
: >"$TEST_ROOT/rollback-git-reads.log"
set +e
env -i PATH='/usr/bin:/bin' HOME='/nonexistent' \
	SSH_ORIGINAL_COMMAND="yonaris-las-v1 marketing-deploy $CANDIDATE_RELEASE $WWW" \
	REAL_STAT="$REAL_STAT" REAL_READLINK="$REAL_READLINK" \
	/bin/bash --noprofile --norc -p "$ROLLBACK_DISPATCHER" \
	>"$TEST_ROOT/remote-config.out" 2>"$TEST_ROOT/remote-config.err"
remote_config_status=$?
set -e
[[ "$remote_config_status" -ne 0 && ! -s "$TEST_ROOT/rollback-git-reads.log" && \
	! -s "$ROLLBACK_EVENT_LOG" ]] || {
	echo 'Dispatcher reached a Git object read or mutation with remote config present.' >&2
	exit 1
}
git --git-dir="$ROLLBACK_SOURCE_GIT" config --remove-section remote.audit

# A missing exact object fails locally; no helper may manufacture it through a
# credential prompt, lazy fetch, or alternate object database.
touch "$TEST_ROOT/rollback-git-missing"
: >"$ROLLBACK_EVENT_LOG"
: >"$TEST_ROOT/rollback-git-reads.log"
set +e
env -i PATH='/usr/bin:/bin' HOME='/nonexistent' \
	SSH_ORIGINAL_COMMAND="yonaris-las-v1 marketing-deploy $CANDIDATE_RELEASE $WWW" \
	REAL_STAT="$REAL_STAT" REAL_READLINK="$REAL_READLINK" \
	/bin/bash --noprofile --norc -p "$ROLLBACK_DISPATCHER" \
	>"$TEST_ROOT/missing-object.out" 2>"$TEST_ROOT/missing-object.err"
missing_object_status=$?
set -e
rm -f "$TEST_ROOT/rollback-git-missing"
[[ "$missing_object_status" -ne 0 && ! -s "$ROLLBACK_EVENT_LOG" ]] || {
	echo 'Dispatcher mutated state after an exact Git object read failed locally.' >&2
	exit 1
}

printf '%s\n' runtime-failure >"$ROLLBACK_MODE"
: >"$ROLLBACK_EVENT_LOG"
set +e
env -i PATH='/usr/bin:/bin' HOME='/nonexistent' \
	SSH_ORIGINAL_COMMAND="yonaris-las-v1 marketing-deploy $CANDIDATE_RELEASE $WWW" \
	REAL_STAT="$REAL_STAT" REAL_READLINK="$REAL_READLINK" \
	/bin/bash --noprofile --norc -p "$ROLLBACK_DISPATCHER" \
	>"$TEST_ROOT/rollback.out" 2>"$TEST_ROOT/rollback.err"
rollback_status=$?
set -e
[[ "$rollback_status" == 1 ]]
expected_rollback_events="$(printf '%s\n' \
	state-begin caddy-prepared candidate-deploy-failed predecessor-restored \
	predecessor-verified caddy-rollback state-reconcile)"
[[ "$(cat "$ROLLBACK_EVENT_LOG")" == "$expected_rollback_events" ]] || {
	echo 'Marketing failure touched Caddy before predecessor restore+verify completed.' >&2
	cat "$ROLLBACK_EVENT_LOG" >&2
	exit 1
}

printf '%s\n' caddy-failure >"$ROLLBACK_MODE"
: >"$ROLLBACK_EVENT_LOG"
set +e
env -i PATH='/usr/bin:/bin' HOME='/nonexistent' \
	SSH_ORIGINAL_COMMAND="yonaris-las-v1 marketing-deploy $CANDIDATE_RELEASE $WWW" \
	REAL_STAT="$REAL_STAT" REAL_READLINK="$REAL_READLINK" \
	/bin/bash --noprofile --norc -p "$ROLLBACK_DISPATCHER" \
	>"$TEST_ROOT/caddy-rollback.out" 2>"$TEST_ROOT/caddy-rollback.err"
caddy_failure_status=$?
set -e
[[ "$caddy_failure_status" == 1 ]]
expected_caddy_failure_events="$(printf '%s\n' \
	state-begin caddy-prepared candidate-deployed caddy-activate-failed \
	predecessor-restored predecessor-verified caddy-rollback state-reconcile)"
[[ "$(cat "$ROLLBACK_EVENT_LOG")" == "$expected_caddy_failure_events" ]] || {
	echo 'Caddy activation failure rolled routing back before predecessor restore+verify.' >&2
	cat "$ROLLBACK_EVENT_LOG" >&2
	exit 1
}

bash "$SCRIPT_DIR/dispatch-las-bundle-pointer-race.test.sh"

echo 'stable root dispatcher protocol, immutable execution, and pending-journal tests passed'
