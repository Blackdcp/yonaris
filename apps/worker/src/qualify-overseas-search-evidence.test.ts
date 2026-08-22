import assert from "node:assert/strict";
import test from "node:test";
import type { Provider, ScrapeResult } from "@workspace/lib/providers/types";
import {
	assertQualificationAcknowledged,
	runQualificationMatrix,
} from "./qualify-overseas-search-evidence.js";

const ACK = "paid-21-calls-2026-08-22";

function scrapeResult(): ScrapeResult {
	return {
		textContent: "private answer",
		rawOutput: { queries: ["expanded query"], answer: "private raw answer" },
		webQueries: ["expanded query"],
		webSearchObserved: true,
		citations: [],
	};
}

function provider(run: Provider["run"], validateTarget: Provider["validateTarget"] = () => null): Provider {
	return {
		id: "fake",
		name: "Fake",
		isConfigured: () => true,
		validateTarget,
		run,
	};
}

const entries = [
	{ channel: "chatgpt.consumer_web", model: "chatgpt", provider: "first" },
	{ channel: "gemini.consumer_web", model: "gemini", provider: "second" },
] as const;

test("requires the exact paid-call acknowledgement", () => {
	assert.throws(() => assertQualificationAcknowledged({}), /21 paid calls/);
	assert.throws(
		() => assertQualificationAcknowledged({ OVERSEAS_SEARCH_EVIDENCE_QUALIFICATION_ACK: "yes" }),
		/21 paid calls/,
	);
	assert.doesNotThrow(() =>
		assertQualificationAcknowledged({ OVERSEAS_SEARCH_EVIDENCE_QUALIFICATION_ACK: ACK }),
	);
});

test("validates every target before invoking a paid provider run", async () => {
	let paidRuns = 0;
	const rows: unknown[] = [];
	const invalidProvider = provider(
		async () => {
			paidRuns += 1;
			return scrapeResult();
		},
		() => "unsupported target",
	);

	const summary = await runQualificationMatrix({
		entries: [entries[0]],
		resolveProvider: () => invalidProvider,
		resolveTarget: () => ({ captureRouteKey: "fake.route" }),
		write: (row) => rows.push(row),
	});

	assert.equal(paidRuns, 0);
	assert.equal(summary.failed, 1);
	assert.deepEqual(rows, [
		{
			kind: "candidate",
			status: "failed",
			channel: "chatgpt.consumer_web",
			provider: "first",
			captureRouteKey: "fake.route",
			failureClass: "validation_failed",
		},
	]);
});

test("runs candidates sequentially and continues after one provider failure", async () => {
	let active = 0;
	let maximumActive = 0;
	const order: string[] = [];
	const rows: unknown[] = [];
	const providers: Record<string, Provider> = {
		first: provider(async () => {
			active += 1;
			maximumActive = Math.max(maximumActive, active);
			order.push("first:start");
			await Promise.resolve();
			active -= 1;
			order.push("first:fail");
			throw new Error("private provider failure details");
		}),
		second: provider(async () => {
			active += 1;
			maximumActive = Math.max(maximumActive, active);
			order.push("second:start");
			await Promise.resolve();
			active -= 1;
			order.push("second:success");
			return scrapeResult();
		}),
	};

	const summary = await runQualificationMatrix({
		entries,
		resolveProvider: (id) => providers[id],
		resolveTarget: (config) => ({ captureRouteKey: `route.${config.provider}` }),
		write: (row) => rows.push(row),
		now: (() => {
			let value = 0;
			return () => value++ * 10;
		})(),
	});

	assert.equal(maximumActive, 1);
	assert.deepEqual(order, ["first:start", "first:fail", "second:start", "second:success"]);
	assert.deepEqual(summary, { attempted: 2, succeeded: 1, failed: 1 });
	assert.equal(rows.length, 2);
	const serialized = JSON.stringify(rows);
	assert.ok(!serialized.includes("private answer"));
	assert.ok(!serialized.includes("private raw answer"));
	assert.ok(!serialized.includes("private provider failure details"));
});
