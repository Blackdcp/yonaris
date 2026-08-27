#!/usr/bin/env bash

set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "$SCRIPT_DIR/../../.." && pwd)"
DISPATCHER="$SCRIPT_DIR/dispatch-las-command.sh"
GUARD="$SCRIPT_DIR/guard-artifact-output-release.sh"
VERIFIER="$SCRIPT_DIR/verify-las-forced-command.sh"
TRUST_INSTALLER="$SCRIPT_DIR/install-las-trust-policy.sh"
STATE_MANAGER="$SCRIPT_DIR/manage-las-release-state.sh"
RUNTIME_MANAGER="$SCRIPT_DIR/manage-las-runtime.sh"
CADDY_MANAGER="$SCRIPT_DIR/manage-las-caddy.sh"
PRODUCER="$SCRIPT_DIR/produce-las-migration-readiness.sh"
BUNDLE_INSTALLER="$SCRIPT_DIR/install-las-stable-bundle.sh"
ACTIVE_BUNDLE_LAUNCHER="$SCRIPT_DIR/run-las-active-bundle.sh"
DEPLOY="$SCRIPT_DIR/deploy.sh"
MARKETING_DEPLOY="$SCRIPT_DIR/deploy-marketing.sh"
DOTENV_LOADER="$SCRIPT_DIR/load-strict-dotenv.sh"
PORTAL_COMPOSE="$SCRIPT_DIR/../compose.yaml"
MARKETING_COMPOSE="$SCRIPT_DIR/../compose.marketing.yaml"
RUNBOOK="$SCRIPT_DIR/../ARTIFACT-OUTPUT-LANGUAGE-RUNBOOK.md"
PORTAL_WORKFLOW="$REPO_ROOT/.github/workflows/deploy-las.yaml"
MARKETING_WORKFLOW="$REPO_ROOT/.github/workflows/deploy-marketing.yaml"
E2E_WORKFLOW="$REPO_ROOT/.github/workflows/e2e.yaml"

EXPECTED_FINGERPRINT='SHA256:gM/QEgkfN99cP/Cf9awUOwSb7FMesQTgRCTI9kPh84A'
EXPECTED_FORCED_ENTRY='restrict,command="/usr/bin/sudo -n /usr/local/libexec/yonaris-las/dispatch-las-command" ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAINm/JTgoBi4QJiP0KunOfVuG3JDd6NpxlVdZ3l9xzTWg yonaris-las-operator-2026-08-06'
PROBE_RESPONSE='yonaris-las-probe-v1 ok'

assert_contains() {
	local path="$1"
	local exact="$2"
	local reason="$3"
	if ! grep -Fq -- "$exact" "$path"; then
		printf 'Missing security contract (%s): %s in %s\n' "$reason" "$exact" "$path" >&2
		exit 1
	fi
}

assert_not_contains() {
	local path="$1"
	local exact="$2"
	local reason="$3"
	if grep -Fq -- "$exact" "$path"; then
		printf 'Forbidden security contract (%s): %s in %s\n' "$reason" "$exact" "$path" >&2
		exit 1
	fi
}

for required_program in "$TRUST_INSTALLER" "$STATE_MANAGER" "$RUNTIME_MANAGER" \
	"$CADDY_MANAGER" "$PRODUCER" "$BUNDLE_INSTALLER" "$ACTIVE_BUNDLE_LAUNCHER"; do
	[[ -f "$required_program" ]] || {
		printf 'Missing root-owned stable program source: %s\n' "$required_program" >&2
		exit 1
	}
done

# GitHub Actions never receives an unrestricted pre-cutover shell. Root trust is
# bootstrapped locally from reviewed, fixed-hash files; every workflow SSH call
# must therefore be an enumerated forced-command protocol request.
assert_not_contains "$PORTAL_WORKFLOW" 'bash -s' 'Actions may not stream an unrestricted Phase 1 shell'
assert_not_contains "$PORTAL_WORKFLOW" "<<'REMOTE'" 'Actions may not stream a remote heredoc'
assert_not_contains "$PORTAL_WORKFLOW" "LAS_FORCED_COMMAND_ENABLED != 'true'" \
	'Actions may not fall back to an unforced deployment path'
assert_contains "$PORTAL_WORKFLOW" \
	"vars.LAS_FORCED_COMMAND_ENABLED == 'true'" \
	'portal deployment requires the forced boundary'

