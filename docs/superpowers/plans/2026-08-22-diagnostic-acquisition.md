# Yonaris Diagnostic Acquisition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the mailto-only diagnostic with a trustworthy bilingual request flow that reaches the configured recipient through Resend and never reports false success.

**Architecture:** A shared Zod schema defines the browser/server contract. A pure request handler enforces origin, honeypot, size, schema, and coarse per-IP limits before a small Resend HTTP adapter delivers plain-text email. The client uses a two-stage progressive form with explicit pending, success, validation, and delivery-failure states; mailto remains only as the honest fallback.

**Tech Stack:** React 19, TypeScript 7, TanStack file routes, Zod 4, Resend HTTPS API through native `fetch`, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-08-22-full-site-rebuild-design.md`

## Global Constraints

- Offer: one brand, one market, and one important question; Yonaris confirms scope before evidence collection.
- Likely output: scoped baseline, selected answer/source evidence, clearest gaps, and three next tests, subject to team confirmation.
- Required production environment: `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `MARKETING_LEAD_RECIPIENT=black.dcp@outlook.com`.
- No instant scan, instant score, ranking/traffic promise, or fake success.
- No submitted lead data is sent to client analytics or written to local storage.
- Missing configuration or delivery failure produces an honest error plus a prefilled mailto fallback.
- Same-origin POST, honeypot rejection, coarse per-IP rate limiting, bounded body/field size, and shared validation are mandatory.
- English and Chinese have equivalent fields, disclosure, result states, and Privacy links.
- Use TDD before every production behavior.

---

### Task 1: Define one diagnostic schema and fallback contract

**Files:**
- Create: `apps/www/src/lib/diagnostic-schema.ts`
- Create: `apps/www/src/lib/diagnostic-schema.test.ts`
- Modify: `apps/www/src/content/site/diagnostic.ts`
- Create: `apps/www/src/content/site/diagnostic.test.ts`
- Modify: `apps/www/src/lib/marketing-content.ts`
- Modify: `apps/www/src/lib/marketing-content.test.ts`
- Modify: `apps/www/src/components/marketing/diagnostic-form.test.tsx`

**Interfaces:**
- Produces: `DiagnosticLead`, `DiagnosticLeadField`, `diagnosticLeadSchema`, `parseDiagnosticLead()`, `parseDiagnosticSearch()`, `buildDiagnosticMailto()`, `getPrivacyContent()`.
- Consumes: `Locale`.

- [ ] **Step 1: Write failing schema tests**

```ts
import { describe, expect, it } from "vitest";
import { buildDiagnosticMailto, parseDiagnosticLead } from "./diagnostic-schema";

const valid = {
  locale: "en", brand: "Acme", website: "https://acme.example", market: "Enterprise software",
  question: "Which platform fits a global team?", competitors: "Contoso", name: "Ava Chen",
  email: "ava@acme.example", consent: true, companyUrl: "",
} as const;

describe("diagnostic lead schema", () => {
  it("requires brand, absolute http website, market, question, name, work email, and consent", () => {
    expect(parseDiagnosticLead(valid).success).toBe(true);
    expect(parseDiagnosticLead({ ...valid, market: "", consent: false }).success).toBe(false);
    expect(parseDiagnosticLead({ ...valid, website: "javascript:alert(1)" }).success).toBe(false);
    expect(() => parseDiagnosticLead({ ...valid, website: "acme" })).not.toThrow();
    expect(parseDiagnosticLead({ ...valid, website: "acme" }).success).toBe(false);
  });

  it("bounds fields and rejects a filled honeypot", () => {
    expect(parseDiagnosticLead({ ...valid, question: "x".repeat(2001) }).success).toBe(false);
    expect(parseDiagnosticLead({ ...valid, companyUrl: "https://bot.example" }).success).toBe(false);
  });

  it("builds a complete encoded fallback addressed to the founder", () => {
    const href = buildDiagnosticMailto(valid);
    expect(href).toMatch(/^mailto:black\.dcp%40outlook\.com\?/);
    expect(decodeURIComponent(href)).toContain("Market: Enterprise software");
    expect(decodeURIComponent(href)).toContain("Which platform fits a global team?");
  });
});
```

