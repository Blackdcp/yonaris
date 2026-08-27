#!/bin/bash

set -Eeuo pipefail
set +x
umask 077
PATH='/usr/bin:/bin'
LC_ALL='C'
LANG='C'
export PATH
export LC_ALL LANG
readonly PATH LC_ALL LANG
unset CADDY_ADMIN

readonly TRUST_DIRECTORY='/etc/yonaris'
readonly TRANSITION_JOURNAL='/etc/yonaris/las-transition-pending-v1'
readonly BOOTSTRAP_JOURNAL='/etc/yonaris/las-caddy-bootstrap-pending-v1'
readonly MARKETING_RELEASE='/etc/yonaris/las-active-marketing-release-v1'
readonly CADDY_DIRECTORY='/etc/caddy'
readonly CADDY_TARGET='/etc/caddy/Caddyfile'
readonly CADDY_BACKUP_ROOT='/etc/yonaris/las-caddy-transition-backups-v1'
readonly CADDY_ADMIN_DIRECTORY='/run/caddy'
readonly CADDY_ADMIN_SOCKET='/run/caddy/admin.sock'
readonly CADDY_ADMIN_ADDRESS='unix//run/caddy/admin.sock'
readonly CADDY_ADMIN_CONFIG='admin unix//run/caddy/admin.sock|0600'
readonly ORIGIN_HEALTH_CA='/etc/yonaris/las-origin-health-ca.pem'
readonly ORIGIN_HEALTH_CA_SHA256='4fd8df5f5818d3979635f7ff7aeb3925cc2a28d17630d6038f190403601dc057'
readonly RELEASE_TREE_ROOT='/var/lib/yonaris/las-release-trees'
readonly STABLE_DIRECTORY="${LAS_STABLE_BUNDLE_DIR:-/usr/local/libexec/yonaris-las}"
readonly STABLE_STATE_MANAGER="$STABLE_DIRECTORY/manage-las-release-state"
readonly APEX_HEADER='yonaris.com, www.yonaris.com {'

fail() { /usr/bin/printf '%s\n' "$1" >&2; exit "${2:-1}"; }

metadata_matches() {
	local path="$1" kind="$2" expected="$3"
	if /usr/bin/readlink -- "$path" >/dev/null 2>&1; then return 1; fi
	case "$kind" in
		directory) [[ -d "$path" ]] || return 1 ;;
		file) [[ -f "$path" && -r "$path" ]] || return 1 ;;
		socket) [[ "$(/usr/bin/stat -c '%F' -- "$path" 2>/dev/null)" == socket ]] || return 1 ;;
		*) return 1 ;;
	esac
	[[ "$(/usr/bin/stat -c '%u:%g:%a' -- "$path" 2>/dev/null)" == "$expected" ]] && \
		[[ "$kind" != file || "$(/usr/bin/stat -c '%h' -- "$path" 2>/dev/null)" == 1 ]]
}

release_is_valid() { [[ "$1" =~ ^sha-[0-9a-f]{40}$ ]]; }
sha_file() { /usr/bin/sha256sum -- "$1" | /usr/bin/awk '{print $1}'; }
sync_directory() { /usr/bin/sync -f "$1"; }

state_manager() {
	metadata_matches "$STABLE_STATE_MANAGER" file '0:0:755' && \
		/usr/bin/env -i PATH='/usr/bin:/bin' HOME='/nonexistent' LC_ALL='C' LANG='C' \
			LAS_STABLE_BUNDLE_DIR="${LAS_STABLE_BUNDLE_DIR:-}" \
			/bin/bash --noprofile --norc -p "$STABLE_STATE_MANAGER" "$@"
}

journal_field() {
	local name="$1"
	state_manager status | /usr/bin/awk -v name="$name" '$1 == name { print $2 }'
}

release_fragment() {
	local release_tag="$1" tree="$RELEASE_TREE_ROOT/$1" fragment line_count
	release_is_valid "$release_tag" || return 1
	metadata_matches "$RELEASE_TREE_ROOT" directory '0:0:555' || return 1
	metadata_matches "$tree" directory '0:0:555' || return 1
	fragment="$tree/deploy/las/caddy/yonaris-marketing.caddy"
	metadata_matches "$fragment" file '0:0:444' || return 1
	apex_bounds "$fragment" || return 1
	line_count="$(/usr/bin/wc -l <"$fragment")"
	[[ "$APEX_START" == 1 && "$APEX_END" == "$line_count" ]] || return 1
	/usr/bin/printf '%s' "$fragment"
}

