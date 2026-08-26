import { spawn, spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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

function bashBinary(): string {
	return process.platform === "win32" ? "C:\\Program Files\\Git\\bin\\bash.exe" : "bash";
}

function shellPath(path: string): string {
	return path.replaceAll("\\", "/");
}

function runGenerator(script: string, env: NodeJS.ProcessEnv): Promise<{ status: number | null; output: string }> {
	return new Promise((resolveResult) => {
		const child = spawn(bashBinary(), [script], { cwd: process.cwd(), env: { ...process.env, ...env } });
		let output = "";
		child.stdout.on("data", (chunk) => (output += chunk));
		child.stderr.on("data", (chunk) => (output += chunk));
		child.on("close", (status) => resolveResult({ status, output }));
	});
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
				'uiLanguageSupported: check("user_ui_language_supported", sql`' +
					"$" +
					"{table.uiLanguage}" +
					" IN ('en', 'zh-CN')`),",
			);
			expect(first.output).toContain("Source of truth: Better Auth CLI output plus repository post-processing.");
			expect(first.output).toContain('} from "drizzle-orm/pg-core";\n\nexport const user = pgTable(\n  "user",\n  {');
			expect(first.output).not.toContain("drizzle-oexport");
			expect(generator).toContain('node "$SCRIPT_DIR/postprocess-auth-schema.mjs" "$CLI_OUTPUT" "$PROCESSED_OUTPUT"');
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

	it("pins the compatible CLI and invokes only the package-local binary", () => {
		const packageJson = JSON.parse(readFileSync(resolve(process.cwd(), "package.json"), "utf8")) as {
			devDependencies?: Record<string, string>;
		};
		const generator = readFileSync(resolve(process.cwd(), "scripts/generate-auth-schema.sh"), "utf8");

		expect(packageJson.devDependencies?.["@better-auth/cli"]).toBe("1.4.21");
		expect(generator).toContain('"$PNPM_BIN" exec better-auth generate');
		expect(generator).toContain("--yes");
		expect(generator).not.toContain("npx");
		expect(generator).not.toContain("_cli-helper.ts");
	});

	it("uses isolated temporary files and publishes postprocessed output atomically", async () => {
		const generatorPath = resolve(process.cwd(), "scripts/generate-auth-schema.sh");
		const generator = readFileSync(generatorPath, "utf8");
		expect(generator).toContain("mktemp -d");
		expect(generator).toContain('mv -f "$PROCESSED_OUTPUT" "$OUTPUT"');

		const directory = mkdtempSync(resolve(process.cwd(), ".auth-generator-test-"));
		const fixture = resolve(directory, "fixture.ts");
		const output = resolve(directory, "schema-auth.ts");
		const log = resolve(directory, "cli.log");
		const fakePnpm = resolve(directory, "pnpm");
		writeFileSync(fixture, cliSchema);
		writeFileSync(
			fakePnpm,
			`#!/usr/bin/env bash
set -euo pipefail
printf '%s\\n' "$*" >> "$AUTH_SCHEMA_TEST_LOG"
if [ "\${AUTH_SCHEMA_FAKE_FAIL:-}" = "1" ]; then exit 42; fi
output=""
config=""
while [ "$#" -gt 0 ]; do
  if [ "$1" = "--output" ]; then output="$2"; shift 2
  elif [ "$1" = "--config" ]; then config="$2"; shift 2
  else shift
  fi
done
grep -q 'src/auth/server' "$config"
if grep -q '\\\\' "$config"; then exit 43; fi
cp "$AUTH_SCHEMA_TEST_FIXTURE" "$output"
`,
		);
		chmodSync(fakePnpm, 0o755);

		const env = {
			AUTH_SCHEMA_OUTPUT: shellPath(output),
			AUTH_SCHEMA_TMP_ROOT: shellPath(directory),
			AUTH_SCHEMA_TEST_FIXTURE: shellPath(fixture),
			AUTH_SCHEMA_TEST_LOG: shellPath(log),
			PNPM_BIN: shellPath(fakePnpm),
		};

		try {
			const runs = await Promise.all([runGenerator(generatorPath, env), runGenerator(generatorPath, env)]);
			expect(
				runs.map((run) => run.status),
				runs.map((run) => run.output).join("\n---\n"),
			).toEqual([0, 0]);
			expect(readFileSync(output, "utf8")).toContain("user_ui_language_supported");
			const configs = readFileSync(log, "utf8")
				.trim()
				.split("\n")
				.map((line) => /--config ([^ ]+)/.exec(line)?.[1]);
			expect(configs).toHaveLength(2);
			expect(new Set(configs).size).toBe(2);
			expect(readdirSync(directory).filter((name) => name.startsWith(".yonaris-auth-schema."))).toEqual([]);

			writeFileSync(output, "sentinel\n");
			const failed = await runGenerator(generatorPath, { ...env, AUTH_SCHEMA_FAKE_FAIL: "1" });
			expect(failed.status).toBe(42);
			expect(readFileSync(output, "utf8")).toBe("sentinel\n");
			expect(readdirSync(directory).filter((name) => name.startsWith(".yonaris-auth-schema."))).toEqual([]);
		} finally {
			rmSync(directory, { force: true, recursive: true });
		}
	});
});
