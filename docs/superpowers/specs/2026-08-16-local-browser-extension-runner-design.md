# Local Browser Extension Runner Design

## Objective

Turn Yonaris domestic consumer-web monitoring into a normal product workflow:

1. a platform administrator clicks **Run now** in the Portal;
2. Yonaris freezes the selected Program prompts and creates the work;
3. a paired Chrome extension on a trusted local PC claims the work;
4. the extension opens a new Doubao or DeepSeek conversation for every sample;
5. the extension uploads the answer, citations, query metadata, and answer-container HTML;
6. Yonaris persists the observation and 90-day response snapshot, then exposes the existing Elmo metrics and read-only customer views.

This release is administrator-triggered only. It does not create a daily schedule, run historical batches automatically, or give customer accounts execution permissions.

## Product contract

- Only a global platform administrator can see or invoke **Run now**.
- The administrator selects one measurement Program and one or both supported domestic channels: Doubao and DeepSeek.
- Every enabled Prompt in the selected Program is frozen into the batch.
- Each Prompt is sampled exactly five times on each selected channel, matching the current overseas `RUNS_PER_PROMPT=5` production default.
- The Portal shows the exact task count before confirmation: `prompts x channels x 5`.
- A single user action creates, freezes, and starts one auditable Browser Runner batch. Partial setup is not exposed as a normal successful action.
- Customers remain read-only. They can view resulting metrics, answers, citations, and ready response snapshots for their own brand, but cannot create, start, retry, finalize, or delete runs.
- A valid completed answer with no StepFun mention is a successful observation with `brandMentioned=false`.
- A technical failure creates no `prompt_run`, does not become a negative brand mention, and reduces delivery coverage rather than silently changing the Visibility denominator.

## Recommended architecture

Reuse the existing frozen delivery batch, lease, submit-intent, observation, evidence, and response-snapshot systems. Replace the dedicated-host-only client experience with a cross-platform Chrome extension that implements the existing runner role through a versioned device API.

```text
Platform admin
  -> Portal Run now
  -> frozen delivery batch (Prompt x channel x 5)
  -> extension device task API
  -> Chrome extension coordinator
       -> Doubao content adapter
       -> DeepSeek content adapter
  -> answer + citations + query state + answer HTML
  -> atomic observation persistence
  -> response snapshot archive (HTML + JSON, 90 days)
  -> existing Elmo metrics and customer views
```

The Portal remains the source of truth for task identity, leases, progress, metrics, and retention. The extension never connects directly to PostgreSQL and never calculates customer metrics.

## Portal experience

### Run now

Add **Run now** to the platform Sampling Operations experience. The dialog contains:

- brand and Program;
- enabled Prompt count;
- Doubao and DeepSeek channel checkboxes;
- fixed sample count of five per Prompt/channel;
- exact total task count;
- paired extension online state and version;
- per-channel readiness: ready, signed out, paused by risk control, adapter incompatible, or unavailable.

The action is allowed while no compatible device is online. The resulting batch remains in a clear **Waiting for local runner** state and is not counted as a failure. When an eligible extension returns, it can claim the queued tasks without recreating the batch.

### Progress

The Portal shows one batch with per-channel and overall totals:

- queued;
- running;
- succeeded;
- needs human before submit;
- needs same-session recovery after submit;
- terminal technical failure;
- success coverage and result status.

Existing abandoned Doubao batches are not automatically resumed or modified by this feature.

### Local collection devices

Add a platform-only device view showing:

- device display name and stable public identifier;
- extension version and browser family;
- operating system;
- last heartbeat and online/offline state;
- supported surfaces;
- Doubao and DeepSeek readiness;
- active task count and current adaptive concurrency;
- revoke action.

No cookies, account names, phone numbers, browser history, Portal session cookie, or platform credentials are displayed or stored in this view.

## Extension pairing and authorization

The Chrome extension is the local Runner for Windows and macOS. The same package may later be published for Microsoft Edge.

Pairing uses a short-lived, single-use code initiated by an authenticated platform administrator. On successful exchange, the server issues a random device secret whose hash and device scope are stored server-side. The clear device secret remains only in `chrome.storage.local` and can be revoked from the Portal.

The device credential is restricted to Browser Runner endpoints. It can:

