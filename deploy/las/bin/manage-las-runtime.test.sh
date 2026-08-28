#!/usr/bin/env bash

set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
SOURCE="$SCRIPT_DIR/manage-las-runtime.sh"
DISPATCHER="$SCRIPT_DIR/dispatch-las-command.sh"
TEST_ROOT="$(mktemp -d)"
trap 'rm -rf -- "$TEST_ROOT"' EXIT

STATE="$TEST_ROOT/var/lib/yonaris"
WORK_ROOT="$STATE/migration-readiness-work-v2"
TREES="$STATE/las-release-trees"
RUNTIME_HOME="$TEST_ROOT/var/lib/yonaris-runtime"
RUNTIME_DIR="$TEST_ROOT/run/user/2002"
DAEMON_CONFIG_DIRECTORY="$RUNTIME_HOME/.config/docker"
DAEMON_CONFIG="$DAEMON_CONFIG_DIRECTORY/daemon.json"
ENV_FILE="$TEST_ROOT/etc/yonaris/las-runtime.env"
ACTIVATION_ATTESTATION="$TEST_ROOT/etc/yonaris/artifact-output-language-active-v1"
PROC="$TEST_ROOT/proc"
MOCK_BIN="$TEST_ROOT/mock-bin"
DOCKER_LOG="$TEST_ROOT/docker.log"
EVENT_LOG="$TEST_ROOT/events.log"
STATE_MODE="$TEST_ROOT/state-mode"
MANAGER="$TEST_ROOT/manage-las-runtime"
MODEL="$TEST_ROOT/model.json"
RELEASE='sha-1111111111111111111111111111111111111111'
TREE="$TREES/$RELEASE"
WEB='sha256:1111111111111111111111111111111111111111111111111111111111111111'
WORKER='sha256:2222222222222222222222222222222222222222222222222222222222222222'
MIGRATE='sha256:3333333333333333333333333333333333333333333333333333333333333333'
POSTGRES='sha256:4444444444444444444444444444444444444444444444444444444444444444'
RETIRED_FIFTH_DIGEST='sha256:5555555555555555555555555555555555555555555555555555555555555555'
REAL_STAT="$(command -v stat)"
REAL_READLINK="$(command -v readlink)"
REAL_TR="$(command -v tr)"
REAL_AWK="$(command -v awk)"
REAL_PYTHON="${RUNTIME_TEST_REAL_PYTHON:-$(command -v python3)}"
STABLE_DIRECTORY="$TEST_ROOT/usr/local/libexec/yonaris-las"
STATE_MANAGER="$STABLE_DIRECTORY/manage-las-release-state"

! grep -Eq 'MARKETING_|marketing|compose\.marketing|WWW_IMAGE_DIGEST|yonaris-www|1516|www-sha256' "$SOURCE"
grep -Fq 'RESEND_API_KEY' "$SOURCE"
grep -Fq 'RESEND_FROM_EMAIL' "$SOURCE"
grep -Fq 'portal-runtime-v2' "$SOURCE"
grep -Fq 'migration-readiness-runtime-v2' "$SOURCE"

mkdir -p "$TREE/deploy/las" "$RUNTIME_HOME/.docker" "$RUNTIME_DIR" "$PROC/432/fd" "$PROC/net" \
	"$MOCK_BIN" "$STABLE_DIRECTORY" "$TEST_ROOT/docker-resources" "$(dirname -- "$ENV_FILE")"
printf 'services: {}\n' >"$TREE/deploy/las/compose.yaml"
write_valid_env() {
	cat >"$ENV_FILE" <<'EOF'
POSTGRES_USER=postgres
POSTGRES_PASSWORD=test-secret
POSTGRES_DB=yonaris
DATABASE_URL=postgresql://postgres:test-secret@postgres:5432/yonaris
DEPLOYMENT_ID=11111111-1111-4111-8111-111111111111
APP_URL=https://portal.yonaris.com
BETTER_AUTH_SECRET=e2e-session-secret-with-at-least-thirty-two-characters
CREDENTIAL_ENCRYPTION_KEY=BwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwc=
SCRAPE_TARGETS=chatgpt:olostep:online
OLOSTEP_API_KEY=test-olostep-secret
ARTIFACT_ZH_CN_ENABLED=false
WORKER_ENABLED=true
WORKER_QUEUE_SCOPE=full
RUNS_PER_PROMPT=5
DISABLE_TELEMETRY=1
RESEND_API_KEY=test-resend-secret
RESEND_FROM_EMAIL=Yonaris_Portal_noreply_at_example.com
EOF
}
write_valid_env
printf '%s\n' allow >"$STATE_MODE"
PORTAL_ENV_JSON='{"POSTGRES_USER":"postgres","POSTGRES_PASSWORD":"test-secret","POSTGRES_DB":"yonaris","DATABASE_URL":"postgresql://postgres:test-secret@postgres:5432/yonaris","DEPLOYMENT_ID":"11111111-1111-4111-8111-111111111111","APP_URL":"https://portal.yonaris.com","BETTER_AUTH_SECRET":"e2e-session-secret-with-at-least-thirty-two-characters","CREDENTIAL_ENCRYPTION_KEY":"BwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwc=","SCRAPE_TARGETS":"chatgpt:olostep:online","OLOSTEP_API_KEY":"test-olostep-secret","ARTIFACT_ZH_CN_ENABLED":"false","WORKER_ENABLED":"true","WORKER_QUEUE_SCOPE":"full","RUNS_PER_PROMPT":"5","DISABLE_TELEMETRY":"1","RESEND_API_KEY":"test-resend-secret","RESEND_FROM_EMAIL":"Yonaris_Portal_noreply_at_example.com"}'
printf '432\n' >"$RUNTIME_DIR/docker.pid"
printf 'socket-placeholder\n' >"$RUNTIME_DIR/docker.sock"
printf 'socket-placeholder\n' >"$PROC/432/fd/7"
printf 'Uid:\t2002\t2002\t2002\t2002\n' >"$PROC/432/status"
printf '432 (dockerd) S 1 1 1 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 12345\n' >"$PROC/432/stat"
write_dockerd_cmdline() {
	printf '%s\0' "$@" >"$PROC/432/cmdline"
}
write_dockerd_cmdline /usr/bin/dockerd --rootless "--host=unix://$RUNTIME_DIR/docker.sock"
printf 'Num RefCount Protocol Flags Type St Inode Path\n000: 2 0 00010000 0001 01 777 %s/docker.sock\n' "$RUNTIME_DIR" >"$PROC/net/unix"

write_valid_model() {
	cat >"$MODEL" <<EOF
{
  "name":"yonaris",
  "networks":{"backend":{"name":"yonaris_backend"}},
  "volumes":{"postgres_data":{"name":"yonaris_postgres_data"}},
  "services":{
    "postgres":{"image":"postgres@$POSTGRES","environment":{"POSTGRES_USER":"postgres","POSTGRES_PASSWORD":"test-secret","POSTGRES_DB":"yonaris","POSTGRES_INITDB_ARGS":"--data-checksums"},"healthcheck":{"test":["CMD-SHELL","pg_isready -U \$POSTGRES_USER -d \$POSTGRES_DB"],"interval":"5s","timeout":"5s","retries":12,"start_period":"20s"},"networks":{"backend":null},"restart":"unless-stopped","volumes":[{"type":"volume","source":"postgres_data","target":"/var/lib/postgresql/data"}],"cpus":1,"mem_limit":1073741824,"shm_size":268435456,"stop_grace_period":"60s","logging":{"driver":"json-file","options":{"max-file":"5","max-size":"20m"}}},
    "db-migrate":{"image":"ghcr.io/blackdcp/yonaris-db-migrate@$MIGRATE","environment":$PORTAL_ENV_JSON,"networks":{"backend":null},"profiles":["operations"],"restart":"no","depends_on":{"postgres":{"condition":"service_healthy"}},"cpus":1,"mem_limit":1073741824,"logging":{"driver":"json-file","options":{"max-file":"5","max-size":"20m"}}},
    "account-ops":{"image":"ghcr.io/blackdcp/yonaris-worker@$WORKER","environment":$PORTAL_ENV_JSON,"networks":{"backend":null},"profiles":["operations"],"restart":"no","depends_on":{"postgres":{"condition":"service_healthy"}},"volumes":[{"type":"bind","source":"$STATE/response-snapshots/v1","target":"$STATE/response-snapshots/v1"}],"cpus":0.5,"mem_limit":536870912,"logging":{"driver":"json-file","options":{"max-file":"5","max-size":"20m"}}},
    "web":{"image":"ghcr.io/blackdcp/yonaris-web@$WEB","environment":$PORTAL_ENV_JSON,"healthcheck":{"test":["CMD","curl","--fail","--silent","--show-error","--max-time","5","http://127.0.0.1:3000/"],"interval":"15s","timeout":"6s","retries":8,"start_period":"45s"},"networks":{"backend":null},"ports":[{"host_ip":"127.0.0.1","published":"1515","target":3000}],"restart":"unless-stopped","depends_on":{"postgres":{"condition":"service_healthy"}},"volumes":[{"type":"bind","source":"$STATE/response-snapshots/v1","target":"$STATE/response-snapshots/v1"}],"cpus":1,"mem_limit":1073741824,"stop_grace_period":"30s","logging":{"driver":"json-file","options":{"max-file":"5","max-size":"20m"}}},
    "worker":{"image":"ghcr.io/blackdcp/yonaris-worker@$WORKER","environment":$PORTAL_ENV_JSON,"networks":{"backend":null},"restart":"unless-stopped","depends_on":{"postgres":{"condition":"service_healthy"}},"volumes":[{"type":"bind","source":"$STATE/response-snapshots/v1","target":"$STATE/response-snapshots/v1"}],"cpus":1.5,"mem_limit":2147483648,"stop_grace_period":"90s","logging":{"driver":"json-file","options":{"max-file":"5","max-size":"20m"}}}
  }
}
EOF
}
write_valid_model

