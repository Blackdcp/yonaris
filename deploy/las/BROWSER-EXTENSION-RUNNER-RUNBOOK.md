# Local Browser Runner extension runbook

The Yonaris Browser Runner extension executes administrator-started Doubao and DeepSeek consumer-web samples in a trusted local Chrome profile on Windows or macOS. Portal remains the task and metric source of truth. The extension has no database credential, Portal administrator cookie, provider API key, scheduled batch creator, automated login, CAPTCHA bypass, proxy rotation, or screenshot requirement.

## Fixed v1 product contract

- Only a global platform administrator can pair/revoke devices and use **Run now**.
- **Run now** freezes every enabled Prompt in one CN / zh-CN / Asia/Shanghai scored Program.
- Each selected channel receives exactly five samples per Prompt; every sample starts a new conversation.
- A popup **Check for work now** click executes at most one task across all channels. The extension never claims work from a timer and never opens concurrent task tabs.
- Only a surface whose installed adapter reports `ready` can receive a claim. A signed-out, restricted, changed or unverified surface stays unavailable.
- A server submit intent is durable before the page click. After that point the task is never automatically re-asked.
- Successful tasks upload answer text, citations/query observations and one sanitized current-answer HTML snapshot. Standard v1 does not capture a pixel screenshot or whole provider page.
- Login, CAPTCHA, risk control, timeout or page drift creates no `prompt_run`; it lowers delivery coverage and never becomes `brandMentioned=false`.
- Customer accounts are read-only.
- No daily schedule is created. Every batch requires a fresh platform-admin **Run now** action.

## Install the reviewed build

1. Sign in to Portal as the global platform administrator and open **Platform administration → Sampling operations → Local Browser devices**.
2. Download the extension ZIP shown there. Portal serves the exact reviewed extension packaged into its own immutable web release and displays its SHA-256 digest.
3. Extract the ZIP to a stable local directory owned by the operator. Do not run it from Downloads or a synced public folder.
4. In current stable Chrome, open `chrome://extensions`, enable Developer mode, choose **Load unpacked**, and select the extracted directory containing `manifest.json`.
5. Use a dedicated Chrome profile for monitoring. Sign in to Doubao and DeepSeek manually in normal tabs. Never store the phone number, password, SMS code, cookies or storage state in Yonaris.

The successful deployment's GitHub Actions artifact remains a second immutable copy for release audit. Its ZIP must match the package served by Portal.

The reviewed manifest permits only Portal, Doubao and DeepSeek origins. Reject an artifact that requests `<all_urls>`, `*://*/*`, clipboard, downloads, debugger, native messaging or proxy permissions.

## Pair the device

1. Sign in to Portal as the global platform administrator.
2. Open **Platform administration → Sampling operations → Local Browser devices**.
3. Choose the customer, enter an operator-recognizable device name, and create the 15-minute one-time code.
4. Open the extension popup, enter the code, and pair. The clear device token is shown by neither Portal nor the extension after exchange.
5. Confirm the device becomes **Online** and inspect each channel readiness row. Do not assume both channels are ready: an unavailable adapter is intentionally excluded from claims. Revoke and pair again if the wrong customer was selected.

Pairing authorizes only the selected customer and the two approved runner surfaces. It does not grant Portal page or customer-data access.

## First-site UAT

Run this before a scored customer cohort whenever the extension or an adapter version changes:

1. In the dedicated Chrome profile, open only the surface under test and confirm its ordinary login manually.
2. Create a temporary CN observation Program with one non-sensitive Prompt and one sample. Do not use a scored customer cohort for adapter qualification.
3. Start only that surface, then click **Check for work now** once. Do not delete or manually replay the task to improve an answer.
4. Watch the single active tab: the adapter must choose **新对话** rather than **新工作任务**, submit the exact frozen Prompt once, observe one new answer, and close a successfully accepted tab.
5. In Portal, confirm one successful task, one run, channel identity, answer text, citation/query fields and one ready response snapshot.
6. Open the customer read-only Prompt detail and verify **Browser answer HTML**. Download HTML/JSON and verify they represent only the accepted answer, not sidebar/history/account data.
7. If either site shows login, CAPTCHA, risk control or changed controls, stop the UAT. Resolve ordinary login manually or release an adapter update; never bypass the challenge.

## Customer cohort after a one-task UAT

Run only channels whose current adapter version passed the one-task UAT:

1. Open **Sampling operations**, select the customer and intended CN scored Program.
2. Select only verified, ready channels and check the displayed task equation before creating the batch.
3. Choose **Run tasks now** once. Do not create an overlapping batch for the same Program and channels.
4. Keep Chrome and the extension running. Each popup **Check for work now** click executes at most one queued task; there is no background queue consumption.
5. Review Portal progress after every task. Stop clicking at the first login, CAPTCHA, account restriction, page drift, timeout or needs-human result.
6. Verify customer channel filters, Visibility denominator, answers, citations, query fan-out and snapshot readiness before presenting results.

## Pause, resume and recovery

- To pause the local device, disable the unpacked extension or close its dedicated Chrome profile. Unclaimed tasks stay queued in Portal.
- Re-enable/reopen Chrome and use **Check for work now** for one further claimable task.
- A clearly pre-submit transient failure may receive the one server-approved retry. Login/CAPTCHA/page drift waits for an administrator.
- After submit intent, recovery is restricted to the original local tab and exact user message. If that tab/session cannot be proven, finalize it as a technical failure; never ask the Prompt again for the same task.
- A surface marked unavailable cannot receive a task. Do not continue on another account or channel merely to work around a provider restriction.

## Safe rollout order

1. Revoke or pause every paired device before deploying a Portal release that changes the extension protocol.
2. Deploy Portal and verify health. Devices whose heartbeat does not report an approved `ready` adapter intentionally receive no claims.
3. Install or reload the exact reviewed extension ZIP on one device, then confirm its adapter versions and readiness in Portal.
4. Re-pair or unpause only that reviewed device. Run the one-task observation UAT before starting a scored cohort.
5. Upgrade remaining devices one at a time. Temporary queue downtime during this fail-closed rollout is expected; allowing an older adapter to keep claiming is not.

## Revocation and rollback

1. In **Local Browser devices**, revoke the device. Revocation stops new claims immediately.
2. Disable/remove the extension from Chrome. Delete the extracted package only after no task needs same-tab recovery.
3. Keep the batch ledger. Do not delete failed tasks or insert replacement `prompt_runs` manually.
4. To roll back an adapter, install the previously reviewed ZIP paired as a new device, then revoke the incompatible device. Do not reuse its secret.

Daily/recurring domestic scheduling remains disabled. Enabling it requires a separate product decision, capacity plan and release review.
