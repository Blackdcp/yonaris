#!/usr/bin/env bash

set -Eeuo pipefail

die() {
	echo "browser runner verification: $*" >&2
	exit 1
}

[[ "$(id -u)" == "0" ]] || die "root is required"
readonly config_root="${YONARIS_BROWSER_CONFIG_ROOT:-/etc/yonaris-browser-runner}"
readonly browser_env="$config_root/browser.env"
readonly control_env="$config_root/control.env"
readonly network_env="$config_root/network.env"
for file in "$browser_env" "$control_env"; do
	[[ -f "$file" && ! -L "$file" ]] || die "missing or unsafe configuration: $file"
	[[ "$(stat -c %U:%G -- "$file")" == "root:root" ]] || die "configuration must be root-owned: $file"
	[[ "$(stat -c %a -- "$file")" == "600" ]] || die "configuration must have mode 0600: $file"
done
[[ -f "$network_env" && ! -L "$network_env" ]] || die "missing or unsafe configuration: $network_env"
[[ "$(stat -c %U:%G:%a -- "$network_env")" == "root:root:644" ]] ||
	die "network configuration must be root-owned mode 0644"

if grep -Eq 'BROWSER_RUNNER_API_TOKEN|DATABASE_URL|ADMIN_API_KEYS|BETTER_AUTH_SECRET|CREDENTIAL_ENCRYPTION_KEY' "$browser_env"; then
	die "browser environment contains a control-plane secret name"
fi

set -a
# shellcheck disable=SC1090
source "$browser_env"
set +a
[[ "${BROWSER_BROKER_UID:-}" == "$(id -u yonaris-browser)" ]] || die "browser UID does not match browser.env"
[[ "${BROWSER_BROKER_ALLOWED_CONTROL_UID:-}" == "$(id -u yonaris-runner)" ]] || die "control UID does not match browser.env"
[[ "${BROWSER_BROKER_RPC_GID:-}" == "$(getent group yonaris-browser-rpc | cut -d: -f3)" ]] ||
	die "RPC GID does not match browser.env"
[[ "$BROWSER_BROKER_UID" != "$BROWSER_BROKER_ALLOWED_CONTROL_UID" ]] || die "control and browser identities are not separated"
[[ "${BROWSER_EGRESS_PROXY_URL:-}" == "http://127.0.0.1:17777" ]] || die "browser proxy URL is invalid"
proxy_uid="$(sed -n 's/^BROWSER_EGRESS_PROXY_UID=//p' "$network_env" | tail -n 1)"
[[ "$proxy_uid" == "$(id -u yonaris-browser-proxy)" ]] || die "proxy UID does not match network.env"
[[ "$proxy_uid" != "$BROWSER_BROKER_UID" && "$proxy_uid" != "$BROWSER_BROKER_ALLOWED_CONTROL_UID" ]] ||
	die "proxy identity is not separated"
id -nG yonaris-runner | tr ' ' '\n' | grep -Fxq yonaris-browser-rpc || die "control identity lacks the RPC group"

[[ "$(stat -c %U:%G:%a -- "$BROWSER_BROKER_STATE_DIR")" == "yonaris-browser:yonaris-browser-rpc:700" ]] ||
	die "browser state directory ownership or mode is invalid"
[[ "$(stat -c %U:%G:%a -- "$BROWSER_BROKER_EVIDENCE_DIR")" == "yonaris-browser:yonaris-browser-rpc:750" ]] ||
	die "evidence handoff directory ownership or mode is invalid"
[[ "$(stat -c %U:%G:%a -- "$BROWSER_BROKER_PEERCRED_HELPER")" == "root:root:755" ]] ||
	die "peer-credential helper ownership or mode is invalid"

[[ "$(sysctl -n kernel.apparmor_restrict_unprivileged_userns)" == "1" ]] || die "AppArmor user-namespace restriction is not enabled"
[[ "$(sysctl -n kernel.unprivileged_userns_clone)" == "1" ]] || die "unprivileged user namespaces are unavailable"
aa-status --enabled >/dev/null || die "AppArmor is not enabled"
aa-status | grep -Fq yonaris-browser-chromium || die "Chromium AppArmor attachment is not loaded"
aa-status | grep -Fq yonaris-browser-chromium-headless || die "headless Chromium AppArmor attachment is not loaded"

[[ -d "$PLAYWRIGHT_BROWSERS_PATH" && ! -L "$PLAYWRIGHT_BROWSERS_PATH" ]] || die "pinned browser root is unsafe"
[[ "$(stat -c %U:%G -- "$PLAYWRIGHT_BROWSERS_PATH")" == "root:root" ]] || die "pinned browser root is not root-owned"
if find "$PLAYWRIGHT_BROWSERS_PATH" -xdev \( -type f -o -type d \) \( ! -user root -o -perm /022 \) -print -quit | grep -q .; then
	die "pinned browser root contains a mutable path"
fi
if find "$PLAYWRIGHT_BROWSERS_PATH" -xdev -type f -perm /6000 -print -quit | grep -q .; then
	die "pinned browser root contains a set-ID file"
fi
(cd -- "$PLAYWRIGHT_BROWSERS_PATH" && sha256sum -c --quiet SHA256SUMS) || die "pinned browser digest verification failed"

for unit in yonaris-browser-network.service yonaris-browser-egress-proxy.service yonaris-browser-broker.service yonaris-browser-runner.service; do
	unit_state="$(systemctl is-enabled "$unit" 2>/dev/null || true)"
	[[ "$unit_state" == "static" || "$unit_state" == "disabled" ]] || die "$unit has an unexpected activation state: $unit_state"
done
systemd-analyze verify \
	/etc/systemd/system/yonaris-browser-network.service \
	/etc/systemd/system/yonaris-browser-egress-proxy.service \
	/etc/systemd/system/yonaris-browser-broker.service \
	/etc/systemd/system/yonaris-browser-runner.service

network_enabled="$(sed -n 's/^BROWSER_NETWORK_POLICY_ENABLED=//p' "$network_env" | tail -n 1)"
live_enabled="$(sed -n 's/^BROWSER_RUNNER_LIVE_ENABLED=//p' "$control_env" | tail -n 1)"
adapter_verified="$(sed -n 's/^BROWSER_RUNNER_DOUBAO_ADAPTER_VERIFIED=//p' "$browser_env" | tail -n 1)"
if [[ "$network_enabled" != "true" ]]; then
	! systemctl is-active --quiet yonaris-browser-network.service || die "disabled network policy unit is active"
fi
if [[ "$live_enabled" != "true" ]]; then
	! systemctl is-active --quiet yonaris-browser-runner.service || die "disabled live runner is active"
fi
if [[ "$adapter_verified" != "true" ]]; then
	! systemctl is-active --quiet yonaris-browser-runner.service || die "unverified adapter is executing live work"
fi

echo "browser runner host verification passed (network=$network_enabled live=$live_enabled adapter=$adapter_verified)"
