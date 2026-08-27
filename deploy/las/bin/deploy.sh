#!/usr/bin/env bash

set -Eeuo pipefail
# Never let an inherited xtrace setting expose values sourced from the env file.
set +x
umask 077
# Legacy candidate-side compatibility harness only.  The stable dispatcher and
# manage-las-runtime are the production deployment boundary.
LEGACY_DEPLOY_COMPATIBILITY='legacy-candidate-deploy-v1'
readonly LEGACY_DEPLOY_COMPATIBILITY
if [[ "${YONARIS_FORCED_DISPATCH_PROOF:-}" == \
  'yonaris-las-forced-command-v1' ]]; then
  PATH='/usr/bin:/bin'
fi
export PATH
ARTIFACT_OUTPUT_LANGUAGE_SYSTEM_PATH="$PATH"

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
DOTENV_LOADER="$SCRIPT_DIR/load-strict-dotenv.sh"
DEPLOY_ROOT="${DEPLOY_ROOT:-/opt/yonaris}"
COMPOSE_FILE="${COMPOSE_FILE:-$(cd -- "$SCRIPT_DIR/.." && pwd)/compose.yaml}"
ENV_FILE="${ENV_FILE:-$DEPLOY_ROOT/.env}"
RELEASE_FILE="$DEPLOY_ROOT/.release"
WEB_PORT="${WEB_PORT:-1515}"
INVOKED_FORCED_DISPATCH_PROOF="${YONARIS_FORCED_DISPATCH_PROOF:-}"
INVOKED_FORCED_DISPATCH_COMMAND="${SSH_ORIGINAL_COMMAND:-}"
INVOKED_OUTPUT_LANGUAGE_ACTIVATED="${YONARIS_OUTPUT_LANGUAGE_ACTIVATED:-}"
ARTIFACT_OUTPUT_LANGUAGE_TOKEN='artifact-output-language-v1'
ARTIFACT_OUTPUT_LANGUAGE_FORCED_PROOF='yonaris-las-forced-command-v1'
ARTIFACT_OUTPUT_LANGUAGE_ROOT="$DEPLOY_ROOT/artifact-output-languages"
ARTIFACT_OUTPUT_LANGUAGE_RECEIPTS="$ARTIFACT_OUTPUT_LANGUAGE_ROOT/compatible-releases"
ARTIFACT_OUTPUT_LANGUAGE_MARKER='/etc/yonaris/artifact-output-language-active-v1'
ARTIFACT_OUTPUT_LANGUAGE_CAPABILITY_FILE="$SCRIPT_DIR/../artifact-output-language-compatible"
ARTIFACT_OUTPUT_LANGUAGE_HOST_GUARD='/usr/local/libexec/yonaris-las/guard-artifact-output-release'
ARTIFACT_OUTPUT_LANGUAGE_DEPLOY_UID="$(/usr/bin/id -u)"
ARTIFACT_OUTPUT_LANGUAGE_DEPLOY_GID="$(/usr/bin/id -g)"
STABLE_TRANSITION_MANAGED="${YONARIS_STABLE_TRANSITION_MANAGED:-0}"
PREDECESSOR_RELEASE="${YONARIS_PREDECESSOR_RELEASE:-}"
PREDECESSOR_COMPOSE_FILE="${YONARIS_PREDECESSOR_COMPOSE_FILE:-}"

# The production env file is application configuration, never trusted invocation
# context. Capture the forced-command proof before sourcing it and freeze every
# path/token that defines this irreversible deployment contract.
readonly \
  release_tag SCRIPT_DIR DOTENV_LOADER DEPLOY_ROOT COMPOSE_FILE ENV_FILE RELEASE_FILE \
  INVOKED_FORCED_DISPATCH_PROOF INVOKED_FORCED_DISPATCH_COMMAND \
  INVOKED_OUTPUT_LANGUAGE_ACTIVATED \
  ARTIFACT_OUTPUT_LANGUAGE_TOKEN ARTIFACT_OUTPUT_LANGUAGE_FORCED_PROOF \
  ARTIFACT_OUTPUT_LANGUAGE_ROOT ARTIFACT_OUTPUT_LANGUAGE_RECEIPTS \
  ARTIFACT_OUTPUT_LANGUAGE_MARKER ARTIFACT_OUTPUT_LANGUAGE_CAPABILITY_FILE \
  ARTIFACT_OUTPUT_LANGUAGE_HOST_GUARD \
  ARTIFACT_OUTPUT_LANGUAGE_DEPLOY_UID ARTIFACT_OUTPUT_LANGUAGE_DEPLOY_GID \
  ARTIFACT_OUTPUT_LANGUAGE_SYSTEM_PATH STABLE_TRANSITION_MANAGED \
  PREDECESSOR_RELEASE PREDECESSOR_COMPOSE_FILE

