#!/bin/bash

set -Eeuo pipefail
set +x
umask 077
PATH='/usr/bin:/bin'
export PATH
readonly PATH

readonly PROTOCOL='yonaris-las-v1'
readonly PROBE_RESPONSE='yonaris-las-probe-v1 ok'
readonly ACTIVATION_TOKEN='artifact-output-language-active-v1'
readonly BUNDLE_TOKEN='yonaris-las-stable-bundle-v1'
readonly STATE_DIRECTORY='/var/lib/yonaris'
readonly SOURCE_GIT_DIR='/var/lib/yonaris/las-objects.git'
readonly RELEASE_TREE_ROOT='/var/lib/yonaris/las-release-trees'
readonly ACTIVATION_ATTESTATION='/etc/yonaris/artifact-output-language-active-v1'
readonly PORTAL_RELEASE='/etc/yonaris/las-active-portal-release-v1'
readonly MARKETING_RELEASE='/etc/yonaris/las-active-marketing-release-v1'
readonly FIXED_STABLE_DIRECTORY='/usr/local/libexec/yonaris-las'
readonly BUNDLES_DIRECTORY='/usr/local/libexec/yonaris-las/bundles'
readonly ACTIVE_BUNDLE_POINTER='/etc/yonaris/las-stable-bundle-active-v1'
readonly ACTIVE_BUNDLE_POINTER_TEMP='/etc/yonaris/.las-stable-bundle-active-v1.active.new'
readonly BUNDLE_TRANSITION_JOURNAL='/etc/yonaris/las-stable-bundle-pending-v1'
readonly BUNDLE_TRANSITION_JOURNAL_TEMP='/etc/yonaris/.las-stable-bundle-pending-v1.new'
INHERITED_BUNDLE_DIRECTORY="${LAS_STABLE_BUNDLE_DIR:-}"
if [[ -n "$INHERITED_BUNDLE_DIRECTORY" ]]; then
	STABLE_DIRECTORY="$INHERITED_BUNDLE_DIRECTORY"
	TRUST_POLICY="$STABLE_DIRECTORY/las-trust-v1"
	ROOT_VERIFIER="$STABLE_DIRECTORY/verify-yonaris-las-forced-command"
else
	STABLE_DIRECTORY="$FIXED_STABLE_DIRECTORY"
	TRUST_POLICY='/etc/yonaris/las-trust-v1'
	ROOT_VERIFIER='/usr/local/sbin/verify-yonaris-las-forced-command'
fi
readonly INHERITED_BUNDLE_DIRECTORY STABLE_DIRECTORY TRUST_POLICY ROOT_VERIFIER
readonly STABLE_DISPATCHER="$STABLE_DIRECTORY/dispatch-las-command"
readonly STABLE_GUARD="$STABLE_DIRECTORY/guard-artifact-output-release"
readonly STABLE_STATE_MANAGER="$STABLE_DIRECTORY/manage-las-release-state"
readonly STABLE_RUNTIME_MANAGER="$STABLE_DIRECTORY/manage-las-runtime"
readonly STABLE_CADDY_MANAGER="$STABLE_DIRECTORY/manage-las-caddy"
readonly LOCK_DIRECTORY='/run/lock/yonaris'

fail() { /usr/bin/printf '%s\n' "$1" >&2; exit "${2:-1}"; }

[[ "$(/usr/bin/id -u)" == 0 ]] || fail 'The stable LAS dispatcher must run as root through the SSH gate.'
if [[ -n "$INHERITED_BUNDLE_DIRECTORY" ]]; then
	[[ "$INHERITED_BUNDLE_DIRECTORY" =~ ^$BUNDLES_DIRECTORY/sha256-[0-9a-f]{64}$ ]] || \
		fail 'The active LAS bundle pin is invalid.'
fi