release_origin_health_ca() {
	local release_tag="$1" tree="$RELEASE_TREE_ROOT/$1" bundle
	release_is_valid "$release_tag" || return 1
	metadata_matches "$RELEASE_TREE_ROOT" directory '0:0:555' || return 1
	metadata_matches "$tree" directory '0:0:555' || return 1
	bundle="$tree/deploy/las/caddy/cloudflare-origin-ca.pem"
	metadata_matches "$bundle" file '0:0:444' || return 1
	[[ "$(sha_file "$bundle")" == "$ORIGIN_HEALTH_CA_SHA256" ]] || return 1
	/usr/bin/printf '%s' "$bundle"
}

apex_bounds() {
	local config="$1" bounds extra
	bounds="$(/usr/bin/python3 - "$config" "$APEX_HEADER" <<'PY'
import pathlib
import sys

lines = pathlib.Path(sys.argv[1]).read_text(encoding="utf-8").splitlines()
header = sys.argv[2]
starts = [index for index, line in enumerate(lines) if line == header]
if len(starts) != 1:
    raise SystemExit(1)
start = starts[0]
depth = 0
quoted = False
escaped = False
for index in range(start, len(lines)):
    visible = []
    for offset, char in enumerate(lines[index]):
        if escaped:
            escaped = False
            continue
        if char == "\\" and quoted:
            escaped = True
            continue
        if char == '"':
            quoted = not quoted
            continue
        if char == "#" and not quoted:
            break
        if quoted:
            continue
        visible.append(char)
        if char == "{":
            depth += 1
        elif char == "}":
            depth -= 1
            if depth < 0:
                raise SystemExit(1)
            if index > start and depth == 0:
                remainder = lines[index][offset + 1:].lstrip()
                if remainder and not remainder.startswith("#"):
                    raise SystemExit(1)
                print(start + 1, index + 1)
                raise SystemExit(0)
raise SystemExit(1)
PY
)" || return 1
	read -r APEX_START APEX_END extra <<<"$bounds"
	[[ "$APEX_START" =~ ^[1-9][0-9]*$ && "$APEX_END" =~ ^[1-9][0-9]*$ && -z "${extra:-}" ]] || return 1
}

apex_sha() {
	local config="$1"
	apex_bounds "$config" || return 1
	/usr/bin/sed -n "${APEX_START},${APEX_END}p" "$config" | /usr/bin/sha256sum | /usr/bin/awk '{print $1}'
}

build_candidate() {
	local fragment="$1" destination="$2" secure_base
	secure_base="${destination}.secure-base"
	if ! write_secure_admin_config "$CADDY_TARGET" "$secure_base"; then
		/usr/bin/rm -f -- "$secure_base"
		return 1
	fi
	apex_bounds "$secure_base" || { /usr/bin/rm -f -- "$secure_base"; return 1; }
	{
		if ((APEX_START > 1)); then /usr/bin/head -n "$((APEX_START - 1))" "$secure_base"; fi
		/usr/bin/cat -- "$fragment"
		/usr/bin/tail -n "+$((APEX_END + 1))" "$secure_base"
	} >"$destination"
	/usr/bin/rm -f -- "$secure_base"
	/usr/bin/chown 0:0 -- "$destination" && /usr/bin/chmod 0644 -- "$destination" && \
		secure_admin_config "$destination"
}

atomic_copy() {
	local source="$1" destination="$2" mode="$3" directory temporary
	directory="$(/usr/bin/dirname -- "$destination")"
	temporary="$(/usr/bin/mktemp "$directory/.las-caddy.XXXXXX")" || return 1
	if ! /usr/bin/cp -- "$source" "$temporary" || \
		! /usr/bin/chown 0:0 -- "$temporary" || ! /usr/bin/chmod "$mode" -- "$temporary" || \
		! /usr/bin/sync -f "$temporary" || ! /usr/bin/mv -f -- "$temporary" "$destination" || \
		! sync_directory "$directory"; then
		/usr/bin/rm -f -- "$temporary"
		return 1
	fi
}

atomic_text() {
	local destination="$1" mode="$2" contents="$3" directory temporary
	directory="$(/usr/bin/dirname -- "$destination")"
	temporary="$(/usr/bin/mktemp "$directory/.las-caddy-state.XXXXXX")" || return 1
	if ! /usr/bin/printf '%s' "$contents" >"$temporary" || \
		! /usr/bin/chown 0:0 -- "$temporary" || ! /usr/bin/chmod "$mode" -- "$temporary" || \
		! /usr/bin/sync -f "$temporary" || ! /usr/bin/mv -f -- "$temporary" "$destination" || \
		! sync_directory "$directory"; then
		/usr/bin/rm -f -- "$temporary"
		return 1
	fi
}

