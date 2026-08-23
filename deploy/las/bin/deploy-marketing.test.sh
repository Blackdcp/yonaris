#!/usr/bin/env bash

set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "$SCRIPT_DIR/../../.." && pwd)"
DEPLOY_SCRIPT="$SCRIPT_DIR/deploy-marketing.sh"
COMPOSE_FILE="$REPO_ROOT/deploy/las/compose.marketing.yaml"
CANDIDATE_TAG="sha-1111111111111111111111111111111111111111"
PREVIOUS_TAG="sha-2222222222222222222222222222222222222222"
FAKE_SECRET="re_A7k2L9m4N6p8Q1r3S5t7V9x2Z4b6C8d0"

test_root="$(mktemp -d)"
trap 'rm -rf -- "$test_root"' EXIT

failures=0
fail() {
	printf 'not ok - %s\n' "$1" >&2
	failures=$((failures + 1))
}

pass() {
	printf 'ok - %s\n' "$1"
}

assert_success() {
	local description="$1"
	shift
	if "$@"; then
		pass "$description"
	else
		fail "$description"
		if [[ -n "${OUTPUT_LOG:-}" && -f "$OUTPUT_LOG" ]]; then
			sed 's/re_A7k2L9m4N6p8Q1r3S5t7V9x2Z4b6C8d0/[redacted]/g' "$OUTPUT_LOG" >&2
		fi
	fi
}

assert_failure() {
	local expected_status="$1"
	local description="$2"
	shift 2
	set +e
	"$@"
	local status=$?
	set -e
	if [[ "$status" == "$expected_status" ]]; then pass "$description"; else fail "$description (status=$status, expected=$expected_status)"; fi
}

fixture="$test_root/fixture"
mkdir -p "$fixture/bin" "$fixture/script"
cp "$DEPLOY_SCRIPT" "$fixture/script/deploy-marketing.sh"

cat >"$fixture/script/install-marketing-caddy.sh" <<'STUB'
#!/usr/bin/env bash
set -Eeuo pipefail
printf 'caddy-helper %s\n' "$*" >>"$DEPLOY_TEST_CALL_LOG"

if [[ "${1:-}" == "--restore-full" ]]; then
	if [[ "${DEPLOY_TEST_CADDY_RESTORE_STATUS:-0}" != 0 ]]; then
		exit "$DEPLOY_TEST_CADDY_RESTORE_STATUS"
	fi
	if [[ -n "${CADDY_EXPECTED_CURRENT_SHA_FILE:-}" ]]; then
		expected_current="$(tr -d '[:space:]' <"$CADDY_EXPECTED_CURRENT_SHA_FILE")"
		actual_current="$(sha256sum "$CADDY_TARGET_CONFIG" | cut -d' ' -f1)"
		[[ "$actual_current" == "$expected_current" ]] || exit 1
	fi
	cp -- "$2" "$CADDY_TARGET_CONFIG"
	exit 0
fi

if [[ "${1:-}" == "--confirm-restored" ]]; then
	cmp -s -- "$2" "$CADDY_TARGET_CONFIG"
	exit $?
fi

if [[ -n "${CADDY_BACKUP_OUTPUT:-}" ]]; then
	cp -- "$CADDY_TARGET_CONFIG" "$CADDY_BACKUP_OUTPUT"
fi
if [[ -n "${CADDY_METADATA_DIR:-}" ]]; then
	sha256sum "$CADDY_BACKUP_OUTPUT" | cut -d' ' -f1 >"$CADDY_METADATA_DIR/previous-caddy-sha256"
	if [[ "${DEPLOY_TEST_RECOVER_WRONG_CANDIDATE:-0}" == 1 ]]; then
		printf '%s\n' 'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc' >"$CADDY_METADATA_DIR/candidate-caddy-sha256"
	else
		printf '%s\n' 'candidate caddy config' | sha256sum | cut -d' ' -f1 >"$CADDY_METADATA_DIR/candidate-caddy-sha256"
	fi
fi
if [[ -n "${CADDY_EXPECTED_CANDIDATE_SHA_FILE:-}" ]]; then
	expected_candidate="$(tr -d '[:space:]' <"$CADDY_EXPECTED_CANDIDATE_SHA_FILE")"
	actual_candidate="$(tr -d '[:space:]' <"$CADDY_METADATA_DIR/candidate-caddy-sha256")"
	if [[ "$actual_candidate" != "$expected_candidate" ]]; then exit 1; fi
fi
if [[ "${DEPLOY_TEST_TAMPER_INSTALL_BACKUP:-0}" == 1 ]]; then
	printf '%s\n' 'tampered after digest' >>"$CADDY_BACKUP_OUTPUT"
fi
if [[ "${DEPLOY_TEST_CADDY_INSTALL_STATUS:-0}" != 0 ]]; then
	exit "$DEPLOY_TEST_CADDY_INSTALL_STATUS"
fi
printf '%s\n' 'candidate caddy config' >"$CADDY_TARGET_CONFIG"
STUB

cat >"$fixture/bin/docker" <<'STUB'
#!/usr/bin/env bash
set -Eeuo pipefail
printf 'docker %s\n' "$*" >>"$DEPLOY_TEST_CALL_LOG"
printf 'env %s|%s|%s|%s\n' \
	"${MARKETING_DIAGNOSTIC_DELIVERY_MODE-UNSET}" \
	"${RESEND_API_KEY-UNSET}" \
	"${RESEND_FROM_EMAIL-UNSET}" \
	"${MARKETING_LEAD_RECIPIENT-UNSET}" >>"$DEPLOY_TEST_ENV_LOG"

