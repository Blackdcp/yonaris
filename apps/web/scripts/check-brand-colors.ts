#!/usr/bin/env tsx
import { readdirSync, readFileSync } from "node:fs";
import { extname, relative, resolve } from "node:path";

const SOURCE_ROOT = resolve(import.meta.dirname, "../src");
const RUNTIME_EXTENSIONS = new Set([".ts", ".tsx", ".css"]);
const EXCLUDED_PATHS = ["brand/yonaris.css", "lib/domain-categories.ts", "stories/", "test/", "__tests__/"];
const DISALLOWED_DECORATIVE_UTILITIES =
	/\b(?:text|bg|border|ring|fill|stroke)-(?:blue|indigo|violet|purple|pink|cyan|teal)-\d{2,3}(?:\/\d+)?\b/g;
const LEGACY_DECORATIVE_HEX = /#(?:2563eb|3b82f6|8b5cf6|a463f2|ff8ab7|36b39a|79a8e8|11a8cd|b279a2)\b/gi;
const THIRD_PARTY_COLOR_FILES = new Set(["components/progress-bar-chart.tsx"]);

function sourceFiles(directory: string): string[] {
	return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		const path = resolve(directory, entry.name);
		if (entry.isDirectory()) return sourceFiles(path);
		return RUNTIME_EXTENSIONS.has(extname(entry.name)) ? [path] : [];
	});
}

const violations = sourceFiles(SOURCE_ROOT).flatMap((file) => {
	const localPath = relative(SOURCE_ROOT, file).replaceAll("\\", "/");
	if (EXCLUDED_PATHS.some((excluded) => localPath === excluded || localPath.includes(excluded))) return [];

	return readFileSync(file, "utf8")
		.split(/\r?\n/)
		.flatMap((line, index) => {
			const matches = [
				...line.matchAll(DISALLOWED_DECORATIVE_UTILITIES),
				...(THIRD_PARTY_COLOR_FILES.has(localPath) ? [] : line.matchAll(LEGACY_DECORATIVE_HEX)),
			];
			return matches.map((match) => `${localPath}:${index + 1} ${match[0]}`);
		});
});

if (violations.length > 0) {
	console.error("Non-brand decorative color utilities found:\n");
	console.error(violations.join("\n"));
	console.error("\nUse Yonaris tokens, or document a semantic/third-party exception in this check.");
	process.exitCode = 1;
} else {
	console.log("Yonaris runtime color policy passed.");
}
