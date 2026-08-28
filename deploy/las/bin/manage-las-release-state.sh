#!/bin/bash

set -Eeuo pipefail
set +x
umask 077
PATH='/usr/bin:/bin'
export PATH
readonly PATH

readonly RECEIPT_TOKEN='artifact-output-language-receipt-v3'
readonly LEGACY_RECEIPT_TOKEN='artifact-output-language-receipt-v2'
readonly ACTIVATION_TOKEN='artifact-output-language-active-v1'
readonly TRUST_DIRECTORY='/etc/yonaris'
readonly ACTIVATION_ATTESTATION='/etc/yonaris/artifact-output-language-active-v1'
readonly TRANSITION_JOURNAL='/etc/yonaris/las-transition-pending-v1'
readonly LEGACY_CADDY_BOOTSTRAP_JOURNAL='/etc/yonaris/las-caddy-bootstrap-pending-v1'
readonly STABLE_BUNDLE_JOURNAL='/etc/yonaris/las-stable-bundle-pending-v1'
readonly RECEIPT_ROOT='/etc/yonaris/las-compatible-releases-v3'
readonly LEGACY_RECEIPT_ROOT='/etc/yonaris/las-compatible-releases-v2'
readonly MIGRATION_READINESS_ROOT='/etc/yonaris/las-migration-readiness-v2'
readonly MIGRATION_EVIDENCE_ROOT='/etc/yonaris/las-migration-evidence-v2'
readonly PORTAL_RELEASE='/etc/yonaris/las-active-portal-release-v1'
readonly DEPLOY_ROOT='/opt/yonaris'
readonly STATE_DIRECTORY='/var/lib/yonaris'
readonly SOURCE_GIT_DIR='/var/lib/yonaris/las-objects.git'
readonly RELEASE_TREE_ROOT='/var/lib/yonaris/las-release-trees'
readonly TREE_BINDING_ROOT='/var/lib/yonaris/las-release-trees/.bindings'
if [[ -n "${LAS_STABLE_BUNDLE_DIR:-}" ]]; then
	STABLE_DIRECTORY="$LAS_STABLE_BUNDLE_DIR"
	STABLE_GUARD="$STABLE_DIRECTORY/guard-artifact-output-release"
	STABLE_RUNTIME_MANAGER="$STABLE_DIRECTORY/manage-las-runtime"
	ROOT_VERIFIER="$STABLE_DIRECTORY/verify-yonaris-las-forced-command"
else
	STABLE_DIRECTORY='/usr/local/libexec/yonaris-las'
	STABLE_GUARD='/usr/local/libexec/yonaris-las/guard-artifact-output-release'
	STABLE_RUNTIME_MANAGER='/usr/local/libexec/yonaris-las/manage-las-runtime'
	ROOT_VERIFIER='/usr/local/sbin/verify-yonaris-las-forced-command'
fi
readonly STABLE_DIRECTORY STABLE_GUARD STABLE_RUNTIME_MANAGER ROOT_VERIFIER

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
	[[ "$(/usr/bin/stat -c '%u:%g:%a' -- "$path" 2>/dev/null)" == "$expected" ]]
}

release_is_valid() {
	[[ "$1" =~ ^sha-[0-9a-f]{40}$ ]]
}

digest_is_valid() {
	[[ "$1" =~ ^sha256:[0-9a-f]{64}$ ]]
}

operation_is_valid() {
	case "$1" in
		deploy | rollback) return 0 ;;
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

safe_object_path() {
	local candidate="$1" component remainder
	[[ -n "$candidate" && "$candidate" != /* && "$candidate" != */ ]] || return 1
	# Control characters make logs and operator review ambiguous. Reject them as a
	# structural class while otherwise accepting the full Git pathname namespace.
	[[ "$candidate" != *$'\n'* && "$candidate" != *$'\r'* && "$candidate" != *$'\t'* ]] || return 1
	remainder="$candidate"
	while [[ "$remainder" == */* ]]; do
		component="${remainder%%/*}"
		remainder="${remainder#*/}"
		[[ -n "$component" && "$component" != . && "$component" != .. ]] || return 1
	done
	[[ -n "$remainder" && "$remainder" != . && "$remainder" != .. ]]
}

sync_directory() {
	/usr/bin/sync -f "$1"
}

atomic_write() {
	local destination="$1"
	local mode="$2"
	local contents="$3"
	local directory temporary
	directory="$(/usr/bin/dirname -- "$destination")"
	temporary="$(/usr/bin/mktemp "$directory/.las-state.XXXXXX")"
	if ! /usr/bin/printf '%s' "$contents" >"$temporary" || \
		! /usr/bin/chown 0:0 -- "$temporary" || \
		! /usr/bin/chmod "$mode" -- "$temporary" || \
		! /usr/bin/sync -f "$temporary" || \
		! /usr/bin/mv -f -- "$temporary" "$destination" || \
		! sync_directory "$directory"; then
		/usr/bin/rm -f -- "$temporary"
		return 1
	fi
}

read_exact_release() {
	local path="$1"
	local value=''
	metadata_matches "$path" file '0:0:644' || return 1
	value="$(/usr/bin/tr -d '[:space:]' <"$path")"
	release_is_valid "$value" || return 1
	/usr/bin/cmp -s "$path" <(/usr/bin/printf '%s\n' "$value") || return 1
	/usr/bin/printf '%s' "$value"
}

receipt_path() {
	/usr/bin/printf '%s/%s' "$RECEIPT_ROOT" "$1"
}

legacy_receipt_path() {
	/usr/bin/printf '%s/%s' "$LEGACY_RECEIPT_ROOT" "$1"
}

read_receipt_file() {
	local release_tag="$1" format="$2" path="$3"
	local -a lines=()
	metadata_matches "$path" file '0:0:644' || return 1
	[[ "$(/usr/bin/stat -c '%h' -- "$path")" == 1 ]] || return 1
	mapfile -t lines <"$path"
	[[ "${lines[1]:-}" == "release $release_tag" ]] || return 1
	[[ "${lines[2]}" =~ ^web-sha256\ (sha256:[0-9a-f]{64})$ ]] || return 1
	[[ "${lines[3]}" =~ ^worker-sha256\ (sha256:[0-9a-f]{64})$ ]] || return 1
	[[ "${lines[4]}" =~ ^migrate-sha256\ (sha256:[0-9a-f]{64})$ ]] || return 1
	[[ "${lines[5]}" =~ ^postgres-sha256\ (sha256:[0-9a-f]{64})$ ]] || return 1
	case "$format" in
		v3)
			[[ "${#lines[@]}" -eq 6 && "${lines[0]}" == "$RECEIPT_TOKEN" ]] || return 1
			;;
		v2)
			[[ "${#lines[@]}" -eq 7 && "${lines[0]}" == "$LEGACY_RECEIPT_TOKEN" && \
				"${lines[6]}" =~ ^www-sha256\ (sha256:[0-9a-f]{64})$ ]] || return 1
			;;
		*) return 1 ;;
	esac
	/usr/bin/printf '%s\n' "${lines[@]:2:4}"
}

