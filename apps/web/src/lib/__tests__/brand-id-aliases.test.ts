import { describe, expect, it } from "vitest";
import { resolveBrandIdAlias } from "../brand-id-aliases";

describe("resolveBrandIdAlias", () => {
	it("returns the original id without configuration", () => {
		expect(resolveBrandIdAlias("default", undefined)).toBe("default");
	});

	it("resolves a configured legacy id", () => {
		expect(resolveBrandIdAlias("default", "default:memtensor")).toBe("memtensor");
	});

	it("supports multiple mappings and chained renames", () => {
		expect(resolveBrandIdAlias("old", "other:brand, old:default,default:memtensor")).toBe("memtensor");
	});

	it("ignores malformed mappings", () => {
		expect(resolveBrandIdAlias("default", "broken,default:,bad id:memtensor,default:memtensor")).toBe("memtensor");
	});

	it("falls back to the original id for cycles", () => {
		expect(resolveBrandIdAlias("default", "default:memtensor,memtensor:default")).toBe("default");
	});
});
