#!/bin/bash

set -Eeuo pipefail
set +x
umask 077
PATH='/usr/bin:/bin'
export PATH
readonly PATH

readonly POLICY_TOKEN='yonaris-las-trust-v1'
readonly BUNDLE_TOKEN='yonaris-las-stable-bundle-v1'
readonly JOURNAL_TOKEN='yonaris-las-stable-bundle-transition-v1'
readonly ACTIONS_KEY_FINGERPRINT='SHA256:gM/QEgkfN99cP/Cf9awUOwSb7FMesQTgRCTI9kPh84A'
readonly CAPABILITY_TOKEN='artifact-output-language-v1'
readonly CAPABILITY_PATH='deploy/las/artifact-output-language-compatible'
readonly STABLE_ROOT='/usr/local/libexec/yonaris-las'
readonly STAGING_DIRECTORY='/usr/local/libexec/yonaris-las/.bundle-v1.new'
readonly BUNDLES_DIRECTORY='/usr/local/libexec/yonaris-las/bundles'
readonly TRUST_DIRECTORY='/etc/yonaris'
readonly ACTIVE_POINTER='/etc/yonaris/las-stable-bundle-active-v1'
readonly ACTIVE_POINTER_TEMP='/etc/yonaris/.las-stable-bundle-active-v1.active.new'
readonly TRANSITION_JOURNAL='/etc/yonaris/las-stable-bundle-pending-v1'
readonly TRANSITION_JOURNAL_TEMP='/etc/yonaris/.las-stable-bundle-pending-v1.new'
readonly STATE_DIRECTORY='/var/lib/yonaris'
readonly SOURCE_GIT_DIR='/var/lib/yonaris/las-objects.git'
readonly LOCK_DIRECTORY='/run/lock/yonaris'
readonly RELEASE_TRANSITION_JOURNAL='/etc/yonaris/las-transition-pending-v1'
readonly CADDY_BOOTSTRAP_JOURNAL='/etc/yonaris/las-caddy-bootstrap-pending-v1'
readonly RECEIPT_TOKEN='artifact-output-language-receipt-v2'
readonly RECEIPT_ROOT='/etc/yonaris/las-compatible-releases-v2'
readonly PORTAL_RELEASE='/etc/yonaris/las-active-portal-release-v1'
readonly MARKETING_RELEASE='/etc/yonaris/las-active-marketing-release-v1'
readonly ENTRYPOINT_SHA256='6a68dd97779b2728d32afa81582dcbcc7d10f4bd018061d56dedef62383ed83a'

readonly -a PROGRAMS=(
	'dispatch-las-command'
	'guard-artifact-output-release'
	'install-yonaris-las-trust-policy'
	'manage-las-release-state'
	'manage-las-runtime'
	'manage-las-caddy'
	'verify-yonaris-las-forced-command'
	'produce-las-migration-readiness'
)
readonly -a LABELS=(
	'dispatcher'
	'guard'
	'installer'
	'state-manager'
	'runtime-manager'
	'caddy-manager'
	'verifier'
	'migration-readiness-producer'
)
readonly -a ENTRYPOINT_PATHS=(
	'/usr/local/libexec/yonaris-las/dispatch-las-command'
	'/usr/local/libexec/yonaris-las/guard-artifact-output-release'
	'/usr/local/sbin/install-yonaris-las-trust-policy'
	'/usr/local/libexec/yonaris-las/manage-las-release-state'
	'/usr/local/libexec/yonaris-las/manage-las-runtime'
	'/usr/local/libexec/yonaris-las/manage-las-caddy'
	'/usr/local/sbin/verify-yonaris-las-forced-command'
	'/usr/local/libexec/yonaris-las/produce-las-migration-readiness'
)

fail() {
	/usr/bin/printf '%s\n' "$1" >&2
	exit 1
}

