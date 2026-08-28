#!/usr/bin/env bash

set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
INSTALLER_SOURCE="$SCRIPT_DIR/install-las-stable-bundle.sh"
ENTRYPOINT_SOURCE="$SCRIPT_DIR/run-las-active-bundle.sh"
DISPATCHER_SOURCE="$SCRIPT_DIR/dispatch-las-command.sh"
TEST_ROOT="$(mktemp -d)"
trap 'chmod -R u+w "$TEST_ROOT" 2>/dev/null || true; rm -rf -- "$TEST_ROOT"' EXIT

STABLE_ROOT="$TEST_ROOT/usr/local/libexec/yonaris-las"
STAGING_DIRECTORY="$STABLE_ROOT/.bundle-v1.new"
BUNDLES_DIRECTORY="$STABLE_ROOT/bundles"
TRUST_DIRECTORY="$TEST_ROOT/etc/yonaris"
STATE_DIRECTORY="$TEST_ROOT/var/lib/yonaris"
SOURCE_GIT_DIR="$STATE_DIRECTORY/las-objects.git"
LOCK_DIRECTORY="$TEST_ROOT/run/lock/yonaris"
ACTIVE_POINTER="$TRUST_DIRECTORY/las-stable-bundle-active-v1"
TRANSITION_JOURNAL="$TRUST_DIRECTORY/las-stable-bundle-pending-v1"
RELEASE_TRANSITION_JOURNAL="$TRUST_DIRECTORY/las-transition-pending-v1"
CADDY_BOOTSTRAP_JOURNAL="$TRUST_DIRECTORY/las-caddy-bootstrap-pending-v1"
RECEIPT_ROOT="$TRUST_DIRECTORY/las-compatible-releases-v3"
LEGACY_RECEIPT_ROOT="$TRUST_DIRECTORY/las-compatible-releases-v2"
PORTAL_RELEASE="$TRUST_DIRECTORY/las-active-portal-release-v1"
INSTALLER="$TEST_ROOT/usr/local/sbin/install-yonaris-las-stable-bundle"
MOCK_BIN="$TEST_ROOT/mock-bin"
REAL_STAT="$(command -v stat)"
REAL_READLINK="$(command -v readlink)"
REAL_MV="$(command -v mv)"
REAL_SYNC="$(command -v sync)"
REAL_FLOCK="$(command -v flock || true)"
REAL_GIT="$(command -v git)"
export REAL_STAT REAL_READLINK REAL_MV REAL_SYNC REAL_FLOCK REAL_GIT

PROGRAMS=(
	dispatch-las-command
	guard-artifact-output-release
	install-yonaris-las-trust-policy
	manage-las-release-state
	manage-las-runtime
	manage-las-caddy
	verify-yonaris-las-forced-command
	produce-las-migration-readiness
)
LABELS=(dispatcher guard installer state-manager runtime-manager caddy-manager verifier migration-readiness-producer)
STABLE_DISPATCHER="$STABLE_ROOT/dispatch-las-command"

mkdir -p "$STABLE_ROOT" "$BUNDLES_DIRECTORY" "$TRUST_DIRECTORY" "$SOURCE_GIT_DIR" "$LOCK_DIRECTORY" "$RECEIPT_ROOT" "$LEGACY_RECEIPT_ROOT" \
	"$(dirname -- "$INSTALLER")" "$MOCK_BIN"
chmod 0755 "$STABLE_ROOT" "$BUNDLES_DIRECTORY" "$TRUST_DIRECTORY"
chmod 0711 "$STATE_DIRECTORY"
chmod 0700 "$SOURCE_GIT_DIR"
chmod 0700 "$LOCK_DIRECTORY"
git init --bare --quiet "$SOURCE_GIT_DIR"

cat >"$MOCK_BIN/id" <<'STUB'
#!/usr/bin/env bash
[[ "$*" == -u ]] || exit 2
printf '%s\n' "${BUNDLE_TEST_UID:-0}"
STUB
cat >"$MOCK_BIN/stat" <<'STUB'
#!/usr/bin/env bash
set -Eeuo pipefail
format=''; path="${@: -1}"
[[ "${1:-}" == -c ]] && format="$2"
if [[ "$format" == '%h' ]]; then exec "$REAL_STAT" "$@"; fi
case "$path" in
	*/usr/local/libexec/yonaris-las | */usr/local/libexec/yonaris-las/bundles | */etc/yonaris | \
	*/las-compatible-releases-v3 | */las-compatible-releases-v2)
		printf '0:0:755\n' ;;
	*/var/lib/yonaris) printf '0:0:711\n' ;;
	*/var/lib/yonaris/las-objects.git) printf '0:0:700\n' ;;
	*/run/lock/yonaris) printf '0:0:700\n' ;;
	*/.bundle-v1.new)
		if [[ -e '__FINALIZED_STAGING__' ]]; then
			printf '0:0:555\n'
		else
			printf '0:0:700\n'
		fi ;;
	*/.bundle-v1.new/las-trust-v1)
		if [[ -e '__FINALIZED_STAGING__' ]]; then
			printf '0:0:644\n'
		else
			printf '0:0:600\n'
		fi ;;
	*/.bundle-v1.new/*) printf '0:0:755\n' ;;
	*/bundles/sha256-*/las-trust-v1) printf '0:0:644\n' ;;
	*/bundles/sha256-*/*) printf '0:0:755\n' ;;
	*/bundles/sha256-*) printf '0:0:555\n' ;;
	*/dispatch-las-command | */guard-artifact-output-release | \
	*/install-yonaris-las-trust-policy | */manage-las-release-state | \
	*/manage-las-runtime | */manage-las-caddy | \
	*/verify-yonaris-las-forced-command | */produce-las-migration-readiness)
		printf '0:0:755\n' ;;
	*/las-stable-bundle-active-v1 | */las-stable-bundle-pending-v1 | \
	*/.las-stable-bundle-active-v1.active.new | */.las-stable-bundle-pending-v1.new)
		printf '0:0:600\n' ;;
	*/las-active-portal-release-v1 | */las-compatible-releases-v3/sha-* | \
	*/las-compatible-releases-v2/sha-*) printf '0:0:644\n' ;;
	*) exec "$REAL_STAT" "$@" ;;
