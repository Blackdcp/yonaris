#!/bin/bash

set -Eeuo pipefail
set +x
umask 077
PATH='/usr/bin:/bin'
export PATH
readonly PATH

readonly POLICY_TOKEN='yonaris-las-trust-v1'
readonly ACTIONS_KEY_FINGERPRINT='SHA256:gM/QEgkfN99cP/Cf9awUOwSb7FMesQTgRCTI9kPh84A'
readonly TRUST_DIRECTORY='/etc/yonaris'
readonly STAGING_POLICY='/etc/yonaris/.las-trust-v1.new'
readonly LIVE_POLICY='/etc/yonaris/las-trust-v1'
readonly ROLLBACK_POLICY='/etc/yonaris/.las-trust-v1.rollback'
readonly STATE_DIRECTORY='/var/lib/yonaris'
readonly SOURCE_GIT_DIR='/var/lib/yonaris/las-objects.git'
readonly CAPABILITY_PATH='deploy/las/artifact-output-language-compatible'
readonly CAPABILITY_TOKEN='artifact-output-language-v1'
readonly STABLE_DIRECTORY='/usr/local/libexec/yonaris-las'
readonly STABLE_DISPATCHER='/usr/local/libexec/yonaris-las/dispatch-las-command'
readonly STABLE_GUARD='/usr/local/libexec/yonaris-las/guard-artifact-output-release'
readonly STABLE_INSTALLER='/usr/local/sbin/install-yonaris-las-trust-policy'
readonly STABLE_STATE_MANAGER='/usr/local/libexec/yonaris-las/manage-las-release-state'
readonly STABLE_RUNTIME_MANAGER='/usr/local/libexec/yonaris-las/manage-las-runtime'
readonly STABLE_CADDY_MANAGER='/usr/local/libexec/yonaris-las/manage-las-caddy'
readonly ROOT_VERIFIER='/usr/local/sbin/verify-yonaris-las-forced-command'

fail() {
	/usr/bin/printf '%s\n' "$1" >&2
	exit 1
}

metadata_matches() {
	local path="$1"
	local kind="$2"
	local expected="$3"
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

candidate_capability_is_valid() {
	local release_tag="$1" release_sha="${1#sha-}" candidate status
	candidate="$(/usr/bin/mktemp)"
	if git_store_is_local_only && \
		git_local cat-file -e "$release_sha^{commit}" && \
		git_local cat-file -p "$release_sha:$CAPABILITY_PATH" >"$candidate" && \
		/usr/bin/cmp -s "$candidate" <(/usr/bin/printf '%s\n' "$CAPABILITY_TOKEN"); then
		status=0
	else
		status=1
	fi
	/usr/bin/rm -f -- "$candidate"
	return "$status"
}

operation_is_valid() {
	case "$1" in
		deploy | rollback | marketing-preflight | marketing-deploy | marketing-verify) return 0 ;;
		*) return 1 ;;
	esac
}

digest_is_valid() {
	[[ "$1" =~ ^sha256:[0-9a-f]{64}$ ]]
}

validate_policy_file() {
	local path="$1"
	local required_mode="$2"
	local -a lines=()
	local -A seen=()
	local -A release_digests=()
	local verb release_tag operation web_label web_digest worker_label worker_digest
	local migrate_label migrate_digest postgres_label postgres_digest www_label www_digest extra
	local expected_path expected_hash label line index digests

	metadata_matches "$path" file "0:0:$required_mode" || return 1
	mapfile -t lines <"$path"
	[[ "${#lines[@]}" -ge 10 ]] || return 1
	[[ "${lines[0]}" == "$POLICY_TOKEN" ]] || return 1
	[[ "${lines[1]}" == "actions-key-fingerprint $ACTIONS_KEY_FINGERPRINT" ]] || return 1

	for index in 2 3 4 5 6 7 8; do
		case "$index" in
			2) label='dispatcher'; expected_path="$STABLE_DISPATCHER" ;;
			3) label='guard'; expected_path="$STABLE_GUARD" ;;
			4) label='installer'; expected_path="$STABLE_INSTALLER" ;;
			5) label='state-manager'; expected_path="$STABLE_STATE_MANAGER" ;;
			6) label='runtime-manager'; expected_path="$STABLE_RUNTIME_MANAGER" ;;
			7) label='caddy-manager'; expected_path="$STABLE_CADDY_MANAGER" ;;
			8) label='verifier'; expected_path="$ROOT_VERIFIER" ;;
		esac
		line="${lines[$index]}"
		[[ "$line" =~ ^$label-sha256\ ([0-9a-f]{64})$ ]] || return 1
		expected_hash="${BASH_REMATCH[1]}"
		metadata_matches "$expected_path" file '0:0:755' || return 1
		[[ "$(/usr/bin/sha256sum -- "$expected_path" | /usr/bin/awk '{print $1}')" == \
			"$expected_hash" ]] || return 1
	done

	for line in "${lines[@]:9}"; do
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
		candidate_capability_is_valid "$release_tag" || return 1
	done
}