# Trust is rooted outside the candidate checkout and outside every path writable
# by yonaris-deploy. The verifier binds the actual Actions key, forced options,
# stable program hashes, policy, and attestation in one no-argument decision.
[[ "$(head -n 1 "$VERIFIER")" == '#!/bin/bash' ]] || {
	echo 'The root verifier must execute with the absolute /bin/bash interpreter.' >&2
	exit 1
}
for contract in \
	"ACTIONS_KEY_FINGERPRINT='$EXPECTED_FINGERPRINT'" \
	"EXPECTED_AUTHORIZED_KEY='$EXPECTED_FORCED_ENTRY'" \
	"SSH_DIRECTORY='/home/yonaris-gate/.ssh'" \
	"AUTHORIZED_KEYS='/home/yonaris-gate/.ssh/authorized_keys'" \
	"ATTESTATION='/etc/yonaris/las-forced-command-active'" \
	"STABLE_DIRECTORY=\"\$LAS_STABLE_BUNDLE_DIR\"" \
	'readonly STABLE_DISPATCHER="$STABLE_DIRECTORY/dispatch-las-command"' \
	'readonly STABLE_GUARD="$STABLE_DIRECTORY/guard-artifact-output-release"'; do
	assert_contains "$VERIFIER" "$contract" 'root verifier trust binding'
done
for absolute_command in \
	/usr/bin/cmp /usr/bin/grep /usr/bin/readlink /usr/bin/sha256sum \
	/usr/bin/ssh-keygen /usr/bin/stat; do
	assert_contains "$VERIFIER" "$absolute_command" 'absolute verifier command'
done
assert_contains "$VERIFIER" "0:0:755" 'root-owned ssh directory and stable directory metadata'
assert_contains "$VERIFIER" "0:0:600" 'root-owned authorized_keys and attestation metadata'
assert_contains "$VERIFIER" "0:0:644" 'root-owned readable policy metadata'

for stable_program in "$DISPATCHER" "$GUARD"; do
	assert_contains "$stable_program" 'TRUST_POLICY="$STABLE_DIRECTORY/las-trust-v1"' \
		'active-bundle release authorization policy'
	assert_contains "$stable_program" 'LAS_STABLE_BUNDLE_DIR' \
		'same-generation stable peer pin'
	assert_not_contains "$stable_program" "DEPLOY_ROOT/bin" \
		'deployment account must not own stable programs'
done
for stable_program in "$DISPATCHER" "$GUARD" "$TRUST_INSTALLER" "$STATE_MANAGER"; do
	[[ "$(head -n 1 "$stable_program")" == '#!/bin/bash' ]] || {
		printf 'Stable program must use absolute /bin/bash: %s\n' "$stable_program" >&2
		exit 1
	}
done
assert_not_contains "$DISPATCHER" 'produce-las-migration-readiness' \
	'forced SSH dispatcher never exposes the root-only producer'

# Candidate trees are materialized from exact Git objects.  The dispatcher may
# authorize and materialize them, but production runtime execution belongs only
# to the stable runtime manager under the isolated runtime identity.
for exact_contract in \
	'/usr/bin/git --no-replace-objects' \
	"GIT_CONFIG_NOSYSTEM='1'" \
	"GIT_CONFIG_GLOBAL='/dev/null'" \
	"core.hooksPath=/dev/null" \
	"RELEASE_TREE_ROOT='/var/lib/yonaris/las-release-trees'" \
	'/usr/bin/env -i'; do
	assert_contains "$DISPATCHER" "$exact_contract" 'clean immutable candidate materialization'
done
assert_not_contains "$DISPATCHER" 'DOCKER_HOST=' 'candidate dispatcher never carries a Docker socket'
assert_not_contains "$DISPATCHER" '/usr/sbin/runuser' \
	'dispatcher never executes candidate code under a mutable deployment identity'
assert_contains "$RUNTIME_MANAGER" "DOCKER_HOST='unix:///run/user/" \
	'only isolated runtime manager owns the rootless socket address'
assert_contains "$RUNTIME_MANAGER" '/usr/sbin/runuser -u "$RUNTIME_USER" -- /usr/bin/env -i' \
	'only stable runtime manager crosses into the isolated runtime identity'