esac
STUB
cat >"$MOCK_BIN/flock" <<'STUB'
#!/usr/bin/env bash
[[ ! -e '__LOCK_HELD__' ]] || exit 1
if [[ -e '__USE_REAL_FLOCK__' ]]; then
	printf '%s\n' real >>'__FLOCK_LOG__'
	[[ " $* " != *' --shared '* ]] || touch '__SHARED_WAITING__'
	exec '__REAL_FLOCK__' "$@"
fi
if [[ " $* " == *' --shared '* ]]; then
	touch '__SHARED_WAITING__'
	for _ in $(seq 1 1000); do
		[[ -e '__EXCLUSIVE_HELD__' ]] || exit 0
		sleep 0.01
	done
	exit 75
fi
touch '__EXCLUSIVE_HELD__'
STUB
sed -i \
	-e "s#__LOCK_HELD__#$TEST_ROOT/lock-held#g" \
	-e "s#__SHARED_WAITING__#$TEST_ROOT/race-shared-waiting#g" \
	-e "s#__EXCLUSIVE_HELD__#$TEST_ROOT/race-exclusive-held#g" \
	-e "s#__USE_REAL_FLOCK__#$TEST_ROOT/race-use-real-flock#g" \
	-e "s#__FLOCK_LOG__#$TEST_ROOT/race-flock.log#g" \
	-e "s#__REAL_FLOCK__#${REAL_FLOCK:-/nonexistent/flock}#g" \
	"$MOCK_BIN/flock"
sed -i "s#__FINALIZED_STAGING__#$TEST_ROOT/finalized-staging#g" "$MOCK_BIN/stat"
cat >"$MOCK_BIN/readlink" <<'STUB'
#!/usr/bin/env bash
set -Eeuo pipefail
path="${@: -1}"
if [[ "${BUNDLE_TEST_LINK_PATH:-}" == "$path" ]]; then
	printf '%s.target\n' "$path"
	exit 0
fi
exec "$REAL_READLINK" "$@"
STUB
cat >"$MOCK_BIN/mv" <<'STUB'
#!/usr/bin/env bash
set -Eeuo pipefail
source_path="${@: -2:1}"
target_path="${@: -1}"
root_semantic_mv() {
	if [[ -d "$source_path" && "$source_path" == */.bundle-v1.new && "$target_path" == */bundles/sha256-* ]]; then
		/usr/bin/chmod u+w -- "$source_path"
		"$REAL_MV" "$@"
		/usr/bin/chmod 0555 -- "$target_path"
	else
		"$REAL_MV" "$@"
	fi
}
case "${BUNDLE_TEST_MV_MODE:-}" in
	fail-pointer)
		[[ "$source_path" == *.active.new && "$target_path" == */las-stable-bundle-active-v1 ]] && exit 91
		;;
	kill-after-bundle)
		if [[ "$source_path" == */.bundle-v1.new && "$target_path" == */bundles/sha256-* ]]; then
			root_semantic_mv "$@"
			kill -KILL "$PPID"
			exit 137
		fi
		;;
	kill-before-bundle)
		if [[ "$source_path" == */.bundle-v1.new && "$target_path" == */bundles/sha256-* ]]; then
			kill -KILL "$PPID"
			exit 137
		fi
		;;
	kill-after-pointer)
		if [[ "$source_path" == *.active.new && "$target_path" == */las-stable-bundle-active-v1 ]]; then
			root_semantic_mv "$@"
			kill -KILL "$PPID"
			exit 137
		fi
		;;
esac
root_semantic_mv "$@"
STUB
cat >"$MOCK_BIN/sync" <<'STUB'
#!/usr/bin/env bash
set -Eeuo pipefail
printf '%s\n' "${@: -1}" >>"$BUNDLE_TEST_SYNC_LOG"
[[ "${BUNDLE_TEST_SYNC_FAILURE_PATH:-}" != "${@: -1}" ]] || exit 92
if [[ "${@: -1}" == "$BUNDLE_TEST_STAGING_DIRECTORY" ]]; then
	touch "$BUNDLE_TEST_FINALIZED_MARKER"
	if [[ "${BUNDLE_TEST_SYNC_MODE:-}" == kill-after-finalize ]]; then
		kill -KILL "$PPID"
		exit 137
	fi
