#!/usr/bin/env bash

set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

required_files=(
	"$SCRIPT_DIR/README.md"
	"$SCRIPT_DIR/install-host.sh"
	"$SCRIPT_DIR/bin/apply-browser-egress.sh"
	"$SCRIPT_DIR/bin/browser-egress-negative-probes.sh"
	"$SCRIPT_DIR/bin/clear-browser-egress.sh"
	"$SCRIPT_DIR/bin/verify-host.sh"
	"$SCRIPT_DIR/bin/yonaris-browser-peercred"
	"$SCRIPT_DIR/config/browser.env.example"
	"$SCRIPT_DIR/config/control.env.example"
	"$SCRIPT_DIR/config/network.env.example"
	"$SCRIPT_DIR/config/approved-browser-domains"
	"$SCRIPT_DIR/config/control-plane-hosts"
	"$SCRIPT_DIR/apparmor/yonaris-browser-chromium.in"
	"$SCRIPT_DIR/systemd/yonaris-browser-network.service"
	"$SCRIPT_DIR/systemd/yonaris-browser-egress-proxy.service.in"
	"$SCRIPT_DIR/systemd/yonaris-browser-broker.service.in"
	"$SCRIPT_DIR/systemd/yonaris-browser-runner.service.in"
)

for required_file in "${required_files[@]}"; do
	if [[ ! -f "$required_file" ]]; then
		echo "Missing host asset: $required_file" >&2
		exit 1
	fi
done

all_assets="$(find "$SCRIPT_DIR" -type f ! -name 'host-assets.test.sh' ! -name '*.pyc' -print0 | xargs -0 cat)"
for forbidden in \
	'--no-sandbox' \
	'--disable-setuid-sandbox' \
	'kernel.unprivileged_userns_clone=0' \
	'kernel.apparmor_restrict_unprivileged_userns=0' \
	'Restart=always' \
	'Restart=on-failure'; do
	if grep -Fq -- "$forbidden" <<<"$all_assets"; then
		echo "Forbidden host configuration found: $forbidden" >&2
		exit 1
	fi
done

if find "$SCRIPT_DIR/systemd" -type f \( -name '*.timer' -o -name '*cron*' \) -print -quit | grep -q .; then
	echo "Browser runner host assets must not contain timers or cron entries." >&2
	exit 1
fi

broker_unit="$SCRIPT_DIR/systemd/yonaris-browser-broker.service.in"
control_unit="$SCRIPT_DIR/systemd/yonaris-browser-runner.service.in"
network_unit="$SCRIPT_DIR/systemd/yonaris-browser-network.service"
proxy_unit="$SCRIPT_DIR/systemd/yonaris-browser-egress-proxy.service.in"

grep -Fqx 'User=yonaris-browser' "$broker_unit"
grep -Fqx 'Group=yonaris-browser-rpc' "$broker_unit"
grep -Fq '@@NODE_EXECUTABLE@@ @@TSX_EXECUTABLE@@ @@SOURCE_DIRECTORY@@/apps/browser-runner/src/broker-cli.ts -- serve' "$broker_unit"
grep -Fqx 'Restart=no' "$broker_unit"
grep -Fqx 'Requires=yonaris-browser-network.service' "$broker_unit"
grep -Fqx 'UnsetEnvironment=BROWSER_RUNNER_API_TOKEN DATABASE_URL ADMIN_API_KEYS BETTER_AUTH_SECRET ELMO_ENCRYPTION_KEY' "$broker_unit"

grep -Fqx 'User=yonaris-runner' "$control_unit"
grep -Fqx 'SupplementaryGroups=yonaris-browser-rpc' "$control_unit"
grep -Fq '@@NODE_EXECUTABLE@@ @@TSX_EXECUTABLE@@ @@SOURCE_DIRECTORY@@/apps/browser-runner/src/cli.ts -- poll --live --surface doubao' "$control_unit"
grep -Fqx 'Restart=no' "$control_unit"
grep -Fqx 'UnsetEnvironment=DATABASE_URL ADMIN_API_KEYS BETTER_AUTH_SECRET ELMO_ENCRYPTION_KEY' "$control_unit"

