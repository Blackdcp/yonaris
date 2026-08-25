# Zero-one regional experience release evidence

Status: local release candidate. Production push and deployment are intentionally pending independent release-owner review.

Candidate source starts from `bd6ea1c8e0d89c90192f51fc8f352ee1255561f1`. Verification was performed on the final local tree on 2026-08-25 against production-built output, never the development server.

## Release contract

- Human surfaces: 14 indexable English and Chinese pages with self-canonical, locale alternates, Markdown discovery, JSON-LD discovery, and `llms.txt` discovery.
- Agent surfaces: 14 noindex-follow HTML pages, 14 stable Markdown documents, and two locale catalogues with Human canonicals, stable fact groups, claim IDs, scope, limitations, and connected JSON-LD graphs.
- Canonical URLs: all 13 non-root Human trailing-slash variants and all 16 stable machine trailing-slash variants return query-preserving `307` redirects to the no-slash URL for GET and HEAD before representation negotiation.
- Negotiation: 904 GET/HEAD Accept and trailing-slash cases passed, including an omitted `Accept` header, valid HTML/Markdown preferences, unsupported media, and zero 5xx responses.
- Forms: Global exposes exactly name, email, and company; China exposes exactly name, phone, and company. Extra visible controls are rejected by release smoke.
- Public output: source and runtime checks found no prohibited ancestry/licensing language, implementation commentary, or retired publication output.

## Built-output browser evidence

The final browser suite used `WWW_E2E_REUSE_SERVER=true` and `WWW_E2E_PORT=3001` against `apps/www/.output/server/index.mjs` bound to `127.0.0.1:3001`.

| Evidence | Result |
| --- | --- |
| Human captures | 14 routes × 390×844, 768×1024, 1024×768, and 1440×900 = 56 |
| Representative Agent captures | `/agent`, `/agent/product`, `/zh/agent`, `/zh/agent/product` × four viewports = 16 |
| Layout records | 72; zero overflow, clipping, collision, lexical-break, text-floor, or mobile-target findings; zero exceptions |
| Accessibility | Axe on 18 Human/Agent routes; zero minor, moderate, serious, critical, or unknown findings |
| Tabs | 9 tablists, 34 tabs, 36 Arrow/Home/End keyboard actions; zero failures |
| Focus | 18 route-level visible-focus checks; zero failures |
| Forms | Two locale contracts; empty-submit focus, intercepted 503 `delivery_unconfirmed`, no false success, UUID idempotency, and input preservation passed |

The machine-readable browser summary and captures are stored at `.superpowers/sdd/2026-08-25-experience-90-agent-readable/screenshots/`. Representative evidence:

- `human-en-home-1440x900.png` and `human-en-home-390x844.png`: Global proposition, illustrative answer artefact, detached evidence rail, market decision path, and lead handoff.
- `human-product-1440x900.png`: Observe → Compare → Review → Recheck product walkthrough.
- `human-zh-1440x900.png` and `human-zh-390x844.png`: China-local first-screen narrative, intact “第一解释权” lexical unit, four commercial risks, four diagnostic outputs, and coherent two-row decision path.
- `human-zh-approach-390x844.png`: China-local service sequence and readable priority treatment.
- `agent-agent-390x844.png` and `agent-zh-agent-product-1440x900.png`: explicit Human canonical, Markdown, catalogue, locale, review date, scope, stable facts, evidence links, and limitations.

## Strict 90-point review

The rubric is a release judgment grounded in the captures and interactions above, not an automated scientific score.

| Dimension | Score | Concrete evidence |
| --- | ---: | --- |
| Positioning and first-screen value | 14/15 | Both homepages state the buying shift immediately and show a concrete review artefact within the first 1.5 screens. |
| Trust, evidence, and buying confidence | 14/15 | Illustrative material is labelled as such; evidence rails, scope, limitations, citations, review dates, and honest unconfirmed form state avoid invented proof. |
| Product comprehension and actionability | 14/15 | Global shows Observe/Compare/Review/Recheck; China shows question scope, answer snapshot, gap evidence, and priority list with a clear next action. |
| Visual hierarchy and system coherence | 15/15 | The three deliberate systems—Global editorial/answer field, China command centre, and Agent fact interface—share the Yonaris wordmark, navy, paper, and Signal Orange while remaining purpose-specific. |
| Information architecture and conversion | 9/10 | Topic-paired Human/Agent navigation, locale parity, canonical discovery, and exactly three-field handoffs are coherent on all governed routes. |
| Responsive reading quality | 9/10 | 72 four-viewport captures have no overflow or lexical break; visible mobile functional labels are at least 0.75rem, body/readout text at least 0.875rem with 1.4 line height, and targets at least 44×44. |
| Interaction and motion quality | 9/10 | All scene tabs pass click/focus/Arrow/Home/End behavior with bounded transitions and reduced-motion handling; form focus and error-state behavior are deterministic. |
| Accessibility and performance resilience | 8/10 | Axe is clean across 18 routes, focus is visible, and built/Docker output is stable. The existing shared client chunk remains about 597 kB; the long-lived local Nitro QA process also emitted TanStack Router's 120-second stream-cleanup warning when its buffered logs were drained at shutdown, without a failed response or gate. |
| **Total** | **92/100** | Release threshold ≥90; trust and comprehension both meet the required 14/15 floor. |

## Automated and container gates

- `node --test apps/www/scripts/smoke-marketing.test.mjs apps/www/scripts/smoke-marketing-caddy.test.mjs`: 24/24 passed.
- `pnpm --filter @workspace/www test`: 27 files, 157 tests passed.
- `pnpm --filter @workspace/www check-types`: passed.
- `pnpm --filter @workspace/www build`: passed; only the existing >500 kB shared-chunk advisory remains.
- `pnpm --filter @workspace/www audit:legacy-marketing`: passed.
- `pnpm --filter @workspace/www audit:site-manifest`: passed.
- `pnpm audit:public-output -- --phase source`: `[]`.
- `pnpm test:public-output-policy`: 34/34 passed.
- `git diff --check`: passed (line-ending notices only).
- Final immutable marketing image: `yonaris-www@sha256:e374bcd8c08dc4549458d8df6e8c051fd1a69e2e8b1d57c0256b1651689dab8f`.
- Direct image smoke: 49 routes, 13 redirects, 48 same-origin assets, and 904 negotiation/trailing-slash cases passed.
- Caddy boundary smoke: trusted IPv4, trusted IPv6, direct-host identity, exact public-route policy, and strict 904-case matrix passed.

## Honest delivery boundary

Automatic email delivery is not claimed. Production Resend credentials and sending-domain DNS are not configured in this release context. QA validates exact regional fields, client/server validation, an intercepted 503 response, and the honest `delivery_unconfirmed` state with preserved input; it does not represent that an email was sent.

Release-owner monitoring should watch the TanStack Router SSR stream-lifetime warning noted above. It did not reproduce as a response failure, 5xx, browser error, container-smoke failure, or accessibility failure in this candidate, so it is recorded as a runtime advisory rather than hidden or presented as resolved.

No production push, deployment, external message, or repository setting change was performed as part of this local release-candidate task.