if [[ " $* " == *" compose "*" up "*" www "* ]]; then
	if [[ "${DEPLOY_TEST_FAIL_START_TAG:-}" == "${IMAGE_TAG:-}" ]]; then
		exit 1
	fi
	printf '%s\n' "${IMAGE_TAG:-}" >"$DEPLOY_TEST_RUNNING_TAG"
fi
exit 0
STUB

cat >"$fixture/bin/curl" <<'STUB'
#!/usr/bin/env bash
set -Eeuo pipefail
printf 'curl %s\n' "$*" >>"$DEPLOY_TEST_CALL_LOG"
running_tag="$(tr -d '[:space:]' <"$DEPLOY_TEST_RUNNING_TAG" 2>/dev/null || true)"
if [[ "${DEPLOY_TEST_FAIL_HEALTH_TAG:-}" == "$running_tag" ]]; then
	exit 22
fi
exit 0
STUB

cat >"$fixture/bin/flock" <<'STUB'
#!/usr/bin/env bash
printf 'flock %s\n' "$*" >>"$DEPLOY_TEST_CALL_LOG"
exit 0
STUB

cat >"$fixture/bin/mv" <<'STUB'
#!/usr/bin/env bash
set -Eeuo pipefail
destination="${*: -1}"
if [[ "${DEPLOY_TEST_FAIL_MARKER:-0}" == 1 && "$destination" == */.marketing-release ]]; then
	exit 1
fi
if [[ "${DEPLOY_TEST_FAIL_BUNDLE_WRITE:-0}" == 1 && "$destination" == */candidate-image-tag ]]; then
	exit 1
fi
exec /usr/bin/mv "$@"
STUB

cat >"$fixture/bin/chmod" <<'STUB'
#!/usr/bin/env bash
if [[ "${DEPLOY_TEST_FAIL_BUNDLE_CHMOD:-0}" == 1 && "$*" == *marketing-rollbacks* ]]; then
	exit 1
fi
exec /usr/bin/chmod "$@"
STUB

cat >"$fixture/bin/uname" <<'STUB'
#!/usr/bin/env bash
if [[ -n "${DEPLOY_TEST_UNAME:-}" ]]; then
	printf '%s\n' "$DEPLOY_TEST_UNAME"
	exit 0
fi
exec /usr/bin/uname "$@"
STUB

chmod +x "$fixture/script/"*.sh "$fixture/bin/"*

write_env() {
	local target="$1"
	local variant="$2"
	cat >"$target" <<EOF
IMAGE_REGISTRY=ghcr.io
IMAGE_NAMESPACE=blackdcp
IMAGE_TAG=$CANDIDATE_TAG
EOF
	if [[ "$variant" == mailto-only ]]; then
		printf '%s\n' 'MARKETING_DIAGNOSTIC_DELIVERY_MODE=mailto-only' >>"$target"
		return
	fi
	if [[ "$variant" == invalid-mode ]]; then
		printf '%s\n' 'MARKETING_DIAGNOSTIC_DELIVERY_MODE=mail-only' >>"$target"
	fi
	case "$variant" in
		missing-key) ;;
		blank-key) printf "%s\n" "RESEND_API_KEY='   '" >>"$target" ;;
		test-key) printf '%s\n' 'RESEND_API_KEY=re_test_123456' >>"$target" ;;
		fake-key) printf '%s\n' 'RESEND_API_KEY=re_fake_12345678901234567890' >>"$target" ;;
		dummy-key) printf '%s\n' 'RESEND_API_KEY=re_dummy_12345678901234567890' >>"$target" ;;
		fixture-key) printf '%s\n' 'RESEND_API_KEY=re_fixture_12345678901234567890' >>"$target" ;;
		invalid-key) printf '%s\n' 'RESEND_API_KEY=re_invalid_12345678901234567890' >>"$target" ;;
		demo-key) printf '%s\n' 'RESEND_API_KEY=re_demo_12345678901234567890' >>"$target" ;;
		mock-key) printf '%s\n' 'RESEND_API_KEY=re_mock_12345678901234567890' >>"$target" ;;
		not-resend-key) printf '%s\n' 'RESEND_API_KEY=not-a-resend-key' >>"$target" ;;
		short-key) printf '%s\n' 'RESEND_API_KEY=re_x' >>"$target" ;;
		changeme-key) printf '%s\n' 'RESEND_API_KEY=changeme' >>"$target" ;;
		placeholder-key) printf '%s\n' 'RESEND_API_KEY=placeholder' >>"$target" ;;
		example-key) printf '%s\n' 'RESEND_API_KEY=example_resend_key' >>"$target" ;;
		*) printf 'RESEND_API_KEY=%s\n' "$FAKE_SECRET" >>"$target" ;;
	esac
	case "$variant" in
		wrong-from) printf "%s\n" "RESEND_FROM_EMAIL='Yonaris <other@yonaris.com>'" >>"$target" ;;
		*) printf "%s\n" "RESEND_FROM_EMAIL='Yonaris <diagnostic@yonaris.com>'" >>"$target" ;;
	esac
	case "$variant" in
		wrong-recipient) printf '%s\n' 'MARKETING_LEAD_RECIPIENT=sales@example.com' >>"$target" ;;
		*) printf '%s\n' 'MARKETING_LEAD_RECIPIENT=black.dcp@outlook.com' >>"$target" ;;
	esac
}

