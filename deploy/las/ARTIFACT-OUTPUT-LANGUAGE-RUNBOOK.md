# LAS forced-command and output-language runbook

This is a root-operated trust procedure. GitHub Actions is never given an
unrestricted shell, including for bootstrap. The deployment principal cannot
change `authorized_keys`, the trust policy, stable programs, release receipts,
transition journals, or the one-way language activation attestation.

## Fixed trust boundary

The only Actions key is identified by fingerprint:

```text
SHA256:gM/QEgkfN99cP/Cf9awUOwSb7FMesQTgRCTI9kPh84A
```

`/home/yonaris-gate/.ssh/authorized_keys` must be byte-for-byte exactly this
one LF-terminated line; comments, blank lines, and additional keys are errors:

```text
restrict,command="/usr/bin/sudo -n /usr/local/libexec/yonaris-las/dispatch-las-command" ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAINm/JTgoBi4QJiP0KunOfVuG3JDd6NpxlVdZ3l9xzTWg yonaris-las-operator-2026-08-06
```

Root owns these paths:

| Path | Owner/mode | Purpose |
| --- | --- | --- |
| `/home/yonaris-gate`, `.ssh` | `root:root 0755` | separate SSH-only gate; prevents key-directory replacement |
| `authorized_keys` | `root:root 0600` | exact forced entry |
| `/usr/local/libexec/yonaris-las` | `root:root 0755` | byte-identical fixed launchers plus versioned program bundles |
| `/usr/local/libexec/yonaris-las/bundles` | `root:root 0755` | parent for immutable bundle generations |
| `/usr/local/libexec/yonaris-las/bundles/sha256-*` | `root:root 0555` | complete immutable stable-program + policy generations |
| `/etc/yonaris/las-stable-bundle-active-v1` | `root:root 0600` | atomic pointer to the one active generation |
| `/usr/local/sbin/verify-yonaris-las-forced-command` | `root:root 0755` | fixed launcher for the active root verifier; only the state manager uses its exact preactivation argument |
| `/usr/local/sbin/install-yonaris-las-trust-policy` | `root:root 0755` | compatibility launcher; refuses standalone updates after bundle activation |
| `/usr/local/sbin/install-yonaris-las-stable-bundle` | `root:root 0755` | root-local atomic programs+policy installer |
| `/usr/local/libexec/yonaris-las/produce-las-migration-readiness` | `root:root 0755` | fixed root-only backup, off-host round-trip, rehearsal, and attestation producer |
| `/usr/local/libexec/yonaris-las/store-las-migration-backup` | `root:root 0755` | mandatory separately reviewed off-host adapter; never callable through SSH |
| active bundle `las-trust-v1` | `root:root 0644` | hashes and SHA/operation/digest policy for that exact generation |
| `/etc/sudoers.d/yonaris-las-dispatch` | `root:root 0440` | the one exact gate-to-root command |
| `/etc/yonaris/las-runtime.env` | `root:yonaris-runtime 0440` | strict dotenv data readable only inside the runtime TCB |
| `/etc/yonaris/las-forced-command-active` | `root:root 0600` | forced-boundary attestation |
| `/etc/yonaris/artifact-output-language-active-v1` | `root:root 0400` | one-way activation attestation |
| `/etc/yonaris/las-transition-pending-v1` | `root:root 0600` | crash-recovery journal |
| `/etc/yonaris/las-caddy-bootstrap-pending-v1` | `root:root 0600` | first-Caddy-cutover journal; absent after convergence |
| `/etc/yonaris/las-stable-bundle-pending-v1` | `root:root 0600` | crash-recovery journal for program+policy publication |
| `/etc/yonaris/las-compatible-releases-v2` | `root:root 0755` | digest-bound receipts |
| `/etc/yonaris/las-caddy-transition-backups-v1` | `root:root 0700` | full-file Caddy predecessors bound by transition hashes |
| `/etc/yonaris/las-migration-readiness-v1` | `root:root 0700` | verifier-only release attestations for an exact five-digest tuple |
| `/etc/yonaris/las-migration-evidence-v1` | `root:root 0700` | immutable backup and rehearsal evidence files named by an attestation |
| `/etc/yonaris/las-origin-health-ca.pem` | `root:root 0444` | pinned Cloudflare Origin CA used only for direct-origin health checks |
| `/var/lib/yonaris` | `root:root 0711` | canonical state parent; no deploy-user writes |
| `/var/lib/yonaris/las-release-trees` | `root:root 0555` | exact immutable commit trees |
| `/var/lib/yonaris/las-release-trees/.bindings` | `root:root 0555` | root-created manifest bindings for materialized trees |
| `/var/lib/yonaris/las-objects.git` | `root:root 0700` | root-only bare Git object store |
| `/etc/yonaris/las-active-portal-release-v1`, `las-active-marketing-release-v1` | `root:root 0644` | canonical active release markers |
| `/var/lib/yonaris-runtime` | `root:yonaris-runtime 0750` | dedicated rootless runtime home |
| `/var/lib/yonaris-runtime/.docker` | `yonaris-runtime:yonaris-runtime 0700` | registry and daemon client configuration |
| `/run/lock/yonaris` | `root:root 0700` | dispatcher locks the directory inode without creating/following a file |
| `/etc/tmpfiles.d/yonaris-las.conf` | `root:root 0644` | recreates the exact lock and Caddy runtime directories after boot |
| `/run/caddy/admin.sock` | `caddy:caddy 0600` | Unix-only Caddy admin endpoint; absent or misowned means fail closed |

All three service accounts must be absent from the `docker` group and unable to
read or write `/var/run/docker.sock`. Only the locked `yonaris-runtime` TCB owns
the dedicated rootless daemon at `/run/user/<runtime-uid>/docker.sock`, with
configuration under `/var/lib/yonaris-runtime/.docker`. `yonaris-gate`,
`yonaris-deploy`, and every business container must be unable to read that
socket. Host networking, devices, privileged containers, and all host mounts
except the exact stable allowlist are prohibited.