Run `pnpm.cmd --filter @workspace/www test -- diagnostic-schema.test.ts src/content/site/diagnostic.test.ts`; expected FAIL because the schema and finalized offer contract do not exist.

- [ ] **Step 2: Implement the bounded Zod contract**

```ts
export const diagnosticLeadSchema = z.object({
  locale: z.enum(["en", "zh"]),
  brand: z.string().trim().min(1).max(120),
  website: z.string().trim().max(300).superRefine((value, context) => {
    try {
      if (!["http:", "https:"].includes(new URL(value).protocol)) context.addIssue({ code: "custom", message: "Use an http or https website" });
    } catch {
      context.addIssue({ code: "custom", message: "Use an absolute website URL" });
    }
  }),
  market: z.string().trim().min(1).max(160),
  question: z.string().trim().min(10).max(2000),
  competitors: z.string().trim().max(600),
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(254),
  consent: z.literal(true),
  companyUrl: z.string().trim().max(0),
});
export type DiagnosticLead = z.infer<typeof diagnosticLeadSchema>;
```

Move validator and mailto generation out of `marketing-content.ts`; keep compatibility re-exports until all imports move. Finalize `diagnostic.ts` with the one-brand/one-market/one-question contract, bilingual `homeOffer`, likely output, disclosure, success, failure, and fallback copy.

Add `parseDiagnosticSearch(search)` to accept only one absolute HTTP(S) website string and otherwise return `{ website: "" }`; its tests retain the current absent/array/malformed prefill regression without calling `new URL()` outside a guarded block.

- [ ] **Step 3: Run GREEN and commit**

```powershell
pnpm.cmd --filter @workspace/www test -- diagnostic-schema.test.ts src/content/site/diagnostic.test.ts marketing-content.test.ts diagnostic-form.test.tsx
git add apps/www/src/lib/diagnostic-schema.ts apps/www/src/lib/diagnostic-schema.test.ts apps/www/src/content/site/diagnostic.ts apps/www/src/content/site/diagnostic.test.ts apps/www/src/lib/marketing-content.ts apps/www/src/lib/marketing-content.test.ts apps/www/src/components/marketing/diagnostic-form.test.tsx
git commit -m "define the diagnostic lead contract"
```

### Task 2: Deliver validated leads through a hardened Resend endpoint

**Files:**
- Create: `apps/www/src/lib/diagnostic-delivery.server.ts`
- Create: `apps/www/src/lib/diagnostic-delivery.server.test.ts`
- Create: `apps/www/src/routes/api/diagnostic.ts`
- Create: `e2e/www-tests/diagnostic-api.spec.ts`
- Modify: `deploy/las/compose.marketing.yaml`
- Modify: `deploy/las/env.example`
- Modify: `deploy/las/bin/deploy-marketing.sh`
- Create: `deploy/las/bin/deploy-marketing.test.sh`
- Modify: `.github/workflows/deploy-marketing.yaml`

**Interfaces:**
- Consumes: `DiagnosticLead`, `parseDiagnosticLead()`.
- Produces: `DiagnosticDeliveryEnv`, `DiagnosticHandlerDeps`, `readJsonBodyLimited()`, `createDiagnosticLeadHandler(deps)`, `sendLeadWithResend(lead, env, fetchImpl)`.

- [ ] **Step 1: Write failing handler security and delivery tests**

