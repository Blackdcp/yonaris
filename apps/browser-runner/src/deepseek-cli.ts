import { createHash } from "node:crypto";
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";
import {
	DeepSeekPlaywrightSessionFactory,
	type DeepSeekSelectorContract,
	deepSeekProfileIdentityHash,
	openDeepSeekLoginWindow,
	validateDeepSeekSelectorContract,
} from "./adapters/deepseek-live.js";
import { deepSeekManifestFingerprint, parseDeepSeekReviewedManifest } from "./deepseek-capture-contract.js";
import { reviewDeepSeekObservationEvidence } from "./deepseek-evidence-review.js";
import { runDeepSeekCohort, runDeepSeekUatOnce } from "./deepseek-local-capture.js";
import { sanitizeDiagnostic } from "./errors.js";
import { sandboxedPersistentContext } from "./sandbox-preflight.js";

type ParsedDeepSeekCommand =
	| { command: "login-window"; stateDirectory: string }
	| { command: "probe-selectors"; stateDirectory: string }
	| { command: "uat-once"; stateDirectory: string; selectorsPath: string }
	| { command: "run-cohort"; stateDirectory: string; selectorsPath: string; outputPath: string }
	| { command: "review-evidence"; filePath: string; evidenceDirectory: string; outputPath: string }
	| { command: "validate-manifest"; filePath: string };

const SECRET_FLAG = /^--(?:password|token|cookie|phone|storage-state)$/i;

export function parseDeepSeekCliArguments(arguments_: string[]): ParsedDeepSeekCommand {
	if (arguments_.some((argument) => SECRET_FLAG.test(argument))) {
		throw new Error("DeepSeek secret arguments are forbidden");
	}
	const [command, ...flagArguments] = arguments_;
	if (command === "poll" || command === "schedule" || command === "daily") {
		throw new Error("DeepSeek capture is an explicit one-shot operation; recurring modes are not supported");
	}
	const flags = parseFlags(flagArguments);
	if (command === "login-window" || command === "probe-selectors") {
		assertOnlyFlags(flags, ["state-dir"]);
		return { command, stateDirectory: requiredFlag(flags, "state-dir") };
	}
	if (command === "uat-once") {
		assertOnlyFlags(flags, ["state-dir", "selectors"]);
		return {
			command,
			stateDirectory: requiredFlag(flags, "state-dir"),
			selectorsPath: requiredFlag(flags, "selectors"),
		};
	}
	if (command === "run-cohort") {
		assertOnlyFlags(flags, ["state-dir", "selectors", "output"]);
		return {
			command,
			stateDirectory: requiredFlag(flags, "state-dir"),
			selectorsPath: requiredFlag(flags, "selectors"),
			outputPath: requiredFlag(flags, "output"),
		};
	}
	if (command === "validate-manifest") {
		assertOnlyFlags(flags, ["file"]);
		return { command, filePath: requiredFlag(flags, "file") };
	}
	if (command === "review-evidence") {
		assertOnlyFlags(flags, ["file", "evidence-dir", "output"]);
		return {
			command,
			filePath: requiredFlag(flags, "file"),
			evidenceDirectory: requiredFlag(flags, "evidence-dir"),
			outputPath: requiredFlag(flags, "output"),
		};
	}
	throw new Error(
		"DeepSeek capture supports only explicit one-shot login, probe, UAT, cohort, and validation commands",
	);
}