fi
[[ "${BUNDLE_TEST_SYNC_DELAY:-no}" != yes ]] || sleep 0.01
exec "$REAL_SYNC" "$@"
STUB
cat >"$MOCK_BIN/git" <<'STUB'
#!/usr/bin/env bash
set -Eeuo pipefail
if [[ " $* " == *' config --local --no-includes --name-only --get-regexp '* ]]; then
	exec '__REAL_GIT__' "$@"
fi
[[ "${GIT_NO_REPLACE_OBJECTS:-}" == 1 && "${GIT_NO_LAZY_FETCH:-}" == 1 && \
	"${GIT_TERMINAL_PROMPT:-}" == 0 && "${GIT_ASKPASS:-}" == /bin/false && \
	"${SSH_ASKPASS:-}" == /bin/false && " $* " == *' --no-replace-objects '* && \
	" $* " == *' -c core.hooksPath=/dev/null '* && \
	" $* " == *' -c credential.helper= '* && \
	" $* " == *' -c protocol.allow=never '* ]] || exit 93
printf '%s\n' "$*" >>'__GIT_LOG__'
[[ ! -e '__GIT_MISSING__' ]] || exit 95
if [[ "$*" =~ cat-file\ -e\ [0-9a-f]{40}\^\{commit\}$ ]]; then
	exit 0
elif [[ "$*" =~ cat-file\ -p\ [0-9a-f]{40}:deploy/las/artifact-output-language-compatible$ ]]; then
		if [[ -e '__CAPABILITY_INVALID__' ]]; then
			printf 'invalid\n'
		else
			printf 'artifact-output-language-v1\n'
		fi
else
	exit 94
fi
STUB
sed -i \
	-e "s#__REAL_GIT__#$REAL_GIT#g" \
	-e "s#__GIT_LOG__#$TEST_ROOT/git.log#g" \
	-e "s#__CAPABILITY_INVALID__#$TEST_ROOT/capability-invalid#g" \
	-e "s#__GIT_MISSING__#$TEST_ROOT/git-missing#g" \
	"$MOCK_BIN/git"