artifact_output_language_metadata_matches() {
  local path="$1"
  local kind="$2"
  local uid="$3"
  local gid="$4"
  local mode="$5"

  if /usr/bin/readlink -- "$path" >/dev/null 2>&1; then
    return 1
  fi
  case "$kind" in
    directory) [[ -d "$path" ]] || return 1 ;;
    file) [[ -f "$path" && -r "$path" ]] || return 1 ;;
    *) return 1 ;;
  esac
  [[ "$(/usr/bin/stat -c '%u:%g:%a' -- "$path" 2>/dev/null)" == "$uid:$gid:$mode" ]]
}

artifact_output_language_forced_invocation_is_valid() {
  [[ "$INVOKED_FORCED_DISPATCH_PROOF" == "$ARTIFACT_OUTPUT_LANGUAGE_FORCED_PROOF" ]] && \
    [[ "$INVOKED_FORCED_DISPATCH_COMMAND" == \
      "yonaris-las-v1 deploy $release_tag $WEB_IMAGE_DIGEST $WORKER_IMAGE_DIGEST $MIGRATE_IMAGE_DIGEST $POSTGRES_IMAGE_DIGEST" ]]
}

has_exact_artifact_output_language_token() {
  local path="$1"
  [[ -f "$path" && -r "$path" ]] || return 1
  cmp -s "$path" <(printf '%s\n' "$ARTIFACT_OUTPUT_LANGUAGE_TOKEN")
}

artifact_output_language_activation_attestation_is_valid() {
  artifact_output_language_metadata_matches \
    "$ARTIFACT_OUTPUT_LANGUAGE_MARKER" file 0 0 400 && \
    cmp -s "$ARTIFACT_OUTPUT_LANGUAGE_MARKER" \
      <(printf '%s\n' 'artifact-output-language-active-v1')
}

artifact_output_language_activation_is_proven() {
  if [[ "$STABLE_TRANSITION_MANAGED" == 1 ]]; then
    [[ "$INVOKED_OUTPUT_LANGUAGE_ACTIVATED" == 1 ]]
  else
    artifact_output_language_activation_attestation_is_valid
  fi
}

artifact_output_language_stable_state_is_valid() {
  artifact_output_language_metadata_matches \
    "$ARTIFACT_OUTPUT_LANGUAGE_ROOT" directory \
    "$ARTIFACT_OUTPUT_LANGUAGE_DEPLOY_UID" "$ARTIFACT_OUTPUT_LANGUAGE_DEPLOY_GID" 700 && \
    artifact_output_language_metadata_matches \
      "$ARTIFACT_OUTPUT_LANGUAGE_RECEIPTS" directory \
      "$ARTIFACT_OUTPUT_LANGUAGE_DEPLOY_UID" "$ARTIFACT_OUTPUT_LANGUAGE_DEPLOY_GID" 700
}

artifact_output_language_stable_guard_metadata_is_valid() {
  artifact_output_language_metadata_matches \
    "$ARTIFACT_OUTPUT_LANGUAGE_HOST_GUARD" file 0 0 755
}

artifact_output_language_receipt_is_valid() {
  local release="$1"
  local receipt="$ARTIFACT_OUTPUT_LANGUAGE_RECEIPTS/$release"
  artifact_output_language_metadata_matches \
    "$receipt" file \
    "$ARTIFACT_OUTPUT_LANGUAGE_DEPLOY_UID" "$ARTIFACT_OUTPUT_LANGUAGE_DEPLOY_GID" 600 && \
    has_exact_artifact_output_language_token "$receipt"
}

prepare_artifact_output_language_directory() {
  local path="$1"
  local mode="$2"

  if [[ -e "$path" || -L "$path" ]]; then
    artifact_output_language_metadata_matches \
      "$path" directory \
      "$ARTIFACT_OUTPUT_LANGUAGE_DEPLOY_UID" \
      "$ARTIFACT_OUTPUT_LANGUAGE_DEPLOY_GID" "$mode"
    return
  fi

  case "$mode" in
    700) (umask 077; mkdir -- "$path") ;;
    750) (umask 027; mkdir -- "$path") ;;
    *) return 1 ;;
  esac && \
    artifact_output_language_metadata_matches \
      "$path" directory \
      "$ARTIFACT_OUTPUT_LANGUAGE_DEPLOY_UID" \
      "$ARTIFACT_OUTPUT_LANGUAGE_DEPLOY_GID" "$mode"
}

