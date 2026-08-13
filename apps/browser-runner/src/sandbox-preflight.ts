import { chmod, mkdir, mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import { type BrowserContext, chromium } from "playwright";

export type PersistentContextLaunchOptions = NonNullable<Parameters<typeof chromium.launchPersistentContext>[1]>;

export type PersistentContextLauncher = (
	profileDirectory: string,
	options: PersistentContextLaunchOptions,
) => Promise<BrowserContext>;

const defaultLauncher: PersistentContextLauncher = (profileDirectory, options) =>
	chromium.launchPersistentContext(profileDirectory, options);

export function sandboxedPersistentContext(
	profileDirectory: string,
	options: Omit<PersistentContextLaunchOptions, "chromiumSandbox">,
	launcher: PersistentContextLauncher = defaultLauncher,
	environment: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): Promise<BrowserContext> {
	const proxy = browserProxyFromEnvironment(environment);
	return launcher(profileDirectory, { ...options, ...(proxy ? { proxy } : {}), chromiumSandbox: true });
}

function browserProxyFromEnvironment(
	environment: NodeJS.ProcessEnv | Record<string, string | undefined>,
): { server: string } | undefined {
	const value = environment.BROWSER_EGRESS_PROXY_URL?.trim();
	if (!value) return undefined;
	if (value !== "http://127.0.0.1:17777") {
		throw new Error("Browser Runner requires the fixed local egress proxy http://127.0.0.1:17777");
	}
	return { server: value };
}

export async function runChromiumSandboxPreflight(
	stateDirectory: string,
	launcher: PersistentContextLauncher = defaultLauncher,
): Promise<void> {
	const preflightRoot = path.resolve(stateDirectory, "preflight");
	await mkdir(preflightRoot, { recursive: true, mode: 0o700 });
	await chmod(preflightRoot, 0o700);
	const profileDirectory = await mkdtemp(path.join(preflightRoot, "chromium-sandbox-"));
	await chmod(profileDirectory, 0o700);
	let context: BrowserContext | undefined;
	try {
		context = await sandboxedPersistentContext(profileDirectory, { headless: true }, launcher);
		const page = context.pages()[0] ?? (await context.newPage());
		await page.goto("about:blank", { waitUntil: "domcontentloaded" });
	} finally {
		await context?.close().catch(() => undefined);
		await rm(profileDirectory, { recursive: true, force: true });
	}
}