read_receipt() {
	local release_tag="$1" current_path legacy_path current_digests='' legacy_digests=''
	local current_present=false legacy_present=false
	current_path="$(receipt_path "$release_tag")"
	legacy_path="$(legacy_receipt_path "$release_tag")"
	if [[ -e "$current_path" || -L "$current_path" ]]; then
		current_present=true
		current_digests="$(read_receipt_file "$release_tag" v3 "$current_path")" || return 1
	fi
	if [[ -e "$legacy_path" || -L "$legacy_path" ]]; then
		legacy_present=true
		legacy_digests="$(read_receipt_file "$release_tag" v2 "$legacy_path")" || return 1
	fi
	[[ "$current_present" == true || "$legacy_present" == true ]] || return 1
	if [[ "$current_present" == true && "$legacy_present" == true ]]; then
		[[ "$current_digests" == "$legacy_digests" ]] || return 1
	fi
	if [[ "$current_present" == true ]]; then
		/usr/bin/printf '%s\n' "$current_digests"
	else
		/usr/bin/printf '%s\n' "$legacy_digests"
	fi
}

receipt_contents() {
	local release_tag="$1" web_digest="$2" worker_digest="$3" migrate_digest="$4" postgres_digest="$5"
	/usr/bin/printf '%s\nrelease %s\nweb-sha256 %s\nworker-sha256 %s\nmigrate-sha256 %s\npostgres-sha256 %s\n' \
		"$RECEIPT_TOKEN" "$release_tag" "$web_digest" "$worker_digest" \
		"$migrate_digest" "$postgres_digest"
}

receipt_matches_tuple() {
	local release_tag="$1" web="$2" worker="$3" migrate="$4" postgres="$5"
	local actual expected
	actual="$(read_receipt "$release_tag")" || return 1
	expected="$(/usr/bin/printf 'web-sha256 %s\nworker-sha256 %s\nmigrate-sha256 %s\npostgres-sha256 %s\n' \
		"$web" "$worker" "$migrate" "$postgres")"
	[[ "$actual" == "$expected" ]]
}

verify_migration_readiness() {
	local release_tag="$1" web="$2" worker="$3" migrate="$4" postgres="$5"
	local attestation="$MIGRATION_READINESS_ROOT/$1"
	local backup="$MIGRATION_EVIDENCE_ROOT/$1.backup"
	local rehearsal="$MIGRATION_EVIDENCE_ROOT/$1.rehearsal"
	local backup_hash rehearsal_hash
	local -a lines=()
	release_is_valid "$release_tag" && digest_is_valid "$web" && digest_is_valid "$worker" && \
		digest_is_valid "$migrate" && digest_is_valid "$postgres" || return 1
	metadata_matches "$MIGRATION_READINESS_ROOT" directory '0:0:700' && \
		metadata_matches "$MIGRATION_EVIDENCE_ROOT" directory '0:0:700' && \
		metadata_matches "$attestation" file '0:0:400' && \
		metadata_matches "$backup" file '0:0:400' && \
		metadata_matches "$rehearsal" file '0:0:400' || return 1
	for evidence in "$attestation" "$backup" "$rehearsal"; do
		[[ "$(/usr/bin/stat -c '%h' -- "$evidence")" == 1 ]] || return 1
	done
	mapfile -t lines <"$attestation"
	[[ "${#lines[@]}" -eq 8 && "${lines[0]}" == las-migration-readiness-v2 && \
		"${lines[1]}" == "release $release_tag" && \
		"${lines[2]}" == "web-sha256 $web" && \
		"${lines[3]}" == "worker-sha256 $worker" && \
		"${lines[4]}" == "migrate-sha256 $migrate" && \
		"${lines[5]}" == "postgres-sha256 $postgres" ]] || return 1
	[[ "${lines[6]}" =~ ^backup-evidence-sha256\ ([0-9a-f]{64})$ ]] || return 1
	backup_hash="${BASH_REMATCH[1]}"
	[[ "${lines[7]}" =~ ^rehearsal-evidence-sha256\ ([0-9a-f]{64})$ ]] || return 1
	rehearsal_hash="${BASH_REMATCH[1]}"
	[[ "$(/usr/bin/sha256sum -- "$backup" | /usr/bin/awk '{print $1}')" == "$backup_hash" && \
		"$(/usr/bin/sha256sum -- "$rehearsal" | /usr/bin/awk '{print $1}')" == "$rehearsal_hash" ]]
}

