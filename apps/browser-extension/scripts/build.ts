import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { build } from "esbuild";

const root = resolve(import.meta.dirname, "..");
const output = resolve(root, "dist");

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await build({
	absWorkingDir: root,
	entryPoints: ["src/background.ts", "src/popup.ts"],
	outdir: output,
	bundle: true,
	format: "iife",
	platform: "browser",
	target: "chrome120",
	minify: true,
	sourcemap: false,
	legalComments: "none",
});
await Promise.all([
	cp(resolve(root, "src/popup.html"), resolve(output, "popup.html")),
	cp(resolve(root, "src/popup.css"), resolve(output, "popup.css")),
	copyManifest(),
]);

async function copyManifest(): Promise<void> {
	const manifest = JSON.parse(await readFile(resolve(root, "manifest.json"), "utf8")) as Record<string, unknown>;
	await writeFile(resolve(output, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}
