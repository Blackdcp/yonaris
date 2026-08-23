#!/usr/bin/env bash

set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "$SCRIPT_DIR/../../.." && pwd)"
INSTALLER="$SCRIPT_DIR/install-marketing-caddy.sh"
REDIRECT="$REPO_ROOT/deploy/las/caddy/yonaris-redirect.caddy"
V1="$REPO_ROOT/deploy/las/caddy/yonaris-marketing-v1.caddy"
V2="$REPO_ROOT/deploy/las/caddy/yonaris-marketing-v2.caddy"
FINAL="$REPO_ROOT/deploy/las/caddy/yonaris-marketing.caddy"

TEST_ROOT="$(mktemp -d)"
trap 'rm -rf -- "$TEST_ROOT"' EXIT

failures=0
pass() { printf 'ok - %s\n' "$1"; }
fail() { printf 'not ok - %s\n' "$1" >&2; failures=$((failures + 1)); }

assert_status() {
	local expected="$1" description="$2"
	shift 2
	set +e
	"$@" >"$CASE_ROOT/output.log" 2>&1
	local actual=$?
	set -e
	if [[ "$actual" == "$expected" ]]; then pass "$description"; else fail "$description (status=$actual expected=$expected)"; sed -n '1,160p' "$CASE_ROOT/output.log" >&2; fi
}

fixture="$TEST_ROOT/fixture"
mkdir -p "$fixture/bin"

cat >"$fixture/bin/caddy" <<'STUB'
#!/usr/bin/env bash
set -Eeuo pipefail
printf 'caddy %s\n' "$*" >>"$CADDY_TEST_COMMAND_LOG"
if [[ "${1:-}" == validate ]]; then
	config=""
	while [[ $# -gt 0 ]]; do
		if [[ "$1" == --config ]]; then config="$2"; break; fi
		shift
	done
	if [[ "${CADDY_TEST_FAIL_CANDIDATE_VALIDATE:-0}" == 1 ]] && grep -Fq '@diagnosticCloudflare' "$config"; then exit 1; fi
	if [[ "${CADDY_TEST_FAIL_RESTORE_VALIDATE:-0}" == 1 ]] && ! grep -Fq '@diagnosticCloudflare' "$config"; then exit 1; fi
	exit 0
fi
if [[ "${1:-}" == reload ]]; then
	count=0
	[[ -f "$CADDY_TEST_RELOAD_COUNT" ]] && count="$(cat "$CADDY_TEST_RELOAD_COUNT")"
	count=$((count + 1))
	printf '%s\n' "$count" >"$CADDY_TEST_RELOAD_COUNT"
	if [[ "${CADDY_TEST_FAIL_RELOAD_ALWAYS:-0}" == 1 ]]; then exit 1; fi
	if [[ "${CADDY_TEST_FAIL_RELOAD_ONCE:-0}" == 1 && "$count" == 1 ]]; then exit 1; fi
fi
exit 0
STUB

cat >"$fixture/bin/chown" <<'STUB'
#!/usr/bin/env bash
exit 0
STUB

cat >"$fixture/bin/install" <<'STUB'
#!/usr/bin/env bash
set -Eeuo pipefail
while [[ $# -gt 0 ]]; do
	case "$1" in
		-o | -g | -m) shift 2 ;;
		--) shift; break ;;
		*) break ;;
	esac
done
cp -- "$1" "$2"
STUB

cat >"$fixture/bin/curl" <<'STUB'
#!/usr/bin/env bash
set -Eeuo pipefail
output=""
url=""
method="GET"
while [[ $# -gt 0 ]]; do
	case "$1" in
		--output) output="$2"; shift 2 ;;
		--request) method="$2"; shift 2 ;;
		--write-out | --resolve | --max-time | --header | --data-binary) shift 2 ;;
		https://*) url="$1"; shift ;;
		*) shift ;;
	esac
