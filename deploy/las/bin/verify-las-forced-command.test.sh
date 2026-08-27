#!/usr/bin/env bash

set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
VERIFIER_SOURCE="$SCRIPT_DIR/verify-las-forced-command.sh"
TEST_ROOT="$(mktemp -d)"
trap 'rm -rf -- "$TEST_ROOT"' EXIT

HOME_DIRECTORY="$TEST_ROOT/home/yonaris-gate"
SSH_DIRECTORY="$HOME_DIRECTORY/.ssh"
AUTHORIZED_KEYS="$SSH_DIRECTORY/authorized_keys"
TRUST_DIRECTORY="$TEST_ROOT/etc/yonaris"
TRUST_POLICY="$TRUST_DIRECTORY/las-trust-v1"
RUNTIME_ENV="$TRUST_DIRECTORY/las-runtime.env"
ATTESTATION="$TRUST_DIRECTORY/las-forced-command-active"
ACTIVATION="$TRUST_DIRECTORY/artifact-output-language-active-v1"
TRANSITION_JOURNAL="$TRUST_DIRECTORY/las-transition-pending-v1"
STABLE_DIRECTORY="$TEST_ROOT/usr/local/libexec/yonaris-las"
STABLE_DISPATCHER="$STABLE_DIRECTORY/dispatch-las-command"
STABLE_GUARD="$STABLE_DIRECTORY/guard-artifact-output-release"
STABLE_STATE_MANAGER="$STABLE_DIRECTORY/manage-las-release-state"
STABLE_RUNTIME_MANAGER="$STABLE_DIRECTORY/manage-las-runtime"
STABLE_CADDY_MANAGER="$STABLE_DIRECTORY/manage-las-caddy"
STABLE_PRODUCER="$STABLE_DIRECTORY/produce-las-migration-readiness"
RUNTIME_BOUNDARY_LOG="$TEST_ROOT/runtime-boundary.log"
STABLE_INSTALLER="$TEST_ROOT/usr/local/sbin/install-yonaris-las-trust-policy"
VERIFIER="$TEST_ROOT/usr/local/sbin/verify-yonaris-las-forced-command"
BUNDLE_ID="$(printf 'b%.0s' {1..64})"
BUNDLE_DIRECTORY="$STABLE_DIRECTORY/bundles/sha256-$BUNDLE_ID"
BUNDLE_DISPATCHER="$BUNDLE_DIRECTORY/dispatch-las-command"
BUNDLE_GUARD="$BUNDLE_DIRECTORY/guard-artifact-output-release"
BUNDLE_STATE_MANAGER="$BUNDLE_DIRECTORY/manage-las-release-state"
BUNDLE_RUNTIME_MANAGER="$BUNDLE_DIRECTORY/manage-las-runtime"
BUNDLE_CADDY_MANAGER="$BUNDLE_DIRECTORY/manage-las-caddy"
BUNDLE_INSTALLER="$BUNDLE_DIRECTORY/install-yonaris-las-trust-policy"
BUNDLE_VERIFIER="$BUNDLE_DIRECTORY/verify-yonaris-las-forced-command"
BUNDLE_PRODUCER="$BUNDLE_DIRECTORY/produce-las-migration-readiness"
BUNDLE_POLICY="$BUNDLE_DIRECTORY/las-trust-v1"
ROOTLESS_HOME="$TEST_ROOT/var/lib/yonaris-runtime"
ROOTLESS_CONFIG="$ROOTLESS_HOME/.docker"
ROOTLESS_DIRECTORY="$TEST_ROOT/run/user/2002"
ROOTLESS_SOCKET="$ROOTLESS_DIRECTORY/docker.sock"
ROOTFUL_SOCKET="$TEST_ROOT/var/run/docker.sock"
SUDOERS_DIRECTORY="$TEST_ROOT/etc/sudoers.d"
SUDOERS_POLICY="$SUDOERS_DIRECTORY/yonaris-las-dispatch"
SOURCE_GIT_DIR="$TEST_ROOT/var/lib/yonaris/las-objects.git"
STATE_DIRECTORY="$TEST_ROOT/var/lib/yonaris"
LOCK_DIRECTORY="$TEST_ROOT/run/lock/yonaris"
SYSTEMD_DIRECTORY="$TEST_ROOT/etc/systemd/system"
BACKUP_SERVICE_MASK="$SYSTEMD_DIRECTORY/yonaris-backup.service"
BACKUP_TIMER_MASK="$SYSTEMD_DIRECTORY/yonaris-backup.timer"
TMPFILES_CONFIG="$TEST_ROOT/etc/tmpfiles.d/yonaris-las.conf"
CADDY_RUNTIME_DIRECTORY="$TEST_ROOT/run/caddy"
LEGACY_CADDY_ENTRY="$TEST_ROOT/usr/local/sbin/install-marketing-caddy"
MOCK_BIN="$TEST_ROOT/mock-bin"
REAL_STAT="$(command -v stat)"
REAL_READLINK="$(command -v readlink)"
EXPECTED_KEY="restrict,command=\"/usr/bin/sudo -n $STABLE_DISPATCHER\" ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAINm/JTgoBi4QJiP0KunOfVuG3JDd6NpxlVdZ3l9xzTWg yonaris-las-operator-2026-08-06"
DIGEST_WEB='sha256:1111111111111111111111111111111111111111111111111111111111111111'
DIGEST_WORKER='sha256:2222222222222222222222222222222222222222222222222222222222222222'
DIGEST_MIGRATE='sha256:3333333333333333333333333333333333333333333333333333333333333333'
DIGEST_POSTGRES='sha256:4444444444444444444444444444444444444444444444444444444444444444'
DIGEST_WWW='sha256:5555555555555555555555555555555555555555555555555555555555555555'

mkdir -p "$SSH_DIRECTORY" "$TRUST_DIRECTORY" "$STABLE_DIRECTORY" \
	"$(dirname -- "$VERIFIER")" "$ROOTLESS_CONFIG" "$(dirname -- "$ROOTLESS_SOCKET")" \
	"$(dirname -- "$ROOTFUL_SOCKET")" "$SUDOERS_DIRECTORY" "$SOURCE_GIT_DIR" \
	"$LOCK_DIRECTORY" "$SYSTEMD_DIRECTORY" "$(dirname -- "$TMPFILES_CONFIG")" \
	"$CADDY_RUNTIME_DIRECTORY" "$(dirname -- "$LEGACY_CADDY_ENTRY")" "$MOCK_BIN"
printf '%s\n' \
	"d $LOCK_DIRECTORY 0700 root root -" \
	"d $CADDY_RUNTIME_DIRECTORY 0750 caddy caddy -" >"$TMPFILES_CONFIG"
printf '%s\n' \
	'#!/bin/bash' \
	'set -Eeuo pipefail' \
	"printf '%s\\n' 'The legacy LAS Caddy installer is permanently disabled.' >&2" \
	'exit 2' >"$LEGACY_CADDY_ENTRY"
