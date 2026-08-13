# Laoxu Browser Runner host assets

These files install the two-identity boundary for the China-host Doubao runner. They do not create a sampling batch, schedule work, enable a unit, start a unit, log in to Doubao, or place a Portal credential into the browser process.

## Security boundary

- `yonaris-runner` is the control identity. Only its root-readable environment file contains the dedicated Runner API credential. It claims frozen tasks, records durable submit intent, uploads evidence, and completes observations.
- `yonaris-browser` is the browser-broker identity. It owns the Playwright profile and Chromium processes, has no database or Portal secrets, and cannot connect to the Yonaris control plane or private/metadata networks.
- `yonaris-browser-rpc` grants the control identity access only to the broker Unix socket and sealed evidence handoff directory. The broker additionally verifies Linux peer credentials.
- Both unprivileged-user-namespace sysctls retain the Ubuntu 24.04 secure values. AppArmor grants `userns` only to the two exact, root-owned, digest-pinned Chromium executables. Chromium's own namespace/seccomp sandbox remains explicitly enabled by the application.
- The browser UID firewall is a final allowlist: public DNS resolvers, then exact IPs resolved from the approved hostname file over TCP 80/443. Control-plane, loopback, private, link-local, metadata, multicast, documentation, and all unlisted destinations are rejected.
- No timer or recurring schedule is installed. Every run begins with an explicit operator action against an already frozen batch.

## Install in disabled state

The pinned source tree and browser tree must already exist, be root-owned, be non-writable by group/other, and include a root-owned `SHA256SUMS` produced from that exact browser revision.

```sh
sudo env \
  YONARIS_SOURCE_DIRECTORY=/opt/yonaris-browser-runner/source \
  YONARIS_NODE_BIN_DIRECTORY=/opt/node-v24.19.0-linux-x64/bin \
  PLAYWRIGHT_BROWSERS_PATH=/opt/yonaris-browser-runner/ms-playwright \
  ./install-host.sh
```

The installer is idempotent for host structure and unit templates. It preserves existing environment and allowlist files, loads the exact-path AppArmor profile, verifies unit syntax, and leaves all live/network gates off. It refuses mutable source/browser trees and never rewrites an existing operator configuration.

Run the read-only host check:

```sh
sudo /usr/local/sbin/yonaris-verify-browser-runner-host
```

## Configuration and one-time UAT

1. Keep `/etc/yonaris-browser-runner/control.env` mode `0600 root:root`. Set its API URL, dedicated runner token, brand ID and DOM fingerprint only after the production Runner API is ready. Never copy that file into the browser account or its environment.
2. Record the approved Doubao selectors in `/etc/yonaris-browser-runner/browser.env`. Keep both adapter verification flags false until a non-scored China-host UAT proves account identity, blank-conversation creation, one prompt submission, response completion, evidence capture and three-state native-search observation.
3. Add every exact Doubao response/CDN hostname observed during UAT to `approved-browser-domains`. Add every Portal/control hostname or fixed origin address to `control-plane-hosts`. Entries are comments, exact hostnames, IPv4 addresses, or IPv6 addresses; wildcard domains are rejected.
4. Review the public DNS resolver addresses in `network.env`, then set `BROWSER_NETWORK_POLICY_ENABLED=true`. Stop both runner processes before reloading the policy because address-set replacement is intentionally not live.
5. Start `yonaris-browser-network.service` manually. Its post-start hook runs the negative probes and atomically writes a short-lived root-owned proof bound to the browser UID, current policy hash, and nft chain. A failed probe prevents the service from becoming active; stopping the service removes both proof files and the nft table. It performs connectivity checks only; it does not authenticate or send a prompt.
6. Run the broker preflight as `yonaris-browser`, using only `browser.env`, before any profile login. It must open a sandboxed disposable `about:blank` page successfully.
7. Provision the dedicated profile in an approved headed desktop session before the proof TTL expires. Every manual login/probe/UAT/provision command independently refuses to launch Chromium unless the root-owned policy is enabled, the network service is active, and the negative-probe proof still matches. A human completes the ordinary Doubao login or challenge. The provisioning command only observes the approved authenticated marker; it never handles credentials, QR codes or challenges.
8. After the non-scored UAT is reviewed, set the matching adapter verification flags and fingerprint, start the broker manually, and finally set `BROWSER_RUNNER_LIVE_ENABLED=true` before manually starting the control unit.

The units are static and intentionally have no `[Install]` section. Starting the control unit pulls in the broker and the already configured network policy, but a false gate makes the chain fail closed.

## Stop and retain evidence

Stop the control unit after the explicit delivery, turn the live gate off, remove its dedicated API token, and stop the broker. Do not delete frozen batches, attempts, handoffs, evidence or successful observations as rollback. Technical failures remain delivery failures and never become negative brand mentions.

When a task reaches login, verification, CAPTCHA or selector drift, the runner retains the same-session handoff and continues the remaining batch. Human recovery may inspect that retained session but must not replay a prompt after durable submit intent.
