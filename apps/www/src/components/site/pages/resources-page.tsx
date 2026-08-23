import { getResourcesContent } from "@/content/site";
import { SiteShell } from "../site-shell";

export function ResourcesPage(): React.ReactNode {
	const content = getResourcesContent("en");

	return (
		<SiteShell locale="en" mainClassName="resources-page">
			<section className="resources-hero" aria-labelledby="resources-title">
				<div className="resources-hero__inner">
					<div className="resources-hero__copy">
						<p className="resources-kicker">{content.eyebrow}</p>
						<h1 id="resources-title">{content.headline}</h1>
						<p className="resources-hero__introduction">{content.introduction}</p>
					</div>
					<aside className="resources-hero__scope" aria-label="Resource scope">
						<p className="resources-hero__index" aria-hidden="true">
							R / 06
						</p>
						<p>{content.currentScope}</p>
					</aside>
				</div>
			</section>

			<section className="resources-directory" aria-labelledby="resources-directory-title">
				<div className="resources-directory__heading">
					<p className="resources-kicker">Index / 2026</p>
					<h2 id="resources-directory-title">{content.indexLabel}</h2>
				</div>
				<ol className="resources-index">
					{content.items.map((item, index) => (
						<li key={item.id} data-resource-id={item.id}>
							<a className="resources-link" href={item.path} aria-label={item.label}>
								<span className="resources-link__index">{String(index + 1).padStart(2, "0")}</span>
								<span className="resources-link__title">{item.label}</span>
								<span className="resources-link__description">{item.description}</span>
								<span className="resources-link__arrow" aria-hidden="true">
									↗
								</span>
							</a>
						</li>
					))}
				</ol>
			</section>
		</SiteShell>
	);
}
