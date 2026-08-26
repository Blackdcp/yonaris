# Portal Bilingual Experience Design

**Date:** 2026-08-26

## Goal

Deliver complete English and Simplified Chinese experiences for the authenticated Portal, authentication flows, platform administration, current transactional emails, one-time reports, exports, and Opportunities without coupling presentation language to a customer's market or Program measurement locale.

## Product decisions

- The only supported presentation/output languages are English (`en`) and Simplified Chinese (`zh-CN`).
- UI language is a per-user presentation preference. It never changes a Program's market, locale, timezone, prompts, providers, sampling route, or evaluation logic.
- Existing URLs and route IDs remain unchanged. There are no language path prefixes.
- A user who manages several markets uses one UI language while freely viewing Programs in any market or measurement locale.
- Reports and exports have an explicit output-language choice independent of UI language.
- Opportunity generation has an explicit output-language choice. Generated rows and caches are isolated by brand, Program, and output language.
- Existing transactional emails use the recipient's saved UI language. A recipient without an account preference falls back to the initiating user's language when available, then English.
- Raw evidence is never translated: brand and competitor names, Prompt text, model answers, citations, URLs, and observed search queries remain verbatim.
- The customer-facing name for Query Fan-Out is `AI 检索脉络` in Chinese. A group is `检索路径`, one query is `衍生检索词`, and its helper text is `查看 AI 为回答当前问题而展开的实际联网搜索词。`

## Language model

Three independent values are represented explicitly:

| Value | Source of truth | Controls | Must not control |
|---|---|---|---|
| `uiLanguage` | authenticated user preference plus an SSR cookie | Portal labels, navigation, validation copy, dates, numbers, email preference | Program selection or measurement behavior |
| `measurementScopes.locale` | Program configuration | prompts, observations, surface routing, evidence identity | UI, report, export, or Opportunity language |
| `outputLanguage` | explicit report/export/Opportunity selection | generated or rendered artifact copy | Program market/locale and raw evidence |

The shared language contract is a narrow union: `"en" | "zh-CN"`. Unknown values fail validation at write boundaries and resolve to English only at read-time compatibility boundaries.

## UI localization architecture

`apps/web/src/i18n/` owns a dependency-free, SSR-safe localization layer:

- a typed flat message catalog using stable semantic IDs rather than English source text as keys;
- complete English and Simplified Chinese catalogs with compile-time key parity;
- `I18nProvider` and `useI18n()` for message interpolation and locale-aware `Intl.DateTimeFormat`, `Intl.NumberFormat`, and `Intl.ListFormat` helpers;
- pure locale parsing, cookie, and fallback helpers that can be tested without React or a database.

`apps/web/src/routes/__root.tsx` resolves the locale before SSR, sets `<html lang>`, localizes global metadata, and wraps the whole route tree in the provider. Authenticated saved preference wins over the cookie. For anonymous auth pages, the cookie wins, followed by `Accept-Language`, then English. The language switch writes the cookie and, when authenticated, the user preference, then reloads the same URL so server and client render the same locale without hydration flicker.

The user table stores `ui_language` through Better Auth's supported `additionalFields` configuration and generated schema workflow. Existing users backfill to English. The value is included in the custom session. It is not added to organizations, brands, or measurement scopes.

The switch appears in the authenticated user menu and authentication card chrome. Labels are `English` and `简体中文`; a language never represents a market such as China or Singapore.

The migration also includes a database check restricting the value to `en` and `zh-CN`. Server updates validate the same union and always update the current session user, never an arbitrary user ID.

## Translation coverage

Every human-facing surface in `apps/web` is included:

- root metadata, not-found, configuration, error, loading, and empty states;
- login, registration, verification guidance, forgot/reset password, logout, and invitation acceptance;
- global sidebar, breadcrumbs, user menu, Program switcher, filters, pagination, date ranges, chart labels/tooltips, print/export chrome, dialogs, toasts, and accessibility labels;
- customer overview, Programs, Visibility, Share of Voice, AI 检索脉络, Citations, Opportunities, Prompt history/editing, onboarding, and every brand setting;
- platform Customers, access, report operations, automation, sampling operations, provider tools, and their dialogs/statuses;
- one-time report creation/history and printable report rendering.

Shared `@workspace/ui` components remain app-agnostic. Embedded accessibility text becomes caller-provided labels or a small package-level label interface; the shared package does not import the web catalog.

Developer logs, database values, API enum tokens, route segments, analytics event names, and machine-only operational receipts stay English/stable. User-visible server failures expose stable codes; the client localizes known codes and uses a localized generic fallback for unexpected failures instead of attempting to translate arbitrary exception text.

