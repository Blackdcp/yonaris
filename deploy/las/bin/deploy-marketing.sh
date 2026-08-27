#!/usr/bin/env bash

# Never inherit xtrace into environment loading. This must stay before any
# command that can read production configuration.
{ set +x; } 2>/dev/null || true
set -Eeuo pipefail
umask 077

usage() {
	echo "Usage: $0 [--verify-only|--rollback|--recover] sha-<40-character-git-sha>" >&2
}

mode="deploy"
case "$#:$1" in
	1:*) release_tag="$1" ;;
	2:--verify-only) mode="verify"; release_tag="$2" ;;
	2:--rollback) mode="rollback"; release_tag="$2" ;;
	2:--recover) mode="recover"; release_tag="$2" ;;
	*) usage; exit 2 ;;
esac

if [[ ! "$release_tag" =~ ^sha-[0-9a-f]{40}$ ]]; then
	echo "Refusing an invalid immutable marketing release tag." >&2
	exit 2
fi

digest_is_valid() {
	[[ "$1" =~ ^sha256:[0-9a-f]{64}$ ]]
}

if ! digest_is_valid "${WWW_IMAGE_DIGEST:-}"; then
	echo "A root-authorized sha256 marketing image digest is required." >&2
	exit 2
fi
if [[ "$mode" != verify ]] && ! digest_is_valid "${PREVIOUS_WWW_IMAGE_DIGEST:-}"; then
	echo "A durable predecessor marketing image digest is required." >&2
	exit 2
fi

SCRIPT_SOURCE="${BASH_SOURCE[0]:-$0}"
SCRIPT_DIR="$(cd -- "$(dirname -- "$SCRIPT_SOURCE")" && pwd)"
DOTENV_LOADER="$SCRIPT_DIR/load-strict-dotenv.sh"
DEPLOY_ROOT="${DEPLOY_ROOT:-/opt/yonaris}"
MARKETING_COMPOSE_FILE="${MARKETING_COMPOSE_FILE:-$(cd -- "$SCRIPT_DIR/.." && pwd)/compose.marketing.yaml}"
ENV_FILE="${ENV_FILE:-$DEPLOY_ROOT/.env}"
RELEASE_FILE="$DEPLOY_ROOT/.marketing-release"
ROLLBACK_ROOT="$DEPLOY_ROOT/marketing-rollbacks"
ROLLBACK_BUNDLE="$ROLLBACK_ROOT/$release_tag"
HEALTH_ATTEMPTS="${MARKETING_HEALTH_ATTEMPTS:-45}"
CADDY_TARGET_CONFIG="${CADDY_TARGET_CONFIG:-/etc/caddy/Caddyfile}"
STABLE_TRANSITION_MANAGED="${YONARIS_STABLE_TRANSITION_MANAGED:-0}"
STABLE_PREDECESSOR_RELEASE="${YONARIS_PREDECESSOR_MARKETING_RELEASE:-}"

if [[ ! -f "$MARKETING_COMPOSE_FILE" ]]; then
	echo "Missing marketing Compose file." >&2
	exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
	echo "Missing production environment file." >&2
	exit 1
fi

if [[ ! -f "$DOTENV_LOADER" || ! -r "$DOTENV_LOADER" || -L "$DOTENV_LOADER" ]]; then
	echo "Missing strict dotenv loader." >&2
	exit 1
fi

# shellcheck source=deploy/las/bin/load-strict-dotenv.sh
source "$DOTENV_LOADER"

load_marketing_environment() {
	set +x
	load_strict_dotenv "$ENV_FILE"
}

is_placeholder_secret() {
	local normalized="${1,,}"
	if [[ ! "$1" =~ ^re_[A-Za-z0-9_-]{20,}$ ]]; then
		return 0
	fi
	[[ "$normalized" == *test* ||
		"$normalized" == *fake* ||
		"$normalized" == *dummy* ||
		"$normalized" == *fixture* ||
		"$normalized" == *invalid* ||
		"$normalized" == *demo* ||
		"$normalized" == *mock* ||
		"$normalized" == *example* ||
		"$normalized" == *replace_with* ||
		"$normalized" == *placeholder* ||
		"$normalized" == *changeme* ||
		"$normalized" == '<'*'>' ||
		"$normalized" == your_* ]]
}

