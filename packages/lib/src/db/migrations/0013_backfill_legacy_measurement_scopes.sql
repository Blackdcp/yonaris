SET lock_timeout = '5s';
SET statement_timeout = '15min';

-- Historical runs did not record a trustworthy market or language. Preserve
-- that uncertainty instead of relabelling them as US/en or CN/zh-CN.
INSERT INTO "measurement_scopes" (
	"brand_id",
	"key",
	"name",
	"market",
	"locale",
	"timezone",
	"enabled",
	"is_default"
)
SELECT
	"id",
	'legacy-unspecified',
	'Legacy / Unspecified',
	'ZZ',
	'und',
	'UTC',
	true,
	true
FROM "brands"
ON CONFLICT ("brand_id", "key") DO NOTHING;
--> statement-breakpoint

UPDATE "prompts" AS p
SET "scope_id" = s."id"
FROM "measurement_scopes" AS s
WHERE s."brand_id" = p."brand_id"
	AND s."key" = 'legacy-unspecified'
	AND p."scope_id" IS NULL;
--> statement-breakpoint

UPDATE "prompt_runs" AS pr
SET "scope_id" = p."scope_id"
FROM "prompts" AS p
WHERE p."id" = pr."prompt_id"
	AND pr."scope_id" IS NULL;
--> statement-breakpoint

UPDATE "prompt_runs"
SET
	"observed_at" = COALESCE("observed_at", "created_at"),
	"surface_target_key" = COALESCE("surface_target_key", 'legacy.' || "model" || '.unspecified'),
	"capture_route_key" = COALESCE("capture_route_key", 'legacy.' || COALESCE("provider", 'unknown'));
