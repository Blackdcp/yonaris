import path from "node:path";
import type { Browser, Page } from "@playwright/test";
import pg from "pg";
import {
  DATABASE_URL,
  LANGUAGE_SMOKE_BRAND_NAME,
  LANGUAGE_SMOKE_ORG_ID,
  LANGUAGE_SMOKE_USER,
} from "./fixtures";

export const LANGUAGE_SMOKE_AUTH_STATE_PATH = path.join(import.meta.dirname, ".auth", "portal-language.json");

/** Provision a dedicated platform identity without changing parallel fixtures. */
export async function provisionLanguageSmokeIdentity(input: {
  adminPage: Page;
  browser: Browser;
  baseURL: string;
}): Promise<void> {
  const { adminPage, browser, baseURL } = input;

  // Local mode intentionally permits only the bootstrap user's public signup.
  // Provision this second identity through the same administrator-owned access
  // flow used in production instead of calling the disabled signup endpoint.
  await adminPage.goto("/admin/access");
  await adminPage
    .getByRole("heading", { name: "Customer access" })
    .waitFor({ state: "visible", timeout: 30_000 });

  const workspaceSelect = adminPage.getByRole("combobox").first();
  await workspaceSelect.click();
  await adminPage
    .getByRole("option", { name: LANGUAGE_SMOKE_BRAND_NAME, exact: true })
    .click();

  await adminPage
    .getByRole("button", { name: "Create customer account", exact: true })
    .click();
  const createDialog = adminPage.getByRole("dialog", {
    name: "Create customer account",
  });
  await createDialog.getByLabel("Name").fill(LANGUAGE_SMOKE_USER.name);
  await createDialog.getByLabel("Email").fill(LANGUAGE_SMOKE_USER.email);
  await createDialog.getByRole("combobox").click();
  await adminPage.getByRole("option", { name: "Admin", exact: true }).click();
  await createDialog
    .getByRole("button", { name: "Create account", exact: true })
    .click();

  const credentialDialog = adminPage.getByRole("dialog", {
    name: "One-time customer credentials",
  });
  await credentialDialog.waitFor({ state: "visible", timeout: 30_000 });
  await credentialDialog
    .getByText("Admin", { exact: true })
    .waitFor({ state: "visible" });
  const credentialValues = await credentialDialog.locator("code").allTextContents();
  const [email, temporaryPassword] = credentialValues.map((value) => value.trim());
  if (email !== LANGUAGE_SMOKE_USER.email || !temporaryPassword) {
    throw new Error("Language smoke setup did not return the expected one-time credentials");
  }

  const context = await input.browser.newContext({ baseURL: input.baseURL });
  const page = await context.newPage();
  try {
    const signIn = await page.request.post("/api/auth/sign-in/email", {
      headers: { Origin: baseURL },
      data: { email, password: temporaryPassword },
    });
    if (!signIn.ok()) {
      throw new Error(`Language smoke auth failed: ${signIn.status()} ${await signIn.text()}`);
    }

    const client = new pg.Client({ connectionString: DATABASE_URL });
    await client.connect();
    try {
      const userResult = await client.query(`SELECT id FROM "user" WHERE lower(email) = lower($1) LIMIT 1`, [
        LANGUAGE_SMOKE_USER.email,
      ]);
      const userId = userResult.rows[0]?.id as string | undefined;
      if (!userId) throw new Error("Language smoke identity was not persisted after provisioning");

      const membership = await client.query(
        `SELECT id FROM member WHERE organization_id = $1 AND user_id = $2 LIMIT 1`,
        [LANGUAGE_SMOKE_ORG_ID, userId],
      );
      if (membership.rows.length === 0) {
        await client.query(
          `INSERT INTO member (id, organization_id, user_id, role, created_at)
           VALUES (gen_random_uuid(), $1, $2, 'admin', NOW())`,
          [LANGUAGE_SMOKE_ORG_ID, userId],
        );
      }
      await client.query(`UPDATE "user" SET role = 'admin', ui_language = 'en' WHERE id = $1`, [userId]);
    } finally {
      await client.end();
    }

    const sessionResponse = await page.request.get("/api/auth/get-session");
    const session = (await sessionResponse.json()) as {
      user?: { email?: string; role?: string; uiLanguage?: string };
    };
    if (
      !sessionResponse.ok() ||
      session.user?.email !== LANGUAGE_SMOKE_USER.email ||
      session.user?.role !== "admin" ||
      session.user?.uiLanguage !== "en"
    ) {
      throw new Error("Language smoke identity did not resolve as the dedicated platform user");
    }

    await context.storageState({ path: LANGUAGE_SMOKE_AUTH_STATE_PATH });
  } finally {
    await context.close();
  }
}
