import type { ReactNode } from "react";
import { PAGE_FACTS } from "@/content/experience/canonical-public-facts";
import { GLOBAL_COPY } from "@/content/experience/global-copy";
import type { HumanPageKey } from "@/content/experience/types";
import { LeadForm } from "../shared/lead-form";
import { OrbitField } from "../shared/orbit-field";
import {
	BuyingQuestionDossier,
	CompanyReadingScene,
	EvidenceReviewScene,
	HomeReadingScene,
	MarketAnswerCaseFile,
	PlatformInspectorScene,
} from "./global-scenes";
import { GlobalShell } from "./global-shell";

function ActionLink({ href, children }: { href: string; children: ReactNode }) {
	return (
		<a className="site-06-action" href={href}>
			{children}
		</a>
	);
}

function Photo({ src, alt, credit }: { src: string; alt: string; credit: string }) {
	return (
		<figure className="site-06-hero__media">
			<img src={src} alt={alt} />
			<figcaption>{credit}</figcaption>
		</figure>
	);
}

const heroFactIds = {
	product: PAGE_FACTS.en.product.id,
	approach: PAGE_FACTS.en.approach.id,
	geo: PAGE_FACTS.en.geo.id,
	diagnostic: PAGE_FACTS.en.diagnostic.id,
	privacy: PAGE_FACTS.en.privacy.id,
} as const satisfies Partial<Record<HumanPageKey, string>>;

function Hero({ pageKey, media }: { pageKey: HumanPageKey; media: ReactNode }) {
	const copy = GLOBAL_COPY[pageKey];
	return (
		<section className="site-06-hero" id={heroFactIds[pageKey as keyof typeof heroFactIds]}>
			<div className="site-06-hero__copy">
				<p className="site-06-kicker">{copy.eyebrow}</p>
				<h1>{copy.title}</h1>
				<p className="site-06-hero__lead">{copy.lead}</p>
				<ActionLink href={copy.primaryAction.href}>{copy.primaryAction.label}</ActionLink>
			</div>
			{media}
		</section>
	);
}

function ClosingSection({ pageKey }: { pageKey: HumanPageKey }) {
	const copy = GLOBAL_COPY[pageKey];
	return (
		<section className="site-06-section site-06-close">
			<h2>{copy.closingTitle}</h2>
			<p className="site-06-hero__lead">{copy.closingBody}</p>
			<ActionLink href={copy.primaryAction.href}>{copy.primaryAction.label}</ActionLink>
		</section>
	);
}

export function GlobalHomePage() {
	return (
		<GlobalShell pageKey="home">
			<Hero
				pageKey="home"
				media={
					<Photo
						src="/brand/site-06/conference-room.jpg"
						alt="A conference room in warm daylight"
						credit="Photo: Nastuh Abootalebi / Unsplash"
					/>
				}
			/>

			<section className="site-06-section">
				<header className="site-06-section__intro">
					<p className="site-06-kicker">One public truth. Two ways to read it.</p>
					<h2>People need context. Agents need explicit evidence and boundaries.</h2>
				</header>
				<HomeReadingScene />
			</section>

			<section className="site-06-section">
				<header className="site-06-section__intro">
					<p className="site-06-kicker">Illustrative buying question and answer evidence</p>
					<h2>The shortlist now forms before the click.</h2>
					<p className="site-06-hero__lead">
						Traditional MarTech begins with exposure, visits and leads. Yonaris starts earlier: with the question, the
						evidence an agent can find and the comparison a buyer may inherit.
					</p>
				</header>
				<BuyingQuestionDossier />
			</section>

			<section className="site-06-section">
				<MarketAnswerCaseFile />
			</section>

			<section className="site-06-section">
				<header className="site-06-section__intro">
					<h2>Keep the question, evidence and retest together.</h2>
					<p className="site-06-hero__lead">
						A review preserves the original buying question, the answer and sources observed at the time, the change
						made, and the retest under comparable conditions.
					</p>
				</header>
				<EvidenceReviewScene />
			</section>

			<ClosingSection pageKey="home" />
		</GlobalShell>
	);
}

export function GlobalProductPage() {
	return (
		<GlobalShell pageKey="product">
			<Hero
				pageKey="product"
				media={
					<div>
						<Photo
							src="/brand/site-06/conference-room.jpg"
							alt="A meeting room in warm daylight"
							credit="Photo: Nastuh Abootalebi / Unsplash"
						/>
						<article className="site-06-evidence-document" aria-label="Illustrative answer dossier">
							<span>Answer dossier · Illustrative structure</span>
							<p className="site-06-evidence-document__answer">
								Which company can support this decision without adding risk?
							</p>
							<p>
								Fit with the operating conditions, evidence a buying team can review, and an explicit delivery boundary.
							</p>
						</article>
					</div>
				}
			/>

			<section className="site-06-section">
				<header className="site-06-section__intro">
					<p className="site-06-kicker">One de-identified answer</p>
					<h2>Follow the phrase that controls the comparison.</h2>
				</header>
				<PlatformInspectorScene />
			</section>

			<ClosingSection pageKey="product" />
		</GlobalShell>
	);
}