prepare_artifact_output_language_state() {
  if ! prepare_artifact_output_language_directory \
      "$ARTIFACT_OUTPUT_LANGUAGE_ROOT" 700 || \
    ! prepare_artifact_output_language_directory \
      "$ARTIFACT_OUTPUT_LANGUAGE_RECEIPTS" 700; then
    echo 'Could not prepare exact durable artifact output language state metadata.' >&2
    return 1
  fi
}

write_artifact_output_language_state() {
  local destination="$1"
  local description="$2"
  local temporary

  if [[ -e "$destination" || -L "$destination" ]]; then
    if artifact_output_language_metadata_matches \
        "$destination" file \
        "$ARTIFACT_OUTPUT_LANGUAGE_DEPLOY_UID" "$ARTIFACT_OUTPUT_LANGUAGE_DEPLOY_GID" 600 && \
      has_exact_artifact_output_language_token "$destination"; then
      return 0
    fi
    echo "Refusing malformed existing $description: $destination" >&2
    return 1
  fi

  temporary="$(mktemp "${destination}.tmp.XXXXXX")"
  if ! printf '%s\n' "$ARTIFACT_OUTPUT_LANGUAGE_TOKEN" >"$temporary" || \
    ! chmod 600 "$temporary" || \
    ! mv -f -- "$temporary" "$destination" || \
    ! artifact_output_language_metadata_matches \
      "$destination" file \
      "$ARTIFACT_OUTPUT_LANGUAGE_DEPLOY_UID" "$ARTIFACT_OUTPUT_LANGUAGE_DEPLOY_GID" 600 || \
    ! has_exact_artifact_output_language_token "$destination"; then
    rm -f -- "$temporary"
    echo "Could not atomically persist $description: $destination" >&2
    return 1
  fi
}

release_file_is_valid() {
  local path="$1"
  local expected_release="$2"
  artifact_output_language_metadata_matches \
    "$path" file \
    "$ARTIFACT_OUTPUT_LANGUAGE_DEPLOY_UID" "$ARTIFACT_OUTPUT_LANGUAGE_DEPLOY_GID" 600 && \
    cmp -s "$path" <(printf '%s\n' "$expected_release")
}

write_staged_release_file() {
  local destination="$1"
  local expected_release="$2"
  printf '%s\n' "$expected_release" >"$destination" && \
    chmod 600 "$destination" && \
    release_file_is_valid "$destination" "$expected_release"
}

rollback_healthy_release_transaction() {
  local receipt="$1"
  local receipt_was_created="$2"
  local release_backup="$3"
  local release_had_previous="$4"
  local release_was_committed="$5"
  local recovery_failed=false

  if [[ "$release_was_committed" == true ]]; then
    if [[ "$release_had_previous" == true ]]; then
      if ! mv -f -- "$release_backup" "$RELEASE_FILE"; then
        recovery_failed=true
      fi
    elif ! rm -f -- "$RELEASE_FILE"; then
      recovery_failed=true
    fi
  fi
  if [[ "$receipt_was_created" == true ]] && ! rm -f -- "$receipt"; then
    recovery_failed=true
  fi
  if [[ "$recovery_failed" == true ]]; then
    echo 'Healthy release transaction recovery failed; stop and repair durable state.' >&2
    return 1
  fi
}

persist_active_release_only() {
  local expected_release="$1"
  local release_temporary

  release_temporary="$(mktemp "$DEPLOY_ROOT/.release.tmp.XXXXXX")"
  if ! write_staged_release_file "$release_temporary" "$expected_release" || \
    ! mv -f -- "$release_temporary" "$RELEASE_FILE" || \
    ! release_file_is_valid "$RELEASE_FILE" "$expected_release"; then
    rm -f -- "$release_temporary"
    echo 'Could not atomically persist the active release.' >&2
    return 1
  fi
}

