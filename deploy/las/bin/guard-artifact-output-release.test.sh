#!/usr/bin/env bash

set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
GUARD_SOURCE="$SCRIPT_DIR/guard-artifact-output-release.sh"
CAPABILITY_TOKEN='artifact-output-language-v1'
DIGEST_WEB='sha256:1111111111111111111111111111111111111111111111111111111111111111'
DIGEST_WORKER='sha256:2222222222222222222222222222222222222222222222222222222222222222'
DIGEST_MIGRATE='sha256:3333333333333333333333333333333333333333333333333333333333333333'
DIGEST_POSTGRES='sha256:4444444444444444444444444444444444444444444444444444444444444444'
DIGEST_WWW='sha256:5555555555555555555555555555555555555555555555555555555555555555'
TEST_ROOT="$(mktemp -d)"
trap 'rm -rf -- "$TEST_ROOT"' EXIT

STATE_ROOT="$TEST_ROOT/var/lib/yonaris"
GIT_ROOT="$STATE_ROOT/repo"
TRUST_DIRECTORY="$TEST_ROOT/etc/yonaris"
TRUST_POLICY="$TRUST_DIRECTORY/las-trust-v1"
RECEIPT_ROOT="$TRUST_DIRECTORY/las-compatible-releases-v3"
LEGACY_RECEIPT_ROOT="$TRUST_DIRECTORY/las-compatible-releases-v2"
STABLE_DIRECTORY="$TEST_ROOT/usr/local/libexec/yonaris-las"
STABLE_GUARD="$STABLE_DIRECTORY/guard-artifact-output-release"
STABLE_DISPATCHER="$STABLE_DIRECTORY/dispatch-las-command"
STABLE_STATE_MANAGER="$STABLE_DIRECTORY/manage-las-release-state"
STABLE_RUNTIME_MANAGER="$STABLE_DIRECTORY/manage-las-runtime"
STABLE_CADDY_MANAGER="$STABLE_DIRECTORY/manage-las-caddy"
STABLE_PRODUCER="$STABLE_DIRECTORY/produce-las-migration-readiness"
STABLE_INSTALLER="$TEST_ROOT/usr/local/sbin/install-yonaris-las-trust-policy"
ROOT_VERIFIER="$TEST_ROOT/usr/local/sbin/verify-yonaris-las-forced-command"
MOCK_BIN="$TEST_ROOT/mock-bin"
REAL_STAT="$(command -v stat)"
REAL_READLINK="$(command -v readlink)"
REAL_GIT="$(command -v git)"

mkdir -p "$GIT_ROOT/deploy/las" "$TRUST_DIRECTORY" "$RECEIPT_ROOT" "$LEGACY_RECEIPT_ROOT" \
	"$STABLE_DIRECTORY" "$(dirname -- "$STABLE_INSTALLER")" "$MOCK_BIN"
git -C "$GIT_ROOT" init --quiet
git -C "$GIT_ROOT" config user.email test@yonaris.invalid
git -C "$GIT_ROOT" config user.name 'Yonaris security test'
git -C "$GIT_ROOT" config core.autocrlf false
printf '%s\n' "$CAPABILITY_TOKEN" >"$GIT_ROOT/deploy/las/artifact-output-language-compatible"
git -C "$GIT_ROOT" add .
git -C "$GIT_ROOT" commit --quiet -m compatible
COMPATIBLE_SHA="$(git -C "$GIT_ROOT" rev-parse HEAD)"
printf '%s\n' 'malformed-capability' >"$GIT_ROOT/deploy/las/artifact-output-language-compatible"
git -C "$GIT_ROOT" add .
git -C "$GIT_ROOT" commit --quiet -m malformed
MALFORMED_SHA="$(git -C "$GIT_ROOT" rev-parse HEAD)"
CAPABILITY_BLOB_SHA="$(git -C "$GIT_ROOT" rev-parse "$COMPATIBLE_SHA:deploy/las/artifact-output-language-compatible")"

for stable_program in "$STABLE_DISPATCHER" "$STABLE_STATE_MANAGER" "$STABLE_RUNTIME_MANAGER" \
	"$STABLE_CADDY_MANAGER" "$STABLE_PRODUCER" "$STABLE_INSTALLER" "$ROOT_VERIFIER"; do
	printf '#!/bin/bash\nexit 0\n' >"$stable_program"
	chmod 0755 "$stable_program"
done

