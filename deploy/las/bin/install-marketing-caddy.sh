#!/usr/bin/env bash

set -Eeuo pipefail
umask 077

REDIRECT_SHA="2f645156db46e9584cd47ad825804256d928757e462f31ea57391a11cdcc36d3"
V1_SHA="1b4580fed8750a61b8468b00d2852f1dc8cb8cf1b1d5587effe5519c5c230d67"
V2_SHA="6f1f6dd9f3ce91318d037f0e0328eac4c41bdd90fb942835204408ca669f09c4"
LAST_RELEASE_SHA="8278b92f4caf06d7c7187d1c1b3b402c745fcdbc35217a91399069bf0ceaff91"
APEX_HEADER="yonaris.com, www.yonaris.com {"

sha_file() {
	sha256sum "$1" | cut -d' ' -f1
}

read_sha_file() {
	local value
	value="$(tr -d '[:space:]' <"$1")"
	[[ "$value" =~ ^[0-9a-f]{64}$ ]] || return 1
	printf '%s' "$value"
}

apex_bounds() {
	local config="$1"
	mapfile -t apex_headers < <(grep -nF -x -- "$APEX_HEADER" "$config" | cut -d: -f1)
	[[ "${#apex_headers[@]}" == 1 ]] || return 1
	APEX_START="${apex_headers[0]}"
	local relative_end
	relative_end="$(tail -n "+$APEX_START" "$config" | grep -n -m1 -x '}' | cut -d: -f1)"
	[[ "$relative_end" =~ ^[0-9]+$ ]] || return 1
	APEX_END=$((APEX_START + relative_end - 1))
}

apex_sha() {
	local config="$1"
	apex_bounds "$config"
	sed -n "${APEX_START},${APEX_END}p" "$config" | sha256sum | cut -d' ' -f1
}

is_reviewed_predecessor_sha() {
	case "$1" in
		"$REDIRECT_SHA" | "$V1_SHA" | "$V2_SHA" | "$LAST_RELEASE_SHA") return 0 ;;
		*) return 1 ;;
	esac
}

verify_reviewed_fragments() {
	local redirect="$1" v1="$2" v2="$3"
	[[ "$(sha_file "$redirect")" == "$REDIRECT_SHA" ]] || return 1
	[[ "$(sha_file "$v1")" == "$V1_SHA" ]] || return 1
	[[ "$(sha_file "$v2")" == "$V2_SHA" ]] || return 1
}

make_private_directory() {
	local path="$1"
	mkdir -p -- "$path"
	if chmod 700 -- "$path"; then return 0; fi
	case "$(uname -s)" in
		MINGW* | MSYS*) return 0 ;;
		*) return 1 ;;
	esac
}

atomic_copy() {
	local source="$1" destination="$2"
	local temporary="${destination}.tmp.$$"
	if ! { cp -- "$source" "$temporary" && chmod 600 -- "$temporary" && mv -f -- "$temporary" "$destination"; }; then
		rm -f -- "$temporary"
		return 1
	fi
}

atomic_text() {
	local value="$1" destination="$2"
	local temporary="${destination}.tmp.$$"
	if ! { printf '%s\n' "$value" >"$temporary" && chmod 600 -- "$temporary" && mv -f -- "$temporary" "$destination"; }; then
		rm -f -- "$temporary"
		return 1
	fi
}

curl_origin() {
	local host="$1" path="$2" expected="$3" response_file="$4" method="${5:-GET}" body_pattern="${6:-}"
	local status
	if ! status="$(curl --insecure --silent --show-error --max-time 15 \
		--request "$method" --output "$response_file" --write-out '%{http_code}' \
		--resolve "$host:443:127.0.0.1" "https://$host$path")"; then
		return 1
	fi
	[[ "$status" == "$expected" ]] || return 1
	[[ -z "$body_pattern" ]] || grep -Fq -- "$body_pattern" "$response_file"
}

check_apex_and_portal() {
	local state_dir="$1"
	curl_origin yonaris.com / 200 "$state_dir/apex.html" GET "AI market evidence" &&
		curl_origin portal.yonaris.com / 200 "$state_dir/portal.html"
}

