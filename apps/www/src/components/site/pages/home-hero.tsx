import type { getGlobalContent } from "@/content/site/global";
import type { Locale } from "@/content/site/types";
import { getCorePath } from "@/lib/site-manifest";
import { HomeDiagnosticPreview } from "./home-diagnostic-preview";

export function HomeHero({
	locale,
	content,
}: {
	locale: Locale;
	content: ReturnType<typeof getGlobalContent>;
}): React.ReactNode {
	const companyPath = getCorePath("company", locale);
	const diagnosticPath = getCorePath("diagnostic", locale);

	return (
		<section className="home-product-stage" aria-labelledby="home-hero-title">
			<div className="home-product-stage__inner">
				<div className="home-hero-copy home-product-stage__copy">
					<p className="home-identity">
						<span>{content.category}</span>
						<span aria-hidden="true">/</span>
						<a href={companyPath} data-home-context-link="company">
							{content.vision}
						</a>
					</p>
					<h1 id="home-hero-title" className="home-product-stage__title">
						{content.hero.headline}
					</h1>
					<p className="home-product-stage__lead">{content.hero.explanation}</p>
					<form action={diagnosticPath} method="get" className="home-domain-form">
						<label htmlFor={`home-website-${locale}`} className="sr-only">
							{content.hero.websiteLabel}
						</label>
						<input
							id={`home-website-${locale}`}
							name="website"
							type="url"
							required
							autoComplete="url"
							placeholder={content.hero.websitePlaceholder}
						/>
						<button type="submit">
							{content.hero.submitLabel}
							<span aria-hidden="true">↗</span>
						</button>
					</form>
				</div>

				<HomeDiagnosticPreview locale={locale} content={content.preview} />
			</div>
		</section>
	);
}
