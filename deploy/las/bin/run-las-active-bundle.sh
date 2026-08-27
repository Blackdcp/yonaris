#!/bin/bash

set -Eeuo pipefail
set +x
umask 077
PATH='/usr/bin:/bin'
export PATH
readonly PATH

readonly BUNDLE_TOKEN='yonaris-las-stable-bundle-v1'
readonly STABLE_ROOT='/usr/local/libexec/yonaris-las'
readonly BUNDLES_DIRECTORY='/usr/local/libexec/yonaris-las/bundles'
readonly TRUST_DIRECTORY='/etc/yonaris'
readonly ACTIVE_POINTER='/etc/yonaris/las-stable-bundle-active-v1'

fail() {
	/usr/bin/printf '%s\n' "$1" >&2
	exit 1
}

metadata_matches() {
	local path="$1" kind="$2" expected="$3"
	if /usr/bin/readlink -- "$path" >/dev/null 2>&1; then
		return 1
	fi
	case "$kind" in
		directory) [[ -d "$path" ]] || return 1 ;;
		file) [[ -f "$path" && -r "$path" ]] || return 1 ;;
		*) return 1 ;;
	esac
	[[ "$(/usr/bin/stat -c '%u:%g:%a' -- "$path" 2>/dev/null)" == "$expected" ]] && \
		[[ "$kind" != file || "$(/usr/bin/stat -c '%h' -- "$path" 2>/dev/null)" == 1 ]]
}

case "${0##*/}" in
	dispatch-las-command | guard-artifact-output-release | \
	install-yonaris-las-trust-policy | manage-las-release-state | \
	manage-las-runtime | manage-las-caddy | verify-yonaris-las-forced-command)
		program="${0##*/}" ;;
	*) fail 'The LAS active-bundle launcher name is not an approved stable entrypoint.' ;;
esac

metadata_matches "$0" file '0:0:755' || fail 'The LAS fixed launcher is not exact root-owned code.'
metadata_matches "$STABLE_ROOT" directory '0:0:755' || fail 'The LAS stable root is invalid.'
metadata_matches "$BUNDLES_DIRECTORY" directory '0:0:755' || fail 'The LAS versioned-bundle root is invalid.'
metadata_matches "$TRUST_DIRECTORY" directory '0:0:755' || fail 'The LAS trust root is invalid.'
if [[ "$program" != dispatch-las-command && -n "${LAS_STABLE_BUNDLE_DIR:-}" ]]; then
	[[ "$LAS_STABLE_BUNDLE_DIR" =~ ^$BUNDLES_DIRECTORY/sha256-[0-9a-f]{64}$ ]] || \
		fail 'The inherited LAS bundle pin is invalid.'
	bundle_directory="$LAS_STABLE_BUNDLE_DIR"
else
	metadata_matches "$ACTIVE_POINTER" file '0:0:600' || fail 'The LAS active-bundle pointer is invalid.'
	mapfile -t pointer_lines <"$ACTIVE_POINTER"
	[[ "${#pointer_lines[@]}" -eq 2 && "${pointer_lines[0]}" == "$BUNDLE_TOKEN" ]] || \
		fail 'The LAS active-bundle pointer grammar is invalid.'
	[[ "${pointer_lines[1]}" =~ ^bundle-id\ (sha256:[0-9a-f]{64})$ ]] || \
		fail 'The LAS active-bundle ID is invalid.'
	bundle_id="${BASH_REMATCH[1]}"
	bundle_directory="$BUNDLES_DIRECTORY/sha256-${bundle_id#sha256:}"
fi
program_path="$bundle_directory/$program"

metadata_matches "$bundle_directory" directory '0:0:555' || \
	fail 'The selected LAS bundle directory is invalid.'
metadata_matches "$bundle_directory/las-trust-v1" file '0:0:644' || \
	fail 'The selected LAS bundle policy is invalid.'
metadata_matches "$program_path" file '0:0:755' || \
	fail 'The selected LAS bundle program is invalid.'

LAS_STABLE_BUNDLE_DIR="$bundle_directory"
export LAS_STABLE_BUNDLE_DIR
readonly LAS_STABLE_BUNDLE_DIR
exec "$program_path" "$@"
