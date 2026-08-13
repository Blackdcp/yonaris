#!/usr/bin/env bash

set -Eeuo pipefail
umask 077

readonly table_family="inet"
readonly table_name="yonaris_browser_egress"
readonly config_file="${BROWSER_NETWORK_CONFIG:-/etc/yonaris-browser-runner/network.env}"

die() {
	echo "browser egress: $*" >&2
	exit 1
}

[[ "$(id -u)" == "0" ]] || die "root is required"
[[ -f "$config_file" && ! -L "$config_file" ]] || die "network configuration is missing or unsafe"
# shellcheck disable=SC1090
source "$config_file"

[[ "${BROWSER_NETWORK_POLICY_ENABLED:-false}" == "true" ]] || die "policy remains disabled"
browser_uid="$(id -u yonaris-browser)"
[[ "$browser_uid" =~ ^[1-9][0-9]*$ ]] || die "browser service UID is invalid"

approved_file="${BROWSER_NETWORK_APPROVED_DOMAINS:-/etc/yonaris-browser-runner/approved-browser-domains}"
control_file="${BROWSER_NETWORK_CONTROL_PLANE_HOSTS:-/etc/yonaris-browser-runner/control-plane-hosts}"
active_marker="${BROWSER_NETWORK_ACTIVE_MARKER:-/run/yonaris-browser-runner/network-policy-active.json}"
probe_receipt="${BROWSER_NETWORK_PROBE_RECEIPT:-/run/yonaris-browser-runner/network-negative-probes.json}"
[[ -f "$approved_file" && ! -L "$approved_file" ]] || die "approved-domain file is missing or unsafe"
[[ -f "$control_file" && ! -L "$control_file" ]] || die "control-plane host file is missing or unsafe"
[[ "$active_marker" == "/run/yonaris-browser-runner/network-policy-active.json" ]] || die "active marker path is not approved"
[[ "$probe_receipt" == "/run/yonaris-browser-runner/network-negative-probes.json" ]] || die "probe receipt path is not approved"
[[ -d "$(dirname -- "$active_marker")" && ! -L "$(dirname -- "$active_marker")" ]] || die "proof runtime directory is unsafe"

if systemctl is-active --quiet yonaris-browser-broker.service ||
	systemctl is-active --quiet yonaris-browser-runner.service; then
	die "stop the runner and broker before replacing their egress policy"
fi

declare -a approved_v4=() approved_v6=() control_plane_v4=() control_plane_v6=()
declare -a dns_v4=() dns_v6=()

normalize_input_file() {
	local source_file="$1"
	awk '{ sub(/#.*/, ""); gsub(/^[[:space:]]+|[[:space:]]+$/, ""); if (length) print }' "$source_file"
}

resolve_entry() {
	local entry="$1"
	local -n output_v4="$2"
	local -n output_v6="$3"
	[[ "$entry" =~ ^[A-Za-z0-9.-]+$ || "$entry" =~ ^[0-9A-Fa-f:]+$ ]] || die "invalid host entry: $entry"
	local resolved
	resolved="$(python3 - "$entry" <<'PY'
import ipaddress
import socket
import sys

value = sys.argv[1]
try:
    addresses = {str(ipaddress.ip_address(value))}
except ValueError:
    try:
        addresses = {item[4][0] for item in socket.getaddrinfo(value, 443, type=socket.SOCK_STREAM)}
    except socket.gaierror as error:
        raise SystemExit(f"cannot resolve {value}: {error}")
for address in sorted(addresses, key=lambda item: (ipaddress.ip_address(item).version, item)):
    parsed = ipaddress.ip_address(address)
    if not parsed.is_global:
        raise SystemExit(f"host {value} resolved to non-global address {parsed}")
    print(parsed)
PY
)" || die "could not safely resolve $entry"
	[[ -n "$resolved" ]] || die "host did not resolve: $entry"
	while IFS= read -r address; do
		if [[ "$address" == *:* ]]; then output_v6+=("$address"); else output_v4+=("$address"); fi
	done <<<"$resolved"
}

while IFS= read -r host; do resolve_entry "$host" approved_v4 approved_v6; done < <(normalize_input_file "$approved_file")
while IFS= read -r host; do resolve_entry "$host" control_plane_v4 control_plane_v6; done < <(normalize_input_file "$control_file")

for address in ${BROWSER_NETWORK_DNS_V4:-}; do
	[[ "$address" =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}$ ]] || die "invalid IPv4 DNS resolver"
	dns_v4+=("$address")
done
for address in ${BROWSER_NETWORK_DNS_V6:-}; do
	[[ "$address" =~ ^[0-9A-Fa-f:]+$ ]] || die "invalid IPv6 DNS resolver"
	dns_v6+=("$address")
