# Yonaris Browser Runner

This package is an execution sidecar for frozen sampling batches. It does not calculate Visibility or Share of Voice and does not schedule batches. Successful observations eventually flow into Elmo's existing `prompt_runs` path; technical failures remain delivery failures and never become negative brand mentions.

The package is intentionally source-run with `tsx`. Its `build` and `check-types` scripts validate the TypeScript source without producing a deployment bundle; the CN host starts `src/cli.ts` through the package `start` script.

## Safety boundary

- Fixture mode is the only mode enabled by default. Remote execution additionally requires the dedicated Runner API endpoint and credentials; the current production configuration keeps that API disabled.
- Live Doubao requires `--live --surface doubao`, `BROWSER_RUNNER_LIVE_ENABLED=true`, an API token, and `BROWSER_RUNNER_DOUBAO_ADAPTER_VERIFIED=true`. The verification flag must remain false until a CN-host UAT records `BROWSER_RUNNER_DOUBAO_DOM_FINGERPRINT` and approves the answer, completion, authenticated-account, new-conversation, and user-message selectors. `BROWSER_RUNNER_DOUBAO_SEARCH_OFF_SELECTOR` remains mandatory only for a frozen `forbidden` search contract. A `platform_default` task uses native-auto search: `BROWSER_RUNNER_DOUBAO_SEARCH_USED_SELECTOR` and `BROWSER_RUNNER_DOUBAO_SEARCH_NOT_USED_SELECTOR` may establish `true` or `false`; neither or conflicting visible markers records `null`.
- There is no cron or daily schedule. `run` executes one explicitly selected batch. `poll` only claims batches explicitly started in Yonaris, and remains fail-closed while the dedicated Runner API or live-adapter gates are disabled.
- The runner never logs in automatically and never bypasses a CAPTCHA. A human must provision a separate sampling-only account profile before execution. Login, verification and selector drift produce `needs_human` while the rest of the batch continues.
- A transient failure before submit may use one centrally accounted retry. Once durable submit intent exists, the runner never sends the prompt again. It may only confirm or collect from the same browser session.
- Production must run on a dedicated, isolated CN host. The adapter validates the top-level Doubao URL, but application code cannot prove that every browser subresource avoids internal networks. Host/network egress policy must deny RFC1918, link-local/cloud metadata and control-plane destinations, then allow only the approved Doubao and Yonaris API endpoints. The current single-process runner gives Node and Chromium the same host identity, so it cannot express “Node may call Yonaris while Chromium may not” by UID rules alone; use separate cgroups, network namespaces, or split process identities if that distinction is required.

## Host and Chromium sandbox preflight

Playwright's Chromium sandbox defaults to off, so every runner launch explicitly sets `chromiumSandbox: true`. A host is not eligible for live execution until this command exits successfully:

```sh
pnpm --filter @workspace/browser-runner start -- preflight --state-dir /var/lib/yonaris-browser-runner
```

On Ubuntu 24.04, keep `kernel.apparmor_restrict_unprivileged_userns=1`. Do not use `--no-sandbox`, do not set the restriction to `0`, and do not use a broad wildcard profile. Install Chromium in a root-owned fixed path whose parent directories are not writable by the runner, pin and verify its SHA-256, and attach an AppArmor profile to that exact executable path containing `userns,`. Load it with `apparmor_parser -r`, confirm the profile is enforced with `aa-status`, then run the preflight as the unprivileged runner account. A Playwright cache under the runner's writable home is not an acceptable AppArmor attachment path for production.

Ubuntu documents that 24.04 restricts unprivileged user namespaces by default and that applications needing them must be explicitly allowed by an AppArmor profile. Playwright documents that `chromiumSandbox` defaults to false. These host steps preserve both controls rather than disabling either one.

## Dedicated sampling account provisioning

Use an account reserved for sampling, with no personal history or unrelated activity. After the approved positive account selector has been recorded in `BROWSER_RUNNER_DOUBAO_AUTHENTICATED_SELECTOR`, an operator with access to the host desktop runs:

```sh
pnpm --filter @workspace/browser-runner broker -- provision-dedicated-profile
```

The command opens a sandboxed headed browser and waits up to ten minutes. Before launch, the broker CLI verifies the live root-owned network-service marker and fresh negative-probe receipt; it does not run privileged probes itself. The operator performs the normal Doubao login or challenge directly. The runner does not type credentials, click login, scan a QR code, or bypass verification. It marks the profile ready only when one approved authenticated-account marker is visible and the login button is absent. Runtime tasks use the honest `dedicated_sampling_profile` session requirement, open a verified blank new conversation for every task, and reuse the account only sequentially. An active-task marker binds the profile to the central task/session identity; a missing, stale, or concurrent marker fails closed.

For first-time selector discovery, the broker exposes three deliberately separate operator commands. `login-window` opens the same sandboxed headed profile without requiring selectors and without writing the ready marker. `probe-selectors` performs a read-only scan and prints only bounded neutral selector candidates plus coarse login/composer state; it never prints page text, HTML, cookies, storage, URLs with query data, or account identifiers. `uat-once` records an exclusive, fsynced local intent before it sends one fixed non-sensitive prompt, can run at most once for that unapproved profile, never contacts the Portal, and reports only structural candidate changes. None of these commands marks the profile ready or contributes an observation. The formal `provision-dedicated-profile` command remains the only path that can write the ready marker and still requires an explicitly approved authenticated selector.