Verify the effective SSH boundary, not just a config fragment:

```bash
sudo /usr/sbin/sshd -T -C user=yonaris-gate,host=localhost,addr=127.0.0.1 \
  | grep -E '^(authorizedkeysfile|authorizedkeyscommand |authorizedkeyscommanduser|permituserenvironment)'
```

It must report only `.ssh/authorized_keys`, no `AuthorizedKeysCommand`, and
`permituserenvironment no`.

## Root-local bootstrap

Perform bootstrap in this order from an already authenticated root console:

1. create the three locked identities and canonical root-owned state;
2. retire the old LAS rootful containers, free ports `1515` and `1516`, and
   establish the isolated `yonaris-runtime` rootless daemon;
3. install the fixed launchers, root-only whole-bundle installer, exact SSH
   boundary, forced key, sudoers file, runtime dotenv, tmpfiles rule, and
   forced-boundary marker;
4. preload the reviewed private Git commit into the root-only bare object store;
5. stage one complete program-and-policy generation, then let the root-only
   installer publish and post-verify its atomic active pointer;
6. after trustworthy migration evidence exists, bootstrap portal runtime and
   attest its surface; use that receipt as the exact anchor to bootstrap www,
   then bootstrap Caddy and attest the marketing surface;
7. run the root verifier and forced SSH probes before enabling either workflow.

Do not create migration evidence, a receipt, active-release marker, Caddy
journal, or bundle pointer by hand. A failed step leaves the workflows disabled
and does not establish a verified predecessor.

On a fresh host, create the three locked identities with the exact passwd
records required by the verifier. `yonaris-deploy` and `yonaris-runtime` are
not login principals; only the forced SSH gate retains `/bin/bash`:

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
sudo install -d -o root -g root -m 0755 /home/yonaris-gate
sudo install -d -o root -g root -m 0755 /home/yonaris-gate/.ssh
```

For an existing identity, stop before changing its UID or GID: receipts,
runtime files, and process ownership may already bind those numbers. Reconcile
only its required home/shell and lock the password. The NSS passwd database
must contain exactly one owner for each sensitive UID: `yonaris-gate`,
`yonaris-deploy`, `yonaris-runtime`, and `caddy`; all four UIDs are distinct and
non-root. The numeric runtime GID must likewise resolve to exactly the
`yonaris-runtime` group, with no unrelated primary or supplemental member.

Create the canonical parents before installing programs. The object store is a
bare root-only repository; `/opt/yonaris` contains only narrowly scoped mutable
candidate output/import data and never contains an authoritative checkout:

```bash
sudo install -d -o root -g root -m 0755 /etc/yonaris
sudo install -d -o root -g root -m 0711 /var/lib/yonaris
sudo install -d -o root -g root -m 0700 /var/lib/yonaris/las-objects.git
sudo git init --bare /var/lib/yonaris/las-objects.git
sudo chown -R root:root /var/lib/yonaris/las-objects.git
sudo chmod 0700 /var/lib/yonaris/las-objects.git
sudo install -d -o root -g root -m 0755 /var/lib/yonaris/las-release-trees
sudo install -d -o root -g root -m 0555 \
  /var/lib/yonaris/las-release-trees/.bindings
sudo chmod 0555 /var/lib/yonaris/las-release-trees
sudo install -d -o root -g root -m 0755 \
  /etc/yonaris/las-compatible-releases-v2
sudo install -d -o root -g root -m 0700 \
  /etc/yonaris/las-caddy-transition-backups-v1
sudo install -d -o root -g root -m 0700 \
  /etc/yonaris/las-migration-readiness-v1
sudo install -d -o root -g root -m 0700 \
  /etc/yonaris/las-migration-evidence-v1
sudo install -d -o yonaris-deploy -g yonaris-deploy -m 0750 /opt/yonaris
sudo install -d -o yonaris-deploy -g yonaris-deploy -m 0700 \
  /opt/yonaris/import
sudo install -d -o root -g yonaris-runtime -m 0750 \
  /var/lib/yonaris-runtime
sudo install -d -o yonaris-runtime -g yonaris-runtime -m 0700 \
  /var/lib/yonaris-runtime/.docker
```

Install a root-owned `/etc/tmpfiles.d/yonaris-las.conf` containing exactly:

```text
d /run/lock/yonaris 0700 root root -
d /run/caddy 0750 caddy caddy -
```

Set that file to `root:root 0644`, run
`systemd-tmpfiles --create /etc/tmpfiles.d/yonaris-las.conf`, and verify the
lock is `root:root 0700` and the Caddy runtime directory is
`caddy:caddy 0750`. The root verifier compares the entire two-line file
byte-for-byte; do not add a third path, substitute a lock file, or use a
deploy-owned directory.

Copy the reviewed production dotenv from root-only transfer media to
`/etc/yonaris/las-runtime.env` as a regular, single-link
`root:yonaris-runtime 0440` file. It must use the exact UTF-8 data-only grammar
accepted by the stable runtime manager: one known uppercase `KEY=value` per
line, with optional blank lines/comments; no duplicate or unknown key, NUL,
shell expansion, command substitution, unsafe unquoted whitespace or shell
metacharacter, malformed quote, or `replace_with` placeholder is accepted.
The runtime manager rejects the file before Docker access unless all required
secrets and fields are non-empty, `DEPLOYMENT_ID` is a canonical UUID,
`CREDENTIAL_ENCRYPTION_KEY` decodes to exactly 32 bytes, boolean/enum/integer
fields use their exact grammar, provider credentials agree with
`SCRAPE_TARGETS`, and `DATABASE_URL` is the exact `postgresql://` URL for the
same decoded user, password, and database on `postgres:5432` with no query or
fragment. `APP_ENV_FILE` is always the canonical path; neither gate nor deploy
may read it.

