#!/usr/bin/env bash

set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
MANAGER_SOURCE="$SCRIPT_DIR/manage-las-release-state.sh"
TEST_ROOT="$(mktemp -d)"
trap 'chmod -R u+w "$TEST_ROOT" 2>/dev/null || true; rm -rf -- "$TEST_ROOT"' EXIT

# Exact-tree extraction must reject dot path components before any root write;
# a raw Git tree is not a trusted filesystem path namespace.
grep -Fq 'safe_object_path "$object_path"' "$MANAGER_SOURCE"
grep -Fq '[[ -n "$candidate" && "$candidate" != /* && "$candidate" != */ ]]' "$MANAGER_SOURCE"
grep -Fq '[[ -n "$component" && "$component" != . && "$component" != .. ]]' "$MANAGER_SOURCE"
if grep -Fq '^[A-Za-z0-9._@+-]' "$MANAGER_SOURCE"; then
	echo 'Exact-tree path validation regressed to a character whitelist.' >&2
	exit 1
fi

SAFE_PATH_HELPER="$TEST_ROOT/safe-object-path"
{
	printf '%s\n' '#!/usr/bin/env bash' 'set -Eeuo pipefail'
	sed -n '/^safe_object_path() {/,/^}/p' "$MANAGER_SOURCE"
	printf '%s\n' 'safe_object_path "$1"'
} >"$SAFE_PATH_HELPER"
chmod 0755 "$SAFE_PATH_HELPER"
"$SAFE_PATH_HELPER" 'customer data/[CN]/price $5.txt'
for unsafe_path in '' '/absolute' 'trailing/' 'double//slash' '.' '..' 'a/./b' 'a/../b' \
	$'line\nbreak' $'tab\tbreak' $'carriage\rbreak'; do
	if "$SAFE_PATH_HELPER" "$unsafe_path"; then
		echo 'Exact-tree path validation accepted an unsafe structural component.' >&2
		exit 1
	fi
done

TRUST_DIRECTORY="$TEST_ROOT/etc/yonaris"
ACTIVATION="$TRUST_DIRECTORY/artifact-output-language-active-v1"
JOURNAL="$TRUST_DIRECTORY/las-transition-pending-v1"
STABLE_BUNDLE_JOURNAL="$TRUST_DIRECTORY/las-stable-bundle-pending-v1"
RECEIPT_ROOT="$TRUST_DIRECTORY/las-compatible-releases-v2"
CADDY_BACKUP_ROOT="$TRUST_DIRECTORY/las-caddy-transition-backups-v1"
MIGRATION_READINESS_ROOT="$TRUST_DIRECTORY/las-migration-readiness-v1"
MIGRATION_EVIDENCE_ROOT="$TRUST_DIRECTORY/las-migration-evidence-v1"
CADDY_DIRECTORY="$TEST_ROOT/etc/caddy"
CADDY_TARGET="$CADDY_DIRECTORY/Caddyfile"
PORTAL_RELEASE="$TRUST_DIRECTORY/las-active-portal-release-v1"
MARKETING_RELEASE="$TRUST_DIRECTORY/las-active-marketing-release-v1"
DEPLOY_ROOT="$TEST_ROOT/opt/yonaris"
GIT_ROOT="$TEST_ROOT/var/lib/yonaris/las-objects.git"
TREE_ROOT="$TEST_ROOT/var/lib/yonaris/las-release-trees"
BINDING_ROOT="$TREE_ROOT/.bindings"
STABLE_DIRECTORY="$TEST_ROOT/usr/local/libexec/yonaris-las"
MANAGER="$STABLE_DIRECTORY/manage-las-release-state"
STABLE_GUARD="$STABLE_DIRECTORY/guard-artifact-output-release"
STABLE_RUNTIME_MANAGER="$STABLE_DIRECTORY/manage-las-runtime"
STABLE_CADDY_MANAGER="$STABLE_DIRECTORY/manage-las-caddy"
ROOT_VERIFIER="$TEST_ROOT/usr/local/sbin/verify-yonaris-las-forced-command"
MOCK_BIN="$TEST_ROOT/mock-bin"
REAL_STAT="$(command -v stat)"
REAL_READLINK="$(command -v readlink)"
REAL_GIT="$(command -v git)"
REAL_MV="$(command -v mv)"
WEB='sha256:1111111111111111111111111111111111111111111111111111111111111111'
WORKER='sha256:2222222222222222222222222222222222222222222222222222222222222222'
MIGRATE='sha256:3333333333333333333333333333333333333333333333333333333333333333'
POSTGRES='sha256:4444444444444444444444444444444444444444444444444444444444444444'
WWW='sha256:5555555555555555555555555555555555555555555555555555555555555555'

mkdir -p "$TRUST_DIRECTORY" "$RECEIPT_ROOT" "$CADDY_BACKUP_ROOT" "$MIGRATION_READINESS_ROOT" \
	"$MIGRATION_EVIDENCE_ROOT" "$CADDY_DIRECTORY" "$DEPLOY_ROOT" "$TREE_ROOT" \
	"$BINDING_ROOT" "$STABLE_DIRECTORY" "$(dirname -- "$ROOT_VERIFIER")" \
	"$(dirname -- "$GIT_ROOT")" "$MOCK_BIN"
