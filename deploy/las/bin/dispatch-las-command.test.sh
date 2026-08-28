#!/usr/bin/env bash

set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
SOURCE="$SCRIPT_DIR/dispatch-las-command.sh"
TEST_ROOT="$(mktemp -d)"
trap 'rm -rf -- "$TEST_ROOT"' EXIT

MOCK_BIN="$TEST_ROOT/mock-bin"
DISPATCHER="$TEST_ROOT/dispatch-las-command"
mkdir -p "$MOCK_BIN"

cat >"$MOCK_BIN/id" <<'STUB'
#!/usr/bin/env bash
[[ "$*" == -u ]] || exit 2
printf '%s\n' 0
STUB
chmod 0755 "$MOCK_BIN/id"

sed -e "s#/usr/bin/id#$MOCK_BIN/id#g" "$SOURCE" >"$DISPATCHER"
chmod 0755 "$DISPATCHER"

SHA='sha-1111111111111111111111111111111111111111'
WEB='sha256:1111111111111111111111111111111111111111111111111111111111111111'
WORKER='sha256:2222222222222222222222222222222222222222222222222222222222222222'
MIGRATE='sha256:3333333333333333333333333333333333333333333333333333333333333333'
POSTGRES='sha256:4444444444444444444444444444444444444444444444444444444444444444'
WWW='sha256:5555555555555555555555555555555555555555555555555555555555555555'

run_dispatch() {
	local command="$1"
	env -i PATH='/usr/bin:/bin' HOME='/nonexistent' SSH_ORIGINAL_COMMAND="$command" \
		/bin/bash --noprofile --norc -p "$DISPATCHER"
}

assert_protocol_rejected() {
	local label="$1" command="$2" status
	set +e
	run_dispatch "$command" >"$TEST_ROOT/$label.out" 2>"$TEST_ROOT/$label.err"
	status=$?
	set -e
	[[ "$status" -eq 2 ]] || {
		echo "Expected protocol rejection for $label, got $status" >&2
		cat "$TEST_ROOT/$label.err" >&2
		exit 1
	}
}

assert_reaches_control_boundary() {
	local label="$1" command="$2" status
	set +e
	run_dispatch "$command" >"$TEST_ROOT/$label.out" 2>"$TEST_ROOT/$label.err"
	status=$?
	set -e
	[[ "$status" -ne 0 && "$status" -ne 2 ]]
	grep -Fq 'dispatcher lock directory is invalid' "$TEST_ROOT/$label.err"
}

# The public SSH grammar has exactly three forms: an argument-free probe and
# deploy/rollback with one immutable SHA plus four image digests.
assert_reaches_control_boundary probe 'yonaris-las-v1 probe'
assert_reaches_control_boundary deploy \
	"yonaris-las-v1 deploy $SHA $WEB $WORKER $MIGRATE $POSTGRES"
assert_reaches_control_boundary rollback \
	"yonaris-las-v1 rollback $SHA $WEB $WORKER $MIGRATE $POSTGRES"

assert_protocol_rejected probe-payload 'yonaris-las-v1 probe extra'
assert_protocol_rejected rollback-sha-only "yonaris-las-v1 rollback $SHA"
assert_protocol_rejected deploy-five-digests \
	"yonaris-las-v1 deploy $SHA $WEB $WORKER $MIGRATE $POSTGRES $WWW"
assert_protocol_rejected rollback-five-digests \
	"yonaris-las-v1 rollback $SHA $WEB $WORKER $MIGRATE $POSTGRES $WWW"
for operation in marketing-preflight marketing-deploy marketing-verify; do
	assert_protocol_rejected "$operation" "yonaris-las-v1 $operation $SHA $WWW"
done
assert_protocol_rejected noncanonical-space \
	"yonaris-las-v1  deploy $SHA $WEB $WORKER $MIGRATE $POSTGRES"

# The dispatcher consumes the guard's four-digest v2 record. Explicit rollback
# uses the guard's receipt-bound rollback mode and never enters migration.
grep -Fq '"$record" == release-digests-v2' "$SOURCE"
grep -Fq 'rollback "$release_tag")' "$SOURCE"
[[ "$(grep -Fc "state_attestation 'las-migration-readiness-v1 ok'" "$SOURCE")" -eq 1 ]]
[[ "$(grep -Fc 'state_manager complete portal' "$SOURCE")" -eq 2 ]]

# Only the legacy v2 receipt reader may mention the retired fifth digest.
[[ "$(grep -Fc 'www-sha256' "$SOURCE")" -eq 1 ]]
! grep -Eq 'marketing-(preflight|deploy|verify|rollback)|MARKETING_RELEASE|WWW_IMAGE_DIGEST|marketing-runtime' "$SOURCE"

printf '%s\n' 'Portal-only LAS dispatcher protocol tests passed'
