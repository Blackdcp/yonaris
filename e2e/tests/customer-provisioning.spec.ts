import { expect, test } from "@playwright/test";
import { ADMIN_AUTH_STATE_PATH } from "../auth-setup";

test.use({ storageState: ADMIN_AUTH_STATE_PATH });

test("a platform operator can provision a ready customer workspace and ordinary account", async ({ page, browser }) => {
	const suffix = Date.now().toString(36);
	const workspaceName = `Customer E2E ${suffix}`;
	const brandId = `customer-e2e-${suffix}`;
	const customerEmail = `customer-e2e-${suffix}@example.com`;

	await page.goto("/admin/access");
	await page.getByRole("heading", { name: "Customer access" }).waitFor({ state: "visible", timeout: 30_000 });

	await page.getByRole("button", { name: "Create customer workspace", exact: true }).click();
	const workspaceDialog = page.getByRole("dialog", { name: "Create customer workspace" });
	await workspaceDialog.getByLabel("Customer or brand name").fill(workspaceName);
	await workspaceDialog.getByLabel("Website").fill("https://example.com");
	await workspaceDialog.getByRole("button", { name: "Create workspace", exact: true }).click();
	await workspaceDialog.waitFor({ state: "hidden", timeout: 30_000 });
	// Wait for the newly-created workspace to become the selected tenant before
	// opening the account dialog. This verifies the real UI handoff and avoids
	// racing the React Query invalidation with the next mutation.
	await expect(page.getByRole("combobox").first()).toContainText(workspaceName, { timeout: 30_000 });

	await page.getByRole("button", { name: "Create customer account", exact: true }).click();
	const accountDialog = page.getByRole("dialog", { name: "Create customer account" });
	await accountDialog.getByLabel("Name").fill(`Customer QA ${suffix}`);
	await accountDialog.getByLabel("Email").fill(customerEmail);
	await accountDialog.getByRole("button", { name: "Create account", exact: true }).click();

	const credentialDialog = page.getByRole("dialog", { name: "One-time customer credentials" });
	await credentialDialog.waitFor({ state: "visible", timeout: 30_000 });
	const credentialValues = await credentialDialog.locator("code").allTextContents();
	const [email, temporaryPassword] = credentialValues.map((value) => value.trim());
	expect(email).toBe(customerEmail);
	expect(temporaryPassword).toBeTruthy();

	const baseURL = new URL(page.url()).origin;
	const customerContext = await browser.newContext({ baseURL });
	try {
		const customerPage = await customerContext.newPage();
		const signInResponse = await customerPage.request.post("/api/auth/sign-in/email", {
			headers: { Origin: baseURL },
			data: { email, password: temporaryPassword },
		});
		expect(signInResponse.status()).toBe(200);

		const response = await customerPage.goto(`/app/${brandId}/programs`);
		expect(response?.status()).toBe(200);
		await expect(customerPage.getByRole("heading", { name: "Programs" })).toBeVisible({ timeout: 30_000 });
		await expect(customerPage.getByText(workspaceName, { exact: true }).first()).toBeVisible();

		const sidebar = customerPage.locator('[data-slot="sidebar"]');
		await expect(sidebar.getByText("Programs", { exact: true })).toBeVisible();
		await expect(sidebar.getByText("Platform administration", { exact: true })).toHaveCount(0);
		await expect(sidebar.getByText("Sampling operations", { exact: true })).toHaveCount(0);
	} finally {
		await customerContext.close();
	}
});
