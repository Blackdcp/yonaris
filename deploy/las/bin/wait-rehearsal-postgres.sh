#!/usr/bin/env bash

set -Eeuo pipefail
set +x

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 yonaris-upgrade-rehearsal-db-<run-id>" >&2
  exit 2
fi

container_name="$1"
if [[ ! "$container_name" =~ ^yonaris-upgrade-rehearsal-db-[0-9TZ-]+$ ]]; then
  echo "Refusing an invalid rehearsal database container name." >&2
  exit 2
fi

attempts="${REHEARSAL_POSTGRES_READY_ATTEMPTS:-60}"
interval_seconds="${REHEARSAL_POSTGRES_READY_INTERVAL_SECONDS:-1}"
if [[ ! "$attempts" =~ ^[1-9][0-9]{0,2}$ ]] || ((attempts > 300)); then
  echo "REHEARSAL_POSTGRES_READY_ATTEMPTS must be between 1 and 300." >&2
  exit 2
fi
if [[ ! "$interval_seconds" =~ ^[0-9]$ ]]; then
  echo "REHEARSAL_POSTGRES_READY_INTERVAL_SECONDS must be between 0 and 9." >&2
  exit 2
fi

for required_command in docker sleep tr; do
  if ! command -v "$required_command" >/dev/null 2>&1; then
    echo "Missing required command: $required_command" >&2
    exit 1
  fi
done

initialization_marker='PostgreSQL init process complete; ready for start up.'

for ((attempt = 1; attempt <= attempts; attempt++)); do
  container_logs=""
  if container_logs="$(docker logs "$container_name" 2>&1)" &&
    [[ "$container_logs" == *"$initialization_marker"* ]]; then
    database_name=""
    if database_name="$(
      docker exec "$container_name" psql \
        --username yonaris_rehearsal \
        --dbname yonaris_rehearsal \
        --no-psqlrc \
        --quiet \
        --tuples-only \
        --no-align \
        --set ON_ERROR_STOP=1 \
        --command 'select current_database();' 2>/dev/null |
        tr -d '[:space:]'
    )" && [[ "$database_name" == yonaris_rehearsal ]]; then
      echo "Isolated PostgreSQL initialization completed."
      exit 0
    fi
  fi

  if ((attempt < attempts)); then
    sleep "$interval_seconds"
  fi
done

docker logs --tail 100 "$container_name" >&2 || true
echo "Isolated PostgreSQL did not finish initialization with the rehearsal database available." >&2
exit 1
