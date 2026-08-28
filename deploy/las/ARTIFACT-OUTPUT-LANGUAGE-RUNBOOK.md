# LAS forced-command and output-language runbook

This is a root-operated trust procedure for the Portal LAS runtime. GitHub
Actions receives only a fixed forced-command protocol; it never receives an
unrestricted shell, the Docker socket, the runtime dotenv, receipt write
access, journal write access, or stable-program update access.

## Final Portal-only contract

Every active release decision binds one immutable Git release and exactly four
registry digests, in this order: Web, Worker, migration, and PostgreSQL. The
only forced operations are:

```text
yonaris-las-v1 probe
yonaris-las-v1 deploy sha-<40-lowercase-git-sha> \
  sha256:<web> sha256:<worker> sha256:<migrate> sha256:<postgres>
yonaris-las-v1 rollback sha-<40-lowercase-git-sha> \
  sha256:<web> sha256:<worker> sha256:<migrate> sha256:<postgres>
```

There is no second application surface, fifth active digest, second Compose
project, or second loopback application port. LAS does not edit, reload,
restore, or derive hashes for host Caddy configuration. The stable Caddy peer
accepts only `verify-boundary`: it validates the root-owned configuration,
permissioned Unix admin socket, pinned origin CA, and direct Portal origin
health without changing any host state.

New healthy receipts are six-line v3 records under
`/etc/yonaris/las-compatible-releases-v3/<release>`:

```text
artifact-output-language-receipt-v3
release sha-<40-lowercase-git-sha>
web-sha256 sha256:<64-lowercase-hex>
worker-sha256 sha256:<64-lowercase-hex>
migrate-sha256 sha256:<64-lowercase-hex>
postgres-sha256 sha256:<64-lowercase-hex>
```

Seven-line v2 receipts under `/etc/yonaris/las-compatible-releases-v2` are
read-only rollback compatibility. They begin with
`artifact-output-language-receipt-v2` and bind the release plus five digest
lines. The fifth legacy digest line is still schema-validated as `www-sha256`,
but it never enters policy, a request, a journal, migration readiness, runtime
authorization, or a newly written receipt. A v2 and v3 receipt may coexist for
the same release only when their Web, Worker, migration, and PostgreSQL digests
match exactly. Any malformed receipt or conflicting pair fails closed. The v2
file is never rewritten or used to reintroduce its retired capability; a
successful `complete` or Portal bootstrap always writes v3.

## Fixed trust boundary

The one Actions key is identified by this fingerprint:

```text
SHA256:gM/QEgkfN99cP/Cf9awUOwSb7FMesQTgRCTI9kPh84A
```

`/home/yonaris-gate/.ssh/authorized_keys` must be byte-for-byte this one
LF-terminated line, with no comments, blank lines, or additional keys:

```text
restrict,command="/usr/bin/sudo -n /usr/local/libexec/yonaris-las/dispatch-las-command" ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAINm/JTgoBi4QJiP0KunOfVuG3JDd6NpxlVdZ3l9xzTWg yonaris-las-operator-2026-08-06
```

The sudoers file contains only the fixed dispatcher capability:

```sudoers
Cmnd_Alias YONARIS_LAS_DISPATCH = /usr/local/libexec/yonaris-las/dispatch-las-command
Defaults!YONARIS_LAS_DISPATCH secure_path=/usr/bin:/bin:/usr/sbin:/sbin
Defaults!YONARIS_LAS_DISPATCH env_reset
Defaults!YONARIS_LAS_DISPATCH env_keep += "SSH_ORIGINAL_COMMAND"
Defaults!YONARIS_LAS_DISPATCH env_delete += "BASH_ENV ENV CDPATH GLOBIGNORE BASHOPTS SHELLOPTS LD_PRELOAD LD_LIBRARY_PATH PYTHONPATH PERL5LIB RUBYLIB"
yonaris-gate ALL=(root) NOPASSWD: YONARIS_LAS_DISPATCH
```

