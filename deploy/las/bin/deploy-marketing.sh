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
MARKETING_COMPOSE_FILE="${MARKETING_COMPOSE_FILE:-$(cd -- "$SCRIPT_DIR/.." && pwd)/compose.marketing.yaml}"
ENV_FILE="${ENV_FILE:-$DEPLOY_ROOT/.env}"
RELEASE_FILE="$DEPLOY_ROOT/.marketing-release"

if [[ ! -f "$MARKETING_COMPOSE_FILE" ]]; then
  echo "Missing marketing Compose file: $MARKETING_COMPOSE_FILE" >&2
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing production environment file: $ENV_FILE" >&2
  exit 1
fi

cd -- "$(dirname -- "$MARKETING_COMPOSE_FILE")"

mkdir -p "$DEPLOY_ROOT"
exec 9>"$DEPLOY_ROOT/.marketing-deploy.lock"
if ! flock -n 9; then
  echo "Another Yonaris marketing deployment is already running." >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

required_marketing_env=(RESEND_API_KEY RESEND_FROM_EMAIL MARKETING_LEAD_RECIPIENT)
missing_marketing_env=()
for variable_name in "${required_marketing_env[@]}"; do
  variable_value="${!variable_name-}"
  if [[ -z "${variable_value//[[:space:]]/}" ]]; then
    missing_marketing_env+=("$variable_name")
  fi
done
if (( ${#missing_marketing_env[@]} > 0 )); then
  echo "Missing required marketing configuration: ${missing_marketing_env[*]}" >&2
  exit 1
fi

previous_tag=""
if [[ -f "$RELEASE_FILE" ]]; then
  previous_tag="$(tr -d '[:space:]' <"$RELEASE_FILE")"
fi

compose=(docker compose --project-name yonaris-marketing --env-file "$ENV_FILE" --file "$MARKETING_COMPOSE_FILE")

rollback_marketing() {
  if [[ "$previous_tag" =~ ^sha-[0-9a-f]{40}$ ]]; then
    echo "Restoring the previous marketing image $previous_tag."
    if ! IMAGE_TAG="$previous_tag" "${compose[@]}" pull www; then
      echo "Could not refresh the previous image; trying the local cached image." >&2
    fi
    if ! IMAGE_TAG="$previous_tag" "${compose[@]}" up -d --no-deps --pull never www; then
      echo "Failed to restore the previous marketing container." >&2
      return 1
    fi

    for _ in $(seq 1 30); do
      if curl --fail --silent --show-error --max-time 5 "http://127.0.0.1:1516/" >/dev/null 2>&1; then
        echo "Previous marketing release $previous_tag is healthy again."
        return 0
      fi
      sleep 2
    done

    echo "The previous marketing container did not recover its health check." >&2
    IMAGE_TAG="$previous_tag" "${compose[@]}" logs --tail 80 www >&2 || true
    return 1
  else
    if ! IMAGE_TAG="$release_tag" "${compose[@]}" stop www >/dev/null 2>&1; then
      echo "Failed to stop the first unhealthy marketing release." >&2
      return 1
    fi
  fi
}

echo "Pulling the Yonaris marketing image for $release_tag"
IMAGE_TAG="$release_tag" "${compose[@]}" pull www

echo "Starting the Yonaris marketing site"
if ! IMAGE_TAG="$release_tag" "${compose[@]}" up -d --no-deps --pull never www; then
  echo "The Yonaris marketing container failed to start." >&2
  IMAGE_TAG="$release_tag" "${compose[@]}" logs --tail 80 www >&2 || true
  rollback_marketing
  exit 1
fi

www_ready=false
for _ in $(seq 1 45); do
  if curl --fail --silent --show-error --max-time 5 "http://127.0.0.1:1516/" >/dev/null 2>&1; then
    www_ready=true
    break
  fi
  sleep 2
done

if [[ "$www_ready" != true ]]; then
  echo "Yonaris marketing site failed its HTTP health check." >&2
  IMAGE_TAG="$release_tag" "${compose[@]}" logs --tail 80 www >&2 || true
  rollback_marketing
  exit 1
fi

helper_image="${IMAGE_REGISTRY:-ghcr.io}/${IMAGE_NAMESPACE:-blackdcp}/yonaris-www:${release_tag}"
set +e
CADDY_HELPER_IMAGE="$helper_image" bash "$SCRIPT_DIR/install-marketing-caddy.sh"
caddy_install_status=$?
set -e
if (( caddy_install_status == 75 )); then
  echo "Caddy rollback could not be confirmed; leaving the healthy marketing container running for recovery." >&2
  exit 75
fi
if (( caddy_install_status != 0 )); then
  rollback_marketing
  exit 1
fi

release_file_tmp="${RELEASE_FILE}.tmp.$$"
if ! { printf '%s\n' "$release_tag" >"$release_file_tmp" && mv -f -- "$release_file_tmp" "$RELEASE_FILE"; }; then
  rm -f -- "$release_file_tmp"
  echo "The site is live, but the marketing release marker could not be updated." >&2
  exit 1
fi
echo "Yonaris marketing $release_tag is healthy on 127.0.0.1:1516 and live on yonaris.com."