metadata_matches() {
	local path="$1" kind="$2" expected="$3"
	if /usr/bin/readlink -- "$path" >/dev/null 2>&1; then return 1; fi
	case "$kind" in
		directory) [[ -d "$path" ]] || return 1 ;;
		file) [[ -f "$path" && -r "$path" ]] || return 1 ;;
		socket) [[ -S "$path" ]] || return 1 ;;
		*) return 1 ;;
	esac
	[[ "$(/usr/bin/stat -c '%u:%g:%a' -- "$path" 2>/dev/null)" == "$expected" ]]
}

active_bundle_pin_is_current() {
	local bundle_id expected_directory
	local -a pointer_lines=()
	[[ -n "$INHERITED_BUNDLE_DIRECTORY" ]] || return 0
	metadata_matches "$ACTIVE_BUNDLE_POINTER" file '0:0:600' && \
		[[ "$(/usr/bin/stat -c '%h' -- "$ACTIVE_BUNDLE_POINTER" 2>/dev/null)" == 1 ]] || return 1
	mapfile -t pointer_lines <"$ACTIVE_BUNDLE_POINTER"
	[[ "${#pointer_lines[@]}" -eq 2 && "${pointer_lines[0]}" == "$BUNDLE_TOKEN" ]] || return 1
	[[ "${pointer_lines[1]}" =~ ^bundle-id\ (sha256:[0-9a-f]{64})$ ]] || return 1
	bundle_id="${BASH_REMATCH[1]}"
	/usr/bin/cmp -s "$ACTIVE_BUNDLE_POINTER" \
		<(/usr/bin/printf '%s\n' "$BUNDLE_TOKEN" "bundle-id $bundle_id") || return 1
	expected_directory="$BUNDLES_DIRECTORY/sha256-${bundle_id#sha256:}"
	[[ "$expected_directory" == "$INHERITED_BUNDLE_DIRECTORY" && \
		"$STABLE_DIRECTORY" == "$INHERITED_BUNDLE_DIRECTORY" ]]
}

verify_forced_boundary() {
	metadata_matches "$ROOT_VERIFIER" file '0:0:755' && \
		"$ROOT_VERIFIER" || {
		/usr/bin/printf '%s\n' 'Missing exact root-owned forced-command trust verification.' >&2
		return 1
	}
}

state_manager() {
	metadata_matches "$STABLE_STATE_MANAGER" file '0:0:755' && \
		"$STABLE_STATE_MANAGER" "$@"
}

state_attestation() {
	local expected="$1" output
	shift
	output="$(state_manager "$@")" || return 1
	[[ "$output" == "$expected" ]]
}

read_exact_release() {
	local path="$1" value=''
	metadata_matches "$path" file '0:0:644' || return 1
	value="$(/usr/bin/tr -d '[:space:]' <"$path")"
	[[ "$value" =~ ^sha-[0-9a-f]{40}$ ]] || return 1
	/usr/bin/cmp -s "$path" <(/usr/bin/printf '%s\n' "$value") || return 1
	/usr/bin/printf '%s' "$value"
}

git_local() {
	/usr/bin/env -i \
		PATH='/usr/bin:/bin' HOME='/nonexistent' LC_ALL='C' \
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
	metadata_matches "$STATE_DIRECTORY" directory '0:0:711' || return 1
	metadata_matches "$SOURCE_GIT_DIR" directory '0:0:700' || return 1
	git_store_is_local_only || return 1
	git_local "$@"
}

fetch_release_object() {
	local release_tag="$1" release_sha="${1#sha-}"
	[[ "$release_tag" =~ ^sha-[0-9a-f]{40}$ ]] || return 1
	# Network authentication and ref mutation are deliberately outside the SSH
	# forced-command path. A root-local operator must preload the reviewed commit
	# object before installing the policy entry that authorizes it.
	git_clean cat-file -e "$release_sha^{commit}"
}

materialize_release_tree() {
	local release_tag="$1"
	fetch_release_object "$release_tag" && state_manager materialize "$release_tag"
}

release_tree() {
	local release_tag="$1" tree="$RELEASE_TREE_ROOT/$1"
	metadata_matches "$tree" directory '0:0:555' || return 1
	/usr/bin/printf '%s' "$tree"
}

