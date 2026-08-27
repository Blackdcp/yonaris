# Yonaris on Qiniu LAS

This deployment layer coexists with the services already running on the LAS
instance. It does not modify the existing `api.cheng-zi-ai.com` route, the
default `127.0.0.1:4173` route, the running One API container, or the stopped
`new-api-prod` container.

> **Production status: NOT READY.** The stable bundle contains the reviewed
> root-only migration-readiness producer, but production remains blocked until
> its mandatory root-owned off-host adapter is installed, a direct-root
> rehearsal succeeds for the exact release tuple, and the complete bootstrap is
> reverified. Do not hand-create or hash evidence. Keep
> `LAS_DEPLOY_ENABLED=false` and `LAS_FORCED_COMMAND_ENABLED=false` until then.

## Production layout

- `yonaris.com` is proxied by the existing host Caddy to the marketing site on
  `127.0.0.1:1516`.
- `portal.yonaris.com` is proxied by the existing host Caddy to
  `127.0.0.1:1515`.
- PostgreSQL is available only on the private `yonaris_backend` Docker network
  and is pinned to a separately reviewed PostgreSQL 16 registry digest.
- GitHub Actions builds immutable Web, Worker, migration, and marketing images
  in GHCR. The root policy binds those four digests plus PostgreSQL as one exact
  five-digest tuple for every release SHA.
- The LAS host materializes the authorized Git object into a root-owned,
  immutable release tree. Only root-owned stable managers may consume Compose
  files from that tree; the dispatcher no longer runs candidate deployment
  scripts, and a mutable checkout is not a production input.

## 1. GitHub repository

Create an empty private repository at `https://github.com/Blackdcp/yonaris`.
Use it as `origin`; no external source remote is required.

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
`api.cheng-zi-ai.com`, and `jiacanmou.uk`. The stable Caddy manager only accepts
the reviewed Yonaris redirect block and replaces that exact block atomically.
Do not remove the stopped `new-api-prod` container or the route to port 4173.

## 4. Bootstrap accounts and canonical host state

Create three distinct locked accounts. `yonaris-gate` is only the forced SSH
principal, `yonaris-deploy` owns only explicitly scoped non-runtime mutable
data and is never an execution fallback for release scripts, and
`yonaris-runtime` is the deliberately small TCB that owns the isolated
rootless daemon. None may be a member of the `docker` group or use
`/var/run/docker.sock`; rootful Docker access is host-root access and defeats
the forced-command boundary. The verifier scans the complete NSS passwd
database so each of these UIDs and the `caddy` UID belongs to exactly its named
account; it also requires the runtime numeric GID to have one canonical group.

Create the accounts with the exact home and shell contracts checked by the
root verifier. These commands are for a fresh host; if an account already
exists, reconcile it offline and re-run the verifier instead of creating a
second identity:

```bash
sudo adduser --disabled-password --gecos '' \
  --home /home/yonaris-deploy --shell /usr/sbin/nologin yonaris-deploy
sudo adduser --disabled-password --gecos '' \
  --home /home/yonaris-gate --shell /bin/bash yonaris-gate
sudo adduser --disabled-password --gecos '' \
  --home /var/lib/yonaris-runtime --shell /usr/sbin/nologin yonaris-runtime
sudo passwd -l yonaris-deploy
sudo passwd -l yonaris-gate
sudo passwd -l yonaris-runtime
sudo gpasswd -d yonaris-deploy docker || true
sudo gpasswd -d yonaris-gate docker || true
sudo gpasswd -d yonaris-runtime docker || true
sudo loginctl enable-linger yonaris-runtime
```

Do not create a deploy-user Git key or production checkout. The repository is
private, while the dispatcher deliberately has no credential and performs no
network fetch of any kind. Before authorizing a SHA, a root operator must
import that exact commit into
`/var/lib/yonaris/las-objects.git` from either an offline reviewed Git bundle
or a root-only, read-only GitHub credential used from an authenticated root
console. Verify the resulting object ID, remove the transfer material, remove
every repository remote/include/partial-clone setting, and only then install
the policy that names it. The canonical store must have no alternate object
database, promisor pack, legacy remote/branch file, or missing reachable
object. Every stable root reader also sets `GIT_NO_LAZY_FETCH=1`, disables
credential helpers/prompts, and denies every Git transport. No Git credential may be readable by
`yonaris-gate`, `yonaris-deploy`, `yonaris-runtime`, or a container.

