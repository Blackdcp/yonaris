import assert from "node:assert/strict";
import test from "node:test";
import { parseDeepSeekCliArguments } from "./deepseek-cli.js";

test("parses only the explicit local DeepSeek commands", () => {
	assert.deepEqual(parseDeepSeekCliArguments(["login-window", "--state-dir", "C:\\state"]), {
		command: "login-window",
		stateDirectory: "C:\\state",
	});
	assert.deepEqual(
		parseDeepSeekCliArguments([
			"run-cohort",
			"--state-dir",
			"C:\\state",
			"--selectors",
			"C:\\selectors.json",
			"--output",
			"C:\\reviewed.json",
		]),
		{
			command: "run-cohort",
			stateDirectory: "C:\\state",
			selectorsPath: "C:\\selectors.json",
			outputPath: "C:\\reviewed.json",
		},
	);
	assert.deepEqual(parseDeepSeekCliArguments(["validate-manifest", "--file", "C:\\reviewed.json"]), {
		command: "validate-manifest",
		filePath: "C:\\reviewed.json",
	});
	assert.deepEqual(
		parseDeepSeekCliArguments([
			"review-evidence",
			"--file",
			"C:\\captured.json",
			"--evidence-dir",
			"C:\\evidence",
			"--output",
			"C:\\reviewed.json",
		]),
		{
			command: "review-evidence",
			filePath: "C:\\captured.json",
			evidenceDirectory: "C:\\evidence",
			outputPath: "C:\\reviewed.json",
		},
	);
});

test("requires selector input for UAT and cohort but never accepts credentials", () => {
	assert.throws(() => parseDeepSeekCliArguments(["uat-once", "--state-dir", "C:\\state"]), /--selectors is required/);
	for (const secretFlag of ["--password", "--token", "--cookie", "--phone", "--storage-state"]) {
		assert.throws(
			() => parseDeepSeekCliArguments(["login-window", "--state-dir", "C:\\state", secretFlag, "secret"]),
			/secret arguments are forbidden/,
		);
	}
});

test("rejects recurring modes and unknown flags", () => {
	assert.throws(() => parseDeepSeekCliArguments(["poll", "--state-dir", "C:\\state"]), /explicit one-shot/);
	assert.throws(
		() => parseDeepSeekCliArguments(["probe-selectors", "--state-dir", "C:\\state", "--daily"]),
		/Unexpected flag/,
	);
});
