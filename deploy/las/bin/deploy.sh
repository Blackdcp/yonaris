#!/usr/bin/env bash

set -Eeuo pipefail
# Never let an inherited xtrace setting expose values sourced from the env file.
set +x
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

for required_script in \
  "$SCRIPT_DIR/backup.sh" \
  "$SCRIPT_DIR/check-sampling-storage.sh" \
  "$SCRIPT_DIR/prune-superseded-images.sh" \
  "$SCRIPT_DIR/rehearse-db-upgrade.sh"; do
  if [[ ! -f "$required_script" || ! -r "$required_script" ]]; then
    echo "Missing required deployment script: $required_script" >&2
    exit 1
  fi
done

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

WORKER_ENABLED="${WORKER_ENABLED:-true}"
if [[ "$WORKER_ENABLED" != true ]] && [[ "$WORKER_ENABLED" != false ]]; then
  echo "WORKER_ENABLED must be true or false." >&2
  exit 1
fi

WORKER_QUEUE_SCOPE="${WORKER_QUEUE_SCOPE:-full}"
if [[ "$WORKER_QUEUE_SCOPE" != full ]] && [[ "$WORKER_QUEUE_SCOPE" != analysis-only ]]; then
  echo "WORKER_QUEUE_SCOPE must be full or analysis-only." >&2
  exit 1
fi

RUNS_PER_PROMPT="${RUNS_PER_PROMPT:-5}"
if [[ ! "$RUNS_PER_PROMPT" =~ ^[1-9][0-9]*$ ]]; then
  echo "RUNS_PER_PROMPT must be a positive integer." >&2
  exit 1
fi

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

echo "Removing superseded, unused Yonaris release images"
DEPLOY_ROOT="$DEPLOY_ROOT" IMAGE_REGISTRY="${IMAGE_REGISTRY:-ghcr.io}" \
  IMAGE_NAMESPACE="${IMAGE_NAMESPACE:-blackdcp}" \
  bash "$SCRIPT_DIR/prune-superseded-images.sh" "$release_tag"

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

echo "Running the pre-migration Sampling storage preflight"
DEPLOY_ROOT="$DEPLOY_ROOT" COMPOSE_FILE="$COMPOSE_FILE" ENV_FILE="$ENV_FILE" \
  bash "$SCRIPT_DIR/check-sampling-storage.sh" --allow-missing-evidence-schema

echo "Creating a pre-migration backup"
backup_file="$(
  DEPLOY_ROOT="$DEPLOY_ROOT" COMPOSE_FILE="$COMPOSE_FILE" ENV_FILE="$ENV_FILE" \
    bash "$SCRIPT_DIR/backup.sh"
)"
if [[ "$backup_file" != /* ]] || \
  [[ "$backup_file" == *$'\n'* || "$backup_file" == *$'\r'* ]] || \
  [[ ! -f "$backup_file" || ! -r "$backup_file" ]]; then
  echo "Backup script did not return one readable absolute dump path." >&2
  exit 1
fi

migration_image="${IMAGE_REGISTRY:-ghcr.io}/${IMAGE_NAMESPACE:-blackdcp}/yonaris-db-migrate:$release_tag"
echo "Rehearsing the database upgrade with the immutable candidate image"
bash "$SCRIPT_DIR/rehearse-db-upgrade.sh" \
  "$backup_file" \
  --image "$migration_image"

echo "Running database migrations"
IMAGE_TAG="$release_tag" "${compose[@]}" --profile operations run --rm --no-deps db-migrate

echo "Running the post-migration strict Sampling storage preflight"
DEPLOY_ROOT="$DEPLOY_ROOT" COMPOSE_FILE="$COMPOSE_FILE" ENV_FILE="$ENV_FILE" \
  bash "$SCRIPT_DIR/check-sampling-storage.sh"

if [[ "${DEPLOYMENT_MODE:-}" == local ]]; then
  echo "Ensuring the local bootstrap owner has global admin access"
  if ! bootstrap_repair_output="$(
    IMAGE_TAG="$release_tag" "${compose[@]}" --profile operations run --rm --no-deps -T \
      account-ops node ./node_modules/tsx/dist/cli.mjs \
      ./src/repair-local-admin.ts --bootstrap-owner --apply 2>&1
  )"; then
    printf '%s\n' "$bootstrap_repair_output" >&2
    bootstrap_repair_code="$(
      printf '%s\n' "$bootstrap_repair_output" |
        sed -n 's/.*"code":"\([a-z0-9_]*\)".*/\1/p' |
        tail -n 1
    )"
    if [[ ! "$bootstrap_repair_code" =~ ^[a-z0-9_]+$ ]]; then
      bootstrap_repair_code="command_failed"
    fi
    printf '::error title=Bootstrap owner repair failed::code=%s\n' "$bootstrap_repair_code" >&2
    echo "Bootstrap owner repair failed; keeping the current runtime services unchanged." >&2
    exit 1
  fi
  printf '%s\n' "$bootstrap_repair_output"
fi

echo "Starting Yonaris runtime services"
runtime_services=(web)
if [[ "$WORKER_ENABLED" == true ]]; then
  runtime_services+=(worker)
fi
IMAGE_TAG="$release_tag" "${compose[@]}" up -d --no-deps "${runtime_services[@]}"
if [[ "$WORKER_ENABLED" == false ]]; then
  IMAGE_TAG="$release_tag" "${compose[@]}" stop worker >/dev/null 2>&1 || true
fi

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
    IMAGE_TAG="$previous_tag" "${compose[@]}" up -d --no-deps "${runtime_services[@]}"
    if [[ "$WORKER_ENABLED" == false ]]; then
      IMAGE_TAG="$previous_tag" "${compose[@]}" stop worker >/dev/null 2>&1 || true
    fi
  fi
  exit 1
fi

worker_ready=false
if [[ "$WORKER_ENABLED" == true ]]; then
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
else
  worker_ready=true
fi

if [[ "$worker_ready" != true ]]; then
  echo "Yonaris Worker did not remain stable." >&2
  IMAGE_TAG="$release_tag" "${compose[@]}" logs --tail 80 worker >&2 || true
  if [[ "$previous_tag" =~ ^sha-[0-9a-f]{40}$ ]]; then
    echo "Rolling Web and Worker back to $previous_tag; the database migration is not reversed."
    IMAGE_TAG="$previous_tag" "${compose[@]}" pull web worker || true
    IMAGE_TAG="$previous_tag" "${compose[@]}" up -d --no-deps "${runtime_services[@]}"
  fi
  exit 1
fi

printf '%s\n' "$release_tag" >"$RELEASE_FILE"
if [[ "$WORKER_ENABLED" == true ]]; then
  echo "Yonaris $release_tag is healthy on 127.0.0.1:${WEB_PORT}; Worker is stable."
else
  echo "Yonaris $release_tag is healthy on 127.0.0.1:${WEB_PORT}; Worker is intentionally paused."
fi
