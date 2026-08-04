interface Feature {
	num: string;
	eyebrow: string;
	title: string;
	description: string;
}

const features: Feature[] = [
	{
		num: "01",
		eyebrow: "DASHBOARD",
		title: "Your AI visibility command center.",
		description:
			"See everything at a glance — current visibility, share of voice, 30-day trends, and the key metrics behind every score.",
	},
	{
		num: "02",
		eyebrow: "VISIBILITY",
		title: "Track visibility across every prompt and model.",
		description:
			"Filter by AI model, time range, and tags. See per-prompt visibility scores with trend lines comparing your brand against competitors.",
	},
	{
		num: "03",
		eyebrow: "SHARE OF VOICE",
		title: "See how you stack up against the competition.",
		description:
			"Compare your brand's mention share against every competitor. A live leaderboard ranks who AI engines name most — so you can see who dominates and where the gaps are.",
	},
	{
		num: "04",
		eyebrow: "QUERY FAN-OUT",
		title: "See the searches behind every AI answer.",
		description:
			"AI engines fan a single prompt out into dozens of web searches. Track the exact queries and keywords they generate — and how they rewrite your prompts along the way.",
	},
	{
		num: "05",
		eyebrow: "CITATIONS",
		title: "Understand where AI gets its information.",
		description:
			"See which domains and URLs AI models cite most, track new and dropped sources over time, and break down citations by category — brand, competitor, social, and more.",
	},
	{
		num: "06",
		eyebrow: "OPPORTUNITIES",
		title: "Know exactly what to do next.",
		description:
			"Turn your data into action with AI-generated recommendations — content to create, pages to refresh, and third-party sources to pitch — each ranked by impact.",
	},
	{
		num: "07",
		eyebrow: "PROMPTS",
		title: "Search, tag, and organize your prompts.",
		description:
			"Find any prompt instantly with full-text search and highlight matching. Tag prompts for easy filtering and track visibility scores per prompt.",
	},
	{
		num: "08",
		eyebrow: "DEEP DIVE",
		title: "Inspect every individual AI response.",
		description:
			"Drill into any prompt to see exactly what each AI model said, which brands were mentioned, what sources were cited, and how the response was constructed.",
	},
	{
		num: "09",
		eyebrow: "TRENDS",
		title: "Track visibility trends over months.",
		description:
			"Watch how your brand's AI visibility changes over time compared to competitors. Spot the impact of content changes and market shifts.",
	},
];

export function Features() {
	return (
		<section id="features" className="border-b border-zinc-200 bg-white">
			<div className="mx-auto max-w-6xl px-4 py-16 md:px-6 lg:py-24">
				<div>
					<p className="font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-500">/ FEATURES</p>
					<h2 className="mt-4 text-4xl font-semibold leading-[1.05] tracking-tight text-balance text-zinc-950 md:text-5xl">
						All you need to grow AI visibility.
					</h2>
				</div>

				<div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
					{features.map((f) => (
						<article key={f.num} className="rounded-lg border border-zinc-200 bg-zinc-50 p-6">
							<p className="font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-500">
								<span className="text-blue-600 tabular-nums">{f.num}</span>
								<span className="mx-2 text-zinc-300">/</span>
								{f.eyebrow}
							</p>
							<h3 className="mt-5 text-xl font-semibold leading-tight tracking-tight text-balance text-zinc-950">
								{f.title}
							</h3>
							<p className="mt-3 text-pretty text-sm leading-6 text-zinc-600">{f.description}</p>
						</article>
					))}
				</div>
			</div>
		</section>
	);
}
