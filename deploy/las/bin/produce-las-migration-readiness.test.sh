#!/bin/bash

set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PRODUCER_SOURCE="$SCRIPT_DIR/produce-las-migration-readiness.sh"

grep -Fq "MIGRATION_READINESS_ROOT='/etc/yonaris/las-migration-readiness-v2'" "$PRODUCER_SOURCE"
grep -Fq 'las-migration-readiness-v2' "$PRODUCER_SOURCE"
grep -Fq 'migration-readiness-runtime-v2' "$PRODUCER_SOURCE"
if grep -Eq 'WWW|www-sha256|five digests|las-migration-readiness-v1' "$PRODUCER_SOURCE"; then
	echo 'Migration-readiness producer still exposes the retired fifth digest or v1 evidence.' >&2
	exit 1
fi
TEST_ROOT="$(mktemp -d)"
trap 'chmod -R u+w "$TEST_ROOT" 2>/dev/null || true; rm -rf -- "$TEST_ROOT"' EXIT

[[ -f "$PRODUCER_SOURCE" ]] || {
	echo 'The migration-readiness producer is missing.' >&2
	exit 1
}

TRUST_DIRECTORY="$TEST_ROOT/etc/yonaris"
READINESS_ROOT="$TRUST_DIRECTORY/las-migration-readiness-v2"
EVIDENCE_ROOT="$TRUST_DIRECTORY/las-migration-evidence-v2"
STATE_DIRECTORY="$TEST_ROOT/var/lib/yonaris"
WORK_ROOT="$STATE_DIRECTORY/migration-readiness-work-v2"
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
REAL_RM="$(command -v rm)"
RELEASE='sha-0123456789abcdef0123456789abcdef01234567'
COMPLETION_TIMESTAMP='2026-08-28T04:00:00Z'
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
release='$RELEASE'; web='$WEB'; worker='$WORKER'; migrate='$MIGRATE'; postgres='$POSTGRES'
[[ "\${2:-}" == "\$release" && "\${3:-}" == "\$web" && "\${4:-}" == "\$worker" && \
	"\${5:-}" == "\$migrate" && "\${6:-}" == "\$postgres" ]] || exit 2
case "\${1:-}" in
	migration-readiness-runtime-authorization)
		[[ \$# -eq 6 && ! -e '$TEST_ROOT/state-fail' ]] || exit 1
		printf '%s\n' 'las-migration-readiness-runtime-authorization-v2 ok'
		;;
	migration-readiness)
		[[ \$# -eq 6 ]] || exit 2
		attestation='$READINESS_ROOT/'"\$release"
		backup='$EVIDENCE_ROOT/'"\$release"'.backup'
		rehearsal='$EVIDENCE_ROOT/'"\$release"'.rehearsal'
		[[ -f "\$attestation" && -f "\$backup" && -f "\$rehearsal" ]] || exit 1
		mapfile -t lines <"\$attestation"
		[[ "\${#lines[@]}" -eq 8 && "\${lines[0]}" == las-migration-readiness-v2 && \
			"\${lines[1]}" == "release \$release" && "\${lines[2]}" == "web-sha256 \$web" && \
			"\${lines[3]}" == "worker-sha256 \$worker" && "\${lines[4]}" == "migrate-sha256 \$migrate" && \
			"\${lines[5]}" == "postgres-sha256 \$postgres" ]] || exit 1
		backup_hash="\$(sha256sum -- "\$backup" | awk '{print \$1}')"
		rehearsal_hash="\$(sha256sum -- "\$rehearsal" | awk '{print \$1}')"
		[[ "\${lines[6]}" == "backup-evidence-sha256 \$backup_hash" && \
			"\${lines[7]}" == "rehearsal-evidence-sha256 \$rehearsal_hash" ]] || exit 1
		printf '%s\n' 'las-migration-readiness-v2 ok'
		;;
	*) exit 2 ;;
esac
STUB

cat >"$RUNTIME_MANAGER" <<STUB
#!/usr/bin/env bash
set -Eeuo pipefail
printf 'runtime %s\n' "\$*" >>'$EVENT_LOG'
release='$RELEASE'; web='$WEB'; worker='$WORKER'; migrate='$MIGRATE'; postgres='$POSTGRES'
case "\${1:-}" in
	migration-backup)
		[[ \$# -eq 8 && "\$2" == "\$release" && "\$3" == "\$web" && "\$4" == "\$worker" && \
			"\$5" == "\$migrate" && "\$6" == "\$postgres" && \
			"\$8" == migration-readiness-runtime-v2 && ! -e '$TEST_ROOT/runtime-backup-fail' ]] || exit 1
		printf '%s\n' 'PGDMP-database-secret-bytes' >"\$7"
		chmod 0600 "\$7"
		;;
	migration-rehearse)
		[[ \$# -eq 9 && "\$2" == "\$release" && "\$3" == "\$web" && "\$4" == "\$worker" && \
			"\$5" == "\$migrate" && "\$6" == "\$postgres" && \
			"\$9" == migration-readiness-runtime-v2 && ! -e '$TEST_ROOT/runtime-rehearsal-fail' ]] || exit 1
		[[ "\$(cat -- "\$7")" == 'PGDMP-database-secret-bytes' ]] || exit 1
		printf '%s\n' 'las-migration-rehearsal-runtime-v2 ok' 'migration-exit-status 0' \
			'completed-at-utc $COMPLETION_TIMESTAMP' >"\$8"
		chmod 0600 "\$8"
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
set -Eeuo pipefail
printf 'sync %s\n' "\$*" >>'$EVENT_LOG'
failure="\$(cat '$TEST_ROOT/sync-failure' 2>/dev/null || true)"
target="\${@: -1}"
if [[ "\$failure" == post-attestation-directory && "\$target" == '$READINESS_ROOT' && \
	-f '$READINESS_ROOT/$RELEASE' ]]; then
	exit 92
