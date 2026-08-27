import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => readFileSync(path.join(repositoryRoot, file), "utf8");
const fixtures = await import(pathToFileURL(path.join(repositoryRoot, "e2e/fixtures.ts")).href);

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

test("opportunity fixtures pin two language variants to one Program and byte-identical raw evidence", () => {
	assert.deepEqual(fixtures.LANGUAGE_SMOKE_OPPORTUNITY_EVIDENCE, {
		brand: "Language Smoke 原始品牌",
		competitor: "原始竞品 / Raw Rival",
		prompt: {
			id: "00000000-0000-4000-8000-710000000011",
			text: "适合家庭出游的新能源 SUV",
		},
		yourCitation: {
			title: "Language Smoke 原始品牌 / Raw Brand Evidence",
			domain: "language-smoke.example.cn",
			url: "https://language-smoke.example.cn/raw?market=CN",
		},
		competitorCitation: {
			title: "原始竞品 / Raw Rival",
			domain: "raw-rival.example",
			url: "https://raw-rival.example/evidence?source=language-smoke#unchanged",
		},
	});

	const english = fixtures.LANGUAGE_SMOKE_OPPORTUNITIES?.en;
	const chinese = fixtures.LANGUAGE_SMOKE_OPPORTUNITIES?.["zh-CN"];
	assert.deepEqual(
		[english?.id, chinese?.id],
		["00000000-0000-4000-8000-720000000001", "00000000-0000-4000-8000-720000000002"],
	);
	assert.deepEqual([english?.createdAt, chinese?.createdAt], ["2026-08-20T08:00:00.000Z", "2026-08-20T08:01:00.000Z"]);
	assert.deepEqual([english?.outputLanguage, chinese?.outputLanguage], ["en", "zh-CN"]);
	assert.deepEqual([english?.model, chinese?.model], ["e2e-fixed-opportunity", "e2e-fixed-opportunity"]);
	assert.equal(english?.scopeId, "00000000-0000-4000-8000-710000000001");
	assert.equal(chinese?.scopeId, english?.scopeId);
	assert.notEqual(fixtures.LANGUAGE_SMOKE_SCOPES.en.id, english?.scopeId);

	for (const variant of [english, chinese]) {
		assert.equal(variant?.brandId, fixtures.LANGUAGE_SMOKE_BRAND_ID);
		assert.deepEqual(variant?.report.opportunities[0].relatedPrompts, [
			{
				promptId: "00000000-0000-4000-8000-710000000011",
				text: "适合家庭出游的新能源 SUV",
			},
		]);
		assert.deepEqual(variant?.report.opportunities[0].yourCitations, [
			{
				title: "Language Smoke 原始品牌 / Raw Brand Evidence",
				domain: "language-smoke.example.cn",
				url: "https://language-smoke.example.cn/raw?market=CN",
			},
		]);
		assert.deepEqual(variant?.report.opportunities[0].competitorCitations, [
			{
				title: "原始竞品 / Raw Rival",
				domain: "raw-rival.example",
				url: "https://raw-rival.example/evidence?source=language-smoke#unchanged",
			},
		]);
	}

	assert.deepEqual(
		{
			summary: english?.report.summary,
			title: english?.report.opportunities[0].title,
			why: english?.report.opportunities[0].why,
			risks: english?.report.risks,
		},
		{
			summary: ["English model summary: earn trusted third-party coverage."],
			title: "English model opportunity: win the family EV comparison",
			why: "English model rationale: trusted citations can improve answer presence.",
			risks: ["English model risk: editorial placements are not guaranteed."],
		},
	);
	assert.deepEqual(
		{
			summary: chinese?.report.summary,
			title: chinese?.report.opportunities[0].title,
			why: chinese?.report.opportunities[0].why,
			risks: chinese?.report.risks,
		},
		{
			summary: ["中文模型摘要：争取可信的第三方内容收录。"],
			title: "中文模型机会：进入家庭新能源车对比内容",
			why: "中文模型理由：可信引用有助于提升品牌在 AI 回答中的呈现。",
			risks: ["中文模型风险：编辑收录无法保证。"],
		},
	);
	assert.equal(
		fixtures.LANGUAGE_SMOKE_OPPORTUNITY_STORAGE_KEY,
		"yonaris:artifact-output-language:v1:opportunities-customer:portal-language-e2e:00000000-0000-4000-8000-710000000001",
	);
});