Verify the effective SSH configuration reports only
`authorizedkeysfile .ssh/authorized_keys`, `authorizedkeyscommand none`, and
`permituserenvironment no`. `yonaris-gate`, `yonaris-deploy`, and
`yonaris-runtime` are distinct locked identities. None belongs to the rootful
`docker` group or can access `/var/run/docker.sock`; only `yonaris-runtime` can
access its dedicated rootless daemon.

The authoritative root-owned state is:

| Path | Owner/mode | Contract |
| --- | --- | --- |
| `/var/lib/yonaris/las-objects.git` | `root:root 0700` | local-only reviewed Git object store |
| `/var/lib/yonaris/las-release-trees` | `root:root 0555` | immutable materialized release trees and bindings |
| `/etc/yonaris/las-runtime.env` | `root:yonaris-runtime 0440` | stable runtime manager input; never sourced by a deploy process |
| `/usr/local/libexec/yonaris-las/bundles/sha256-*` | `root:root 0555` | immutable complete stable-program and policy generations |
| `/etc/yonaris/las-stable-bundle-active-v1` | `root:root 0600` | atomic active-generation pointer |
| `/etc/yonaris/las-stable-bundle-pending-v1` | `root:root 0600` | durable bundle-publication journal |
| `/etc/yonaris/las-transition-pending-v1` | `root:root 0600` | Portal transition journal with four digests |
| `/etc/yonaris/las-compatible-releases-v3` | `root:root 0755` | v3 Portal receipts; receipt files are `0644` |
| `/etc/yonaris/las-compatible-releases-v2` | `root:root 0755` | read-only legacy v2 receipts |
| `/etc/yonaris/las-active-portal-release-v1` | `root:root 0644` | canonical active release marker |
| `/etc/yonaris/las-migration-readiness-v2` | `root:root 0700` | four-digest readiness attestations |
| `/etc/yonaris/las-migration-evidence-v2` | `root:root 0700` | immutable backup and rehearsal evidence |
| `/etc/yonaris/las-forced-command-active` | `root:root 0600` | forced-boundary attestation |
| `/etc/yonaris/artifact-output-language-active-v1` | `root:root 0400` | one-way output-language activation attestation |
| `/run/lock/yonaris` | `root:root 0700` | common directory-inode lock |

The candidate checkout cannot update the trust policy, any stable program,
the forced key, runtime environment, receipts, markers, journals, or release
trees. Candidate code never receives a Docker socket. The fixed dispatcher,
guard (`/usr/local/libexec/yonaris-las/guard-artifact-output-release`), state
manager, runtime manager, read-only Caddy verifier, migration
producer, and root verifier execute only through the generation named by the
active bundle pointer.

## Root-local bootstrap and bundle publication

Keep the workflow disabled and work from an already authenticated root console.
Provision the locked identities, rootless runtime, root-owned paths, exact key
and sudoers boundary, reviewed `/etc/yonaris/las-runtime.env`, pinned Portal
origin CA, and local-only object store before publishing a bundle. Do not
create a marker, receipt, evidence file, or journal by hand.

Stage one complete reviewed generation at
`/usr/local/libexec/yonaris-las/.bundle-v1.new`. It contains the eight stable
programs with their exact names plus `las-trust-v1`; the policy binds every
program hash, the Actions key fingerprint, the allowed operation, release, and
four-digest tuple. Compare hashes out of band and run `/bin/bash -n` on every
shell entrypoint before publication. Then invoke the no-argument root-only
installer directly:

```text
/usr/local/sbin/install-yonaris-las-stable-bundle
```

The installer validates and fsyncs the complete generation, publishes an
immutable bundle, atomically moves `/etc/yonaris/las-stable-bundle-active-v1`,
and post-verifies through that exact generation. Its durable journal reconciles
only bundle-pointer publication windows; it restores the prior pointer if the
candidate generation fails verification. Never update one live stable program
or policy file independently, and never edit the active pointer or journal.