If `/etc/yonaris/artifact-output-language-active-v1` exists,
`ARTIFACT_ZH_CN_ENABLED=true` and `WORKER_ENABLED=true` are both mandatory.
Before that marker exists, ordinary runtime verification rejects
`ARTIFACT_ZH_CN_ENABLED=true`; only the root state manager's exact read-only
preactivation verification may validate that brief transition state. Optional
`BROWSER_RUNNER_ENABLED` and `RESPONSE_SNAPSHOT_ENABLED`, when present, are
exact lowercase booleans; the latter remains `false` because its legacy
activation operation is not part of the production protocol.

### Produce migration-readiness evidence from the root console

Every portal bootstrap or deploy mutation first calls the root state manager
with this exact verifier interface:

```text
manage-las-release-state migration-readiness \
  sha-<40-lowercase-git-sha> \
  sha256:<web> sha256:<worker> sha256:<migrate> sha256:<postgres> sha256:<www>
# las-migration-readiness-v1 ok
```

The verifier accepts only a nine-line, regular, single-link `root:root 0400`
attestation under `/etc/yonaris/las-migration-readiness-v1/<release>`. It binds
the token, release, all five digests, and the SHA-256 values of matching
`<release>.backup` and `<release>.rehearsal` files under
`/etc/yonaris/las-migration-evidence-v1`, which must also be regular,
single-link `root:root 0400` files.

Install the reviewed `store-las-migration-backup` adapter as a root-owned,
single-link `0755` file before using the producer. The adapter accepts only
`put-get <release> <backup-sha256> <source> <returned-copy>`; it must upload the
source to the independently administered off-host store, download it again to
`returned-copy`, and preserve byte equality: both local SHA-256 values must
equal `backup-sha256`. It must not expose credentials to deploy users,
containers, or the SSH dispatcher.

Run the producer only from an already authenticated root console (not through
`sudo`) after the active stable bundle is installed. It fail-closes unless
`/usr/bin/mv` is GNU coreutils 8.32 or newer and an actual same-filesystem
sentinel probe in the evidence parent proves `mv -nT` leaves an existing
destination unchanged while preserving its source. Do not create, copy, edit,
or hash evidence by hand:

```text
/usr/local/libexec/yonaris-las/produce-las-migration-readiness \
  sha-<40> sha256:<web> sha256:<worker> sha256:<migrate> sha256:<postgres> sha256:<www>
/usr/local/libexec/yonaris-las/manage-las-release-state \
  migration-readiness \
  sha-<40> sha256:<web> sha256:<worker> sha256:<migrate> sha256:<postgres> sha256:<www>
```

The second command must print exactly `las-migration-readiness-v1 ok` before a
portal bootstrap, database migration, or production workflow can proceed.

The existing `/etc/caddy` directory must remain `root:root 0755` and the full
`/etc/caddy/Caddyfile` a regular, single-link `root:root 0644` file. Preserve an
out-of-band root backup before bootstrap. The stable Caddy helper creates its
own `0600` hash-bound predecessor under
`/etc/yonaris/las-caddy-transition-backups-v1`; never substitute a deploy-owned
copy or mount the host Caddyfile into a candidate container.

The stable helper requires Caddy's admin API only at
`unix//run/caddy/admin.sock|0600`; the default TCP listeners on
`127.0.0.1:2019` and `[::1]:2019` must be closed. It installs the reviewed
Cloudflare Origin CA from the immutable release as
`/etc/yonaris/las-origin-health-ca.pem`, verifies its pinned SHA-256
`4fd8df5f5818d3979635f7ff7aeb3925cc2a28d17630d6038f190403601dc057`, and
uses `--cacert` plus exact `--resolve` addresses for direct-origin health
checks. The exact tmpfiles rule above recreates `/run/caddy` after boot; Caddy
itself must then create the `caddy:caddy 0600` socket before any stable helper
operation is accepted.

Retire installed legacy host entrypoints before the first verifier run. Both
`yonaris-backup.service` and `yonaris-backup.timer` must be stopped, disabled,
and masked by root-owned `/etc/systemd/system/... -> /dev/null` links; their
effective `ExecStart` and `SupplementaryGroups` must be empty. The checked-in
unit is only a disabled legacy stub and is not a production backup capability.
Also move any pre-existing `/usr/local/sbin/install-marketing-caddy` into a
root-only quarantine directory, leaving that pathname absent. The verifier
also accepts a reviewed byte-exact four-line fail-closed stub at that pathname,
but never accepts an old installer. Example retirement sequence:

```bash
sudo systemctl disable --now yonaris-backup.timer yonaris-backup.service
sudo systemctl mask yonaris-backup.timer yonaris-backup.service
sudo install -d -o root -g root -m 0700 /root/yonaris-retired
sudo mv -n -- /usr/local/sbin/install-marketing-caddy \
  /root/yonaris-retired/install-marketing-caddy.pre-stable
```

If the Caddy entry did not exist, omit only the `mv`. Verify the source path is
absent and both units are `inactive`/`masked` before continuing. Do not install
the repository's former rootful Caddy implementation or enable the legacy
backup unit merely because their source files remain for compatibility tests.

From a reviewed fixed commit, compare the SHA-256 values out of band and run
`/bin/bash -n` on the launcher, installer, and all eight implementations. The
fixed public entrypoints are eight byte-identical copies of
`run-las-active-bundle.sh`; they never contain a mutable program generation.
Install those launchers and the root-only bundle installer without consulting
the deployment checkout:

```bash
sudo install -d -o root -g root -m 0755 \
  /usr/local/libexec/yonaris-las /usr/local/libexec/yonaris-las/bundles /etc/yonaris
sudo install -o root -g root -m 0755 install-las-stable-bundle.sh \
  /usr/local/sbin/install-yonaris-las-stable-bundle
sudo install -o root -g root -m 0755 run-las-active-bundle.sh \
  /usr/local/libexec/yonaris-las/dispatch-las-command
sudo install -o root -g root -m 0755 run-las-active-bundle.sh \
  /usr/local/libexec/yonaris-las/guard-artifact-output-release
sudo install -o root -g root -m 0755 run-las-active-bundle.sh \
  /usr/local/libexec/yonaris-las/manage-las-release-state
sudo install -o root -g root -m 0755 run-las-active-bundle.sh \
  /usr/local/libexec/yonaris-las/manage-las-runtime
sudo install -o root -g root -m 0755 run-las-active-bundle.sh \
  /usr/local/libexec/yonaris-las/manage-las-caddy
sudo install -o root -g root -m 0755 run-las-active-bundle.sh \
  /usr/local/libexec/yonaris-las/produce-las-migration-readiness
sudo install -o root -g root -m 0755 run-las-active-bundle.sh \
  /usr/local/sbin/verify-yonaris-las-forced-command
sudo install -o root -g root -m 0755 run-las-active-bundle.sh \
  /usr/local/sbin/install-yonaris-las-trust-policy
```

Create exactly `/usr/local/libexec/yonaris-las/.bundle-v1.new` as
`root:root 0700`. Copy the reviewed implementations into it with these exact
names and mode `0755`: `dispatch-las-command`,
`guard-artifact-output-release`, `install-yonaris-las-trust-policy`,
`manage-las-release-state`, `manage-las-runtime`, `manage-las-caddy`, and
`verify-yonaris-las-forced-command`, and `produce-las-migration-readiness`.
Create its `las-trust-v1` as a `root:root 0600` regular single-link file. Its
eight header hashes must bind those eight staging files. Do not run the
installer yet: the first policy,
preloaded commit, rootless runtime, forced key, sudoers file, sshd boundary, and
forced-boundary marker below must all exist because installation post-verifies
the entire boundary through the candidate generation.

For every later program or policy change, stage and install a new complete
bundle; never replace one live program or policy by itself.

The candidate checkout cannot update the trust policy or any stable program.
There is no Actions bootstrap fallback and no `bash -s`/heredoc phase.

Create distinct locked `yonaris-gate`, `yonaris-deploy`, and `yonaris-runtime`
users. The gate owns no checkout/runtime data; deploy owns only explicitly
scoped non-runtime mutable data and is not an execution fallback for release
scripts; runtime owns only its rootless daemon/config. Deploy and runtime have
no sudo rule. Install this single gate-only sudo command; the verifier,
managers, and installers are deliberately absent:

```sudoers
Cmnd_Alias YONARIS_LAS_DISPATCH = /usr/local/libexec/yonaris-las/dispatch-las-command
Defaults!YONARIS_LAS_DISPATCH secure_path=/usr/bin:/bin:/usr/sbin:/sbin
Defaults!YONARIS_LAS_DISPATCH env_reset
Defaults!YONARIS_LAS_DISPATCH env_keep += "SSH_ORIGINAL_COMMAND"
Defaults!YONARIS_LAS_DISPATCH env_delete += "BASH_ENV ENV CDPATH GLOBIGNORE BASHOPTS SHELLOPTS LD_PRELOAD LD_LIBRARY_PATH PYTHONPATH PERL5LIB RUBYLIB"
yonaris-gate ALL=(root) NOPASSWD: YONARIS_LAS_DISPATCH
```

Prepare that block and the key as LF-terminated reviewed files under a
temporary `root:root 0700` `/root/yonaris-bootstrap` directory, install them to
`/etc/sudoers.d/yonaris-las-dispatch` as `root:root 0440`, then require both a
byte comparison and `/usr/sbin/visudo -cf` to pass. Install the exact
LF-terminated key line from the start of this runbook as follows; do not append
to an existing file:

```bash
sudo install -o root -g root -m 0600 /root/yonaris-bootstrap/authorized_keys \
  /home/yonaris-gate/.ssh/authorized_keys
sudo install -o root -g root -m 0440 /root/yonaris-bootstrap/yonaris-las-dispatch.sudoers \
  /etc/sudoers.d/yonaris-las-dispatch
sudo /usr/sbin/visudo -cf /etc/sudoers.d/yonaris-las-dispatch
```

Configure sshd so the effective gate policy is public-key-only with exactly
`.ssh/authorized_keys`, no key command, no user environment, and no sshd
`ForceCommand`; the per-key command remains the only forced command. Ubuntu
24.04's OpenSSH 9.6 baseline does not provide the later `RefuseConnection`
directive, so use this compatible denial block for the two non-login accounts:

```text
Match User yonaris-deploy,yonaris-runtime
    AuthenticationMethods any
    PasswordAuthentication no
    KbdInteractiveAuthentication no
    PubkeyAuthentication no
    HostbasedAuthentication no
    GSSAPIAuthentication no
    KerberosAuthentication no
    DisableForwarding yes
    AllowAgentForwarding no
    AllowTcpForwarding no
    AllowStreamLocalForwarding no
    X11Forwarding no
    PermitTTY no
    PermitTunnel no
    PermitOpen none
    PermitListen none
Match all
```

`AuthenticationMethods any` is the valid OpenSSH default; it exposes no path
because every supported authentication method is explicitly disabled for these
accounts. Validate `sshd -t`, reload sshd, then use `sshd -T -C` for both users
in localhost, IPv4, and IPv6 contexts. The effective output must contain every
line above once. A fragment that looks correct but loses to another `Match`
rule is not accepted.

Create `/etc/yonaris/las-forced-command-active` atomically as `root:root 0600`
with exactly `yonaris-las-forced-command-v1` plus one LF. This marker states the
intended boundary; it is not proof by itself and must be present before the
first bundle install can post-verify.

The root dispatcher calls only the root-owned stable verifier, guard, state,
runtime, and Caddy managers. It never runs a release-owned deployment helper or
enters `yonaris-deploy`. All Docker API calls use fixed runtime-manager grammar;
that manager alone enters `yonaris-runtime` with `env -i`. Candidate code
therefore cannot invoke a root helper or reach either Docker daemon. Activation
remains a separate root-local operation and refuses any call with `SUDO_USER`.

