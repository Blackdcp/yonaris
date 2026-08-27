#!/bin/bash

set -Eeuo pipefail
set +x
umask 077
PATH='/usr/bin:/bin'
export PATH
readonly PATH

readonly TOKEN='yonaris-las-forced-command-v1'
readonly ACTIVATION_TOKEN='artifact-output-language-active-v1'
readonly POLICY_TOKEN='yonaris-las-trust-v1'
readonly ACTIONS_KEY_TYPE='ssh-ed25519'
readonly ACTIONS_KEY_BODY='AAAAC3NzaC1lZDI1NTE5AAAAINm/JTgoBi4QJiP0KunOfVuG3JDd6NpxlVdZ3l9xzTWg'
readonly ACTIONS_KEY_FINGERPRINT='SHA256:gM/QEgkfN99cP/Cf9awUOwSb7FMesQTgRCTI9kPh84A'
readonly EXPECTED_AUTHORIZED_KEY='restrict,command="/usr/bin/sudo -n /usr/local/libexec/yonaris-las/dispatch-las-command" ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAINm/JTgoBi4QJiP0KunOfVuG3JDd6NpxlVdZ3l9xzTWg yonaris-las-operator-2026-08-06'
readonly SSH_GATE_USER='yonaris-gate'
readonly DEPLOY_USER='yonaris-deploy'
readonly RUNTIME_USER='yonaris-runtime'
readonly HOME_DIRECTORY='/home/yonaris-gate'
readonly SSH_DIRECTORY='/home/yonaris-gate/.ssh'
readonly AUTHORIZED_KEYS='/home/yonaris-gate/.ssh/authorized_keys'
readonly TRUST_DIRECTORY='/etc/yonaris'
readonly RUNTIME_ENV='/etc/yonaris/las-runtime.env'
readonly ATTESTATION='/etc/yonaris/las-forced-command-active'
readonly ACTIVATION_ATTESTATION='/etc/yonaris/artifact-output-language-active-v1'
readonly TRANSITION_JOURNAL='/etc/yonaris/las-transition-pending-v1'
readonly CADDY_BOOTSTRAP_JOURNAL='/etc/yonaris/las-caddy-bootstrap-pending-v1'
readonly FIXED_DISPATCH_ENTRYPOINT='/usr/local/libexec/yonaris-las/dispatch-las-command'
if [[ -n "${LAS_STABLE_BUNDLE_DIR:-}" ]]; then
	STABLE_DIRECTORY="$LAS_STABLE_BUNDLE_DIR"
	STABLE_DIRECTORY_MODE='555'
	TRUST_POLICY="$STABLE_DIRECTORY/las-trust-v1"
	STABLE_INSTALLER="$STABLE_DIRECTORY/install-yonaris-las-trust-policy"
	VERIFIER="$STABLE_DIRECTORY/verify-yonaris-las-forced-command"
else
	STABLE_DIRECTORY='/usr/local/libexec/yonaris-las'
	STABLE_DIRECTORY_MODE='755'
	TRUST_POLICY='/etc/yonaris/las-trust-v1'
	STABLE_INSTALLER='/usr/local/sbin/install-yonaris-las-trust-policy'
	VERIFIER='/usr/local/sbin/verify-yonaris-las-forced-command'