rollback_policy_install() {
	if [[ -f "$ROLLBACK_POLICY" && ! -L "$ROLLBACK_POLICY" ]]; then
		/usr/bin/mv -f -- "$ROLLBACK_POLICY" "$LIVE_POLICY" || return 1
		validate_policy_file "$LIVE_POLICY" 644 || return 1
	else
		/usr/bin/rm -f -- "$LIVE_POLICY" || return 1
		[[ ! -e "$LIVE_POLICY" && ! -L "$LIVE_POLICY" ]] || return 1
	fi
	/usr/bin/sync -f "$TRUST_DIRECTORY"
}

[[ $# -eq 0 ]] || {
	/usr/bin/printf '%s\n' 'The LAS trust policy installer accepts no arguments.' >&2
	exit 2
}
[[ "$(/usr/bin/id -u)" == 0 ]] || fail 'The LAS trust policy installer must run as root.'
[[ -z "${SUDO_USER:-}" ]] || fail 'The LAS trust policy installer is root-local and is not a deploy-user sudo capability.'
[[ -z "${LAS_STABLE_BUNDLE_DIR:-}" ]] || \
	fail 'Standalone trust-policy replacement is disabled after atomic stable-bundle activation.'
metadata_matches "$TRUST_DIRECTORY" directory '0:0:755' || \
	fail 'The LAS trust directory is not exact root-owned state.'
metadata_matches "$STATE_DIRECTORY" directory '0:0:711' || \
	fail 'The root-owned LAS state parent is invalid.'
metadata_matches "$SOURCE_GIT_DIR" directory '0:0:700' || \
	fail 'The root-owned LAS Git object store is invalid.'
[[ ! -e "$ROLLBACK_POLICY" && ! -L "$ROLLBACK_POLICY" ]] || \
	fail 'A prior LAS policy installation recovery file still exists.'
validate_policy_file "$STAGING_POLICY" 600 || \
	fail 'The same-directory root-owned LAS staging policy is invalid.'

had_live=false
if [[ -e "$LIVE_POLICY" || -L "$LIVE_POLICY" ]]; then
	validate_policy_file "$LIVE_POLICY" 644 || fail 'The live LAS policy is not a currently verified rollback source.'
	/usr/bin/ln -- "$LIVE_POLICY" "$ROLLBACK_POLICY" || fail 'Could not bind the prior LAS policy inode for rollback.'
	had_live=true
fi

/usr/bin/chmod 0644 -- "$STAGING_POLICY" || fail 'Could not finalize LAS staging policy mode.'
if ! /usr/bin/mv -f -- "$STAGING_POLICY" "$LIVE_POLICY" || \
	! /usr/bin/sync -f "$TRUST_DIRECTORY" || \
	! validate_policy_file "$LIVE_POLICY" 644 || \
	! "$ROOT_VERIFIER"; then
	if ! rollback_policy_install; then
		fail 'LAS policy post-verification and rollback both failed; stop all deployments.'
	fi
	fail 'LAS policy post-verification failed; the last verified policy was restored.'
fi

if [[ "$had_live" == true ]]; then
	/usr/bin/rm -f -- "$ROLLBACK_POLICY" || fail 'Could not remove LAS policy rollback file.'
fi
/usr/bin/sync -f "$TRUST_DIRECTORY"
/usr/bin/printf '%s\n' 'LAS trust policy installed and post-verified.'