## Rootless Docker

Before enabling the forced key, stop the old LAS portal/marketing containers
through the existing root operator channel and prove that rootful processes no
longer own `127.0.0.1:1515` or `127.0.0.1:1516`. Do not start the new daemon
until both ports are free. A rootful daemon needed by unrelated host services
may remain, but none of the three LAS identities may access its socket.

Remove legacy group access and enable the dedicated user's linger/runtime
directory:

```bash
sudo gpasswd -d yonaris-deploy docker || true
sudo gpasswd -d yonaris-gate docker || true
sudo gpasswd -d yonaris-runtime docker || true
sudo loginctl enable-linger yonaris-runtime
sudo install -d -o root -g yonaris-runtime -m 0750 /var/lib/yonaris-runtime
sudo install -d -o yonaris-runtime -g yonaris-runtime -m 0700 \
  /var/lib/yonaris-runtime/.docker
```

Install and enable Docker rootless mode using the distribution's pinned Docker
packages and a user systemd unit whose `HOME`/data root is
`/var/lib/yonaris-runtime`. The daemon must be the real `/usr/bin/dockerd`
process running with exactly one `--rootless` flag and exactly one `--host`/`-H`
value, `unix:///run/user/<runtime-uid>/docker.sock`. An additional TCP, fd, or
second Unix listener, a `--config-file` override, a proxy socket, or a rootful
daemon behind that pathname is rejected. If
`/var/lib/yonaris-runtime/.config/docker/daemon.json` exists, both parent
directories must be `yonaris-runtime:yonaris-runtime 0700`, the file must be a
regular single-link `0600` file owned by that identity, its JSON root must be an
object, and it must not contain the top-level `hosts` key. Its runtime directory must be
`yonaris-runtime:yonaris-runtime 0700`, the socket `0600` or `0660`, and
`docker.pid` a regular `0600` file owned by the runtime identity. All four UIDs
reported in `/proc/<pid>/status` must equal the `yonaris-runtime` UID, the
process must own the one `/proc/net/unix` socket inode, and `docker info` must
contain `name=rootless` without changing that identity snapshot.

Confirm that these access checks fail:

```bash
for account in yonaris-gate yonaris-deploy yonaris-runtime; do
  sudo -u "$account" test ! -r /var/run/docker.sock
  sudo -u "$account" test ! -w /var/run/docker.sock
done
for account in yonaris-gate yonaris-deploy; do
  sudo -u "$account" test ! -r /run/user/$(id -u yonaris-runtime)/docker.sock
  sudo -u "$account" test ! -w /run/user/$(id -u yonaris-runtime)/docker.sock
  sudo -u "$account" test ! -r /etc/yonaris/las-runtime.env
done
```

Install the reviewed GHCR read-only `config.json` from root-only transfer media
as `yonaris-runtime:yonaris-runtime 0600` under the account-owned
`DOCKER_CONFIG`, then destroy the transfer copy. No service account may invoke
the Docker client directly; every live daemon operation, including a future
registry-login rotation, must be an enumerated fixed-argument operation of the
root-owned stable runtime manager. Neither the socket nor the runtime dotenv
may be mounted into Web, Worker, migration, PostgreSQL, or marketing
containers. Rootless Compose must also reject host networking, privileged
mode, devices, Docker-socket mounts, and any host bind outside the exact stable
allowlist.

## Digest-bound release policy

The policy has ten exact header lines followed by one or more allow entries:

```text
yonaris-las-trust-v1
actions-key-fingerprint SHA256:gM/QEgkfN99cP/Cf9awUOwSb7FMesQTgRCTI9kPh84A
dispatcher-sha256 <64-lowercase-hex>
guard-sha256 <64-lowercase-hex>
installer-sha256 <64-lowercase-hex>
state-manager-sha256 <64-lowercase-hex>
runtime-manager-sha256 <64-lowercase-hex>
caddy-manager-sha256 <64-lowercase-hex>
verifier-sha256 <64-lowercase-hex>
migration-readiness-producer-sha256 <64-lowercase-hex>
allow sha-<40-lowercase-git-sha> <operation> web-sha256 sha256:<64-hex> worker-sha256 sha256:<64-hex> migrate-sha256 sha256:<64-hex> postgres-sha256 sha256:<64-hex> www-sha256 sha256:<64-hex>
```

The operator must add every release SHA and operation explicitly. All entries
for the same SHA use the same five registry digests: Web, Worker, migration,
PostgreSQL, and www. Obtain the four application digests from the pinned build
workflows, bind PostgreSQL to the reviewed `postgres:16-alpine` digest exposed
as `LAS_POSTGRES_IMAGE_DIGEST`, verify all five against registry/signing
evidence, and record them offline. The only policy operations accepted by the
stable parsers are `deploy`, `rollback`, `marketing-preflight`,
`marketing-deploy`, and `marketing-verify`. A portal request transmits the
first four digests; a marketing request transmits www; every policy decision,
state transition, runtime-manager call, and receipt retains the complete tuple.
Mutable tags are never an authorization input.

The forced dispatcher performs no clone, fetch, SSH, HTTPS, credential-helper,
or ref mutation. Before a policy names a SHA, an authenticated root operator
must preload that exact commit and all reachable objects into
`/var/lib/yonaris/las-objects.git`. The preferred transfer is a reviewed full
Git bundle that exports the exact commit under a dedicated release ref. Install
the transfer as a root-only `0600` file, verify the bundle and its out-of-band
SHA-256, import it into a persistent root-only ref such as
`refs/yonaris/releases/<40-hex>`, and require both `rev-parse ...^{commit}` and
`cat-file -e ...^{commit}` to return the expected 40-hex object ID with replace
objects disabled. Retain the root release ref so garbage collection cannot
prune a policy-authorized commit, then remove the transfer file.

