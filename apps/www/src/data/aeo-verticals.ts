export interface AeoVertical {
	slug: string;
	/** Display noun used after "AEO for", e.g. "agencies". */
	audience: string;
	short: string;
	intro: string[];
	/** Illustrative prompts buyers in this vertical ask AI engines. */
	examplePrompts: string[];
	plays: { name: string; text: string }[];
	yonarisFit: string;
	faqs: { question: string; answer: string }[];
}

export const aeoVerticals: AeoVertical[] = [
	{
		slug: "agencies",
		audience: "agencies",
		short:
			"Establish a repeatable GEO baseline for every client, with prompt sets and AI models configured for each engagement.",
		intro: [
			"Agencies tend to feel the shift to AI search first, because clients start asking why a competitor shows up in ChatGPT and they do not. AEO turns into a service line: measure each client's presence across the answer engines, find the gaps, and show the work.",
			"The hard part is producing comparable results across many clients. A consistent baseline, configurable model coverage, and clear separation between client datasets make the work easier to operate and explain.",
		],
		examplePrompts: ["best [client category] companies", "[client] vs [competitor]", "is [client] worth it"],
		plays: [
			{
				name: "Run a prompt set per client",
				text: "Build a focused list of the questions each client's buyers actually ask, and track it on a schedule so changes stand out.",
			},
			{
				name: "Benchmark against named competitors",
				text: "Share of voice against specific rivals is the metric clients understand. Show who gets cited instead of them, and on which prompts.",
			},
			{
				name: "Turn gaps into a retainer",
				text: "Every prompt where a client is missing is a concrete content brief. That is the bridge from reporting to billable work.",
			},
			{
				name: "Keep client baselines separate",
				text: "Use distinct prompt sets, model selections, and reporting periods for each client so results remain comparable and auditable.",
			},
		],
		yonarisFit:
			"Yonaris organizes prompt sets, configured AI models, and baseline results by client while leaving deployment and data control with the operator.",
		faqs: [
			{
				question: "Can agencies manage separate GEO baselines for clients?",
				answer:
					"Yonaris supports a structured baseline workflow in which prompt sets and model coverage can be configured for each engagement. The deployment operator controls how client data is stored and presented.",
			},
			{
				question: "How do agencies price AEO services?",
				answer:
					"Many agencies combine recurring monitoring with content or technical optimization work. A stable prompt set and reporting cadence make the baseline, changes, and resulting work clear to the client.",
			},
		],
	},
	{
		slug: "saas",
		audience: "SaaS companies",
		short: "Win the 'best [category] software' and 'X vs Y' answers where buyers now build their shortlists.",
		intro: [
			"SaaS buyers increasingly ask an AI engine to shortlist tools before they ever reach a vendor site. Best project management software, Notion vs Asana, alternatives to a given tool. If the model does not name you, you are out of the consideration set before the demo.",
			"These comparison and alternatives prompts are high intent and winnable. The same content that ranks a comparison page can earn the citation in an AI answer, as long as it is clear, current, and backed by sources the model trusts.",
		],
		examplePrompts: [
			"best [category] software",
			"[your tool] vs [competitor]",
			"alternatives to [competitor]",
			"is [your tool] good for [use case]",
		],
		plays: [
			{
				name: "Track comparison and alternatives prompts",
				text: "These are where buyers shortlist. Monitor them across engines and watch which competitors get named alongside or instead of you.",
			},
			{
				name: "Publish honest comparison pages",
				text: "Well-structured, fair comparison and alternatives content gives engines a clean source to cite when buyers ask how you stack up.",
			},
			{
				name: "Earn third-party reviews",
				text: "Reviews and mentions on sites the models trust shape how confidently they recommend you.",
			},
			{
				name: "Catch wrong feature and pricing claims",
				text: "Models go stale. Monitor for outdated descriptions of your features or pricing and correct the underlying sources.",
			},
		],
		yonarisFit:
			"Yonaris establishes a repeatable baseline across the AI models configured for the project, showing brand and competitor mentions and surfacing changes in product descriptions over time.",
		faqs: [
			{
				question: "How do I show up when buyers ask AI for software recommendations?",
				answer:
					"Publish clear, current content for the comparison and alternatives queries in your category, earn reviews on trusted sources, and track those prompts so you can see where you appear and where a competitor does instead.",
			},
			{
				question: "Can I see which competitors AI tools recommend?",
				answer:
					"Yes. Yonaris records competitor mentions and citations for the configured prompt set, so you can compare share of voice against named rivals within the baseline.",
			},
		],
	},
	{
		slug: "ecommerce",
		audience: "e-commerce brands",
		short: "Make sure AI shopping answers and buying-guide queries surface your products, not just your competitors'.",
		intro: [
			"Shoppers ask AI engines to compare products and recommend the best option, and some engines now have dedicated shopping features. Best running shoes for flat feet, cheapest option under a hundred dollars. The answer usually names a few brands and skips the rest.",
			"Product and category content, clean structured data, and reviews on trusted sources are what get your catalog into those answers. The work overlaps with SEO, but the target is the recommendation rather than the ranking.",
		],
		examplePrompts: ["best [product] for [need]", "[product] under [price]", "[your brand] vs [competitor] [product]"],
		plays: [
			{
				name: "Track buying-guide prompts",
				text: "Monitor the comparison and recommendation queries for your top categories, and see which competitors the engines name.",
			},
			{
				name: "Add product and review schema",
				text: "Structured data for products and reviews helps engines extract and trust your catalog details.",
			},
			{
				name: "Earn reviews engines cite",
				text: "Recommendations lean on third-party reviews. Presence on the sites engines pull from improves your odds of being named.",
			},
			{
				name: "Keep price and availability accurate",
				text: "Stale prices and stock invite wrong answers. Keep product data current so engines describe you correctly.",
			},
		],
		yonarisFit:
			"Yonaris measures how configured AI models describe and recommend your products against competitors, giving each category a repeatable GEO baseline.",
		faqs: [
			{
				question: "Do AI engines recommend products?",
				answer:
					"Yes. Engines answer buying-guide and comparison questions with a shortlist of products, and some now have dedicated shopping features. Brands not named in those answers lose the recommendation.",
			},
			{
				question: "How do I get my products into AI shopping answers?",
				answer:
					"Publish clear product and category content, add product and review structured data, earn reviews on trusted sites, and keep price and availability accurate. Then track the prompts to measure progress.",
			},
		],
	},
	{
		slug: "b2b",
		audience: "B2B companies",
		short: "Show up when buyers research categories, vendors, and you, across long and considered purchases.",
		intro: [
			"B2B purchases involve a lot of research, and much of it now starts with an AI engine. Buyers ask what a category is, who the serious vendors are, and whether you are credible, long before they fill out a form.",
			"Because the cycle is long and the deals are large, a single AI answer that omits or misframes you carries outsized cost. The fix is durable authority: clear content, trusted mentions, and accurate descriptions across the engines your buyers use.",
		],
		examplePrompts: [
			"what is [category] software",
			"top [category] vendors for enterprise",
			"is [your brand] enterprise-ready",
		],
		plays: [
			{
				name: "Track category, competitor, and branded prompts",
				text: "Cover the full research journey, from what a category is to whether you specifically are credible.",
			},
			{
				name: "Build authority content",
				text: "Thorough, well-structured content on your topic gives engines a confident source to cite for considered purchases.",
			},
			{
				name: "Earn analyst and press mentions",
				text: "Corroboration on respected sources weighs heavily in how engines describe enterprise vendors.",
			},
			{
				name: "Correct inaccuracies quickly",
				text: "An out-of-date claim about your product can sit in answers for months. Monitor and fix the sources behind it.",
			},
		],
		yonarisFit:
			"Yonaris measures your presence across category, competitor, and branded prompts on the configured AI models, so you can see where you enter the buyer's research and where you are absent.",
		faqs: [
			{
				question: "Why does AEO matter for B2B?",
				answer:
					"B2B buyers research with AI engines before they talk to sales. If the model does not name you, or describes you inaccurately, you can lose a deal before it starts. AEO is how you measure and fix that.",
			},
			{
				question: "How is AI answer presence different from SEO for B2B?",
				answer:
					"SEO targets a ranking on a results page. AI answer presence targets being named and cited inside a written answer. The fundamentals overlap, but the unit of success is the citation, not the position.",
			},
		],
	},
	{
		slug: "startups",
		audience: "startups",
		short: "Build AI answer presence from zero with a focused prompt set and a repeatable GEO baseline.",
		intro: [
			"A new brand starts out invisible to AI engines, because there is little for the models to have learned. The job is to build a credible footprint quickly: clear content, early reviews, and mentions on sources the models trust.",
			"Early teams can keep the measurement scope focused: choose the buyer questions that matter, configure the relevant AI models, and repeat the same baseline as the brand earns new coverage.",
		],
		examplePrompts: ["best [new category] tools", "alternatives to [incumbent]", "what is [your brand]"],
		plays: [
			{
				name: "Define a tight prompt set",
				text: "A handful of high-intent prompts beats a broad, expensive list. Track the questions your earliest buyers ask.",
			},
			{
				name: "Tell a clear category story",
				text: "Help engines place you by explaining your category and product plainly, with consistent naming.",
			},
			{
				name: "Earn your first reviews",
				text: "Early mentions on trusted sources give the models something to ground an answer about you in.",
			},
			{
				name: "Track weekly",
				text: "Visibility moves as you publish and get covered. A weekly read shows whether it is working.",
			},
		],
		yonarisFit:
			"Yonaris gives an early-stage team a repeatable GEO baseline using a focused prompt set and configurable AI models, with data controlled by the deployment operator.",
		faqs: [
			{
				question: "How can a startup establish an AI answer presence baseline?",
				answer:
					"Start with a small set of high-intent prompts, choose the AI models relevant to your buyers, and repeat the same test on a consistent cadence. Yonaris keeps that baseline structured as the scope grows.",
			},
			{
				question: "When should a startup start doing AEO?",
				answer:
					"As soon as buyers in your category ask AI engines for recommendations, which is early for most categories now. Starting sooner builds the trusted footprint that later answers draw on.",
			},
		],
	},
	{
		slug: "enterprise",
		audience: "enterprises",
		short: "Track AI answer presence at scale with configurable model coverage and deployment-controlled data.",
		intro: [
			"Large brands have the most to lose when an AI engine describes them wrongly, and the most scrutiny over where their data goes. Many AI answer presence tools are closed and hosted, which means handing your prompt strategy and history to a third party.",
			"A deployment-controlled workflow keeps decisions about prompt history, access, and retention with the operator. A documented baseline also makes the methodology behind board-level reporting easier to review.",
		],
		examplePrompts: ["is [brand] trustworthy", "[brand] vs [competitor]", "best [category] for enterprise"],
		plays: [
			{
				name: "Define deployment data controls",
				text: "Let the deployment operator define how prompts, results, access, and retention are handled for the organization.",
			},
			{
				name: "Standardize a prompt set",
				text: "Use a consistent set of prompts across product lines and regions so results are comparable across the org.",
			},
			{
				name: "Benchmark named competitors",
				text: "Track share of voice against the specific rivals leadership cares about, on the prompts that matter.",
			},
			{
				name: "Document the methodology",
				text: "Record the prompt set, selected models, cadence, and scoring rules so each reported metric can be reviewed.",
			},
		],
		yonarisFit:
			"Yonaris standardizes prompt sets and configurable model coverage while the deployment operator controls data handling and access.",
		faqs: [
			{
				question: "Can we control AI answer presence data handling?",
				answer:
					"Yonaris is designed so the deployment operator controls how prompts, results, access, and retention are handled. Teams can also document the prompt set and model configuration behind each baseline.",
			},
			{
				question: "How does Yonaris handle data control?",
				answer:
					"Data handling is controlled by the party operating the deployment. That operator defines storage, access, and retention according to the organization's requirements.",
			},
		],
	},
	{
		slug: "healthcare",
		audience: "healthcare brands",
		short: "Monitor and correct how AI engines describe your healthcare brand, where accuracy is not optional.",
		intro: [
			"Health topics are exactly where AI engines are most cautious, and where errors do the most damage. An inaccurate description of a provider, product, or service is a real risk, not a cosmetic one.",
			"Accuracy and data control both matter here. Authoritative, well-sourced content shapes what the models say, while the deployment operator controls how prompt and result data is handled.",
		],
		examplePrompts: ["is [treatment] safe", "best [specialty] near me", "what does [brand] treat"],
		plays: [
			{
				name: "Publish authoritative content",
				text: "Well-sourced, expert-backed content is what cautious engines cite on health topics. Make yours the clear reference.",
			},
			{
				name: "Monitor for unsafe or wrong claims",
				text: "Track how engines describe your brand and treatments so an inaccurate or unsafe statement does not go unnoticed.",
			},
			{
				name: "Earn trusted health citations",
				text: "References from respected health sources carry extra weight in how engines ground their answers.",
			},
			{
				name: "Control sensitive data",
				text: "Define prompt storage, result access, and retention through the party operating the deployment.",
			},
		],
		yonarisFit:
			"Yonaris gives healthcare teams a repeatable baseline for how configured AI models describe their brand, while the deployment operator controls data handling.",
		faqs: [
			{
				question: "Why does AEO matter in healthcare?",
				answer:
					"Patients ask AI engines about conditions, treatments, and providers. An inaccurate answer about your brand carries real risk, so monitoring and correcting how engines describe you matters more here than almost anywhere.",
			},
			{
				question: "How do I catch AI errors about my health brand?",
				answer:
					"Track a consistent set of prompts about your brand and services across the configured AI models, and watch for inaccurate or stale claims. Yonaris records each baseline so changes surface quickly.",
			},
		],
	},
	{
		slug: "financial-services",
		audience: "financial services",
		short: "Track how AI engines describe your financial brand, with the accuracy and data control the sector demands.",
		intro: [
			"Finance is another area where engines tread carefully, and where a wrong answer about rates, products, or eligibility carries compliance weight. Buyers ask AI engines for recommendations and comparisons all the same.",
			"Authoritative content earns the citation, while deployment-controlled handling of prompt data and visibility history helps the workflow fit a regulated environment.",
		],
		examplePrompts: ["best [product] for [need]", "is [brand] legit", "[brand] vs [competitor] fees"],
		plays: [
			{
				name: "Publish clear, accurate product content",
				text: "Precise content on your products and terms gives engines a reliable, compliant source to quote.",
			},
			{
				name: "Monitor for inaccurate claims",
				text: "Track how engines state your rates, fees, and eligibility so a wrong claim does not sit in answers unnoticed.",
			},
			{
				name: "Earn trusted citations",
				text: "References from respected financial sources weigh heavily in what engines repeat about you.",
			},
			{
				name: "Define data controls",
				text: "Let the deployment operator set storage, access, and retention rules to fit data and compliance requirements.",
			},
		],
		yonarisFit:
			"Yonaris establishes a repeatable baseline across configured AI models and records description changes, while the deployment operator controls data handling.",
		faqs: [
			{
				question: "Why does AEO matter for financial services?",
				answer:
					"Consumers ask AI engines to compare financial products and judge whether a brand is trustworthy. An inaccurate or absent answer affects both acquisition and compliance, so tracking it is essential.",
			},
			{
				question: "Can I keep AI answer presence data on our own infrastructure?",
				answer:
					"Yes. With Yonaris, the party operating the deployment controls how prompts and visibility history are stored, accessed, and retained for the regulated environment.",
			},
		],
	},
];

export function getAeoVertical(slug: string): AeoVertical | undefined {
	return aeoVerticals.find((v) => v.slug === slug);
}