cat >"$MOCK_BIN/id" <<'EOF'
#!/usr/bin/env bash
case "$*" in
  '-u yonaris-runtime' | '-g yonaris-runtime') printf '2002\n' ;;
  '-u') printf '0\n' ;;
  *) exit 2 ;;
esac
EOF
cat >"$MOCK_BIN/runuser" <<'EOF'
#!/usr/bin/env bash
[[ "$1" == -u && "$2" == yonaris-runtime && "$3" == -- ]] || exit 2
shift 3
exec "$@"
EOF
cat >"$MOCK_BIN/docker" <<'EOF'
#!/usr/bin/env bash
set -Eeuo pipefail
printf '%s\n' "$*" >>'__DOCKER_LOG__'
printf 'docker %s\n' "$*" >>'__EVENT_LOG__'
rehearsal_failure="$(cat '__ROOT__/rehearsal-failure' 2>/dev/null || true)"
rehearsal_readiness="$(cat '__ROOT__/rehearsal-readiness' 2>/dev/null || true)"
resource_root='__ROOT__/docker-resources'
named_argument() {
	local previous='' argument
	for argument in "$@"; do
		if [[ "$previous" == --name ]]; then
			printf '%s' "$argument"
			return 0
		fi
		previous="$argument"
	done
	return 1
}
if [[ "$1" == info ]]; then
  [[ ! -e '__ROOT__/request-rebind' ]] || touch '__ROOT__/rebound'
  printf '["name=rootless"]\n'
  exit 0
fi
if [[ " $* " == *' compose '* && " $* " == *' config --format json '* ]]; then
  cat '__MODEL__'
  exit 0
fi
if [[ " $* " == *' compose '* && " $* " == *' ps -q postgres '* ]]; then printf 'postgres-id\n'; exit 0; fi
if [[ " $* " == *' compose '* && " $* " == *' ps -q web '* ]]; then printf 'web-id\n'; exit 0; fi
if [[ " $* " == *' compose '* && " $* " == *' ps -q worker '* ]]; then printf 'worker-id\n'; exit 0; fi
if [[ " $* " == *' compose '* && " $* " == *' exec -T postgres pg_dump '* ]]; then
	printf 'postgres-custom-dump\n'
	exit 0
fi
if [[ "$1" == inspect && "$*" == *'{{.State.Status}} {{.RestartCount}} {{.Config.Image}}'* ]]; then
	printf 'running 0 ghcr.io/blackdcp/yonaris-worker@__WORKER__\n'
	exit 0
fi
if [[ "$1" == inspect && "$*" == *'{{.Config.Image}}'* ]]; then
	case "${@: -1}" in
		postgres-id) printf 'postgres@__POSTGRES__\n' ;;
		web-id) printf 'ghcr.io/blackdcp/yonaris-web@__WEB__\n' ;;
		*) exit 96 ;;
	esac
	exit 0
fi
if [[ "$1" == inspect && "$*" == *'{{.State.Health.Status}}'* ]]; then printf 'healthy\n'; exit 0; fi
if [[ "$1" == image && "$2" == inspect ]]; then printf '%s\n' "${@: -1}"; exit 0; fi
if [[ " $* " == *' compose '* && ( " $* " == *' pull '* || " $* " == *' up '* || " $* " == *' run '* ) ]]; then exit 0; fi
if [[ "$1" == pull ]]; then
	exit 0
fi
if [[ "$1" == network && "$2" == create ]]; then
	[[ "$rehearsal_failure" != network-create ]] || exit 93
	touch "$resource_root/network-${@: -1}"
	exit 0
fi
if [[ "$1" == volume && "$2" == create ]]; then
	touch "$resource_root/volume-${@: -1}"
	exit 0
fi
if [[ "$1" == run ]]; then
	if [[ " $* " == *' ghcr.io/blackdcp/yonaris-db-migrate@'* ]]; then
		[[ "$rehearsal_failure" != migration ]] || exit 95
		exit 0
	fi
	container_name="$(named_argument "$@")"
	touch "$resource_root/container-$container_name"
	printf 'rehearsal-postgres-id\n'
	exit 0
fi
if [[ "$1" == create && " $* " == *' ghcr.io/blackdcp/yonaris-db-migrate@'* ]]; then
	container_name="$(named_argument "$@")"
	touch "$resource_root/container-$container_name"
	printf 'rehearsal-migration-id\n'
	exit 0
fi
if [[ "$1" == start && "$2" == --attach ]]; then
	[[ "$rehearsal_failure" != migration ]] || exit 95
	exit 0
fi
if [[ "$1" == wait ]]; then
	printf '0\n'
	exit 0
fi
if [[ "$1" == exec ]]; then
	if [[ " $* " == *' pg_restore '* ]]; then
		[[ "$rehearsal_failure" != restore ]] || exit 94
		exit 0
	fi
	if [[ " $* " == *' pg_isready '* ]]; then
		if [[ "$rehearsal_readiness" =~ ^[1-9][0-9]*$ ]]; then
			printf '%s\n' "$((rehearsal_readiness - 1))" >'__ROOT__/rehearsal-readiness'
			exit 91
		fi
		[[ "$rehearsal_readiness" != never ]] || exit 91
		printf 'accepting connections\n'
		exit 0
	fi
fi
if [[ "$1" == rm ]]; then
	resource="$resource_root/container-${@: -1}"
	[[ "$rehearsal_failure" != cleanup-all ]] || exit 98
	[[ "$rehearsal_failure" == cleanup-linger ]] || rm -f -- "$resource"
	exit 0
fi
if [[ "$1" == volume && "$2" == rm ]]; then
	resource="$resource_root/volume-${@: -1}"
	[[ "$rehearsal_failure" != cleanup-all ]] || exit 98
	rm -f -- "$resource"
	exit 0
fi
if [[ "$1" == network && "$2" == rm ]]; then
	resource="$resource_root/network-${@: -1}"
	[[ "$rehearsal_failure" != cleanup-all ]] || exit 98
	rm -f -- "$resource"
	exit 0
fi
if [[ ( "$1" == container || "$1" == volume || "$1" == network ) && "$2" == ls ]]; then
	filter="${@: -1}"
	name="${filter#name=^}"
	name="${name#/}"
	name="${name%\$}"
	if [[ -e "$resource_root/$1-$name" ]]; then
		printf '%s\n' "$name"
	fi
	exit 0
fi
exit 97
EOF
sed -i \
	-e "s#__ROOT__#$TEST_ROOT#g" \
	-e "s#__MODEL__#$MODEL#g" \
	-e "s#__DOCKER_LOG__#$DOCKER_LOG#g" \
	-e "s#__EVENT_LOG__#$EVENT_LOG#g" \
	-e "s#__WEB__#$WEB#g" \
	-e "s#__WORKER__#$WORKER#g" \
	-e "s#__POSTGRES__#$POSTGRES#g" \
	"$MOCK_BIN/docker"
cat >"$MOCK_BIN/curl" <<'EOF'
#!/usr/bin/env bash
exit 0
EOF
cat >"$MOCK_BIN/sleep" <<'EOF'
#!/usr/bin/env bash
exit 0
EOF
cat >"$STATE_MANAGER" <<'EOF'
#!/usr/bin/env bash
set -Eeuo pipefail
printf 'state %s\n' "$*" >>'__EVENT_LOG__'
mode="$(cat '__STATE_MODE__')"
[[ "$mode" != bad-token ]] || { printf 'bad token\n'; exit 0; }
case "$1" in
	migration-readiness)
		[[ "$mode" != deny-readiness ]] || exit 1
		printf '%s\n' 'las-migration-readiness-v2 ok'
		;;
	migration-readiness-runtime-authorization)
		[[ "$mode" != deny-migration-runtime ]] || exit 1
		printf '%s\n' 'las-migration-readiness-runtime-authorization-v2 ok'
		;;
	pending-runtime-tuple)
		[[ "$mode" != deny-pending && "$mode" != failed-deploy-rollback && "$mode" != deny-all-rollback ]] || exit 1
		printf '%s\n' 'las-pending-runtime-tuple-v1 ok'
		;;
	pending-rollback-runtime-tuple)
		[[ "$mode" != deny-rollback && "$mode" != requested-rollback && "$mode" != deny-all-rollback ]] || exit 1
		printf '%s\n' 'las-pending-rollback-runtime-tuple-v1 ok'
		;;
	bootstrap-runtime-authorization)
		[[ "$mode" != deny-bootstrap ]] || exit 1
		printf '%s\n' 'las-bootstrap-runtime-authorization-v1 ok'
		;;
	*) exit 92 ;;