fi
readonly STABLE_DIRECTORY STABLE_DIRECTORY_MODE TRUST_POLICY STABLE_INSTALLER VERIFIER
readonly STABLE_DISPATCHER="$STABLE_DIRECTORY/dispatch-las-command"
readonly STABLE_GUARD="$STABLE_DIRECTORY/guard-artifact-output-release"
readonly STABLE_STATE_MANAGER="$STABLE_DIRECTORY/manage-las-release-state"
readonly STABLE_RUNTIME_MANAGER="$STABLE_DIRECTORY/manage-las-runtime"
readonly STABLE_CADDY_MANAGER="$STABLE_DIRECTORY/manage-las-caddy"
readonly STABLE_PRODUCER="$STABLE_DIRECTORY/produce-las-migration-readiness"
readonly SUDOERS_POLICY='/etc/sudoers.d/yonaris-las-dispatch'
readonly STATE_DIRECTORY='/var/lib/yonaris'
readonly SOURCE_GIT_DIR='/var/lib/yonaris/las-objects.git'
readonly LOCK_DIRECTORY='/run/lock/yonaris'
readonly TMPFILES_CONFIG='/etc/tmpfiles.d/yonaris-las.conf'
readonly CADDY_RUNTIME_DIRECTORY='/run/caddy'
readonly SYSTEMD_DIRECTORY='/etc/systemd/system'
readonly BACKUP_SERVICE_MASK='/etc/systemd/system/yonaris-backup.service'
readonly BACKUP_TIMER_MASK='/etc/systemd/system/yonaris-backup.timer'
readonly LEGACY_CADDY_ENTRY='/usr/local/sbin/install-marketing-caddy'
readonly ROOTFUL_DOCKER_SOCKET='/var/run/docker.sock'
readonly ROOTLESS_DOCKER_HOME='/var/lib/yonaris-runtime'
readonly ROOTLESS_DOCKER_CONFIG='/var/lib/yonaris-runtime/.docker'
readonly SUDO='/usr/bin/sudo'

fail() { /usr/bin/printf '%s\n' "$1" >&2; exit 1; }

case "$#" in
	0) RUNTIME_BOUNDARY_OPERATION=verify-boundary ;;
	1)
		[[ "$1" == preactivate-output-language ]] || {
			/usr/bin/printf '%s\n' 'The LAS forced-command verifier accepts only the exact preactivation mode.' >&2
			exit 2
		}
		RUNTIME_BOUNDARY_OPERATION=verify-preactivation-boundary
		;;
	*)
		/usr/bin/printf '%s\n' 'The LAS forced-command verifier accepts at most one exact preactivation mode.' >&2
		exit 2
		;;
esac
readonly RUNTIME_BOUNDARY_OPERATION
[[ "$(/usr/bin/id -u)" == 0 ]] || fail 'The LAS forced-command verifier must run as root.'
if [[ -n "${LAS_STABLE_BUNDLE_DIR:-}" ]]; then
	[[ "$LAS_STABLE_BUNDLE_DIR" =~ ^/usr/local/libexec/yonaris-las/bundles/sha256-[0-9a-f]{64}$ ]] || \
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

operation_is_valid() {
	case "$1" in
		deploy | rollback | marketing-preflight | marketing-deploy | marketing-verify) return 0 ;;
		*) return 1 ;;
	esac
}

digest_is_valid() { [[ "$1" =~ ^sha256:[0-9a-f]{64}$ ]]; }

validate_policy() {
	local -a lines=()
	local -A seen=()
	local -A release_digests=()
	local line verb release_tag operation web_label web_digest worker_label worker_digest
	local migrate_label migrate_digest postgres_label postgres_digest www_label www_digest extra
	local index label expected_path expected_hash digests
	mapfile -t lines <"$TRUST_POLICY"
	[[ "${#lines[@]}" -ge 11 && "${lines[0]}" == "$POLICY_TOKEN" && \
		"${lines[1]}" == "actions-key-fingerprint $ACTIONS_KEY_FINGERPRINT" ]] || return 1
	for index in 2 3 4 5 6 7 8 9; do
		case "$index" in
			2) label='dispatcher'; expected_path="$STABLE_DISPATCHER" ;;
			3) label='guard'; expected_path="$STABLE_GUARD" ;;
			4) label='installer'; expected_path="$STABLE_INSTALLER" ;;
			5) label='state-manager'; expected_path="$STABLE_STATE_MANAGER" ;;
			6) label='runtime-manager'; expected_path="$STABLE_RUNTIME_MANAGER" ;;
			7) label='caddy-manager'; expected_path="$STABLE_CADDY_MANAGER" ;;
			8) label='verifier'; expected_path="$VERIFIER" ;;
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
		[[ "$verb" == allow && -z "${extra:-}" && "$release_tag" =~ ^sha-[0-9a-f]{40}$ ]] || return 1
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