ensure_origin_health_ca() {
	local release_tag="$1" source
	source="$(release_origin_health_ca "$release_tag")" || return 1
	if [[ -e "$ORIGIN_HEALTH_CA" || -L "$ORIGIN_HEALTH_CA" ]]; then
		metadata_matches "$ORIGIN_HEALTH_CA" file '0:0:444' && \
			[[ "$(sha_file "$ORIGIN_HEALTH_CA")" == "$ORIGIN_HEALTH_CA_SHA256" ]]
		return
	fi
	atomic_copy "$source" "$ORIGIN_HEALTH_CA" 0444 && \
		metadata_matches "$ORIGIN_HEALTH_CA" file '0:0:444' && \
		[[ "$(sha_file "$ORIGIN_HEALTH_CA")" == "$ORIGIN_HEALTH_CA_SHA256" ]]
}

ensure_admin_directory() {
	local caddy_uid caddy_gid
	caddy_uid="$(/usr/bin/id -u caddy 2>/dev/null)" || return 1
	caddy_gid="$(/usr/bin/id -g caddy 2>/dev/null)" || return 1
	[[ "$caddy_uid" =~ ^[1-9][0-9]*$ && "$caddy_gid" =~ ^[0-9]+$ ]] || return 1
	if [[ -e "$CADDY_ADMIN_DIRECTORY" || -L "$CADDY_ADMIN_DIRECTORY" ]]; then
		[[ -d "$CADDY_ADMIN_DIRECTORY" ]] && ! /usr/bin/readlink -- "$CADDY_ADMIN_DIRECTORY" >/dev/null 2>&1 || return 1
		/usr/bin/chown "$caddy_uid:$caddy_gid" -- "$CADDY_ADMIN_DIRECTORY" && \
			/usr/bin/chmod 0750 -- "$CADDY_ADMIN_DIRECTORY" || return 1
	else
		/usr/bin/install -d -o "$caddy_uid" -g "$caddy_gid" -m 0750 -- "$CADDY_ADMIN_DIRECTORY" || return 1
	fi
	metadata_matches "$CADDY_ADMIN_DIRECTORY" directory "$caddy_uid:$caddy_gid:750"
}

read_bootstrap_journal() {
	local -a lines=()
	metadata_matches "$BOOTSTRAP_JOURNAL" file '0:0:600' || return 1
	mapfile -t lines <"$BOOTSTRAP_JOURNAL"
	[[ "${#lines[@]}" -eq 5 && "${lines[0]}" == las-caddy-bootstrap-v1 ]] || return 1
	[[ "${lines[1]}" =~ ^candidate\ (sha-[0-9a-f]{40})$ ]] || return 1
	BOOTSTRAP_CANDIDATE="${BASH_REMATCH[1]}"
	[[ "${lines[2]}" =~ ^before-sha256\ ([0-9a-f]{64})$ ]] || return 1
	BOOTSTRAP_BEFORE="${BASH_REMATCH[1]}"
	[[ "${lines[3]}" =~ ^after-sha256\ ([0-9a-f]{64})$ ]] || return 1
	BOOTSTRAP_AFTER="${BASH_REMATCH[1]}"
	[[ "${lines[4]}" =~ ^backup-sha256\ ([0-9a-f]{64})$ ]] || return 1
	BOOTSTRAP_BACKUP="${BASH_REMATCH[1]}"
}

clear_bootstrap_journal() {
	/usr/bin/rm -f -- "$BOOTSTRAP_JOURNAL" && \
		[[ ! -e "$BOOTSTRAP_JOURNAL" && ! -L "$BOOTSTRAP_JOURNAL" ]] && \
		sync_directory "$TRUST_DIRECTORY"
}

secure_admin_config() {
	local config="$1"
	/usr/bin/python3 - "$config" "$CADDY_ADMIN_CONFIG" <<'PY'
import pathlib
import sys

lines = pathlib.Path(sys.argv[1]).read_text(encoding="utf-8").splitlines()
expected = sys.argv[2]
first = next((index for index, line in enumerate(lines)
              if line.strip() and not line.lstrip().startswith("#")), None)
if first is None or lines[first].strip() != "{":
    raise SystemExit(1)

depth = 0
started = False
ended = False
admin_directives = []
for index in range(first, len(lines)):
    quoted = False
    escaped = False
    visible = []
    for char in lines[index]:
        if escaped:
            escaped = False
            if quoted:
                continue
        if char == "\\" and quoted:
            escaped = True
            continue
        if char == '"':
            quoted = not quoted
            continue
        if char == "#" and not quoted:
            break
        if not quoted:
            visible.append(char)
    if quoted or escaped:
        raise SystemExit(1)
    text = "".join(visible).strip()
    line_depth = depth
    if started and not ended and line_depth == 1 and text and not text.startswith("}"):
        if text.split(maxsplit=1)[0] == "admin":
            admin_directives.append(text)
    for offset, char in enumerate(visible):
        if char == "{":
            depth += 1
            started = True
        elif char == "}":
            depth -= 1
            if depth < 0:
                raise SystemExit(1)
            if started and depth == 0:
                if "".join(visible[offset + 1:]).strip():
                    raise SystemExit(1)
                ended = True
                break
    if ended:
        break

if not ended or admin_directives != [expected]:
    raise SystemExit(1)
PY
}

