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

### Task 1: Define one diagnostic request, content, and fallback contract

**Files:**
- Create: `apps/www/src/lib/diagnostic-schema.ts`
- Create: `apps/www/src/lib/diagnostic-schema.test.ts`
- Create: `apps/www/src/content/site/diagnostic.test.ts`
- Modify: `apps/www/src/content/site/diagnostic.ts`
- Modify: `apps/www/src/content/site/index.ts`
- Modify: `apps/www/src/content/site/content-parity.test.ts`
- Modify: `apps/www/src/lib/site-seo.test.ts`
- Modify: `apps/www/src/lib/marketing-content.ts`
- Modify: `apps/www/src/lib/marketing-content.test.ts`
- Modify: `apps/www/src/components/marketing/diagnostic-form.tsx`
- Modify: `apps/www/src/components/marketing/diagnostic-form.test.tsx`

Task 1 does not edit the routes, API, Resend, deployment, analytics, homepage composition, or `/privacy` presentation. Task 3 owns the single user-facing changeset for the complete diagnostic experience.

**Interfaces:**

```ts
export const DIAGNOSTIC_SCOPE_FIELDS = ["website", "brand", "market", "question"] as const;
export const DIAGNOSTIC_CONTACT_FIELDS = ["competitors", "name", "email", "consent"] as const;
export const DIAGNOSTIC_LEAD_FIELDS = [...DIAGNOSTIC_SCOPE_FIELDS, ...DIAGNOSTIC_CONTACT_FIELDS] as const;

export type DiagnosticLeadField = (typeof DIAGNOSTIC_LEAD_FIELDS)[number];
export type DiagnosticStageId = "scope" | "contact";

const websiteSchema = z.string().trim().min(1).max(300).superRefine((value, context) => {
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
      context.addIssue({ code: "custom", message: "invalid_website" });
    }
  } catch {
    context.addIssue({ code: "custom", message: "invalid_website" });
  }
});
const scopeShape = {
  website: websiteSchema,
  brand: z.string().trim().min(1).max(120),
  market: z.string().trim().min(1).max(160),
  question: z.string().trim().min(10).max(2000),
} as const;
export const diagnosticScopeSchema = z.strictObject(scopeShape);
export type DiagnosticScope = z.output<typeof diagnosticScopeSchema>;
export const diagnosticLeadSchema = z.strictObject({
  locale: z.enum(["en", "zh"]),
  ...scopeShape,
  competitors: z.string().trim().max(600).default(""),
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().min(1).max(254).pipe(z.email()),
  consent: z.literal(true),
  companyUrl: z.string().trim().max(0).default(""),
});
export type DiagnosticLead = z.output<typeof diagnosticLeadSchema>;
export function parseDiagnosticScope(input: unknown): z.ZodSafeParseResult<DiagnosticScope>;
export function parseDiagnosticLead(input: unknown): z.ZodSafeParseResult<DiagnosticLead>;
export function parseDiagnosticSearch(search: Record<string, unknown>): { website: string };
export function buildDiagnosticMailto(input: unknown): string | null;
export const DIAGNOSTIC_FALLBACK_RECIPIENT = "black.dcp@outlook.com";
```

- `diagnostic-schema.ts` is browser-safe: it imports only `zod` and type-only `Locale`; no `node:*`, `process`, env, logging, or server code.
- Both schemas use `z.strictObject()`. Unknown fields fail.
- The scope schema contains exactly `website`, `brand`, `market`, and `question`.
- The complete lead requires `locale`, scope fields, `name`, `email`, and literal `consent: true`; `competitors` and `companyUrl` normalize from missing to `""`, but `null` and non-strings fail.
- Trim before validation. Bounds: website 1–300, brand 1–120, market 1–160, question 10–2000, competitors 0–600, name 1–120, email 1–254, honeypot exactly empty.
- Website requires the trimmed raw value to begin with exact `http://` or `https://`, contain no whitespace/control characters, parse to a non-empty hostname, and contain no credentials. This rejects browser-normalized malformed forms such as `https:example.com`, `https:/example.com`, or embedded newline/tab characters. “Work email” is a label; validation claims only syntax and length.
- `parseDiagnosticSearch()` accepts one validated website string and returns an empty prefill for absent, array, malformed, credentialed, or non-HTTP values.
- `buildDiagnosticMailto()` revalidates its unknown input, returns `null` for invalid input, sends only to the fallback recipient, normalizes CR/LF from subject fields, includes every visible field plus locale/consent, excludes `companyUrl`, and only creates an encoded `mailto:` URL.

`DiagnosticContent` becomes the single bilingual source for every field label, placeholder, validation message, action, disclosure, success/failure state, home offer, and privacy fact:

