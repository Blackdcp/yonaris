#!/usr/bin/env bash

set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
DISPATCHER="$SCRIPT_DIR/dispatch-las-command.sh"
VERIFIER="$SCRIPT_DIR/verify-las-forced-command.sh"
RUNTIME_MANAGER="$SCRIPT_DIR/manage-las-runtime.sh"
CADDY_MANAGER="$SCRIPT_DIR/manage-las-caddy.sh"
DEPLOY="$SCRIPT_DIR/deploy.sh"
RUNBOOK="$SCRIPT_DIR/../ARTIFACT-OUTPUT-LANGUAGE-RUNBOOK.md"

EXPECTED_ENTRY='restrict,command="/usr/bin/sudo -n /usr/local/libexec/yonaris-las/dispatch-las-command" ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAINm/JTgoBi4QJiP0KunOfVuG3JDd6NpxlVdZ3l9xzTWg yonaris-las-operator-2026-08-06'

grep -Fq "SSH_GATE_USER='yonaris-gate'" "$VERIFIER"
grep -Fq "DEPLOY_USER='yonaris-deploy'" "$VERIFIER"
grep -Fq "EXPECTED_AUTHORIZED_KEY='$EXPECTED_ENTRY'" "$VERIFIER"
grep -Fq "SOURCE_GIT_DIR='/var/lib/yonaris/las-objects.git'" "$DISPATCHER"
grep -Fq "SOURCE_GIT_DIR='/var/lib/yonaris/las-objects.git'" "$SCRIPT_DIR/manage-las-release-state.sh"
grep -Fq "SOURCE_GIT_DIR='/var/lib/yonaris/las-objects.git'" "$SCRIPT_DIR/guard-artifact-output-release.sh"
grep -Fq "SOURCE_GIT_DIR='/var/lib/yonaris/las-objects.git'" "$SCRIPT_DIR/install-las-trust-policy.sh"
for root_program in "$DISPATCHER" "$VERIFIER" "$SCRIPT_DIR/manage-las-release-state.sh" \
	"$SCRIPT_DIR/guard-artifact-output-release.sh" "$SCRIPT_DIR/install-las-trust-policy.sh"; do
	grep -Fq "STATE_DIRECTORY='/var/lib/yonaris'" "$root_program"
done
grep -Fq "LOCK_DIRECTORY='/run/lock/yonaris'" "$DISPATCHER"
grep -Fq 'exec 9<"$LOCK_DIRECTORY"' "$DISPATCHER"
grep -Fq "PORTAL_RELEASE='/etc/yonaris/las-active-portal-release-v1'" "$DISPATCHER"
if grep -Eq 'MARKETING_RELEASE|las-active-marketing-release|WWW_IMAGE_DIGEST|marketing-(preflight|deploy|verify)' "$DISPATCHER"; then
	echo 'Root dispatcher still exposes the retired marketing deployment surface.' >&2
	exit 1
fi
grep -Fq '"$original_command" == "$PROTOCOL probe"' "$DISPATCHER"
grep -Fq 'deploy | rollback' "$DISPATCHER"
grep -Fq 'arg1 arg2 arg3 arg4 extra' "$DISPATCHER"
grep -Fq '[[ "$(/usr/bin/id -u)" == 0 ]]' "$DISPATCHER"
grep -Fq '/usr/sbin/runuser -u "$RUNTIME_USER" -- /usr/bin/env -i' "$RUNTIME_MANAGER"
if grep -Fq '/usr/sbin/runuser' "$DISPATCHER"; then
	echo 'Root dispatcher must not execute candidate code under another identity.' >&2
	exit 1
fi
grep -Fq '[[ $# -eq 1 && "$1" == verify-boundary ]]' "$CADDY_MANAGER"
grep -Fq "CADDY_ADMIN_SOCKET='/run/caddy/admin.sock'" "$CADDY_MANAGER"
grep -Fq '/usr/bin/caddy validate' "$CADDY_MANAGER"
grep -Fq -- '--resolve portal.yonaris.com:443:127.0.0.1' "$CADDY_MANAGER"
if grep -Eq 'caddy reload|systemctl|MARKETING_RELEASE|RELEASE_TREE_ROOT|STABLE_STATE_MANAGER|bootstrap-activate' "$CADDY_MANAGER"; then
	echo 'Stable Caddy boundary still exposes a configuration or release-state mutation.' >&2
	exit 1
fi
if grep -Eq 'SSH_ORIGINAL_COMMAND=|YONARIS_OUTPUT_LANGUAGE_ACTIVATED=' "$DISPATCHER"; then
	echo 'Root dispatcher must not pass SSH or activation context into candidate code.' >&2
	exit 1
fi

if grep -Fq '/usr/bin/sudo' "$DISPATCHER"; then
	echo 'Root dispatcher must not recursively grant candidate code a sudo helper.' >&2
	exit 1
fi
if grep -Fq '.source-deploy.lock' "$DISPATCHER"; then
	echo 'Root dispatcher still opens a deploy-user-controlled lock path.' >&2
	exit 1
fi
if grep -Eq '/usr/bin/sudo|sudo -n|sudo -u' "$DEPLOY"; then
	echo 'Unprivileged candidate deploy code still attempts to invoke sudo.' >&2
	exit 1
fi
if grep -Eq '^yonaris-deploy ALL=.*(manage-las-release-state|verify-yonaris)' "$RUNBOOK"; then
	echo 'Runtime candidate UID still has a root helper sudo capability.' >&2
	exit 1
fi
grep -Fq 'yonaris-gate ALL=(root) NOPASSWD: YONARIS_LAS_DISPATCH' "$RUNBOOK"
grep -Fq 'Defaults!YONARIS_LAS_DISPATCH env_keep += "SSH_ORIGINAL_COMMAND"' "$RUNBOOK"
grep -Fq 'Defaults!YONARIS_LAS_DISPATCH env_delete +=' "$RUNBOOK"

echo 'separate SSH gate, root dispatcher, and isolated stable runtime boundary tests passed'