After either import mechanism, remove all `remote.*`, `include.*`,
`includeIf.*`, `extensions.partialClone`, protocol, credential, URL-rewrite,
HTTP, SSH-command, and alternate-ref configuration from the canonical store.
It must have no `config.worktree` or `commondir`, no
`objects/info/{alternates,http-alternates}`, no `*.promisor` pack sidecar, and
no entry under the legacy `remotes/` or `branches/` directories. Perform the
clean-store check with lazy fetch, credentials, prompts, and every transport
disabled:

```bash
release_sha=<40-lowercase-hex>
test "$release_sha" = "$(printf '%s' "$release_sha" | tr -cd '0-9a-f')"
test "${#release_sha}" -eq 40
actual="$(env -i PATH=/usr/bin:/bin HOME=/nonexistent \
  GIT_CONFIG_NOSYSTEM=1 GIT_CONFIG_GLOBAL=/dev/null \
  GIT_NO_REPLACE_OBJECTS=1 GIT_NO_LAZY_FETCH=1 GIT_TERMINAL_PROMPT=0 \
  GIT_ASKPASS=/bin/false SSH_ASKPASS=/bin/false GIT_SSH_COMMAND=/bin/false \
  git --no-replace-objects --git-dir=/var/lib/yonaris/las-objects.git \
  -c core.hooksPath=/dev/null -c credential.helper= \
  -c protocol.allow=never -c protocol.file.allow=never \
  -c protocol.http.allow=never -c protocol.https.allow=never \
  -c protocol.ssh.allow=never -c protocol.git.allow=never \
  -c protocol.ext.allow=never \
  rev-parse "refs/yonaris/releases/$release_sha^{commit}")"
test "$actual" = "$release_sha"
env -i PATH=/usr/bin:/bin HOME=/nonexistent \
  GIT_CONFIG_NOSYSTEM=1 GIT_CONFIG_GLOBAL=/dev/null \
  GIT_NO_REPLACE_OBJECTS=1 GIT_NO_LAZY_FETCH=1 GIT_TERMINAL_PROMPT=0 \
  GIT_ASKPASS=/bin/false SSH_ASKPASS=/bin/false GIT_SSH_COMMAND=/bin/false \
  git --no-replace-objects --git-dir=/var/lib/yonaris/las-objects.git \
  -c core.hooksPath=/dev/null -c credential.helper= \
  -c protocol.allow=never -c protocol.file.allow=never \
  -c protocol.http.allow=never -c protocol.https.allow=never \
  -c protocol.ssh.allow=never -c protocol.git.allow=never \
  -c protocol.ext.allow=never \
  cat-file -e "$release_sha^{commit}"
```

A root-only authenticated HTTPS import is allowed instead of an offline bundle
only from the already authenticated root console. Its read-only private-repo
credential must live in root-only temporary storage, must never be embedded in
a URL or process argument, and must be removed after the same persistent-ref
and object-ID checks. No credential, remote, or network protocol is configured
for the dispatcher, and no credential is readable by a service account or
container. Missing objects therefore fail closed before authorization or
materialization; do not install the policy first and hope the workflow fetches
them.

Materialization parses the Git tree as NUL-delimited records. Valid Git
filenames—including spaces, `$`, `[` and `]`—remain valid release content; a
shell-safe-name allowlist is not the trust boundary. The materializer must
instead reject empty, absolute, dot, or `..` traversal components, embedded
NULs, symlinks, submodules/gitlinks, and every object type except ordinary
trees and `100644`/`100755` blobs. It writes fresh single-link root-owned files,
normalizes them to `0444`/`0555`, makes every directory `0555`, hashes the full
tree manifest into a root-owned `0444` binding, and revalidates that binding on
every use. Never extract an archive over a release tree or edit it in place.

Put policy updates only in the root-owned
`.bundle-v1.new/las-trust-v1` described above, then install the whole bundle.
The bundle installer accepts no path or arguments. It validates headers,
duplicates, operations, digests, same-SHA consistency, all eight stable hashes,
and the capability blob from every exact commit using
`git --no-replace-objects`. `yonaris-deploy` must not have a sudo rule for
either installer. The legacy single-policy installer is bootstrap
compatibility only and must fail closed once the active-bundle pointer exists.

Before publishing any generation, the installer takes the common root-owned
`/run/lock/yonaris` directory-inode lock in exclusive mode and refuses to
proceed while an ordinary release or Caddy bootstrap transition is pending. It
also checks both canonical active-surface markers. For each one that exists,
the candidate policy must preserve one exact `rollback` line matching all five
digests in the root-owned receipt. The same rollback-coverage check runs while
recovering a finalized staging orphan or durable bundle transition; a bundle
update can never silently strand either active surface.

After the exact key, sshd/sudo boundary, forced marker, rootless daemon, runtime
dotenv, object store, and complete staging bundle all pass their static checks,
run the whole-bundle installer directly from that authenticated root console;
it rejects `SUDO_USER` and any argument:

```text
/usr/local/sbin/install-yonaris-las-stable-bundle
```

The installer fsyncs every file, publishes a complete `0555` generation under
`bundles/sha256-*`, atomically changes the root-owned active pointer, invokes
the verifier through that exact generation, and restores the predecessor
pointer on failure. Its three-line durable pending journal binds the exact
predecessor and candidate bundle IDs and reconciles every rename and SIGKILL
window; the five-digest rollback invariant is checked against the receipts and
candidate policy before either activation or recovery. Never edit the active
pointer or pending journal. Rerun the same root-only installer to reconcile an
interrupted publication, then require:

```bash
/usr/local/sbin/verify-yonaris-las-forced-command
```

While the bundle journal, journal temporary, or active-pointer temporary
exists, every forced probe and deployment exits 75 under the common lock before
calling a stable peer or reading Git. The check is intentionally dispatcher
local rather than part of the generic verifier, because the bundle installer
must run that verifier during its own postverification and recovery window.