```ts
interface DiagnosticStage {
  id: DiagnosticStageId;
  progressLabel: string;
  title: string;
  summary: string;
  fields: readonly DiagnosticLeadField[];
}
interface DiagnosticFieldCopy { label: string; placeholder: string; error: string }
interface DiagnosticContent {
  meta: PageMeta;
  eyebrow: string;
  headline: string;
  offer: string;
  confirmation: string;
  currentScope: string;
  currentScopeClaimIds: readonly string[];
  stages: readonly [DiagnosticStage, DiagnosticStage];
  likelyOutput: {
    eyebrow: string;
    title: string;
    introduction: string;
    items: readonly string[];
    claimIds: readonly string[];
  };
  form: {
    fields: Record<Exclude<DiagnosticLeadField, "consent">, DiagnosticFieldCopy>;
    consent: { label: string; error: string; privacyLeadIn: string; privacyLinkLabel: string };
    honeypotLabel: string;
    validationSummary: string;
    reviewLabel: string;
    actions: { continue: string; back: string; submit: string; submitting: string; retry: string };
    success: { title: string; body: string };
    failure: { title: string; body: string; fallbackLabel: string; fallbackDisclosure: string };
    disclosure: string;
  };
  homeOffer: {
    eyebrow: string;
    title: string;
    body: string;
    actionLabel: string;
    disclosure: string;
    claimIds: readonly string[];
  };
  claims: readonly FactualClaim[];
  limitations: readonly string[];
}
```

Stages are exactly `scope | contact`; success is a result state, not a stage. Ordered stage copy is pinned as `1 / Scope — Frame the question`, `2 / Contact — Contact and review`, `1 / 范围 — 界定问题`, and `2 / 联系 — 联系信息与确认`. English actions are `Continue`, `Back to scope`, `Request the diagnostic`, `Submitting request…`, `Try again`; Chinese actions are `继续`, `返回范围`, `申请免费诊断`, `正在提交申请…`, `重试`.

Success is exactly `Request submitted for review` / `申请已提交审核`. It says the request was submitted for Yonaris review, the team confirms scope before evidence collection, and this is not an instant diagnostic result; it never claims that human review has begun. Failure is exactly `We couldn’t confirm delivery` / `我们无法确认申请是否送达`, says the entries remain on the page, and offers `Open email draft` / `打开邮件草稿` with the disclosure that opening a draft sends nothing. Consent copy is `I agree that Yonaris may use these details to review my request and contact me.` / `我同意 Yonaris 使用这些信息审核本次申请并与我联系。`; the adjacent links are `How we handle diagnostic request data` / `我们如何处理诊断申请信息`.

Field copy is exact and independently authored; each slash below separates label / placeholder / validation error:

| Field | English | 中文 |
|---|---|---|
| website | `Website` / `https://example.com` / `Enter the full website URL, including http:// or https://.` | `官网` / `https://example.com` / `请输入完整网址，包括 http:// 或 https://。` |
| brand | `Brand` / `Your brand or company` / `Enter the brand or company name.` | `品牌` / `你的品牌或公司` / `请输入品牌或公司名称。` |
| market | `Market or category` / `What market are you competing in?` / `Enter the market or category.` | `市场或品类` / `你正在参与哪个市场的竞争？` / `请输入市场或品类。` |
| question | `Market question` / `What do you need to understand before your next market decision?` / `Add a little more detail so we can understand the decision.` | `市场问题` / `下一步市场决策前，你最需要看清什么？` / `请再具体一些，帮助我们理解这个决策问题。` |
| competitors | `Competitors to include` / `Names or URLs (optional)` / `Keep competitor context within 600 characters.` | `需要纳入的竞品` / `名称或网址（选填）` / `竞品信息请控制在 600 个字符以内。` |
| name | `Your name` / `Name` / `Enter your name.` | `你的姓名` / `姓名` / `请输入姓名。` |
| email | `Work email` / `you@company.com` / `Enter a valid email address.` | `工作邮箱` / `you@company.com` / `请输入有效的邮箱地址。` |

Tests pin every key and reject raw Zod messages in rendered output. Validation summary is `Check the highlighted fields and try again.` / `请检查标出的信息后重试。`; consent error is `Confirm that we may use these details to review the request and contact you.` / `请确认我们可以使用这些信息审核申请并与你联系。`; the Privacy lead-in is `Privacy:` / `隐私说明：`. `homeOffer` is pinned to `Start with the question behind your next market move.` / `从决定下一步市场行动的问题开始`, explains one brand/market/question plus scope confirmation, and discloses that submit creates no instant scan, score, or evidence result.

`likelyOutput` is pinned to `What the diagnostic can clarify` / `诊断可以帮你看清什么`, introduced by `If we confirm a workable scope, the diagnostic is designed to return:` / `如果范围可执行，诊断预计会包括：`, followed by: an agreed-question baseline, selected AI answers and available source evidence, the clearest observed gaps, and three bounded next tests (with natural Chinese equivalents). Failure is `We couldn’t confirm delivery` / `我们无法确认申请是否送达`; it says entries remain, offers `Open email draft` / `打开邮件草稿`, and explicitly says a draft sends nothing until the user sends it.