git init --bare --quiet "$GIT_ROOT"
WORK_REPO="$TEST_ROOT/work"
git init --quiet "$WORK_REPO"
git -C "$WORK_REPO" config user.email test@yonaris.invalid
git -C "$WORK_REPO" config user.name 'Yonaris state test'
git -C "$WORK_REPO" config core.autocrlf false
mkdir -p "$WORK_REPO/deploy/las/bin"
printf '#!/bin/bash\nprintf predecessor\n' >"$WORK_REPO/deploy/las/bin/deploy.sh"
printf '#!/bin/bash\nprintf predecessor-marketing\n' >"$WORK_REPO/deploy/las/bin/deploy-marketing.sh"
mkdir -p "$WORK_REPO/customer data/[CN]"
printf '%s\n' 'literal-dollar-path' >"$WORK_REPO/customer data/[CN]/price \$5.txt"
chmod +x "$WORK_REPO/deploy/las/bin"/*.sh
git -C "$WORK_REPO" add .
git -C "$WORK_REPO" commit --quiet -m predecessor
PREDECESSOR_SHA="$(git -C "$WORK_REPO" rev-parse HEAD)"
printf '#!/bin/bash\nprintf exact-candidate\n' >"$WORK_REPO/deploy/las/bin/deploy.sh"
git -C "$WORK_REPO" add .
git -C "$WORK_REPO" commit --quiet -m candidate
CANDIDATE_SHA="$(git -C "$WORK_REPO" rev-parse HEAD)"
printf '#!/bin/bash\nprintf replacement-attack\n' >"$WORK_REPO/deploy/las/bin/deploy.sh"
git -C "$WORK_REPO" add .
git -C "$WORK_REPO" commit --quiet -m replacement
REPLACEMENT_SHA="$(git -C "$WORK_REPO" rev-parse HEAD)"
BINDING_CRASH_TREE="$(git -C "$WORK_REPO" rev-parse "$CANDIDATE_SHA^{tree}")"
BINDING_CRASH_SHA="$(printf '%s\n' 'binding crash fixture' | \
	git -C "$WORK_REPO" commit-tree "$BINDING_CRASH_TREE" -p "$CANDIDATE_SHA")"
CORRUPT_ORPHAN_SHA="$(printf '%s\n' 'corrupt orphan fixture' | \
	git -C "$WORK_REPO" commit-tree "$BINDING_CRASH_TREE" -p "$BINDING_CRASH_SHA")"
CANDIDATE_DEPLOY_BLOB_SHA="$(git -C "$WORK_REPO" rev-parse "$CANDIDATE_SHA:deploy/las/bin/deploy.sh")"
git -C "$WORK_REPO" push --quiet "$GIT_ROOT" \
	"$PREDECESSOR_SHA:refs/heads/predecessor" \
	"$CANDIDATE_SHA:refs/heads/candidate" \
	"$REPLACEMENT_SHA:refs/heads/replacement" \
	"$BINDING_CRASH_SHA:refs/heads/binding-crash" \
	"$CORRUPT_ORPHAN_SHA:refs/heads/corrupt-orphan"
git --git-dir="$GIT_ROOT" replace "$CANDIDATE_SHA" "$REPLACEMENT_SHA"
printf '#!/bin/bash\nprintf dirty-checkout-attack\n' >"$WORK_REPO/deploy/las/bin/deploy.sh"
printf 'initial caddy\n' >"$CADDY_TARGET"

cat >"$ROOT_VERIFIER" <<'STUB'
#!/usr/bin/env bash
printf 'verifier %s\n' "$*" >>'__TEST_ROOT__/bootstrap-events.log'
[[ ! -e '__TEST_ROOT__/verifier-fail' ]] || exit 1
case "$#" in
	0) ;;
	1) [[ "$1" == preactivate-output-language && ! -e '__TEST_ROOT__/preactivation-fail' ]] ;;
	*) exit 2 ;;
esac
STUB
sed -i "s#__TEST_ROOT__#$TEST_ROOT#g" "$ROOT_VERIFIER"
cat >"$STABLE_GUARD" <<STUB
#!/usr/bin/env bash
printf 'guard %s\n' "\$*" >>'$TEST_ROOT/bootstrap-events.log'
if [[ "\$1" == rollback && "\$2" == sha-* ]]; then [[ ! -e '$TEST_ROOT/rollback-guard-bad' ]]; exit; fi
[[ "\$1" == candidate && "\$2" == sha-* && ( "\$3" == deploy || "\$3" == marketing-deploy ) ]] || exit 2
if [[ -e '$TEST_ROOT/guard-bad' ]]; then bad='sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'; else bad='$WEB'; fi
printf 'release-digests-v1 %s %s %s %s %s %s %s\n' "\$2" "\$3" "\$bad" '$WORKER' '$MIGRATE' '$POSTGRES' '$WWW'
STUB
cat >"$STABLE_RUNTIME_MANAGER" <<STUB
#!/usr/bin/env bash
set -Eeuo pipefail
printf 'runtime %s\n' "\$*" >>'$TEST_ROOT/bootstrap-events.log'
[[ ! -e '$TEST_ROOT/runtime-fail' ]]
STUB
cat >"$STABLE_CADDY_MANAGER" <<STUB
#!/usr/bin/env bash
set -Eeuo pipefail
printf 'caddy %s\n' "\$*" >>'$TEST_ROOT/bootstrap-events.log'
[[ ! -e '$TEST_ROOT/caddy-fail' ]]
STUB
chmod +x "$ROOT_VERIFIER" "$STABLE_GUARD" "$STABLE_RUNTIME_MANAGER" "$STABLE_CADDY_MANAGER"

cat >"$MOCK_BIN/id" <<'STUB'
#!/usr/bin/env bash
[[ "$*" == -u ]] || exit 2
printf '%s\n' "${STATE_TEST_UID:-0}"
STUB
cat >"$MOCK_BIN/chown" <<'STUB'
#!/usr/bin/env bash
exit 0
STUB
cat >"$MOCK_BIN/sync" <<'STUB'
#!/usr/bin/env bash
printf 'sync %s\n' "$*" >>"$STATE_TEST_IO_LOG"
if [[ "${STATE_TEST_SYNC_KILL:-}:$*" == directory:*'/etc/yonaris' ]]; then
	kill -KILL "$PPID"
	exit 137
fi
case "${STATE_TEST_SYNC_FAIL:-no}:${@: -1}" in
	yes:* | file:*/.las-state.* | directory:*/etc/yonaris) exit 92 ;;
esac
STUB
cat >"$MOCK_BIN/mv" <<'STUB'
#!/usr/bin/env bash
set -Eeuo pipefail
source_path="${@: -2:1}"
destination="${@: -1}"
printf 'mv %s\n' "$*" >>"$STATE_TEST_IO_LOG"
root_semantic_mv() {
	if [[ -d "$source_path" && "$destination" == */las-release-trees/sha-* ]]; then
		/usr/bin/chmod u+w -- "$source_path"
		"$REAL_MV" "$@"
		/usr/bin/chmod 0555 -- "$destination"
	else
		"$REAL_MV" "$@"
	fi
}
case "${STATE_TEST_MV_KILL:-}:$destination" in
	tree:*/las-release-trees/sha-* | binding:*/las-release-trees/.bindings/sha-*)
		root_semantic_mv "$@"
		kill -KILL "$PPID"
		exit 137
		;;
esac
case "${STATE_TEST_MV_FAIL:-}:$destination" in
	journal:*/las-transition-pending-v1 | release:*/las-active-portal-release-v1 | \
	release:*/las-active-marketing-release-v1) exit 91 ;;
esac
root_semantic_mv "$@"
STUB
cat >"$MOCK_BIN/readlink" <<'STUB'
#!/usr/bin/env bash
exec "$REAL_READLINK" "$@"
STUB
cat >"$MOCK_BIN/git" <<'STUB'
#!/usr/bin/env bash
set -Eeuo pipefail
if [[ -e "__GIT_FAIL_FILE__" && " $* " == *' ls-tree '* ]]; then
	"__REAL_GIT__" "$@"
	exit 94