validate_effective_sshd_boundary() {
	local context effective expected
	for context in \
		'user=yonaris-gate,host=localhost,addr=127.0.0.1' \
		'user=yonaris-gate,host=github-actions.invalid,addr=203.0.113.1' \
		'user=yonaris-gate,host=github-actions.invalid,addr=2001:db8::1'; do
		effective="$(/usr/sbin/sshd -T -C "$context")" || return 1
		for expected in \
			'authorizedkeysfile .ssh/authorized_keys' \
			'authorizedkeyscommand none' \
			'authorizedkeyscommanduser none' \
			'permituserenvironment no' \
			'passwordauthentication no' \
			'kbdinteractiveauthentication no' \
			'pubkeyauthentication yes' \
			'authenticationmethods publickey' \
			'forcecommand none' \
			'trustedusercakeys none' \
			'authorizedprincipalsfile none' \
			'authorizedprincipalscommand none' \
			'authorizedprincipalscommanduser none'; do
			[[ "$(/usr/bin/grep -Fxc "$expected" <<<"$effective")" == 1 ]] || return 1
		done
	done
}

validate_account_boundary() {
	local deploy_uid deploy_gid gate_uid gate_gid runtime_uid runtime_gid caddy_uid caddy_gid account status extra passwd_line
	local name marker uid gid gecos home shell passwd_database group_database group_name group_marker group_gid group_members group_extra
	local runtime_group_count=0
	local deploy_uid_count=0 gate_uid_count=0 runtime_uid_count=0 caddy_uid_count=0
	local -a runtime_primary_accounts=()
	deploy_uid="$(/usr/bin/id -u "$DEPLOY_USER")" || return 1
	deploy_gid="$(/usr/bin/id -g "$DEPLOY_USER")" || return 1
	gate_uid="$(/usr/bin/id -u "$SSH_GATE_USER")" || return 1
	gate_gid="$(/usr/bin/id -g "$SSH_GATE_USER")" || return 1
	runtime_uid="$(/usr/bin/id -u "$RUNTIME_USER")" || return 1
	runtime_gid="$(/usr/bin/id -g "$RUNTIME_USER")" || return 1
	caddy_uid="$(/usr/bin/id -u caddy)" || return 1
	caddy_gid="$(/usr/bin/id -g caddy)" || return 1
	[[ "$deploy_uid" =~ ^[0-9]+$ && "$gate_uid" =~ ^[0-9]+$ && \
		"$runtime_uid" =~ ^[0-9]+$ && "$caddy_uid" =~ ^[0-9]+$ && \
		"$deploy_uid" != 0 && "$gate_uid" != 0 && "$runtime_uid" != 0 && "$caddy_uid" != 0 && \
		"$deploy_uid" != "$gate_uid" && "$deploy_uid" != "$runtime_uid" && "$deploy_uid" != "$caddy_uid" && \
		"$gate_uid" != "$runtime_uid" && "$gate_uid" != "$caddy_uid" && "$runtime_uid" != "$caddy_uid" ]] || return 1
	for account in "$DEPLOY_USER" "$SSH_GATE_USER" "$RUNTIME_USER"; do
		read -r _ status extra <<<"$(/usr/bin/passwd -S "$account")" || return 1
		[[ "$status" == L && -n "$extra" ]] || return 1
	done
	passwd_line="$(/usr/bin/getent passwd "$DEPLOY_USER")" || return 1
	IFS=: read -r name marker uid gid gecos home shell <<<"$passwd_line"
	[[ "$name" == "$DEPLOY_USER" && "$uid" == "$deploy_uid" && "$gid" == "$deploy_gid" && \
		"$home" == /home/yonaris-deploy && "$shell" == /usr/sbin/nologin ]] || return 1
	passwd_line="$(/usr/bin/getent passwd "$SSH_GATE_USER")" || return 1
	IFS=: read -r name marker uid gid gecos home shell <<<"$passwd_line"
	[[ "$name" == "$SSH_GATE_USER" && "$uid" == "$gate_uid" && "$gid" == "$gate_gid" && \
		"$home" == "$HOME_DIRECTORY" && "$shell" == /bin/bash ]] || return 1
	passwd_line="$(/usr/bin/getent passwd "$RUNTIME_USER")" || return 1
	IFS=: read -r name marker uid gid gecos home shell <<<"$passwd_line"
	[[ "$name" == "$RUNTIME_USER" && "$uid" == "$runtime_uid" && "$gid" == "$runtime_gid" && \
		"$home" == "$ROOTLESS_DOCKER_HOME" && "$shell" == /usr/sbin/nologin ]] || return 1
	passwd_line="$(/usr/bin/getent passwd caddy)" || return 1
	IFS=: read -r name marker uid gid gecos home shell <<<"$passwd_line"
	[[ "$name" == caddy && "$uid" == "$caddy_uid" && "$gid" == "$caddy_gid" ]] || return 1
	passwd_database="$(/usr/bin/getent passwd)" || return 1
	while IFS=: read -r name marker uid gid gecos home shell extra; do
		[[ -z "${extra:-}" && "$uid" =~ ^[0-9]+$ && "$gid" =~ ^[0-9]+$ ]] || return 1
		case "$uid" in
			"$deploy_uid") [[ "$name" == "$DEPLOY_USER" ]] || return 1; ((deploy_uid_count += 1)) ;;
			"$gate_uid") [[ "$name" == "$SSH_GATE_USER" ]] || return 1; ((gate_uid_count += 1)) ;;
			"$runtime_uid") [[ "$name" == "$RUNTIME_USER" ]] || return 1; ((runtime_uid_count += 1)) ;;
			"$caddy_uid") [[ "$name" == caddy ]] || return 1; ((caddy_uid_count += 1)) ;;
		esac
		[[ "$gid" != "$runtime_gid" ]] || runtime_primary_accounts+=("$name")
	done <<<"$passwd_database"
	[[ "$deploy_uid_count" -eq 1 && "$gate_uid_count" -eq 1 && \
		"$runtime_uid_count" -eq 1 && "$caddy_uid_count" -eq 1 ]] || return 1
	[[ "${#runtime_primary_accounts[@]}" -eq 1 && \
		"${runtime_primary_accounts[0]}" == "$RUNTIME_USER" ]] || return 1
	group_database="$(/usr/bin/getent group)" || return 1
	while IFS=: read -r group_name group_marker group_gid group_members group_extra; do
		[[ -z "${group_extra:-}" && "$group_gid" =~ ^[0-9]+$ ]] || return 1
		if [[ "$group_gid" == "$runtime_gid" ]]; then
			((runtime_group_count += 1))
			[[ "$group_name" == "$RUNTIME_USER" && \
				( -z "$group_members" || "$group_members" == "$RUNTIME_USER" ) ]] || return 1
		fi
	done <<<"$group_database"
	[[ "$runtime_group_count" -eq 1 ]]
}

