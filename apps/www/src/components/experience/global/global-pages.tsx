import type { ReactNode } from "react";
import { PAGE_FACTS } from "@/content/experience/canonical-public-facts";
import { GLOBAL_COPY } from "@/content/experience/global-copy";
import type { HumanPageKey } from "@/content/experience/types";
import type { DiagnosticRequestType } from "@/lib/diagnostic-schema";
import { CanonicalRecordTransform } from "../shared/canonical-record-transform";
import { CinematicField, Site06ResponsiveImage } from "../shared/cinematic-field";
import { DecisionTraceScene } from "../shared/decision-trace-scene";
import { EvidenceSheet } from "../shared/evidence-sheet";
import { LeadForm } from "../shared/lead-form";
import { ProductProofScene } from "../shared/product-proof-scene";
import { BuyingQuestionDossier, EN_READING_RECORDS, EvidenceReviewScene } from "./global-scenes";
import { GlobalShell } from "./global-shell";

function ActionLink({ href, children }: { href: string; children: ReactNode }) {
	return (
		<a className="site-06-action" href={href}>
			{children}
		</a>
	);
}

const pageFacts = {
	product: PAGE_FACTS.en.product,
	approach: PAGE_FACTS.en.approach,
	geo: PAGE_FACTS.en.geo,
	diagnostic: PAGE_FACTS.en.diagnostic,
	privacy: PAGE_FACTS.en.privacy,
} as const;

function HomePageLead() {
	const copy = GLOBAL_COPY.home;
	return (
		<header className="site-06-page-lead">
			<p className="site-06-kicker">{copy.eyebrow}</p>
			<h1>{copy.title}</h1>
			<p className="site-06-hero__lead">{copy.lead}</p>
			<ActionLink href={copy.primaryAction.href}>{copy.primaryAction.label}</ActionLink>
		</header>
	);
}

function RouteLead({ pageKey }: { pageKey: Exclude<HumanPageKey, "home" | "company" | "privacy"> }) {
	const copy = GLOBAL_COPY[pageKey];
	return (
		<header className="site-06-page-lead">
			<p className="site-06-kicker">{copy.eyebrow}</p>
			<h1>{copy.title}</h1>
			<p className="site-06-hero__lead">{copy.lead}</p>
		</header>
	);
}

function DarkClose({ pageKey }: { pageKey: HumanPageKey }) {
	const copy = GLOBAL_COPY[pageKey];
	return (
		<section className="site-06-dark-close">
			<div>
				<h2>{copy.closingTitle}</h2>
				<p>{copy.closingBody}</p>
			</div>
			<ActionLink href={copy.primaryAction.href}>{copy.primaryAction.label}</ActionLink>
		</section>
	);
}

export function GlobalHomePage() {
	return (
		<GlobalShell pageKey="home">
			<div
				className="site-06-page-composition site-06-page-composition--cinematic site-06-home-composition"
				data-page-composition="cinematic-orbit"
			>
				<CinematicField
					image={{
						src: "/brand/site-06/decision-room-original.png",
						alt: "A team reviewing a decision in a warm meeting room",
						focalPosition: "center center",
						width: 1535,
						height: 1024,
					}}
					priority
					className="site-06-home-cinematic"
				>
					<HomePageLead />
					<DecisionTraceScene locale="en" />
				</CinematicField>

				<section className="site-06-section site-06-home-dossier">
					<header className="site-06-split-intro">
						<h2>The shortlist now forms before the click.</h2>
						<p>
							Traditional MarTech begins with exposure, visits and leads. Yonaris starts earlier: with the question, the
							evidence an agent can find and the comparison a buyer may inherit.
						</p>
					</header>
					<BuyingQuestionDossier />
				</section>

				<section className="site-06-home-workbench">
					<div className="site-06-section">
						<article
							className="site-06-product-proof-context"
							id={EN_READING_RECORDS[1]?.stableId}
							data-stable-id={EN_READING_RECORDS[1]?.stableId}
							tabIndex={-1}
						>
							<p className="site-06-kicker">Product evidence attached to the decision system</p>
							<h2>Inspect the working state behind the next review.</h2>
							<p>{EN_READING_RECORDS[1]?.fact}</p>
							<small>
								{EN_READING_RECORDS[1]?.evidence} · {EN_READING_RECORDS[1]?.boundary}
							</small>
						</article>
						<ProductProofScene locale="en" compact />
					</div>
				</section>

				<CinematicField
					image={{
						src: "/brand/site-06/glass-passage-original.png",
						alt: "People moving through a glass business passage",
						focalPosition: "center center",
						width: 1717,
						height: 916,
					}}
					className="site-06-home-comparison-photo"
				>
					<header className="site-06-page-lead">
						<h2>Keep the question, evidence and retest together.</h2>
						<p className="site-06-hero__lead">
							A review preserves the original buying question, the answer and sources observed at the time, the change
							made, and the retest under comparable conditions.
						</p>
					</header>
					<EvidenceReviewScene />
				</CinematicField>

				<section className="site-06-section site-06-home-bridge">
					<header className="site-06-split-intro">
						<h2>One public truth. Two ways to read it.</h2>
						<p>
							People need context and judgment. Agents need explicit facts, evidence and boundaries. The public material
							should serve both without creating two competing versions of the company.
						</p>
					</header>
					<article
						className="site-06-home-bridge__scope"
						id={EN_READING_RECORDS[2]?.stableId}
						data-stable-id={EN_READING_RECORDS[2]?.stableId}
						tabIndex={-1}
					>
						<p>{EN_READING_RECORDS[2]?.fact}</p>
						<small>
							{EN_READING_RECORDS[2]?.evidence} · {EN_READING_RECORDS[2]?.boundary}
						</small>
					</article>
					<CanonicalRecordTransform locale="en" compact />
					<aside className="site-06-home-bridge__note">
						The category fact stays fixed while its public basis, boundary, stable identity and representations become
						explicit.
					</aside>
					<ActionLink href="/company">Read the corresponding public record</ActionLink>
				</section>

				<DarkClose pageKey="home" />
			</div>
		</GlobalShell>
	);
}

