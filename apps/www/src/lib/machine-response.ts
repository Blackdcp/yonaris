import type { Locale } from "@/content/site/types";

interface MachineDocumentResponseOptions {
	language?: Locale;
	contentType?: "text/markdown; charset=utf-8" | "text/plain; charset=utf-8";
}

export function machineDocumentResponse(body: BodyInit | null, options: MachineDocumentResponseOptions = {}): Response {
	return new Response(body, {
		headers: {
			"Cache-Control": "public, max-age=300",
			"Content-Language": options.language === "zh" ? "zh-CN" : "en",
			"Content-Type": options.contentType ?? "text/markdown; charset=utf-8",
			"X-Robots-Tag": "noindex, follow",
		},
	});
}

export function appendVary(headers: Headers, dimension: string): void {
	const existing = (headers.get("Vary") ?? "")
		.split(",")
		.map((value) => value.trim())
		.filter(Boolean);
	if (!existing.some((value) => value.toLowerCase() === dimension.toLowerCase())) existing.push(dimension);
	headers.set("Vary", existing.join(", "));
}
