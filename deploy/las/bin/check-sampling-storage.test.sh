#!/usr/bin/env bash

set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT_UNDER_TEST="$SCRIPT_DIR/check-sampling-storage.sh"
TEST_ROOT="$(mktemp -d)"
trap 'rm -rf -- "$TEST_ROOT"' EXIT

MOCK_BIN="$TEST_ROOT/bin"
DEPLOY_ROOT="$TEST_ROOT/deploy"
BACKUP_DIR="$DEPLOY_ROOT/backups"
COMPOSE_FILE="$TEST_ROOT/compose.yaml"
ENV_FILE="$DEPLOY_ROOT/.env"
DOCKER_LOG="$TEST_ROOT/docker.log"

mkdir -p "$MOCK_BIN" "$BACKUP_DIR"
printf '{}\n' >"$COMPOSE_FILE"
printf 'POSTGRES_USER=yonaris\nPOSTGRES_DB=yonaris\n' >"$ENV_FILE"

cat >"$MOCK_BIN/du" <<'EOF'
#!/usr/bin/env bash
set -Eeuo pipefail
case "$MOCK_HOST_DU_MODE" in
	failure)
		printf '9999\t%s\n' "${*: -1}"
		echo "du: cannot read directory: Permission denied" >&2
		exit 1
		;;
	multiline) printf '%s\t%s\n42\t/extra\n' "$MOCK_HOST_DU_KIB" "${*: -1}" ;;
	wrong-path) printf '%s\t/not-the-requested-path\n' "$MOCK_HOST_DU_KIB" ;;
	success) printf '%s\t%s\n' "$MOCK_HOST_DU_KIB" "${*: -1}" ;;
	*) exit 94 ;;
esac
EOF

cat >"$MOCK_BIN/df" <<'EOF'
#!/usr/bin/env bash
set -Eeuo pipefail
printf 'Filesystem 1024-blocks Used Available Capacity Mounted on\n'
printf '/dev/mock 100000 20000 80000 20%% /mock\n'
EOF

cat >"$MOCK_BIN/docker" <<'EOF'
#!/usr/bin/env bash
set -Eeuo pipefail

case "$1" in
	compose)
		printf 'compose\n' >>"$MOCK_DOCKER_LOG"
		joined=" $* "
		if [[ "$joined" == *" ps -q postgres "* ]]; then
			printf '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef\n'
		elif [[ "$joined" == *" pg_database_size"* ]]; then
			printf '1000\t0\tready\n'
		elif [[ "$joined" == *"FROM public.evidence_artifacts"* ]]; then
			printf '0\t0\t0\t0\t0\t0\t0\t0\t0\t0\n'
		elif [[ "$joined" == *" exec -T postgres df -Pk /var/lib/postgresql/data "* ]]; then
			printf 'Filesystem 1024-blocks Used Available Capacity Mounted on\n'
			printf '/dev/mock 100000 30000 70000 30%% /var/lib/postgresql/data\n'
		else
			echo "Unexpected docker compose invocation" >&2
			exit 90
		fi
		;;
	inspect)
		printf 'inspect' >>"$MOCK_DOCKER_LOG"
		printf ' <%s>' "$@" >>"$MOCK_DOCKER_LOG"
		printf '\n' >>"$MOCK_DOCKER_LOG"
		printf 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\n'
		;;
	run)
		printf 'run' >>"$MOCK_DOCKER_LOG"
		printf ' <%s>' "$@" >>"$MOCK_DOCKER_LOG"
		printf '\n' >>"$MOCK_DOCKER_LOG"
		case "$MOCK_FALLBACK_DU_MODE" in
			failure)
				printf '777\t/backups\n'
				exit 92
				;;
			multiline)
				printf '%s\t/backups\n43\t/backups/extra\n' "$MOCK_FALLBACK_DU_KIB"
				;;
			wrong-path) printf '%s\t/not-backups\n' "$MOCK_FALLBACK_DU_KIB" ;;
			success) printf '%s\t/backups\n' "$MOCK_FALLBACK_DU_KIB" ;;
			*) exit 93 ;;
		esac
		;;
	*)
		echo "Unexpected docker invocation: $*" >&2
		exit 91
		;;
esac
EOF

chmod +x "$MOCK_BIN/du" "$MOCK_BIN/df" "$MOCK_BIN/docker"

run_preflight() {
	local host_du_mode="$1"
	local max_backup_bytes="$2"
	local fallback_du_mode="${3:-success}"
	env \
		PATH="$MOCK_BIN:$PATH" \
		DEPLOY_ROOT="$DEPLOY_ROOT" \
		BACKUP_DIR="$BACKUP_DIR" \
		COMPOSE_FILE="$COMPOSE_FILE" \
		ENV_FILE="$ENV_FILE" \
		MOCK_DOCKER_LOG="$DOCKER_LOG" \
		MOCK_HOST_DU_MODE="$host_du_mode" \
		MOCK_HOST_DU_KIB=41 \
		MOCK_FALLBACK_DU_MODE="$fallback_du_mode" \
		MOCK_FALLBACK_DU_KIB=42 \
		SAMPLING_STORAGE_MAX_BACKUP_BYTES="$max_backup_bytes" \
		bash "$SCRIPT_UNDER_TEST"
}