authorize_candidate() {
	local release_tag="$1" operation="$2" output
	output="$(/usr/bin/env -i PATH='/usr/bin:/bin' HOME='/nonexistent' \
		LAS_STABLE_BUNDLE_DIR="$INHERITED_BUNDLE_DIRECTORY" \
		/bin/bash --noprofile --norc -p "$STABLE_GUARD" \
		candidate "$release_tag" "$operation")" || return 1
	read -r record authorized_release authorized_operation \
		WEB_IMAGE_DIGEST WORKER_IMAGE_DIGEST MIGRATE_IMAGE_DIGEST POSTGRES_IMAGE_DIGEST WWW_IMAGE_DIGEST extra <<<"$output"
	[[ "$record" == release-digests-v1 && "$authorized_release" == "$release_tag" && \
		"$authorized_operation" == "$operation" && -z "${extra:-}" ]] || return 1
	for digest in "$WEB_IMAGE_DIGEST" "$WORKER_IMAGE_DIGEST" "$MIGRATE_IMAGE_DIGEST" "$POSTGRES_IMAGE_DIGEST" "$WWW_IMAGE_DIGEST"; do
		[[ "$digest" =~ ^sha256:[0-9a-f]{64}$ ]] || return 1
	done
	export WEB_IMAGE_DIGEST WORKER_IMAGE_DIGEST MIGRATE_IMAGE_DIGEST POSTGRES_IMAGE_DIGEST WWW_IMAGE_DIGEST
}

read_receipt_digests() {
	local release_tag="$1" receipt="/etc/yonaris/las-compatible-releases-v2/$1"
	local -a lines=()
	metadata_matches "$receipt" file '0:0:644' || return 1
	mapfile -t lines <"$receipt"
	[[ "${#lines[@]}" -eq 7 && "${lines[0]}" == artifact-output-language-receipt-v2 && \
		"${lines[1]}" == "release $release_tag" ]] || return 1
	[[ "${lines[2]}" =~ ^web-sha256\ (sha256:[0-9a-f]{64})$ ]] || return 1
	PREVIOUS_WEB_IMAGE_DIGEST="${BASH_REMATCH[1]}"
	[[ "${lines[3]}" =~ ^worker-sha256\ (sha256:[0-9a-f]{64})$ ]] || return 1
	PREVIOUS_WORKER_IMAGE_DIGEST="${BASH_REMATCH[1]}"
	[[ "${lines[4]}" =~ ^migrate-sha256\ (sha256:[0-9a-f]{64})$ ]] || return 1
	PREVIOUS_MIGRATE_IMAGE_DIGEST="${BASH_REMATCH[1]}"
	[[ "${lines[5]}" =~ ^postgres-sha256\ (sha256:[0-9a-f]{64})$ ]] || return 1
	PREVIOUS_POSTGRES_IMAGE_DIGEST="${BASH_REMATCH[1]}"
	[[ "${lines[6]}" =~ ^www-sha256\ (sha256:[0-9a-f]{64})$ ]] || return 1
	PREVIOUS_WWW_IMAGE_DIGEST="${BASH_REMATCH[1]}"
	export PREVIOUS_WEB_IMAGE_DIGEST PREVIOUS_WORKER_IMAGE_DIGEST \
		PREVIOUS_MIGRATE_IMAGE_DIGEST PREVIOUS_POSTGRES_IMAGE_DIGEST PREVIOUS_WWW_IMAGE_DIGEST
}

runtime_manager() {
	metadata_matches "$STABLE_RUNTIME_MANAGER" file '0:0:755' && \
		/usr/bin/env -i PATH='/usr/bin:/bin' HOME='/nonexistent' \
			LAS_STABLE_BUNDLE_DIR="$INHERITED_BUNDLE_DIRECTORY" \
			/bin/bash --noprofile --norc -p "$STABLE_RUNTIME_MANAGER" "$@"
}