The complete account, directory, bare-store, fixed-launcher, runtime-env,
initial predecessor receipt/marker, sudoers, and rootless-daemon sequence is in
[ARTIFACT-OUTPUT-LANGUAGE-RUNBOOK.md](ARTIFACT-OUTPUT-LANGUAGE-RUNBOOK.md).
Follow it before enabling either workflow variable. In particular,
`/run/lock/yonaris` and the Caddy-owned `/run/caddy` runtime directory must be
recreated by the exact root-owned tmpfiles rule after every boot; a one-time
`mkdir` is insufficient. The legacy backup service/timer must be inactive and
masked, and any installed legacy Caddy entrypoint must be absent or the
byte-exact fail-closed stub accepted by the verifier.

Create the production configuration as
`/etc/yonaris/las-runtime.env`, a regular single-link file owned
`root:yonaris-runtime` with mode `0440`. Start from the reviewed `env.example`
outside any mutable checkout. The stable runtime manager parses it as strict
UTF-8 data, never shell code: unknown/duplicate keys, NUL, expansions,
malformed quoting, unsafe unquoted values, placeholders, invalid UUID/base64,
provider mismatch, or a `DATABASE_URL` that does not exactly agree with the
PostgreSQL fields all fail before Docker access. Generate production values
with:

```bash
openssl rand -hex 24
openssl rand -base64 48
openssl rand -base64 32
uuidgen
```

Keep `ARTIFACT_ZH_CN_ENABLED=false` for the first output-language-compatible
release. Chinese artifact writes require the separate, irreversible two-phase
procedure in [ARTIFACT-OUTPUT-LANGUAGE-RUNBOOK.md](ARTIFACT-OUTPUT-LANGUAGE-RUNBOOK.md).
The flag accepts only the exact lowercase values `true` or `false`. Once the
root activation marker exists, both `ARTIFACT_ZH_CN_ENABLED=true` and
`WORKER_ENABLED=true` are mandatory; the inverse mismatch also fails closed.
Keep `RESPONSE_SNAPSHOT_ENABLED=false`: its former candidate-side activation
operation is permanently outside the production protocol.

The database password must be copied into both `POSTGRES_PASSWORD` and the
password component of `DATABASE_URL`. For the initial data migration, do not
generate a new `CREDENTIAL_ENCRYPTION_KEY`: copy the exact key from the current local
environment so encrypted provider credentials remain readable.

The example keeps the current memory-tensor target,
`chatgpt:brightdata:online`. Copy the existing `BRIGHTDATA_API_TOKEN`,
`DEEPSEEK_API_KEY`, and `AGNES_API_KEY` from the local environment. The
administrator Overseas Run now control is independent of `SCRAPE_TARGETS` and,
when a Bright Data token is configured, defaults to all six Bright Data
channels. Set `BRIGHTDATA_SERP_ZONE` to the exact name of an active,
account-owned Bright Data SERP zone: deployment rejects a missing value, the UI
keeps Google AI Overview disabled when it is absent outside deployment, and
Yonaris validates the account metadata before it creates the paid cohort. The
stable runtime preflight rejects missing required values and every
`replace_with_...` placeholder.
After PostgreSQL is initialized, changing `POSTGRES_PASSWORD` in the file alone
does not rotate the database user's password.

`WORKER_ENABLED=true` runs scheduled evaluations. Set it to `false` for a
static showcase environment: Web remains available and queued jobs are kept,
but no model or scraper requests are processed. Change it back to `true` and
deploy again when recurring collection should resume. This showcase mode is
not permitted after the one-way output-language activation marker exists.

Set `WORKER_QUEUE_SCOPE=analysis-only` together with `WORKER_ENABLED=true` to
run onboarding brand analysis without consuming queued prompt evaluations or
scheduling new ones. The default `full` scope processes every production queue.

`DEFAULT_DELAY_HOURS` controls the cadence for newly scheduled prompts, while
`RUNS_PER_PROMPT` controls the independent samples taken for each prompt/model
pair per cycle. Existing scheduled jobs must be rescheduled when their cadence
changes; changing the environment file alone does not rewrite queued job data.

