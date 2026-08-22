import { describe, expect, test } from "vitest";

type MachineResponseModule = typeof import("./machine-response");

async function loadSubject(): Promise<MachineResponseModule | undefined> {
	try {
		return (await import("./machine-response")) as MachineResponseModule;
	} catch {
		return undefined;
	}
}

const subject = await loadSubject();

function requireSubject(): MachineResponseModule | undefined {
	expect(subject, "the machine-response helper must load").toBeDefined();
	return subject;
}

describe("machine responses", () => {
	test("marks English and Chinese documents as cacheable noindex machine content", async () => {
		const responseHelpers = requireSubject();
		if (!responseHelpers) return;

		for (const [language, expected] of [
			["en", "en"],
			["zh", "zh-CN"],
		] as const) {
			const response = responseHelpers.machineDocumentResponse("# Facts", { language });
			expect(response.status).toBe(200);
			expect(await response.text()).toBe("# Facts");
			expect(response.headers.get("content-type")).toBe("text/markdown; charset=utf-8");
			expect(response.headers.get("content-language")).toBe(expected);
			expect(response.headers.get("x-robots-tag")).toBe("noindex, follow");
			expect(response.headers.get("cache-control")).toBe("public, max-age=300");
		}
	});

	test("merges Accept into Vary without discarding or duplicating existing dimensions", () => {
		const responseHelpers = requireSubject();
		if (!responseHelpers) return;

		const headers = new Headers({ Vary: "RSC, Accept-Encoding, accept" });
		responseHelpers.appendVary(headers, "Accept");
		expect(headers.get("vary")).toBe("RSC, Accept-Encoding, accept");

		responseHelpers.appendVary(headers, "Next-Router-State-Tree");
		expect(headers.get("vary")).toBe("RSC, Accept-Encoding, accept, Next-Router-State-Tree");
	});
});
