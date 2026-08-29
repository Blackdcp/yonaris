#!/usr/bin/env bash

set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
SOURCE="$SCRIPT_DIR/manage-las-caddy.sh"
CA_SOURCE="$SCRIPT_DIR/../caddy/cloudflare-origin-ca.pem"
TEST_ROOT="$(mktemp -d)"
trap 'rm -rf -- "$TEST_ROOT"' EXIT

TRUST_DIRECTORY="$TEST_ROOT/etc/yonaris"
CADDY_DIRECTORY="$TEST_ROOT/etc/caddy"
CADDY_TARGET="$CADDY_DIRECTORY/Caddyfile"
ADMIN_DIRECTORY="$TEST_ROOT/run/caddy"
ADMIN_SOCKET="$ADMIN_DIRECTORY/admin.sock"
ORIGIN_CA="$TRUST_DIRECTORY/las-origin-health-ca.pem"
MOCK_BIN="$TEST_ROOT/mock-bin"
MANAGER="$TEST_ROOT/manage-las-caddy"
CADDY_LOG="$TEST_ROOT/caddy.log"
CURL_LOG="$TEST_ROOT/curl.log"
RUNUSER_LOG="$TEST_ROOT/runuser.log"
if PY_LAUNCHER="$(command -v python3 2>/dev/null)" && "$PY_LAUNCHER" --version >/dev/null 2>&1; then
	PYTHON_COMMAND="$PY_LAUNCHER"
elif PY_LAUNCHER="$(command -v py 2>/dev/null)" && "$PY_LAUNCHER" -3 --version >/dev/null 2>&1; then
	PYTHON_COMMAND="$PY_LAUNCHER -3"
else
	printf '%s\n' 'Python 3 is required for the Caddy boundary test.' >&2
	exit 1
fi

mkdir -p "$TRUST_DIRECTORY" "$CADDY_DIRECTORY" "$ADMIN_DIRECTORY" "$MOCK_BIN"
cp -- "$CA_SOURCE" "$ORIGIN_CA"
: >"$ADMIN_SOCKET"

write_config() {
	printf '{\n\tadmin unix/%s|0600\n}\nportal.yonaris.com {\n\treverse_proxy 127.0.0.1:1515\n}\n' \
		"$ADMIN_SOCKET" >"$CADDY_TARGET"
}
write_config

cat >"$MOCK_BIN/id" <<'STUB'
#!/usr/bin/env bash
if [[ "$*" == -u ]]; then printf '%s\n' "${CADDY_TEST_UID:-0}"; exit 0; fi
case "${1:-}:${2:-}" in
	-u:caddy) printf '%s\n' 998 ;;
	-g:caddy) printf '%s\n' 998 ;;
	-u:yonaris-gate) printf '%s\n' 1001 ;;
	-u:yonaris-deploy) printf '%s\n' 1002 ;;
	-u:yonaris-runtime) printf '%s\n' 1003 ;;
	*) exit 2 ;;
esac
STUB

cat >"$MOCK_BIN/stat" <<'STUB'
#!/usr/bin/env bash
format="${2:-}"; path="${@: -1}"
failure="${CADDY_TEST_METADATA_FAILURE:-}"
if [[ "$format" == '%h' ]]; then
	[[ "$failure" != target-hardlink || "$path" != */etc/caddy/Caddyfile ]] || { printf '%s\n' 2; exit 0; }
	printf '%s\n' 1
	exit 0
fi
if [[ "$format" == '%F' ]]; then
	[[ "$path" == */run/caddy/admin.sock && "$failure" != socket-kind ]] && { printf '%s\n' socket; exit 0; }
	printf '%s\n' 'regular empty file'
	exit 0
fi
case "$path" in
	*/etc/yonaris) value='0:0:755' ;;
	*/etc/caddy) value='0:0:755' ;;
	*/etc/caddy/Caddyfile) value='0:0:644' ;;
	*/etc/yonaris/las-origin-health-ca.pem) value='0:0:444' ;;
	*/run/caddy) value='998:998:750' ;;
	*/run/caddy/admin.sock) value='998:998:600' ;;
	*) exit 2 ;;
esac
case "$failure:$path" in
	trust-mode:*/etc/yonaris) value='0:0:777' ;;
	caddy-mode:*/etc/caddy) value='0:0:777' ;;
	target-mode:*/etc/caddy/Caddyfile) value='0:0:600' ;;
	ca-mode:*/las-origin-health-ca.pem) value='0:0:644' ;;
	admin-mode:*/run/caddy) value='998:998:755' ;;
	socket-mode:*/run/caddy/admin.sock) value='998:998:660' ;;
esac
printf '%s\n' "$value"
STUB

cat >"$MOCK_BIN/readlink" <<'STUB'
#!/usr/bin/env bash
path="${@: -1}"
case "${CADDY_TEST_SYMLINK:-}:$path" in
	target:*/etc/caddy/Caddyfile | ca:*/las-origin-health-ca.pem | \
	admin:*/run/caddy | socket:*/run/caddy/admin.sock)
		printf '%s.target\n' "$path"; exit 0 ;;