migration_readiness_absent_or_matches() {
	local release_tag="$1" web="$2" worker="$3" migrate="$4" postgres="$5"
	local attestation="$MIGRATION_READINESS_ROOT/$release_tag"
	local backup="$MIGRATION_EVIDENCE_ROOT/$release_tag.backup"
	local rehearsal="$MIGRATION_EVIDENCE_ROOT/$release_tag.rehearsal"
	metadata_matches "$MIGRATION_READINESS_ROOT" directory '0:0:700' && \
		metadata_matches "$MIGRATION_EVIDENCE_ROOT" directory '0:0:700' || return 1
	if [[ ! -e "$attestation" && ! -L "$attestation" && \
		! -e "$backup" && ! -L "$backup" && ! -e "$rehearsal" && ! -L "$rehearsal" ]]; then
		return 0
	fi
	verify_migration_readiness "$release_tag" "$web" "$worker" "$migrate" "$postgres"
}

tree_manifest() {
	local tree="$1"
	local entry relative mode ownership digest listing records manifest_digest
	local status=0
	metadata_matches "$tree" directory '0:0:555' || return 1
	metadata_matches "$STATE_DIRECTORY" directory '0:0:711' || return 1
	listing="$(/usr/bin/mktemp "$STATE_DIRECTORY/.las-manifest.XXXXXX")" || return 1
	records="$(/usr/bin/mktemp "$STATE_DIRECTORY/.las-manifest-records.XXXXXX")" || {
		/usr/bin/rm -f -- "$listing"
		return 1
	}
	if ! /usr/bin/find "$tree" -mindepth 1 -print0 | LC_ALL=C /usr/bin/sort -z >"$listing"; then
		/usr/bin/rm -f -- "$listing" "$records"
		return 1
	fi
	while IFS= read -r -d '' entry; do
		relative="${entry#"$tree"/}"
		if ! safe_object_path "$relative"; then status=1; break; fi
		if [[ -L "$entry" ]]; then
			status=1; break
		elif [[ -d "$entry" ]]; then
			ownership="$(/usr/bin/stat -c '%u:%g:%a' -- "$entry")"
			[[ "$ownership" == 0:0:* ]] || { status=1; break; }
			mode="${ownership##*:}"
			if [[ "$mode" != 555 ]]; then status=1; break; fi
			/usr/bin/printf 'd\0%s\0%s\0' "$mode" "$relative" >>"$records" || { status=1; break; }
		elif [[ -f "$entry" ]]; then
			if [[ "$(/usr/bin/stat -c '%h' -- "$entry")" != 1 ]]; then status=1; break; fi
			ownership="$(/usr/bin/stat -c '%u:%g:%a' -- "$entry")"
			[[ "$ownership" == 0:0:* ]] || { status=1; break; }
			mode="${ownership##*:}"
			if [[ "$mode" != 444 && "$mode" != 555 ]]; then status=1; break; fi
			digest="$(/usr/bin/sha256sum -- "$entry" | /usr/bin/awk '{print $1}')"
			/usr/bin/printf 'f\0%s\0%s\0%s\0' "$mode" "$digest" "$relative" >>"$records" || {
				status=1
				break
			}
		else
			status=1; break
		fi
	done <"$listing"
	/usr/bin/rm -f -- "$listing" || status=1
	if ((status != 0)); then
		/usr/bin/rm -f -- "$records"
		return 1
	fi
	manifest_digest="$(/usr/bin/sha256sum -- "$records" | /usr/bin/awk '{print $1}')" || {
		/usr/bin/rm -f -- "$records"
		return 1
	}
	/usr/bin/rm -f -- "$records" || return 1
	/usr/bin/printf '%s\n' "$manifest_digest"
}

validate_release_tree() {
	local release_tag="$1"
	local tree="$RELEASE_TREE_ROOT/$release_tag"
	local binding="$TREE_BINDING_ROOT/$release_tag"
	local expected actual
	metadata_matches "$RELEASE_TREE_ROOT" directory '0:0:555' || return 1
	metadata_matches "$TREE_BINDING_ROOT" directory '0:0:555' || return 1
	metadata_matches "$STATE_DIRECTORY" directory '0:0:711' || return 1
	metadata_matches "$SOURCE_GIT_DIR" directory '0:0:700' || return 1
	metadata_matches "$binding" file '0:0:444' || return 1
	expected="$(/usr/bin/tr -d '[:space:]' <"$binding")"
	[[ "$expected" =~ ^[0-9a-f]{64}$ ]] || return 1
	actual="$(tree_manifest "$tree")" || return 1
	[[ "$actual" == "$expected" ]]
}

