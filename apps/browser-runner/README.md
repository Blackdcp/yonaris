# Yonaris Browser Runner

This package is an execution sidecar for frozen sampling batches. It does not calculate Visibility or Share of Voice and does not schedule batches. Successful observations eventually flow into Elmo's existing `prompt_runs` path; technical failures remain delivery failures and never become negative brand mentions.

The package is intentionally source-run with `tsx`. Its `build` and `check-types` scripts validate the TypeScript source without producing a deployment bundle; the CN host starts `src/cli.ts` through the package `start` script.

## Safety boundary

- Fixture mode is the only mode enabled by default. Remote execution additionally requires the dedicated Runner API endpoint and credentials; the current production configuration keeps that API disabled.
- Live Doubao requires `--live --surface doubao`, `BROWSER_RUNNER_LIVE_ENABLED=true`, an API token, and `BROWSER_RUNNER_DOUBAO_ADAPTER_VERIFIED=true`. The verification flag must remain false until a CN-host UAT records `BROWSER_RUNNER_DOUBAO_DOM_FINGERPRINT` and approves `BROWSER_RUNNER_DOUBAO_ANSWER_SELECTOR`, the in-progress/stop-generation `BROWSER_RUNNER_DOUBAO_COMPLETION_SELECTOR`, and `BROWSER_RUNNER_DOUBAO_SEARCH_OFF_SELECTOR`. The last selector must match one unique visible element whose DOM state itself proves search is off (for example, `data-state="off"` or `aria-checked="false"`), not merely the presence of a generic search control.
- There is no cron or daily schedule. `run` executes one explicitly selected batch. `poll` only claims batches explicitly started in Yonaris, and remains fail-closed while the dedicated Runner API or live-adapter gates are disabled.
- The runner never logs in automatically and never bypasses a CAPTCHA. Login, verification and selector drift produce `needs_human` while the rest of the batch continues.
- A transient failure before submit may use one centrally accounted retry. Once durable submit intent exists, the runner never sends the prompt again. It may only confirm or collect from the same browser session.
- Production must run on a dedicated, isolated CN host. The adapter validates the top-level Doubao URL, but application code cannot prove that every browser subresource avoids internal networks. Host/network egress policy must deny RFC1918, link-local/cloud metadata and control-plane destinations, then allow only the approved Doubao and Yonaris API endpoints.

## Local fixture smoke run

```sh
pnpm --filter @workspace/browser-runner start -- run --fixture fixtures/doubao-smoke.json
```

Runner state defaults to the platform user-data directory (`%LOCALAPPDATA%/Yonaris/BrowserRunner` on Windows, `~/Library/Application Support/Yonaris/BrowserRunner` on macOS, or `$XDG_DATA_HOME/yonaris-browser-runner` on Linux); use `--state-dir` to choose another private location. Each run contains a JSONL journal, summary, local fixture observations, an HTML page snapshot, and a PNG screenshot. Directories are restricted to `0700` and files to `0600` where supported.

Production evidence files are removed locally after both artifacts are durably uploaded and the observation is accepted. Journals and failed handoffs are retained for at most seven days by startup cleanup and an hourly sweep in long-running poll mode; successful profiles and completed-assist handoffs are deleted immediately. Cleanup validates every child path, leaves ambiguous data untouched, and records blocked cleanup events in a private retention journal.

## Human handoff

Live tasks use a dedicated persistent browser profile per task. On `needs_human`, the profile, last Doubao URL and handoff metadata are retained. On a machine with a desktop session:

```sh
pnpm --filter @workspace/browser-runner start -- assist --task-id <task-id>
```

The command opens the retained profile in a headed browser. The operator may restore the current page or solve a challenge when the frozen session protocol permits it, but must not resend the prompt. The first deployment must therefore be on a CN runner host that the operator can access locally or through an approved remote-desktop channel. Successful tasks remove their profile; `needs_human` tasks retain it.

For an `anonymous_clean` task, a login wall is terminal: logging in changes the frozen session protocol, so `assist` refuses that handoff. Post-submit handoffs may resume only through the runner-only server lease, reuse the retained profile, verify the exact frozen user message if confirmation was not already durable, and extract without calling the submit action. Pre-submit handoffs are completed through the admin workbench.

There is no daemon scheduler. For an explicitly operator-started production session, run the foreground `poll` process on the CN host, then click **Start** for the already frozen browser-runner batch in Yonaris. The poller consumes only started batches and stops on SIGINT/SIGTERM; it never creates or schedules a batch.

The production answer extractor is fail-closed until its selectors are verified on that runner host. The verified adapter proves search-off before submit and again before evidence, records a durable server-side submit intent before it types or sends anything, counts existing answer nodes before submission, rejects answers while the approved stop-generation marker remains visible, and accepts only a new answer that remains stable for at least eight seconds. Tokens remain in the Node process and are never injected into page JavaScript.
