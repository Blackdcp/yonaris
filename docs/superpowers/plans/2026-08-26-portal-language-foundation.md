# Portal Language Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the shared two-language contract, persisted per-user UI preference, SSR-safe localization runtime, and bilingual global/authentication shell.

**Architecture:** A dependency-free typed catalog lives in `apps/web/src/i18n`, while the reusable `en | zh-CN` value contract lives in `@workspace/config`. TanStack Start resolves language on the server from the authenticated user, cookie, and request headers; switching writes the current user's preference plus cookie and reloads the same URL.

**Tech Stack:** TypeScript, React 19, TanStack Start, Better Auth, Drizzle/PostgreSQL, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-26-portal-bilingual-design.md`

## Global Constraints

- Supported values are exactly `en` and `zh-CN`.
- UI language never reads from or writes to `measurementScopes.locale`, market, or timezone.
- Routes and URLs remain unchanged.
- No new localization dependency is added.
- Production code is written only after its focused test fails for the intended missing behavior.
- Do not apply the database migration to any database.

---

### Task 1: Shared language contract

**Files:**
- Create: `packages/config/src/language.ts`
- Create: `packages/config/src/language.test.ts`
- Modify: `packages/config/package.json`

**Interfaces:**
- Produces: `CONTENT_LANGUAGES`, `ContentLanguage`, `UiLanguage`, `OutputLanguage`, `isContentLanguage(value)`, `parseContentLanguage(value, fallback?)` from `@workspace/config/language`.

- [ ] **Step 1: Write the failing contract tests**

```ts
import { describe, expect, it } from "vitest";
import { isContentLanguage, parseContentLanguage } from "./language";

describe("content language", () => {
	for (const value of ["en", "zh-CN"] as const) {
		it(`accepts ${value}`, () => {
			expect(isContentLanguage(value)).toBe(true);
			expect(parseContentLanguage(value)).toBe(value);
		});
	}

	it("rejects markets, generic Chinese, and unknown values", () => {
		for (const value of ["CN", "SG", "zh", "zh-SG", "fr", ""]) {
			expect(isContentLanguage(value)).toBe(false);
		}
		expect(() => parseContentLanguage("zh")).toThrow("Unsupported language");
		expect(parseContentLanguage(undefined, "en")).toBe("en");
	});
});
```

- [ ] **Step 2: Run the test and verify it fails because the module is absent**

Run from `packages/config`: `& 'node_modules/.bin/vitest.CMD' run src/language.test.ts`

Expected: FAIL resolving `./language`.

- [ ] **Step 3: Implement the narrow contract and package export**

```ts
export const CONTENT_LANGUAGES = ["en", "zh-CN"] as const;
export type ContentLanguage = (typeof CONTENT_LANGUAGES)[number];
export type UiLanguage = ContentLanguage;
export type OutputLanguage = ContentLanguage;

export function isContentLanguage(value: unknown): value is ContentLanguage {
	return value === "en" || value === "zh-CN";
}