The verifier checks the full key file, effective sshd boundary, stable hashes,
policy, attestation, activation marker if present, rootless process/socket
identity, absence from the legacy privileged supplemental group, and denial of
the rootful socket.

## Establish the first canonical predecessor

The first forced deployment cannot manufacture its own predecessor. After the
first bundle is active, use its fixed launchers from the same authenticated
root console. The release must already have exact `deploy`,
`marketing-deploy`, and `rollback` policy entries with one identical five-tuple.

After the mandatory adapter is installed, run the producer and exact verifier
sequence above. Do not fabricate its attestation. Once that exact evidence
passes, materialize the release and bootstrap the portal runtime:

```text
/usr/local/libexec/yonaris-las/manage-las-release-state \
  materialize sha-<40-lowercase-git-sha>
/usr/local/libexec/yonaris-las/manage-las-runtime \
  bootstrap-portal-deploy sha-<40-lowercase-git-sha> \
  sha256:<web> sha256:<worker> sha256:<migrate> sha256:<postgres> sha256:<www> \
  portal-bootstrap-runtime-v1
```

Immediately attest the portal surface; the resulting portal marker and
five-digest receipt are the required anchor for marketing bootstrap:

```text
/usr/local/libexec/yonaris-las/manage-las-release-state \
  bootstrap-surface portal sha-<40-lowercase-git-sha> \
  sha256:<web> sha256:<worker> sha256:<migrate> sha256:<postgres> sha256:<www>
/usr/local/libexec/yonaris-las/manage-las-runtime \
  bootstrap-marketing-deploy sha-<40-lowercase-git-sha> \
  sha256:<web> sha256:<worker> sha256:<migrate> sha256:<postgres> sha256:<www> \
  marketing-bootstrap-runtime-v1
```

Both runtime bootstrap operations reject `SUDO_USER` and, immediately before
each Docker mutation, require the exact root-local
`bootstrap-runtime-authorization <surface> <release> <five digests>` response
`las-bootstrap-runtime-authorization-v1 ok`.
Portal authorization requires the immutable tree, `deploy` policy line, and
exact migration-readiness evidence with no active portal marker. Marketing
authorization requires no marketing marker, the `marketing-deploy` policy
line, and the already-attested portal tree/receipt with the same five-tuple.
These are the only pre-surface-marker runtime exceptions, and they still enter
Docker solely through the root-owned stable runtime manager. Gate, deploy, and
candidate code never receive a socket or runtime dotenv.

With portal and www healthy on ports `1515` and `1516`, bootstrap the apex from
the exact immutable fragment:

```text
/usr/local/libexec/yonaris-las/manage-las-caddy \
  bootstrap-activate sha-<40-lowercase-git-sha> \
  sha-<same-40-lowercase-git-sha>
```

`bootstrap-activate` rejects `SUDO_USER`, an existing canonical marketing
marker, or an ordinary transition journal. If the live apex is not already the
release fragment, it saves the arbitrary legacy full Caddyfile as
`root:root 0600` and derives a separately validated secured predecessor that
preserves the legacy business routes while replacing any admin directive with
the exact Unix-socket boundary. Its durable journal binds the secured
predecessor hash as `before`, the candidate hash as `after`, and the untouched
legacy backup hash separately. A retry accepts only those three bound live
states and deterministically re-derives the secured predecessor from the raw
backup.

The helper atomically installs the candidate and restarts `caddy.service` to
move the admin API onto the permissioned Unix socket, then checks both portal
and apex directly against the pinned origin CA. If candidate restart or health
verification fails, rollback installs the secured predecessor, never the raw
legacy file, and clears the journal only after the Unix admin boundary and
origin health both pass. Otherwise it exits 75 with the journal intact. Retry
this exact command until it converges; never clear the journal or replace the
live file by hand.

Only after the portal anchor, live www runtime, and Caddy are verified may the
state manager attest the marketing surface using the same seven-line receipt:

```text
/usr/local/libexec/yonaris-las/manage-las-release-state \
  bootstrap-surface marketing sha-<40-lowercase-git-sha> \
  sha256:<web> sha256:<worker> sha256:<migrate> sha256:<postgres> sha256:<www>
```

`bootstrap-surface` rejects `SUDO_USER`, any pending release/Caddy bootstrap
journal, a conflicting marker/receipt, an invalid tree binding, or a tuple that
does not exactly match the policy and commit capability. It re-verifies actual
runtime digests and HTTP health; marketing also requires the exact live Caddy
fragment. Repeating an identical completed call is idempotent. Runtime or Caddy
success without its corresponding attestation is still an unverified
bootstrap: leave both workflows disabled and retry the exact fixed operation,
never write a marker or receipt manually.

## Probe, deployment, and recovery

The no-side-effect probe is:

```bash
ssh yonaris-gate@las-host 'yonaris-las-v1 probe'
# yonaris-las-probe-v1 ok
```

An arbitrary command such as `true` must exit 2 with exactly
`Refusing non-protocol LAS SSH command.`. Enable both GitHub variables only
after these checks pass **and** the trustworthy migration-evidence producer and
complete predecessor bootstrap described above have been independently
verified. Actions may then send only these canonical argument shapes, with no
quoting variants, environment prefixes, paths, or extra words:

| Shape | Operations |
| --- | --- |
| `yonaris-las-v1 probe` | no-side-effect boundary probe |
| `yonaris-las-v1 deploy sha-<40> <web> <worker> <migrate> <postgres>` | portal transition; every image argument is an exact `sha256:` digest |
| `yonaris-las-v1 <marketing-operation> sha-<40> <www>` | `marketing-preflight`, `marketing-deploy`, `marketing-verify` |

There is no generic operation or request-file grammar. These eleven former
candidate-side operations are permanently absent from the dispatcher, policy
parsers, and production workflow surface:

