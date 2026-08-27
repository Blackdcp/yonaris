#!/usr/bin/env bash

set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
INSTALLER_SOURCE="$SCRIPT_DIR/install-las-trust-policy.sh"
TEST_ROOT="$(mktemp -d)"
trap 'rm -rf -- "$TEST_ROOT"' EXIT

TRUST_DIRECTORY="$TEST_ROOT/etc/yonaris"
STAGING_POLICY="$TRUST_DIRECTORY/.las-trust-v1.new"
LIVE_POLICY="$TRUST_DIRECTORY/las-trust-v1"
ROLLBACK_POLICY="$TRUST_DIRECTORY/.las-trust-v1.rollback"
STATE_ROOT="$TEST_ROOT/var/lib/yonaris"
GIT_ROOT="$STATE_ROOT/source"
STABLE_DIRECTORY="$TEST_ROOT/usr/local/libexec/yonaris-las"
STABLE_DISPATCHER="$STABLE_DIRECTORY/dispatch-las-command"
STABLE_GUARD="$STABLE_DIRECTORY/guard-artifact-output-release"
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
REAL_MV="$(command -v mv)"
DIGEST_WEB='sha256:1111111111111111111111111111111111111111111111111111111111111111'
DIGEST_WORKER='sha256:2222222222222222222222222222222222222222222222222222222222222222'
DIGEST_MIGRATE='sha256:3333333333333333333333333333333333333333333333333333333333333333'
DIGEST_POSTGRES='sha256:4444444444444444444444444444444444444444444444444444444444444444'
DIGEST_WWW='sha256:5555555555555555555555555555555555555555555555555555555555555555'

mkdir -p "$TRUST_DIRECTORY" "$GIT_ROOT/deploy/las" "$STABLE_DIRECTORY" \
	"$(dirname -- "$STABLE_INSTALLER")" "$MOCK_BIN"
git -C "$GIT_ROOT" init --quiet
git -C "$GIT_ROOT" config user.email test@yonaris.invalid
git -C "$GIT_ROOT" config user.name 'Yonaris installer test'
git -C "$GIT_ROOT" config core.autocrlf false
printf '%s\n' 'artifact-output-language-v1' >"$GIT_ROOT/deploy/las/artifact-output-language-compatible"
git -C "$GIT_ROOT" add .
git -C "$GIT_ROOT" commit --quiet -m compatible
RELEASE_SHA="$(git -C "$GIT_ROOT" rev-parse HEAD)"
printf '%s\n' 'malformed' >"$GIT_ROOT/deploy/las/artifact-output-language-compatible"
git -C "$GIT_ROOT" add .
git -C "$GIT_ROOT" commit --quiet -m replacement
REPLACEMENT_SHA="$(git -C "$GIT_ROOT" rev-parse HEAD)"
CAPABILITY_BLOB_SHA="$(git -C "$GIT_ROOT" rev-parse "$RELEASE_SHA:deploy/las/artifact-output-language-compatible")"
git -C "$GIT_ROOT" replace "$RELEASE_SHA" "$REPLACEMENT_SHA"

for program in "$STABLE_DISPATCHER" "$STABLE_GUARD" "$STABLE_STATE_MANAGER" \
	"$STABLE_RUNTIME_MANAGER" "$STABLE_CADDY_MANAGER" "$STABLE_PRODUCER"; do
	printf '#!/bin/bash\nexit 0\n' >"$program"
	chmod 0755 "$program"
done
cat >"$ROOT_VERIFIER" <<'STUB'
#!/usr/bin/env bash
[[ "${INSTALLER_TEST_POSTVERIFY:-success}" == success ]]
STUB
chmod 0755 "$ROOT_VERIFIER"

cat >"$MOCK_BIN/id" <<'STUB'
#!/usr/bin/env bash
[[ "$*" == -u ]] || exit 2
printf '0\n'
STUB
cat >"$MOCK_BIN/stat" <<'STUB'
#!/usr/bin/env bash
set -Eeuo pipefail
format=''; path="${@: -1}"
[[ "${1:-}" == -c ]] && format="$2"
if [[ "$format" == '%h' ]]; then exec "$REAL_STAT" "$@"; fi
case "${INSTALLER_TEST_METADATA_FAILURE:-}:$path" in
	parent-writable:*/etc/yonaris) printf '0:0:777\n'; exit 0 ;;
esac
case "$path" in
	*/etc/yonaris) printf '0:0:755\n' ;;
	*/var/lib/yonaris) printf '0:0:711\n' ;;
	*/.git) printf '0:0:700\n' ;;
	*/.las-trust-v1.new) printf '0:0:600\n' ;;
	*/las-trust-v1) printf '0:0:644\n' ;;
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
if [[ "${INSTALLER_TEST_METADATA_FAILURE:-}" == staging-symlink && "$path" == */.las-trust-v1.new ]]; then
	printf '%s.target\n' "$path"; exit 0