test("opportunity seed resets the table and inserts only deterministic columns and values", () => {
	const source = read("e2e/seed.ts");
	assert.match(source, /TRUNCATE TABLE[\s\S]*?brand_opportunities,[\s\S]*?brands/u);
	assert.equal(source.match(/INSERT INTO brand_opportunities/gu)?.length, 1);
	const insert = source.match(
		/INSERT INTO brand_opportunities[\s\S]*?\(id, brand_id, scope_id, output_language, report, model, created_at\)[\s\S]*?VALUES\s*\(\$1, \$2, \$3, \$4, \$5::json, \$6, \$7::timestamptz\),\s*\(\$8, \$9, \$10, \$11, \$12::json, \$13, \$14::timestamptz\)/u,
	)?.[0];
	assert.ok(insert, "missing the exact deterministic two-row brand_opportunities insert");
	assert.doesNotMatch(insert, /NOW\(|gen_random_uuid/u);
	assert.match(source, /LANGUAGE_SMOKE_OPPORTUNITIES\["zh-CN"\]/u);
});

test("opportunity browser smoke covers the four independent language combinations and read-only empty state", () => {
	const source = read("e2e/tests/portal-language.spec.ts");
	for (const combination of [
		'{ uiLanguage: "en", artifactLanguage: "en" }',
		'{ uiLanguage: "zh-CN", artifactLanguage: "en" }',
		'{ uiLanguage: "zh-CN", artifactLanguage: "zh-CN" }',
		'{ uiLanguage: "en", artifactLanguage: "zh-CN" }',
	]) {
		assert.equal(source.includes(combination), true, `missing Opportunity language combination: ${combination}`);
	}
	assert.match(source, /sessionStorage\.getItem\(key\)/u);
	assert.match(source, /data-slot="opportunities-report"/u);
	assert.match(source, /toHaveAttribute\("lang", artifactLanguage\)/u);
	assert.match(source, /staticCopy\.yourCitations/u);
	assert.match(source, /LANGUAGE_SMOKE_OPPORTUNITY_EVIDENCE\.yourCitation/u);
	assert.match(source, /LANGUAGE_SMOKE_OPPORTUNITY_EVIDENCE\.competitorCitation/u);
	assert.match(source, /request\.method\(\) === "POST"/u);
	assert.match(source, /sameOriginPosts/u);
	assert.match(source, /toHaveLength\(0\)/u);
	assert.match(source, /waitForResponse/u);
	assert.match(source, /responseBody\.includes\("not_generated"\)/u);
	assert.match(source, /responseBody\.includes\("zh-CN"\)/u);
	assert.match(source, /ensureUiLanguage/u);
	assert.match(source, /finally/u);
});

test("scheduled language smoke keeps Chinese writes off and provider work stubbed", () => {
	const workflow = read(".github/workflows/e2e.yaml");
	assert.match(workflow, /'ARTIFACT_ZH_CN_ENABLED=false'/u);
	assert.match(workflow, /'ONBOARDING_LLM_TARGET=stub:stub'/u);
});

test("Opportunity selection ships as the exact web patch changeset", () => {
	assert.equal(
		read(".changeset/select-opportunity-output-language.md"),
		'---\n"@workspace/web": patch\n---\n\nLet Portal users independently select English or Simplified Chinese for Opportunity generation and viewing while preserving raw evidence.\n',
	);
});