verify_marketing_configuration() {
	load_marketing_environment
	local invalid=0
	local delivery_mode="${MARKETING_DIAGNOSTIC_DELIVERY_MODE:-resend}"

	case "$delivery_mode" in
		mailto-only)
			echo "MARKETING_DIAGNOSTIC_DELIVERY_MODE=mailto-only"
			echo "RESEND_API_KEY=not-required"
			echo "RESEND_FROM_EMAIL=not-required"
			echo "MARKETING_LEAD_RECIPIENT=not-required"
			export RESEND_API_KEY=""
			export RESEND_FROM_EMAIL=""
			export MARKETING_LEAD_RECIPIENT=""
			return 0
			;;
		resend)
			echo "MARKETING_DIAGNOSTIC_DELIVERY_MODE=resend"
			;;
		*)
			echo "MARKETING_DIAGNOSTIC_DELIVERY_MODE=invalid"
			return 1
			;;
	esac

	if is_placeholder_secret "${RESEND_API_KEY-}"; then
		echo "RESEND_API_KEY=invalid"
		invalid=1
	else
		echo "RESEND_API_KEY=ok"
	fi

	if [[ "${RESEND_FROM_EMAIL-}" == 'Yonaris <diagnostic@yonaris.com>' ]]; then
		echo "RESEND_FROM_EMAIL=ok"
	else
		echo "RESEND_FROM_EMAIL=invalid"
		invalid=1
	fi

	if [[ "${MARKETING_LEAD_RECIPIENT-}" == 'black.dcp@outlook.com' ]]; then
		echo "MARKETING_LEAD_RECIPIENT=ok"
	else
		echo "MARKETING_LEAD_RECIPIENT=invalid"
		invalid=1
	fi

	return "$invalid"
}

if [[ "$mode" == verify ]]; then
	verify_marketing_configuration
	exit 0
fi

read_immutable_tag() {
	local path="$1"
	local value=""
	[[ -f "$path" ]] || return 1
	value="$(tr -d '[:space:]' <"$path")"
	[[ "$value" =~ ^sha-[0-9a-f]{40}$ ]] || return 1
	printf '%s' "$value"
}

validate_bound_bundle() {
	local marker_tag candidate_tag previous_tag candidate_digest previous_digest expected_backup_sha actual_backup_sha candidate_caddy_sha actual_current_caddy expected_current_caddy rollback_phase
	marker_tag="$(read_immutable_tag "$RELEASE_FILE")" || {
		echo "Recovery requires a valid current release marker." >&2
		return 1
	}
	[[ -d "$ROLLBACK_BUNDLE" && -f "$ROLLBACK_BUNDLE/Caddyfile.previous" ]] || {
		echo "Rollback bundle is missing." >&2
		return 1
	}
	candidate_tag="$(read_immutable_tag "$ROLLBACK_BUNDLE/candidate-image-tag")" || return 1
	previous_tag="$(read_immutable_tag "$ROLLBACK_BUNDLE/previous-image-tag")" || return 1
	candidate_digest="$(tr -d '[:space:]' <"$ROLLBACK_BUNDLE/candidate-image-digest")" || return 1
	previous_digest="$(tr -d '[:space:]' <"$ROLLBACK_BUNDLE/previous-image-digest")" || return 1
	[[ "$candidate_tag" == "$release_tag" && "$previous_tag" != "$candidate_tag" ]] || {
		echo "Rollback bundle binding is invalid." >&2
		return 1
	}
	digest_is_valid "$candidate_digest" && digest_is_valid "$previous_digest" && \
		[[ "$candidate_digest" == "$WWW_IMAGE_DIGEST" && \
			"$previous_digest" == "$PREVIOUS_WWW_IMAGE_DIGEST" ]] || {
		echo "Rollback bundle image digests do not match the root-authorized evidence." >&2
		return 1
	}
	[[ -f "$ROLLBACK_BUNDLE/candidate-caddy-sha256" && -f "$ROLLBACK_BUNDLE/previous-caddy-sha256" ]] || {
		echo "Rollback bundle Caddy binding is incomplete." >&2
		return 1
	}
	expected_backup_sha="$(tr -d '[:space:]' <"$ROLLBACK_BUNDLE/previous-caddy-sha256")"
	candidate_caddy_sha="$(tr -d '[:space:]' <"$ROLLBACK_BUNDLE/candidate-caddy-sha256")"
	[[ "$expected_backup_sha" =~ ^[0-9a-f]{64}$ && "$candidate_caddy_sha" =~ ^[0-9a-f]{64}$ ]] || {
		echo "Rollback bundle contains an invalid Caddy digest." >&2
		return 1
	}
	actual_backup_sha="$(sha256sum "$ROLLBACK_BUNDLE/Caddyfile.previous" | cut -d' ' -f1)"
	[[ "$actual_backup_sha" == "$expected_backup_sha" ]] || {
		echo "Rollback bundle Caddy backup failed integrity validation." >&2
		return 1
	}

	if [[ "$mode" == rollback ]]; then
		[[ "$marker_tag" == "$release_tag" ]] || {
			echo "Rollback marker does not match the requested candidate." >&2
			return 1
		}
		[[ -f "$CADDY_TARGET_CONFIG" ]] || return 1
		actual_current_caddy="$(sha256sum "$CADDY_TARGET_CONFIG" | cut -d' ' -f1)"
		rollback_phase=""
		[[ -f "$ROLLBACK_BUNDLE/rollback-marker-pending" ]] && rollback_phase="$(tr -d '[:space:]' <"$ROLLBACK_BUNDLE/rollback-marker-pending")"
		case "$rollback_phase" in
			marker-pending) expected_current_caddy="$expected_backup_sha" ;;
			restore-in-progress)
				if [[ "$actual_current_caddy" != "$candidate_caddy_sha" && "$actual_current_caddy" != "$expected_backup_sha" ]]; then
					echo "Rollback in-progress state does not match either bound Caddyfile." >&2
					return 1
				fi
				expected_current_caddy="$actual_current_caddy"
				;;
			*) expected_current_caddy="$candidate_caddy_sha" ;;
		esac
		[[ "$actual_current_caddy" == "$expected_current_caddy" ]] || {
			echo "Current complete Caddyfile does not match the rollback binding." >&2
			return 1
		}
	else
		[[ "$marker_tag" == "$previous_tag" ]] || {
			echo "Recovery marker does not match the bundle predecessor." >&2
			return 1
		}
		[[ -f "$ROLLBACK_BUNDLE/recovery-status" ]] || {
			echo "Recovery bundle has no emergency status." >&2
			return 1
		}
		[[ "$(tr -d '[:space:]' <"$ROLLBACK_BUNDLE/recovery-status")" == unconfirmed-caddy-rollback ]] || {
			echo "Recovery bundle is not in an allowed emergency state." >&2
			return 1
		}
	fi
}