materialize_release_tree() {
	local release_tag="$1"
	local release_sha="${release_tag#sha-}"
	local staging listing manifest binding_staging path entry metadata object_mode object_type object_id object_path parent
	local target_tree="$RELEASE_TREE_ROOT/$release_tag" target_binding="$TREE_BINDING_ROOT/$release_tag"
	local orphan_manifest='' existing_orphan=0
	release_is_valid "$release_tag" || return 1
	if validate_release_tree "$release_tag"; then
		return 0
	fi
	metadata_matches "$RELEASE_TREE_ROOT" directory '0:0:555' || return 1
	metadata_matches "$TREE_BINDING_ROOT" directory '0:0:555' || return 1
	if [[ -e "$target_binding" || -L "$target_binding" ]]; then
		# A binding without a valid exact tree is never repaired in place.
		return 1
	fi
	if [[ -e "$target_tree" || -L "$target_tree" ]]; then
		metadata_matches "$target_tree" directory '0:0:555' || return 1
		orphan_manifest="$(tree_manifest "$target_tree")" || return 1
		existing_orphan=1
	fi
	staging="$(/usr/bin/mktemp -d "/var/lib/yonaris/.las-tree-$release_tag.XXXXXX")"
	listing="$(/usr/bin/mktemp "/var/lib/yonaris/.las-ls-tree-$release_tag.XXXXXX")"
	TREE_STAGING_CLEANUP_PATH="$staging"
	TREE_LISTING_CLEANUP_PATH="$listing"
	TREE_BINDING_CLEANUP_PATH=''
	cleanup_tree_staging() {
		if [[ -n "$TREE_STAGING_CLEANUP_PATH" ]]; then
			[[ "$TREE_STAGING_CLEANUP_PATH" =~ ^/var/lib/yonaris/\.las-tree-sha-[0-9a-f]{40}\.[A-Za-z0-9]+$ ]] || return 1
			/usr/bin/chmod -R u+w -- "$TREE_STAGING_CLEANUP_PATH" 2>/dev/null || true
			/usr/bin/rm -rf -- "$TREE_STAGING_CLEANUP_PATH"
		fi
		if [[ -n "$TREE_LISTING_CLEANUP_PATH" ]]; then
			[[ "$TREE_LISTING_CLEANUP_PATH" =~ ^/var/lib/yonaris/\.las-ls-tree-sha-[0-9a-f]{40}\.[A-Za-z0-9]+$ ]] || return 1
			/usr/bin/rm -f -- "$TREE_LISTING_CLEANUP_PATH"
		fi
		if [[ -n "$TREE_BINDING_CLEANUP_PATH" ]]; then
			[[ "$TREE_BINDING_CLEANUP_PATH" =~ ^/var/lib/yonaris/las-release-trees/\.bindings/\.binding\.[A-Za-z0-9]+$ || \
				"$TREE_BINDING_CLEANUP_PATH" == "/var/lib/yonaris/las-release-trees/.bindings/$release_tag" ]] || return 1
			/usr/bin/rm -f -- "$TREE_BINDING_CLEANUP_PATH"
		fi
	}
	trap cleanup_tree_staging RETURN

	git_store_is_local_only || return 1
	git_local cat-file -e "$release_sha^{commit}" || return 1
	git_local ls-tree -rz --full-tree "$release_sha^{tree}" >"$listing" || return 1
	while IFS= read -r -d '' entry; do
		metadata="${entry%%$'\t'*}"
		object_path="${entry#*$'\t'}"
		read -r object_mode object_type object_id <<<"$metadata"
		[[ "$object_type" == blob && ( "$object_mode" == 100644 || "$object_mode" == 100755 ) ]] || return 1
		[[ "$object_id" =~ ^[0-9a-f]{40,64}$ ]] || return 1
		safe_object_path "$object_path" || return 1
		parent="$(/usr/bin/dirname -- "$staging/$object_path")"
		/usr/bin/mkdir -p -- "$parent"
		git_local cat-file blob "$object_id" >"$staging/$object_path" || return 1
		[[ "$object_mode" == 100755 ]] && /usr/bin/chmod 0755 -- "$staging/$object_path"
	done <"$listing"
	/usr/bin/rm -f -- "$listing"
	TREE_LISTING_CLEANUP_PATH=''
	[[ -f "$staging/deploy/las/bin/deploy.sh" && \
		! -L "$staging/deploy/las/bin/deploy.sh" ]] || return 1
	if /usr/bin/find "$staging" -type l -print -quit | /usr/bin/grep -q .; then
		return 1
	fi
	while IFS= read -r -d '' path; do
		/usr/bin/chown 0:0 -- "$path"
		if [[ -d "$path" ]]; then
			/usr/bin/chmod 0555 -- "$path"
		elif [[ -x "$path" ]]; then
			/usr/bin/chmod 0555 -- "$path"
		else
			/usr/bin/chmod 0444 -- "$path"
		fi
		/usr/bin/sync "$path" || return 1
	done < <(/usr/bin/find "$staging" -depth -print0)
	/usr/bin/chown 0:0 -- "$staging"
	/usr/bin/chmod 0555 -- "$staging"
	/usr/bin/sync "$staging" || return 1
	manifest="$(tree_manifest "$staging")" || return 1
	if ((existing_orphan == 1)) && [[ "$orphan_manifest" != "$manifest" ]]; then
		# tree_manifest has already established that every descendant is an
		# exact root-owned regular file/directory with safe relative names and
		# no links. A truncated crash orphan may therefore be replaced only at
		# this fixed, release-derived target with the independently rebuilt tree.
		/usr/bin/chmod -R u+w -- "$target_tree" || return 1
		/usr/bin/rm -rf -- "$target_tree" || return 1
		[[ ! -e "$target_tree" && ! -L "$target_tree" ]] || return 1
		sync_directory "$RELEASE_TREE_ROOT" || return 1
		existing_orphan=0
	fi
	binding_staging="$(/usr/bin/mktemp "$TREE_BINDING_ROOT/.binding.XXXXXX")"
	TREE_BINDING_CLEANUP_PATH="$binding_staging"
	/usr/bin/printf '%s\n' "$manifest" >"$binding_staging"
	/usr/bin/chown 0:0 -- "$binding_staging"
	/usr/bin/chmod 0444 -- "$binding_staging"
	/usr/bin/sync "$binding_staging" || return 1
	if ((existing_orphan == 1)); then
		/usr/bin/chmod -R u+w -- "$staging"
		/usr/bin/rm -rf -- "$staging"
		TREE_STAGING_CLEANUP_PATH=''
	else
		/usr/bin/mv -- "$staging" "$target_tree"
		TREE_STAGING_CLEANUP_PATH=''
		sync_directory "$RELEASE_TREE_ROOT" || return 1
	fi
	/usr/bin/mv -- "$binding_staging" "$target_binding"
	TREE_BINDING_CLEANUP_PATH=''
	sync_directory "$TREE_BINDING_ROOT" || return 1
	if validate_release_tree "$release_tag"; then
		trap - RETURN
		TREE_STAGING_CLEANUP_PATH=''
		TREE_LISTING_CLEANUP_PATH=''
		TREE_BINDING_CLEANUP_PATH=''
		return 0
	fi
	return 1
}

