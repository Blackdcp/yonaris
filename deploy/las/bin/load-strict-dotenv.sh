#!/bin/bash

# This file is shell code from the authorized release tree. The production
# environment file it reads is data only: no source, eval, expansion, or command
# substitution is used here.

dotenv_key_is_allowed() {
	case "$1" in
		AGNES_API_KEY | ANTHROPIC_API_KEY | APP_ENV_FILE | APP_ICON | APP_NAME | \
		APP_URL | APP_WORDMARK | APP_WORDMARK_ON_DARK | ARTIFACT_ZH_CN_ENABLED | \
		BETTER_AUTH_SECRET | BRAND_ID_ALIASES | BRIGHTDATA_API_TOKEN | \
		BRIGHTDATA_SERP_ZONE | BROWSER_RUNNER_ENABLED | CREDENTIAL_ENCRYPTION_KEY | \
		DATABASE_URL | DATAFORSEO_LOGIN | DATAFORSEO_PASSWORD | DEEPSEEK_API_KEY | \
		DEFAULT_DELAY_HOURS | DEPLOYMENT_ID | DEPLOYMENT_MODE | DISABLE_TELEMETRY | \
		ENVIRONMENT | GOOGLE_CLIENT_ID | GOOGLE_CLIENT_SECRET | IMAGE_NAMESPACE | \
		IMAGE_REGISTRY | IMAGE_TAG | JINA_API_KEY | MARKETING_DIAGNOSTIC_DELIVERY_MODE | \
		MARKETING_LEAD_RECIPIENT | MISTRAL_API_KEY | OLOSTEP_API_KEY | \
		OPENAI_API_KEY | OPENROUTER_API_KEY | OXYLABS_PASSWORD | OXYLABS_USERNAME | \
		POSTGRES_DB | POSTGRES_PASSWORD | POSTGRES_USER | RESEND_API_KEY | \
		RESEND_FROM_EMAIL | RESPONSE_SNAPSHOT_ENABLED | RESPONSE_SNAPSHOT_HOST_ROOT | \
		RESPONSE_SNAPSHOT_OUTBOX_TTL_HOURS | RESPONSE_SNAPSHOT_RETENTION_DAYS | \
		RESPONSE_SNAPSHOT_ROOT | RESPONSE_SNAPSHOT_STOP_USED_PERCENT | \
		RESPONSE_SNAPSHOT_WARN_USED_PERCENT | RUNS_PER_PROMPT | SCRAPE_TARGETS | \
		SENTRY_DSN | VITE_APP_ICON | VITE_APP_NAME | VITE_APP_URL | \
		VITE_APP_WORDMARK | VITE_APP_WORDMARK_ON_DARK | VITE_DEPLOYMENT_MODE | \
		VITE_POSTHOG_HOST | VITE_POSTHOG_KEY | VITE_SENTRY_DSN | VITE_SITE_URL | \
		WEB_PORT | WORKER_ENABLED | WORKER_QUEUE_SCOPE) return 0 ;;
		*) return 1 ;;
	esac
}

dotenv_value_contains_executable_syntax() {
	local value="$1"
	[[ "$value" == *'$('* || "$value" == *'${'* || "$value" == *'`'* || \
		"$value" == *'$\x27'* || "$value" == *$'\n'* || "$value" == *$'\r'* ]]
}

load_strict_dotenv() {
	local dotenv_path="$1"
	local line=''
	local key=''
	local raw_value=''
	local value=''
	local line_number=0
	local -A seen_keys=()

	[[ -f "$dotenv_path" && -r "$dotenv_path" && ! -L "$dotenv_path" ]] || {
		echo "Missing readable non-symlink production environment file: $dotenv_path" >&2
		return 1
	}

	while IFS= read -r line || [[ -n "$line" ]]; do
		line_number=$((line_number + 1))
		line="${line%$'\r'}"
		if [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]]; then
			continue
		fi
		if [[ ! "$line" =~ ^([A-Z][A-Z0-9_]*)=(.*)$ ]]; then
			printf 'Refusing malformed production environment line %s.\n' "$line_number" >&2
			return 1
		fi

		key="${BASH_REMATCH[1]}"
		raw_value="${BASH_REMATCH[2]}"
		if ! dotenv_key_is_allowed "$key"; then
			printf 'Refusing unsupported production environment key on line %s: %s\n' \
				"$line_number" "$key" >&2
			return 1
		fi
		if [[ -n "${seen_keys[$key]:-}" ]]; then
			printf 'Refusing duplicate production environment key on line %s: %s\n' \
				"$line_number" "$key" >&2
			return 1
		fi
		seen_keys["$key"]=1

		if dotenv_value_contains_executable_syntax "$raw_value"; then
			printf 'Refusing executable syntax in production environment value on line %s.\n' \
				"$line_number" >&2
			return 1
		fi

		case "$raw_value" in
			\'*)
				if [[ ! "$raw_value" =~ ^\'([^\']*)\'$ ]]; then
					printf 'Refusing malformed single-quoted value on line %s.\n' "$line_number" >&2
					return 1
				fi
				value="${BASH_REMATCH[1]}"
				;;
			\"*)
				if [[ ! "$raw_value" =~ ^\"([^\"]*)\"$ ]]; then
					printf 'Refusing malformed double-quoted value on line %s.\n' "$line_number" >&2
					return 1
				fi
				value="${BASH_REMATCH[1]}"
				;;
			*)
				if [[ "$raw_value" =~ [[:space:]\;\&\|\<\>\\] || \
					"$raw_value" == *\"* || "$raw_value" == *\'* ]]; then
					printf 'Refusing unquoted shell metacharacter in production environment value on line %s.\n' \
						"$line_number" >&2
					return 1
				fi
				value="$raw_value"
				;;
		esac

		printf -v "$key" '%s' "$value"
		export "$key"
	done <"$dotenv_path"
}