for forbidden in \
	'git checkout' \
	'git reset' \
	'git clean' \
	'bash "$SOURCE_ROOT/' \
	'bash "$candidate_script"'; do
	assert_not_contains "$DISPATCHER" "$forbidden" 'mutable candidate execution'
done

# Production dotenv is data, never shell. The strict loader accepts only the
# reviewed key allowlist and must not evaluate substitutions or startup hooks.
for script in "$DEPLOY" "$MARKETING_DEPLOY"; do
	assert_not_contains "$script" 'source "$ENV_FILE"' '.env may not execute shell'
	assert_not_contains "$script" '. "$ENV_FILE"' '.env may not execute shell'
	assert_contains "$script" 'load_strict_dotenv' 'strict dotenv parser'
done
assert_contains "$DOTENV_LOADER" 'Refusing unsupported production environment key' 'dotenv key allowlist'
assert_contains "$DOTENV_LOADER" 'Refusing executable syntax in production environment value' 'dotenv no-eval contract'
assert_not_contains "$DOTENV_LOADER" 'eval ' 'dotenv parser never evaluates input'

# Activation and release transition state is root-owned and one-way. A pending
# transition is durable before runtime mutation and is reconciled or rejected at
# every forced dispatcher entry. Rollback uses the materialized predecessor.
for exact_contract in \
	"ACTIVATION_ATTESTATION='/etc/yonaris/artifact-output-language-active-v1'" \
	"TRANSITION_JOURNAL='/etc/yonaris/las-transition-pending-v1'" \
	"PORTAL_RELEASE='/etc/yonaris/las-active-portal-release-v1'" \
	'begin portal' \
	'complete portal' \
	'reconcile portal'; do
	assert_contains "$STATE_MANAGER" "$exact_contract" 'root durable release state'
done
assert_contains "$DISPATCHER" 'reconcile_pending_transition' 'entry-time pending transition reconciliation'
assert_contains "$DISPATCHER" 'materialize_release_tree "$active_portal_release"' \
	'rollback uses materialized predecessor tree'
assert_contains "$DEPLOY" 'YONARIS_PREDECESSOR_COMPOSE_FILE' 'predecessor compose rollback boundary'
assert_not_contains "$DEPLOY" 'rollback_runtime_services || true' 'rollback failures may not be swallowed'

# Policy updates have a separate root-only staging interface. It validates a
# same-directory root-owned staging file, atomically renames it, fsyncs, and
# restores the last verified policy if post-verification fails.
for exact_contract in \
	"STAGING_POLICY='/etc/yonaris/.las-trust-v1.new'" \
	"LIVE_POLICY='/etc/yonaris/las-trust-v1'" \
	"STABLE_INSTALLER='/usr/local/sbin/install-yonaris-las-trust-policy'" \
	'validate_policy_file "$STAGING_POLICY" 600' \
	'/usr/bin/mv -f -- "$STAGING_POLICY" "$LIVE_POLICY"' \
	'/usr/bin/sync -f "$TRUST_DIRECTORY"' \
	'rollback_policy_install'; do
	assert_contains "$TRUST_INSTALLER" "$exact_contract" 'root policy staging transaction'
done
assert_contains "$TRUST_INSTALLER" 'LAS_STABLE_BUNDLE_DIR' \
	'standalone policy update refuses an active bundle invocation'
for exact_contract in \
	"STAGING_DIRECTORY='/usr/local/libexec/yonaris-las/.bundle-v1.new'" \
	"ENTRYPOINT_SHA256='b820e6c2777075904377561e176f6781fc5b2f447f9d45bb0381cd18582532e7'" \
	"ACTIVE_POINTER='/etc/yonaris/las-stable-bundle-active-v1'" \
	"TRANSITION_JOURNAL='/etc/yonaris/las-stable-bundle-pending-v1'" \
	'validate_fixed_launchers' \
	'validate_policy_and_programs' \
	'reconcile_pending_bundle' \
	'/usr/bin/mv -fT -- "$ACTIVE_POINTER_TEMP" "$ACTIVE_POINTER"'; do
	assert_contains "$BUNDLE_INSTALLER" "$exact_contract" 'atomic stable programs and policy bundle'
done
for exact_contract in \
	"'produce-las-migration-readiness'" \
	"'migration-readiness-producer'"; do
	assert_contains "$BUNDLE_INSTALLER" "$exact_contract" \
		'migration-readiness producer is hash-bound in every stable bundle'