validate_deploy_sshd_denial() {
	local account context effective expected
	for account in "$DEPLOY_USER" "$RUNTIME_USER"; do
	for context in \
		"user=$account,host=localhost,addr=127.0.0.1" \
		"user=$account,host=github-actions.invalid,addr=203.0.113.1" \
		"user=$account,host=github-actions.invalid,addr=2001:db8::1"; do
		effective="$(/usr/sbin/sshd -T -C "$context")" || return 1
		for expected in \
			'authenticationmethods any' \
			'passwordauthentication no' \
			'kbdinteractiveauthentication no' \
			'pubkeyauthentication no' \
			'hostbasedauthentication no' \
			'gssapiauthentication no' \
			'kerberosauthentication no' \
			'disableforwarding yes' \
			'allowagentforwarding no' \
			'allowtcpforwarding no' \
			'allowstreamlocalforwarding no' \
			'x11forwarding no' \
			'permittty no' \
			'permittunnel no' \
			'permitopen none' \
			'permitlisten none'; do
			[[ "$(/usr/bin/grep -Fxc "$expected" <<<"$effective")" == 1 ]] || return 1
		done
	done
	done
}

validate_caddy_boundary() {
	metadata_matches "$STABLE_CADDY_MANAGER" file '0:0:755' || return 1
	/usr/bin/env -i PATH='/usr/bin:/bin' HOME='/nonexistent' \
		LAS_STABLE_BUNDLE_DIR="${LAS_STABLE_BUNDLE_DIR:-}" \
		/bin/bash --noprofile --norc -p "$STABLE_CADDY_MANAGER" verify-boundary
}

