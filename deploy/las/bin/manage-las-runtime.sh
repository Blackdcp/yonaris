#!/bin/bash

set -Eeuo pipefail
set +x
umask 077
PATH='/usr/bin:/bin'
export PATH
readonly PATH

readonly RUNTIME_USER='yonaris-runtime'
readonly RUNTIME_HOME='/var/lib/yonaris-runtime'
readonly STATE_DIRECTORY='/var/lib/yonaris'
readonly RELEASE_TREE_ROOT='/var/lib/yonaris/las-release-trees'
readonly MIGRATION_WORK_ROOT="$STATE_DIRECTORY/migration-readiness-work-v2"
readonly ENV_FILE='/etc/yonaris/las-runtime.env'
readonly ACTIVATION_ATTESTATION='/etc/yonaris/artifact-output-language-active-v1'
readonly ACTIVATION_TOKEN='artifact-output-language-active-v1'
readonly PORTAL_WEB_IMAGE='ghcr.io/blackdcp/yonaris-web'
readonly PORTAL_WORKER_IMAGE='ghcr.io/blackdcp/yonaris-worker'
readonly PORTAL_MIGRATE_IMAGE='ghcr.io/blackdcp/yonaris-db-migrate'
readonly POSTGRES_IMAGE='postgres'
readonly MIGRATION_REHEARSAL_READY_ATTEMPTS=30
readonly RUNTIME_UID="$(/usr/bin/id -u "$RUNTIME_USER")"
readonly RUNTIME_GID="$(/usr/bin/id -g "$RUNTIME_USER")"
readonly ROOTLESS_RUNTIME_DIR="/run/user/$RUNTIME_UID"
readonly DOCKER_HOST='unix:///run/user/'"$RUNTIME_UID"'/docker.sock'
readonly DOCKER_CONFIG="$RUNTIME_HOME/.docker"
readonly DOCKER_DAEMON_CONFIG_DIRECTORY="$RUNTIME_HOME/.config/docker"
readonly DOCKER_DAEMON_CONFIG="$DOCKER_DAEMON_CONFIG_DIRECTORY/daemon.json"
readonly DOCKER_PID_FILE="$ROOTLESS_RUNTIME_DIR/docker.pid"
readonly FIXED_STABLE_DIRECTORY='/usr/local/libexec/yonaris-las'
if [[ -n "${LAS_STABLE_BUNDLE_DIR:-}" ]]; then
	STABLE_DIRECTORY="$LAS_STABLE_BUNDLE_DIR"
else
	STABLE_DIRECTORY="$FIXED_STABLE_DIRECTORY"
fi
readonly STABLE_DIRECTORY
readonly STABLE_STATE_MANAGER="$STABLE_DIRECTORY/manage-las-release-state"

fail() { /usr/bin/printf '%s\n' "$1" >&2; exit "${2:-1}"; }

metadata_matches() {
	local path="$1" kind="$2" expected="$3"
	if /usr/bin/readlink -- "$path" >/dev/null 2>&1; then return 1; fi
	case "$kind" in
		directory) [[ -d "$path" ]] || return 1 ;;
		file) [[ -f "$path" && -r "$path" ]] || return 1 ;;
		socket) [[ -S "$path" ]] || return 1 ;;
		*) return 1 ;;
	esac
	[[ "$(/usr/bin/stat -c '%u:%g:%a' -- "$path" 2>/dev/null)" == "$expected" ]] && \
		[[ "$kind" != file || "$(/usr/bin/stat -c '%h' -- "$path" 2>/dev/null)" == 1 ]]
}

release_is_valid() { [[ "$1" =~ ^sha-[0-9a-f]{40}$ ]]; }
digest_is_valid() { [[ "$1" =~ ^sha256:[0-9a-f]{64}$ ]]; }

state_attestation() {
	local expected="$1" output
	shift
	metadata_matches "$STABLE_STATE_MANAGER" file '0:0:755' || return 1
	output="$(/usr/bin/env -i PATH='/usr/bin:/bin' HOME='/nonexistent' \
		LAS_STABLE_BUNDLE_DIR="${LAS_STABLE_BUNDLE_DIR:-}" \
		/bin/bash --noprofile --norc -p "$STABLE_STATE_MANAGER" "$@")" || return 1
	[[ "$output" == "$expected" ]]
}

validate_runtime_env() {
	local validation_mode="${1:-steady}" activation_state=absent
	case "$validation_mode" in
		steady | preactivation) ;;
		*) return 1 ;;
	esac
	metadata_matches "$ENV_FILE" file "0:$RUNTIME_GID:440" || return 1
	if [[ -e "$ACTIVATION_ATTESTATION" || -L "$ACTIVATION_ATTESTATION" ]]; then
		[[ "$validation_mode" == steady ]] || return 1
		metadata_matches "$ACTIVATION_ATTESTATION" file '0:0:400' && \
			/usr/bin/cmp -s "$ACTIVATION_ATTESTATION" <(/usr/bin/printf '%s\n' "$ACTIVATION_TOKEN") || return 1
		activation_state=present
	elif [[ "$validation_mode" == preactivation ]]; then
		activation_state=preactivation
	fi
	/usr/bin/python3 - "$ENV_FILE" "$activation_state" <<'PY'
import base64
import binascii
import pathlib
import re
import sys
import urllib.parse
import uuid

allowed = {
    "AGNES_API_KEY", "ANTHROPIC_API_KEY", "APP_ENV_FILE", "APP_ICON", "APP_NAME",
    "APP_URL", "APP_WORDMARK", "APP_WORDMARK_ON_DARK", "ARTIFACT_ZH_CN_ENABLED",
    "BETTER_AUTH_SECRET", "BRAND_ID_ALIASES", "BRIGHTDATA_API_TOKEN",
    "BRIGHTDATA_SERP_ZONE", "BROWSER_RUNNER_ENABLED", "CREDENTIAL_ENCRYPTION_KEY",
    "DATABASE_URL", "DATAFORSEO_LOGIN", "DATAFORSEO_PASSWORD", "DEEPSEEK_API_KEY",
    "DEFAULT_DELAY_HOURS", "DEPLOYMENT_ID", "DEPLOYMENT_MODE", "DISABLE_TELEMETRY",
    "ENVIRONMENT", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "IMAGE_NAMESPACE",
    "IMAGE_REGISTRY", "IMAGE_TAG", "JINA_API_KEY", "MISTRAL_API_KEY", "OLOSTEP_API_KEY", "OPENAI_API_KEY",
    "OPENROUTER_API_KEY", "OXYLABS_PASSWORD", "OXYLABS_USERNAME", "POSTGRES_DB",
    "POSTGRES_PASSWORD", "POSTGRES_USER", "RESEND_API_KEY", "RESEND_FROM_EMAIL",
    "RESPONSE_SNAPSHOT_ENABLED", "RESPONSE_SNAPSHOT_HOST_ROOT",
    "RESPONSE_SNAPSHOT_OUTBOX_TTL_HOURS", "RESPONSE_SNAPSHOT_RETENTION_DAYS",
    "RESPONSE_SNAPSHOT_ROOT", "RESPONSE_SNAPSHOT_STOP_USED_PERCENT",
    "RESPONSE_SNAPSHOT_WARN_USED_PERCENT", "RUNS_PER_PROMPT", "SCRAPE_TARGETS",
    "SENTRY_DSN", "VITE_APP_ICON", "VITE_APP_NAME", "VITE_APP_URL", "VITE_APP_WORDMARK",
    "VITE_APP_WORDMARK_ON_DARK", "VITE_DEPLOYMENT_MODE", "VITE_POSTHOG_HOST",
    "VITE_POSTHOG_KEY", "VITE_SENTRY_DSN", "VITE_SITE_URL", "WEB_PORT",
    "WORKER_ENABLED", "WORKER_QUEUE_SCOPE",
}
try:
    text = pathlib.Path(sys.argv[1]).read_text(encoding="utf-8")