full_health() {
	local state_dir="$1"
	local response="$state_dir/health-response"

	curl_origin yonaris.com / 200 "$response" GET "AI market evidence" || return 1
	grep -Fq "MarTech, rebuilt" "$response" || return 1
	grep -Fq "See how AI is shaping your market" "$response" || return 1

	local path
	for path in \
		/product /zh/product /approach /research /company /privacy \
		/agent/company /llms.txt; do
		curl_origin yonaris.com "$path" 200 "$response" || return 1
	done
	for path in /status /brand /og/status.png /recordranks-logo.svg; do
		curl_origin yonaris.com "$path" 404 "$response" || return 1
	done

	curl_origin yonaris.com '/platform?fixture=1' 308 "$response" || return 1
	for path in /llms.mdx/site/private /api/repo-activity/refresh /api; do
		curl_origin yonaris.com "$path" 404 "$response" || return 1
	done
	curl_origin portal.yonaris.com / 200 "$response" || return 1

	local diagnostic_body
	diagnostic_body='{"locale":"en","website":"https://example.com","brand":"Honeypot fixture","market":"Enterprise software","question":"How does the market understand this product today?","competitors":"","name":"Release Fixture","email":"fixture@example.com","consent":true,"companyUrl":"filled-by-bot"}'
	local diagnostic_status
	if ! diagnostic_status="$(curl --insecure --silent --show-error --max-time 15 \
		--request POST --output "$response" --write-out '%{http_code}' \
		--resolve yonaris.com:443:127.0.0.1 \
		--header 'Origin: https://yonaris.com' \
		--header 'Sec-Fetch-Site: same-origin' \
		--header 'Content-Type: application/json' \
		--header 'Accept-Encoding: identity' \
		--header 'Idempotency-Key: 11111111-1111-4111-8111-111111111111' \
		--data-binary "$diagnostic_body" \
		https://yonaris.com/api/diagnostic)"; then
		return 1
	fi
	[[ "$diagnostic_status" == 400 ]] || return 1
	[[ "$(tr -d '[:space:]' <"$response")" == '{"ok":false,"code":"invalid_request"}' ]]
}

reload_with_retries() {
	local config="$1" attempts="${MARKETING_HEALTH_RELOAD_ATTEMPTS:-3}"
	local attempt
	for attempt in $(seq 1 "$attempts"); do
		if caddy reload --config "$config" --adapter caddyfile --force; then return 0; fi
		if ((attempts > 1)); then sleep 1; fi
	done
	return 1
}

inside_install() {
	local redirect="$1" v1="$2" v2="$3" final="$4" target="$5" backup_output="$6" metadata_dir="$7" expected_candidate_sha_file="${8:--}"
	local required
	for required in "$redirect" "$v1" "$v2" "$final" "$target"; do
		[[ -f "$required" ]] || { echo "Missing required Caddy file: $required" >&2; return 1; }
	done
	[[ -d "$(dirname -- "$backup_output")" && -d "$metadata_dir" ]] || {
		echo "Durable Caddy output directory is missing." >&2
		return 1
	}
	verify_reviewed_fragments "$redirect" "$v1" "$v2" || {
		echo "A reviewed predecessor fragment hash changed." >&2
		return 1
	}

	local live_sha final_sha
	live_sha="$(apex_sha "$target")" || { echo "Expected exactly one complete Yonaris apex block." >&2; return 1; }
	final_sha="$(sha_file "$final")"
	if [[ "$live_sha" != "$final_sha" ]] && ! is_reviewed_predecessor_sha "$live_sha"; then
		echo "The live Yonaris Caddy block does not match a reviewed state; refusing to edit it." >&2
		return 1
	fi
	local expected_candidate_sha=""
	if [[ "$expected_candidate_sha_file" != - ]]; then
		expected_candidate_sha="$(read_sha_file "$expected_candidate_sha_file")" || return 1
	fi

	local target_dir state_dir candidate backup changed=false keep_state=false
	target_dir="$(cd -- "$(dirname -- "$target")" && pwd -P)"
	state_dir="$(mktemp -d "$target_dir/.yonaris-caddy.XXXXXXXX")"
	make_private_directory "$state_dir"
	candidate="$state_dir/Caddyfile.candidate"
	backup="$state_dir/Caddyfile.backup"

	cleanup() {
		if [[ "$keep_state" == true ]]; then
			echo "Emergency Caddy recovery directory retained at $state_dir" >&2
		else
			case "$state_dir" in
				"$target_dir"/.yonaris-caddy.*) rm -rf -- "$state_dir" ;;
				*) echo "Refusing unexpected Caddy recovery path." >&2 ;;
			esac
		fi
	}
	trap cleanup RETURN

	if [[ "$live_sha" == "$final_sha" ]]; then
		cp -- "$target" "$candidate"
	else
		apex_bounds "$target"
		{
			if ((APEX_START > 1)); then head -n "$((APEX_START - 1))" "$target"; fi
			cat -- "$final"
			tail -n "+$((APEX_END + 1))" "$target"
		} >"$candidate"
		changed=true
	fi

	chown root:root "$candidate"
	chmod 0644 "$candidate"
	local candidate_sha
	candidate_sha="$(sha_file "$candidate")"
	if [[ -n "$expected_candidate_sha" && "$candidate_sha" != "$expected_candidate_sha" ]]; then
		echo "Complete candidate Caddyfile digest does not match the release binding." >&2
		return 1
	fi
	caddy validate --config "$candidate" --adapter caddyfile >/dev/null
	cp -- "$target" "$backup"

	# The durable full backup and both bindings exist and verify before any live
	# move/reload. Failure here leaves the active Caddyfile untouched.
	atomic_copy "$backup" "$backup_output" || return 1
	local backup_sha
	backup_sha="$(sha_file "$backup_output")"
	[[ "$backup_sha" == "$(sha_file "$backup")" ]] || return 1
	atomic_text "$backup_sha" "$metadata_dir/previous-caddy-sha256" || return 1
	atomic_text "$candidate_sha" "$metadata_dir/candidate-caddy-sha256" || return 1

	restore_previous() {
		keep_state=true
		if ! atomic_copy "$backup" "$candidate" || ! mv -f -- "$candidate" "$target"; then return 1; fi
		caddy validate --config "$target" --adapter caddyfile >/dev/null || return 1
		if ! reload_with_retries "$target"; then return 1; fi
		keep_state=false
		return 0
	}

	if [[ "$changed" == true ]]; then
		keep_state=true
		mv -f -- "$candidate" "$target"
		if ! reload_with_retries "$target"; then
			if ! restore_previous; then return 75; fi
			return 1
		fi
	fi

	if ! full_health "$state_dir"; then
		if ! restore_previous; then return 75; fi
		return 1
	fi
	keep_state=false
	return 0
}

