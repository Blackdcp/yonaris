import type { getGlobalContent, getHomeComposition } from "@/content/site/global";
import type { Locale } from "@/content/site/types";
import { getCorePath } from "@/lib/site-manifest";

function HomeTextLink({
	href,
	label,
	context,
	tone = "paper",
}: {
	href: string;
	label: string;
	context: "product" | "geo" | "approach" | "research" | "diagnostic";
	tone?: "paper" | "ink";
}): React.ReactNode {
	return (
		<a
			href={href}
			data-home-context-link={context}
			className={`home-link home-link--${tone} ${tone === "paper" ? "marketing-paper-focus" : ""}`}
		>
			<span>{label}</span>
			<span aria-hidden="true">↗</span>
		</a>
	);
}

export function HomeNarrative({
	locale,
	global,
	composition,
}: {
	locale: Locale;
	global: ReturnType<typeof getGlobalContent>;
	composition: ReturnType<typeof getHomeComposition>;
}): React.ReactNode {
	const paths = {
		product: getCorePath("product", locale),
		geo: getCorePath("geo", locale),
		approach: getCorePath("approach", locale),
		research: getCorePath("research", locale),
		diagnostic: getCorePath("diagnostic", locale),
	};
	const { home } = global;

	return (
		<div className="home-narrative">
			<section
				className="home-stage home-stage--product"
				data-home-stage="product"
				aria-labelledby="home-product-title"
			>
				<div className="home-stage__inner home-product-proof">
					<div className="home-product-proof__intro">
						<p className="home-stage-label">{home.stageLabels.product}</p>
						<h2 id="home-product-title" className="home-stage-heading">
							{composition.product.title}
						</h2>
						<div className="home-product-proof__links">
							<HomeTextLink href={paths.product} label={home.links.product} context="product" tone="ink" />
							<div className="home-product-proof__geo">
								<span className="home-product-proof__geo-label">{home.product.geoContextLabel}</span>
								<HomeTextLink href={paths.geo} label={home.links.geo} context="geo" tone="ink" />
							</div>
						</div>
					</div>

					<article className="home-product-proof__record">
						<div>
							<p className="home-product-proof__record-label">{home.product.claimLabel}</p>
							<strong>{composition.product.evidenceLabel}</strong>
						</div>
						<p className="home-product-proof__summary">{composition.product.summary}</p>
						<div className="home-product-proof__boundary">
							<span className="home-product-proof__boundary-label">{home.product.limitationLabel}</span>
							<p>{composition.product.limitation}</p>
						</div>
					</article>
				</div>
			</section>

			<section
				className="home-stage home-stage--approach"
				data-home-stage="approach"
				aria-labelledby="home-approach-title"
			>
				<div className="home-stage__inner home-approach-preview">
					<div className="home-approach-preview__intro">
						<p className="home-stage-label">{home.stageLabels.approach}</p>
						<h2 id="home-approach-title" className="home-stage-heading">
							{composition.approach.title}
						</h2>
						<p>{composition.approach.summary}</p>
						<HomeTextLink href={paths.approach} label={home.links.approach} context="approach" />
					</div>
					<div className="home-approach-preview__sequence">
						<p>{home.approach.sequenceLabel}</p>
						<ol>
							{composition.approach.steps.map((step, index) => (
								<li key={step}>
									<span className="home-approach-preview__index" aria-hidden="true">
										0{index + 1}
									</span>
									<strong>{step}</strong>
								</li>
							))}
						</ol>
					</div>
				</div>
			</section>

			<section
				className="home-stage home-stage--research"
				data-home-stage="research"
				aria-labelledby="home-research-title"
			>
				<div className="home-stage__inner home-research-preview">
					<div className="home-research-preview__intro">
						<p className="home-stage-label">{home.stageLabels.research}</p>
						<h2 id="home-research-title" className="home-stage-heading">
							{composition.research.title}
						</h2>
						<HomeTextLink href={paths.research} label={home.links.research} context="research" />
					</div>
					<dl className="home-research-preview__ledger">
						<div>
							<dt>{home.research.scopeLabel}</dt>
							<dd>{composition.research.scope}</dd>
						</div>
						<div>
							<dt>{home.research.denominatorLabel}</dt>
							<dd>{composition.research.denominator}</dd>
						</div>
						<div>
							<dt>{home.research.limitationLabel}</dt>
							<dd>{composition.research.limitation}</dd>
						</div>
					</dl>
				</div>
			</section>

			<section
				className="home-stage home-stage--diagnostic"
				data-home-stage="diagnostic"
				aria-labelledby="home-diagnostic-title"
			>
				<div className="home-stage__inner home-diagnostic-close">
					<div>
						<p className="home-stage-label">{composition.diagnostic.eyebrow}</p>
						<h2 id="home-diagnostic-title" className="home-stage-heading">
							{composition.diagnostic.title}
						</h2>
					</div>
					<div className="home-diagnostic-close__action">
						<p>{composition.diagnostic.body}</p>
						<HomeTextLink
							href={paths.diagnostic}
							label={composition.diagnostic.actionLabel}
							context="diagnostic"
							tone="ink"
						/>
						<small className="home-diagnostic-close__disclosure">{composition.diagnostic.disclosure}</small>
					</div>
				</div>
			</section>
		</div>
	);
}