persist_healthy_release_transaction() {
  local expected_release="$1"
  local receipt="$ARTIFACT_OUTPUT_LANGUAGE_RECEIPTS/$expected_release"
  local receipt_temporary=''
  local release_temporary=''
  local release_backup=''
  local receipt_was_created=false
  local receipt_was_committed=false
  local release_had_previous=false
  local release_was_committed=false
  local previous_release=''

  if [[ -e "$receipt" || -L "$receipt" ]]; then
    artifact_output_language_receipt_is_valid "$expected_release" || {
      echo "Refusing malformed existing healthy release receipt: $receipt" >&2
      return 1
    }
  else
    receipt_was_created=true
    receipt_temporary="$(mktemp "$ARTIFACT_OUTPUT_LANGUAGE_RECEIPTS/.receipt.tmp.XXXXXX")"
    if ! printf '%s\n' "$ARTIFACT_OUTPUT_LANGUAGE_TOKEN" >"$receipt_temporary" || \
      ! chmod 600 "$receipt_temporary" || \
      ! artifact_output_language_metadata_matches \
        "$receipt_temporary" file \
        "$ARTIFACT_OUTPUT_LANGUAGE_DEPLOY_UID" "$ARTIFACT_OUTPUT_LANGUAGE_DEPLOY_GID" 600 || \
      ! has_exact_artifact_output_language_token "$receipt_temporary"; then
      rm -f -- "$receipt_temporary"
      echo 'Could not stage the healthy compatibility receipt.' >&2
      return 1
    fi
  fi

  release_temporary="$(mktemp "$DEPLOY_ROOT/.release.tmp.XXXXXX")"
  if ! write_staged_release_file "$release_temporary" "$expected_release"; then
    rm -f -- "$receipt_temporary" "$release_temporary"
    echo 'Could not stage the active release.' >&2
    return 1
  fi

  if [[ -e "$RELEASE_FILE" || -L "$RELEASE_FILE" ]]; then
    previous_release="$(tr -d '[:space:]' <"$RELEASE_FILE")"
    if [[ ! "$previous_release" =~ ^sha-[0-9a-f]{40}$ ]] || \
      ! release_file_is_valid "$RELEASE_FILE" "$previous_release"; then
      rm -f -- "$receipt_temporary" "$release_temporary"
      echo 'Refusing malformed existing active release.' >&2
      return 1
    fi
    release_had_previous=true
    release_backup="$(mktemp "$DEPLOY_ROOT/.release.backup.XXXXXX")"
    if ! write_staged_release_file "$release_backup" "$previous_release"; then
      rm -f -- "$receipt_temporary" "$release_temporary" "$release_backup"
      echo 'Could not stage active release transaction recovery.' >&2
      return 1
    fi
  fi

  if [[ "$receipt_was_created" == true ]]; then
    if ! mv -f -- "$receipt_temporary" "$receipt"; then
      rm -f -- "$receipt_temporary" "$release_temporary" "$release_backup"
      echo 'Could not atomically persist the healthy compatibility receipt.' >&2
      return 1
    fi
    receipt_was_committed=true
  fi

  if ! mv -f -- "$release_temporary" "$RELEASE_FILE"; then
    if ! rollback_healthy_release_transaction \
      "$receipt" "$receipt_was_committed" "$release_backup" \
      "$release_had_previous" false; then
      rm -f -- "$release_temporary"
      echo "Preserving recovery file for operator repair: $release_backup" >&2
      return 1
    fi
    rm -f -- "$release_temporary" "$release_backup"
    echo 'Could not atomically persist the active release; receipt was rolled back.' >&2
    return 1
  fi
  release_was_committed=true

  if ! artifact_output_language_receipt_is_valid "$expected_release" || \
    ! release_file_is_valid "$RELEASE_FILE" "$expected_release"; then
    if ! rollback_healthy_release_transaction \
      "$receipt" "$receipt_was_committed" "$release_backup" \
      "$release_had_previous" "$release_was_committed"; then
      rm -f -- "$release_temporary"
      echo "Preserving recovery file for operator repair: $release_backup" >&2
      return 1
    fi
    rm -f -- "$release_temporary" "$release_backup"
    echo 'Healthy release transaction verification failed and was rolled back.' >&2
    return 1
  fi

  rm -f -- "$release_backup"
}

if [[ ! -f "$COMPOSE_FILE" ]]; then
  echo "Missing Compose file: $COMPOSE_FILE" >&2
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing production environment file: $ENV_FILE" >&2
  exit 1
fi

for required_script in \
	"$DOTENV_LOADER" \
  "$SCRIPT_DIR/backup.sh" \
	"$SCRIPT_DIR/check-response-snapshot-storage.sh" \
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

# shellcheck source=deploy/las/bin/load-strict-dotenv.sh
source "$DOTENV_LOADER"
load_strict_dotenv "$ENV_FILE"
PATH="$ARTIFACT_OUTPUT_LANGUAGE_SYSTEM_PATH"
export PATH
readonly PATH

