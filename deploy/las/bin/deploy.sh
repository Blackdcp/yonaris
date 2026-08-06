#!/usr/bin/env bash

set -Eeuo pipefail
umask 077

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 sha-<40-character-git-sha>" >&2
  exit 2
fi

release_tag="$1"
if [[ ! "$release_tag" =~ ^sha-[0-9a-f]{40}$ ]]; then
  echo "Refusing invalid immutable release tag: $release_tag" >&2
  exit 2
fi

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_ROOT="${DEPLOY_ROOT:-/opt/yonaris}"
COMPOSE_FILE="${COMPOSE_FILE:-$(cd -- "$SCRIPT_DIR/.." && pwd)/compose.yaml}"
ENV_FILE="${ENV_FILE:-$DEPLOY_ROOT/.env}"
RELEASE_FILE="$DEPLOY_ROOT/.release"
WEB_PORT="${WEB_PORT:-1515}"

if [[ ! -f "$COMPOSE_FILE" ]]; then
  echo "Missing Compose file: $COMPOSE_FILE" >&2
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing production environment file: $ENV_FILE" >&2
  exit 1
fi

cd -- "$(dirname -- "$COMPOSE_FILE")"

mkdir -p "$DEPLOY_ROOT"
exec 9>"$DEPLOY_ROOT/.deploy.lock"
if ! flock -n 9; then
  echo "Another Yonaris deployment is already running." >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

required_vars=(
  POSTGRES_USER
  POSTGRES_PASSWORD
  POSTGRES_DB
  DATABASE_URL
  DEPLOYMENT_ID
  APP_URL
  BETTER_AUTH_SECRET
  ELMO_ENCRYPTION_KEY
  SCRAPE_TARGETS
)

require_value() {
  local variable="$1"
  local value="${!variable:-}"

  if [[ -z "${value//[[:space:]]/}" ]]; then
    echo "Missing required production value: $variable" >&2
    exit 1
  fi
  if [[ "$value" == *replace_with_* ]]; then
    echo "Refusing placeholder production value: $variable" >&2
    exit 1
  fi
}

for variable in "${required_vars[@]}"; do
  require_value "$variable"
done

IFS=',' read -r -a scrape_targets <<<"$SCRAPE_TARGETS"
for target in "${scrape_targets[@]}"; do
  IFS=':' read -r _ provider _ <<<"${target//[[:space:]]/}"
  case "$provider" in
    dataforseo)
      require_value DATAFORSEO_LOGIN
      require_value DATAFORSEO_PASSWORD
      ;;
    openai-api) require_value OPENAI_API_KEY ;;
    agnes-api) require_value AGNES_API_KEY ;;
    deepseek-api) require_value DEEPSEEK_API_KEY ;;
    anthropic-api) require_value ANTHROPIC_API_KEY ;;
    mistral-api) require_value MISTRAL_API_KEY ;;
    olostep) require_value OLOSTEP_API_KEY ;;
    brightdata) require_value BRIGHTDATA_API_TOKEN ;;
    oxylabs)
      require_value OXYLABS_USERNAME
      require_value OXYLABS_PASSWORD
      ;;
    openrouter) require_value OPENROUTER_API_KEY ;;
  esac
done

previous_tag=""
if [[ -f "$RELEASE_FILE" ]]; then
  previous_tag="$(tr -d '[:space:]' <"$RELEASE_FILE")"
fi

compose=(docker compose --project-name yonaris --env-file "$ENV_FILE" --file "$COMPOSE_FILE")

echo "Pulling Yonaris images for $release_tag"
IMAGE_TAG="$release_tag" "${compose[@]}" pull web worker db-migrate

echo "Starting PostgreSQL"
IMAGE_TAG="$release_tag" "${compose[@]}" up -d postgres

database_ready=false
for _ in $(seq 1 30); do
  if IMAGE_TAG="$release_tag" "${compose[@]}" exec -T postgres \
    pg_isready --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" >/dev/null 2>&1; then
    database_ready=true
    break
  fi
  sleep 2
done

if [[ "$database_ready" != true ]]; then
  echo "PostgreSQL did not become ready." >&2
  exit 1
fi

echo "Creating a pre-migration backup"
DEPLOY_ROOT="$DEPLOY_ROOT" COMPOSE_FILE="$COMPOSE_FILE" ENV_FILE="$ENV_FILE" \
  bash "$SCRIPT_DIR/backup.sh" >/dev/null

echo "Running database migrations"
IMAGE_TAG="$release_tag" "${compose[@]}" --profile operations run --rm --no-deps db-migrate

echo "Starting Web and Worker"
IMAGE_TAG="$release_tag" "${compose[@]}" up -d --no-deps web worker

web_ready=false
for _ in $(seq 1 45); do
  if curl --fail --silent --show-error --max-time 5 "http://127.0.0.1:${WEB_PORT}/" >/dev/null 2>&1; then
    web_ready=true
    break
  fi
  sleep 2
done

if [[ "$web_ready" != true ]]; then
  echo "Yonaris failed its HTTP health check." >&2
  IMAGE_TAG="$release_tag" "${compose[@]}" logs --tail 80 web >&2 || true
  if [[ "$previous_tag" =~ ^sha-[0-9a-f]{40}$ ]]; then
    echo "Rolling Web and Worker back to $previous_tag; the database migration is not reversed."
    IMAGE_TAG="$previous_tag" "${compose[@]}" pull web worker || true
    IMAGE_TAG="$previous_tag" "${compose[@]}" up -d --no-deps web worker
  fi
  exit 1
fi

worker_ready=false
stable_checks=0
for _ in $(seq 1 15); do
  worker_id="$(IMAGE_TAG="$release_tag" "${compose[@]}" ps -q worker)"
  if [[ -n "$worker_id" ]] && [[ "$(docker inspect --format '{{.State.Status}} {{.RestartCount}}' "$worker_id")" == "running 0" ]]; then
    stable_checks=$((stable_checks + 1))
    if [[ "$stable_checks" -ge 5 ]]; then
      worker_ready=true
      break
    fi
  else
    stable_checks=0
  fi
  sleep 2
done

if [[ "$worker_ready" != true ]]; then
  echo "Yonaris Worker did not remain stable." >&2
  IMAGE_TAG="$release_tag" "${compose[@]}" logs --tail 80 worker >&2 || true
  if [[ "$previous_tag" =~ ^sha-[0-9a-f]{40}$ ]]; then
    echo "Rolling Web and Worker back to $previous_tag; the database migration is not reversed."
    IMAGE_TAG="$previous_tag" "${compose[@]}" pull web worker || true
    IMAGE_TAG="$previous_tag" "${compose[@]}" up -d --no-deps web worker
  fi
  exit 1
fi

printf '%s\n' "$release_tag" >"$RELEASE_FILE"
echo "Yonaris $release_tag is healthy on 127.0.0.1:${WEB_PORT}; Worker is stable."
