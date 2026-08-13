import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { buildDeliveryBatchFreezeWindowCondition } from "./delivery-batches";

describe("delivery batch freeze transaction boundary", () => {
	it("uses one database statement timestamp to keep freeze inside the expected measurement window", () => {
		const query = new PgDialect().sqlToQuery(
			buildDeliveryBatchFreezeWindowCondition({
				startsAt: "2026-08-12T16:00:00.000Z",
				endsAt: "2026-08-20T15:59:59.000Z",
			}),
		);

		expect(query.sql.match(/statement_timestamp\(\)/g)).toHaveLength(2);
		expect(query.sql).toMatch(/statement_timestamp\(\) >= \$1/);
		expect(query.sql).toMatch(/statement_timestamp\(\) < \$2/);
		expect(query.params).toEqual([new Date("2026-08-12T16:00:00.000Z"), new Date("2026-08-20T15:59:59.000Z")]);
	});
});
