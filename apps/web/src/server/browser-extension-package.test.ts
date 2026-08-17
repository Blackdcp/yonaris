import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";

const execute = promisify(execFile);
const packageScript = fileURLToPath(new URL("../../scripts/package-browser-extension.mjs", import.meta.url));
const roots: string[] = [];
const approvedFiles = [
	"background.js",
	"content-entry.js",
	"icon.svg",
	"manifest.json",
	"popup.css",
	"popup.html",
	"popup.js",
] as const;

afterEach(async () => {
	await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("Browser Runner extension package", () => {
	it("creates a reproducible ZIP and matching SHA-256 metadata from the exact reviewed files", async () => {
		const root = await createFixture();
		const source = join(root, "dist");
		const firstOutput = join(root, "first");
		const secondOutput = join(root, "second");

		await runPackager(source, firstOutput);
		await runPackager(source, secondOutput);

		const firstZip = await readFile(join(firstOutput, "yonaris-browser-extension.zip"));
		const secondZip = await readFile(join(secondOutput, "yonaris-browser-extension.zip"));
		const metadata = JSON.parse(await readFile(join(firstOutput, "yonaris-browser-extension.json"), "utf8")) as Record<
			string,
			unknown
		>;
		const expectedSha256 = createHash("sha256").update(firstZip).digest("hex");

		expect(firstZip.equals(secondZip)).toBe(true);
		expect(firstZip.subarray(0, 4).toString("hex")).toBe("504b0304");
		expect(metadata).toEqual({
			fileName: "yonaris-browser-extension.zip",
			sha256: expectedSha256,
			version: "0.1.0",
		});
	});

	it("rejects an extension build with a missing reviewed file", async () => {
		const root = await createFixture();
		const source = join(root, "dist");
		await rm(join(source, "popup.js"));

		await expect(runPackager(source, join(root, "output"))).rejects.toThrow(/missing.*popup\.js/i);
	});

	it("rejects an extension build containing an unexpected file", async () => {
		const root = await createFixture();
		const source = join(root, "dist");
		await writeFile(join(source, "debug.js"), "not reviewed", "utf8");

		await expect(runPackager(source, join(root, "output"))).rejects.toThrow(/unexpected.*debug\.js/i);
	});
});

async function createFixture(): Promise<string> {
	const root = await mkdtemp(join(tmpdir(), "yonaris-extension-package-"));
	roots.push(root);
	const source = join(root, "dist");
	await mkdir(source, { recursive: true });
	for (const fileName of approvedFiles) {
		const contents =
			fileName === "manifest.json"
				? JSON.stringify({ manifest_version: 3, name: "Yonaris Browser Runner", version: "0.1.0" })
				: `${fileName}\n`;
		await writeFile(join(source, fileName), contents, "utf8");
	}
	return root;
}

async function runPackager(source: string, output: string): Promise<void> {
	await execute(process.execPath, [packageScript, "--source", source, "--output-dir", output], {
		windowsHide: true,
	});
}