- heartbeat and report coarse readiness;
- claim eligible tasks for an explicitly started batch;
- renew a task lease;
- record submit intent and submission confirmation;
- upload bounded response data and answer HTML;
- mark a task as needing human intervention;
- resume the same task/session when the protocol permits it.

It cannot read arbitrary customer data, list Portal users, call platform-admin APIs, access snapshot exports, or connect to the database. Pairing and task APIs reject Portal admin keys and customer cookies as runner credentials.

The extension background service worker owns the device credential. Content scripts never receive it. A content script receives only the current task payload and an unguessable per-task message nonce. Messages are accepted only from the exact tab and approved origin bound to the active lease.

## Extension components

### Coordinator

The extension background service worker:

- maintains the device heartbeat;
- polls only for explicitly started work;
- keeps a durable local journal containing task IDs, phases, hashes, and retry state, but not retained answer content;
- allocates tasks to per-surface tab pools;
- enforces leases and server-side submit intent before any page submission;
- uploads observations and removes local response material after durable acceptance;
- resumes safely after service-worker suspension or browser restart.

### Surface adapters

Doubao and DeepSeek use separate adapters with a shared contract:

```ts
type ConsumerWebAdapter = {
  surface: "doubao.consumer_web" | "deepseek.consumer_web";
  inspectAuth(): Promise<"ready" | "signed_out" | "challenge" | "unknown">;
  openNewConversation(): Promise<void>;
  prepare(prompt: string): Promise<void>;
  submitOnce(prompt: string): Promise<void>;
  confirmSubmitted(prompt: string): Promise<void>;
  collectCurrentAnswer(): Promise<CollectedAnswer>;
};
```

Every task opens a verified blank conversation. Five samples are five independent conversations. Adapters fail closed when the composer, new-conversation control, user-message confirmation, answer container, completion state, or current-answer identity is ambiguous.

The standard product does not upload an original-site screenshot. It uploads only the current answer container HTML plus canonical structured JSON. The existing full-page/screenshot evidence path remains available for legacy or explicitly contracted forensic workflows but is not required for these extension batches.

## Concurrency and risk control

The extension runs Doubao and DeepSeek independently. Each surface starts with five concurrent tabs and has an adaptive range of one to ten. The coordinator interleaves different Prompts so the five samples of one Prompt are not emitted as an instantaneous identical burst.

Concurrency changes are bounded and explainable:

- stable successes may increase concurrency by one up to the configured maximum;
- HTTP or UI rate-limit evidence immediately reduces concurrency and starts an exponential cooldown;
- login expiry, CAPTCHA, account verification, or ambiguous page state pauses that surface;
- the other surface continues;
- a local operator can pause or resume a surface from the extension popup;
- no proxy rotation, CAPTCHA bypass, automated account creation, stealth fingerprinting, or private webpage API replay is used.

The extension uses the user's normal trusted Chrome environment and persistent per-platform login state. It does not require a VM, VNC, Linux broker, AppArmor policy, or dedicated cloud browser host.

Execution time is governed by platform response time and platform-enforced concurrency. For 60 Prompts on two channels at five samples each, the batch contains 600 tasks. With five active tabs per channel, a practical target is roughly 30–90 minutes, but the Portal presents progress rather than promising a fixed completion time. Risk control may extend the run.

## Exactly-once and recovery semantics

The server persists submit intent, runner session identity, device identity, lease generation, and adapter version before the extension sends a Prompt.

- A clearly pre-submit navigation failure may be retried once.
- Once submit intent exists, the extension never sends that Prompt again for the same task.
- Submission is confirmed by finding the exact frozen user message in the bound tab.
- A post-submit browser restart or service-worker suspension may recover only the same conversation tab/session and exact user message.
- If that identity cannot be proven, the task becomes `needs_human`; it is not re-asked automatically.
- A challenge before submission can be resolved by a human and then continued.
- A challenge after submission must retain the original tab for same-session recovery or be finalized as a technical failure.
- A batch continues processing other claimable tasks and reports all human work after the automatic pass.

## Observation and snapshot persistence

On a successful task, the extension submits:

- frozen Prompt and task identity;
- full answer text;
- sanitized current-answer HTML source;
- public final conversation URL;
- observed timestamp;
- model and adapter versions;
- citations in visible order;
- exposed query fan-out values, or an explicit unavailable state;
- native web-search observation as `true`, `false`, or `null`;
- content hashes and bounded capture metadata.