chmod 0644 "$TMPFILES_CONFIG"
chmod 0755 "$LEGACY_CADDY_ENTRY"
touch "$BACKUP_SERVICE_MASK" "$BACKUP_TIMER_MASK"
for program in "$STABLE_DISPATCHER" "$STABLE_GUARD" "$STABLE_STATE_MANAGER" "$STABLE_INSTALLER" "$STABLE_PRODUCER"; do
	printf '#!/bin/bash\nexit 0\n' >"$program"
	chmod 0755 "$program"
done
cat >"$STABLE_CADDY_MANAGER" <<STUB
#!/bin/bash
[[ "\$#" -eq 1 && "\$1" == verify-boundary ]] || exit 2
for failure in socket-missing default-2019 unprivileged-connect; do
	[[ ! -e '$TEST_ROOT/caddy-boundary-'"\$failure" ]] || exit 1
done
STUB
chmod 0755 "$STABLE_CADDY_MANAGER"
cat >"$STABLE_RUNTIME_MANAGER" <<STUB
#!/bin/bash
[[ "\$#" -eq 1 ]] || exit 2
case "\$1" in
	verify-boundary | verify-preactivation-boundary) ;;
	*) exit 2 ;;
esac
printf '%s\n' "\$1" >>'$RUNTIME_BOUNDARY_LOG'
[[ ! -e '$TEST_ROOT/runtime-boundary-failure' ]]
STUB
chmod 0755 "$STABLE_RUNTIME_MANAGER"
printf '%s\n' "$EXPECTED_KEY" >"$AUTHORIZED_KEYS"
printf '%s\n' 'yonaris-las-forced-command-v1' >"$ATTESTATION"
printf '%s\n' 'DEPLOYMENT_MODE=local' >"$RUNTIME_ENV"
touch "$ROOTLESS_SOCKET" "$ROOTFUL_SOCKET"

cat >"$MOCK_BIN/stat" <<'STUB'
#!/usr/bin/env bash
set -Eeuo pipefail
format=''; path="${@: -1}"
[[ "${1:-}" == -c ]] && format="$2"
if [[ "$format" == '%h' ]]; then exec "$REAL_STAT" "$@"; fi
if [[ "$format" == '%a' && "$path" == */var/run/docker.sock ]]; then
	printf '660\n'; exit 0
fi
if [[ "$path" =~ /libexec/yonaris-las/bundles/sha256-[0-9a-f]{64}$ ]]; then
	printf '0:0:555\n'; exit 0
fi
case "$path" in
	*/etc/systemd/system) printf '0:0:755\n' ;;
	*/systemd/system/yonaris-backup.service | */systemd/system/yonaris-backup.timer)
		printf '0:0\n' ;;
	*/home/yonaris-deploy | */home/yonaris-deploy/.ssh | */etc/yonaris | */libexec/yonaris-las)
		printf '0:0:755\n' ;;
	*/home/yonaris-gate | */home/yonaris-gate/.ssh | */etc/sudoers.d) printf '0:0:755\n' ;;
	*/authorized_keys | */las-forced-command-active) printf '0:0:600\n' ;;
	*/artifact-output-language-active-v1) printf '0:0:400\n' ;;
	*/las-trust-v1) printf '0:0:644\n' ;;
	*/las-runtime.env) printf '0:2002:440\n' ;;
	*/yonaris-las-dispatch) printf '0:0:440\n' ;;
	*/var/lib/yonaris) printf '0:0:711\n' ;;
	*/las-objects.git | */run/lock/yonaris) printf '0:0:700\n' ;;
	*/run/caddy) printf '3003:3003:750\n' ;;
	*/etc/tmpfiles.d/yonaris-las.conf) printf '0:0:644\n' ;;
	*/usr/local/sbin/install-marketing-caddy) printf '0:0:755\n' ;;
	*/dispatch-las-command | */guard-artifact-output-release | */manage-las-release-state | \
	*/manage-las-runtime | */manage-las-caddy | \
	*/install-yonaris-las-trust-policy | */verify-yonaris-las-forced-command | \
	*/produce-las-migration-readiness)
		printf '0:0:755\n' ;;
	*/var/lib/yonaris-runtime) printf '0:2002:750\n' ;;
	*/var/lib/yonaris-runtime/.docker | */run/user/2002) printf '2002:2002:700\n' ;;
	*/run/user/2002/docker.sock) printf '2002:2002:600\n' ;;
	*) exec "$REAL_STAT" "$@" ;;
esac
STUB
cat >"$MOCK_BIN/readlink" <<'STUB'
#!/usr/bin/env bash
set -Eeuo pipefail
path="${@: -1}"
if [[ "${VERIFIER_TEST_SYMLINK:-}" == authorized && "$path" == */authorized_keys ]]; then
	printf '%s.target\n' "$path"; exit 0
fi
if [[ "$path" == */systemd/system/yonaris-backup.service || \
	"$path" == */systemd/system/yonaris-backup.timer ]]; then
	[[ "${VERIFIER_TEST_BACKUP_MASK:-exact}" == exact ]] || exit 1
	printf '%s\n' /dev/null
	exit 0
fi
exec "$REAL_READLINK" "$@"
STUB
cat >"$MOCK_BIN/id" <<'STUB'
#!/usr/bin/env bash
set -Eeuo pipefail
case "$*" in
	-u) printf '0\n' ;;
	'-nG yonaris-deploy') printf '%s\n' "${VERIFIER_TEST_GROUPS:-yonaris-deploy}" ;;
	'-nG yonaris-gate') printf '%s\n' "${VERIFIER_TEST_GATE_GROUPS:-yonaris-gate}" ;;
	'-nG yonaris-runtime') printf '%s\n' "${VERIFIER_TEST_RUNTIME_GROUPS:-yonaris-runtime}" ;;
	'-u yonaris-deploy') printf '1001\n' ;;
	'-g yonaris-deploy') printf '1001\n' ;;
	'-u yonaris-gate') printf '%s\n' "${VERIFIER_TEST_GATE_UID:-1002}" ;;
	'-g yonaris-gate') printf '1002\n' ;;
	'-u yonaris-runtime' | '-g yonaris-runtime') printf '2002\n' ;;
	'-u caddy' | '-g caddy') printf '3003\n' ;;
	*) exit 2 ;;
