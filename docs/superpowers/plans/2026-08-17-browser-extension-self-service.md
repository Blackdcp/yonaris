# Browser Extension Self-Service Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the reviewed Browser Runner extension with Portal and let administrators download, install and pair it from any Windows or macOS device.

**Architecture:** Build the existing extension first, package its exact `dist` allowlist into a deterministic ZIP plus SHA-256 metadata under Portal public assets, and render those assets on the existing device-management page. Keep pairing and task execution contracts unchanged.

**Tech Stack:** TypeScript, Node.js, `archiver`, React, Vitest, pnpm, Docker, GitHub Actions.

## Global Constraints

- Do not embed secrets, tokens, pairing codes, customer data or environment values in the extension artifact.
- Package exactly `background.js`, `content-entry.js`, `icon.svg`, `manifest.json`, `popup.css`, `popup.html`, and `popup.js`.
- Keep domestic execution administrator-started; do not add a schedule or automated provider login.
- Keep existing customer assignment, retry, evidence and Elmo metric semantics unchanged.
- Preserve all user-owned untracked files in the worktree.

---

### Task 1: Deterministic extension package

**Files:**
- Create: `apps/web/scripts/package-browser-extension.mjs`
- Create: `apps/web/scripts/package-browser-extension.test.ts`
- Modify: `apps/web/package.json`

**Interfaces:**
- Consumes: `apps/browser-extension/dist` with the seven approved files.
- Produces: `apps/web/public/downloads/yonaris-browser-extension.zip` and `apps/web/public/downloads/yonaris-browser-extension.json` with `{ version, sha256, fileName }`.

- [ ] **Step 1: Write failing tests for exact allowlist, deterministic entry ordering, metadata and missing/unexpected file rejection.**
- [ ] **Step 2: Run the targeted test and confirm the packaging module is missing.**
- [ ] **Step 3: Implement the minimal packaging script with `archiver`, SHA-256 and atomic output replacement.**
- [ ] **Step 4: Run the targeted test and package a real extension build.**
- [ ] **Step 5: Commit the packaging unit.**

### Task 2: Portal installation card

**Files:**
- Create: `apps/web/src/components/sampling/browser-runner-extension-install.tsx`
- Create: `apps/web/src/components/sampling/browser-runner-extension-install.test.tsx`
- Modify: `apps/web/src/routes/_authed/admin/sampling/devices.tsx`

**Interfaces:**
- Consumes: same-origin `/downloads/yonaris-browser-extension.zip` and `/downloads/yonaris-browser-extension.json`.
- Produces: an administrator-facing download button, SHA-256 display and four-step Windows/macOS Chrome instructions.

- [ ] **Step 1: Write a failing render test for download, digest, install steps and no secret material.**
- [ ] **Step 2: Run the targeted test and confirm the component is missing.**
- [ ] **Step 3: Implement the component and insert it before the pairing/device list.**
- [ ] **Step 4: Run component and device-page tests.**
- [ ] **Step 5: Commit the Portal UI unit.**

### Task 3: Immutable Docker/CI delivery

**Files:**
- Modify: `docker/Dockerfile`
- Modify: `.github/workflows/e2e.yaml`
- Modify: `deploy/las/BROWSER-EXTENSION-RUNNER-RUNBOOK.md`

**Interfaces:**
- Consumes: extension and web package scripts from Tasks 1-2.
- Produces: a web image whose public assets contain the exact same reviewed extension package tested by CI.

- [ ] **Step 1: Extend static workflow/Docker tests to require extension build and package before web build.**
- [ ] **Step 2: Run the static tests and confirm they fail on the old build chain.**
- [ ] **Step 3: Update the dependency stage, builder commands, CI assertions and operator runbook.**
- [ ] **Step 4: Run extension tests/build, web tests/typecheck/build, static checks and Docker build in proportion to release risk.**
- [ ] **Step 5: Commit, push, open/merge the PR, monitor production deployment, and verify the production download URL plus existing paired-device state.**