esac
EOF
sed -i "s#__EVENT_LOG__#$EVENT_LOG#g; s#__STATE_MODE__#$STATE_MODE#g" "$STATE_MANAGER"
cat >"$MOCK_BIN/readlink" <<'EOF'
#!/usr/bin/env bash
path="${@: -1}"
case "$path" in
  */proc/432/exe) printf '/usr/bin/dockerd\n' ;;
  */proc/432/fd/7) printf 'socket:[777]\n' ;;
  *) exec "$REAL_READLINK" "$@" ;;
esac
EOF
cat >"$MOCK_BIN/stat" <<'EOF'
#!/usr/bin/env bash
set -Eeuo pipefail
format="${2:-}"; path="${@: -1}"
if [[ "$format" == '%h' ]]; then printf '1\n'; exit 0; fi
if [[ "$format" == '%d:%i' ]]; then
	if [[ -e "$RUNTIME_TEST_ROOT/rebound" || -e "$RUNTIME_TEST_ROOT/fake-socket" ]]; then printf '9:556\n'; else printf '9:555\n'; fi
  exit 0
fi
case "$path" in
  */var/lib/yonaris) metadata='0:0:711' ;;
  */migration-readiness-work-v2/sha-*/*) metadata='0:0:600' ;;
  */migration-readiness-work-v2 | */migration-readiness-work-v2/sha-*) metadata='0:0:700' ;;
  */las-release-trees | */las-release-trees/sha-*) metadata='0:0:555' ;;
  */compose.yaml) metadata='0:0:444' ;;
  */manage-las-release-state) metadata='0:0:755' ;;
  */var/lib/yonaris-runtime) metadata='0:2002:750' ;;
  */var/lib/yonaris-runtime/.docker | */var/lib/yonaris-runtime/.config | \
  */var/lib/yonaris-runtime/.config/docker | */run/user/2002) metadata='2002:2002:700' ;;
  */var/lib/yonaris-runtime/.config/docker/daemon.json) metadata='2002:2002:600' ;;
  */docker.sock | */docker.pid) metadata='2002:2002:600' ;;
  */etc/yonaris/las-runtime.env) metadata='0:2002:440' ;;
  */etc/yonaris/artifact-output-language-active-v1) metadata='0:0:400' ;;
  *) exec "$REAL_STAT" "$@" ;;
esac
if [[ "$format" == '%a' ]]; then printf '%s\n' "${metadata##*:}"; else printf '%s\n' "$metadata"; fi
EOF
cat >"$MOCK_BIN/tr" <<'EOF'
#!/usr/bin/env bash
exec "$REAL_TR" "$@"
EOF
cat >"$MOCK_BIN/awk" <<'EOF'
#!/usr/bin/env bash
if [[ "${@: -1}" == */proc/net/unix && ( -e "$RUNTIME_TEST_ROOT/rebound" || -e "$RUNTIME_TEST_ROOT/fake-socket" ) ]]; then
  printf '778\n'
  exit 0