Define and freeze the following `PrivacyContent` in `diagnostic.ts` and export `getPrivacyContent()` through `content/site/index.ts`:

```ts
type PrivacySectionId = "submitted-data" | "abuse-control" | "delivery" | "purpose" | "browser-data" | "contact";
interface PrivacySection { id: PrivacySectionId; title: string; body: readonly string[] }
interface PrivacyLanguageContent {
  id: "en" | "zh";
  lang: "en" | "zh-CN";
  title: string;
  introduction: string;
  sections: readonly [PrivacySection, PrivacySection, PrivacySection, PrivacySection, PrivacySection, PrivacySection];
  returnLabel: string;
  returnPath: "/diagnostic" | "/zh/diagnostic";
}
interface PrivacyContent {
  meta: PageMeta;
  jumpLabel: string;
  languages: readonly [PrivacyLanguageContent, PrivacyLanguageContent];
}
```

The English section is titled `Diagnostic request privacy`; the Chinese section is `诊断申请隐私说明`. Both state the same six facts: submitted fields are website, brand, market/category, one decision question, optional competitors, name, email, and consent; a trusted proxy-provided client IP is used only for coarse short-lived abuse limiting; accepted requests are sent through an email delivery service to the Yonaris team; the purpose is to review, confirm scope, and respond; diagnostic field values are not added to client analytics events or written to localStorage/cookies; Privacy questions go to `black.dcp@outlook.com`. Return links are `Return to the diagnostic` → `/diagnostic` and `返回诊断申请` → `/zh/diagnostic`.

It must not invent retention periods, GDPR/legal-basis/jurisdiction/DPO/encryption guarantees, sale/sharing guarantees, or deletion SLA. Tests pin section IDs, language tags, paths, required facts, semantic EN/ZH parity, and forbidden promises.

The claim registry remains exactly:

```ts
{ id: "diagnostic-scope-confirmation", status: "managed-delivery" }
{ id: "diagnostic-likely-output", status: "managed-delivery" }
```

`currentScopeClaimIds` references the scope claim; `likelyOutput.claimIds` references the output claim; `homeOffer.claimIds` references both. Success says only that the request was accepted for team review and explicitly says it is not an instant diagnostic result.

`marketing-content.ts` becomes a thin compatibility facade: legacy types/validators derive from the shared schema, constants alias the canonical recipient, and mailto generation is re-exported. It must not retain a second URL/email/required-field implementation. Task 3 removes the bridge after component migration.

- [ ] **Step 1: Write and run the behavioral RED**

Tests cover strict-object rejection, all bounds, credentialed/non-HTTP URLs, optional normalization, honeypot, search prefill, revalidated mailto with CR/LF sanitation, stage-one parsing, `scope/contact` IDs, ordered fields, independently authored EN/ZH form/status copy, claim references, home-offer parity, Privacy allowlist/forbidden promises, the temporary facade, and the current form’s missing consent/honeypot/Privacy link.

```powershell
pnpm.cmd --filter @workspace/www test -- diagnostic-schema.test.ts diagnostic.test.ts content-parity.test.ts site-seo.test.ts marketing-content.test.ts diagnostic-form.test.tsx
```

Expected RED is missing module/contract and missing rendered behavior, never a path-alias, TypeScript configuration, or fixture error.

- [ ] **Step 2: Implement the minimum shared contract**

Use Zod issue paths as the only source of field errors. Move all user-facing copy out of the component. Add the consent control, empty honeypot, and separate `/privacy` link to the existing temporary form without yet replacing mailto submission. Because this intermediate form only opens `mailto:`, its CTA and disclosure must render `form.failure.fallbackLabel` and `form.failure.fallbackDisclosure`; it must never render the future API submit action or claim the request has been submitted. Use only approved VI tokens for validation treatment. This keeps every intermediate commit buildable and truthful. Preserve current canonical routes and SEO while adding Diagnostic-specific parity assertions.

- [ ] **Step 3: Run GREEN, browser-safety gates, and commit**

```powershell
pnpm.cmd --filter @workspace/www test -- diagnostic-schema.test.ts diagnostic.test.ts content-parity.test.ts site-seo.test.ts marketing-content.test.ts diagnostic-form.test.tsx
pnpm.cmd --filter @workspace/www check-types
pnpm.cmd --filter @workspace/www build
git diff --check
git add apps/www/src/lib/diagnostic-schema.ts apps/www/src/lib/diagnostic-schema.test.ts apps/www/src/content/site/diagnostic.ts apps/www/src/content/site/diagnostic.test.ts apps/www/src/content/site/index.ts apps/www/src/content/site/content-parity.test.ts apps/www/src/lib/site-seo.test.ts apps/www/src/lib/marketing-content.ts apps/www/src/lib/marketing-content.test.ts apps/www/src/components/marketing/diagnostic-form.tsx apps/www/src/components/marketing/diagnostic-form.test.tsx
git commit -m "define the diagnostic request contract"
```