export function GlobalProductPage() {
	return (
		<GlobalShell pageKey="product">
			<div
				className="site-06-page-composition site-06-page-composition--cinematic site-06-product-composition"
				data-page-composition="evidence-workbench"
			>
				<CinematicField
					image={{
						src: "/brand/site-06/decision-room-original.png",
						alt: "A team reviewing a decision in a warm meeting room",
						focalPosition: "center center",
						width: 1535,
						height: 1024,
					}}
					priority
					className="site-06-product-cinematic"
				>
					<RouteLead pageKey="product" />
					<EvidenceSheet
						label="Answer dossier · Illustrative structure"
						annotation={
							<span>
								Source type · company capability record
								<br />
								Owner · public company material
								<br />
								Scope · named market condition
								<br />
								Review date · 27 Aug 2026
							</span>
						}
					>
						<p>Which company can support this decision without adding risk?</p>
						<p className="site-06-evidence-sheet__support">
							The answer gives weight to fit with the operating conditions, evidence a buying team can review, and a
							delivery boundary that remains explicit.
						</p>
					</EvidenceSheet>
				</CinematicField>

				<section className="site-06-section site-06-product-trace">
					<article className="site-06-product-fact" id={pageFacts.product.id} tabIndex={-1}>
						<p>{pageFacts.product.value}</p>
						<small>
							{pageFacts.product.source} · {pageFacts.product.boundary}
						</small>
					</article>
					<ProductProofScene locale="en" />
				</section>

				<DarkClose pageKey="product" />
			</div>
		</GlobalShell>
	);
}

export function GlobalApproachPage() {
	return (
		<GlobalShell pageKey="approach">
			<div
				className="site-06-page-composition site-06-page-composition--cinematic site-06-approach-composition"
				data-page-composition="comparison-field"
			>
				<CinematicField
					image={{
						src: "/brand/site-06/glass-passage-original.png",
						alt: "People moving through a glass business passage",
						focalPosition: "center 72%",
						width: 1717,
						height: 916,
					}}
					priority
					className="site-06-approach-cinematic"
				>
					<RouteLead pageKey="approach" />
					<aside className="site-06-same-question-preview" aria-label="Baseline and retest evidence preview">
						<p className="site-06-kicker">Same buying question</p>
						<blockquote>What changed in the answer—and what evidence caused the change?</blockquote>
						<p data-review-state="baseline">
							<strong>Baseline</strong> Capability is visible; the buying condition is unsupported.
						</p>
						<p data-review-state="retest">
							<strong>Retest</strong> The new source states the condition, scope and review date.
						</p>
					</aside>
				</CinematicField>

				<section className="site-06-approach-stage">
					<div className="site-06-section">
						<article className="site-06-approach-record" id={pageFacts.approach.id} tabIndex={-1}>
							<header className="site-06-route-record-note">
								<p>{pageFacts.approach.value}</p>
								<p>
									<strong>Public basis:</strong> {pageFacts.approach.source}
								</p>
								<p>
									<strong>Review boundary:</strong> {pageFacts.approach.boundary}
								</p>
							</header>
							<EvidenceReviewScene preview />
						</article>
					</div>
				</section>

				<section className="site-06-section site-06-editorial-close">
					<h2>{GLOBAL_COPY.approach.closingTitle}</h2>
					<p>{GLOBAL_COPY.approach.closingBody}</p>
				</section>
			</div>
		</GlobalShell>
	);
}

