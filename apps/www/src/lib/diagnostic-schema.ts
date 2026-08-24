import { z } from "zod";
import type { Locale } from "@/content/site/types";

export const DIAGNOSTIC_SCOPE_FIELDS = ["website", "brand", "market", "question"] as const;
export const DIAGNOSTIC_CONTACT_FIELDS = ["competitors", "name", "email", "consent"] as const;
export const DIAGNOSTIC_LEAD_FIELDS = [...DIAGNOSTIC_SCOPE_FIELDS, ...DIAGNOSTIC_CONTACT_FIELDS] as const;

export type DiagnosticLeadField = (typeof DIAGNOSTIC_LEAD_FIELDS)[number];
export type DiagnosticStageId = "scope" | "contact";

function containsWhitespaceOrControl(value: string): boolean {
	for (const character of value) {
		const codePoint = character.codePointAt(0);
		if (/\s/u.test(character) || (codePoint !== undefined && (codePoint <= 0x1f || codePoint === 0x7f))) {
			return true;
		}
	}
	return false;
}

const websiteSchema = z
	.string()
	.trim()
	.min(1)
	.max(300)
	.superRefine((value, context) => {
		if (!/^(?:http|https):\/\//.test(value) || containsWhitespaceOrControl(value)) {
			context.addIssue({ code: "custom", message: "invalid_website" });
			return;
		}

		try {
			const url = new URL(value);
			if (!["http:", "https:"].includes(url.protocol) || !url.hostname || url.username || url.password) {
				context.addIssue({ code: "custom", message: "invalid_website" });
			}
		} catch {
			context.addIssue({ code: "custom", message: "invalid_website" });
		}
	});

const scopeShape = {
	website: websiteSchema,
	brand: z.string().trim().min(1).max(120),
	market: z.string().trim().min(1).max(160),
	question: z.string().trim().min(10).max(2000),
} as const;

export const diagnosticScopeSchema = z.strictObject(scopeShape);
export type DiagnosticScope = z.output<typeof diagnosticScopeSchema>;

const contactShape = {
	name: z.string().trim().min(1).max(120),
	company: z.string().trim().min(1).max(160),
	companyUrl: z.string().trim().max(0).default(""),
} as const;

export const diagnosticLeadSchema = z.discriminatedUnion("locale", [
	z.strictObject({
		locale: z.literal("en" satisfies Locale),
		...contactShape,
		email: z.string().trim().min(1).max(254).pipe(z.email()),
	}),
	z.strictObject({
		locale: z.literal("zh" satisfies Locale),
		...contactShape,
		phone: z
			.string()
			.trim()
			.min(6)
			.max(32)
			.regex(/^(?=.*\d)[+\d\s()-]+$/),
	}),
]);
export type DiagnosticLead = z.output<typeof diagnosticLeadSchema>;

export function parseDiagnosticScope(input: unknown): z.ZodSafeParseResult<DiagnosticScope> {
	return diagnosticScopeSchema.safeParse(input);
}

export function parseDiagnosticLead(input: unknown): z.ZodSafeParseResult<DiagnosticLead> {
	return diagnosticLeadSchema.safeParse(input);
}

export function parseDiagnosticSearch(search: Record<string, unknown>): { website: string } {
	if (typeof search.website !== "string") return { website: "" };
	const result = websiteSchema.safeParse(search.website);
	return result.success ? { website: result.data } : { website: "" };
}