```ts
import { describe, expect, it, vi } from "vitest";
import { createDiagnosticLeadHandler, sendLeadWithResend } from "./diagnostic-delivery.server";

const env = { RESEND_API_KEY: "re_test", RESEND_FROM_EMAIL: "Yonaris <diagnostic@yonaris.com>", MARKETING_LEAD_RECIPIENT: "black.dcp@outlook.com" };
const lead = { locale: "en", brand: "Acme", website: "https://acme.example", market: "Enterprise", question: "Which platform should we choose?", competitors: "", name: "Ava", email: "ava@acme.example", consent: true, companyUrl: "" };
const makeRequest = (body = lead, origin = "https://yonaris.com") => new Request("https://yonaris.com/api/diagnostic", { method: "POST", headers: { "content-type": "application/json", origin, "x-yonaris-client-ip": "203.0.113.7" }, body: JSON.stringify(body) });

it("rejects cross-origin and malformed submissions before delivery", async () => {
  const deliver = vi.fn();
  const handler = createDiagnosticLeadHandler({ getEnv: () => env, deliver, now: () => 1_000 });
  expect((await handler(makeRequest(lead, "https://evil.example"))).status).toBe(403);
  expect((await handler(makeRequest({ ...lead, companyUrl: "bot" }))).status).toBe(400);
  expect(deliver).not.toHaveBeenCalled();
});

it("returns success only after delivery resolves", async () => {
  const deliver = vi.fn().mockResolvedValue(undefined);
  const handler = createDiagnosticLeadHandler({ getEnv: () => env, deliver, now: () => 1_000 });
  const response = await handler(makeRequest());
  expect(response.status).toBe(202);
  expect(await response.json()).toEqual({ ok: true });
  expect(deliver).toHaveBeenCalledWith(lead, env);
});

it("returns 503 when configuration or Resend delivery fails", async () => {
  const missing = createDiagnosticLeadHandler({ getEnv: () => ({}), deliver: vi.fn(), now: () => 1_000 });
  expect((await missing(makeRequest())).status).toBe(503);
  const failed = createDiagnosticLeadHandler({ getEnv: () => env, deliver: vi.fn().mockRejectedValue(new Error("upstream")), now: () => 1_000 });
  expect((await failed(makeRequest())).status).toBe(503);
});

it("rate limits the sixth request from one IP inside ten minutes", async () => {
  const handler = createDiagnosticLeadHandler({ getEnv: () => env, deliver: vi.fn().mockResolvedValue(undefined), now: () => 1_000 });
  for (let index = 0; index < 5; index += 1) expect((await handler(makeRequest())).status).toBe(202);
  expect((await handler(makeRequest())).status).toBe(429);
});

it("rejects a chunked body after 20 KiB even without Content-Length", async () => {
  const handler = createDiagnosticLeadHandler({ getEnv: () => env, deliver: vi.fn(), now: () => 1_000 });
  const oversized = new Request("https://yonaris.com/api/diagnostic", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "https://yonaris.com", "x-yonaris-client-ip": "203.0.113.7" },
    body: `{"brand":"${"x".repeat(21_000)}"}`,
  });
  expect(oversized.headers.has("content-length")).toBe(false);
  expect((await handler(oversized)).status).toBe(413);
});

it("sends the exact bounded Resend request and aborts a stalled upstream", async () => {
  const upstream = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
  await sendLeadWithResend(lead, env, upstream);
  expect(upstream).toHaveBeenCalledWith("https://api.resend.com/emails", expect.objectContaining({
    method: "POST",
    headers: expect.objectContaining({ Authorization: "Bearer re_test" }),
    signal: expect.any(AbortSignal),
  }));
  const payload = JSON.parse(String(upstream.mock.calls[0][1]?.body));
  expect(payload).toMatchObject({ to: ["black.dcp@outlook.com"], reply_to: "ava@acme.example" });
  expect(payload.subject).not.toMatch(/[\r\n]/);
  await expect(sendLeadWithResend(lead, env, vi.fn().mockResolvedValue(new Response("bad", { status: 500 })))).rejects.toThrow();
});
```

Run `pnpm.cmd --filter @workspace/www test -- diagnostic-delivery.server.test.ts`; expected FAIL.

After creating `e2e/www-tests/diagnostic-api.spec.ts`, also run the route RED before mounting the handler:

```powershell
pnpm.cmd --filter e2e exec playwright test --config playwright.www.config.ts www-tests/diagnostic-api.spec.ts --project=chromium
```

Expected RED is a missing/non-400 endpoint, not a TypeScript, import, or fixture failure.

- [ ] **Step 2: Implement the pure handler and bounded rate limiter**