new_case() {
	local name="$1"
	CASE_ROOT="$test_root/$name"
	DEPLOY_ROOT="$CASE_ROOT/deploy"
	ENV_FILE="$CASE_ROOT/marketing.env"
	CADDY_TARGET_CONFIG="$CASE_ROOT/Caddyfile"
	CALL_LOG="$CASE_ROOT/calls.log"
	ENV_LOG="$CASE_ROOT/env.log"
	OUTPUT_LOG="$CASE_ROOT/output.log"
	RUNNING_TAG="$CASE_ROOT/running-tag"
	mkdir -p "$DEPLOY_ROOT"
	: >"$CALL_LOG"
	: >"$ENV_LOG"
	printf '%s\n' 'previous complete caddy config' >"$CADDY_TARGET_CONFIG"
	printf '%s\n' "$PREVIOUS_TAG" >"$DEPLOY_ROOT/.marketing-release"
	printf '%s\n' "$PREVIOUS_TAG" >"$RUNNING_TAG"
	write_env "$ENV_FILE" valid
}

run_script() {
	env \
		PATH="$fixture/bin:$PATH" \
		DEPLOY_ROOT="$DEPLOY_ROOT" \
		MARKETING_COMPOSE_FILE="$COMPOSE_FILE" \
		ENV_FILE="$ENV_FILE" \
		CADDY_TARGET_CONFIG="$CADDY_TARGET_CONFIG" \
		DEPLOY_TEST_CALL_LOG="$CALL_LOG" \
		DEPLOY_TEST_ENV_LOG="$ENV_LOG" \
		DEPLOY_TEST_RUNNING_TAG="$RUNNING_TAG" \
		DEPLOY_TEST_FAIL_START_TAG="${DEPLOY_TEST_FAIL_START_TAG:-}" \
		DEPLOY_TEST_FAIL_HEALTH_TAG="${DEPLOY_TEST_FAIL_HEALTH_TAG:-}" \
		DEPLOY_TEST_CADDY_INSTALL_STATUS="${DEPLOY_TEST_CADDY_INSTALL_STATUS:-0}" \
		DEPLOY_TEST_CADDY_RESTORE_STATUS="${DEPLOY_TEST_CADDY_RESTORE_STATUS:-0}" \
		DEPLOY_TEST_FAIL_MARKER="${DEPLOY_TEST_FAIL_MARKER:-0}" \
		DEPLOY_TEST_FAIL_BUNDLE_WRITE="${DEPLOY_TEST_FAIL_BUNDLE_WRITE:-0}" \
		DEPLOY_TEST_FAIL_BUNDLE_CHMOD="${DEPLOY_TEST_FAIL_BUNDLE_CHMOD:-0}" \
		DEPLOY_TEST_UNAME="${DEPLOY_TEST_UNAME:-}" \
		DEPLOY_TEST_TAMPER_INSTALL_BACKUP="${DEPLOY_TEST_TAMPER_INSTALL_BACKUP:-0}" \
		DEPLOY_TEST_RECOVER_WRONG_CANDIDATE="${DEPLOY_TEST_RECOVER_WRONG_CANDIDATE:-0}" \
		MARKETING_HEALTH_ATTEMPTS=1 \
		bash "$fixture/script/deploy-marketing.sh" "$@" >"$OUTPUT_LOG" 2>&1
}

tree_digest() {
	find "$1" -type f -print0 | sort -z | xargs -0 sha256sum | sha256sum | cut -d' ' -f1
}

tree_snapshot() {
	find "$1" -printf '%P|%y|%m|%T@|%i\n' | sort
	tree_digest "$1"
}

# RED: verify-only is xtrace-safe and has no filesystem/network side effects.
new_case verify_only
before_digest="$(tree_snapshot "$DEPLOY_ROOT")"
set +e
env \
	PATH="$fixture/bin:$PATH" \
	DEPLOY_ROOT="$DEPLOY_ROOT" \
	MARKETING_COMPOSE_FILE="$COMPOSE_FILE" \
	ENV_FILE="$ENV_FILE" \
	CADDY_TARGET_CONFIG="$CADDY_TARGET_CONFIG" \
	DEPLOY_TEST_CALL_LOG="$CALL_LOG" \
	DEPLOY_TEST_ENV_LOG="$ENV_LOG" \
	DEPLOY_TEST_RUNNING_TAG="$RUNNING_TAG" \
	bash -x "$fixture/script/deploy-marketing.sh" --verify-only "$CANDIDATE_TAG" >"$OUTPUT_LOG" 2>&1