export function GlobalCompanyPage() {
	const copy = GLOBAL_COPY.company;
	const supportingRecords = EN_READING_RECORDS.filter((record) => record.id !== "category");
	return (
		<GlobalShell pageKey="company">
			<div
				className="site-06-page-composition site-06-company-composition"
				data-page-composition="canonical-record-field"
			>
				<section className="site-06-company-field">
					<div className="site-06-company-lead">
						<header className="site-06-page-lead">
							<p className="site-06-kicker">{copy.eyebrow}</p>
							<h1>{copy.title}</h1>
							<p className="site-06-hero__lead">{copy.lead}</p>
						</header>
						<CanonicalRecordTransform locale="en" />
					</div>
				</section>

				<section className="site-06-section site-06-company-document" data-scene-object="canonical-fact-record">
					<header className="site-06-split-intro">
						<h2>Machine-readable does not mean machine-written.</h2>
						<p>
							Clear headings, stable addresses, visible sources, scoped facts and consistent public records help
							retrieval. They do not guarantee ranking, inclusion, retrieval or citation.
						</p>
					</header>
					<section className="site-06-company-anchor-ledger" aria-label="Yonaris purpose and scope records">
						{supportingRecords.map((record) => (
							<article key={record.id} id={record.stableId} data-stable-id={record.stableId} tabIndex={-1}>
								<span>{record.prompt}</span>
								<p>{record.fact}</p>
								<small>
									{record.evidence} · {record.boundary}
								</small>
							</article>
						))}
					</section>
					<p className="site-06-company-document__statement">
						People receive context for a decision. Agents receive the same facts with evidence, scope and a stable
						relationship to the rest of the company record.
					</p>
					<ActionLink href="/agent/company">Read the corresponding Agent record</ActionLink>
				</section>
			</div>
		</GlobalShell>
	);
}

export function GlobalGeoPage() {
	return (
		<GlobalShell pageKey="geo" tone="paper">
			<div className="site-06-page-composition site-06-market-composition" data-page-composition="market-editorial">
				<section className="site-06-market-editorial">
					<RouteLead pageKey="geo" />
					<figure className="site-06-editorial-photo">
						<Site06ResponsiveImage
							image={{
								src: "/brand/site-06/glass-passage-original.png",
								alt: "A business conversation in a glass meeting space",
								width: 1717,
								height: 916,
							}}
							sizes="(max-width: 880px) 100vw, 50vw"
						/>
					</figure>
				</section>

				<article
					className="site-06-section site-06-market-ledger"
					aria-label="Market conditions record"
					id={pageFacts.geo.id}
					tabIndex={-1}
				>
					<header>
						<p className="site-06-kicker">One decision, read in its actual context</p>
						<h2>Context is part of the evidence record.</h2>
						<p>{pageFacts.geo.value}</p>
					</header>
					<dl>
						<div>
							<dt>Market</dt>
							<dd>The commercial context surrounding the choice.</dd>
						</div>
						<div>
							<dt>Language</dt>
							<dd>The words a buyer uses to describe the need.</dd>
						</div>
						<div>
							<dt>Buying context</dt>
							<dd>The condition that determines what a suitable answer must support.</dd>
						</div>
						<div>
							<dt>Alternatives</dt>
							<dd>The options considered under the same question.</dd>
						</div>
						<div>
							<dt>Evidence</dt>
							<dd>The sources, scope, review date and boundaries available for inspection.</dd>
						</div>
					</dl>
					<aside className="site-06-route-record-note">
						<p>{pageFacts.geo.source}</p>
						<p>{pageFacts.geo.boundary}</p>
					</aside>
				</article>

				<DarkClose pageKey="geo" />
			</div>
		</GlobalShell>
	);
}

