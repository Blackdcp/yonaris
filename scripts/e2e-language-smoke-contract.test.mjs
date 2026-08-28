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

test("report fixtures pin persisted English and Chinese rows to byte-identical raw evidence", () => {
	assert.deepEqual(fixtures.LANGUAGE_SMOKE_REPORT_EVIDENCE, {
		brand: "Test Organization",
		competitor: "原始竞品 / Raw Rival",
		prompt: {
			id: "00000000-0000-4000-8000-730000000001",
			text: "原始 Prompt / Raw Prompt 01",
		},
		query: "原始检索词 / Raw Query 01",
		answer: "原始回答 / Raw answer 01",
		citation: {
			title: "原始证据 / Raw Evidence",
			domain: "raw-evidence.example",
			url: "https://raw-evidence.example/report?source=language-smoke#unchanged",
		},
	});

	const english = fixtures.LANGUAGE_SMOKE_REPORTS?.en;
	const chinese = fixtures.LANGUAGE_SMOKE_REPORTS?.["zh-CN"];
	assert.deepEqual(
		[english?.id, chinese?.id],
		["00000000-0000-0000-0000-300000000001", "00000000-0000-0000-0000-300000000005"],
	);
	assert.deepEqual([english?.outputLanguage, chinese?.outputLanguage], ["en", "zh-CN"]);
	assert.deepEqual([english?.createdAt, chinese?.createdAt], ["2026-08-20T09:00:00.000Z", "2026-08-20T09:01:00.000Z"]);
	assert.equal(english?.brandName, fixtures.LANGUAGE_SMOKE_REPORT_EVIDENCE.brand);
	assert.equal(chinese?.brandName, english?.brandName);
	assert.equal(chinese?.brandWebsite, english?.brandWebsite);

	const rawOutput = fixtures.LANGUAGE_SMOKE_REPORT_RAW_OUTPUT;
	assert.equal(rawOutput?.prompts[0].value, fixtures.LANGUAGE_SMOKE_REPORT_EVIDENCE.prompt.text);
	assert.equal(rawOutput?.promptRuns[0].promptValue, fixtures.LANGUAGE_SMOKE_REPORT_EVIDENCE.prompt.text);
	assert.deepEqual(rawOutput?.promptRuns[0].runs[0], {
		model: "e2e-raw-model",
		version: "e2e-fixed-report",
		webSearchEnabled: true,
		rawOutput: {
			promptId: "00000000-0000-4000-8000-730000000001",
			citation: {
				title: "原始证据 / Raw Evidence",
				domain: "raw-evidence.example",
				url: "https://raw-evidence.example/report?source=language-smoke#unchanged",
			},
		},
		webQueries: ["原始检索词 / Raw Query 01"],
		textContent: "原始回答 / Raw answer 01",
		brandMentioned: true,
		competitorsMentioned: ["原始竞品 / Raw Rival"],
	});
	assert.equal(
		fixtures.LANGUAGE_SMOKE_REPORT_STORAGE_KEY,
		"yonaris:artifact-output-language:v1:report-create",
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

test("report seed inserts the two persisted language rows with deterministic SQL", () => {
	const source = read("e2e/seed.ts");
	assert.match(source, /TRUNCATE TABLE[\s\S]*?reports,[\s\S]*?brands/u);
	const insert = source.match(
		/INSERT INTO reports[\s\S]*?\(id, brand_name, brand_website, status, progress, output_language, raw_output,[\s\S]*?created_at, completed_at, updated_at\)[\s\S]*?VALUES\s*\(\$1, \$2, \$3, 'completed', 100, \$4, \$5::json, \$6::timestamptz,[\s\S]*?\$6::timestamptz, \$6::timestamptz\),\s*\(\$7, \$8, \$9, 'completed', 100, \$10, \$11::json, \$12::timestamptz,[\s\S]*?\$12::timestamptz, \$12::timestamptz\)/u,
	)?.[0];
	assert.ok(insert, "missing the exact deterministic two-row report language insert");
	assert.doesNotMatch(insert, /NOW\(|gen_random_uuid/u);
	assert.match(source, /LANGUAGE_SMOKE_REPORTS\["zh-CN"\]/u);
	assert.equal(source.match(/JSON\.stringify\(LANGUAGE_SMOKE_REPORT_RAW_OUTPUT\)/gu)?.length, 2);
});

test("Bruno report contracts cover legacy default, explicit values, the write gate, and persisted reads", () => {
	const legacyCreate = read("e2e/bruno/reports/create report.bru");
	const legacyBody = legacyCreate.match(/body:json \{[\s\S]*?\n\}/u)?.[0];
	assert.ok(legacyBody, "missing legacy report request body");
	assert.doesNotMatch(legacyBody, /outputLanguage/u);
	assert.match(legacyCreate, /res\.body\.outputLanguage: eq en/u);

	const explicitEnglish = read("e2e/bruno/reports/create report explicit English.bru");
	assert.match(explicitEnglish, /"outputLanguage": "en"/u);
	assert.match(explicitEnglish, /res\.body\.outputLanguage: eq en/u);

	const disabledChinese = read("e2e/bruno/reports/create report Simplified Chinese disabled 503.bru");
	assert.match(disabledChinese, /"outputLanguage": "zh-CN"/u);
	assert.match(disabledChinese, /res\.status: eq 503/u);
	assert.match(disabledChinese, /res\.body\.code: eq report-output-language-temporarily-unavailable/u);

	for (const invalid of ["zh", "CN", "zh-SG"]) {
		const source = read(`e2e/bruno/reports/create report invalid ${invalid} 400.bru`);
		assert.equal(source.includes(`"outputLanguage": "${invalid}"`), true);
		assert.match(source, /res\.status: eq 400/u);
	}

	const rejectedRead = read("e2e/bruno/reports/list reports after rejected Chinese create.bru");
	for (const rejectedBrand of [
		"Bruno Rejected Chinese Report",
		"Bruno Invalid zh Report",
		"Bruno Invalid CN Report",
		"Bruno Invalid zh-SG Report",
	]) {
		assert.match(rejectedRead, new RegExp(rejectedBrand, "u"));
	}
	assert.match(rejectedRead, /const rejected = reports\.some\([\s\S]*?expect\(rejected,[\s\S]*?\.to\.equal\(false\)/u);

	const list = read("e2e/bruno/reports/list reports.bru");
	assert.match(list, /00000000-0000-0000-0000-300000000001[\s\S]*?outputLanguage", "en"/u);
	assert.match(list, /00000000-0000-0000-0000-300000000005[\s\S]*?outputLanguage", "zh-CN"/u);
	for (const [file, language] of [
		["e2e/bruno/reports/get completed report.bru", "en"],
		["e2e/bruno/reports/get completed Chinese report.bru", "zh-CN"],
	]) {
		const source = read(file);
		assert.match(source, new RegExp(`res\\.body\\.outputLanguage: eq ${language}`, "u"));
		assert.match(source, /res\.body\.prompts\[0\]\.promptValue: eq 原始 Prompt \/ Raw Prompt 01/u);
		assert.match(source, /res\.body\.prompts\[0\]\.mentions\.mentionsTopK\[0\]\.entity: eq 原始竞品 \/ Raw Rival/u);
	}
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

test("report browser smoke covers four independent UI and output-language combinations across reloads", () => {
	const source = read("e2e/tests/portal-language.spec.ts");
	for (const combination of [
		'{ uiLanguage: "en", artifactLanguage: "en", selector: "Output language" }',
		'{ uiLanguage: "en", artifactLanguage: "zh-CN", selector: "Output language" }',
		'{ uiLanguage: "zh-CN", artifactLanguage: "zh-CN", selector: "输出语言" }',
		'{ uiLanguage: "zh-CN", artifactLanguage: "en", selector: "输出语言" }',
	]) {
		assert.equal(source.includes(combination), true, `missing report language combination: ${combination}`);
	}
	assert.match(source, /LANGUAGE_SMOKE_REPORT_STORAGE_KEY/u);
	assert.match(source, /sessionStorage\.getItem\(key\)/u);
	assert.match(source, /reloadAndExpectReportLanguageCombination\(page, REPORT_LANGUAGE_COMBINATIONS\[1\]\)/u);
	assert.match(source, /reloadAndExpectReportLanguageCombination\(page, REPORT_LANGUAGE_COMBINATIONS\[3\]\)/u);
	assert.match(source, /toBeEnabled\(\)/u);
	assert.match(source, /toHaveAttribute\("lang", combination\.uiLanguage\)/u);
});

test("scheduled language smoke keeps Chinese writes off and provider work stubbed", () => {
	const workflow = read(".github/workflows/e2e.yaml");
	assert.match(workflow, /'ARTIFACT_ZH_CN_ENABLED=false'/u);
	assert.match(workflow, /'ONBOARDING_LLM_TARGET=stub:stub'/u);
});

test("Opportunity and report selection ship as the exact web patch changeset", () => {
	assert.equal(
		read(".changeset/select-opportunity-output-language.md"),
		'---\n"@workspace/web": patch\n---\n\nLet Portal users select English or Simplified Chinese for Opportunities, reports, and chart exports independently of the interface language, while generated artifacts preserve the chosen language and raw evidence.\n',
	);
});