fi
exec "$REAL_AWK" "$@"
EOF
cat >"$MOCK_BIN/python3" <<'EOF'
#!/usr/bin/env bash
exec "$REAL_PYTHON" "$@"
EOF
chmod +x "$MOCK_BIN"/* "$STATE_MANAGER"

sed \
	-e "s#/var/lib/yonaris-runtime#__RUNTIME_HOME__#g" \
	-e "s#/var/lib/yonaris#$STATE#g" \
	-e "s#__RUNTIME_HOME__#$RUNTIME_HOME#g" \
	-e "s#/run/user#$TEST_ROOT/run/user#g" \
	-e "s#/etc/yonaris/las-runtime.env#$ENV_FILE#g" \
	-e "s#/etc/yonaris/artifact-output-language-active-v1#$ACTIVATION_ATTESTATION#g" \
	-e "s#/proc#$PROC#g" \
	-e 's/^set +x$/[[ "${RUNTIME_TEST_TRACE:-no}" != yes ]] || set -x/' \
	-e 's/\[\[ -S "\$path" \]\]/[[ -e "$path" ]]/g' \
	-e "s#/usr/bin/id#$MOCK_BIN/id#g" \
	-e "s#/usr/sbin/runuser#$MOCK_BIN/runuser#g" \
	-e "s#/usr/bin/dockerd#__DOCKERD_EXE__#g" \
	-e "s#/usr/bin/docker#$MOCK_BIN/docker#g" \
	-e "s#__DOCKERD_EXE__#/usr/bin/dockerd#g" \
	-e "s#/usr/bin/readlink#$MOCK_BIN/readlink#g" \
	-e "s#/usr/bin/stat#$MOCK_BIN/stat#g" \
	-e "s#/usr/bin/tr#$MOCK_BIN/tr#g" \
	-e "s#/usr/bin/awk#$MOCK_BIN/awk#g" \
	-e "s#/usr/bin/python3#$MOCK_BIN/python3#g" \
	-e "s#/usr/bin/curl#$MOCK_BIN/curl#g" \
	-e "s#/usr/bin/sleep#$MOCK_BIN/sleep#g" \
	-e 's/^readonly MIGRATION_REHEARSAL_READY_ATTEMPTS=30$/readonly MIGRATION_REHEARSAL_READY_ATTEMPTS=3/' \
	-e "s#/usr/local/libexec/yonaris-las#$STABLE_DIRECTORY#g" \
	"$SOURCE" >"$MANAGER"
chmod +x "$MANAGER"

run_manager() {
	local -a shell_flags=(--noprofile --norc -p)
	local -a extra_env=()
	[[ "${RUNTIME_TEST_TRACE:-no}" != yes ]] || shell_flags=(--noprofile --norc -p -x)
	[[ -z "${RUNTIME_TEST_SUDO_USER:-}" ]] || extra_env+=("SUDO_USER=$RUNTIME_TEST_SUDO_USER")
	env PATH='/usr/bin:/bin' HOME='/nonexistent' \
		REAL_STAT="$REAL_STAT" REAL_READLINK="$REAL_READLINK" REAL_TR="$REAL_TR" REAL_AWK="$REAL_AWK" REAL_PYTHON="$REAL_PYTHON" \
		RUNTIME_TEST_ROOT="$TEST_ROOT" RUNTIME_TEST_MODEL="$MODEL" RUNTIME_TEST_REBIND_DURING_API="${RUNTIME_TEST_REBIND_DURING_API:-no}" \
		RUNTIME_TEST_DOCKER_LOG="$DOCKER_LOG" \
		RUNTIME_TEST_TRACE="${RUNTIME_TEST_TRACE:-no}" \
		"${extra_env[@]}" \
		/bin/bash "${shell_flags[@]}" "$MANAGER" "$@"
}

run_manager portal-preflight "$RELEASE" "$WEB" "$WORKER" "$MIGRATE" "$POSTGRES" portal-runtime-v2
run_manager verify-boundary

# The active runtime grammar is Portal-only and binds four digests. Retired
# marketing operations and a fifth digest fail before any stable state or
# mutable Docker operation can be reached.
for retired_request in fifth-digest marketing; do
	: >"$EVENT_LOG"
	: >"$DOCKER_LOG"
	set +e
	case "$retired_request" in
		fifth-digest)
			run_manager portal-preflight "$RELEASE" "$WEB" "$WORKER" "$MIGRATE" "$POSTGRES" \
				"$RETIRED_FIFTH_DIGEST" portal-runtime-v2 >/dev/null 2>&1
			;;
		marketing)
			run_manager marketing-deploy "$RELEASE" "$WEB" "$WORKER" "$MIGRATE" "$POSTGRES" \
				portal-runtime-v2 >/dev/null 2>&1
			;;
	esac
	retired_status=$?
	set -e
	[[ "$retired_status" -ne 0 ]] && ! grep -Eq '^state ' "$EVENT_LOG" || {
		echo "Retired runtime request reached state: $retired_request" >&2
		exit 1
	}
	! grep -Eq '^.* compose .* (pull|up|run)( |$)' "$DOCKER_LOG"
done

# Requested rollback uses the journal candidate tuple; failed-deploy recovery
# first rejects that tuple and then authorizes only the predecessor receipt.
for rollback_kind in requested-rollback failed-deploy-rollback denied-rollback; do
	: >"$EVENT_LOG"
	: >"$DOCKER_LOG"
	case "$rollback_kind" in
		requested-rollback) printf '%s\n' requested-rollback >"$STATE_MODE" ;;
		failed-deploy-rollback) printf '%s\n' failed-deploy-rollback >"$STATE_MODE" ;;
		denied-rollback) printf '%s\n' deny-all-rollback >"$STATE_MODE" ;;
	esac
	set +e
	run_manager portal-rollback "$RELEASE" "$WEB" "$WORKER" "$MIGRATE" "$POSTGRES" portal-runtime-v2 >/dev/null 2>&1
	rollback_status=$?
	set -e
	grep -Fqx "state pending-runtime-tuple portal $RELEASE $WEB $WORKER $MIGRATE $POSTGRES" "$EVENT_LOG"
	case "$rollback_kind" in
		requested-rollback)
			[[ "$rollback_status" -eq 0 ]]
			! grep -Fq 'state pending-rollback-runtime-tuple' "$EVENT_LOG"
			;;
		failed-deploy-rollback)
			[[ "$rollback_status" -eq 0 ]]
			grep -Fqx "state pending-rollback-runtime-tuple portal $RELEASE $WEB $WORKER $MIGRATE $POSTGRES" "$EVENT_LOG"
			;;
		denied-rollback)
			[[ "$rollback_status" -ne 0 ]]
			grep -Fqx "state pending-rollback-runtime-tuple portal $RELEASE $WEB $WORKER $MIGRATE $POSTGRES" "$EVENT_LOG"
			! grep -Eq '^.* compose .* (pull|up|run)( |$)' "$DOCKER_LOG"
			;;
	esac
done
printf '%s\n' allow >"$STATE_MODE"

[[ "${RUNTIME_TEST_PORTAL_AUTH_SLICE:-no}" != yes ]] || {
	printf '%s\n' 'portal-only runtime authorization tests passed'
	exit 0
}

# Backup and rehearsal are direct-root-only operations. A sudo-derived caller
# cannot reach state, Docker, or release work-directory side effects.
: >"$EVENT_LOG"
: >"$DOCKER_LOG"
set +e
RUNTIME_TEST_SUDO_USER=operator run_manager migration-backup "$RELEASE" "$WEB" "$WORKER" "$MIGRATE" "$POSTGRES" \
	"$WORK_ROOT/$RELEASE/sudo.dump" migration-readiness-runtime-v2 >/dev/null 2>&1
sudo_backup_status=$?
set -e
[[ "$sudo_backup_status" -ne 0 && ! -s "$EVENT_LOG" && ! -s "$DOCKER_LOG" && ! -e "$WORK_ROOT" ]] || {
	echo 'sudo-derived migration backup reached a side effect.' >&2
	exit 1
}
set +e
RUNTIME_TEST_SUDO_USER=operator run_manager migration-rehearse "$RELEASE" "$WEB" "$WORKER" "$MIGRATE" "$POSTGRES" \
	"$WORK_ROOT/$RELEASE/sudo.dump" "$WORK_ROOT/$RELEASE/sudo.result" migration-readiness-runtime-v2 >/dev/null 2>&1
sudo_rehearsal_status=$?
set -e
[[ "$sudo_rehearsal_status" -ne 0 && ! -s "$EVENT_LOG" && ! -s "$DOCKER_LOG" && ! -e "$WORK_ROOT" ]] || {
	echo 'sudo-derived migration rehearsal reached a side effect.' >&2
	exit 1
}

# A production dump can only be written to the release-scoped root-only work
# directory after the exact migration-readiness runtime authorization.
: >"$EVENT_LOG"
: >"$DOCKER_LOG"
run_manager migration-backup "$RELEASE" "$WEB" "$WORKER" "$MIGRATE" "$POSTGRES" \
	"$WORK_ROOT/$RELEASE/database.dump" migration-readiness-runtime-v2
grep -Fqx "state migration-readiness-runtime-authorization $RELEASE $WEB $WORKER $MIGRATE $POSTGRES" "$EVENT_LOG"
grep -Fq 'exec -T postgres pg_dump --username postgres --dbname yonaris --format custom --no-owner --no-acl' "$DOCKER_LOG"
[[ -s "$WORK_ROOT/$RELEASE/database.dump" ]] || { echo 'Migration backup was empty.' >&2; exit 1; }
if run_manager migration-backup "$RELEASE" "$WEB" "$WORKER" "$MIGRATE" "$POSTGRES" \
	"$TEST_ROOT/outside.dump" migration-readiness-runtime-v2; then
	echo 'Unsafe migration backup output was accepted.' >&2
	exit 1
fi

REHEARSAL_PREFIX="yonaris-migration-readiness-$RELEASE"
REHEARSAL_NETWORK="$REHEARSAL_PREFIX-network"
REHEARSAL_VOLUME="$REHEARSAL_PREFIX-volume"
REHEARSAL_CONTAINER="$REHEARSAL_PREFIX-postgres"
REHEARSAL_MIGRATION_CONTAINER="$REHEARSAL_PREFIX-migrate"
REHEARSAL_RESULT="$WORK_ROOT/$RELEASE/rehearsal.result"

assert_rehearsal_cleanup() {
	grep -Fq "rm -f $REHEARSAL_CONTAINER" "$DOCKER_LOG"
	[[ -z "$REHEARSAL_MIGRATION_CONTAINER" ]] || \
		grep -Fq "rm -f $REHEARSAL_MIGRATION_CONTAINER" "$DOCKER_LOG"
	grep -Fq "volume rm $REHEARSAL_VOLUME" "$DOCKER_LOG"
	grep -Fq "network rm $REHEARSAL_NETWORK" "$DOCKER_LOG"
}

assert_rehearsal_absence_verification() {
	grep -Fq "container ls --all --quiet --filter name=^/$REHEARSAL_CONTAINER\$" "$DOCKER_LOG"
	[[ -z "$REHEARSAL_MIGRATION_CONTAINER" ]] || \
		grep -Fq "container ls --all --quiet --filter name=^/$REHEARSAL_MIGRATION_CONTAINER\$" "$DOCKER_LOG"
	grep -Fq "volume ls --quiet --filter name=^$REHEARSAL_VOLUME\$" "$DOCKER_LOG"
	grep -Fq "network ls --quiet --filter name=^$REHEARSAL_NETWORK\$" "$DOCKER_LOG"
}

assert_rehearsal_docker_attestation() {
	local -a events=()
	local index expected="state migration-readiness-runtime-authorization $RELEASE $WEB $WORKER $MIGRATE $POSTGRES"
	mapfile -t events <"$EVENT_LOG"
	for ((index = 0; index < ${#events[@]}; index += 1)); do
		[[ "${events[$index]}" == docker\ * ]] || continue
		[[ "${events[$index]}" == 'docker info --format {{json .SecurityOptions}}' ]] && continue
		[[ "$index" -ge 1 && "${events[$((index - 1))]}" == "$expected" ]] || {
			echo "Docker rehearsal action lacked an adjacent authorization: ${events[$index]}" >&2
			exit 1
		}
	done
}

read_rehearsal_resources() {
	REHEARSAL_NETWORK="$(awk '$1 == "network" && $2 == "create" { print $NF; exit }' "$DOCKER_LOG")"
	REHEARSAL_VOLUME="$(awk '$1 == "volume" && $2 == "create" { print $NF; exit }' "$DOCKER_LOG")"
	REHEARSAL_CONTAINER="$(awk '$1 == "run" && $2 == "--detach" { for (i = 1; i < NF; i += 1) if ($i == "--name") { print $(i + 1); exit } }' "$DOCKER_LOG")"
	REHEARSAL_MIGRATION_CONTAINER="$(awk '$1 == "create" && $0 ~ /yonaris-db-migrate/ { for (i = 1; i < NF; i += 1) if ($i == "--name") { print $(i + 1); exit } }' "$DOCKER_LOG")"
	[[ "$REHEARSAL_NETWORK" =~ ^yonaris-migration-readiness-$RELEASE-[0-9a-f]{16}-network$ ]]
	[[ "$REHEARSAL_VOLUME" =~ ^yonaris-migration-readiness-$RELEASE-[0-9a-f]{16}-volume$ ]]
	[[ "$REHEARSAL_CONTAINER" =~ ^yonaris-migration-readiness-$RELEASE-[0-9a-f]{16}-postgres$ ]]
	[[ -z "$REHEARSAL_MIGRATION_CONTAINER" || \
		"$REHEARSAL_MIGRATION_CONTAINER" =~ ^yonaris-migration-readiness-$RELEASE-[0-9a-f]{16}-migrate$ ]]
}

# The isolated restore occurs before the exact migration image, has no published
# port, verifies PostgreSQL health, and records only fixed secret-free success.
: >"$EVENT_LOG"
: >"$DOCKER_LOG"
run_manager migration-rehearse "$RELEASE" "$WEB" "$WORKER" "$MIGRATE" "$POSTGRES" \
	"$WORK_ROOT/$RELEASE/database.dump" "$REHEARSAL_RESULT" migration-readiness-runtime-v2
read_rehearsal_resources
[[ -n "$REHEARSAL_MIGRATION_CONTAINER" ]] || { echo 'The migration rehearsal container is not tracked by name.' >&2; exit 1; }
grep -Fqx "state migration-readiness-runtime-authorization $RELEASE $WEB $WORKER $MIGRATE $POSTGRES" "$EVENT_LOG"
grep -Fq "pull postgres@$POSTGRES" "$DOCKER_LOG"
grep -Fq "pull ghcr.io/blackdcp/yonaris-db-migrate@$MIGRATE" "$DOCKER_LOG"
grep -Fq "network create --internal $REHEARSAL_NETWORK" "$DOCKER_LOG"
! grep -F -- '--publish' "$DOCKER_LOG"
restore_line="$(grep -n 'pg_restore' "$DOCKER_LOG" | head -n 1 | cut -d: -f1)"
migration_line="$(grep -n "ghcr.io/blackdcp/yonaris-db-migrate@$MIGRATE" "$DOCKER_LOG" | tail -n 1 | cut -d: -f1)"
[[ "$restore_line" =~ ^[1-9][0-9]*$ && "$migration_line" =~ ^[1-9][0-9]*$ && "$restore_line" -lt "$migration_line" ]] || {
	echo 'Migration ran before restore.' >&2
	exit 1
}
grep -Fq 'pg_isready --username yonaris_rehearsal --dbname yonaris_rehearsal' "$DOCKER_LOG"
grep -Fq "wait $REHEARSAL_MIGRATION_CONTAINER" "$DOCKER_LOG"
mapfile -t rehearsal_result_lines <"$REHEARSAL_RESULT"
[[ "${#rehearsal_result_lines[@]}" -eq 3 && \
	"${rehearsal_result_lines[0]%$'\r'}" == 'las-migration-rehearsal-runtime-v2 ok' && \
	"${rehearsal_result_lines[1]%$'\r'}" == 'migration-exit-status 0' && \
	"${rehearsal_result_lines[2]%$'\r'}" =~ ^completed-at-utc\ [0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z$ ]] || {
	echo 'Migration rehearsal result lacks the exact success status and UTC completion timestamp.' >&2
	exit 1
}
! grep -F 'test-secret' "$REHEARSAL_RESULT"
assert_rehearsal_cleanup
assert_rehearsal_absence_verification
assert_rehearsal_docker_attestation
[[ -z "$(find "$TEST_ROOT/docker-resources" -mindepth 1 -print -quit)" ]]
first_rehearsal_network="$REHEARSAL_NETWORK"

# A readiness delay is retried before restore; a bounded timeout fails closed.
printf '2\n' >"$TEST_ROOT/rehearsal-readiness"
: >"$EVENT_LOG"
: >"$DOCKER_LOG"
run_manager migration-rehearse "$RELEASE" "$WEB" "$WORKER" "$MIGRATE" "$POSTGRES" \
	"$WORK_ROOT/$RELEASE/database.dump" "$WORK_ROOT/$RELEASE/rehearsal-delayed.result" migration-readiness-runtime-v2
read_rehearsal_resources
[[ "$REHEARSAL_NETWORK" != "$first_rehearsal_network" ]] || { echo 'Rehearsal resources were not invocation-unique.' >&2; exit 1; }
[[ "$(grep -c 'pg_isready' "$DOCKER_LOG")" == 4 ]] || { echo 'Delayed readiness did not retry before and after migration.' >&2; exit 1; }
assert_rehearsal_docker_attestation
rm -f -- "$TEST_ROOT/rehearsal-readiness"

printf 'never\n' >"$TEST_ROOT/rehearsal-readiness"
: >"$EVENT_LOG"
: >"$DOCKER_LOG"
set +e
run_manager migration-rehearse "$RELEASE" "$WEB" "$WORKER" "$MIGRATE" "$POSTGRES" \
	"$WORK_ROOT/$RELEASE/database.dump" "$WORK_ROOT/$RELEASE/rehearsal-timeout.result" migration-readiness-runtime-v2 >/dev/null 2>&1
timeout_status=$?
set -e
read_rehearsal_resources
[[ "$timeout_status" -ne 0 && "$(grep -c 'pg_isready' "$DOCKER_LOG")" == 3 ]] || { echo 'Rehearsal readiness timeout was not bounded.' >&2; exit 1; }
assert_rehearsal_cleanup
assert_rehearsal_docker_attestation
rm -f -- "$TEST_ROOT/rehearsal-readiness"

# A failed network creation owns no resource and must not remove a stale one.
: >"$EVENT_LOG"
: >"$DOCKER_LOG"
printf 'network-create\n' >"$TEST_ROOT/rehearsal-failure"
set +e
run_manager migration-rehearse "$RELEASE" "$WEB" "$WORKER" "$MIGRATE" "$POSTGRES" \
	"$WORK_ROOT/$RELEASE/database.dump" "$WORK_ROOT/$RELEASE/rehearsal-network-failure.result" migration-readiness-runtime-v2 >/dev/null 2>&1
network_failure_status=$?
set -e
[[ "$network_failure_status" -ne 0 ]] || { echo 'Injected network-create failure passed.' >&2; exit 1; }
! grep -F 'network rm' "$DOCKER_LOG"
assert_rehearsal_docker_attestation
rm -f -- "$TEST_ROOT/rehearsal-failure"

# Cleanup is an EXIT-trap obligation, including restore and migration failure.
for rehearsal_failure in restore migration; do
	: >"$EVENT_LOG"
	: >"$DOCKER_LOG"
	printf '%s\n' "$rehearsal_failure" >"$TEST_ROOT/rehearsal-failure"
	set +e
	run_manager migration-rehearse "$RELEASE" "$WEB" "$WORKER" "$MIGRATE" "$POSTGRES" \
		"$WORK_ROOT/$RELEASE/database.dump" "$WORK_ROOT/$RELEASE/rehearsal-$rehearsal_failure.result" migration-readiness-runtime-v2 >/dev/null 2>&1
	failure_status=$?
	set -e
	read_rehearsal_resources
	[[ "$failure_status" -ne 0 ]] || { echo "Injected $rehearsal_failure failure passed." >&2; exit 1; }
	assert_rehearsal_cleanup
	assert_rehearsal_absence_verification
	assert_rehearsal_docker_attestation
	rm -f -- "$TEST_ROOT/rehearsal-failure"
done

# Cleanup is part of the success boundary. Every owned resource is attempted
# even when removals fail, and a resource that remains after a successful
# removal response is detected. Neither case may leave a rehearsal result.
for cleanup_failure in cleanup-all cleanup-linger; do
	: >"$EVENT_LOG"
	: >"$DOCKER_LOG"
	rm -f -- "$TEST_ROOT/docker-resources"/*
	printf '%s\n' "$cleanup_failure" >"$TEST_ROOT/rehearsal-failure"
	cleanup_result="$WORK_ROOT/$RELEASE/rehearsal-$cleanup_failure.result"
	set +e
	run_manager migration-rehearse "$RELEASE" "$WEB" "$WORKER" "$MIGRATE" "$POSTGRES" \
		"$WORK_ROOT/$RELEASE/database.dump" "$cleanup_result" migration-readiness-runtime-v2 >/dev/null 2>&1
	cleanup_status=$?
	set -e
	read_rehearsal_resources
	[[ "$cleanup_status" -ne 0 && ! -e "$cleanup_result" ]] || {
		echo "Cleanup failure escaped the rehearsal boundary: $cleanup_failure" >&2
		exit 1
	}
	assert_rehearsal_cleanup
	assert_rehearsal_absence_verification
	assert_rehearsal_docker_attestation
	rm -f -- "$TEST_ROOT/rehearsal-failure" "$TEST_ROOT/docker-resources"/*
done

[[ "${RUNTIME_TEST_NEW_OPERATION_SLICE:-no}" != yes ]] || {
	printf '%s\n' 'migration runtime new-operation tests passed'
	exit 0
}

assert_preactivation_rejected() {
	local name="$1"
	shift
	: >"$DOCKER_LOG"
	set +e
	run_manager "$@" >"$TEST_ROOT/$name.out" 2>"$TEST_ROOT/$name.err"
	local status=$?
	set -e
	[[ "$status" -ne 0 && ! -s "$DOCKER_LOG" ]] || {
		echo "Invalid runtime preactivation reached Docker: $name" >&2
		exit 1
	}
}

# Preactivation is a dedicated read-only boundary. It admits only the exact
# transition state: marker absent, Chinese artifacts enabled, and Worker
# enabled. It still authenticates the complete runtime dotenv and dockerd
# identity/configuration before its one read-only Docker info request.
write_valid_env
sed -i 's/^ARTIFACT_ZH_CN_ENABLED=.*/ARTIFACT_ZH_CN_ENABLED=true/' "$ENV_FILE"
rm -f -- "$ACTIVATION_ATTESTATION"
: >"$DOCKER_LOG"
run_manager verify-preactivation-boundary
[[ "$(cat "$DOCKER_LOG")" == 'info --format {{json .SecurityOptions}}' ]] || {
	echo 'Runtime preactivation did not perform exactly one read-only Docker boundary request.' >&2
	exit 1
}