async function main(): Promise<void> {
	const rawArguments = process.argv.slice(2);
	if (rawArguments[0] === "--") rawArguments.shift();
	const command = parseDeepSeekCliArguments(rawArguments);
	if (command.command === "login-window") {
		const result = await openDeepSeekLoginWindow(path.resolve(command.stateDirectory));
		process.stdout.write(`${JSON.stringify({ status: result.status, profileReadyForProbe: true })}\n`);
		return;
	}
	if (command.command === "probe-selectors") {
		const result = await collectSelectorProbe(path.resolve(command.stateDirectory));
		process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
		return;
	}
	if (command.command === "validate-manifest") {
		const manifest = parseDeepSeekReviewedManifest(JSON.parse(await readFile(path.resolve(command.filePath), "utf8")));
		process.stdout.write(
			`${JSON.stringify({ status: "valid", total: 18, manifestFingerprint: deepSeekManifestFingerprint(manifest) })}\n`,
		);
		return;
	}
	if (command.command === "review-evidence") {
		const captured = parseDeepSeekReviewedManifest(JSON.parse(await readFile(path.resolve(command.filePath), "utf8")));
		const evidenceRoot = path.resolve(command.evidenceDirectory);
		const observations = [];
		for (const observation of captured.observations) {
			const directory = path.resolve(evidenceRoot, observation.externalId);
			if (path.dirname(directory) !== evidenceRoot) throw new Error("DeepSeek evidence path escaped its root");
			observations.push(
				reviewDeepSeekObservationEvidence(
					observation,
					await readFile(path.join(directory, "screenshot.png")),
					await readFile(path.join(directory, "page.html")),
				),
			);
		}
		const reviewed = parseDeepSeekReviewedManifest({ ...captured, observations });
		await writeFile(path.resolve(command.outputPath), `${JSON.stringify(reviewed, null, 2)}\n`, {
			flag: "wx",
			mode: 0o600,
		});
		process.stdout.write(
			`${JSON.stringify({
				status: "reviewed",
				total: observations.length,
				manifestFingerprint: deepSeekManifestFingerprint(reviewed),
			})}\n`,
		);
		return;
	}
	const selectors = await readSelectorContract(command.selectorsPath);
	const selectorFingerprint = selectorContractFingerprint(selectors);
	const factory = new DeepSeekPlaywrightSessionFactory(command.stateDirectory, selectors);
	if (command.command === "uat-once") {
		const result = await runDeepSeekUatOnce({
			stateDirectory: command.stateDirectory,
			selectorFingerprint,
			profileIdentityHash: await deepSeekProfileIdentityHash(command.stateDirectory),
			browserMajor: await chromiumMajor(),
			sessionFactory: factory,
		});
		process.stdout.write(`${JSON.stringify(result)}\n`);
		return;
	}
	const receipt = await runDeepSeekCohort({
		stateDirectory: command.stateDirectory,
		outputPath: command.outputPath,
		selectorFingerprint,
		sessionFactory: factory,
	});
	process.stdout.write(`${JSON.stringify(receipt)}\n`);
}

async function readSelectorContract(filePath: string): Promise<DeepSeekSelectorContract> {
	const value = JSON.parse(await readFile(path.resolve(filePath), "utf8")) as unknown;
	if (!isRecord(value)) throw new Error("DeepSeek selector contract must be an object");
	const expected = [
		"answer",
		"captcha",
		"citationLink",
		"composer",
		"generating",
		"loginWall",
		"newConversation",
		"queryItem",
		"rateLimit",
		"searchNotUsed",
		"searchUsed",
		"send",
		"userMessage",
		"version",
	];
	const actual = Object.keys(value).sort();
	if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
		throw new Error("DeepSeek selector contract contains unexpected or missing fields");
	}
	return validateDeepSeekSelectorContract(value as DeepSeekSelectorContract);
}

function selectorContractFingerprint(selectors: DeepSeekSelectorContract): string {
	const canonical = JSON.stringify(
		Object.fromEntries(Object.entries(selectors).sort(([left], [right]) => left.localeCompare(right))),
	);
	return `deepseek-${createHash("sha256").update(canonical).digest("hex").slice(0, 32)}`;
}

async function chromiumMajor(): Promise<number> {
	const browser = await chromium.launch({ headless: true, chromiumSandbox: true });
	try {
		const major = Number.parseInt(browser.version().split(".")[0] ?? "", 10);
		if (!Number.isInteger(major)) throw new Error("Unable to identify the approved Chromium build");
		return major;
	} finally {
		await browser.close();
	}
}