# A rollback mismatch must be rejected before a lock file, environment source,
# Docker command, or any other mutation.
if [[ "$mode" == rollback || "$mode" == recover ]]; then
	validate_bound_bundle
else
	# Normal deploy and --verify-only use the exact same preflight function.
	verify_marketing_configuration
fi

mkdir -p "$DEPLOY_ROOT"
exec 9>"$DEPLOY_ROOT/.marketing-deploy.lock"
if ! flock -n 9; then
	echo "Another Yonaris marketing deployment is already running." >&2
	exit 1
fi

if [[ "$mode" == rollback || "$mode" == recover ]]; then
	load_marketing_environment
fi

cd -- "$(dirname -- "$MARKETING_COMPOSE_FILE")"
compose=(docker compose --project-name yonaris-marketing --env-file "$ENV_FILE" --file "$MARKETING_COMPOSE_FILE")
helper_image="${IMAGE_REGISTRY:-ghcr.io}/${IMAGE_NAMESPACE:-blackdcp}/yonaris-www@$WWW_IMAGE_DIGEST"

health_local_app() {
	for _ in $(seq 1 "$HEALTH_ATTEMPTS"); do
		if curl --fail --silent --show-error --max-time 5 "http://127.0.0.1:1516/" >/dev/null 2>&1; then
			return 0
		fi
		if ((HEALTH_ATTEMPTS > 1)); then sleep 2; fi
	done
	return 1
}

start_and_health_app() {
	local tag="$1"
	local digest="$2"
	digest_is_valid "$digest" || return 1
	if ! IMAGE_TAG="$tag" WWW_IMAGE_DIGEST="$digest" "${compose[@]}" pull www; then
		echo "Could not refresh marketing image $tag; trying the local immutable image." >&2
	fi
	if ! IMAGE_TAG="$tag" WWW_IMAGE_DIGEST="$digest" "${compose[@]}" up -d --no-deps --pull never www; then
		return 1
	fi
	health_local_app
}

restore_app_or_recovery_exit() {
	local tag="$1"
	local digest="$2"
	if start_and_health_app "$tag" "$digest"; then
		return 0
	fi
	echo "The previous immutable marketing app could not be restored." >&2
	exit 75
}

