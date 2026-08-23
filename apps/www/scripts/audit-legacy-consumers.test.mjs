import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, rm, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const scannerPath = fileURLToPath(new URL("./audit-legacy-consumers.mjs", import.meta.url));

function run(command, args, cwd) {
	const result = spawnSync(command, args, { cwd, encoding: "utf8" });
	if (result.error) throw result.error;
	return result;
}

function runGit(cwd, ...args) {
	const result = run("git", args, cwd);
	assert.equal(result.status, 0, `git ${args.join(" ")} failed:\n${result.stderr}`);
}

async function writeFixture(root, relativePath, source) {
	const target = path.join(root, ...relativePath.split("/"));
	await mkdir(path.dirname(target), { recursive: true });
	await writeFile(target, source, "utf8");
	return target;
}

async function fixtureRepository(t) {
	const root = await mkdtemp(path.join(tmpdir(), "yonaris-legacy-audit-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	runGit(root, "init", "--quiet");
	return root;
}

function runScanner(root) {
	const result = run(process.execPath, [scannerPath], root);
	return { ...result, output: `${result.stdout}${result.stderr}` };
}

test("reports an untracked production import with its normalized path and line", async (t) => {
	const root = await fixtureRepository(t);
	await writeFixture(
		root,
		"apps/www/src/untracked-consumer.tsx",
		[
			'import { MarketingDetailPage } from "@/components/marketing/detail-page";',
			'export { MarketingShell } from "./components/marketing/marketing-shell";',
		].join("\n"),
	);

	const result = runScanner(root);

	assert.equal(result.status, 1);
	assert.match(
		result.output,
		/apps\/www\/src\/untracked-consumer\.tsx:1 \[retired-import\].*components\/marketing\/detail-page/,
	);
	assert.match(
		result.output,
		/apps\/www\/src\/untracked-consumer\.tsx:2 \[retired-import\].*components\/marketing\/marketing-shell/,
	);
});

test("returns every violation in stable path, line, and rule order", async (t) => {
	const root = await fixtureRepository(t);
	await writeFixture(
		root,
		"apps/www/src/z-consumer.ts",
		[
			'import { marketingPageHead } from "@/lib/marketing-seo";',
			"const detail = MarketingDetailPage;",
			"const routes = MARKETING_ROUTES;",
		].join("\n"),
	);
	await writeFixture(root, "apps/www/src/a-consumer.ts", "const shell = MarketingShell;\n");

	const first = runScanner(root);
	const second = runScanner(root);

	assert.equal(first.status, 1);
	assert.equal(first.output, second.output);
	assert.match(first.output, /apps\/www\/src\/a-consumer\.ts:1 \[retired-identifier\] MarketingShell/);
	assert.match(first.output, /apps\/www\/src\/z-consumer\.ts:1 \[retired-import\].*lib\/marketing-seo/);
	assert.match(first.output, /apps\/www\/src\/z-consumer\.ts:1 \[retired-identifier\] marketingPageHead/);
	assert.match(first.output, /apps\/www\/src\/z-consumer\.ts:2 \[retired-identifier\] MarketingDetailPage/);
	assert.match(first.output, /apps\/www\/src\/z-consumer\.ts:3 \[retired-identifier\] MARKETING_ROUTES/);
	assert.ok(first.output.indexOf("a-consumer.ts") < first.output.indexOf("z-consumer.ts"));
	assert.doesNotMatch(first.output, /apps\\www\\src/);
});

test("rejects retired FAQ groups and the legacy localized-path helper", async (t) => {
	const root = await fixtureRepository(t);
	await writeFixture(
		root,
		"apps/www/src/untracked-legacy-symbols.ts",
		[
			"const home = HOME_FAQS;",
			"const pricing = PRICING_FAQS;",
			"const offsite = OFFSITE_FAQS;",
			"const localized = getLocalizedPath;",
		].join("\n"),
	);

	const result = runScanner(root);

	assert.equal(result.status, 1);
	assert.match(result.output, /untracked-legacy-symbols\.ts:1 \[retired-identifier\] HOME_FAQS/);
	assert.match(result.output, /untracked-legacy-symbols\.ts:2 \[retired-identifier\] PRICING_FAQS/);
	assert.match(result.output, /untracked-legacy-symbols\.ts:3 \[retired-identifier\] OFFSITE_FAQS/);
	assert.match(result.output, /untracked-legacy-symbols\.ts:4 \[retired-identifier\] getLocalizedPath/);
});

test("accepts only the corresponding legacy key in each approved redirect and excludes non-production fixtures", async (t) => {
	const root = await fixtureRepository(t);
	for (const [relativePath, key] of [
		["apps/www/src/routes/platform.tsx", "platform"],
		["apps/www/src/routes/zh/platform.tsx", "platform"],
		["apps/www/src/routes/methodology.tsx", "methodology"],
		["apps/www/src/routes/zh/methodology.tsx", "methodology"],
		["apps/www/src/routes/results.tsx", "results"],
		["apps/www/src/routes/zh/results.tsx", "results"],
	]) {
		await writeFixture(root, relativePath, `const redirectKey = "${key}";\n`);
	}
	await writeFixture(root, "apps/www/src/ignored.test.ts", "const detail = MarketingDetailPage;\n");
	await writeFixture(root, "apps/www/src/ignored.spec.tsx", "const routes = MARKETING_ROUTES;\n");
	await writeFixture(root, "apps/www/src/routeTree.gen.ts", "const shell = MarketingShell;\n");
	await writeFixture(root, "apps/www/src/not-production.js", "const shell = MarketingShell;\n");

	const result = runScanner(root);

	assert.equal(result.status, 0, result.output);
	assert.match(result.output, /no retired marketing consumers/i);
});

test("does not let a redirect key exemption hide another retired rule", async (t) => {
	const root = await fixtureRepository(t);
	await writeFixture(
		root,
		"apps/www/src/routes/platform.tsx",
		[
			'import { MarketingShell } from "@/components/marketing/marketing-shell";',
			'const redirectKey = "platform";',
			'const wrongKey = "results";',
		].join("\n"),
	);

	const result = runScanner(root);

	assert.equal(result.status, 1);
	assert.match(result.output, /routes\/platform\.tsx:1 \[retired-import\]/);
	assert.match(result.output, /routes\/platform\.tsx:1 \[retired-identifier\] MarketingShell/);
	assert.doesNotMatch(result.output, /\[retired-page-key\] platform/);
	assert.match(result.output, /routes\/platform\.tsx:3 \[retired-page-key\] results/);
});

test("rejects a retired source definition even without an inbound consumer", async (t) => {
	const root = await fixtureRepository(t);
	await writeFixture(root, "apps/www/src/components/marketing/detail-page.tsx", "export const retired = true;\n");

	const result = runScanner(root);

	assert.equal(result.status, 1);
	assert.match(result.output, /apps\/www\/src\/components\/marketing\/detail-page\.tsx:1 \[retired-source\]/);
});

test("skips cached paths that have already been deleted from the working tree", async (t) => {
	const root = await fixtureRepository(t);
	const retired = await writeFixture(
		root,
		"apps/www/src/components/marketing/detail-page.tsx",
		"export const retired = true;\n",
	);
	runGit(root, "add", "apps/www/src/components/marketing/detail-page.tsx");
	await unlink(retired);

	const result = runScanner(root);

	assert.equal(result.status, 0, result.output);
	assert.match(result.output, /no retired marketing consumers/i);
});