done
printf 'curl %s %s\n' "$method" "$url" >>"$CADDY_TEST_CURL_LOG"
if [[ -n "${CADDY_TEST_FAIL_HEALTH_PATH:-}" && "$url" == *"$CADDY_TEST_FAIL_HEALTH_PATH"* ]]; then
	printf '500'
	exit 0
fi
status=200
body='Yonaris AI-native MarTech MarTech, rebuilt. See how AI is shaping your market.'
case "$url" in
	*/platform\?*) status=308; body='' ;;
	*/llms.mdx/site/* | */api/repo-activity/refresh | */api) status=404; body='' ;;
	*/api/diagnostic) status=400; body='{"ok":false,"code":"invalid_request"}' ;;
	*/agent/*) body='AI-native MarTech' ;;
esac
if [[ -n "$output" && "$output" != /dev/null ]]; then printf '%s' "$body" >"$output"; fi
printf '%s' "$status"
STUB

cat >"$fixture/bin/docker" <<'STUB'
#!/usr/bin/env bash
set -Eeuo pipefail
printf '%s\n' "$@" >"$CADDY_TEST_DOCKER_ARGV"
command_text=""
while [[ $# -gt 0 ]]; do
	if [[ "$1" == -c ]]; then
		command_text="$2"
		shift 2
		break
	fi
	shift
done
[[ "$command_text" == *'bash "$@"'* ]]
[[ "${1:-}" == sh ]]
[[ "${2:-}" == "$CADDY_TEST_EXPECTED_SCRIPT" ]]
[[ "${3:-}" == --inside-host ]]
[[ "${4:-}" == install ]]
script_count=0
for argument in "$@"; do [[ "$argument" == "$CADDY_TEST_EXPECTED_SCRIPT" ]] && script_count=$((script_count + 1)); done
[[ "$script_count" == 1 ]]
STUB

chmod +x "$fixture/bin/"*

new_case() {
	local name="$1"
	CASE_ROOT="$TEST_ROOT/$name"
	TARGET="$CASE_ROOT/Caddyfile"
	BACKUP_OUT="$CASE_ROOT/durable/Caddyfile.previous"
	META_OUT="$CASE_ROOT/durable"
	COMMAND_LOG="$CASE_ROOT/caddy.log"
	CURL_LOG="$CASE_ROOT/curl.log"
	RELOAD_COUNT="$CASE_ROOT/reload-count"
	mkdir -p "$CASE_ROOT" "$META_OUT"
	: >"$COMMAND_LOG"
	: >"$CURL_LOG"
}

write_full_config() {
	local fragment="$1" target="$2"
	{
		printf '%s\n' 'unrelated.example {' $'\trespond "keep me"' '}'
		cat "$fragment"
		printf '%s\n' 'portal.yonaris.com {' $'\trespond "portal stays"' '}'
	} >"$target"
}

run_install() {
	env \
		PATH="$fixture/bin:$PATH" \
		CADDY_TEST_COMMAND_LOG="$COMMAND_LOG" \
		CADDY_TEST_CURL_LOG="$CURL_LOG" \
		CADDY_TEST_RELOAD_COUNT="$RELOAD_COUNT" \
		CADDY_TEST_FAIL_CANDIDATE_VALIDATE="${CADDY_TEST_FAIL_CANDIDATE_VALIDATE:-0}" \
		CADDY_TEST_FAIL_RESTORE_VALIDATE="${CADDY_TEST_FAIL_RESTORE_VALIDATE:-0}" \
		CADDY_TEST_FAIL_RELOAD_ONCE="${CADDY_TEST_FAIL_RELOAD_ONCE:-0}" \
		CADDY_TEST_FAIL_RELOAD_ALWAYS="${CADDY_TEST_FAIL_RELOAD_ALWAYS:-0}" \
		CADDY_TEST_FAIL_HEALTH_PATH="${CADDY_TEST_FAIL_HEALTH_PATH:-}" \
		MARKETING_HEALTH_RELOAD_ATTEMPTS=1 \
		bash "$INSTALLER" --inside-host install "$REDIRECT" "$V1" "$V2" "$FINAL" "$TARGET" "$BACKUP_OUT" "$META_OUT"
}

run_restore() {
	local backup="$1" expected_sha_file="$2"
	local expected_backup_file="$CASE_ROOT/expected-backup-sha"
	printf '%s\n' "$(sha256sum "$backup" | cut -d' ' -f1)" >"$expected_backup_file"
	env \
		PATH="$fixture/bin:$PATH" \
		CADDY_TEST_COMMAND_LOG="$COMMAND_LOG" \
		CADDY_TEST_CURL_LOG="$CURL_LOG" \
		CADDY_TEST_RELOAD_COUNT="$RELOAD_COUNT" \
		CADDY_TEST_FAIL_RELOAD_ALWAYS="${CADDY_TEST_FAIL_RELOAD_ALWAYS:-0}" \
		MARKETING_HEALTH_RELOAD_ATTEMPTS=1 \
		bash "$INSTALLER" --inside-host restore "$backup" "$TARGET" "$expected_sha_file" "$expected_backup_file" "$REDIRECT" "$V1" "$V2" "$FINAL"
}

tree_snapshot() {
	find "$1" ! -name output.log ! -name caddy.log ! -name curl.log ! -name reload-count -printf '%P|%y|%m|%T@|%i\n' | sort
	find "$1" -type f ! -name output.log ! -name caddy.log ! -name curl.log ! -name reload-count -print0 | sort -z | xargs -0 sha256sum
}

file_snapshot() {
	stat -c '%n|%F|%a|%Y|%i|%s' "$1"
	sha256sum "$1"
}

# RED: every reviewed state and final-current are accepted, with full health.
for state in redirect v1 v2 final; do
	case "$state" in
		redirect) fragment="$REDIRECT" ;;
		v1) fragment="$V1" ;;
		v2) fragment="$V2" ;;
		final) fragment="$FINAL" ;;
	esac
	new_case "accepted_$state"
	write_full_config "$fragment" "$TARGET"
	cp "$TARGET" "$CASE_ROOT/original"
	assert_status 0 "$state reviewed Caddy state upgrades or validates idempotently" run_install
	if grep -Fq '@diagnosticCloudflare' "$TARGET" && grep -Fq 'respond "keep me"' "$TARGET" && grep -Fq 'respond "portal stays"' "$TARGET"; then pass "$state preserves unrelated full-Caddyfile blocks"; else fail "$state preserves unrelated full-Caddyfile blocks"; fi
	if cmp -s "$CASE_ROOT/original" "$BACKUP_OUT"; then pass "$state persists the complete predecessor Caddyfile"; else fail "$state persists the complete predecessor Caddyfile"; fi
	expected_backup_sha=""
	[[ -f "$BACKUP_OUT" ]] && expected_backup_sha="$(sha256sum "$BACKUP_OUT" | cut -d' ' -f1)"
	previous_binding=""
	candidate_binding=""
	[[ -f "$META_OUT/previous-caddy-sha256" ]] && previous_binding="$(tr -d '[:space:]' <"$META_OUT/previous-caddy-sha256")"
	[[ -f "$META_OUT/candidate-caddy-sha256" ]] && candidate_binding="$(tr -d '[:space:]' <"$META_OUT/candidate-caddy-sha256")"
	if [[ -n "$expected_backup_sha" && "$previous_binding" == "$expected_backup_sha" && "$candidate_binding" == "$(sha256sum "$TARGET" | cut -d' ' -f1)" ]]; then pass "$state writes full-file predecessor and candidate Caddy bindings"; else fail "$state writes full-file predecessor and candidate Caddy bindings"; fi
	for required in '/product' '/approach' '/research' '/company' '/status' '/privacy' '/agent/company' '/llms.txt' '/recordranks-logo.svg' '/platform?fixture=1' '/llms.mdx/site/private' '/api/repo-activity/refresh' '/api/diagnostic'; do
		if ! grep -Fq "$required" "$CURL_LOG"; then fail "$state full health includes $required"; fi
	done
done

# RED: the top-level helper passes the script path exactly once before the mode.
new_case outer_dispatch
docker_argv="$CASE_ROOT/docker-argv"
assert_status 0 "outer helper dispatch passes one exact inside-host argv vector" env \
	PATH="$fixture/bin:$PATH" \
	DEPLOY_ROOT="$CASE_ROOT/deploy" \
	CADDY_LEGACY_FRAGMENT="$REDIRECT" \
	CADDY_PREVIOUS_MARKETING_FRAGMENT="$V1" \
	CADDY_V2_MARKETING_FRAGMENT="$V2" \
	CADDY_MARKETING_FRAGMENT="$FINAL" \
	CADDY_TARGET_CONFIG="$TARGET" \
	CADDY_BACKUP_OUTPUT="$BACKUP_OUT" \
	CADDY_METADATA_DIR="$META_OUT" \
	CADDY_HELPER_IMAGE=fixture-helper:immutable \
	CADDY_TEST_DOCKER_ARGV="$docker_argv" \
	CADDY_TEST_EXPECTED_SCRIPT="$CASE_ROOT/deploy/source/deploy/las/bin/install-marketing-caddy.sh" \
	bash "$INSTALLER"

# RED: unknown state is refused before tempfile, validation, reload, or health.
new_case unknown
cat >"$TARGET" <<'EOF'
unrelated.example {
	respond "keep me"
}
yonaris.com, www.yonaris.com {
	respond "unknown"
}
portal.yonaris.com {
	respond "portal stays"
}
EOF
before="$(file_snapshot "$TARGET")"
assert_status 1 "unknown live apex block is rejected" run_install
after="$(file_snapshot "$TARGET")"
unknown_temp_count="$(find "$CASE_ROOT" -maxdepth 1 -type d -name '.yonaris-caddy.*' | wc -l | tr -d '[:space:]')"
if [[ "$before" == "$after" && ! -s "$COMMAND_LOG" && ! -s "$CURL_LOG" && ! -e "$BACKUP_OUT" && "$unknown_temp_count" == 0 ]]; then pass "unknown-state refusal makes zero mutation or effectful call"; else fail "unknown-state refusal makes zero mutation or effectful call"; fi

# RED: validation never writes live; reload/health failure restores complete backup.
new_case candidate_validate_failure
write_full_config "$V2" "$TARGET"
cp "$TARGET" "$CASE_ROOT/original"
export CADDY_TEST_FAIL_CANDIDATE_VALIDATE=1
assert_status 1 "candidate validation failure is rejected" run_install
unset CADDY_TEST_FAIL_CANDIDATE_VALIDATE
if cmp -s "$CASE_ROOT/original" "$TARGET" && ! grep -Fq 'caddy reload' "$COMMAND_LOG" && [[ ! -s "$CURL_LOG" ]]; then pass "candidate validation failure leaves live Caddy untouched"; else fail "candidate validation failure leaves live Caddy untouched"; fi

new_case reload_failure
write_full_config "$V2" "$TARGET"
cp "$TARGET" "$CASE_ROOT/original"
export CADDY_TEST_FAIL_RELOAD_ONCE=1
assert_status 1 "candidate reload failure returns after confirmed full rollback" run_install
unset CADDY_TEST_FAIL_RELOAD_ONCE
if cmp -s "$CASE_ROOT/original" "$TARGET" && [[ "$(cat "$RELOAD_COUNT" 2>/dev/null || true)" == 2 ]]; then pass "reload failure restores, validates, and reloads complete predecessor"; else fail "reload failure restores, validates, and reloads complete predecessor"; fi

new_case health_failure
write_full_config "$V2" "$TARGET"
cp "$TARGET" "$CASE_ROOT/original"
export CADDY_TEST_FAIL_HEALTH_PATH=/company
assert_status 1 "full-health failure returns after confirmed full rollback" run_install
unset CADDY_TEST_FAIL_HEALTH_PATH
if cmp -s "$CASE_ROOT/original" "$TARGET" && [[ "$(cat "$RELOAD_COUNT" 2>/dev/null || true)" == 2 ]]; then pass "health failure restores complete predecessor"; else fail "health failure restores complete predecessor"; fi

new_case recovery_failure
write_full_config "$V2" "$TARGET"
export CADDY_TEST_FAIL_RELOAD_ALWAYS=1
assert_status 75 "unconfirmed restore reload exits 75" run_install
unset CADDY_TEST_FAIL_RELOAD_ALWAYS
recovery_count="$(find "$CASE_ROOT" -maxdepth 1 -type d -name '.yonaris-caddy.*' | wc -l | tr -d '[:space:]')"
if [[ "$recovery_count" == 1 ]]; then pass "unconfirmed rollback preserves one recovery directory"; else fail "unconfirmed rollback preserves one recovery directory"; fi

# RED: explicit rollback verifies current binding, restores full file, and checks apex+Portal.
new_case explicit_restore
write_full_config "$FINAL" "$TARGET"
write_full_config "$V2" "$CASE_ROOT/Caddyfile.previous"
printf '%s\n' "$(sha256sum "$TARGET" | cut -d' ' -f1)" >"$CASE_ROOT/expected-current-sha"
assert_status 0 "explicit restore accepts marker-bound current candidate" run_restore "$CASE_ROOT/Caddyfile.previous" "$CASE_ROOT/expected-current-sha"
if cmp -s "$TARGET" "$CASE_ROOT/Caddyfile.previous" && grep -Fq 'https://yonaris.com/' "$CURL_LOG" && grep -Fq 'https://portal.yonaris.com/' "$CURL_LOG"; then pass "explicit restore installs full predecessor and verifies apex plus Portal"; else fail "explicit restore installs full predecessor and verifies apex plus Portal"; fi

new_case restore_mismatch
write_full_config "$V2" "$TARGET"
write_full_config "$REDIRECT" "$CASE_ROOT/Caddyfile.previous"
printf '%s\n' "$(sha256sum "$FINAL" | cut -d' ' -f1)" >"$CASE_ROOT/expected-current-sha"
before="$(file_snapshot "$TARGET")"
assert_status 1 "explicit restore rejects current-candidate hash mismatch" run_restore "$CASE_ROOT/Caddyfile.previous" "$CASE_ROOT/expected-current-sha"
after="$(file_snapshot "$TARGET")"
restore_temp_count="$(find "$CASE_ROOT" -maxdepth 1 -type d -name '.yonaris-caddy.*' | wc -l | tr -d '[:space:]')"
if [[ "$before" == "$after" && ! -s "$COMMAND_LOG" && ! -s "$CURL_LOG" && "$restore_temp_count" == 0 ]]; then pass "explicit restore mismatch is mutation-free"; else fail "explicit restore mismatch is mutation-free"; fi

new_case restore_unrelated_drift
write_full_config "$FINAL" "$TARGET"
write_full_config "$V2" "$CASE_ROOT/Caddyfile.previous"
printf '%s\n' "$(sha256sum "$TARGET" | cut -d' ' -f1)" >"$CASE_ROOT/expected-current-sha"
printf '%s\n' '# unrelated operator change' >>"$TARGET"
before="$(file_snapshot "$TARGET")"
assert_status 1 "explicit restore rejects unrelated full-Caddyfile drift" run_restore "$CASE_ROOT/Caddyfile.previous" "$CASE_ROOT/expected-current-sha"
after="$(file_snapshot "$TARGET")"
if [[ "$before" == "$after" && ! -s "$COMMAND_LOG" && ! -s "$CURL_LOG" ]]; then pass "unrelated Caddy changes are never overwritten by rollback"; else fail "unrelated Caddy changes are never overwritten by rollback"; fi

if ((failures > 0)); then
	printf '%s installer contract check(s) failed.\n' "$failures" >&2
	exit 1
fi

echo "All marketing Caddy installer state-machine checks passed."
