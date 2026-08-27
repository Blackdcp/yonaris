#!/bin/bash

set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PRODUCER_SOURCE="$SCRIPT_DIR/produce-las-migration-readiness.sh"
TEST_ROOT="$(mktemp -d)"
trap 'chmod -R u+w "$TEST_ROOT" 2>/dev/null || true; rm -rf -- "$TEST_ROOT"' EXIT

[[ -f "$PRODUCER_SOURCE" ]] || {
	echo 'The migration-readiness producer is missing.' >&2
	exit 1
}

TRUST_DIRECTORY="$TEST_ROOT/etc/yonaris"
READINESS_ROOT="$TRUST_DIRECTORY/las-migration-readiness-v1"
EVIDENCE_ROOT="$TRUST_DIRECTORY/las-migration-evidence-v1"
STATE_DIRECTORY="$TEST_ROOT/var/lib/yonaris"
WORK_ROOT="$STATE_DIRECTORY/migration-readiness-work-v1"
LOCK_DIRECTORY="$TEST_ROOT/run/lock/yonaris"
STABLE_DIRECTORY="$TEST_ROOT/usr/local/libexec/yonaris-las"
STATE_MANAGER="$STABLE_DIRECTORY/manage-las-release-state"
RUNTIME_MANAGER="$STABLE_DIRECTORY/manage-las-runtime"
ADAPTER="$STABLE_DIRECTORY/store-las-migration-backup"
PRODUCER="$STABLE_DIRECTORY/produce-las-migration-readiness"
MOCK_BIN="$TEST_ROOT/mock-bin"
EVENT_LOG="$TEST_ROOT/events.log"
REAL_STAT="$(command -v stat)"
REAL_MV="$(command -v mv)"
RELEASE='sha-0123456789abcdef0123456789abcdef01234567'
WEB='sha256:1111111111111111111111111111111111111111111111111111111111111111'
WORKER='sha256:2222222222222222222222222222222222222222222222222222222222222222'
MIGRATE='sha256:3333333333333333333333333333333333333333333333333333333333333333'
POSTGRES='sha256:4444444444444444444444444444444444444444444444444444444444444444'
WWW='sha256:5555555555555555555555555555555555555555555555555555555555555555'

mkdir -p "$READINESS_ROOT" "$EVIDENCE_ROOT" "$STATE_DIRECTORY" "$LOCK_DIRECTORY" \
	"$STABLE_DIRECTORY" "$MOCK_BIN"
chmod 0700 "$READINESS_ROOT" "$EVIDENCE_ROOT" "$LOCK_DIRECTORY"
chmod 0711 "$STATE_DIRECTORY"

cat >"$STATE_MANAGER" <<STUB
#!/usr/bin/env bash
set -Eeuo pipefail
printf 'state %s\n' "\$*" >>'$EVENT_LOG'
release='$RELEASE'; web='$WEB'; worker='$WORKER'; migrate='$MIGRATE'; postgres='$POSTGRES'; www='$WWW'
[[ "\${2:-}" == "\$release" && "\${3:-}" == "\$web" && "\${4:-}" == "\$worker" && \
	"\${5:-}" == "\$migrate" && "\${6:-}" == "\$postgres" && "\${7:-}" == "\$www" ]] || exit 2