fi
STUB
cat >"$MOCK_BIN/python3" <<STUB
#!/usr/bin/env bash
set -Eeuo pipefail
source_path="\${@: -2:1}"
destination_path="\${@: -1}"
case "\${PRODUCER_TEST_RENAME_MODE:-success}:\$destination_path" in
	unsupported:*) exit 95 ;;
	fail-backup:*.backup | fail-rehearsal:*.rehearsal | fail-attestation:'$READINESS_ROOT/$RELEASE') exit 5 ;;
	eexist-backup:*.backup)
		printf '%s\n' 'concurrent root evidence' >"\$destination_path"
		chmod 0400 "\$destination_path"
		[[ -f "\$source_path" ]] || exit 96
		printf 'rename-eexist-source-preserved %s\n' "\$source_path" >>'$EVENT_LOG'
		exit 17
		;;
esac
printf 'rename %s %s\n' "\$source_path" "\$destination_path" >>'$EVENT_LOG'
exec '$REAL_MV' -T -- "\$source_path" "\$destination_path"
STUB
cat >"$MOCK_BIN/rm" <<STUB
#!/usr/bin/env bash
set -Eeuo pipefail
printf 'rm %s\n' "\$*" >>'$EVENT_LOG'
if [[ "\${PRODUCER_TEST_RM_MODE:-}" == probe && "\$*" == *.renameat2-probe-* ]]; then
	exit 92
fi
if [[ "\${PRODUCER_TEST_RM_MODE:-}" == work && "\$*" == *'/.producer.'* ]]; then
	exit 93
fi
exec '$REAL_RM' "\$@"
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
	-e "s#/usr/bin/rm#$MOCK_BIN/rm#g" \
	-e "s#$MOCK_BIN/rmdir#/usr/bin/rmdir#g" \
	-e "s#/usr/bin/env -i PATH='/usr/bin:/bin' HOME='/nonexistent' /usr/bin/python3#$MOCK_BIN/python3#g" \
	"$PRODUCER_SOURCE" >"$PRODUCER"
chmod 0755 "$PRODUCER"

run_producer() {
	local -a args=("$@")
	local i
	for i in "${!args[@]}"; do
		if [[ "${args[$i]}" == "$WWW" ]]; then unset 'args[i]'; fi
	done
	env -i PATH='/usr/bin:/bin' HOME='/nonexistent' \
		PRODUCER_TEST_UID="${PRODUCER_TEST_UID:-0}" SUDO_USER="${PRODUCER_TEST_SUDO_USER:-}" \
		PRODUCER_TEST_RENAME_MODE="${PRODUCER_TEST_RENAME_MODE:-success}" \
		PRODUCER_TEST_RM_MODE="${PRODUCER_TEST_RM_MODE:-}" \
		/bin/bash --noprofile --norc -p "$PRODUCER" "${args[@]}"
}

