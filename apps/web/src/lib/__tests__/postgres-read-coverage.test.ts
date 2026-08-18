import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	execute: vi.fn(),
}));

vi.mock("drizzle-orm/node-postgres", () => ({
	drizzle: () => ({ execute: mocks.execute }),
}));

import {
	getCitationRunCoverage,
	getFanoutBreakdown,
	getFanoutModelTotals,
	getFanoutPromptTotals,
} from "@/lib/postgres-read";

function executedSql(): string {
	const [query] = mocks.execute.mock.calls[0] as [
		{
			toQuery: (config: {
				escapeName: (name: string) => string;
				escapeParam: (index: number, value: unknown) => string;
				escapeString: (value: string) => string;
				casing: { getColumnCasing: (column: { name: string }) => string };
			}) => { sql: string };
		},
	];
	return query
		.toQuery({
			escapeName: (name) => name,
			escapeParam: (index) => `$${index + 1}`,
			escapeString: (value) => value,
			casing: { getColumnCasing: (column) => column.name },
		})
		.sql.replace(/\s+/g, " ");
}

describe("coverage query semantics", () => {
	beforeEach(() => {
		mocks.execute.mockReset();
		mocks.execute.mockResolvedValue({ rows: [] });
	});

	it("counts citation coverage by distinct prompt run despite a fan-out of citation links", async () => {
		await getCitationRunCoverage("brand-1", "2026-08-01", "2026-08-18", "Asia/Shanghai", [
			"11111111-1111-4111-8111-111111111111",
		]);

		const statement = executedSql();
		expect(statement).toContain("count(DISTINCT pr.id)::int AS evaluated_runs");
		expect(statement).toContain(
			"count(DISTINCT pr.id) FILTER (WHERE pr.web_search_enabled)::int AS search_enabled_runs",
		);
		expect(statement).toContain(
			"count(DISTINCT pr.id) FILTER (WHERE c.id IS NOT NULL)::int AS extracted_citation_runs",
		);
	});

	it("derives raw and exposed query run coverage separately from genuine fan-out", async () => {
		await getFanoutModelTotals("brand-1", "2026-08-01", "2026-08-18", "Asia/Shanghai", [
			"11111111-1111-4111-8111-111111111111",
		]);

		const statement = executedSql();
		expect(statement).toContain("AS raw_query_runs");
		expect(statement).toContain("AS exposed_query_runs");
		expect(statement).toContain("WHERE pr.web_search_enabled AND fq.raw_cnt > 0");
		expect(statement).toContain("WHERE pr.web_search_enabled AND fq.exposed_cnt > 0");
	});

	it("keeps fan-out breakdowns and prompt denominators on web-search-enabled runs", async () => {
		const args: [string, string, string, string, string[]] = [
			"brand-1",
			"2026-08-01",
			"2026-08-18",
			"Asia/Shanghai",
			["11111111-1111-4111-8111-111111111111"],
		];

		await getFanoutBreakdown(...args);
		expect(executedSql()).toContain("AND pr.web_search_enabled");

		mocks.execute.mockClear();
		await getFanoutPromptTotals(...args);
		expect(executedSql()).toContain("AND pr.web_search_enabled");
	});
});
