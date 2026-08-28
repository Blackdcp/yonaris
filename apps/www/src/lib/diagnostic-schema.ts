import { z } from "zod";
import type { Locale } from "@/content/site/types";

const contactShape = {
	name: z.string().trim().min(1).max(120),
	company: z.string().trim().min(1).max(160),
	companyUrl: z.string().trim().max(0).default(""),
	requestType: z.enum(["consultation", "privacy"]).default("consultation"),
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
export type DiagnosticRequestType = DiagnosticLead["requestType"];

export function parseDiagnosticLead(input: unknown): z.ZodSafeParseResult<DiagnosticLead> {
	return diagnosticLeadSchema.safeParse(input);
}