write_secure_admin_config() {
	local source="$1" destination="$2"
	if secure_admin_config "$source"; then
		/usr/bin/cp -- "$source" "$destination" && secure_admin_config "$destination"
		return
	fi
	/usr/bin/python3 - "$source" "$destination" "$CADDY_ADMIN_CONFIG" <<'PY'
import pathlib
import sys

source = pathlib.Path(sys.argv[1])
destination = pathlib.Path(sys.argv[2])
expected = sys.argv[3]
lines = source.read_text(encoding="utf-8").splitlines(keepends=True)
first = next((index for index, line in enumerate(lines)
              if line.strip() and not line.lstrip().startswith("#")), None)
if first is None or lines[first].strip() != "{":
    raise SystemExit(1)

depth = 0
started = False
ended = False
admin_directives = []
for index in range(first, len(lines)):
    quoted = False
    escaped = False
    visible = []
    for char in lines[index].rstrip("\r\n"):
        if escaped:
            escaped = False
            if quoted:
                continue
        if char == "\\" and quoted:
            escaped = True
            continue
        if char == '"':
            quoted = not quoted
            continue
        if char == "#" and not quoted:
            break
        if not quoted:
            visible.append(char)
    if quoted or escaped:
        raise SystemExit(1)
    text = "".join(visible).strip()
    line_depth = depth
    if started and not ended and line_depth == 1 and text and not text.startswith("}"):
        if text.split(maxsplit=1)[0] == "admin":
            admin_directives.append(text)
    for offset, char in enumerate(visible):
        if char == "{":
            depth += 1
            started = True
        elif char == "}":
            depth -= 1
            if depth < 0:
                raise SystemExit(1)
            if started and depth == 0:
                if "".join(visible[offset + 1:]).strip():
                    raise SystemExit(1)
                ended = True
                break
    if ended:
        break

if not ended or admin_directives:
    raise SystemExit(1)
newline = "\r\n" if lines[first].endswith("\r\n") else "\n"
lines.insert(first + 1, f"\t{expected}{newline}")
destination.write_text("".join(lines), encoding="utf-8", newline="")
PY
	secure_admin_config "$destination"
}

default_admin_is_closed() {
	local endpoint
	for endpoint in 'http://127.0.0.1:2019/' 'http://[::1]:2019/'; do
		if clean_curl --noproxy '*' --silent --show-error --max-time 1 --output /dev/null "$endpoint" \
			>/dev/null 2>&1; then
			return 1
		fi
	done
}

clean_curl() {
	/usr/bin/env -i PATH='/usr/bin:/bin' HOME='/nonexistent' LC_ALL='C' LANG='C' \
		/usr/bin/curl -q "$@"
}

verify_admin_boundary() {
	local caddy_uid caddy_gid identity uid gate_uid deploy_uid runtime_uid
	caddy_uid="$(/usr/bin/id -u caddy 2>/dev/null)" || return 1
	caddy_gid="$(/usr/bin/id -g caddy 2>/dev/null)" || return 1
	[[ "$caddy_uid" =~ ^[1-9][0-9]*$ && "$caddy_gid" =~ ^[0-9]+$ ]] || return 1
	metadata_matches "$CADDY_ADMIN_DIRECTORY" directory "$caddy_uid:$caddy_gid:750" || return 1
	metadata_matches "$CADDY_ADMIN_SOCKET" socket "$caddy_uid:$caddy_gid:600" || return 1
	secure_admin_config "$CADDY_TARGET" || return 1

	for identity in yonaris-gate yonaris-deploy yonaris-runtime; do
		uid="$(/usr/bin/id -u "$identity" 2>/dev/null)" || return 1
		[[ "$uid" =~ ^[1-9][0-9]*$ && "$uid" != "$caddy_uid" ]] || return 1
		case "$identity" in
			yonaris-gate) gate_uid="$uid" ;;
			yonaris-deploy) deploy_uid="$uid" ;;
			yonaris-runtime) runtime_uid="$uid" ;;
		esac
	done
	[[ "$gate_uid" != "$deploy_uid" && "$gate_uid" != "$runtime_uid" && "$deploy_uid" != "$runtime_uid" ]] || return 1
	clean_curl --noproxy '*' --fail --silent --show-error --max-time 2 \
		--unix-socket "$CADDY_ADMIN_SOCKET" --output /dev/null http://127.0.0.1/config/ || return 1
	for identity in yonaris-gate yonaris-deploy yonaris-runtime; do
		if /usr/sbin/runuser --user "$identity" -- \
			/usr/bin/env -i PATH='/usr/bin:/bin' HOME='/nonexistent' LC_ALL='C' LANG='C' \
				/usr/bin/curl -q --noproxy '*' --fail --silent --show-error --max-time 2 \
				--unix-socket "$CADDY_ADMIN_SOCKET" --output /dev/null http://127.0.0.1/config/ \
				>/dev/null 2>&1; then
			return 1
		fi
	done
	default_admin_is_closed
}

