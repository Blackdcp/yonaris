#!/usr/bin/env bash

set -Eeuo pipefail
# Never expose values inherited from the production environment.
set +x

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 sha-<40-character-git-sha>" >&2
  exit 2
fi

candidate_tag="$1"
if [[ ! "$candidate_tag" =~ ^sha-[0-9a-f]{40}$ ]]; then
  echo "Refusing invalid immutable release tag." >&2
  exit 2
fi

for required_command in docker df awk; do
  if ! command -v "$required_command" >/dev/null 2>&1; then
    echo "Missing required command: $required_command" >&2
    exit 1
  fi
done

DEPLOY_ROOT="${DEPLOY_ROOT:-/opt/yonaris}"
RELEASE_FILE="$DEPLOY_ROOT/.release"
IMAGE_REGISTRY="${IMAGE_REGISTRY:-ghcr.io}"
IMAGE_NAMESPACE="${IMAGE_NAMESPACE:-blackdcp}"

if [[ "$DEPLOY_ROOT" != /* || "$DEPLOY_ROOT" == "/" ||
  "$DEPLOY_ROOT" == *$'\r'* || "$DEPLOY_ROOT" == *$'\n'* ]]; then
  echo "DEPLOY_ROOT must be a non-root absolute path without CR or LF." >&2
  exit 1
fi

repository_prefix="$IMAGE_REGISTRY/$IMAGE_NAMESPACE"
if [[ ! "$IMAGE_REGISTRY" =~ ^[a-z0-9.-]+(:[0-9]+)?$ ]] ||
  [[ ! "$IMAGE_NAMESPACE" =~ ^[a-z0-9]+([._-][a-z0-9]+)*(/[a-z0-9]+([._-][a-z0-9]+)*)*$ ]]; then
  echo "IMAGE_REGISTRY and IMAGE_NAMESPACE do not form a valid lowercase Docker repository prefix." >&2
  exit 1
fi

current_tag=""
if [[ -f "$RELEASE_FILE" ]]; then
  current_tag="$(<"$RELEASE_FILE")"
  if [[ ! "$current_tag" =~ ^sha-[0-9a-f]{40}$ ]]; then
    echo "Refusing an invalid current release marker." >&2
    exit 1
  fi
fi

measure_available_bytes() {
  local metrics
  if ! metrics="$(df -Pk -- "$DEPLOY_ROOT" | awk 'NR == 2 { print $4 }')" ||
    [[ ! "$metrics" =~ ^(0|[1-9][0-9]{0,17})$ ]]; then
    echo "Could not measure deployment filesystem availability." >&2
    return 1
  fi
  printf '%s\n' "$((metrics * 1024))"
}

declare -A protected_image_ids=()
if ! container_output="$(docker ps -aq --no-trunc)"; then
  echo "Could not list Docker containers." >&2
  exit 1
fi
container_ids=()
if [[ -n "$container_output" ]]; then
  mapfile -t container_ids <<<"$container_output"
fi
for container_id in "${container_ids[@]}"; do
  if [[ ! "$container_id" =~ ^[0-9a-f]{12,64}$ ]]; then
    echo "Docker returned an invalid container identifier." >&2
    exit 1
  fi
done

if ((${#container_ids[@]} > 0)); then
  if ! container_image_output="$(
    docker inspect --format '{{.Image}}' "${container_ids[@]}"
  )"; then
    echo "Could not inspect Docker container images." >&2
    exit 1
  fi
  mapfile -t container_image_ids <<<"$container_image_output"
  if ((${#container_image_ids[@]} != ${#container_ids[@]})); then
    echo "Docker did not return one image identifier per container." >&2
    exit 1
  fi
  for image_id in "${container_image_ids[@]}"; do
    if [[ ! "$image_id" =~ ^sha256:[0-9a-f]{64}$ ]]; then
      echo "Docker returned an invalid container image identifier." >&2
      exit 1
    fi
    protected_image_ids["$image_id"]=1
  done
fi

available_before="$(measure_available_bytes)"
removed_count=0
protected_count=0

repositories=(
  "$repository_prefix/yonaris-web"
  "$repository_prefix/yonaris-worker"
  "$repository_prefix/yonaris-db-migrate"
)

for repository in "${repositories[@]}"; do
  if ! image_output="$(
    docker image ls "$repository" --format '{{.Repository}}\t{{.Tag}}'
  )"; then
    echo "Could not list Yonaris release images." >&2
    exit 1
  fi
  image_rows=()
  if [[ -n "$image_output" ]]; then
    mapfile -t image_rows <<<"$image_output"
  fi
  for image_row in "${image_rows[@]}"; do
    IFS=$'\t' read -r listed_repository listed_tag extra <<<"$image_row"
    if [[ -n "${extra:-}" || "$listed_repository" != "$repository" ]]; then
      echo "Docker returned an unexpected image listing row." >&2
      exit 1
    fi
    # Never touch mutable, dangling, or non-release tags.
    if [[ ! "$listed_tag" =~ ^sha-[0-9a-f]{40}$ ]]; then
      continue
    fi
    if [[ "$listed_tag" == "$candidate_tag" || "$listed_tag" == "$current_tag" ]]; then
      protected_count=$((protected_count + 1))
      continue
    fi

    image_ref="$listed_repository:$listed_tag"
    image_id="$(docker image inspect --format '{{.Id}}' "$image_ref")"
    if [[ ! "$image_id" =~ ^sha256:[0-9a-f]{64}$ ]]; then
      echo "Docker returned an invalid image identifier for a Yonaris release." >&2
      exit 1
    fi
    if [[ -n "${protected_image_ids[$image_id]:-}" ]]; then
      protected_count=$((protected_count + 1))
      continue
    fi

    echo "Removing superseded Yonaris image: $image_ref"
    docker image rm "$image_ref" >/dev/null
    removed_count=$((removed_count + 1))
  done
done

available_after="$(measure_available_bytes)"
printf '%s\n' \
  "yonaris.images.removed=$removed_count" \
  "yonaris.images.protected=$protected_count" \
  "filesystem.available.bytes.before=$available_before" \
  "filesystem.available.bytes.after=$available_after"
