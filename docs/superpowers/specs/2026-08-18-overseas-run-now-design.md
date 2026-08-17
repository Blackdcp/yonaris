# Overseas Bright Data Run Now Design

## Outcome

A global platform administrator can open **Platform administration → Sampling operations**, select an enabled scored overseas Program, choose any of the six Bright Data channels already registered in Yonaris, and start one five-sample cohort. The work runs asynchronously on the existing worker, writes the existing Elmo observations and response snapshots, and exposes progress without creating a recurring schedule.

The first production use is PPIO's `Global Market` Program: 10 enabled Prompts × 6 channels × 5 samples = 300 planned provider calls.

## Fixed product contract

- Only a global platform administrator can start an overseas run.
- Eligible Programs are enabled, scored, manual-only, and use an explicit non-China market and locale supported by the selected Bright Data routes. PPIO `Global Market` is `US / en-US / UTC`.
- The six fixed channels are:
  - ChatGPT consumer web;
  - Perplexity consumer web;
  - Gemini consumer web;
  - Copilot consumer web;
  - Google AI Mode search;
  - Google AI Overview search.
- All six channels are selected by default. An administrator may deselect individual channels before starting.
- Every enabled Prompt is sampled exactly five times on every selected channel.
- The Portal displays the exact paid call count before execution: `Prompts × channels × 5`.
- One click creates one cohort. It does not enable daily automation or change the Program's automatic target configuration.
- Customer accounts remain read-only.
- The Elmo Visibility, Share of Voice, citation, query, and coverage formulas remain unchanged.

## Recommended architecture

Use dedicated overseas cohort and call-slot records plus a dedicated pg-boss queue rather than the domestic delivery-task queue or the legacy recurring `process-prompt` job.

```text
Platform administrator
  -> Portal Overseas Run now
  -> frozen overseas cohort (Prompt × channel × 5)
  -> durable overseas call slots (queue source of truth)
  -> pg-boss overseas-run-call jobs
  -> existing Bright Data provider adapters
  -> existing observation persistence
  -> existing response snapshot archive
  -> existing Elmo metrics and customer views
```

The cohort is the product and audit boundary. It freezes Program identity, Prompt IDs and texts, selected channel descriptors, five sample slots, market/locale/timezone, creator, creation time, and a manifest hash. Its call slots are created in the same database transaction. The worker receives only frozen call identities; it never re-reads a mutable Prompt to decide what text to submit.

Call slots are also the durable dispatch outbox. After the cohort transaction commits, an idempotent dispatcher sends deterministic pg-boss jobs for queued slots. If dispatch is interrupted, the cohort remains visibly `dispatch_pending`; reopening the page or an existing worker maintenance pass may enqueue the missing deterministic jobs without creating a provider call. No recurring measurement schedule is introduced.

The domestic Browser Runner remains separate. Overseas execution does not require a paired local device, Chrome login, or browser extension.

## Why a dedicated queue

The existing scheduled `process-prompt` job selects deployment targets from `SCRAPE_TARGETS`, runs every configured target, and schedules the next cycle. Reusing it for this button would make the paid call set depend on deployment configuration and could accidentally create recurring work.

The existing StepFun overseas one-shot is safe but hard-coded to one brand, three Prompts, one ChatGPT target, and one sample. Its provider invocation, observation persistence, mention analysis, citation extraction, and snapshot archiving are reusable; its fixed request contract is not.

The dedicated queue keeps the new action one-shot, channel-explicit, progress-visible, and idempotent.

## Portal experience

The Sampling Operations page contains separate **Domestic browser run** and **Overseas Bright Data run** cards.

The overseas card shows:

- eligible Program selector;
- enabled Prompt count and Program timezone;
- six channel checkboxes grouped as **AI assistants** and **Google search experiences**;
- provider readiness for every channel;
- fixed five-sample label;
- exact call equation and estimated call count;
- a single **Run N overseas samples now** button.

Provider readiness is server-derived. A channel is startable only when the Bright Data credential exists, its Yonaris target descriptor is registered, its dataset or SERP route is configured, response snapshot storage is writable when snapshot capture is required, and the route supports the Program market and locale. Unavailable channels are disabled with a reason; the server rechecks all conditions during submission.

The action returns after the cohort and all call slots have been durably created and an initial dispatch has been attempted. The browser request does not wait for Bright Data. A dispatch interruption is displayed as pending and is recoverable from the durable call slots.

## Progress and results

Each overseas cohort exposes:

- planned;
- queued;
- running;
- succeeded;
- failed;
- success coverage;
- per-channel totals;
- snapshot ready, pending, and failed totals;
- created and completed timestamps.

The UI refreshes progress from the database. A cohort becomes `completed` after every frozen call is terminal. A partially successful cohort remains complete but is labeled `Incomplete` and displays coverage; failed calls never become negative brand mentions.

The customer dashboard continues to read `prompt_runs`, citations, query values, and response snapshots. Model/channel filters distinguish all six surfaces. Search surfaces retain their own identities and are not relabeled as chatbot responses.

## Idempotency and paid-call safety

The browser generates a random idempotency key for one administrator action. Server-side creation uses that key and one database transaction to create the frozen cohort and all call slots. Repeating the same request returns the same cohort and idempotently dispatches any missing jobs.

Every call has a stable source identity derived from cohort ID, Prompt ID, channel, and sample index. Before invoking Bright Data, the worker atomically claims the observation attempt. A completed call is a no-op; an active call cannot be executed twice.

The UI disables the button while submission is in flight and shows the created cohort immediately. A second deliberate click creates a new cohort and therefore new paid calls; the exact call count remains visible before that action.

