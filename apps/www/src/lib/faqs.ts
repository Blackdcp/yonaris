export interface FaqItem {
	question: string;
	answer: string;
}

// AI Visibility Tool Directory FAQ. This remains part of the governed legacy
// archive and is rendered by the directory route.
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
