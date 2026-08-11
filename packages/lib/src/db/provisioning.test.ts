import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { buildPromoteUniqueDefaultOrgAdminQuery, hasOwnerOrAdminOrgRole, slugifyOrgName } from "./provisioning";

describe("hasOwnerOrAdminOrgRole", () => {
	it.each(["owner", "admin", "member,admin", "viewer, owner", " member , admin "])(
		"recognizes an exact privileged token in %j",
		(role) => {
			expect(hasOwnerOrAdminOrgRole(role)).toBe(true);
		},
	);

	it.each([null, undefined, "", "member", "viewer", "member,viewer", "administrator"])(
		"rejects an unprivileged role list in %j",
		(role) => {
			expect(hasOwnerOrAdminOrgRole(role)).toBe(false);
		},
	);
});

describe("promoteUniqueDefaultOrgAdmin SQL", () => {
	it("atomically selects the default org's sole owner/admin and updates that user", () => {
		const query = new PgDialect().sqlToQuery(buildPromoteUniqueDefaultOrgAdminQuery("user-1"));

		expect(query.sql).toContain('select "member"."user_id" as user_id');
		expect(query.sql).toContain('"member"."organization_id" = \'default\'');
		expect(query.sql.match(/unnest\(string_to_array\("member"\."role", ','\)\)/g)).toHaveLength(1);
		expect(query.sql.match(/btrim\(privileged_role\.value\) in \(\$1, \$2\)/g)).toHaveLength(1);
		expect(query.sql).toMatch(
			/inner join privileged_default_org_members\s+on privileged_default_org_members\.user_id = "user"\."id"/,
		);
		expect(query.sql).toContain("(select count(*) from privileged_default_org_members) = 1");
		expect(query.sql).not.toContain('select count(*) from "user"');
		expect(query.sql).toContain('set "role" = \'admin\', "updated_at" = now()');
		expect(query.sql).not.toContain('set "user"."role"');
		expect(query.sql).not.toContain('"user"."updated_at" = now()');
		expect(query.sql).toContain('where "user"."id" in (select id from eligible)');
		expect(query.sql).toContain('"user"."role" is distinct from \'admin\'');
		expect(query.sql).toContain("select exists(select 1 from eligible) as eligible");
		expect(query.params).toEqual(["owner", "admin", "user-1"]);
	});
});

describe("slugifyOrgName", () => {
	it("lowercases", () => {
		expect(slugifyOrgName("Acme")).toBe("acme");
	});

	it("replaces runs of non-alphanumerics with single hyphens", () => {
		expect(slugifyOrgName("Acme Co!")).toBe("acme-co");
		expect(slugifyOrgName("Foo   Bar")).toBe("foo-bar");
	});

	it("trims leading and trailing hyphens", () => {
		expect(slugifyOrgName("  hello world  ")).toBe("hello-world");
		expect(slugifyOrgName("!!!brand!!!")).toBe("brand");
	});

	it("falls back to 'brand' for empty / non-alphanumeric input", () => {
		expect(slugifyOrgName("")).toBe("brand");
		expect(slugifyOrgName("!!!")).toBe("brand");
	});

	it("preserves digits", () => {
		expect(slugifyOrgName("Acme 2")).toBe("acme-2");
	});
});