caddy_manager() {
	metadata_matches "$STABLE_CADDY_MANAGER" file '0:0:755' && \
		/usr/bin/env -i PATH='/usr/bin:/bin' HOME='/nonexistent' \
			LAS_STABLE_BUNDLE_DIR="$INHERITED_BUNDLE_DIRECTORY" \
			/bin/bash --noprofile --norc -p "$STABLE_CADDY_MANAGER" "$@"
}

rollback_portal_runtime() {
	local predecessor="$1"
	read_receipt_digests "$predecessor" || return 1
	runtime_manager portal-rollback "$predecessor" "$PREVIOUS_WEB_IMAGE_DIGEST" \
		"$PREVIOUS_WORKER_IMAGE_DIGEST" "$PREVIOUS_MIGRATE_IMAGE_DIGEST" \
		"$PREVIOUS_POSTGRES_IMAGE_DIGEST" "$PREVIOUS_WWW_IMAGE_DIGEST" portal-runtime-v1
}

reconcile_pending_transition() {
	local status
	status="$(state_manager status)" || fail 'Could not inspect durable LAS transition state.' 75
	[[ "$status" == clear ]] && return 0
	/usr/bin/printf '%s\n' "$status" >&2
	fail 'A durable LAS transition is pending; ordinary forced operations fail closed until root recovery.' 75
}

reject_pending_bundle_install() {
	local path
	for path in "$BUNDLE_TRANSITION_JOURNAL" "$BUNDLE_TRANSITION_JOURNAL_TEMP" \
		"$ACTIVE_BUNDLE_POINTER_TEMP"; do
		[[ ! -e "$path" && ! -L "$path" ]] || \
			fail 'A stable-bundle installation state is pending; forced operations fail closed until root recovery.' 75
	done
}

validate_activation_attestation() {
	if [[ -e "$ACTIVATION_ATTESTATION" || -L "$ACTIVATION_ATTESTATION" ]]; then
		metadata_matches "$ACTIVATION_ATTESTATION" file '0:0:400' && \
			/usr/bin/cmp -s "$ACTIVATION_ATTESTATION" \
				<(/usr/bin/printf '%s\n' "$ACTIVATION_TOKEN") || \
			fail 'The root-owned output-language activation attestation is invalid.'
	fi
}

acquire_shared_control_lock() {
	metadata_matches "$LOCK_DIRECTORY" directory '0:0:700' || \
		fail 'The root-owned dispatcher lock directory is invalid.'
	exec 9<"$LOCK_DIRECTORY"
	/usr/bin/flock --shared --wait 1800 9 || fail 'The shared LAS control lock could not be acquired.' 75
}

validate_locked_dispatch_boundary() {
	reject_pending_bundle_install
	active_bundle_pin_is_current || \
		fail 'The active LAS bundle pointer no longer matches the inherited launcher pin.' 75
	verify_forced_boundary
	reconcile_pending_transition
	validate_activation_attestation
}

upgrade_to_exclusive_control_lock() {
	/usr/bin/flock --exclusive --wait 1800 9 || fail 'The exclusive LAS control lock could not be acquired.' 75
	# flock conversion is not atomic. Revalidate every root-owned input after the
	# exclusive lock is held so neither a bundle install nor another dispatcher
	# can cross this command's mutation boundary.
	validate_locked_dispatch_boundary
}

original_command="${SSH_ORIGINAL_COMMAND:-}"
if [[ "$original_command" == "$PROTOCOL probe" ]]; then
	acquire_shared_control_lock
	validate_locked_dispatch_boundary
	/usr/bin/printf '%s\n' "$PROBE_RESPONSE"
	exit 0
fi