esac
STUB
cat >"$MOCK_BIN/systemctl" <<'STUB'
#!/usr/bin/env bash
set -Eeuo pipefail
case "$*" in
	'show -p ActiveState --value yonaris-backup.service' | \
	'show -p ActiveState --value yonaris-backup.timer')
		printf '%s\n' "${VERIFIER_TEST_BACKUP_ACTIVE_STATE:-inactive}" ;;
	'is-enabled yonaris-backup.service' | 'is-enabled yonaris-backup.timer')
		state="${VERIFIER_TEST_BACKUP_ENABLED_STATE:-masked}"
		printf '%s\n' "$state"
		[[ "$state" != masked ]] || exit 1
		;;
	'show -p ExecStart --value yonaris-backup.service' | \
	'show -p ExecStart --value yonaris-backup.timer')
		printf '%s\n' "${VERIFIER_TEST_BACKUP_EXEC_START:-}" ;;
	'show -p SupplementaryGroups --value yonaris-backup.service' | \
	'show -p SupplementaryGroups --value yonaris-backup.timer')
		printf '%s\n' "${VERIFIER_TEST_BACKUP_GROUPS:-}" ;;
	*) exit 2 ;;
esac
STUB
cat >"$MOCK_BIN/sshd" <<'STUB'
#!/usr/bin/env bash
set -Eeuo pipefail
if [[ "$*" == *'user=yonaris-deploy'* || "$*" == *'user=yonaris-runtime'* ]]; then
	printf '%s\n' \
		"authenticationmethods ${VERIFIER_TEST_DENIED_AUTHENTICATION_METHODS:-any}" \
		'passwordauthentication no' \
		'kbdinteractiveauthentication no' \
		"pubkeyauthentication ${VERIFIER_TEST_DEPLOY_PUBKEY_AUTH:-no}" \
		"hostbasedauthentication ${VERIFIER_TEST_DEPLOY_HOSTBASED_AUTH:-no}" \
		"gssapiauthentication ${VERIFIER_TEST_DEPLOY_GSSAPI_AUTH:-no}" \
		"kerberosauthentication ${VERIFIER_TEST_DEPLOY_KERBEROS_AUTH:-no}" \
		"disableforwarding ${VERIFIER_TEST_DEPLOY_DISABLE_FORWARDING:-yes}" \
		"allowagentforwarding ${VERIFIER_TEST_DEPLOY_AGENT_FORWARDING:-no}" \
		"allowtcpforwarding ${VERIFIER_TEST_DEPLOY_TCP_FORWARDING:-no}" \
		"allowstreamlocalforwarding ${VERIFIER_TEST_DEPLOY_STREAMLOCAL_FORWARDING:-no}" \
		"x11forwarding ${VERIFIER_TEST_DEPLOY_X11_FORWARDING:-no}" \
		"permittty ${VERIFIER_TEST_DEPLOY_TTY:-no}" \
		"permittunnel ${VERIFIER_TEST_DEPLOY_TUNNEL:-no}" \
		"permitopen ${VERIFIER_TEST_DEPLOY_PERMIT_OPEN:-none}" \
		"permitlisten ${VERIFIER_TEST_DEPLOY_PERMIT_LISTEN:-none}"
	exit 0
fi
printf '%s\n' \
	'authorizedkeysfile .ssh/authorized_keys' \
	"authorizedkeyscommand ${VERIFIER_TEST_AUTHORIZED_KEYS_COMMAND:-none}" \
	'authorizedkeyscommanduser none' \
	'permituserenvironment no' \
	"passwordauthentication ${VERIFIER_TEST_PASSWORD_AUTH:-no}" \
	'kbdinteractiveauthentication no' \
	'pubkeyauthentication yes' \
	'authenticationmethods publickey' \
	'forcecommand none' \
	"trustedusercakeys ${VERIFIER_TEST_TRUSTED_USER_CA_KEYS:-none}" \
	'authorizedprincipalsfile none' \
	'authorizedprincipalscommand none' \
	'authorizedprincipalscommanduser none'
STUB
cat >"$MOCK_BIN/getent" <<'STUB'
#!/usr/bin/env bash
case "$1:${2:-}" in
	passwd:yonaris-gate) printf '%s\n' 'yonaris-gate:x:1002:1002::__GATE_HOME__:/bin/bash' ;;
	passwd:yonaris-deploy) printf '%s\n' "yonaris-deploy:x:1001:1001::/home/yonaris-deploy:${VERIFIER_TEST_DEPLOY_SHELL:-/usr/sbin/nologin}" ;;
	passwd:yonaris-runtime) printf '%s\n' "yonaris-runtime:x:2002:2002::$ROOTLESS_HOME:/usr/sbin/nologin" ;;
	passwd:caddy) printf '%s\n' 'caddy:x:3003:3003::/var/lib/caddy:/usr/sbin/nologin' ;;
	passwd:)
		printf '%s\n' \
			'root:x:0:0:root:/root:/bin/bash' \
			'yonaris-deploy:x:1001:1001::/home/yonaris-deploy:/usr/sbin/nologin' \
			'yonaris-gate:x:1002:1002::__GATE_HOME__:/bin/bash' \
			"yonaris-runtime:x:2002:2002::$ROOTLESS_HOME:/usr/sbin/nologin" \
			'caddy:x:3003:3003::/var/lib/caddy:/usr/sbin/nologin'
		case "${VERIFIER_TEST_UID_ALIAS:-}" in
			deploy) printf '%s\n' 'deploy-shadow:x:1001:4004::/nonexistent:/usr/sbin/nologin' ;;
			gate) printf '%s\n' 'gate-shadow:x:1002:4004::/nonexistent:/usr/sbin/nologin' ;;
			runtime) printf '%s\n' 'runtime-shadow:x:2002:4004::/nonexistent:/usr/sbin/nologin' ;;
			caddy) printf '%s\n' 'caddy-shadow:x:3003:4004::/nonexistent:/usr/sbin/nologin' ;;
		esac
		[[ "${VERIFIER_TEST_RUNTIME_PRIMARY_INTRUDER:-no}" != yes ]] || \
			printf '%s\n' 'unrelated:x:4004:2002::/nonexistent:/usr/sbin/nologin'
		;;
	group:yonaris-runtime | group:2002)
		printf 'yonaris-runtime:x:2002:%s\n' "${VERIFIER_TEST_RUNTIME_GROUP_MEMBERS:-}"
		;;
	group:)
		printf '%s\n' \
			'root:x:0:' \
			'yonaris-deploy:x:1001:' \
			'yonaris-gate:x:1002:' \
			"yonaris-runtime:x:2002:${VERIFIER_TEST_RUNTIME_GROUP_MEMBERS:-}"
		[[ "${VERIFIER_TEST_RUNTIME_DUPLICATE_GID:-no}" != yes ]] || \
			printf '%s\n' 'runtime-shadow:x:2002:unrelated'
		;;
	*) exit 2 ;;