journal_contents() {
	local candidate="$1" predecessor="$2" operation="$3"
	local web="$4" worker="$5" migrate="$6" postgres="$7"
	/usr/bin/printf 'las-transition-v3\nsurface portal\ncandidate %s\npredecessor %s\noperation %s\nweb-sha256 %s\nworker-sha256 %s\nmigrate-sha256 %s\npostgres-sha256 %s\n' \
		"$candidate" "$predecessor" "$operation" "$web" "$worker" "$migrate" "$postgres"
}

read_journal() {
	local -a lines=()
	metadata_matches "$TRANSITION_JOURNAL" file '0:0:600' || return 1
	mapfile -t lines <"$TRANSITION_JOURNAL"
	[[ "${#lines[@]}" -eq 9 && "${lines[0]}" == las-transition-v3 && \
		"${lines[1]}" == 'surface portal' ]] || return 1
	[[ "${lines[2]}" =~ ^candidate\ (sha-[0-9a-f]{40})$ ]] || return 1
	[[ "${lines[3]}" =~ ^predecessor\ (sha-[0-9a-f]{40})$ ]] || return 1
	[[ "${lines[4]}" =~ ^operation\ ([a-z-]+)$ ]] || return 1
	operation_is_valid "${BASH_REMATCH[1]}" || return 1
	[[ "${lines[5]}" =~ ^web-sha256\ (sha256:[0-9a-f]{64})$ && \
		"${lines[6]}" =~ ^worker-sha256\ (sha256:[0-9a-f]{64})$ && \
		"${lines[7]}" =~ ^migrate-sha256\ (sha256:[0-9a-f]{64})$ && \
		"${lines[8]}" =~ ^postgres-sha256\ (sha256:[0-9a-f]{64})$ ]] || return 1
	/usr/bin/printf '%s\n' "${lines[@]}"
}

journal_field() {
	local name="$1"
	read_journal | /usr/bin/awk -v name="$name" '$1 == name { print $2 }'
}

ensure_root_state() {
	metadata_matches "$TRUST_DIRECTORY" directory '0:0:755' || return 1
	metadata_matches "$RECEIPT_ROOT" directory '0:0:755' || return 1
	metadata_matches "$LEGACY_RECEIPT_ROOT" directory '0:0:755' || return 1
	metadata_matches "$STATE_DIRECTORY" directory '0:0:711' || return 1
}

verify_forced_root_boundary() {
	metadata_matches "$ROOT_VERIFIER" file '0:0:755' && "$ROOT_VERIFIER" "$@"
}

run_stable_guard() {
	/usr/bin/env -i PATH='/usr/bin:/bin' HOME='/nonexistent' \
		LAS_STABLE_BUNDLE_DIR="${LAS_STABLE_BUNDLE_DIR:-}" \
		/bin/bash --noprofile --norc -p "$STABLE_GUARD" "$@"
}

runtime_manager() {
	metadata_matches "$STABLE_RUNTIME_MANAGER" file '0:0:755' && \
		/usr/bin/env -i PATH='/usr/bin:/bin' HOME='/nonexistent' \
			LAS_STABLE_BUNDLE_DIR="${LAS_STABLE_BUNDLE_DIR:-}" \
			/bin/bash --noprofile --norc -p "$STABLE_RUNTIME_MANAGER" "$@"
}

authorize_bootstrap_tuple() {
	local release_tag="$1" operation="$2" expected_web="$3" expected_worker="$4"
	local expected_migrate="$5" expected_postgres="$6" output
	local token authorized_release authorized_operation web worker migrate postgres extra
	output="$(run_stable_guard candidate "$release_tag" "$operation")" || return 1
	read -r token authorized_release authorized_operation web worker migrate postgres extra <<<"$output"
	[[ "$token" == release-digests-v2 && "$authorized_release" == "$release_tag" && \
		"$authorized_operation" == "$operation" && -z "${extra:-}" && \
		"$web" == "$expected_web" && "$worker" == "$expected_worker" && \
		"$migrate" == "$expected_migrate" && "$postgres" == "$expected_postgres" ]]
}

[[ "$(/usr/bin/id -u)" == 0 ]] || fail 'The LAS release-state manager must run as root.'
if [[ -n "${LAS_STABLE_BUNDLE_DIR:-}" ]]; then
	[[ "$LAS_STABLE_BUNDLE_DIR" =~ ^/usr/local/libexec/yonaris-las/bundles/sha256-[0-9a-f]{64}$ ]] || \
		fail 'The active LAS bundle pin is invalid.'
fi