Provision GHCR read-only authentication into
`/var/lib/yonaris-runtime/.docker/config.json` from root-only transfer material,
then set the file to `yonaris-runtime:yonaris-runtime 0600` and destroy the
transfer copy. Do not invoke Docker directly as any service account. Registry
login/rotation that needs a live daemon must be implemented as a reviewed,
fixed-argument operation in the root-owned stable runtime manager.
The daemon argv has one exact rootless Unix host and no `--config-file`
override. A default rootless `~/.config/docker/daemon.json`, if present, must be
owned/mode-locked as documented in the runbook and may not define `hosts`.

Do not put model-provider credentials in GitHub. They stay only in the
root-owned `/etc/yonaris/las-runtime.env` on the LAS host.

## 5. Caddy and HTTPS

The live Caddyfile uses the Cloudflare Origin certificate for both Yonaris
hosts. The portal route remains:

```caddyfile
portal.yonaris.com {
	tls /etc/caddy/certs/yonaris/yonaris-origin.pem /etc/caddy/certs/yonaris/yonaris-origin.key
	reverse_proxy 127.0.0.1:1515
}
```

The root-owned runtime helper starts and health-checks the isolated `www`
project. The root-owned stable Caddy helper then accepts only the exact apex
fragment from the immutable, policy-authorized release tree. It validates a
candidate Caddyfile, records predecessor/candidate hashes in the durable
transition journal, atomically installs it, performs a graceful reload, and
checks both apex and portal directly against the origin. Any failure restores,
reloads, and post-verifies the exact predecessor. The retired deploy-user
Caddy entrypoint remains fail-closed and must never receive a Docker socket or
host-root mount.

The first `bootstrap-activate` cutover is stricter: it binds the arbitrary
legacy full-file backup separately from a derived predecessor that preserves
the old business routes but enforces the Unix admin boundary. Before recording
or installing the candidate, it atomically installs, restarts, and verifies
that secured predecessor so the raw legacy file is never the rollback target.
If the predecessor cannot be verified, Caddy is stopped and the default TCP
admin endpoint is confirmed closed. A failed candidate may roll back only to
the verified secured predecessor, and the bootstrap journal is cleared only
after admin-boundary and origin-health verification. Later transactions reload
only through the Unix socket.

Caddy administration is Unix-socket-only at
`unix//run/caddy/admin.sock|0600`; the default localhost TCP admin ports must be
closed. Direct origin checks use the immutable release's reviewed Cloudflare
Origin CA, installed as root-owned
`/etc/yonaris/las-origin-health-ca.pem` and verified against its pinned digest.
The exact tmpfiles contract recreates `/run/caddy` as `caddy:caddy 0750` after
boot, and stable operations reject a missing or misowned admin socket.

Port 1516 is intentionally fixed in both the isolated Compose file and the
reviewed Caddy fragment so their upstreams cannot drift.

## 6. Initial memory-tensor data import

Export the current local PostgreSQL 16 database without writing a binary dump
through PowerShell's output redirection:

```powershell
docker exec yonaris-dev-postgres pg_dump -U postgres -d yonaris -Fc -f /tmp/yonaris.dump
docker cp yonaris-dev-postgres:/tmp/yonaris.dump .\yonaris.dump
$hash = (Get-FileHash -Algorithm SHA256 .\yonaris.dump).Hash.ToLowerInvariant()
"$hash  yonaris.dump" | Set-Content -Encoding ascii .\yonaris.dump.sha256
```

Transfer `yonaris.dump` and its SHA-256 file to `/opt/yonaris/import/` on the
LAS host, then run `sha256sum -c yonaris.dump.sha256` there. Before any
customers use production, start the empty database and restore it:

Do not run `docker compose` as `yonaris-deploy` and do not temporarily expose
the runtime socket for this import. A root operator must add a reviewed,
fixed-argument import operation to the stable runtime helper, bind it to the
active release and PostgreSQL digest in the root policy, and execute it through
that helper. Until that operation is installed and verified, the import is
intentionally blocked.

The restore command replaces matching objects in the new Yonaris database. It
must not be used after production begins receiving writes.

For a guarded first import, the checked-in helper refuses any database whose
public schema is non-empty and compares every table count in the export
manifest:

The same rule applies to `restore-initial.sh`: it is evidence and validation
logic for the future fixed operation, not authorization to give candidate code
the runtime socket.