for digest_variable in WEB_IMAGE_DIGEST WORKER_IMAGE_DIGEST MIGRATE_IMAGE_DIGEST POSTGRES_IMAGE_DIGEST; do
  digest_value="${!digest_variable:-}"
  if [[ ! "$digest_value" =~ ^sha256:[0-9a-f]{64}$ ]]; then
    echo "Missing or invalid root-authorized image digest: $digest_variable" >&2
    exit 1
  fi
done

if [[ -z "${ARTIFACT_ZH_CN_ENABLED+x}" ]]; then
  ARTIFACT_ZH_CN_ENABLED=false
elif [[ "$ARTIFACT_ZH_CN_ENABLED" != true ]] && [[ "$ARTIFACT_ZH_CN_ENABLED" != false ]]; then
  echo "ARTIFACT_ZH_CN_ENABLED must be true or false." >&2
  exit 1
fi

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
  CREDENTIAL_ENCRYPTION_KEY
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

# The administrator Overseas Run now control is independent of SCRAPE_TARGETS
# and defaults to all six Bright Data channels, including Google AI Overview.
# A configured Bright Data account therefore needs an explicit account-owned
# SERP zone before this production deploy can show that default safely.
brightdata_api_token="${BRIGHTDATA_API_TOKEN:-}"
if [[ -n "${brightdata_api_token//[[:space:]]/}" ]]; then
  require_value BRIGHTDATA_API_TOKEN
  require_value BRIGHTDATA_SERP_ZONE
fi

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
    brightdata)
      require_value BRIGHTDATA_API_TOKEN
      ;;
    oxylabs)
      require_value OXYLABS_USERNAME
      require_value OXYLABS_PASSWORD
      ;;
    openrouter) require_value OPENROUTER_API_KEY ;;
  esac
done

previous_tag=""
if [[ "$STABLE_TRANSITION_MANAGED" == 1 ]]; then
  previous_tag="$PREDECESSOR_RELEASE"
  if [[ ! "$previous_tag" =~ ^sha-[0-9a-f]{40}$ ]] || \
    [[ ! -f "$PREDECESSOR_COMPOSE_FILE" || -L "$PREDECESSOR_COMPOSE_FILE" ]]; then
    echo 'Stable transition requires an exact materialized predecessor release.' >&2
    exit 1
  fi
elif [[ -e "$RELEASE_FILE" || -L "$RELEASE_FILE" ]]; then
  previous_tag="$(tr -d '[:space:]' <"$RELEASE_FILE")"
  if [[ ! "$previous_tag" =~ ^sha-[0-9a-f]{40}$ ]] || \
    ! release_file_is_valid "$RELEASE_FILE" "$previous_tag"; then
    echo 'Refusing malformed existing active release.' >&2
    exit 1
  fi
fi

artifact_output_language_capable=false
if [[ -e "$ARTIFACT_OUTPUT_LANGUAGE_CAPABILITY_FILE" ]]; then
  if ! has_exact_artifact_output_language_token "$ARTIFACT_OUTPUT_LANGUAGE_CAPABILITY_FILE"; then
    echo "Candidate $release_tag does not carry the exact artifact output language capability." >&2
    exit 1
  fi
  artifact_output_language_capable=true
fi

if [[ "$artifact_output_language_capable" != true ]]; then
  echo "Candidate $release_tag is not root-authorized for artifact output language deployment." >&2
  exit 1
fi
if [[ "$STABLE_TRANSITION_MANAGED" == 1 ]]; then
  if [[ "$INVOKED_OUTPUT_LANGUAGE_ACTIVATED" != 0 && \
    "$INVOKED_OUTPUT_LANGUAGE_ACTIVATED" != 1 ]]; then
    echo 'Stable transition has an invalid root-derived activation proof.' >&2
    exit 1
  fi
  if ! artifact_output_language_forced_invocation_is_valid; then
    echo 'Stable transitions require the exact root-dispatched invocation.' >&2
    exit 1
  fi
elif ! artifact_output_language_stable_guard_metadata_is_valid || \
  ! "$ARTIFACT_OUTPUT_LANGUAGE_HOST_GUARD" candidate "$release_tag" deploy; then
  echo "Candidate $release_tag is not root-authorized for artifact output language deployment." >&2
  exit 1
fi

activation_exists=false
if [[ "$STABLE_TRANSITION_MANAGED" == 1 ]]; then
  [[ "$INVOKED_OUTPUT_LANGUAGE_ACTIVATED" == 1 ]] && activation_exists=true
