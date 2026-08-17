import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("mode compatibility migration rewind", () => {
	it("removes every post-0021 schema object before replaying migrations", () => {
		const repositoryRoot = resolve(process.cwd(), "../..");
		const workflow = readFileSync(resolve(repositoryRoot, ".github/workflows/mode-compat.yaml"), "utf8");
		const journal = JSON.parse(
			readFileSync(resolve(repositoryRoot, "packages/lib/src/db/migrations/meta/_journal.json"), "utf8"),
		) as { entries: Array<{ idx: number; when: number; tag: string }> };
		const post0021 = journal.entries.filter(({ idx }) => idx > 21);

		expect(post0021.map(({ tag }) => tag)).toEqual([
			"0022_response_snapshot_archive",
			"0023_browser_extension_devices",
			"0024_overseas_run_now",
		]);
		for (const migration of post0021) expect(workflow).toContain(String(migration.when));
		expect(workflow).toContain("DROP TABLE public.overseas_run_calls;");
		expect(workflow).toContain("DROP TABLE public.overseas_run_cohorts;");
		expect(workflow).toContain("DROP TYPE public.overseas_run_call_status;");
		expect(workflow).toContain("DROP TYPE public.overseas_run_cohort_status;");
		expect(workflow).toContain(`'select count(*) from drizzle.__drizzle_migrations;')" = "${journal.entries.length}"`);
	});
});