fi
exec "__REAL_GIT__" "$@"
STUB
sed -i "s#__REAL_GIT__#$REAL_GIT#g" "$MOCK_BIN/git"
sed -i "s#__GIT_FAIL_FILE__#$TEST_ROOT/git-ls-tree-fail#g" "$MOCK_BIN/git"
cat >"$MOCK_BIN/stat" <<'STUB'
#!/usr/bin/env bash
set -Eeuo pipefail
format="${2:-}"
path="${@: -1}"
if [[ "$format" == '%h' ]]; then
	exec "$REAL_STAT" "$@"
fi
metadata=''
if [[ -d "$path" ]]; then
	case "$path" in
		*/etc/yonaris | */las-compatible-releases-v2 | */etc/caddy) metadata='0:0:755' ;;
		*/las-caddy-transition-backups-v1 | */las-migration-readiness-v1 | \
		*/las-migration-evidence-v1) metadata='0:0:700' ;;
		*/var/lib/yonaris) metadata='0:0:711' ;;
		*/las-objects.git) metadata='0:0:700' ;;
		*/las-release-trees | */las-release-trees/.bindings | */las-release-trees/sha-* | \
		*/.las-tree-sha-*) metadata='0:0:555' ;;
		*) exec "$REAL_STAT" "$@" ;;
	esac
elif [[ -f "$path" ]]; then
	case "$path" in
		*/las-transition-pending-v1 | */las-caddy-bootstrap-pending-v1) metadata='0:0:600' ;;
		*/artifact-output-language-active-v1) metadata='0:0:400' ;;
		*/las-migration-readiness-v1/sha-* | */las-migration-evidence-v1/sha-*.backup | \
		*/las-migration-evidence-v1/sha-*.rehearsal) metadata='0:0:400' ;;
		*/las-compatible-releases-v2/sha-* | */las-active-portal-release-v1 | \
		*/las-active-marketing-release-v1 | */etc/caddy/Caddyfile) metadata='0:0:644' ;;
		*/las-release-trees/.bindings/sha-*) metadata='0:0:444' ;;
		*/las-release-trees/sha-*/* | */.las-tree-sha-*/*)
			if [[ -x "$path" ]]; then metadata='0:0:555'; else metadata='0:0:444'; fi ;;
		*/guard-artifact-output-release | */verify-yonaris-las-forced-command | \
		*/manage-las-runtime | */manage-las-caddy) metadata='0:0:755' ;;
		*) exec "$REAL_STAT" "$@" ;;
	esac
else
	exec "$REAL_STAT" "$@"
fi
if [[ "${STATE_TEST_CHILD_OWNER_BAD:-no}" == yes && \
	"$path" == */las-release-trees/sha-*/deploy/las/bin/deploy.sh ]]; then
	metadata="1001:1001:${metadata##*:}"
fi
if [[ "$format" == '%a' ]]; then
	printf '%s\n' "${metadata##*:}"
else
	printf '%s\n' "$metadata"