release_transitions_are_clear() {
	[[ ! -e "$RELEASE_TRANSITION_JOURNAL" && ! -L "$RELEASE_TRANSITION_JOURNAL" && \
		! -e "$CADDY_BOOTSTRAP_JOURNAL" && ! -L "$CADDY_BOOTSTRAP_JOURNAL" ]]
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

validate_fixed_launchers() {
	local path hash
	for path in "${ENTRYPOINT_PATHS[@]}"; do
		metadata_matches "$path" file '0:0:755' || return 1
		hash="$(/usr/bin/sha256sum -- "$path" | /usr/bin/awk '{print $1}')"
		[[ "$hash" == "$ENTRYPOINT_SHA256" ]] || return 1
	done
}

digest_is_valid() {
	[[ "$1" =~ ^sha256:[0-9a-f]{64}$ ]]
}

operation_is_valid() {
	case "$1" in
		deploy | rollback | marketing-preflight | marketing-deploy | marketing-verify) return 0 ;;
		*) return 1 ;;
	esac
}

git_local() {
	/usr/bin/env -i PATH='/usr/bin:/bin' HOME='/nonexistent' LC_ALL='C' \
		GIT_CONFIG_NOSYSTEM='1' GIT_CONFIG_GLOBAL='/dev/null' \
		GIT_NO_REPLACE_OBJECTS='1' GIT_NO_LAZY_FETCH='1' \
		GIT_TERMINAL_PROMPT='0' GIT_ASKPASS='/bin/false' SSH_ASKPASS='/bin/false' \
		GIT_SSH_COMMAND='/bin/false' GIT_PAGER='/bin/cat' \
		/usr/bin/git --no-replace-objects --git-dir="$SOURCE_GIT_DIR" \
			-c core.hooksPath=/dev/null -c core.fsmonitor=false \
			-c core.askPass=/bin/false -c credential.helper= \
			-c protocol.allow=never -c protocol.file.allow=never \
			-c protocol.http.allow=never -c protocol.https.allow=never \
			-c protocol.ssh.allow=never -c protocol.git.allow=never \
			-c protocol.ext.allow=never "$@"
}

git_store_is_local_only() {
	local config_names='' config_status=0 found='' key lower_key path
	local objects="$SOURCE_GIT_DIR/objects"
	[[ -f "$SOURCE_GIT_DIR/config" && ! -L "$SOURCE_GIT_DIR/config" && \
		-d "$objects" && ! -L "$objects" ]] || return 1
	for path in \
		"$SOURCE_GIT_DIR/config.worktree" \
		"$SOURCE_GIT_DIR/commondir" \
		"$objects/info/alternates" \
		"$objects/info/http-alternates"; do
		[[ ! -e "$path" && ! -L "$path" ]] || return 1
	done
	if [[ -e "$objects/pack" || -L "$objects/pack" ]]; then
		[[ -d "$objects/pack" && ! -L "$objects/pack" ]] || return 1
		found="$(/usr/bin/find "$objects/pack" -mindepth 1 -maxdepth 1 \
			-name '*.promisor' -print -quit)" || return 1
		[[ -z "$found" ]] || return 1
	fi
	for path in "$SOURCE_GIT_DIR/remotes" "$SOURCE_GIT_DIR/branches"; do
		if [[ -e "$path" || -L "$path" ]]; then
			[[ -d "$path" && ! -L "$path" ]] || return 1
			found="$(/usr/bin/find "$path" -mindepth 1 -print -quit)" || return 1
			[[ -z "$found" ]] || return 1
		fi
	done
	config_names="$(git_local config --local --no-includes --name-only \
		--get-regexp '.*' 2>/dev/null)" || config_status=$?
	if [[ "$config_status" -eq 1 ]]; then
		config_names=''
	elif [[ "$config_status" -ne 0 ]]; then
		return 1
	fi
	while IFS= read -r key; do
		[[ -n "$key" ]] || continue
		lower_key="${key,,}"
		case "$lower_key" in
			remote.* | extensions.partialclone | include.* | includeif.* | \
			core.alternaterefscommand | core.alternaterefsprefixes | \
			core.sshcommand | ssh.variant | protocol.* | credential.* | \
			url.*.insteadof | url.*.pushinsteadof | http.*)
				return 1
				;;
		esac
	done <<<"$config_names"
}

git_clean() {
	git_store_is_local_only || return 1
	git_local "$@"
}

