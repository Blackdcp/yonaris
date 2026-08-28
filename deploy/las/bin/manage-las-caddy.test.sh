#!/usr/bin/env bash

set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
SOURCE="$SCRIPT_DIR/manage-las-caddy.sh"
OFFICIAL_ORIGIN_CA="$SCRIPT_DIR/../caddy/cloudflare-origin-ca.pem"
TEST_ROOT="$(mktemp -d)"
tls_pid=''
cleanup() {
	if [[ -n "$tls_pid" ]]; then
		kill "$tls_pid" >/dev/null 2>&1 || true
		wait "$tls_pid" >/dev/null 2>&1 || true
	fi
	rm -rf -- "$TEST_ROOT"
}
trap cleanup EXIT

ETC="$TEST_ROOT/etc"
TRUST="$ETC/yonaris"
CADDY_DIR="$ETC/caddy"
TARGET="$CADDY_DIR/Caddyfile"
ADMIN_DIR="$TEST_ROOT/run/caddy"
ADMIN_SOCKET="$ADMIN_DIR/admin.sock"
ORIGIN_CA="$TRUST/las-origin-health-ca.pem"
TLS_TEST_CA="$TEST_ROOT/tls-test-ca.pem"
TLS_TEST_CA_KEY="$TEST_ROOT/tls-test-ca.key"
TLS_KEY="$TEST_ROOT/tls-health.key"
TLS_CSR="$TEST_ROOT/tls-health.csr"
TLS_CERT="$TEST_ROOT/tls-health.pem"
CADDY_LOG="$TEST_ROOT/caddy-commands.log"
CURL_LOG="$TEST_ROOT/curl-commands.log"
BACKUPS="$TRUST/las-caddy-transition-backups-v1"
JOURNAL="$TRUST/las-transition-pending-v1"
BOOTSTRAP_JOURNAL="$TRUST/las-caddy-bootstrap-pending-v1"
MARKETING_RELEASE="$TRUST/las-active-marketing-release-v1"
TREES="$TEST_ROOT/var/lib/yonaris/las-release-trees"
STABLE="$TEST_ROOT/usr/local/libexec/yonaris-las"
MANAGER="$STABLE/manage-las-caddy"
STATE_MANAGER="$STABLE/manage-las-release-state"
MOCK_BIN="$TEST_ROOT/mock-bin"
REAL_STAT="$(command -v stat)"
REAL_READLINK="$(command -v readlink)"
REAL_CP="$(command -v cp)"
REAL_MV="$(command -v mv)"
REAL_SYNC="$(command -v sync)"
REAL_ENV="$(command -v env)"
REAL_OPENSSL="$(command -v openssl)"
REAL_PYTHON="$(command -v python3)"
CANDIDATE='sha-1111111111111111111111111111111111111111'
PREDECESSOR='sha-2222222222222222222222222222222222222222'
EXPECTED_ORIGIN_CA_SHA256='4fd8df5f5818d3979635f7ff7aeb3925cc2a28d17630d6038f190403601dc057'

[[ "$(sha256sum "$OFFICIAL_ORIGIN_CA" | awk '{print $1}')" == "$EXPECTED_ORIGIN_CA_SHA256" ]]
grep -Fq "readonly ORIGIN_HEALTH_CA_SHA256='$EXPECTED_ORIGIN_CA_SHA256'" "$SOURCE"

mkdir -p "$TRUST" "$CADDY_DIR" "$ADMIN_DIR" "$BACKUPS" "$TREES/$CANDIDATE/deploy/las/caddy" \
	"$TREES/$PREDECESSOR/deploy/las/caddy" "$STABLE" "$MOCK_BIN"
cp "$OFFICIAL_ORIGIN_CA" "$ORIGIN_CA"
cp "$OFFICIAL_ORIGIN_CA" "$TREES/$CANDIDATE/deploy/las/caddy/cloudflare-origin-ca.pem"
cp "$OFFICIAL_ORIGIN_CA" "$TREES/$PREDECESSOR/deploy/las/caddy/cloudflare-origin-ca.pem"