done
[[ ${#dns_v4[@]} -gt 0 || ${#dns_v6[@]} -gt 0 ]] || die "at least one public DNS resolver is required"
[[ ${#approved_v4[@]} -gt 0 || ${#approved_v6[@]} -gt 0 ]] || die "the browser allowlist resolved to no addresses"

validate_sets() {
	python3 - "$@" <<'PY'
import ipaddress
import sys

groups = {}
name = None
for item in sys.argv[1:]:
    if item.startswith("@"):
        name = item[1:]
        groups[name] = set()
    elif name:
        address = ipaddress.ip_address(item)
        if not address.is_global:
            raise SystemExit(f"{name} contains non-global address {address}")
        groups[name].add(address)
if groups.get("approved", set()) & groups.get("control", set()):
    raise SystemExit("approved and control-plane address sets overlap")
PY
}

validate_sets @approved "${approved_v4[@]}" "${approved_v6[@]}" @control "${control_plane_v4[@]}" "${control_plane_v6[@]}" @dns "${dns_v4[@]}" "${dns_v6[@]}" || die "resolved network sets are unsafe"

deduplicate() {
	local -n values="$1"
	if [[ ${#values[@]} -gt 0 ]]; then
		mapfile -t values < <(printf '%s\n' "${values[@]}" | LC_ALL=C sort -u)
	fi
}
for array_name in approved_v4 approved_v6 control_plane_v4 control_plane_v6 dns_v4 dns_v6; do deduplicate "$array_name"; done

nft_elements() {
	local -n values="$1"
	local separator=""
	for value in "${values[@]}"; do
		printf '%s%s' "$separator" "$value"
		separator=", "
	done
}

nft_set() {
	local set_name="$1"
	local address_type="$2"
	local -n values="$3"
	if [[ ${#values[@]} -eq 0 ]]; then
		echo "  set $set_name { type $address_type; flags interval; }"
		return
	fi
	echo "  set $set_name { type $address_type; flags interval; elements = { $(nft_elements "$3") } }"
}

policy_file="$(mktemp /run/yonaris-browser-egress.XXXXXX.nft)"
marker_candidate=''
cleanup_candidates() {
	rm -f -- "$policy_file"
	if [[ -n "$marker_candidate" ]]; then rm -f -- "$marker_candidate"; fi
}
trap cleanup_candidates EXIT
{
	echo "table $table_family $table_name {"
	nft_set approved_v4 ipv4_addr approved_v4
	nft_set approved_v6 ipv6_addr approved_v6
	nft_set control_plane_v4 ipv4_addr control_plane_v4
	nft_set control_plane_v6 ipv6_addr control_plane_v6
	nft_set dns_v4 ipv4_addr dns_v4
	nft_set dns_v6 ipv6_addr dns_v6
	cat <<NFT
  chain output {
    type filter hook output priority -150; policy accept;
    meta skuid $browser_uid ip daddr @control_plane_v4 reject
    meta skuid $browser_uid ip6 daddr @control_plane_v6 reject
    meta skuid $browser_uid ip daddr 127.0.0.53 meta l4proto { tcp, udp } th dport 53 accept
    meta skuid $browser_uid ip daddr { 0.0.0.0/8, 10.0.0.0/8, 100.64.0.0/10, 127.0.0.0/8, 169.254.0.0/16, 172.16.0.0/12, 192.0.0.0/24, 192.0.2.0/24, 192.168.0.0/16, 198.18.0.0/15, 198.51.100.0/24, 203.0.113.0/24, 224.0.0.0/4, 240.0.0.0/4 } reject
    meta skuid $browser_uid ip6 daddr { ::/128, ::1/128, ::ffff:0:0/96, 64:ff9b::/96, 100::/64, 2001:db8::/32, fd00::/8, fe80::/10, ff00::/8 } reject
    meta skuid $browser_uid ip daddr @dns_v4 meta l4proto { tcp, udp } th dport 53 accept
    meta skuid $browser_uid ip6 daddr @dns_v6 meta l4proto { tcp, udp } th dport 53 accept
    meta skuid $browser_uid ip daddr @approved_v4 tcp dport { 80, 443 } accept
    meta skuid $browser_uid ip6 daddr @approved_v6 tcp dport { 80, 443 } accept
    meta skuid $browser_uid reject
  }
}
NFT
} >"$policy_file"

nft -c -f "$policy_file"
if nft list table "$table_family" "$table_name" >/dev/null 2>&1; then
	nft delete table "$table_family" "$table_name"
fi
nft -f "$policy_file"
nft list chain "$table_family" "$table_name" output >/dev/null
policy_hash="$(python3 - "$config_file" "$approved_file" "$control_file" <<'PY'
import hashlib
import pathlib
import sys

config, approved, control = (pathlib.Path(value) for value in sys.argv[1:])
digest = hashlib.sha256()
digest.update(b"network.env\0")
digest.update(config.read_bytes())
digest.update(b"\0approved-browser-domains\0")
digest.update(approved.read_bytes())
digest.update(b"\0control-plane-hosts\0")
digest.update(control.read_bytes())
print(digest.hexdigest())
PY
)"
[[ "$policy_hash" =~ ^[0-9a-f]{64}$ ]] || die "policy hash could not be calculated"
verified_at="$(date -u '+%Y-%m-%dT%H:%M:%S.000Z')"
marker_candidate="$(mktemp "$(dirname -- "$active_marker")/.network-policy-active.XXXXXX")"
printf '{"schemaVersion":1,"verifiedAt":"%s","browserUid":%s,"policySha256":"%s","nftChain":"inet yonaris_browser_egress output"}\n' \
	"$verified_at" "$browser_uid" "$policy_hash" >"$marker_candidate"
chmod 0644 -- "$marker_candidate"
chown root:root -- "$marker_candidate"
sync -f -- "$marker_candidate"
mv -f -- "$marker_candidate" "$active_marker"
marker_candidate=''
sync -f -- "$(dirname -- "$active_marker")"
rm -f -- "$probe_receipt"
echo "browser egress policy loaded for UID $browser_uid"
