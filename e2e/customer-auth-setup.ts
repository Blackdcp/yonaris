import type { Browser, Page } from "@playwright/test";
import path from "node:path";
import { CUSTOMER_TEST_USER, STEPFUN_BRAND_NAME } from "./fixtures";

export const CUSTOMER_AUTH_STATE_PATH = path.join(
  import.meta.dirname,
  ".auth",
  "stepfun-customer.json",
);

/**
 * Exercise the same platform-admin provisioning flow used in production, then
 * persist a genuine ordinary-customer session for the boundary suite.
 */
export async function provisionCustomerTestIdentity(input: {
  adminPage: Page;
  browser: Browser;
  baseURL: string;
}): Promise<void> {
  const { adminPage, browser, baseURL } = input;

  await adminPage.goto("/admin/access");
  await adminPage
    .getByRole("heading", { name: "Customer access" })
    .waitFor({ state: "visible", timeout: 30_000 });

  const workspaceSelect = adminPage.getByRole("combobox").first();
  await workspaceSelect.click();
  await adminPage
    .getByRole("option", { name: STEPFUN_BRAND_NAME, exact: true })
    .click();

  await adminPage
    .getByRole("button", { name: "Create customer account", exact: true })
    .click();
  const createDialog = adminPage.getByRole("dialog", {
    name: "Create customer account",
  });
  await createDialog.getByLabel("Name").fill(CUSTOMER_TEST_USER.name);
  await createDialog.getByLabel("Email").fill(CUSTOMER_TEST_USER.email);
  await createDialog.getByRole("combobox").click();
  await adminPage.getByRole("option", { name: "Analyst", exact: true }).click();
  await createDialog
    .getByRole("button", { name: "Create account", exact: true })
    .click();

  const credentialDialog = adminPage.getByRole("dialog", {
    name: "One-time customer credentials",
  });
  await credentialDialog.waitFor({ state: "visible", timeout: 30_000 });
  await credentialDialog
    .getByText("Analyst", { exact: true })
    .waitFor({ state: "visible" });
  const credentialValues = await credentialDialog.locator("code").allTextContents();
  const [email, temporaryPassword] = credentialValues.map((value) => value.trim());
  if (email !== CUSTOMER_TEST_USER.email || !temporaryPassword) {
    throw new Error("Customer access setup did not return the expected one-time credentials");
  }

  const customerContext = await browser.newContext({ baseURL });
  try {
    const customerPage = await customerContext.newPage();
    const signInResponse = await customerPage.request.post(
      "/api/auth/sign-in/email",
      {
        headers: { Origin: baseURL },
        data: { email, password: temporaryPassword },
      },
    );
    if (!signInResponse.ok()) {
      throw new Error(
        `Customer sign-in failed: ${signInResponse.status()} ${await signInResponse.text()}`,
      );
    }

    const sessionResponse = await customerPage.request.get("/api/auth/get-session");
    const session = (await sessionResponse.json()) as {
      user?: { email?: string; role?: string };
    };
    if (
      !sessionResponse.ok() ||
      session.user?.email !== CUSTOMER_TEST_USER.email ||
      session.user?.role === "admin"
    ) {
      throw new Error("Provisioned customer identity did not resolve as a non-platform user");
    }

    await customerContext.storageState({ path: CUSTOMER_AUTH_STATE_PATH });
  } finally {
    await customerContext.close();
  }
}