export function GlobalApproachPage() {
	return (
		<GlobalShell pageKey="approach">
			<Hero
				pageKey="approach"
				media={
					<Photo
						src="/brand/site-06/business-walk.jpg"
						alt="Two business people walking outside a modern workplace"
						credit="Photo: Mikhail Nilov / Pexels"
					/>
				}
			/>

			<section className="site-06-section">
				<header className="site-06-section__intro">
					<h2>Keep the question fixed. Let the evidence change.</h2>
					<p className="site-06-hero__lead">
						This illustrative record shows the method, not a customer result. The buyer question and review conditions
						stay comparable across both readings.
					</p>
				</header>
				<EvidenceReviewScene preview />
			</section>

			<ClosingSection pageKey="approach" />
		</GlobalShell>
	);
}

export function GlobalGeoPage() {
	return (
		<GlobalShell pageKey="geo" tone="paper">
			<Hero
				pageKey="geo"
				media={
					<article
						className="site-06-evidence-document site-06-market-conditions"
						aria-label="Market conditions record"
					>
						<header>
							<span>Conditions held beside one question</span>
							<strong>One decision, read in its actual context</strong>
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
								<dt>Category</dt>
								<dd>The frame used to understand the company.</dd>
							</div>
							<div>
								<dt>Alternatives</dt>
								<dd>The options considered under the same question.</dd>
							</div>
							<div>
								<dt>Evidence</dt>
								<dd>The sources and boundaries available for review.</dd>
							</div>
						</dl>
					</article>
				}
			/>

			<section className="site-06-section">
				<h2>Context is part of the evidence record.</h2>
				<div className="site-06-evidence-document">
					<dl>
						<div>
							<dt>Market and language</dt>
							<dd>The words a buyer uses and the public material an agent can retrieve.</dd>
						</div>
						<div>
							<dt>Category and alternatives</dt>
							<dd>The comparison frame and the companies considered under the same question.</dd>
						</div>
						<div>
							<dt>Evidence conditions</dt>
							<dd>The source, scope, review date and boundary that make the reading inspectable.</dd>
						</div>
					</dl>
				</div>
			</section>

			<ClosingSection pageKey="geo" />
		</GlobalShell>
	);
}

export function GlobalCompanyPage() {
	return (
		<GlobalShell pageKey="company">
			<Hero
				pageKey="company"
				media={
					<OrbitField label="One public record for people and agents" interactive>
						<strong>One public record</strong>
					</OrbitField>
				}
			/>

			<section className="site-06-section">
				<CompanyReadingScene />
			</section>

			<section className="site-06-section">
				<h2>Machine-readable does not mean machine-written.</h2>
				<p className="site-06-hero__lead">
					Clear headings, stable addresses, visible sources, scoped facts and consistent public records help retrieval.
					They do not guarantee ranking, inclusion, retrieval or citation.
				</p>
				<ActionLink href="/agent/company">Read the corresponding Agent record</ActionLink>
			</section>

			<ClosingSection pageKey="company" />
		</GlobalShell>
	);
}

export function GlobalDiagnosticPage() {
	return (
		<GlobalShell pageKey="diagnostic">
			<Hero
				pageKey="diagnostic"
				media={
					<Photo
						src="/brand/site-06/glass-venue.jpg"
						alt="People moving through a large glass business venue"
						credit="Photo: Zerrin Velizade / Pexels"
					/>
				}
			/>

			<section className="site-06-section" id="contact-form">
				<LeadForm locale="en" />
			</section>
		</GlobalShell>
	);
}

export function GlobalPrivacyPage() {
	return (
		<GlobalShell pageKey="privacy" tone="paper">
			<Hero
				pageKey="privacy"
				media={
					<div className="site-06-evidence-document">
						<span>Contact request</span>
						<p className="site-06-evidence-document__answer">Name · work email · company</p>
						<p>Only these three visible fields are required.</p>
					</div>
				}
			/>

			<section className="site-06-section">
				<h2>Delivery is confirmed only after provider acceptance.</h2>
				<div className="site-06-evidence-document">
					<p>
						The form uses your details to respond to the request. If delivery is not confirmed, the page keeps the
						entered values and offers another attempt. Browser analytics do not receive the form values.
					</p>
				</div>
			</section>

			<ClosingSection pageKey="privacy" />
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