candidate_capability_is_valid() {
	local release_sha="$1" candidate_file status
	[[ "$release_sha" =~ ^[0-9a-f]{40}$ ]] || return 1
	candidate_file="$(/usr/bin/mktemp "$STATE_DIRECTORY/.las-bundle-capability.XXXXXX")" || return 1
	if git_clean cat-file -e "$release_sha^{commit}" 2>/dev/null && \
		git_clean cat-file -p "$release_sha:$CAPABILITY_PATH" >"$candidate_file" 2>/dev/null && \
		/usr/bin/cmp -s "$candidate_file" <(/usr/bin/printf '%s\n' "$CAPABILITY_TOKEN"); then
		status=0
	else
		status=1
	fi
	/usr/bin/rm -f -- "$candidate_file" || return 1
	return "$status"
}

validate_policy_and_programs() {
	local directory="$1" policy_mode="$2"
	local policy="$directory/las-trust-v1" index line label program expected_hash actual_hash
	local verb release_tag operation web_label web_digest worker_label worker_digest
	local migrate_label migrate_digest postgres_label postgres_digest www_label www_digest extra digests
	local -a lines=()
	local -A seen=() release_digests=()

	metadata_matches "$policy" file "0:0:$policy_mode" || return 1
	mapfile -t lines <"$policy"
	[[ "${#lines[@]}" -ge 11 ]] || return 1
	[[ "${lines[0]}" == "$POLICY_TOKEN" ]] || return 1
	[[ "${lines[1]}" == "actions-key-fingerprint $ACTIONS_KEY_FINGERPRINT" ]] || return 1

	for index in "${!PROGRAMS[@]}"; do
		label="${LABELS[$index]}"
		program="${PROGRAMS[$index]}"
		line="${lines[$((index + 2))]}"
		[[ "$line" =~ ^$label-sha256\ ([0-9a-f]{64})$ ]] || return 1
		expected_hash="${BASH_REMATCH[1]}"
		metadata_matches "$directory/$program" file '0:0:755' || return 1
		actual_hash="$(/usr/bin/sha256sum -- "$directory/$program" | /usr/bin/awk '{print $1}')"
		[[ "$actual_hash" == "$expected_hash" ]] || return 1
	done

	for line in "${lines[@]:10}"; do
		read -r verb release_tag operation \
			web_label web_digest worker_label worker_digest \
			migrate_label migrate_digest postgres_label postgres_digest \
			www_label www_digest extra <<<"$line" || return 1
		[[ "$verb" == allow && -z "${extra:-}" ]] || return 1
		[[ "$release_tag" =~ ^sha-[0-9a-f]{40}$ ]] || return 1
		operation_is_valid "$operation" || return 1
		[[ "$web_label" == web-sha256 && "$worker_label" == worker-sha256 && \
			"$migrate_label" == migrate-sha256 && "$postgres_label" == postgres-sha256 && \
			"$www_label" == www-sha256 ]] || return 1
		digest_is_valid "$web_digest" && digest_is_valid "$worker_digest" && \
			digest_is_valid "$migrate_digest" && digest_is_valid "$postgres_digest" && \
			digest_is_valid "$www_digest" || return 1
		[[ -z "${seen[$release_tag $operation]:-}" ]] || return 1
		seen["$release_tag $operation"]=1
		digests="$web_digest $worker_digest $migrate_digest $postgres_digest $www_digest"
		[[ -z "${release_digests[$release_tag]:-}" || \
			"${release_digests[$release_tag]}" == "$digests" ]] || return 1
		release_digests["$release_tag"]="$digests"
		candidate_capability_is_valid "${release_tag#sha-}" || return 1
	done
}

