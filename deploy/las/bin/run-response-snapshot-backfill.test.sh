#!/usr/bin/env bash

set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT_UNDER_TEST="$SCRIPT_DIR/run-response-snapshot-backfill.sh"
TEST_ROOT="$(mktemp -d)"
trap 'rm -rf -- "$TEST_ROOT"' EXIT
SOURCE_ROOT="$TEST_ROOT/source"
BIN_DIR="$SOURCE_ROOT/deploy/las/bin"
REQUEST_DIR="$SOURCE_ROOT/deploy/las/response-snapshot-backfills/requests"
DEPLOY_ROOT="$TEST_ROOT/deploy"
MOCK_BIN="$TEST_ROOT/bin"
RELEASE=sha-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
mkdir -p "$BIN_DIR" "$REQUEST_DIR" "$DEPLOY_ROOT" "$MOCK_BIN"
sed 's/\r$//' "$SCRIPT_UNDER_TEST" >"$BIN_DIR/run-response-snapshot-backfill.sh"
printf '{}\n' >"$SOURCE_ROOT/deploy/las/compose.yaml"
printf 'RESPONSE_SNAPSHOT_ENABLED=true\n' >"$DEPLOY_ROOT/.env"
printf '%s\n' "$RELEASE" >"$DEPLOY_ROOT/.release"

if python3 --version >/dev/null 2>&1; then
	TEST_PYTHON_BIN="$(command -v python3)"
elif [[ -x /c/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe ]]; then
	TEST_PYTHON_BIN=/c/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe
else
	echo "Python 3 is required for the backfill wrapper test." >&2
	exit 1
fi
cat >"$MOCK_BIN/python3" <<'EOF'
#!/usr/bin/env bash
set -o pipefail
"$TEST_PYTHON_BIN" "$@" | tr -d '\r'
EOF
export TEST_PYTHON_BIN

request="$REQUEST_DIR/request.json"
cat >"$request" <<'EOF'
{"schemaVersion":1,"operation":"backfill-response-snapshots","requestId":"reviewed","brandId":"stepfun","fromObservedAt":"2026-08-14T00:00:00.000Z","toObservedAtExclusive":"2026-08-15T00:00:00.000Z","channelsExact":["doubao"],"runIds":["11111111-1111-4111-8111-111111111111"],"expectedRunCount":1,"expectedRunFingerprint":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb","sourceCommitSha":"cccccccccccccccccccccccccccccccccccccccc"}
EOF

cat >"$MOCK_BIN/docker" <<'EOF'
#!/usr/bin/env bash
set -Eeuo pipefail
if [[ " $* " == *" --apply "* ]]; then
	printf '{"ok":true,"status":"applied","requestId":"reviewed","brandId":"stepfun","total":1,"runFingerprint":"%s","created":1,"alreadyReady":0,"pending":0,"failed":0}\n' "$(printf 'b%.0s' {1..64})"
else
	printf '{"ok":true,"status":"dry_run","requestId":"reviewed","brandId":"stepfun","total":1,"runFingerprint":"%s","existing":0,"wouldCreate":1,"currentStatuses":{"pending":0,"ready":0,"failed":0,"expired":0}}\n' "$(printf 'b%.0s' {1..64})"
fi
EOF
cat >"$MOCK_BIN/flock" <<'EOF'
#!/usr/bin/env bash
exit 0
EOF
cat >"$MOCK_BIN/install" <<'EOF'
#!/usr/bin/env bash
set -Eeuo pipefail
mkdir -p -- "${@: -1}"
EOF
chmod +x "$MOCK_BIN/docker" "$MOCK_BIN/flock" "$MOCK_BIN/install" "$MOCK_BIN/python3" "$BIN_DIR/run-response-snapshot-backfill.sh"

output="$(env PATH="$MOCK_BIN:$PATH" DEPLOY_ROOT="$DEPLOY_ROOT" COMPOSE_FILE="$SOURCE_ROOT/deploy/las/compose.yaml" ENV_FILE="$DEPLOY_ROOT/.env" bash "$BIN_DIR/run-response-snapshot-backfill.sh" "$RELEASE" "$request")"
grep -Fq 'response snapshot backfill dry-run:' <<<"$output"
grep -Fq 'response snapshot backfill apply:' <<<"$output"
test -f "$DEPLOY_ROOT/operation-receipts/response-snapshot-backfills/reviewed-$(printf 'b%.0s' {1..64}).json"

echo "run response snapshot backfill tests passed"
