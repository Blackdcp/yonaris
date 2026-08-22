import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { findSiteRoute } from "../src/lib/site-manifest";

const DEFAULT_ROUTES_ROOT = fileURLToPath(new URL("../src/routes/", import.meta.url));
const FILE_ROUTE_PATTERN = /createFileRoute\(\s*["'`]([^"'`]+)["'`]\s*\)/g;

async function listRouteFiles(directory: string): Promise<string[]> {
	const entries = await readdir(directory, { withFileTypes: true });
	const files = await Promise.all(
		entries.map((entry) => {
			const entryPath = path.join(directory, entry.name);
			return entry.isDirectory() ? listRouteFiles(entryPath) : Promise.resolve([entryPath]);
		}),
	);
	return files.flat().filter((file) => /\.[cm]?[jt]sx?$/.test(file));
}

export function normalizeFileRoutePattern(routePath: string): `/${string}` {
	const normalized = routePath
		.split("/")
		.map((segment) => (segment.startsWith("$") ? "*" : segment))
		.join("/");
	const withoutTrailingSlash = normalized === "/" ? normalized : normalized.replace(/\/+$/, "");
	return withoutTrailingSlash as `/${string}`;
}

export async function discoverRoutePatterns(routesRoot = DEFAULT_ROUTES_ROOT): Promise<`/${string}`[]> {
	const patterns = new Set<`/${string}`>();
	for (const file of await listRouteFiles(routesRoot)) {
		const source = await readFile(file, "utf8");
		for (const match of source.matchAll(FILE_ROUTE_PATTERN)) {
			patterns.add(normalizeFileRoutePattern(match[1]));
		}
	}
	return [...patterns].sort();
}

export async function auditSiteManifest(routesRoot = DEFAULT_ROUTES_ROOT): Promise<`/${string}`[]> {
	const patterns = await discoverRoutePatterns(routesRoot);
	return patterns.filter((pattern) => !findSiteRoute(pattern));
}

async function main(): Promise<void> {
	const unclassified = await auditSiteManifest();
	if (unclassified.length > 0) {
		console.error(`Unclassified public route patterns:\n${unclassified.map((pattern) => `- ${pattern}`).join("\n")}`);
		process.exitCode = 1;
		return;
	}
	console.log("All public route patterns are classified.");
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : undefined;
if (invokedPath === import.meta.url) {
	await main();
}