validate_exact_entries() {
	local directory="$1" expected actual program
	expected="$(/usr/bin/printf '%s\n' "${PROGRAMS[@]}" 'las-trust-v1' | /usr/bin/sort)"
	actual="$(/usr/bin/find "$directory" -mindepth 1 -maxdepth 1 -printf '%f\n' | /usr/bin/sort)"
	[[ "$actual" == "$expected" ]] || return 1
	while IFS= read -r path; do
		[[ -z "$path" ]] && continue
		/usr/bin/readlink -- "$path" >/dev/null 2>&1 && return 1
		[[ -f "$path" ]] || return 1
		[[ "$(/usr/bin/stat -c '%h' -- "$path" 2>/dev/null)" == 1 ]] || return 1
	done < <(/usr/bin/find "$directory" -mindepth 1 -maxdepth 1 -print)
}

validate_staging_bundle() {
	metadata_matches "$STAGING_DIRECTORY" directory '0:0:700' || return 1
	validate_exact_entries "$STAGING_DIRECTORY" || return 1
	validate_policy_and_programs "$STAGING_DIRECTORY" 600
}

bundle_directory_for_id() {
	local id="$1"
	digest_is_valid "$id" || return 1
	/usr/bin/printf '%s/sha256-%s\n' "$BUNDLES_DIRECTORY" "${id#sha256:}"
}

validate_installed_bundle() {
	local id="$1" directory
	directory="$(bundle_directory_for_id "$id")" || return 1
	metadata_matches "$directory" directory '0:0:555' || return 1
	validate_exact_entries "$directory" || return 1
	validate_policy_and_programs "$directory" 644 || return 1
	[[ "sha256:$(/usr/bin/sha256sum -- "$directory/las-trust-v1" | /usr/bin/awk '{print $1}')" == "$id" ]]
}

validate_finalized_staging_bundle() {
	local id="$1"
	digest_is_valid "$id" || return 1
	metadata_matches "$STAGING_DIRECTORY" directory '0:0:555' || return 1
	validate_exact_entries "$STAGING_DIRECTORY" || return 1
	validate_policy_and_programs "$STAGING_DIRECTORY" 644 || return 1
	[[ "sha256:$(/usr/bin/sha256sum -- "$STAGING_DIRECTORY/las-trust-v1" | /usr/bin/awk '{print $1}')" == "$id" ]]
}

validate_staging_bundle_for_id() {
	local id="$1"
	digest_is_valid "$id" || return 1
	if validate_finalized_staging_bundle "$id"; then
		return 0
	fi
	validate_staging_bundle || return 1
	[[ "sha256:$(/usr/bin/sha256sum -- "$STAGING_DIRECTORY/las-trust-v1" | /usr/bin/awk '{print $1}')" == "$id" ]]
}

read_active_release() {
	local path="$1" release
	local -a release_lines=()
	if [[ ! -e "$path" && ! -L "$path" ]]; then
		/usr/bin/printf '%s\n' none
		return 0
	fi
	metadata_matches "$path" file '0:0:644' || return 1
	mapfile -t release_lines <"$path"
	[[ "${#release_lines[@]}" -eq 1 && "${release_lines[0]}" =~ ^sha-[0-9a-f]{40}$ ]] || return 1
	release="${release_lines[0]}"
	/usr/bin/cmp -s "$path" <(/usr/bin/printf '%s\n' "$release") || return 1
	/usr/bin/printf '%s\n' "$release"
}

read_receipt_digests() {
	local release="$1" path="$RECEIPT_ROOT/$1"
	local web worker migrate postgres www
	local -a lines=()
	metadata_matches "$path" file '0:0:644' || return 1
	mapfile -t lines <"$path"
	[[ "${#lines[@]}" -eq 7 && "${lines[0]}" == "$RECEIPT_TOKEN" && \
		"${lines[1]}" == "release $release" ]] || return 1
	[[ "${lines[2]}" =~ ^web-sha256\ (sha256:[0-9a-f]{64})$ ]] || return 1; web="${BASH_REMATCH[1]}"
	[[ "${lines[3]}" =~ ^worker-sha256\ (sha256:[0-9a-f]{64})$ ]] || return 1; worker="${BASH_REMATCH[1]}"
	[[ "${lines[4]}" =~ ^migrate-sha256\ (sha256:[0-9a-f]{64})$ ]] || return 1; migrate="${BASH_REMATCH[1]}"
	[[ "${lines[5]}" =~ ^postgres-sha256\ (sha256:[0-9a-f]{64})$ ]] || return 1; postgres="${BASH_REMATCH[1]}"
	[[ "${lines[6]}" =~ ^www-sha256\ (sha256:[0-9a-f]{64})$ ]] || return 1; www="${BASH_REMATCH[1]}"
	/usr/bin/printf '%s %s %s %s %s\n' "$web" "$worker" "$migrate" "$postgres" "$www"
}

