SET lock_timeout = '5s';
SET statement_timeout = '15min';

UPDATE "measurement_scopes"
SET
    "is_default" = false,
    "updated_at" = NOW()
WHERE
    "key" = 'legacy-unspecified'
    AND "sampling_evaluation_role" IS NULL
    AND "is_default" = true
    AND NOT EXISTS (
        SELECT 1
        FROM "prompts" p
        WHERE p."scope_id" = "measurement_scopes"."id"
    );