fi
STUB
chmod +x "$MOCK_BIN"/*

sed \
	-e "s#/etc/yonaris#$TRUST_DIRECTORY#g" \
	-e "s#/opt/yonaris#$DEPLOY_ROOT#g" \
	-e "s#/var/lib/yonaris#$TEST_ROOT/var/lib/yonaris#g" \
	-e "s#/usr/local/libexec/yonaris-las#$STABLE_DIRECTORY#g" \
	-e "s#/usr/local/sbin/verify-yonaris-las-forced-command#$ROOT_VERIFIER#g" \
	-e "s#/usr/bin/id#$MOCK_BIN/id#g" \
	-e "s#/usr/bin/chown#$MOCK_BIN/chown#g" \
	-e "s#/usr/bin/sync#$MOCK_BIN/sync#g" \
	-e "s#/usr/bin/mv#$MOCK_BIN/mv#g" \
	-e "s#/usr/bin/readlink#$MOCK_BIN/readlink#g" \
	-e "s#/usr/bin/stat#$MOCK_BIN/stat#g" \
	-e "s#/usr/bin/git#$MOCK_BIN/git#g" \
	"$MANAGER_SOURCE" >"$MANAGER"
chmod 0755 "$MANAGER"

run_manager() {
	env -i PATH='/usr/bin:/bin' HOME='/nonexistent' \
		REAL_STAT="$REAL_STAT" REAL_READLINK="$REAL_READLINK" REAL_MV="$REAL_MV" \
		STATE_TEST_UID="${STATE_TEST_UID:-0}" STATE_TEST_MV_FAIL="${STATE_TEST_MV_FAIL:-}" \
		STATE_TEST_MV_KILL="${STATE_TEST_MV_KILL:-}" \
		STATE_TEST_SYNC_FAIL="${STATE_TEST_SYNC_FAIL:-no}" \
		STATE_TEST_SYNC_KILL="${STATE_TEST_SYNC_KILL:-}" \
		STATE_TEST_GUARD_BAD="${STATE_TEST_GUARD_BAD:-no}" \
		STATE_TEST_RUNTIME_FAIL="${STATE_TEST_RUNTIME_FAIL:-no}" \
		STATE_TEST_CADDY_FAIL="${STATE_TEST_CADDY_FAIL:-no}" \
		STATE_TEST_EVENT_LOG="$TEST_ROOT/bootstrap-events.log" \
		STATE_TEST_IO_LOG="$TEST_ROOT/state-io.log" \
		STATE_TEST_CHILD_OWNER_BAD="${STATE_TEST_CHILD_OWNER_BAD:-no}" \
		SUDO_USER="${STATE_TEST_SUDO_USER:-}" \
		/bin/bash --noprofile --norc -p "$MANAGER" "$@"
}

receipt() {
	local release="$1"
	printf 'artifact-output-language-receipt-v2\nrelease %s\nweb-sha256 %s\nworker-sha256 %s\nmigrate-sha256 %s\npostgres-sha256 %s\nwww-sha256 %s\n' \
		"$release" "$WEB" "$WORKER" "$MIGRATE" "$POSTGRES" "$WWW"
}

write_migration_readiness() {
	local release="$1" backup rehearsal
	backup="$MIGRATION_EVIDENCE_ROOT/$release.backup"
	rehearsal="$MIGRATION_EVIDENCE_ROOT/$release.rehearsal"
	printf 'backup evidence for %s\n' "$release" >"$backup"
	printf 'rehearsal evidence for %s\n' "$release" >"$rehearsal"
	chmod 0400 "$backup" "$rehearsal"
	printf '%s\n' \
		'las-migration-readiness-v1' \
		"release $release" \
		"web-sha256 $WEB" \
		"worker-sha256 $WORKER" \
		"migrate-sha256 $MIGRATE" \
		"postgres-sha256 $POSTGRES" \
		"www-sha256 $WWW" \
		"backup-evidence-sha256 $(sha256sum "$backup" | awk '{print $1}')" \
		"rehearsal-evidence-sha256 $(sha256sum "$rehearsal" | awk '{print $1}')" \
		>"$MIGRATION_READINESS_ROOT/$release"
	chmod 0400 "$MIGRATION_READINESS_ROOT/$release"
}

nul_tree_manifest() {
	local tree="$1" entry relative mode digest
	while IFS= read -r -d '' entry; do
		relative="${entry#"$tree"/}"
		if [[ -d "$entry" ]]; then
			mode=555
			printf 'd\0%s\0%s\0' "$mode" "$relative"
		else
			if [[ -x "$entry" ]]; then mode=555; else mode=444; fi
			digest="$(sha256sum -- "$entry" | awk '{print $1}')"
			printf 'f\0%s\0%s\0%s\0' "$mode" "$digest" "$relative"
		fi
	done < <(find "$tree" -mindepth 1 -print0 | LC_ALL=C sort -z)
}

PREDECESSOR="sha-$PREDECESSOR_SHA"
CANDIDATE="sha-$CANDIDATE_SHA"

assert_materialize_rejected_without_tree() {
	local label="$1" release="$2" status
	set +e
	run_manager materialize "$release" >"$TEST_ROOT/$label.out" 2>"$TEST_ROOT/$label.err"
	status=$?
	set -e
	[[ "$status" -ne 0 && ! -e "$TREE_ROOT/$release" && ! -e "$BINDING_ROOT/$release" ]] || {
		printf 'State manager accepted non-local Git object-store fixture: %s (status=%s tree=%s binding=%s)\n' \
			"$label" "$status" "$([[ -e "$TREE_ROOT/$release" ]] && printf yes || printf no)" \
			"$([[ -e "$BINDING_ROOT/$release" ]] && printf yes || printf no)" >&2
		exit 1
	}
}

# Materialization is permitted only from a self-contained local object store.
git --git-dir="$GIT_ROOT" config remote.audit.url 'https://git.invalid/yonaris.git'
assert_materialize_rejected_without_tree remote-config "$PREDECESSOR"
git --git-dir="$GIT_ROOT" config --remove-section remote.audit

git --git-dir="$GIT_ROOT" config core.repositoryformatversion 1
git --git-dir="$GIT_ROOT" config extensions.partialClone audit
assert_materialize_rejected_without_tree partial-clone-config "$PREDECESSOR"
git --git-dir="$GIT_ROOT" config --unset-all extensions.partialClone
git --git-dir="$GIT_ROOT" config core.repositoryformatversion 0

git --git-dir="$GIT_ROOT" config remote.cache.promisor true
assert_materialize_rejected_without_tree promisor-config "$PREDECESSOR"
git --git-dir="$GIT_ROOT" config --remove-section remote.cache

touch "$GIT_ROOT/objects/pack/pack-0000000000000000000000000000000000000000.promisor"
assert_materialize_rejected_without_tree promisor-pack "$PREDECESSOR"
rm -f "$GIT_ROOT/objects/pack/pack-0000000000000000000000000000000000000000.promisor"

printf '%s\n' "$TEST_ROOT/external-object-store/objects" >"$GIT_ROOT/objects/info/alternates"
assert_materialize_rejected_without_tree alternate-object-store "$PREDECESSOR"
rm -f "$GIT_ROOT/objects/info/alternates"

candidate_blob="$GIT_ROOT/objects/${CANDIDATE_DEPLOY_BLOB_SHA:0:2}/${CANDIDATE_DEPLOY_BLOB_SHA:2}"
candidate_blob_backup="$TEST_ROOT/candidate-deploy-blob.backup"
cp -- "$candidate_blob" "$candidate_blob_backup"
rm -f -- "$candidate_blob"
if GIT_NO_LAZY_FETCH=1 git --no-replace-objects --git-dir="$GIT_ROOT" \
	-c protocol.allow=never cat-file -e "$CANDIDATE_DEPLOY_BLOB_SHA" 2>/dev/null; then
	echo 'Missing-object fixture still resolves after removing its loose object.' >&2
	exit 1
fi
assert_materialize_rejected_without_tree missing-object "$CANDIDATE"
cp -- "$candidate_blob_backup" "$candidate_blob"

run_manager materialize "$PREDECESSOR"
run_manager materialize "$CANDIDATE"
expected_candidate_manifest="$(nul_tree_manifest "$TREE_ROOT/$CANDIDATE" | sha256sum | awk '{print $1}')"
cmp -s "$BINDING_ROOT/$CANDIDATE" <(printf '%s\n' "$expected_candidate_manifest")
cmp -s "$TREE_ROOT/$CANDIDATE/customer data/[CN]/price \$5.txt" \
	<(printf '%s\n' 'literal-dollar-path')
grep -Fq 'exact-candidate' "$TREE_ROOT/$CANDIDATE/deploy/las/bin/deploy.sh"
if grep -Eq 'replacement-attack|dirty-checkout-attack' "$TREE_ROOT/$CANDIDATE/deploy/las/bin/deploy.sh"; then
	echo 'Root materializer consumed replace refs or dirty checkout bytes.' >&2
	exit 1
fi
STATE_TEST_CHILD_OWNER_BAD=yes
set +e
run_manager materialize "$CANDIDATE" >/dev/null 2>&1
owner_mismatch_status=$?
set -e
unset STATE_TEST_CHILD_OWNER_BAD
[[ "$owner_mismatch_status" -ne 0 ]]

# A producer that emits a complete-looking prefix but exits nonzero must not
# leave either an immutable tree or binding behind.
PARTIAL="sha-$REPLACEMENT_SHA"
touch "$TEST_ROOT/git-ls-tree-fail"
set +e
run_manager materialize "$PARTIAL" >/dev/null 2>&1
partial_status=$?
set -e
rm -f "$TEST_ROOT/git-ls-tree-fail"
[[ "$partial_status" -ne 0 && ! -e "$TREE_ROOT/$PARTIAL" && ! -e "$BINDING_ROOT/$PARTIAL" ]]

# A crash after the immutable tree rename must not create a permanent orphan.
# The retry may bind it only after independently rematerializing the exact Git
# object and matching the canonical NUL manifest.
STATE_TEST_MV_KILL=tree
set +e
run_manager materialize "$PARTIAL" >/dev/null 2>&1
tree_kill_status=$?
set -e
unset STATE_TEST_MV_KILL
[[ "$tree_kill_status" -ne 0 && -d "$TREE_ROOT/$PARTIAL" && ! -e "$BINDING_ROOT/$PARTIAL" ]]
run_manager materialize "$PARTIAL"
run_manager materialize "$PARTIAL"
[[ -d "$TREE_ROOT/$PARTIAL" && -f "$BINDING_ROOT/$PARTIAL" ]]

# A crash after the binding rename is likewise idempotent: either the durable
# binding is present and validates, or orphan recovery reconstructs it.
BINDING_CRASH="sha-$BINDING_CRASH_SHA"
STATE_TEST_MV_KILL=binding
set +e
run_manager materialize "$BINDING_CRASH" >/dev/null 2>&1
binding_kill_status=$?
set -e
unset STATE_TEST_MV_KILL
[[ "$binding_kill_status" -ne 0 && -d "$TREE_ROOT/$BINDING_CRASH" ]]
run_manager materialize "$BINDING_CRASH"
[[ -f "$BINDING_ROOT/$BINDING_CRASH" ]]

# A power-loss-truncated orphan is safe to replace only after its full
# namespace/ownership/link metadata validates and a fresh exact Git tree has
# been independently reconstructed. A second kill during repair remains
# retryable and must converge to the canonical blob bytes.
CORRUPT_ORPHAN="sha-$CORRUPT_ORPHAN_SHA"
STATE_TEST_MV_KILL=tree
set +e
run_manager materialize "$CORRUPT_ORPHAN" >/dev/null 2>&1
corrupt_seed_status=$?
set -e
unset STATE_TEST_MV_KILL
[[ "$corrupt_seed_status" -ne 0 && -d "$TREE_ROOT/$CORRUPT_ORPHAN" && ! -e "$BINDING_ROOT/$CORRUPT_ORPHAN" ]]
chmod u+w "$TREE_ROOT/$CORRUPT_ORPHAN/deploy/las/bin/deploy.sh"
printf '%s\n' truncated >"$TREE_ROOT/$CORRUPT_ORPHAN/deploy/las/bin/deploy.sh"
chmod 0555 "$TREE_ROOT/$CORRUPT_ORPHAN/deploy/las/bin/deploy.sh"
STATE_TEST_MV_KILL=tree
set +e
run_manager materialize "$CORRUPT_ORPHAN" >/dev/null 2>&1
corrupt_repair_kill_status=$?
set -e
unset STATE_TEST_MV_KILL
[[ "$corrupt_repair_kill_status" -ne 0 && -d "$TREE_ROOT/$CORRUPT_ORPHAN" && ! -e "$BINDING_ROOT/$CORRUPT_ORPHAN" ]]
run_manager materialize "$CORRUPT_ORPHAN"
grep -Fq 'exact-candidate' "$TREE_ROOT/$CORRUPT_ORPHAN/deploy/las/bin/deploy.sh"
[[ -f "$BINDING_ROOT/$CORRUPT_ORPHAN" ]]

set +e
run_manager migration-readiness "$CANDIDATE" "$WEB" "$WORKER" "$MIGRATE" "$POSTGRES" "$WWW" >/dev/null 2>&1
missing_readiness_status=$?
set -e
[[ "$missing_readiness_status" -ne 0 ]]

# Migration-readiness runtime access is authorized only for an exact immutable
# candidate tree and its deploy policy tuple, while every recovery journal is
# empty. No partial or conflicting readiness namespace may be crossed.
[[ "$(run_manager migration-readiness-runtime-authorization "$CANDIDATE" "$WEB" "$WORKER" "$MIGRATE" "$POSTGRES" "$WWW")" == \
	'las-migration-readiness-runtime-authorization-v1 ok' ]]
grep -Fq "verifier " "$TEST_ROOT/bootstrap-events.log"
grep -Fq "guard candidate $CANDIDATE deploy" "$TEST_ROOT/bootstrap-events.log"

set +e
run_manager migration-readiness-runtime-authorization "$CANDIDATE" "$WEB" "$WORKER" "$MIGRATE" "$POSTGRES" >/dev/null 2>&1
authorization_arity_status=$?
set -e
[[ "$authorization_arity_status" -eq 2 ]]

touch "$TEST_ROOT/guard-bad"
set +e
run_manager migration-readiness-runtime-authorization "$CANDIDATE" "$WEB" "$WORKER" "$MIGRATE" "$POSTGRES" "$WWW" >/dev/null 2>&1
authorization_policy_status=$?
set -e
rm -f "$TEST_ROOT/guard-bad"
[[ "$authorization_policy_status" -ne 0 ]]

touch "$TEST_ROOT/verifier-fail"
set +e
run_manager migration-readiness-runtime-authorization "$CANDIDATE" "$WEB" "$WORKER" "$MIGRATE" "$POSTGRES" "$WWW" >/dev/null 2>&1
authorization_boundary_status=$?
set -e
rm -f "$TEST_ROOT/verifier-fail"
[[ "$authorization_boundary_status" -ne 0 ]]

mv "$BINDING_ROOT/$CANDIDATE" "$BINDING_ROOT/$CANDIDATE.saved"
set +e
run_manager migration-readiness-runtime-authorization "$CANDIDATE" "$WEB" "$WORKER" "$MIGRATE" "$POSTGRES" "$WWW" >/dev/null 2>&1
authorization_tree_status=$?
set -e
mv "$BINDING_ROOT/$CANDIDATE.saved" "$BINDING_ROOT/$CANDIDATE"
[[ "$authorization_tree_status" -ne 0 ]]

for pending_journal in "$JOURNAL" "$TRUST_DIRECTORY/las-caddy-bootstrap-pending-v1" "$STABLE_BUNDLE_JOURNAL"; do
	printf '%s\n' pending >"$pending_journal"
	set +e
	run_manager migration-readiness-runtime-authorization "$CANDIDATE" "$WEB" "$WORKER" "$MIGRATE" "$POSTGRES" "$WWW" >/dev/null 2>&1
	authorization_pending_status=$?
	set -e
	rm -f "$pending_journal"
	[[ "$authorization_pending_status" -ne 0 ]]
done

printf '%s\n' 'partial conflicting backup evidence' >"$MIGRATION_EVIDENCE_ROOT/$CANDIDATE.backup"
chmod 0400 "$MIGRATION_EVIDENCE_ROOT/$CANDIDATE.backup"
set +e
run_manager migration-readiness-runtime-authorization "$CANDIDATE" "$WEB" "$WORKER" "$MIGRATE" "$POSTGRES" "$WWW" >/dev/null 2>&1
authorization_conflict_status=$?
set -e
rm -f "$MIGRATION_EVIDENCE_ROOT/$CANDIDATE.backup"
[[ "$authorization_conflict_status" -ne 0 ]]

write_migration_readiness "$PREDECESSOR"
write_migration_readiness "$CANDIDATE"
[[ "$(run_manager migration-readiness "$CANDIDATE" "$WEB" "$WORKER" "$MIGRATE" "$POSTGRES" "$WWW")" == \
	'las-migration-readiness-v1 ok' ]]
[[ "$(run_manager migration-readiness-runtime-authorization "$CANDIDATE" "$WEB" "$WORKER" "$MIGRATE" "$POSTGRES" "$WWW")" == \
	'las-migration-readiness-runtime-authorization-v1 ok' ]]
set +e
run_manager migration-readiness "$CANDIDATE" \
	'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' \
	"$WORKER" "$MIGRATE" "$POSTGRES" "$WWW" >/dev/null 2>&1
wrong_readiness_status=$?
set -e
[[ "$wrong_readiness_status" -ne 0 ]]
printf '%s\n' 'artifact-output-language-active-v1' >"$ACTIVATION"
set +e
run_manager bootstrap-runtime-authorization portal "$PREDECESSOR" "$WEB" "$WORKER" "$MIGRATE" "$POSTGRES" "$WWW" >/dev/null 2>&1
orphan_activation_bootstrap_status=$?
set -e
rm -f "$ACTIVATION"
[[ "$orphan_activation_bootstrap_status" -ne 0 ]]
[[ "$(run_manager bootstrap-runtime-authorization portal "$PREDECESSOR" "$WEB" "$WORKER" "$MIGRATE" "$POSTGRES" "$WWW")" == \
	'las-bootstrap-runtime-authorization-v1 ok' ]]

# Marketing runtime bootstrap is not pristine merely because its own marker is
# absent. It must be anchored in a live, exact portal predecessor receipt/tree
# and the candidate's marketing-deploy policy tuple.
set +e
run_manager bootstrap-runtime-authorization marketing "$CANDIDATE" "$WEB" "$WORKER" "$MIGRATE" "$POSTGRES" "$WWW" >/dev/null 2>&1
marketing_without_portal_status=$?
set -e
[[ "$marketing_without_portal_status" -ne 0 ]]

printf 'las-caddy-bootstrap-v1\n' >"$TRUST_DIRECTORY/las-caddy-bootstrap-pending-v1"
set +e
run_manager status >/dev/null 2>&1
caddy_pending_status=$?
set -e
rm -f "$TRUST_DIRECTORY/las-caddy-bootstrap-pending-v1"
[[ "$caddy_pending_status" -ne 0 ]]

# Initial canonical state is a root-local live attestation, not a parameter-only
# seed. It binds the active bundle policy/capability, exact immutable tree, and
# actual rootless runtime (plus Caddy for marketing) before writing evidence.
STATE_TEST_SUDO_USER=yonaris-deploy
set +e
run_manager bootstrap-surface portal "$PREDECESSOR" "$WEB" "$WORKER" "$MIGRATE" "$POSTGRES" "$WWW" >/dev/null 2>&1
sudo_bootstrap_status=$?
set -e
unset STATE_TEST_SUDO_USER
[[ "$sudo_bootstrap_status" -ne 0 && ! -e "$PORTAL_RELEASE" && ! -e "$RECEIPT_ROOT/$PREDECESSOR" ]]

touch "$TEST_ROOT/runtime-fail"
set +e
run_manager bootstrap-surface portal "$PREDECESSOR" "$WEB" "$WORKER" "$MIGRATE" "$POSTGRES" "$WWW" >/dev/null 2>&1
runtime_bootstrap_status=$?
set -e
rm -f "$TEST_ROOT/runtime-fail"
[[ "$runtime_bootstrap_status" -ne 0 && ! -e "$PORTAL_RELEASE" && ! -e "$RECEIPT_ROOT/$PREDECESSOR" ]]

touch "$TEST_ROOT/guard-bad"
set +e
run_manager bootstrap-surface portal "$PREDECESSOR" "$WEB" "$WORKER" "$MIGRATE" "$POSTGRES" "$WWW" >/dev/null 2>&1
policy_bootstrap_status=$?
set -e
rm -f "$TEST_ROOT/guard-bad"
[[ "$policy_bootstrap_status" -ne 0 && ! -e "$PORTAL_RELEASE" && ! -e "$RECEIPT_ROOT/$PREDECESSOR" ]]

run_manager bootstrap-surface portal "$PREDECESSOR" "$WEB" "$WORKER" "$MIGRATE" "$POSTGRES" "$WWW"
cmp -s "$PORTAL_RELEASE" <(printf '%s\n' "$PREDECESSOR")
cmp -s "$RECEIPT_ROOT/$PREDECESSOR" <(receipt "$PREDECESSOR")
run_manager bootstrap-surface portal "$PREDECESSOR" "$WEB" "$WORKER" "$MIGRATE" "$POSTGRES" "$WWW"
grep -Fq "runtime portal-verify $PREDECESSOR" "$TEST_ROOT/bootstrap-events.log"

mv "$RECEIPT_ROOT/$PREDECESSOR" "$RECEIPT_ROOT/$PREDECESSOR.saved"
set +e
run_manager bootstrap-runtime-authorization marketing "$CANDIDATE" "$WEB" "$WORKER" "$MIGRATE" "$POSTGRES" "$WWW" >/dev/null 2>&1
marketing_without_portal_receipt_status=$?
set -e
mv "$RECEIPT_ROOT/$PREDECESSOR.saved" "$RECEIPT_ROOT/$PREDECESSOR"
[[ "$marketing_without_portal_receipt_status" -ne 0 ]]

printf '%s\n' 'artifact-output-language-active-v1' >"$ACTIVATION"
set +e
run_manager bootstrap-runtime-authorization marketing "$CANDIDATE" "$WEB" "$WORKER" "$MIGRATE" "$POSTGRES" "$WWW" >/dev/null 2>&1
marketing_activation_status=$?
set -e
rm -f "$ACTIVATION"
[[ "$marketing_activation_status" -ne 0 ]]

printf '%s\n' 'las-caddy-bootstrap-v1' >"$TRUST_DIRECTORY/las-caddy-bootstrap-pending-v1"
set +e
run_manager bootstrap-runtime-authorization marketing "$CANDIDATE" "$WEB" "$WORKER" "$MIGRATE" "$POSTGRES" "$WWW" >/dev/null 2>&1
marketing_caddy_pending_status=$?
set -e
rm -f "$TRUST_DIRECTORY/las-caddy-bootstrap-pending-v1"
[[ "$marketing_caddy_pending_status" -ne 0 ]]

set +e
run_manager bootstrap-runtime-authorization marketing "$CANDIDATE" \
	'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' \
	"$WORKER" "$MIGRATE" "$POSTGRES" "$WWW" >/dev/null 2>&1
marketing_wrong_tuple_status=$?
set -e
[[ "$marketing_wrong_tuple_status" -ne 0 ]]
[[ "$(run_manager bootstrap-runtime-authorization marketing "$CANDIDATE" "$WEB" "$WORKER" "$MIGRATE" "$POSTGRES" "$WWW")" == \
	'las-bootstrap-runtime-authorization-v1 ok' ]]
grep -Fq "guard candidate $CANDIDATE marketing-deploy" "$TEST_ROOT/bootstrap-events.log"

touch "$TEST_ROOT/caddy-fail"
set +e
run_manager bootstrap-surface marketing "$CANDIDATE" "$WEB" "$WORKER" "$MIGRATE" "$POSTGRES" "$WWW" >/dev/null 2>&1
caddy_bootstrap_status=$?
set -e
rm -f "$TEST_ROOT/caddy-fail"
[[ "$caddy_bootstrap_status" -ne 0 && ! -e "$MARKETING_RELEASE" && ! -e "$RECEIPT_ROOT/$CANDIDATE" ]]
run_manager bootstrap-surface marketing "$CANDIDATE" "$WEB" "$WORKER" "$MIGRATE" "$POSTGRES" "$WWW"
cmp -s "$MARKETING_RELEASE" <(printf '%s\n' "$CANDIDATE")
cmp -s "$RECEIPT_ROOT/$CANDIDATE" <(receipt "$CANDIDATE")
grep -Fq "caddy verify-active $CANDIDATE $CANDIDATE" "$TEST_ROOT/bootstrap-events.log"

set +e
run_manager bootstrap-surface portal "$CANDIDATE" "$WEB" "$WORKER" "$MIGRATE" "$POSTGRES" "$WWW" >/dev/null 2>&1
overwrite_bootstrap_status=$?
set -e
[[ "$overwrite_bootstrap_status" -ne 0 ]]

receipt "$PREDECESSOR" >"$RECEIPT_ROOT/$PREDECESSOR"
printf '%s\n' "$PREDECESSOR" >"$PORTAL_RELEASE"
printf '%s\n' "$PREDECESSOR" >"$MARKETING_RELEASE"

# Non-root candidate code cannot invoke any state command directly.
STATE_TEST_UID=1001
set +e
run_manager status >/dev/null 2>&1
nonroot_status=$?
set -e
unset STATE_TEST_UID
[[ "$nonroot_status" -ne 0 ]]

rm -f "$TEST_ROOT/state-io.log"
run_manager begin portal "$CANDIDATE" deploy "$WEB" "$WORKER" "$MIGRATE" "$POSTGRES" "$WWW" >/dev/null
[[ -f "$JOURNAL" ]]
file_sync_line="$(grep -nE 'sync -f .*/\.las-state\.' "$TEST_ROOT/state-io.log" | head -n 1 | cut -d: -f1)"
journal_mv_line="$(grep -nF " $JOURNAL" "$TEST_ROOT/state-io.log" | grep -F 'mv ' | head -n 1 | cut -d: -f1)"
directory_sync_line="$(grep -nFx "sync -f $TRUST_DIRECTORY" "$TEST_ROOT/state-io.log" | head -n 1 | cut -d: -f1)"
[[ -n "$file_sync_line" && -n "$journal_mv_line" && -n "$directory_sync_line" && \
	"$file_sync_line" -lt "$journal_mv_line" && "$journal_mv_line" -lt "$directory_sync_line" ]]
