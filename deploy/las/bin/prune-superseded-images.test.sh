#!/usr/bin/env bash

set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT_UNDER_TEST="$SCRIPT_DIR/prune-superseded-images.sh"
TEST_ROOT="$(mktemp -d)"
trap 'rm -rf -- "$TEST_ROOT"' EXIT

MOCK_BIN="$TEST_ROOT/bin"
DEPLOY_ROOT="$TEST_ROOT/deploy"
DOCKER_LOG="$TEST_ROOT/docker.log"
CURRENT_TAG="sha-1111111111111111111111111111111111111111"
CANDIDATE_TAG="sha-2222222222222222222222222222222222222222"
UNUSED_TAG="sha-3333333333333333333333333333333333333333"
USED_TAG="sha-4444444444444444444444444444444444444444"

mkdir -p "$MOCK_BIN" "$DEPLOY_ROOT"
printf '%s\n' "$CURRENT_TAG" >"$DEPLOY_ROOT/.release"

cat >"$MOCK_BIN/df" <<'EOF'
#!/usr/bin/env bash
set -Eeuo pipefail
printf 'Filesystem 1024-blocks Used Available Capacity Mounted on\n'
printf '/dev/mock 100000 50000 50000 50%% /mock\n'
EOF

cat >"$MOCK_BIN/docker" <<'EOF'
#!/usr/bin/env bash
set -Eeuo pipefail

printf '<%s>' "$1" >>"$MOCK_DOCKER_LOG"
printf ' <%s>' "${@:2}" >>"$MOCK_DOCKER_LOG"
printf '\n' >>"$MOCK_DOCKER_LOG"

if [[ "${MOCK_DOCKER_FAILURE:-}" == "$1-$2" ]]; then
  exit 91
fi

if [[ "$1 $2 $3" == 'ps -aq --no-trunc' ]]; then
  printf 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\n'
  exit 0
fi

if [[ "$1" == inspect && "$2" == --format ]]; then
  printf 'sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd\n'
  exit 0
fi

if [[ "$1 $2" == 'image ls' ]]; then
  repository="$3"
  case "$repository" in
    ghcr.io/blackdcp/yonaris-web)
      printf '%s\t%s\n' "$repository" 'sha-1111111111111111111111111111111111111111'
      printf '%s\t%s\n' "$repository" 'sha-2222222222222222222222222222222222222222'
      printf '%s\t%s\n' "$repository" 'sha-3333333333333333333333333333333333333333'
      printf '%s\t%s\n' "$repository" 'sha-4444444444444444444444444444444444444444'
      printf '%s\t%s\n' "$repository" latest
      ;;
    ghcr.io/blackdcp/yonaris-worker | ghcr.io/blackdcp/yonaris-db-migrate)
      printf '%s\t%s\n' "$repository" 'sha-3333333333333333333333333333333333333333'
      ;;
    *) exit 92 ;;
  esac
  exit 0
fi

if [[ "$1 $2" == 'image inspect' ]]; then
  ref="${@: -1}"
  if [[ "$ref" == *':sha-4444444444444444444444444444444444444444' ]]; then
    printf 'sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd\n'
  else
    printf 'sha256:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee\n'
  fi
  exit 0
fi

if [[ "$1 $2" == 'image rm' ]]; then
  exit 0
fi

echo "Unexpected Docker invocation" >&2
exit 93
EOF

chmod +x "$MOCK_BIN/df" "$MOCK_BIN/docker"

run_cleanup() {
  env \
    PATH="$MOCK_BIN:$PATH" \
    DEPLOY_ROOT="$DEPLOY_ROOT" \
    MOCK_DOCKER_LOG="$DOCKER_LOG" \
    IMAGE_REGISTRY=ghcr.io \
    IMAGE_NAMESPACE=blackdcp \
    bash "$SCRIPT_UNDER_TEST" "$CANDIDATE_TAG"
}

: >"$DOCKER_LOG"
output="$(run_cleanup)"
grep -Fq 'yonaris.images.removed=3' <<<"$output"
grep -Fq 'yonaris.images.protected=3' <<<"$output"
grep -Fq 'filesystem.available.bytes.before=51200000' <<<"$output"
grep -Fq 'filesystem.available.bytes.after=51200000' <<<"$output"

for expected_ref in \
  "ghcr.io/blackdcp/yonaris-web:$UNUSED_TAG" \
  "ghcr.io/blackdcp/yonaris-worker:$UNUSED_TAG" \
  "ghcr.io/blackdcp/yonaris-db-migrate:$UNUSED_TAG"; do
  grep -Fq "<image> <rm> <$expected_ref>" "$DOCKER_LOG"
done

for protected_ref in \
  "ghcr.io/blackdcp/yonaris-web:$CURRENT_TAG" \
  "ghcr.io/blackdcp/yonaris-web:$CANDIDATE_TAG" \
  "ghcr.io/blackdcp/yonaris-web:$USED_TAG"; do
  if grep -Fq "<image> <rm> <$protected_ref>" "$DOCKER_LOG"; then
    echo "Cleanup removed a protected image: $protected_ref" >&2
    exit 1
  fi
done

if grep -Eq '<system>|<volume>|<--force>|<prune>' "$DOCKER_LOG"; then
  echo "Cleanup used a broad or forced Docker deletion." >&2
  exit 1
fi

set +e
env PATH="$MOCK_BIN:$PATH" DEPLOY_ROOT="$DEPLOY_ROOT" \
  bash "$SCRIPT_UNDER_TEST" sha-invalid >"$TEST_ROOT/invalid.out" 2>"$TEST_ROOT/invalid.err"
invalid_status=$?
set -e
if [[ "$invalid_status" -ne 2 ]]; then
  echo "Invalid candidate tag did not fail closed." >&2
  exit 1
fi

: >"$DOCKER_LOG"
set +e
env PATH="$MOCK_BIN:$PATH" DEPLOY_ROOT="$DEPLOY_ROOT" \
  MOCK_DOCKER_LOG="$DOCKER_LOG" MOCK_DOCKER_FAILURE=ps--aq \
  bash "$SCRIPT_UNDER_TEST" "$CANDIDATE_TAG" >"$TEST_ROOT/docker.out" 2>"$TEST_ROOT/docker.err"
docker_status=$?
set -e
if [[ "$docker_status" -ne 1 ]]; then
  echo "Docker inventory failure did not fail closed." >&2
  exit 1
fi
grep -Fq 'Could not list Docker containers.' "$TEST_ROOT/docker.err"

echo "prune-superseded-images mock tests passed"
