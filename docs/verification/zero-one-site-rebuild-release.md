# Zero-one regional experience release evidence

Status: local release candidate, pending independent release-owner review. This document records a provisional design score; it does not claim that the strict release rubric has passed. No production push or deployment was performed.

Verification was performed on 2026-08-25 against fresh production-built output from the local tree based on `b35b94ab57dcce1ad22f2a1ae24c2d899d642035`, never against the development server.

## Release contract

- Human surfaces: 14 indexable English and Chinese pages with self-canonical, locale alternates, Markdown discovery, JSON-LD discovery, and `llms.txt` discovery.
- Agent surfaces: 14 noindex-follow HTML pages, 14 stable Markdown documents, and two locale catalogues with Human canonicals, stable fact groups, claim IDs, scope, limitations, and connected JSON-LD graphs.
- Canonical URLs: all 13 non-root Human trailing-slash variants and all 16 stable machine trailing-slash variants return query-preserving `307` redirects to the no-slash URL for GET and HEAD before representation negotiation.
- Negotiation: 904 GET/HEAD Accept and trailing-slash cases passed, including an omitted `Accept` header, valid HTML/Markdown preferences, unsupported media, and zero 5xx responses.
- Forms: Global exposes exactly name, email, and company; China exposes exactly name, phone, and company. Smoke rejects any additional visible `input`, `select`, or `textarea`.
- Public output: source and runtime checks found no prohibited ancestry/licensing language, implementation commentary, or retired publication output.

## Product and trust boundary

The Human and Agent surfaces now describe the same current delivery model: a Yonaris-led managed review with a customer-visible evidence workspace, not a self-serve ranking dashboard. The handoff covers the agreed question scope, complete answer snapshot, citations only when the source exposes them, named-alternative comparison, prioritized next review, and a recheck record for the same scope. Rechecks follow the agreed project questions rather than an invented continuous-monitoring or fixed-SLA promise.

The Product and Company pages expose the actual English and Chinese Agent Markdown/catalogue records, review date, scope, limitations, and first-party provenance. The pages state what those records prove and do not prove. They do not invent customers, results, an independent audit, a legal entity, a retention policy, or real AI observations. The approved visible support/privacy fallback is `mailto:black.dcp@outlook.com`.

Form copy is conditional on the delivery provider accepting the request. A provider-accepted response is not presented as inbox delivery. An unconfirmed response preserves the entered values, offers retry, and exposes a mail draft fallback that sends nothing until the visitor sends it.

## Built-output browser evidence

The final browser suite used `WWW_E2E_REUSE_SERVER=true` and `WWW_E2E_PORT=3001` against `apps/www/.output/server/index.mjs` bound to `127.0.0.1:3001`.

| Evidence | Result |
| --- | --- |
| Human captures | 14 routes × 390×844, 768×1024, 1024×768, and 1440×900 = 56 |
| Representative Agent captures | `/agent`, `/agent/product`, `/zh/agent`, `/zh/agent/product` × four viewports = 16 |
| Layout records | 72; zero overflow, clipping, collision, lexical-break, text-floor, or mobile-target findings; `inlineTargetExceptions=[]` |
| Accessibility | Axe on 18 Human/Agent routes; zero violations at every severity |
| Tabs | 9 tablists, 34 tabs, 36 Arrow/Home/End keyboard actions; zero failures |
| Focus | 18 route-level visible-focus checks; zero failures |
| Approach paint | 768, 1024, and 1440 checks keep the full active tab label inside the visible paint area |
| Diagnostic CTAs | Global 390 and China 768 have no bottom overlay; header/prominent CTAs reach an explicit form anchor |
| Agent rails | Global/China at 390/768 expose a 44px scroll affordance and a genuinely horizontally scrollable topic rail |
| Forms | Exact locale fields, empty-submit focus, intercepted `delivery_unconfirmed`, value preservation, mailto fallback, UUID idempotency, and provider-accepted/no-inbox-claim state passed |

Evidence root: `.superpowers/sdd/2026-08-25-experience-90-agent-readable/screenshots/`.

Machine-readable summary: `browser-qa-summary.json`, generated `2026-08-25T12:20:39Z`, SHA-256 `8FBD36968D29D9546C8D56822409C2BB6A89D12711B5274C119E2B1638CA4AA8`.

Representative captures:

- `human-en-home-1440x900.png` and `human-en-home-390x844.png`: Global proposition, answer artefact, evidence rail, and decision path.
- `human-approach-768x1024.png`, `human-approach-1024x768.png`, and `human-approach-1440x900.png`: complete active `01 Choose the question` label with no paint clipping.
- `human-product-1440x900.png`: managed review, customer-visible workspace, inspectable handoff, and recheck boundary.
- `human-company-1440x900.png` and `human-privacy-390x844.png`: first-party public-record limits and visible support/privacy fallback.
- `human-zh-1440x900.png` and `human-zh-390x844.png`: China-local narrative with intact lexical units and readable decision path.
- `human-zh-diagnostic-768x1024.png`: in-flow conversion path and explicit China form anchor.
- `agent-agent-390x844.png` and `agent-zh-agent-product-1440x900.png`: Human canonical, Markdown, catalogue, locale, review date, stable facts, evidence links, scope, and limitations.

