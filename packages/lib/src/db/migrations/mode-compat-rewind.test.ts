import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function extractStepScript(workflow: string, stepName: string): string {
	const normalized = workflow.replaceAll("\r\n", "\n");
	const stepMarker = `      - name: ${stepName}\n`;
	const stepStart = normalized.indexOf(stepMarker);
	if (stepStart === -1) throw new Error(`Expected workflow step: ${stepName}`);
	const nextStep = normalized.indexOf("\n      - name: ", stepStart + stepMarker.length);
	const step = normalized.slice(stepStart, nextStep === -1 ? undefined : nextStep);
	const runMarker = "        run: |\n";
	const runStart = step.indexOf(runMarker);
	if (runStart === -1) throw new Error(`Expected multiline run script for workflow step: ${stepName}`);
	return step
		.slice(runStart + runMarker.length)
		.split("\n")
		.map((line) => (line.startsWith("          ") ? line.slice(10) : line))
		.join("\n")
		.trimEnd();
}

function extractSqlHeredoc(script: string): { sql: string; end: number } {
	const startMarker = "<<'SQL'\n";
	const start = script.indexOf(startMarker);
	if (start === -1) throw new Error("Expected SQL heredoc start");
	const bodyStart = start + startMarker.length;
	const end = script.indexOf("\nSQL\n", bodyStart);
	if (end === -1) throw new Error("Expected SQL heredoc end");
	return { sql: script.slice(bodyStart, end), end: end + "\nSQL\n".length };
}

function extractDeletedMigrationTimestamps(sql: string): number[] {
	return [...sql.matchAll(/DELETE FROM drizzle\.__drizzle_migrations\s+WHERE created_at IN \(([^)]+)\);/g)].flatMap(
		([, values]) =>
			values.split(",").map((value) => {
				const timestamp = Number(value.trim());
				if (!Number.isSafeInteger(timestamp)) throw new Error(`Invalid migration timestamp: ${value}`);
				return timestamp;
			}),
	);
}

function satisfiesPrecedencePairs(source: string, pairs: ReadonlyArray<readonly [string, string]>): boolean {
	return pairs.every(([before, after]) => {
		const beforeIndex = source.indexOf(before);
		const afterIndex = source.indexOf(after);
		return beforeIndex !== -1 && afterIndex > beforeIndex;
	});
}

function containsAll(source: string, fragments: readonly string[]): boolean {
	return fragments.every((fragment) => source.includes(fragment));
}

describe("mode compatibility migration rewind", () => {
	it("removes every post-0021 schema object before replaying migrations", () => {
		const repositoryRoot = resolve(process.cwd(), "../..");
		const workflow = readFileSync(resolve(repositoryRoot, ".github/workflows/mode-compat.yaml"), "utf8");
		const journal = JSON.parse(
			readFileSync(resolve(repositoryRoot, "packages/lib/src/db/migrations/meta/_journal.json"), "utf8"),
		) as { entries: Array<{ idx: number; when: number; tag: string }> };
		const post0021 = journal.entries.filter(({ idx }) => idx > 21);
		const rewindScript = extractStepScript(workflow, "Rewind seeded database to 0021");
		const replayScript = extractStepScript(
			workflow,
			"Upgrade seeded 0021 data to latest without changing Yonaris inputs",
		);
		const rewind = extractSqlHeredoc(rewindScript);

		expect(post0021.map(({ tag }) => tag)).toEqual([
			"0022_response_snapshot_archive",
			"0023_browser_extension_devices",
			"0024_overseas_run_now",
			"0025_workable_whizzer",
			"0026_cancel_empty_legacy_default",
			"0027_response_snapshot_visual_evidence",
			"0028_browser_runner_six_surfaces",
			"0029_browser_runner_zhipu_surface",
			"0030_overseas_dataforseo_provider",
			"0031_user_ui_language",
			"0032_artifact_output_languages",
		]);
		expect(journal.entries).toHaveLength(33);

		const opportunityIndex = "DROP INDEX public.brand_opportunities_brand_scope_language_created_at_idx;";
		const opportunityCheck =
			"ALTER TABLE public.brand_opportunities DROP CONSTRAINT brand_opportunities_output_language_supported;";
		const opportunityColumn = "ALTER TABLE public.brand_opportunities DROP COLUMN output_language;";
		const reportCheck = "ALTER TABLE public.reports DROP CONSTRAINT reports_output_language_supported;";
		const reportColumn = "ALTER TABLE public.reports DROP COLUMN output_language;";
		const scopeForeignKey =
			"ALTER TABLE public.brand_opportunities DROP CONSTRAINT brand_opportunities_scope_fk;";
		const scopeColumn = "ALTER TABLE public.brand_opportunities DROP COLUMN scope_id;";
		const rollbackPrecedence = [
			[opportunityIndex, opportunityColumn],
			[opportunityIndex, scopeColumn],
			[opportunityCheck, opportunityColumn],
			[reportCheck, reportColumn],
			[scopeForeignKey, scopeColumn],
		] as const;
		const requiredRewindStatements = [
			"DROP TABLE public.overseas_run_calls;",
			"DROP TABLE public.overseas_run_cohorts;",
			"DROP TYPE public.overseas_run_call_status;",
			"DROP TYPE public.overseas_run_cohort_status;",
			opportunityIndex,
			opportunityCheck,
			opportunityColumn,
			reportCheck,
			reportColumn,
			'ALTER TABLE public."user" DROP CONSTRAINT user_ui_language_supported;',
			'ALTER TABLE public."user" DROP COLUMN ui_language;',
			scopeForeignKey,
			scopeColumn,
			"CREATE INDEX brand_opportunities_brand_id_created_at_idx",
		] as const;
		for (const statement of requiredRewindStatements) expect(rewind.sql).toContain(statement);
		for (const missingStatement of requiredRewindStatements) {
			const deletionMutation = rewind.sql.replace(missingStatement, "");
			expect(containsAll(deletionMutation, requiredRewindStatements)).toBe(false);
		}
		const mutatedRewind = rewind.sql.replace(
			`${opportunityIndex}\n${opportunityCheck}\n${opportunityColumn}`,
			`${opportunityColumn}\n${opportunityIndex}\n${opportunityCheck}`,
		);
		for (const statement of requiredRewindStatements) expect(mutatedRewind).toContain(statement);
		expect(satisfiesPrecedencePairs(mutatedRewind, rollbackPrecedence)).toBe(false);
		expect(satisfiesPrecedencePairs(rewind.sql, rollbackPrecedence)).toBe(true);

		expect(extractDeletedMigrationTimestamps(rewind.sql)).toEqual(post0021.map(({ when }) => when));
		expect(rewind.sql).not.toContain("DROP INDEX public.brand_opportunities_brand_scope_created_at_idx;");

		const rewindCount = rewindScript.indexOf(')" = "22"');
		expect(rewindCount).toBeGreaterThan(rewind.end);
		expect(rewindScript).not.toContain(')" = "33"');
		const replayLoopEnd = replayScript.lastIndexOf("\ndone\n");
		expect(replayLoopEnd).toBeGreaterThan(-1);
		expect(replayScript.indexOf(`)" = "${journal.entries.length}"`)).toBeGreaterThan(replayLoopEnd);
		expect(replayScript).not.toContain(')" = "22"');
	});
});