except (OSError, UnicodeError):
    raise SystemExit(1)
activation_state = sys.argv[2]
if "\x00" in text:
    raise SystemExit(1)
seen = set()
values = {}
for number, line in enumerate(text.splitlines(), 1):
    if not line or line.lstrip().startswith("#"):
        continue
    match = re.fullmatch(r"([A-Z][A-Z0-9_]*)=(.*)", line)
    if not match:
        raise SystemExit(f"invalid dotenv line {number}")
    key, value = match.groups()
    if key not in allowed or key in seen:
        raise SystemExit(f"invalid dotenv key {number}")
    seen.add(key)
    if any(token in value for token in ("$", "`")):
        raise SystemExit(f"executable dotenv value {number}")
    if value.startswith("'"):
        if len(value) < 2 or not value.endswith("'") or "'" in value[1:-1]:
            raise SystemExit(f"malformed quoted dotenv value {number}")
        value = value[1:-1]
    elif value.startswith('"'):
        if len(value) < 2 or not value.endswith('"') or '"' in value[1:-1]:
            raise SystemExit(f"malformed quoted dotenv value {number}")
        value = value[1:-1]
    elif re.search(r"[\s;&|<>\\\"']", value):
        raise SystemExit(f"unsafe unquoted dotenv value {number}")
    values[key] = value

required = {
    "POSTGRES_USER", "POSTGRES_PASSWORD", "POSTGRES_DB", "DATABASE_URL",
    "DEPLOYMENT_ID", "APP_URL", "BETTER_AUTH_SECRET", "CREDENTIAL_ENCRYPTION_KEY",
    "SCRAPE_TARGETS", "ARTIFACT_ZH_CN_ENABLED", "WORKER_ENABLED",
    "WORKER_QUEUE_SCOPE", "RUNS_PER_PROMPT",
}
missing = sorted(required - seen)
if missing:
    raise SystemExit(f"missing required production dotenv key: {missing[0]}")

def require_value(key):
    value = values.get(key, "")
    if not value.strip():
        raise SystemExit(f"empty required production dotenv key: {key}")
    if "replace_with" in value.lower():
        raise SystemExit(f"placeholder production dotenv key: {key}")
    return value

for key in required:
    require_value(key)
for key, value in values.items():
    if value and "replace_with" in value.lower():
        raise SystemExit(f"placeholder configured dotenv key: {key}")

for key in ("ARTIFACT_ZH_CN_ENABLED", "WORKER_ENABLED"):
    if values[key] not in {"true", "false"}:
        raise SystemExit(f"invalid production boolean: {key}")
for key in ("BROWSER_RUNNER_ENABLED", "RESPONSE_SNAPSHOT_ENABLED"):
    if key in values and values[key] not in {"true", "false"}:
        raise SystemExit(f"invalid optional production boolean: {key}")
if "DISABLE_TELEMETRY" in values and values["DISABLE_TELEMETRY"] not in {"0", "1"}:
    raise SystemExit("invalid telemetry boolean")
if values["WORKER_QUEUE_SCOPE"] not in {"full", "analysis-only"}:
    raise SystemExit("invalid Worker queue scope")
if not re.fullmatch(r"[1-9][0-9]*", values["RUNS_PER_PROMPT"]):
    raise SystemExit("invalid runs-per-Prompt value")

try:
    deployment_id = uuid.UUID(values["DEPLOYMENT_ID"])
except (ValueError, AttributeError):
    raise SystemExit("invalid deployment UUID") from None
if str(deployment_id) != values["DEPLOYMENT_ID"]:
    raise SystemExit("deployment UUID is not canonical")
try:
    credential_key = base64.b64decode(values["CREDENTIAL_ENCRYPTION_KEY"], validate=True)
except (binascii.Error, ValueError):
    raise SystemExit("invalid credential encryption key") from None
if len(credential_key) != 32:
    raise SystemExit("invalid credential encryption key length")

try:
    database = urllib.parse.urlsplit(values["DATABASE_URL"])
    database_port = database.port
except ValueError:
    raise SystemExit("invalid database URL") from None
database_user = urllib.parse.unquote(database.username or "")
database_password = urllib.parse.unquote(database.password or "")
database_name = urllib.parse.unquote(database.path.removeprefix("/"))
if (database.scheme != "postgresql" or database.hostname != "postgres" or database_port != 5432
        or database.query or database.fragment or database_user != values["POSTGRES_USER"]
        or database_password != values["POSTGRES_PASSWORD"] or database_name != values["POSTGRES_DB"]):
    raise SystemExit("database URL does not match the internal Postgres contract")

provider_credentials = {
    "dataforseo": ("DATAFORSEO_LOGIN", "DATAFORSEO_PASSWORD"),
    "openai-api": ("OPENAI_API_KEY",),
    "agnes-api": ("AGNES_API_KEY",),
    "deepseek-api": ("DEEPSEEK_API_KEY",),
    "anthropic-api": ("ANTHROPIC_API_KEY",),
    "mistral-api": ("MISTRAL_API_KEY",),
    "olostep": ("OLOSTEP_API_KEY",),
    "brightdata": ("BRIGHTDATA_API_TOKEN",),
    "oxylabs": ("OXYLABS_USERNAME", "OXYLABS_PASSWORD"),
    "openrouter": ("OPENROUTER_API_KEY",),
}
targets = values["SCRAPE_TARGETS"].split(",")
for target in targets:
    parts = target.split(":")
    if (not target or target != target.strip() or len(parts) < 2
            or not parts[0] or not parts[1] or any(not part for part in parts)):
        raise SystemExit("invalid SCRAPE_TARGETS entry")
    provider = parts[1]
    credentials = provider_credentials.get(provider)
    if credentials is None:
        raise SystemExit("unknown SCRAPE_TARGETS provider")
    for key in credentials:
        require_value(key)
if values.get("BRIGHTDATA_API_TOKEN", "").strip():
    require_value("BRIGHTDATA_SERP_ZONE")

if activation_state == "present":
    if values["ARTIFACT_ZH_CN_ENABLED"] != "true" or values["WORKER_ENABLED"] != "true":
        raise SystemExit("irreversible activation requires Chinese artifacts and Worker")
elif activation_state == "preactivation":
    if values["ARTIFACT_ZH_CN_ENABLED"] != "true" or values["WORKER_ENABLED"] != "true":
        raise SystemExit("preactivation requires Chinese artifacts and Worker")
elif values["ARTIFACT_ZH_CN_ENABLED"] == "true":
    raise SystemExit("Chinese artifact writes require the irreversible activation attestation")
PY
}

