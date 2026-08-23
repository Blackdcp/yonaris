import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import test from "node:test";

const fragment = await readFile(
  new URL("./yonaris-marketing.caddy", import.meta.url),
  "utf8",
);

const predecessorUrl = new URL("./yonaris-marketing-v2.caddy", import.meta.url);
const rangesUrl = new URL("./cloudflare-ip-ranges.json", import.meta.url);

test("the reviewed v2 predecessor is preserved byte-for-byte", async () => {
	assert.equal(existsSync(predecessorUrl), true, "missing v2 predecessor snapshot");
	const predecessor = await readFile(predecessorUrl);
	assert.equal(
		createHash("sha256").update(predecessor).digest("hex").toUpperCase(),
		"6F1F6DD9F3CE91318D037F0E0328EAC4C41BDD90FB942835204408CA669F09C4",
	);
});

test("the checked Cloudflare snapshot contains the reviewed 15 IPv4 and 7 IPv6 ranges", async () => {
	assert.equal(existsSync(rangesUrl), true, "missing Cloudflare range snapshot");
	const ranges = JSON.parse(await readFile(rangesUrl, "utf8"));
	assert.equal(ranges.reviewedAt, "2026-08-22");
	assert.equal(ranges.ipv4.length, 15);
	assert.equal(ranges.ipv6.length, 7);
});

test("the active apex policy is method-specific and has a terminal direct 404", () => {
	assert.match(fragment, /@diagnosticCloudflare\s*\{/u);
	assert.match(fragment, /@diagnosticDirect\s*\{/u);
	assert.match(fragment, /@publicApiGetHead\s*\{/u);
	assert.match(fragment, /@plausibleEvent\s*\{/u);
	assert.match(fragment, /@publicGetHead\s*\{/u);
	assert.doesNotMatch(fragment, /(?:^|\s)\/api\/\*(?:\s|$)/u);
	assert.doesNotMatch(fragment, /(?:^|\s)\/zh\/\*(?:\s|$)/u);
	assert.doesNotMatch(fragment, /(?:^|\s)\/diagnostic\/\*(?:\s|$)/u);
	assert.match(fragment.trimEnd(), /respond 404\n\s*\}\n\}$/u);
});
