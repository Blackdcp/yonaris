import assert from "node:assert/strict";
import test from "node:test";
import { buildStatusMatrix, formatProvider, providerCategory, type TargetStatus } from "./status-helpers";

test("shows DeepSeek's native provider as a direct API target", () => {
	const target: TargetStatus = {
		target: "deepseek:deepseek-api:deepseek-v4-pro:online",
		entries: [],
	};

	assert.equal(formatProvider("deepseek-api"), "DeepSeek API");
	assert.equal(providerCategory("deepseek-api"), "direct-api");

	const matrix = buildStatusMatrix([target]);
	assert.deepEqual(matrix.models, ["deepseek"]);
	assert.deepEqual(matrix.providers, ["direct-api"]);
	assert.equal(matrix.availability("deepseek", "direct-api"), "tracked");
	assert.equal(matrix.cell("deepseek", "direct-api")?.count, 1);
});
