#!/usr/bin/env bash

set -Eeuo pipefail

die() {
	echo "browser egress probe: $*" >&2
	exit 1
}

[[ "$(id -u)" == "0" ]] || die "root is required"
readonly config_file="${BROWSER_NETWORK_CONFIG:-/etc/yonaris-browser-runner/network.env}"
[[ -f "$config_file" && ! -L "$config_file" ]] || die "network configuration is missing or unsafe"
# shellcheck disable=SC1090
source "$config_file"
[[ "${BROWSER_NETWORK_POLICY_ENABLED:-false}" == "true" ]] || die "policy remains disabled"
[[ "${BROWSER_EGRESS_PROXY_URL:-}" == "http://127.0.0.1:17777" ]] || die "browser proxy URL is invalid"
systemctl is-active --quiet yonaris-browser-egress-proxy.service || die "browser egress proxy is not active"
nft list chain inet yonaris_browser_egress output >/dev/null || die "nft output chain is absent"

browser_uid="$(id -u yonaris-browser)"
active_marker="${BROWSER_NETWORK_ACTIVE_MARKER:-/run/yonaris-browser-runner/network-policy-active.json}"
probe_receipt="${BROWSER_NETWORK_PROBE_RECEIPT:-/run/yonaris-browser-runner/network-negative-probes.json}"
approved_file="${BROWSER_NETWORK_APPROVED_DOMAINS:-/etc/yonaris-browser-runner/approved-browser-domains}"
control_file="${BROWSER_NETWORK_CONTROL_PLANE_HOSTS:-/etc/yonaris-browser-runner/control-plane-hosts}"
[[ "$active_marker" == "/run/yonaris-browser-runner/network-policy-active.json" ]] || die "active marker path is not approved"
[[ "$probe_receipt" == "/run/yonaris-browser-runner/network-negative-probes.json" ]] || die "probe receipt path is not approved"
[[ "$(stat -c %u:%a -- "$active_marker")" == "0:644" ]] || die "network active marker is not root-owned mode 0644"
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
python3 - "$active_marker" "$browser_uid" "$policy_hash" <<'PY'
import json
import pathlib
import sys

path, browser_uid, policy_hash = sys.argv[1:]
proof = json.loads(pathlib.Path(path).read_text(encoding="utf-8"))
expected = {
    "schemaVersion": 1,
    "browserUid": int(browser_uid),
    "policySha256": policy_hash,
    "nftChain": "inet yonaris_browser_egress output",
}
if any(proof.get(key) != value for key, value in expected.items()):
    raise SystemExit("network active marker does not match the loaded policy")
PY

if runuser -u yonaris-browser -- curl --fail --silent --show-error --location --max-time 8 \
	--noproxy '*' --output /dev/null https://www.doubao.com/chat/; then
	die "browser identity bypassed the exact-host egress proxy"
fi
runuser -u yonaris-browser -- curl --fail --silent --show-error --location --max-time 20 \
	--proxy "$BROWSER_EGRESS_PROXY_URL" --output /dev/null https://www.doubao.com/chat/ ||
	die "approved Doubao endpoint is unreachable through the exact-host proxy"

blocked_urls=(
	"http://127.0.0.1:22/"
	"http://10.198.0.107/"
	"http://100.100.100.200/"
	"http://169.254.169.254/"
	"https://portal.yonaris.com/"
)
for url in "${blocked_urls[@]}"; do
	if runuser -u yonaris-browser -- curl --silent --show-error --insecure --max-time 4 \
		--proxy "$BROWSER_EGRESS_PROXY_URL" --output /dev/null "$url"; then
		die "browser identity reached forbidden endpoint $url"
	fi
done

runuser -u yonaris-runner -- curl --silent --show-error --location --max-time 15 \
	--output /dev/null https://portal.yonaris.com/ || die "control identity cannot reach Portal"

verified_at="$(date -u '+%Y-%m-%dT%H:%M:%S.000Z')"
receipt_candidate="$(mktemp "$(dirname -- "$probe_receipt")/.network-negative-probes.XXXXXX")"
cleanup_receipt_candidate() {
	if [[ -n "$receipt_candidate" ]]; then rm -f -- "$receipt_candidate"; fi
}
trap cleanup_receipt_candidate EXIT
printf '{"schemaVersion":1,"verifiedAt":"%s","browserUid":%s,"policySha256":"%s","nftChain":"inet yonaris_browser_egress output","negativeProbesPassed":true}\n' \
	"$verified_at" "$browser_uid" "$policy_hash" >"$receipt_candidate"
chmod 0644 -- "$receipt_candidate"
chown root:root -- "$receipt_candidate"
sync -f -- "$receipt_candidate"
mv -f -- "$receipt_candidate" "$probe_receipt"
receipt_candidate=''
sync -f -- "$(dirname -- "$probe_receipt")"
echo "browser egress negative probes passed"