```text
report-operations
overseas-formal-readiness
overseas-formal-one-shot
response-snapshot-activation
sampling-batch-operation
local-demo-import
reviewed-consumer-cohort-import
program-locale-repair
program-import
response-snapshot-backfill
browser-runner-activation
```

Do not add them to a policy, restore their SSH calls, or execute their legacy
helpers through a socket or dotenv. If a future product need requires host
state or Docker access, it needs a new, separately reviewed fixed operation in
the root-owned stable manager and a new exact protocol; re-enabling one of the
retired names is not a supported migration path.

The deployment workflow currently retains literal `if: ${{ false }}` plan/job
stubs for static regression tests. They are inert compatibility text, not an
operational surface; every such job must remain unconditionally false, while
the dispatcher and policy parsers independently reject the name. Removing the
stubs later is safe, but changing a condition to make one runnable is not.

The release object must already exist in the root bare store, the active bundle
must contain the exact operation and five-tuple policy line, and non-deploy
operations must target the canonical active portal release. The dispatcher
does not fetch a missing object.

Before a portal or marketing runtime switch, the root state manager fsyncs a
pending journal containing surface, candidate, predecessor, operation, and all
five image digests. Immediately before every Docker mutation, the stable
runtime manager requires one exact state-manager response:
`pending-runtime-tuple <surface> <candidate> <five digests>` for the candidate
or `pending-rollback-runtime-tuple <surface> <predecessor> <five digests>` for
rollback. The byte-exact success tokens are respectively
`las-pending-runtime-tuple-v1 ok` and
`las-pending-rollback-runtime-tuple-v1 ok`; any other output fails closed. A
normal portal mutation additionally rechecks
`migration-readiness <candidate> <five digests>`. Compose uses only
`image@sha256`, and completion checks container image and registry
`RepoDigests` before atomically writing the receipt and root-owned canonical
release marker under `/etc/yonaris`. Any legacy `/opt/yonaris/.release`
projection is non-authoritative and is never written by root. The pending
journal is cleared last.

For a normal marketing change, the dispatcher and stable managers execute one
ordered transaction: authorize and materialize both releases; preflight the
candidate www runtime and Caddy fragment; fsync `begin marketing`; have the
Caddy manager build and validate the full candidate file, persist a `0600`
predecessor backup, and bind its before/after/backup hashes into the journal;
start the exact www digest; atomically activate and reload Caddy; verify the www
container digest plus ports `1516`, apex, and portal origin health; then write
the receipt/marketing marker and clear the journal. Candidate code never edits
or mounts `/etc/caddy/Caddyfile`.

If runtime or Caddy activation fails before durable completion, the managers
may return an ordinary failure only after restoring and post-verifying the
hash-bound predecessor runtime and full Caddyfile. Any ambiguous failure keeps
the journal and exits 75. Recovery must compare the live full-file hash with
the journal, use only its root-owned backup, restore the predecessor www digest,
re-run Caddy validation/reload and origin checks, and finally call the exact
state-manager reconciliation. Never copy an unbound Caddyfile over the live
file or delete a backup while its transition may still be pending.

Every dispatcher entry takes that inode lock in shared mode before invoking any
stable peer. While holding it, the dispatcher requires the root-owned `0600`,
single-link active-pointer bytes to name the exact bundle generation captured
by the fixed launcher, then runs that generation's verifier and checks the
transition journal and activation marker. A probe remains under the shared
lock. A normal operation converts the same descriptor to exclusive mode and,
because `flock` conversion is not atomic, repeats the entire pointer, verifier,
journal, and activation check before any object lookup/materialization, state
begin, runtime mutation, or Caddy mutation. If the installer rolls a candidate
pointer back while a request from that generation is queued, the stale pin
fails with exit 75 before any stable peer is reached.

If the journal is present or malformed, all ordinary operations—including
probe, portal, and marketing—fail closed with exit 75. A root operator must
inspect actual container digests, materialize the exact predecessor tree,
restore with that predecessor's Compose file and receipt digests, verify
Caddy/runtime health, and only then run the state manager's exact
`reconcile <surface> <candidate> rollback` command. Never clear or edit the
journal manually, and never ignore a Docker, rename, fsync, health, or rollback
failure.

## One-way Chinese artifact activation

First deploy a compatible release and verify its root-owned v2 receipt and
rollback evidence. Disable both workflows and enter a root-only maintenance
window. Atomically publish a strict runtime dotenv with
`ARTIFACT_ZH_CN_ENABLED=true` and `WORKER_ENABLED=true`, then immediately run:

```text
# Run from an already authenticated root console; do not invoke through sudo.
/usr/local/libexec/yonaris-las/manage-las-release-state activate-output-language
```

This atomically creates the `0400` attestation containing exactly
`artifact-output-language-active-v1`. It has no delete/deactivate command.
For the first activation, the state manager itself invokes the verifier's exact
`preactivate-output-language` mode. That read-only mode requires the marker to
remain absent, both runtime flags to be true, and the complete SSH, rootless
Docker, Caddy, policy, and runtime boundary to pass before the atomic marker
write. Once the marker exists, an idempotent rerun uses the ordinary verifier.
Neither verifier mode is a deploy command or a general bypass. The state
manager also refuses activation during release, Caddy-bootstrap, or stable-
bundle recovery. Run the ordinary root verifier once more before re-enabling
either workflow. No deployment or Docker mutation may run between the dotenv
publication and marker creation.
Once the marker exists, either flag being absent or false also fails before
Docker access. If activation does not complete, keep workflows disabled and
reconcile the root-owned state; never create the marker by hand or leave the
environment for ordinary operation.
After it exists, do not restore an unrestricted key, old dispatcher, old
policy schema, tag-based Compose file, or deploy-user-owned release state.
Rollback is limited to a policy-authorized, digest-bound compatible predecessor
with a durable root receipt and immutable materialized tree. If that evidence
is unavailable, stop the deployment and recover the evidence; do not bypass
the attestation.
