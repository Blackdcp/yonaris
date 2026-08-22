#!/usr/bin/env bash

set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "$SCRIPT_DIR/../../.." && pwd)"
DEPLOY_SCRIPT="$SCRIPT_DIR/deploy-marketing.sh"
COMPOSE_FILE="$REPO_ROOT/deploy/las/compose.marketing.yaml"
WORKFLOW_FILE="$REPO_ROOT/.github/workflows/deploy-marketing.yaml"
RELEASE_TAG="sha-1111111111111111111111111111111111111111"
TEST_SECRET="re_unit_test_secret_value"

test_root="$(mktemp -d)"
trap 'rm -rf -- "$test_root"' EXIT

failures=0
fail() {
	echo "not ok - $1" >&2
	failures=$((failures + 1))
}

pass() {
	echo "ok - $1"
}

mkdir -p "$test_root/bin" "$test_root/script" "$test_root/deploy"
cp "$DEPLOY_SCRIPT" "$test_root/script/deploy-marketing.sh"
cat >"$test_root/script/install-marketing-caddy.sh" <<'STUB'
#!/usr/bin/env bash
exit 0
STUB
cat >"$test_root/bin/docker" <<'STUB'
#!/usr/bin/env bash
printf 'docker %s\n' "$*" >>"$DEPLOY_TEST_CALL_LOG"
printf 'env %s|%s|%s\n' \
  "${RESEND_API_KEY-UNSET}" \
  "${RESEND_FROM_EMAIL-UNSET}" \
  "${MARKETING_LEAD_RECIPIENT-UNSET}" >>"$DEPLOY_TEST_ENV_LOG"
exit 0
STUB
cat >"$test_root/bin/curl" <<'STUB'
#!/usr/bin/env bash
printf 'curl %s\n' "$*" >>"$DEPLOY_TEST_CALL_LOG"
exit 0
STUB
cat >"$test_root/bin/flock" <<'STUB'
#!/usr/bin/env bash
exit 0
STUB
chmod +x "$test_root/script/"*.sh "$test_root/bin/"*

call_log="$test_root/calls.log"
env_log="$test_root/env.log"
output_log="$test_root/output.log"
export DEPLOY_TEST_CALL_LOG="$call_log"
export DEPLOY_TEST_ENV_LOG="$env_log"

write_env() {
	local target="$1"
	local invalid_variable="$2"
	cat >"$target" <<EOF
IMAGE_REGISTRY=ghcr.io
IMAGE_NAMESPACE=blackdcp
IMAGE_TAG=$RELEASE_TAG
EOF
	if [[ "$invalid_variable" != RESEND_API_KEY ]]; then
		printf 'RESEND_API_KEY=%s\n' "$TEST_SECRET" >>"$target"
	fi
	if [[ "$invalid_variable" == RESEND_FROM_EMAIL ]]; then
		printf "%s\n" "RESEND_FROM_EMAIL='   '" >>"$target"
	else
		printf "%s\n" "RESEND_FROM_EMAIL='Yonaris <diagnostic@yonaris.com>'" >>"$target"
	fi
	if [[ "$invalid_variable" != MARKETING_LEAD_RECIPIENT ]]; then
		printf '%s\n' 'MARKETING_LEAD_RECIPIENT=black.dcp@outlook.com' >>"$target"
	fi
}

for invalid_variable in RESEND_API_KEY RESEND_FROM_EMAIL MARKETING_LEAD_RECIPIENT; do
	invalid_env="$test_root/$invalid_variable.env"
	write_env "$invalid_env" "$invalid_variable"
	: >"$call_log"
	: >"$env_log"
	if env \
		PATH="$test_root/bin:$PATH" \
		DEPLOY_ROOT="$test_root/deploy" \
		MARKETING_COMPOSE_FILE="$COMPOSE_FILE" \
		ENV_FILE="$invalid_env" \
		bash "$test_root/script/deploy-marketing.sh" "$RELEASE_TAG" >"$output_log" 2>&1; then
		fail "$invalid_variable blank or missing is rejected"
	else
		pass "$invalid_variable blank or missing is rejected"
	fi
	if [[ -s "$call_log" ]]; then
		fail "$invalid_variable preflight runs before Docker and network commands"
	else
		pass "$invalid_variable preflight runs before Docker and network commands"
	fi
	if grep -Fq "$TEST_SECRET" "$output_log"; then
		fail "$invalid_variable deployment error redacts the Resend API key"
	else
		pass "$invalid_variable deployment error redacts the Resend API key"
	fi
done

valid_env="$test_root/valid.env"
write_env "$valid_env" ""
: >"$call_log"
: >"$env_log"
if env \
	PATH="$test_root/bin:$PATH" \
	DEPLOY_ROOT="$test_root/deploy" \
	MARKETING_COMPOSE_FILE="$COMPOSE_FILE" \
	ENV_FILE="$valid_env" \
	bash "$test_root/script/deploy-marketing.sh" "$RELEASE_TAG" >"$output_log" 2>&1; then
	pass "valid configuration completes against isolated deployment doubles"
else
	fail "valid configuration completes against isolated deployment doubles"
fi
if grep -Eq 'api\.resend\.com|/domains([/?[:space:]]|$)' "$call_log"; then
	fail "deployment performs no Resend network or domain API call"
else
	pass "deployment performs no Resend network or domain API call"
fi
if grep -Fq "env $TEST_SECRET|Yonaris <diagnostic@yonaris.com>|black.dcp@outlook.com" "$env_log"; then
	pass "deployment exports all three values to Compose"
else
	fail "deployment exports all three values to Compose"
fi

compose_json="$test_root/compose.json"
if env \
	IMAGE_TAG="$RELEASE_TAG" \
	RESEND_API_KEY="$TEST_SECRET" \
	RESEND_FROM_EMAIL='Yonaris <diagnostic@yonaris.com>' \
	MARKETING_LEAD_RECIPIENT='black.dcp@outlook.com' \
	docker compose --project-name yonaris-marketing-test --file "$COMPOSE_FILE" config --format json >"$compose_json"; then
	if node - "$compose_json" <<'NODE'
const fs = require("node:fs");
const document = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const services = document.services ?? {};
const expected = {
  MARKETING_LEAD_RECIPIENT: "black.dcp@outlook.com",
  RESEND_API_KEY: "re_unit_test_secret_value",
  RESEND_FROM_EMAIL: "Yonaris <diagnostic@yonaris.com>",
};
const actual = services.www?.environment ?? {};
if (JSON.stringify(actual) !== JSON.stringify(expected)) process.exit(1);
for (const [name, service] of Object.entries(services)) {
  if (name === "www") continue;
  const environment = service?.environment ?? {};
  if (Object.keys(expected).some((key) => key in environment)) process.exit(1);
}
NODE
	then
		pass "Compose scopes exactly the three diagnostic variables to www"
	else
		fail "Compose scopes exactly the three diagnostic variables to www"
	fi
else
	fail "Compose configuration renders without contacting a daemon"
fi

if grep -Fq 'bash deploy/las/bin/deploy-marketing.test.sh' "$WORKFLOW_FILE"; then
	pass "the marketing workflow runs the isolated deployment test"
else
	fail "the marketing workflow runs the isolated deployment test"
fi

if (( failures > 0 )); then
	echo "$failures deployment contract check(s) failed." >&2
	exit 1
fi

echo "All marketing deployment contract checks passed."