validate_effective_sudo_boundary() {
	local gate_listing command_listing
	gate_listing="$(/usr/bin/env -i PATH='/usr/bin:/bin' LC_ALL=C \
		"$SUDO" -n -l -U "$SSH_GATE_USER" 2>/dev/null)" || return 1
	command_listing="$(/usr/bin/grep -E '^[[:space:]]+\(' <<<"$gate_listing" || true)"
	[[ "$command_listing" == "    (root) NOPASSWD: $FIXED_DISPATCH_ENTRYPOINT" ]] || return 1
	if /usr/bin/env -i PATH='/usr/bin:/bin' LC_ALL=C \
		"$SUDO" -n -l -U "$DEPLOY_USER" >/dev/null 2>&1; then
		return 1
	fi
	if /usr/bin/env -i PATH='/usr/bin:/bin' LC_ALL=C \
		"$SUDO" -n -l -U "$RUNTIME_USER" >/dev/null 2>&1; then
		return 1
	fi
}

validate_tmpfiles_boundary() {
	local caddy_uid caddy_gid
	caddy_uid="$(/usr/bin/id -u caddy)" || return 1
	caddy_gid="$(/usr/bin/id -g caddy)" || return 1
	[[ "$caddy_uid" =~ ^[0-9]+$ && "$caddy_gid" =~ ^[0-9]+$ ]] || return 1
	metadata_matches "$TMPFILES_CONFIG" file '0:0:644' && \
		[[ "$(/usr/bin/stat -c '%h' -- "$TMPFILES_CONFIG")" == 1 ]] && \
		/usr/bin/cmp -s "$TMPFILES_CONFIG" <(/usr/bin/printf '%s\n' \
			'd /run/lock/yonaris 0700 root root -' \
			'd /run/caddy 0750 caddy caddy -') && \
		metadata_matches "$CADDY_RUNTIME_DIRECTORY" directory "$caddy_uid:$caddy_gid:750"
}

validate_legacy_host_boundaries() {
	local unit path active enabled enabled_status exec_start supplementary_groups
	metadata_matches "$SYSTEMD_DIRECTORY" directory '0:0:755' || return 1
	for unit in yonaris-backup.service yonaris-backup.timer; do
		path="$SYSTEMD_DIRECTORY/$unit"
		[[ "$(/usr/bin/readlink -- "$path" 2>/dev/null)" == /dev/null ]] || return 1
		[[ "$(/usr/bin/stat -c '%u:%g' -- "$path" 2>/dev/null)" == 0:0 ]] || return 1
		active="$(/usr/bin/systemctl show -p ActiveState --value "$unit")" || return 1
		if enabled="$(/usr/bin/systemctl is-enabled "$unit" 2>/dev/null)"; then
			enabled_status=0
		else
			enabled_status=$?
		fi
		exec_start="$(/usr/bin/systemctl show -p ExecStart --value "$unit")" || return 1
		supplementary_groups="$(/usr/bin/systemctl show -p SupplementaryGroups --value "$unit")" || return 1
		[[ "$active" == inactive && "$enabled" == masked && \
			( "$enabled_status" -eq 0 || "$enabled_status" -eq 1 ) && -z "$exec_start" && \
			-z "$supplementary_groups" ]] || return 1
	done
	if [[ -e "$LEGACY_CADDY_ENTRY" || -L "$LEGACY_CADDY_ENTRY" ]]; then
		metadata_matches "$LEGACY_CADDY_ENTRY" file '0:0:755' && \
			[[ "$(/usr/bin/stat -c '%h' -- "$LEGACY_CADDY_ENTRY")" == 1 ]] && \
			/usr/bin/cmp -s "$LEGACY_CADDY_ENTRY" <(/usr/bin/printf '%s\n' \
				'#!/bin/bash' \
				'set -Eeuo pipefail' \
				"printf '%s\\n' 'The legacy LAS Caddy installer is permanently disabled.' >&2" \
				'exit 2') || return 1
	fi
}