atomic_write_marker() {
	local tag="$1"
	local temporary_marker="${RELEASE_FILE}.tmp.$$"
	if ! { printf '%s\n' "$tag" >"$temporary_marker" && mv -f -- "$temporary_marker" "$RELEASE_FILE"; }; then
		rm -f -- "$temporary_marker"
		return 1
	fi
}

make_private_directory() {
	local path="$1"
	mkdir -p -- "$path"
	if chmod 700 -- "$path"; then
		return 0
	fi
	# Git Bash on Windows cannot represent POSIX directory modes. Production is
	# Linux and must fail closed if mode 700 cannot be applied.
	case "$(uname -s)" in
		MINGW* | MSYS*) return 0 ;;
		*) return 1 ;;
	esac
}

atomic_write_bundle_value() {
	local value="$1"
	local destination="$2"
	local temporary="${destination}.tmp.$$"
	if ! { printf '%s\n' "$value" >"$temporary" && chmod 600 -- "$temporary" && mv -f -- "$temporary" "$destination"; }; then
		rm -f -- "$temporary"
		return 1
	fi
}

archive_candidate_bundle() {
	[[ -d "$ROLLBACK_BUNDLE" ]] || return 0
	local archived="$ROLLBACK_ROOT/failed-$release_tag-$$"
	if ! mv -- "$ROLLBACK_BUNDLE" "$archived"; then
		return 1
	fi
	make_private_directory "$archived"
}

if [[ "$mode" == recover ]]; then
	recovery_attempt="$ROLLBACK_BUNDLE/recovery-attempt"
	if ! make_private_directory "$recovery_attempt"; then
		echo "Could not prepare the bound recovery attempt." >&2
		exit 75
	fi
	if ! start_and_health_app "$release_tag" "$WWW_IMAGE_DIGEST"; then
		echo "Candidate app recovery failed; Caddy was not touched." >&2
		exit 75
	fi

	set +e
	CADDY_HELPER_IMAGE="$helper_image" \
		CADDY_BACKUP_OUTPUT="$recovery_attempt/Caddyfile.observed" \
		CADDY_METADATA_DIR="$recovery_attempt" \
		CADDY_EXPECTED_CANDIDATE_SHA_FILE="$ROLLBACK_BUNDLE/candidate-caddy-sha256" \
		bash "$SCRIPT_DIR/install-marketing-caddy.sh"
	recovery_install_status=$?
	set -e
	if ((recovery_install_status != 0)); then
		echo "Candidate Caddy recovery remains unconfirmed; preserving the healthy candidate app and bundle." >&2
		exit 75
	fi

	original_candidate_sha="$(tr -d '[:space:]' <"$ROLLBACK_BUNDLE/candidate-caddy-sha256")"
	recovered_candidate_sha="$(tr -d '[:space:]' <"$recovery_attempt/candidate-caddy-sha256" 2>/dev/null || true)"
	if [[ "$recovered_candidate_sha" != "$original_candidate_sha" ]]; then
		echo "Recovered Caddy candidate does not match the release binding." >&2
		exit 75
	fi
	if ! atomic_write_marker "$release_tag"; then
		echo "Candidate recovered, but its release marker could not be written." >&2
		exit 75
	fi
	atomic_write_bundle_value "recovered" "$ROLLBACK_BUNDLE/recovery-status" || true
	echo "Yonaris marketing recovery converged $release_tag."
	exit 0
fi