inside_restore() {
	local backup="$1" target="$2" expected_current_file="$3" expected_backup_file="$4" redirect="$5" v1="$6" v2="$7" final="$8"
	local required
	for required in "$backup" "$target" "$expected_current_file" "$expected_backup_file" "$redirect" "$v1" "$v2" "$final"; do
		[[ -f "$required" ]] || return 1
	done
	verify_reviewed_fragments "$redirect" "$v1" "$v2" || return 1
	local expected_current expected_backup actual_backup current_sha current_apex backup_apex final_sha
	expected_current="$(read_sha_file "$expected_current_file")" || return 1
	expected_backup="$(read_sha_file "$expected_backup_file")" || return 1
	actual_backup="$(sha_file "$backup")"
	[[ "$actual_backup" == "$expected_backup" ]] || return 1
	current_sha="$(sha_file "$target")"
	[[ "$current_sha" == "$expected_current" ]] || return 1
	current_apex="$(apex_sha "$target")" || return 1
	final_sha="$(sha_file "$final")"
	[[ "$current_apex" == "$final_sha" ]] || return 1
	backup_apex="$(apex_sha "$backup")" || return 1
	if [[ "$backup_apex" != "$final_sha" ]] && ! is_reviewed_predecessor_sha "$backup_apex"; then return 1; fi

	local target_dir state_dir current_copy staged keep_state=false
	target_dir="$(cd -- "$(dirname -- "$target")" && pwd -P)"
	state_dir="$(mktemp -d "$target_dir/.yonaris-caddy.XXXXXXXX")"
	make_private_directory "$state_dir"
	current_copy="$state_dir/Caddyfile.current"
	staged="$state_dir/Caddyfile.restore"
	cleanup_restore_state() {
		if [[ "$keep_state" == true ]]; then
			echo "Emergency explicit-restore directory retained at $state_dir" >&2
		else
			case "$state_dir" in "$target_dir"/.yonaris-caddy.*) rm -rf -- "$state_dir" ;; esac
		fi
	}
	trap cleanup_restore_state RETURN
	cp -- "$target" "$current_copy"
	cp -- "$backup" "$staged"
	[[ "$(sha_file "$staged")" == "$expected_backup" ]] || return 1
	chown root:root "$staged"
	chmod 0644 "$staged"
	caddy validate --config "$staged" --adapter caddyfile >/dev/null
	keep_state=true
	mv -f -- "$staged" "$target"
	if ! reload_with_retries "$target" || ! check_apex_and_portal "$state_dir"; then
		if atomic_copy "$current_copy" "$staged" && mv -f -- "$staged" "$target" &&
			caddy validate --config "$target" --adapter caddyfile >/dev/null && reload_with_retries "$target"; then
			keep_state=false
			return 1
		fi
		echo "Explicit Caddy restore could not be recovered; retaining $state_dir" >&2
		return 75
	fi
	keep_state=false
	return 0
}

