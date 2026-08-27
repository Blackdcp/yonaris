#!/bin/bash

set -Eeuo pipefail
set +x
umask 077
PATH='/usr/bin:/bin'
export PATH
readonly PATH

readonly CAPABILITY_TOKEN='artifact-output-language-v1'
readonly CAPABILITY_PATH='deploy/las/artifact-output-language-compatible'
readonly POLICY_TOKEN='yonaris-las-trust-v1'
readonly RECEIPT_TOKEN='artifact-output-language-receipt-v2'
readonly ACTIONS_KEY_FINGERPRINT='SHA256:gM/QEgkfN99cP/Cf9awUOwSb7FMesQTgRCTI9kPh84A'
readonly STATE_DIRECTORY='/var/lib/yonaris'
readonly SOURCE_GIT_DIR='/var/lib/yonaris/las-objects.git'
readonly RECEIPT_ROOT='/etc/yonaris/las-compatible-releases-v2'
if [[ -n "${LAS_STABLE_BUNDLE_DIR:-}" ]]; then
	STABLE_DIRECTORY="$LAS_STABLE_BUNDLE_DIR"
	STABLE_DIRECTORY_MODE='555'
	TRUST_POLICY="$STABLE_DIRECTORY/las-trust-v1"
	STABLE_INSTALLER="$STABLE_DIRECTORY/install-yonaris-las-trust-policy"
	ROOT_VERIFIER="$STABLE_DIRECTORY/verify-yonaris-las-forced-command"
else
	STABLE_DIRECTORY='/usr/local/libexec/yonaris-las'
	STABLE_DIRECTORY_MODE='755'
	TRUST_POLICY='/etc/yonaris/las-trust-v1'
	STABLE_INSTALLER='/usr/local/sbin/install-yonaris-las-trust-policy'
	ROOT_VERIFIER='/usr/local/sbin/verify-yonaris-las-forced-command'
fi
readonly STABLE_DIRECTORY STABLE_DIRECTORY_MODE TRUST_POLICY STABLE_INSTALLER ROOT_VERIFIER
readonly STABLE_DISPATCHER="$STABLE_DIRECTORY/dispatch-las-command"
readonly STABLE_GUARD="$STABLE_DIRECTORY/guard-artifact-output-release"
readonly STABLE_STATE_MANAGER="$STABLE_DIRECTORY/manage-las-release-state"
readonly STABLE_RUNTIME_MANAGER="$STABLE_DIRECTORY/manage-las-runtime"
readonly STABLE_CADDY_MANAGER="$STABLE_DIRECTORY/manage-las-caddy"
readonly STABLE_PRODUCER="$STABLE_DIRECTORY/produce-las-migration-readiness"

usage() {
	/usr/bin/printf '%s\n' \
		"Usage: $0 candidate sha-<40-character-git-sha> <operation>" \
		"       $0 rollback sha-<40-character-git-sha>" >&2
	exit 2
}

metadata_matches() {
	local path="$1"
	local kind="$2"
	local expected="$3"
	if /usr/bin/readlink -- "$path" >/dev/null 2>&1; then return 1; fi
	case "$kind" in
		directory) [[ -d "$path" ]] || return 1 ;;
		file) [[ -f "$path" && -r "$path" ]] || return 1 ;;
		*) return 1 ;;
	esac
	[[ "$(/usr/bin/stat -c '%u:%g:%a' -- "$path" 2>/dev/null)" == "$expected" ]]
}

operation_is_valid() {
	case "$1" in
		deploy | rollback | marketing-preflight | marketing-deploy | marketing-verify) return 0 ;;
		*) return 1 ;;
	esac
}

digest_is_valid() { [[ "$1" =~ ^sha256:[0-9a-f]{64}$ ]]; }

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