case "\${1:-}" in
	migration-readiness-runtime-authorization)
		[[ \$# -eq 7 && ! -e '$TEST_ROOT/state-fail' ]] || exit 1
		printf '%s\n' 'las-migration-readiness-runtime-authorization-v1 ok'
		;;
	migration-readiness)
		[[ \$# -eq 7 ]] || exit 2
		attestation='$READINESS_ROOT/'"\$release"
		backup='$EVIDENCE_ROOT/'"\$release"'.backup'
		rehearsal='$EVIDENCE_ROOT/'"\$release"'.rehearsal'
		[[ -f "\$attestation" && -f "\$backup" && -f "\$rehearsal" ]] || exit 1
		mapfile -t lines <"\$attestation"
		[[ "\${#lines[@]}" -eq 9 && "\${lines[0]}" == las-migration-readiness-v1 && \
			"\${lines[1]}" == "release \$release" && "\${lines[2]}" == "web-sha256 \$web" && \
			"\${lines[3]}" == "worker-sha256 \$worker" && "\${lines[4]}" == "migrate-sha256 \$migrate" && \
			"\${lines[5]}" == "postgres-sha256 \$postgres" && "\${lines[6]}" == "www-sha256 \$www" ]] || exit 1
		backup_hash="\$(sha256sum -- "\$backup" | awk '{print \$1}')"
		rehearsal_hash="\$(sha256sum -- "\$rehearsal" | awk '{print \$1}')"
		[[ "\${lines[7]}" == "backup-evidence-sha256 \$backup_hash" && \
			"\${lines[8]}" == "rehearsal-evidence-sha256 \$rehearsal_hash" ]] || exit 1
		printf '%s\n' 'las-migration-readiness-v1 ok'
		;;
	*) exit 2 ;;
esac
STUB

cat >"$RUNTIME_MANAGER" <<STUB
#!/usr/bin/env bash
set -Eeuo pipefail
printf 'runtime %s\n' "\$*" >>'$EVENT_LOG'
release='$RELEASE'; web='$WEB'; worker='$WORKER'; migrate='$MIGRATE'; postgres='$POSTGRES'; www='$WWW'
case "\${1:-}" in
	migration-backup)
		[[ \$# -eq 9 && "\$2" == "\$release" && "\$3" == "\$web" && "\$4" == "\$worker" && \
			"\$5" == "\$migrate" && "\$6" == "\$postgres" && "\$7" == "\$www" && \
			"\$9" == migration-readiness-runtime-v1 && ! -e '$TEST_ROOT/runtime-backup-fail' ]] || exit 1
		printf '%s\n' 'PGDMP-database-secret-bytes' >"\$8"
		chmod 0600 "\$8"
		;;
	migration-rehearse)
		[[ \$# -eq 10 && "\$2" == "\$release" && "\$3" == "\$web" && "\$4" == "\$worker" && \
			"\$5" == "\$migrate" && "\$6" == "\$postgres" && "\$7" == "\$www" && \
			"\${10}" == migration-readiness-runtime-v1 && ! -e '$TEST_ROOT/runtime-rehearsal-fail' ]] || exit 1
		[[ "\$(cat -- "\$8")" == 'PGDMP-database-secret-bytes' ]] || exit 1
		printf '%s\n' 'las-migration-rehearsal-runtime-v1 ok' >"\$9"
		chmod 0600 "\$9"
		;;
	*) exit 2 ;;
esac
STUB

cat >"$ADAPTER" <<STUB
#!/usr/bin/env bash
set -Eeuo pipefail
printf 'adapter %s\n' "\$*" >>'$EVENT_LOG'
[[ \$# -eq 5 && "\$1" == put-get && "\$2" == '$RELEASE' && "\$3" =~ ^[0-9a-f]{64}$ && \
	-f "\$4" && "\$(stat -c '%a' -- "\$4")" == 600 && \
	"\$3" == "\$(sha256sum -- "\$4" | awk '{print \$1}')" ]] || exit 2
if [[ -e '$TEST_ROOT/adapter-byte-change' ]]; then
	printf '%s\n' 'changed-off-host-bytes' >"\$5"
else
	cp -- "\$4" "\$5"
fi
chmod 0600 "\$5"
STUB

