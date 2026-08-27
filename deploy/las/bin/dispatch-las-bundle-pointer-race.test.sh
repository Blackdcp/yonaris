#!/usr/bin/env bash

set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
SOURCE="$SCRIPT_DIR/dispatch-las-command.sh"
TEST_ROOT="$(mktemp -d)"
RELEASE_FILE="$TEST_ROOT/release-holder"
holder_pid=''
dispatcher_pid=''
cleanup() {
	: >"$RELEASE_FILE" 2>/dev/null || true
	[[ -z "$holder_pid" ]] || kill "$holder_pid" >/dev/null 2>&1 || true
	[[ -z "$dispatcher_pid" ]] || kill "$dispatcher_pid" >/dev/null 2>&1 || true
	[[ -z "$holder_pid" ]] || wait "$holder_pid" >/dev/null 2>&1 || true
	[[ -z "$dispatcher_pid" ]] || wait "$dispatcher_pid" >/dev/null 2>&1 || true
	rm -rf -- "$TEST_ROOT"
}
trap cleanup EXIT

STABLE_ROOT="$TEST_ROOT/usr/local/libexec/yonaris-las"
BUNDLES="$STABLE_ROOT/bundles"
ETC_ROOT="$TEST_ROOT/etc/yonaris"
LOCK_DIRECTORY="$TEST_ROOT/run/lock/yonaris"
MOCK_BIN="$TEST_ROOT/mock-bin"
EVENT_LOG="$TEST_ROOT/events.log"
HOLDER_READY="$TEST_ROOT/holder-ready"
WAITER_READY="$TEST_ROOT/waiter-ready"
EXCLUSIVE_HELD="$TEST_ROOT/exclusive-held"
ACTIVE_POINTER="$ETC_ROOT/las-stable-bundle-active-v1"
CANDIDATE_ID='sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
PREDECESSOR_ID='sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
CANDIDATE_BUNDLE="$BUNDLES/sha256-${CANDIDATE_ID#sha256:}"
PREDECESSOR_BUNDLE="$BUNDLES/sha256-${PREDECESSOR_ID#sha256:}"
DISPATCHER="$CANDIDATE_BUNDLE/dispatch-las-command"
REAL_STAT="$(command -v stat)"
REAL_READLINK="$(command -v readlink)"

mkdir -p "$CANDIDATE_BUNDLE" "$PREDECESSOR_BUNDLE" "$ETC_ROOT" \
	"$LOCK_DIRECTORY" "$MOCK_BIN"

cat >"$CANDIDATE_BUNDLE/stable-peer" <<'STUB'
#!/usr/bin/env bash
printf '%s\n' "${0##*/} $*" >>'__EVENT_LOG__'
if [[ "${0##*/}" == manage-las-release-state && "${1:-}" == status ]]; then
	printf '%s\n' clear
fi
STUB
sed -i "s#__EVENT_LOG__#$EVENT_LOG#g" "$CANDIDATE_BUNDLE/stable-peer"
for peer in verify-yonaris-las-forced-command guard-artifact-output-release \
	manage-las-release-state manage-las-runtime manage-las-caddy; do
	cp -- "$CANDIDATE_BUNDLE/stable-peer" "$CANDIDATE_BUNDLE/$peer"
done
cat >"$MOCK_BIN/id" <<'STUB'
#!/usr/bin/env bash
[[ "$*" == -u ]] || exit 2
printf '%s\n' 0
STUB
cat >"$MOCK_BIN/stat" <<'STUB'
#!/usr/bin/env bash
format="${2:-}"; path="${@: -1}"
case "$path" in
	*/etc/yonaris/las-stable-bundle-active-v1)
		if [[ "$format" == '%h' ]]; then printf '%s\n' 1; else printf '%s\n' '0:0:600'; fi
		;;
	*/run/lock/yonaris) printf '%s\n' '0:0:700' ;;
	*/verify-yonaris-las-forced-command | */manage-las-release-state | \
	*/guard-artifact-output-release | */manage-las-runtime | */manage-las-caddy)
		printf '%s\n' '0:0:755'
		;;
	*) exec "$REAL_STAT" "$@" ;;
esac
STUB
cat >"$MOCK_BIN/readlink" <<'STUB'
#!/usr/bin/env bash
exec "$REAL_READLINK" "$@"
STUB
cat >"$MOCK_BIN/flock" <<'STUB'
#!/usr/bin/env bash
if [[ "${1:-}" == --shared ]]; then
	printf '%s\n' waiting >'__WAITER_READY__'
	for _ in {1..500}; do
		[[ -d '__EXCLUSIVE_HELD__' ]] || exit 0
		/usr/bin/sleep 0.01
	done
	exit 99