fi
exec "$REAL_READLINK" "$@"
STUB
cat >"$MOCK_BIN/mv" <<'STUB'
#!/usr/bin/env bash
set -Eeuo pipefail
if [[ "${INSTALLER_TEST_MV_FAILURE:-}" == staging && "$*" == *'.las-trust-v1.new'*'las-trust-v1'* ]]; then
	exit 91
fi
exec "$REAL_MV" "$@"
STUB
cat >"$MOCK_BIN/sync" <<'STUB'
#!/usr/bin/env bash
[[ "${INSTALLER_TEST_SYNC_FAILURE:-}" != yes ]]
STUB
chmod +x "$MOCK_BIN"/*

sed \
	-e "s#/etc/yonaris#$TRUST_DIRECTORY#g" \
	-e "s#readonly STATE_DIRECTORY='/var/lib/yonaris'#readonly STATE_DIRECTORY='$STATE_ROOT'#g" \
	-e "s#/var/lib/yonaris/las-objects.git#$GIT_ROOT/.git#g" \
	-e "s#/usr/local/libexec/yonaris-las#$STABLE_DIRECTORY#g" \
	-e "s#/usr/local/sbin/install-yonaris-las-trust-policy#$STABLE_INSTALLER#g" \
	-e "s#/usr/local/sbin/verify-yonaris-las-forced-command#$ROOT_VERIFIER#g" \
	-e "s#/usr/bin/id#$MOCK_BIN/id#g" \
	-e "s#/usr/bin/stat#$MOCK_BIN/stat#g" \
	-e "s#/usr/bin/readlink#$MOCK_BIN/readlink#g" \
	-e "s#/usr/bin/git#$REAL_GIT#g" \
	-e "s#/usr/bin/mv#$MOCK_BIN/mv#g" \
	-e "s#/usr/bin/sync#$MOCK_BIN/sync#g" \
	"$INSTALLER_SOURCE" >"$STABLE_INSTALLER"
chmod 0755 "$STABLE_INSTALLER"

policy() {
	local operation="$1"
	printf '%s\n' \
		'yonaris-las-trust-v1' \
		'actions-key-fingerprint SHA256:gM/QEgkfN99cP/Cf9awUOwSb7FMesQTgRCTI9kPh84A' \
		"dispatcher-sha256 $(sha256sum "$STABLE_DISPATCHER" | awk '{print $1}')" \
		"guard-sha256 $(sha256sum "$STABLE_GUARD" | awk '{print $1}')" \
		"installer-sha256 $(sha256sum "$STABLE_INSTALLER" | awk '{print $1}')" \
		"state-manager-sha256 $(sha256sum "$STABLE_STATE_MANAGER" | awk '{print $1}')" \
		"runtime-manager-sha256 $(sha256sum "$STABLE_RUNTIME_MANAGER" | awk '{print $1}')" \
		"caddy-manager-sha256 $(sha256sum "$STABLE_CADDY_MANAGER" | awk '{print $1}')" \
		"verifier-sha256 $(sha256sum "$ROOT_VERIFIER" | awk '{print $1}')" \
		"migration-readiness-producer-sha256 $(sha256sum "$STABLE_PRODUCER" | awk '{print $1}')" \
		"allow sha-$RELEASE_SHA $operation web-sha256 $DIGEST_WEB worker-sha256 $DIGEST_WORKER migrate-sha256 $DIGEST_MIGRATE postgres-sha256 $DIGEST_POSTGRES www-sha256 $DIGEST_WWW"
}

reset_policies() {
	rm -f "$STAGING_POLICY" "$LIVE_POLICY" "$ROLLBACK_POLICY"
	policy rollback >"$LIVE_POLICY"
	policy deploy >"$STAGING_POLICY"
	chmod 0644 "$LIVE_POLICY"
	chmod 0600 "$STAGING_POLICY"
}

run_installer() {
	env -i PATH='/usr/bin:/bin' HOME='/nonexistent' \
		REAL_STAT="$REAL_STAT" REAL_READLINK="$REAL_READLINK" REAL_MV="$REAL_MV" \
		INSTALLER_TEST_METADATA_FAILURE="${INSTALLER_TEST_METADATA_FAILURE:-}" \
		INSTALLER_TEST_MV_FAILURE="${INSTALLER_TEST_MV_FAILURE:-}" \
		INSTALLER_TEST_SYNC_FAILURE="${INSTALLER_TEST_SYNC_FAILURE:-}" \
		INSTALLER_TEST_POSTVERIFY="${INSTALLER_TEST_POSTVERIFY:-success}" \
		SUDO_USER="${INSTALLER_TEST_SUDO_USER:-}" \
		/bin/bash --noprofile --norc -p "$STABLE_INSTALLER" "$@"
}

assert_rejected_unchanged() {
	local name="$1"; shift
	local before="$(sha256sum "$LIVE_POLICY" | awk '{print $1}')"
	set +e
	"$@" >"$TEST_ROOT/$name.out" 2>"$TEST_ROOT/$name.err"
	local status=$?
	set -e
	local after="$(sha256sum "$LIVE_POLICY" | awk '{print $1}')"
	[[ "$status" -ne 0 && "$before" == "$after" ]] || {
		echo "Installer changed live policy for rejected case $name" >&2; exit 1;
	}
}

# `git replace` points the authorized SHA at a malformed commit, but the root
# installer validates the original exact object and successfully installs it.
reset_policies
run_installer
grep -Fq "sha-$RELEASE_SHA deploy" "$LIVE_POLICY"
[[ ! -e "$STAGING_POLICY" && ! -e "$ROLLBACK_POLICY" ]]

# Installing policy never turns a root Git read into an implicit fetch or a
# read from another object database. Every rejected case preserves live policy.
reset_policies
git -C "$GIT_ROOT" config remote.audit.url 'https://git.invalid/yonaris.git'
assert_rejected_unchanged remote-config run_installer
git -C "$GIT_ROOT" config --remove-section remote.audit

reset_policies
git -C "$GIT_ROOT" config core.repositoryformatversion 1
git -C "$GIT_ROOT" config extensions.partialClone audit
assert_rejected_unchanged partial-clone-config run_installer
git -C "$GIT_ROOT" config --unset-all extensions.partialClone
git -C "$GIT_ROOT" config core.repositoryformatversion 0

reset_policies
git -C "$GIT_ROOT" config remote.cache.promisor true
assert_rejected_unchanged promisor-config run_installer
git -C "$GIT_ROOT" config --remove-section remote.cache

reset_policies
mkdir -p "$GIT_ROOT/.git/objects/pack"
touch "$GIT_ROOT/.git/objects/pack/pack-0000000000000000000000000000000000000000.promisor"
assert_rejected_unchanged promisor-pack run_installer
rm -f "$GIT_ROOT/.git/objects/pack/pack-0000000000000000000000000000000000000000.promisor"

reset_policies
printf '%s\n' "$TEST_ROOT/external-object-store/objects" >"$GIT_ROOT/.git/objects/info/alternates"
assert_rejected_unchanged alternate-object-store run_installer
rm -f "$GIT_ROOT/.git/objects/info/alternates"

reset_policies
capability_object="$GIT_ROOT/.git/objects/${CAPABILITY_BLOB_SHA:0:2}/${CAPABILITY_BLOB_SHA:2}"
capability_object_backup="$TEST_ROOT/capability-object.backup"
cp -- "$capability_object" "$capability_object_backup"
rm -f -- "$capability_object"
assert_rejected_unchanged missing-object run_installer
cp -- "$capability_object_backup" "$capability_object"

reset_policies
INSTALLER_TEST_SUDO_USER=yonaris-deploy
assert_rejected_unchanged deploy-sudo run_installer
unset INSTALLER_TEST_SUDO_USER
assert_rejected_unchanged arbitrary-path run_installer "$TEST_ROOT/other-policy"

for failure in parent-writable staging-symlink; do
	reset_policies
	INSTALLER_TEST_METADATA_FAILURE="$failure"
	assert_rejected_unchanged "$failure" run_installer
	unset INSTALLER_TEST_METADATA_FAILURE
done

reset_policies
hardlink="$TEST_ROOT/staging-hardlink"
ln "$STAGING_POLICY" "$hardlink"
assert_rejected_unchanged staging-hardlink run_installer
rm -f "$hardlink"

reset_policies
policy deploy >>"$STAGING_POLICY"
assert_rejected_unchanged duplicate-entry run_installer

reset_policies
sed -i 's/ deploy / unknown-operation /' "$STAGING_POLICY"
assert_rejected_unchanged unknown-operation run_installer

reset_policies
sed -i 's/sha256:5555555555555555555555555555555555555555555555555555555555555555/tag-latest/' "$STAGING_POLICY"
assert_rejected_unchanged invalid-digest run_installer

reset_policies
policy marketing-deploy | tail -n 1 | \
	sed "s#$DIGEST_WWW#sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa#" \
	>>"$STAGING_POLICY"
assert_rejected_unchanged same-sha-digest-conflict run_installer

reset_policies
INSTALLER_TEST_POSTVERIFY=failure
assert_rejected_unchanged postverify-rollback run_installer
unset INSTALLER_TEST_POSTVERIFY
[[ ! -e "$ROLLBACK_POLICY" ]]

reset_policies
INSTALLER_TEST_MV_FAILURE=staging
assert_rejected_unchanged atomic-rename run_installer
unset INSTALLER_TEST_MV_FAILURE

echo 'root-local atomic LAS trust-policy installer tests passed'