- Require `Content-Type: application/json`; use `Content-Length` only for early rejection, then read the actual `ReadableStream` in bounded chunks and stop once decoded bytes exceed 20 KiB before JSON parsing.
- Require `Origin` equal to `new URL(request.url).origin`.
- Parse the JSON once, validate with the shared schema, and never log request fields.
- Trust only Caddy's overwritten `x-yonaris-client-ip`; validate it with `node:net.isIP()` and use `unknown` when absent/invalid. Never inspect browser-supplied `cf-connecting-ip` or `x-forwarded-for` inside the application. Governance Task 5 owns the site-scoped Cloudflare peer allowlist and direct-peer fallback that create this internal header; the application never tries to reconstruct proxy trust. Treat the resulting limiter as coarse abuse control only.
- Permit five accepted attempts per key in a ten-minute in-process window; prune expired buckets on insert, cap the map at 10,000 buckets by evicting the oldest bucket, and return `Retry-After` on 429. Document this as best-effort abuse control, not an authentication boundary.
- Read env only through `getEnv()` so tests remain deterministic.
- Return JSON 202 only after `deliver()` resolves; configuration/delivery failure returns generic JSON 503 without leaking credentials or upstream response text.

- [ ] **Step 3: Implement the Resend HTTP adapter**

`sendLeadWithResend()` POSTs `https://api.resend.com/emails` with `Authorization: Bearer <key>`, `Content-Type: application/json`, and:

```ts
{
  from: env.RESEND_FROM_EMAIL,
  to: [env.MARKETING_LEAD_RECIPIENT],
  reply_to: lead.email,
  subject: `[Yonaris diagnostic] ${lead.brand} · ${lead.market}`,
  text: renderLeadEmail(lead),
}
```

Strip CR/LF from subject fields, use plain text for all lead values, apply `AbortSignal.timeout(10_000)`, and throw on every non-2xx or timed-out Resend response. The adapter RED uses fake timers and a fetch double that rejects when its received signal aborts; advance 10,000 ms and assert the promise rejects so the timeout is behaviorally proven rather than merely checking that some signal exists.

- [ ] **Step 4: Mount the route and run GREEN**

`apps/www/src/routes/api/diagnostic.ts` creates one handler using `process.env`, native `fetch`, and `Date.now`, then delegates `POST` through TanStack `server.handlers`. Create `diagnostic-api.spec.ts` before the route: its request test posts invalid input to `/api/diagnostic`, uses `maxRedirects: 0`, and expects direct JSON 400 with zero redirect. Run it once before implementation and record RED (route missing/non-400), then rerun after the build-generated route tree and require GREEN.