read -r protocol operation release_tag arg1 arg2 arg3 arg4 extra <<<"$original_command" || true
if [[ "$protocol" != "$PROTOCOL" || -n "${extra:-}" ]]; then fail 'Refusing non-protocol LAS SSH command.' 2; fi
[[ "$release_tag" =~ ^sha-[0-9a-f]{40}$ ]] || fail 'Refusing invalid immutable LAS release tag.' 2
case "$operation" in
	deploy)
		[[ "$arg1" =~ ^sha256:[0-9a-f]{64}$ && "$arg2" =~ ^sha256:[0-9a-f]{64}$ && \
			"$arg3" =~ ^sha256:[0-9a-f]{64}$ && "$arg4" =~ ^sha256:[0-9a-f]{64}$ ]] || \
			fail 'Deploy requires exact web, worker, migrate, and postgres image digests.' 2
		expected_command="$PROTOCOL $operation $release_tag $arg1 $arg2 $arg3 $arg4"
		;;
	marketing-preflight | marketing-deploy | marketing-verify)
		[[ "$arg1" =~ ^sha256:[0-9a-f]{64}$ && -z "${arg2:-}" && -z "${arg3:-}" && -z "${arg4:-}" ]] || \
			fail 'Marketing operation requires the exact www build digest.' 2
		expected_command="$PROTOCOL $operation $release_tag $arg1"
		;;
	*) fail 'Refusing non-protocol LAS SSH command.' 2 ;;
esac
[[ "$original_command" == "$expected_command" ]] || fail 'Refusing non-canonical LAS SSH command.' 2

acquire_shared_control_lock
validate_locked_dispatch_boundary
upgrade_to_exclusive_control_lock
fetch_release_object "$release_tag" || fail 'Could not fetch the exact release commit object.'
authorize_candidate "$release_tag" "$operation" || fail 'Release is not digest-bound and root-authorized for this operation.'
case "$operation" in
	deploy)
		[[ "$WEB_IMAGE_DIGEST" == "$arg1" && "$WORKER_IMAGE_DIGEST" == "$arg2" && \
			"$MIGRATE_IMAGE_DIGEST" == "$arg3" && "$POSTGRES_IMAGE_DIGEST" == "$arg4" ]] || \
			fail 'Root policy digests do not match this workflow build.'
		;;
	marketing-preflight | marketing-deploy | marketing-verify)
		[[ "$WWW_IMAGE_DIGEST" == "$arg1" ]] || \
			fail 'Root policy www digest does not match this workflow build.'
		;;
esac
materialize_release_tree "$release_tag" || fail 'Could not materialize the authorized immutable release tree.'
candidate_tree="$(release_tree "$release_tag")" || fail 'The candidate immutable release tree is invalid.'

active_portal_release="$(read_exact_release "$PORTAL_RELEASE")" || fail 'A root-owned active portal release is required.'
state_manager rollback-evidence portal "$active_portal_release" || fail 'The active portal release lacks durable rollback evidence.'
materialize_release_tree "$active_portal_release" || fail 'Could not materialize the active rollback release.'
predecessor_tree="$(release_tree "$active_portal_release")" || fail 'The active rollback tree is invalid.'
read_receipt_digests "$active_portal_release" || fail 'The active rollback digest receipt is invalid.'