grep -Fqx 'Type=oneshot' "$network_unit"
grep -Fqx 'Requires=yonaris-browser-egress-proxy.service' "$network_unit"
grep -Fqx 'After=network-online.target ufw.service yonaris-browser-egress-proxy.service' "$network_unit"
grep -Fqx 'RemainAfterExit=yes' "$network_unit"
grep -Fqx 'RuntimeDirectory=yonaris-browser-runner' "$network_unit"
grep -Fqx 'ExecStartPost=/usr/local/sbin/yonaris-browser-egress-negative-probes' "$network_unit"
grep -Fqx 'ExecStop=/usr/local/sbin/yonaris-clear-browser-egress' "$network_unit"
grep -Fqx 'ExecStopPost=/usr/local/sbin/yonaris-clear-browser-egress' "$network_unit"
grep -Fqx 'EnvironmentFile=/etc/yonaris-browser-runner/network.env' "$broker_unit"
grep -Fqx 'User=yonaris-browser-proxy' "$proxy_unit"
grep -Fqx 'Group=yonaris-browser-proxy' "$proxy_unit"
grep -Fq 'egress-proxy-cli.ts' "$proxy_unit"
grep -Fqx 'PartOf=yonaris-browser-network.service' "$proxy_unit"
grep -Fqx 'Restart=no' "$proxy_unit"
if grep -Eq '^WantedBy=|^RequiredBy=' "$broker_unit" "$control_unit" "$network_unit" "$proxy_unit"; then
	echo "Browser runner units must remain static and manually started." >&2
	exit 1
fi

browser_env="$SCRIPT_DIR/config/browser.env.example"
control_env="$SCRIPT_DIR/config/control.env.example"
network_env="$SCRIPT_DIR/config/network.env.example"
grep -Fqx 'BROWSER_RUNNER_DOUBAO_ADAPTER_VERIFIED=false' "$browser_env"
grep -Fqx 'BROWSER_EGRESS_PROXY_URL=http://127.0.0.1:17777' "$browser_env"
if grep -Eq 'BROWSER_RUNNER_API_TOKEN|DATABASE_URL|ADMIN_API_KEYS|BETTER_AUTH_SECRET|ELMO_ENCRYPTION_KEY' "$browser_env"; then
	echo "Browser environment template contains a control-plane secret name." >&2
	exit 1
fi
grep -Fqx 'BROWSER_RUNNER_LIVE_ENABLED=false' "$control_env"
grep -Fqx 'BROWSER_NETWORK_POLICY_ENABLED=false' "$network_env"
grep -Fqx 'BROWSER_EGRESS_PROXY_URL=http://127.0.0.1:17777' "$network_env"
grep -Fq 'BROWSER_EGRESS_PROXY_UID=@@PROXY_UID@@' "$network_env"
grep -Fqx 'BROWSER_NETWORK_PROOF_TTL_SECONDS=1800' "$network_env"
grep -Fqx 'BROWSER_NETWORK_ACTIVE_MARKER=/run/yonaris-browser-runner/network-policy-active.json' "$network_env"
grep -Fqx 'BROWSER_NETWORK_PROBE_RECEIPT=/run/yonaris-browser-runner/network-negative-probes.json' "$network_env"
grep -Fq 'network.env 0644' "$SCRIPT_DIR/install-host.sh"
grep -Fq 'network configuration must be root-owned mode 0644' "$SCRIPT_DIR/bin/verify-host.sh"
if grep -Fq '@@PNPM_EXECUTABLE@@' "$broker_unit" "$control_unit"; then
	echo "Runtime services must not invoke Corepack or a package manager." >&2
	exit 1
fi