verify_status=$?
set -e
after_digest="$(tree_snapshot "$DEPLOY_ROOT")"
if [[ "$verify_status" == 0 ]]; then pass "verify-only accepts exact immutable tag and exact mail configuration"; else fail "verify-only accepts exact immutable tag and exact mail configuration"; fi
if [[ "$before_digest" == "$after_digest" && ! -s "$CALL_LOG" ]]; then pass "verify-only performs no filesystem, lock, Docker, Caddy, curl, or network mutation"; else fail "verify-only performs no filesystem, lock, Docker, Caddy, curl, or network mutation"; fi
if grep -Fq "$FAKE_SECRET" "$OUTPUT_LOG"; then fail "verify-only disables inherited xtrace before sourcing secrets"; else pass "verify-only disables inherited xtrace before sourcing secrets"; fi
if [[ "$(grep -Ec '^(RESEND_API_KEY|RESEND_FROM_EMAIL|MARKETING_LEAD_RECIPIENT)=(ok|invalid)$' "$OUTPUT_LOG" || true)" == 3 ]]; then pass "verify-only reports only variable names and status"; else fail "verify-only reports only variable names and status"; fi

new_case verify_mailto_only
write_env "$ENV_FILE" mailto-only
before_digest="$(tree_snapshot "$DEPLOY_ROOT")"
assert_success "verify-only accepts explicit mailto-only mode without Resend configuration" run_script --verify-only "$CANDIDATE_TAG"
after_digest="$(tree_snapshot "$DEPLOY_ROOT")"
if [[ "$before_digest" == "$after_digest" && ! -s "$CALL_LOG" ]]; then pass "mailto-only preflight remains side-effect free"; else fail "mailto-only preflight remains side-effect free"; fi
if grep -Fxq 'MARKETING_DIAGNOSTIC_DELIVERY_MODE=mailto-only' "$OUTPUT_LOG" &&
	[[ "$(grep -Ec '^(RESEND_API_KEY|RESEND_FROM_EMAIL|MARKETING_LEAD_RECIPIENT)=not-required$' "$OUTPUT_LOG" || true)" == 3 ]]; then
	pass "mailto-only preflight reports an explicit delivery mode without secret values"
else
	fail "mailto-only preflight reports an explicit delivery mode without secret values"
fi

new_case verify_absent_root
rm -f -- "$DEPLOY_ROOT/.marketing-release"
rmdir -- "$DEPLOY_ROOT"
if [[ -e "$DEPLOY_ROOT" ]]; then fail "verify-only absent-root fixture starts absent"; else pass "verify-only absent-root fixture starts absent"; fi
assert_success "verify-only succeeds without creating an absent deploy root" run_script --verify-only "$CANDIDATE_TAG"
if [[ ! -e "$DEPLOY_ROOT" && ! -s "$CALL_LOG" ]]; then pass "verify-only leaves an absent deploy root absent and invokes no effectful command"; else fail "verify-only leaves an absent deploy root absent and invokes no effectful command"; fi

for variant in missing-key blank-key test-key fake-key dummy-key fixture-key invalid-key demo-key mock-key not-resend-key short-key changeme-key placeholder-key example-key wrong-from wrong-recipient invalid-mode; do
	new_case "verify_$variant"
	write_env "$ENV_FILE" "$variant"
	before_digest="$(tree_snapshot "$DEPLOY_ROOT")"
	assert_failure 1 "$variant is rejected by the shared preflight" run_script --verify-only "$CANDIDATE_TAG"
	after_digest="$(tree_snapshot "$DEPLOY_ROOT")"
	if [[ "$before_digest" == "$after_digest" && ! -s "$CALL_LOG" ]]; then pass "$variant rejection is side-effect free"; else fail "$variant rejection is side-effect free"; fi
	if grep -Fq "$FAKE_SECRET" "$OUTPUT_LOG"; then fail "$variant failure redacts secret values"; else pass "$variant failure redacts secret values"; fi
done

# RED: a successful release persists a complete, private rollback bundle.
new_case release_success
assert_success "normal release completes against isolated deployment doubles" run_script "$CANDIDATE_TAG"
if [[ "$(tr -d '[:space:]' <"$DEPLOY_ROOT/.marketing-release")" == "$CANDIDATE_TAG" ]]; then pass "release marker changes last to the candidate"; else fail "release marker changes last to the candidate"; fi
bundle="$DEPLOY_ROOT/marketing-rollbacks/$CANDIDATE_TAG"
if [[ -f "$bundle/Caddyfile.previous" ]] && grep -Fq 'previous complete caddy config' "$bundle/Caddyfile.previous" &&
	[[ "$(tr -d '[:space:]' <"$bundle/previous-image-tag")" == "$PREVIOUS_TAG" ]] &&
	[[ "$(tr -d '[:space:]' <"$bundle/candidate-image-tag")" == "$CANDIDATE_TAG" ]]; then
	pass "release stores the full predecessor Caddyfile and immutable image binding"
else
	fail "release stores the full predecessor Caddyfile and immutable image binding"
fi
bundle_mode="$(stat -c '%a' "$bundle" 2>/dev/null || true)"
case "$(uname -s)" in
	MINGW* | MSYS*) pass "durable rollback mode check is deferred to the Linux workflow fixture" ;;
	*) if [[ "$bundle_mode" == 700 ]]; then pass "durable rollback bundle is mode 700"; else fail "durable rollback bundle is mode 700 (mode=$bundle_mode)"; fi ;;
esac
if grep -Fq "env UNSET|$FAKE_SECRET|Yonaris <diagnostic@yonaris.com>|black.dcp@outlook.com" "$ENV_LOG"; then pass "normal deployment exports the validated values only to Compose"; else fail "normal deployment exports the validated values only to Compose"; fi
if grep -Eq 'api\.resend\.com|/domains([/?[:space:]]|$)' "$CALL_LOG"; then fail "deployment never contacts Resend or a domain API"; else pass "deployment never contacts Resend or a domain API"; fi