validate_rootless_docker_boundary() {
	local groups gate_groups runtime_groups deploy_uid deploy_gid runtime_uid runtime_gid rootless_socket rootful_mode
	groups=" $(/usr/bin/id -nG yonaris-deploy) "
	[[ "$groups" != *' docker '* && "$groups" != *' yonaris-gate '* && \
		"$groups" != *' yonaris-runtime '* && "$groups" != *' caddy '* ]] || return 1
	gate_groups=" $(/usr/bin/id -nG yonaris-gate) "
	[[ "$gate_groups" != *' docker '* && "$gate_groups" != *' yonaris-deploy '* && \
		"$gate_groups" != *' yonaris-runtime '* && "$gate_groups" != *' caddy '* ]] || return 1
	runtime_groups=" $(/usr/bin/id -nG yonaris-runtime) "
	[[ "$runtime_groups" != *' docker '* && "$runtime_groups" != *' yonaris-deploy '* && \
		"$runtime_groups" != *' yonaris-gate '* && "$runtime_groups" != *' caddy '* ]] || return 1
	deploy_uid="$(/usr/bin/id -u "$DEPLOY_USER")" || return 1
	deploy_gid="$(/usr/bin/id -g "$DEPLOY_USER")" || return 1
	runtime_uid="$(/usr/bin/id -u "$RUNTIME_USER")" || return 1
	runtime_gid="$(/usr/bin/id -g "$RUNTIME_USER")" || return 1
	[[ "$deploy_uid" != "$runtime_uid" && "$deploy_gid" != "$runtime_gid" ]] || return 1
	metadata_matches "$RUNTIME_ENV" file "0:$runtime_gid:440" || return 1
	[[ "$(/usr/bin/stat -c '%h' -- "$RUNTIME_ENV")" == 1 ]] || return 1
	rootless_socket="/run/user/$runtime_uid/docker.sock"
	metadata_matches "$ROOTLESS_DOCKER_HOME" directory "0:$runtime_gid:750" || return 1
	metadata_matches "$ROOTLESS_DOCKER_CONFIG" directory "$runtime_uid:$runtime_gid:700" || return 1
	metadata_matches "/run/user/$runtime_uid" directory "$runtime_uid:$runtime_gid:700" || return 1
	metadata_matches "$rootless_socket" socket "$runtime_uid:$runtime_gid:600" || \
		metadata_matches "$rootless_socket" socket "$runtime_uid:$runtime_gid:660" || return 1
	/usr/sbin/runuser -u "$SSH_GATE_USER" -- /usr/bin/test ! -r "$rootless_socket" && \
		/usr/sbin/runuser -u "$SSH_GATE_USER" -- /usr/bin/test ! -w "$rootless_socket" && \
		/usr/sbin/runuser -u "$SSH_GATE_USER" -- /usr/bin/test ! -r "$RUNTIME_ENV" && \
		/usr/sbin/runuser -u "$SSH_GATE_USER" -- /usr/bin/test ! -w "$RUNTIME_ENV" && \
		/usr/sbin/runuser -u "$DEPLOY_USER" -- /usr/bin/test ! -r "$rootless_socket" && \
		/usr/sbin/runuser -u "$DEPLOY_USER" -- /usr/bin/test ! -w "$rootless_socket" && \
		/usr/sbin/runuser -u "$DEPLOY_USER" -- /usr/bin/test ! -r "$RUNTIME_ENV" && \
		/usr/sbin/runuser -u "$DEPLOY_USER" -- /usr/bin/test ! -w "$RUNTIME_ENV" || return 1
	metadata_matches "$STABLE_RUNTIME_MANAGER" file '0:0:755' || return 1
	/usr/bin/env -i PATH='/usr/bin:/bin' HOME='/nonexistent' \
		LAS_STABLE_BUNDLE_DIR="${LAS_STABLE_BUNDLE_DIR:-}" \
		/bin/bash --noprofile --norc -p "$STABLE_RUNTIME_MANAGER" "$RUNTIME_BOUNDARY_OPERATION" || return 1
	if [[ -e "$ROOTFUL_DOCKER_SOCKET" || -L "$ROOTFUL_DOCKER_SOCKET" ]]; then
		[[ -S "$ROOTFUL_DOCKER_SOCKET" && ! -L "$ROOTFUL_DOCKER_SOCKET" ]] || return 1
		rootful_mode="$(/usr/bin/stat -c '%a' -- "$ROOTFUL_DOCKER_SOCKET")"
		[[ "$rootful_mode" != *6 && "$rootful_mode" != *7 ]] || return 1
		/usr/sbin/runuser -u "$DEPLOY_USER" -- /usr/bin/test ! -r "$ROOTFUL_DOCKER_SOCKET" && \
			/usr/sbin/runuser -u "$DEPLOY_USER" -- /usr/bin/test ! -w "$ROOTFUL_DOCKER_SOCKET" && \
			/usr/sbin/runuser -u "$SSH_GATE_USER" -- /usr/bin/test ! -r "$ROOTFUL_DOCKER_SOCKET" && \
			/usr/sbin/runuser -u "$SSH_GATE_USER" -- /usr/bin/test ! -w "$ROOTFUL_DOCKER_SOCKET" && \
			/usr/sbin/runuser -u "$RUNTIME_USER" -- /usr/bin/test ! -r "$ROOTFUL_DOCKER_SOCKET" && \
			/usr/sbin/runuser -u "$RUNTIME_USER" -- /usr/bin/test ! -w "$ROOTFUL_DOCKER_SOCKET" || return 1
	fi
}