### Task 2: Deliver validated leads through a hardened, idempotent Resend endpoint

**Files:**
- Create: `apps/www/src/lib/diagnostic-api-protocol.ts`
- Create: `apps/www/src/lib/diagnostic-api-protocol.test.ts`
- Create: `apps/www/src/lib/diagnostic-delivery.server.ts`
- Create: `apps/www/src/lib/diagnostic-delivery.server.test.ts`
- Create: `apps/www/src/routes/api/diagnostic.ts`
- Create: `e2e/www-tests/diagnostic-api.spec.ts`
- Create: `deploy/las/bin/deploy-marketing.test.sh`
- Modify: `apps/www/src/routeTree.gen.ts` only through TanStack generation
- Modify: `deploy/las/compose.marketing.yaml`
- Modify: `deploy/las/env.example`
- Modify: `deploy/las/bin/deploy-marketing.sh`
- Modify: `deploy/las/README.md`
- Modify: `.github/workflows/deploy-marketing.yaml`

Do not edit any Caddy fragment or installer in this task. Production API exposure and trusted-client-IP construction belong to Governance Task 5 and must ship atomically with the rebuilt route allowlist. This task may be committed only on the unreleased feature branch; it must not reach `main` before Governance Task 5 because a `main` push can automatically deploy it.

**Browser-safe protocol:**

```ts
export const DIAGNOSTIC_API_PATH = "/api/diagnostic";
export const DIAGNOSTIC_IDEMPOTENCY_HEADER = "Idempotency-Key";
export type DiagnosticApiErrorCode =
  | "invalid_request" | "invalid_idempotency_key" | "forbidden_request"
  | "unsupported_media_type" | "payload_too_large" | "rate_limited"
  | "service_unavailable" | "delivery_unconfirmed";
export type DiagnosticApiResponse = { ok: true } | { ok: false; code: DiagnosticApiErrorCode };
export function parseDiagnosticIdempotencyKey(value: string | null):
  | { success: true; data: string }
  | { success: false };
export function toResendIdempotencyKey(uuid: string): `diagnostic/${string}`;
```

The protocol accepts one canonical UUID only; missing, arbitrary, whitespace-padded, or comma-joined multiple values fail. Task 3 imports the path, header, and response type rather than duplicating them.

**Server interfaces:**

```ts
export interface DiagnosticDeliveryEnv {
  RESEND_API_KEY: string;
  RESEND_FROM_EMAIL: string;
  MARKETING_LEAD_RECIPIENT: string;
}
export type DeliverDiagnosticLead = (input: {
  lead: DiagnosticLead;
  env: DiagnosticDeliveryEnv;
  idempotencyKey: string;
}) => Promise<void>;
export class DiagnosticDeliveryError extends Error {
  constructor(readonly code: "service_unavailable" | "delivery_unconfirmed") {
    super(code);
  }
}
export interface DiagnosticHandlerDeps {
  getEnv(): Record<string, string | undefined>;
  deliver: DeliverDiagnosticLead;
  now(): number;
}
export function readJsonBodyLimited(request: Request, maxBytes?: number): Promise<unknown>;
export function createDiagnosticLeadHandler(deps: DiagnosticHandlerDeps): (request: Request) => Promise<Response>;
export function sendLeadWithResend(input: {
  lead: DiagnosticLead;
  env: DiagnosticDeliveryEnv;
  idempotencyKey: string;
}, fetchImpl?: typeof fetch): Promise<void>;
```

Every response is JSON with `Cache-Control: no-store` and `X-Content-Type-Options: nosniff`; no branch adds CORS or reflects inputs/upstream bodies. The exact response contract is:

| Condition | Status | Code |
|---|---:|---|
| Resend 2xx | 202 | `{ ok: true }` |
| invalid JSON/schema/honeypot | 400 | `invalid_request` |
| absent/invalid UUID | 400 | `invalid_idempotency_key` |
| absent/mismatched Origin or non-`same-origin` Fetch Metadata | 403 | `forbidden_request` |
| actual body > 20,480 bytes | 413 | `payload_too_large` |
| non-JSON media or compressed body | 415 | `unsupported_media_type` |
| sixth eligible IP attempt in ten minutes | 429 | `rate_limited` plus accurate `Retry-After` |
| missing env or explicit Resend non-2xx | 503 | `service_unavailable` |
| timeout, abort, or network ambiguity | 503 | `delivery_unconfirmed` |

