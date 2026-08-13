#!/usr/bin/env bash

set -Eeuo pipefail
umask 077

readonly script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
source_directory="${YONARIS_SOURCE_DIRECTORY:-/opt/yonaris-browser-runner/source}"
node_bin_directory="${YONARIS_NODE_BIN_DIRECTORY:-/opt/node-v24.19.0-linux-x64/bin}"
playwright_browsers_path="${PLAYWRIGHT_BROWSERS_PATH:-/opt/yonaris-browser-runner/ms-playwright}"
chromium_executable="${YONARIS_CHROMIUM_EXECUTABLE:-$playwright_browsers_path/chromium-1228/chrome-linux64/chrome}"
chromium_headless_executable="${YONARIS_CHROMIUM_HEADLESS_EXECUTABLE:-$playwright_browsers_path/chromium_headless_shell-1228/chrome-headless-shell-linux64/chrome-headless-shell}"

die() {
	echo "browser runner installer: $*" >&2
	exit 1
}

[[ "$(id -u)" == "0" ]] || die "root is required"
for command in apparmor_parser getent groupadd id install nft python3 readlink sha256sum stat sysctl systemctl systemd-analyze useradd usermod; do
	command -v "$command" >/dev/null || die "required command is missing: $command"
done

canonical_path() {
	local input="$1"
	[[ "$input" == /* && "$input" != *$'\n'* && "$input" != *$'\r'* && "$input" != *$'\t'* && "$input" != *' '* ]] ||
		die "deployment paths must be absolute and contain no whitespace"
	readlink -f -- "$input"
}

source_directory="$(canonical_path "$source_directory")"
node_bin_directory="$(canonical_path "$node_bin_directory")"
playwright_browsers_path="$(canonical_path "$playwright_browsers_path")"
chromium_executable="$(canonical_path "$chromium_executable")"
chromium_headless_executable="$(canonical_path "$chromium_headless_executable")"
node_executable="$(canonical_path "$node_bin_directory/node")"
tsx_executable="$(canonical_path "$source_directory/apps/browser-runner/node_modules/tsx/dist/cli.mjs")"

[[ -f "$source_directory/apps/browser-runner/package.json" ]] || die "Browser Runner source tree is incomplete"
[[ -x "$node_executable" ]] || die "pinned Node executable is missing"
[[ -f "$tsx_executable" && "$tsx_executable" == "$source_directory/"* ]] || die "pinned tsx entry point is missing or escaped the source tree"
[[ -x "$chromium_executable" && -x "$chromium_headless_executable" ]] || die "pinned Chromium executables are missing"
[[ "$chromium_executable" == "$playwright_browsers_path/"* ]] || die "Chromium escaped the pinned browser root"
[[ "$chromium_headless_executable" == "$playwright_browsers_path/"* ]] || die "headless Chromium escaped the pinned browser root"

assert_root_owned_tree() {
	local root="$1"
	[[ "$(stat -c %U -- "$root")" == "root" ]] || die "$root must be root-owned"
	if find "$root" -xdev \( -type f -o -type d \) \( ! -user root -o -perm /022 \) -print -quit | grep -q .; then
		die "$root contains a non-root-owned or group/world-writable path"
	fi
}

assert_root_owned_tree "$playwright_browsers_path"
assert_root_owned_tree "$source_directory"
if find "$playwright_browsers_path" -xdev -type f -perm /6000 -print -quit | grep -q .; then
	die "pinned browser tree contains a set-ID executable"
fi
[[ -f "$playwright_browsers_path/SHA256SUMS" && ! -L "$playwright_browsers_path/SHA256SUMS" ]] ||
	die "root-owned browser digest manifest is missing"
[[ "$(stat -c %U:%G -- "$playwright_browsers_path/SHA256SUMS")" == "root:root" ]] ||
	die "browser digest manifest ownership is invalid"
(cd -- "$playwright_browsers_path" && sha256sum -c --quiet SHA256SUMS) || die "pinned browser digest verification failed"

getent group yonaris-browser-rpc >/dev/null || groupadd --system yonaris-browser-rpc
getent group yonaris-runner >/dev/null || groupadd --system yonaris-runner
if ! id yonaris-runner >/dev/null 2>&1; then
	useradd --system --gid yonaris-runner --home-dir /var/lib/yonaris-browser-runner --create-home --shell /usr/sbin/nologin yonaris-runner
fi
if ! id yonaris-browser >/dev/null 2>&1; then
	useradd --system --gid yonaris-browser-rpc --home-dir /var/lib/yonaris-browser-broker --no-create-home --shell /usr/sbin/nologin yonaris-browser
fi
usermod -aG yonaris-browser-rpc yonaris-runner

control_uid="$(id -u yonaris-runner)"
browser_uid="$(id -u yonaris-browser)"
rpc_gid="$(getent group yonaris-browser-rpc | cut -d: -f3)"
[[ "$control_uid" =~ ^[1-9][0-9]*$ && "$browser_uid" =~ ^[1-9][0-9]*$ && "$rpc_gid" =~ ^[1-9][0-9]*$ ]] ||
	die "service identities are invalid"
[[ "$control_uid" != "$browser_uid" ]] || die "control and browser services require separate UIDs"

install -d -o root -g root -m 0755 /etc/yonaris-browser-runner
install -d -o root -g root -m 0755 /usr/local/libexec /usr/local/sbin
install -d -o yonaris-browser -g yonaris-browser-rpc -m 0700 /var/lib/yonaris-browser-broker
install -d -o yonaris-browser -g yonaris-browser-rpc -m 0700 /var/lib/yonaris-browser-broker/home
install -d -o yonaris-browser -g yonaris-browser-rpc -m 0750 /var/lib/yonaris-browser-evidence
install -d -o yonaris-runner -g yonaris-runner -m 0700 /var/lib/yonaris-browser-runner
install -d -o yonaris-runner -g yonaris-runner -m 0700 /var/lib/yonaris-browser-runner/control

render_template() {
	local template="$1"
	local destination="$2"
	local mode="$3"
	TEMPLATE="$template" DESTINATION="$destination" \
		SOURCE_DIRECTORY="$source_directory" NODE_BIN_DIRECTORY="$node_bin_directory" NODE_EXECUTABLE="$node_executable" TSX_EXECUTABLE="$tsx_executable" \
		CHROMIUM_EXECUTABLE="$chromium_executable" CHROMIUM_HEADLESS_EXECUTABLE="$chromium_headless_executable" \
		BROWSER_UID="$browser_uid" CONTROL_UID="$control_uid" RPC_GID="$rpc_gid" \
		python3 - <<'PY'
import os
from pathlib import Path

source = Path(os.environ["TEMPLATE"]).read_text(encoding="utf-8")
replacements = {
    "@@SOURCE_DIRECTORY@@": os.environ["SOURCE_DIRECTORY"],
    "@@NODE_BIN_DIRECTORY@@": os.environ["NODE_BIN_DIRECTORY"],
    "@@NODE_EXECUTABLE@@": os.environ["NODE_EXECUTABLE"],
    "@@TSX_EXECUTABLE@@": os.environ["TSX_EXECUTABLE"],
    "@@CHROMIUM_EXECUTABLE@@": os.environ["CHROMIUM_EXECUTABLE"],
    "@@CHROMIUM_HEADLESS_EXECUTABLE@@": os.environ["CHROMIUM_HEADLESS_EXECUTABLE"],
    "@@BROWSER_UID@@": os.environ["BROWSER_UID"],
    "@@CONTROL_UID@@": os.environ["CONTROL_UID"],
    "@@RPC_GID@@": os.environ["RPC_GID"],
}
for marker, value in replacements.items():
    source = source.replace(marker, value)
if "@@" in source:
    raise SystemExit("unresolved deployment template marker")
temporary = Path(os.environ["DESTINATION"] + ".new")
temporary.write_text(source, encoding="utf-8")
PY
	install -o root -g root -m "$mode" -- "$destination.new" "$destination"
	rm -f -- "$destination.new"
}

install_config_once() {
	local template="$1"
	local destination="$2"
	local mode="$3"
	if [[ -e "$destination" ]]; then
		[[ -f "$destination" && ! -L "$destination" && "$(stat -c %U:%G -- "$destination")" == "root:root" ]] ||
			die "refusing unsafe existing configuration $destination"
		chmod "$mode" -- "$destination"
		return
	fi
	render_template "$template" "$destination" "$mode"
}

install_config_once "$script_dir/config/browser.env.example" /etc/yonaris-browser-runner/browser.env 0600
install_config_once "$script_dir/config/control.env.example" /etc/yonaris-browser-runner/control.env 0600
install_config_once "$script_dir/config/network.env.example" /etc/yonaris-browser-runner/network.env 0644
install_config_once "$script_dir/config/approved-browser-domains" /etc/yonaris-browser-runner/approved-browser-domains 0644
install_config_once "$script_dir/config/control-plane-hosts" /etc/yonaris-browser-runner/control-plane-hosts 0644

if grep -Eq 'BROWSER_RUNNER_API_TOKEN|DATABASE_URL|ADMIN_API_KEYS|BETTER_AUTH_SECRET|ELMO_ENCRYPTION_KEY' \
	/etc/yonaris-browser-runner/browser.env; then
	die "browser environment contains a control-plane secret name"
fi

install -o root -g root -m 0755 "$script_dir/bin/yonaris-browser-peercred" /usr/local/libexec/yonaris-browser-peercred
install -o root -g root -m 0755 "$script_dir/bin/apply-browser-egress.sh" /usr/local/sbin/yonaris-apply-browser-egress
install -o root -g root -m 0755 "$script_dir/bin/browser-egress-negative-probes.sh" /usr/local/sbin/yonaris-browser-egress-negative-probes
install -o root -g root -m 0755 "$script_dir/bin/clear-browser-egress.sh" /usr/local/sbin/yonaris-clear-browser-egress
install -o root -g root -m 0755 "$script_dir/bin/verify-host.sh" /usr/local/sbin/yonaris-verify-browser-runner-host
install -o root -g root -m 0644 "$script_dir/README.md" /etc/yonaris-browser-runner/README.md

render_template "$script_dir/apparmor/yonaris-browser-chromium.in" /etc/apparmor.d/yonaris-browser-chromium 0644
apparmor_parser -Q -K /etc/apparmor.d/yonaris-browser-chromium
apparmor_parser -r /etc/apparmor.d/yonaris-browser-chromium

render_template "$script_dir/systemd/yonaris-browser-broker.service.in" /etc/systemd/system/yonaris-browser-broker.service 0644
render_template "$script_dir/systemd/yonaris-browser-runner.service.in" /etc/systemd/system/yonaris-browser-runner.service 0644
install -o root -g root -m 0644 "$script_dir/systemd/yonaris-browser-network.service" \
	/etc/systemd/system/yonaris-browser-network.service

sysctl_file=/etc/sysctl.d/90-yonaris-browser-sandbox.conf
printf '%s\n' \
	'kernel.apparmor_restrict_unprivileged_userns = 1' \
	'kernel.unprivileged_userns_clone = 1' >"$sysctl_file.new"
install -o root -g root -m 0644 "$sysctl_file.new" "$sysctl_file"
rm -f -- "$sysctl_file.new"
sysctl -q -w kernel.apparmor_restrict_unprivileged_userns=1
sysctl -q -w kernel.unprivileged_userns_clone=1

systemctl daemon-reload
systemd-analyze verify \
	/etc/systemd/system/yonaris-browser-network.service \
	/etc/systemd/system/yonaris-browser-broker.service \
	/etc/systemd/system/yonaris-browser-runner.service

echo "Browser Runner host assets installed in disabled state. Review /etc/yonaris-browser-runner/README.md."
