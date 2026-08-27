import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getTableConfig, PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { brandOpportunities, reports } from "../schema";

const repositoryRoot = resolve(process.cwd(), "../..");

describe("artifact output language migration artifacts", () => {
	it("adds independent output-language columns, checks, and the language-aware Opportunity index", () => {
		const migrationPath = resolve(
			repositoryRoot,
			"packages/lib/src/db/migrations/0032_artifact_output_languages.sql",
		);
		expect(
			existsSync(migrationPath),
			"Expected 0032_artifact_output_languages.sql to exist before checking its contract",
		).toBe(true);
		const migration = readFileSync(migrationPath, "utf8");

		expect(migration).toContain(
			'ALTER TABLE "reports" ADD COLUMN "output_language" text DEFAULT \'en\' NOT NULL',
		);
		expect(migration).toContain(
			'ALTER TABLE "reports" ADD CONSTRAINT "reports_output_language_supported" CHECK ("reports"."output_language" IN (\'en\', \'zh-CN\'))',
		);
		expect(migration).toContain(
			'ALTER TABLE "brand_opportunities" ADD COLUMN "output_language" text DEFAULT \'en\' NOT NULL',
		);
		expect(migration).toContain(
			'ALTER TABLE "brand_opportunities" ADD CONSTRAINT "brand_opportunities_output_language_supported" CHECK ("brand_opportunities"."output_language" IN (\'en\', \'zh-CN\'))',
		);
		expect(migration).toContain('DROP INDEX "brand_opportunities_brand_scope_created_at_idx"');
		expect(migration).toContain(
			'CREATE INDEX "brand_opportunities_brand_scope_language_created_at_idx" ON "brand_opportunities" USING btree ("brand_id","scope_id","output_language","created_at")',
		);
		expect(migration).not.toMatch(/measurement_scopes|locale|market/i);
	});

	it("exposes exact defaults, checks, and index ordering through Drizzle metadata", () => {
		const dialect = new PgDialect();
		const reportTable = getTableConfig(reports);
		const opportunityTable = getTableConfig(brandOpportunities);

		for (const table of [reportTable, opportunityTable]) {
			expect(table.columns.find((column) => column.name === "output_language")).toMatchObject({
				default: "en",
				notNull: true,
			});
		}

		const reportCheck = reportTable.checks.find(
			(check) => check.name === "reports_output_language_supported",
		);
		const opportunityCheck = opportunityTable.checks.find(
			(check) => check.name === "brand_opportunities_output_language_supported",
		);
		expect(reportCheck).toBeDefined();
		expect(opportunityCheck).toBeDefined();
		if (!reportCheck || !opportunityCheck) throw new Error("Expected both named output-language checks");
		expect(dialect.sqlToQuery(reportCheck.value).sql).toContain(
			'"reports"."output_language" IN (\'en\', \'zh-CN\')',
		);
		expect(dialect.sqlToQuery(opportunityCheck.value).sql).toContain(
			'"brand_opportunities"."output_language" IN (\'en\', \'zh-CN\')',
		);

		const indexes = opportunityTable.indexes.map((index) => index.config);
		expect(indexes.map(({ name }) => name)).not.toContain("brand_opportunities_brand_scope_created_at_idx");
		const languageIndex = indexes.find(
			({ name }) => name === "brand_opportunities_brand_scope_language_created_at_idx",
		);
		expect(languageIndex).toBeDefined();
		expect(languageIndex?.columns.map((column) => ("name" in column ? column.name : undefined))).toEqual([
			"brand_id",
			"scope_id",
			"output_language",
			"created_at",
		]);
	});

	it("keeps the generated snapshot and journal aligned", () => {
		const snapshot = JSON.parse(
			readFileSync(resolve(repositoryRoot, "packages/lib/src/db/migrations/meta/0032_snapshot.json"), "utf8"),
		) as {
			tables: Record<
				string,
				{
					columns: Record<string, { default: string; notNull: boolean }>;
					checkConstraints: Record<string, { name: string; value: string }>;
					indexes: Record<string, { columns: Array<{ expression: string }> }>;
				}
			>;
		};
		const journal = JSON.parse(
			readFileSync(resolve(repositoryRoot, "packages/lib/src/db/migrations/meta/_journal.json"), "utf8"),
		) as { entries: Array<{ idx: number; version: string; when: number; tag: string; breakpoints: boolean }> };
		const reportTable = snapshot.tables["public.reports"];
		const opportunityTable = snapshot.tables["public.brand_opportunities"];

		expect(reportTable.columns.output_language).toMatchObject({ default: "'en'", notNull: true });
		expect(opportunityTable.columns.output_language).toMatchObject({ default: "'en'", notNull: true });
		expect(reportTable.checkConstraints.reports_output_language_supported).toEqual({
			name: "reports_output_language_supported",
			value: '"reports"."output_language" IN (\'en\', \'zh-CN\')',
		});
		expect(opportunityTable.checkConstraints.brand_opportunities_output_language_supported).toEqual({
			name: "brand_opportunities_output_language_supported",
			value: '"brand_opportunities"."output_language" IN (\'en\', \'zh-CN\')',
		});
		expect(opportunityTable.indexes).not.toHaveProperty("brand_opportunities_brand_scope_created_at_idx");
		expect(
			opportunityTable.indexes[
				"brand_opportunities_brand_scope_language_created_at_idx"
			].columns.map(({ expression }) => expression),
		).toEqual(["brand_id", "scope_id", "output_language", "created_at"]);
		expect(journal.entries.at(-1)).toMatchObject({
			idx: 32,
			version: "7",
			tag: "0032_artifact_output_languages",
			breakpoints: true,
		});
		expect(journal.entries.at(-1)?.when).toEqual(expect.any(Number));
	});
});