status="$(run_manager status)"
grep -Fq "candidate $CANDIDATE" <<<"$status"
grep -Fq "predecessor $PREDECESSOR" <<<"$status"
[[ "$(run_manager pending-runtime-tuple portal "$CANDIDATE" "$WEB" "$WORKER" "$MIGRATE" "$POSTGRES" "$WWW")" == \
	'las-pending-runtime-tuple-v1 ok' ]]
[[ "$(run_manager pending-rollback-runtime-tuple portal "$PREDECESSOR" "$WEB" "$WORKER" "$MIGRATE" "$POSTGRES" "$WWW")" == \
	'las-pending-rollback-runtime-tuple-v1 ok' ]]

# This is the SIGKILL window: runtime may have switched, but without complete
# the root journal remains and every ordinary dispatcher entry must deny.
[[ "$(tr -d '[:space:]' <"$PORTAL_RELEASE")" == "$PREDECESSOR" ]]
run_manager complete portal "$CANDIDATE"
[[ "$(tr -d '[:space:]' <"$PORTAL_RELEASE")" == "$CANDIDATE" ]]
cmp -s "$RECEIPT_ROOT/$CANDIDATE" <(receipt "$CANDIDATE")
[[ ! -e "$JOURNAL" ]]

# A release-marker rename failure leaves the journal pending even though the
# candidate receipt was durable; reconciliation restores predecessor state.
printf '%s\n' "$PREDECESSOR" >"$PORTAL_RELEASE"
run_manager begin portal "$CANDIDATE" deploy "$WEB" "$WORKER" "$MIGRATE" "$POSTGRES" "$WWW" >/dev/null
STATE_TEST_MV_FAIL=release
set +e
run_manager complete portal "$CANDIDATE" >/dev/null 2>&1
release_fail_status=$?
set -e
unset STATE_TEST_MV_FAIL
[[ "$release_fail_status" -ne 0 && -f "$JOURNAL" ]]
run_manager status >/dev/null
run_manager reconcile portal "$CANDIDATE" rollback
[[ "$(tr -d '[:space:]' <"$PORTAL_RELEASE")" == "$PREDECESSOR" && ! -e "$JOURNAL" ]]
cmp -s "$RECEIPT_ROOT/$CANDIDATE" <(receipt "$CANDIDATE")

