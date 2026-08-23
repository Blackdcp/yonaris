import { getDiagnosticContent, type Locale } from "@/content/site";
import { SiteShell } from "../site-shell";
import { DiagnosticForm } from "./diagnostic-form";

function DiagnosticHeadline({ locale, headline }: { locale: Locale; headline: string }) {
	if (locale === "zh") {
		return (
			<h1 aria-label={headline}>
				<span data-diagnostic-headline-line="先看见 AI 看见了什么">先看见 AI 看见了什么</span>
				<span data-diagnostic-headline-line="再决定改变什么">再决定改变什么</span>
			</h1>
		);
	}
	return <h1>{headline}</h1>;
}

export function DiagnosticPage({ locale, initialWebsite }: { locale: Locale; initialWebsite?: string }) {
	const content = getDiagnosticContent(locale);
	return (
		<SiteShell locale={locale} activeKey="diagnostic" mainClassName="diagnostic-page">
			<section className="diagnostic-environment" aria-labelledby="diagnostic-title">
				<div className="diagnostic-desk">
					<header className="diagnostic-intro">
						<p className="diagnostic-kicker">{content.eyebrow}</p>
						<div id="diagnostic-title">
							<DiagnosticHeadline locale={locale} headline={content.headline} />
						</div>
						<p className="diagnostic-intro__offer">{content.offer}</p>
						<p className="diagnostic-intro__confirmation">{content.confirmation}</p>
						<p className="diagnostic-intro__scope">{content.currentScope}</p>
					</header>

					<aside className="diagnostic-output" aria-labelledby="diagnostic-output-title">
						<p className="diagnostic-kicker">{content.likelyOutput.eyebrow}</p>
						<h2 id="diagnostic-output-title">{content.likelyOutput.title}</h2>
						<p>{content.likelyOutput.introduction}</p>
						<ol>
							{content.likelyOutput.items.map((item, index) => (
								<li key={item}>
									<span>{String(index + 1).padStart(2, "0")}</span>
									{item}
								</li>
							))}
						</ol>
					</aside>

					<DiagnosticForm locale={locale} initialWebsite={initialWebsite} />
				</div>
			</section>
		</SiteShell>
	);
}
