export interface FaqItem {
	question: string;
	answer: string;
}

// Homepage FAQ. Rendered visibly on "/" and emitted as FAQPage JSON-LD from the
// same route, so the structured data always matches what a reader (or an AI
// crawler) sees on the page.
export const HOME_FAQS: FaqItem[] = [
	{
		question: "What is Yonaris?",
		answer:
			"Yonaris is an AI visibility platform for Generative Engine Optimization (GEO) and Answer Engine Optimization (AEO). It tracks brand mentions, citations, competitors, and the queries AI systems use to build their answers.",
	},
	{
		question: "What is Generative Engine Optimization (GEO)?",
		answer:
			"GEO is the practice of measuring and improving how AI answer engines discover, describe, mention, and cite a brand. It uses repeatable prompts and evidence from model responses to identify opportunities for improvement.",
	},
	{
		question: "Which AI models can Yonaris track?",
		answer:
			"Yonaris tracks the AI providers configured for a deployment. Each run records the response, brand and competitor mentions, citations, and available query fan-out data so results can be compared over time.",
	},
	{
		question: "Can Yonaris establish a GEO baseline?",
		answer:
			"Yes. A controlled prompt set, fixed execution rules, and scheduled reruns create a baseline for visibility, share of voice, citations, and competitor presence across the selected models.",
	},
	{
		question: "Who owns the data collected by Yonaris?",
		answer:
			"Data is stored in the Yonaris deployment used by your team. Provider credentials and deployment choices remain under the control of the deployment operator.",
	},
];

// Pricing page FAQ.
export const PRICING_FAQS: FaqItem[] = [
	{
		question: "Which Yonaris deployment option should I choose?",
		answer:
			"Choose the deployment model that matches your data-control, maintenance, and customer-delivery requirements. Contact the Yonaris team before relying on availability or commercial terms shown on this site.",
	},
	{
		question: "Can Yonaris support multiple customer brands?",
		answer:
			"Yonaris supports multiple tracked brands and can be adapted for agency delivery workflows. Organization, access-control, and white-label requirements should be confirmed for each deployment.",
	},
	{
		question: "Which costs are separate from Yonaris?",
		answer:
			"AI provider, search-data, scraping, infrastructure, and storage costs depend on the integrations and execution volume selected for the deployment.",
	},
	{
		question: "Can pricing be confirmed online?",
		answer:
			"No. Published deployment options are informational until the Yonaris team confirms scope, availability, and commercial terms for your use case.",
	},
];

// Off-Site AEO service FAQ. Rendered on "/off-site-aeo" and emitted as FAQPage
// JSON-LD from the same route.
export const OFFSITE_FAQS: FaqItem[] = [
	{
		question: "How does the off-site AEO service work?",
		answer:
			"It starts with a consultancy call where we review how AI answer engines currently talk about you and decide which prompts and gaps to target. Within 30 days, that month's posts are planned, written, humanized, and live on high-authority sites, and you get a report tying each placement to the issue it targets. We then keep publishing for you every month, adjusting the targets as your visibility shifts.",
	},
	{
		question: "Are the articles AI-generated?",
		answer:
			"Yes, and we're upfront about it. We draft with AI, then it is reworked until it lands under a 25% AI-detection score on both ZeroGPT and Pangram before it goes live. That keeps quality high while keeping your brand mentioned in content the models actually trust and cite.",
	},
	{
		question: "Do you offer refunds?",
		answer:
			"No. All plans are non-refundable. We commission and place real editorial inventory on third-party sites as soon as your month begins, so those costs are committed up front. You can cancel future months at any time before that cycle's work starts.",
	},
	{
		question: "How is this different from buying backlinks?",
		answer:
			"It's a similar process. However, we make sure the content is useful for AEO, only place it on high-quality sites, and humanize the text to avoid detection. Many backlink services offer very low-quality placements with high spam scores, non-existent traffic, and gamed DRs, and either make you provide your own content or produce content that's low quality and easily detected as AI.",
	},
	{
		question: "Will this help my traditional SEO too?",
		answer:
			"These all provide dofollow links on high-DR domains with actual traffic, so your search rankings should benefit as well. But the primary purpose is to provide more data points to AI searches for AEO.",
	},
];

// AI Visibility Tool Directory FAQ.
export const DIRECTORY_FAQS: FaqItem[] = [
	{
		question: "What is an AI visibility tool?",
		answer:
			"An AI visibility tool tracks how AI answer engines like ChatGPT, Perplexity, Gemini, and Google AI Overviews mention and cite your brand. It measures how often you appear in AI answers, which competitors show up alongside you, and which sources the models reference.",
	},
	{
		question: "What is Answer Engine Optimization (AEO)?",
		answer:
			"Answer Engine Optimization (AEO), also called generative engine optimization (GEO), is the practice of improving how often AI answer engines mention and cite your brand. AI visibility tools measure that presence so you can track and improve it over time.",
	},
	{
		question: "How do I choose the best AI visibility tool?",
		answer:
			"The right tool depends on which AI engines you need to track, whether you want self-hosting and data ownership, your budget, and any agency or white-label needs. This directory compares 100+ tools feature-by-feature so you can match a tool to your requirements.",
	},
	{
		question: "Is there an open-source AI visibility tool?",
		answer:
			"Yes. Elmo is an open-source, self-hostable AI visibility platform. You can run it on your own infrastructure for free, audit exactly how each metric is calculated, and export your data at any time.",
	},
	{
		question: "How does AI visibility tracking work?",
		answer:
			"AI visibility tracking works by running a defined set of prompts across AI engines on a schedule, then recording whether each answer mentions your brand, cites your site, and how it describes you. Sampling over time reveals trends a one-off check would miss.",
	},
	{
		question: "Can you track brand mentions in ChatGPT?",
		answer:
			"Yes. AI visibility software queries ChatGPT with your prompts and records whether it mentions or cites your brand. Because answers vary between runs, tracking a consistent prompt set on a schedule gives a far more reliable read than a single manual check.",
	},
];