run_manager() {
	local -a args=("$@")
	local i
	for i in "${!args[@]}"; do
		if [[ "${args[$i]}" == "$WWW" ]]; then unset 'args[i]'; fi
	done
	env -i PATH='/usr/bin:/bin' HOME='/nonexistent' \
		/bin/bash --noprofile --norc -p "$STATE_MANAGER" "${args[@]}"
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
run_producer "$RELEASE" "$WEB" "$WORKER" "$MIGRATE" >/dev/null 2>&1
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

# A modern userspace must still fail closed when direct renameat2 support is
# unavailable on the host filesystem or kernel.
: >"$EVENT_LOG"
PRODUCER_TEST_RENAME_MODE=unsupported
set +e
run_producer "$RELEASE" "$WEB" "$WORKER" "$MIGRATE" "$POSTGRES" "$WWW" >/dev/null 2>&1
unsupported_rename_status=$?
set -e
unset PRODUCER_TEST_RENAME_MODE
[[ "$unsupported_rename_status" -ne 0 ]]
assert_no_runtime_or_adapter
assert_no_evidence

# Cleanup of a direct-rename capability probe is part of the fail-closed
# operation: no readiness success may be emitted after cleanup failure.
: >"$EVENT_LOG"
PRODUCER_TEST_RM_MODE=probe
set +e
run_producer "$RELEASE" "$WEB" "$WORKER" "$MIGRATE" "$POSTGRES" "$WWW" \
	>"$TEST_ROOT/probe-cleanup.out" 2>"$TEST_ROOT/probe-cleanup.err"
probe_cleanup_status=$?
set -e
unset PRODUCER_TEST_RM_MODE
[[ "$probe_cleanup_status" -ne 0 ]]
assert_no_runtime_or_adapter
assert_no_evidence
! grep -Fxq 'las-migration-readiness-v2 ok' "$TEST_ROOT/probe-cleanup.out"

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
grep -Fq "runtime migration-backup $RELEASE $WEB $WORKER $MIGRATE $POSTGRES" "$EVENT_LOG" || {
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

# The root-only backup, returned copy, and runtime result are deleted and their
# absence is verified before any evidence rename. A work cleanup failure must
# therefore publish no evidence and emit no success token.
: >"$EVENT_LOG"
PRODUCER_TEST_RM_MODE=work
set +e
run_producer "$RELEASE" "$WEB" "$WORKER" "$MIGRATE" "$POSTGRES" "$WWW" \
	>"$TEST_ROOT/work-cleanup.out" 2>"$TEST_ROOT/work-cleanup.err"
work_cleanup_status=$?
set -e
unset PRODUCER_TEST_RM_MODE
[[ "$work_cleanup_status" -ne 0 ]] && grep -Fq 'runtime migration-rehearse' "$EVENT_LOG" && \
	assert_no_evidence && ! grep -Fxq 'las-migration-readiness-v2 ok' "$TEST_ROOT/work-cleanup.out" || {
	echo 'Producer published readiness before sensitive work cleanup succeeded.' >&2
	exit 1
}
"$REAL_RM" -rf -- "$WORK_ROOT/$RELEASE"

: >"$EVENT_LOG"
PRODUCER_TEST_RENAME_MODE=fail-backup
set +e
run_producer "$RELEASE" "$WEB" "$WORKER" "$MIGRATE" "$POSTGRES" "$WWW" >/dev/null 2>&1
atomic_status=$?
set -e
unset PRODUCER_TEST_RENAME_MODE
[[ "$atomic_status" -ne 0 ]]
assert_no_evidence
assert_work_clean

# A failure after only backup evidence is published remains verifier-invalid,
# preserves the partial bytes, and cannot be retried into an automatic overwrite.
: >"$EVENT_LOG"
PRODUCER_TEST_RENAME_MODE=fail-rehearsal
set +e
run_producer "$RELEASE" "$WEB" "$WORKER" "$MIGRATE" "$POSTGRES" "$WWW" \
	>/dev/null 2>"$TEST_ROOT/backup-only.err"
backup_only_status=$?
set -e
unset PRODUCER_TEST_RENAME_MODE
[[ "$backup_only_status" -ne 0 && -f "$EVIDENCE_ROOT/$RELEASE.backup" && \
	! -e "$EVIDENCE_ROOT/$RELEASE.rehearsal" && ! -e "$READINESS_ROOT/$RELEASE" ]] || {
	echo 'Backup-only publication failure did not preserve the published evidence boundary.' >&2
	cat "$TEST_ROOT/backup-only.err" >&2
	cat "$EVENT_LOG" >&2
	find "$EVIDENCE_ROOT" "$READINESS_ROOT" -maxdepth 1 -print >&2
	exit 1
}
backup_only_hash="$(sha256sum -- "$EVIDENCE_ROOT/$RELEASE.backup" | awk '{print $1}')"
set +e
run_manager migration-readiness "$RELEASE" "$WEB" "$WORKER" "$MIGRATE" "$POSTGRES" "$WWW" >/dev/null 2>&1
backup_only_verifier_status=$?
set -e
[[ "$backup_only_verifier_status" -ne 0 ]]
: >"$EVENT_LOG"
set +e
run_producer "$RELEASE" "$WEB" "$WORKER" "$MIGRATE" "$POSTGRES" "$WWW" >/dev/null 2>&1
backup_only_retry_status=$?
set -e
[[ "$backup_only_retry_status" -ne 0 && \
	"$(sha256sum -- "$EVIDENCE_ROOT/$RELEASE.backup" | awk '{print $1}')" == "$backup_only_hash" ]]
assert_no_runtime_or_adapter
rm -f "$EVIDENCE_ROOT/$RELEASE.backup"

# A failure after both evidence files but before the attestation likewise
# remains verifier-invalid and fails closed without rerunning work.
: >"$EVENT_LOG"
PRODUCER_TEST_RENAME_MODE=fail-attestation
set +e
run_producer "$RELEASE" "$WEB" "$WORKER" "$MIGRATE" "$POSTGRES" "$WWW" >/dev/null 2>&1
evidence_only_status=$?
set -e
unset PRODUCER_TEST_RENAME_MODE
[[ "$evidence_only_status" -ne 0 && -f "$EVIDENCE_ROOT/$RELEASE.backup" && \
	-f "$EVIDENCE_ROOT/$RELEASE.rehearsal" && ! -e "$READINESS_ROOT/$RELEASE" ]]
set +e
run_manager migration-readiness "$RELEASE" "$WEB" "$WORKER" "$MIGRATE" "$POSTGRES" "$WWW" >/dev/null 2>&1
evidence_only_verifier_status=$?
set -e
[[ "$evidence_only_verifier_status" -ne 0 ]]
: >"$EVENT_LOG"
set +e
run_producer "$RELEASE" "$WEB" "$WORKER" "$MIGRATE" "$POSTGRES" "$WWW" >/dev/null 2>&1
evidence_only_retry_status=$?
set -e
[[ "$evidence_only_retry_status" -ne 0 ]]
assert_no_runtime_or_adapter
rm -f "$EVIDENCE_ROOT/$RELEASE.backup" "$EVIDENCE_ROOT/$RELEASE.rehearsal"

# A destination created after the producer's absence scan must not be
# overwritten by publication. The raced bytes remain an explicit conflict.
: >"$EVENT_LOG"
PRODUCER_TEST_RENAME_MODE=eexist-backup
set +e
run_producer "$RELEASE" "$WEB" "$WORKER" "$MIGRATE" "$POSTGRES" "$WWW" >/dev/null 2>&1
publication_race_status=$?
set -e
unset PRODUCER_TEST_RENAME_MODE
[[ "$publication_race_status" -ne 0 ]]
grep -Fqx 'concurrent root evidence' "$EVIDENCE_ROOT/$RELEASE.backup"
grep -Fq 'rename-eexist-source-preserved' "$EVENT_LOG"
[[ ! -e "$EVIDENCE_ROOT/$RELEASE.rehearsal" && ! -e "$READINESS_ROOT/$RELEASE" ]]
rm -f "$EVIDENCE_ROOT/$RELEASE.backup"

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

# All three files can be verifier-valid while the final parent-directory sync
# still fails. A retry must re-sync the verified files and both parents before
# returning success, without repeating backup, transfer, or rehearsal work.
: >"$EVENT_LOG"
printf '%s\n' post-attestation-directory >"$TEST_ROOT/sync-failure"
set +e
run_producer "$RELEASE" "$WEB" "$WORKER" "$MIGRATE" "$POSTGRES" "$WWW" >/dev/null 2>&1
post_attestation_sync_status=$?
set -e
rm -f "$TEST_ROOT/sync-failure"
[[ "$post_attestation_sync_status" -ne 0 ]]
[[ "$(run_manager migration-readiness "$RELEASE" "$WEB" "$WORKER" "$MIGRATE" "$POSTGRES" "$WWW")" == \
	'las-migration-readiness-v2 ok' ]]
work_cleanup_line="$(grep -nE '^rm -rf -- .*/migration-readiness-work-v2/.*/\.producer\.' "$EVENT_LOG" | tail -n 1 | cut -d: -f1)"
backup_publish_line="$(grep -nF " $EVIDENCE_ROOT/$RELEASE.backup" "$EVENT_LOG" | grep 'rename ' | head -n 1 | cut -d: -f1)"
[[ "$work_cleanup_line" =~ ^[1-9][0-9]*$ && "$backup_publish_line" =~ ^[1-9][0-9]*$ && \
	"$work_cleanup_line" -lt "$backup_publish_line" ]] || {
	echo 'Sensitive migration work was not removed before evidence publication.' >&2
	cat "$EVENT_LOG" >&2
	exit 1
}
: >"$EVENT_LOG"
run_producer "$RELEASE" "$WEB" "$WORKER" "$MIGRATE" "$POSTGRES" "$WWW"
assert_no_runtime_or_adapter
grep -Fqx "sync -f $EVIDENCE_ROOT/$RELEASE.backup" "$EVENT_LOG" || {
	cat "$EVENT_LOG" >&2
	exit 1
}
grep -Fqx "sync -f $EVIDENCE_ROOT/$RELEASE.rehearsal" "$EVENT_LOG"
grep -Fqx "sync -f $READINESS_ROOT/$RELEASE" "$EVENT_LOG"
grep -Fqx "sync -f $EVIDENCE_ROOT" "$EVENT_LOG"
grep -Fqx "sync -f $READINESS_ROOT" "$EVENT_LOG"
[[ "$("$MOCK_BIN/stat" -c '%u:%g:%a' -- "$EVIDENCE_ROOT/$RELEASE.backup")" == 0:0:400 && \
	"$("$MOCK_BIN/stat" -c '%u:%g:%a' -- "$EVIDENCE_ROOT/$RELEASE.rehearsal")" == 0:0:400 && \
	"$("$MOCK_BIN/stat" -c '%u:%g:%a' -- "$READINESS_ROOT/$RELEASE")" == 0:0:400 ]]
[[ "$(wc -l <"$READINESS_ROOT/$RELEASE")" -eq 8 ]]
mapfile -t rehearsal_evidence_lines <"$EVIDENCE_ROOT/$RELEASE.rehearsal"
[[ "${#rehearsal_evidence_lines[@]}" -eq 11 && \
	"${rehearsal_evidence_lines[9]}" == 'migration-exit-status 0' && \
	"${rehearsal_evidence_lines[10]}" == "completed-at-utc $COMPLETION_TIMESTAMP" ]] || {
	echo 'Published rehearsal evidence lacks the exact migration status and UTC completion timestamp.' >&2
	exit 1
}
if grep -ERq 'database-secret|yonaris_rehearsal|DATABASE_URL|POSTGRES_' \
	"$EVIDENCE_ROOT/$RELEASE.backup" "$EVIDENCE_ROOT/$RELEASE.rehearsal" "$READINESS_ROOT/$RELEASE"; then
	echo 'Published migration-readiness evidence contains secret or database content.' >&2
	exit 1
fi
grep -Fq "flock --exclusive --wait 1800 9" "$EVENT_LOG"
assert_work_clean

runtime_count="$(grep -c '^runtime ' "$EVENT_LOG" || true)"
adapter_count="$(grep -c '^adapter ' "$EVENT_LOG" || true)"
run_producer "$RELEASE" "$WEB" "$WORKER" "$MIGRATE" "$POSTGRES" "$WWW"
[[ "$(grep -c '^runtime ' "$EVENT_LOG" || true)" -eq "$runtime_count" && \
	"$(grep -c '^adapter ' "$EVENT_LOG" || true)" -eq "$adapter_count" ]]

echo 'root-owned migration readiness producer tests passed'