Handler order is fixed: Origin; `Sec-Fetch-Site`; JSON media type; identity encoding; early Content-Length; UUID; trusted internal IP bucket; bounded streaming body; strict JSON/Zod/honeypot; environment; delivery. It trusts only Caddy-overwritten `X-Yonaris-Client-IP`, validates it with `node:net.isIP()`, and ignores browser `CF-Connecting-IP` and forwarding headers. Missing/invalid internal IP uses `unknown`. The limiter allows five eligible requests per fixed ten-minute window, prunes expired buckets, caps at 10,000 by oldest eviction, and is documented as in-process best-effort abuse control.

The Resend adapter sends deterministic plain text only. Explicit non-2xx responses throw `DiagnosticDeliveryError("service_unavailable")`; aborts, timeouts, network failures, and unknown thrown failures are conservatively classified as `delivery_unconfirmed`:

```text
POST https://api.resend.com/emails
Authorization: Bearer <key>
Content-Type: application/json
Accept: application/json
User-Agent: Yonaris-Diagnostic/1
Idempotency-Key: diagnostic/<client UUID>
```

Payload uses the configured sender and recipient, lead email as `reply_to`, one-line CR/LF-sanitized subject, stable field order, and no timestamp. Apply a behavioral ten-second timeout, perform no server retry, never read/log an upstream error body, and never include lead/API-key values in errors. A 2xx means Resend accepted the request, not inbox delivery.

- [ ] **Step 1: Write protocol, handler, and adapter RED**

Cover UUID parsing, exact Resend key, origin/fetch-metadata order, media/encoding, declared and chunked limits, invalid UTF-8/JSON/schema/honeypot, five-plus-one limiter/reset/eviction, spoofed headers, env, 202 only after delivery, generic response headers, zero PII/secret logs, deterministic Resend payload, identical lead+UUID requests, explicit upstream rejection, and fake-timer timeout/network ambiguity.

```powershell
pnpm.cmd --filter @workspace/www test -- diagnostic-api-protocol.test.ts diagnostic-delivery.server.test.ts
```

- [ ] **Step 2: Implement the pure protocol, handler, and adapter; run focused GREEN**

Implement only the interfaces and ordering above. Run the same focused unit command and require GREEN before creating or mounting the route.

- [ ] **Step 3: Write route RED, then mount the pure handler and run route GREEN**

Before creating the route, `diagnostic-api.spec.ts` posts only invalid/non-delivering bodies with `maxRedirects: 0` and expects direct JSON 400/403/415 plus no-store/nosniff/no-CORS. Expected RED is 404/non-JSON, never fixture failure. The final route delegates POST through TanStack `server.handlers` using `process.env`, native fetch, and `Date.now`; the generated route-tree diff may contain only this API route.

```powershell
pnpm.cmd --filter e2e exec playwright test --config playwright.www.config.ts www-tests/diagnostic-api.spec.ts --project=chromium
```

- [ ] **Step 4: Write deployment RED, then add configuration without broadening credentials**

Create the isolated shell test first and run it against the unchanged deployment code; record RED for missing-variable preflight/compose propagation. Then implement: Compose passes the three required env variables only into `www`. The deployment script rejects blanks before pull/up and never calls Resend `/domains`; production uses a `yonaris.com` domain-scoped Sending Access key. Domain verification is a documented one-time release prerequisite in `deploy/las/README.md`, not a runtime check requiring Full Access. The shell test proves missing-variable failure, secret redaction, compose scoping, no network/domain API call, and workflow execution without mutating real deployment.

```dotenv
RESEND_API_KEY=
RESEND_FROM_EMAIL='Yonaris <diagnostic@yonaris.com>'
MARKETING_LEAD_RECIPIENT=black.dcp@outlook.com
```

- [ ] **Step 5: Run full GREEN and commit**

```powershell
pnpm.cmd --filter @workspace/www test -- diagnostic-schema.test.ts diagnostic-api-protocol.test.ts diagnostic-delivery.server.test.ts
pnpm.cmd --filter e2e exec playwright test --config playwright.www.config.ts www-tests/diagnostic-api.spec.ts --project=chromium
bash deploy/las/bin/deploy-marketing.test.sh
pnpm.cmd --filter @workspace/www check-types
pnpm.cmd --filter e2e check-types
pnpm.cmd --filter @workspace/www build
node --test deploy/las/caddy/yonaris-marketing.test.mjs
git diff --check
git add apps/www/src/lib/diagnostic-api-protocol.ts apps/www/src/lib/diagnostic-api-protocol.test.ts apps/www/src/lib/diagnostic-delivery.server.ts apps/www/src/lib/diagnostic-delivery.server.test.ts apps/www/src/routes/api/diagnostic.ts apps/www/src/routeTree.gen.ts e2e/www-tests/diagnostic-api.spec.ts deploy/las/compose.marketing.yaml deploy/las/env.example deploy/las/bin/deploy-marketing.sh deploy/las/bin/deploy-marketing.test.sh deploy/las/README.md .github/workflows/deploy-marketing.yaml
git commit -m "deliver diagnostic leads through Resend"
```

