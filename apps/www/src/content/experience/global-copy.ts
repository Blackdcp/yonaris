import type { HumanPageCopy, HumanPageKey } from "./types";

type LinkCopy = {
	readonly label: string;
	readonly href: string;
};

type GlobalPageCopy = HumanPageCopy & {
	readonly primaryAction: LinkCopy;
	readonly secondaryAction?: LinkCopy;
	readonly closingTitle: string;
	readonly closingBody: string;
};

export const GLOBAL_COPY = {
	home: {
		navLabel: "Home",
		metaTitle: "Yonaris — See how AI presents your brand",
		metaDescription:
			"See whether your brand appears in selected AI answers, how it is described, which competitors are included, and which citations are shown.",
		eyebrow: "AI is becoming the front door to your market",
		title: "Your next customer may never search. They’ll ask.",
		lead: "Yonaris brings relevant AI answers, brand mentions, competitor comparisons, and available citations into one place—so your team can see what needs attention.",
		primaryAction: { label: "Request an AI-answer review", href: "/diagnostic" },
		secondaryAction: { label: "Explore the product", href: "/product" },
		closingTitle: "Start with one decision-critical question.",
		closingBody:
			"Share three details. We’ll contact you to discuss the brand, market, language, and question you want to understand.",
	},
	product: {
		navLabel: "Product",
		metaTitle: "Yonaris Product — Review AI answers about your brand",
		metaDescription:
			"Inspect AI answers, brand mentions, competitor comparisons, citations when available, and changes across repeated checks.",
		eyebrow: "The Yonaris product",
		title: "See how AI answers your market’s buying questions.",
		lead: "Review the full response, whether your brand appears, how it is described, which competitors are named, and which citations are visible.",
		primaryAction: { label: "Request a product walkthrough", href: "/diagnostic" },
		secondaryAction: { label: "How Yonaris works with you", href: "/approach" },
		closingTitle: "Start with the answer that matters most.",
		closingBody:
			"Start with one high-value buying question, then expand across brands, markets, and languages as priorities grow.",
	},
	approach: {
		navLabel: "Approach",
		metaTitle: "Yonaris Approach — Start with one buying question",
		metaDescription:
			"Define one buyer question, review the answers in context, and compare the same question over time.",
		eyebrow: "A focused way to examine AI answers",
		title: "Start with the buying question that matters.",
		lead: "Define the brand, market, language, and relevant alternatives. Then review the complete answers side by side and return to the same question over time.",
		primaryAction: { label: "Discuss your priority question", href: "/diagnostic" },
		secondaryAction: { label: "Explore the product", href: "/product" },
		closingTitle: "Begin with a defined question.",
		closingBody: "One brand, one market, one language, and the alternatives customers already consider.",
	},
	geo: {
		navLabel: "Global markets",
		metaTitle: "Yonaris Global Markets — One brand, many answer contexts",
		metaDescription:
			"Compare how AI presents the same brand for selected languages, buyer questions, categories, and competitors.",
		eyebrow: "Global growth needs local questions",
		title: "See how the same brand appears across markets.",
		lead: "Compare selected markets using local language, buyer questions, category terms, and relevant alternatives—without treating localization as word-for-word translation.",
		primaryAction: { label: "Discuss a target market", href: "/diagnostic" },
		secondaryAction: { label: "See the approach", href: "/approach" },
		closingTitle: "Global consistency is not word-for-word sameness.",
		closingBody: "Compare the same core brand facts against the questions each selected market actually asks.",
	},
	company: {
		navLabel: "Company",
		metaTitle: "About Yonaris — A clearer view of AI brand answers",
		metaDescription:
			"Yonaris helps brands understand how AI presents them across buyer questions, languages, and market contexts.",
		eyebrow: "About Yonaris",
		title: "Built for the shift from search results to AI answers.",
		lead: "Yonaris is a brand intelligence company helping teams understand how AI presents them when customers discover, compare, and choose.",
		primaryAction: { label: "Talk to Yonaris", href: "/diagnostic" },
		secondaryAction: { label: "See the product", href: "/product" },
		closingTitle: "One brand truth. Different market questions.",
		closingBody:
			"We connect a consistent brand core with the language, category expectations, and alternatives customers use in each market.",
	},
	diagnostic: {
		navLabel: "Contact",
		metaTitle: "Talk to Yonaris — Start with one market question",
		metaDescription:
			"Share your name, work email, and company. Yonaris will follow up about the brand and market question that matters.",
		eyebrow: "Start a focused conversation",
		title: "Start with the question that matters.",
		lead: "Tell us who you are and where you work. We’ll get in touch to understand the brand, market, and buying question behind your next move.",
		primaryAction: { label: "Go to the form", href: "#contact-form" },
		secondaryAction: { label: "See the product first", href: "/product" },
		closingTitle: "Three details. One useful first conversation.",
		closingBody: "No long questionnaire. We can begin with the question you already have.",
	},
	privacy: {
		navLabel: "Privacy",
		metaTitle: "Yonaris Privacy — Contact request data",
		metaDescription:
			"What the Yonaris contact form sends, how the details are used, and what stays out of browser analytics.",
		eyebrow: "Contact request privacy",
		title: "Your details take one short route.",
		lead: "The contact form asks for three visible details. They are sent to Yonaris so we can respond to your request.",
		primaryAction: { label: "Return to contact", href: "/diagnostic" },
		secondaryAction: { label: "Visit the homepage", href: "/" },
		closingTitle: "Ready to start a conversation?",
		closingBody: "Return to the contact form whenever you are ready.",
	},
} as const satisfies Record<HumanPageKey, GlobalPageCopy>;

export type GlobalCopy = typeof GLOBAL_COPY;
