import { getOpenSourceContent } from "@/content/site";
import { UtilityShell } from "../utility-shell";

export function OpenSourcePage(): React.ReactNode {
	const content = getOpenSourceContent();

	return (
		<UtilityShell section="open-source">
			<article className="open-source-page">
				<header className="open-source-hero">
					<div className="open-source-hero__inner">
						<div className="open-source-hero__copy">
							<p className="resources-kicker">{content.eyebrow}</p>
							<h1>{content.headline}</h1>
							<p className="open-source-hero__introduction">{content.introduction}</p>
						</div>
						<aside className="open-source-hero__scope" aria-label="Current relationship boundary">
							<p className="open-source-hero__index" aria-hidden="true">
								OS / 01
							</p>
							<p>{content.currentScope}</p>
						</aside>
					</div>
				</header>

				<section className="open-source-relationship" aria-labelledby="open-source-relationship-title">
					<div className="open-source-section-heading">
						<p className="resources-kicker">Relationship</p>
						<div>
							<h2 id="open-source-relationship-title">{content.relationship.title}</h2>
							<p>{content.relationship.introduction}</p>
						</div>
					</div>
					<ol className="open-source-relationship__list">
						{content.relationship.items.map((item, index) => (
							<li key={item.id} data-relationship-id={item.id}>
								<p className="open-source-relationship__index">{String(index + 1).padStart(2, "0")}</p>
								<h3>{item.label}</h3>
								<p>{item.description}</p>
							</li>
						))}
					</ol>
				</section>

				<section className="open-source-compatibility" aria-labelledby="open-source-compatibility-title">
					<div className="open-source-compatibility__inner">
						<div className="open-source-compatibility__heading">
							<p className="resources-kicker">Compatibility identifiers</p>
							<h2 id="open-source-compatibility-title">{content.compatibility.title}</h2>
							<p>{content.compatibility.introduction}</p>
						</div>
						<dl className="open-source-identifiers">
							{content.compatibility.identifiers.map((identifier, index) => (
								<div key={identifier.id}>
									<dt>
										<span>{String(index + 1).padStart(2, "0")}</span>
										{identifier.label}
									</dt>
									<dd>
										{identifier.values.map((value) => (
											<code key={value}>{value}</code>
										))}
									</dd>
								</div>
							))}
						</dl>
					</div>
				</section>

				<section className="open-source-sources" aria-labelledby="open-source-sources-title">
					<div className="open-source-sources__heading">
						<p className="resources-kicker">Primary sources</p>
						<h2 id="open-source-sources-title">Read the source.</h2>
					</div>
					<ul>
						{content.sources.map((source, index) => (
							<li key={source.id}>
								<a
									href={source.href}
									aria-label={source.label}
									target={source.external ? "_blank" : undefined}
									rel={source.external ? "noreferrer" : undefined}
								>
									<span>{String(index + 1).padStart(2, "0")}</span>
									<strong>{source.label}</strong>
									<small>{source.external ? "github.com" : "yonaris.com"}</small>
									<span aria-hidden="true">↗</span>
								</a>
							</li>
						))}
					</ul>
				</section>
			</article>
		</UtilityShell>
	);
}