for invalid_preactivation_request in near-spelling public-name extra-argument; do
	case "$invalid_preactivation_request" in
		near-spelling) command=(verify-preactivation-boundaryx) ;;
		public-name) command=(preactivate-output-language) ;;
		extra-argument) command=(verify-preactivation-boundary extra) ;;
	esac
	assert_preactivation_rejected "preactivation-request-$invalid_preactivation_request" "${command[@]}"
done

printf '%s\n' 'artifact-output-language-active-v1' >"$ACTIVATION_ATTESTATION"
assert_preactivation_rejected preactivation-marker-present verify-preactivation-boundary
rm -f -- "$ACTIVATION_ATTESTATION"
printf '%s\n' attacker >"$TEST_ROOT/activation-symlink-target"
ln -s "$TEST_ROOT/activation-symlink-target" "$ACTIVATION_ATTESTATION"
assert_preactivation_rejected preactivation-marker-symlink verify-preactivation-boundary
rm -f -- "$ACTIVATION_ATTESTATION" "$TEST_ROOT/activation-symlink-target"

for preactivation_flag_case in language-disabled worker-disabled; do
	write_valid_env
	case "$preactivation_flag_case" in
		language-disabled) ;;
		worker-disabled)
			sed -i 's/^ARTIFACT_ZH_CN_ENABLED=.*/ARTIFACT_ZH_CN_ENABLED=true/' "$ENV_FILE"
			sed -i 's/^WORKER_ENABLED=.*/WORKER_ENABLED=false/' "$ENV_FILE"
			;;
	esac
	assert_preactivation_rejected "preactivation-$preactivation_flag_case" verify-preactivation-boundary
