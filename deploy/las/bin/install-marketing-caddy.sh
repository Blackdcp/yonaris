#!/usr/bin/env bash

set -Eeuo pipefail
umask 077

if [[ "${1:-}" == "--inside-host" ]]; then
  legacy_fragment="${2:?Missing expected legacy Caddy fragment}"
  marketing_fragment="${3:?Missing marketing Caddy fragment}"
  target_config="${4:?Missing target Caddy config}"
  target_dir="$(dirname -- "$target_config")"
  candidate_config="$target_dir/.Caddyfile.yonaris-candidate-$$"
  backup_config="$target_dir/.Caddyfile.yonaris-backup-$$"
  extracted_block="$target_dir/.Caddyfile.yonaris-block-$$"
  apex_response="/tmp/yonaris-apex-response-$$"
  changed_config=false

  cleanup() {
    rm -f -- "$candidate_config" "$backup_config" "$extracted_block" "$apex_response"
  }
  trap cleanup EXIT

  restore_previous_config() {
    echo "Restoring the previous Caddy configuration." >&2
    install -o root -g root -m 0644 -- "$backup_config" "$candidate_config"
    mv -f -- "$candidate_config" "$target_config"
    caddy validate --config "$target_config" --adapter caddyfile >/dev/null
    caddy reload --config "$target_config" --adapter caddyfile --force
  }

  for required_file in "$legacy_fragment" "$marketing_fragment" "$target_config"; do
    if [[ ! -f "$required_file" ]]; then
      echo "Missing required Caddy file: $required_file" >&2
      exit 1
    fi
  done

  block_header="yonaris.com, www.yonaris.com {"
  mapfile -t header_lines < <(grep -nF -x -- "$block_header" "$target_config" | cut -d: -f1)
  if [[ "${#header_lines[@]}" -ne 1 ]]; then
    echo "Expected exactly one Yonaris apex block; found ${#header_lines[@]}." >&2
    exit 1
  fi

  start_line="${header_lines[0]}"
  if sed -n "${start_line},/^}$/p" "$target_config" >"$extracted_block" &&
    cmp -s -- "$extracted_block" "$marketing_fragment"; then
    install -o root -g root -m 0644 -- "$target_config" "$candidate_config"
  elif cmp -s -- "$extracted_block" "$legacy_fragment"; then
    block_lines="$(wc -l <"$legacy_fragment" | tr -d '[:space:]')"
    {
      if (( start_line > 1 )); then
        head -n "$((start_line - 1))" "$target_config"
      fi
      cat -- "$marketing_fragment"
      tail -n "+$((start_line + block_lines))" "$target_config"
    } >"$candidate_config"
    chown root:root "$candidate_config"
    chmod 0644 "$candidate_config"
    changed_config=true
  else
    echo "The live Yonaris Caddy block does not match either reviewed state; refusing to edit it." >&2
    exit 1
  fi

  caddy validate --config "$candidate_config" --adapter caddyfile >/dev/null
  install -o root -g root -m 0644 -- "$target_config" "$backup_config"
  mv -f -- "$candidate_config" "$target_config"

  if ! caddy reload --config "$target_config" --adapter caddyfile --force; then
    restore_previous_config
    exit 1
  fi

  if ! apex_status="$(curl --insecure --silent --show-error --max-time 15 \
    --output "$apex_response" --write-out '%{http_code}' \
    --resolve yonaris.com:443:127.0.0.1 https://yonaris.com/)"; then
    echo "The direct apex health check could not connect." >&2
    restore_previous_config
    exit 1
  fi

  if ! portal_status="$(curl --insecure --silent --show-error --max-time 15 \
    --output /dev/null --write-out '%{http_code}' \
    --resolve portal.yonaris.com:443:127.0.0.1 https://portal.yonaris.com/)"; then
    echo "The direct portal health check could not connect." >&2
    restore_previous_config
    exit 1
  fi

  if [[ "$apex_status" != 200 ]] || ! grep -Fq "Product Truth" "$apex_response" ||
    [[ "$portal_status" != 200 ]]; then
    echo "Post-reload checks failed (apex=$apex_status, portal=$portal_status)." >&2
    restore_previous_config
    exit 1
  fi

  if [[ "$changed_config" == true ]]; then
    echo "Caddy now proxies yonaris.com to the marketing site."
  else
    echo "The Yonaris marketing Caddy route was already installed and is healthy."
  fi
  exit 0
fi

DEPLOY_ROOT="${DEPLOY_ROOT:-/opt/yonaris}"
legacy_fragment="${CADDY_LEGACY_FRAGMENT:-$DEPLOY_ROOT/source/deploy/las/caddy/yonaris-redirect.caddy}"
marketing_fragment="${CADDY_MARKETING_FRAGMENT:-$DEPLOY_ROOT/source/deploy/las/caddy/yonaris-marketing.caddy}"
target_config="${CADDY_TARGET_CONFIG:-/etc/caddy/Caddyfile}"
helper_image="${CADDY_HELPER_IMAGE:?Set CADDY_HELPER_IMAGE to the deployed marketing image}"
script_path="$DEPLOY_ROOT/source/deploy/las/bin/install-marketing-caddy.sh"

docker run --rm \
  --user 0 \
  --network host \
  --entrypoint /bin/sh \
  --volume /:/host \
  "$helper_image" \
  -c 'exec chroot /host /usr/bin/env bash "$1" --inside-host "$2" "$3" "$4"' \
  sh "$script_path" "$legacy_fragment" "$marketing_fragment" "$target_config"
