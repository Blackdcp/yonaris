# Local Browser Runner extension runbook

The Yonaris Browser Runner extension executes administrator-started Doubao and DeepSeek consumer-web samples in a trusted local Chrome profile on Windows or macOS. Portal remains the task and metric source of truth. The extension has no database credential, Portal administrator cookie, provider API key, scheduled batch creator, automated login, CAPTCHA bypass, proxy rotation, or screenshot requirement.

## Fixed v1 product contract

- Only a global platform administrator can pair/revoke devices and use **Run now**.
- **Run now** freezes every enabled Prompt in one CN / zh-CN / Asia/Shanghai scored Program.
- Each selected channel receives exactly five samples per Prompt; every sample starts a new conversation.
- Doubao and DeepSeek are separate queues. Each starts with five local tabs and adapts within one through ten. A rate limit cools only that channel.
- A server submit intent is durable before the page click. After that point the task is never automatically re-asked.
- Successful tasks upload answer text, citations/query observations and one sanitized current-answer HTML snapshot. Standard v1 does not capture a pixel screenshot or whole provider page.
- Login, CAPTCHA, risk control, timeout or page drift creates no `prompt_run`; it lowers delivery coverage and never becomes `brandMentioned=false`.
- Customer accounts are read-only.
- No daily schedule is created. Every batch requires a fresh platform-admin **Run now** action.

## Install the reviewed build

1. Open the successful GitHub Actions run for the exact deployed server SHA.
2. Download artifact `yonaris-browser-extension-<sha>` and verify the run's E2E, migration and deployment gates are green.
3. Extract the ZIP to a stable local directory owned by the operator. Do not run it from Downloads or a synced public folder.
4. In current stable Chrome, open `chrome://extensions`, enable Developer mode, choose **Load unpacked**, and select the extracted directory containing `manifest.json`.
5. Use a dedicated Chrome profile for monitoring. Sign in to Doubao and DeepSeek manually in normal tabs. Never store the phone number, password, SMS code, cookies or storage state in Yonaris.

The reviewed manifest permits only Portal, Doubao and DeepSeek origins. Reject an artifact that requests `<all_urls>`, `*://*/*`, clipboard, downloads, debugger, native messaging or proxy permissions.

## Pair the device

1. Sign in to Portal as the global platform administrator.
2. Open **Platform administration → Sampling operations → Local Browser devices**.
3. Choose the customer, enter an operator-recognizable device name, and create the 15-minute one-time code.
4. Open the extension popup, enter the code, and pair. The clear device token is shown by neither Portal nor the extension after exchange.
5. Confirm the device becomes **Online** and both channel readiness rows are present. Revoke and pair again if the wrong customer was selected.

Pairing authorizes only the selected customer and the two approved runner surfaces. It does not grant Portal page or customer-data access.

## First-site UAT

Run this before a scored customer cohort whenever the extension or an adapter version changes:

1. In the dedicated Chrome profile, open Doubao and DeepSeek and confirm each ordinary login manually.
2. Create a temporary CN scored Program with one non-sensitive Prompt.
3. Use **Run now** for one channel at a time. The fixed product contract creates five independent samples; do not delete or manually replay individual tasks to improve an answer.
4. Watch the local tabs: the adapter must choose **新对话** rather than **新工作任务**, submit the exact frozen Prompt once, observe one new answer, and close a successfully accepted tab.
5. In Portal, confirm five successful tasks, five runs, channel identity, answer text, citation/query fields and five ready response snapshots.
6. Open the customer read-only Prompt detail and verify **Browser answer HTML**. Download HTML/JSON and verify they represent only the accepted answer, not sidebar/history/account data.
7. If either site shows login, CAPTCHA, risk control or changed controls, stop the UAT. Resolve ordinary login manually or release an adapter update; never bypass the challenge.

## StepFun 30-task pilot

After both one-channel UATs pass:

1. Open **Sampling operations**, select StepFun and the intended CN scored Program.
2. Select Doubao and DeepSeek. Check the displayed equation. For three enabled Prompts it must be `3 × 2 × 5 = 30 tasks`.
3. Choose **Run 30 tasks now** once.
4. Keep Chrome and the extension running. The popup's **Check for work now** action starts an immediate check; background checks only consume this already-started batch and never create another batch.
5. Review Portal progress by channel. The batch is final only when all 30 frozen slots are resolved; unresolved technical tasks remain visible as needs-human/incomplete coverage.
6. Verify customer channel filters, Visibility denominator, answers, citations, query fan-out and snapshot readiness before presenting results.

## Pause, resume and recovery

- To pause the local device, disable the unpacked extension or close its dedicated Chrome profile. Unclaimed tasks stay queued in Portal.
- Re-enable/reopen Chrome and use **Check for work now** to resume claimable work.
- A clearly pre-submit transient failure may receive the one server-approved retry. Login/CAPTCHA/page drift waits for an administrator.
- After submit intent, recovery is restricted to the original local tab and exact user message. If that tab/session cannot be proven, finalize it as a technical failure; never ask the Prompt again for the same task.
- Doubao risk control does not stop DeepSeek, and vice versa.

## Revocation and rollback

1. In **Local Browser devices**, revoke the device. Revocation stops new claims immediately.
2. Disable/remove the extension from Chrome. Delete the extracted package only after no task needs same-tab recovery.
3. Keep the batch ledger. Do not delete failed tasks or insert replacement `prompt_runs` manually.
4. To roll back an adapter, install the previously reviewed ZIP paired as a new device, then revoke the incompatible device. Do not reuse its secret.

Daily/recurring domestic scheduling remains disabled. Enabling it requires a separate product decision, capacity plan and release review.