export function parseContentLanguage(value: unknown, fallback?: ContentLanguage): ContentLanguage {
	if (isContentLanguage(value)) return value;
	if (fallback !== undefined && value === undefined) return fallback;
	throw new Error("Unsupported language. Expected en or zh-CN.");
}
```

Export `./language` from `packages/config/package.json`.

- [ ] **Step 4: Re-run the focused test**

Expected: PASS with both supported values and every rejection checked.

- [ ] **Step 5: Commit**

```powershell
git add packages/config/src/language.ts packages/config/src/language.test.ts packages/config/package.json
git commit -m "Define the portal language contract"
```

---

### Task 2: Persist the authenticated user's UI language

**Files:**
- Modify: `packages/lib/src/auth/server.ts`
- Modify (generated): `packages/lib/src/db/schema-auth.ts`
- Create: `packages/lib/src/db/migrations/0031_user_ui_language.sql`
- Modify (generated): `packages/lib/src/db/migrations/meta/0031_snapshot.json`
- Modify (generated): `packages/lib/src/db/migrations/meta/_journal.json`
- Modify: `apps/web/src/hooks/use-auth.tsx`
- Create: `apps/web/src/server/ui-language.ts`
- Create: `apps/web/src/server/ui-language.test.ts`

**Interfaces:**
- Consumes: `UiLanguage`, `parseContentLanguage`.
- Produces: session `user.uiLanguage`, `getUiLanguageFn(): Promise<UiLanguage>`, and `setUiLanguageFn({ data: { uiLanguage } })` scoped to the current session user.

- [ ] **Step 1: Write failing pure resolution and write-boundary tests**

Test these literal cases in `ui-language.test.ts`:

```ts
expect(resolveUiLanguage({ saved: "zh-CN", cookie: "en", acceptLanguage: "en-US" })).toBe("zh-CN");
expect(resolveUiLanguage({ saved: undefined, cookie: "zh-CN", acceptLanguage: "en-US" })).toBe("zh-CN");
expect(resolveUiLanguage({ saved: undefined, cookie: undefined, acceptLanguage: "zh-SG,zh;q=0.9" })).toBe("zh-CN");
expect(resolveUiLanguage({ saved: undefined, cookie: undefined, acceptLanguage: "fr-FR" })).toBe("en");
expect(() => validateUiLanguageUpdate("CN")).toThrow("Unsupported language");
```

Add a source-boundary test following `reports-execution-boundary.test.ts` that proves the update function obtains `session.user.id` internally and exposes no `userId` validator field.

- [ ] **Step 2: Run the test and verify the missing exports fail**

Run from `apps/web`: `& 'node_modules/.bin/vitest.CMD' run --project=unit src/server/ui-language.test.ts`

- [ ] **Step 3: Add the Better Auth field through supported configuration**

Add this `additionalFields` member in `packages/lib/src/auth/server.ts` and include it in the custom session result:

```ts
uiLanguage: {
	type: "string",
	required: false,
	defaultValue: "en",
	input: true,
},
```

Regenerate the Better Auth schema with `packages/lib/scripts/generate-auth-schema.sh`; do not hand-edit unrelated generated output. Generate Drizzle migration `0031`, then add a check constraint equivalent to:

```sql
ALTER TABLE "user" ADD COLUMN "ui_language" text DEFAULT 'en' NOT NULL;
ALTER TABLE "user" ADD CONSTRAINT "user_ui_language_supported" CHECK ("ui_language" IN ('en', 'zh-CN'));
```

- [ ] **Step 4: Implement the SSR read/write boundary**

Use `getCookie`, `setCookie`, and `getRequestHeaders` from `@tanstack/react-start/server`. Cookie name: `yonaris_ui_language`; options: `path: "/"`, `sameSite: "lax"`, one-year `maxAge`, and `secure` only in production. Resolve the authoritative session with `resolveAuthSession`; update only `session.user.id` with a parsed value.

- [ ] **Step 5: Run the focused tests and auth session tests**

Run:

```powershell
& 'node_modules/.bin/vitest.CMD' run --project=unit src/server/ui-language.test.ts src/lib/auth/__tests__/resolve-session.test.ts
```

Expected: PASS; no test references Program locale.

- [ ] **Step 6: Commit**

```powershell
git add packages/lib/src/auth/server.ts packages/lib/src/db/schema-auth.ts packages/lib/src/db/migrations apps/web/src/hooks/use-auth.tsx apps/web/src/server/ui-language.ts apps/web/src/server/ui-language.test.ts
git commit -m "Persist each user's portal language"
```

---

### Task 3: Typed catalogs and formatting runtime

**Files:**
- Create: `apps/web/src/i18n/define-catalog.ts`
- Create: `apps/web/src/i18n/catalogs/common.ts`
- Create: `apps/web/src/i18n/catalogs/auth.ts`
- Create: `apps/web/src/i18n/catalog.ts`
- Create: `apps/web/src/i18n/provider.tsx`
- Create: `apps/web/src/i18n/i18n.test.tsx`

**Interfaces:**
- Produces: `MessageId`, `translate(locale, id, values?)`, `I18nProvider`, `useI18n()` returning `{ locale, t, formatDate, formatNumber, formatList }`.
- Catalog ownership: later plans add `customer.ts`, `admin.ts`, and `reports.ts` without changing common runtime code.

- [ ] **Step 1: Write failing catalog parity/interpolation/format tests**

Cover missing values, braces, localized dates, localized numbers, and real React rendering:

```tsx
expect(translate("zh-CN", "common.loading")).toBe("加载中…");
expect(translate("zh-CN", "common.welcomeName", { name: "Acme" })).toBe("欢迎，Acme");
expect(formatNumber("zh-CN", 12345)).toBe("12,345");
expect(formatDate("zh-CN", new Date("2026-08-26T00:00:00Z"), { timeZone: "UTC" })).toContain("2026");
```

Compile-time parity is enforced by `defineCatalog(en, zhCN)` where `zhCN` must contain every key in `en` and may contain no extra key.

- [ ] **Step 2: Run and observe the missing i18n modules fail**

Run from `apps/web`: `& 'node_modules/.bin/vitest.CMD' run --project=unit src/i18n/i18n.test.tsx`

- [ ] **Step 3: Implement catalog modules and provider**

Use semantic IDs such as `common.loading`, `navigation.overview`, and `auth.login.title`. Interpolation replaces only named `{token}` placeholders and throws in tests/development for a missing value. Production falls back to the English message only when a catalog lookup is unexpectedly absent.

- [ ] **Step 4: Run focused tests and type-check the catalog**

Run the test above, then from `apps/web`: `& 'node_modules/.bin/tsc.CMD' --noEmit`.

- [ ] **Step 5: Commit**

```powershell
git add apps/web/src/i18n
git commit -m "Add the bilingual portal message runtime"
```

---

### Task 4: SSR integration and language switches

**Files:**
- Modify: `apps/web/src/routes/__root.tsx`
- Modify: `apps/web/src/routes/_authed.tsx`
- Create: `apps/web/src/components/language-switcher.tsx`
- Create: `apps/web/src/components/language-switcher.test.tsx`
- Modify: `apps/web/src/components/nav-user.tsx`
- Modify: `apps/web/src/components/full-page-card.tsx`
- Modify: `apps/web/src/routes/auth/login.tsx`
- Modify: `apps/web/src/routes/auth/register.tsx`
- Modify: `apps/web/src/routes/auth/forgot-password.tsx`
- Modify: `apps/web/src/routes/auth/reset-password.tsx`
- Modify: `apps/web/src/routes/_authed/accept-invitation/$invitationId.tsx`
- Modify: `apps/web/src/router-default-components.tsx`

**Interfaces:**
- Consumes: `getUiLanguageFn`, `setUiLanguageFn`, `I18nProvider`, common/auth catalogs.
- Produces: SSR `html[lang]`, same-URL language switching, and bilingual auth/global error experiences.

- [ ] **Step 1: Write failing component and SSR-oriented tests**

Render the switcher in each locale and assert `English`, `简体中文`, current checked state, and that choosing the other language calls only `{ uiLanguage: "..." }`. Render root/auth helpers for both locales and assert localized title plus `lang` agreement.

- [ ] **Step 2: Run the focused tests and observe English-only output**

Run from `apps/web`:

```powershell
& 'node_modules/.bin/vitest.CMD' run --project=unit src/components/language-switcher.test.tsx src/i18n/i18n.test.tsx
```

- [ ] **Step 3: Integrate locale into root context before SSR**

Add `uiLanguage` to `RouterContext`, fetch it with root data, replace both hard-coded `<html lang="en">` values, localize root title/description/OG locale, and wrap `Outlet`/missing-env UI with `I18nProvider`. The switch calls `setUiLanguageFn`, then `window.location.reload()` without changing `location.pathname`, search, or hash.

- [ ] **Step 4: Translate auth and global failure copy**

Move visible copy, placeholders, validation messages, button states, and accessibility labels from the listed files into `common.ts` or `auth.ts`. Registration passes the current valid `uiLanguage` in the Better Auth sign-up input so the first verification email can use it.

- [ ] **Step 5: Extend navigation/auth tests and run them**

Run focused auth, language-switcher, root/default, and app-sidebar tests. Confirm existing route destinations and access gates are unchanged.

- [ ] **Step 6: Commit**

```powershell
git add apps/web/src/routes apps/web/src/components apps/web/src/router-default-components.tsx apps/web/src/i18n
git commit -m "Localize the portal shell and authentication"
```

---

### Task 5: Foundation verification

**Files:**
- Modify only files required by failures found in this task.

- [ ] **Step 1: Run all affected package tests**

Use the direct package binaries in this Windows workspace:

```powershell
# apps/web
& 'node_modules/.bin/vitest.CMD' run --project=unit
# packages/config and packages/lib from their package directories
& 'node_modules/.bin/vitest.CMD' run
```

- [ ] **Step 2: Run affected type checks**

Run `tsc --noEmit` directly in `apps/web`, `packages/config`, and `packages/lib`.

- [ ] **Step 3: Verify migration artifacts without applying them**

Confirm schema source, `0031` SQL, snapshot, and journal agree; verify default/backfill English and the two-value check.

- [ ] **Step 4: Commit any verified corrections**

Use an imperative message describing the correction; do not amend prior commits.