esac
STUB
sed -i "s#__GATE_HOME__#$HOME_DIRECTORY#g" "$MOCK_BIN/getent"
sed -i "s#\$ROOTLESS_HOME#$ROOTLESS_HOME#g" "$MOCK_BIN/getent"
cat >"$MOCK_BIN/passwd" <<'STUB'
#!/usr/bin/env bash
[[ "$1" == -S ]]
printf '%s L 2026-08-27 0 99999 7 -1\n' "$2"
STUB
cat >"$MOCK_BIN/sudo" <<'STUB'
#!/usr/bin/env bash
set -Eeuo pipefail
user="${4:-}"
case "$user" in
	yonaris-gate)
		printf '%s\n' \
			'Matching Defaults entries for yonaris-gate on host:' \
			'User yonaris-gate may run the following commands on host:' \
			'    (root) NOPASSWD: __STABLE_DISPATCHER__'
		[[ ! -e '__EXTRA_GATE_SUDO__' ]] || printf '%s\n' '    (ALL) NOPASSWD: ALL'
		;;
	yonaris-deploy | yonaris-runtime)
		[[ ! -e '__EXTRA_DEPLOY_SUDO__' ]] || {
			printf '%s\n' '    (ALL) NOPASSWD: ALL'; exit 0;
		}
		exit 1
		;;
	*) exit 2 ;;
esac
STUB
sed -i "s#__STABLE_DISPATCHER__#$STABLE_DISPATCHER#g" "$MOCK_BIN/sudo"
sed -i "s#__EXTRA_GATE_SUDO__#$TEST_ROOT/extra-gate-sudo#g" "$MOCK_BIN/sudo"
sed -i "s#__EXTRA_DEPLOY_SUDO__#$TEST_ROOT/extra-deploy-sudo#g" "$MOCK_BIN/sudo"
cat >"$MOCK_BIN/runuser" <<'STUB'
#!/usr/bin/env bash
user="${2:-}" path="${@: -1}"
case "$user:$path" in
	yonaris-deploy:*/var/run/docker.sock)
		[[ "${VERIFIER_TEST_ROOTFUL_ACCESS:-denied}" == denied ]] ;;
	yonaris-runtime:*/var/run/docker.sock)
		[[ "${VERIFIER_TEST_RUNTIME_ROOTFUL_ACCESS:-denied}" == denied ]] ;;
	yonaris-gate:*/var/run/docker.sock)
		[[ "${VERIFIER_TEST_GATE_ROOTFUL_ACCESS:-denied}" == denied ]] ;;
	yonaris-gate:*/run/user/2002/docker.sock)
		[[ "${VERIFIER_TEST_GATE_ROOTLESS_ACCESS:-denied}" == denied ]] ;;
	yonaris-deploy:*/run/user/2002/docker.sock)
		[[ "${VERIFIER_TEST_DEPLOY_ROOTLESS_ACCESS:-denied}" == denied ]] ;;
	yonaris-deploy:*/etc/yonaris/las-runtime.env)
		[[ "${VERIFIER_TEST_DEPLOY_ENV_ACCESS:-denied}" == denied ]] ;;
	yonaris-gate:*/etc/yonaris/las-runtime.env)
		[[ "${VERIFIER_TEST_GATE_ENV_ACCESS:-denied}" == denied ]] ;;
	*) exit 90 ;;
