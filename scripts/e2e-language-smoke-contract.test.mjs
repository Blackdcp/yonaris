import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => readFileSync(path.join(repositoryRoot, file), "utf8");

test("normal local and CI fixture phases schedule the isolated language smoke project", () => {
	const packageJson = JSON.parse(read("e2e/package.json"));
	assert.match(packageJson.scripts["test:e2e"], /--project=fixtures\s+--project=language-smoke/u);
	assert.match(read(".github/workflows/e2e.yaml"), /playwright test --project=fixtures --project=language-smoke/u);
	const config = read("e2e/playwright.config.ts");
	assert.match(config, /name:\s*"language-smoke"/u);
	assert.match(config, /testMatch:\s*\/portal-language\\\.spec\\\.tsx?\//u);
	assert.match(config, /outputDir:\s*"test-results-language-smoke"/u);
	assert.match(config, /workers:\s*1/u);
	assert.match(config, /storageState:\s*LANGUAGE_SMOKE_AUTH_STATE_PATH/u);
});

test("language auth setup resets and verifies the persisted validated preference", () => {
	const source = read("e2e/language-auth-setup.ts");
	assert.match(source, /SET role = 'admin', ui_language = 'en'/u);
	assert.match(source, /session\.user\?\.uiLanguage !== "en"/u);
});

test("query smoke preserves auto-expansion and asserts exact bilingual terminology", () => {
	const source = read("e2e/tests/portal-language.spec.ts");
	assert.match(source, /getAttribute\("aria-expanded"\)\) === "false"/u);
	for (const copy of [
		"AI 检索脉络",
		"检索路径",
		"衍生检索词",
		"查看 AI 为回答当前问题而展开的实际联网搜索词。",
		"Query Fan-Out",
		"Search Paths",
		"Derived Queries",
		"When an AI engine with web search capabilities responds to a prompt, it may choose to make a number of web searches before creating its answer. These underlying web searches, presented here as derived queries, are only available for some engines.",
	]) {
		assert.equal(source.includes(copy), true, `missing exact Query Fan-Out assertion: ${copy}`);
	}
});