done

write_valid_env
sed -i 's/^ARTIFACT_ZH_CN_ENABLED=.*/ARTIFACT_ZH_CN_ENABLED=true/' "$ENV_FILE"
printf '%s\n' 'UNLISTED_COMPOSE_ENV=attacker' >>"$ENV_FILE"
assert_preactivation_rejected preactivation-compose-env verify-preactivation-boundary
sed -i '/^UNLISTED_COMPOSE_ENV=/d' "$ENV_FILE"
write_dockerd_cmdline /usr/bin/dockerd --rootless "--host=unix://$RUNTIME_DIR/docker.sock" --host=tcp://127.0.0.1:2375
assert_preactivation_rejected preactivation-dockerd-identity verify-preactivation-boundary
write_dockerd_cmdline /usr/bin/dockerd --rootless "--host=unix://$RUNTIME_DIR/docker.sock"
mkdir -p "$DAEMON_CONFIG_DIRECTORY"
printf '%s\n' "{\"hosts\":[\"unix://$RUNTIME_DIR/docker.sock\"]}" >"$DAEMON_CONFIG"
assert_preactivation_rejected preactivation-daemon-config verify-preactivation-boundary
rm -rf -- "$RUNTIME_HOME/.config"
write_valid_env

assert_runtime_boundary_rejected() {
	local name="$1"
	set +e
	run_manager verify-boundary >"$TEST_ROOT/$name.out" 2>"$TEST_ROOT/$name.err"
	local status=$?
	set -e
	[[ "$status" -ne 0 ]] || {
		echo "Runtime boundary accepted invalid dockerd launch: $name" >&2
		exit 1
	}
}

# /proc/<pid>/cmdline is a NUL-delimited argv contract. One exact rootless flag
# and one exact Unix host are required; a matching substring or an additional
# listener/config source must never satisfy the daemon identity check.
for launch_case in missing-host argv0-rootless option-terminator extra-tcp extra-fd extra-unix mixed-host-forms alternate-config split-alternate-config rootless-false; do
	case "$launch_case" in
		missing-host)
			write_dockerd_cmdline /usr/bin/dockerd --rootless "--log-opt=tag=unix://$RUNTIME_DIR/docker.sock"
			;;
		argv0-rootless)
			write_dockerd_cmdline --rootless "--host=unix://$RUNTIME_DIR/docker.sock"
			;;
		option-terminator)
			write_dockerd_cmdline /usr/bin/dockerd -- --rootless "--host=unix://$RUNTIME_DIR/docker.sock"
			;;
		extra-tcp)
			write_dockerd_cmdline /usr/bin/dockerd --rootless "--host=unix://$RUNTIME_DIR/docker.sock" --host=tcp://127.0.0.1:2375
			;;
		extra-fd)
			write_dockerd_cmdline /usr/bin/dockerd --rootless "--host=unix://$RUNTIME_DIR/docker.sock" -H fd://
			;;
		extra-unix)
			write_dockerd_cmdline /usr/bin/dockerd --rootless -H "unix://$RUNTIME_DIR/docker.sock" -H=unix:///tmp/second.sock
			;;
		mixed-host-forms)
			write_dockerd_cmdline /usr/bin/dockerd --rootless --host "unix://$RUNTIME_DIR/docker.sock" -Htcp://127.0.0.1:2375
			;;
		alternate-config)
			write_dockerd_cmdline /usr/bin/dockerd --rootless "--host=unix://$RUNTIME_DIR/docker.sock" --config-file=/tmp/attacker-daemon.json
			;;
		split-alternate-config)
			write_dockerd_cmdline /usr/bin/dockerd --rootless "--host=unix://$RUNTIME_DIR/docker.sock" --config-file /tmp/attacker-daemon.json
			;;
		rootless-false)
			write_dockerd_cmdline /usr/bin/dockerd --rootless=false "--host=unix://$RUNTIME_DIR/docker.sock"
			;;
	esac
	assert_runtime_boundary_rejected "$launch_case"
done
write_dockerd_cmdline /usr/bin/dockerd --rootless "--host=unix://$RUNTIME_DIR/docker.sock"

mkdir -p "$DAEMON_CONFIG_DIRECTORY"
printf '%s\n' '{"log-driver":"local"}' >"$DAEMON_CONFIG"
run_manager verify-boundary
printf '%s\n' "{\"hosts\":[\"unix://$RUNTIME_DIR/docker.sock\",\"tcp://127.0.0.1:2375\"]}" >"$DAEMON_CONFIG"
assert_runtime_boundary_rejected daemon-config-hosts
rm -rf -- "$RUNTIME_HOME/.config"

# Production dotenv semantics fail before even a read-only Docker API call.
cp "$ENV_FILE" "$TEST_ROOT/runtime.env.valid"
for invalid_env in missing-required placeholder uuid credential-key artifact-bool worker-bool \
	queue-scope runs database-user database-password database-name database-host \
	database-port database-scheme provider-missing provider-placeholder provider-unknown target-empty marketing-key; do
	cp "$TEST_ROOT/runtime.env.valid" "$ENV_FILE"
	case "$invalid_env" in
		missing-required) sed -i '/^APP_URL=/d' "$ENV_FILE" ;;
		placeholder) sed -i 's/^BETTER_AUTH_SECRET=.*/BETTER_AUTH_SECRET=replace_with_secret/' "$ENV_FILE" ;;
		uuid) sed -i 's/^DEPLOYMENT_ID=.*/DEPLOYMENT_ID=not-a-uuid/' "$ENV_FILE" ;;
		credential-key) sed -i 's#^CREDENTIAL_ENCRYPTION_KEY=.*#CREDENTIAL_ENCRYPTION_KEY=YWJj#' "$ENV_FILE" ;;
		artifact-bool) sed -i 's/^ARTIFACT_ZH_CN_ENABLED=.*/ARTIFACT_ZH_CN_ENABLED=TRUE/' "$ENV_FILE" ;;
		worker-bool) sed -i 's/^WORKER_ENABLED=.*/WORKER_ENABLED=1/' "$ENV_FILE" ;;
		queue-scope) sed -i 's/^WORKER_QUEUE_SCOPE=.*/WORKER_QUEUE_SCOPE=all/' "$ENV_FILE" ;;
		runs) sed -i 's/^RUNS_PER_PROMPT=.*/RUNS_PER_PROMPT=0/' "$ENV_FILE" ;;
		database-user) sed -i 's#^DATABASE_URL=.*#DATABASE_URL=postgresql://attacker:test-secret@postgres:5432/yonaris#' "$ENV_FILE" ;;
		database-password) sed -i 's#^DATABASE_URL=.*#DATABASE_URL=postgresql://postgres:attacker@postgres:5432/yonaris#' "$ENV_FILE" ;;
		database-name) sed -i 's#/yonaris$#/attacker#' "$ENV_FILE" ;;
		database-host) sed -i 's/@postgres:5432/@localhost:5432/' "$ENV_FILE" ;;
		database-port) sed -i 's/@postgres:5432/@postgres:5433/' "$ENV_FILE" ;;
		database-scheme) sed -i 's#^DATABASE_URL=postgresql:#DATABASE_URL=mysql:#' "$ENV_FILE" ;;
		provider-missing) sed -i '/^OLOSTEP_API_KEY=/d' "$ENV_FILE" ;;
		provider-placeholder) sed -i 's/^OLOSTEP_API_KEY=.*/OLOSTEP_API_KEY=replace_with_key/' "$ENV_FILE" ;;
		provider-unknown) sed -i 's/^SCRAPE_TARGETS=.*/SCRAPE_TARGETS=chatgpt:unknown:online/' "$ENV_FILE" ;;
		target-empty) sed -i 's/^SCRAPE_TARGETS=.*/SCRAPE_TARGETS=chatgpt:olostep:online,/' "$ENV_FILE" ;;
		marketing-key) printf '%s\n' 'MARKETING_LEAD_RECIPIENT=retired@example.com' >>"$ENV_FILE" ;;
	esac
	rm -f -- "$DOCKER_LOG"
	set +e
	invalid_output="$(run_manager verify-boundary 2>&1)"
	invalid_status=$?
	set -e
	[[ "$invalid_status" -ne 0 && ! -s "$DOCKER_LOG" ]] || {
		echo "Invalid runtime dotenv reached Docker: $invalid_env" >&2
		exit 1
	}
	[[ "$invalid_output" != *test-secret* && "$invalid_output" != *test-olostep-secret* ]] || {
		echo "Runtime dotenv validation exposed a secret: $invalid_env" >&2
		exit 1
	}