`compose.marketing.yaml` explicitly passes `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, and `MARKETING_LEAD_RECIPIENT`. `env.example` documents `RESEND_FROM_EMAIL='Yonaris <diagnostic@yonaris.com>'` with shell-safe quotes and the recipient. `deploy-marketing.sh` exits before pulling/starting when any value is blank; before rollout it performs the read-only Resend `GET /domains` check and requires the sender domain to be `verified` with sending enabled. Its new shell test uses a temporary fixture environment and stubbed Resend/Docker commands, proves missing/unverified/verified cases, and asserts `docker compose config` passes all three values only into the `www` runtime environment—it must never pull, start, stop, mutate the real deployment, or print the API key.

This task does not edit the strict Caddy fragment. Governance Task 5 owns the one final, versioned allowlist migration and exposes `/api/diagnostic` together with every rebuilt public route. The branch must not be pushed or deployed between this task and that release gate.

```powershell
pnpm.cmd --filter @workspace/www test -- diagnostic-delivery.server.test.ts
pnpm.cmd --filter e2e exec playwright test --config playwright.www.config.ts www-tests/diagnostic-api.spec.ts --project=chromium
pnpm.cmd --filter @workspace/www check-types
bash deploy/las/bin/deploy-marketing.test.sh
pnpm.cmd --filter @workspace/www build
git add apps/www/src/lib/diagnostic-delivery.server.ts apps/www/src/lib/diagnostic-delivery.server.test.ts apps/www/src/routes/api/diagnostic.ts e2e/www-tests/diagnostic-api.spec.ts deploy/las/compose.marketing.yaml deploy/las/env.example deploy/las/bin/deploy-marketing.sh deploy/las/bin/deploy-marketing.test.sh .github/workflows/deploy-marketing.yaml
git commit -m "deliver diagnostic leads through Resend"
```

### Task 3: Replace the mailto form with a two-stage resilient client flow

**Files:**
- Move: `apps/www/src/components/marketing/diagnostic-form.tsx` → `apps/www/src/components/site/pages/diagnostic-form.tsx`
- Move: `apps/www/src/components/marketing/diagnostic-form.test.tsx` → `apps/www/src/components/site/pages/diagnostic-form.test.tsx`
- Move: `apps/www/src/components/marketing/diagnostic-page.tsx` → `apps/www/src/components/site/pages/diagnostic-page.tsx`
- Modify: `apps/www/src/routes/diagnostic.tsx`
- Modify: `apps/www/src/routes/zh/diagnostic.tsx`
- Modify: `apps/www/src/styles/pages/diagnostic.css`
- Create: `e2e/www-tests/diagnostic.spec.ts`

**Interfaces:**
- Consumes: `DiagnosticLead`, `parseDiagnosticLead()`, `buildDiagnosticMailto()` and `POST /api/diagnostic`.
- Produces: stages `scope | contact | success`; statuses `idle | submitting | failed`.

- [ ] **Step 1: Write failing rendered and browser-state tests**

Rendered test:

```tsx
const html = renderToStaticMarkup(<DiagnosticForm locale="en" initialWebsite="https://acme.example" />);
expect(html).toContain("1 / Scope");
expect(html).toContain("2 / Contact");
expect(html).toContain('name="companyUrl"');
expect(html).toContain('href="/privacy"');
expect(html).not.toContain("Nothing is sent until you send the email");
```

Playwright test:

```ts
async function completeDiagnosticForm(page: Page) {
  await page.goto("/diagnostic?website=https%3A%2F%2Facme.example");
  await page.getByLabel("Brand").fill("Acme");
  await page.getByLabel("Market or category").fill("Enterprise software");
  await page.getByLabel("One question that matters").fill("Which platform should a global team choose?");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Your name").fill("Ava Chen");
  await page.getByLabel("Work email").fill("ava@acme.example");
  await page.getByLabel(/I agree/).check();
}

test("diagnostic reports success only after a 202 response", async ({ page }) => {
  await page.route("**/api/diagnostic", (route) => route.fulfill({ status: 202, contentType: "application/json", body: '{"ok":true}' }));
  await completeDiagnosticForm(page);
  await page.getByRole("button", { name: "Request the diagnostic" }).click();
  await expect(page.getByRole("status")).toContainText("Request received");
});