validate_policy_and_stable_programs() {
	local -a lines=()
	local -A seen=()
	local -A release_digests=()
	local line verb release_tag operation web_label web_digest worker_label worker_digest
	local migrate_label migrate_digest postgres_label postgres_digest www_label www_digest extra
	local index label expected_path expected_hash digests
	metadata_matches '/etc/yonaris' directory '0:0:755' || return 1
	metadata_matches "$TRUST_POLICY" file '0:0:644' || return 1
	metadata_matches "$STABLE_DIRECTORY" directory "0:0:$STABLE_DIRECTORY_MODE" || return 1
	metadata_matches "$STATE_DIRECTORY" directory '0:0:711' || return 1
	metadata_matches "$SOURCE_GIT_DIR" directory '0:0:700' || return 1
	[[ "$(/usr/bin/readlink -f -- "$0")" == "$STABLE_GUARD" ]] || return 1
	mapfile -t lines <"$TRUST_POLICY"
	[[ "${#lines[@]}" -ge 11 ]] || return 1
	[[ "${lines[0]}" == "$POLICY_TOKEN" ]] || return 1
	[[ "${lines[1]}" == "actions-key-fingerprint $ACTIONS_KEY_FINGERPRINT" ]] || return 1
	for index in 2 3 4 5 6 7 8 9; do
		case "$index" in
			2) label='dispatcher'; expected_path="$STABLE_DISPATCHER" ;;
			3) label='guard'; expected_path="$STABLE_GUARD" ;;
			4) label='installer'; expected_path="$STABLE_INSTALLER" ;;
			5) label='state-manager'; expected_path="$STABLE_STATE_MANAGER" ;;
			6) label='runtime-manager'; expected_path="$STABLE_RUNTIME_MANAGER" ;;
			7) label='caddy-manager'; expected_path="$STABLE_CADDY_MANAGER" ;;
			8) label='verifier'; expected_path="$ROOT_VERIFIER" ;;
			9) label='migration-readiness-producer'; expected_path="$STABLE_PRODUCER" ;;
		esac
		line="${lines[$index]}"
		[[ "$line" =~ ^$label-sha256\ ([0-9a-f]{64})$ ]] || return 1
		expected_hash="${BASH_REMATCH[1]}"
		metadata_matches "$expected_path" file '0:0:755' || return 1
		[[ "$(/usr/bin/sha256sum -- "$expected_path" | /usr/bin/awk '{print $1}')" == "$expected_hash" ]] || return 1
	done
	for line in "${lines[@]:10}"; do
		read -r verb release_tag operation web_label web_digest worker_label worker_digest \
			migrate_label migrate_digest postgres_label postgres_digest www_label www_digest extra <<<"$line" || return 1
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
	done
}

authorized_line() {
	local release_tag="$1" operation="$2" prefix line
	prefix="allow $release_tag $operation "
	line="$(/usr/bin/grep -F -- "$prefix" "$TRUST_POLICY" || true)"
	[[ -n "$line" && "$(/usr/bin/grep -Fc -- "$prefix" "$TRUST_POLICY")" == 1 ]] || return 1
	/usr/bin/printf '%s' "$line"
}

parse_authorized_digests() {
	local line="$1"
	local verb release_tag operation web_label web_digest worker_label worker_digest
	local migrate_label migrate_digest postgres_label postgres_digest www_label www_digest extra
	read -r verb release_tag operation web_label web_digest worker_label worker_digest \
		migrate_label migrate_digest postgres_label postgres_digest www_label www_digest extra <<<"$line" || return 1
	[[ "$verb" == allow && -z "${extra:-}" ]] || return 1
	/usr/bin/printf '%s %s %s %s %s' "$web_digest" "$worker_digest" "$migrate_digest" "$postgres_digest" "$www_digest"
}

candidate_capability_is_valid() {
	local release_sha="$1" candidate_file status
	candidate_file="$(/usr/bin/mktemp)"
	if git_store_is_local_only && \
		git_local cat-file -e "$release_sha^{commit}" 2>/dev/null && \
		git_local cat-file -p "$release_sha:$CAPABILITY_PATH" >"$candidate_file" 2>/dev/null && \
		/usr/bin/cmp -s "$candidate_file" <(/usr/bin/printf '%s\n' "$CAPABILITY_TOKEN"); then
		status=0
	else
		status=1
	fi
	/usr/bin/rm -f -- "$candidate_file"
	return "$status"
}

