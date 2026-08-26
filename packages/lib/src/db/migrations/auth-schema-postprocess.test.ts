import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const cliSchema = `import { relations } from "drizzle-orm";
import {
  pgTable,
  text,
} from "drizzle-orm/pg-core";

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  uiLanguage: text("ui_language").default("en").notNull(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
});
`;

function postprocess(input: string) {
	const directory = mkdtempSync(resolve(tmpdir(), "yonaris-auth-schema-"));
	const inputPath = resolve(directory, "cli-schema.ts");
	const outputPath = resolve(directory, "schema-auth.ts");
	writeFileSync(inputPath, input);
	const script = resolve(process.cwd(), "scripts/postprocess-auth-schema.mjs");
	const result = spawnSync(process.execPath, [script, inputPath, outputPath], { encoding: "utf8" });
	const output = result.status === 0 ? readFileSync(outputPath, "utf8") : undefined;

	return {
		...result,
		output,
		cleanup: () => rmSync(directory, { force: true, recursive: true }),
	};
}

describe("auth schema postprocessing", () => {
	it("deterministically adds the named UI-language constraint to CLI output", () => {
		const first = postprocess(cliSchema);
		const second = postprocess(cliSchema);
		const generator = readFileSync(resolve(process.cwd(), "scripts/generate-auth-schema.sh"), "utf8");

		try {
			expect(first.status).toBe(0);
			expect(second.status).toBe(0);
			expect(first.output).toBe(second.output);
			expect(first.output).toContain(
				'uiLanguageSupported: check("user_ui_language_supported", sql`${table.uiLanguage} IN (\'en\', \'zh-CN\')`),',
			);
			expect(first.output).toContain("Source of truth: Better Auth CLI output plus repository post-processing.");
			expect(first.output).toContain(
				'} from "drizzle-orm/pg-core";\n\nexport const user = pgTable(\n  "user",\n  {',
			);
			expect(first.output).not.toContain("drizzle-oexport");
			expect(generator).toContain('node "$SCRIPT_DIR/postprocess-auth-schema.mjs" "$TMP_OUTPUT" "$OUTPUT"');
	} finally {
			first.cleanup();
			second.cleanup();
		}
	});

	it("fails loudly when the CLI user-table anchor drifts", () => {
		const result = postprocess(cliSchema.replace('export const user = pgTable("user", {', ""));

		try {
			expect(result.status).toBe(1);
			expect(result.stderr).toContain("[postprocess-auth-schema] ERROR: expected user table anchor");
		} finally {
			result.cleanup();
		}
	});
});