validate_sudo_dispatch_boundary() {
	metadata_matches '/etc/sudoers.d' directory '0:0:755' && \
		metadata_matches "$SUDOERS_POLICY" file '0:0:440' || return 1
	/usr/bin/cmp -s "$SUDOERS_POLICY" <(/usr/bin/printf '%s\n' \
		'Cmnd_Alias YONARIS_LAS_DISPATCH = /usr/local/libexec/yonaris-las/dispatch-las-command' \
		'Defaults!YONARIS_LAS_DISPATCH secure_path=/usr/bin:/bin:/usr/sbin:/sbin' \
		'Defaults!YONARIS_LAS_DISPATCH env_reset' \
		'Defaults!YONARIS_LAS_DISPATCH env_keep += "SSH_ORIGINAL_COMMAND"' \
		'Defaults!YONARIS_LAS_DISPATCH env_delete += "BASH_ENV ENV CDPATH GLOBIGNORE BASHOPTS SHELLOPTS LD_PRELOAD LD_LIBRARY_PATH PYTHONPATH PERL5LIB RUBYLIB"' \
		'yonaris-gate ALL=(root) NOPASSWD: YONARIS_LAS_DISPATCH') && \
		/usr/sbin/visudo -cf "$SUDOERS_POLICY" >/dev/null
}

