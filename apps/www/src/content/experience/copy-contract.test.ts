import { describe, expect, it } from "vitest";

type CopyModule = {
	GLOBAL_COPY?: Record<string, unknown>;
	CHINA_COPY?: Record<string, unknown>;
};

const subject = (await import("./index").catch(() => undefined)) as CopyModule | undefined;

const retiredSalesLanguage =
	/reviewable|denominator|managed delivery|human review|configured scope|evidence boundary|interface demonstration|no customer data|causal proof|证据边界|有效分母|人工审核点|配置化观察|责任边界|当前软件|当前演示|因果证明/i;

describe("regional customer copy", () => {
	it("provides complete, independent copy models for both editions", () => {
		expect(subject?.GLOBAL_COPY, "global copy must exist").toBeDefined();
		expect(subject?.CHINA_COPY, "China copy must exist").toBeDefined();
		if (!subject?.GLOBAL_COPY || !subject.CHINA_COPY) return;
		const expected = ["home", "product", "approach", "geo", "company", "diagnostic", "privacy"];
		expect(Object.keys(subject.GLOBAL_COPY)).toEqual(expected);
		expect(Object.keys(subject.CHINA_COPY)).toEqual(expected);
		expect(JSON.stringify(subject.GLOBAL_COPY)).not.toMatch(retiredSalesLanguage);
		expect(JSON.stringify(subject.CHINA_COPY)).not.toMatch(retiredSalesLanguage);
	});

	it("does not publish the retired section or role-based segmentation", () => {
		const rendered = JSON.stringify(subject ?? {});
		expect(rendered).not.toMatch(/resources|research|for CMOs|for marketers|市场总监|品牌负责人/i);
	});
});