fi
exit 0
STUB
sed -i \
	-e "s#__WAITER_READY__#$WAITER_READY#g" \
	-e "s#__EXCLUSIVE_HELD__#$EXCLUSIVE_HELD#g" \
	"$MOCK_BIN/flock"
chmod +x "$CANDIDATE_BUNDLE"/* "$MOCK_BIN"/*

sed \
	-e "s#/usr/local/libexec/yonaris-las#$STABLE_ROOT#g" \
	-e "s#/etc/yonaris#$ETC_ROOT#g" \
	-e "s#/run/lock/yonaris#$LOCK_DIRECTORY#g" \
	-e "s#/usr/bin/id#$MOCK_BIN/id#g" \
	-e "s#/usr/bin/stat#$MOCK_BIN/stat#g" \
	-e "s#/usr/bin/readlink#$MOCK_BIN/readlink#g" \
	-e "s#/usr/bin/flock#$MOCK_BIN/flock#g" \
	"$SOURCE" >"$DISPATCHER"
chmod 0755 "$DISPATCHER"

write_pointer() {
	local id="$1" temporary="$ETC_ROOT/.las-stable-bundle-active-v1.new"
	printf '%s\n' 'yonaris-las-stable-bundle-v1' "bundle-id $id" >"$temporary"
	mv -f -- "$temporary" "$ACTIVE_POINTER"
}

wait_for_file() {
	local path="$1"
	for _ in {1..500}; do
		[[ ! -e "$path" ]] || return 0
		/usr/bin/sleep 0.01
	done
	return 1
}

run_pointer_rollback_race() {
	local label="$1" command="$2" status
	rm -f -- "$EVENT_LOG" "$HOLDER_READY" "$WAITER_READY" "$RELEASE_FILE"
	write_pointer "$CANDIDATE_ID"
	(
		mkdir "$EXCLUSIVE_HELD"
		printf '%s\n' ready >"$HOLDER_READY"
		for _ in {1..500}; do
			if [[ -e "$RELEASE_FILE" ]]; then
				rmdir "$EXCLUSIVE_HELD"
				exit 0
			fi
			/usr/bin/sleep 0.01
		done
		rmdir "$EXCLUSIVE_HELD"
		exit 99
	) &
	holder_pid=$!
	wait_for_file "$HOLDER_READY"
	env -i PATH='/usr/bin:/bin' HOME='/nonexistent' \
		LAS_STABLE_BUNDLE_DIR="$CANDIDATE_BUNDLE" \
		SSH_ORIGINAL_COMMAND="$command" \
		REAL_STAT="$REAL_STAT" REAL_READLINK="$REAL_READLINK" \
		/bin/bash --noprofile --norc -p "$DISPATCHER" \
		>"$TEST_ROOT/$label.out" 2>"$TEST_ROOT/$label.err" &
	dispatcher_pid=$!
	wait_for_file "$WAITER_READY"
	kill -0 "$dispatcher_pid"
	[[ ! -s "$EVENT_LOG" ]]
	write_pointer "$PREDECESSOR_ID"
	printf '%s\n' release >"$RELEASE_FILE"
	wait "$holder_pid"
	holder_pid=''
	set +e
	wait "$dispatcher_pid"
	status=$?
	set -e
	dispatcher_pid=''
	[[ "$status" -ne 0 ]]
	grep -Fq 'active LAS bundle pointer no longer matches the inherited launcher pin' \
		"$TEST_ROOT/$label.err"
	[[ ! -s "$EVENT_LOG" ]] || {
		echo "Stale bundle $label reached a privileged stable peer after pointer rollback." >&2
		cat "$EVENT_LOG" >&2
		exit 1
	}
}

run_pointer_rollback_race probe 'yonaris-las-v1 probe'
run_pointer_rollback_race deploy \
	'yonaris-las-v1 deploy sha-1111111111111111111111111111111111111111 sha256:1111111111111111111111111111111111111111111111111111111111111111 sha256:2222222222222222222222222222222222222222222222222222222222222222 sha256:3333333333333333333333333333333333333333333333333333333333333333 sha256:4444444444444444444444444444444444444444444444444444444444444444'

echo 'stable bundle pointer rollback race tests passed'