Task 3 completes client idempotency: first valid submit generates `crypto.randomUUID()`, synchronous locking blocks double submit, ambiguous/unavailable retries of the same normalized lead reuse the key, only a materially different normalized lead gets a new key, success clears it, and neither lead nor key enters storage/cookies/analytics.

### Task 3: Replace the mailto form with a two-stage resilient client flow

**Files:**
- Move: `apps/www/src/components/marketing/diagnostic-form.tsx` → `apps/www/src/components/site/pages/diagnostic-form.tsx`
- Move: `apps/www/src/components/marketing/diagnostic-form.test.tsx` → `apps/www/src/components/site/pages/diagnostic-form.test.tsx`
- Move: `apps/www/src/components/marketing/diagnostic-page.tsx` → `apps/www/src/components/site/pages/diagnostic-page.tsx`
- Create: `apps/www/src/lib/diagnostic-client.ts`
- Create: `apps/www/src/lib/diagnostic-client.test.ts`
- Create: `apps/www/src/lib/diagnostic-analytics-privacy.ts`
- Create: `apps/www/src/lib/diagnostic-analytics-privacy.test.ts`
- Modify: `apps/www/src/routes/diagnostic.tsx`
- Modify: `apps/www/src/routes/zh/diagnostic.tsx`
- Modify: `apps/www/src/routes/__root.tsx`
- Modify: `apps/www/src/env.d.ts`
- Modify: `apps/www/src/styles/pages/diagnostic.css`
- Modify: `apps/www/src/lib/marketing-content.ts`
- Modify: `apps/www/src/lib/marketing-content.test.ts`
- Modify: `apps/www/src/lib/posthog.ts`
- Create: `apps/www/src/lib/posthog.test.ts`
- Create: `e2e/playwright.analytics.config.ts`
- Modify: `e2e/package.json`
- Modify: `e2e/www-tests/homepage.spec.ts`
- Create: `e2e/www-tests/diagnostic.spec.ts`
- Create: `e2e/www-tests/diagnostic-analytics.spec.ts`
- Modify: `.github/workflows/e2e.yaml`
- Create: `.changeset/diagnostic-request-experience.md`

**Interfaces:**
- Consumes the shared lead schema, protocol path/header/response types, bilingual Diagnostic content, and `buildDiagnosticMailto()`.
- Produces authored stages `scope | contact`, result stage `success`, and submission states `idle | submitting | unconfirmed`.
- `diagnostic-client.ts` owns the pure request adapter and classifies only HTTP 202 plus parsed `{ ok: true }` as success. Invalid JSON, `{ ok: false }`, network failure, and timeout remain unconfirmed.

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
  await expect(page.getByRole("status")).toContainText("Request submitted for review");
});

