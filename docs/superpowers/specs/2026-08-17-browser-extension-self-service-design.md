# Browser Extension Self-Service Distribution Design

## Outcome

A platform administrator can sign in to Portal from any Windows or macOS device, download the exact Browser Runner extension shipped with that Portal release, install it in Chrome, pair it to one customer with a 15-minute one-time code, and run administrator-started domestic Doubao/DeepSeek batches.

## Architecture

The web image builds `@workspace/browser-extension` before the Portal build. A packaging script creates one deterministic ZIP and a SHA-256 metadata file in the Portal public assets. The existing **Local Browser devices** page links to the same-origin ZIP and displays the digest and concise Chrome installation steps. Pairing, device authorization, task claiming, provider login state, retry rules, response snapshots and Yonaris metric calculations remain unchanged.

## Security and Operations

- The ZIP contains only the reviewed extension `dist` files and is public because the source repository and extension code are public; no token, pairing code, customer data or environment value is embedded.
- The package is built in the same immutable web-image build as Portal, so a server/extension protocol release cannot silently point at an unrelated artifact.
- Chrome still requires an administrator to enable Developer mode and choose **Load unpacked**. A website cannot silently install an unpacked extension.
- Every device receives a separate revocable bearer through the existing one-time pairing flow and remains limited to its selected customer.
- Domestic execution remains administrator-started only; no daily schedule or automatic login is introduced.

## User Flow

1. Sign in to Portal as the platform administrator.
2. Open **Sampling operations → Local Browser devices**.
3. Download and extract the official extension ZIP; compare the displayed SHA-256 if desired.
4. Open `chrome://extensions`, enable Developer mode, choose **Load unpacked**, and select the extracted directory.
5. Manually sign in to Doubao and DeepSeek in that Chrome profile.
6. Create and enter the one-time pairing code.
7. Confirm the device is Online/Ready, return to Sampling operations, and click **Run now**.

## Verification

- Packaging tests reject missing or unexpected extension files and verify reproducible ZIP entries plus SHA metadata.
- UI tests require a same-origin download link, digest, Windows/macOS wording and pairing steps.
- Docker and CI build the extension before Portal and verify the packaged files exist in the web output.
- Existing pairing, device authorization, run-now, snapshot and metric regression suites remain green.
