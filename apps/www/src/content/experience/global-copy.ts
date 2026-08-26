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
		metaTitle: "Yonaris — See what shapes the buyer shortlist",
		metaDescription:
			"See the questions, evidence, and comparisons behind an AI-shaped buyer shortlist before the first conversation.",
		eyebrow: "AI-native MarTech infrastructure built for decisions made by people and shaped by agents.",
		title: "See what buyers are being told before the first conversation.",
		lead: "Yonaris makes the questions, evidence and comparisons behind an AI-shaped shortlist visible—so your team can act on the decision, not chase another visibility score.",
		primaryAction: { label: "Bring us one buying question", href: "/diagnostic" },
		secondaryAction: { label: "See the evidence platform", href: "/product" },
		closingTitle: "Bring one question the market cannot afford to get wrong.",
		closingBody: "We will establish whether it can be observed, evidenced and turned into a useful next action.",
	},
	product: {
		navLabel: "Platform",
		metaTitle: "Yonaris Platform — Make a market answer inspectable",
		metaDescription:
			"See how AI answers your market’s buying questions. Follow one answer into its source, boundary, and effect on the shortlist.",
		eyebrow: "A market answer, made inspectable.",
		title: "See what shaped the shortlist.",
		lead: "Start with one buying question. Follow the answer into the source, the boundary and the buying effect—then decide what deserves attention first.",
		primaryAction: { label: "Bring us a buying question", href: "/diagnostic" },
		secondaryAction: { label: "Review the evidence method", href: "/approach" },
		closingTitle: "Make one market judgment clear enough to act on.",
		closingBody: "The point is not another score. It is an inspectable decision with a visible source and boundary.",
	},
	approach: {
		navLabel: "Evidence",
		metaTitle: "Yonaris Evidence — Keep the question and retest together",
		metaDescription: "Keep the original question, answer, evidence, judgment, and retest in one readable record.",
		eyebrow: "Evidence that survives the meeting.",
		title: "Proof should be something your team can review.",
		lead: "The original question, observed answer, source material, recommendation and retest stay in one readable record.",
		primaryAction: { label: "Discuss your buying question", href: "/diagnostic" },
		secondaryAction: { label: "Inspect the platform", href: "/product" },
		closingTitle: "A retest only compares when the conditions remain visible.",
		closingBody: "Keep the question, market, model, language and source conditions beside the evidence.",
	},
	geo: {
		navLabel: "Across markets",
		metaTitle: "Yonaris Across Markets — Preserve the decision conditions",
		metaDescription:
			"Review how market, language, category wording, alternatives, and evidence change one buying decision.",
		eyebrow: "One system, different market conditions.",
		title: "Markets change the conditions around the decision.",
		lead: "Market, language, category wording, alternatives and evidence conditions stay visible around the buying decision. Yonaris keeps them beside the answer so your team can compare like with like and decide what to review.",
		primaryAction: { label: "Discuss a market question", href: "/diagnostic" },
		secondaryAction: { label: "See the evidence record", href: "/approach" },
		closingTitle: "Keep the company fact stable and the market context visible.",
		closingBody: "Consistency comes from preserving the fact while reviewing how each decision is framed.",
	},
	company: {
		navLabel: "Human + Agent",
		metaTitle: "Yonaris Human + Agent — One clear public company record",
		metaDescription:
			"Give people decision context and agents the same facts, sources, boundaries, and stable identifiers.",
		eyebrow: "One public record. Two legitimate readers.",
		title: "The same company should remain clear to people and agents.",
		lead: "Your team gets the context to decide; agents get the same fact, source and boundary.",
		primaryAction: { label: "Talk to Yonaris", href: "/diagnostic" },
		secondaryAction: { label: "Open the Agent surface", href: "/agent/company" },
		closingTitle: "Machine-readable does not mean machine-written.",
		closingBody:
			"Clear headings, stable addresses, visible sources and scoped facts are editorial discipline, not a retrieval guarantee.",
	},
	diagnostic: {
		navLabel: "Contact",
		metaTitle: "Talk to Yonaris — Begin with the buying decision",
		metaDescription: "Share your name, work email, and company to begin with one buying decision.",
		eyebrow: "Start with the decision, not a product demo.",
		title: "Tell us who to contact. We’ll begin with the buying decision.",
		lead: "Share three details. The first conversation will frame one market question and decide whether it can be observed, evidenced and turned into a useful next action.",
		primaryAction: { label: "Go to the contact form", href: "#contact-form" },
		secondaryAction: { label: "See the platform first", href: "/product" },
		closingTitle: "Three details. One useful first conversation.",
		closingBody: "No long questionnaire or prepared report is required.",
	},
	privacy: {
		navLabel: "Privacy",
		metaTitle: "Yonaris Privacy — Contact request data",
		metaDescription: "What the Yonaris contact form asks for and when delivery is confirmed.",
		eyebrow: "Contact request privacy.",
		title: "Your contact request takes one short route.",
		lead: "The form asks for three visible details. The page confirms form delivery only after the delivery service accepts the request; otherwise your entries stay in place.",
		primaryAction: { label: "Return to contact", href: "/diagnostic" },
		secondaryAction: { label: "Visit the homepage", href: "/" },
		closingTitle: "Ready to begin with a buying decision?",
		closingBody: "Return to the contact form whenever you are ready.",
	},
} as const satisfies Record<HumanPageKey, GlobalPageCopy>;

export type GlobalCopy = typeof GLOBAL_COPY;