async function collectSelectorProbe(stateDirectory: string) {
	const profileDirectory = path.resolve(stateDirectory, "deepseek-profile");
	await mkdir(profileDirectory, { recursive: true, mode: 0o700 });
	await chmod(profileDirectory, 0o700);
	const context = await sandboxedPersistentContext(profileDirectory, {
		headless: true,
		locale: "zh-CN",
		timezoneId: "Asia/Shanghai",
		viewport: { width: 1440, height: 900 },
	});
	try {
		const page = context.pages()[0] ?? (await context.newPage());
		await page.goto("https://chat.deepseek.com/", { waitUntil: "domcontentloaded", timeout: 60_000 });
		await page.waitForTimeout(3_000);
		const report = await page.evaluate(() => {
			const safeToken = /^[A-Za-z_][A-Za-z0-9_.:-]{1,100}$/;
			const candidates = new Map<string, { selector: string; tag: string; count: number; visible: boolean }>();
			for (const element of document.querySelectorAll(
				"textarea,[contenteditable=true],button,[role=button],[data-testid]",
			)) {
				const tag = element.tagName.toLowerCase();
				const selectors: string[] = [];
				if (element.id && safeToken.test(element.id)) selectors.push(`#${element.id}`);
				const testId = element.getAttribute("data-testid");
				if (testId && safeToken.test(testId)) selectors.push(`[data-testid="${testId}"]`);
				for (const className of element.classList) {
					if (safeToken.test(className)) selectors.push(`.${className}`);
				}
				for (const selector of selectors.slice(0, 4)) {
					if (candidates.has(selector)) continue;
					const nodes = [...document.querySelectorAll(selector)];
					candidates.set(selector, {
						selector,
						tag,
						count: nodes.length,
						visible: nodes.some((node) => {
							const rect = node.getBoundingClientRect();
							return rect.width > 0 && rect.height > 0;
						}),
					});
				}
			}
			return {
				schemaVersion: 1,
				topLevel: location.origin === "https://chat.deepseek.com",
				signedIn: location.pathname !== "/sign_in",
				candidates: [...candidates.values()].filter((item) => item.count <= 10).slice(0, 100),
			};
		});
		return report;
	} finally {
		await context.close();
	}
}

function parseFlags(arguments_: string[]): Map<string, string> {
	const flags = new Map<string, string>();
	for (let index = 0; index < arguments_.length; index += 2) {
		const flag = arguments_[index];
		const value = arguments_[index + 1];
		if (!flag?.startsWith("--") || !value || value.startsWith("--")) throw new Error(`Unexpected flag ${flag ?? ""}`);
		const key = flag.slice(2);
		if (flags.has(key)) throw new Error(`Unexpected flag --${key}`);
		flags.set(key, value);
	}
	return flags;
}

function assertOnlyFlags(flags: ReadonlyMap<string, string>, allowed: readonly string[]): void {
	for (const key of flags.keys()) {
		if (!allowed.includes(key)) throw new Error(`Unexpected flag --${key}`);
	}
}

function requiredFlag(flags: ReadonlyMap<string, string>, key: string): string {
	const value = flags.get(key)?.trim();
	if (!value) throw new Error(`--${key} is required`);
	return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
	void main().catch((error) => {
		process.stderr.write(`${sanitizeDiagnostic(error instanceof Error ? error.message : String(error))}\n`);
		process.exitCode = 1;
	});
}

export function defaultDeepSeekStateDirectory(): string {
	if (process.platform === "win32") {
		return path.join(
			process.env.LOCALAPPDATA || path.join(homedir(), "AppData", "Local"),
			"Yonaris",
			"DeepSeekSampling",
		);
	}
	return path.join(homedir(), ".local", "share", "yonaris-deepseek-sampling");
}