The active policy grammar has only `deploy` and `rollback` allow lines, each
with Web, Worker, migration, and PostgreSQL digests. All allow lines for one
release use the same four values. The operator must add every release SHA and operation
after reviewing its immutable tree, capability token, image provenance, and
rollback evidence. A `rollback` line is mandatory for each active or retained
rollback release. The candidate checkout cannot update the trust policy; later
policy changes are complete bundle publications from the root trust process.

After publication, the root verifier must succeed before a workflow or
bootstrap mutation:

```text
/usr/local/sbin/verify-yonaris-las-forced-command
```

## Migration-readiness v2

Every Portal bootstrap and deploy requires an exact v2 readiness attestation
for the release and its four digests. The root-only producer performs the
production backup, separately administered off-host put/get round trip,
isolated restore and migration rehearsal, and no-replace publication. It writes
immutable `root:root 0400` backup and rehearsal evidence under
`/etc/yonaris/las-migration-evidence-v2`, then an eight-line attestation under
`/etc/yonaris/las-migration-readiness-v2`:

```text
las-migration-readiness-v2
release sha-<40-lowercase-git-sha>
web-sha256 sha256:<64-lowercase-hex>
worker-sha256 sha256:<64-lowercase-hex>
migrate-sha256 sha256:<64-lowercase-hex>
postgres-sha256 sha256:<64-lowercase-hex>
backup-evidence-sha256 <64-lowercase-hex>
rehearsal-evidence-sha256 <64-lowercase-hex>
```

The producer and state verifier must return exactly
`las-migration-readiness-v2 ok`. Do not copy a developer rehearsal log into
these roots or create, edit, rename, or hash production evidence manually.
Legacy readiness and evidence roots do not authorize a Portal mutation.

## Establish the first canonical predecessor

The first forced deploy cannot invent its rollback predecessor. The reviewed
commit and all four image digests must already be in the root object store and
active policy, with matching `deploy` and `rollback` allow lines. Install the
reviewed off-host backup adapter and use this order from the authenticated root
console:

```text
/usr/local/libexec/yonaris-las/manage-las-release-state \
  materialize sha-<40-lowercase-git-sha>
/usr/local/libexec/yonaris-las/produce-las-migration-readiness \
  sha-<40-lowercase-git-sha> \
  sha256:<web> sha256:<worker> sha256:<migrate> sha256:<postgres>
/usr/local/libexec/yonaris-las/manage-las-release-state \
  migration-readiness \
  sha-<40-lowercase-git-sha> \
  sha256:<web> sha256:<worker> sha256:<migrate> sha256:<postgres>
/usr/local/libexec/yonaris-las/manage-las-runtime \
  bootstrap-portal-deploy sha-<40-lowercase-git-sha> \
  sha256:<web> sha256:<worker> sha256:<migrate> sha256:<postgres> \
  portal-bootstrap-runtime-v2
```

Immediately attest the portal surface:

```text
/usr/local/libexec/yonaris-las/manage-las-release-state \
  bootstrap-surface portal sha-<40-lowercase-git-sha> \
  sha256:<web> sha256:<worker> sha256:<migrate> sha256:<postgres>
```

Across bootstrap authorization, runtime verification, and final attestation,
the stable peers recheck the immutable tree, policy tuple, migration readiness,
actual container and registry digests, Portal health, and read-only Caddy
boundary. Successful attestation writes a v3 receipt and the canonical Portal
marker transactionally. An identical completed call is idempotent. If runtime
success is not attested, keep the workflow disabled and retry the same stable
operation; never fabricate the receipt or marker.

## Probe, deploy, rollback, and recovery

Before enabling the workflow, require the exact side-effect-free probe:

```text
ssh yonaris-gate@las-host 'yonaris-las-v1 probe'
# yonaris-las-probe-v1 ok
```