if [[ "$mode" == rollback ]]; then
	previous_tag="$(read_immutable_tag "$ROLLBACK_BUNDLE/previous-image-tag")"
	if ! start_and_health_app "$previous_tag" "$PREVIOUS_WWW_IMAGE_DIGEST"; then
		echo "The predecessor app failed before Caddy rollback; current Caddy was not touched." >&2
		exit 1
	fi

	pending_marker="$ROLLBACK_BUNDLE/rollback-marker-pending"
	if [[ -f "$pending_marker" ]]; then
		pending_phase="$(tr -d '[:space:]' <"$pending_marker")"
		current_full_sha="$(sha256sum "$CADDY_TARGET_CONFIG" | cut -d' ' -f1)"
		previous_full_sha="$(tr -d '[:space:]' <"$ROLLBACK_BUNDLE/previous-caddy-sha256")"
		if [[ "$pending_phase" == restore-in-progress && "$current_full_sha" != "$previous_full_sha" ]]; then
			# A previous restore never reached the predecessor Caddyfile. Re-run the
			# ordinary bound restore below.
			:
		elif [[ "$pending_phase" == marker-pending || "$current_full_sha" == "$previous_full_sha" ]]; then
		set +e
		CADDY_HELPER_IMAGE="$helper_image" \
			CADDY_EXPECTED_RESTORED_SHA_FILE="$ROLLBACK_BUNDLE/previous-caddy-sha256" \
			bash "$SCRIPT_DIR/install-marketing-caddy.sh" --confirm-restored "$ROLLBACK_BUNDLE/Caddyfile.previous"
		confirm_restored_status=$?
		set -e
		if ((confirm_restored_status != 0)); then
			echo "Marker-pending rollback does not match the verified predecessor Caddyfile." >&2
			exit 75
		fi
		if ! atomic_write_marker "$previous_tag"; then
			echo "Predecessor is live, but its marker is still pending." >&2
			exit 75
		fi
		atomic_write_bundle_value "complete" "$pending_marker" || true
		echo "Yonaris marketing rollback marker reconciliation restored $previous_tag."
		exit 0
		fi
	fi

	if ! atomic_write_bundle_value "restore-in-progress" "$pending_marker"; then
		echo "Could not persist rollback marker recovery state; Caddy was not touched." >&2
		if ! start_and_health_app "$release_tag" "$WWW_IMAGE_DIGEST"; then
			echo "Candidate app recovery could not be confirmed." >&2
		fi
		exit 75
	fi

	set +e
	CADDY_HELPER_IMAGE="$helper_image" \
		CADDY_EXPECTED_CURRENT_SHA_FILE="$ROLLBACK_BUNDLE/candidate-caddy-sha256" \
		CADDY_EXPECTED_BACKUP_SHA_FILE="$ROLLBACK_BUNDLE/previous-caddy-sha256" \
		bash "$SCRIPT_DIR/install-marketing-caddy.sh" --restore-full "$ROLLBACK_BUNDLE/Caddyfile.previous"
	caddy_restore_status=$?
	set -e
	if ((caddy_restore_status != 0)); then
		echo "Caddy rollback was not confirmed; restoring the candidate app and preserving recovery material." >&2
		if ! start_and_health_app "$release_tag" "$WWW_IMAGE_DIGEST"; then
			echo "CRITICAL: neither the predecessor Caddyfile nor candidate app recovery was confirmed." >&2
		fi
		exit 75
	fi
	if ! atomic_write_bundle_value "marker-pending" "$pending_marker"; then
		echo "Predecessor Caddy is live, but marker-pending state could not be persisted." >&2
		exit 75
	fi

	if ! atomic_write_marker "$previous_tag"; then
		echo "Rollback completed live, but its release marker could not be restored." >&2
		exit 75
	fi

	echo "Yonaris marketing rollback restored $previous_tag."
	exit 0
fi

if [[ "$STABLE_TRANSITION_MANAGED" == 1 ]]; then
	previous_tag="$STABLE_PREDECESSOR_RELEASE"
	[[ "$previous_tag" =~ ^sha-[0-9a-f]{40}$ ]] || {
		echo "A stable deployment requires the root dispatcher's predecessor release." >&2
		exit 1
	}
else
	previous_tag="$(read_immutable_tag "$RELEASE_FILE")" || {
		echo "A normal deployment requires a valid predecessor release marker." >&2
		exit 1
	}
fi

if [[ "$previous_tag" == "$release_tag" ]]; then
	echo "The requested immutable release is already marked current; refusing to overwrite its rollback bundle." >&2
	exit 1
fi

if [[ -e "$ROLLBACK_BUNDLE" ]]; then
	echo "A rollback bundle already exists for this candidate; refusing to overwrite it." >&2
	exit 1
fi

echo "Starting the Yonaris marketing candidate."
if ! start_and_health_app "$release_tag" "$WWW_IMAGE_DIGEST"; then
	echo "The candidate app failed before the Caddy switch." >&2
	restore_app_or_recovery_exit "$previous_tag" "$PREVIOUS_WWW_IMAGE_DIGEST"
	exit 1
fi

