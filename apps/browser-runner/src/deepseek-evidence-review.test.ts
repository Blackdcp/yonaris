import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { reviewDeepSeekObservationEvidence } from "./deepseek-evidence-review.js";

const screenshot = Buffer.from("png-evidence");
const html = Buffer.from(
	'<html><body><span>已阅读 2 个网页</span><a href="https://example.com/a">-1</a><a href="http://news.example.cn/b">-2</a></body></html>',
	"utf8",
);
const observation = {
	externalId: "slot-1",
	promptIndex: 1 as const,
	sampleIndex: 1 as const,
	promptText: "国内有哪些主流大模型公司？" as const,
	answerText: "包含 StepFun 的完整回答",
	observedAt: "2026-08-14T00:00:00.000Z",
	pageUrl: "https://chat.deepseek.com/a/chat/s/abcdef",
	webSearchObserved: null,
	webQueries: [],
	citations: [
		{ url: "https://example.com/a", title: "-1", citationIndex: 0 },
		{ url: "http://news.example.cn/b", title: "-2", citationIndex: 1 },
	],
	evidence: {
		screenshotSha256: createHash("sha256").update(screenshot).digest("hex"),
		pageSnapshotSha256: createHash("sha256").update(html).digest("hex"),
	},
};

test("promotes positive DeepSeek search evidence without inventing query strings", () => {
	const reviewed = reviewDeepSeekObservationEvidence(observation, screenshot, html);
	assert.equal(reviewed.webSearchObserved, true);
	assert.deepEqual(reviewed.webQueries, []);
	assert.deepEqual(
		reviewed.citations.map((item) => item.title),
		["example.com", "news.example.cn"],
	);
});

test("rejects evidence hash mismatches and citations missing from the captured HTML", () => {
	assert.throws(
		() => reviewDeepSeekObservationEvidence(observation, Buffer.from("different"), html),
		/evidence digest mismatch/,
	);
	const missingCitationHtml = Buffer.from("<html><body>已阅读 1 个网页</body></html>", "utf8");
	const withMatchingDigest = {
		...observation,
		evidence: {
			...observation.evidence,
			pageSnapshotSha256: createHash("sha256").update(missingCitationHtml).digest("hex"),
		},
	};
	assert.throws(
		() => reviewDeepSeekObservationEvidence(withMatchingDigest, screenshot, missingCitationHtml),
		/citation is absent/,
	);
});

test("does not claim observed search without the positive read-webpages marker", () => {
	const noMarker = Buffer.from(
		'<html><body><a href="https://example.com/a">-1</a><a href="http://news.example.cn/b">-2</a></body></html>',
		"utf8",
	);
	const input = {
		...observation,
		evidence: {
			...observation.evidence,
			pageSnapshotSha256: createHash("sha256").update(noMarker).digest("hex"),
		},
	};
	assert.throws(() => reviewDeepSeekObservationEvidence(input, screenshot, noMarker), /positive search evidence/);
});

test("accepts browser-normalized trailing slashes when the saved href is equivalent", () => {
	const normalizedHtml = Buffer.from('<html><body>已阅读 1 个网页<a href="https://01.ai">-1</a></body></html>', "utf8");
	const input = {
		...observation,
		citations: [{ url: "https://01.ai/", title: "-1", citationIndex: 0 }],
		evidence: {
			...observation.evidence,
			pageSnapshotSha256: createHash("sha256").update(normalizedHtml).digest("hex"),
		},
	};
	assert.equal(reviewDeepSeekObservationEvidence(input, screenshot, normalizedHtml).citations[0]?.title, "01.ai");
});