## Provisional design review

This is an implementer assessment grounded in the final captures and interactions, not an independent approval. The trust score is intentionally capped because the repository does not contain independently verifiable customer evidence, operator/legal identity evidence, or real-answer provenance. Consequently, the current provisional score does **not** satisfy the rubric's mandatory Trust 14/15 floor and is not represented as a ≥90 release pass.

| Dimension | Provisional score | Concrete evidence and remaining limit |
| --- | ---: | --- |
| Positioning and first-screen value | 14/15 | Both homepages state the buying shift immediately and show a concrete, explicitly illustrative review artefact. |
| Trust, evidence, and buying confidence | 12/15 | First-party records, review date, scope, limitations, support fallback, and honest delivery states are inspectable. Independent identity/customer/real-answer proof is unavailable and was not invented. |
| Product comprehension and actionability | 14/15 | Independently authored EN/ZH copy explains the managed-review/workspace model, who does what, exact handoff fields, next review, and scoped recheck. |
| Visual hierarchy and system coherence | 14/15 | Global editorial answer field, China decision interface, and Agent fact interface share the Yonaris wordmark, navy, paper, and Signal Orange without collapsing into one regional template. |
| Information architecture and conversion | 9/10 | Topic-paired Human/Agent navigation, locale parity, canonical discovery, explicit diagnostic anchors, and three-field handoffs are coherent. |
| Responsive reading quality | 9/10 | 72 captures have zero findings; meaningful mobile labels meet the 0.75rem floor, body/readout text the 0.875rem floor, and interactive targets 44×44. |
| Interaction and motion quality | 9/10 | Tabs, keyboard operation, focus, CTA-to-form behavior, form error/success boundaries, and reduced-motion treatment pass. |
| Accessibility and performance resilience | 7/10 | Axe and focus checks are clean and the HEAD stream leak is fixed. The shared client chunk remains about 597 kB and no independent performance lab result is claimed. |
| **Total** | **88/100 provisional** | Independent review is required; Trust is below the mandatory 14/15 floor. |

## Automated, runtime, and container gates

- `node --test apps/www/scripts/smoke-marketing.test.mjs apps/www/scripts/smoke-marketing-caddy.test.mjs`: 26/26 passed.
- `pnpm --filter @workspace/www test`: 28 files, 172 tests passed.
- `pnpm --filter @workspace/www check-types`: passed.
- `pnpm --filter @workspace/www build`: passed; the existing ~597 kB shared-client-chunk advisory remains.
- `pnpm --filter @workspace/www audit:legacy-marketing`: passed.
- `pnpm --filter @workspace/www audit:site-manifest`: passed.
- `pnpm audit:public-output --phase source`: `[]`.
- `pnpm test:public-output-policy`: 34/34 passed.
- `git diff --check`: passed.
- Final local marketing image: `yonaris-www@sha256:3df7e6e80fb3c951212755a8dadf89f9ac175ca6dff0f121931ba48fb4281ef6`.
- Direct image smoke: 49 routes, 13 redirects, 48 same-origin assets, and 904 negotiation/trailing-slash cases passed.
- Caddy boundary smoke: trusted IPv4, trusted IPv6, direct-host identity, exact public-route policy, and strict 904-case matrix passed.

## HEAD SSR ownership regression

The earlier 120-second warning was reproduced as a real live-process HTML `HEAD` SSR stream ownership leak, not a harmless shutdown advisory. A focused regression now verifies that the application server strips a routed HTML `HEAD` result while it still owns the TanStack `SsrResponse`: the handler runs once, cleanup/disposal runs exactly once, status and headers are preserved, and the returned body is null. `GET` retains its body and ownership; Markdown, 406, and 307 behavior remains unchanged.

Fresh runtime evidence:

- Built server: isolated HTML `HEAD`, complete 904-case governed matrix, and the browser run were observed for more than 140 seconds with zero `SSR stream transform exceeded maximum lifetime` warnings.
- Final Docker image: HTML `HEAD` at `2026-08-25T12:24:31Z` plus the complete governed matrix was observed through `2026-08-25T12:26:47Z` (136 seconds) with only the normal listening log and zero watchdog warnings.

## Honest release boundary

Automatic email or inbox delivery is not claimed or verified. QA proves exact fields, validation, the provider-accepted wording, and the honest unconfirmed/retry/mailto state; it does not represent that an email reached an inbox.

No production push, deployment, external message, or repository-setting change was performed. Independent review remains the release blocker, especially for the explicit Trust evidence gap and the provisional rubric score.