cat >"$MOCK_BIN/stat" <<'STUB'
#!/usr/bin/env bash
set -Eeuo pipefail
path="${@: -1}"
case "${GUARD_TEST_METADATA_FAILURE:-}:$path" in
	policy-mode:*/las-trust-v1) printf '0:0:600\n'; exit 0 ;;
	receipt-mode:*/las-compatible-releases-v3/sha-* | receipt-mode:*/las-compatible-releases-v2/sha-*) printf '0:0:600\n'; exit 0 ;;
esac
case "$path" in
	*/etc/yonaris | */las-compatible-releases-v3 | */las-compatible-releases-v2 | */libexec/yonaris-las)
		printf '0:0:755\n' ;;
	*/.git) printf '0:0:700\n' ;;
	*/var/lib/yonaris) printf '0:0:711\n' ;;
	*/las-trust-v1 | */las-compatible-releases-v3/sha-* | */las-compatible-releases-v2/sha-*) printf '0:0:644\n' ;;
	*/dispatch-las-command | */guard-artifact-output-release | */manage-las-release-state | \
	*/manage-las-runtime | */manage-las-caddy | \
	*/install-yonaris-las-trust-policy | */verify-yonaris-las-forced-command | \
	*/produce-las-migration-readiness)
		printf '0:0:755\n' ;;
	*) exec "$REAL_STAT" "$@" ;;
esac
STUB
cat >"$MOCK_BIN/readlink" <<'STUB'
#!/usr/bin/env bash
set -Eeuo pipefail
path="${@: -1}"
if [[ "${GUARD_TEST_METADATA_FAILURE:-}" == policy-symlink && "$path" == */las-trust-v1 ]]; then
	printf '%s.target\n' "$path"
	exit 0
fi
exec "$REAL_READLINK" "$@"
STUB
chmod +x "$MOCK_BIN/stat" "$MOCK_BIN/readlink"

sed \
	-e "s#readonly STATE_DIRECTORY='/var/lib/yonaris'#readonly STATE_DIRECTORY='$STATE_ROOT'#g" \
	-e "s#/var/lib/yonaris/las-objects.git#$GIT_ROOT/.git#g" \
	-e "s#/etc/yonaris/las-compatible-releases-v3#$RECEIPT_ROOT#g" \
	-e "s#/etc/yonaris/las-compatible-releases-v2#$LEGACY_RECEIPT_ROOT#g" \
	-e "s#/etc/yonaris/las-trust-v1#$TRUST_POLICY#g" \
	-e "s#'/etc/yonaris'#'$TRUST_DIRECTORY'#g" \
	-e "s#/usr/local/libexec/yonaris-las#$STABLE_DIRECTORY#g" \
	-e "s#/usr/local/sbin/install-yonaris-las-trust-policy#$STABLE_INSTALLER#g" \
	-e "s#/usr/local/sbin/verify-yonaris-las-forced-command#$ROOT_VERIFIER#g" \
	-e "s#/usr/bin/stat#$MOCK_BIN/stat#g" \
	-e "s#/usr/bin/readlink#$MOCK_BIN/readlink#g" \
	-e "s#/usr/bin/git#$REAL_GIT#g" \
	"$GUARD_SOURCE" >"$STABLE_GUARD"
chmod 0755 "$STABLE_GUARD"

policy_line() {
	local release="$1" operation="$2"
	printf 'allow sha-%s %s web-sha256 %s worker-sha256 %s migrate-sha256 %s postgres-sha256 %s\n' \
		"$release" "$operation" "$DIGEST_WEB" "$DIGEST_WORKER" "$DIGEST_MIGRATE" "$DIGEST_POSTGRES"
}

write_policy() {
	{
		printf '%s\n' \
			'yonaris-las-trust-v1' \
			'actions-key-fingerprint SHA256:gM/QEgkfN99cP/Cf9awUOwSb7FMesQTgRCTI9kPh84A' \
			"dispatcher-sha256 $(sha256sum "$STABLE_DISPATCHER" | awk '{print $1}')" \
			"guard-sha256 $(sha256sum "$STABLE_GUARD" | awk '{print $1}')" \
			"installer-sha256 $(sha256sum "$STABLE_INSTALLER" | awk '{print $1}')" \
			"state-manager-sha256 $(sha256sum "$STABLE_STATE_MANAGER" | awk '{print $1}')" \
			"runtime-manager-sha256 $(sha256sum "$STABLE_RUNTIME_MANAGER" | awk '{print $1}')" \
			"caddy-manager-sha256 $(sha256sum "$STABLE_CADDY_MANAGER" | awk '{print $1}')" \
			"verifier-sha256 $(sha256sum "$ROOT_VERIFIER" | awk '{print $1}')"
		printf '%s\n' "migration-readiness-producer-sha256 $(sha256sum "$STABLE_PRODUCER" | awk '{print $1}')"
		policy_line "$COMPATIBLE_SHA" deploy
		policy_line "$COMPATIBLE_SHA" rollback
		policy_line "$MALFORMED_SHA" deploy
	} >"$TRUST_POLICY"
	chmod 0644 "$TRUST_POLICY"
}
write_policy