cat >"$TREES/$PREDECESSOR/deploy/las/caddy/yonaris-marketing.caddy" <<'EOF'
yonaris.com, www.yonaris.com {
  @api path /api/*
  handle @api {
    reverse_proxy 127.0.0.1:1516
  }
  handle {
    reverse_proxy 127.0.0.1:1514
  }
}
EOF
cat >"$TREES/$CANDIDATE/deploy/las/caddy/yonaris-marketing.caddy" <<'EOF'
yonaris.com, www.yonaris.com {
  @api path /api/*
  handle @api {
    reverse_proxy 127.0.0.1:1516
  }
  handle {
    reverse_proxy 127.0.0.1:1516
  }
}
EOF
cat >"$TARGET" <<'EOF'
{
  email ops@yonaris.com
  admin unix//run/caddy/admin.sock|0600
}

portal.yonaris.com {
  reverse_proxy 127.0.0.1:1515
}

yonaris.com, www.yonaris.com {
  @api path /api/*
  handle @api {
    reverse_proxy 127.0.0.1:1516
  }
  handle {
    reverse_proxy 127.0.0.1:1514
  }
}
EOF
sed -i "s#/run/caddy#$ADMIN_DIR#g" "$TARGET"
cp "$TARGET" "$TEST_ROOT/original"
: >"$CADDY_LOG"
: >"$CURL_LOG"

# A real CA/leaf pair proves that the health trust file authenticates the
# origin independently of the machine trust store. The private key is an
# ephemeral test fixture and never enters a release tree.
"$REAL_OPENSSL" req -x509 -newkey rsa:2048 -nodes -days 1 \
	-subj '//CN=LAS Caddy health test CA' \
	-addext 'basicConstraints=critical,CA:TRUE' \
	-addext 'keyUsage=critical,keyCertSign,cRLSign' \
	-keyout "$TLS_TEST_CA_KEY" -out "$TLS_TEST_CA" >/dev/null 2>&1
"$REAL_OPENSSL" req -new -newkey rsa:2048 -nodes \
	-subj '//CN=yonaris.com' \
	-addext 'subjectAltName=DNS:yonaris.com,DNS:portal.yonaris.com' \
	-keyout "$TLS_KEY" -out "$TLS_CSR" >/dev/null 2>&1
"$REAL_OPENSSL" x509 -req -days 1 -copy_extensions copy \
	-in "$TLS_CSR" -CA "$TLS_TEST_CA" -CAkey "$TLS_TEST_CA_KEY" -CAcreateserial \
	-out "$TLS_CERT" >/dev/null 2>&1
"$REAL_OPENSSL" verify -CAfile "$TLS_TEST_CA" -verify_hostname yonaris.com "$TLS_CERT" >/dev/null

: >"$ADMIN_SOCKET"

write_journal() {
	cat >"$JOURNAL" <<EOF
las-transition-v2
surface marketing
candidate $CANDIDATE
predecessor $PREDECESSOR
operation marketing-deploy
web-sha256 sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
worker-sha256 sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb
migrate-sha256 sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc
postgres-sha256 sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd
www-sha256 sha256:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
caddy-before-sha256 none
caddy-after-sha256 none
caddy-backup-sha256 none
EOF
}
write_journal

cat >"$STATE_MANAGER" <<EOF
#!/usr/bin/env bash
set -Eeuo pipefail
JOURNAL='$JOURNAL'
case "\${1:-}" in
  status) cat "\$JOURNAL" ;;
  record-caddy)
    [[ "\$2" == '$CANDIDATE' && "\$3" =~ ^[0-9a-f]{64}$ && "\$4" =~ ^[0-9a-f]{64}$ && "\$5" == "\$3" ]] || exit 1
    if [[ -e '$TEST_ROOT/fail-record' ]]; then exit 93; fi
    head -n 10 "\$JOURNAL" >"\$JOURNAL.new"
    printf 'caddy-before-sha256 %s\ncaddy-after-sha256 %s\ncaddy-backup-sha256 %s\n' "\$3" "\$4" "\$5" >>"\$JOURNAL.new"
    mv -f -- "\$JOURNAL.new" "\$JOURNAL"
    ;;
  *) exit 2 ;;
esac
EOF
chmod +x "$STATE_MANAGER"

cat >"$MOCK_BIN/env" <<'EOF'
#!/usr/bin/env bash
set -Eeuo pipefail
clean=no
if [[ "${1:-}" == -i ]]; then clean=yes; shift; fi
assignments=()
while [[ "${1:-}" == *=* ]]; do assignments+=("$1"); shift; done
if [[ "$clean" == yes ]]; then
	joined=" ${assignments[*]} "
	[[ "$joined" == *' PATH=/usr/bin:/bin '* && "$joined" == *' HOME=/nonexistent '* && \
		"$joined" == *' LC_ALL=C '* && "$joined" == *' LANG=C '* ]] || exit 98
  exec "$REAL_ENV" CADDY_TEST_ENV_WAS_CLEAN=yes "${assignments[@]}" "$@"
fi
exec "$REAL_ENV" "${assignments[@]}" "$@"
EOF
cat >"$MOCK_BIN/id" <<'EOF'
#!/usr/bin/env bash
set -Eeuo pipefail
case "$*" in
  -u) printf '0\n' ;;
  '-u caddy') printf '%s\n' "${CADDY_TEST_CADDY_UID:-991}" ;;
  '-g caddy') printf '%s\n' "${CADDY_TEST_CADDY_GID:-991}" ;;
  '-u yonaris-gate') [[ "${CADDY_TEST_ADMIN_UID_ALIAS:-}" == yonaris-gate ]] && printf '%s\n' "${CADDY_TEST_CADDY_UID:-991}" || printf '1001\n' ;;
  '-u yonaris-deploy') [[ "${CADDY_TEST_ADMIN_UID_ALIAS:-}" == yonaris-deploy ]] && printf '%s\n' "${CADDY_TEST_CADDY_UID:-991}" || printf '1002\n' ;;
  '-u yonaris-runtime') [[ "${CADDY_TEST_ADMIN_UID_ALIAS:-}" == yonaris-runtime ]] && printf '%s\n' "${CADDY_TEST_CADDY_UID:-991}" || printf '1003\n' ;;
  *) exit 2 ;;
esac
EOF
cat >"$MOCK_BIN/chown" <<'EOF'
#!/usr/bin/env bash
exit 0
EOF
cat >"$MOCK_BIN/caddy" <<'EOF'
#!/usr/bin/env bash
set -Eeuo pipefail
printf '%s\n' "$*" >>"$CADDY_TEST_CADDY_LOG"
case "$1" in
  validate) [[ "${CADDY_TEST_FAIL_VALIDATE:-no}" != yes ]] ;;
  reload)
    if [[ "${CADDY_TEST_FAIL_RELOAD_ONCE:-no}" == yes && ! -e "${CADDY_TEST_STATE}/reload-failed" ]]; then
      touch "${CADDY_TEST_STATE}/reload-failed"; exit 1
    fi
    [[ "${CADDY_TEST_FAIL_RELOAD_ALWAYS:-no}" != yes ]]
    ;;
  *) exit 2 ;;
esac
EOF
cat >"$MOCK_BIN/systemctl" <<'EOF'
#!/usr/bin/env bash
set -Eeuo pipefail
printf '%s\n' "$*" >>"$CADDY_TEST_SYSTEMCTL_LOG"
case "${1:-}" in
  restart)
    count=0
    [[ -f "$CADDY_TEST_RESTART_COUNT" ]] && count="$(cat "$CADDY_TEST_RESTART_COUNT")"
    count=$((count + 1))
    printf '%s\n' "$count" >"$CADDY_TEST_RESTART_COUNT"
    if [[ "${CADDY_TEST_FAIL_RESTART_ALWAYS:-no}" == yes ]]; then exit 1; fi
    if [[ "${CADDY_TEST_FAIL_RESTART_ONCE:-no}" == yes && "$count" == 1 ]]; then exit 1; fi
    rm -f "$CADDY_TEST_STOPPED"
    if grep -Fq "$CADDY_TEST_EXPECTED_ADMIN_CONFIG" "$CADDY_TEST_TARGET"; then
      : >"$CADDY_TEST_EXPECTED_ADMIN_SOCKET"
    else
      rm -f "$CADDY_TEST_EXPECTED_ADMIN_SOCKET"
    fi
    ;;
  stop)
    : >"$CADDY_TEST_STOPPED"
    rm -f "$CADDY_TEST_EXPECTED_ADMIN_SOCKET"
    ;;
  is-active) [[ ! -e "$CADDY_TEST_STOPPED" && "${CADDY_TEST_FAIL_IS_ACTIVE:-no}" != yes ]] ;;
  *) exit 2 ;;
esac
EOF
cat >"$MOCK_BIN/curl" <<'EOF'
#!/usr/bin/env bash
set -Eeuo pipefail
[[ "${CADDY_TEST_ENV_WAS_CLEAN:-no}" == yes && "${1:-}" == -q ]] || exit 97
[[ " $* " == *' --show-error '* && " $* " == *" --noproxy * "* ]] || exit 93
printf '%s\n' "$*" >>"$CADDY_TEST_CURL_LOG"
case " $* " in
  *' --unix-socket '*)
    [[ " $* " == *" --unix-socket $CADDY_TEST_EXPECTED_ADMIN_SOCKET "* ]] || exit 94
    if [[ -z "${CADDY_TEST_EFFECTIVE_IDENTITY:-}" ]]; then
      [[ "${CADDY_TEST_ROOT_ADMIN_CONNECT_FAIL:-no}" != yes ]]
      exit $?
    fi
    [[ "${CADDY_TEST_ADMIN_CONNECT_IDENTITY:-}" == "$CADDY_TEST_EFFECTIVE_IDENTITY" ]]
    exit $?
    ;;
esac
case " $* " in
  *' http://127.0.0.1:2019/'* | *' http://[::1]:2019/'*)
    [[ "${CADDY_TEST_DEFAULT_ADMIN_OPEN:-no}" == yes ]]
    exit $?
    ;;
esac
case " $* " in
  *' --insecure '* | *' -k '*) exit 96 ;;
esac
cacert=''
while [[ $# -gt 0 ]]; do
  case "$1" in
    --cacert) cacert="${2:-}"; shift 2 ;;
    *) shift ;;
  esac
done
[[ "$cacert" == "$CADDY_TEST_EXPECTED_CA" && -f "$cacert" ]] || exit 95
[[ "${CADDY_TEST_FAIL_HEALTH:-no}" != yes ]]
EOF
cat >"$MOCK_BIN/runuser" <<'EOF'
#!/usr/bin/env bash
set -Eeuo pipefail
[[ "${1:-}" == --user && -n "${2:-}" && "${3:-}" == -- ]] || exit 2
identity="$2"
shift 3
env CADDY_TEST_EFFECTIVE_IDENTITY="$identity" "$@"
EOF
cat >"$MOCK_BIN/python3" <<'EOF'
#!/usr/bin/env bash
exec "$REAL_PYTHON" "$@"
EOF
cat >"$MOCK_BIN/sync" <<'EOF'
#!/usr/bin/env bash
if [[ "${CADDY_TEST_FAIL_SYNC:-no}" == yes ]]; then exit 91; fi
exec "$REAL_SYNC" "$@"
EOF
cat >"$MOCK_BIN/cp" <<'EOF'
#!/usr/bin/env bash
destination="${@: -1}"
if [[ "${CADDY_TEST_FAIL_BACKUP_COPY:-no}" == yes && "$destination" == *las-caddy-transition-backups-v1* ]]; then exit 92; fi
exec "$REAL_CP" "$@"
EOF
cat >"$MOCK_BIN/mv" <<'EOF'
#!/usr/bin/env bash
destination="${@: -1}"
if [[ "$destination" == */Caddyfile ]]; then
  count=0
  [[ -f "$CADDY_TEST_TARGET_MV_COUNT" ]] && count="$(cat "$CADDY_TEST_TARGET_MV_COUNT")"
  count=$((count + 1))
  printf '%s\n' "$count" >"$CADDY_TEST_TARGET_MV_COUNT"
  if [[ "${CADDY_TEST_FAIL_TARGET_MV:-no}" == yes ||
    ( -n "${CADDY_TEST_FAIL_TARGET_MV_AT:-}" && "$count" == "$CADDY_TEST_FAIL_TARGET_MV_AT" ) ]]; then exit 94; fi