elif [[ -e "$ARTIFACT_OUTPUT_LANGUAGE_MARKER" || -L "$ARTIFACT_OUTPUT_LANGUAGE_MARKER" ]]; then
  activation_exists=true
fi
if [[ "$activation_exists" == true ]]; then
  if ! artifact_output_language_activation_is_proven; then
    echo "The irreversible artifact output language activation marker is malformed." >&2
    exit 1
  fi
  if [[ "$ARTIFACT_ZH_CN_ENABLED" != true ]]; then
    echo 'Activated artifact output languages require ARTIFACT_ZH_CN_ENABLED=true.' >&2
    exit 1
  fi
  if [[ "$WORKER_ENABLED" != true ]]; then
    echo "An activated artifact output language deployment requires WORKER_ENABLED=true." >&2
    exit 1
  fi
  if [[ "$STABLE_TRANSITION_MANAGED" != 1 ]]; then
    echo 'Activated artifact output languages require the root-managed transition boundary.' >&2
    exit 1
  fi
  if ! artifact_output_language_forced_invocation_is_valid; then
    echo 'Activated artifact output languages require exact forced-command invocation.' >&2
    exit 1
  fi
  if [[ "$artifact_output_language_capable" != true ]]; then
    echo "Refusing a pre-language candidate after irreversible artifact output language activation." >&2
    exit 1
  fi
  if [[ "$STABLE_TRANSITION_MANAGED" != 1 ]] && ! artifact_output_language_stable_state_is_valid; then
    echo "Irreversible artifact output language activation exists, but durable state metadata is invalid." >&2
    exit 1
  fi
fi

if [[ "$ARTIFACT_ZH_CN_ENABLED" == true ]]; then
  if [[ "$WORKER_ENABLED" != true ]]; then
    echo "ARTIFACT_ZH_CN_ENABLED=true requires WORKER_ENABLED=true." >&2
    exit 1
  fi
  if [[ "$STABLE_TRANSITION_MANAGED" != 1 ]]; then
    echo 'ARTIFACT_ZH_CN_ENABLED=true requires the root-managed transition boundary.' >&2
    exit 1
  fi
  if ! artifact_output_language_forced_invocation_is_valid; then
    echo 'ARTIFACT_ZH_CN_ENABLED=true requires exact forced-command invocation.' >&2
    exit 1
  fi
  if ! artifact_output_language_activation_is_proven; then
    echo 'ARTIFACT_ZH_CN_ENABLED=true requires the root-local one-way activation attestation.' >&2
    exit 1
  fi
  if [[ "$artifact_output_language_capable" != true ]]; then
    echo "ARTIFACT_ZH_CN_ENABLED=true requires the exact candidate capability." >&2
    exit 1
  fi
  if [[ "$STABLE_TRANSITION_MANAGED" != 1 ]]; then
    if [[ ! "$previous_tag" =~ ^sha-[0-9a-f]{40}$ ]] || \
      ! artifact_output_language_stable_state_is_valid || \
      ! artifact_output_language_receipt_is_valid "$previous_tag" || \
      ! "$ARTIFACT_OUTPUT_LANGUAGE_HOST_GUARD" rollback "$previous_tag"; then
      echo "ARTIFACT_ZH_CN_ENABLED=true requires a healthy compatible rollback predecessor." >&2
      exit 1
    fi
  fi
fi

compose=(docker compose --project-name yonaris --env-file "$ENV_FILE" --file "$COMPOSE_FILE")

