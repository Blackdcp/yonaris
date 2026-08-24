<p align="center">
  <img src="apps/web/public/brand/yonaris-wordmark-navy.png" alt="Yonaris" width="400">
</p>

# Yonaris

Yonaris is a private AI market evidence product for making market evidence observable, reviewable, and useful to human teams and software agents.

This repository and its deployment materials are proprietary and confidential. They are not offered as a public self-hosting package or reusable third-party project.

## Product surfaces

- `apps/www`: public Yonaris company and product site
- `apps/web`: authenticated product workspace
- `apps/worker`: managed evidence collection and processing
- `deploy/las`: production release automation

## Internal development

Use the workspace scripts in `package.json` for local checks and builds. Production releases must use the reviewed immutable-image workflow and deployment state machine; do not publish packages or container images from this repository.

Copyright © 2026 Yonaris. All rights reserved.