For an anonymous-first rollout, use `broker anonymous-uat-once`. It requires the visible signed-out Doubao marker and a unique composer, writes one state-wide durable intent before sending the same fixed non-sensitive prompt exactly once, and uses a disposable profile that is deleted when the command exits. It never contacts the Portal, never creates a `prompt_run`, and cannot be rerun against the same state directory. Only after this non-scored UAT proves the selector/completion contract may a formal `anonymous_clean` batch be frozen and explicitly started.

## Local fixture smoke run

```sh
pnpm --filter @workspace/browser-runner start -- run --fixture fixtures/doubao-smoke.json
```

Runner state defaults to the platform user-data directory (`%LOCALAPPDATA%/Yonaris/BrowserRunner` on Windows, `~/Library/Application Support/Yonaris/BrowserRunner` on macOS, or `$XDG_DATA_HOME/yonaris-browser-runner` on Linux); use `--state-dir` to choose another private location. Each run contains a JSONL journal, summary, local fixture observations, an HTML page snapshot, and a PNG screenshot. Directories are restricted to `0700` and files to `0600` where supported.

Production evidence files are removed locally after both artifacts are durably uploaded and the observation is accepted. Journals and failed handoffs are retained for at most seven days by startup cleanup and an hourly sweep in long-running poll mode; successful profiles and completed-assist handoffs are deleted immediately. Cleanup validates every child path, leaves ambiguous data untouched, and records blocked cleanup events in a private retention journal.

## Human handoff

Anonymous live tasks use a persistent browser profile per task. Dedicated-account tasks share the separately provisioned sampling profile sequentially and retain an active-session marker on `needs_human`. On a machine with a desktop session:

```sh
pnpm --filter @workspace/browser-runner start -- assist --task-id <task-id>
```

The command opens the retained profile in a headed browser. The operator may restore the current page or solve a challenge when the frozen session protocol permits it, but must not resend the prompt. The first deployment must therefore be on a CN runner host that the operator can access locally or through an approved remote-desktop channel. Successful tasks remove their profile; `needs_human` tasks retain it.

For an `anonymous_clean` task, a login wall is terminal: logging in changes the frozen session protocol, so `assist` refuses that handoff. Post-submit handoffs may resume only through the runner-only server lease, reuse the retained profile, verify the exact frozen user message if confirmation was not already durable, and extract without calling the submit action. Pre-submit handoffs are completed through the admin workbench.

There is no daemon scheduler. For an explicitly operator-started production session, run the foreground `poll` process on the CN host, then click **Start** for the already frozen browser-runner batch in Yonaris. The poller consumes only started batches and stops on SIGINT/SIGTERM; it never creates or schedules a batch.

The production answer extractor is fail-closed until its selectors are verified on that runner host. The verified adapter proves search-off before submit and again before evidence, records a durable server-side submit intent before it types or sends anything, counts existing answer nodes before submission, rejects answers while the approved stop-generation marker remains visible, and accepts only a new answer that remains stable for at least eight seconds. Tokens remain in the Node process and are never injected into page JavaScript.

## One-shot local DeepSeek cohort

The StepFun DeepSeek comparison is a separate local-PC workflow. It does not use the Doubao service principal, does not claim Sampling batches, and never starts a poller or recurring schedule. It uses one dedicated local DeepSeek profile and writes a reviewed production manifest only after all three frozen prompts complete six independent conversations each.

```powershell
pnpm --filter @workspace/browser-runner deepseek -- login-window --state-dir C:\Users\operator\AppData\Local\Yonaris\DeepSeekSampling
pnpm --filter @workspace/browser-runner deepseek -- probe-selectors --state-dir C:\Users\operator\AppData\Local\Yonaris\DeepSeekSampling
pnpm --filter @workspace/browser-runner deepseek -- uat-once --state-dir C:\Users\operator\AppData\Local\Yonaris\DeepSeekSampling --selectors apps\browser-runner\src\deepseek-selector-contracts\deepseek-web-20260814-uat1.json
pnpm --filter @workspace/browser-runner deepseek -- run-cohort --state-dir C:\Users\operator\AppData\Local\Yonaris\DeepSeekSampling --selectors apps\browser-runner\src\deepseek-selector-contracts\deepseek-web-20260814-uat1.json --output C:\reviewed\stepfun-local-pc-deepseek-18-20260814.json
pnpm --filter @workspace/browser-runner deepseek -- review-evidence --file C:\reviewed\stepfun-local-pc-deepseek-18-20260814.json --evidence-dir C:\Users\operator\AppData\Local\Yonaris\DeepSeekSampling\evidence --output C:\reviewed\stepfun-local-pc-deepseek-18-20260814-reviewed.json
```

`login-window` performs no automatic input and waits until the operator closes the browser. `probe-selectors` is read-only and prints no page text, cookies, storage, phone number, or login data. `uat-once` durably records intent before one fixed non-scored prompt and cannot be repeated in the same state directory. `run-cohort` refuses a missing or mismatched UAT approval, retries only one clearly pre-submit navigation failure, never resends after intent, and withholds the import manifest until all 18 observations are complete. `review-evidence` re-hashes every saved screenshot and HTML page, requires positive DeepSeek read-webpages evidence before recording observed search, and never invents hidden query strings. Search remains `native_auto`; missing search evidence is stored as unknown rather than false.