done
cp "$TEST_ROOT/runtime.env.valid" "$ENV_FILE"

assert_no_docker_mutation() {
	if grep -Eq '^.* compose .* (pull|up|run)( |$)' "$DOCKER_LOG" 2>/dev/null; then
		echo 'A denied stable authorization reached a Docker mutation.' >&2
		exit 1
	fi
}

assert_exact_state_call() {
	local expected="$1"
	grep -Fqx "state $expected" "$EVENT_LOG" || {
		echo "Missing exact stable state authorization call: $expected" >&2
		exit 1
	}
}

# Every generic or bootstrap mutation request must reach the matching stable
# state interface and remain mutation-free when that evidence is unavailable.
write_valid_model
for gate_case in readiness pending rollback bootstrap sudo-bootstrap; do
	printf '%s\n' allow >"$STATE_MODE"
	: >"$EVENT_LOG"
	: >"$DOCKER_LOG"
	case "$gate_case" in
		readiness)
			printf '%s\n' deny-readiness >"$STATE_MODE"
			command=(portal-deploy "$RELEASE" "$WEB" "$WORKER" "$MIGRATE" "$POSTGRES" portal-runtime-v2)
			expected="migration-readiness $RELEASE $WEB $WORKER $MIGRATE $POSTGRES"
			;;
		pending)
			printf '%s\n' deny-pending >"$STATE_MODE"
			command=(portal-deploy "$RELEASE" "$WEB" "$WORKER" "$MIGRATE" "$POSTGRES" portal-runtime-v2)
			expected="pending-runtime-tuple portal $RELEASE $WEB $WORKER $MIGRATE $POSTGRES"
			;;
		rollback)
			printf '%s\n' deny-all-rollback >"$STATE_MODE"
			command=(portal-rollback "$RELEASE" "$WEB" "$WORKER" "$MIGRATE" "$POSTGRES" portal-runtime-v2)
			expected="pending-runtime-tuple portal $RELEASE $WEB $WORKER $MIGRATE $POSTGRES"
			;;
		bootstrap)
			printf '%s\n' deny-bootstrap >"$STATE_MODE"
			command=(bootstrap-portal-deploy "$RELEASE" "$WEB" "$WORKER" "$MIGRATE" "$POSTGRES" portal-bootstrap-runtime-v2)
			expected="bootstrap-runtime-authorization portal $RELEASE $WEB $WORKER $MIGRATE $POSTGRES"
			;;
		sudo-bootstrap)
			command=(bootstrap-portal-deploy "$RELEASE" "$WEB" "$WORKER" "$MIGRATE" "$POSTGRES" portal-bootstrap-runtime-v2)
			expected=''
			;;
	esac
	set +e
	if [[ "$gate_case" == sudo-bootstrap ]]; then
		RUNTIME_TEST_SUDO_USER=operator run_manager "${command[@]}" >/dev/null 2>&1
	else
		run_manager "${command[@]}" >/dev/null 2>&1
	fi
	gate_status=$?
	set -e
	[[ "$gate_status" -ne 0 ]] || { echo "Denied runtime gate passed: $gate_case" >&2; exit 1; }
	[[ -z "$expected" ]] || assert_exact_state_call "$expected"
	if [[ "$gate_case" == rollback ]]; then
		assert_exact_state_call "pending-rollback-runtime-tuple portal $RELEASE $WEB $WORKER $MIGRATE $POSTGRES"
	fi
	if [[ -z "$expected" && -s "$EVENT_LOG" ]]; then
		echo 'sudo-derived bootstrap reached a stable state helper.' >&2
		exit 1
	fi
	assert_no_docker_mutation
	write_valid_model
done

assert_mutation_sequence() {
	local gate_kind="$1" expected_count="$2" readiness_required="$3"
	local -a events=()
	mapfile -t events <"$EVENT_LOG"
	local index mutation_count=0 expected_gate expected_readiness readiness_offset
	expected_readiness="state migration-readiness $RELEASE $WEB $WORKER $MIGRATE $POSTGRES"
	case "$gate_kind" in
		portal | requested-rollback) expected_gate="state pending-runtime-tuple portal $RELEASE $WEB $WORKER $MIGRATE $POSTGRES" ;;
		failed-deploy-rollback) expected_gate="state pending-rollback-runtime-tuple portal $RELEASE $WEB $WORKER $MIGRATE $POSTGRES" ;;
		bootstrap) expected_gate="state bootstrap-runtime-authorization portal $RELEASE $WEB $WORKER $MIGRATE $POSTGRES" ;;
	esac
	for ((index = 0; index < ${#events[@]}; index += 1)); do
		if [[ "${events[$index]}" =~ ^docker\ compose\ .*\ (pull|up|run)(\ |$) ]]; then
			((mutation_count += 1))
			[[ "$index" -ge 1 && "${events[$((index - 1))]}" == "$expected_gate" ]] || {
				echo "Docker mutation lacked its adjacent $gate_kind state gate." >&2
				exit 1
			}
			if [[ "$readiness_required" == yes ]]; then
				readiness_offset=2
				[[ "$gate_kind" != failed-deploy-rollback ]] || readiness_offset=3
				[[ "$index" -ge "$readiness_offset" && "${events[$((index - readiness_offset))]}" == "$expected_readiness" ]] || {
					echo "Docker mutation lacked its adjacent migration readiness gate." >&2
					exit 1
				}
			fi
		fi
	done
	[[ "$mutation_count" == "$expected_count" ]] || {
		echo "Unexpected Docker mutation count for $gate_kind: $mutation_count" >&2
		exit 1
	}
}

printf '%s\n' allow >"$STATE_MODE"
: >"$EVENT_LOG"
run_manager portal-deploy "$RELEASE" "$WEB" "$WORKER" "$MIGRATE" "$POSTGRES" portal-runtime-v2
assert_mutation_sequence portal 4 yes

: >"$EVENT_LOG"
printf '%s\n' requested-rollback >"$STATE_MODE"
run_manager portal-rollback "$RELEASE" "$WEB" "$WORKER" "$MIGRATE" "$POSTGRES" portal-runtime-v2
assert_mutation_sequence requested-rollback 2 yes

# A failed deploy is authorized only by the predecessor receipt path after the
# requested-candidate path rejects the tuple.
: >"$EVENT_LOG"
printf '%s\n' failed-deploy-rollback >"$STATE_MODE"
run_manager portal-rollback "$RELEASE" "$WEB" "$WORKER" "$MIGRATE" "$POSTGRES" portal-runtime-v2
grep -Fqx "state pending-runtime-tuple portal $RELEASE $WEB $WORKER $MIGRATE $POSTGRES" "$EVENT_LOG"
assert_mutation_sequence failed-deploy-rollback 2 yes

: >"$EVENT_LOG"
printf '%s\n' allow >"$STATE_MODE"
run_manager bootstrap-portal-deploy "$RELEASE" "$WEB" "$WORKER" "$MIGRATE" "$POSTGRES" portal-bootstrap-runtime-v2
assert_mutation_sequence bootstrap 4 yes
write_valid_model

# The irreversible marker requires both language writes and the Worker.
printf '%s\n' 'artifact-output-language-active-v1' >"$ACTIVATION_ATTESTATION"
for marker_case in language-disabled worker-disabled; do
	cp "$TEST_ROOT/runtime.env.valid" "$ENV_FILE"
	case "$marker_case" in
		language-disabled) ;;
		worker-disabled)
			sed -i 's/^ARTIFACT_ZH_CN_ENABLED=.*/ARTIFACT_ZH_CN_ENABLED=true/' "$ENV_FILE"
			sed -i 's/^WORKER_ENABLED=.*/WORKER_ENABLED=false/' "$ENV_FILE"
			;;
	esac
	rm -f -- "$DOCKER_LOG"
	set +e
	run_manager verify-boundary >/dev/null 2>&1
	marker_status=$?
	set -e
	[[ "$marker_status" -ne 0 && ! -s "$DOCKER_LOG" ]] || {
		echo "Invalid irreversible-marker env reached Docker: $marker_case" >&2
		exit 1
	}
