#!/usr/bin/env bash

set -Eeuo pipefail

[[ "$(id -u)" == "0" ]] || {
	echo "browser egress cleanup: root is required" >&2
	exit 1
}

readonly config_file="${BROWSER_NETWORK_CONFIG:-/etc/yonaris-browser-runner/network.env}"
active_marker="/run/yonaris-browser-runner/network-policy-active.json"
probe_receipt="/run/yonaris-browser-runner/network-negative-probes.json"
if [[ -f "$config_file" && ! -L "$config_file" ]]; then
	# shellcheck disable=SC1090
	source "$config_file"
	active_marker="${BROWSER_NETWORK_ACTIVE_MARKER:-$active_marker}"
	probe_receipt="${BROWSER_NETWORK_PROBE_RECEIPT:-$probe_receipt}"
fi
[[ "$active_marker" == "/run/yonaris-browser-runner/network-policy-active.json" ]] || exit 1
[[ "$probe_receipt" == "/run/yonaris-browser-runner/network-negative-probes.json" ]] || exit 1

if nft list table inet yonaris_browser_egress >/dev/null 2>&1; then
	nft delete table inet yonaris_browser_egress
fi
rm -f -- "$active_marker" "$probe_receipt"