health_verify() {
	clean_curl --noproxy '*' --fail --silent --show-error --max-time 15 \
			--cacert "$ORIGIN_HEALTH_CA" \
			--resolve portal.yonaris.com:443:127.0.0.1 https://portal.yonaris.com/ >/dev/null && \
		clean_curl --noproxy '*' --fail --silent --show-error --max-time 15 \
			--cacert "$ORIGIN_HEALTH_CA" \
			--resolve yonaris.com:443:127.0.0.1 https://yonaris.com/ >/dev/null
}

reload_and_verify() {
	verify_origin_health_ca && verify_admin_boundary && \
		/usr/bin/caddy validate --config "$CADDY_TARGET" --adapter caddyfile >/dev/null && \
		/usr/bin/caddy reload --address "$CADDY_ADMIN_ADDRESS" --config "$CADDY_TARGET" --adapter caddyfile --force && \
		verify_admin_boundary && health_verify
}

restart_bootstrap_and_verify() {
	verify_origin_health_ca && secure_admin_config "$CADDY_TARGET" && \
		/usr/bin/caddy validate --config "$CADDY_TARGET" --adapter caddyfile >/dev/null && \
		/usr/bin/systemctl restart caddy.service && \
		/usr/bin/systemctl is-active --quiet caddy.service && \
		verify_admin_boundary && health_verify
}

stop_bootstrap_fail_closed() {
	/usr/bin/systemctl stop caddy.service && \
		! /usr/bin/systemctl is-active --quiet caddy.service && \
		default_admin_is_closed
}

restore_bootstrap_predecessor() {
	local secured_predecessor="$1" expected="$2" current
	metadata_matches "$secured_predecessor" file '0:0:600' || return 1
	[[ "$(sha_file "$secured_predecessor")" == "$expected" ]] || return 1
	secure_admin_config "$secured_predecessor" || return 1
	current="$(sha_file "$CADDY_TARGET")" || return 1
	if [[ "$current" != "$expected" ]]; then
		atomic_copy "$secured_predecessor" "$CADDY_TARGET" 0644 || return 1
	fi
	[[ "$(sha_file "$CADDY_TARGET")" == "$expected" ]] && restart_bootstrap_and_verify
}

restore_bound_backup() {
	local backup="$1" expected="$2" current
	metadata_matches "$backup" file '0:0:600' || return 1
	[[ "$(sha_file "$backup")" == "$expected" ]] || return 1
	secure_admin_config "$backup" || return 1
	current="$(sha_file "$CADDY_TARGET")" || return 1
	if [[ "$current" != "$expected" ]]; then
		atomic_copy "$backup" "$CADDY_TARGET" 0644 || return 1
	fi
	[[ "$(sha_file "$CADDY_TARGET")" == "$expected" ]] && reload_and_verify
}

verify_root_surface() {
	metadata_matches "$TRUST_DIRECTORY" directory '0:0:755' && \
		metadata_matches "$CADDY_DIRECTORY" directory '0:0:755' && \
		metadata_matches "$CADDY_TARGET" file '0:0:644' && \
		metadata_matches "$CADDY_BACKUP_ROOT" directory '0:0:700'
}

verify_origin_health_ca() {
	metadata_matches "$ORIGIN_HEALTH_CA" file '0:0:444' && \
		[[ "$(sha_file "$ORIGIN_HEALTH_CA")" == "$ORIGIN_HEALTH_CA_SHA256" ]]
}

[[ "$(/usr/bin/id -u)" == 0 ]] || fail 'The stable LAS Caddy manager must run as root.'
if [[ -n "${LAS_STABLE_BUNDLE_DIR:-}" ]]; then
	[[ "$LAS_STABLE_BUNDLE_DIR" =~ ^/usr/local/libexec/yonaris-las/bundles/sha256-[0-9a-f]{64}$ ]] || \
		fail 'The active LAS bundle pin is invalid.'