cat >"$MOCK_BIN/id" <<'STUB'
#!/usr/bin/env bash
[[ "$*" == -u ]] || exit 2
printf '%s\n' "${PRODUCER_TEST_UID:-0}"
STUB
cat >"$MOCK_BIN/chown" <<'STUB'
#!/usr/bin/env bash
exit 0
STUB
cat >"$MOCK_BIN/stat" <<STUB
#!/usr/bin/env bash
set -Eeuo pipefail
format="\${2:-}"
path="\${@: -1}"
if [[ "\$format" == '%h' ]]; then exec '$REAL_STAT' "\$@"; fi
mode="\$('$REAL_STAT' -c '%a' -- "\$path")"
if [[ "\$format" == '%u:%g:%a' ]]; then
	case "\$path" in
		'$TRUST_DIRECTORY') mode=755 ;;
		'$STATE_DIRECTORY') mode=711 ;;
		'$LOCK_DIRECTORY' | '$READINESS_ROOT' | '$EVIDENCE_ROOT') mode=700 ;;
		'$WORK_ROOT' | '$WORK_ROOT/'*) [[ -d "\$path" ]] && mode=700 ;;
		'$STATE_MANAGER' | '$RUNTIME_MANAGER' | '$ADAPTER') mode=755 ;;
		'$READINESS_ROOT/sha-'* | '$EVIDENCE_ROOT/sha-'*.backup | \
			'$EVIDENCE_ROOT/sha-'*.rehearsal) mode=400 ;;
	esac
	if [[ "\$path" == '$ADAPTER' && -e '$TEST_ROOT/adapter-metadata-bad' ]]; then mode=700; fi
	printf '%s\n' "0:0:\$mode"
else
	exec '$REAL_STAT' "\$@"