An arbitrary command such as `true` must exit 2 with exactly
`Refusing non-protocol LAS SSH command.`. The dispatcher does not fetch missing
Git objects and accepts no environment prefixes, alternate quoting grammar,
paths, tags, or extra words.

A normal deploy preserves this order under the common lock:

1. pin and verify the active stable bundle, forced boundary, activation marker,
   and clear journal state;
2. authorize and materialize the candidate and active predecessor, validate
   the predecessor receipt and rollback policy, and preflight the candidate;
3. verify candidate migration-readiness v2 for the exact four digests;
4. fsync a Portal-only transition journal containing surface, candidate,
   predecessor, operation, and the four candidate digests;
5. switch the stable rootless runtime, then verify exact container image IDs,
   registry `RepoDigests`, database migration state, and Portal health;
6. atomically write the v3 receipt and active marker, then clear the journal
   last.

If candidate activation fails, the stable dispatcher restores the receipt-bound
predecessor tuple, post-verifies it, reconciles rollback state, and only then
returns the candidate failure. If restoration or verification is ambiguous,
the journal remains and the command exits 75. It never changes Caddy as part of
deployment or compensation.

An explicit `yonaris-las-v1 rollback` is a new Portal transition, not a journal
shortcut. Before mutation, the guard requires the exact rollback policy line,
immutable tree, matching v3 receipt or compatible v2 receipt, and
migration-readiness v2 for the requested four-digest tuple. The state manager
journals that tuple; the runtime manager switches and verifies it; `complete`
writes a v3 receipt and active marker and clears the journal last. This ordering
also upgrades a rollback target that has only a legacy v2 receipt without
modifying that legacy file.

While a final Portal journal is pending or malformed, all ordinary forced
operations, including probe, fail closed. Preserve the journal and inspect the
root-owned status and actual runtime evidence. A root recovery must make an
explicit choice: verify and complete the journaled candidate, or restore and
post-verify the journaled predecessor before asking the stable state manager to
reconcile rollback. Do not clear or edit a journal, write a receipt or marker,
or use raw Docker/Compose commands to bypass the stable runtime manager.

An incomplete legacy Caddy-era journal is not a Portal-only transition. This
includes `/etc/yonaris/las-caddy-bootstrap-pending-v1` and an old
`las-transition-v2` record under `/etc/yonaris/las-transition-pending-v1` that
contains a fifth digest or Caddy transition fields. The final programs keep
such state fail-closed and perform no automatic conversion, runtime mutation,
or Caddy mutation. Keep the workflow disabled, preserve the journal and its
referenced evidence, and use a separately reviewed root recovery plan to choose
an explicit state migration or a policy- and receipt-bound Portal rollback.
Only after that choice is fully restored and post-verified may an operator
migrate the durable state; never delete the old journal to make `probe` pass.

## One-way Chinese artifact activation

First verify a compatible active Portal release, four-digest rollback evidence,
clear transition and bundle journals, and the ordinary root verifier. Disable
the workflow for a root-only maintenance window. Atomically publish the strict
runtime dotenv with `ARTIFACT_ZH_CN_ENABLED=true` and `WORKER_ENABLED=true`,
then, without an intervening deployment or Docker mutation, invoke:

```text
/usr/local/libexec/yonaris-las/manage-las-release-state activate-output-language
```

The state manager uses the verifier's exact read-only preactivation mode and
atomically creates `/etc/yonaris/artifact-output-language-active-v1` containing
only `artifact-output-language-active-v1`. It has no delete or deactivate
operation. Run the ordinary root verifier again before re-enabling the
workflow. If activation does not complete, leave the workflow disabled and
reconcile root-owned state; never create the marker by hand.

After it exists, do not restore an unrestricted key, old dispatcher, old
policy grammar, tag-based Compose input, or deploy-owned state. Both runtime
flags remain mandatory. Rollback is limited to a policy-authorized immutable
release with four matching digests and a durable v3 or compatible v2 receipt;
if that evidence is unavailable, stop rather than bypassing the attestation.