validate_active_rollback_coverage() {
	local directory="$1" marker release tuple web worker migrate postgres www expected
	metadata_matches "$RECEIPT_ROOT" directory '0:0:755' || return 1
	for marker in "$PORTAL_RELEASE" "$MARKETING_RELEASE"; do
		release="$(read_active_release "$marker")" || return 1
		[[ "$release" != none ]] || continue
		tuple="$(read_receipt_digests "$release")" || return 1
		read -r web worker migrate postgres www <<<"$tuple"
		expected="allow $release rollback web-sha256 $web worker-sha256 $worker migrate-sha256 $migrate postgres-sha256 $postgres www-sha256 $www"
		[[ "$(/usr/bin/grep -Fxc -- "$expected" "$directory/las-trust-v1")" == 1 ]] || return 1
	done
}

read_active_id() {
	local id
	local -a lines=()
	if [[ ! -e "$ACTIVE_POINTER" && ! -L "$ACTIVE_POINTER" ]]; then
		/usr/bin/printf '%s\n' none
		return 0
	fi
	metadata_matches "$ACTIVE_POINTER" file '0:0:600' || return 1
	mapfile -t lines <"$ACTIVE_POINTER"
	[[ "${#lines[@]}" -eq 2 && "${lines[0]}" == "$BUNDLE_TOKEN" ]] || return 1
	[[ "${lines[1]}" =~ ^bundle-id\ (sha256:[0-9a-f]{64})$ ]] || return 1
	id="${BASH_REMATCH[1]}"
	validate_installed_bundle "$id" || return 1
	/usr/bin/printf '%s\n' "$id"
}

write_transition_journal() {
	local predecessor="$1" candidate="$2"
	[[ "$predecessor" == none ]] || digest_is_valid "$predecessor" || return 1
	digest_is_valid "$candidate" || return 1
	[[ ! -e "$TRANSITION_JOURNAL_TEMP" && ! -L "$TRANSITION_JOURNAL_TEMP" ]] || return 1
	/usr/bin/printf '%s\n' \
		"$JOURNAL_TOKEN" \
		"predecessor $predecessor" \
		"candidate $candidate" >"$TRANSITION_JOURNAL_TEMP" || return 1
	/usr/bin/chmod 0600 -- "$TRANSITION_JOURNAL_TEMP" || return 1
	/usr/bin/sync -f "$TRANSITION_JOURNAL_TEMP" || return 1
	/usr/bin/mv -fT -- "$TRANSITION_JOURNAL_TEMP" "$TRANSITION_JOURNAL" || return 1
	/usr/bin/sync -f "$TRUST_DIRECTORY"
}

read_transition_file() {
	local path="$1"
	local -a lines=()
	metadata_matches "$path" file '0:0:600' || return 1
	mapfile -t lines <"$path"
	[[ "${#lines[@]}" -eq 3 && "${lines[0]}" == "$JOURNAL_TOKEN" ]] || return 1
	[[ "${lines[1]}" =~ ^predecessor\ (none|sha256:[0-9a-f]{64})$ ]] || return 1
	JOURNAL_PREDECESSOR="${BASH_REMATCH[1]}"
	[[ "${lines[2]}" =~ ^candidate\ (sha256:[0-9a-f]{64})$ ]] || return 1
	JOURNAL_CANDIDATE="${BASH_REMATCH[1]}"
}

read_transition_journal() {
	read_transition_file "$TRANSITION_JOURNAL"
}

