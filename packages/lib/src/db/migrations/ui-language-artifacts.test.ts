import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("user UI language migration artifacts", () => {
	it("keeps the schema, migration, snapshot, and journal aligned", () => {
		const repositoryRoot = resolve(process.cwd(), "../..");
		const schema = readFileSync(resolve(repositoryRoot, "packages/lib/src/db/schema-auth.ts"), "utf8");
		const migration = readFileSync(
			resolve(repositoryRoot, "packages/lib/src/db/migrations/0031_user_ui_language.sql"),
			"utf8",
		);
		const snapshot = JSON.parse(
			readFileSync(resolve(repositoryRoot, "packages/lib/src/db/migrations/meta/0031_snapshot.json"), "utf8"),
		) as {
			tables: {
				"public.user": {
					columns: { ui_language: { default: string; notNull: boolean } };
					checkConstraints: Record<string, { name: string; value: string }>;
				};
			};
		};
		const journal = JSON.parse(
			readFileSync(resolve(repositoryRoot, "packages/lib/src/db/migrations/meta/_journal.json"), "utf8"),
		) as { entries: Array<{ idx: number; tag: string }> };

		expect(schema).toContain('check("user_ui_language_supported", sql`${table.uiLanguage} IN (\'en\', \'zh-CN\')`)');
		expect(migration).toContain('ADD COLUMN "ui_language" text DEFAULT \'en\' NOT NULL');
		expect(migration).toContain('CHECK ("ui_language" IN (\'en\', \'zh-CN\'))');
		expect(snapshot.tables["public.user"].columns.ui_language).toMatchObject({
			default: "'en'",
			notNull: true,
		});
		expect(snapshot.tables["public.user"].checkConstraints.user_ui_language_supported).toEqual({
			name: "user_ui_language_supported",
			value: `"user"."ui_language" IN ('en', 'zh-CN')`,
		});
		expect(journal.entries).toContainEqual({
			idx: 31,
			version: "7",
			when: 1787735383309,
			tag: "0031_user_ui_language",
			breakpoints: true,
		});
	});
});
