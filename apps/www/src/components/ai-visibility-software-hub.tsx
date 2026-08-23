const FEATURES = [
	{
		title: "Cross-platform tracking",
		body: "Recorded coverage across ChatGPT, Perplexity, Gemini, Copilot, and Google AI Overviews.",
	},
	{ title: "Mention and citation analysis", body: "Separated a named appearance from a linked citation." },
	{ title: "Prompt monitoring", body: "Repeated a defined prompt set instead of relying on a single snapshot." },
	{
		title: "Competitor benchmarking",
		body: "Compared share of voice against named competitors on the same questions.",
	},
	{ title: "Sentiment and accuracy", body: "Recorded how a supplier described brand framing and factual accuracy." },
	{ title: "Recommendations", body: "Mapped missing prompts and topics to possible follow-up work." },
] as const;

function ArchiveSection({
	index,
	label,
	title,
	children,
}: {
	index: string;
	label: string;
	title: string;
	children: React.ReactNode;
}) {
	return (
		<section className="legacy-archive-section" aria-labelledby={`archive-hub-${index}`}>
			<p className="legacy-archive-kicker">
				{index} / {label}
			</p>
			<h2 className="legacy-archive-section__heading" id={`archive-hub-${index}`}>
				{title}
			</h2>
			<div className="legacy-archive-copy">{children}</div>
		</section>
	);
}

export function AiVisibilitySoftwareHub() {
	return (
		<>
			<ArchiveSection index="01" label="Recorded definition" title="What the archive called AI visibility software">
				<p>
					The source material described software that sampled how brands appeared across answer engines, recording
					mentions, citations, framing, and competitor presence.
				</p>
				<p>
					Its unit of analysis was the generated answer rather than a search-results position. A repeated prompt set
					turned individual answers into a historical series.
				</p>
			</ArchiveSection>
			<ArchiveSection index="02" label="Historical context" title="Why the category emerged">
				<p>
					The archive tracked a shift from ranked link lists toward synthesized answers. In that frame, a cited source
					or named brand became the observable outcome.
				</p>
			</ArchiveSection>
			<section className="legacy-archive-section" aria-labelledby="archive-capabilities">
				<p className="legacy-archive-kicker">03 / Recorded capabilities</p>
				<h2 className="legacy-archive-section__heading" id="archive-capabilities">
					What the directory looked for
				</h2>
				<ul className="legacy-archive-ledger">
					{FEATURES.map((feature, index) => (
						<li className="legacy-archive-ledger__row" key={feature.title}>
							<span className="legacy-archive-index">{String(index + 1).padStart(2, "0")}</span>
							<div>
								<h3>{feature.title}</h3>
								<p>{feature.body}</p>
							</div>
							<span className="legacy-archive-ledger__arrow" aria-hidden="true">
								—
							</span>
						</li>
					))}
				</ul>
			</section>
			<ArchiveSection
				index="04"
				label="Recorded upstream positioning"
				title="The measurement model described at publication"
			>
				<p>
					The archived material described controlled prompt sets, configured providers, repeat runs, and recorded
					mentions, citations, and source coverage.
				</p>
				<p>
					This wording is retained as historical context only. Current Yonaris scope is defined on the Product and GEO
					pages linked in the archive boundary.
				</p>
			</ArchiveSection>
		</>
	);
}
