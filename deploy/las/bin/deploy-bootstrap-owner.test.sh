#!/usr/bin/env bash

set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT_UNDER_TEST="$SCRIPT_DIR/deploy.sh"
TEST_ROOT="$(mktemp -d)"
trap 'rm -rf -- "$TEST_ROOT"' EXIT

MOCK_BIN="$TEST_ROOT/bin"
MOCK_SCRIPT_DIR="$TEST_ROOT/deploy-bin"
DEPLOY_ROOT="$TEST_ROOT/deploy"
COMPOSE_FILE="$TEST_ROOT/compose.yaml"
ENV_FILE="$DEPLOY_ROOT/.env"
EVENT_LOG="$TEST_ROOT/events.log"
OLD_RELEASE="sha-1111111111111111111111111111111111111111"
NEW_RELEASE="sha-2222222222222222222222222222222222222222"

mkdir -p "$MOCK_BIN" "$MOCK_SCRIPT_DIR" "$DEPLOY_ROOT/backups"
sed 's/\r$//' "$SCRIPT_UNDER_TEST" >"$MOCK_SCRIPT_DIR/deploy.sh"
printf '{}\n' >"$COMPOSE_FILE"
cat >"$ENV_FILE" <<'EOF'
POSTGRES_USER=yonaris
POSTGRES_PASSWORD=database-password
POSTGRES_DB=yonaris
DATABASE_URL=postgres://yonaris:database-password@postgres:5432/yonaris
DEPLOYMENT_ID=deployment-id
APP_URL=https://portal.yonaris.test
BETTER_AUTH_SECRET=auth-secret
ELMO_ENCRYPTION_KEY=encryption-key
SCRAPE_TARGETS=chatgpt:brightdata:online
BRIGHTDATA_API_TOKEN=brightdata-token
WORKER_ENABLED=true
DEPLOYMENT_MODE=local
EOF

cat >"$MOCK_SCRIPT_DIR/check-sampling-storage.sh" <<'EOF'
#!/usr/bin/env bash
set -Eeuo pipefail
if [[ " $* " == *" --allow-missing-evidence-schema "* ]]; then
  printf 'preflight:pre-migration\n' >>"$MOCK_EVENT_LOG"
else
  printf 'preflight:post-migration\n' >>"$MOCK_EVENT_LOG"
fi
EOF

cat >"$MOCK_SCRIPT_DIR/check-response-snapshot-storage.sh" <<'EOF'
#!/usr/bin/env bash
set -Eeuo pipefail
if [[ " $* " == *" --round-trip "* ]]; then
  printf 'snapshot-storage:round-trip\n' >>"$MOCK_EVENT_LOG"
else
  printf 'snapshot-storage:preflight\n' >>"$MOCK_EVENT_LOG"
fi
EOF

cat >"$MOCK_SCRIPT_DIR/prune-superseded-images.sh" <<'EOF'
#!/usr/bin/env bash
set -Eeuo pipefail
printf 'images:prune:%s\n' "$*" >>"$MOCK_EVENT_LOG"
if [[ "${MOCK_PRUNE_RESULT:-success}" == failure ]]; then
  exit 1
fi
EOF

cat >"$MOCK_SCRIPT_DIR/backup.sh" <<'EOF'
#!/usr/bin/env bash
set -Eeuo pipefail
backup_file="$DEPLOY_ROOT/backups/mock.dump"
printf 'backup\n' >"$backup_file"
printf 'backup\n' >>"$MOCK_EVENT_LOG"
printf '%s\n' "$backup_file"
EOF

cat >"$MOCK_SCRIPT_DIR/rehearse-db-upgrade.sh" <<'EOF'
#!/usr/bin/env bash
set -Eeuo pipefail
printf 'rehearsal\n' >>"$MOCK_EVENT_LOG"
EOF

cat >"$MOCK_BIN/docker" <<'EOF'
#!/usr/bin/env bash
set -Eeuo pipefail

