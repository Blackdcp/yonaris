import { createHash, randomUUID } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { pipeline } from "node:stream/promises";
import { ZipArchive } from "archiver";

const APPROVED_FILES = [
	"background.js",
	"content-entry.js",
	"icon.svg",
	"manifest.json",
	"popup.css",
	"popup.html",
	"popup.js",
];
const FILE_NAME = "yonaris-browser-extension.zip";
const METADATA_NAME = "yonaris-browser-extension.json";
const ZIP_TIMESTAMP = new Date("1980-01-01T00:00:00.000Z");

async function main() {
	const options = parseArguments(process.argv.slice(2));
	await packageBrowserExtension(options);
}

export async function packageBrowserExtension({ source, outputDirectory }) {
	const sourceDirectory = resolve(source);
	const destinationDirectory = resolve(outputDirectory);
	await assertReviewedFiles(sourceDirectory);
	await mkdir(destinationDirectory, { recursive: true });

	const nonce = randomUUID();
	const zipCandidate = join(destinationDirectory, `.${FILE_NAME}.${nonce}.tmp`);
	const metadataCandidate = join(destinationDirectory, `.${METADATA_NAME}.${nonce}.tmp`);
	const zipPath = join(destinationDirectory, FILE_NAME);
	const metadataPath = join(destinationDirectory, METADATA_NAME);

	try {
		await createZip(sourceDirectory, zipCandidate);
		const zip = await readFile(zipCandidate);
		const manifest = JSON.parse(await readFile(join(sourceDirectory, "manifest.json"), "utf8"));
		if (typeof manifest.version !== "string" || !/^\d+\.\d+\.\d+$/.test(manifest.version)) {
			throw new Error("Browser extension manifest version is invalid");
		}
		const metadata = {
			fileName: FILE_NAME,
			sha256: createHash("sha256").update(zip).digest("hex"),
			version: manifest.version,
		};
		await writeFile(metadataCandidate, `${JSON.stringify(metadata)}\n`, { encoding: "utf8", mode: 0o644 });
		await replaceFile(zipCandidate, zipPath);
		await replaceFile(metadataCandidate, metadataPath);
	} finally {
		await Promise.all([rm(zipCandidate, { force: true }), rm(metadataCandidate, { force: true })]);
	}
}

async function assertReviewedFiles(sourceDirectory) {
	const names = (await readdir(sourceDirectory)).sort();
	const missing = APPROVED_FILES.filter((name) => !names.includes(name));
	if (missing.length > 0) throw new Error(`Browser extension build is missing reviewed file: ${missing.join(", ")}`);
	const unexpected = names.filter((name) => !APPROVED_FILES.includes(name));
	if (unexpected.length > 0) {
		throw new Error(`Browser extension build contains unexpected file: ${unexpected.join(", ")}`);
	}
	for (const name of APPROVED_FILES) {
		const file = await stat(join(sourceDirectory, name));
		if (!file.isFile()) throw new Error(`Browser extension reviewed path is not a file: ${name}`);
	}
}

async function createZip(sourceDirectory, candidatePath) {
	const archive = new ZipArchive({ forceLocalTime: false, store: true, zlib: { level: 0 } });
	const output = createWriteStream(candidatePath, { flags: "wx", mode: 0o600 });
	for (const name of APPROVED_FILES) {
		archive.append(await readFile(join(sourceDirectory, name)), { date: ZIP_TIMESTAMP, mode: 0o644, name });
	}
	const completed = pipeline(archive, output);
	archive.finalize();
	await completed;
}

async function replaceFile(candidatePath, finalPath) {
	await rm(finalPath, { force: true });
	await rename(candidatePath, finalPath);
}

function parseArguments(argumentsList) {
	const values = new Map();
	for (let index = 0; index < argumentsList.length; index += 2) {
		const key = argumentsList[index];
		const value = argumentsList[index + 1];
		if (!key?.startsWith("--") || !value) throw new Error("Usage: --source <directory> --output-dir <directory>");
		values.set(key.slice(2), value);
	}
	const source = values.get("source");
	const outputDirectory = values.get("output-dir");
	if (!source || !outputDirectory || values.size !== 2) {
		throw new Error("Usage: --source <directory> --output-dir <directory>");
	}
	return { source, outputDirectory };
}

if (basename(process.argv[1] ?? "") === "package-browser-extension.mjs") {
	main().catch((error) => {
		console.error(error instanceof Error ? error.message : "Browser extension packaging failed");
		process.exitCode = 1;
	});
}