release_tree() {
	local release_tag="$1" tree="$RELEASE_TREE_ROOT/$1"
	release_is_valid "$release_tag" || return 1
	metadata_matches "$STATE_DIRECTORY" directory '0:0:711' || return 1
	metadata_matches "$RELEASE_TREE_ROOT" directory '0:0:555' || return 1
	metadata_matches "$tree" directory '0:0:555' || return 1
	/usr/bin/printf '%s' "$tree"
}

verify_runtime_boundary() {
	local validation_mode="${1:-steady}" socket="$ROOTLESS_RUNTIME_DIR/docker.sock" security_options before after
	case "$validation_mode" in
		steady | preactivation) ;;
		*) return 1 ;;
	esac
	metadata_matches "$RUNTIME_HOME" directory "0:$RUNTIME_GID:750" || return 1
	metadata_matches "$DOCKER_CONFIG" directory "$RUNTIME_UID:$RUNTIME_GID:700" || return 1
	metadata_matches "$ROOTLESS_RUNTIME_DIR" directory "$RUNTIME_UID:$RUNTIME_GID:700" || return 1
	metadata_matches "$socket" socket "$RUNTIME_UID:$RUNTIME_GID:600" || \
		metadata_matches "$socket" socket "$RUNTIME_UID:$RUNTIME_GID:660" || return 1
	metadata_matches "$DOCKER_PID_FILE" file "$RUNTIME_UID:$RUNTIME_GID:600" || return 1
	validate_runtime_env "$validation_mode" || return 1
	before="$(runtime_identity_snapshot)" || return 1
	security_options="$(runtime_env /usr/bin/docker info --format '{{json .SecurityOptions}}')" || return 1
	[[ "$security_options" == *'name=rootless'* ]] || return 1
	after="$(runtime_identity_snapshot)" || return 1
	[[ "$after" == "$before" ]]
}

validate_dockerd_argv() {
	local cmdline="$1" expected_host="$2"
	/usr/bin/python3 - "$cmdline" "$expected_host" <<'PY'
import pathlib
import sys

data = pathlib.Path(sys.argv[1]).read_bytes()
if not data or not data.endswith(b"\0"):
    raise SystemExit(1)
raw_argv = data[:-1].split(b"\0")
if not raw_argv or any(not value for value in raw_argv):
    raise SystemExit(1)
try:
    argv = [value.decode("utf-8", "strict") for value in raw_argv]
except UnicodeDecodeError:
    raise SystemExit(1) from None

arguments = argv[1:]
if arguments.count("--rootless") != 1 or any(value.startswith("--rootless=") for value in arguments):
    raise SystemExit(1)

hosts = []
index = 0
while index < len(arguments):
    argument = arguments[index]
    if argument == "--":
        raise SystemExit(1)
    if argument in {"--host", "-H"}:
        index += 1
        if index >= len(arguments):
            raise SystemExit(1)
        hosts.append(arguments[index])
    elif argument.startswith("--host="):
        hosts.append(argument.removeprefix("--host="))
    elif argument.startswith("-H="):
        hosts.append(argument.removeprefix("-H="))
    elif argument.startswith("-H") and argument != "-H":
        hosts.append(argument[2:])
    elif argument == "--config-file" or argument.startswith("--config-file="):
        raise SystemExit(1)
    index += 1

if hosts != [sys.argv[2]]:
    raise SystemExit(1)
PY
}

daemon_config_snapshot() {
	local config_home="$RUNTIME_HOME/.config" digest
	if [[ -e "$config_home" || -L "$config_home" ]]; then
		metadata_matches "$config_home" directory "$RUNTIME_UID:$RUNTIME_GID:700" || return 1
	fi
	if [[ -e "$DOCKER_DAEMON_CONFIG_DIRECTORY" || -L "$DOCKER_DAEMON_CONFIG_DIRECTORY" ]]; then
		metadata_matches "$DOCKER_DAEMON_CONFIG_DIRECTORY" directory "$RUNTIME_UID:$RUNTIME_GID:700" || return 1
	fi
	if [[ ! -e "$DOCKER_DAEMON_CONFIG" && ! -L "$DOCKER_DAEMON_CONFIG" ]]; then
		/usr/bin/printf '%s' absent
		return 0
	fi
	metadata_matches "$DOCKER_DAEMON_CONFIG" file "$RUNTIME_UID:$RUNTIME_GID:600" || return 1
	/usr/bin/python3 - "$DOCKER_DAEMON_CONFIG" <<'PY' || return 1
import json
import pathlib
import sys

try:
    config = json.loads(pathlib.Path(sys.argv[1]).read_text(encoding="utf-8"))
except (OSError, UnicodeError, json.JSONDecodeError):
    raise SystemExit(1) from None
if not isinstance(config, dict) or "hosts" in config:
    raise SystemExit(1)
PY
	digest="$(/usr/bin/sha256sum -- "$DOCKER_DAEMON_CONFIG" | /usr/bin/awk '{ print $1 }')" || return 1
	[[ "$digest" =~ ^[0-9a-f]{64}$ ]] || return 1
	/usr/bin/printf 'sha256:%s' "$digest"
}