## Query Fan-Out / AI 检索脉络

The existing route remains `/app/$brand/query-fan-out`; query keys and tab identifiers remain stable. Only rendered copy changes by UI language.

The existing analysis strips non-Latin characters, which makes Chinese query-word analysis empty and prevents highlighting. Tokenization is upgraded independently of UI locale:

- Latin and numeric runs remain word tokens;
- contiguous Han text is segmented with `Intl.Segmenter("zh-CN", { granularity: "word" })` when available;
- a deterministic Han-character fallback is used where `Intl.Segmenter` is unavailable;
- mixed-script queries preserve source order and raw query text;
- stop-word and comparison behavior is tested for English, Chinese, and mixed input.

This is product-data support, not a locale conditional: English UI viewing a Chinese Program and Chinese UI viewing an English Program use the same analysis.

## Opportunity output language

`brand_opportunities` gains non-null `output_language`, backfilled to `en`. Its latest-row index becomes `(brand_id, scope_id, output_language, created_at)`. The existing legacy null-scope fallback is valid only for English.

`getOpportunitiesFn` and `generateOpportunitiesFn` accept validated `outputLanguage`. All freshness checks, reads, inserts, React Query keys, and invalidations include it. Admin generation remains the only write/generation path and retains the scored-Program requirement.

The generation prompt requires every model-authored title, summary, rationale, action, and caveat to use the selected output language. `relatedPrompts` remain verbatim measured Prompt text so lineage and deep links stay correct.

The admin generation control contains an explicit language selector. The customer Opportunities page also contains an output-language selector so artifact choice does not silently follow UI language. It may initialize from the UI preference for convenience, but changing either value never mutates the other.

## Report and export output language

`reports` gains non-null `output_language`, backfilled to `en`. Both the Portal form and public API accept a validated output language; omitted API values remain backward compatible as English. The report queue payload carries the value for an auditable end-to-end contract.

The printable report has a report-specific English/Chinese catalog selected from the persisted output language. A validated render query override allows an operator to choose either output language without changing the stored default. Static headings, explanations, recommendations, chart/export labels, dates, and numbers use that output language. Raw Prompts, answers, web queries, citations, and entity names remain unchanged.

Chart PNG/print exports accept an explicit output language and do not infer it from Program locale. The existing raw response-snapshot ZIP export is unchanged because it contains evidence artifacts rather than human report copy.

## Transactional email language

The current cloud email templates—verification, password reset, and organization invitation—receive an explicit language and have complete English and Simplified Chinese subjects, text, and HTML.

- Verification and password-reset callbacks use the target user's `uiLanguage`.
- Invitations use an existing recipient account's preference when found; otherwise the inviter's preference; otherwise English.
- URLs, tokens, organization names, and user names remain verbatim.

There is no report-completion notification flow today. This change does not invent one because reports have no requester/recipient model and the worker has no durable email outbox. Any future report notification must first add explicit recipients and idempotent delivery records, then use the same language contract.

## Migration and compatibility

One forward migration adds:

- `user.ui_language text NOT NULL DEFAULT 'en'` with a supported-value check;
- `reports.output_language text NOT NULL DEFAULT 'en'` with a supported-value check;
- `brand_opportunities.output_language text NOT NULL DEFAULT 'en'` with a supported-value check and language-aware index.

Schema source, SQL, Drizzle snapshot, and journal are committed together. No migration is applied to any database during implementation.

Old users, reports, and Opportunities behave exactly as English until explicitly changed or regenerated. API clients that omit report output language continue producing English reports.

## Testing and acceptance

Implementation follows red-green-refactor with focused tests for each slice:

- locale validation, fallback precedence, interpolation, catalog parity, and `Intl` formatting;
- SSR and hydration agreement, `<html lang>`, cookie persistence, session preference persistence, and same-URL switching;
- UI language independence from Program market/locale;
- English and Chinese shell/auth/customer/admin render outcomes;
- exact approved AI 检索脉络 terminology and CJK/mixed-script analysis;
- Opportunity cache/read/generation isolation by output language and unchanged admin boundary;
- report request, queue, persistence, render override, chart/export copy, and raw-evidence preservation;
- recipient-specific bilingual email templates and fallbacks;
- schema/migration shape and backward-compatible defaults.

Acceptance requires targeted unit/component tests, type checks for affected packages, production builds for affected apps/packages, and focused browser smoke tests covering auth, customer, admin, AI 检索脉络, Opportunities, and report rendering in both languages.