esac
exit 1
STUB

cat >"$MOCK_BIN/caddy" <<'STUB'
#!/usr/bin/env bash
printf '%s\n' "$*" >>"$CADDY_TEST_CADDY_LOG"
[[ "$*" == "validate --config $CADDY_TEST_TARGET --adapter caddyfile" ]] || exit 90
[[ "${CADDY_TEST_VALIDATE_FAILURE:-no}" != yes ]]
STUB

cat >"$MOCK_BIN/runuser" <<'STUB'
#!/usr/bin/env bash
printf '%s\n' "$*" >>"$CADDY_TEST_RUNUSER_LOG"
[[ "${CADDY_TEST_USER_ADMIN_ACCESS:-denied}" == allowed ]]
STUB

cat >"$MOCK_BIN/curl" <<'STUB'
#!/usr/bin/env bash
printf '%s\n' "$*" >>'__CURL_LOG__'
case "$*" in
	*'http://127.0.0.1/config/'*) [[ ! -e '__TEST_ROOT__/admin-failure' ]] ;;
	*'http://127.0.0.1:2019/'* | *'http://[::1]:2019/'*)
		[[ -e '__TEST_ROOT__/default-admin-open' ]] ;;
	*'https://portal.yonaris.com/'*)
		[[ "$*" == *"--cacert __ORIGIN_CA__"* && \
			"$*" == *'--resolve portal.yonaris.com:443:127.0.0.1'* && \
			"$*" != *'--insecure'* && "$*" != *' -k '* ]] || exit 91
		[[ ! -e '__TEST_ROOT__/health-failure' ]]
		;;
	*) exit 92 ;;
esac
STUB
sed -i \
	-e "s#__CURL_LOG__#$CURL_LOG#g" \
	-e "s#__TEST_ROOT__#$TEST_ROOT#g" \
	-e "s#__ORIGIN_CA__#$ORIGIN_CA#g" \
	"$MOCK_BIN/curl"