if [[ "$1" == inspect ]]; then
  printf 'running 0\n'
  exit 0
fi

if [[ "$1" != compose ]]; then
  echo "Unexpected docker invocation: $*" >&2
  exit 90
fi

joined=" $* "
if [[ "$joined" == *" exec -T postgres pg_isready "* ]]; then
  exit 0
fi
if [[ "$joined" == *" ps -q worker "* ]]; then
  printf 'worker-container-id\n'
  exit 0
fi
if [[ "$joined" == *" run --rm --no-deps db-migrate "* ]]; then
  printf 'migration\n' >>"$MOCK_EVENT_LOG"
  exit 0
fi
if [[ "$joined" == *" --profile operations run --rm --no-deps -T account-ops "* ]]; then
  printf 'bootstrap:%s\n' "$*" >>"$MOCK_EVENT_LOG"
  if [[ "$joined" != *" account-ops node ./node_modules/tsx/dist/cli.mjs ./src/repair-local-admin.ts --bootstrap-owner --apply "* ]]; then
    echo "Unexpected bootstrap owner command: $*" >&2
    exit 91
  fi
  if [[ "$MOCK_BOOTSTRAP_RESULT" == failure ]]; then
    printf '{"status":"error","code":"bootstrap_owner_ambiguous"}\n' >&2
    exit 1
  fi
  printf '{"status":"applied","changesRequired":false,"changed":false,"sessionsRevoked":0}\n'
  exit 0
fi
if [[ "$joined" == *" up -d --no-deps web worker "* ]]; then
  printf 'runtime:start\n' >>"$MOCK_EVENT_LOG"
  exit 0
fi

printf 'docker:%s\n' "$*" >>"$MOCK_EVENT_LOG"
EOF

cat >"$MOCK_BIN/curl" <<'EOF'
#!/usr/bin/env bash
set -Eeuo pipefail
exit 0
EOF

cat >"$MOCK_BIN/sleep" <<'EOF'
#!/usr/bin/env bash
set -Eeuo pipefail
exit 0
EOF

cat >"$MOCK_BIN/flock" <<'EOF'
#!/usr/bin/env bash
set -Eeuo pipefail
if [[ "$#" -eq 2 && "$1" == -n && "$2" == 9 ]]; then
  exit 0
fi
echo "Unexpected flock invocation: $*" >&2
exit 92
EOF

chmod +x \
  "$MOCK_SCRIPT_DIR/deploy.sh" \
  "$MOCK_SCRIPT_DIR/backup.sh" \
  "$MOCK_SCRIPT_DIR/check-sampling-storage.sh" \
  "$MOCK_SCRIPT_DIR/check-response-snapshot-storage.sh" \
  "$MOCK_SCRIPT_DIR/prune-superseded-images.sh" \
  "$MOCK_SCRIPT_DIR/rehearse-db-upgrade.sh" \
  "$MOCK_BIN/docker" \
  "$MOCK_BIN/curl" \
  "$MOCK_BIN/sleep" \
  "$MOCK_BIN/flock"

run_deploy() {
  local bootstrap_result="$1"
  local prune_result="${2:-success}"
  env \
    PATH="$MOCK_BIN:$PATH" \
    DEPLOY_ROOT="$DEPLOY_ROOT" \
    COMPOSE_FILE="$COMPOSE_FILE" \
    ENV_FILE="$ENV_FILE" \
    MOCK_EVENT_LOG="$EVENT_LOG" \
    MOCK_BOOTSTRAP_RESULT="$bootstrap_result" \
    MOCK_PRUNE_RESULT="$prune_result" \
    bash "$MOCK_SCRIPT_DIR/deploy.sh" "$NEW_RELEASE"
}

assert_order() {
  local earlier="$1"
  local later="$2"
  local earlier_line
  local later_line
  earlier_line="$(grep -n -m1 -F -- "$earlier" "$EVENT_LOG" | cut -d: -f1)"
  later_line="$(grep -n -m1 -F -- "$later" "$EVENT_LOG" | cut -d: -f1)"
  if [[ -z "$earlier_line" || -z "$later_line" || "$earlier_line" -ge "$later_line" ]]; then
    echo "Expected '$earlier' before '$later'." >&2
    exit 1
  fi
}