esac
STUB
cat >"$MOCK_BIN/visudo" <<'STUB'
#!/usr/bin/env bash
[[ "$1" == -cf && -f "$2" ]]
STUB
chmod +x "$MOCK_BIN"/*

printf '%s\n' \
	"Cmnd_Alias YONARIS_LAS_DISPATCH = $STABLE_DISPATCHER" \
	'Defaults!YONARIS_LAS_DISPATCH secure_path=/usr/bin:/bin:/usr/sbin:/sbin' \
	'Defaults!YONARIS_LAS_DISPATCH env_reset' \
	'Defaults!YONARIS_LAS_DISPATCH env_keep += "SSH_ORIGINAL_COMMAND"' \
	'Defaults!YONARIS_LAS_DISPATCH env_delete += "BASH_ENV ENV CDPATH GLOBIGNORE BASHOPTS SHELLOPTS LD_PRELOAD LD_LIBRARY_PATH PYTHONPATH PERL5LIB RUBYLIB"' \
	'yonaris-gate ALL=(root) NOPASSWD: YONARIS_LAS_DISPATCH' >"$SUDOERS_POLICY"

sed \
	-e "s#/home/yonaris-gate#$HOME_DIRECTORY#g" \
	-e "s#/etc/yonaris#$TRUST_DIRECTORY#g" \
	-e "s#/usr/local/libexec/yonaris-las#$STABLE_DIRECTORY#g" \
	-e "s#/usr/local/sbin/install-yonaris-las-trust-policy#$STABLE_INSTALLER#g" \
	-e "s#/usr/local/sbin/verify-yonaris-las-forced-command#$VERIFIER#g" \
	-e "s#/var/lib/yonaris-runtime#$ROOTLESS_HOME#g" \
	-e "s#/run/user/\$runtime_uid#$ROOTLESS_DIRECTORY#g" \
	-e "s#/var/run/docker.sock#$ROOTFUL_SOCKET#g" \
	-e "s#/etc/sudoers.d/yonaris-las-dispatch#$SUDOERS_POLICY#g" \
	-e "s#'/etc/sudoers.d'#'$SUDOERS_DIRECTORY'#g" \
	-e "s#readonly STATE_DIRECTORY='/var/lib/yonaris'#readonly STATE_DIRECTORY='$STATE_DIRECTORY'#g" \
	-e "s#/var/lib/yonaris/las-objects.git#$SOURCE_GIT_DIR#g" \
	-e "s#/run/lock/yonaris#$LOCK_DIRECTORY#g" \
	-e "s#/etc/systemd/system#$SYSTEMD_DIRECTORY#g" \
	-e "s#/etc/tmpfiles.d/yonaris-las.conf#$TMPFILES_CONFIG#g" \
	-e "s#/run/caddy#$CADDY_RUNTIME_DIRECTORY#g" \
	-e "s#/usr/local/sbin/install-marketing-caddy#$LEGACY_CADDY_ENTRY#g" \
	-e "s#/usr/bin/stat#$MOCK_BIN/stat#g" \
	-e "s#/usr/bin/readlink#$MOCK_BIN/readlink#g" \
	-e "s#/usr/bin/id#$MOCK_BIN/id#g" \
	-e "s#/usr/sbin/sshd#$MOCK_BIN/sshd#g" \
	-e "s#/usr/bin/passwd#$MOCK_BIN/passwd#g" \
	-e "s#/usr/bin/getent#$MOCK_BIN/getent#g" \
	-e "s#readonly SUDO='/usr/bin/sudo'#readonly SUDO='$MOCK_BIN/sudo'#g" \
	-e "s#/usr/sbin/runuser#$MOCK_BIN/runuser#g" \
	-e "s#/usr/sbin/visudo#$MOCK_BIN/visudo#g" \
	-e "s#/usr/bin/systemctl#$MOCK_BIN/systemctl#g" \
	-e 's/\[\[ -S "\$path" \]\]/[[ -e "$path" ]]/g' \
	-e 's/\[\[ -S "\$ROOTFUL_DOCKER_SOCKET"/[[ -e "$ROOTFUL_DOCKER_SOCKET"/g' \
	"$VERIFIER_SOURCE" >"$VERIFIER"
chmod 0755 "$VERIFIER"

write_policy() {
	printf '%s\n' \
		'yonaris-las-trust-v1' \
		'actions-key-fingerprint SHA256:gM/QEgkfN99cP/Cf9awUOwSb7FMesQTgRCTI9kPh84A' \
		"dispatcher-sha256 $(sha256sum "$STABLE_DISPATCHER" | awk '{print $1}')" \
		"guard-sha256 $(sha256sum "$STABLE_GUARD" | awk '{print $1}')" \
		"installer-sha256 $(sha256sum "$STABLE_INSTALLER" | awk '{print $1}')" \
		"state-manager-sha256 $(sha256sum "$STABLE_STATE_MANAGER" | awk '{print $1}')" \
		"runtime-manager-sha256 $(sha256sum "$STABLE_RUNTIME_MANAGER" | awk '{print $1}')" \
	"caddy-manager-sha256 $(sha256sum "$STABLE_CADDY_MANAGER" | awk '{print $1}')" \
	"verifier-sha256 $(sha256sum "$VERIFIER" | awk '{print $1}')" \
	"migration-readiness-producer-sha256 $(sha256sum "$STABLE_PRODUCER" | awk '{print $1}')" \
		"allow sha-1111111111111111111111111111111111111111 deploy web-sha256 $DIGEST_WEB worker-sha256 $DIGEST_WORKER migrate-sha256 $DIGEST_MIGRATE postgres-sha256 $DIGEST_POSTGRES www-sha256 $DIGEST_WWW" \
		>"$TRUST_POLICY"
}
write_policy

mkdir -p "$BUNDLE_DIRECTORY"
cp -- "$STABLE_DISPATCHER" "$BUNDLE_DISPATCHER"
cp -- "$STABLE_GUARD" "$BUNDLE_GUARD"
cp -- "$STABLE_STATE_MANAGER" "$BUNDLE_STATE_MANAGER"
cp -- "$STABLE_RUNTIME_MANAGER" "$BUNDLE_RUNTIME_MANAGER"
cp -- "$STABLE_CADDY_MANAGER" "$BUNDLE_CADDY_MANAGER"
cp -- "$STABLE_INSTALLER" "$BUNDLE_INSTALLER"
cp -- "$VERIFIER" "$BUNDLE_VERIFIER"
cp -- "$STABLE_PRODUCER" "$BUNDLE_PRODUCER"
chmod 0755 "$BUNDLE_DISPATCHER" "$BUNDLE_GUARD" "$BUNDLE_STATE_MANAGER" \
	"$BUNDLE_RUNTIME_MANAGER" "$BUNDLE_CADDY_MANAGER" "$BUNDLE_INSTALLER" "$BUNDLE_VERIFIER" "$BUNDLE_PRODUCER"
printf '%s\n' \
	'yonaris-las-trust-v1' \
	'actions-key-fingerprint SHA256:gM/QEgkfN99cP/Cf9awUOwSb7FMesQTgRCTI9kPh84A' \
	"dispatcher-sha256 $(sha256sum "$BUNDLE_DISPATCHER" | awk '{print $1}')" \
	"guard-sha256 $(sha256sum "$BUNDLE_GUARD" | awk '{print $1}')" \
	"installer-sha256 $(sha256sum "$BUNDLE_INSTALLER" | awk '{print $1}')" \
	"state-manager-sha256 $(sha256sum "$BUNDLE_STATE_MANAGER" | awk '{print $1}')" \
	"runtime-manager-sha256 $(sha256sum "$BUNDLE_RUNTIME_MANAGER" | awk '{print $1}')" \
	"caddy-manager-sha256 $(sha256sum "$BUNDLE_CADDY_MANAGER" | awk '{print $1}')" \
	"verifier-sha256 $(sha256sum "$BUNDLE_VERIFIER" | awk '{print $1}')" \
	"migration-readiness-producer-sha256 $(sha256sum "$BUNDLE_PRODUCER" | awk '{print $1}')" \
	"allow sha-1111111111111111111111111111111111111111 deploy web-sha256 $DIGEST_WEB worker-sha256 $DIGEST_WORKER migrate-sha256 $DIGEST_MIGRATE postgres-sha256 $DIGEST_POSTGRES www-sha256 $DIGEST_WWW" \
	>"$BUNDLE_POLICY"
chmod 0644 "$BUNDLE_POLICY"
chmod 0555 "$BUNDLE_DIRECTORY"

run_verifier() {
	local executable="${VERIFIER_TEST_EXECUTABLE:-$VERIFIER}"
	local bundle_directory="${VERIFIER_TEST_BUNDLE_DIR:-}"
	env -i PATH='/usr/bin:/bin' HOME='/nonexistent' \
		LAS_STABLE_BUNDLE_DIR="$bundle_directory" \
		REAL_STAT="$REAL_STAT" REAL_READLINK="$REAL_READLINK" \
		VERIFIER_TEST_SYMLINK="${VERIFIER_TEST_SYMLINK:-}" \
		VERIFIER_TEST_GROUPS="${VERIFIER_TEST_GROUPS:-yonaris-deploy}" \
		VERIFIER_TEST_GATE_GROUPS="${VERIFIER_TEST_GATE_GROUPS:-yonaris-gate}" \
		VERIFIER_TEST_RUNTIME_GROUPS="${VERIFIER_TEST_RUNTIME_GROUPS:-yonaris-runtime}" \
		VERIFIER_TEST_RUNTIME_PRIMARY_INTRUDER="${VERIFIER_TEST_RUNTIME_PRIMARY_INTRUDER:-no}" \
		VERIFIER_TEST_RUNTIME_GROUP_MEMBERS="${VERIFIER_TEST_RUNTIME_GROUP_MEMBERS:-}" \
		VERIFIER_TEST_RUNTIME_DUPLICATE_GID="${VERIFIER_TEST_RUNTIME_DUPLICATE_GID:-no}" \
		VERIFIER_TEST_AUTHORIZED_KEYS_COMMAND="${VERIFIER_TEST_AUTHORIZED_KEYS_COMMAND:-none}" \
		VERIFIER_TEST_PASSWORD_AUTH="${VERIFIER_TEST_PASSWORD_AUTH:-no}" \
		VERIFIER_TEST_TRUSTED_USER_CA_KEYS="${VERIFIER_TEST_TRUSTED_USER_CA_KEYS:-none}" \
		VERIFIER_TEST_DEPLOY_PUBKEY_AUTH="${VERIFIER_TEST_DEPLOY_PUBKEY_AUTH:-no}" \
		VERIFIER_TEST_DENIED_AUTHENTICATION_METHODS="${VERIFIER_TEST_DENIED_AUTHENTICATION_METHODS:-any}" \
		VERIFIER_TEST_DEPLOY_HOSTBASED_AUTH="${VERIFIER_TEST_DEPLOY_HOSTBASED_AUTH:-no}" \
		VERIFIER_TEST_DEPLOY_GSSAPI_AUTH="${VERIFIER_TEST_DEPLOY_GSSAPI_AUTH:-no}" \
		VERIFIER_TEST_DEPLOY_KERBEROS_AUTH="${VERIFIER_TEST_DEPLOY_KERBEROS_AUTH:-no}" \
		VERIFIER_TEST_DEPLOY_DISABLE_FORWARDING="${VERIFIER_TEST_DEPLOY_DISABLE_FORWARDING:-yes}" \
		VERIFIER_TEST_DEPLOY_AGENT_FORWARDING="${VERIFIER_TEST_DEPLOY_AGENT_FORWARDING:-no}" \
		VERIFIER_TEST_DEPLOY_TCP_FORWARDING="${VERIFIER_TEST_DEPLOY_TCP_FORWARDING:-no}" \
		VERIFIER_TEST_DEPLOY_STREAMLOCAL_FORWARDING="${VERIFIER_TEST_DEPLOY_STREAMLOCAL_FORWARDING:-no}" \
		VERIFIER_TEST_DEPLOY_X11_FORWARDING="${VERIFIER_TEST_DEPLOY_X11_FORWARDING:-no}" \
		VERIFIER_TEST_DEPLOY_TTY="${VERIFIER_TEST_DEPLOY_TTY:-no}" \
		VERIFIER_TEST_DEPLOY_TUNNEL="${VERIFIER_TEST_DEPLOY_TUNNEL:-no}" \
		VERIFIER_TEST_DEPLOY_PERMIT_OPEN="${VERIFIER_TEST_DEPLOY_PERMIT_OPEN:-none}" \
		VERIFIER_TEST_DEPLOY_PERMIT_LISTEN="${VERIFIER_TEST_DEPLOY_PERMIT_LISTEN:-none}" \
		VERIFIER_TEST_DEPLOY_SHELL="${VERIFIER_TEST_DEPLOY_SHELL:-/usr/sbin/nologin}" \
		VERIFIER_TEST_UID_ALIAS="${VERIFIER_TEST_UID_ALIAS:-}" \
		VERIFIER_TEST_GATE_UID="${VERIFIER_TEST_GATE_UID:-1002}" \
		VERIFIER_TEST_ROOTFUL_ACCESS="${VERIFIER_TEST_ROOTFUL_ACCESS:-denied}" \
		VERIFIER_TEST_GATE_ROOTFUL_ACCESS="${VERIFIER_TEST_GATE_ROOTFUL_ACCESS:-denied}" \
		VERIFIER_TEST_GATE_ROOTLESS_ACCESS="${VERIFIER_TEST_GATE_ROOTLESS_ACCESS:-denied}" \
		VERIFIER_TEST_DEPLOY_ROOTLESS_ACCESS="${VERIFIER_TEST_DEPLOY_ROOTLESS_ACCESS:-denied}" \
		VERIFIER_TEST_DEPLOY_ENV_ACCESS="${VERIFIER_TEST_DEPLOY_ENV_ACCESS:-denied}" \
		VERIFIER_TEST_GATE_ENV_ACCESS="${VERIFIER_TEST_GATE_ENV_ACCESS:-denied}" \
		VERIFIER_TEST_RUNTIME_ROOTFUL_ACCESS="${VERIFIER_TEST_RUNTIME_ROOTFUL_ACCESS:-denied}" \
		VERIFIER_TEST_BACKUP_MASK="${VERIFIER_TEST_BACKUP_MASK:-exact}" \
		VERIFIER_TEST_BACKUP_ACTIVE_STATE="${VERIFIER_TEST_BACKUP_ACTIVE_STATE:-inactive}" \
		VERIFIER_TEST_BACKUP_ENABLED_STATE="${VERIFIER_TEST_BACKUP_ENABLED_STATE:-masked}" \
		VERIFIER_TEST_BACKUP_EXEC_START="${VERIFIER_TEST_BACKUP_EXEC_START:-}" \
		VERIFIER_TEST_BACKUP_GROUPS="${VERIFIER_TEST_BACKUP_GROUPS:-}" \
		/bin/bash --noprofile --norc -p "$executable" "$@"
}

assert_rejected() {
	local name="$1"; shift
	set +e
	"$@" >"$TEST_ROOT/$name.out" 2>"$TEST_ROOT/$name.err"
	local status=$?
	set -e
	[[ "$status" -ne 0 ]] || { echo "Verifier accepted $name" >&2; exit 1; }
}

assert_argument_rejected() {
	local name="$1"
	shift
	: >"$RUNTIME_BOUNDARY_LOG"
	set +e
	run_verifier "$@" >"$TEST_ROOT/$name.out" 2>"$TEST_ROOT/$name.err"
	local status=$?
	set -e
	[[ "$status" -eq 2 && ! -s "$RUNTIME_BOUNDARY_LOG" ]] || {
		echo "Verifier accepted or delegated an invalid argument vector: $name" >&2
		exit 1
	}
}

: >"$RUNTIME_BOUNDARY_LOG"
run_verifier
[[ "$(cat "$RUNTIME_BOUNDARY_LOG")" == verify-boundary ]]
: >"$RUNTIME_BOUNDARY_LOG"
run_verifier preactivate-output-language
[[ "$(cat "$RUNTIME_BOUNDARY_LOG")" == verify-preactivation-boundary ]]
: >"$RUNTIME_BOUNDARY_LOG"
VERIFIER_TEST_EXECUTABLE="$BUNDLE_VERIFIER" VERIFIER_TEST_BUNDLE_DIR="$BUNDLE_DIRECTORY" run_verifier
[[ "$(cat "$RUNTIME_BOUNDARY_LOG")" == verify-boundary ]]
: >"$RUNTIME_BOUNDARY_LOG"
VERIFIER_TEST_EXECUTABLE="$BUNDLE_VERIFIER" VERIFIER_TEST_BUNDLE_DIR="$BUNDLE_DIRECTORY" \
	run_verifier preactivate-output-language
[[ "$(cat "$RUNTIME_BOUNDARY_LOG")" == verify-preactivation-boundary ]]

for invalid_verifier_arguments in near-spelling internal-name prefixed-name extra-argument; do
	case "$invalid_verifier_arguments" in
		near-spelling) command=(preactivate-output-languagex) ;;
		internal-name) command=(verify-preactivation-boundary) ;;
		prefixed-name) command=(--preactivate-output-language) ;;
		extra-argument) command=(preactivate-output-language extra) ;;
	esac
	assert_argument_rejected "arguments-$invalid_verifier_arguments" "${command[@]}"
done

# The special public mode changes only the runtime-env predicate. Every other
# verifier boundary remains in the same fail-closed path.
printf '%s\n%s\n' 'ssh-ed25519 AAAAextra unrestricted' "$EXPECTED_KEY" >"$AUTHORIZED_KEYS"
assert_rejected preactivation-forced-key run_verifier preactivate-output-language
printf '%s\n' "$EXPECTED_KEY" >"$AUTHORIZED_KEYS"
VERIFIER_TEST_UID_ALIAS=runtime
assert_rejected preactivation-uid-alias run_verifier preactivate-output-language
unset VERIFIER_TEST_UID_ALIAS
VERIFIER_TEST_DEPLOY_HOSTBASED_AUTH=yes
assert_rejected preactivation-sshd run_verifier preactivate-output-language
unset VERIFIER_TEST_DEPLOY_HOSTBASED_AUTH
touch "$TEST_ROOT/caddy-boundary-socket-missing"
assert_rejected preactivation-caddy run_verifier preactivate-output-language
rm -f "$TEST_ROOT/caddy-boundary-socket-missing"
printf '%s\n' 'las-transition-v2' >"$TRANSITION_JOURNAL"
assert_rejected preactivation-pending run_verifier preactivate-output-language
rm -f "$TRANSITION_JOURNAL"
write_policy
tail -n 1 "$TRUST_POLICY" >>"$TRUST_POLICY"
assert_rejected preactivation-policy run_verifier preactivate-output-language
write_policy
VERIFIER_TEST_GATE_ROOTLESS_ACCESS=allowed
assert_rejected preactivation-rootless-access run_verifier preactivate-output-language
unset VERIFIER_TEST_GATE_ROOTLESS_ACCESS
touch "$TEST_ROOT/runtime-boundary-failure"
assert_rejected preactivation-runtime-boundary run_verifier preactivate-output-language
rm -f "$TEST_ROOT/runtime-boundary-failure"

for mutation in prefix suffix blank missing-lf; do
	case "$mutation" in
		prefix) printf '%s\n%s\n' 'ssh-ed25519 AAAAextra unrestricted' "$EXPECTED_KEY" >"$AUTHORIZED_KEYS" ;;
		suffix) printf '%s\n%s\n' "$EXPECTED_KEY" '# extra comment' >"$AUTHORIZED_KEYS" ;;
		blank) printf '\n%s\n' "$EXPECTED_KEY" >"$AUTHORIZED_KEYS" ;;
		missing-lf) printf '%s' "$EXPECTED_KEY" >"$AUTHORIZED_KEYS" ;;
	esac
	assert_rejected "authorized-$mutation" run_verifier
	printf '%s\n' "$EXPECTED_KEY" >"$AUTHORIZED_KEYS"
done

VERIFIER_TEST_AUTHORIZED_KEYS_COMMAND='/usr/local/bin/lookup-keys'
assert_rejected sshd-command run_verifier
unset VERIFIER_TEST_AUTHORIZED_KEYS_COMMAND
VERIFIER_TEST_PASSWORD_AUTH=yes
assert_rejected sshd-password run_verifier
unset VERIFIER_TEST_PASSWORD_AUTH
VERIFIER_TEST_TRUSTED_USER_CA_KEYS=/etc/ssh/trusted-user-ca.pub
assert_rejected sshd-user-ca run_verifier
unset VERIFIER_TEST_TRUSTED_USER_CA_KEYS
VERIFIER_TEST_DEPLOY_PUBKEY_AUTH=yes
assert_rejected deploy-sshd-pubkey run_verifier
unset VERIFIER_TEST_DEPLOY_PUBKEY_AUTH
VERIFIER_TEST_DENIED_AUTHENTICATION_METHODS=publickey
assert_rejected deploy-sshd-authentication-methods run_verifier
unset VERIFIER_TEST_DENIED_AUTHENTICATION_METHODS
VERIFIER_TEST_DEPLOY_HOSTBASED_AUTH=yes
assert_rejected deploy-sshd-hostbased run_verifier
unset VERIFIER_TEST_DEPLOY_HOSTBASED_AUTH
VERIFIER_TEST_DEPLOY_GSSAPI_AUTH=yes
assert_rejected deploy-sshd-gssapi run_verifier
unset VERIFIER_TEST_DEPLOY_GSSAPI_AUTH
VERIFIER_TEST_DEPLOY_KERBEROS_AUTH=yes
assert_rejected deploy-sshd-kerberos run_verifier
unset VERIFIER_TEST_DEPLOY_KERBEROS_AUTH
for forwarding_case in disable agent tcp streamlocal x11 tty tunnel permit-open permit-listen; do
	case "$forwarding_case" in
		disable) VERIFIER_TEST_DEPLOY_DISABLE_FORWARDING=no ;;
		agent) VERIFIER_TEST_DEPLOY_AGENT_FORWARDING=yes ;;
		tcp) VERIFIER_TEST_DEPLOY_TCP_FORWARDING=yes ;;
		streamlocal) VERIFIER_TEST_DEPLOY_STREAMLOCAL_FORWARDING=yes ;;
		x11) VERIFIER_TEST_DEPLOY_X11_FORWARDING=yes ;;
		tty) VERIFIER_TEST_DEPLOY_TTY=yes ;;
		tunnel) VERIFIER_TEST_DEPLOY_TUNNEL=yes ;;
		permit-open) VERIFIER_TEST_DEPLOY_PERMIT_OPEN=any ;;
		permit-listen) VERIFIER_TEST_DEPLOY_PERMIT_LISTEN=any ;;
	esac
	assert_rejected "deploy-sshd-forwarding-$forwarding_case" run_verifier
	unset VERIFIER_TEST_DEPLOY_DISABLE_FORWARDING VERIFIER_TEST_DEPLOY_AGENT_FORWARDING \
		VERIFIER_TEST_DEPLOY_TCP_FORWARDING VERIFIER_TEST_DEPLOY_STREAMLOCAL_FORWARDING \
		VERIFIER_TEST_DEPLOY_X11_FORWARDING VERIFIER_TEST_DEPLOY_TTY VERIFIER_TEST_DEPLOY_TUNNEL \
		VERIFIER_TEST_DEPLOY_PERMIT_OPEN VERIFIER_TEST_DEPLOY_PERMIT_LISTEN
done
VERIFIER_TEST_DEPLOY_SHELL=/bin/bash
assert_rejected deploy-login-shell run_verifier
unset VERIFIER_TEST_DEPLOY_SHELL
touch "$TEST_ROOT/extra-gate-sudo"
assert_rejected gate-extra-sudo run_verifier
rm -f "$TEST_ROOT/extra-gate-sudo"
touch "$TEST_ROOT/extra-deploy-sudo"
assert_rejected deploy-extra-sudo run_verifier
rm -f "$TEST_ROOT/extra-deploy-sudo"
VERIFIER_TEST_GATE_UID=1001
assert_rejected shared-uid run_verifier
unset VERIFIER_TEST_GATE_UID
for sensitive_account in deploy gate runtime caddy; do
	VERIFIER_TEST_UID_ALIAS="$sensitive_account"
	assert_rejected "$sensitive_account-uid-alias" run_verifier
	unset VERIFIER_TEST_UID_ALIAS
done
for caddy_failure in socket-missing default-2019 unprivileged-connect; do
	touch "$TEST_ROOT/caddy-boundary-$caddy_failure"
	assert_rejected "caddy-$caddy_failure" run_verifier
	rm -f "$TEST_ROOT/caddy-boundary-$caddy_failure"
done
VERIFIER_TEST_GROUPS='yonaris-deploy docker'
assert_rejected docker-group run_verifier
unset VERIFIER_TEST_GROUPS
VERIFIER_TEST_GATE_GROUPS='yonaris-gate docker'
assert_rejected gate-docker-group run_verifier
unset VERIFIER_TEST_GATE_GROUPS
VERIFIER_TEST_GATE_GROUPS='yonaris-gate yonaris-runtime'
assert_rejected gate-runtime-group run_verifier
unset VERIFIER_TEST_GATE_GROUPS
VERIFIER_TEST_GROUPS='yonaris-deploy yonaris-runtime'
assert_rejected deploy-runtime-group run_verifier
unset VERIFIER_TEST_GROUPS
VERIFIER_TEST_RUNTIME_GROUPS='yonaris-runtime docker'
assert_rejected runtime-docker-group run_verifier
unset VERIFIER_TEST_RUNTIME_GROUPS
VERIFIER_TEST_RUNTIME_PRIMARY_INTRUDER=yes
assert_rejected unrelated-runtime-primary-group run_verifier
unset VERIFIER_TEST_RUNTIME_PRIMARY_INTRUDER
VERIFIER_TEST_RUNTIME_GROUP_MEMBERS=unrelated
assert_rejected unrelated-runtime-supplemental-group run_verifier
unset VERIFIER_TEST_RUNTIME_GROUP_MEMBERS
VERIFIER_TEST_RUNTIME_DUPLICATE_GID=yes
assert_rejected duplicate-runtime-gid-group run_verifier
unset VERIFIER_TEST_RUNTIME_DUPLICATE_GID
VERIFIER_TEST_GATE_ROOTLESS_ACCESS=allowed
assert_rejected gate-rootless-socket run_verifier
unset VERIFIER_TEST_GATE_ROOTLESS_ACCESS
VERIFIER_TEST_DEPLOY_ROOTLESS_ACCESS=allowed
assert_rejected deploy-rootless-socket run_verifier
unset VERIFIER_TEST_DEPLOY_ROOTLESS_ACCESS
VERIFIER_TEST_DEPLOY_ENV_ACCESS=allowed
assert_rejected deploy-runtime-env run_verifier
unset VERIFIER_TEST_DEPLOY_ENV_ACCESS
VERIFIER_TEST_GATE_ENV_ACCESS=allowed
assert_rejected gate-runtime-env run_verifier
unset VERIFIER_TEST_GATE_ENV_ACCESS
VERIFIER_TEST_GATE_ROOTFUL_ACCESS=allowed
assert_rejected gate-rootful-socket run_verifier
unset VERIFIER_TEST_GATE_ROOTFUL_ACCESS
VERIFIER_TEST_RUNTIME_ROOTFUL_ACCESS=allowed
assert_rejected runtime-rootful-socket run_verifier
unset VERIFIER_TEST_RUNTIME_ROOTFUL_ACCESS
VERIFIER_TEST_SYMLINK=authorized
assert_rejected authorized-symlink run_verifier
unset VERIFIER_TEST_SYMLINK

VERIFIER_TEST_BACKUP_ACTIVE_STATE=active
assert_rejected legacy-backup-active run_verifier
unset VERIFIER_TEST_BACKUP_ACTIVE_STATE
VERIFIER_TEST_BACKUP_GROUPS=docker
assert_rejected legacy-backup-docker-group run_verifier
unset VERIFIER_TEST_BACKUP_GROUPS
VERIFIER_TEST_BACKUP_EXEC_START='/opt/yonaris/source/deploy/las/bin/backup.sh'
assert_rejected legacy-backup-mutable-exec run_verifier
unset VERIFIER_TEST_BACKUP_EXEC_START
cp "$TMPFILES_CONFIG" "$TEST_ROOT/tmpfiles.saved"
printf '%s\n' 'd /run/caddy 0777 yonaris-deploy yonaris-deploy -' >"$TMPFILES_CONFIG"
assert_rejected caddy-tmpfiles-boundary run_verifier
cp "$TEST_ROOT/tmpfiles.saved" "$TMPFILES_CONFIG"

printf '%s\n' 'malformed' >"$ACTIVATION"
assert_rejected activation run_verifier
rm -f "$ACTIVATION"

printf '%s\n' 'las-caddy-bootstrap-v1' >"$TRUST_DIRECTORY/las-caddy-bootstrap-pending-v1"
assert_rejected caddy-bootstrap-pending run_verifier
rm -f "$TRUST_DIRECTORY/las-caddy-bootstrap-pending-v1"
printf '%s\n' 'las-transition-v2' >"$TRANSITION_JOURNAL"
assert_rejected release-transition-pending run_verifier
rm -f "$TRANSITION_JOURNAL"
printf '%s\n' attacker >"$TEST_ROOT/attacker-transition"
ln -s "$TEST_ROOT/attacker-transition" "$TRANSITION_JOURNAL"
assert_rejected release-transition-symlink run_verifier
rm -f "$TRANSITION_JOURNAL" "$TEST_ROOT/attacker-transition"

write_policy
tail -n 1 "$TRUST_POLICY" >>"$TRUST_POLICY"
assert_rejected duplicate-policy run_verifier
write_policy

printf 'allow sha-1111111111111111111111111111111111111111 marketing-deploy web-sha256 %s worker-sha256 %s migrate-sha256 %s postgres-sha256 %s www-sha256 %s\n' \
	"$DIGEST_WEB" "$DIGEST_WORKER" "$DIGEST_MIGRATE" "$DIGEST_POSTGRES" \
	'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' >>"$TRUST_POLICY"
assert_rejected same-sha-digest-conflict run_verifier
write_policy

touch "$TEST_ROOT/runtime-boundary-failure"
assert_rejected runtime-daemon-boundary run_verifier
rm -f "$TEST_ROOT/runtime-boundary-failure"

printf '%s\n' '# tamper' >>"$STABLE_DISPATCHER"
assert_rejected stable-hash run_verifier

echo 'exact authorized_keys, sshd, rootless Docker, and digest-policy verifier tests passed'
