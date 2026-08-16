#!/usr/bin/env bash

set -Eeuo pipefail
set +x
umask 027
export LC_ALL=C

verify_only=false
if [[ "${1:-}" == --verify-only && $# -eq 1 ]]; then
	verify_only=true
elif [[ $# -ne 0 ]]; then
	echo "Usage: $0 [--verify-only]" >&2
	exit 2
fi

if [[ "$verify_only" != true && "$(id -u)" != 0 ]]; then
	echo "Response snapshot storage preparation must run as root." >&2
	exit 1
fi

storage_root="${RESPONSE_SNAPSHOT_HOST_ROOT:-/var/lib/yonaris/response-snapshots/v1}"
runtime_uid="${RESPONSE_SNAPSHOT_UID:-1001}"
runtime_gid="${RESPONSE_SNAPSHOT_GID:-1001}"

validate_root() {
	local value="$1"
	if [[ "$value" != /* || "$value" == / || "$value" == *$'\r'* || "$value" == *$'\n'* ]]; then
		echo "RESPONSE_SNAPSHOT_HOST_ROOT must be a non-root absolute path without CR or LF." >&2
		exit 1
	fi
	case "$value/" in
		/opt/yonaris/releases/*)
			echo "Response snapshot storage cannot be placed under immutable releases." >&2
			exit 1
			;;
	esac
}

validate_root "$storage_root"
if [[ "$runtime_uid" != 1001 || "$runtime_gid" != 1001 ]]; then
	echo "Response snapshot v1 requires the immutable runtime UID/GID 1001:1001." >&2
	exit 1
fi

cursor="$storage_root"
while [[ "$cursor" != / ]]; do
	if [[ -L "$cursor" ]]; then
		echo "Response snapshot storage cannot contain symlink path components." >&2
		exit 1
	fi
	cursor="$(dirname -- "$cursor")"
done
if [[ -e "$storage_root" && ! -d "$storage_root" ]]; then
	echo "Response snapshot storage root must be a directory." >&2
	exit 1
fi

if [[ "$verify_only" != true ]]; then
	install -d -o "$runtime_uid" -g "$runtime_gid" -m 0750 -- "$storage_root"
fi

if [[ -L "$storage_root" || ! -d "$storage_root" ]]; then
	echo "Prepared response snapshot storage is unsafe." >&2
	exit 1
fi
if [[ "$(stat -c %u:%g -- "$storage_root")" != 1001:1001 ]]; then
	echo "Prepared response snapshot storage has the wrong owner." >&2
	exit 1
fi
if [[ "$(stat -c %a -- "$storage_root")" != 750 ]]; then
	echo "Prepared response snapshot storage has the wrong mode." >&2
	exit 1
fi

printf '%s\n' \
	'response_snapshot_storage.status=prepared' \
	'response_snapshot_storage.owner=1001:1001' \
	'response_snapshot_storage.mode=0750'