: >"$EVENT_LOG"
printf '%s\n' "$OLD_RELEASE" >"$DEPLOY_ROOT/.release"
success_output="$(run_deploy success)"
grep -Fq '"status":"applied"' <<<"$success_output"
grep -Fq -- 'account-ops node ./node_modules/tsx/dist/cli.mjs ./src/repair-local-admin.ts --bootstrap-owner --apply' "$EVENT_LOG"
if grep -Eq 'account-ops (pnpm|npx)' "$EVENT_LOG"; then
  echo "Bootstrap repair unexpectedly invoked a runtime package manager." >&2
  exit 1
fi
assert_order 'migration' 'preflight:post-migration'
assert_order 'images:prune:' 'preflight:pre-migration'
assert_order 'snapshot-storage:preflight' 'backup'
assert_order 'preflight:post-migration' 'bootstrap:'
assert_order 'preflight:post-migration' 'snapshot-storage:round-trip'
assert_order 'snapshot-storage:round-trip' 'bootstrap:'
assert_order 'bootstrap:' 'runtime:start'
if [[ "$(tr -d '[:space:]' <"$DEPLOY_ROOT/.release")" != "$NEW_RELEASE" ]]; then
  echo "Successful deployment did not update the immutable release marker." >&2
  exit 1
fi

: >"$EVENT_LOG"
printf '%s\n' "$OLD_RELEASE" >"$DEPLOY_ROOT/.release"
set +e
run_deploy failure >"$TEST_ROOT/failure.out" 2>"$TEST_ROOT/failure.err"
failure_status=$?
set -e
if [[ "$failure_status" -eq 0 ]]; then
  echo "Ambiguous bootstrap owner unexpectedly passed deployment." >&2
  exit 1
fi
grep -Fq 'Bootstrap owner repair failed; keeping the current runtime services unchanged.' \
  "$TEST_ROOT/failure.err"
grep -Fq '::error title=Bootstrap owner repair failed::code=bootstrap_owner_ambiguous' \
  "$TEST_ROOT/failure.err"
grep -Fq 'bootstrap:' "$EVENT_LOG"
if grep -Fq 'runtime:start' "$EVENT_LOG"; then
  echo "Runtime services were replaced after bootstrap owner repair failed." >&2
  exit 1
fi
if [[ "$(tr -d '[:space:]' <"$DEPLOY_ROOT/.release")" != "$OLD_RELEASE" ]]; then
  echo "Failed deployment changed the release marker." >&2
  exit 1
fi

: >"$EVENT_LOG"
sed -i 's/^DEPLOYMENT_MODE=.*/DEPLOYMENT_MODE=cloud/' "$ENV_FILE"
run_deploy success >"$TEST_ROOT/non-local.out"
if grep -Fq 'bootstrap:' "$EVENT_LOG"; then
  echo "Bootstrap owner repair ran outside local deployment mode." >&2
  exit 1
fi
grep -Fq 'runtime:start' "$EVENT_LOG"

: >"$EVENT_LOG"
set +e
run_deploy success failure >"$TEST_ROOT/prune-failure.out" 2>"$TEST_ROOT/prune-failure.err"
prune_failure_status=$?
set -e
if [[ "$prune_failure_status" -eq 0 ]]; then
  echo "Failed image inventory unexpectedly allowed deployment to continue." >&2
  exit 1
fi
grep -Fq "images:prune:$NEW_RELEASE" "$EVENT_LOG"
if grep -Eq 'preflight:|backup|migration|bootstrap:|runtime:start' "$EVENT_LOG"; then
  echo "Deployment continued after targeted image cleanup failed." >&2
  exit 1
fi

echo "deploy bootstrap owner mock tests passed"