# A receipt is shared by SHA across surfaces. A failed marketing transition for
# a SHA that remains active on portal must not delete that portal evidence.
printf '%s\n' "$CANDIDATE" >"$PORTAL_RELEASE"
printf '%s\n' "$PREDECESSOR" >"$MARKETING_RELEASE"
run_manager begin marketing "$CANDIDATE" marketing-deploy "$WEB" "$WORKER" "$MIGRATE" "$POSTGRES" "$WWW" >/dev/null
run_manager reconcile marketing "$CANDIDATE" rollback
[[ "$(tr -d '[:space:]' <"$PORTAL_RELEASE")" == "$CANDIDATE" ]]
[[ "$(tr -d '[:space:]' <"$MARKETING_RELEASE")" == "$PREDECESSOR" ]]
cmp -s "$RECEIPT_ROOT/$CANDIDATE" <(receipt "$CANDIDATE")

# Completion is idempotent only for the same digest tuple. It must never
# overwrite pre-existing evidence for the same SHA with different bytes.
printf '%s\n' "$PREDECESSOR" >"$PORTAL_RELEASE"
run_manager begin portal "$CANDIDATE" deploy "$WEB" "$WORKER" "$MIGRATE" "$POSTGRES" "$WWW" >/dev/null
conflicting_web='sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
printf 'artifact-output-language-receipt-v2\nrelease %s\nweb-sha256 %s\nworker-sha256 %s\nmigrate-sha256 %s\npostgres-sha256 %s\nwww-sha256 %s\n' \
	"$CANDIDATE" "$conflicting_web" "$WORKER" "$MIGRATE" "$POSTGRES" "$WWW" >"$RECEIPT_ROOT/$CANDIDATE"