new_case release_mailto_only
write_env "$ENV_FILE" mailto-only
assert_success "normal release accepts explicit mailto-only mode without Resend configuration" run_script "$CANDIDATE_TAG"
if grep -Fq 'env mailto-only|||' "$ENV_LOG"; then pass "mailto-only release exports no synthetic Resend values"; else fail "mailto-only release exports no synthetic Resend values"; fi
if grep -Eq 'api\.resend\.com|/domains([/?[:space:]]|$)' "$CALL_LOG"; then fail "mailto-only deployment never contacts Resend or a domain API"; else pass "mailto-only deployment never contacts Resend or a domain API"; fi

compose_json="$test_root/compose.json"
if env \
	IMAGE_TAG="$CANDIDATE_TAG" \
	RESEND_API_KEY="$FAKE_SECRET" \
	RESEND_FROM_EMAIL='Yonaris <diagnostic@yonaris.com>' \
	MARKETING_LEAD_RECIPIENT='black.dcp@outlook.com' \
	docker compose --project-name yonaris-marketing-test --file "$COMPOSE_FILE" config --format json >"$compose_json"; then
	if node - "$compose_json" <<'NODE'
const fs = require("node:fs");
const document = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const expected = {
  MARKETING_DIAGNOSTIC_DELIVERY_MODE: "resend",
  MARKETING_LEAD_RECIPIENT: "black.dcp@outlook.com",
  RESEND_API_KEY: "re_A7k2L9m4N6p8Q1r3S5t7V9x2Z4b6C8d0",
  RESEND_FROM_EMAIL: "Yonaris <diagnostic@yonaris.com>",
};
const services = document.services ?? {};
const actual = services.www?.environment ?? {};
if (JSON.stringify(actual) !== JSON.stringify(expected)) process.exit(1);
for (const [name, service] of Object.entries(services)) {
  if (name === "www") continue;
  if (Object.keys(expected).some((key) => key in (service?.environment ?? {}))) process.exit(1);
}
NODE
	then
		pass "Compose injects exactly the diagnostic delivery mode and Resend variables into www only"
	else
		fail "Compose injects exactly the diagnostic delivery mode and Resend variables into www only"
	fi
else
	fail "Compose secret-scope fixture renders without contacting a daemon"
fi

mailto_compose_json="$test_root/compose-mailto-only.json"
if env \
	IMAGE_TAG="$CANDIDATE_TAG" \
	MARKETING_DIAGNOSTIC_DELIVERY_MODE=mailto-only \
	docker compose --project-name yonaris-marketing-mailto-test --file "$COMPOSE_FILE" config --format json >"$mailto_compose_json"; then
	if node - "$mailto_compose_json" <<'NODE'
const fs = require("node:fs");
const document = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const expected = {
  MARKETING_DIAGNOSTIC_DELIVERY_MODE: "mailto-only",
  MARKETING_LEAD_RECIPIENT: "",
  RESEND_API_KEY: "",
  RESEND_FROM_EMAIL: "",
};
const actual = document.services?.www?.environment ?? {};
if (JSON.stringify(actual) !== JSON.stringify(expected)) process.exit(1);
NODE
	then
		pass "Compose renders explicit mailto-only mode without synthetic Resend values"
	else
		fail "Compose renders explicit mailto-only mode without synthetic Resend values"
	fi
else
	fail "Compose renders explicit mailto-only mode without requiring Resend values"
fi

# RED: app failures restore the marker's predecessor before Caddy mutation.
new_case app_failure
export DEPLOY_TEST_FAIL_START_TAG="$CANDIDATE_TAG"
assert_failure 1 "candidate start failure restores the predecessor app" run_script "$CANDIDATE_TAG"
unset DEPLOY_TEST_FAIL_START_TAG
if [[ "$(tr -d '[:space:]' <"$RUNNING_TAG")" == "$PREVIOUS_TAG" ]] && ! grep -Fq 'caddy-helper' "$CALL_LOG"; then pass "app failure leaves Caddy untouched"; else fail "app failure leaves Caddy untouched"; fi
if [[ "$(tr -d '[:space:]' <"$DEPLOY_ROOT/.marketing-release")" == "$PREVIOUS_TAG" ]]; then pass "app failure leaves release marker unchanged"; else fail "app failure leaves release marker unchanged"; fi

# RED: every rollback-bundle preparation failure restores the predecessor and exits 75.
new_case bundle_mkdir_failure
printf '%s\n' 'collision' >"$DEPLOY_ROOT/marketing-rollbacks"
assert_failure 75 "rollback bundle mkdir failure is a recovery exit" run_script "$CANDIDATE_TAG"
if [[ "$(tr -d '[:space:]' <"$RUNNING_TAG")" == "$PREVIOUS_TAG" ]] && ! grep -Fq 'caddy-helper' "$CALL_LOG"; then pass "bundle mkdir failure restores app before any Caddy mutation"; else fail "bundle mkdir failure restores app before any Caddy mutation"; fi