if [[ "$operation" == deploy ]]; then
	runtime_manager portal-preflight "$release_tag" "$WEB_IMAGE_DIGEST" "$WORKER_IMAGE_DIGEST" \
		"$MIGRATE_IMAGE_DIGEST" "$POSTGRES_IMAGE_DIGEST" "$WWW_IMAGE_DIGEST" portal-runtime-v1 || \
		fail 'Stable portal runtime preflight rejected the candidate.'
	state_attestation 'las-migration-readiness-v1 ok' migration-readiness "$release_tag" \
		"$WEB_IMAGE_DIGEST" "$WORKER_IMAGE_DIGEST" "$MIGRATE_IMAGE_DIGEST" \
		"$POSTGRES_IMAGE_DIGEST" "$WWW_IMAGE_DIGEST" || \
		fail 'Root-owned migration readiness rejected the exact candidate tuple.'
	state_manager begin portal "$release_tag" deploy "$WEB_IMAGE_DIGEST" "$WORKER_IMAGE_DIGEST" \
		"$MIGRATE_IMAGE_DIGEST" "$POSTGRES_IMAGE_DIGEST" "$WWW_IMAGE_DIGEST" >/dev/null || \
		fail 'Could not durably begin the portal runtime transition.' 75
	set +e
	runtime_manager portal-deploy "$release_tag" "$WEB_IMAGE_DIGEST" "$WORKER_IMAGE_DIGEST" \
		"$MIGRATE_IMAGE_DIGEST" "$POSTGRES_IMAGE_DIGEST" "$WWW_IMAGE_DIGEST" portal-runtime-v1
	deploy_status=$?
	set -e
	if ((deploy_status != 0)); then
		if rollback_portal_runtime "$active_portal_release" && \
			state_manager reconcile portal "$release_tag" rollback; then
			exit "$deploy_status"
		fi
		fail 'Candidate failed and predecessor reconciliation did not complete.' 75
	fi
	runtime_manager portal-verify "$release_tag" "$WEB_IMAGE_DIGEST" "$WORKER_IMAGE_DIGEST" \
		"$MIGRATE_IMAGE_DIGEST" "$POSTGRES_IMAGE_DIGEST" "$WWW_IMAGE_DIGEST" portal-runtime-v1 || \
		fail 'Candidate runtime digest verification failed; transition remains pending.' 75
	state_manager complete portal "$release_tag" || fail 'Candidate is healthy but durable completion is pending.' 75
	exit 0
fi

if [[ "$operation" == marketing-preflight ]]; then
	active_marketing_release="$(read_exact_release "$MARKETING_RELEASE")" || fail 'A root-owned active marketing release is required.'
	materialize_release_tree "$active_marketing_release" || fail 'Could not materialize the active marketing release.'
	runtime_manager marketing-preflight "$release_tag" "$WEB_IMAGE_DIGEST" "$WORKER_IMAGE_DIGEST" \
		"$MIGRATE_IMAGE_DIGEST" "$POSTGRES_IMAGE_DIGEST" "$WWW_IMAGE_DIGEST" marketing-runtime-v1 && \
		caddy_manager preflight "$release_tag" "$active_marketing_release"
	exit $?
