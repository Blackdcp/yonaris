const contexts = {
	"legacy-research": {
		title: "Legacy research archive",
		provenance:
			"These guides come from earlier Yonaris research into AI search and answer-engine discovery. They remain available as dated reference material.",
		boundary:
			"Archive boundary applied 2026-08-23. This material does not define the current Yonaris product, company, or comparison position.",
	},
	"upstream-comparison": {
		title: "Upstream Elmo comparison archive",
		provenance:
			"This directory was imported from the upstream Elmo comparison project and is retained as a historical market dataset.",
		boundary:
			"Archive boundary applied 2026-08-23. It is not the current Yonaris product, company, or comparison position.",
	},
} as const;

export function LegacyArchiveContext({ kind }: { kind: keyof typeof contexts }): React.ReactNode {
	const context = contexts[kind];
	return (
		<aside className="site-archive-context" aria-label={context.title}>
			<div className="site-archive-context__label">
				<span aria-hidden="true">Archive / 2026</span>
				<strong>{context.title}</strong>
			</div>
			<div className="site-archive-context__body">
				<p>{context.provenance}</p>
				<p>{context.boundary}</p>
				<nav aria-label="Archive boundary and current Yonaris scope" className="site-archive-context__links">
					<a href="/product">Current product</a>
					<a href="/geo">Current GEO work</a>
					{kind === "upstream-comparison" ? (
						<>
							<a href="/open-source">Open source</a>
							<a href="https://github.com/elmohq/elmo" rel="noreferrer">
								elmohq/elmo
							</a>
						</>
					) : null}
				</nav>
			</div>
		</aside>
	);
}
