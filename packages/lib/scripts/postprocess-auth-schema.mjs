import { readFileSync, writeFileSync } from "node:fs";

const [inputPath, outputPath] = process.argv.slice(2);

function fail(message) {
	console.error(`[postprocess-auth-schema] ERROR: ${message}`);
	process.exit(1);
}

if (!inputPath || !outputPath) fail("usage: postprocess-auth-schema.mjs <input> <output>");

const drizzleImport = 'import { relations } from "drizzle-orm";';
const pgCoreImport = 'import {\n  pgTable,';
const userTableStart = 'export const user = pgTable("user", {';
const userTableEnd = "\n});\n\nexport const session = pgTable(";

let schema;
try {
	schema = readFileSync(inputPath, "utf8");
} catch (error) {
	fail(`unable to read CLI output: ${error.message}`);
}

if (!schema.includes(drizzleImport)) fail("expected drizzle-orm import anchor");
if (!schema.includes(pgCoreImport)) fail("expected drizzle-orm/pg-core import anchor");

const userStart = schema.indexOf(userTableStart);
if (userStart === -1) fail("expected user table anchor");

const userEnd = schema.indexOf(userTableEnd, userStart);
if (userEnd === -1) fail("expected user table terminator anchor");

const userBody = schema.slice(userStart + userTableStart.length, userEnd).replaceAll("\n  ", "\n    ");
const userTable = `export const user = pgTable(
  "user",
  {${userBody}
  },
  (table) => ({
    uiLanguageSupported: check("user_ui_language_supported", sql\`\${table.uiLanguage} IN ('en', 'zh-CN')\`),
  }),
);

`;
schema = `${schema.slice(0, userStart)}${userTable}${schema.slice(userEnd + "\n});\n\n".length)}`;
schema = schema.replace(drizzleImport, 'import { relations, sql } from "drizzle-orm";');
schema = schema.replace(pgCoreImport, 'import {\n  check,\n  pgTable,');

const header = `/**
 * Better-auth Drizzle schema — tables and relations.
 *
 * Generated via: pnpm run generate:auth-schema
 * Source of truth: Better Auth CLI output plus repository post-processing.
 *
 * DO NOT EDIT BY HAND. Re-run packages/lib/scripts/generate-auth-schema.sh
 * after changing Better Auth configuration or repository schema constraints.
 */
`;

writeFileSync(outputPath, `${header}${schema}`);
console.log(`[postprocess-auth-schema] Written ${schema.split("\n").length + 8} lines to ${outputPath}`);