new_case bundle_chmod_failure
export DEPLOY_TEST_FAIL_BUNDLE_CHMOD=1 DEPLOY_TEST_UNAME=Linux
assert_failure 75 "rollback bundle chmod failure is a recovery exit" run_script "$CANDIDATE_TAG"
unset DEPLOY_TEST_FAIL_BUNDLE_CHMOD DEPLOY_TEST_UNAME
if [[ "$(tr -d '[:space:]' <"$RUNNING_TAG")" == "$PREVIOUS_TAG" ]] && ! grep -Fq 'caddy-helper' "$CALL_LOG"; then pass "bundle chmod failure restores app before any Caddy mutation"; else fail "bundle chmod failure restores app before any Caddy mutation"; fi

new_case bundle_write_failure
export DEPLOY_TEST_FAIL_BUNDLE_WRITE=1
assert_failure 75 "rollback bundle binding write failure is a recovery exit" run_script "$CANDIDATE_TAG"
unset DEPLOY_TEST_FAIL_BUNDLE_WRITE
if [[ "$(tr -d '[:space:]' <"$RUNNING_TAG")" == "$PREVIOUS_TAG" ]] && ! grep -Fq 'caddy-helper' "$CALL_LOG"; then pass "bundle write failure restores app before any Caddy mutation"; else fail "bundle write failure restores app before any Caddy mutation"; fi

# RED: confirmed Caddy rollback restores app; unconfirmed rollback preserves candidate and exits 75.
new_case caddy_failure
export DEPLOY_TEST_CADDY_INSTALL_STATUS=1
assert_failure 1 "confirmed Caddy rollback restores the predecessor app" run_script "$CANDIDATE_TAG"
unset DEPLOY_TEST_CADDY_INSTALL_STATUS
if [[ "$(tr -d '[:space:]' <"$RUNNING_TAG")" == "$PREVIOUS_TAG" ]]; then pass "confirmed Caddy rollback restores predecessor app after Caddy"; else fail "confirmed Caddy rollback restores predecessor app after Caddy"; fi
export DEPLOY_TEST_CADDY_INSTALL_STATUS=0
assert_success "confirmed failed release archives stale bundle so the same immutable tag can retry" run_script "$CANDIDATE_TAG"
unset DEPLOY_TEST_CADDY_INSTALL_STATUS

new_case caddy_recovery
export DEPLOY_TEST_CADDY_INSTALL_STATUS=75
assert_failure 75 "unconfirmed Caddy rollback exits 75" run_script "$CANDIDATE_TAG"
unset DEPLOY_TEST_CADDY_INSTALL_STATUS
if [[ "$(tr -d '[:space:]' <"$RUNNING_TAG")" == "$CANDIDATE_TAG" && -d "$DEPLOY_ROOT/marketing-rollbacks/$CANDIDATE_TAG" ]]; then pass "unconfirmed Caddy rollback keeps healthy candidate and recovery bundle"; else fail "unconfirmed Caddy rollback keeps healthy candidate and recovery bundle"; fi
: >"$CALL_LOG"
assert_failure 1 "ordinary rollback still rejects the old-marker recovery mismatch" run_script --rollback "$CANDIDATE_TAG"
if [[ ! -s "$CALL_LOG" ]]; then pass "ordinary rollback mismatch remains mutation-free after Caddy 75"; else fail "ordinary rollback mismatch remains mutation-free after Caddy 75"; fi
assert_success "hash-bound recovery mode resolves the Caddy-75 mixed state" run_script --recover "$CANDIDATE_TAG"
if [[ "$(tr -d '[:space:]' <"$RUNNING_TAG")" == "$CANDIDATE_TAG" ]] && [[ "$(tr -d '[:space:]' <"$DEPLOY_ROOT/.marketing-release")" == "$CANDIDATE_TAG" ]] && grep -Fq 'candidate caddy config' "$CADDY_TARGET_CONFIG"; then pass "recovery mode converges candidate app and Caddy before writing candidate marker"; else fail "recovery mode converges candidate app and Caddy before writing candidate marker"; fi

new_case recovery_candidate_mismatch
export DEPLOY_TEST_CADDY_INSTALL_STATUS=75
assert_failure 75 "fixture enters Caddy-75 state for recovery candidate mismatch" run_script "$CANDIDATE_TAG"
unset DEPLOY_TEST_CADDY_INSTALL_STATUS
target_before_recover="$(sha256sum "$CADDY_TARGET_CONFIG" | cut -d' ' -f1)"
export DEPLOY_TEST_RECOVER_WRONG_CANDIDATE=1
assert_failure 75 "recovery rejects a candidate whose digest differs before live mutation" run_script --recover "$CANDIDATE_TAG"
unset DEPLOY_TEST_RECOVER_WRONG_CANDIDATE
target_after_recover="$(sha256sum "$CADDY_TARGET_CONFIG" | cut -d' ' -f1)"
if [[ "$target_before_recover" == "$target_after_recover" ]] && [[ "$(tr -d '[:space:]' <"$DEPLOY_ROOT/.marketing-release")" == "$PREVIOUS_TAG" ]]; then pass "recovery candidate mismatch leaves Caddy bytes and marker unchanged"; else fail "recovery candidate mismatch leaves Caddy bytes and marker unchanged"; fi