export function GlobalDiagnosticPage({ requestType = "consultation" }: { requestType?: DiagnosticRequestType } = {}) {
	const isPrivacyRequest = requestType === "privacy";
	return (
		<GlobalShell pageKey="diagnostic">
			<div
				className="site-06-page-composition site-06-page-composition--cinematic site-06-diagnostic-composition"
				data-page-composition="contact-cinematic"
			>
				<CinematicField
					image={{
						src: "/brand/site-06/working-session-original.png",
						alt: "A working session reviewing evidence together",
						focalPosition: "center center",
						width: 1693,
						height: 929,
					}}
					priority
					className="site-06-contact-cinematic"
				>
					<article id={pageFacts.diagnostic.id} className="site-06-contact-scene" tabIndex={-1}>
						{isPrivacyRequest ? (
							<header className="site-06-page-lead">
								<p className="site-06-kicker">Privacy request</p>
								<h1>Ask Yonaris to review a previous contact request.</h1>
								<p className="site-06-hero__lead">
									Use the same contact and company details so we can identify the record for manual review and follow up
									through the channel you provide.
								</p>
							</header>
						) : (
							<RouteLead pageKey="diagnostic" />
						)}
						<div id="contact-form" className="site-06-contact-form">
							<LeadForm locale="en" compact requestType={requestType} />
						</div>
						<aside className="site-06-contact-scene__record">
							{isPrivacyRequest ? (
								<>
									<p>The same three visible details identify an earlier contact request.</p>
									<p>Yonaris privacy-request process · reviewed 27 Aug 2026</p>
									<p>Submitting starts manual review; it does not automatically delete records.</p>
								</>
							) : (
								<>
									<p>{pageFacts.diagnostic.value}</p>
									<p>{pageFacts.diagnostic.source}</p>
									<p>{pageFacts.diagnostic.boundary}</p>
								</>
							)}
						</aside>
					</article>
				</CinematicField>
			</div>
		</GlobalShell>
	);
}

export function GlobalPrivacyPage() {
	return (
		<GlobalShell pageKey="privacy" tone="paper">
			<div className="site-06-page-composition site-06-privacy-composition" data-page-composition="privacy-editorial">
				<article className="site-06-privacy-document" id={pageFacts.privacy.id} tabIndex={-1}>
					<header className="site-06-privacy-document__header">
						<p className="site-06-kicker">{GLOBAL_COPY.privacy.eyebrow}</p>
						<h1>{GLOBAL_COPY.privacy.title}</h1>
						<p className="site-06-hero__lead">{GLOBAL_COPY.privacy.lead}</p>
						<p className="site-06-privacy-document__purpose">{pageFacts.privacy.value}</p>
						<p className="site-06-privacy-document__basis">{pageFacts.privacy.source}</p>
						<p className="site-06-privacy-document__boundary">{pageFacts.privacy.boundary}</p>
					</header>
					<section>
						<h2>Three visible details</h2>
						<p>Name, work email and company are the only visible fields required for an English contact request.</p>
					</section>
					<section>
						<h2>How the request is delivered</h2>
						<p>
							Yonaris uses Resend as an email processor to send the form contents to Yonaris. The details are used to
							understand and respond to your request; browser analytics do not receive the form values. According to{" "}
							<a href="https://resend.com/docs/dashboard/domains/regions">Resend region documentation</a> and its{" "}
							<a href="https://resend.com/legal/dpa">Data Processing Addendum</a>, form contents sent through Resend are
							processed and stored in the United States.
						</p>
					</section>
					<section>
						<h2>Retention and deletion</h2>
						<p>
							Retention depends on what is reasonably needed to respond, arrange follow-up and meet applicable
							record-keeping duties. A privacy or deletion request is reviewed manually; the form does not automatically
							delete a record. Use the same contact and company details as the earlier request so the team can identify
							it. No personal email address is published here.
						</p>
						<ActionLink href="/diagnostic?intent=privacy">Request a privacy review</ActionLink>
					</section>
				</article>
			</div>
		</GlobalShell>
	);
}

export const GLOBAL_PAGES = {
	home: GlobalHomePage,
	product: GlobalProductPage,
	approach: GlobalApproachPage,
	geo: GlobalGeoPage,
	company: GlobalCompanyPage,
	diagnostic: GlobalDiagnosticPage,
	privacy: GlobalPrivacyPage,
} as const satisfies Record<HumanPageKey, () => ReactNode>;
