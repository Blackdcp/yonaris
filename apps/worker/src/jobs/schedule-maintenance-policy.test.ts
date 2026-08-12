import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isAutomaticExecutionActivated } from "./schedule-maintenance-policy";

describe("schedule maintenance execution boundary", () => {
	it("never schedules a customer-created manual-only prompt", () => {
		assert.equal(isAutomaticExecutionActivated({ enabled: true, automaticTargetKeys: [] }), false);
	});

	it("fails closed when a prompt has no persisted execution scope", () => {
		assert.equal(isAutomaticExecutionActivated(undefined), false);
	});

	it("continues platform-managed legacy and explicitly targeted scopes", () => {
		assert.equal(isAutomaticExecutionActivated({ enabled: true, automaticTargetKeys: null }), true);
		assert.equal(isAutomaticExecutionActivated({ enabled: true, automaticTargetKeys: ["chatgpt.consumer_web"] }), true);
		assert.equal(isAutomaticExecutionActivated({ enabled: false, automaticTargetKeys: null }), false);
	});
});