new_case marker_failure
export DEPLOY_TEST_FAIL_MARKER=1
assert_failure 75 "marker failure after live switch exits 75" run_script "$CANDIDATE_TAG"
unset DEPLOY_TEST_FAIL_MARKER
if [[ "$(tr -d '[:space:]' <"$RUNNING_TAG")" == "$PREVIOUS_TAG" && "$(tr -d '[:space:]' <"$DEPLOY_ROOT/.marketing-release")" == "$PREVIOUS_TAG" ]] && grep -Fq 'previous complete caddy config' "$CADDY_TARGET_CONFIG"; then pass "marker failure confirms full Caddy and app rollback while preserving the old marker"; else fail "marker failure confirms full Caddy and app rollback while preserving the old marker"; fi

new_case invalid_binding_after_switch
export DEPLOY_TEST_TAMPER_INSTALL_BACKUP=1
assert_failure 75 "invalid post-switch Caddy binding enters recovery" run_script "$CANDIDATE_TAG"
unset DEPLOY_TEST_TAMPER_INSTALL_BACKUP
if [[ "$(tr -d '[:space:]' <"$RUNNING_TAG")" == "$CANDIDATE_TAG" ]] && grep -Fq 'candidate caddy config' "$CADDY_TARGET_CONFIG" && ! grep -Fq 'caddy-helper --restore-full' "$CALL_LOG" && [[ -d "$DEPLOY_ROOT/marketing-rollbacks/$CANDIDATE_TAG" ]]; then pass "invalid backup is never consumed for restore and candidate live state is preserved"; else fail "invalid backup is never consumed for restore and candidate live state is preserved"; fi

# RED: post-success rollback is app-first, restores full Caddy, and writes marker last.
new_case explicit_rollback
assert_success "fixture release succeeds before explicit rollback" run_script "$CANDIDATE_TAG"
: >"$CALL_LOG"
assert_success "explicit rollback succeeds for the marker-bound candidate" run_script --rollback "$CANDIDATE_TAG"
if [[ "$(tr -d '[:space:]' <"$RUNNING_TAG")" == "$PREVIOUS_TAG" ]] && grep -Fq 'previous complete caddy config' "$CADDY_TARGET_CONFIG" && [[ "$(tr -d '[:space:]' <"$DEPLOY_ROOT/.marketing-release")" == "$PREVIOUS_TAG" ]]; then pass "explicit rollback restores predecessor app, complete Caddyfile, then marker"; else fail "explicit rollback restores predecessor app, complete Caddyfile, then marker"; fi
first_up_line="$(grep -n "up -d.*www" "$CALL_LOG" | head -n1 | cut -d: -f1 || true)"
restore_line="$(grep -n 'caddy-helper --restore-full' "$CALL_LOG" | head -n1 | cut -d: -f1 || true)"
if [[ -n "$first_up_line" && -n "$restore_line" && "$first_up_line" -lt "$restore_line" ]]; then pass "explicit rollback switches and health-checks predecessor app before Caddy"; else fail "explicit rollback switches and health-checks predecessor app before Caddy"; fi

new_case rollback_mismatch
mkdir -p "$DEPLOY_ROOT/marketing-rollbacks/$CANDIDATE_TAG"
printf '%s\n' "$CANDIDATE_TAG" >"$DEPLOY_ROOT/marketing-rollbacks/$CANDIDATE_TAG/candidate-image-tag"
printf '%s\n' "$PREVIOUS_TAG" >"$DEPLOY_ROOT/marketing-rollbacks/$CANDIDATE_TAG/previous-image-tag"
printf '%s\n' 'backup' >"$DEPLOY_ROOT/marketing-rollbacks/$CANDIDATE_TAG/Caddyfile.previous"
printf '%s\n' 'sha-3333333333333333333333333333333333333333' >"$DEPLOY_ROOT/.marketing-release"
before_digest="$(tree_snapshot "$DEPLOY_ROOT")"
assert_failure 1 "rollback rejects marker and bundle mismatch" run_script --rollback "$CANDIDATE_TAG"
after_digest="$(tree_snapshot "$DEPLOY_ROOT")"
if [[ "$before_digest" == "$after_digest" && ! -s "$CALL_LOG" ]]; then pass "rollback mismatch is mutation-free"; else fail "rollback mismatch is mutation-free"; fi

new_case rollback_tamper
assert_success "fixture release succeeds before rollback integrity tamper" run_script "$CANDIDATE_TAG"
: >"$CALL_LOG"
printf '%s\n' 'tampered backup' >>"$DEPLOY_ROOT/marketing-rollbacks/$CANDIDATE_TAG/Caddyfile.previous"
before_digest="$(tree_snapshot "$DEPLOY_ROOT")"
assert_failure 1 "rollback rejects a backup whose SHA no longer matches its binding" run_script --rollback "$CANDIDATE_TAG"
after_digest="$(tree_snapshot "$DEPLOY_ROOT")"
if [[ "$before_digest" == "$after_digest" && ! -s "$CALL_LOG" ]]; then pass "tampered rollback backup is rejected before mutation"; else fail "tampered rollback backup is rejected before mutation"; fi

