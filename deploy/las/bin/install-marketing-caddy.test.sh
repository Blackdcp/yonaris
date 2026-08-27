#!/usr/bin/env bash

set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
LEGACY_INSTALLER="$SCRIPT_DIR/install-marketing-caddy.sh"
TEST_ROOT="$(mktemp -d)"
trap 'rm -rf -- "$TEST_ROOT"' EXIT

sentinel="$TEST_ROOT/must-not-change"
printf '%s\n' 'untouched' >"$sentinel"

assert_disabled() {
	local description="$1"
	shift
	local status
	set +e
	LEGACY_CADDY_TEST_SENTINEL="$sentinel" \
		/bin/bash --noprofile --norc "$LEGACY_INSTALLER" "$@" >"$TEST_ROOT/output" 2>&1
	status=$?
	set -e
	[[ "$status" -eq 2 ]] || {
		printf 'legacy Caddy entry was not fail-closed: %s (status=%s)\n' "$description" "$status" >&2
		sed -n '1,80p' "$TEST_ROOT/output" >&2
		exit 1
	}
	[[ "$(cat "$sentinel")" == untouched ]] || {
		printf 'legacy Caddy entry mutated state: %s\n' "$description" >&2
		exit 1
	}
	grep -Fq 'permanently disabled' "$TEST_ROOT/output" || {
		printf 'legacy Caddy entry did not explain the fail-closed boundary: %s\n' "$description" >&2
		exit 1
	}
}

assert_disabled no-arguments
assert_disabled public-install --install
assert_disabled public-restore --restore-full "$TEST_ROOT/backup"
assert_disabled public-confirm --confirm-restored "$TEST_ROOT/backup"
assert_disabled inside-install --inside-host install a b c d e f g h 1000 1000
assert_disabled inside-restore --inside-host restore a b c d e f g h
assert_disabled inside-confirm --inside-host confirm a b c d e f g
assert_disabled inside-unknown --inside-host unknown
assert_disabled malformed-inside --inside-host

printf '%s\n' 'legacy Caddy launcher is fail-closed for every public and inside-host entry'
