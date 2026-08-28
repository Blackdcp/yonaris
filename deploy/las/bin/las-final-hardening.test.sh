#!/usr/bin/env bash

set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "$SCRIPT_DIR/../../.." && pwd)"

DISPATCHER="$SCRIPT_DIR/dispatch-las-command.sh"
VERIFIER="$SCRIPT_DIR/verify-las-forced-command.sh"
STATE_MANAGER="$SCRIPT_DIR/manage-las-release-state.sh"
GUARD="$SCRIPT_DIR/guard-artifact-output-release.sh"
POLICY_INSTALLER="$SCRIPT_DIR/install-las-trust-policy.sh"
RUNTIME_MANAGER="$SCRIPT_DIR/manage-las-runtime.sh"
CADDY_MANAGER="$SCRIPT_DIR/manage-las-caddy.sh"
BUNDLE_INSTALLER="$SCRIPT_DIR/install-las-stable-bundle.sh"
ACTIVE_BUNDLE_LAUNCHER="$SCRIPT_DIR/run-las-active-bundle.sh"
PORTAL_COMPOSE="$SCRIPT_DIR/../compose.yaml"
PORTAL_WORKFLOW="$REPO_ROOT/.github/workflows/deploy-las.yaml"
RUNBOOK="$SCRIPT_DIR/../ARTIFACT-OUTPUT-LANGUAGE-RUNBOOK.md"
LEGACY_BACKUP_UNIT="$SCRIPT_DIR/../systemd/yonaris-backup.service"

fail() { printf '%s\n' "$1" >&2; exit 1; }
contains() { grep -Fq -- "$2" "$1" || fail "Missing final hardening contract: $2 in $1"; }
not_contains() { ! grep -Fq -- "$2" "$1" || fail "Forbidden final hardening surface: $2 in $1"; }

for required in "$RUNTIME_MANAGER" "$CADDY_MANAGER" "$BUNDLE_INSTALLER" "$ACTIVE_BUNDLE_LAUNCHER"; do
	[[ -f "$required" ]] || fail "Missing final root-owned helper source: $required"
	[[ "$(head -n 1 "$required")" == '#!/bin/bash' ]] || fail "Stable helper lacks /bin/bash: $required"
done

# The candidate UID never sees either Docker socket or daemon configuration.
contains "$DISPATCHER" 'INHERITED_BUNDLE_DIRECTORY="${LAS_STABLE_BUNDLE_DIR:-}"'
contains "$DISPATCHER" 'STABLE_DIRECTORY="$INHERITED_BUNDLE_DIRECTORY"'
contains "$DISPATCHER" 'active_bundle_pin_is_current'
contains "$DISPATCHER" '/usr/bin/flock --shared --wait 1800 9'
contains "$DISPATCHER" 'readonly STABLE_RUNTIME_MANAGER="$STABLE_DIRECTORY/manage-las-runtime"'
contains "$DISPATCHER" '"$STABLE_RUNTIME_MANAGER"'
not_contains "$DISPATCHER" '/usr/sbin/runuser'
not_contains "$DISPATCHER" 'DOCKER_HOST='
not_contains "$DISPATCHER" 'DOCKER_CONFIG='
not_contains "$DISPATCHER" 'XDG_RUNTIME_DIR='
contains "$VERIFIER" "RUNTIME_USER='yonaris-runtime'"
contains "$VERIFIER" 'deploy_uid" != "$runtime_uid'
contains "$VERIFIER" 'test ! -r "$rootless_socket"'
contains "$VERIFIER" "RUNTIME_ENV='/etc/yonaris/las-runtime.env'"
contains "$RUNTIME_MANAGER" '/usr/sbin/runuser -u "$RUNTIME_USER" -- /usr/bin/env -i'
contains "$RUNTIME_MANAGER" "DOCKER_HOST='unix:///run/user/"
not_contains "$RUNTIME_MANAGER" '/opt/yonaris/source'

# Host Caddy is a read-only Portal boundary verifier. Release deployment cannot
# mutate configuration, reload Caddy, or restore the retired marketing surface.
contains "$CADDY_MANAGER" 'verify-boundary'
contains "$CADDY_MANAGER" 'caddy validate'
contains "$CADDY_MANAGER" 'portal.yonaris.com'
not_contains "$CADDY_MANAGER" 'caddy reload'
not_contains "$CADDY_MANAGER" 'bootstrap-activate'
not_contains "$CADDY_MANAGER" 'MARKETING_RELEASE'
not_contains "$CADDY_MANAGER" 'RELEASE_TREE_ROOT'
not_contains "$STATE_MANAGER" 'caddy-before-sha256'
not_contains "$STATE_MANAGER" 'caddy-after-sha256'
not_contains "$CADDY_MANAGER" '--volume /:/host'
not_contains "$CADDY_MANAGER" '/opt/yonaris/source'
not_contains "$DISPATCHER" 'deploy/las/bin/deploy-marketing.sh "$release_tag"'