publish_active_pointer() {
	local id="$1"
	digest_is_valid "$id" || return 1
	validate_installed_bundle "$id" || return 1
	[[ ! -e "$ACTIVE_POINTER_TEMP" && ! -L "$ACTIVE_POINTER_TEMP" ]] || return 1
	/usr/bin/printf '%s\n' "$BUNDLE_TOKEN" "bundle-id $id" >"$ACTIVE_POINTER_TEMP" || return 1
	/usr/bin/chmod 0600 -- "$ACTIVE_POINTER_TEMP" || return 1
	/usr/bin/sync -f "$ACTIVE_POINTER_TEMP" || return 1
	/usr/bin/mv -fT -- "$ACTIVE_POINTER_TEMP" "$ACTIVE_POINTER" || return 1
	/usr/bin/sync -f "$TRUST_DIRECTORY"
}

remove_active_pointer() {
	[[ ! -L "$ACTIVE_POINTER" ]] || return 1
	/usr/bin/rm -f -- "$ACTIVE_POINTER" || return 1
	[[ ! -e "$ACTIVE_POINTER" && ! -L "$ACTIVE_POINTER" ]] || return 1
	/usr/bin/sync -f "$TRUST_DIRECTORY"
}

verify_bundle() {
	local id="$1" directory
	validate_installed_bundle "$id" || return 1
	directory="$(bundle_directory_for_id "$id")" || return 1
	/usr/bin/env -i PATH='/usr/bin:/bin' HOME='/nonexistent' \
		LAS_STABLE_BUNDLE_DIR="$directory" \
		"$directory/verify-yonaris-las-forced-command"
}

clear_transition_journal() {
	/usr/bin/rm -f -- "$TRANSITION_JOURNAL" || return 1
	[[ ! -e "$TRANSITION_JOURNAL" && ! -L "$TRANSITION_JOURNAL" ]] || return 1
	/usr/bin/sync -f "$TRUST_DIRECTORY"
}

restore_predecessor() {
	local predecessor="$1"
	if [[ "$predecessor" == none ]]; then
		remove_active_pointer
	else
		publish_active_pointer "$predecessor"
	fi
}

materialize_candidate_bundle() {
	local candidate="$1" candidate_directory
	candidate_directory="$(bundle_directory_for_id "$candidate")" || return 1
	if [[ -e "$candidate_directory" || -L "$candidate_directory" ]]; then
		validate_installed_bundle "$candidate"
		return
	fi
	if ! validate_finalized_staging_bundle "$candidate"; then
		validate_staging_bundle_for_id "$candidate" || return 1
		finalize_staging_bundle || return 1
		validate_finalized_staging_bundle "$candidate" || return 1
	fi
	/usr/bin/mv -- "$STAGING_DIRECTORY" "$candidate_directory" || return 1
	/usr/bin/sync -f "$BUNDLES_DIRECTORY" || return 1
	validate_installed_bundle "$candidate"
}

reconcile_pending_bundle() {
	local current candidate_directory
	local -a temporary_pointer_lines=()
	read_transition_journal || return 1
	materialize_candidate_bundle "$JOURNAL_CANDIDATE" || return 1
	candidate_directory="$(bundle_directory_for_id "$JOURNAL_CANDIDATE")" || return 1
	validate_active_rollback_coverage "$candidate_directory" || return 1
	if [[ -e "$ACTIVE_POINTER_TEMP" || -L "$ACTIVE_POINTER_TEMP" ]]; then
		metadata_matches "$ACTIVE_POINTER_TEMP" file '0:0:600' || return 1
		mapfile -t temporary_pointer_lines <"$ACTIVE_POINTER_TEMP"
		[[ "${#temporary_pointer_lines[@]}" -eq 2 && \
			"${temporary_pointer_lines[0]}" == "$BUNDLE_TOKEN" && \
			"${temporary_pointer_lines[1]}" == "bundle-id $JOURNAL_CANDIDATE" ]] || return 1
		/usr/bin/rm -f -- "$ACTIVE_POINTER_TEMP" || return 1
		/usr/bin/sync -f "$TRUST_DIRECTORY" || return 1
	fi
	current="$(read_active_id)" || return 1
	case "$current" in
		"$JOURNAL_CANDIDATE") ;;
		"$JOURNAL_PREDECESSOR") publish_active_pointer "$JOURNAL_CANDIDATE" || return 1 ;;
		*) return 1 ;;
	esac
	if ! verify_bundle "$JOURNAL_CANDIDATE"; then
		restore_predecessor "$JOURNAL_PREDECESSOR" || return 1
		clear_transition_journal || return 1
		return 1
	fi
	clear_transition_journal
}