run_guard() {
	env -i PATH='/usr/bin:/bin' HOME='/nonexistent' \
		REAL_STAT="$REAL_STAT" REAL_READLINK="$REAL_READLINK" \
		GUARD_TEST_METADATA_FAILURE="${GUARD_TEST_METADATA_FAILURE:-}" \
		/bin/bash --noprofile --norc -p "$STABLE_GUARD" "$@"
}

expected="release-digests-v2 sha-$COMPATIBLE_SHA deploy $DIGEST_WEB $DIGEST_WORKER $DIGEST_MIGRATE $DIGEST_POSTGRES"
[[ "$(run_guard candidate "sha-$COMPATIBLE_SHA" deploy)" == "$expected" ]]

# Dirty checkout bytes, filters, hooks, replace refs, and shell startup payloads
# cannot change the exact commit blob read by the stable guard.
printf '%s\n' 'dirty-checkout-attack' >"$GIT_ROOT/deploy/las/artifact-output-language-compatible"
hook_marker="$TEST_ROOT/hook-executed"
filter_marker="$TEST_ROOT/filter-executed"
bash_env_marker="$TEST_ROOT/bash-env-executed"
printf '#!/bin/bash\ntouch %q\n' "$hook_marker" >"$GIT_ROOT/.git/hooks/post-checkout"
chmod +x "$GIT_ROOT/.git/hooks/post-checkout"
git -C "$GIT_ROOT" config filter.attack.smudge "touch $filter_marker"
git -C "$GIT_ROOT" replace "$COMPATIBLE_SHA" "$MALFORMED_SHA"
printf 'touch %q\n' "$bash_env_marker" >"$TEST_ROOT/bash-env"
output="$(env BASH_ENV="$TEST_ROOT/bash-env" \
	/usr/bin/env -i PATH='/usr/bin:/bin' HOME='/nonexistent' \
	REAL_STAT="$REAL_STAT" REAL_READLINK="$REAL_READLINK" \
	/bin/bash --noprofile --norc -p "$STABLE_GUARD" candidate "sha-$COMPATIBLE_SHA" deploy)"
[[ "$output" == "$expected" ]]
[[ ! -e "$hook_marker" && ! -e "$filter_marker" && ! -e "$bash_env_marker" ]]

assert_local_store_rejected() {
	local label="$1" status
	set +e
	run_guard candidate "sha-$COMPATIBLE_SHA" deploy \
		>"$TEST_ROOT/$label.out" 2>"$TEST_ROOT/$label.err"
	status=$?
	set -e
	[[ "$status" -ne 0 ]] || {
		echo "Guard accepted non-local Git object-store fixture: $label" >&2
		exit 1
	}
}

# Root Git reads are offline-only even when every requested object is already
# present. Repository-local remote, partial-clone, promisor, and alternate
# configuration is rejected instead of relying on a later protocol failure.
git -C "$GIT_ROOT" config remote.audit.url 'https://git.invalid/yonaris.git'
assert_local_store_rejected remote-config
git -C "$GIT_ROOT" config --remove-section remote.audit

git -C "$GIT_ROOT" config core.repositoryformatversion 1
git -C "$GIT_ROOT" config extensions.partialClone audit
assert_local_store_rejected partial-clone-config
git -C "$GIT_ROOT" config --unset-all extensions.partialClone
git -C "$GIT_ROOT" config core.repositoryformatversion 0

git -C "$GIT_ROOT" config remote.cache.promisor true
assert_local_store_rejected promisor-config
git -C "$GIT_ROOT" config --remove-section remote.cache

mkdir -p "$GIT_ROOT/.git/objects/pack"
touch "$GIT_ROOT/.git/objects/pack/pack-0000000000000000000000000000000000000000.promisor"
assert_local_store_rejected promisor-pack
rm -f "$GIT_ROOT/.git/objects/pack/pack-0000000000000000000000000000000000000000.promisor"

printf '%s\n' "$TEST_ROOT/external-object-store/objects" >"$GIT_ROOT/.git/objects/info/alternates"
assert_local_store_rejected alternate-object-store
rm -f "$GIT_ROOT/.git/objects/info/alternates"