metadata_matches "$HOME_DIRECTORY" directory '0:0:755' && \
	metadata_matches "$SSH_DIRECTORY" directory '0:0:755' && \
	metadata_matches "$AUTHORIZED_KEYS" file '0:0:600' || \
	fail 'The root-owned LAS Actions authorized_keys boundary is invalid.'
/usr/bin/cmp -s "$AUTHORIZED_KEYS" <(/usr/bin/printf '%s\n' "$EXPECTED_AUTHORIZED_KEY") || \
	fail 'authorized_keys is not exactly one LF-terminated forced Actions entry.'

actual_fingerprint="$(
	/usr/bin/printf '%s %s\n' "$ACTIONS_KEY_TYPE" "$ACTIONS_KEY_BODY" |
		/usr/bin/ssh-keygen -lf /dev/stdin -E sha256 |
		/usr/bin/awk 'NR == 1 { print $2 }'
)"
[[ "$actual_fingerprint" == "$ACTIONS_KEY_FINGERPRINT" ]] || \
	fail 'The LAS Actions public-key fingerprint is invalid.'
validate_effective_sshd_boundary || fail 'The effective sshd authorized-key boundary is not exact.'
validate_sudo_dispatch_boundary || fail 'The SSH gate sudo boundary is not byte-exact and valid.'
validate_account_boundary || fail 'The LAS SSH gate and deploy account identities are not distinct locked non-root accounts.'
validate_deploy_sshd_denial || fail 'The runtime deployment account still has an inbound sshd authentication path.'
validate_effective_sudo_boundary || fail 'The effective sudo policy grants more than the one stable gate dispatcher.'
validate_tmpfiles_boundary || fail 'The reboot-persistent LAS lock and Caddy runtime-directory contract is invalid.'
validate_legacy_host_boundaries || fail 'A legacy host backup or Caddy entrypoint can still bypass the stable boundary.'

metadata_matches "$TRUST_DIRECTORY" directory '0:0:755' && \
	metadata_matches "$TRUST_POLICY" file '0:0:644' && \
	metadata_matches "$ATTESTATION" file '0:0:600' && \
	/usr/bin/cmp -s "$ATTESTATION" <(/usr/bin/printf '%s\n' "$TOKEN") || \
	fail 'The root-owned LAS trust policy or forced-command attestation is invalid.'
if [[ -e "$ACTIVATION_ATTESTATION" || -L "$ACTIVATION_ATTESTATION" ]]; then
	metadata_matches "$ACTIVATION_ATTESTATION" file '0:0:400' && \
		/usr/bin/cmp -s "$ACTIVATION_ATTESTATION" <(/usr/bin/printf '%s\n' "$ACTIVATION_TOKEN") || \
		fail 'The one-way artifact language activation attestation is invalid.'
fi
[[ ! -e "$CADDY_BOOTSTRAP_JOURNAL" && ! -L "$CADDY_BOOTSTRAP_JOURNAL" ]] || \
	fail 'A canonical Caddy bootstrap transition is pending root recovery.'
[[ ! -e "$TRANSITION_JOURNAL" && ! -L "$TRANSITION_JOURNAL" ]] || \
	fail 'A canonical release transition is pending root recovery.'

metadata_matches "$STABLE_DIRECTORY" directory "0:0:$STABLE_DIRECTORY_MODE" && \
	metadata_matches "$STATE_DIRECTORY" directory '0:0:711' && \
	metadata_matches "$SOURCE_GIT_DIR" directory '0:0:700' && \
	metadata_matches "$LOCK_DIRECTORY" directory '0:0:700' && \
	metadata_matches "$VERIFIER" file '0:0:755' && \
	[[ "$(/usr/bin/readlink -f -- "$0")" == "$VERIFIER" ]] && validate_policy || \
	fail 'The root-owned LAS verifier, stable programs, or digest policy is invalid.'
validate_rootless_docker_boundary || \
	fail 'Only the isolated yonaris-runtime TCB may access its verified rootless Docker daemon.'
validate_caddy_boundary || \
	fail 'The Caddy admin socket or listener boundary is invalid.'