apparmor_profile="$SCRIPT_DIR/apparmor/yonaris-browser-chromium.in"
grep -Fqx '  userns,' "$apparmor_profile"
grep -Fq '@@CHROMIUM_EXECUTABLE@@' "$apparmor_profile"
grep -Fq '@@CHROMIUM_HEADLESS_EXECUTABLE@@' "$apparmor_profile"
if grep -Eq '/opt/.+\*|chrome\*|chromium\*' "$apparmor_profile"; then
	echo "AppArmor attachment paths must not use wildcards." >&2
	exit 1
fi

egress_script="$SCRIPT_DIR/bin/apply-browser-egress.sh"
grep -Fq 'nft_set dns_v6 ipv6_addr dns_v6' "$egress_script"
grep -Fq 'echo "  set $set_name { type $address_type; flags interval; }"' "$egress_script"
stub_dns_line="$(grep -nF 'ip daddr 127.0.0.53 meta l4proto { tcp, udp } th dport 53 accept' "$egress_script" | cut -d: -f1)"
loopback_reject_line="$(grep -nF 'ip daddr { 0.0.0.0/8, 10.0.0.0/8' "$egress_script" | cut -d: -f1)"
[[ -n "$stub_dns_line" && -n "$loopback_reject_line" && "$stub_dns_line" -lt "$loopback_reject_line" ]]
for required_rule in \
	'meta skuid $browser_uid' \
	'10.0.0.0/8' \
	'100.64.0.0/10' \
	'127.0.0.0/8' \
	'169.254.0.0/16' \
	'172.16.0.0/12' \
	'192.168.0.0/16' \
	'fd00::/8' \
	'fe80::/10' \
	'@control_plane_v4 reject' \
	'ip daddr 127.0.0.1 tcp dport 17777 accept'; do
	if ! grep -Fq -- "$required_rule" "$egress_script"; then
		echo "Missing browser egress rule: $required_rule" >&2
		exit 1
	fi
done
if grep -Fq '@approved_v4 tcp dport' "$egress_script"; then
	echo "Browser identity must not bypass the exact-host proxy through frozen CDN addresses." >&2
	exit 1
fi
grep -Fq 'network-policy-active.json' "$egress_script"
grep -Fq 'policySha256' "$egress_script"

probe_script="$SCRIPT_DIR/bin/browser-egress-negative-probes.sh"
grep -Fq 'network-negative-probes.json' "$probe_script"
grep -Fq 'negativeProbesPassed' "$probe_script"
grep -Fq 'policySha256' "$probe_script"
grep -Fq -- '--proxy "$BROWSER_EGRESS_PROXY_URL"' "$probe_script"
grep -Fq -- "--noproxy '*'" "$probe_script"
grep -Fq 'chmod 0644 -- "$receipt_candidate"' "$probe_script"

clear_script="$SCRIPT_DIR/bin/clear-browser-egress.sh"
grep -Fq 'nft delete table' "$clear_script"
grep -Fq 'BROWSER_NETWORK_ACTIVE_MARKER' "$clear_script"
grep -Fq 'BROWSER_NETWORK_PROBE_RECEIPT' "$clear_script"

install_script="$SCRIPT_DIR/install-host.sh"
if grep -Eq 'systemctl[[:space:]]+(enable|start|enable[[:space:]]+--now)' "$install_script"; then
	echo "Installer must not enable or start Browser Runner services." >&2
	exit 1
fi
grep -Fq 'kernel.apparmor_restrict_unprivileged_userns' "$install_script"
grep -Fq 'kernel.unprivileged_userns_clone' "$install_script"
grep -Fq 'apparmor_parser -r' "$install_script"
grep -Fq 'yonaris-browser-proxy' "$install_script"
grep -Fq '@@PROXY_UID@@' "$SCRIPT_DIR/config/network.env.example"

if python3 --version >/dev/null 2>&1; then
	python3 -m py_compile "$SCRIPT_DIR/bin/yonaris-browser-peercred"
fi
for script in "$SCRIPT_DIR"/*.sh "$SCRIPT_DIR"/bin/*.sh; do
	bash -n "$script"
done

echo "browser runner host asset tests passed"
