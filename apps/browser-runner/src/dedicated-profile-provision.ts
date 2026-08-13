import { chmod, mkdir } from "node:fs/promises";
import { dedicatedProfileDirectory, initializeDedicatedProfile } from "./dedicated-profile.js";
import { BrowserRunnerError } from "./errors.js";
import { type PersistentContextLauncher, sandboxedPersistentContext } from "./sandbox-preflight.js";

const DOUBAO_URL = "https://www.doubao.com/chat/";

/**
 * Opens the dedicated profile for an operator to authenticate manually. The
 * function never types credentials, clicks login, or handles a challenge. It
 * writes the runtime-ready marker only after a positive authenticated selector
 * is uniquely visible and Doubao's login button is absent.
 */
export async function provisionDedicatedDoubaoProfile(
	stateDirectory: string,
	launcher?: PersistentContextLauncher,
): Promise<string> {
	const authenticatedSelector = process.env.BROWSER_RUNNER_DOUBAO_AUTHENTICATED_SELECTOR?.trim();
	if (!authenticatedSelector || authenticatedSelector.length > 500) {
		throw new BrowserRunnerError(
			"adapter_unverified",
			"session_open",
			"needs_human",
			"BROWSER_RUNNER_DOUBAO_AUTHENTICATED_SELECTOR must identify the approved positive account marker",
		);
	}
	const profileDirectory = dedicatedProfileDirectory(stateDirectory);
	await mkdir(profileDirectory, { recursive: true, mode: 0o700 });
	await chmod(profileDirectory, 0o700);
	const context = await sandboxedPersistentContext(
		profileDirectory,
		{
			headless: false,
			locale: "zh-CN",
			timezoneId: "Asia/Shanghai",
			viewport: { width: 1_440, height: 900 },
		},
		launcher,
	);
	try {
		const page = context.pages()[0] ?? (await context.newPage());
		await page.goto(DOUBAO_URL, { waitUntil: "domcontentloaded" });
		const authenticated = page.locator(authenticatedSelector);
		try {
			await authenticated.waitFor({ state: "visible", timeout: 10 * 60_000 });
		} catch (cause) {
			throw new BrowserRunnerError(
				"dedicated_profile_not_authenticated",
				"session_open",
				"needs_human",
				"Manual Doubao authentication was not positively verified before the provisioning window expired",
				{ cause },
			);
		}
		const loginButtonVisible = await page
			.getByRole("button", { name: "\u767b\u5f55", exact: true })
			.isVisible()
			.catch(() => false);
		if ((await authenticated.count()) !== 1 || !(await authenticated.isVisible()) || loginButtonVisible) {
			throw new BrowserRunnerError(
				"dedicated_profile_not_authenticated",
				"session_open",
				"needs_human",
				"Manual Doubao authentication did not produce the approved dedicated-account state",
			);
		}
		await initializeDedicatedProfile(profileDirectory);
		return profileDirectory;
	} finally {
		await context.close().catch(() => undefined);
	}
}