chmod 0755 "$MOCK_BIN"/*

entrypoint_template="$TEST_ROOT/entrypoint-template"
sed \
	-e "s#/usr/local/libexec/yonaris-las#$STABLE_ROOT#g" \
	-e "s#/usr/local/sbin#$TEST_ROOT/usr/local/sbin#g" \
	-e "s#/etc/yonaris#$TRUST_DIRECTORY#g" \
	-e "s#/usr/bin/stat#$MOCK_BIN/stat#g" \
	-e "s#/usr/bin/readlink#$MOCK_BIN/readlink#g" \
	"$ENTRYPOINT_SOURCE" >"$entrypoint_template"
chmod 0755 "$entrypoint_template"
for program in "${PROGRAMS[@]}"; do
	case "$program" in
		install-yonaris-las-trust-policy | verify-yonaris-las-forced-command)
			destination="$TEST_ROOT/usr/local/sbin/$program" ;;
		*) destination="$STABLE_ROOT/$program" ;;
	esac
	cp "$entrypoint_template" "$destination"
	chmod 0755 "$destination"
done
ENTRYPOINT_SHA256="$(sha256sum "$entrypoint_template" | awk '{print $1}')"

sed \
	-e "s#/usr/local/libexec/yonaris-las#$STABLE_ROOT#g" \
	-e "s#/usr/local/sbin#$TEST_ROOT/usr/local/sbin#g" \
	-e "s#/etc/yonaris#$TRUST_DIRECTORY#g" \
	-e "s#/var/lib/yonaris#$STATE_DIRECTORY#g" \
	-e "s#/run/lock/yonaris#$LOCK_DIRECTORY#g" \
	-e "s#/usr/bin/id#$MOCK_BIN/id#g" \
	-e "s#/usr/bin/git#$MOCK_BIN/git#g" \
	-e "s#/usr/bin/stat#$MOCK_BIN/stat#g" \
	-e "s#/usr/bin/readlink#$MOCK_BIN/readlink#g" \
	-e "s#/usr/bin/mv#$MOCK_BIN/mv#g" \
	-e "s#/usr/bin/sync#$MOCK_BIN/sync#g" \
	-e "s#/usr/bin/flock#$MOCK_BIN/flock#g" \
	-e 's/^set +x$/[[ "${BUNDLE_TEST_TRACE:-no}" != yes ]] || set -x/' \
	-e "s#readonly ENTRYPOINT_SHA256='[0-9a-f]*'#readonly ENTRYPOINT_SHA256='$ENTRYPOINT_SHA256'#g" \
	"$INSTALLER_SOURCE" >"$INSTALLER"
chmod 0755 "$INSTALLER"

stage_bundle() {
	local generation="$1" program index hash
	rm -f "$TEST_ROOT/finalized-staging"
	rm -rf -- "$STAGING_DIRECTORY"
	mkdir "$STAGING_DIRECTORY"
	chmod 0700 "$STAGING_DIRECTORY"
	for program in "${PROGRAMS[@]}"; do
		if [[ "$program" == verify-yonaris-las-forced-command ]]; then
			cat >"$STAGING_DIRECTORY/$program" <<STUB
#!/bin/bash
set -Eeuo pipefail
bundle_dir="\${LAS_STABLE_BUNDLE_DIR:?}"
[[ "\$0" == "\$bundle_dir/verify-yonaris-las-forced-command" ]]
IFS= read -r token <"\$bundle_dir/las-trust-v1"
[[ "\$token" == yonaris-las-trust-v1 ]]
if [[ '$generation' == v6 && "\${BUNDLE_RACE_READER:-no}" == yes ]]; then
	printf '%s\n' verifier >>'$TEST_ROOT/race-peer-mutations'
fi
if [[ '$generation' == v5 ]]; then
	printf '%s\n' verifier >>'$TEST_ROOT/pending-peer-mutations'
fi
if [[ '$generation' == v6 && "\${BUNDLE_RACE_READER:-no}" != yes ]]; then
	touch '$TEST_ROOT/race-candidate-pointer-live'
	for _ in \$(seq 1 1000); do
		[[ -e '$TEST_ROOT/race-reader-pinned' ]] && break
		sleep 0.01
	done
	[[ -e '$TEST_ROOT/race-reader-pinned' ]]
fi
[[ '$generation' != v6 ]]
STUB
		elif [[ "$program" == dispatch-las-command ]]; then
			if [[ "$generation" == v6 ]]; then
				sed \
					-e "s#/usr/local/libexec/yonaris-las#$STABLE_ROOT#g" \
					-e "s#/etc/yonaris#$TRUST_DIRECTORY#g" \
					-e "s#/var/lib/yonaris#$STATE_DIRECTORY#g" \
					-e "s#/run/lock/yonaris#$LOCK_DIRECTORY#g" \
					-e "s#/usr/bin/id#$MOCK_BIN/id#g" \
					-e "s#/usr/bin/stat#$MOCK_BIN/stat#g" \
					-e "s#/usr/bin/readlink#$MOCK_BIN/readlink#g" \
					-e "s#/usr/bin/flock#$MOCK_BIN/flock#g" \
					"$DISPATCHER_SOURCE" >"$STAGING_DIRECTORY/$program"
				sed -i "/^readonly PATH$/a\\
if [[ \"\${BUNDLE_RACE_READER:-no}\" == yes ]]; then touch '$TEST_ROOT/race-reader-pinned'; fi" \
					"$STAGING_DIRECTORY/$program"
			else
				cat >"$STAGING_DIRECTORY/$program" <<STUB
#!/bin/bash
set -Eeuo pipefail
bundle_dir="\${LAS_STABLE_BUNDLE_DIR:?}"
sleep 0.01
[[ "\$("$STABLE_ROOT/manage-las-release-state")" == '$generation:manage-las-release-state' ]]
IFS= read -r token <"\$bundle_dir/las-trust-v1"
[[ "\$token" == yonaris-las-trust-v1 ]]
printf '%s\n' '$generation:dispatch-las-command'
STUB
			fi
		elif [[ "$program" == manage-las-release-state && "$generation" == v6 ]]; then
			cat >"$STAGING_DIRECTORY/$program" <<STUB
#!/bin/bash
set -Eeuo pipefail
[[ "\${BUNDLE_RACE_READER:-no}" != yes ]] || printf '%s\n' state-manager >>'$TEST_ROOT/race-peer-mutations'
printf '%s\n' 'v6:manage-las-release-state'
STUB
		elif [[ "$generation" == v5 ]]; then
			cat >"$STAGING_DIRECTORY/$program" <<STUB
#!/bin/bash
set -Eeuo pipefail
printf '%s\n' '$program' >>'$TEST_ROOT/pending-peer-mutations'
if [[ '$program' == manage-las-release-state && "\${1:-}" == status ]]; then
	printf '%s\n' clear
else
	printf '%s\n' 'v5:$program'
fi
STUB
		else
			printf '#!/bin/bash\nprintf "%%s\\n" %q\n' "$generation:$program" >"$STAGING_DIRECTORY/$program"
		fi
		chmod 0755 "$STAGING_DIRECTORY/$program"
	done
	{
		printf '%s\n' 'yonaris-las-trust-v1'
		printf '%s\n' 'actions-key-fingerprint SHA256:gM/QEgkfN99cP/Cf9awUOwSb7FMesQTgRCTI9kPh84A'
		for index in "${!PROGRAMS[@]}"; do
			program="${PROGRAMS[$index]}"
			hash="$(sha256sum "$STAGING_DIRECTORY/$program" | awk '{print $1}')"
			printf '%s-sha256 %s\n' "${LABELS[$index]}" "$hash"
		done
		printf '%s\n' 'allow sha-1111111111111111111111111111111111111111 deploy web-sha256 sha256:1111111111111111111111111111111111111111111111111111111111111111 worker-sha256 sha256:2222222222222222222222222222222222222222222222222222222222222222 migrate-sha256 sha256:3333333333333333333333333333333333333333333333333333333333333333 postgres-sha256 sha256:4444444444444444444444444444444444444444444444444444444444444444'
		printf '%s\n' 'allow sha-1111111111111111111111111111111111111111 rollback web-sha256 sha256:1111111111111111111111111111111111111111111111111111111111111111 worker-sha256 sha256:2222222222222222222222222222222222222222222222222222222222222222 migrate-sha256 sha256:3333333333333333333333333333333333333333333333333333333333333333 postgres-sha256 sha256:4444444444444444444444444444444444444444444444444444444444444444'
	} >"$STAGING_DIRECTORY/las-trust-v1"
	chmod 0600 "$STAGING_DIRECTORY/las-trust-v1"
}

run_installer() {
	local -a shell_flags=(--noprofile --norc -p)
	local status restore_errexit=no
	[[ "$-" != *e* ]] || restore_errexit=yes
	[[ "${BUNDLE_TEST_TRACE:-no}" != yes ]] || shell_flags+=( -x )
	if [[ "${BUNDLE_TEST_CAPABILITY_INVALID:-no}" == yes ]]; then
		touch "$TEST_ROOT/capability-invalid"
	else
		rm -f "$TEST_ROOT/capability-invalid"
	fi
	set +e
	rm -f "$TEST_ROOT/race-exclusive-held"
	env -i PATH='/usr/bin:/bin' HOME='/nonexistent' \
		REAL_STAT="$REAL_STAT" REAL_READLINK="$REAL_READLINK" REAL_MV="$REAL_MV" REAL_SYNC="$REAL_SYNC" \
		BUNDLE_TEST_UID="${BUNDLE_TEST_UID:-0}" \
		BUNDLE_TEST_LINK_PATH="${BUNDLE_TEST_LINK_PATH:-}" \
		BUNDLE_TEST_MV_MODE="${BUNDLE_TEST_MV_MODE:-}" \
		BUNDLE_TEST_SYNC_LOG="$TEST_ROOT/sync.log" \
		BUNDLE_TEST_SYNC_FAILURE_PATH="${BUNDLE_TEST_SYNC_FAILURE_PATH:-}" \
		BUNDLE_TEST_SYNC_DELAY="${BUNDLE_TEST_SYNC_DELAY:-no}" \
		BUNDLE_TEST_SYNC_MODE="${BUNDLE_TEST_SYNC_MODE:-}" \
		BUNDLE_TEST_STAGING_DIRECTORY="$STAGING_DIRECTORY" \
		BUNDLE_TEST_FINALIZED_MARKER="$TEST_ROOT/finalized-staging" \
		BUNDLE_TEST_TRACE="${BUNDLE_TEST_TRACE:-no}" \
		SUDO_USER="${BUNDLE_TEST_SUDO_USER:-}" \
		/bin/bash "${shell_flags[@]}" "$INSTALLER" "$@"
	status=$?
	rm -f "$TEST_ROOT/race-exclusive-held"
	if [[ "$restore_errexit" == yes ]]; then set -e; else set +e; fi
	rm -f "$TEST_ROOT/capability-invalid"
	return "$status"
}

active_bundle_directory() {
	local id
	id="$(awk '$1 == "bundle-id" { print $2 }' "$ACTIVE_POINTER")"
	printf '%s/sha256-%s\n' "$BUNDLES_DIRECTORY" "${id#sha256:}"
}

active_generation() {
	"$STABLE_DISPATCHER"
}

assert_active_unchanged() {
	local expected="$1"
	[[ "$(active_generation)" == "$expected" ]] || {
		printf 'active bundle changed: expected %s, got %s\n' "$expected" "$(active_generation)" >&2
		exit 1
	}
}

wait_for_path() {
	local path="$1"
	for _ in $(seq 1 1000); do
		[[ -e "$path" ]] && return 0
		sleep 0.01
	done
	printf 'Timed out waiting for race fixture path: %s\n' "$path" >&2
	return 1
}

# First install makes exactly one complete bundle visible through one atomic pointer.
stage_bundle v1
run_installer
[[ "$(active_generation)" == 'v1:dispatch-las-command' ]]
[[ "$("$STABLE_ROOT/produce-las-migration-readiness")" == \
	'v1:produce-las-migration-readiness' ]]
[[ ! -e "$STAGING_DIRECTORY" && ! -e "$TRANSITION_JOURNAL" ]]
grep -Fq "$BUNDLES_DIRECTORY" "$TEST_ROOT/sync.log"
grep -Fq "$TRUST_DIRECTORY" "$TEST_ROOT/sync.log"

ACTIVE_RELEASE='sha-1111111111111111111111111111111111111111'
printf '%s\n' "$ACTIVE_RELEASE" >"$PORTAL_RELEASE"
printf '%s\n' \
	'artifact-output-language-receipt-v3' \
	"release $ACTIVE_RELEASE" \
	'web-sha256 sha256:1111111111111111111111111111111111111111111111111111111111111111' \
	'worker-sha256 sha256:2222222222222222222222222222222222222222222222222222222222222222' \
	'migrate-sha256 sha256:3333333333333333333333333333333333333333333333333333333333333333' \
	'postgres-sha256 sha256:4444444444444444444444444444444444444444444444444444444444444444' \
	>"$RECEIPT_ROOT/$ACTIVE_RELEASE"
printf '%s\n' \
	'artifact-output-language-receipt-v2' \
	"release $ACTIVE_RELEASE" \
	'web-sha256 sha256:1111111111111111111111111111111111111111111111111111111111111111' \
	'worker-sha256 sha256:2222222222222222222222222222222222222222222222222222222222222222' \
	'migrate-sha256 sha256:3333333333333333333333333333333333333333333333333333333333333333' \
	'postgres-sha256 sha256:4444444444444444444444444444444444444444444444444444444444444444' \
	'www-sha256 sha256:5555555555555555555555555555555555555555555555555555555555555555' \
	>"$LEGACY_RECEIPT_ROOT/$ACTIVE_RELEASE"

assert_offline_store_rejected() {
	local label="$1" status
	set +e
	run_installer >"$TEST_ROOT/$label.out" 2>"$TEST_ROOT/$label.err"
	status=$?
	set -e
	[[ "$status" -ne 0 ]] || {
		echo "Stable-bundle installer accepted non-local Git object-store fixture: $label" >&2
		exit 1
	}
	assert_active_unchanged 'v1:dispatch-las-command'
}

# Stable bundle activation must never cause an implicit fetch or consume an
# alternate/promisor object store, even when the requested commit is complete.
stage_bundle voffline-remote
git --git-dir="$SOURCE_GIT_DIR" config remote.audit.url 'https://git.invalid/yonaris.git'
assert_offline_store_rejected remote-config
git --git-dir="$SOURCE_GIT_DIR" config --remove-section remote.audit

stage_bundle voffline-partial
git --git-dir="$SOURCE_GIT_DIR" config core.repositoryformatversion 1
git --git-dir="$SOURCE_GIT_DIR" config extensions.partialClone audit
assert_offline_store_rejected partial-clone-config
git --git-dir="$SOURCE_GIT_DIR" config --unset-all extensions.partialClone
git --git-dir="$SOURCE_GIT_DIR" config core.repositoryformatversion 0

stage_bundle voffline-promisor
git --git-dir="$SOURCE_GIT_DIR" config remote.cache.promisor true
assert_offline_store_rejected promisor-config
git --git-dir="$SOURCE_GIT_DIR" config --remove-section remote.cache

stage_bundle voffline-promisor-pack
touch "$SOURCE_GIT_DIR/objects/pack/pack-0000000000000000000000000000000000000000.promisor"
assert_offline_store_rejected promisor-pack
rm -f "$SOURCE_GIT_DIR/objects/pack/pack-0000000000000000000000000000000000000000.promisor"

stage_bundle voffline-alternate
printf '%s\n' "$TEST_ROOT/external-object-store/objects" >"$SOURCE_GIT_DIR/objects/info/alternates"
assert_offline_store_rejected alternate-object-store
rm -f "$SOURCE_GIT_DIR/objects/info/alternates"

stage_bundle voffline-missing
touch "$TEST_ROOT/git-missing"
assert_offline_store_rejected missing-object
rm -f "$TEST_ROOT/git-missing"

# A new policy must retain exact rollback authority for every canonical active
# surface and its immutable five-digest receipt.
stage_bundle vmissingrollback
sed -i '/ rollback /d' "$STAGING_DIRECTORY/las-trust-v1"
if run_installer; then echo 'bundle policy dropped active rollback coverage' >&2; exit 1; fi
assert_active_unchanged 'v1:dispatch-las-command'

# Bundle generation changes share the same root lock as dispatch and refuse to
# run across ordinary release/Caddy recovery boundaries.
stage_bundle vlock
touch "$TEST_ROOT/lock-held"
if run_installer; then echo 'bundle installer ignored the dispatcher lock' >&2; exit 1; fi
rm -f "$TEST_ROOT/lock-held"
assert_active_unchanged 'v1:dispatch-las-command'
touch "$RELEASE_TRANSITION_JOURNAL"
if run_installer; then echo 'bundle installer crossed a pending release transition' >&2; exit 1; fi
rm -f "$RELEASE_TRANSITION_JOURNAL"
assert_active_unchanged 'v1:dispatch-las-command'
touch "$CADDY_BOOTSTRAP_JOURNAL"
if run_installer; then echo 'bundle installer crossed a pending Caddy bootstrap transition' >&2; exit 1; fi
rm -f "$CADDY_BOOTSTRAP_JOURNAL"
assert_active_unchanged 'v1:dispatch-las-command'

# Deploy/candidate users cannot invoke the root-local upgrade capability.
stage_bundle v2
BUNDLE_TEST_SUDO_USER=yonaris-deploy
if run_installer; then echo 'sudo-originated bundle install was accepted' >&2; exit 1; fi
unset BUNDLE_TEST_SUDO_USER
assert_active_unchanged 'v1:dispatch-las-command'
BUNDLE_TEST_UID=1001
if run_installer; then echo 'non-root bundle install was accepted' >&2; exit 1; fi
unset BUNDLE_TEST_UID
assert_active_unchanged 'v1:dispatch-las-command'

# Staging is exact root-owned regular data: no symlink or hardlink anywhere,
# including the producer that may publish migration-readiness evidence.
BUNDLE_TEST_LINK_PATH="$STAGING_DIRECTORY/produce-las-migration-readiness"
if run_installer; then echo 'staging symlink was accepted' >&2; exit 1; fi
unset BUNDLE_TEST_LINK_PATH
assert_active_unchanged 'v1:dispatch-las-command'
ln "$STAGING_DIRECTORY/produce-las-migration-readiness" "$TEST_ROOT/producer-hardlink"
if run_installer; then echo 'staging hardlink was accepted' >&2; exit 1; fi
rm -f "$TEST_ROOT/producer-hardlink"
assert_active_unchanged 'v1:dispatch-las-command'

# Policy hashes bind every program before any active-state mutation.
printf '\n# mutation\n' >>"$STAGING_DIRECTORY/produce-las-migration-readiness"
if run_installer; then echo 'program/policy hash mismatch was accepted' >&2; exit 1; fi
assert_active_unchanged 'v1:dispatch-las-command'

# The root policy cannot authorize a commit whose exact Git object lacks the
# reviewed capability; replace refs and hooks are disabled on every lookup.
stage_bundle vcap
BUNDLE_TEST_CAPABILITY_INVALID=yes
if run_installer; then echo 'invalid Git capability was accepted' >&2; exit 1; fi
unset BUNDLE_TEST_CAPABILITY_INVALID
assert_active_unchanged 'v1:dispatch-las-command'
grep -Fq -- '--no-replace-objects' "$TEST_ROOT/git.log"

# fsync failure before publication cannot expose a partial candidate.
stage_bundle v2
BUNDLE_TEST_SYNC_FAILURE_PATH="$STAGING_DIRECTORY/dispatch-las-command"
if run_installer; then echo 'fsync failure was accepted' >&2; exit 1; fi
unset BUNDLE_TEST_SYNC_FAILURE_PATH
assert_active_unchanged 'v1:dispatch-las-command'
[[ -d "$STAGING_DIRECTORY" ]]

# A crash after staging finalize but before the old journal publication window
# must be recoverable without accepting mixed bytes or changing the predecessor.
stage_bundle vfinalize
set +e
BUNDLE_TEST_SYNC_MODE=kill-after-finalize run_installer >/dev/null 2>&1
finalize_kill_status=$?
set -e
[[ "$finalize_kill_status" -ne 0 && -d "$STAGING_DIRECTORY" ]]
assert_active_unchanged 'v1:dispatch-las-command'
run_installer
assert_active_unchanged 'vfinalize:dispatch-las-command'

# Readers through the formal fixed entrypoint observe only a complete predecessor or candidate.
stage_bundle v2
reader_errors="$TEST_ROOT/reader-errors"
: >"$reader_errors"
(
	while [[ ! -e "$TEST_ROOT/reader-stop" ]]; do
	generation="$($STABLE_DISPATCHER 2>/dev/null || true)"
		case "$generation" in
			vfinalize:dispatch-las-command | v2:dispatch-las-command) ;;
			*) printf 'mixed:%s\n' "$generation" >>"$reader_errors" ;;
		esac
	done
) &
reader_pid=$!
BUNDLE_TEST_SYNC_DELAY=yes run_installer
touch "$TEST_ROOT/reader-stop"
wait "$reader_pid"
[[ ! -s "$reader_errors" ]]
assert_active_unchanged 'v2:dispatch-las-command'

# A crash/failure while publishing the journal is recovered from exact bytes.
stage_bundle vjournal
# The production temp name is deliberately fixed and same-directory.
BUNDLE_TEST_SYNC_FAILURE_PATH="$TRUST_DIRECTORY/.las-stable-bundle-pending-v1.new"
if run_installer; then echo 'journal fsync failure was accepted' >&2; exit 1; fi
unset BUNDLE_TEST_SYNC_FAILURE_PATH
assert_active_unchanged 'v2:dispatch-las-command'
[[ -f "$TRUST_DIRECTORY/.las-stable-bundle-pending-v1.new" ]]
run_installer
assert_active_unchanged 'vjournal:dispatch-las-command'

# A failed pointer rename leaves the predecessor active and a durable journal.
stage_bundle v3
BUNDLE_TEST_MV_MODE=fail-pointer
if run_installer; then echo 'pointer rename failure was accepted' >&2; exit 1; fi
unset BUNDLE_TEST_MV_MODE
assert_active_unchanged 'vjournal:dispatch-las-command'
[[ -f "$TRANSITION_JOURNAL" ]]
run_installer
assert_active_unchanged 'v3:dispatch-las-command'
[[ ! -e "$TRANSITION_JOURNAL" ]]

# SIGKILL before bundle rename is recovered from the finalized staging directory.
stage_bundle vbefore
set +e
BUNDLE_TEST_MV_MODE=kill-before-bundle run_installer >/dev/null 2>&1
kill_status=$?
set -e
[[ "$kill_status" -ne 0 && -f "$TRANSITION_JOURNAL" && -d "$STAGING_DIRECTORY" ]]
assert_active_unchanged 'v3:dispatch-las-command'
run_installer
assert_active_unchanged 'vbefore:dispatch-las-command'

# SIGKILL after bundle rename is recovered by deterministic roll-forward.
stage_bundle v4
set +e
BUNDLE_TEST_MV_MODE=kill-after-bundle run_installer >/dev/null 2>&1
kill_status=$?
set -e
[[ "$kill_status" -ne 0 && -f "$TRANSITION_JOURNAL" ]]
assert_active_unchanged 'vbefore:dispatch-las-command'
run_installer
assert_active_unchanged 'v4:dispatch-las-command'
[[ ! -e "$TRANSITION_JOURNAL" ]]

# SIGKILL after pointer rename is recovered without reverting or mixing versions.
stage_bundle v5
set +e
BUNDLE_TEST_MV_MODE=kill-after-pointer run_installer >/dev/null 2>&1
kill_status=$?
set -e
[[ "$kill_status" -ne 0 && -f "$TRANSITION_JOURNAL" ]]
assert_active_unchanged 'v5:dispatch-las-command'

# A published candidate pointer can outlive SIGKILL while the durable journal
# remains. A forced reader pinned to that candidate must stop under its shared
# lock before calling any stable peer. The installer itself still owns
# postverification and reconciliation while its journal exists.
PENDING_DISPATCHER="$TEST_ROOT/pending-dispatch-las-command"
sed \
	-e "s#/usr/local/libexec/yonaris-las#$STABLE_ROOT#g" \
	-e "s#/etc/yonaris#$TRUST_DIRECTORY#g" \
	-e "s#/var/lib/yonaris#$STATE_DIRECTORY#g" \
	-e "s#/run/lock/yonaris#$LOCK_DIRECTORY#g" \
	-e "s#/usr/bin/id#$MOCK_BIN/id#g" \
	-e "s#/usr/bin/git#$MOCK_BIN/git#g" \
	-e "s#/usr/bin/stat#$MOCK_BIN/stat#g" \
	-e "s#/usr/bin/readlink#$MOCK_BIN/readlink#g" \
	-e "s#/usr/bin/flock#$MOCK_BIN/flock#g" \
	"$DISPATCHER_SOURCE" >"$PENDING_DISPATCHER"
chmod 0755 "$PENDING_DISPATCHER"
: >"$TEST_ROOT/pending-peer-mutations"
set +e
env -i PATH='/usr/bin:/bin' HOME='/nonexistent' \
	LAS_STABLE_BUNDLE_DIR="$(active_bundle_directory)" \
	SSH_ORIGINAL_COMMAND='yonaris-las-v1 probe' \
	REAL_STAT="$REAL_STAT" REAL_READLINK="$REAL_READLINK" \
	/bin/bash --noprofile --norc -p "$PENDING_DISPATCHER" \
	>"$TEST_ROOT/pending-reader.out" 2>"$TEST_ROOT/pending-reader.err"
pending_reader_status=$?
set -e
[[ "$pending_reader_status" -eq 75 ]]
grep -Fq 'stable-bundle installation state is pending' "$TEST_ROOT/pending-reader.err"
[[ ! -s "$TEST_ROOT/pending-peer-mutations" ]] || {
	echo 'A forced reader reached stable peers after kill-after-pointer.' >&2
	cat "$TEST_ROOT/pending-peer-mutations" >&2
	exit 1
}

run_installer
assert_active_unchanged 'v5:dispatch-las-command'
[[ ! -e "$TRANSITION_JOURNAL" ]]

# Failed active-bundle verification restores the exact predecessor pointer.
# A fixed launcher that already pinned the rejected candidate must queue on the
# same lock and, after rollback, reject that stale inherited pin before calling
# any candidate verifier/state/runtime peer.
stage_bundle v6
rm -f "$TEST_ROOT/race-candidate-pointer-live" "$TEST_ROOT/race-reader-pinned" \
	"$TEST_ROOT/race-shared-waiting" "$TEST_ROOT/race-peer-mutations" "$TEST_ROOT/race-flock.log"
if [[ -n "$REAL_FLOCK" ]]; then touch "$TEST_ROOT/race-use-real-flock"; fi
run_installer >"$TEST_ROOT/race-installer.out" 2>"$TEST_ROOT/race-installer.err" &
installer_pid=$!
wait_for_path "$TEST_ROOT/race-candidate-pointer-live"
BUNDLE_RACE_READER=yes SSH_ORIGINAL_COMMAND='yonaris-las-v1 probe' \
	"$STABLE_DISPATCHER" >"$TEST_ROOT/race-reader.out" 2>"$TEST_ROOT/race-reader.err" &
reader_pid=$!
wait_for_path "$TEST_ROOT/race-reader-pinned"
wait_for_path "$TEST_ROOT/race-shared-waiting"
set +e
wait "$installer_pid"
installer_status=$?
wait "$reader_pid"
reader_status=$?
set -e
[[ "$installer_status" -ne 0 && "$reader_status" -eq 75 ]]
assert_active_unchanged 'v5:dispatch-las-command'
[[ ! -e "$TRANSITION_JOURNAL" ]]
grep -Fxq 'The active LAS bundle pointer no longer matches the inherited launcher pin.' \
	"$TEST_ROOT/race-reader.err"
[[ ! -e "$TEST_ROOT/race-peer-mutations" ]]
if [[ -n "$REAL_FLOCK" ]]; then
	[[ "$(grep -Fxc real "$TEST_ROOT/race-flock.log")" -ge 2 ]]
fi
rm -f "$TEST_ROOT/race-use-real-flock"

printf '%s\n' 'root-local atomic LAS stable-bundle installer tests passed'