assert_output_line() {
	local output="$1"
	local expected="$2"
	if ! grep -Fqx -- "$expected" <<<"$output"; then
		echo "Missing output line: $expected" >&2
		exit 1
	fi
}

: >"$DOCKER_LOG"
host_output="$(run_preflight success 0)"
assert_output_line "$host_output" 'backups.total.bytes=41984'
assert_output_line "$host_output" 'status=OK'
if grep -q '^run' "$DOCKER_LOG"; then
	echo "Container fallback ran even though host du succeeded." >&2
	exit 1
fi

for invalid_host_mode in multiline wrong-path; do
	: >"$DOCKER_LOG"
	invalid_host_output="$(run_preflight "$invalid_host_mode" 0)"
	assert_output_line "$invalid_host_output" 'backups.total.bytes=43008'
	if ! grep -q '^run' "$DOCKER_LOG"; then
		echo "Invalid $invalid_host_mode host du output did not trigger the fallback." >&2
		exit 1
	fi
done

: >"$DOCKER_LOG"
fallback_output="$(run_preflight failure 0)"
assert_output_line "$fallback_output" 'backups.total.bytes=43008'
assert_output_line "$fallback_output" 'status=OK'

fallback_run="$(grep '^run' "$DOCKER_LOG")"
for required_argument in \
	'<--pull> <never>' \
	'<--network> <none>' \
	'<--read-only>' \
	'<--cap-drop> <ALL>' \
	'<--cap-add> <DAC_READ_SEARCH>' \
	'<--security-opt> <no-new-privileges>' \
	'<--user> <0:0>' \
	"<--mount> <type=bind,source=$BACKUP_DIR,target=/backups,readonly>" \
	'<--entrypoint> <du>' \
	'<sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa>' \
	'<-sk> <--> </backups>'; do
	if [[ "$fallback_run" != *"$required_argument"* ]]; then
		echo "Fallback is missing required Docker arguments: $required_argument" >&2
		exit 1
	fi
done

: >"$DOCKER_LOG"
set +e
run_preflight failure 43007 >"$TEST_ROOT/alert.out" 2>"$TEST_ROOT/alert.err"
alert_status=$?
set -e
if [[ "$alert_status" -ne 2 ]]; then
	echo "Expected backup threshold breach to exit 2; got $alert_status" >&2
	exit 1
fi
grep -Fq 'backups.total.bytes is 43008; configured maximum is 43007' "$TEST_ROOT/alert.err"

: >"$DOCKER_LOG"
set +e
run_preflight failure 0 failure >"$TEST_ROOT/failure.out" 2>"$TEST_ROOT/failure.err"
failure_status=$?
set -e
if [[ "$failure_status" -ne 1 ]]; then
	echo "Expected incomplete fallback du to exit 1; got $failure_status" >&2
	exit 1
fi
if grep -Fq 'backups.total.bytes=' "$TEST_ROOT/failure.out"; then
	echo "Incomplete fallback du output was accepted." >&2
	exit 1
fi
grep -Fq 'PostgreSQL image fallback could not read the complete backup tree.' "$TEST_ROOT/failure.err"

for invalid_mode in multiline wrong-path; do
	: >"$DOCKER_LOG"
	set +e
	run_preflight failure 0 "$invalid_mode" >"$TEST_ROOT/$invalid_mode.out" 2>"$TEST_ROOT/$invalid_mode.err"
	invalid_status=$?
	set -e
	if [[ "$invalid_status" -ne 1 ]]; then
		echo "Expected $invalid_mode fallback output to exit 1; got $invalid_status" >&2
		exit 1
	fi
	if grep -Fq 'backups.total.bytes=' "$TEST_ROOT/$invalid_mode.out"; then
		echo "$invalid_mode fallback output was accepted." >&2
		exit 1
	fi
	grep -Fq 'PostgreSQL image fallback returned an invalid backup size result.' "$TEST_ROOT/$invalid_mode.err"
done

for invalid_backup_dir in \
	/ \
	relative/path \
	"$TEST_ROOT/backup,comma" \
	"$TEST_ROOT/"$'backup\nnewline' \
	"$TEST_ROOT/"$'backup\rreturn'; do
	set +e
	env \
		PATH="$MOCK_BIN:$PATH" \
		DEPLOY_ROOT="$DEPLOY_ROOT" \
		BACKUP_DIR="$invalid_backup_dir" \
		COMPOSE_FILE="$COMPOSE_FILE" \
		ENV_FILE="$ENV_FILE" \
		bash "$SCRIPT_UNDER_TEST" >"$TEST_ROOT/path.out" 2>"$TEST_ROOT/path.err"
	path_status=$?
	set -e
	if [[ "$path_status" -ne 1 ]]; then
		echo "Expected unsafe BACKUP_DIR to exit 1: $invalid_backup_dir" >&2
		exit 1
	fi
	grep -Fq 'BACKUP_DIR must be a non-root absolute path without CR, LF, or commas.' "$TEST_ROOT/path.err"
done

echo "check-sampling-storage mock tests passed"