test("delivery failure offers the encoded email fallback", async ({ page }) => {
  await page.route("**/api/diagnostic", (route) => route.fulfill({ status: 503, contentType: "application/json", body: '{"ok":false}' }));
  await completeDiagnosticForm(page);
  await page.getByRole("button", { name: "Request the diagnostic" }).click();
  await expect(page.getByRole("alert")).toContainText("could not deliver");
  await expect(page.getByRole("link", { name: "Send by email instead" })).toHaveAttribute("href", /^mailto:/);
});
```

Add English and Chinese matrices for: Stage 1 invalid input sends zero requests; pending disables duplicate submit; Back preserves every field; 202 alone creates success; 503 preserves values and exposes mailto; 390×844 and 320×740 have no overflow; success/failure screenshots are saved and inspected. Implement the repeated form-fill sequence as a local Playwright helper in the same test file, not production code. Run tests; expected FAIL because the current form opens mailto.

```powershell
pnpm.cmd --filter @workspace/www test -- diagnostic-form.test.tsx diagnostic-schema.test.ts
pnpm.cmd --filter e2e exec playwright test --config playwright.www.config.ts www-tests/diagnostic.spec.ts --project=chromium
```

Record the expected behavioral REDs (no staged POST state machine, no 202-gated success, no resilient failure state), not syntax or selector failures.

- [ ] **Step 2: Implement progressive fields and shared validation**

Stage 1: website, brand, market/category, one decision question. Stage 2: competitors, name, work email, consent, hidden honeypot, review. Preserve typed values when moving back. Validate Stage 1 locally before advancing and the entire shared schema before POST.

- [ ] **Step 3: Implement request states and honest fallback**

Submit JSON to `/api/diagnostic`; disable only while pending; prevent duplicate requests; announce errors and success through `role="alert"`/`role="status"`; on failure retain all values and display `buildDiagnosticMailto(lead)`. Do not fire PostHog or write lead data to browser persistence. Both route modules use `parseDiagnosticSearch()` and `corePageHead("diagnostic", locale)`.

- [ ] **Step 4: Run GREEN at desktop and mobile, then commit**

```powershell
pnpm.cmd --filter @workspace/www test -- diagnostic-form.test.tsx diagnostic-schema.test.ts diagnostic-delivery.server.test.ts
pnpm.cmd --filter e2e exec playwright test --config playwright.www.config.ts diagnostic.spec.ts
git add apps/www/src/components/site/pages/diagnostic-* apps/www/src/routes/diagnostic.tsx apps/www/src/routes/zh/diagnostic.tsx apps/www/src/styles/pages/diagnostic.css e2e/www-tests/diagnostic.spec.ts
git commit -m "build the resilient diagnostic request flow"
```

### Task 4: Publish the diagnostic Privacy disclosure

**Files:**
- Create: `apps/www/src/components/site/pages/privacy-page.tsx`
- Create: `apps/www/src/routes/privacy.tsx`
- Modify: `apps/www/src/content/site/diagnostic.test.ts`
- Modify: `e2e/www-tests/diagnostic.spec.ts`

**Interfaces:**
- Consumes: SiteShell, site manifest, diagnostic field contract.
- Produces: `PrivacyPage()` and `/privacy`, containing concise English and Chinese disclosure sections under one canonical URL.

- [ ] **Step 1: Write the failing pure-content privacy test**

```ts
const privacy = getPrivacyContent();
for (const phrase of ["Diagnostic request data", "email delivery", "purpose", "black.dcp@outlook.com", "诊断申请数据"]) expect(JSON.stringify(privacy)).toContain(phrase);
expect(JSON.stringify(privacy)).not.toContain("retained for");
```

Run tests; expected FAIL because the Privacy page and shared canonical disclosure do not exist.

```powershell
pnpm.cmd --filter @workspace/www test -- src/content/site/diagnostic.test.ts
pnpm.cmd --filter e2e exec playwright test --config playwright.www.config.ts www-tests/diagnostic.spec.ts --project=chromium
```

- [ ] **Step 2: Implement concise bilingual Privacy pages**

State exactly, in English and Chinese: fields collected, email delivery to the Yonaris team, purpose of scoping/responding to the request, no client analytics use, and contact email. Do not invent retention duration, jurisdiction, DPO, certification, or legal basis. The route uses `supportingPageHead("privacy")`.

- [ ] **Step 3: Verify both diagnostic locales link the same canonical disclosure**

Playwright asserts `/diagnostic` and `/zh/diagnostic` both link `/privacy`, and `/privacy` exposes both language sections with one canonical link.

- [ ] **Step 4: Run GREEN, build, and commit**

```powershell
pnpm.cmd --filter @workspace/www test
pnpm.cmd --filter e2e exec playwright test --config playwright.www.config.ts diagnostic.spec.ts
pnpm.cmd --filter @workspace/www check-types
pnpm.cmd --filter @workspace/www build
git add apps/www/src/components/site/pages/privacy-page.tsx apps/www/src/routes/privacy.tsx apps/www/src/content/site/diagnostic.test.ts e2e/www-tests/diagnostic.spec.ts
git commit -m "document diagnostic request privacy"
```

## Plan 3 Acceptance

- Valid requests return success only after Resend accepts delivery to the configured recipient.
- Invalid, cross-origin, bot, oversized, rate-limited, unconfigured, and upstream-failed requests cannot produce a false success.
- Browser failure preserves values and exposes a complete prefilled mailto fallback.
- The two-stage flow is equivalent in English and Chinese and works at 320px.
- Privacy describes only the actual collection and email-delivery behavior.
