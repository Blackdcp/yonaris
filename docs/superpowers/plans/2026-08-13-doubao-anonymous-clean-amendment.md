# Doubao Anonymous-Clean Amendment Implementation Plan

**Goal:** Validate anonymous Doubao once without scoring, then run the exact StepFun 3 x 6 delivery without changing Elmo metrics or enabling a daily schedule.

## Constraints

- Keep `dedicated_sampling_profile` as a future optional protocol.
- Do not modify Visibility, Share of Voice, Opportunities, or report formulas.
- Do not create the scored batch before the anonymous UAT passes.
- Do not retry after a durable submit intent; recover only from the same retained session.
- Keep production execution disabled until code, deployment, Laoxu isolation, and UAT gates pass.

## Tasks

- [ ] Add red tests proving Browser Runner accepts the anonymous/native-auto protocol and the fixed StepFun request requires `anonymous_clean`.
- [ ] Implement the minimum protocol/UI/request changes while preserving dedicated-profile compatibility.
- [ ] Add a gated `anonymous-uat-once` broker command using a fresh disposable profile, durable intent, and exactly one fixed neutral submission.
- [ ] Run Browser Runner, Worker, Web, Lib, migration, formatting, and build verification.
- [ ] Deploy the compatibility changes with Browser Runner still disabled and confirm production health.
- [ ] Install the immutable release on Laoxu and rerun sandbox/network negative probes.
- [ ] Execute the one-shot anonymous UAT and approve the observed Doubao selector/fingerprint contract.
- [ ] Activate the scoped runner credential, create/freeze/start the fixed 18-task batch, and run it once.
- [ ] Verify 18 terminal slots, successful observations and evidence counts, coverage, and customer-visible results; then disable live execution and remove the temporary runner credential.
