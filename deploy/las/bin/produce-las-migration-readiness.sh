#!/bin/bash

set -Eeuo pipefail
set +x
umask 077
PATH='/usr/bin:/bin'
export PATH
readonly PATH

readonly TRUST_DIRECTORY='/etc/yonaris'
readonly MIGRATION_READINESS_ROOT='/etc/yonaris/las-migration-readiness-v1'
readonly MIGRATION_EVIDENCE_ROOT='/etc/yonaris/las-migration-evidence-v1'
readonly STATE_DIRECTORY='/var/lib/yonaris'
readonly MIGRATION_WORK_ROOT='/var/lib/yonaris/migration-readiness-work-v1'
readonly LOCK_DIRECTORY='/run/lock/yonaris'
readonly BACKUP_ADAPTER='/usr/local/libexec/yonaris-las/store-las-migration-backup'
if [[ -n "${LAS_STABLE_BUNDLE_DIR:-}" ]]; then
	STABLE_DIRECTORY="$LAS_STABLE_BUNDLE_DIR"
else
	STABLE_DIRECTORY='/usr/local/libexec/yonaris-las'
fi
readonly STABLE_DIRECTORY
readonly STATE_MANAGER="$STABLE_DIRECTORY/manage-las-release-state"
readonly RUNTIME_MANAGER="$STABLE_DIRECTORY/manage-las-runtime"

fail() {
	/usr/bin/printf '%s\n' "$1" >&2
	exit "${2:-1}"
}

metadata_matches() {
	local path="$1" kind="$2" expected="$3"
	if /usr/bin/readlink -- "$path" >/dev/null 2>&1; then
		return 1
	fi
	case "$kind" in
		directory) [[ -d "$path" ]] || return 1 ;;
		file) [[ -f "$path" && -r "$path" ]] || return 1 ;;
		*) return 1 ;;
	esac
	[[ "$(/usr/bin/stat -c '%u:%g:%a' -- "$path" 2>/dev/null)" == "$expected" ]] && \
		[[ "$kind" != file || "$(/usr/bin/stat -c '%h' -- "$path" 2>/dev/null)" == 1 ]]
}

release_is_valid() {
	[[ "$1" =~ ^sha-[0-9a-f]{40}$ ]]
}

digest_is_valid() {
	[[ "$1" =~ ^sha256:[0-9a-f]{64}$ ]]
}

prepare_private_directory() {
	local path="$1" parent
	parent="$(/usr/bin/dirname -- "$path")"
	if [[ ! -e "$path" && ! -L "$path" ]]; then
		/usr/bin/mkdir -- "$path" || return 1
		/usr/bin/chown 0:0 -- "$path" || return 1
		/usr/bin/chmod 0700 -- "$path" || return 1
		/usr/bin/sync -f "$parent" || return 1
	fi
	metadata_matches "$path" directory '0:0:700'
}

state_manager() {
	metadata_matches "$STATE_MANAGER" file '0:0:755' && \
		/usr/bin/env -i PATH='/usr/bin:/bin' HOME='/nonexistent' \
			LAS_STABLE_BUNDLE_DIR="${LAS_STABLE_BUNDLE_DIR:-}" \
			/bin/bash --noprofile --norc -p "$STATE_MANAGER" "$@"
}

runtime_manager() {
	metadata_matches "$RUNTIME_MANAGER" file '0:0:755' && \
		/usr/bin/env -i PATH='/usr/bin:/bin' HOME='/nonexistent' \
			LAS_STABLE_BUNDLE_DIR="${LAS_STABLE_BUNDLE_DIR:-}" \
			/bin/bash --noprofile --norc -p "$RUNTIME_MANAGER" "$@"
}

backup_adapter() {
	metadata_matches "$BACKUP_ADAPTER" file '0:0:755' && \
		/usr/bin/env -i PATH='/usr/bin:/bin' HOME='/nonexistent' \
			"$BACKUP_ADAPTER" "$@"
}

prepare_publication_file() {
	local path="$1" contents="$2"
	/usr/bin/printf '%s' "$contents" >"$path" || return 1
	/usr/bin/chown 0:0 -- "$path" || return 1
	/usr/bin/chmod 0400 -- "$path" || return 1
	/usr/bin/sync -f "$path" || return 1
	metadata_matches "$path" file '0:0:400'
}

