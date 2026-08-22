import type { getGlobalContent } from "@/content/site/global";
import type { Locale } from "@/content/site/types";

type HomeDiagnosticPreviewContent = ReturnType<typeof getGlobalContent>["preview"];

export function HomeDiagnosticPreview({
	locale,
	content,
}: {
	locale: Locale;
	content: HomeDiagnosticPreviewContent;
}): React.ReactNode {
	const limitationId = `home-preview-limitation-${locale}`;

	return (
		<figure
			className="home-diagnostic-preview"
			aria-label={content.ariaLabel}
			aria-describedby={limitationId}
			data-preview-status="illustrative"
		>
			<figcaption>{content.label}</figcaption>
			<div className="home-diagnostic-preview__chrome">
				<span className="home-diagnostic-preview__dot home-diagnostic-preview__dot--signal" />
				<span className="home-diagnostic-preview__dot" />
				<span className="home-diagnostic-preview__dot" />
				<span className="home-diagnostic-preview__breadcrumb">{content.breadcrumb}</span>
			</div>

			<div className="home-diagnostic-preview__workbench">
				<aside className="home-diagnostic-preview__nav" aria-label={content.navigationLabel}>
					<p>{content.navigationTitle}</p>
					<ul>
						{content.navigation.map((item, index) => (
							<li key={item} className={index === 0 ? "is-active" : undefined}>
								<i aria-hidden="true" />
								{item}
							</li>
						))}
					</ul>
				</aside>

				<section className="home-diagnostic-preview__canvas" aria-labelledby={`home-preview-question-${locale}`}>
					<p className="home-diagnostic-preview__kicker">{content.context}</p>
					<h2 id={`home-preview-question-${locale}`}>{content.question}</h2>
					<div className="home-diagnostic-preview__answers">
						{content.answers.map((answer) => (
							<article key={answer.label}>
								<header>
									<span className="home-diagnostic-preview__engine">{answer.engine}</span>
									<strong>{answer.label}</strong>
									<small>{answer.status}</small>
								</header>
								<p>
									{answer.before}
									<mark>{answer.emphasis}</mark>
									{answer.after}
								</p>
								<footer>
									{answer.sources.map((source) => (
										<span key={source}>{source}</span>
									))}
								</footer>
							</article>
						))}
					</div>
				</section>

				<aside className="home-diagnostic-preview__readout" aria-label={content.readoutTitle}>
					<h2>{content.readoutTitle}</h2>
					{content.readout.map(([label, value], index) => (
						<div key={label} className={index === 1 ? "is-finding" : undefined}>
							<p>{label}</p>
							<strong>{value}</strong>
						</div>
					))}
				</aside>
			</div>
			<p id={limitationId} className="home-diagnostic-preview__limitation">
				{content.limitation}
			</p>
		</figure>
	);
}
