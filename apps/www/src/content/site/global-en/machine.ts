import type { CorePageKey, FactualClaim } from "@/content/site/types";
import { GLOBAL_ENGLISH_CONTENT } from "./index";

export interface GlobalEnglishMachineFacts {
	readonly title: string;
	readonly description: string;
	readonly currentScope: string;
	readonly claims: readonly FactualClaim[];
	readonly limitations: readonly string[];
}

export const GLOBAL_ENGLISH_MACHINE_FACTS: Readonly<Record<CorePageKey, GlobalEnglishMachineFacts>> = {
	home: {
		title: GLOBAL_ENGLISH_CONTENT.home.headline,
		description: GLOBAL_ENGLISH_CONTENT.home.description,
		currentScope:
			"Yonaris reviews configured AI answer evidence for one defined brand, market, language, and decision question.",
		claims: [
			{
				id: "reviewable-market-evidence",
				status: "current-software",
				text: "The customer workspace keeps configured answer records and their evidence states visible for review.",
			},
			{
				id: "operated-delivery",
				status: "managed-delivery",
				text: "Yonaris operates configured collection and human review where the workflow is not self-service.",
			},
		],
		limitations: ["Configured observation is not universal market coverage or causal proof."],
	},
	product: {
		title: GLOBAL_ENGLISH_CONTENT.product.headline,
		description: GLOBAL_ENGLISH_CONTENT.product.description,
		currentScope:
			"The evidence workbench records market scope, answer samples, available-source states, review status, and a bounded next-test candidate.",
		claims: [
			{
				id: "visible-workbench",
				status: "current-software",
				text: "Customers can inspect configured evidence records in the workspace.",
			},
			{
				id: "explicit-ownership",
				status: "managed-delivery",
				text: "System output, Yonaris review, and customer decision remain separate responsibilities.",
			},
		],
		limitations: [GLOBAL_ENGLISH_CONTENT.product.boundary],
	},
	approach: {
		title: GLOBAL_ENGLISH_CONTENT.approach.headline,
		description: GLOBAL_ENGLISH_CONTENT.approach.description,
		currentScope:
			"One defined market question moves through scope definition, comparable observation, evidence inspection, human review, and repeat measurement.",
		claims: [
			{
				id: "four-step-path",
				status: "managed-delivery",
				text: "The workflow leaves a scope brief, answer set, evidence note, and next-test brief for review.",
			},
		],
		limitations: ["Repeat observation supports comparison; it does not by itself prove causality."],
	},
	research: {
		title: GLOBAL_ENGLISH_CONTENT.research.headline,
		description: GLOBAL_ENGLISH_CONTENT.research.description,
		currentScope:
			"Evidence records expose the observation scope, valid denominator, answer state, available-source state, finding, and review boundary.",
		claims: [
			{
				id: "denominator-visible",
				status: "verified-evidence",
				text: "A reported rate is defined against all valid samples in the configured scope.",
			},
			{
				id: "unknowns-remain-unknown",
				status: "verified-evidence",
				text: "Unavailable evidence is recorded as unknown rather than inferred.",
			},
		],
		limitations: [GLOBAL_ENGLISH_CONTENT.research.boundary],
	},
	company: {
		title: GLOBAL_ENGLISH_CONTENT.company.headline,
		description: GLOBAL_ENGLISH_CONTENT.company.description,
		currentScope:
			"Yonaris combines customer-visible software, configured collection, evidence review, and customer-owned decisions.",
		claims: [
			{
				id: "software-and-service",
				status: "managed-delivery",
				text: "The current operating model pairs a reviewable workspace with operated collection and human review.",
			},
		],
		limitations: ["Unverified team, customer, office, response-time, and coverage claims are not published."],
	},
	geo: {
		title: GLOBAL_ENGLISH_CONTENT.geo.headline,
		description: GLOBAL_ENGLISH_CONTENT.geo.description,
		currentScope:
			"The applied workflow maps discovery, description, comparison, available sources, and repeat observation inside a configured market boundary.",
		claims: [
			{
				id: "configured-entry-map",
				status: "managed-delivery",
				text: "Market, language, question set, supported surface, cohort, and observation period remain explicit.",
			},
		],
		limitations: ["Global service capability is configurable, not universal coverage."],
	},
	diagnostic: {
		title: GLOBAL_ENGLISH_CONTENT.diagnostic.headline,
		description: GLOBAL_ENGLISH_CONTENT.diagnostic.description,
		currentScope:
			"The regional website forms collect only the approved contact fields and send them through a server-validated email delivery route for human review.",
		claims: [
			{
				id: "regional-contact-contract",
				status: "verified-evidence",
				text: "Global requests contain name, work email, and company; China requests contain name, phone, and company.",
			},
		],
		limitations: ["Submitting starts a human scope review; it does not create an instant scan, score, or evidence result."],
	},
};