# Missing objects cannot be completed from the network or another object store.
capability_object="$GIT_ROOT/.git/objects/${CAPABILITY_BLOB_SHA:0:2}/${CAPABILITY_BLOB_SHA:2}"
capability_object_backup="$TEST_ROOT/capability-object.backup"
cp -- "$capability_object" "$capability_object_backup"
rm -f -- "$capability_object"
assert_local_store_rejected missing-object
cp -- "$capability_object_backup" "$capability_object"

set +e
run_guard candidate "sha-$MALFORMED_SHA" deploy >/dev/null 2>&1
malformed_status=$?
run_guard candidate "sha-$COMPATIBLE_SHA" marketing-deploy >/dev/null 2>&1
wrong_operation_status=$?
set -e
[[ "$malformed_status" -ne 0 && "$wrong_operation_status" -ne 0 ]]

receipt="$RECEIPT_ROOT/sha-$COMPATIBLE_SHA"
printf 'artifact-output-language-receipt-v3\nrelease sha-%s\nweb-sha256 %s\nworker-sha256 %s\nmigrate-sha256 %s\npostgres-sha256 %s\n' \
	"$COMPATIBLE_SHA" "$DIGEST_WEB" "$DIGEST_WORKER" "$DIGEST_MIGRATE" "$DIGEST_POSTGRES" >"$receipt"
chmod 0644 "$receipt"
[[ "$(run_guard rollback "sha-$COMPATIBLE_SHA")" == \
	"release-digests-v2 sha-$COMPATIBLE_SHA rollback $DIGEST_WEB $DIGEST_WORKER $DIGEST_MIGRATE $DIGEST_POSTGRES" ]]

rm -f -- "$receipt"
legacy_receipt="$LEGACY_RECEIPT_ROOT/sha-$COMPATIBLE_SHA"
printf 'artifact-output-language-receipt-v2\nrelease sha-%s\nweb-sha256 %s\nworker-sha256 %s\nmigrate-sha256 %s\npostgres-sha256 %s\nwww-sha256 %s\n' \
	"$COMPATIBLE_SHA" "$DIGEST_WEB" "$DIGEST_WORKER" "$DIGEST_MIGRATE" "$DIGEST_POSTGRES" "$DIGEST_WWW" >"$legacy_receipt"
chmod 0644 "$legacy_receipt"
[[ "$(run_guard rollback "sha-$COMPATIBLE_SHA")" == \
	"release-digests-v2 sha-$COMPATIBLE_SHA rollback $DIGEST_WEB $DIGEST_WORKER $DIGEST_MIGRATE $DIGEST_POSTGRES" ]]

printf '%s\n' 'tampered' >>"$legacy_receipt"
set +e
run_guard rollback "sha-$COMPATIBLE_SHA" >/dev/null 2>&1
tampered_receipt_status=$?
set -e
[[ "$tampered_receipt_status" -ne 0 ]]

write_policy
policy_line "$COMPATIBLE_SHA" deploy >>"$TRUST_POLICY"
set +e
run_guard candidate "sha-$COMPATIBLE_SHA" deploy >/dev/null 2>&1
duplicate_status=$?
set -e
[[ "$duplicate_status" -ne 0 ]]

write_policy
printf 'allow sha-%s deploy web-sha256 %s worker-sha256 %s migrate-sha256 %s postgres-sha256 %s www-sha256 %s\n' \
	"$COMPATIBLE_SHA" "$DIGEST_WEB" "$DIGEST_WORKER" "$DIGEST_MIGRATE" "$DIGEST_POSTGRES" "$DIGEST_WWW" \
	>>"$TRUST_POLICY"
set +e
run_guard candidate "sha-$COMPATIBLE_SHA" deploy >/dev/null 2>&1
same_sha_digest_status=$?
set -e
[[ "$same_sha_digest_status" -ne 0 ]]

write_policy
policy_line "$COMPATIBLE_SHA" marketing-deploy >>"$TRUST_POLICY"
set +e
run_guard candidate "sha-$COMPATIBLE_SHA" deploy >/dev/null 2>&1
marketing_policy_status=$?
set -e
[[ "$marketing_policy_status" -ne 0 ]]

write_policy
GUARD_TEST_METADATA_FAILURE=policy-symlink
set +e
run_guard candidate "sha-$COMPATIBLE_SHA" deploy >/dev/null 2>&1
symlink_status=$?
set -e
unset GUARD_TEST_METADATA_FAILURE
[[ "$symlink_status" -ne 0 ]]

echo 'digest-bound exact-object guard tests passed'