fi
if [[ $# -eq 1 && "$1" == verify-boundary ]]; then
	verify_root_surface || fail 'The root-owned Caddy surface is invalid.'
	verify_origin_health_ca || fail 'The root-owned origin health CA is invalid.'
	verify_admin_boundary || fail 'The Caddy admin API is not confined to its permissioned Unix socket.'
	exit 0
fi
[[ $# -eq 3 ]] || fail 'Refusing invalid LAS Caddy-manager request.' 2
operation="$1"; candidate="$2"; predecessor="$3"
release_is_valid "$candidate" && release_is_valid "$predecessor" || exit 2
verify_root_surface || fail 'The root-owned Caddy surface is invalid.'
candidate_fragment="$(release_fragment "$candidate")" || fail 'Candidate Caddy fragment is not from the immutable release tree.'
predecessor_fragment="$(release_fragment "$predecessor")" || fail 'Predecessor Caddy fragment is not from the immutable release tree.'
candidate_fragment_sha="$(sha_file "$candidate_fragment")"
predecessor_fragment_sha="$(sha_file "$predecessor_fragment")"
backup="$CADDY_BACKUP_ROOT/$candidate.$predecessor.previous"

if [[ "$operation" != bootstrap-activate ]]; then
	verify_origin_health_ca || fail 'The root-owned origin health CA is invalid.'
	verify_admin_boundary || fail 'The Caddy admin API is not confined to its permissioned Unix socket.'
fi

case "$operation" in
	bootstrap-activate)
		[[ "$candidate" == "$predecessor" ]] || fail 'Canonical Caddy bootstrap requires one exact release.' 2
		[[ -z "${SUDO_USER:-}" ]] || fail 'Canonical Caddy bootstrap is root-local and rejects sudo-originated calls.'
		[[ ! -e "$MARKETING_RELEASE" && ! -L "$MARKETING_RELEASE" ]] || \
			fail 'Canonical marketing release state already exists; bootstrap cannot replace it.'
		[[ ! -e "$TRANSITION_JOURNAL" && ! -L "$TRANSITION_JOURNAL" ]] || \
			fail 'Canonical Caddy bootstrap is forbidden during a release transition.'
		ensure_origin_health_ca "$candidate" || fail 'Could not install the reviewed origin health CA.'
		ensure_admin_directory || fail 'Could not establish the Caddy-owned admin-socket directory.'
		backup="$CADDY_BACKUP_ROOT/bootstrap.$candidate.previous"
		candidate_file="$(/usr/bin/mktemp "$CADDY_DIRECTORY/.las-caddy-bootstrap.XXXXXX")"
		secured_predecessor_file="$(/usr/bin/mktemp "$CADDY_DIRECTORY/.las-caddy-bootstrap-predecessor.XXXXXX")"
		trap '/usr/bin/rm -f -- "$candidate_file" "$secured_predecessor_file"' EXIT
		build_candidate "$candidate_fragment" "$candidate_file" || fail 'Could not build the exact bootstrap Caddyfile.'
		/usr/bin/caddy validate --config "$candidate_file" --adapter caddyfile >/dev/null || \
			fail 'Bootstrap Caddyfile validation failed.'
		after_sha="$(sha_file "$candidate_file")"; current_sha="$(sha_file "$CADDY_TARGET")"
		bootstrap_pending=no
		if [[ -e "$BOOTSTRAP_JOURNAL" || -L "$BOOTSTRAP_JOURNAL" ]]; then
			bootstrap_pending=yes
			read_bootstrap_journal || fail 'The durable Caddy bootstrap journal is malformed.' 75
			[[ "$BOOTSTRAP_CANDIDATE" == "$candidate" && "$BOOTSTRAP_AFTER" == "$after_sha" ]] || \
				fail 'The Caddy bootstrap retry conflicts with durable evidence.' 75
			before_sha="$BOOTSTRAP_BEFORE"; backup_sha="$BOOTSTRAP_BACKUP"
			metadata_matches "$backup" file '0:0:600' && [[ "$(sha_file "$backup")" == "$backup_sha" ]] || \
				fail 'The Caddy bootstrap predecessor backup is invalid.' 75
		else
			if [[ "$(apex_sha "$CADDY_TARGET")" == "$candidate_fragment_sha" ]] && \
				secure_admin_config "$CADDY_TARGET"; then
				verify_admin_boundary && health_verify || fail 'Already-live bootstrap Caddy state failed verification.'
				exit 0
			fi
			if [[ -e "$backup" || -L "$backup" ]]; then
				metadata_matches "$backup" file '0:0:600' || \
					fail 'Existing Caddy bootstrap backup is not exact root-owned state.'
			else
				atomic_copy "$CADDY_TARGET" "$backup" 0600 || fail 'Could not durably back up bootstrap Caddy state.'
			fi
			backup_sha="$(sha_file "$backup")"
		fi
		write_secure_admin_config "$backup" "$secured_predecessor_file" || \
			fail 'Could not derive the secured bootstrap predecessor.' 75
		/usr/bin/chown 0:0 -- "$secured_predecessor_file" && \
			/usr/bin/chmod 0600 -- "$secured_predecessor_file" || \
			fail 'Could not finalize the secured bootstrap predecessor.' 75
		/usr/bin/caddy validate --config "$secured_predecessor_file" --adapter caddyfile >/dev/null || \
			fail 'The secured bootstrap predecessor is not a valid Caddyfile.' 75
		secured_predecessor_sha="$(sha_file "$secured_predecessor_file")"
		if [[ "$bootstrap_pending" == yes ]]; then
			[[ "$secured_predecessor_sha" == "$before_sha" ]] || \
				fail 'The secured bootstrap predecessor conflicts with durable evidence.' 75
		else
			before_sha="$secured_predecessor_sha"
			[[ "$current_sha" == "$backup_sha" || "$current_sha" == "$before_sha" ]] || \
				fail 'Existing Caddy bootstrap backup conflicts with live predecessor bytes.'
			if [[ "$current_sha" == "$backup_sha" ]] && \
				! atomic_copy "$secured_predecessor_file" "$CADDY_TARGET" 0644; then
				fail 'Could not atomically secure the bootstrap predecessor.' 75
			fi
			if ! restart_bootstrap_and_verify || [[ "$(sha_file "$CADDY_TARGET")" != "$before_sha" ]]; then
				if restore_bootstrap_predecessor "$secured_predecessor_file" "$before_sha"; then exit 1; fi
				stop_bootstrap_fail_closed || \
					fail 'The bootstrap predecessor could not be secured or stopped.' 75
				fail 'Caddy was stopped after the secured bootstrap predecessor could not be verified.' 75
			fi
			atomic_text "$BOOTSTRAP_JOURNAL" 0600 \
				"las-caddy-bootstrap-v1"$'\n'"candidate $candidate"$'\n'"before-sha256 $before_sha"$'\n'\
"after-sha256 $after_sha"$'\n'"backup-sha256 $backup_sha"$'\n' || \
				fail 'Could not durably persist Caddy bootstrap evidence.'
		fi
		current_sha="$(sha_file "$CADDY_TARGET")"
		[[ "$current_sha" == "$before_sha" || "$current_sha" == "$after_sha" ]] || \
			fail 'Live Caddy bytes diverged from all bound bootstrap states.' 75
		if [[ "$current_sha" == "$before_sha" ]]; then
			verify_admin_boundary && health_verify || \
				fail 'The secured bootstrap predecessor is not live at the admin and health boundaries.' 75
		fi
		if [[ "$current_sha" != "$after_sha" ]] && ! atomic_copy "$candidate_file" "$CADDY_TARGET" 0644; then
			[[ "$(sha_file "$CADDY_TARGET")" == "$before_sha" ]] && \
				verify_admin_boundary && health_verify || \
				fail 'Candidate installation failed and the secured predecessor could not be reverified.' 75
			fail 'Could not atomically install bootstrap Caddy state; recovery remains pending.' 75
		fi
		if ! restart_bootstrap_and_verify || [[ "$(sha_file "$CADDY_TARGET")" != "$after_sha" ]]; then
			if restore_bootstrap_predecessor "$secured_predecessor_file" "$before_sha" && \
				clear_bootstrap_journal; then exit 1; fi
			fail 'Bootstrap Caddy activation and rollback did not converge.' 75
		fi
		clear_bootstrap_journal || fail 'Bootstrap Caddy is live but its journal could not be cleared.' 75
		;;
	preflight | prepare)
		if [[ "$operation" == prepare ]]; then
			[[ "$(journal_field surface)" == marketing && \
				"$(journal_field candidate)" == "$candidate" && \
				"$(journal_field predecessor)" == "$predecessor" ]] || \
				fail 'Caddy operation does not match the pending marketing transition.'
		fi
		live_apex_sha="$(apex_sha "$CADDY_TARGET")" || fail 'Live Caddyfile lacks one exact apex block.'
		[[ "$live_apex_sha" == "$predecessor_fragment_sha" || "$live_apex_sha" == "$candidate_fragment_sha" ]] || \
			fail 'Live Caddy apex is neither the bound predecessor nor candidate.'
		candidate_file="$(/usr/bin/mktemp "$CADDY_DIRECTORY/.las-caddy-candidate.XXXXXX")"
		trap '/usr/bin/rm -f -- "$candidate_file"' EXIT
		build_candidate "$candidate_fragment" "$candidate_file" || fail 'Could not build the exact candidate Caddyfile.'
		/usr/bin/caddy validate --config "$candidate_file" --adapter caddyfile >/dev/null || \
			fail 'Candidate Caddyfile validation failed.'
		[[ "$operation" == preflight ]] && exit 0
		after_sha="$(sha_file "$candidate_file")"
		existing_before="$(journal_field caddy-before-sha256)"
		existing_after="$(journal_field caddy-after-sha256)"
		existing_backup="$(journal_field caddy-backup-sha256)"
		if [[ "$existing_before" != none || "$existing_after" != none || "$existing_backup" != none ]]; then
			[[ "$existing_before" =~ ^[0-9a-f]{64}$ && "$existing_after" == "$after_sha" && \
				"$existing_backup" == "$existing_before" ]] || fail 'Existing Caddy preparation evidence conflicts with this retry.'
			metadata_matches "$backup" file '0:0:600' && [[ "$(sha_file "$backup")" == "$existing_before" ]] || \
				fail 'Existing Caddy retry backup is invalid.'
			current_sha="$(sha_file "$CADDY_TARGET")"
			[[ "$current_sha" == "$existing_before" || "$current_sha" == "$existing_after" ]] || \
				fail 'Live Caddyfile diverged during an idempotent preparation retry.'
			state_manager record-caddy "$candidate" "$existing_before" "$existing_after" "$existing_backup"
			exit 0
		fi
		[[ "$live_apex_sha" == "$predecessor_fragment_sha" ]] || \
			fail 'A fresh Caddy preparation must start from the bound predecessor apex.'
		before_sha="$(sha_file "$CADDY_TARGET")"
		if [[ -e "$backup" || -L "$backup" ]]; then
			metadata_matches "$backup" file '0:0:600' && [[ "$(sha_file "$backup")" == "$before_sha" ]] || \
				fail 'Existing Caddy transition backup conflicts with the live predecessor.'
		else
			atomic_copy "$CADDY_TARGET" "$backup" 0600 || fail 'Could not durably back up the predecessor Caddyfile.'
		fi
		state_manager record-caddy "$candidate" "$before_sha" "$after_sha" "$before_sha" || \
			fail 'Could not durably bind Caddy transition evidence.'
		;;
	activate)
		[[ "$(journal_field surface)" == marketing && \
			"$(journal_field candidate)" == "$candidate" && \
			"$(journal_field predecessor)" == "$predecessor" ]] || \
			fail 'Caddy activation does not match the pending marketing transition.'
		before_sha="$(journal_field caddy-before-sha256)"; after_sha="$(journal_field caddy-after-sha256)"
		[[ "$before_sha" =~ ^[0-9a-f]{64}$ && "$after_sha" =~ ^[0-9a-f]{64}$ ]] || \
			fail 'Caddy activation evidence is incomplete.'
		candidate_file="$(/usr/bin/mktemp "$CADDY_DIRECTORY/.las-caddy-candidate.XXXXXX")"
		trap '/usr/bin/rm -f -- "$candidate_file"' EXIT
		build_candidate "$candidate_fragment" "$candidate_file" || fail 'Could not rebuild the exact candidate Caddyfile.'
		[[ "$(sha_file "$candidate_file")" == "$after_sha" ]] || fail 'Candidate Caddyfile changed after durable preparation.'
		/usr/bin/caddy validate --config "$candidate_file" --adapter caddyfile >/dev/null || fail 'Prepared Caddyfile validation failed.'
		current_sha="$(sha_file "$CADDY_TARGET")"
		[[ "$current_sha" == "$before_sha" || "$current_sha" == "$after_sha" ]] || \
			fail 'Live Caddyfile diverged before activation.'
		if [[ "$current_sha" == "$before_sha" ]] && ! atomic_copy "$candidate_file" "$CADDY_TARGET" 0644; then
			fail 'Could not atomically install the prepared Caddyfile; transition remains pending.' 75
		fi
		if ! reload_and_verify; then
			if restore_bound_backup "$backup" "$before_sha"; then exit 1; fi
			fail 'Caddy cutover and bound rollback both failed; transition remains pending.' 75
		fi
		[[ "$(sha_file "$CADDY_TARGET")" == "$after_sha" ]] || \
			fail 'Caddy post-verification hash mismatch; transition remains pending.' 75
		;;
	rollback)
		[[ "$(journal_field surface)" == marketing && \
			"$(journal_field candidate)" == "$candidate" && \
			"$(journal_field predecessor)" == "$predecessor" ]] || \
			fail 'Caddy rollback does not match the pending transition.'
		before_sha="$(journal_field caddy-before-sha256)"; after_sha="$(journal_field caddy-after-sha256)"
		[[ "$before_sha" =~ ^[0-9a-f]{64}$ && "$after_sha" =~ ^[0-9a-f]{64}$ ]] || \
			fail 'Caddy rollback evidence is incomplete.'
		current_sha="$(sha_file "$CADDY_TARGET")"
		[[ "$current_sha" == "$before_sha" || "$current_sha" == "$after_sha" ]] || \
			fail 'Live Caddyfile diverged from both transition states.'
		restore_bound_backup "$backup" "$before_sha" || \
			fail 'Could not restore and verify the bound predecessor Caddyfile.' 75
		;;
	verify-active)
		[[ "$(apex_sha "$CADDY_TARGET")" == "$candidate_fragment_sha" ]] || \
			fail 'Active Caddy apex does not match the immutable release fragment.'
		reload_and_verify
		;;
	*) fail 'Refusing unknown LAS Caddy-manager operation.' 2 ;;
esac
