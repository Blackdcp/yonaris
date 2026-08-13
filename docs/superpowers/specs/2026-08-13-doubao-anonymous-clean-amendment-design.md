# Doubao Anonymous-Clean Sampling Amendment

Date: 2026-08-13

## Decision

The first StepFun Doubao delivery will use `anonymous_clean`, not a dedicated signed-in account. Every task launches in a new disposable browser profile. The page must visibly remain signed out before the frozen prompt is submitted.

The existing `dedicated_sampling_profile` capability remains available for a future, separately approved protocol. This amendment does not reinterpret any existing frozen batch.

## Non-scored UAT gate

Before creating the scored 18-task delivery, Laoxu runs one isolated, non-scored UAT with the fixed prompt `请仅回复：测试通过。`.

The UAT must prove:

- the final page is an approved HTTPS Doubao URL;
- the signed-out marker and unique composer are both visible;
- a durable local submit intent is written before the only submission;
- the user message appears once;
- one new answer reaches the approved completion state;
- the full answer, screenshot, and HTML snapshot can be captured;
- native-search evidence is recorded as `true`, `false`, or `null` without guessing.

If anonymous submission triggers login, CAPTCHA, rate limiting, or page drift, the UAT stops. It produces no `prompt_run` and cannot affect StepFun metrics.

## Formal delivery

Only after the UAT passes, create and explicitly start one scored batch containing the three exact enabled StepFun prompts, six samples each, Doubao only, for 18 frozen tasks.

The frozen protocol is:

- market `CN`, locale `zh-CN`, timezone `Asia/Shanghai`;
- session `anonymous_clean`;
- search requirement `platform_default`, observed as `native_auto`;
- exactly one PNG screenshot and one HTML page snapshot per successful task;
- no cron, daily schedule, or automatic batch creation.

## Metric invariants

Elmo formulas remain unchanged. `N` is the 18 frozen slots, `S` is successful persisted observations, and `M` is successful observations with a StepFun mention. Visibility remains `M / S`; technical failures reduce coverage `S / N` but never become negative mentions. A valid answer without StepFun remains a successful `brandMentioned=false` observation.

## Isolation and cleanup

Laoxu must retain the existing Chromium sandbox, AppArmor, separate browser/control identities, exact-host egress proxy, private/metadata/control-plane deny rules, and evidence integrity checks. Each anonymous profile is deleted after successful upload; a post-submit interruption may retain only the bound profile needed for same-session recovery.