runtime_identity_snapshot() {
	local socket="$ROOTLESS_RUNTIME_DIR/docker.sock" pid exe uid_line inode start_time fd link found=false
	local socket_file_identity daemon_config_identity
	local -a socket_inodes=()
	pid="$(/usr/bin/tr -d '[:space:]' <"$DOCKER_PID_FILE")"
	[[ "$pid" =~ ^[1-9][0-9]*$ && -d "/proc/$pid/fd" ]] || return 1
	exe="$(/usr/bin/readlink -f -- "/proc/$pid/exe")" || return 1
	[[ "$exe" == /usr/bin/dockerd ]] || return 1
	uid_line="$(/usr/bin/awk '/^Uid:/ { print $2 ":" $3 ":" $4 ":" $5 }' "/proc/$pid/status")" || return 1
	[[ "$uid_line" == "$RUNTIME_UID:$RUNTIME_UID:$RUNTIME_UID:$RUNTIME_UID" ]] || return 1
	validate_dockerd_argv "/proc/$pid/cmdline" "unix://$socket" || return 1
	daemon_config_identity="$(daemon_config_snapshot)" || return 1
	socket_file_identity="$(/usr/bin/stat -c '%d:%i' -- "$socket")" || return 1
	[[ "$socket_file_identity" =~ ^[0-9]+:[1-9][0-9]*$ ]] || return 1
	mapfile -t socket_inodes < <(/usr/bin/awk -v path="$socket" '$8 == path { print $7 }' /proc/net/unix)
	[[ "${#socket_inodes[@]}" -eq 1 && "${socket_inodes[0]}" =~ ^[1-9][0-9]*$ ]] || return 1
	inode="${socket_inodes[0]}"
	for fd in "/proc/$pid/fd"/*; do
		link="$(/usr/bin/readlink -- "$fd" 2>/dev/null || true)"
		if [[ "$link" == "socket:[$inode]" ]]; then found=true; break; fi
	done
	[[ "$found" == true ]] || return 1
	start_time="$(/usr/bin/awk '{ print $22 }' "/proc/$pid/stat")" || return 1
	[[ "$start_time" =~ ^[1-9][0-9]*$ ]] || return 1
	/usr/bin/printf '%s:%s:%s:%s:%s' "$pid" "$start_time" "$socket_file_identity" "$inode" "$daemon_config_identity"
}

runtime_env() {
	local before after status
	before="$(runtime_identity_snapshot)" || return 1
	set +e
	/usr/sbin/runuser -u "$RUNTIME_USER" -- /usr/bin/env -i \
		PATH='/usr/bin:/bin' HOME="$RUNTIME_HOME" \
		XDG_RUNTIME_DIR="$ROOTLESS_RUNTIME_DIR" DOCKER_HOST="$DOCKER_HOST" \
		DOCKER_CONFIG="$DOCKER_CONFIG" "$@"
	status=$?
	set -e
	after="$(runtime_identity_snapshot)" || return 1
	[[ "$after" == "$before" ]] || return 1
	return "$status"
}

compose_portal() {
	local tree="$1" web="$2" worker="$3" migrate="$4" postgres="$5"
	shift 5
	runtime_env APP_ENV_FILE="$ENV_FILE" WEB_IMAGE_DIGEST="$web" \
		WORKER_IMAGE_DIGEST="$worker" MIGRATE_IMAGE_DIGEST="$migrate" \
		POSTGRES_IMAGE_DIGEST="$postgres" \
		/usr/bin/docker compose --project-name yonaris --env-file "$ENV_FILE" \
			--file "$tree/deploy/las/compose.yaml" "$@"
}

validate_compose_model() {
	local tree="$1" web="$2" worker="$3" migrate="$4" postgres="$5"
	local output
	output="$(/usr/bin/mktemp "$STATE_DIRECTORY/.las-compose-model.XXXXXX")" || return 1
	compose_portal "$tree" "$web" "$worker" "$migrate" "$postgres" config --format json >"$output" || {
		/usr/bin/rm -f -- "$output"; return 1;
	}
	set +e
	/usr/bin/python3 - "$web" "$worker" "$migrate" "$postgres" "$output" "$ENV_FILE" <<'PY'
import json
import pathlib
import sys

web, worker, migrate, postgres, path, env_path = sys.argv[1:]
model = json.loads(pathlib.Path(path).read_text(encoding="utf-8"))
def reject(reason):
    raise SystemExit(f"rendered Compose rejected: {reason}")
if set(model) - {"name", "networks", "services", "volumes"}:
    reject("unknown top-level key")
if model.get("name") != "yonaris":
    reject("project name is not exact")
services = model.get("services")
if not isinstance(services, dict):
    reject("services is not an object")
expected = {
    "postgres": f"postgres@{postgres}",
    "db-migrate": f"ghcr.io/blackdcp/yonaris-db-migrate@{migrate}",
    "account-ops": f"ghcr.io/blackdcp/yonaris-worker@{worker}",
    "web": f"ghcr.io/blackdcp/yonaris-web@{web}",
    "worker": f"ghcr.io/blackdcp/yonaris-worker@{worker}",
}
if set(services) != set(expected):
    reject("service set is not exact")
if set(model.get("networks", {})) != {"backend"} or set(model.get("volumes", {})) != {"postgres_data"}:
    reject("portal network or volume set is not exact")
network = model["networks"]["backend"]
volume = model["volumes"]["postgres_data"]
if (not isinstance(network, dict) or set(network) - {"name", "external"}
        or network.get("name") != "yonaris_backend" or network.get("external", False) is not False):
    reject("backend network definition is not exact")
if (not isinstance(volume, dict) or set(volume) - {"name", "driver"}
        or volume.get("name") != "yonaris_postgres_data" or volume.get("driver", "local") != "local"):
    reject("Postgres named volume definition is not exact")
allowed = {
    "postgres": {"cpus", "environment", "healthcheck", "image", "logging", "mem_limit", "networks", "restart", "shm_size", "stop_grace_period", "volumes"},
    "db-migrate": {"cpus", "depends_on", "environment", "image", "logging", "mem_limit", "networks", "profiles", "restart"},
    "account-ops": {"cpus", "depends_on", "environment", "image", "logging", "mem_limit", "networks", "profiles", "restart", "volumes"},
    "web": {"cpus", "depends_on", "environment", "healthcheck", "image", "logging", "mem_limit", "networks", "ports", "restart", "stop_grace_period", "volumes"},
    "worker": {"cpus", "depends_on", "environment", "image", "logging", "mem_limit", "networks", "restart", "stop_grace_period", "volumes"},
}
dotenv = {}
for line in pathlib.Path(env_path).read_text(encoding="utf-8").splitlines():
    if line and not line.lstrip().startswith("#"):
        key, value = line.split("=", 1)
        if len(value) >= 2 and value[0] == value[-1] and value[0] in "'\"":
            value = value[1:-1]
        dotenv[key] = value
required = {
    "postgres": {"environment", "healthcheck", "image", "networks", "restart", "volumes"},
    "db-migrate": {"depends_on", "environment", "image", "networks", "profiles", "restart"},
    "account-ops": {"depends_on", "environment", "image", "networks", "profiles", "restart", "volumes"},
    "web": {"depends_on", "environment", "healthcheck", "image", "networks", "ports", "restart", "volumes"},
    "worker": {"depends_on", "environment", "image", "networks", "restart", "volumes"},
}
expected_restart = {
    "postgres": "unless-stopped", "db-migrate": "no", "account-ops": "no",
    "web": "unless-stopped", "worker": "unless-stopped",
}
expected_limits = {
    "postgres": (1.0, 1024**3), "db-migrate": (1.0, 1024**3),
    "account-ops": (0.5, 512 * 1024**2), "web": (1.0, 1024**3),
    "worker": (1.5, 2 * 1024**3),
}
expected_stop = {"postgres": "60s", "web": "30s", "worker": "90s"}
expected_health = {
    "postgres": (["CMD-SHELL", "pg_isready -U $POSTGRES_USER -d $POSTGRES_DB"], "5s", "5s", 12, "20s"),
    "web": (["CMD", "curl", "--fail", "--silent", "--show-error", "--max-time", "5", "http://127.0.0.1:3000/"], "15s", "6s", 8, "45s"),
}
def duration_matches(value, expected):
    nanos = {"5s": 5_000_000_000, "6s": 6_000_000_000, "15s": 15_000_000_000,
             "20s": 20_000_000_000, "30s": 30_000_000_000, "45s": 45_000_000_000,
             "60s": 60_000_000_000, "90s": 90_000_000_000}
    return value == expected or value == nanos.get(expected)
def memory_matches(value, expected):
    aliases = {256 * 1024**2: {"256m", "268435456"}, 512 * 1024**2: {"512m", "536870912"},
               1024**3: {"1g", "1073741824"}, 2 * 1024**3: {"2g", "2147483648"}}
    return value == expected or str(value).lower() in aliases.get(expected, set())
for name, service in services.items():
    if (not isinstance(service, dict) or service.get("image") != expected[name]
            or set(service) - allowed[name] or not required[name].issubset(service)):
        reject(f"{name} has unknown/missing keys or a mismatched image")
    if set(service.get("networks", {})) != {"backend"}:
        reject(f"{name} network attachment is not exact")
    if service.get("networks", {}).get("backend") not in (None, {}):
        reject(f"{name} network attachment options are not exact")

    environment = service.get("environment")
    if not isinstance(environment, dict):
        reject(f"{name} environment is not an object")
    if name == "postgres":
        expected_environment = {
            "POSTGRES_USER": dotenv["POSTGRES_USER"],
            "POSTGRES_PASSWORD": dotenv["POSTGRES_PASSWORD"],
            "POSTGRES_DB": dotenv["POSTGRES_DB"],
            "POSTGRES_INITDB_ARGS": "--data-checksums",
        }
        if environment != expected_environment:
            reject("Postgres environment shape is not exact")
    elif name in {"db-migrate", "account-ops", "web", "worker"}:
        if environment != dotenv:
            reject(f"{name} env_file expansion is not exact")
    if service.get("restart") != expected_restart[name]:
        reject(f"{name} restart policy is not exact")
    expected_cpu, expected_memory = expected_limits[name]
    if float(service.get("cpus", -1)) != expected_cpu or not memory_matches(service.get("mem_limit"), expected_memory):
        reject(f"{name} resource limits are not exact")
    logging = service.get("logging")
    if logging != {"driver": "json-file", "options": {"max-file": "5", "max-size": "20m"}}:
        reject(f"{name} logging policy is not exact")
    if name in expected_stop and not duration_matches(service.get("stop_grace_period"), expected_stop[name]):
        reject(f"{name} stop grace period is not exact")
    if name == "postgres" and not memory_matches(service.get("shm_size"), 256 * 1024**2):
        reject("Postgres shared-memory limit is not exact")
    expected_profiles = ["operations"] if name in {"db-migrate", "account-ops"} else None
    if service.get("profiles") != expected_profiles:
        reject(f"{name} profile membership is not exact")
    if name in expected_health:
        health = service.get("healthcheck")
        test, interval, timeout, retries, start_period = expected_health[name]
        if (not isinstance(health, dict) or set(health) - {"test", "interval", "timeout", "retries", "start_period", "disable"}
                or health.get("disable", False) is not False or health.get("test") != test
                or not duration_matches(health.get("interval"), interval)
                or not duration_matches(health.get("timeout"), timeout)
                or health.get("retries") != retries
                or not duration_matches(health.get("start_period"), start_period)):
            reject(f"{name} healthcheck is not exact")
    if name in {"db-migrate", "account-ops", "web", "worker"}:
        depends = service.get("depends_on")
        if not isinstance(depends, dict) or set(depends) != {"postgres"}:
            reject(f"{name} dependency graph is not exact")
        dependency = depends["postgres"]
        if (not isinstance(dependency, dict) or set(dependency) - {"condition", "required", "restart"}
                or dependency.get("condition") != "service_healthy"
                or dependency.get("required", True) is not True or dependency.get("restart", False) is not False):
            reject(f"{name} Postgres dependency is not exact")
    volumes = service.get("volumes", [])
    expected_volume = None
    if name == "postgres":
        expected_volume = ("volume", "postgres_data", "/var/lib/postgresql/data")
    elif name in {"account-ops", "web", "worker"}:
        expected_volume = ("bind", "/var/lib/yonaris/response-snapshots/v1", "/var/lib/yonaris/response-snapshots/v1")
    if (expected_volume is None and volumes) or (expected_volume is not None and len(volumes) != 1):
        reject(f"{name} volume count is not exact")
    for volume in service.get("volumes", []):
        if (not isinstance(volume, dict) or set(volume) - {"type", "source", "target", "read_only", "bind", "volume", "consistency"}
                or volume.get("type") not in {"volume", "bind"} or volume.get("read_only", False) is not False):
            reject(f"{name} volume entry is malformed")
        source, target = volume.get("source"), volume.get("target")
        if (volume.get("type"), source, target) != expected_volume:
            reject(f"{name} has an unapproved volume mapping")
        if volume.get("bind") not in (None, {}, {"create_host_path": True}) \
                or volume.get("volume") not in (None, {}, {"nocopy": False}) \
                or volume.get("consistency") not in (None, "consistent"):
            reject(f"{name} volume options are not exact")
        if any(token in str(source) or token in str(target) for token in ("docker.sock", "/proc", "/sys", "/dev", "/run")):
            reject(f"{name} volume reaches a runtime/kernel path")
    ports = service.get("ports", [])
    expected_port = 1515 if name == "web" else None
    if (expected_port is None and ports) or (expected_port is not None and len(ports) != 1):
        reject(f"{name} published port count is not exact")
    for port in ports:
        if not isinstance(port, dict) or port.get("host_ip") != "127.0.0.1":
            reject(f"{name} port binding is not loopback")
        if (set(port) - {"host_ip", "published", "target", "protocol", "mode"}
                or int(port.get("published", -1)) != expected_port or int(port.get("target", -1)) != 3000
                or port.get("protocol", "tcp") != "tcp" or port.get("mode", "ingress") != "ingress"):
            reject(f"{name} published port is not exact")
PY
	status=$?
	set -e
	/usr/bin/rm -f -- "$output" || return 1
	return "$status"
}

authorize_requested_portal_rollback() {
	state_attestation 'las-pending-runtime-tuple-v1 ok' pending-runtime-tuple portal "$@"
}

authorize_failed_deploy_portal_rollback() {
	state_attestation 'las-pending-rollback-runtime-tuple-v1 ok' pending-rollback-runtime-tuple portal "$@"
}

authorize_portal_mutation() {
	local gate="$1" release_tag="$2" web="$3" worker="$4" migrate="$5" postgres="$6"
	verify_runtime_boundary || return 1
	state_attestation 'las-migration-readiness-v2 ok' migration-readiness \
		"$release_tag" "$web" "$worker" "$migrate" "$postgres" || return 1
	case "$gate" in
		pending)
			state_attestation 'las-pending-runtime-tuple-v1 ok' pending-runtime-tuple portal \
				"$release_tag" "$web" "$worker" "$migrate" "$postgres"
			;;
		rollback)
			authorize_requested_portal_rollback "$release_tag" "$web" "$worker" "$migrate" "$postgres" || \
				authorize_failed_deploy_portal_rollback "$release_tag" "$web" "$worker" "$migrate" "$postgres"
			;;
		bootstrap)
			state_attestation 'las-bootstrap-runtime-authorization-v1 ok' bootstrap-runtime-authorization portal \
				"$release_tag" "$web" "$worker" "$migrate" "$postgres"
			;;
		*) return 1 ;;
	esac
}

portal_mutation() {
	local gate="$1" tree="$2" release_tag="$3" web="$4" worker="$5" migrate="$6" postgres="$7"
	shift 7
	authorize_portal_mutation "$gate" "$release_tag" "$web" "$worker" "$migrate" "$postgres" || \
		return 1
	compose_portal "$tree" "$web" "$worker" "$migrate" "$postgres" "$@"
}

image_has_repo_digest() {
	local image="$1" digest="$2"
	runtime_env /usr/bin/docker image inspect --format '{{range .RepoDigests}}{{println .}}{{end}}' \
		"$image@$digest" | /usr/bin/grep -Fqx "$image@$digest"
}

container_matches() {
	local container_id="$1" image="$2" digest="$3" require_health="$4"
	local actual_image health
	[[ -n "$container_id" ]] || return 1
	actual_image="$(runtime_env /usr/bin/docker inspect --format '{{.Config.Image}}' "$container_id")" || return 1
	[[ "$actual_image" == "$image@$digest" ]] || return 1
	if [[ "$require_health" == yes ]]; then
		health="$(runtime_env /usr/bin/docker inspect --format '{{.State.Health.Status}}' "$container_id")" || return 1
		[[ "$health" == healthy ]] || return 1
	fi
	image_has_repo_digest "$image" "$digest"
}

verify_portal() {
	local tree="$1" web="$2" worker="$3" migrate="$4" postgres="$5"
	local web_id worker_id postgres_id worker_before worker_after
	postgres_id="$(compose_portal "$tree" "$web" "$worker" "$migrate" "$postgres" ps -q postgres)" || return 1
	web_id="$(compose_portal "$tree" "$web" "$worker" "$migrate" "$postgres" ps -q web)" || return 1
	worker_id="$(compose_portal "$tree" "$web" "$worker" "$migrate" "$postgres" ps -q worker)" || return 1
	container_matches "$postgres_id" "$POSTGRES_IMAGE" "$postgres" yes && \
		container_matches "$web_id" "$PORTAL_WEB_IMAGE" "$web" yes || return 1
	worker_before="$(runtime_env /usr/bin/docker inspect --format '{{.State.Status}} {{.RestartCount}} {{.Config.Image}}' "$worker_id")" || return 1
	[[ "$worker_before" == "running "*" $PORTAL_WORKER_IMAGE@$worker" ]] || return 1
	/usr/bin/sleep 10
	worker_after="$(runtime_env /usr/bin/docker inspect --format '{{.State.Status}} {{.RestartCount}} {{.Config.Image}}' "$worker_id")" || return 1
	[[ "$worker_after" == "$worker_before" ]] || return 1
	image_has_repo_digest "$PORTAL_WORKER_IMAGE" "$worker" && \
		image_has_repo_digest "$PORTAL_MIGRATE_IMAGE" "$migrate" && \
		/usr/bin/curl --fail --silent --show-error --max-time 15 http://127.0.0.1:1515/ >/dev/null
}

migration_work_path() {
	local release_tag="$1" path="$2" release_root normalized
	release_root="$MIGRATION_WORK_ROOT/$release_tag"
	[[ "$path" == /* ]] || return 1
	normalized="$(/usr/bin/realpath -m -- "$path")" || return 1
	[[ "$normalized" == "$path" && "$normalized" == "$release_root/"* ]] || return 1
	/usr/bin/printf '%s' "$normalized"
}

prepare_migration_work_directory() {
	local release_tag="$1" release_root="$MIGRATION_WORK_ROOT/$1"
	/usr/bin/mkdir -p -- "$release_root" || return 1
	/usr/bin/chmod 0700 -- "$release_root" || return 1
	metadata_matches "$release_root" directory '0:0:700'
}

authorize_migration_readiness_runtime() {
	local release_tag="$1" web="$2" worker="$3" migrate="$4" postgres="$5"
	state_attestation 'las-migration-readiness-runtime-authorization-v2 ok' \
		migration-readiness-runtime-authorization "$release_tag" "$web" "$worker" "$migrate" "$postgres"
}

postgres_runtime_values() {
	/usr/bin/python3 - "$ENV_FILE" <<'PY'
import pathlib
import sys

values = {}
for line in pathlib.Path(sys.argv[1]).read_text(encoding="utf-8").splitlines():
    if not line or line.lstrip().startswith("#"):
        continue
    key, value = line.split("=", 1)
    if len(value) >= 2 and value[:1] == value[-1:] and value[:1] in {"'", '"'}:
        value = value[1:-1]
    values[key] = value
for key in ("POSTGRES_USER", "POSTGRES_DB"):
    value = values.get(key)
    if not value or "\n" in value:
        raise SystemExit(1)
    print(value)
PY
}

migration_rehearsal_docker() {
	local release_tag="$1" web="$2" worker="$3" migrate="$4" postgres="$5"
	shift 5
	authorize_migration_readiness_runtime "$release_tag" "$web" "$worker" "$migrate" "$postgres" || return 1
	runtime_env /usr/bin/docker "$@"
}

migration_rehearsal_resource_is_absent() {
	local kind="$1" name="$2" output
	local -a command
	case "$kind" in
		container) command=(container ls --all --quiet --filter "name=^/$name$") ;;
		volume) command=(volume ls --quiet --filter "name=^$name$") ;;
		network) command=(network ls --quiet --filter "name=^$name$") ;;
		*) return 1 ;;
	esac
	output="$(migration_rehearsal_docker "$MIGRATION_REHEARSAL_RELEASE" "$MIGRATION_REHEARSAL_WEB" \
		"$MIGRATION_REHEARSAL_WORKER" "$MIGRATION_REHEARSAL_MIGRATE" "$MIGRATION_REHEARSAL_POSTGRES" \
		"${command[@]}")" || return 1
	[[ -z "$output" ]]
}

migration_rehearsal_cleanup() {
	local status="$?" cleanup_status=0
	trap - EXIT
	if [[ "$MIGRATION_REHEARSAL_MIGRATION_CONTAINER_CREATED" == true ]]; then
		migration_rehearsal_docker "$MIGRATION_REHEARSAL_RELEASE" "$MIGRATION_REHEARSAL_WEB" "$MIGRATION_REHEARSAL_WORKER" \
			"$MIGRATION_REHEARSAL_MIGRATE" "$MIGRATION_REHEARSAL_POSTGRES" \
			rm -f "$MIGRATION_REHEARSAL_MIGRATION_CONTAINER" >/dev/null 2>&1 || cleanup_status=1
		migration_rehearsal_resource_is_absent container "$MIGRATION_REHEARSAL_MIGRATION_CONTAINER" || cleanup_status=1
	fi
	if [[ "$MIGRATION_REHEARSAL_CONTAINER_CREATED" == true ]]; then
		migration_rehearsal_docker "$MIGRATION_REHEARSAL_RELEASE" "$MIGRATION_REHEARSAL_WEB" "$MIGRATION_REHEARSAL_WORKER" \
			"$MIGRATION_REHEARSAL_MIGRATE" "$MIGRATION_REHEARSAL_POSTGRES" \
			rm -f "$MIGRATION_REHEARSAL_CONTAINER" >/dev/null 2>&1 || cleanup_status=1
		migration_rehearsal_resource_is_absent container "$MIGRATION_REHEARSAL_CONTAINER" || cleanup_status=1
	fi
	if [[ "$MIGRATION_REHEARSAL_VOLUME_CREATED" == true ]]; then
		migration_rehearsal_docker "$MIGRATION_REHEARSAL_RELEASE" "$MIGRATION_REHEARSAL_WEB" "$MIGRATION_REHEARSAL_WORKER" \
			"$MIGRATION_REHEARSAL_MIGRATE" "$MIGRATION_REHEARSAL_POSTGRES" \
			volume rm "$MIGRATION_REHEARSAL_VOLUME" >/dev/null 2>&1 || cleanup_status=1
		migration_rehearsal_resource_is_absent volume "$MIGRATION_REHEARSAL_VOLUME" || cleanup_status=1
	fi
	if [[ "$MIGRATION_REHEARSAL_NETWORK_CREATED" == true ]]; then
		migration_rehearsal_docker "$MIGRATION_REHEARSAL_RELEASE" "$MIGRATION_REHEARSAL_WEB" "$MIGRATION_REHEARSAL_WORKER" \
			"$MIGRATION_REHEARSAL_MIGRATE" "$MIGRATION_REHEARSAL_POSTGRES" \
			network rm "$MIGRATION_REHEARSAL_NETWORK" >/dev/null 2>&1 || cleanup_status=1
		migration_rehearsal_resource_is_absent network "$MIGRATION_REHEARSAL_NETWORK" || cleanup_status=1
	fi
	[[ "$status" -ne 0 ]] && return "$status"
	return "$cleanup_status"
}

wait_for_migration_rehearsal_postgres() {
	local release_tag="$1" web="$2" worker="$3" migrate="$4" postgres="$5" rehearsal_container="$6"
	local attempt
	for ((attempt = 1; attempt <= MIGRATION_REHEARSAL_READY_ATTEMPTS; attempt += 1)); do
		if migration_rehearsal_docker "$release_tag" "$web" "$worker" "$migrate" "$postgres" \
			exec "$rehearsal_container" pg_isready --username yonaris_rehearsal --dbname yonaris_rehearsal; then
			return 0
		fi
		[[ "$attempt" -lt MIGRATION_REHEARSAL_READY_ATTEMPTS ]] && /usr/bin/sleep 1
	done
	return 1
}

migration_backup() {
	local tree="$1" release_tag="$2" web="$3" worker="$4" migrate="$5" postgres="$6" output="$7"
	local -a postgres_values
	local postgres_user postgres_database
	prepare_migration_work_directory "$release_tag" || return 1
	output="$(migration_work_path "$release_tag" "$output")" || return 1
	[[ ! -e "$output" && ! -L "$output" ]] || return 1
	mapfile -t postgres_values < <(postgres_runtime_values)
	[[ "${#postgres_values[@]}" == 2 ]] || return 1
	postgres_user="${postgres_values[0]%$'\r'}"
	postgres_database="${postgres_values[1]%$'\r'}"
	[[ -n "$postgres_user" && -n "$postgres_database" ]] || return 1
	validate_compose_model "$tree" "$web" "$worker" "$migrate" "$postgres" || return 1
	authorize_migration_readiness_runtime "$release_tag" "$web" "$worker" "$migrate" "$postgres" || return 1
	if ! compose_portal "$tree" "$web" "$worker" "$migrate" "$postgres" \
		exec -T postgres pg_dump --username "$postgres_user" --dbname "$postgres_database" \
		--format custom --no-owner --no-acl >"$output"; then
		/usr/bin/rm -f -- "$output"
		return 1
	fi
	metadata_matches "$output" file '0:0:600' && [[ -s "$output" ]] || {
		/usr/bin/rm -f -- "$output"
		return 1
	}
}

migration_rehearse() {
	local release_tag="$1" web="$2" worker="$3" migrate="$4" postgres="$5" backup="$6" result="$7"
	local rehearsal_prefix rehearsal_network rehearsal_volume rehearsal_container rehearsal_migration_container rehearsal_nonce rehearsal_user='yonaris_rehearsal'
	local rehearsal_database='yonaris_rehearsal' rehearsal_password='yonaris_rehearsal'
	local database_url migration_exit_status completion_timestamp
	prepare_migration_work_directory "$release_tag" || return 1
	backup="$(migration_work_path "$release_tag" "$backup")" || return 1
	result="$(migration_work_path "$release_tag" "$result")" || return 1
	[[ ! -e "$result" && ! -L "$result" ]] || return 1
	metadata_matches "$backup" file '0:0:600' && [[ -s "$backup" ]] || return 1
	rehearsal_nonce="$(/usr/bin/od -An -N8 -tx1 /dev/urandom | /usr/bin/tr -d '[:space:]')" || return 1
	[[ "$rehearsal_nonce" =~ ^[0-9a-f]{16}$ ]] || return 1
	rehearsal_prefix="yonaris-migration-readiness-$release_tag-$rehearsal_nonce"
	rehearsal_network="$rehearsal_prefix-network"
	rehearsal_volume="$rehearsal_prefix-volume"
	rehearsal_container="$rehearsal_prefix-postgres"
	rehearsal_migration_container="$rehearsal_prefix-migrate"
	database_url="postgresql://$rehearsal_user:$rehearsal_password@$rehearsal_container:5432/$rehearsal_database"
	MIGRATION_REHEARSAL_RELEASE="$release_tag"
	MIGRATION_REHEARSAL_WEB="$web"
	MIGRATION_REHEARSAL_WORKER="$worker"
	MIGRATION_REHEARSAL_MIGRATE="$migrate"
	MIGRATION_REHEARSAL_POSTGRES="$postgres"
	MIGRATION_REHEARSAL_CONTAINER="$rehearsal_container"
	MIGRATION_REHEARSAL_MIGRATION_CONTAINER="$rehearsal_migration_container"
	MIGRATION_REHEARSAL_VOLUME="$rehearsal_volume"
	MIGRATION_REHEARSAL_NETWORK="$rehearsal_network"
	MIGRATION_REHEARSAL_CONTAINER_CREATED=false
	MIGRATION_REHEARSAL_MIGRATION_CONTAINER_CREATED=false
	MIGRATION_REHEARSAL_VOLUME_CREATED=false
	MIGRATION_REHEARSAL_NETWORK_CREATED=false
	trap migration_rehearsal_cleanup EXIT
	migration_rehearsal_docker "$release_tag" "$web" "$worker" "$migrate" "$postgres" pull "$POSTGRES_IMAGE@$postgres" || return 1
	migration_rehearsal_docker "$release_tag" "$web" "$worker" "$migrate" "$postgres" pull "$PORTAL_MIGRATE_IMAGE@$migrate" || return 1
	migration_rehearsal_docker "$release_tag" "$web" "$worker" "$migrate" "$postgres" network create --internal "$rehearsal_network" || return 1
	MIGRATION_REHEARSAL_NETWORK_CREATED=true
	migration_rehearsal_docker "$release_tag" "$web" "$worker" "$migrate" "$postgres" volume create "$rehearsal_volume" || return 1
	MIGRATION_REHEARSAL_VOLUME_CREATED=true
	migration_rehearsal_docker "$release_tag" "$web" "$worker" "$migrate" "$postgres" run --detach \
		--name "$rehearsal_container" --network "$rehearsal_network" \
		--mount "type=volume,source=$rehearsal_volume,target=/var/lib/postgresql/data" \
		--env "POSTGRES_USER=$rehearsal_user" --env "POSTGRES_PASSWORD=$rehearsal_password" \
		--env "POSTGRES_DB=$rehearsal_database" "$POSTGRES_IMAGE@$postgres" || return 1
	MIGRATION_REHEARSAL_CONTAINER_CREATED=true
	wait_for_migration_rehearsal_postgres "$release_tag" "$web" "$worker" "$migrate" "$postgres" "$rehearsal_container" || return 1
	# The root shell opens the root-only backup before the rootless runtime inherits stdin.
	migration_rehearsal_docker "$release_tag" "$web" "$worker" "$migrate" "$postgres" \
		exec -i "$rehearsal_container" pg_restore --username "$rehearsal_user" --dbname "$rehearsal_database" --no-owner --no-acl <"$backup" || return 1
	migration_rehearsal_docker "$release_tag" "$web" "$worker" "$migrate" "$postgres" create \
		--name "$rehearsal_migration_container" --network "$rehearsal_network" \
		--env "DATABASE_URL=$database_url" "$PORTAL_MIGRATE_IMAGE@$migrate" >/dev/null || return 1
	MIGRATION_REHEARSAL_MIGRATION_CONTAINER_CREATED=true
	migration_rehearsal_docker "$release_tag" "$web" "$worker" "$migrate" "$postgres" \
		start --attach "$rehearsal_migration_container" || return 1
	migration_exit_status="$(migration_rehearsal_docker "$release_tag" "$web" "$worker" "$migrate" "$postgres" \
		wait "$rehearsal_migration_container")" || return 1
	[[ "$migration_exit_status" == 0 ]] || return 1
	wait_for_migration_rehearsal_postgres "$release_tag" "$web" "$worker" "$migrate" "$postgres" "$rehearsal_container" || return 1
	migration_rehearsal_cleanup || return 1
	completion_timestamp="$(/usr/bin/date -u +'%Y-%m-%dT%H:%M:%SZ')" || return 1
	[[ "$completion_timestamp" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z$ ]] || return 1
	/usr/bin/printf '%s\n' 'las-migration-rehearsal-runtime-v2 ok' 'migration-exit-status 0' \
		"completed-at-utc $completion_timestamp" >"$result" || return 1
	metadata_matches "$result" file '0:0:600'
}

[[ "$(/usr/bin/id -u)" == 0 ]] || fail 'The LAS runtime manager must run as root.'
if [[ -n "${LAS_STABLE_BUNDLE_DIR:-}" ]]; then
	[[ "$LAS_STABLE_BUNDLE_DIR" =~ ^/usr/local/libexec/yonaris-las/bundles/sha256-[0-9a-f]{64}$ ]] || \
		fail 'The active LAS bundle pin is invalid.'
fi
if [[ $# -eq 1 ]]; then
	case "$1" in
		verify-boundary)
			verify_runtime_boundary steady || fail 'The isolated LAS runtime boundary is invalid.'
			exit 0
			;;
		verify-preactivation-boundary)
			verify_runtime_boundary preactivation || fail 'The isolated LAS preactivation boundary is invalid.'
			exit 0
			;;
	esac
fi
[[ $# -ge 3 ]] || fail 'Refusing invalid LAS runtime-manager request.' 2
operation="$1"; release_tag="$2"
if [[ ( "$operation" == bootstrap-portal-deploy || "$operation" == migration-backup || \
	"$operation" == migration-rehearse ) && \
	-n "${SUDO_USER:-}" ]]; then
	fail 'Only a direct root operator may bootstrap the LAS runtime.' 2
fi
release_is_valid "$release_tag" || fail 'Refusing invalid runtime release.' 2
tree="$(release_tree "$release_tag")" || fail 'The immutable runtime release tree is invalid.'
verify_runtime_boundary || fail 'The isolated LAS runtime boundary is invalid.'

case "$operation" in
	migration-backup)
		[[ $# -eq 8 ]] || fail 'Migration backup requires four exact image digests and an output path.' 2
		web="$3"; worker="$4"; migrate="$5"; postgres="$6"; output="$7"; expected_marker="$8"
		for digest in "$web" "$worker" "$migrate" "$postgres"; do digest_is_valid "$digest" || exit 2; done
		[[ "$expected_marker" == migration-readiness-runtime-v2 ]] || exit 2
		migration_backup "$tree" "$release_tag" "$web" "$worker" "$migrate" "$postgres" "$output" || \
			fail 'Migration backup failed.'
		;;
	migration-rehearse)
		[[ $# -eq 9 ]] || fail 'Migration rehearsal requires four exact image digests, backup, and result paths.' 2
		web="$3"; worker="$4"; migrate="$5"; postgres="$6"; backup="$7"; result="$8"; expected_marker="$9"
		for digest in "$web" "$worker" "$migrate" "$postgres"; do digest_is_valid "$digest" || exit 2; done
		[[ "$expected_marker" == migration-readiness-runtime-v2 ]] || exit 2
		migration_rehearse "$release_tag" "$web" "$worker" "$migrate" "$postgres" "$backup" "$result" || \
			fail 'Migration rehearsal failed.'
		;;
	portal-preflight | portal-deploy | portal-rollback | portal-verify)
		[[ $# -eq 7 ]] || fail 'Portal runtime operations require four exact image digests.' 2
		web="$3"; worker="$4"; migrate="$5"; postgres="$6"; expected_marker="$7"
		for digest in "$web" "$worker" "$migrate" "$postgres"; do digest_is_valid "$digest" || exit 2; done
		[[ "$expected_marker" == portal-runtime-v2 ]] || exit 2
		validate_compose_model "$tree" "$web" "$worker" "$migrate" "$postgres" || \
			fail 'Portal Compose exceeds the parsed stable runtime allowlist.'
		case "$operation" in
			portal-preflight) exit 0 ;;
			portal-deploy)
				portal_mutation pending "$tree" "$release_tag" "$web" "$worker" "$migrate" "$postgres" pull postgres db-migrate web worker
				portal_mutation pending "$tree" "$release_tag" "$web" "$worker" "$migrate" "$postgres" up -d --wait postgres
				portal_mutation pending "$tree" "$release_tag" "$web" "$worker" "$migrate" "$postgres" --profile operations run --rm db-migrate
				portal_mutation pending "$tree" "$release_tag" "$web" "$worker" "$migrate" "$postgres" up -d --no-deps web worker
				;;
			portal-rollback)
				portal_mutation rollback "$tree" "$release_tag" "$web" "$worker" "$migrate" "$postgres" pull postgres web worker
				portal_mutation rollback "$tree" "$release_tag" "$web" "$worker" "$migrate" "$postgres" up -d --no-deps postgres web worker
				;;
		esac
		verify_portal "$tree" "$web" "$worker" "$migrate" "$postgres"
		;;
	bootstrap-portal-deploy)
		[[ $# -eq 7 ]] || fail 'Bootstrap portal runtime requires four exact image digests.' 2
		web="$3"; worker="$4"; migrate="$5"; postgres="$6"; expected_marker="$7"
		for digest in "$web" "$worker" "$migrate" "$postgres"; do digest_is_valid "$digest" || exit 2; done
		[[ "$expected_marker" == portal-bootstrap-runtime-v2 ]] || exit 2
		validate_compose_model "$tree" "$web" "$worker" "$migrate" "$postgres" || \
			fail 'Portal Compose exceeds the parsed stable runtime allowlist.'
		portal_mutation bootstrap "$tree" "$release_tag" "$web" "$worker" "$migrate" "$postgres" pull postgres db-migrate web worker
		portal_mutation bootstrap "$tree" "$release_tag" "$web" "$worker" "$migrate" "$postgres" up -d --wait postgres
		portal_mutation bootstrap "$tree" "$release_tag" "$web" "$worker" "$migrate" "$postgres" --profile operations run --rm db-migrate
		portal_mutation bootstrap "$tree" "$release_tag" "$web" "$worker" "$migrate" "$postgres" up -d --no-deps web worker
		verify_portal "$tree" "$web" "$worker" "$migrate" "$postgres"
		;;
	*) fail 'Refusing unknown LAS runtime-manager operation.' 2 ;;
esac