new_case rollback_unrelated_caddy_drift
assert_success "fixture release succeeds before unrelated Caddy drift" run_script "$CANDIDATE_TAG"
printf '%s\n' '# unrelated operator change' >>"$CADDY_TARGET_CONFIG"
target_before_drift_reject="$(sha256sum "$CADDY_TARGET_CONFIG" | cut -d' ' -f1)"
: >"$CALL_LOG"
assert_failure 1 "rollback rejects unrelated full-Caddyfile drift" run_script --rollback "$CANDIDATE_TAG"
target_after_drift_reject="$(sha256sum "$CADDY_TARGET_CONFIG" | cut -d' ' -f1)"
if [[ "$target_before_drift_reject" == "$target_after_drift_reject" ]] && [[ "$(tr -d '[:space:]' <"$RUNNING_TAG")" == "$CANDIDATE_TAG" ]] && [[ ! -s "$CALL_LOG" ]]; then pass "unrelated Caddy drift is rejected before app, Caddy, or marker mutation"; else fail "unrelated Caddy drift is rejected before app, Caddy, or marker mutation"; fi

new_case rollback_app_failure
assert_success "fixture release succeeds before rollback app failure" run_script "$CANDIDATE_TAG"
: >"$CALL_LOG"
export DEPLOY_TEST_FAIL_START_TAG="$PREVIOUS_TAG"
assert_failure 1 "rollback predecessor app failure is rejected" run_script --rollback "$CANDIDATE_TAG"
unset DEPLOY_TEST_FAIL_START_TAG
if grep -Fq 'candidate caddy config' "$CADDY_TARGET_CONFIG" && ! grep -Fq 'caddy-helper --restore-full' "$CALL_LOG"; then pass "rollback app failure leaves current Caddy untouched"; else fail "rollback app failure leaves current Caddy untouched"; fi

new_case rollback_caddy_failure
assert_success "fixture release succeeds before rollback Caddy failure" run_script "$CANDIDATE_TAG"
: >"$CALL_LOG"
export DEPLOY_TEST_CADDY_RESTORE_STATUS=1
assert_failure 75 "rollback Caddy failure exits 75" run_script --rollback "$CANDIDATE_TAG"
unset DEPLOY_TEST_CADDY_RESTORE_STATUS
if [[ "$(tr -d '[:space:]' <"$RUNNING_TAG")" == "$CANDIDATE_TAG" ]] && [[ "$(tr -d '[:space:]' <"$DEPLOY_ROOT/.marketing-release")" == "$CANDIDATE_TAG" ]] && [[ -d "$DEPLOY_ROOT/marketing-rollbacks/$CANDIDATE_TAG" ]]; then pass "rollback Caddy failure restores candidate app and preserves recovery material"; else fail "rollback Caddy failure restores candidate app and preserves recovery material"; fi

new_case rollback_marker_pending
assert_success "fixture release succeeds before rollback marker failure" run_script "$CANDIDATE_TAG"
export DEPLOY_TEST_FAIL_MARKER=1
assert_failure 75 "rollback marker failure enters a marker-pending recovery state" run_script --rollback "$CANDIDATE_TAG"
unset DEPLOY_TEST_FAIL_MARKER
pending="$DEPLOY_ROOT/marketing-rollbacks/$CANDIDATE_TAG/rollback-marker-pending"
if [[ -f "$pending" ]] && [[ "$(tr -d '[:space:]' <"$DEPLOY_ROOT/.marketing-release")" == "$CANDIDATE_TAG" ]] && grep -Fq 'previous complete caddy config' "$CADDY_TARGET_CONFIG"; then pass "rollback marker failure binds pending state to predecessor Caddy"; else fail "rollback marker failure binds pending state to predecessor Caddy"; fi
: >"$CALL_LOG"
assert_success "retrying a marker-pending rollback converges the predecessor" run_script --rollback "$CANDIDATE_TAG"
if [[ "$(tr -d '[:space:]' <"$RUNNING_TAG")" == "$PREVIOUS_TAG" ]] && [[ "$(tr -d '[:space:]' <"$DEPLOY_ROOT/.marketing-release")" == "$PREVIOUS_TAG" ]] && grep -Fq 'caddy-helper --confirm-restored' "$CALL_LOG"; then pass "marker-pending retry confirms Caddy and writes predecessor marker last"; else fail "marker-pending retry confirms Caddy and writes predecessor marker last"; fi

new_case rollback_marker_unknown_caddy
assert_success "fixture release succeeds before unknown marker-pending Caddy" run_script "$CANDIDATE_TAG"
export DEPLOY_TEST_FAIL_MARKER=1
assert_failure 75 "fixture creates marker-pending rollback" run_script --rollback "$CANDIDATE_TAG"
unset DEPLOY_TEST_FAIL_MARKER
printf '%s\n' 'unknown caddy bytes' >"$CADDY_TARGET_CONFIG"
target_before_retry="$(sha256sum "$CADDY_TARGET_CONFIG" | cut -d' ' -f1)"
assert_failure 1 "marker-pending retry rejects unknown current Caddy before mutation" run_script --rollback "$CANDIDATE_TAG"
target_after_retry="$(sha256sum "$CADDY_TARGET_CONFIG" | cut -d' ' -f1)"
if [[ "$target_before_retry" == "$target_after_retry" ]] && [[ "$(tr -d '[:space:]' <"$DEPLOY_ROOT/.marketing-release")" == "$CANDIDATE_TAG" ]]; then pass "unknown marker-pending Caddy remains untouched with candidate marker"; else fail "unknown marker-pending Caddy remains untouched with candidate marker"; fi

if ((failures > 0)); then
	printf '%s deployment contract check(s) failed.\n' "$failures" >&2
	exit 1
fi

echo "All marketing deployment and durable rollback contract checks passed."
