import { describe, expect, test } from "vitest";
import { HUMAN_PAGE_KEYS } from "@/content/experience/types";
import * as audit from "../../scripts/audit-site-manifest";
import * as subject from "./site-manifest";

const paths = {
	home: { en: "/", zh: "/zh" },
	product: { en: "/product", zh: "/zh/product" },
	approach: { en: "/approach", zh: "/zh/approach" },
	geo: { en: "/geo", zh: "/zh/geo" },
	company: { en: "/company", zh: "/zh/company" },
	diagnostic: { en: "/diagnostic", zh: "/zh/diagnostic" },
	privacy: { en: "/privacy", zh: "/zh/privacy" },
} as const;

describe("site manifest", () => {
	test("maps all approved Human routes and no retired section", () => {
		for (const key of HUMAN_PAGE_KEYS) {
			expect(subject.getCorePath(key, "en")).toBe(paths[key].en);
			expect(subject.getCorePath(key, "zh")).toBe(paths[key].zh);
			expect(subject.getCoreLastVerified(key)).toBe("2026-08-27");
		}
		expect(subject.findSiteRoute("/research")).toBeUndefined();
		expect(subject.findSiteRoute("/zh/research")).toBeUndefined();
		expect(subject.findSiteRoute("/resources")).toBeUndefined();
	});

	test("keeps canonicals unique and route keys complete", () => {
		const canonicals = subject.SITE_MANIFEST.flatMap((route) => Object.values(route.canonicals));
		expect(new Set(canonicals).size).toBe(canonicals.length);
		expect(subject.SITE_MANIFEST.map((route) => route.key).sort()).toEqual([...subject.SITE_ROUTE_KEYS].sort());
	});

	test("orders the approved Site 06 primary destinations", () => {
		expect(
			subject.SITE_MANIFEST.filter((route) => (route.navigation as readonly string[]).includes("primary")).map(
				(route) => route.key,
			),
		).toEqual(["product", "approach", "company", "diagnostic"]);
	});

	test("maps every Human topic to an Agent page", () => {
		for (const key of HUMAN_PAGE_KEYS) {
			const expected = key === "home" ? "/agent" : `/agent/${key}`;
			expect(subject.getSiteRoute(key).agentPath).toBe(expected);
		}
	});

	test("keeps redirects classified and acyclic", () => {
		expect(subject.SITE_REDIRECTS).toContainEqual({ from: "/results", to: "/product", statusCode: 308 });
		for (const redirect of subject.SITE_REDIRECTS) {
			expect(subject.findSiteRoute(redirect.to)).toBeDefined();
			const seen = new Set<string>();
			let path: string | undefined = redirect.from;
			while (path) {
				expect(seen.has(path)).toBe(false);
				seen.add(path);
				path = subject.getRedirect(path)?.to;
			}
		}
	});

	test("classifies every filesystem route pattern", async () => {
		const patterns = await audit.discoverRoutePatterns();
		expect(patterns.filter((pattern) => !subject.findSiteRoute(pattern))).toEqual([]);
	});
});
