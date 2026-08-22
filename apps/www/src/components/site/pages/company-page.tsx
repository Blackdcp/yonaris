import { getCompanyContent } from "@/content/site/company";
import type { Locale } from "@/content/site/types";
import { getCorePath, getSiteRoute } from "@/lib/site-manifest";
import { SiteShell } from "../site-shell";
import { CompanyReaderField } from "./company-reader-field";

function renderStageTitle(title: string, locale: Locale): React.ReactNode {
	if (locale === "zh") {
		const separatorIndex = title.indexOf("，");
		if (separatorIndex < 0) return title;

		return (
			<>
				<span className="company-nowrap">{title.slice(0, separatorIndex + 1)}</span>
				<wbr />
				<span className="company-nowrap">{title.slice(separatorIndex + 1)}</span>
			</>
		);
	}

	const compound = title.match(/\S+(?:-\S+)+/u);
	if (!compound || compound.index === undefined) return title;

	return (
		<>
			{title.slice(0, compound.index)}
			<span className="company-nowrap">{compound[0]}</span>
			{title.slice(compound.index + compound[0].length)}
		</>
	);
}

export function CompanyPage({ locale }: { locale: Locale }): React.ReactNode {
	const content = getCompanyContent(locale);
	const diagnosticPath = getCorePath("diagnostic", locale);
	const openSourcePath = getSiteRoute("openSource").canonicals.en;
	if (!openSourcePath) throw new Error("Missing Open Source canonical");

	return (
		<SiteShell locale={locale} activeKey="company" mainClassName="company-page">
			<section className="company-hero" aria-labelledby="company-hero-title">
				<div className="company-hero__inner">
					<div className="company-hero__meta">
						<p className="company-kicker">{content.vision.eyebrow}</p>
						<p>{content.category}</p>
					</div>
					<h1 id="company-hero-title">{content.vision.headline}</h1>
					<div className="company-hero__foot">
						<p>{content.vision.summary}</p>
						<p className="company-hero__index" aria-hidden="true">
							Y / 01
						</p>
					</div>
				</div>
			</section>

			<CompanyReaderField locale={locale} content={content.marketShift} />

			<section className="company-stage" aria-labelledby="company-stage-title" data-company-stage="service-led">
				<div className="company-stage__inner">
					<p className="company-kicker">{content.stage.eyebrow}</p>
					<div className="company-stage__statement">
						<h2 id="company-stage-title" aria-label={content.stage.title}>
							{renderStageTitle(content.stage.title, locale)}
						</h2>
						<p>{content.stage.summary}</p>
					</div>
					<div className="company-stage__scope">
						<p>{content.stage.currentScopeLabel}</p>
						<p>{content.currentScope}</p>
					</div>
				</div>
			</section>

			<section className="company-forest" aria-labelledby="company-forest-title">
				<div className="company-forest__inner">
					<div className="company-forest__identity">
						<p className="company-kicker">{content.forest.eyebrow}</p>
						<p>{content.forest.name}</p>
					</div>
					<div className="company-forest__statement">
						<h2 id="company-forest-title">{content.forest.title}</h2>
						<div className="company-forest__copy">
							<p>{content.forest.summary}</p>
							<p>{content.forest.boundary}</p>
						</div>
					</div>
				</div>
			</section>

			<section className="company-principles" aria-labelledby="company-principles-title">
				<div className="company-principles__inner">
					<div className="company-principles__heading">
						<p className="company-kicker">{content.principles.eyebrow}</p>
						<h2 id="company-principles-title">{content.principles.title}</h2>
					</div>
					<ol className="company-principles__list">
						{content.principles.items.map((principle, index) => (
							<li key={principle.id}>
								<p className="company-principles__index">{String(index + 1).padStart(2, "0")}</p>
								<h3 className="company-principles__title">{principle.title}</h3>
								<p className="company-principles__description">{principle.description}</p>
							</li>
						))}
					</ol>
				</div>
			</section>

			<section className="company-close" aria-label={content.contact.title}>
				<div className="company-close__inner">
					<section className="company-open-source" aria-labelledby="company-open-source-title">
						<p className="company-kicker">{content.openSource.eyebrow}</p>
						<div>
							<h2 id="company-open-source-title">{content.openSource.title}</h2>
							<p>{content.openSource.summary}</p>
							<p className="company-open-source__boundary">{content.openSource.boundary}</p>
							<a href={openSourcePath} className="company-ink-focus">
								{content.openSource.linkLabel}
								<span aria-hidden="true">↗</span>
							</a>
						</div>
					</section>

					<section className="company-contact" aria-labelledby="company-contact-title">
						<p className="company-kicker">{content.contact.eyebrow}</p>
						<div className="company-contact__copy">
							<h2 id="company-contact-title">{content.contact.title}</h2>
							<p>{content.contact.summary}</p>
						</div>
						<div className="company-contact__actions">
							<a href={diagnosticPath} className="company-contact__diagnostic company-ink-focus">
								{content.contact.diagnosticLabel}
								<span aria-hidden="true">→</span>
							</a>
							<p>
								<span>{content.contact.emailLabel}</span>
								<a href={`mailto:${content.contact.email}`} className="company-ink-focus">
									{content.contact.email}
								</a>
							</p>
						</div>
					</section>
				</div>
			</section>
		</SiteShell>
	);
}