# Postgres is part of the same immutable digest tuple as every release image.
for consumer in "$DISPATCHER" "$STATE_MANAGER" "$GUARD" "$POLICY_INSTALLER" "$VERIFIER"; do
	contains "$consumer" 'postgres-sha256'
done

# Every active external/policy grammar is Portal-only: probe has no payload and
# deploy/rollback bind exactly web, worker, migrate, and Postgres digests.
contains "$DISPATCHER" '"$original_command" == "$PROTOCOL probe"'
for consumer in "$DISPATCHER" "$STATE_MANAGER" "$GUARD" "$POLICY_INSTALLER" "$VERIFIER"; do
	not_contains "$consumer" 'marketing-preflight'
	not_contains "$consumer" 'marketing-deploy'
	not_contains "$consumer" 'marketing-verify'
done
for consumer in "$DISPATCHER" "$GUARD" "$POLICY_INSTALLER" "$VERIFIER"; do
	not_contains "$consumer" 'WWW_IMAGE_DIGEST'
done
for consumer in "$GUARD" "$POLICY_INSTALLER" "$VERIFIER"; do
	not_contains "$consumer" 'www_label'
	not_contains "$consumer" 'www_digest'
done
contains "$BUNDLE_INSTALLER" 'artifact-output-language-receipt-v3'
contains "$BUNDLE_INSTALLER" 'artifact-output-language-receipt-v2'
contains "$BUNDLE_INSTALLER" 'www-sha256'
not_contains "$BUNDLE_INSTALLER" 'marketing-deploy'

# Removed candidate-side operations are rejected by every policy parser, not
# merely hidden from the SSH dispatcher grammar.
for legacy_operation in report-operations overseas-formal-readiness local-demo-import \
	overseas-formal-one-shot response-snapshot-activation sampling-batch-operation \
	reviewed-consumer-cohort-import program-locale-repair program-import \
	response-snapshot-backfill browser-runner-activation; do
	for consumer in "$STATE_MANAGER" "$GUARD" "$POLICY_INSTALLER" "$VERIFIER" "$BUNDLE_INSTALLER"; do
		not_contains "$consumer" "$legacy_operation"
	done
done
contains "$PORTAL_COMPOSE" 'postgres@${POSTGRES_IMAGE_DIGEST'
contains "$PORTAL_WORKFLOW" 'postgres_digest:'
contains "$DISPATCHER" 'POSTGRES_IMAGE_DIGEST'

# Stable programs and policy switch as one recoverable root-only bundle.
contains "$BUNDLE_INSTALLER" "STAGING_DIRECTORY='/usr/local/libexec/yonaris-las/.bundle-v1.new'"
contains "$BUNDLE_INSTALLER" "TRANSITION_JOURNAL='/etc/yonaris/las-stable-bundle-pending-v1'"
contains "$BUNDLE_INSTALLER" "ACTIVE_POINTER='/etc/yonaris/las-stable-bundle-active-v1'"
contains "$BUNDLE_INSTALLER" "'verify-yonaris-las-forced-command'"
contains "$BUNDLE_INSTALLER" 'reconcile_pending_bundle'
contains "$BUNDLE_INSTALLER" 'validate_staging_bundle'
contains "$BUNDLE_INSTALLER" '/usr/bin/sync -f'
contains "$BUNDLE_INSTALLER" 'SUDO_USER'
contains "$ACTIVE_BUNDLE_LAUNCHER" 'readonly ACTIVE_POINTER='
contains "$ACTIVE_BUNDLE_LAUNCHER" 'LAS_STABLE_BUNDLE_DIR="$bundle_directory"'
contains "$ACTIVE_BUNDLE_LAUNCHER" 'exec "$program_path" "$@"'
contains "$DISPATCHER" 'LAS_STABLE_BUNDLE_DIR="$INHERITED_BUNDLE_DIRECTORY"'
contains "$RUNBOOK" '/var/lib/yonaris/las-objects.git'
contains "$RUNBOOK" '/etc/yonaris/las-runtime.env'
contains "$RUNBOOK" '/usr/local/libexec/yonaris-las/.bundle-v1.new'
contains "$RUNBOOK" '/usr/local/sbin/install-yonaris-las-stable-bundle'
not_contains "$RUNBOOK" 'sudo -i /usr/local/sbin/install-yonaris-las-trust-policy'
not_contains "$RUNBOOK" 'sudo -i /usr/local/libexec/yonaris-las/manage-las-release-state activate-output-language'

# The historical timer cannot restore deploy-user access to rootful Docker or
# execute a mutable checkout. Backups remain blocked until a fixed runtime
# manager operation is implemented and policy-bound.
contains "$LEGACY_BACKUP_UNIT" 'ExecStart=/usr/bin/false'
contains "$LEGACY_BACKUP_UNIT" 'NoNewPrivileges=yes'
not_contains "$LEGACY_BACKUP_UNIT" 'SupplementaryGroups=docker'
not_contains "$LEGACY_BACKUP_UNIT" 'User=yonaris-deploy'
not_contains "$LEGACY_BACKUP_UNIT" '/opt/yonaris/source/deploy/las/bin/backup.sh'

printf '%s\n' 'final LAS hardening contracts passed'
