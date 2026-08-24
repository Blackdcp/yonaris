# Domestic Browser Runner Recovery Design

## Objective

Restore the domestic collection flow after the 2026-08-18 failed PPIO run without risking another account restriction or corrupting Yonaris metrics.

The immediate release has two outcomes:

1. Doubao can complete one production PPIO measurement round and expose successful answers plus HTML snapshots in the existing customer Portal.
2. DeepSeek is fully wired and testable offline, but remains unable to claim real work until an administrator performs a successful read-only qualification after the restricted account has recovered.

## Approved operating contract

- Work is administrator-started only. No recurring work alarm or daily scheduler is introduced.
- One explicit extension action executes at most one task globally.
- Only locally qualified `ready` surfaces are polled. An unavailable DeepSeek surface must neither receive a claim nor make a Doubao run look incomplete.
- The first login, CAPTCHA, account restriction, page drift, timeout, or ambiguous state stops that surface. Remaining delivery tasks stay queued or become explicit human work; no subsequent task is claimed in the same action.
- A durable submit intent is stored before sending. After it exists, the frozen Prompt is never sent again for that task.
- Pre-submit human recovery may continue only the exact task in its preserved tab. Post-submit recovery may collect only from the exact original tab and session and never calls submit.
- Technical failures create no `prompt_run`. Valid successful answers enter the existing Yonaris denominator, including a valid answer with `brandMentioned=false`.
- Standard evidence remains sanitized answer HTML plus canonical JSON under the existing 90-day snapshot policy. Original-site screenshots are not required.

## Surface qualification

Each paired extension stores a coarse local qualification per surface:

- `ready`: a read-only preflight proved the approved origin, authenticated state, unique new-conversation control, unique composer, and approved adapter version;
- `signed_out`, `paused_by_risk_control`, `adapter_incompatible`, or `unavailable`: no work may be claimed.

DeepSeek defaults to `unavailable`. Offline tests prove the state machine and execute the bundled selectors against sanitized DOM fixtures, but they do not mark the live adapter ready. The current recovery release intentionally has no production control that can enable DeepSeek. After the account recovers, the next controlled release must first validate the current live DOM without sending a Prompt, then expose one non-scored one-task canary. Only that successful canary may add the observed adapter version to the server allowlist for scored batches.

The server independently allowlists approved adapter versions. A stale, unknown, or pending DeepSeek version is not eligible even if a client reports `ready`. This deliberate two-release gate prevents an offline fixture from silently enabling the restricted account.

## Production rollout

1. Deploy the safety and qualification release.
2. Disconnect the revoked device and pair the locally installed extension again. Disconnecting clears its old per-task journals.
3. Confirm extension version and that Doubao is `ready`; DeepSeek remains unavailable.
4. Create a Doubao-only PPIO scored batch for ten enabled China prompts with one sample each.
5. Execute one task, verify the resulting `prompt_run`, response snapshot, channel identity, and customer Portal view.
6. Execute two more tasks, verify again, then finish the remaining seven one explicit task at a time. Stop on the first error.
7. Do not create or run DeepSeek work until account recovery and qualification.

This staged rollout intentionally proves one complete 10-Prompt measurement round before returning to the normal five-sample batch default.