recover_transition_journal_temp() {
	local current candidate_directory
	[[ ! -e "$TRANSITION_JOURNAL" && ! -L "$TRANSITION_JOURNAL" ]] || return 1
	read_transition_file "$TRANSITION_JOURNAL_TEMP" || return 1
	current="$(read_active_id)" || return 1
	[[ "$current" == "$JOURNAL_PREDECESSOR" ]] || return 1
	candidate_directory="$(bundle_directory_for_id "$JOURNAL_CANDIDATE")" || return 1
	if [[ -e "$candidate_directory" || -L "$candidate_directory" ]]; then
		validate_installed_bundle "$JOURNAL_CANDIDATE" || return 1
	else
		validate_staging_bundle_for_id "$JOURNAL_CANDIDATE" || return 1
	fi
	/usr/bin/mv -fT -- "$TRANSITION_JOURNAL_TEMP" "$TRANSITION_JOURNAL" || return 1
	/usr/bin/sync -f "$TRUST_DIRECTORY" || return 1
	reconcile_pending_bundle
}

finalize_staging_bundle() {
	local program
	for program in "${PROGRAMS[@]}"; do
		/usr/bin/sync -f "$STAGING_DIRECTORY/$program" || return 1
	done
	/usr/bin/sync -f "$STAGING_DIRECTORY/las-trust-v1" || return 1
	/usr/bin/chmod 0644 -- "$STAGING_DIRECTORY/las-trust-v1" || return 1
	/usr/bin/chmod 0555 -- "$STAGING_DIRECTORY" || return 1
	/usr/bin/sync -f "$STAGING_DIRECTORY" || return 1
}

