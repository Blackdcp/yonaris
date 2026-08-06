# Yonaris on Qiniu LAS

This deployment layer coexists with the services already running on the LAS
instance. It does not modify the existing `api.cheng-zi-ai.com` route, the
default `127.0.0.1:4173` route, the running One API container, or the stopped
`new-api-prod` container.

## Production layout

- `yonaris.com` redirects to `https://portal.yonaris.com` until the marketing
  site is deployed.
- `portal.yonaris.com` is proxied by the existing host Nginx to
  `127.0.0.1:1515`.
- PostgreSQL is available only on the private `yonaris_backend` Docker network.
- GitHub Actions builds immutable Web, Worker, and migration images in GHCR.
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

The zone currently uses Cloudflare nameservers. Start both new records in
**DNS only** mode while issuing the origin certificate and validating the app.
Cloudflare proxying can be enabled later after Nginx is configured to restore
the real client IP from trusted Cloudflare ranges.

## 3. Preserve the existing proxy and applications

Nginx is the production reverse proxy. Caddy is also enabled but fails because
Nginx already owns port 80. Before disabling Caddy, preserve its configuration:

```bash
sudo install -d -m 700 /root/yonaris-preflight
sudo cp -a /etc/caddy/Caddyfile /root/yonaris-preflight/Caddyfile
sudo systemctl disable --now caddy
```

This does not change the existing Nginx routes. Do not remove the stopped
`new-api-prod` container or the default Nginx route to port 4173.

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

Log in to GHCR once on the server with a read-only classic token that has the
`read:packages` scope:

```bash
echo '<GHCR_READ_TOKEN>' | sudo -H -u yonaris-deploy \
  docker login ghcr.io -u Blackdcp --password-stdin
```

Do not put model-provider credentials in GitHub. They stay only in
`/opt/yonaris/.env` on the LAS host.

## 5. Nginx and HTTPS

Install the new site alongside the current ones:

```bash
sudo cp /opt/yonaris/source/deploy/las/nginx/portal.yonaris.com.conf \
  /etc/nginx/sites-available/portal.yonaris.com
sudo ln -s /etc/nginx/sites-available/portal.yonaris.com \
  /etc/nginx/sites-enabled/portal.yonaris.com
sudo nginx -t
sudo systemctl reload nginx
```

After DNS resolves to the LAS host, use Certbot's Nginx integration to issue
and renew the certificate:

```bash
sudo certbot --nginx -d yonaris.com -d portal.yonaris.com
```

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

## Future marketing site

The current `web` image is the authenticated product portal, not the marketing
site in `apps/www`. When the website is ready, give it a separate loopback port
(for example `127.0.0.1:1516`) and replace only the `yonaris.com` redirect with
an Nginx proxy. `portal.yonaris.com`, its database, and its deployment URL can
remain unchanged.

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