test("delivery failure offers the encoded email fallback", async ({ page }) => {
  await page.route("**/api/diagnostic", (route) => route.fulfill({ status: 503, contentType: "application/json", body: '{"ok":false,"code":"delivery_unconfirmed"}' }));
  await completeDiagnosticForm(page);
  await page.getByRole("button", { name: "Request the diagnostic" }).click();
  await expect(page.getByRole("alert")).toContainText("Delivery could not be confirmed");
  await expect(page.getByRole("link", { name: "Send by email instead" })).toHaveAttribute("href", /^mailto:/);
});
```

Add English and Chinese matrices for: Stage 1 invalid input sends zero requests and focuses the first invalid field; Back preserves every field; submission uses the shared API path/header and a UUID; a synchronous lock prevents double-click races; pending exposes a live status and disables navigation/submit; only 202 + `{ok:true}` creates success; invalid 202, 503, timeout, and network ambiguity preserve values and expose the complete mailto; the same normalized lead always reuses its UUID; a materially changed normalized lead gets a new UUID; changing then restoring a value or adding trim-only whitespace reuses the original UUID; success clears it; stale request completion after a materially changed lead/unmount cannot replace current state. Implement repeated form fill only as a test helper.

```powershell
pnpm.cmd --filter @workspace/www test -- diagnostic-client.test.ts diagnostic-analytics-privacy.test.ts diagnostic-form.test.tsx diagnostic-schema.test.ts posthog.test.ts
pnpm.cmd --filter e2e exec playwright test --config playwright.www.config.ts www-tests/diagnostic.spec.ts www-tests/homepage.spec.ts --project=chromium
pnpm.cmd --filter e2e exec playwright test --config playwright.analytics.config.ts --project=chromium
```

Record the expected behavioral REDs (no staged POST state machine, no 202-gated success, no resilient failure state), not syntax or selector failures.

- [ ] **Step 2: Implement progressive fields and shared validation**

Stage 1: website, brand, market/category, one decision question. Stage 2: competitors, name, work email, consent, hidden honeypot, review. Preserve typed values when moving back. Validate Stage 1 with `parseDiagnosticScope()` before advancing and the entire shared schema before POST. Field-level messages and all status/action copy come from `DiagnosticContent`; never expose raw Zod English messages in the Chinese UI. The Privacy link is adjacent to, not nested inside, the consent label.

- [ ] **Step 3: Implement request states and honest fallback**

Generate the first UUID with `crypto.randomUUID()` only after a valid lead is ready to submit. Keep an in-memory `{ normalizedLeadFingerprint, idempotencyKey }`, where the fingerprint is deterministic JSON of the parsed `DiagnosticLead` in canonical field order. Reuse the key whenever the normalized payload is identical, including edit-then-restore and trim-only changes; generate a new key only when the parsed payload truly differs; clear after confirmed success. Do not persist the fingerprint, key, or lead. Abort in-flight work on cleanup and guard stale completions against the fingerprint that initiated them. Submit JSON through the shared protocol module; announce failures through `role="alert"` and pending/success through `role="status"`; on unconfirmed delivery retain all values and display `buildDiagnosticMailto(lead)`.

`?website=` is a one-time convenience, not analytics data. A root-level synchronous bootstrap script runs before the external deferred Plausible script: on the two exact Diagnostic paths it copies the raw query to a short-lived in-memory `window.__YONARIS_DIAGNOSTIC_PREFILL_SEARCH__`, immediately calls `history.replaceState()` with the query removed, and only then allows analytics initialization. SSR seeds from route search; client hydration seeds from the in-memory value and deletes it after consumption. The value is never written to storage/cookies or attached to an event. `diagnostic-analytics-privacy.ts` produces the deterministic bootstrap script and sanitized URL/referrer helpers; `__root.tsx` emits it before Plausible and initializes PostHog only after the clean location exists.

Create a dedicated `playwright.analytics.config.ts` on its own strict port (default 3002) and restrict it to `diagnostic-analytics.spec.ts`. Only this config supplies deterministic non-secret `VITE_PLAUSIBLE_DOMAIN`, `VITE_POSTHOG_KEY`, and a local/interceptable `VITE_POSTHOG_HOST`; the shared public/visual config remains analytics-free, so full-site QA cannot reach external analytics or emit test telemetry. The dedicated browser test fulfills a stub Plausible script that emits one event, intercepts the PostHog endpoint, requires at least one request from each provider, and asserts every observed URL/referrer/payload excludes the raw query and all lead values. Zero-request interception must fail the test. Add `test:www:analytics` to `e2e/package.json`, run it after `test:www` in `.github/workflows/e2e.yaml`, and keep it in the Governance final gate.

Harden PostHog properties so page URLs/referrers contain no diagnostic query and no diagnostic field, domain, email, question, competitors, UUID, or response payload is included in custom events. Assert that no lead/UUID/form value—not that no analytics library metadata at all—is written to localStorage, sessionStorage, cookie, or analytics. Both route modules use `parseDiagnosticSearch()` and `corePageHead("diagnostic", locale)`.

- [ ] **Step 4: Run GREEN at desktop and mobile, then commit**

At 1440, 1024, 768, 390, 360, 320, and 280px, test both locales for overflow, semantic CJK phrase integrity, 44px targets, focus-visible, reduced motion, and WCAG AA in scope/contact/pending/success/unconfirmed states. Capture and inspect EN/ZH desktop plus 390/320 scope, contact, success, and unconfirmed states.

```powershell
pnpm.cmd --filter @workspace/www test -- diagnostic-client.test.ts diagnostic-analytics-privacy.test.ts diagnostic-form.test.tsx diagnostic-schema.test.ts diagnostic-delivery.server.test.ts marketing-content.test.ts posthog.test.ts
pnpm.cmd --filter e2e exec playwright test --config playwright.www.config.ts www-tests/diagnostic.spec.ts www-tests/homepage.spec.ts --project=chromium
pnpm.cmd --filter e2e exec playwright test --config playwright.analytics.config.ts --project=chromium
pnpm.cmd --filter @workspace/www check-types
pnpm.cmd --filter e2e check-types
pnpm.cmd --filter @workspace/www build
git diff --check
git add apps/www/src/components/marketing/diagnostic-form.tsx apps/www/src/components/marketing/diagnostic-form.test.tsx apps/www/src/components/marketing/diagnostic-page.tsx apps/www/src/components/site/pages/diagnostic-form.tsx apps/www/src/components/site/pages/diagnostic-form.test.tsx apps/www/src/components/site/pages/diagnostic-page.tsx apps/www/src/lib/diagnostic-client.ts apps/www/src/lib/diagnostic-client.test.ts apps/www/src/lib/diagnostic-analytics-privacy.ts apps/www/src/lib/diagnostic-analytics-privacy.test.ts apps/www/src/routes/diagnostic.tsx apps/www/src/routes/zh/diagnostic.tsx apps/www/src/routes/__root.tsx apps/www/src/env.d.ts apps/www/src/styles/pages/diagnostic.css apps/www/src/lib/marketing-content.ts apps/www/src/lib/marketing-content.test.ts apps/www/src/lib/posthog.ts apps/www/src/lib/posthog.test.ts e2e/playwright.analytics.config.ts e2e/package.json e2e/www-tests/homepage.spec.ts e2e/www-tests/diagnostic.spec.ts e2e/www-tests/diagnostic-analytics.spec.ts .github/workflows/e2e.yaml .changeset/diagnostic-request-experience.md
git commit -m "build the resilient diagnostic request flow"
```

### Task 4: Publish the diagnostic Privacy disclosure

**Files:**
- Create: `apps/www/src/components/site/pages/privacy-page.tsx`
- Create: `apps/www/src/components/site/pages/privacy-page.test.tsx`
- Create: `apps/www/src/routes/privacy.tsx`
- Create: `apps/www/src/styles/pages/privacy.css`
- Modify: `apps/www/src/styles.css`
- Modify: `apps/www/src/lib/site-seo.test.ts`
- Modify: `apps/www/src/routeTree.gen.ts` only through TanStack generation
- Modify: `e2e/www-tests/diagnostic.spec.ts`

**Interfaces:**
- Consumes `SiteShell`, `getPrivacyContent()`, the site manifest, and the Task 1 diagnostic field contract.
- Produces: `PrivacyPage()` and `/privacy`, containing concise English and Chinese disclosure sections under one canonical URL.

- [ ] **Step 1: Write the failing page and route tests**

Task 1 already owns and tests the Privacy facts. Task 4 RED is the missing `PrivacyPage`/route/presentation, not missing content. Static tests require one English section with `lang="en"`, one Chinese section with `lang="zh-CN"`, a language jump navigation, contact link, and return links to both diagnostic locales. Browser RED requires `/privacy` to render directly with one canonical and no alternate language route.

```powershell
pnpm.cmd --filter @workspace/www test -- privacy-page.test.tsx site-seo.test.ts
pnpm.cmd --filter e2e exec playwright test --config playwright.www.config.ts www-tests/diagnostic.spec.ts --project=chromium
```

- [ ] **Step 2: Implement concise bilingual Privacy pages**

Render exactly the approved Task 1 facts in English and Chinese. Do not invent retention duration, jurisdiction, DPO, certification, legal basis, encryption guarantees, sale/sharing guarantees, or deletion SLA. The route uses `supportingPageHead("privacy")`. There is only `/privacy`: do not add `/zh/privacy`, hreflang, Agent/Markdown, or negotiated variants.

- [ ] **Step 3: Verify both diagnostic locales link the same canonical disclosure**

Playwright asserts `/diagnostic` and `/zh/diagnostic` both link `/privacy`; the consent link remains outside the checkbox label and provides a new-context cue; `/privacy` exposes both language sections, language jumps, diagnostic-return paths, and one canonical link. At all seven site widths assert no overflow, CJK phrase integrity, keyboard focus, WCAG AA, reduced-motion safety, and no duplicate main/header/footer. Capture/inspect desktop and mobile.

- [ ] **Step 4: Run GREEN, build, and commit**

```powershell
pnpm.cmd --filter @workspace/www test -- diagnostic.test.ts privacy-page.test.tsx site-seo.test.ts
pnpm.cmd --filter e2e exec playwright test --config playwright.www.config.ts www-tests/diagnostic.spec.ts --project=chromium
pnpm.cmd --filter @workspace/www check-types
pnpm.cmd --filter e2e check-types
pnpm.cmd --filter @workspace/www build
git diff --check
git add apps/www/src/components/site/pages/privacy-page.tsx apps/www/src/components/site/pages/privacy-page.test.tsx apps/www/src/routes/privacy.tsx apps/www/src/styles/pages/privacy.css apps/www/src/styles.css apps/www/src/lib/site-seo.test.ts apps/www/src/routeTree.gen.ts e2e/www-tests/diagnostic.spec.ts
git commit -m "document diagnostic request privacy"
```

## Plan 3 Acceptance

- Valid requests return success only after Resend accepts delivery to the configured recipient.
- Invalid, cross-origin, bot, oversized, rate-limited, unconfigured, and upstream-failed requests cannot produce a false success.
- Browser failure preserves values and exposes a complete prefilled mailto fallback.
- The two-stage flow is equivalent in English and Chinese and works at 320px.
- Privacy describes only the actual collection and email-delivery behavior.