To repeat only the row-count verification after the initial restore, append
`--verify-only` to the command.

## 7. GitHub deployment settings

Add these repository secrets:

- `LAS_HOST`: the LAS fixed IPv4 address
- `LAS_USER`: `yonaris-gate`
- `LAS_SSH_PRIVATE_KEY`: its private deployment key
- `LAS_SSH_KNOWN_HOSTS`: the verified host-key line for the LAS server

Add these repository variables:

- `LAS_DEPLOY_ENABLED`: keep `false` until bootstrap and the forced probe pass.
- `LAS_FORCED_COMMAND_ENABLED`: keep `false` until the exact forced boundary
  passes both the probe and arbitrary-command rejection checks.
- `LAS_POSTGRES_IMAGE_DIGEST`: the exact reviewed `sha256:` registry digest for
  the approved `postgres:16-alpine` image. Mutable tags are not accepted.

The deployment account owns only explicitly scoped mutable candidate data and
has no Docker socket or sudo access. The locked `yonaris-runtime` account owns
the rootless daemon and registry configuration; only the root-owned stable
runtime helper may enter that TCB with fixed, policy-bound arguments.
The separate `yonaris-gate` account owns no runtime data and has one exact
`NOPASSWD` command: the root-owned dispatcher. The dispatcher calls root
verification/state code itself, never runs a candidate release script or
enters `yonaris-deploy`, and uses `yonaris-runtime` only inside the stable
runtime helper; see
[ARTIFACT-OUTPUT-LANGUAGE-RUNBOOK.md](ARTIFACT-OUTPUT-LANGUAGE-RUNBOOK.md).
The root operator must preload each immutable SHA and authorize its exact
operation before Actions can request it through the stable boundary. The
candidate and deployment key cannot install or edit the trust policy, stable
programs, attestation, or
root-controlled `authorized_keys`. The cutover is proved with the same Actions
key using the exact no-side-effect `yonaris-las-v1 probe` response and an exact
protocol rejection of an arbitrary command.
Stable programs and their policy are published only as one root-owned,
versioned bundle through one atomic active pointer; the fixed sudo/SSH
entrypoints are byte-identical launchers. See the linked runbook for staging,
fsync, post-verification, and crash-reconciliation requirements. The launcher
pins one exact bundle generation before entering the dispatcher. Every probe
and normal operation then takes the common control lock before invoking a
stable peer, requires the canonical active pointer to still match that pin,
and reruns the verifier from the pinned generation. A normal mutation converts
the lock to exclusive mode and repeats the complete pointer/verifier/journal/
activation check because that conversion is not atomic. Thus a request queued
through a candidate generation that the installer later rolls back exits 75
before Git materialization, state mutation, Docker, or Caddy.
The same locked revalidation rejects the stable-bundle journal, its publication
temporary, or the active-pointer temporary with exit 75 before any stable peer
or Git read. This check belongs to the dispatcher, not the generic verifier:
the root-only bundle installer must be able to verify and reconcile its own
candidate while that journal remains durable.
Once the server is ready and the forced probe succeeds, set both
`LAS_DEPLOY_ENABLED=true` and `LAS_FORCED_COMMAND_ENABLED=true`. There is no
Phase 1 unrestricted compatibility deployment. Future merges to `main` deploy
only through the stable dispatcher. Both variables remain `false` until the
producer's exact root-console sequence and full bootstrap verification in the
runbook have succeeded.

## 8. Daily backups

The checked-in legacy timer is a deprecated fail-closed compatibility stub, not
an authorized production entrypoint. Do not install or enable it; any installed
legacy service and timer must instead be inactive and masked. The only migration
evidence workflow is the root-only stable producer documented in the runbook.
It requires GNU coreutils `mv` 8.32 or newer for atomic no-replace publication
and the mandatory root-owned off-host adapter, which must upload and download
the same backup bytes before the local rehearsal.

From an already authenticated root console, use the exact producer and verifier
sequence in the runbook; it is not an SSH operation:

```text
/usr/local/libexec/yonaris-las/produce-las-migration-readiness \
  sha-<40> sha256:<web> sha256:<worker> sha256:<migrate> sha256:<postgres> sha256:<www>
/usr/local/libexec/yonaris-las/manage-las-release-state \
  migration-readiness \
  sha-<40> sha256:<web> sha256:<worker> sha256:<migrate> sha256:<postgres> sha256:<www>
```