done
assert_contains "$ACTIVE_BUNDLE_LAUNCHER" 'LAS_STABLE_BUNDLE_DIR="$bundle_directory"' \
	'fixed launcher pins the selected generation'
assert_contains "$ACTIVE_BUNDLE_LAUNCHER" 'exec "$program_path" "$@"' \
	'fixed launcher executes only a versioned peer'
assert_contains "$PRODUCER" 'RENAME_NOREPLACE = 1' \
	'producer uses the kernel no-replace primitive'
assert_contains "$PRODUCER" 'ctypes.CDLL(None, use_errno=True).renameat2' \
	'producer invokes renameat2 directly without a userspace fallback'
assert_not_contains "$PRODUCER" '/usr/bin/mv -nT' \
	'producer never publishes evidence through racy mv no-clobber semantics'

# authorized_keys is exactly one LF-terminated forced entry, and effective sshd
# policy cannot redirect keys or commands. Rootless Docker is an explicit host
# invariant: the deployment account is not in the docker group and cannot use
# the rootful socket.
for exact_contract in \
	'/usr/bin/cmp -s "$AUTHORIZED_KEYS"' \
	'/usr/sbin/sshd -T -C' \
	'authorizedkeysfile .ssh/authorized_keys' \
	'authorizedkeyscommand none' \
	'permituserenvironment no' \
	'/usr/bin/id -nG yonaris-deploy' \
	'/var/run/docker.sock'; do
	assert_contains "$VERIFIER" "$exact_contract" 'exact ssh/rootless Docker boundary'
done

# Every authorized release binds immutable registry digests, Compose consumes
# image@sha256 references, and runtime verification checks RepoDigests rather
# than trusting a mutable tag.
for policy_consumer in "$GUARD" "$VERIFIER" "$TRUST_INSTALLER" "$BUNDLE_INSTALLER"; do
	for image in web worker migrate postgres www; do
		assert_contains "$policy_consumer" "$image-sha256" 'per-release image digest policy'
	done
done
for compose in "$PORTAL_COMPOSE" "$MARKETING_COMPOSE"; do
	assert_contains "$compose" '@${' 'Compose immutable image digest'
done
assert_contains "$RUNTIME_MANAGER" 'RepoDigests' 'runtime image digest verification'
assert_contains "$RUNTIME_MANAGER" 'config --format json' 'rendered Compose security boundary'
assert_contains "$RUNTIME_MANAGER" 'set(services) != set(expected)' 'exact rendered service set'
assert_contains "$RUNTIME_MANAGER" 'volume count is not exact' 'exact rendered volume set'
assert_contains "$RUNTIME_MANAGER" 'published port count is not exact' 'exact rendered port set'
assert_contains "$RUNTIME_MANAGER" 'http://127.0.0.1:1515/' 'portal host HTTP probe'
assert_contains "$PORTAL_WORKFLOW" 'web_digest:' 'portal build digest workflow output'
assert_contains "$PORTAL_WORKFLOW" 'worker_digest:' 'worker build digest workflow output'
assert_contains "$PORTAL_WORKFLOW" 'migrate_digest:' 'migration build digest workflow output'
assert_contains "$PORTAL_WORKFLOW" 'postgres_digest:' 'Postgres digest workflow output'
assert_contains "$MARKETING_WORKFLOW" 'www_digest:' 'marketing build digest workflow output'
assert_contains "$GUARD" 'authorized_line' 'protected per-release operation allowlist'
assert_contains "$GUARD" 'candidate)' 'candidate capability evidence'
assert_contains "$GUARD" 'rollback)' 'rollback authorization and receipt'
assert_contains "$DISPATCHER" "PROBE_RESPONSE='$PROBE_RESPONSE'" 'stable probe response'
assert_contains "$DISPATCHER" '"$original_command" == "$PROTOCOL probe"' \
	'canonical side-effect-free probe operation'
assert_contains "$DISPATCHER" 'candidate "$release_tag" "$operation")' \
	'operation-specific stable guard request'
assert_contains "$DISPATCHER" 'authorize_candidate "$release_tag" "$operation" ||' \
	'operation-specific stable authorization before runtime mutation'

# Candidate deploy code cannot install or replace any trust root. It must ask the
# already-installed stable guard for deploy authorization before runtime effects.
assert_contains "$DEPLOY" "ARTIFACT_OUTPUT_LANGUAGE_HOST_GUARD='/usr/local/libexec/yonaris-las/guard-artifact-output-release'" \
	'fixed root-owned guard path'
