# Doubao Anonymous-Clean Amendment Implementation Plan

**Outcome:** Anonymous Doubao was validated without scoring and rejected because submission opened a mandatory login wall. The remaining path is the exact StepFun 3 x 6 delivery through the dedicated sampling profile, without changing Elmo metrics or enabling a daily schedule.

## Constraints

- Keep `dedicated_sampling_profile` as a future optional protocol.
- Do not modify Visibility, Share of Voice, Opportunities, or report formulas.
- Do not create the scored batch before the anonymous UAT passes.
- Do not retry after a durable submit intent; recover only from the same retained session.
- Keep production execution disabled until code, deployment, Laoxu isolation, and UAT gates pass.

## Tasks

- [x] Add a gated `anonymous-uat-once` broker command using a fresh disposable profile, durable intent, and one fixed neutral submit attempt.
- [x] Retain protected screenshot/HTML evidence and prove the anonymous attempt is rejected by the login wall.
- [x] Restore the fixed StepFun request and production protocol to `dedicated_sampling_profile`; fail closed for anonymous Doubao.
- [ ] Run Browser Runner, Worker, Web, Lib, migration, formatting, and build verification.
- [ ] Deploy the compatibility changes with Browser Runner still disabled and confirm production health.
- [ ] Install the immutable release on Laoxu and rerun sandbox/network negative probes.
- [ ] Execute the one-shot anonymous UAT and approve the observed Doubao selector/fingerprint contract.
- [ ] Activate the scoped runner credential, create/freeze/start the fixed 18-task batch, and run it once.
- [ ] Verify 18 terminal slots, successful observations and evidence counts, coverage, and customer-visible results; then disable live execution and remove the temporary runner credential.
