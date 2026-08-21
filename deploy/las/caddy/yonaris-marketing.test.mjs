import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const fragment = await readFile(
  new URL("./yonaris-marketing.caddy", import.meta.url),
  "utf8",
);

const routeLine = fragment
  .split(/\r?\n/u)
  .find((line) => line.trimStart().startsWith("@public path "));

test("the apex proxy exposes every published marketing route", () => {
  assert.ok(routeLine, "missing the @public path matcher");

  const allowedPaths = new Set(
    routeLine.trim().slice("@public path ".length).split(/\s+/u),
  );
  const publishedPaths = [
    "/",
    "/zh",
    "/zh/*",
    "/platform",
    "/platform/*",
    "/methodology",
    "/methodology/*",
    "/results",
    "/results/*",
    "/geo",
    "/geo/*",
    "/diagnostic",
    "/diagnostic/*",
    "/agent",
    "/agent/*",
    "/llms.txt",
    "/llms-full.txt",
  ];

  for (const path of publishedPaths) {
    assert.ok(allowedPaths.has(path), `Caddy does not proxy ${path}`);
  }
});