assert_contains "$DEPLOY" '"$ARTIFACT_OUTPUT_LANGUAGE_HOST_GUARD" candidate "$release_tag" deploy' \
	'root allowlist before deployment side effects'
for forbidden in \
	install_artifact_output_language_host_guard \
	install_artifact_output_language_host_dispatcher \
	ARTIFACT_OUTPUT_LANGUAGE_GUARD_SOURCE \
	ARTIFACT_OUTPUT_LANGUAGE_DISPATCHER_SOURCE; do
	assert_not_contains "$DEPLOY" "$forbidden" 'candidate may not update stable trust programs'
done
assert_contains "$DEPLOY" 'persist_healthy_release_transaction' \
	'receipt and active release transactional commit'
assert_contains "$DEPLOY" 'Activated artifact output languages require ARTIFACT_ZH_CN_ENABLED=true.' \
	'one-way activation cannot be behaviorally disabled'
assert_contains "$DEPLOY" 'rollback_healthy_release_transaction' \
	'failed transaction compensation'

# Both workflows authenticate the forced boundary with the same exact probe and
# distinguish a protocol rejection from an SSH authentication failure.
for workflow in "$PORTAL_WORKFLOW" "$MARKETING_WORKFLOW"; do
	assert_contains "$workflow" '"yonaris-las-v1 probe"' 'canonical forced-command probe'
	assert_contains "$workflow" "$PROBE_RESPONSE" 'exact probe response comparison'
	assert_contains "$workflow" '"true"' 'arbitrary command rejection probe'
	assert_contains "$workflow" 'Refusing non-protocol LAS SSH command.' \
		'exact dispatcher rejection response'
	assert_contains "$workflow" 'rejection_status" -ne 2' \
		'authentication failure cannot satisfy rejection test'
done
assert_contains "$RUNTIME_MANAGER" "ENV_FILE='/etc/yonaris/las-runtime.env'" \
	'root-owned immutable runtime environment input belongs to the stable runtime manager'
assert_contains "$DISPATCHER" 'Root policy digests do not match this workflow build.' \
	'portal build-to-policy digest equality'
assert_contains "$DISPATCHER" 'Root policy www digest does not match this workflow build.' \
	'marketing build-to-policy digest equality'
assert_contains "$PORTAL_WORKFLOW" 'needs.build-images.outputs.web_digest' \
	'portal workflow transmits exact build digest'
assert_contains "$MARKETING_WORKFLOW" 'needs.build.outputs.www_digest' \
	'marketing workflow transmits exact build digest'
assert_not_contains "$PORTAL_WORKFLOW" 'bash -s' \
	'workflow never regains an unrestricted pre-cutover bootstrap shell'

# The operating procedure is the other half of the trust boundary. It fixes the
# actual key identity/options, root metadata, immutable hashes, sudo PATH, manual
# release authorization, and safe cutover rollback order.
for contract in \
	"$EXPECTED_FINGERPRINT" \
	"$EXPECTED_FORCED_ENTRY" \
	'/usr/local/libexec/yonaris-las/dispatch-las-command' \
	'/usr/local/libexec/yonaris-las/guard-artifact-output-release' \
	'/etc/yonaris/las-stable-bundle-active-v1' \
	'/usr/local/libexec/yonaris-las/.bundle-v1.new' \
	'/etc/yonaris/las-forced-command-active' \
	'Defaults!YONARIS_LAS_DISPATCH secure_path=' \
	'/bin/bash -n' \
	'yonaris-las-v1 probe' \
	"$PROBE_RESPONSE" \
	'operator must add every release SHA and operation' \
	'candidate checkout cannot update the trust policy'; do
	assert_contains "$RUNBOOK" "$contract" 'operator trust/cutover contract'
done

assert_not_contains "$RUNBOOK" 'authorized_keys.restore.new' \
	'one-way activation can never restore an unrestricted key'
assert_not_contains "$RUNBOOK" 'rm -f -- /etc/yonaris/artifact-output-language-active-v1' \
	'one-way activation has no delete procedure'
assert_contains "$RUNBOOK" 'After it exists, do not restore an unrestricted key' \
	'one-way forced-command rollback boundary'

echo 'artifact output language security contract tests passed'