The server revalidates the task lease, device, surface, URL, session identity, frozen Prompt, payload bounds, and HTML contract. Observation persistence remains atomic with task completion. The response snapshot is then queued from the already-collected immutable content; snapshot failure never re-asks the AI or changes the observation metric.

Response snapshots use the existing `response-snapshot.v1` contract and filesystem storage on LAS:

- sanitized HTML;
- canonical JSON;
- manifest and SHA-256 hashes;
- 90-day retention;
- customer read-only preview and download;
- brand-scoped ZIP export;
- no executable scripts, remote resources, cookies, login state, sidebar history, or whole-page DOM.

## Metric compatibility

The existing Elmo Visibility, Share of Voice, citation, query, and coverage formulas are not changed.

- Only successfully persisted `prompt_runs` enter Visibility's successful-observation denominator.
- A valid answer without a brand mention enters the denominator with `brandMentioned=false`.
- Login, CAPTCHA, UI drift, timeout, lease loss, upload failure, and operator finalization create no `prompt_run`.
- Delivery coverage continues to compare successful observations with the frozen task denominator.
- Channel/model filters expose Doubao and DeepSeek through their existing public model names.
- Snapshot readiness is an independent status and never changes the underlying metric.

## Cross-platform behavior

The first supported browsers are current stable Google Chrome on Windows and macOS. The extension uses standard Manifest V3 APIs and does not depend on OS-specific native messaging. Browser closure makes the device offline; queued work remains safe until Chrome is reopened.

The extension popup provides:

- device connection status;
- current batch and progress;
- per-surface login/readiness state;
- active concurrency and cooldown;
- open-login-page action;
- pause and resume action;
- concise needs-human reason without answer or account PII.

## Testing strategy

### Unit and contract tests

- exact `Prompt x channel x 5` planning and 10,000-task batch cap;
- platform-admin-only Run now authorization;
- one-time device pairing, hashed secrets, revocation, expiry, and scope;
- content-script message nonce and exact tab/origin binding;
- adaptive concurrency boundaries and cooldown transitions;
- submit-intent ordering and no resubmission after intent;
- response payload, URL, HTML, size, and search-tristate validation;
- metric regression proving snapshots and technical failures do not alter Elmo formulas.

### Extension fixture tests

- Doubao and DeepSeek signed-in, signed-out, CAPTCHA, rate-limit, streaming, completed, short-answer, no-mention, citation, search-unknown, and DOM-drift fixtures;
- five independent new conversations per Prompt;
- tab and service-worker restart recovery;
- another tab or an old answer cannot satisfy the current task;
- no Portal credential reaches a target page;
- only the current answer container is uploaded;
- local answer material is removed after durable acceptance.

### Integrated acceptance

1. Run a fully local fake-Portal and fake-surface cohort.
2. Pair one real Chrome extension and run one non-scored Prompt on Doubao and DeepSeek.
3. Run the three StepFun Prompts five times per channel, producing exactly 30 planned tasks.
4. Verify 30 successful or explicitly unresolved task outcomes, correct coverage, channel filters, citations, and ready HTML snapshots.
5. Only after the 30-task pilot passes, run the complete enabled StepFun Program.

No live-site test runs in ordinary CI. Real-site UAT is operator-started, non-scored first, and never bypasses platform challenges.

## Rollout

1. Add the versioned extension device and capability API while leaving creation disabled.
2. Generalize the existing Browser Runner protocol to Doubao and DeepSeek without changing legacy batches.
3. Add the extension package and local fixture harness.
4. Add Portal device management and Run now.
5. Deploy server/database changes with the feature flag off.
6. Install and pair the extension on one trusted Chrome profile.
7. Complete the two one-Prompt non-scored UATs.
8. Enable Run now for platform administrators and execute the 30-task StepFun pilot.
9. Keep recurring scheduling disabled until a separate design and approval.

## Out of scope

- customer-triggered execution;
- recurring or daily scheduling;
- original-site screenshots or pixel-perfect page evidence as a standard feature;
- official API results mixed into consumer-web channel metrics;
- hidden/private web endpoint replay;
- automated login, CAPTCHA solving, account creation, proxy rotation, or fingerprint spoofing;
- Chrome Web Store publication and automated extension updates;
- Safari or Firefox support;
- changing Elmo metric formulas.