set +e
run_manager complete portal "$CANDIDATE" >/dev/null 2>&1
conflict_status=$?
set -e
[[ "$conflict_status" -ne 0 && -f "$JOURNAL" ]]
grep -Fq "$conflicting_web" "$RECEIPT_ROOT/$CANDIDATE"
run_manager reconcile portal "$CANDIDATE" rollback
[[ ! -e "$JOURNAL" ]]
receipt "$CANDIDATE" >"$RECEIPT_ROOT/$CANDIDATE"

# Journal file-fsync, rename, and parent-dir-fsync failures never advance the
# canonical release without leaving durable, reconcilable evidence.
for failpoint in journal file directory; do
	rm -f "$JOURNAL"
	printf '%s\n' "$PREDECESSOR" >"$PORTAL_RELEASE"
	if [[ "$failpoint" == journal ]]; then STATE_TEST_MV_FAIL=journal; else STATE_TEST_SYNC_FAIL="$failpoint"; fi
	set +e
	run_manager begin portal "$CANDIDATE" deploy "$WEB" "$WORKER" "$MIGRATE" "$POSTGRES" "$WWW" >/dev/null 2>&1
	begin_fail_status=$?
	set -e
	unset STATE_TEST_MV_FAIL STATE_TEST_SYNC_FAIL
	[[ "$begin_fail_status" -ne 0 ]]
	[[ "$(tr -d '[:space:]' <"$PORTAL_RELEASE")" == "$PREDECESSOR" ]]
	if [[ -e "$JOURNAL" ]]; then
		run_manager status >/dev/null
		run_manager reconcile portal "$CANDIDATE" rollback
	fi
