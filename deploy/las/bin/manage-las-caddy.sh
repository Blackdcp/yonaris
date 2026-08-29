#!/bin/bash

set -Eeuo pipefail
set +x
umask 077
PATH='/usr/bin:/bin'
LC_ALL='C'
LANG='C'
export PATH LC_ALL LANG
readonly PATH LC_ALL LANG
unset CADDY_ADMIN

readonly TRUST_DIRECTORY='/etc/yonaris'
readonly CADDY_DIRECTORY='/etc/caddy'
readonly CADDY_TARGET='/etc/caddy/Caddyfile'
readonly CADDY_ADMIN_DIRECTORY='/run/caddy'
readonly CADDY_ADMIN_SOCKET='/run/caddy/admin.sock'
readonly CADDY_ADMIN_CONFIG='admin unix//run/caddy/admin.sock'
readonly ORIGIN_HEALTH_CA='/etc/yonaris/las-origin-health-ca.pem'
readonly ORIGIN_HEALTH_CA_SHA256='4fd8df5f5818d3979635f7ff7aeb3925cc2a28d17630d6038f190403601dc057'

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

sha_file() { /usr/bin/sha256sum -- "$1" | /usr/bin/awk '{print $1}'; }

clean_curl() {
	/usr/bin/env -i PATH='/usr/bin:/bin' HOME='/nonexistent' LC_ALL='C' LANG='C' \
		/usr/bin/curl -q "$@"
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

if not ended or depth != 0 or admin_directives != [expected]:
    raise SystemExit(1)
PY
}

default_admin_is_closed() {
	local endpoint
	for endpoint in 'http://127.0.0.1:2019/' 'http://[::1]:2019/'; do
		if clean_curl --noproxy '*' --silent --show-error --max-time 1 \
			--output /dev/null "$endpoint" >/dev/null 2>&1; then
			return 1
		fi
	done
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
	[[ "$gate_uid" != "$deploy_uid" && "$gate_uid" != "$runtime_uid" && \
		"$deploy_uid" != "$runtime_uid" ]] || return 1
	clean_curl --noproxy '*' --fail --silent --show-error --max-time 2 \
		--unix-socket "$CADDY_ADMIN_SOCKET" --output /dev/null \
		http://127.0.0.1/config/ || return 1
	for identity in yonaris-gate yonaris-deploy yonaris-runtime; do
		if /usr/sbin/runuser --user "$identity" -- \
			/usr/bin/env -i PATH='/usr/bin:/bin' HOME='/nonexistent' LC_ALL='C' LANG='C' \
				/usr/bin/curl -q --noproxy '*' --fail --silent --show-error --max-time 2 \
				--unix-socket "$CADDY_ADMIN_SOCKET" --output /dev/null \
				http://127.0.0.1/config/ >/dev/null 2>&1; then
			return 1
		fi
	done
	default_admin_is_closed
}

verify_root_surface() {
	metadata_matches "$TRUST_DIRECTORY" directory '0:0:755' && \
		metadata_matches "$CADDY_DIRECTORY" directory '0:0:755' && \
		metadata_matches "$CADDY_TARGET" file '0:0:644'
}

verify_origin_health_ca() {
	metadata_matches "$ORIGIN_HEALTH_CA" file '0:0:444' && \
		[[ "$(sha_file "$ORIGIN_HEALTH_CA")" == "$ORIGIN_HEALTH_CA_SHA256" ]]
}

verify_portal_origin() {
	clean_curl --noproxy '*' --fail --silent --show-error --max-time 15 \
		--cacert "$ORIGIN_HEALTH_CA" \
		--resolve portal.yonaris.com:443:127.0.0.1 \
		https://portal.yonaris.com/ >/dev/null
}

[[ $# -eq 1 && "$1" == verify-boundary ]] || \
	fail 'The LAS Caddy manager accepts only verify-boundary.' 2
[[ "$(/usr/bin/id -u)" == 0 ]] || fail 'The stable LAS Caddy manager must run as root.'
if [[ -n "${LAS_STABLE_BUNDLE_DIR:-}" ]]; then
	[[ "$LAS_STABLE_BUNDLE_DIR" =~ ^/usr/local/libexec/yonaris-las/bundles/sha256-[0-9a-f]{64}$ ]] || \
		fail 'The active LAS bundle pin is invalid.'
fi

verify_root_surface || fail 'The root-owned Caddy surface is invalid.'
verify_origin_health_ca || fail 'The root-owned origin health CA is invalid.'
verify_admin_boundary || fail 'The Caddy admin API is not confined to its permissioned Unix socket.'
/usr/bin/caddy validate --config "$CADDY_TARGET" --adapter caddyfile >/dev/null || \
	fail 'The root-owned Caddy configuration is invalid.'
verify_portal_origin || fail 'The Portal direct-origin health check failed.'
