import type { HomeHeroContent, Locale } from "@/lib/marketing-content";
import { MarketDiagnosticPreview } from "./market-diagnostic-preview";

interface HomeHeroProps {
	locale: Locale;
	content: HomeHeroContent;
	previewLabel: string;
}

export function HomeHero({ locale, content, previewLabel }: HomeHeroProps) {
	const diagnosticPath = locale === "zh" ? "/zh/diagnostic" : "/diagnostic";

	return (
		<section className="marketing-product-stage" aria-labelledby="home-hero-title">
			<div className="marketing-product-stage__inner">
				<div className="marketing-hero-copy marketing-product-stage__copy">
					<h1 id="home-hero-title" className="marketing-product-stage__title">{content.headline}</h1>
					<p className="marketing-product-stage__lead">{content.explanation}</p>
					<form action={diagnosticPath} method="get" className="marketing-domain-form">
						<label htmlFor={`home-website-${locale}`} className="sr-only">{content.websiteLabel}</label>
						<input
							id={`home-website-${locale}`}
							name="website"
							type="url"
							required
							autoComplete="url"
							placeholder={content.websitePlaceholder}
						/>
						<button type="submit">{content.submitLabel}<span aria-hidden="true">↗</span></button>
					</form>
				</div>

				<MarketDiagnosticPreview locale={locale} label={previewLabel} />
			</div>
		</section>
	);
}