rollback_runtime_services() {
  if [[ ! "$previous_tag" =~ ^sha-[0-9a-f]{40}$ ]]; then
    return 0
  fi

  if [[ "$STABLE_TRANSITION_MANAGED" != 1 && \
    ( -e "$ARTIFACT_OUTPUT_LANGUAGE_MARKER" || -L "$ARTIFACT_OUTPUT_LANGUAGE_MARKER" ) ]]; then
    if ! artifact_output_language_stable_state_is_valid || \
      ! artifact_output_language_receipt_is_valid "$previous_tag" || \
      ! "$ARTIFACT_OUTPUT_LANGUAGE_HOST_GUARD" rollback "$previous_tag"; then
      echo "Refusing automatic rollback without a healthy compatibility receipt for $previous_tag." >&2
      return 1
    fi
  fi

  echo "Rolling Web and Worker back to $previous_tag; the database migration is not reversed."
  rollback_compose_file="$COMPOSE_FILE"
  if [[ "$STABLE_TRANSITION_MANAGED" == 1 ]]; then
    rollback_compose_file="$PREDECESSOR_COMPOSE_FILE"
    for previous_digest_variable in \
      PREVIOUS_WEB_IMAGE_DIGEST PREVIOUS_WORKER_IMAGE_DIGEST PREVIOUS_MIGRATE_IMAGE_DIGEST; do
      previous_digest_value="${!previous_digest_variable:-}"
      [[ "$previous_digest_value" =~ ^sha256:[0-9a-f]{64}$ ]] || {
        echo "Rollback is missing digest-bound predecessor evidence: $previous_digest_variable" >&2
        return 1
      }
    done
  else
    PREVIOUS_WEB_IMAGE_DIGEST="$WEB_IMAGE_DIGEST"
    PREVIOUS_WORKER_IMAGE_DIGEST="$WORKER_IMAGE_DIGEST"
    PREVIOUS_MIGRATE_IMAGE_DIGEST="$MIGRATE_IMAGE_DIGEST"
  fi
  rollback_compose=(docker compose --project-name yonaris --env-file "$ENV_FILE" --file "$rollback_compose_file")
  WEB_IMAGE_DIGEST="$PREVIOUS_WEB_IMAGE_DIGEST" \
    WORKER_IMAGE_DIGEST="$PREVIOUS_WORKER_IMAGE_DIGEST" \
    MIGRATE_IMAGE_DIGEST="$PREVIOUS_MIGRATE_IMAGE_DIGEST" \
    "${rollback_compose[@]}" pull web worker
  WEB_IMAGE_DIGEST="$PREVIOUS_WEB_IMAGE_DIGEST" \
    WORKER_IMAGE_DIGEST="$PREVIOUS_WORKER_IMAGE_DIGEST" \
    MIGRATE_IMAGE_DIGEST="$PREVIOUS_MIGRATE_IMAGE_DIGEST" \
    "${rollback_compose[@]}" up -d --no-deps "${runtime_services[@]}"
  if [[ "$WORKER_ENABLED" == false ]]; then
    WEB_IMAGE_DIGEST="$PREVIOUS_WEB_IMAGE_DIGEST" \
      WORKER_IMAGE_DIGEST="$PREVIOUS_WORKER_IMAGE_DIGEST" \
      MIGRATE_IMAGE_DIGEST="$PREVIOUS_MIGRATE_IMAGE_DIGEST" \
      "${rollback_compose[@]}" stop worker >/dev/null 2>&1
  fi
}

echo "Removing superseded, unused Yonaris release images"
/usr/bin/env DEPLOY_ROOT="$DEPLOY_ROOT" IMAGE_REGISTRY="${IMAGE_REGISTRY:-ghcr.io}" \
  IMAGE_NAMESPACE="${IMAGE_NAMESPACE:-blackdcp}" \
  /bin/bash --noprofile --norc -p "$SCRIPT_DIR/prune-superseded-images.sh" "$release_tag"

echo "Pulling Yonaris images for $release_tag"
"${compose[@]}" pull web worker db-migrate

echo "Starting PostgreSQL"
"${compose[@]}" up -d postgres

database_ready=false
for _ in $(seq 1 30); do
  if "${compose[@]}" exec -T postgres \
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
/usr/bin/env DEPLOY_ROOT="$DEPLOY_ROOT" COMPOSE_FILE="$COMPOSE_FILE" ENV_FILE="$ENV_FILE" \
  /bin/bash --noprofile --norc -p "$SCRIPT_DIR/check-sampling-storage.sh" --allow-missing-evidence-schema

echo "Running the pre-migration response snapshot storage preflight"
/usr/bin/env DEPLOY_ROOT="$DEPLOY_ROOT" COMPOSE_FILE="$COMPOSE_FILE" ENV_FILE="$ENV_FILE" \
	/bin/bash --noprofile --norc -p "$SCRIPT_DIR/check-response-snapshot-storage.sh"

