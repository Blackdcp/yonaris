import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildLocalDemoDefaultScopePromotion } from "./local-demo-import-policy";

describe("local demo import default scope promotion", () => {
	it("promotes only the reviewed StepFun local PC Doubao import scope", () => {
		assert.deepEqual(
			buildLocalDemoDefaultScopePromotion({
				brandId: "stepfun",
				scopeId: "cn-zh-scored",
				importId: "stepfun-local-pc-doubao-demo-20260814",
				source: "local_pc_demo",
			}),
			{ brandId: "stepfun", scopeId: "cn-zh-scored" },
		);
	});

	it("rejects unreviewed imports", () => {
		assert.throws(
			() =>
				buildLocalDemoDefaultScopePromotion({
					brandId: "stepfun",
					scopeId: "cn-zh-scored",
					importId: "other-import",
					source: "local_pc_demo",
				}),
			/unsupported_local_demo_default_scope_promotion/,
		);
	});
});