publish_no_replace() {
	local source="$1" destination="$2"
	[[ ! -e "$destination" && ! -L "$destination" ]] || return 1
	/usr/bin/mv -nT -- "$source" "$destination" || return 1
	# GNU mv -n exits successfully when it declines a raced destination.
	[[ ! -e "$source" && ! -L "$source" ]] || return 1
	metadata_matches "$destination" file '0:0:400'
}

mv_supports_atomic_no_replace() {
	local version major minor extra
	version="$(/usr/bin/mv --version 2>/dev/null | /usr/bin/sed -n '1{s/^mv (GNU coreutils) \([0-9][0-9]*\)\.\([0-9][0-9]*\).*$/\1 \2/p;}')" || return 1
	read -r major minor extra <<<"$version"
	[[ -z "${extra:-}" && "$major" =~ ^[0-9]+$ && "$minor" =~ ^[0-9]+$ ]] || return 1
	(( major > 8 || (major == 8 && minor >= 32) ))
}

durably_verify_readiness() {
	local release_tag="$1" web="$2" worker="$3" migrate="$4" postgres="$5" www="$6"
	local attestation="$MIGRATION_READINESS_ROOT/$release_tag"
	local backup_evidence="$MIGRATION_EVIDENCE_ROOT/$release_tag.backup"
	local rehearsal_evidence="$MIGRATION_EVIDENCE_ROOT/$release_tag.rehearsal"
	state_manager migration-readiness "$release_tag" "$web" "$worker" "$migrate" "$postgres" "$www" \
		2>/dev/null | /usr/bin/grep -Fxq 'las-migration-readiness-v1 ok' || return 1
	/usr/bin/sync -f "$backup_evidence" && \
		/usr/bin/sync -f "$rehearsal_evidence" && \
		/usr/bin/sync -f "$attestation" && \
		/usr/bin/sync -f "$MIGRATION_EVIDENCE_ROOT" && \
		/usr/bin/sync -f "$MIGRATION_READINESS_ROOT" || return 1
	state_manager migration-readiness "$release_tag" "$web" "$worker" "$migrate" "$postgres" "$www" \
		2>/dev/null | /usr/bin/grep -Fxq 'las-migration-readiness-v1 ok'
}

[[ "$(/usr/bin/id -u)" == 0 ]] || fail 'The migration-readiness producer must run as root.' 2
[[ -z "${SUDO_USER:-}" ]] || fail 'The migration-readiness producer is direct-root only.' 2
mv_supports_atomic_no_replace || \
	fail 'GNU coreutils mv >= 8.32 with atomic no-replace support is required.' 2
