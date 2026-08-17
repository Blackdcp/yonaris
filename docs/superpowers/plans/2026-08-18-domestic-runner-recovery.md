# Domestic Browser Runner Recovery Implementation Plan

**Goal:** Safely restore Doubao production collection and make DeepSeek release-ready without accessing the restricted DeepSeek account.

## Tasks

- [x] Add persistent per-surface readiness with DeepSeek unavailable by default.
- [x] Poll only locally ready surfaces and preserve the one-task-per-click/first-error-stop contract.
- [x] Enforce an exact server-side adapter-version allowlist; keep DeepSeek unapproved.
- [x] Add selector-aware, sanitized DOM fixtures for DeepSeek failure states without claiming live readiness.
- [x] Make Portal Run now default to effective ready surfaces only and reject overlapping active cohorts.
- [ ] Verify extension, library, web, and production builds plus focused state-machine tests.
- [ ] Deploy and confirm the production Portal/API release while keeping the existing device revoked.
- [ ] Re-pair extension version 0.2.x, verify Doubao ready and DeepSeek unavailable.
- [ ] Run one Doubao PPIO scored canary and verify observation, prompt run, evidence, snapshot, and Portal visibility.
- [ ] Finish one ten-Prompt Doubao round one task at a time, stopping on the first issue.
- [ ] After the DeepSeek account recovers, add the live read-only qualification control and one non-scored canary path, then approve only the field-proven adapter version.

## Release gates

- No real DeepSeek page access, claim, or Prompt submission before the user confirms account recovery.
- No bulk 50/100-task production execution during the recovery rollout.
- No metric formula changes.
- No staging of local profiles, run artifacts, `.codex-tmp`, or unrelated generated files.
