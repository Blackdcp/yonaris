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

export const diagnosticLeadSchema = z.strictObject({
	locale: z.enum(["en", "zh"] satisfies readonly Locale[]),
	...scopeShape,
	competitors: z.string().trim().max(600).default(""),
	name: z.string().trim().min(1).max(120),
	email: z.string().trim().min(1).max(254).pipe(z.email()),
	consent: z.literal(true),
	companyUrl: z.string().trim().max(0).default(""),
});
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

export const DIAGNOSTIC_FALLBACK_RECIPIENT = "black.dcp@outlook.com";

function oneLine(value: string): string {
	return value
		.replace(/[\r\n]+/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}

function diagnosticMailBody(lead: DiagnosticLead): string {
	const labels =
		lead.locale === "zh"
			? ["语言", "官网", "品牌", "市场或品类", "市场问题", "需要纳入的竞品", "姓名", "邮箱", "同意"]
			: [
					"Locale",
					"Website",
					"Brand",
					"Market or category",
					"Market question",
					"Competitors to include",
					"Name",
					"Email",
					"Consent",
				];
	const values = [
		lead.locale,
		lead.website,
		lead.brand,
		lead.market,
		lead.question,
		lead.competitors || "—",
		lead.name,
		lead.email,
		lead.locale === "zh" ? "已同意" : "yes",
	];
	return labels.map((label, index) => `${label}: ${oneLine(values[index] ?? "")}`).join("\n");
}

export function buildDiagnosticMailto(input: unknown): string | null {
	const result = parseDiagnosticLead(input);
	if (!result.success) return null;

	const lead = result.data;
	const subject =
		lead.locale === "zh"
			? `Yonaris 免费诊断申请 / ${oneLine(lead.brand)}`
			: `Yonaris free diagnostic / ${oneLine(lead.brand)}`;
	return `mailto:${encodeURIComponent(DIAGNOSTIC_FALLBACK_RECIPIENT)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(diagnosticMailBody(lead))}`;
}