fi
exec "$REAL_MV" "$@"
EOF
cat >"$MOCK_BIN/readlink" <<'EOF'
#!/usr/bin/env bash
exec "$REAL_READLINK" "$@"
EOF
cat >"$MOCK_BIN/stat" <<'EOF'
#!/usr/bin/env bash
set -Eeuo pipefail
format="${2:-}"; path="${@: -1}"
if [[ "$format" == '%F' && "$path" == */run/caddy/admin.sock ]]; then
  [[ -e "$path" ]] || exit 1
  printf 'socket\n'
  exit 0
fi
if [[ "$format" == '%h' ]]; then exec "$REAL_STAT" "$@"; fi
	case "$path" in
	  */etc/yonaris | */etc/caddy) metadata='0:0:755' ;;
	  */run/caddy) metadata="991:991:${CADDY_TEST_ADMIN_DIRECTORY_MODE:-750}" ;;
	  */run/caddy/admin.sock) metadata="991:991:${CADDY_TEST_ADMIN_SOCKET_MODE:-600}" ;;
	  */las-origin-health-ca.pem) metadata='0:0:444' ;;
	  */las-release-trees/sha-*/deploy/las/caddy/cloudflare-origin-ca.pem) metadata='0:0:444' ;;
  */las-caddy-transition-backups-v1) metadata='0:0:700' ;;
  */las-release-trees/sha-*/deploy/las/caddy/yonaris-marketing.caddy) metadata='0:0:444' ;;
  */las-release-trees | */las-release-trees/sha-*) metadata='0:0:555' ;;
  */.las-caddy-bootstrap-predecessor.*) metadata='0:0:600' ;;
  */manage-las-release-state) metadata='0:0:755' ;;
  */Caddyfile) metadata='0:0:644' ;;
  */las-caddy-bootstrap-pending-v1) metadata='0:0:600' ;;
  */las-caddy-transition-backups-v1/*.previous) metadata='0:0:600' ;;
  *) exec "$REAL_STAT" "$@" ;;
esac
if [[ "$format" == '%a' ]]; then printf '%s\n' "${metadata##*:}"; else printf '%s\n' "$metadata"; fi
EOF
chmod +x "$MOCK_BIN"/*

sed \
	-e "s#/etc/yonaris#$TRUST#g" \
	-e "s#/etc/caddy#$CADDY_DIR#g" \
	-e "s#/run/caddy#$ADMIN_DIR#g" \
	-e "s#/var/lib/yonaris/las-release-trees#$TREES#g" \
	-e "s#/usr/local/libexec/yonaris-las#$STABLE#g" \
	-e "s#/usr/bin/id#$MOCK_BIN/id#g" \
	-e "s#/usr/bin/env#$MOCK_BIN/env#g" \
	-e "s#/usr/bin/chown#$MOCK_BIN/chown#g" \
	-e "s#/usr/bin/caddy#$MOCK_BIN/caddy#g" \
	-e "s#/usr/bin/systemctl#$MOCK_BIN/systemctl#g" \
	-e "s#/usr/bin/curl#$MOCK_BIN/curl#g" \
	-e "s#/usr/sbin/runuser#$MOCK_BIN/runuser#g" \
	-e "s#/usr/bin/python3#$MOCK_BIN/python3#g" \
	-e "s#/usr/bin/sync#$MOCK_BIN/sync#g" \
	-e "s#/usr/bin/cp#$MOCK_BIN/cp#g" \
	-e "s#/usr/bin/mv#$MOCK_BIN/mv#g" \
	-e "s#/usr/bin/readlink#$MOCK_BIN/readlink#g" \
	-e "s#/usr/bin/stat#$MOCK_BIN/stat#g" \
	"$SOURCE" >"$MANAGER"
chmod +x "$MANAGER"

run_manager() {
	env PATH='/usr/bin:/bin' HOME='/nonexistent' \
		REAL_STAT="$REAL_STAT" REAL_READLINK="$REAL_READLINK" REAL_CP="$REAL_CP" REAL_MV="$REAL_MV" REAL_SYNC="$REAL_SYNC" REAL_ENV="$REAL_ENV" REAL_PYTHON="$REAL_PYTHON" \
		CADDY_TEST_CADDY_LOG="$CADDY_LOG" CADDY_TEST_CURL_LOG="$CURL_LOG" CADDY_TEST_EXPECTED_CA="$ORIGIN_CA" CADDY_TEST_EXPECTED_ADMIN_SOCKET="$ADMIN_SOCKET" \
		CADDY_TEST_SYSTEMCTL_LOG="$TEST_ROOT/systemctl.log" CADDY_TEST_RESTART_COUNT="$TEST_ROOT/restart-count" CADDY_TEST_TARGET="$TARGET" \
		CADDY_TEST_STOPPED="$TEST_ROOT/caddy-stopped" \
		CADDY_TEST_TARGET_MV_COUNT="$TEST_ROOT/target-mv-count" CADDY_TEST_FAIL_TARGET_MV_AT="${CADDY_TEST_FAIL_TARGET_MV_AT:-}" \
		CADDY_TEST_EXPECTED_ADMIN_CONFIG="admin unix/$ADMIN_SOCKET|0600" \
		CADDY_TEST_ADMIN_UID_ALIAS="${CADDY_TEST_ADMIN_UID_ALIAS:-}" CADDY_TEST_DEFAULT_ADMIN_OPEN="${CADDY_TEST_DEFAULT_ADMIN_OPEN:-no}" \
		CADDY_TEST_ADMIN_CONNECT_IDENTITY="${CADDY_TEST_ADMIN_CONNECT_IDENTITY:-}" CADDY_TEST_ROOT_ADMIN_CONNECT_FAIL="${CADDY_TEST_ROOT_ADMIN_CONNECT_FAIL:-no}" \
		CADDY_TEST_ADMIN_DIRECTORY_MODE="${CADDY_TEST_ADMIN_DIRECTORY_MODE:-750}" CADDY_TEST_ADMIN_SOCKET_MODE="${CADDY_TEST_ADMIN_SOCKET_MODE:-600}" \
		CADDY_TEST_STATE="$TEST_ROOT" CADDY_TEST_FAIL_VALIDATE="${CADDY_TEST_FAIL_VALIDATE:-no}" \
		CADDY_TEST_FAIL_RELOAD_ONCE="${CADDY_TEST_FAIL_RELOAD_ONCE:-no}" \
		CADDY_TEST_FAIL_RELOAD_ALWAYS="${CADDY_TEST_FAIL_RELOAD_ALWAYS:-no}" \
		CADDY_TEST_FAIL_RESTART_ONCE="${CADDY_TEST_FAIL_RESTART_ONCE:-no}" CADDY_TEST_FAIL_RESTART_ALWAYS="${CADDY_TEST_FAIL_RESTART_ALWAYS:-no}" \
		CADDY_TEST_FAIL_IS_ACTIVE="${CADDY_TEST_FAIL_IS_ACTIVE:-no}" \
		CADDY_TEST_FAIL_HEALTH="${CADDY_TEST_FAIL_HEALTH:-no}" CADDY_TEST_FAIL_SYNC="${CADDY_TEST_FAIL_SYNC:-no}" \
		CADDY_TEST_FAIL_BACKUP_COPY="${CADDY_TEST_FAIL_BACKUP_COPY:-no}" CADDY_TEST_FAIL_TARGET_MV="${CADDY_TEST_FAIL_TARGET_MV:-no}" \
		SUDO_USER="${CADDY_TEST_SUDO_USER:-}" \
		/bin/bash --noprofile --norc -p "$MANAGER" "$@"
}

# Nested handles must not terminate the apex replacement at the first inner brace.
run_manager preflight "$CANDIDATE" "$PREDECESSOR"

assert_preflight_rejected() {
	local description="$1"
	local status
	set +e
	run_manager preflight "$CANDIDATE" "$PREDECESSOR" >"$TEST_ROOT/rejected.out" 2>&1
	status=$?
	set -e
	[[ "$status" -ne 0 ]] || {
		printf 'unsafe Caddy admin boundary passed preflight: %s\n' "$description" >&2
		exit 1
	}
}

# Every stable operation consumes the same side-effect-free Caddy boundary,
# independent of a candidate/predecessor release pair.
run_manager verify-boundary
CADDY_TEST_DEFAULT_ADMIN_OPEN=yes
set +e
run_manager verify-boundary >"$TEST_ROOT/boundary-rejected.out" 2>&1
boundary_status=$?
set -e
unset CADDY_TEST_DEFAULT_ADMIN_OPEN
[[ "$boundary_status" -ne 0 ]]

# The fixed root helper accepts only a permissioned Caddy-owned Unix admin
# socket. The three LAS identities are distinct, non-root UIDs and cannot own
# its 0600 socket; a default TCP admin listener fails the same preflight.
cp "$TARGET" "$TEST_ROOT/secure-admin-Caddyfile"
sed -i 's#admin .*#admin localhost:2019#' "$TARGET"
assert_preflight_rejected default-tcp-admin-config
cp "$TEST_ROOT/secure-admin-Caddyfile" "$TARGET"

CADDY_TEST_DEFAULT_ADMIN_OPEN=yes
assert_preflight_rejected live-default-tcp-admin
unset CADDY_TEST_DEFAULT_ADMIN_OPEN

CADDY_TEST_ADMIN_SOCKET_MODE=666
assert_preflight_rejected world-writable-admin-socket
unset CADDY_TEST_ADMIN_SOCKET_MODE
CADDY_TEST_ADMIN_DIRECTORY_MODE=755
assert_preflight_rejected world-traversable-admin-directory
unset CADDY_TEST_ADMIN_DIRECTORY_MODE

cp "$ORIGIN_CA" "$TEST_ROOT/origin-ca.clean"
printf '%s\n' tamper >>"$ORIGIN_CA"
assert_preflight_rejected tampered-origin-health-ca
cp "$TEST_ROOT/origin-ca.clean" "$ORIGIN_CA"

for identity in yonaris-gate yonaris-deploy yonaris-runtime; do
	CADDY_TEST_ADMIN_UID_ALIAS="$identity"
	assert_preflight_rejected "$identity-shares-caddy-uid"
	unset CADDY_TEST_ADMIN_UID_ALIAS
done

CADDY_TEST_ROOT_ADMIN_CONNECT_FAIL=yes
assert_preflight_rejected root-cannot-reach-admin-socket
unset CADDY_TEST_ROOT_ADMIN_CONNECT_FAIL
for identity in yonaris-gate yonaris-deploy yonaris-runtime; do
	CADDY_TEST_ADMIN_CONNECT_IDENTITY="$identity"
	assert_preflight_rejected "$identity-can-connect-admin-socket"
	unset CADDY_TEST_ADMIN_CONNECT_IDENTITY
done

rm -f "$ADMIN_SOCKET"
assert_preflight_rejected missing-admin-socket
: >"$ADMIN_SOCKET"

# The immutable fragment must contain one exact apex block and nothing else.
cp "$TREES/$CANDIDATE/deploy/las/caddy/yonaris-marketing.caddy" "$TEST_ROOT/candidate-fragment"
for attack in second-site inline-site import global prefix; do
	cp "$TEST_ROOT/candidate-fragment" "$TREES/$CANDIDATE/deploy/las/caddy/yonaris-marketing.caddy"
	case "$attack" in
		second-site) printf '\nevil.example {\n  respond "evil"\n}\n' >>"$TREES/$CANDIDATE/deploy/las/caddy/yonaris-marketing.caddy" ;;
		inline-site) sed -i '$s#}#} evil.example { respond "evil" }#' "$TREES/$CANDIDATE/deploy/las/caddy/yonaris-marketing.caddy" ;;
		import) printf '\nimport /etc/caddy/evil.caddy\n' >>"$TREES/$CANDIDATE/deploy/las/caddy/yonaris-marketing.caddy" ;;
		global) printf '\n{\n  debug\n}\n' >>"$TREES/$CANDIDATE/deploy/las/caddy/yonaris-marketing.caddy" ;;
		prefix) { printf 'import /etc/caddy/evil.caddy\n'; cat "$TEST_ROOT/candidate-fragment"; } >"$TREES/$CANDIDATE/deploy/las/caddy/yonaris-marketing.caddy" ;;
	esac
	set +e
	run_manager preflight "$CANDIDATE" "$PREDECESSOR" >/dev/null 2>&1
	status=$?
	set -e
	[[ "$status" -ne 0 ]] || { echo "Caddy fragment $attack suffix/prefix passed" >&2; exit 1; }
done
cp "$TEST_ROOT/candidate-fragment" "$TREES/$CANDIDATE/deploy/las/caddy/yonaris-marketing.caddy"

# Validate, backup and journal failpoints leave the live target byte-exact.
for failpoint in VALIDATE BACKUP_COPY SYNC RECORD; do
	cp "$TEST_ROOT/original" "$TARGET"; rm -f "$BACKUPS"/*; write_journal
	variable="CADDY_TEST_FAIL_$failpoint"
	if [[ "$failpoint" == RECORD ]]; then
		touch "$TEST_ROOT/fail-record"
	else
		printf -v "$variable" '%s' yes
		export "$variable"
	fi
	set +e
	run_manager prepare "$CANDIDATE" "$PREDECESSOR" >/dev/null 2>&1
	status=$?
	set -e
	rm -f "$TEST_ROOT/fail-record"
	[[ "$failpoint" == RECORD ]] || unset "$variable"
	[[ "$status" -ne 0 ]] || { echo "Caddy $failpoint failpoint was ignored" >&2; exit 1; }
	cmp -s "$TARGET" "$TEST_ROOT/original"
done

# A fresh journal can never reinterpret an already-live candidate as the
# predecessor. Only an idempotent retry with previously bound before/after
# evidence may observe candidate bytes.
write_journal; rm -f "$BACKUPS"/*; cp "$TEST_ROOT/original" "$TARGET"
run_manager prepare "$CANDIDATE" "$PREDECESSOR"
run_manager activate "$CANDIDATE" "$PREDECESSOR"
write_journal
set +e
run_manager prepare "$CANDIDATE" "$PREDECESSOR" >/dev/null 2>&1
candidate_as_predecessor_status=$?
set -e
[[ "$candidate_as_predecessor_status" -ne 0 ]]
cp "$TEST_ROOT/original" "$TARGET"; write_journal; rm -f "$BACKUPS"/*

# Preparation is durable and idempotent before any live mutation.
write_journal; rm -f "$BACKUPS"/*
run_manager prepare "$CANDIDATE" "$PREDECESSOR"
cmp -s "$TARGET" "$TEST_ROOT/original"
grep -Eq '^caddy-before-sha256 [0-9a-f]{64}$' "$JOURNAL"
run_manager prepare "$CANDIDATE" "$PREDECESSOR"

# Reload or post-health failure restores the bound predecessor atomically.
CADDY_TEST_FAIL_RELOAD_ONCE=yes
set +e
run_manager activate "$CANDIDATE" "$PREDECESSOR" >/dev/null 2>&1
reload_status=$?
set -e
unset CADDY_TEST_FAIL_RELOAD_ONCE
[[ "$reload_status" -eq 1 ]]
cmp -s "$TARGET" "$TEST_ROOT/original"

# A successful activation can be retried after an uncatchable SIGKILL window,
# and rollback restores the exact root-owned backup.
rm -f "$TEST_ROOT/reload-failed"
run_manager activate "$CANDIDATE" "$PREDECESSOR"
grep -Fq 'reverse_proxy 127.0.0.1:1516' "$TARGET"
grep -Fq "reload --address unix/$ADMIN_SOCKET --config $TARGET --adapter caddyfile --force" "$CADDY_LOG"
! grep -Fq 'localhost:2019' "$CADDY_LOG"
grep -Fq -- "--cacert $ORIGIN_CA" "$CURL_LOG"
! grep -Eq -- '(^| )(--insecure|-k)( |$)' "$CURL_LOG"
run_manager activate "$CANDIDATE" "$PREDECESSOR"
run_manager rollback "$CANDIDATE" "$PREDECESSOR"
cmp -s "$TARGET" "$TEST_ROOT/original"

# If both candidate reload and predecessor reload fail, recovery remains pending.
run_manager activate "$CANDIDATE" "$PREDECESSOR"
CADDY_TEST_FAIL_RELOAD_ALWAYS=yes
set +e
run_manager rollback "$CANDIDATE" "$PREDECESSOR" >/dev/null 2>&1
fatal_status=$?
set -e
unset CADDY_TEST_FAIL_RELOAD_ALWAYS
[[ "$fatal_status" -eq 75 ]]
[[ -f "$JOURNAL" ]]

# Fresh-host Caddy cutover is a distinct root-local transaction. It binds the
# arbitrary legacy predecessor bytes before installing the one exact immutable
# release fragment, and every failure is either rolled back or remains pending.
rm -f "$JOURNAL" "$BOOTSTRAP_JOURNAL" "$MARKETING_RELEASE" "$BACKUPS"/*
cp "$TEST_ROOT/original" "$TARGET"
sed -i '/admin unix/d' "$TARGET"
cp "$TARGET" "$TEST_ROOT/legacy-bootstrap-original"
rm -f "$ADMIN_SOCKET" "$ORIGIN_CA" "$TEST_ROOT/restart-count"
CADDY_TEST_SUDO_USER=yonaris-deploy
set +e
run_manager bootstrap-activate "$CANDIDATE" "$CANDIDATE" >/dev/null 2>&1
sudo_bootstrap_status=$?
set -e
unset CADDY_TEST_SUDO_USER
[[ "$sudo_bootstrap_status" -ne 0 && ! -e "$BOOTSTRAP_JOURNAL" ]]
cmp -s "$TARGET" "$TEST_ROOT/legacy-bootstrap-original"

printf '%s\n' tamper >>"$TREES/$CANDIDATE/deploy/las/caddy/cloudflare-origin-ca.pem"
set +e
run_manager bootstrap-activate "$CANDIDATE" "$CANDIDATE" >/dev/null 2>&1
tampered_ca_status=$?
set -e
[[ "$tampered_ca_status" -ne 0 && ! -e "$BOOTSTRAP_JOURNAL" ]]
cmp -s "$TARGET" "$TEST_ROOT/legacy-bootstrap-original"
cp "$OFFICIAL_ORIGIN_CA" "$TREES/$CANDIDATE/deploy/las/caddy/cloudflare-origin-ca.pem"

rm -f "$TEST_ROOT/restart-count"
CADDY_TEST_FAIL_RESTART_ONCE=yes
set +e
run_manager bootstrap-activate "$CANDIDATE" "$CANDIDATE" >/dev/null 2>&1
bootstrap_restart_status=$?
set -e
unset CADDY_TEST_FAIL_RESTART_ONCE
[[ "$bootstrap_restart_status" -eq 1 && ! -e "$BOOTSTRAP_JOURNAL" ]]
# Bootstrap rollback may preserve the legacy application routes, but it must
# never converge by reopening Caddy's default localhost:2019 admin endpoint.
! cmp -s "$TARGET" "$TEST_ROOT/legacy-bootstrap-original"
grep -Fq "admin unix/$ADMIN_SOCKET|0600" "$TARGET"
grep -Fq 'reverse_proxy 127.0.0.1:1514' "$TARGET"
[[ -e "$ADMIN_SOCKET" ]]

# A fresh retry must accept that secured predecessor while retaining the
# original hash-bound backup, then converge to the immutable candidate.
run_manager bootstrap-activate "$CANDIDATE" "$CANDIDATE"
grep -Fq 'reverse_proxy 127.0.0.1:1516' "$TARGET"
grep -Fq "admin unix/$ADMIN_SOCKET|0600" "$TARGET"

cp "$TEST_ROOT/legacy-bootstrap-original" "$TARGET"
rm -f "$ADMIN_SOCKET" "$BOOTSTRAP_JOURNAL" "$TEST_ROOT/target-mv-count"

CADDY_TEST_FAIL_TARGET_MV_AT=2
set +e
run_manager bootstrap-activate "$CANDIDATE" "$CANDIDATE" >/dev/null 2>&1
bootstrap_mv_status=$?
set -e
unset CADDY_TEST_FAIL_TARGET_MV_AT
[[ "$bootstrap_mv_status" -eq 75 && -f "$BOOTSTRAP_JOURNAL" ]]
# Candidate installation may fail only after the legacy predecessor has been
# atomically secured, restarted, and verified with the default admin closed.
! cmp -s "$TARGET" "$TEST_ROOT/legacy-bootstrap-original"
grep -Fq "admin unix/$ADMIN_SOCKET|0600" "$TARGET"
grep -Fq 'reverse_proxy 127.0.0.1:1514' "$TARGET"
[[ -e "$ADMIN_SOCKET" ]]
run_manager bootstrap-activate "$CANDIDATE" "$CANDIDATE"
[[ ! -e "$BOOTSTRAP_JOURNAL" ]]
grep -Fq 'reverse_proxy 127.0.0.1:1516' "$TARGET"
grep -Fq "admin unix/$ADMIN_SOCKET|0600" "$TARGET"
[[ -e "$ADMIN_SOCKET" ]]
cmp -s "$ORIGIN_CA" "$OFFICIAL_ORIGIN_CA"
grep -Fq 'restart caddy.service' "$TEST_ROOT/systemctl.log"
run_manager bootstrap-activate "$CANDIDATE" "$CANDIDATE"

printf '%s\n' "$CANDIDATE" >"$MARKETING_RELEASE"
set +e
run_manager bootstrap-activate "$CANDIDATE" "$CANDIDATE" >/dev/null 2>&1
existing_marker_status=$?
set -e
rm -f "$MARKETING_RELEASE"
[[ "$existing_marker_status" -ne 0 ]]

# If the secured-predecessor restart cannot be verified, bootstrap stops Caddy
# before returning. No candidate journal exists yet, and a retry starts only
# from the secured predecessor bytes.
cp "$TEST_ROOT/legacy-bootstrap-original" "$TARGET"
rm -f "$BOOTSTRAP_JOURNAL" "$ADMIN_SOCKET" "$TEST_ROOT/caddy-stopped"
CADDY_TEST_FAIL_RESTART_ALWAYS=yes
set +e
run_manager bootstrap-activate "$CANDIDATE" "$CANDIDATE" >/dev/null 2>&1
bootstrap_fatal_status=$?
set -e
unset CADDY_TEST_FAIL_RESTART_ALWAYS
[[ "$bootstrap_fatal_status" -eq 75 && ! -e "$BOOTSTRAP_JOURNAL" ]]
! cmp -s "$TARGET" "$TEST_ROOT/legacy-bootstrap-original"
grep -Fq "admin unix/$ADMIN_SOCKET|0600" "$TARGET"
grep -Fq 'stop caddy.service' "$TEST_ROOT/systemctl.log"
[[ ! -e "$ADMIN_SOCKET" ]]
run_manager bootstrap-activate "$CANDIDATE" "$CANDIDATE"
[[ ! -e "$BOOTSTRAP_JOURNAL" ]]

# Exercise the same trust shape with a real certificate chain and TLS socket:
# the ephemeral leaf is not in the machine trust store, but succeeds with the
# root-owned CA fixture that the manager passes explicitly to curl.
tls_port="$("$REAL_PYTHON" -c 'import socket; s=socket.socket(); s.bind(("127.0.0.1", 0)); print(s.getsockname()[1]); s.close()')"
"$REAL_OPENSSL" s_server -quiet -www -accept "127.0.0.1:$tls_port" \
	-cert "$TLS_CERT" -key "$TLS_KEY" >"$TEST_ROOT/tls-server.log" 2>&1 &
tls_pid=$!
for _ in $(seq 1 50); do
	if "$REAL_PYTHON" -c 'import socket,ssl,sys; c=ssl.create_default_context(cafile=sys.argv[1]); s=socket.create_connection(("127.0.0.1",int(sys.argv[2])),1); t=c.wrap_socket(s,server_hostname="yonaris.com"); t.close()' \
		"$TLS_TEST_CA" "$tls_port" >/dev/null 2>&1; then break; fi
	sleep 0.1
done
set +e
"$REAL_PYTHON" -c 'import socket,ssl,sys; c=ssl.create_default_context(); s=socket.create_connection(("127.0.0.1",int(sys.argv[1])),2); t=c.wrap_socket(s,server_hostname="yonaris.com"); t.close()' \
	"$tls_port" >/dev/null 2>&1
system_ca_status=$?
set -e
[[ "$system_ca_status" -ne 0 ]]
"$REAL_PYTHON" -c 'import socket,ssl,sys; c=ssl.create_default_context(cafile=sys.argv[1]); s=socket.create_connection(("127.0.0.1",int(sys.argv[2])),2); t=c.wrap_socket(s,server_hostname="yonaris.com"); t.close()' \
	"$TLS_TEST_CA" "$tls_port"
kill "$tls_pid" >/dev/null 2>&1 || true
wait "$tls_pid" >/dev/null 2>&1 || true
tls_pid=''

printf '%s\n' 'root Caddy nested-block, journal, failpoint, retry, and rollback tests passed'