Jobs use bounded retries only for failures known to occur before Bright Data accepts a request. The call slot records a paid-submission intent before invoking the provider. Once that intent exists, generic queue retry cannot issue a second provider request for that call. If Bright Data returns a snapshot/job identity, the worker records it as provider submission identity before polling. A crash or timeout after paid-submission intent becomes failed/incomplete and requires operator review rather than automatic replay.

## Channel definitions

| Portal label | Model key | Surface identity | Capture route | Search mode |
|---|---|---|---|---|
| ChatGPT | `chatgpt` | `chatgpt.consumer_web` | `brightdata.chatgpt_dataset` | enabled |
| Perplexity | `perplexity` | `perplexity.consumer_web` | `brightdata.perplexity_dataset` | required |
| Gemini | `gemini` | `gemini.consumer_web` | `brightdata.gemini_dataset` | required |
| Copilot | `copilot` | `copilot.consumer_web` | `brightdata.copilot_dataset` | required |
| Google AI Mode | `google-ai-mode` | `google_search.ai_mode` | `brightdata.google_ai_mode_dataset` | required |
| Google AI Overview | `google-ai-overview` | `google_search.ai_overview` | `brightdata.google_serp` | required |

The list is deliberately fixed and version-controlled. Bright Data may expose other collectors or custom dataset IDs, but they do not appear in Portal until Yonaris has an explicit target descriptor, market/locale contract, extraction tests, snapshot contract, and release review.

## Observation and snapshot behavior

Each successful worker call reuses the existing Bright Data provider and `runModelIteration` persistence path:

- provider raw output is normalized into answer text;
- citations and exposed query fan-out values are stored;
- brand and competitor mentions are computed by the existing analysis function;
- one `prompt_run` is written for one successful call;
- a Bright Data response snapshot is archived as sanitized HTML plus canonical JSON;
- the snapshot remains subject to the existing 90-day retention and customer read-only access policy.

Snapshot failure does not re-run the provider or change the observation metric. It is shown as an independent snapshot status and handled by the existing recovery mechanism.

## Failure isolation

- One call failure does not stop other Prompts or channels.
- One channel outage does not stop the remaining channels.
- Credential, route, market/locale, and snapshot-capacity failures block the cohort before any paid job is created.
- Provider failures after execution begins are persisted against their exact call slot.
- Technical failures create no `prompt_run` and reduce coverage.
- A valid answer without a PPIO mention is a successful observation with `brandMentioned=false`.
- The administrator can inspect failure codes, but the first release does not provide per-call manual replay. A later explicit rerun is a new paid cohort.

## Capacity and cost guardrails

The server caps one overseas cohort at 10,000 calls and uses fixed five-sample slots. The Portal displays calls, not a currency estimate, because actual Bright Data pricing depends on the account contract and product route.

PPIO's first full cohort is exactly 300 calls. Worker concurrency is bounded separately for Bright Data dataset and SERP routes so a large cohort cannot exhaust the worker or supplier concurrency limits. Existing response-snapshot disk capacity checks remain mandatory before queueing.

## Testing strategy

### Planning and authorization

- global platform admin is allowed; customer, report operator, and impersonated sessions are rejected;
- only enabled scored manual-only non-China Programs are eligible;
- all six channel descriptors are exact and stable;
- 10 Prompts × 6 channels × 5 samples produces exactly 300 unique slots;
- duplicate channels, Prompt IDs, or slot identities are rejected;
- market/locale incompatibility fails before queueing;
- the 10,000-call cap is enforced.

### Idempotency and queueing

- repeated idempotency key returns the same cohort and queues no duplicate jobs;
- transaction failure creates neither a partial manifest nor partial call slots;
- interrupted dispatch is recovered from call slots and deterministic job keys without duplicate jobs;
- each slot has a stable paid-call identity;
- completed and in-progress attempts cannot invoke the provider again;
- a post-submission ambiguous failure is not automatically replayed.

### Worker and provider fixtures

- fixture success for each of the six channels;
- citations, queries, answer text, model version, channel identity, and snapshot source are preserved;
- one failing channel does not stop the other five;
- snapshot archival failure keeps the observation successful and marks snapshot recovery state;
- valid no-mention answers lower Visibility normally;
- technical failures never create `prompt_runs`.

### Portal and integrated acceptance

- all six channels are selected by default and can be deselected;
- task equation and progress totals render correctly;
- the customer dashboard channel filters show all completed surfaces;
- a production smoke cohort uses one non-sensitive Prompt, one sample, and one channel before the PPIO 300-call cohort;
- after smoke success, the administrator runs the full PPIO `Global Market` cohort once and verifies metrics plus ready HTML/JSON snapshots.

## Rollout

1. Add the cohort schema, queue contract, fixed six-channel registry, and worker handler behind a disabled server feature flag.
2. Add planning, authorization, idempotency, provider fixture, snapshot, and metric regression tests.
3. Add the Portal overseas card and progress list.
4. Deploy migrations and compatible web/worker images with the feature flag disabled.
5. Enable the feature for platform administrators after verifying all six production route readiness checks.
6. Run one one-Prompt/one-channel production smoke cohort.
7. Run the PPIO 300-call cohort and verify channel totals, Elmo metrics, citations, queries, and snapshots.

No daily schedule is created by this rollout.

## Out of scope

- customer-triggered execution;
- daily or recurring overseas schedules;
- channels without a registered Bright Data route;
- automatic replay of uncertain paid requests;
- changing Elmo metric formulas;
- original-site pixel screenshots;
- mixing domestic Browser Runner tasks with overseas Bright Data cohorts;
- exposing provider credentials, dataset IDs, or raw billing details to customers.