done
cp "$TEST_ROOT/runtime.env.valid" "$ENV_FILE"
sed -i 's/^ARTIFACT_ZH_CN_ENABLED=.*/ARTIFACT_ZH_CN_ENABLED=true/' "$ENV_FILE"
run_manager verify-boundary
rm -f -- "$ACTIVATION_ATTESTATION"
cp "$TEST_ROOT/runtime.env.valid" "$ENV_FILE"

# Anchors/interpolation are already resolved at this boundary; an extra service,
# a dangerous key, a socket bind, or a tag in the rendered model all fail closed.
for attack in service privileged socket tag named-socket missing-port disabled-health external-network \
	project-name network-options bind-options port-options environment-extra environment-missing environment-value; do
	write_valid_model
	case "$attack" in
	  service) "$REAL_PYTHON" -c 'import json,sys;p=sys.argv[1];d=json.load(open(p));d["services"]["evil"]={"image":"evil:latest"};json.dump(d,open(p,"w"))' "$MODEL" ;;
	  privileged) "$REAL_PYTHON" -c 'import json,sys;p=sys.argv[1];d=json.load(open(p));d["services"]["web"]["privileged"]=True;json.dump(d,open(p,"w"))' "$MODEL" ;;
	  socket) "$REAL_PYTHON" -c 'import json,sys;p=sys.argv[1];d=json.load(open(p));d["services"]["web"]["volumes"]=[{"type":"bind","source":"/run/user/2002/docker.sock","target":"/run/docker.sock"}];json.dump(d,open(p,"w"))' "$MODEL" ;;
	  tag) "$REAL_PYTHON" -c 'import json,sys;p=sys.argv[1];d=json.load(open(p));d["services"]["postgres"]["image"]="postgres:16-alpine";json.dump(d,open(p,"w"))' "$MODEL" ;;
	  named-socket) "$REAL_PYTHON" -c 'import json,sys;p=sys.argv[1];d=json.load(open(p));d["volumes"]["postgres_data"]["driver_opts"]={"type":"none","o":"bind","device":"/run/user/2002"};d["services"]["postgres"]["volumes"]=[];d["services"]["web"]["volumes"]=[{"type":"volume","source":"postgres_data","target":"/sockdir"}];json.dump(d,open(p,"w"))' "$MODEL" ;;
	  missing-port) "$REAL_PYTHON" -c 'import json,sys;p=sys.argv[1];d=json.load(open(p));d["services"]["web"]["ports"]=[];json.dump(d,open(p,"w"))' "$MODEL" ;;
	  disabled-health) "$REAL_PYTHON" -c 'import json,sys;p=sys.argv[1];d=json.load(open(p));d["services"]["web"]["healthcheck"]={"disable":True};json.dump(d,open(p,"w"))' "$MODEL" ;;
	  external-network) "$REAL_PYTHON" -c 'import json,sys;p=sys.argv[1];d=json.load(open(p));d["networks"]["backend"]["external"]=True;json.dump(d,open(p,"w"))' "$MODEL" ;;
	  project-name) "$REAL_PYTHON" -c 'import json,sys;p=sys.argv[1];d=json.load(open(p));d["name"]="evil";json.dump(d,open(p,"w"))' "$MODEL" ;;
	  network-options) "$REAL_PYTHON" -c 'import json,sys;p=sys.argv[1];d=json.load(open(p));d["services"]["web"]["networks"]["backend"]={"aliases":["evil"]};json.dump(d,open(p,"w"))' "$MODEL" ;;
	  bind-options) "$REAL_PYTHON" -c 'import json,sys;p=sys.argv[1];d=json.load(open(p));d["services"]["web"]["volumes"][0]["bind"]={"propagation":"rshared"};json.dump(d,open(p,"w"))' "$MODEL" ;;
	  port-options) "$REAL_PYTHON" -c 'import json,sys;p=sys.argv[1];d=json.load(open(p));d["services"]["web"]["ports"][0]["app_protocol"]="evil";json.dump(d,open(p,"w"))' "$MODEL" ;;
	  environment-extra) "$REAL_PYTHON" -c 'import json,sys;p=sys.argv[1];d=json.load(open(p));d["services"]["web"]["environment"]["BASH_ENV"]="/tmp/evil";json.dump(d,open(p,"w"))' "$MODEL" ;;
	  environment-missing) "$REAL_PYTHON" -c 'import json,sys;p=sys.argv[1];d=json.load(open(p));del d["services"]["web"]["environment"]["POSTGRES_DB"];json.dump(d,open(p,"w"))' "$MODEL" ;;
	  environment-value) "$REAL_PYTHON" -c 'import json,sys;p=sys.argv[1];d=json.load(open(p));d["services"]["web"]["environment"]["POSTGRES_DB"]="attacker";json.dump(d,open(p,"w"))' "$MODEL" ;;
	esac
	set +e
	run_manager portal-preflight "$RELEASE" "$WEB" "$WORKER" "$MIGRATE" "$POSTGRES" portal-runtime-v2 >/dev/null 2>&1
	status=$?
	set -e
	[[ "$status" -ne 0 ]] || { echo "Rendered Compose $attack attack passed" >&2; exit 1; }
done

# Runtime dotenv is parsed as strict data before the Docker API is contacted.
write_valid_model
payload_marker="$TEST_ROOT/dotenv-payload-executed"
printf 'touch %q\n' "$payload_marker" >"$TEST_ROOT/bash-env-payload"
for payload in bash-env command-substitution exported-function; do
	cp "$TEST_ROOT/runtime.env.valid" "$ENV_FILE"
	case "$payload" in
		bash-env) printf 'BASH_ENV=%s\n' "$TEST_ROOT/bash-env-payload" >>"$ENV_FILE" ;;
		command-substitution) printf 'APP_NAME=$(touch %s)\n' "$payload_marker" >>"$ENV_FILE" ;;
		exported-function) printf 'BASH_FUNC_attack%%%%=() { touch %s; }\n' "$payload_marker" >>"$ENV_FILE" ;;
	esac
	set +e
	run_manager verify-boundary >/dev/null 2>&1
	status=$?
	set -e
	[[ "$status" -ne 0 && ! -e "$payload_marker" ]] || { echo "Runtime dotenv $payload payload passed or executed" >&2; exit 1; }
done
cp "$TEST_ROOT/runtime.env.valid" "$ENV_FILE"

# A fake API rebound at the same pathname is not the dockerd listener inode.
write_valid_model
touch "$TEST_ROOT/fake-socket"
set +e
run_manager portal-preflight "$RELEASE" "$WEB" "$WORKER" "$MIGRATE" "$POSTGRES" portal-runtime-v2 >/dev/null 2>&1
fake_status=$?
set -e
rm -f "$TEST_ROOT/fake-socket"
[[ "$fake_status" -ne 0 ]]

# Rebinding between the pre/post identity snapshots also fails.
touch "$TEST_ROOT/request-rebind"
set +e
run_manager portal-preflight "$RELEASE" "$WEB" "$WORKER" "$MIGRATE" "$POSTGRES" portal-runtime-v2 >/dev/null 2>&1
race_status=$?
set -e
rm -f "$TEST_ROOT/request-rebind" "$TEST_ROOT/rebound"
[[ "$race_status" -ne 0 ]]

# Candidate execution is deliberately outside the runtime TCB and receives no
# Docker socket/config variables from the root dispatcher.
candidate_block="$(sed -n '/run_release_script()/,/^}/p' "$DISPATCHER")"
[[ "$candidate_block" != *DOCKER_HOST* && "$candidate_block" != *XDG_RUNTIME_DIR* && "$candidate_block" != *DOCKER_CONFIG* ]]

printf '%s\n' 'isolated runtime identity, rendered Compose, fake API, and candidate-denial tests passed'