echo "Creating a pre-migration backup"
backup_file="$(
  /usr/bin/env DEPLOY_ROOT="$DEPLOY_ROOT" COMPOSE_FILE="$COMPOSE_FILE" ENV_FILE="$ENV_FILE" \
    /bin/bash --noprofile --norc -p "$SCRIPT_DIR/backup.sh"
)"
if [[ "$backup_file" != /* ]] || \
  [[ "$backup_file" == *$'\n'* || "$backup_file" == *$'\r'* ]] || \
  [[ ! -f "$backup_file" || ! -r "$backup_file" ]]; then
  echo "Backup script did not return one readable absolute dump path." >&2
  exit 1
fi

migration_image="${IMAGE_REGISTRY:-ghcr.io}/${IMAGE_NAMESPACE:-blackdcp}/yonaris-db-migrate@$MIGRATE_IMAGE_DIGEST"
echo "Rehearsing the database upgrade with the immutable candidate image"
/bin/bash --noprofile --norc -p "$SCRIPT_DIR/rehearse-db-upgrade.sh" \
  "$backup_file" \
  --image "$migration_image"

echo "Running database migrations"
"${compose[@]}" --profile operations run --rm --no-deps db-migrate

echo "Running the post-migration strict Sampling storage preflight"
/usr/bin/env DEPLOY_ROOT="$DEPLOY_ROOT" COMPOSE_FILE="$COMPOSE_FILE" ENV_FILE="$ENV_FILE" \
  /bin/bash --noprofile --norc -p "$SCRIPT_DIR/check-sampling-storage.sh"

echo "Verifying candidate Web and Worker access to response snapshot storage"
/usr/bin/env DEPLOY_ROOT="$DEPLOY_ROOT" COMPOSE_FILE="$COMPOSE_FILE" ENV_FILE="$ENV_FILE" \
	/bin/bash --noprofile --norc -p "$SCRIPT_DIR/check-response-snapshot-storage.sh" --round-trip

if [[ "${DEPLOYMENT_MODE:-}" == local ]]; then
  echo "Ensuring the local bootstrap owner has global admin access"
  if ! bootstrap_repair_output="$(
    "${compose[@]}" --profile operations run --rm --no-deps -T \
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
if ! "${compose[@]}" up -d --no-deps "${runtime_services[@]}"; then
  echo "Yonaris runtime services could not be started for $release_tag." >&2
  if ! rollback_runtime_services; then
    echo "Runtime rollback failed; the root transition journal must remain pending." >&2
    exit 75
  fi
  exit 1
fi
if [[ "$WORKER_ENABLED" == false ]]; then
  if ! "${compose[@]}" stop worker >/dev/null 2>&1; then
    echo "Worker stop failed after runtime switch." >&2
    if ! rollback_runtime_services; then
      echo "Runtime rollback also failed; the root transition journal must remain pending." >&2
      exit 75
    fi
    exit 1
  fi
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
  "${compose[@]}" logs --tail 80 web >&2 || true
  if ! rollback_runtime_services; then
    echo "Runtime rollback failed; the root transition journal must remain pending." >&2
    exit 75
  fi
  exit 1
fi

worker_ready=false
if [[ "$WORKER_ENABLED" == true ]]; then
  stable_checks=0
  for _ in $(seq 1 15); do
    if ! worker_id="$("${compose[@]}" ps -q worker)"; then
      echo "Yonaris Worker container lookup failed for $release_tag." >&2
      break
    fi
    worker_state=''
    if [[ -n "$worker_id" ]] && \
      ! worker_state="$(docker inspect --format '{{.State.Status}} {{.RestartCount}}' "$worker_id")"; then
      echo "Yonaris Worker state inspection failed for $release_tag." >&2
      break
    fi
    if [[ -n "$worker_id" ]] && [[ "$worker_state" == "running 0" ]]; then
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
  "${compose[@]}" logs --tail 80 worker >&2 || true
  if ! rollback_runtime_services; then
    echo "Runtime rollback failed; the root transition journal must remain pending." >&2
    exit 75
  fi
  exit 1
fi

if [[ "$STABLE_TRANSITION_MANAGED" == 1 ]]; then
  echo 'Runtime is healthy; the root dispatcher will durably commit the pending transition.'
elif [[ "$artifact_output_language_capable" == true && "$WORKER_ENABLED" == true ]]; then
  prepare_artifact_output_language_state
  if ! persist_healthy_release_transaction "$release_tag"; then
    if ! rollback_runtime_services; then
      echo "Runtime rollback failed after receipt persistence failure." >&2
      exit 75
    fi
    exit 1
  fi
elif [[ "$artifact_output_language_capable" == true ]]; then
  echo 'Worker is disabled; artifact output language compatibility was not recorded.'
  if ! persist_active_release_only "$release_tag"; then
    if ! rollback_runtime_services; then
      echo "Runtime rollback failed after release marker persistence failure." >&2
      exit 75
    fi
    exit 1
  fi
fi
if [[ "$WORKER_ENABLED" == true ]]; then
  echo "Yonaris $release_tag is healthy on 127.0.0.1:${WEB_PORT}; Worker is stable."
else
  echo "Yonaris $release_tag is healthy on 127.0.0.1:${WEB_PORT}; Worker is intentionally paused."
fi