## Marketing site

The `www` image serves `apps/www` on `127.0.0.1:1516` in the independent
`yonaris-marketing` Compose project. Its canonical root-owned marker is
`/etc/yonaris/las-active-marketing-release-v1`; the deploy-user-owned
`.marketing-release` is only a non-authoritative Caddy rollback detail.
`portal.yonaris.com`, its database, containers, and deployment URL remain
unchanged.

### Diagnostic request delivery

The public diagnostic endpoint sends accepted requests through Resend to the
Yonaris team. Before the first release that exposes the endpoint, verify
`yonaris.com` as a sender domain in the Resend dashboard and create a
domain-scoped **Sending Access** API key. A Full Access key is neither required
nor appropriate for this service. Domain verification is a one-time release
prerequisite; deployment intentionally performs no Resend domain API lookup.

Set these values in `/etc/yonaris/las-runtime.env`:

```dotenv
MARKETING_DIAGNOSTIC_DELIVERY_MODE=resend
RESEND_API_KEY=<domain-scoped-sending-access-key>
RESEND_FROM_EMAIL='Yonaris <diagnostic@yonaris.com>'
MARKETING_LEAD_RECIPIENT=black.dcp@outlook.com
```

For an explicit site-only launch before Resend is configured, use
`MARKETING_DIAGNOSTIC_DELIVERY_MODE=mailto-only` and leave all three Resend
values blank. The endpoint then returns an unconfirmed response and the form
retains the visitor's entries for a retry; it never reports delivery or inserts
synthetic credentials. Any other mode fails the release preflight. In `resend`
mode, the deployment fails before pulling or starting an image when any value
is blank or invalid. Only the `www` container receives these variables. An
accepted Resend response confirms that the request entered the delivery
service; it does not prove inbox delivery. The endpoint's five-attempt,
ten-minute client-IP limit is in-process, best-effort abuse control: it relies
on the trusted proxy header, resets with the process, and is not a distributed
enforcement system.

Caddy forwards only `/`, the homepage's static assets, its OG image, and the
single-page `robots.txt`/`sitemap.xml` endpoints. Legacy documentation, status,
and product-marketing routes in `apps/www` are not exposed on the production
domain. Portal and marketing workflows share both an ordered Actions queue and
the root-owned `/run/lock/yonaris` directory inode, so object import,
materialization, and deployment cannot race. After
the forced-command cutover, marketing also passes the stable candidate guard
and requires a compatible active portal rollback receipt before runtime
switch; an existing irreversible marker is validated as well.

## Operations

Database backups:

Direct `docker compose exec` and checkout-owned backup scripts are prohibited.
Backups must be implemented as another fixed-argument stable runtime-helper
operation bound to the active release and its five-digest receipt.

Roll Web and Worker back to an earlier immutable release only through the
production workflow. After Chinese artifact output has been activated, the
stable host guard must approve both the candidate Git object and the healthy
compatibility receipt. Direct execution from an old checkout is forbidden; see
[ARTIFACT-OUTPUT-LANGUAGE-RUNBOOK.md](ARTIFACT-OUTPUT-LANGUAGE-RUNBOOK.md).
The `deploy.sh` inside the immutable materialized tree is an implementation
detail of that guarded workflow, not a manual rollback entry point.

An application rollback does not reverse a database migration. Production
migration must remain blocked until a fixed stable operation can create a
checksummed root-owned backup, restore that exact backup into an isolated
PostgreSQL instance, and run the immutable candidate migration digest against
the copy before touching production. The checked-in rehearsal and backup
scripts are validation logic, not production authorization. Schema-destructive
releases additionally require a reviewed restore plan.

The production SSH and policy surface contains only `probe`, `deploy`,
`marketing-preflight`, `marketing-deploy`, and `marketing-verify`. The eleven
former candidate-side report/import/repair/sampling/snapshot/browser-runner
operations are permanently disabled; the exact list and rejection contract are
in the linked artifact-language runbook. Do not restore their workflow jobs or
add their names to a policy. A future capability that needs Docker or host
state requires a new stable fixed operation and protocol review.

This deployment never runs global Docker prune commands because the LAS host is
shared with other applications.