[[ $# -eq 6 ]] || fail 'Usage: produce-las-migration-readiness <release> <five digests>' 2
release_tag="$1"; web="$2"; worker="$3"; migrate="$4"; postgres="$5"; www="$6"
release_is_valid "$release_tag" && digest_is_valid "$web" && digest_is_valid "$worker" && \
	digest_is_valid "$migrate" && digest_is_valid "$postgres" && digest_is_valid "$www" || \
	fail 'Refusing an invalid migration-readiness release tuple.' 2
if [[ -n "${LAS_STABLE_BUNDLE_DIR:-}" ]]; then
	[[ "$LAS_STABLE_BUNDLE_DIR" =~ ^/usr/local/libexec/yonaris-las/bundles/sha256-[0-9a-f]{64}$ ]] || \
		fail 'The active LAS bundle pin is invalid.' 2
fi

metadata_matches "$LOCK_DIRECTORY" directory '0:0:700' || \
	fail 'The shared root LAS control lock is invalid.'
exec 9<"$LOCK_DIRECTORY"
/usr/bin/flock --exclusive --wait 1800 9 || fail 'The exclusive LAS control lock could not be acquired.' 75

metadata_matches "$TRUST_DIRECTORY" directory '0:0:755' || \
	fail 'The root LAS trust directory is invalid.'
metadata_matches "$STATE_DIRECTORY" directory '0:0:711' || \
	fail 'The root LAS state directory is invalid.'
prepare_private_directory "$MIGRATION_READINESS_ROOT" && \
	prepare_private_directory "$MIGRATION_EVIDENCE_ROOT" && \
	prepare_private_directory "$MIGRATION_WORK_ROOT" || \
	fail 'The root-only migration-readiness directories are invalid.'
metadata_matches "$STATE_MANAGER" file '0:0:755' && \
	metadata_matches "$RUNTIME_MANAGER" file '0:0:755' && \
	metadata_matches "$BACKUP_ADAPTER" file '0:0:755' || \
	fail 'A fixed migration-readiness peer is missing or has unsafe metadata.'

state_manager migration-readiness-runtime-authorization \
	"$release_tag" "$web" "$worker" "$migrate" "$postgres" "$www" \
	| /usr/bin/grep -Fxq 'las-migration-readiness-runtime-authorization-v1 ok' || \
	fail 'The exact migration-readiness runtime tuple is not authorized.'

if durably_verify_readiness "$release_tag" "$web" "$worker" "$migrate" "$postgres" "$www"; then
	/usr/bin/printf '%s\n' 'las-migration-readiness-v1 ok'
	exit 0
fi

attestation="$MIGRATION_READINESS_ROOT/$release_tag"
backup_evidence="$MIGRATION_EVIDENCE_ROOT/$release_tag.backup"
rehearsal_evidence="$MIGRATION_EVIDENCE_ROOT/$release_tag.rehearsal"
for existing in "$attestation" "$backup_evidence" "$rehearsal_evidence"; do
	[[ ! -e "$existing" && ! -L "$existing" ]] || \
		fail 'Existing migration-readiness evidence conflicts with this release tuple.'
done

release_work_root="$MIGRATION_WORK_ROOT/$release_tag"
prepare_private_directory "$release_work_root" || fail 'The release migration work directory is invalid.'
work_directory="$(/usr/bin/mktemp -d "$release_work_root/.producer.XXXXXX")" || \
	fail 'Could not create the root-only migration work directory.'
/usr/bin/chown 0:0 -- "$work_directory" || fail 'Could not own the migration work directory.'
/usr/bin/chmod 0700 -- "$work_directory" || fail 'Could not protect the migration work directory.'
metadata_matches "$work_directory" directory '0:0:700' || fail 'The migration work directory has unsafe metadata.'

cleanup_work() {
	local status="$?"
	trap - EXIT
	/usr/bin/rm -f -- "${backup_temporary:-}" "${rehearsal_temporary:-}" "${attestation_temporary:-}"
	if [[ -n "${work_directory:-}" ]]; then
		[[ "$work_directory" == "$release_work_root"/.producer.* && "$work_directory" != "$release_work_root" ]] || \
			exit 1
		/usr/bin/chmod -R u+w -- "$work_directory" 2>/dev/null || true
		/usr/bin/rm -rf -- "$work_directory"
	fi
	/usr/bin/rmdir -- "$release_work_root" 2>/dev/null || true
	exit "$status"
}
trap cleanup_work EXIT

backup="$work_directory/database.dump"
returned_copy="$work_directory/returned.dump"
rehearsal_result="$work_directory/rehearsal.result"
runtime_manager migration-backup "$release_tag" "$web" "$worker" "$migrate" "$postgres" "$www" \
	"$backup" migration-readiness-runtime-v1 || fail 'The fixed runtime backup operation failed.'
metadata_matches "$backup" file '0:0:600' && [[ -s "$backup" ]] || \
	fail 'The runtime backup staging file is invalid.'
backup_hash="$(/usr/bin/sha256sum -- "$backup" | /usr/bin/awk '{print $1}')" || \
	fail 'Could not hash the staged migration backup.'
[[ "$backup_hash" =~ ^[0-9a-f]{64}$ ]] || fail 'The staged backup digest is invalid.'

backup_adapter put-get "$release_tag" "$backup_hash" "$backup" "$returned_copy" || \
	fail 'The fixed off-host backup round trip failed.'
metadata_matches "$backup" file '0:0:600' && metadata_matches "$returned_copy" file '0:0:600' && \
	[[ -s "$backup" && -s "$returned_copy" ]] || fail 'The off-host backup staging metadata is invalid.'
source_hash_after="$(/usr/bin/sha256sum -- "$backup" | /usr/bin/awk '{print $1}')" || \
	fail 'Could not re-hash the staged migration backup.'
returned_hash="$(/usr/bin/sha256sum -- "$returned_copy" | /usr/bin/awk '{print $1}')" || \
	fail 'Could not hash the returned off-host backup copy.'
[[ "$source_hash_after" == "$backup_hash" && "$returned_hash" == "$backup_hash" ]] || \
	fail 'The off-host backup round trip changed the authorized backup bytes.'

runtime_manager migration-rehearse "$release_tag" "$web" "$worker" "$migrate" "$postgres" "$www" \
	"$returned_copy" "$rehearsal_result" migration-readiness-runtime-v1 || \
	fail 'The fixed migration rehearsal operation failed.'
metadata_matches "$rehearsal_result" file '0:0:600' && \
	/usr/bin/cmp -s "$rehearsal_result" \
		<(/usr/bin/printf '%s\n' 'las-migration-rehearsal-runtime-v1 ok') || \
	fail 'The migration rehearsal result is invalid.'

printf -v backup_contents \
	'las-migration-backup-evidence-v1\nrelease %s\nbackup-sha256 %s\nreturned-copy-sha256 %s\noff-host-round-trip exact-bytes\n' \
	"$release_tag" "$backup_hash" "$returned_hash"
printf -v rehearsal_contents \
	'las-migration-rehearsal-evidence-v1\nrelease %s\nweb-sha256 %s\nworker-sha256 %s\nmigrate-sha256 %s\npostgres-sha256 %s\nwww-sha256 %s\nbackup-sha256 %s\nreturned-copy-sha256 %s\nruntime-result las-migration-rehearsal-runtime-v1-ok\n' \
	"$release_tag" "$web" "$worker" "$migrate" "$postgres" "$www" "$backup_hash" "$returned_hash"

backup_temporary="$(/usr/bin/mktemp "$MIGRATION_EVIDENCE_ROOT/.backup.XXXXXX")" || \
	fail 'Could not stage backup evidence.'
rehearsal_temporary="$(/usr/bin/mktemp "$MIGRATION_EVIDENCE_ROOT/.rehearsal.XXXXXX")" || \
	fail 'Could not stage rehearsal evidence.'
attestation_temporary="$(/usr/bin/mktemp "$MIGRATION_READINESS_ROOT/.attestation.XXXXXX")" || \
	fail 'Could not stage migration readiness.'
prepare_publication_file "$backup_temporary" "$backup_contents" && \
	prepare_publication_file "$rehearsal_temporary" "$rehearsal_contents" || \
	fail 'Could not durably stage migration evidence.'
backup_evidence_hash="$(/usr/bin/sha256sum -- "$backup_temporary" | /usr/bin/awk '{print $1}')" || \
	fail 'Could not hash backup evidence.'
rehearsal_evidence_hash="$(/usr/bin/sha256sum -- "$rehearsal_temporary" | /usr/bin/awk '{print $1}')" || \
	fail 'Could not hash rehearsal evidence.'
printf -v attestation_contents \
	'las-migration-readiness-v1\nrelease %s\nweb-sha256 %s\nworker-sha256 %s\nmigrate-sha256 %s\npostgres-sha256 %s\nwww-sha256 %s\nbackup-evidence-sha256 %s\nrehearsal-evidence-sha256 %s\n' \
	"$release_tag" "$web" "$worker" "$migrate" "$postgres" "$www" \
	"$backup_evidence_hash" "$rehearsal_evidence_hash"
prepare_publication_file "$attestation_temporary" "$attestation_contents" || \
	fail 'Could not durably stage migration readiness.'

for existing in "$attestation" "$backup_evidence" "$rehearsal_evidence"; do
	[[ ! -e "$existing" && ! -L "$existing" ]] || \
		fail 'Migration-readiness evidence appeared during publication.'
done
publish_no_replace "$backup_temporary" "$backup_evidence" || fail 'Could not publish backup evidence without conflict.'
backup_temporary=''
publish_no_replace "$rehearsal_temporary" "$rehearsal_evidence" || \
	fail 'Could not publish rehearsal evidence without conflict.'
rehearsal_temporary=''
/usr/bin/sync -f "$MIGRATION_EVIDENCE_ROOT" || fail 'Could not durably publish migration evidence.'
publish_no_replace "$attestation_temporary" "$attestation" || \
	fail 'Could not publish migration readiness without conflict.'
attestation_temporary=''
/usr/bin/sync -f "$MIGRATION_READINESS_ROOT" || fail 'Could not durably publish migration readiness.'

durably_verify_readiness "$release_tag" "$web" "$worker" "$migrate" "$postgres" "$www" || \
	fail 'Published migration-readiness evidence failed exact verification.'
/usr/bin/printf '%s\n' 'las-migration-readiness-v1 ok'
