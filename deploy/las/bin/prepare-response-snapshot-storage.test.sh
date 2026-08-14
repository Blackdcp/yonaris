#!/usr/bin/env bash

set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT_UNDER_TEST="$SCRIPT_DIR/prepare-response-snapshot-storage.sh"
TEST_ROOT="$(mktemp -d)"
trap 'rm -rf -- "$TEST_ROOT"' EXIT

MOCK_BIN="$TEST_ROOT/bin"
INSTALL_LOG="$TEST_ROOT/install.log"
mkdir -p "$MOCK_BIN" "$TEST_ROOT/var/lib/yonaris"

cat >"$MOCK_BIN/id" <<'EOF'
#!/usr/bin/env bash
if [[ "${1:-}" == "-u" ]]; then printf '0\n'; else exec /usr/bin/id "$@"; fi
EOF

cat >"$MOCK_BIN/install" <<'EOF'
#!/usr/bin/env bash
printf '<%s>' "$@" >>"$MOCK_INSTALL_LOG"
printf '\n' >>"$MOCK_INSTALL_LOG"
mkdir -p -- "${@: -1}"
EOF

cat >"$MOCK_BIN/stat" <<'EOF'
#!/usr/bin/env bash
case "$2" in
	%u:%g) printf '1001:1001\n' ;;
	%a) printf '750\n' ;;
	*) exec /usr/bin/stat "$@" ;;
esac
EOF

chmod +x "$MOCK_BIN/id" "$MOCK_BIN/install" "$MOCK_BIN/stat"

valid_root="$TEST_ROOT/var/lib/yonaris/response-snapshots/v1"
output="$(env PATH="$MOCK_BIN:$PATH" MOCK_INSTALL_LOG="$INSTALL_LOG" RESPONSE_SNAPSHOT_HOST_ROOT="$valid_root" bash "$SCRIPT_UNDER_TEST")"
grep -Fqx 'response_snapshot_storage.status=prepared' <<<"$output"
grep -Fq '<-d><-o><1001><-g><1001><-m><0750>' "$INSTALL_LOG"

for unsafe_root in / /opt/yonaris/releases/current/snapshots relative/snapshots; do
	set +e
	env PATH="$MOCK_BIN:$PATH" MOCK_INSTALL_LOG="$INSTALL_LOG" RESPONSE_SNAPSHOT_HOST_ROOT="$unsafe_root" \
		bash "$SCRIPT_UNDER_TEST" >"$TEST_ROOT/unsafe.out" 2>"$TEST_ROOT/unsafe.err"
	status=$?
	set -e
	if [[ "$status" -eq 0 ]]; then
		echo "Unsafe snapshot root was accepted: $unsafe_root" >&2
		exit 1
	fi
done

set +e
env PATH="$MOCK_BIN:$PATH" MOCK_INSTALL_LOG="$INSTALL_LOG" RESPONSE_SNAPSHOT_HOST_ROOT="$TEST_ROOT/other" \
	RESPONSE_SNAPSHOT_UID=1002 bash "$SCRIPT_UNDER_TEST" >"$TEST_ROOT/uid.out" 2>"$TEST_ROOT/uid.err"
uid_status=$?
set -e
if [[ "$uid_status" -eq 0 ]]; then
	echo "Non-runtime snapshot UID was accepted." >&2
	exit 1
fi

if ln -s "$TEST_ROOT/real" "$TEST_ROOT/link" 2>/dev/null; then
	mkdir -p "$TEST_ROOT/real"
	set +e
	env PATH="$MOCK_BIN:$PATH" MOCK_INSTALL_LOG="$INSTALL_LOG" RESPONSE_SNAPSHOT_HOST_ROOT="$TEST_ROOT/link/v1" \
		bash "$SCRIPT_UNDER_TEST" >"$TEST_ROOT/link.out" 2>"$TEST_ROOT/link.err"
	link_status=$?
	set -e
	if [[ "$link_status" -eq 0 ]]; then
		echo "Symlinked snapshot root was accepted." >&2
		exit 1
	fi
fi

echo "prepare response snapshot storage tests passed"