[[ $# -eq 0 ]] || fail 'The LAS stable-bundle installer accepts no arguments.'
[[ "$(/usr/bin/id -u)" == 0 ]] || fail 'The LAS stable-bundle installer must run as root.'
[[ -z "${SUDO_USER:-}" ]] || fail 'The LAS stable-bundle installer is root-local and is not a deploy-user sudo capability.'
metadata_matches "$STABLE_ROOT" directory '0:0:755' || fail 'The LAS stable root is not exact root-owned state.'
metadata_matches "$BUNDLES_DIRECTORY" directory '0:0:755' || fail 'The LAS versioned-bundle directory is not exact root-owned state.'
metadata_matches "$TRUST_DIRECTORY" directory '0:0:755' || fail 'The LAS trust directory is not exact root-owned state.'
metadata_matches "$STATE_DIRECTORY" directory '0:0:711' || fail 'The LAS state directory is not exact root-owned state.'
metadata_matches "$SOURCE_GIT_DIR" directory '0:0:700' || fail 'The root-only LAS Git object store is invalid.'
metadata_matches "$LOCK_DIRECTORY" directory '0:0:700' || fail 'The shared root LAS control lock is invalid.'
exec 9<"$LOCK_DIRECTORY"
/usr/bin/flock --wait 1800 9 || fail 'The shared LAS control lock could not be acquired.'
release_transitions_are_clear || fail 'A release or Caddy transition is pending; stable-bundle changes are forbidden.'
validate_fixed_launchers || fail 'The fixed LAS bundle launchers are missing, mutable, or not the reviewed launcher bytes.'
reconciled=false
if [[ -e "$TRANSITION_JOURNAL_TEMP" || -L "$TRANSITION_JOURNAL_TEMP" ]]; then
	recover_transition_journal_temp || fail 'The interrupted LAS bundle-journal publication could not be reconciled safely.'
	reconciled=true
fi

if [[ -e "$TRANSITION_JOURNAL" || -L "$TRANSITION_JOURNAL" ]]; then
	reconcile_pending_bundle || fail 'The pending LAS stable-bundle transition could not be reconciled safely.'
	reconciled=true
fi
if [[ "$reconciled" == true && ! -e "$STAGING_DIRECTORY" && ! -L "$STAGING_DIRECTORY" ]]; then
	/usr/bin/printf '%s\n' 'Pending LAS stable-bundle transition reconciled.'
	exit 0
fi
[[ ! -e "$ACTIVE_POINTER_TEMP" && ! -L "$ACTIVE_POINTER_TEMP" ]] || fail 'A stray LAS active-pointer temporary file exists.'

# Recover the only legacy crash shape that predates journal-first finalize: a
# complete, immutable staging bundle with no transition record. Its exact ID
# and predecessor are re-bound before any publication.
if [[ -e "$STAGING_DIRECTORY" && ! -L "$STAGING_DIRECTORY" ]]; then
	orphan_candidate="sha256:$(/usr/bin/sha256sum -- "$STAGING_DIRECTORY/las-trust-v1" 2>/dev/null | /usr/bin/awk '{print $1}')"
	if validate_finalized_staging_bundle "$orphan_candidate"; then
		validate_active_rollback_coverage "$STAGING_DIRECTORY" || \
			fail 'The finalized LAS staging orphan drops active rollback coverage.'
		orphan_predecessor="$(read_active_id)" || fail 'The active LAS bundle pointer is invalid.'
		write_transition_journal "$orphan_predecessor" "$orphan_candidate" || \
			fail 'The finalized LAS staging orphan could not be bound to a recovery journal.'
		reconcile_pending_bundle || fail 'The finalized LAS staging orphan could not be reconciled safely.'
		/usr/bin/printf '%s\n' 'Finalized LAS staging orphan reconciled.'
		exit 0
	fi
fi

validate_staging_bundle || fail 'The root-owned LAS staging bundle or its policy/hash binding is invalid.'
validate_active_rollback_coverage "$STAGING_DIRECTORY" || \
	fail 'The candidate LAS policy does not preserve every active release rollback receipt.'
predecessor="$(read_active_id)" || fail 'The active LAS bundle pointer is invalid.'
candidate="sha256:$(/usr/bin/sha256sum -- "$STAGING_DIRECTORY/las-trust-v1" | /usr/bin/awk '{print $1}')"
candidate_directory="$(bundle_directory_for_id "$candidate")" || fail 'The LAS staging bundle ID is invalid.'
[[ ! -e "$candidate_directory" && ! -L "$candidate_directory" ]] || fail 'The LAS candidate bundle ID already exists.'

write_transition_journal "$predecessor" "$candidate" || fail 'The LAS stable-bundle transition journal could not be persisted.'
if ! finalize_staging_bundle; then
	clear_transition_journal || fail 'LAS staging finalize failed and its recovery journal could not be cleared.'
	fail 'The LAS staging bundle could not be durably finalized.'
fi
if ! /usr/bin/mv -- "$STAGING_DIRECTORY" "$candidate_directory"; then
	fail 'The LAS versioned bundle rename failed; rerun the installer to reconcile the journal.'
fi
/usr/bin/sync -f "$BUNDLES_DIRECTORY" || fail 'The LAS versioned bundle directory could not be persisted.'
release_transitions_are_clear || fail 'A release or Caddy transition appeared before bundle activation.'
if ! publish_active_pointer "$candidate"; then
	fail 'The LAS active-bundle pointer rename failed; rerun the installer to reconcile the journal.'
fi
if ! verify_bundle "$candidate"; then
	restore_predecessor "$predecessor" || fail 'LAS bundle verification and predecessor restoration both failed; stop all deployments.'
	clear_transition_journal || fail 'The LAS predecessor was restored but the transition journal could not be cleared.'
	fail 'LAS bundle post-verification failed; the exact predecessor pointer was restored.'
fi
release_transitions_are_clear || fail 'A release or Caddy transition appeared during bundle verification.'
clear_transition_journal || fail 'The LAS bundle is active, but its completed transition journal could not be cleared.'
/usr/bin/printf '%s\n' 'LAS stable programs and trust policy installed as one atomic bundle.'