if ! make_private_directory "$ROLLBACK_ROOT" ||
	! make_private_directory "$ROLLBACK_BUNDLE" ||
	! atomic_write_bundle_value "$previous_tag" "$ROLLBACK_BUNDLE/previous-image-tag" ||
	! atomic_write_bundle_value "$release_tag" "$ROLLBACK_BUNDLE/candidate-image-tag" ||
	! atomic_write_bundle_value "$PREVIOUS_WWW_IMAGE_DIGEST" "$ROLLBACK_BUNDLE/previous-image-digest" ||
	! atomic_write_bundle_value "$WWW_IMAGE_DIGEST" "$ROLLBACK_BUNDLE/candidate-image-digest" ||
	! atomic_write_bundle_value "unconfirmed-caddy-rollback" "$ROLLBACK_BUNDLE/recovery-status"; then
	echo "Could not create the private rollback bundle; restoring the predecessor app." >&2
	archive_candidate_bundle || true
	restore_app_or_recovery_exit "$previous_tag" "$PREVIOUS_WWW_IMAGE_DIGEST"
	exit 75
fi

set +e
CADDY_HELPER_IMAGE="$helper_image" \
	CADDY_BACKUP_OUTPUT="$ROLLBACK_BUNDLE/Caddyfile.previous" \
	CADDY_METADATA_DIR="$ROLLBACK_BUNDLE" \
	bash "$SCRIPT_DIR/install-marketing-caddy.sh"
caddy_install_status=$?
set -e

if ((caddy_install_status == 75)); then
	echo "Caddy rollback could not be confirmed; keeping the healthy candidate app and recovery bundle." >&2
	atomic_write_bundle_value "unconfirmed-caddy-rollback" "$ROLLBACK_BUNDLE/recovery-status" || true
	exit 75
fi
if ((caddy_install_status != 0)); then
	if ! archive_candidate_bundle; then
		echo "Caddy was restored, but the failed candidate bundle could not be archived." >&2
		restore_app_or_recovery_exit "$previous_tag" "$PREVIOUS_WWW_IMAGE_DIGEST"
		exit 75
	fi
	restore_app_or_recovery_exit "$previous_tag" "$PREVIOUS_WWW_IMAGE_DIGEST"
	exit 1
fi

for binding_file in Caddyfile.previous previous-caddy-sha256 candidate-caddy-sha256; do
	if [[ ! -s "$ROLLBACK_BUNDLE/$binding_file" ]]; then
		echo "Caddy completed without a durable rollback binding; preserving recovery state." >&2
		exit 75
	fi
done

expected_backup_sha="$(tr -d '[:space:]' <"$ROLLBACK_BUNDLE/previous-caddy-sha256")"
candidate_caddy_sha="$(tr -d '[:space:]' <"$ROLLBACK_BUNDLE/candidate-caddy-sha256")"
actual_backup_sha="$(sha256sum "$ROLLBACK_BUNDLE/Caddyfile.previous" | cut -d' ' -f1)"
if [[ ! "$expected_backup_sha" =~ ^[0-9a-f]{64}$ ||
	! "$candidate_caddy_sha" =~ ^[0-9a-f]{64}$ ||
	"$actual_backup_sha" != "$expected_backup_sha" ]]; then
	echo "Caddy completed with an invalid durable rollback binding; refusing to consume the rejected backup." >&2
	atomic_write_bundle_value "invalid-caddy-binding" "$ROLLBACK_BUNDLE/recovery-status" || true
	exit 75
fi

if ! atomic_write_marker "$release_tag"; then
	echo "The release marker could not be updated; rolling back Caddy and app before returning recovery status." >&2
	set +e
	CADDY_HELPER_IMAGE="$helper_image" \
		CADDY_EXPECTED_CURRENT_SHA_FILE="$ROLLBACK_BUNDLE/candidate-caddy-sha256" \
		CADDY_EXPECTED_BACKUP_SHA_FILE="$ROLLBACK_BUNDLE/previous-caddy-sha256" \
		bash "$SCRIPT_DIR/install-marketing-caddy.sh" --restore-full "$ROLLBACK_BUNDLE/Caddyfile.previous"
	marker_restore_status=$?
	set -e
	if ((marker_restore_status != 0)); then
		echo "Caddy recovery after marker failure could not be confirmed; keeping the candidate app and bundle." >&2
		exit 75
	fi
	restore_app_or_recovery_exit "$previous_tag" "$PREVIOUS_WWW_IMAGE_DIGEST"
	archive_candidate_bundle || true
	exit 75
fi

atomic_write_bundle_value "ready" "$ROLLBACK_BUNDLE/recovery-status" || {
	echo "Release marker is current, but rollback status could not be finalized." >&2
	exit 75
}

echo "Yonaris marketing $release_tag is healthy and live; rollback material is retained in mode 700."
