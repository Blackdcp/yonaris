# StepFun DeepSeek Consumer-Web Sampling Design

## Objective

Collect a directly comparable DeepSeek consumer-web cohort for StepFun using the same three frozen prompts and the same six samples per prompt as the existing Doubao cohort. Publish the results into the existing `China · Simplified Chinese · Scored` measurement scope as the public AI channel `DeepSeek`, without changing Elmo metric formulas or enabling any recurring schedule.

## Frozen measurement contract

- Brand: `stepfun`
- Scope: `cn-zh-scored` (`CN`, `zh-CN`, `Asia/Shanghai`)
- Surface: `deepseek.consumer_web`
- Public model/channel: `deepseek`
- Capture route: `assisted_browser.generic`
- Session: a dedicated DeepSeek sampling profile if authentication is required; credentials never enter Yonaris, manifests, screenshots, or logs
- Search behavior: DeepSeek platform default (`native_auto`)
- Prompts, verbatim:
  1. `国内有哪些主流大模型公司？`
  2. `如果我要选择国产大模型服务商,有哪些推荐?`
  3. `阶跃星辰 StepFun 是一家什么公司？`
- Samples: six independent new conversations per prompt, for exactly 18 planned observations
- Schedule: one explicit run only; no cron, timer, daily batch creation, or long-running poller

The prompt set, sample count, market, locale, timezone, and scored lane remain identical to the Doubao cohort. Only the consumer surface/model changes, so the model filter can compare `Doubao` and `DeepSeek` within one scope.

## Execution design

Use a local-PC, foreground Playwright capture command rather than the production Doubao Browser Runner. The command opens a dedicated DeepSeek browser profile, verifies the top-level host is `chat.deepseek.com`, starts a blank conversation for each slot, submits the frozen prompt exactly once, waits for a completed response, and captures the answer, final conversation URL, search state, exposed web queries, citations, screenshot, and page snapshot.

The page adapter is fail-closed. Stable selectors and completion markers must first pass a non-scored one-prompt UAT. Login, CAPTCHA, rate limiting, ambiguous controls, selector drift, or uncertain post-submit state never trigger blind clicking or a second submission.

## Search and source semantics

The runner does not force DeepSeek's web-search control. It records the product's default behavior:

- `webSearchObserved=true` only when a verified DeepSeek search/source marker is present;
- `webSearchObserved=false` only when a verified explicit no-search state is present;
- otherwise `webSearchObserved=null`.

Absence of citations is not converted into `false`. Queries and citations are extracted only from the current answer container and preserved as returned. This keeps the consumer-channel comparison honest even if DeepSeek's default experience differs from Doubao's.

## Retry and human handling

- A clearly pre-submit transient navigation failure may retry once.
- After the durable submit intent is recorded, the prompt is never automatically resubmitted.
- Post-submit uncertainty is recovered only from the same retained browser conversation/profile.
- Unresolved login, CAPTCHA, rate-limit, page-drift, or post-submit recovery failures are collected after the automatic pass for human handling.
- Technical failures do not create `prompt_runs` and therefore do not become negative brand mentions.
- A valid completed answer that does not mention StepFun is a successful observation with `brandMentioned=false`.

## Production import

Build one immutable DeepSeek manifest containing the exact 3×6 slot matrix, answer text, observed time, stable conversation URL, actual search tri-state, queries, citations, and evidence digests. Validate all 18 slots before any production mutation.

The importer must:

1. require the exact brand, scope, prompt text, surface, route, model, locale, market, and 3×6 identities;
2. use a fixed per-slot source key and manifest fingerprint for idempotency;
3. write all 18 observations, citations, and postconditions in one database transaction;
4. roll back the entire cohort if any identity or aggregate check fails;
5. refuse extra DeepSeek rows for the same import cohort;
6. leave the existing 18 Doubao observations untouched;
7. verify the final DeepSeek run/query/citation/mention totals before commit.

Elmo Visibility and Share-of-Voice formulas remain unchanged. Only valid DeepSeek `prompt_runs` enter their successful-observation denominator.

## Customer experience

Once imported, the existing model filter automatically exposes `All models`, `Doubao`, and `DeepSeek` on Visibility, Share of Voice, Query Fan-Out, Citations, and prompt details. Provider names, capture routes, credentials, and browser internals remain platform-only.

## Verification

- Adapter fixture tests: unique composer/send controls, login/CAPTCHA/rate-limit/page-drift detection, new-conversation isolation, exactly-once submission, completion, current-answer extraction, and search/citation tri-state.
- Capture contract tests: exact frozen prompts, exact six samples each, unique slot/source keys, DeepSeek URL allowlist, evidence digests, and no secrets.
- Import tests: dry run, exact 18-slot validation, idempotent retry, all-or-nothing rollback, no Doubao mutation, and final model-specific totals.
- Metric regression tests: the existing Elmo M/S result is unchanged when the same valid observations are filtered by `model=deepseek`.
- Live UAT: one non-scored prompt first; only after it succeeds may the 18 scored observations run.

## Out of scope

- No production DeepSeek autonomous Browser Runner service in this iteration.
- No API-based DeepSeek samples mixed with consumer-web observations.
- No forced web-search experiment.
- No recurring execution or contract cadence.
- No change to customer permissions, global dashboard formulas, or the existing Doubao cohort.