fi
if [[ "$operation" == marketing-deploy ]]; then
	active_marketing_release="$(read_exact_release "$MARKETING_RELEASE")" || \
		fail 'A root-owned active marketing release is required.'
	state_manager rollback-evidence marketing "$active_marketing_release" || \
		fail 'The active marketing release lacks current policy-authorized rollback evidence.'
	materialize_release_tree "$active_marketing_release" || \
		fail 'Could not materialize the marketing rollback release.'
	read_receipt_digests "$active_marketing_release" || \
		fail 'The marketing rollback digest receipt is invalid.'
	predecessor_marketing_tree="$(release_tree "$active_marketing_release")" || \
		fail 'The marketing rollback tree is invalid.'
	state_manager begin marketing "$release_tag" marketing-deploy "$WEB_IMAGE_DIGEST" \
		"$WORKER_IMAGE_DIGEST" "$MIGRATE_IMAGE_DIGEST" "$POSTGRES_IMAGE_DIGEST" "$WWW_IMAGE_DIGEST" >/dev/null || \
		fail 'Could not durably begin the marketing runtime transition.' 75
	set +e
	caddy_manager prepare "$release_tag" "$active_marketing_release"
	prepare_status=$?
	set -e
	if ((prepare_status != 0)); then
		if state_manager reconcile marketing "$release_tag" rollback; then exit "$prepare_status"; fi
		fail 'Caddy preparation failed and durable reconciliation did not complete.' 75
	fi
	set +e
	runtime_manager marketing-deploy "$release_tag" "$WEB_IMAGE_DIGEST" "$WORKER_IMAGE_DIGEST" \
		"$MIGRATE_IMAGE_DIGEST" "$POSTGRES_IMAGE_DIGEST" "$WWW_IMAGE_DIGEST" marketing-runtime-v1
	marketing_status=$?
	set -e
	if ((marketing_status != 0)); then
		if ((marketing_status == 1)) && \
			runtime_manager marketing-rollback "$active_marketing_release" "$PREVIOUS_WEB_IMAGE_DIGEST" \
				"$PREVIOUS_WORKER_IMAGE_DIGEST" "$PREVIOUS_MIGRATE_IMAGE_DIGEST" \
				"$PREVIOUS_POSTGRES_IMAGE_DIGEST" "$PREVIOUS_WWW_IMAGE_DIGEST" marketing-runtime-v1 && \
			caddy_manager rollback "$release_tag" "$active_marketing_release" && \
			state_manager reconcile marketing "$release_tag" rollback; then
			exit "$marketing_status"
		fi
		fail 'Marketing transition did not converge; durable root recovery is required.' 75
	fi
	set +e
	caddy_manager activate "$release_tag" "$active_marketing_release"
	caddy_status=$?
	set -e
	if ((caddy_status != 0)); then
		if ((caddy_status == 1)) && \
			runtime_manager marketing-rollback "$active_marketing_release" "$PREVIOUS_WEB_IMAGE_DIGEST" \
				"$PREVIOUS_WORKER_IMAGE_DIGEST" "$PREVIOUS_MIGRATE_IMAGE_DIGEST" \
				"$PREVIOUS_POSTGRES_IMAGE_DIGEST" "$PREVIOUS_WWW_IMAGE_DIGEST" marketing-runtime-v1 && \
			caddy_manager rollback "$release_tag" "$active_marketing_release" && \
			state_manager reconcile marketing "$release_tag" rollback; then
			exit "$caddy_status"
		fi
		fail 'Caddy transition did not converge; durable root recovery is required.' 75
	fi
	runtime_manager marketing-verify "$release_tag" "$WEB_IMAGE_DIGEST" "$WORKER_IMAGE_DIGEST" \
		"$MIGRATE_IMAGE_DIGEST" "$POSTGRES_IMAGE_DIGEST" "$WWW_IMAGE_DIGEST" marketing-runtime-v1 && \
		caddy_manager verify-active "$release_tag" "$active_marketing_release" || \
		fail 'Marketing candidate digest verification failed; transition remains pending.' 75
	state_manager complete marketing "$release_tag" || \
		fail 'Marketing candidate is live but durable completion is pending.' 75
	exit 0
fi
if [[ "$operation" == marketing-verify ]]; then
	[[ "$(read_exact_release "$MARKETING_RELEASE")" == "$release_tag" ]] || \
		fail 'Marketing release marker is not the requested immutable release.'
	runtime_manager marketing-verify "$release_tag" "$WEB_IMAGE_DIGEST" "$WORKER_IMAGE_DIGEST" \
		"$MIGRATE_IMAGE_DIGEST" "$POSTGRES_IMAGE_DIGEST" "$WWW_IMAGE_DIGEST" marketing-runtime-v1 && \
		caddy_manager verify-active "$release_tag" "$release_tag" || \
		fail 'Marketing runtime digest is not authorized.'
	/usr/bin/curl --fail --silent --show-error --max-time 15 https://yonaris.com/ |
		/usr/bin/grep -Fq 'data-generation="site-06"' ||
		fail 'Live marketing apex is not the authorized Site 06 generation.'
	/usr/bin/curl --fail --silent --show-error --max-time 15 https://portal.yonaris.com/ >/dev/null
	/usr/bin/curl --fail --silent --show-error --max-time 15 https://yonaris.com/company >/dev/null
	[[ "$(/usr/bin/curl --silent --show-error --output /dev/null --write-out '%{http_code}' \
		--max-time 15 https://yonaris.com/resources)" == 404 ]] || fail 'Retired resources route is unexpectedly live.'
	[[ "$(/usr/bin/curl --silent --show-error --output /dev/null --write-out '%{http_code}' \
		--max-time 15 https://yonaris.com/status)" == 404 ]] || fail 'Retired status route is unexpectedly live.'
	exit 0
fi