inside_confirm_restored() {
	local backup="$1" target="$2" expected_backup_file="$3" redirect="$4" v1="$5" v2="$6" final="$7"
	for required in "$backup" "$target" "$expected_backup_file" "$redirect" "$v1" "$v2" "$final"; do [[ -f "$required" ]] || return 1; done
	verify_reviewed_fragments "$redirect" "$v1" "$v2" || return 1
	local expected actual backup_apex final_sha
	expected="$(read_sha_file "$expected_backup_file")" || return 1
	actual="$(sha_file "$backup")"
	[[ "$actual" == "$expected" && "$(sha_file "$target")" == "$expected" ]] || return 1
	backup_apex="$(apex_sha "$backup")" || return 1
	final_sha="$(sha_file "$final")"
	if [[ "$backup_apex" != "$final_sha" ]] && ! is_reviewed_predecessor_sha "$backup_apex"; then return 1; fi
	caddy validate --config "$target" --adapter caddyfile >/dev/null
	local state_dir
	state_dir="$(mktemp -d)"
	trap 'rm -rf -- "$state_dir"' RETURN
	check_apex_and_portal "$state_dir"
}

if [[ "${1:-}" == --inside-host ]]; then
	mode="${2:-}"
	shift 2
	case "$mode" in
		install) inside_install "$@" ;;
		restore) inside_restore "$@" ;;
		confirm) inside_confirm_restored "$@" ;;
		*) echo "Unknown inside-host Caddy operation." >&2; exit 2 ;;
	esac
	exit $?
fi

DEPLOY_ROOT="${DEPLOY_ROOT:-/opt/yonaris}"
redirect="${CADDY_LEGACY_FRAGMENT:-$DEPLOY_ROOT/source/deploy/las/caddy/yonaris-redirect.caddy}"
v1="${CADDY_PREVIOUS_MARKETING_FRAGMENT:-$DEPLOY_ROOT/source/deploy/las/caddy/yonaris-marketing-v1.caddy}"
v2="${CADDY_V2_MARKETING_FRAGMENT:-$DEPLOY_ROOT/source/deploy/las/caddy/yonaris-marketing-v2.caddy}"
final="${CADDY_MARKETING_FRAGMENT:-$DEPLOY_ROOT/source/deploy/las/caddy/yonaris-marketing.caddy}"
target="${CADDY_TARGET_CONFIG:-/etc/caddy/Caddyfile}"
helper_image="${CADDY_HELPER_IMAGE:?Set CADDY_HELPER_IMAGE to the deployed marketing image}"
script_path="$DEPLOY_ROOT/source/deploy/las/bin/install-marketing-caddy.sh"

run_helper() {
	docker run --rm --user 0 --network host --entrypoint /bin/sh --volume /:/host "$helper_image" \
		-c 'exec chroot /host /usr/bin/env bash "$@"' sh "$script_path" "$@"
}

case "${1:-}" in
	--restore-full)
		backup="${2:?Missing complete predecessor Caddyfile}"
		expected_current="${CADDY_EXPECTED_CURRENT_SHA_FILE:?Missing expected current Caddy digest file}"
		expected_backup="${CADDY_EXPECTED_BACKUP_SHA_FILE:?Missing expected predecessor Caddy digest file}"
		run_helper --inside-host restore "$backup" "$target" "$expected_current" "$expected_backup" "$redirect" "$v1" "$v2" "$final"
		;;
	--confirm-restored)
		backup="${2:?Missing complete predecessor Caddyfile}"
		expected_backup="${CADDY_EXPECTED_RESTORED_SHA_FILE:?Missing expected restored Caddy digest file}"
		run_helper --inside-host confirm "$backup" "$target" "$expected_backup" "$redirect" "$v1" "$v2" "$final"
		;;
	*)
		backup_output="${CADDY_BACKUP_OUTPUT:?Set CADDY_BACKUP_OUTPUT to the durable rollback bundle}"
		metadata_dir="${CADDY_METADATA_DIR:?Set CADDY_METADATA_DIR to the durable rollback bundle}"
		expected_candidate="${CADDY_EXPECTED_CANDIDATE_SHA_FILE:--}"
		run_helper --inside-host install "$redirect" "$v1" "$v2" "$final" "$target" "$backup_output" "$metadata_dir" "$expected_candidate"
		;;
esac