receipt_matches_policy() {
	local release_tag="$1" policy_line="$2" receipt="$RECEIPT_ROOT/$1"
	local -a lines=()
	local policy_digests receipt_digests
	metadata_matches "$RECEIPT_ROOT" directory '0:0:755' || return 1
	metadata_matches "$receipt" file '0:0:644' || return 1
	mapfile -t lines <"$receipt"
	[[ "${#lines[@]}" -eq 7 && "${lines[0]}" == "$RECEIPT_TOKEN" && \
		"${lines[1]}" == "release $release_tag" ]] || return 1
	[[ "${lines[2]}" =~ ^web-sha256\ (sha256:[0-9a-f]{64})$ && \
		"${lines[3]}" =~ ^worker-sha256\ (sha256:[0-9a-f]{64})$ && \
		"${lines[4]}" =~ ^migrate-sha256\ (sha256:[0-9a-f]{64})$ && \
		"${lines[5]}" =~ ^postgres-sha256\ (sha256:[0-9a-f]{64})$ && \
		"${lines[6]}" =~ ^www-sha256\ (sha256:[0-9a-f]{64})$ ]] || return 1
	policy_digests="$(parse_authorized_digests "$policy_line")" || return 1
	receipt_digests="${lines[2]#web-sha256 } ${lines[3]#worker-sha256 } ${lines[4]#migrate-sha256 } ${lines[5]#postgres-sha256 } ${lines[6]#www-sha256 }"
	[[ "$receipt_digests" == "$policy_digests" ]]
}

operation="${1:-}"; release_tag="${2:-}"; requested_operation="${3:-}"
if [[ -n "${LAS_STABLE_BUNDLE_DIR:-}" && \
	! "$LAS_STABLE_BUNDLE_DIR" =~ ^/usr/local/libexec/yonaris-las/bundles/sha256-[0-9a-f]{64}$ ]]; then
	/usr/bin/printf '%s\n' 'The active LAS bundle pin is invalid.' >&2
	exit 1
fi
case "$operation" in
	candidate) [[ $# -eq 3 ]] || usage; operation_is_valid "$requested_operation" || usage ;;
	rollback) [[ $# -eq 2 ]] || usage; requested_operation='rollback' ;;
	*) usage ;;
esac
[[ "$release_tag" =~ ^sha-([0-9a-f]{40})$ ]] || { /usr/bin/printf 'Refusing invalid immutable release tag: %s\n' "$release_tag" >&2; exit 2; }
release_sha="${BASH_REMATCH[1]}"
validate_policy_and_stable_programs || { /usr/bin/printf '%s\n' 'The root-owned LAS trust policy or stable program hash is invalid.' >&2; exit 1; }
policy_line="$(authorized_line "$release_tag" "$requested_operation")" || {
	/usr/bin/printf 'Release %s is not root-authorized for operation %s.\n' "$release_tag" "$requested_operation" >&2
	exit 1
}

case "$operation" in
	candidate)
		candidate_capability_is_valid "$release_sha" || {
			/usr/bin/printf 'Candidate %s does not carry the exact artifact output language capability.\n' "$release_tag" >&2
			exit 1
		}
		read -r web_digest worker_digest migrate_digest postgres_digest www_digest <<<"$(parse_authorized_digests "$policy_line")"
		/usr/bin/printf 'release-digests-v1 %s %s %s %s %s %s %s\n' \
			"$release_tag" "$requested_operation" "$web_digest" "$worker_digest" "$migrate_digest" "$postgres_digest" "$www_digest"
		;;
	rollback)
		receipt_matches_policy "$release_tag" "$policy_line" || {
			/usr/bin/printf 'Release %s lacks a root-owned digest-bound healthy receipt.\n' "$release_tag" >&2
			exit 1
		}
		;;
esac