done

rm -f "$JOURNAL"
printf '%s\n' "$PREDECESSOR" >"$PORTAL_RELEASE"
STATE_TEST_SYNC_KILL=directory
set +e
run_manager begin portal "$CANDIDATE" deploy "$WEB" "$WORKER" "$MIGRATE" "$POSTGRES" "$WWW" >/dev/null 2>&1
directory_kill_status=$?
set -e
unset STATE_TEST_SYNC_KILL
[[ "$directory_kill_status" -ne 0 && -f "$JOURNAL" ]]
run_manager status >/dev/null
run_manager reconcile portal "$CANDIDATE" rollback
[[ ! -e "$JOURNAL" && "$(tr -d '[:space:]' <"$PORTAL_RELEASE")" == "$PREDECESSOR" ]]

# The irreversible marker cannot be introduced across either durable recovery
# journal, a broken forced-command boundary, a missing immutable predecessor
# binding, or a rollback policy mismatch.
run_manager begin portal "$CANDIDATE" deploy "$WEB" "$WORKER" "$MIGRATE" "$POSTGRES" "$WWW" >/dev/null
set +e
run_manager activate-output-language >/dev/null 2>&1
pending_activation_status=$?
set -e
rm -f "$ACTIVATION"
[[ "$pending_activation_status" -ne 0 ]]
run_manager reconcile portal "$CANDIDATE" rollback

printf '%s\n' 'las-caddy-bootstrap-v1' >"$TRUST_DIRECTORY/las-caddy-bootstrap-pending-v1"
set +e
run_manager activate-output-language >/dev/null 2>&1
caddy_pending_activation_status=$?
set -e
rm -f "$ACTIVATION" "$TRUST_DIRECTORY/las-caddy-bootstrap-pending-v1"
[[ "$caddy_pending_activation_status" -ne 0 ]]

printf '%s\n' 'yonaris-las-stable-bundle-v1' >"$STABLE_BUNDLE_JOURNAL"
set +e
run_manager activate-output-language >/dev/null 2>&1
bundle_pending_activation_status=$?
set -e
rm -f "$ACTIVATION" "$STABLE_BUNDLE_JOURNAL"
[[ "$bundle_pending_activation_status" -ne 0 ]]

touch "$TEST_ROOT/verifier-fail"
set +e
run_manager activate-output-language >/dev/null 2>&1
boundary_activation_status=$?
set -e
rm -f "$ACTIVATION" "$TEST_ROOT/verifier-fail"
[[ "$boundary_activation_status" -ne 0 ]]

mv "$BINDING_ROOT/$PREDECESSOR" "$BINDING_ROOT/$PREDECESSOR.saved"
set +e
run_manager activate-output-language >/dev/null 2>&1
tree_activation_status=$?
set -e
rm -f "$ACTIVATION"
mv "$BINDING_ROOT/$PREDECESSOR.saved" "$BINDING_ROOT/$PREDECESSOR"
[[ "$tree_activation_status" -ne 0 ]]

touch "$TEST_ROOT/rollback-guard-bad"
set +e
run_manager activate-output-language >/dev/null 2>&1
policy_activation_status=$?
set -e
rm -f "$ACTIVATION" "$TEST_ROOT/rollback-guard-bad"
[[ "$policy_activation_status" -ne 0 ]]

STATE_TEST_SUDO_USER=yonaris-deploy
set +e
run_manager activate-output-language >/dev/null 2>&1
sudo_activation_status=$?
set -e
unset STATE_TEST_SUDO_USER
[[ "$sudo_activation_status" -ne 0 && ! -e "$ACTIVATION" ]]

touch "$TEST_ROOT/preactivation-fail"
set +e
run_manager activate-output-language >/dev/null 2>&1
preactivation_status=$?
set -e
rm -f "$TEST_ROOT/preactivation-fail"
[[ "$preactivation_status" -ne 0 && ! -e "$ACTIVATION" ]]

run_manager activate-output-language
cmp -s "$ACTIVATION" <(printf '%s\n' 'artifact-output-language-active-v1')
[[ "$(grep -Fc 'verifier preactivate-output-language' "$TEST_ROOT/bootstrap-events.log")" -ge 1 ]]
run_manager activate-output-language
[[ "$(tail -n 2 "$TEST_ROOT/bootstrap-events.log" | head -n 1)" == 'verifier ' ]]
set +e
run_manager deactivate-output-language >/dev/null 2>&1
deactivate_status=$?
set -e
[[ "$deactivate_status" == 2 ]]

echo 'root exact-tree materialization, crash journal, atomic marker, and one-way activation tests passed'