chmod 0755 "$MOCK_BIN"/*

sed \
	-e "s#/etc/yonaris#$TRUST_DIRECTORY#g" \
	-e "s#/etc/caddy#$CADDY_DIRECTORY#g" \
	-e "s#/run/caddy#$ADMIN_DIRECTORY#g" \
	-e "s#/usr/bin/id#$MOCK_BIN/id#g" \
	-e "s#/usr/bin/stat#$MOCK_BIN/stat#g" \
	-e "s#/usr/bin/readlink#$MOCK_BIN/readlink#g" \
	-e "s#/usr/bin/caddy#$MOCK_BIN/caddy#g" \
	-e "s#/usr/bin/curl#$MOCK_BIN/curl#g" \
	-e "s#/usr/sbin/runuser#$MOCK_BIN/runuser#g" \
	-e "s#/usr/bin/python3#$PYTHON_COMMAND#g" \
	"$SOURCE" >"$MANAGER"
chmod 0755 "$MANAGER"

run_manager() {
	env -i PATH='/usr/bin:/bin' HOME='/nonexistent' \
		CADDY_TEST_UID="${CADDY_TEST_UID:-0}" \
		CADDY_TEST_METADATA_FAILURE="${CADDY_TEST_METADATA_FAILURE:-}" \
		CADDY_TEST_SYMLINK="${CADDY_TEST_SYMLINK:-}" \
		CADDY_TEST_VALIDATE_FAILURE="${CADDY_TEST_VALIDATE_FAILURE:-no}" \
		CADDY_TEST_USER_ADMIN_ACCESS="${CADDY_TEST_USER_ADMIN_ACCESS:-denied}" \
		CADDY_TEST_CADDY_LOG="$CADDY_LOG" CADDY_TEST_CURL_LOG="$CURL_LOG" \
		CADDY_TEST_RUNUSER_LOG="$RUNUSER_LOG" CADDY_TEST_TARGET="$CADDY_TARGET" \
		CADDY_TEST_CA="$ORIGIN_CA" LAS_STABLE_BUNDLE_DIR="${CADDY_TEST_BUNDLE_DIR:-}" \
		/bin/bash --noprofile --norc -p "$MANAGER" "$@"
}

assert_rejected() {
	local label="$1" expected_status="$2"; shift 2
	local before status
	before="$(sha256sum "$CADDY_TARGET" | awk '{print $1}')"
	set +e
	run_manager "$@" >"$TEST_ROOT/$label.out" 2>"$TEST_ROOT/$label.err"
	status=$?
	set -e
	[[ "$status" -eq "$expected_status" && \
		"$(sha256sum "$CADDY_TARGET" | awk '{print $1}')" == "$before" ]] || {
		echo "Unexpected Caddy rejection result for $label: $status" >&2
		cat "$TEST_ROOT/$label.err" >&2
		exit 1
	}
}

# The sole command verifies exact root-owned metadata, the permissioned Unix
# admin socket, Caddyfile validity, the pinned CA, and Portal direct-origin TLS.
: >"$CADDY_LOG"; : >"$CURL_LOG"; : >"$RUNUSER_LOG"
before="$(sha256sum "$CADDY_TARGET" | awk '{print $1}')"
run_manager verify-boundary
[[ "$(sha256sum "$CADDY_TARGET" | awk '{print $1}')" == "$before" ]]
grep -Fxq "validate --config $CADDY_TARGET --adapter caddyfile" "$CADDY_LOG"
grep -Fq -- "--unix-socket $ADMIN_SOCKET" "$CURL_LOG"
grep -Fq -- "--cacert $ORIGIN_CA" "$CURL_LOG"
grep -Fq -- '--resolve portal.yonaris.com:443:127.0.0.1' "$CURL_LOG"
grep -Fq -- 'https://portal.yonaris.com/' "$CURL_LOG"
! grep -Eq -- 'https://(www\.)?yonaris\.com/' "$CURL_LOG"
[[ "$(wc -l <"$RUNUSER_LOG")" -eq 3 ]]

for request in none extra prepare activate rollback bootstrap-activate verify-active; do
	case "$request" in
		none) args=() ;;
		extra) args=(verify-boundary extra) ;;
		*) args=("$request" sha-1111111111111111111111111111111111111111 sha-2222222222222222222222222222222222222222) ;;
	esac
	assert_rejected "request-$request" 2 "${args[@]}"
done

CADDY_TEST_UID=1001
assert_rejected non-root 1 verify-boundary
unset CADDY_TEST_UID
CADDY_TEST_BUNDLE_DIR='/tmp/attacker-bundle'
assert_rejected bundle-pin 1 verify-boundary
unset CADDY_TEST_BUNDLE_DIR

for failure in trust-mode caddy-mode target-mode target-hardlink ca-mode admin-mode socket-mode socket-kind; do
	CADDY_TEST_METADATA_FAILURE="$failure"
	assert_rejected "metadata-$failure" 1 verify-boundary
	unset CADDY_TEST_METADATA_FAILURE
done
for symlink in target ca admin socket; do
	CADDY_TEST_SYMLINK="$symlink"
	assert_rejected "symlink-$symlink" 1 verify-boundary
	unset CADDY_TEST_SYMLINK
done

printf '%s\n' '# tampered' >>"$ORIGIN_CA"
assert_rejected tampered-ca 1 verify-boundary
cp -- "$CA_SOURCE" "$ORIGIN_CA"

for config_case in tcp-admin duplicate-admin no-global; do
	case "$config_case" in
		tcp-admin) sed -i "s#admin unix/$ADMIN_SOCKET|0600#admin localhost:2019#" "$CADDY_TARGET" ;;
		duplicate-admin) sed -i "/admin unix/a\\\tadmin unix/$ADMIN_SOCKET|0600" "$CADDY_TARGET" ;;
		no-global) sed -i '1,3d' "$CADDY_TARGET" ;;
	esac
	assert_rejected "config-$config_case" 1 verify-boundary
	write_config
done

for failure in VALIDATE ADMIN USER DEFAULT HEALTH; do
	case "$failure" in
		VALIDATE) CADDY_TEST_VALIDATE_FAILURE=yes ;;
		ADMIN) touch "$TEST_ROOT/admin-failure" ;;
		USER) CADDY_TEST_USER_ADMIN_ACCESS=allowed ;;
		DEFAULT) touch "$TEST_ROOT/default-admin-open" ;;
		HEALTH) touch "$TEST_ROOT/health-failure" ;;
	esac
	assert_rejected "runtime-$failure" 1 verify-boundary
	rm -f "$TEST_ROOT/admin-failure" "$TEST_ROOT/default-admin-open" "$TEST_ROOT/health-failure"
	unset CADDY_TEST_VALIDATE_FAILURE CADDY_TEST_USER_ADMIN_ACCESS
done

# Source-level proof that this stable helper has no mutation or release-state
# capability. Validation, Unix-admin reads, and Portal health are its full TCB.
for forbidden in \
	'/usr/bin/caddy reload' '/usr/bin/systemctl' '/usr/bin/chown' '/usr/bin/chmod' \
	'/usr/bin/install' '/usr/bin/mv' '/usr/bin/cp' '/usr/bin/rm' \
	'MARKETING_RELEASE' 'RELEASE_TREE_ROOT' 'STABLE_STATE_MANAGER' \
	'bootstrap-activate' 'prepare)' 'activate)' 'rollback)' 'verify-active'; do
	! grep -Fq -- "$forbidden" "$SOURCE" || {
		echo "Caddy verifier retains forbidden capability: $forbidden" >&2
		exit 1
	}
done
grep -Fq 'verify-boundary' "$SOURCE"
grep -Fq '/usr/bin/caddy validate' "$SOURCE"
grep -Fq 'portal.yonaris.com' "$SOURCE"

printf '%s\n' 'read-only Portal Caddy boundary verifier tests passed'
