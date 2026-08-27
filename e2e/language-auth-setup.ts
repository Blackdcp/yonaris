import path from "node:path";
import type { Browser } from "@playwright/test";
import pg from "pg";
import { DATABASE_URL, LANGUAGE_SMOKE_ORG_ID, LANGUAGE_SMOKE_USER } from "./fixtures";

export const LANGUAGE_SMOKE_AUTH_STATE_PATH = path.join(import.meta.dirname, ".auth", "portal-language.json");

/** Provision a dedicated platform identity without changing parallel fixtures. */
export async function provisionLanguageSmokeIdentity(input: { browser: Browser; baseURL: string }): Promise<void> {
  const context = await input.browser.newContext({ baseURL: input.baseURL });
  const page = await context.newPage();
  try {
    const signUp = await page.request.post("/api/auth/sign-up/email", {
      headers: { Origin: input.baseURL },
      data: LANGUAGE_SMOKE_USER,
    });
    if (!signUp.ok()) {
      const signIn = await page.request.post("/api/auth/sign-in/email", {
        headers: { Origin: input.baseURL },
        data: {
          email: LANGUAGE_SMOKE_USER.email,
          password: LANGUAGE_SMOKE_USER.password,
        },
      });
      if (!signIn.ok()) {
        throw new Error(`Language smoke auth failed: ${signIn.status()} ${await signIn.text()}`);
      }
    }

    const client = new pg.Client({ connectionString: DATABASE_URL });
    await client.connect();
    try {
      const userResult = await client.query(`SELECT id FROM "user" WHERE lower(email) = lower($1) LIMIT 1`, [
        LANGUAGE_SMOKE_USER.email,
      ]);
      const userId = userResult.rows[0]?.id as string | undefined;
      if (!userId) throw new Error("Language smoke identity was not persisted after sign-up");

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