fi
STUB
cat >"$MOCK_BIN/flock" <<STUB
#!/usr/bin/env bash
printf 'flock %s\n' "\$*" >>'$EVENT_LOG'
[[ ! -e '$TEST_ROOT/lock-fail' ]]
STUB
cat >"$MOCK_BIN/sync" <<STUB
#!/usr/bin/env bash
printf 'sync %s\n' "\$*" >>'$EVENT_LOG'
[[ ! -e '$TEST_ROOT/sync-fail' ]]
STUB
cat >"$MOCK_BIN/mv" <<STUB
#!/usr/bin/env bash
set -Eeuo pipefail
destination="\${@: -1}"
printf 'mv %s\n' "\$*" >>'$EVENT_LOG'
if [[ -e '$TEST_ROOT/mv-fail' && "\$destination" == *.backup ]]; then exit 91; fi
exec '$REAL_MV' "\$@"
STUB
chmod 0755 "$STATE_MANAGER" "$RUNTIME_MANAGER" "$ADAPTER" "$MOCK_BIN"/*

sed \
	-e "s#/etc/yonaris#$TRUST_DIRECTORY#g" \
	-e "s#/var/lib/yonaris#$STATE_DIRECTORY#g" \
	-e "s#/run/lock/yonaris#$LOCK_DIRECTORY#g" \
	-e "s#/usr/local/libexec/yonaris-las#$STABLE_DIRECTORY#g" \
	-e "s#/usr/bin/id#$MOCK_BIN/id#g" \
	-e "s#/usr/bin/chown#$MOCK_BIN/chown#g" \
	-e "s#/usr/bin/stat#$MOCK_BIN/stat#g" \
	-e "s#/usr/bin/flock#$MOCK_BIN/flock#g" \
	-e "s#/usr/bin/sync#$MOCK_BIN/sync#g" \
	-e "s#/usr/bin/mv#$MOCK_BIN/mv#g" \
	"$PRODUCER_SOURCE" >"$PRODUCER"
chmod 0755 "$PRODUCER"

run_producer() {
	env -i PATH='/usr/bin:/bin' HOME='/nonexistent' \
		PRODUCER_TEST_UID="${PRODUCER_TEST_UID:-0}" SUDO_USER="${PRODUCER_TEST_SUDO_USER:-}" \
		/bin/bash --noprofile --norc -p "$PRODUCER" "$@"
}

run_manager() {
	env -i PATH='/usr/bin:/bin' HOME='/nonexistent' \
		/bin/bash --noprofile --norc -p "$STATE_MANAGER" "$@"
}

assert_no_runtime_or_adapter() {
	! grep -Eq '^(runtime|adapter) ' "$EVENT_LOG" 2>/dev/null
}

assert_no_evidence() {
	[[ ! -e "$READINESS_ROOT/$RELEASE" && ! -e "$EVIDENCE_ROOT/$RELEASE.backup" && \
		! -e "$EVIDENCE_ROOT/$RELEASE.rehearsal" ]]
}

assert_work_clean() {
	[[ ! -d "$WORK_ROOT/$RELEASE" ]] || \
		[[ -z "$(find "$WORK_ROOT/$RELEASE" -mindepth 1 -print -quit 2>/dev/null)" ]]
}

: >"$EVENT_LOG"
set +e
run_producer "$RELEASE" "$WEB" "$WORKER" "$MIGRATE" "$POSTGRES" >/dev/null 2>&1
short_arity_status=$?
run_producer "$RELEASE" "$WEB" "$WORKER" "$MIGRATE" "$POSTGRES" "$WWW" extra >/dev/null 2>&1
long_arity_status=$?
run_producer "$RELEASE" bad "$WORKER" "$MIGRATE" "$POSTGRES" "$WWW" >/dev/null 2>&1
invalid_digest_status=$?
set -e
[[ "$short_arity_status" -eq 2 && "$long_arity_status" -eq 2 && "$invalid_digest_status" -eq 2 ]]
assert_no_runtime_or_adapter

: >"$EVENT_LOG"
PRODUCER_TEST_UID=1001
set +e
run_producer "$RELEASE" "$WEB" "$WORKER" "$MIGRATE" "$POSTGRES" "$WWW" >/dev/null 2>&1
nonroot_status=$?
set -e
unset PRODUCER_TEST_UID
[[ "$nonroot_status" -ne 0 ]]
assert_no_runtime_or_adapter

: >"$EVENT_LOG"
PRODUCER_TEST_SUDO_USER=operator
set +e
run_producer "$RELEASE" "$WEB" "$WORKER" "$MIGRATE" "$POSTGRES" "$WWW" >/dev/null 2>&1
sudo_status=$?
set -e
unset PRODUCER_TEST_SUDO_USER
[[ "$sudo_status" -ne 0 ]]
assert_no_runtime_or_adapter

: >"$EVENT_LOG"
touch "$TEST_ROOT/state-fail"
set +e
run_producer "$RELEASE" "$WEB" "$WORKER" "$MIGRATE" "$POSTGRES" "$WWW" >/dev/null 2>&1
state_status=$?
set -e
rm -f "$TEST_ROOT/state-fail"
[[ "$state_status" -ne 0 ]]
assert_no_runtime_or_adapter

: >"$EVENT_LOG"
touch "$TEST_ROOT/adapter-metadata-bad"
set +e
run_producer "$RELEASE" "$WEB" "$WORKER" "$MIGRATE" "$POSTGRES" "$WWW" >/dev/null 2>&1
adapter_metadata_status=$?
set -e
rm -f "$TEST_ROOT/adapter-metadata-bad"
[[ "$adapter_metadata_status" -ne 0 ]]
assert_no_runtime_or_adapter

: >"$EVENT_LOG"
touch "$TEST_ROOT/lock-fail"
set +e
run_producer "$RELEASE" "$WEB" "$WORKER" "$MIGRATE" "$POSTGRES" "$WWW" >/dev/null 2>&1
lock_status=$?
set -e
rm -f "$TEST_ROOT/lock-fail"
[[ "$lock_status" -ne 0 ]]
assert_no_runtime_or_adapter

: >"$EVENT_LOG"
touch "$TEST_ROOT/adapter-byte-change"
set +e
run_producer "$RELEASE" "$WEB" "$WORKER" "$MIGRATE" "$POSTGRES" "$WWW" >/dev/null 2>"$TEST_ROOT/round-trip.err"
round_trip_status=$?
set -e
rm -f "$TEST_ROOT/adapter-byte-change"
[[ "$round_trip_status" -ne 0 ]]
grep -Fq "runtime migration-backup $RELEASE $WEB $WORKER $MIGRATE $POSTGRES $WWW" "$EVENT_LOG" || {
	cat "$TEST_ROOT/round-trip.err" >&2
	cat "$EVENT_LOG" >&2
	exit 1
}
grep -Fq "adapter put-get $RELEASE " "$EVENT_LOG"
! grep -Fq 'runtime migration-rehearse' "$EVENT_LOG"
assert_no_evidence
assert_work_clean

: >"$EVENT_LOG"
touch "$TEST_ROOT/runtime-rehearsal-fail"
set +e
run_producer "$RELEASE" "$WEB" "$WORKER" "$MIGRATE" "$POSTGRES" "$WWW" >/dev/null 2>&1
runtime_status=$?
set -e
rm -f "$TEST_ROOT/runtime-rehearsal-fail"
[[ "$runtime_status" -ne 0 ]]
grep -Fq 'runtime migration-rehearse' "$EVENT_LOG"
assert_no_evidence
assert_work_clean

: >"$EVENT_LOG"
touch "$TEST_ROOT/mv-fail"
set +e
run_producer "$RELEASE" "$WEB" "$WORKER" "$MIGRATE" "$POSTGRES" "$WWW" >/dev/null 2>&1
atomic_status=$?
set -e
rm -f "$TEST_ROOT/mv-fail"
[[ "$atomic_status" -ne 0 ]]
assert_no_evidence
assert_work_clean

printf '%s\n' 'operator-owned conflicting evidence' >"$EVIDENCE_ROOT/$RELEASE.backup"
chmod 0400 "$EVIDENCE_ROOT/$RELEASE.backup"
: >"$EVENT_LOG"
set +e
run_producer "$RELEASE" "$WEB" "$WORKER" "$MIGRATE" "$POSTGRES" "$WWW" >/dev/null 2>&1
conflict_status=$?
set -e
[[ "$conflict_status" -ne 0 ]]
grep -Fqx 'operator-owned conflicting evidence' "$EVIDENCE_ROOT/$RELEASE.backup"
assert_no_runtime_or_adapter
rm -f "$EVIDENCE_ROOT/$RELEASE.backup"

: >"$EVENT_LOG"
run_producer "$RELEASE" "$WEB" "$WORKER" "$MIGRATE" "$POSTGRES" "$WWW"
[[ "$(run_manager migration-readiness "$RELEASE" "$WEB" "$WORKER" "$MIGRATE" "$POSTGRES" "$WWW")" == \
	'las-migration-readiness-v1 ok' ]]
[[ "$("$MOCK_BIN/stat" -c '%u:%g:%a' -- "$EVIDENCE_ROOT/$RELEASE.backup")" == 0:0:400 && \
	"$("$MOCK_BIN/stat" -c '%u:%g:%a' -- "$EVIDENCE_ROOT/$RELEASE.rehearsal")" == 0:0:400 && \
	"$("$MOCK_BIN/stat" -c '%u:%g:%a' -- "$READINESS_ROOT/$RELEASE")" == 0:0:400 ]]
[[ "$(wc -l <"$READINESS_ROOT/$RELEASE")" -eq 9 ]]
if grep -ERq 'database-secret|yonaris_rehearsal|DATABASE_URL|POSTGRES_' \
	"$EVIDENCE_ROOT/$RELEASE.backup" "$EVIDENCE_ROOT/$RELEASE.rehearsal" "$READINESS_ROOT/$RELEASE"; then
	echo 'Published migration-readiness evidence contains secret or database content.' >&2
	exit 1
fi
grep -Fq "flock --exclusive --wait 1800 9" "$EVENT_LOG"
assert_work_clean

runtime_count="$(grep -c '^runtime ' "$EVENT_LOG")"
adapter_count="$(grep -c '^adapter ' "$EVENT_LOG")"
run_producer "$RELEASE" "$WEB" "$WORKER" "$MIGRATE" "$POSTGRES" "$WWW"
[[ "$(grep -c '^runtime ' "$EVENT_LOG")" -eq "$runtime_count" && \
	"$(grep -c '^adapter ' "$EVENT_LOG")" -eq "$adapter_count" ]]

echo 'root-owned migration readiness producer tests passed'
