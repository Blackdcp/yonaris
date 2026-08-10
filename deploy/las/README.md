# Yonaris on Qiniu LAS

This deployment layer coexists with the services already running on the LAS
instance. It does not modify the existing `api.cheng-zi-ai.com` route, the
default `127.0.0.1:4173` route, the running One API container, or the stopped
`new-api-prod` container.

## Production layout

- `yonaris.com` is proxied by the existing host Caddy to the marketing site on
  `127.0.0.1:1516`.
- `portal.yonaris.com` is proxied by the existing host Caddy to
  `127.0.0.1:1515`.
- PostgreSQL is available only on the private `yonaris_backend` Docker network.
- GitHub Actions builds immutable Web, Worker, migration, and marketing images
  in GHCR. Portal and marketing deployments use separate workflows and release
  markers.
- The LAS host checks out the exact Git commit before running its deployment
  script, so Compose and deployment-script changes travel with the release.

## 1. GitHub repository

Create an empty private repository at `https://github.com/Blackdcp/yonaris`.
Use it as `origin`; keep `https://github.com/elmohq/elmo.git` as `upstream`.

The deployment workflow is intentionally gated by the repository variable
`LAS_DEPLOY_ENABLED`. The first push builds images but does not contact the
server. Set the variable to `true` only after the remaining bootstrap steps are
complete.

## 2. DNS

Create these A records with the LAS fixed IPv4 address `149.71.241.139`:

- `@` for `yonaris.com`
- `portal` for `portal.yonaris.com`

Do not change the existing `api.cheng-zi-ai.com` record.

The zone uses Cloudflare nameservers and both Yonaris records are proxied. Caddy
serves the Cloudflare Origin certificate stored under
`/etc/caddy/certs/yonaris/`.

## 3. Preserve the existing proxy and applications

Caddy is the production reverse proxy and owns ports 80 and 443. Nginx is
installed but inactive. Preserve the live Caddy configuration before any
manual proxy work:

```bash
sudo install -d -m 700 /root/yonaris-preflight
sudo cp -a /etc/caddy/Caddyfile /root/yonaris-preflight/Caddyfile
```

Do not replace the full Caddyfile: it also owns `cheng-zi-ai.com`,
`api.cheng-zi-ai.com`, and `jiacanmou.uk`. The marketing installer only accepts
the reviewed Yonaris redirect block and replaces that exact block atomically.
Do not remove the stopped `new-api-prod` container or the route to port 4173.

## 4. Bootstrap the deployment account and checkout

Create a dedicated account. Membership in the Docker group is privileged, but
keeps the GitHub workflow out of the root SSH account and avoids broad
passwordless sudo rules:

```bash
sudo adduser --disabled-password --gecos '' yonaris-deploy
sudo usermod -aG docker yonaris-deploy
sudo install -d -o yonaris-deploy -g yonaris-deploy -m 750 /opt/yonaris
sudo install -d -o yonaris-deploy -g yonaris-deploy -m 700 \
  /opt/yonaris/backups /opt/yonaris/import
sudo install -d -o yonaris-deploy -g yonaris-deploy -m 700 \
  /home/yonaris-deploy/.ssh
```

There are two separate SSH trust directions:

1. Add the GitHub Actions deployment public key to
   `/home/yonaris-deploy/.ssh/authorized_keys`; store only its private key in
   the `LAS_SSH_PRIVATE_KEY` repository secret.
2. Generate a different key as `yonaris-deploy`, add its public key to the
   private `Blackdcp/yonaris` repository as a read-only deploy key.

```bash
sudo -H -u yonaris-deploy ssh-keygen -t ed25519 \
  -f /home/yonaris-deploy/.ssh/id_ed25519 -N ''
sudo cat /home/yonaris-deploy/.ssh/id_ed25519.pub
```

Verify GitHub's published SSH host fingerprint before adding `github.com` to
`/home/yonaris-deploy/.ssh/known_hosts`. After the deploy key and host key are
in place, clone and create the production environment file:

```bash
sudo -H -u yonaris-deploy git clone git@github.com:Blackdcp/yonaris.git \
  /opt/yonaris/source
sudo -H -u yonaris-deploy cp \
  /opt/yonaris/source/deploy/las/env.example /opt/yonaris/.env
sudo -H -u yonaris-deploy chmod 600 /opt/yonaris/.env
```

Edit `/opt/yonaris/.env`. Generate production values with:

```bash
openssl rand -hex 24
openssl rand -base64 48
openssl rand -base64 32
uuidgen
```

The database password must be copied into both `POSTGRES_PASSWORD` and the
password component of `DATABASE_URL`. For the initial data migration, do not
generate a new `ELMO_ENCRYPTION_KEY`: copy the exact key from the current local
environment so encrypted provider credentials remain readable.

The example keeps the current memory-tensor target,
`chatgpt:brightdata:online`. Copy the existing `BRIGHTDATA_API_TOKEN`,
`DEEPSEEK_API_KEY`, and `AGNES_API_KEY` from the local environment. The deploy
script rejects missing required values and every `replace_with_...` placeholder.
After PostgreSQL is initialized, changing `POSTGRES_PASSWORD` in the file alone
does not rotate the database user's password.

`WORKER_ENABLED=true` runs scheduled evaluations. Set it to `false` for a
static showcase environment: Web remains available and queued jobs are kept,
but no model or scraper requests are processed. Change it back to `true` and
deploy again when recurring collection should resume.

Set `WORKER_QUEUE_SCOPE=analysis-only` together with `WORKER_ENABLED=true` to
run onboarding brand analysis without consuming queued prompt evaluations or
scheduling new ones. The default `full` scope processes every production queue.

`DEFAULT_DELAY_HOURS` controls the cadence for newly scheduled prompts, while
`RUNS_PER_PROMPT` controls the independent samples taken for each prompt/model
pair per cycle. Existing scheduled jobs must be rescheduled when their cadence
changes; changing the environment file alone does not rewrite queued job data.

Log in to GHCR once on the server with a read-only classic token that has the
`read:packages` scope:

```bash
echo '<GHCR_READ_TOKEN>' | sudo -H -u yonaris-deploy \
  docker login ghcr.io -u Blackdcp --password-stdin
```

Do not put model-provider credentials in GitHub. They stay only in
`/opt/yonaris/.env` on the LAS host.

## 5. Caddy and HTTPS

The live Caddyfile uses the Cloudflare Origin certificate for both Yonaris
hosts. The portal route remains:

```caddyfile
portal.yonaris.com {
	tls /etc/caddy/certs/yonaris/yonaris-origin.pem /etc/caddy/certs/yonaris/yonaris-origin.key
	reverse_proxy 127.0.0.1:1515
}
```

The marketing workflow starts and health-checks the isolated `www` Compose
project before `install-marketing-caddy.sh` replaces only the apex redirect
block. The installer validates a candidate Caddyfile, atomically installs it,
performs a graceful reload through the Caddy admin API, and checks both apex
and portal directly against the origin. Any failure restores and reloads the
previous configuration before the marketing container is rolled back.

Port 1516 is intentionally fixed in both the isolated Compose file and the
reviewed Caddy fragment so their upstreams cannot drift.

## 6. Initial memory-tensor data import

Export the current local PostgreSQL 16 database without writing a binary dump
through PowerShell's output redirection:

```powershell
docker exec elmo-dev-postgres pg_dump -U postgres -d elmo -Fc -f /tmp/yonaris.dump
docker cp elmo-dev-postgres:/tmp/yonaris.dump .\yonaris.dump
$hash = (Get-FileHash -Algorithm SHA256 .\yonaris.dump).Hash.ToLowerInvariant()
"$hash  yonaris.dump" | Set-Content -Encoding ascii .\yonaris.dump.sha256
```

Transfer `yonaris.dump` and its SHA-256 file to `/opt/yonaris/import/` on the
LAS host, then run `sha256sum -c yonaris.dump.sha256` there. Before any
customers use production, start the empty database and restore it:

```bash
cd /opt/yonaris/source
sudo -H -u yonaris-deploy docker compose --project-name yonaris \
  --env-file /opt/yonaris/.env \
  --file deploy/las/compose.yaml up -d postgres

sudo -H -u yonaris-deploy docker compose --project-name yonaris \
  --env-file /opt/yonaris/.env \
  --file deploy/las/compose.yaml exec -T postgres \
  pg_restore -U yonaris -d yonaris --clean --if-exists --no-owner --no-acl \
  </opt/yonaris/import/yonaris.dump
```

The restore command replaces matching objects in the new Yonaris database. It
must not be used after production begins receiving writes.

For a guarded first import, the checked-in helper refuses any database whose
public schema is non-empty and compares every table count in the export
manifest:

```bash
sudo -H -u yonaris-deploy env DEPLOY_ROOT=/opt/yonaris \
  COMPOSE_FILE=/opt/yonaris/source/deploy/las/compose.yaml \
  ENV_FILE=/opt/yonaris/.env \
  bash /opt/yonaris/source/deploy/las/bin/restore-initial.sh \
  /opt/yonaris/import/yonaris.dump \
  /opt/yonaris/import/yonaris.manifest.txt
```

To repeat only the row-count verification after the initial restore, append
`--verify-only` to the command.

## 7. GitHub deployment settings

Add these repository secrets:

- `LAS_HOST`: the LAS fixed IPv4 address
- `LAS_USER`: `yonaris-deploy`
- `LAS_SSH_PRIVATE_KEY`: its private deployment key
- `LAS_SSH_KNOWN_HOSTS`: the verified host-key line for the LAS server

The deployment account owns `/opt/yonaris` and can use Docker; it does not need
sudo. Once the server is ready, set repository variable
`LAS_DEPLOY_ENABLED=true`, then manually run the workflow once. Future merges
to `main` deploy automatically.

## 8. Daily backups

Install the included systemd timer after the first successful deployment:

```bash
sudo cp /opt/yonaris/source/deploy/las/systemd/yonaris-backup.service \
  /etc/systemd/system/yonaris-backup.service
sudo cp /opt/yonaris/source/deploy/las/systemd/yonaris-backup.timer \
  /etc/systemd/system/yonaris-backup.timer
sudo systemctl daemon-reload
sudo systemctl enable --now yonaris-backup.timer
sudo systemctl list-timers yonaris-backup.timer
```

The timer writes custom-format dumps and checksums to
`/opt/yonaris/backups`, retaining 30 days. These backups share the LAS system
disk, so they protect against application and migration mistakes but not loss
of the server or disk. Add encrypted off-host object-storage replication before
the portal contains irreplaceable customer data.

## Marketing site

The `www` image serves `apps/www` on `127.0.0.1:1516` in the independent
`yonaris-marketing` Compose project. Its deployment script and `.marketing-release`
marker are separate from the portal release. `portal.yonaris.com`, its
database, containers, and deployment URL remain unchanged.

Caddy forwards only `/`, the homepage's static assets, its OG image, and the
single-page `robots.txt`/`sitemap.xml` endpoints. Legacy documentation, status,
and product-marketing routes in `apps/www` are not exposed on the production
domain. Portal and marketing workflows share both an ordered Actions queue and
a host-side source lock, so fetch/checkout/deploy operations cannot race.

## Operations

Create a database backup:

```bash
sudo -H -u yonaris-deploy env DEPLOY_ROOT=/opt/yonaris \
  COMPOSE_FILE=/opt/yonaris/source/deploy/las/compose.yaml \
  ENV_FILE=/opt/yonaris/.env \
  bash /opt/yonaris/source/deploy/las/bin/backup.sh
```

Roll Web and Worker back to an earlier immutable image tag:

```bash
sudo -H -u yonaris-deploy env DEPLOY_ROOT=/opt/yonaris \
  COMPOSE_FILE=/opt/yonaris/source/deploy/las/compose.yaml \
  ENV_FILE=/opt/yonaris/.env \
  bash /opt/yonaris/source/deploy/las/bin/deploy.sh sha-<full-40-character-commit>
```

An application rollback does not reverse a database migration. Every deploy
creates a database backup first; schema-destructive releases require a planned
database restore.

This deployment never runs global Docker prune commands because the LAS host is
shared with other applications.