command_name="${1:-}"
case "$command_name" in
	migration-readiness)
		[[ $# -eq 6 ]] || exit 2
		verify_migration_readiness "$2" "$3" "$4" "$5" "$6" || \
			fail 'The root-owned migration backup and rehearsal attestation is absent or does not match this release.'
		/usr/bin/printf '%s\n' 'las-migration-readiness-v2 ok'
		;;
	migration-readiness-runtime-authorization)
		[[ $# -eq 6 ]] || exit 2
		candidate="$2"; web="$3"; worker="$4"; migrate="$5"; postgres="$6"
		release_is_valid "$candidate" && digest_is_valid "$web" && digest_is_valid "$worker" && \
			digest_is_valid "$migrate" && digest_is_valid "$postgres" || exit 2
		verify_forced_root_boundary && ensure_root_state || \
			fail 'Migration readiness requires the exact forced root boundary.'
		[[ ! -e "$TRANSITION_JOURNAL" && ! -L "$TRANSITION_JOURNAL" && \
			! -e "$LEGACY_CADDY_BOOTSTRAP_JOURNAL" && ! -L "$LEGACY_CADDY_BOOTSTRAP_JOURNAL" && \
			! -e "$STABLE_BUNDLE_JOURNAL" && ! -L "$STABLE_BUNDLE_JOURNAL" ]] || \
			fail 'Migration readiness is forbidden while LAS recovery state is pending.'
		validate_release_tree "$candidate" || \
			fail 'Migration readiness lacks the exact immutable candidate tree.'
		authorize_bootstrap_tuple "$candidate" deploy "$web" "$worker" "$migrate" "$postgres" || \
			fail 'Migration readiness digests do not match the exact deploy policy tuple.'
		migration_readiness_absent_or_matches "$candidate" "$web" "$worker" "$migrate" "$postgres" || \
			fail 'Existing migration readiness evidence conflicts with this release tuple.'
		/usr/bin/printf '%s\n' 'las-migration-readiness-runtime-authorization-v2 ok'
		;;
	pending-runtime-tuple)
		[[ $# -eq 7 && "$2" == portal ]] || exit 2
		[[ "$(journal_field surface)" == "$2" && "$(journal_field candidate)" == "$3" && \
			"$(journal_field web-sha256)" == "$4" && "$(journal_field worker-sha256)" == "$5" && \
			"$(journal_field migrate-sha256)" == "$6" && "$(journal_field postgres-sha256)" == "$7" ]] || \
			fail 'The requested runtime mutation does not match the pending release tuple.'
		/usr/bin/printf '%s\n' 'las-pending-runtime-tuple-v1 ok'
		;;
	pending-rollback-runtime-tuple)
		[[ $# -eq 7 && "$2" == portal ]] || exit 2
		[[ "$(journal_field surface)" == "$2" && "$(journal_field predecessor)" == "$3" ]] && \
			receipt_matches_tuple "$3" "$4" "$5" "$6" "$7" || \
			fail 'The requested rollback runtime does not match the pending predecessor receipt.'
		/usr/bin/printf '%s\n' 'las-pending-rollback-runtime-tuple-v1 ok'
		;;
	bootstrap-runtime-authorization)
		[[ $# -eq 7 && "$2" == portal ]] || exit 2
		[[ -z "${SUDO_USER:-}" ]] || fail 'Canonical runtime bootstrap authorization is root-local.'
		candidate="$3"; web="$4"; worker="$5"; migrate="$6"; postgres="$7"
		release_is_valid "$candidate" && digest_is_valid "$web" && digest_is_valid "$worker" && \
			digest_is_valid "$migrate" && digest_is_valid "$postgres" || exit 2
		verify_forced_root_boundary && ensure_root_state || fail 'The forced root boundary is invalid.'
		[[ ! -e "$PORTAL_RELEASE" && ! -L "$PORTAL_RELEASE" && \
			! -e "$ACTIVATION_ATTESTATION" && ! -L "$ACTIVATION_ATTESTATION" && \
			! -e "$TRANSITION_JOURNAL" && ! -L "$TRANSITION_JOURNAL" && \
			! -e "$LEGACY_CADDY_BOOTSTRAP_JOURNAL" && ! -L "$LEGACY_CADDY_BOOTSTRAP_JOURNAL" ]] || \
			fail 'Canonical runtime bootstrap requires an absent surface marker and empty recovery state.'
		materialize_release_tree "$candidate" && validate_release_tree "$candidate" || \
			fail 'Canonical runtime bootstrap lacks the exact immutable candidate tree.'
		authorize_bootstrap_tuple "$candidate" deploy "$web" "$worker" "$migrate" "$postgres" && \
			verify_migration_readiness "$candidate" "$web" "$worker" "$migrate" "$postgres" || \
			fail 'Canonical portal runtime bootstrap lacks exact policy or migration readiness evidence.'
		/usr/bin/printf '%s\n' 'las-bootstrap-runtime-authorization-v1 ok'
		;;
	bootstrap-surface)
		# bootstrap-surface portal <release> <web> <worker> <migrate> <postgres>
		[[ $# -eq 7 && "$2" == portal ]] || exit 2
		[[ -z "${SUDO_USER:-}" ]] || fail 'Only a root-local operator may bootstrap canonical LAS release evidence.'
		candidate="$3"; web="$4"; worker="$5"; migrate="$6"; postgres="$7"
		release_is_valid "$candidate" && digest_is_valid "$web" && digest_is_valid "$worker" && \
			digest_is_valid "$migrate" && digest_is_valid "$postgres" || exit 2
		verify_forced_root_boundary || fail 'The forced root boundary is invalid.'
		ensure_root_state || fail 'Root-owned LAS release state is invalid.'
		[[ ! -e "$TRANSITION_JOURNAL" && ! -L "$TRANSITION_JOURNAL" ]] || \
			fail 'Canonical bootstrap is forbidden while a release transition is pending.'
		[[ ! -e "$LEGACY_CADDY_BOOTSTRAP_JOURNAL" && ! -L "$LEGACY_CADDY_BOOTSTRAP_JOURNAL" ]] || \
			fail 'Canonical bootstrap is forbidden while legacy recovery is pending.'
		materialize_release_tree "$candidate" && validate_release_tree "$candidate" || \
			fail 'Canonical bootstrap requires the exact immutable release tree.'
		release_path="$PORTAL_RELEASE"
		if [[ -e "$release_path" || -L "$release_path" ]]; then
			[[ "$(read_exact_release "$release_path")" == "$candidate" ]] || \
				fail 'Canonical release state already names a different release.'
		fi
		authorize_bootstrap_tuple "$candidate" deploy "$web" "$worker" "$migrate" "$postgres" || \
			fail 'Canonical bootstrap digests do not match the active-bundle policy and exact commit capability.'
		runtime_manager portal-verify "$candidate" "$web" "$worker" "$migrate" "$postgres" portal-runtime-v2 || \
			fail 'Canonical portal bootstrap requires a live verified rootless runtime.'
		expected_receipt="$(receipt_contents "$candidate" "$web" "$worker" "$migrate" "$postgres")"$'\n'
		candidate_receipt="$(receipt_path "$candidate")"
		candidate_legacy_receipt="$(legacy_receipt_path "$candidate")"
		if [[ -e "$candidate_receipt" || -L "$candidate_receipt" || \
			-e "$candidate_legacy_receipt" || -L "$candidate_legacy_receipt" ]]; then
			receipt_matches_tuple "$candidate" "$web" "$worker" "$migrate" "$postgres" || \
				fail 'Existing bootstrap receipt conflicts with the verified digest tuple.'
		fi
		if [[ ! -e "$candidate_receipt" && ! -L "$candidate_receipt" ]]; then
			atomic_write "$candidate_receipt" 0644 "$expected_receipt" || \
				fail 'Could not persist the verified canonical bootstrap receipt.'
		fi
		if [[ ! -e "$release_path" && ! -L "$release_path" ]]; then
			atomic_write "$release_path" 0644 "$candidate"$'\n' || \
				fail 'Could not persist the verified canonical bootstrap release.'
		fi
		read_receipt "$candidate" >/dev/null && [[ "$(read_exact_release "$release_path")" == "$candidate" ]] || \
			fail 'Canonical bootstrap durable post-verification failed.'
		;;
	materialize)
		[[ $# -eq 2 ]] || exit 2
		verify_forced_root_boundary || fail 'The forced root boundary is invalid.'
		materialize_release_tree "$2" || fail 'Could not materialize the exact immutable release tree.'
		;;
	status)
		[[ $# -eq 1 ]] || exit 2
		if [[ -e "$LEGACY_CADDY_BOOTSTRAP_JOURNAL" || -L "$LEGACY_CADDY_BOOTSTRAP_JOURNAL" ]]; then
			fail 'A legacy bootstrap transition is pending root recovery.'
		elif [[ ! -e "$TRANSITION_JOURNAL" && ! -L "$TRANSITION_JOURNAL" ]]; then
			/usr/bin/printf '%s\n' clear
		else
			read_journal || fail 'The durable LAS transition journal is malformed.'
		fi
		;;
	begin)
		# begin portal <candidate> <operation> <web> <worker> <migrate> <postgres>
		[[ $# -eq 8 && "$2" == portal ]] || exit 2
		candidate="$3"; operation="$4"; web="$5"; worker="$6"; migrate="$7"; postgres="$8"
		release_is_valid "$candidate" && operation_is_valid "$operation" && \
			digest_is_valid "$web" && digest_is_valid "$worker" && \
			digest_is_valid "$migrate" && digest_is_valid "$postgres" || exit 2
		ensure_root_state || fail 'Root-owned LAS release state is invalid.'
		[[ ! -e "$TRANSITION_JOURNAL" && ! -L "$TRANSITION_JOURNAL" ]] || \
			fail 'A durable LAS transition is already pending reconciliation.'
		predecessor="$(read_exact_release "$PORTAL_RELEASE")" || \
			fail 'A root-owned compatible predecessor release is required.'
		read_receipt "$predecessor" >/dev/null || fail 'The predecessor receipt is invalid.'
		validate_release_tree "$candidate" && validate_release_tree "$predecessor" || \
			fail 'Candidate and predecessor immutable trees must be materialized first.'
		verify_migration_readiness "$candidate" "$web" "$worker" "$migrate" "$postgres" || \
			fail 'Portal deployment lacks exact root-owned backup and migration rehearsal readiness.'
		atomic_write "$TRANSITION_JOURNAL" 0600 \
			"$(journal_contents "$candidate" "$predecessor" "$operation" "$web" "$worker" "$migrate" "$postgres")"$'\n' || \
			fail 'Could not durably persist the pending LAS transition.'
		read_journal >/dev/null || fail 'Pending LAS transition post-verification failed.'
		/usr/bin/printf 'predecessor %s\n' "$predecessor"
		read_receipt "$predecessor"
		;;
	complete)
		# complete portal <candidate>
		[[ $# -eq 3 && "$2" == portal ]] || exit 2
		candidate="$3"
		[[ "$(journal_field surface)" == portal ]] || fail 'Completion surface does not match the pending transition.'
		[[ "$(journal_field candidate)" == "$candidate" ]] || fail 'Completion does not match the pending candidate.'
		web="$(journal_field web-sha256)"; worker="$(journal_field worker-sha256)"
		migrate="$(journal_field migrate-sha256)"; postgres="$(journal_field postgres-sha256)"
		candidate_receipt="$(receipt_path "$candidate")"
		candidate_legacy_receipt="$(legacy_receipt_path "$candidate")"
		expected_receipt="$(receipt_contents "$candidate" "$web" "$worker" "$migrate" "$postgres")"$'\n'
		if [[ -e "$candidate_receipt" || -L "$candidate_receipt" || \
			-e "$candidate_legacy_receipt" || -L "$candidate_legacy_receipt" ]]; then
			receipt_matches_tuple "$candidate" "$web" "$worker" "$migrate" "$postgres" || \
				fail 'Existing compatible release receipt conflicts with the pending digest tuple.'
		fi
		if [[ ! -e "$candidate_receipt" && ! -L "$candidate_receipt" ]]; then
			atomic_write "$candidate_receipt" 0644 "$expected_receipt" || \
				fail 'Could not persist the root-owned compatible release receipt.'
		fi
		atomic_write "$PORTAL_RELEASE" 0644 "$candidate"$'\n' || \
			fail 'Could not persist the root-owned active release; transition remains pending.'
		read_receipt "$candidate" >/dev/null && [[ "$(read_exact_release "$PORTAL_RELEASE")" == "$candidate" ]] || \
			fail 'Completed LAS transition failed durable post-verification.'
		/usr/bin/rm -f -- "$TRANSITION_JOURNAL" || fail 'Could not clear the completed LAS transition journal.'
		sync_directory "$TRUST_DIRECTORY"
		;;
	reconcile)
		# reconcile portal <candidate> <rollback|complete>
		[[ $# -eq 4 && "$2" == portal ]] || exit 2
		candidate="$3"; resolution="$4"
		[[ "$(journal_field surface)" == portal ]] || fail 'Reconciliation surface does not match the pending transition.'
		[[ "$(journal_field candidate)" == "$candidate" ]] || fail 'Reconciliation does not match the pending candidate.'
		case "$resolution" in
			complete) "$0" complete portal "$candidate" ;;
			rollback)
				predecessor="$(journal_field predecessor)"
				read_receipt "$predecessor" >/dev/null || fail 'Rollback predecessor evidence is invalid.'
				validate_release_tree "$predecessor" || fail 'Rollback predecessor tree is invalid.'
				atomic_write "$PORTAL_RELEASE" 0644 "$predecessor"$'\n' || \
					fail 'Could not restore predecessor release state.'
				# Receipts are immutable per-SHA historical rollback evidence.
				/usr/bin/rm -f -- "$TRANSITION_JOURNAL" || \
					fail 'Could not clear the reconciled transition journal.'
				sync_directory "$TRUST_DIRECTORY"
				;;
			*) exit 2 ;;
		esac
		;;
	rollback-evidence)
		[[ $# -eq 3 && "$2" == portal ]] || exit 2
		release_is_valid "$3" || exit 2
		if [[ -e "$ACTIVATION_ATTESTATION" || -L "$ACTIVATION_ATTESTATION" ]]; then
			metadata_matches "$ACTIVATION_ATTESTATION" file '0:0:400' && \
				/usr/bin/cmp -s "$ACTIVATION_ATTESTATION" <(/usr/bin/printf '%s\n' "$ACTIVATION_TOKEN") || \
				fail 'The one-way artifact language activation attestation is invalid.'
		fi
		read_receipt "$3" >/dev/null && validate_release_tree "$3" && \
			run_stable_guard rollback "$3" || fail 'Rollback lacks durable root-owned evidence.'
		;;
	activate-output-language)
		[[ $# -eq 1 ]] || exit 2
		[[ -z "${SUDO_USER:-}" ]] || fail 'Only a root-local operator may create the one-way activation attestation.'
		activation_mode=preactivation
		if [[ -e "$ACTIVATION_ATTESTATION" || -L "$ACTIVATION_ATTESTATION" ]]; then
			metadata_matches "$ACTIVATION_ATTESTATION" file '0:0:400' && \
				[[ "$(/usr/bin/stat -c '%h' -- "$ACTIVATION_ATTESTATION" 2>/dev/null)" == 1 ]] && \
				/usr/bin/cmp -s "$ACTIVATION_ATTESTATION" <(/usr/bin/printf '%s\n' "$ACTIVATION_TOKEN") || \
				fail 'Existing activation attestation is malformed.'
			activation_mode=steady
		fi
		if [[ "$activation_mode" == preactivation ]]; then
			verify_forced_root_boundary preactivate-output-language
		else
			verify_forced_root_boundary
		fi
		ensure_root_state || \
			fail 'The forced root boundary or canonical LAS state is invalid.'
		[[ ! -e "$TRANSITION_JOURNAL" && ! -L "$TRANSITION_JOURNAL" ]] || \
			fail 'Output-language activation is forbidden while a release transition is pending.'
		[[ ! -e "$LEGACY_CADDY_BOOTSTRAP_JOURNAL" && ! -L "$LEGACY_CADDY_BOOTSTRAP_JOURNAL" ]] || \
			fail 'Output-language activation is forbidden while legacy recovery is pending.'
		[[ ! -e "$STABLE_BUNDLE_JOURNAL" && ! -L "$STABLE_BUNDLE_JOURNAL" ]] || \
			fail 'Output-language activation is forbidden while a stable-bundle transition is pending.'
		current="$(read_exact_release "$PORTAL_RELEASE")" || fail 'A compatible active release is required.'
		read_receipt "$current" >/dev/null && validate_release_tree "$current" && \
			run_stable_guard rollback "$current" || \
			fail 'Activation requires an exact root-authorized compatible rollback predecessor.'
		if [[ "$activation_mode" == preactivation ]]; then
			[[ ! -e "$ACTIVATION_ATTESTATION" && ! -L "$ACTIVATION_ATTESTATION" ]] || \
				fail 'The activation attestation changed during preactivation verification.'
			atomic_write "$ACTIVATION_ATTESTATION" 0400 "$ACTIVATION_TOKEN"$'\n' || \
				fail 'Could not persist the one-way root activation attestation.'
		fi
		;;
	*)
		/usr/bin/printf '%s\n' \
			'Usage: manage-las-release-state migration-readiness <release> <four digests>' \
			'       manage-las-release-state migration-readiness-runtime-authorization <release> <four digests>' \
			'       manage-las-release-state pending-runtime-tuple portal <release> <four digests>' \
			'       manage-las-release-state pending-rollback-runtime-tuple portal <release> <four digests>' \
			'       manage-las-release-state bootstrap-runtime-authorization portal <release> <four digests>' \
			'       manage-las-release-state bootstrap-surface portal <release> <four digests>' \
			'       manage-las-release-state materialize <release>' \
			'       manage-las-release-state status' \
			'       manage-las-release-state begin portal <release> <operation> <four digests>' \
			'       manage-las-release-state complete portal <release>' \
			'       manage-las-release-state reconcile portal <release> <rollback|complete>' \
			'       manage-las-release-state rollback-evidence portal <release>' \
			'       manage-las-release-state activate-output-language' >&2
		exit 2
		;;
esac
