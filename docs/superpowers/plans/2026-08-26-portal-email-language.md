# Transactional Email Language Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Send every existing cloud transactional email—verification, password reset, and organization invitation—in English or Simplified Chinese according to the recipient preference and documented fallback.

**Architecture:** Email template factories require an explicit shared `UiLanguage`. Authentication callbacks read the target user's persisted language; invitations resolve an existing recipient by email, otherwise use the inviter's language, otherwise English. Resend delivery remains centralized in `@workspace/cloud`.

**Tech Stack:** TypeScript, Better Auth, Drizzle/PostgreSQL, Resend, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-26-portal-bilingual-design.md`

## Global Constraints

- Implement after `user.uiLanguage` and the shared language contract exist.
- Supported template languages are exactly `en` and `zh-CN`.
- Names, organization names, email addresses, URLs, and tokens remain verbatim.
- No report-completion email is added; that product has no requester/recipient/outbox model.
- Delivery continues through `packages/cloud/src/email.ts`; the worker does not import cloud email code.

---

### Task 1: Bilingual email templates

**Files:**
- Modify: `packages/cloud/src/email-templates.ts`
- Modify: `packages/cloud/src/email-templates.test.ts`

**Interfaces:**
- `verificationEmail({ url, language }): EmailContent`
- `passwordResetEmail({ url, language }): EmailContent`
- `invitationEmail({ inviterName, orgName, url, language }): EmailContent`

- [ ] **Step 1: Write failing table-driven template tests**

For each factory and both languages, assert exact subject language, a distinctive body phrase, URL preservation in text and HTML, and HTML escaping for dynamic names. Example:

```ts
expect(verificationEmail({ url, language: "zh-CN" }).subject).toBe("验证你的邮箱");
expect(passwordResetEmail({ url, language: "en" }).subject).toBe("Reset your password");
expect(invitationEmail({ inviterName: "A <B>", orgName: "研发", url, language: "zh-CN" }).html).toContain("A &lt;B&gt;");
```

- [ ] **Step 2: Run tests and confirm factories reject the new language field or return English**

Run from `packages/cloud`: `& 'node_modules/.bin/vitest.CMD' run src/email-templates.test.ts`

- [ ] **Step 3: Implement complete text and HTML variants**

Require the language argument at compile time. Keep a single shared escaped HTML frame, but source every subject, heading, paragraph, CTA label, and expiry/security note from the selected template copy. Do not use UI catalog imports in email HTML.

- [ ] **Step 4: Run template tests and mutation-check both branches**

Changing a selected language to English in any callback must fail a Chinese assertion.

- [ ] **Step 5: Commit**

```powershell
git add packages/cloud/src/email-templates.ts packages/cloud/src/email-templates.test.ts
git commit -m "Translate transactional email templates"
```

---

### Task 2: Recipient preference resolution

**Files:**
- Create: `packages/cloud/src/email-language.ts`
- Create: `packages/cloud/src/email-language.test.ts`
- Modify: `packages/cloud/src/auth-hooks.ts`
- Modify: `packages/cloud/src/auth-hooks.test.ts`
- Modify: `packages/lib/src/db/auth-sync.ts`
- Create: `packages/lib/src/db/auth-sync.test.ts`

**Interfaces:**
- Produces: `resolveInvitationLanguage({ recipientLanguage, inviterLanguage }): UiLanguage` and a DB lookup `findUserUiLanguageByEmail(email): Promise<UiLanguage | null>`.

- [ ] **Step 1: Write failing fallback tests**

```ts
expect(resolveInvitationLanguage({ recipientLanguage: "zh-CN", inviterLanguage: "en" })).toBe("zh-CN");
expect(resolveInvitationLanguage({ recipientLanguage: null, inviterLanguage: "zh-CN" })).toBe("zh-CN");
expect(resolveInvitationLanguage({ recipientLanguage: null, inviterLanguage: null })).toBe("en");
```

Add auth-hook tests proving verification/reset use the target user's value and invitation queries the recipient before applying fallback.

- [ ] **Step 2: Run focused tests and observe missing resolution behavior**

- [ ] **Step 3: Implement the bounded DB lookup and pure fallback**

Select only `user.uiLanguage` by normalized exact email. Parse the stored value with English compatibility fallback; never infer from email domain, organization, market, or Program.

- [ ] **Step 4: Thread language into Better Auth callbacks**

Verification/reset parse `user.uiLanguage`. Invitation resolves recipient language, then inviter `uiLanguage`, then English, and passes the result to `invitationEmail`.

- [ ] **Step 5: Run cloud/lib tests and type checks**

- [ ] **Step 6: Commit**

```powershell
git add packages/cloud/src packages/lib/src/db/auth-sync.ts packages/lib/src/db/auth-sync.test.ts
git commit -m "Select email language per recipient"
```

---

### Task 3: Email language verification

**Files:**
- Modify only files required by verified failures.

- [ ] **Step 1: Run full `packages/cloud` and affected `packages/lib` tests**

- [ ] **Step 2: Run package type checks**

- [ ] **Step 3: Inspect every `sendEmail` call**

Confirm every current template call passes an explicit language and that there is no direct report/worker send path.

- [ ] **Step 4: Add the final product changeset**

Create one patch Changeset covering the user-facing bilingual Portal and email/report/Opportunity behavior, using the exact affected package names from their manifests and one concise sentence.

- [ ] **Step 5: Commit verified corrections and the Changeset**

```powershell
git add packages/cloud packages/lib .changeset
git commit -m "Verify bilingual transactional delivery"
```
