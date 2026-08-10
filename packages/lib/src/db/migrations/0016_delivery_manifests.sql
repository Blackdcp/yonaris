CREATE TYPE "public"."delivery_batch_status" AS ENUM('draft', 'frozen', 'in_progress', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."delivery_evaluation_role" AS ENUM('scored', 'observation');--> statement-breakpoint
CREATE TYPE "public"."delivery_search_requirement" AS ENUM('not_applicable', 'required', 'forbidden');--> statement-breakpoint
CREATE TYPE "public"."delivery_session_requirement" AS ENUM('none', 'anonymous_clean', 'new_account_clean');--> statement-breakpoint
CREATE TYPE "public"."delivery_task_status" AS ENUM('planned', 'available', 'claimed', 'succeeded', 'failed', 'cancelled');--> statement-breakpoint
CREATE TABLE "delivery_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" text NOT NULL,
	"scope_id" uuid NOT NULL,
	"idempotency_key" text NOT NULL,
	"name" text NOT NULL,
	"status" "delivery_batch_status" DEFAULT 'draft' NOT NULL,
	"planned_task_count" integer DEFAULT 0 NOT NULL,
	"protocol" json DEFAULT '{}'::json NOT NULL,
	"manifest_snapshot" json,
	"manifest_hash" text,
	"created_by" text,
	"frozen_by" text,
	"cancelled_by" text,
	"frozen_at" timestamp with time zone,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "delivery_batches_nonnegative_planned_task_count" CHECK ("delivery_batches"."planned_task_count" >= 0),
	CONSTRAINT "delivery_batches_frozen_manifest_present" CHECK ("delivery_batches"."status" IN ('draft', 'cancelled') OR ("delivery_batches"."planned_task_count" > 0 AND "delivery_batches"."manifest_snapshot" IS NOT NULL AND "delivery_batches"."manifest_hash" IS NOT NULL AND "delivery_batches"."frozen_at" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "delivery_batches" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "delivery_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" uuid NOT NULL,
	"brand_id" text NOT NULL,
	"scope_id" uuid NOT NULL,
	"prompt_id" uuid NOT NULL,
	"prompt_text" text NOT NULL,
	"surface_target_key" text NOT NULL,
	"capture_route_key" text NOT NULL,
	"sample_index" smallint NOT NULL,
	"session_requirement" "delivery_session_requirement" NOT NULL,
	"search_requirement" "delivery_search_requirement" NOT NULL,
	"evaluation_role" "delivery_evaluation_role" DEFAULT 'scored' NOT NULL,
	"slot_key" text NOT NULL,
	"status" "delivery_task_status" DEFAULT 'planned' NOT NULL,
	"observation_attempt_id" uuid,
	"claimed_by" text,
	"lease_token_hash" text,
	"lease_generation" integer DEFAULT 0 NOT NULL,
	"lease_expires_at" timestamp with time zone,
	"claim_count" smallint DEFAULT 0 NOT NULL,
	"last_error_class" text,
	"last_error_code" text,
	"last_error_message" text,
	"available_at" timestamp with time zone,
	"claimed_at" timestamp with time zone,
	"succeeded_at" timestamp with time zone,
	"failed_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "delivery_tasks_positive_sample_index" CHECK ("delivery_tasks"."sample_index" > 0),
	CONSTRAINT "delivery_tasks_nonnegative_claim_count" CHECK ("delivery_tasks"."claim_count" >= 0),
	CONSTRAINT "delivery_tasks_nonnegative_lease_generation" CHECK ("delivery_tasks"."lease_generation" >= 0),
	CONSTRAINT "delivery_tasks_lease_state_consistent" CHECK (("delivery_tasks"."status" = 'claimed' AND "delivery_tasks"."claimed_by" IS NOT NULL AND "delivery_tasks"."lease_token_hash" IS NOT NULL AND "delivery_tasks"."lease_expires_at" IS NOT NULL AND "delivery_tasks"."claimed_at" IS NOT NULL) OR ("delivery_tasks"."status" <> 'claimed' AND "delivery_tasks"."lease_token_hash" IS NULL AND "delivery_tasks"."lease_expires_at" IS NULL)),
	CONSTRAINT "delivery_tasks_terminal_state_consistent" CHECK (("delivery_tasks"."status" = 'succeeded' AND "delivery_tasks"."observation_attempt_id" IS NOT NULL AND "delivery_tasks"."succeeded_at" IS NOT NULL AND "delivery_tasks"."failed_at" IS NULL AND "delivery_tasks"."cancelled_at" IS NULL) OR ("delivery_tasks"."status" = 'failed' AND "delivery_tasks"."succeeded_at" IS NULL AND "delivery_tasks"."failed_at" IS NOT NULL AND "delivery_tasks"."cancelled_at" IS NULL) OR ("delivery_tasks"."status" = 'cancelled' AND "delivery_tasks"."succeeded_at" IS NULL AND "delivery_tasks"."failed_at" IS NULL AND "delivery_tasks"."cancelled_at" IS NOT NULL) OR ("delivery_tasks"."status" IN ('planned', 'available', 'claimed') AND "delivery_tasks"."succeeded_at" IS NULL AND "delivery_tasks"."failed_at" IS NULL AND "delivery_tasks"."cancelled_at" IS NULL))
);
--> statement-breakpoint
ALTER TABLE "delivery_tasks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE UNIQUE INDEX "delivery_batches_identity_uidx" ON "delivery_batches" USING btree ("brand_id","scope_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "prompts_brand_scope_id_uidx" ON "prompts" USING btree ("brand_id","scope_id","id");--> statement-breakpoint
ALTER TABLE "delivery_batches" ADD CONSTRAINT "delivery_batches_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_batches" ADD CONSTRAINT "delivery_batches_brand_scope_fk" FOREIGN KEY ("brand_id","scope_id") REFERENCES "public"."measurement_scopes"("brand_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_tasks" ADD CONSTRAINT "delivery_tasks_observation_attempt_id_observation_attempts_id_fk" FOREIGN KEY ("observation_attempt_id") REFERENCES "public"."observation_attempts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_tasks" ADD CONSTRAINT "delivery_tasks_batch_identity_fk" FOREIGN KEY ("brand_id","scope_id","batch_id") REFERENCES "public"."delivery_batches"("brand_id","scope_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_tasks" ADD CONSTRAINT "delivery_tasks_prompt_identity_fk" FOREIGN KEY ("brand_id","scope_id","prompt_id") REFERENCES "public"."prompts"("brand_id","scope_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "delivery_batches_brand_idempotency_uidx" ON "delivery_batches" USING btree ("brand_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "delivery_batches_scope_status_created_idx" ON "delivery_batches" USING btree ("brand_id","scope_id","status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "delivery_tasks_batch_slot_uidx" ON "delivery_tasks" USING btree ("batch_id","slot_key");--> statement-breakpoint
CREATE UNIQUE INDEX "delivery_tasks_batch_manifest_slot_uidx" ON "delivery_tasks" USING btree ("batch_id","prompt_id","surface_target_key","capture_route_key","sample_index","session_requirement","search_requirement","evaluation_role");--> statement-breakpoint
CREATE UNIQUE INDEX "delivery_tasks_observation_attempt_id_uidx" ON "delivery_tasks" USING btree ("observation_attempt_id");--> statement-breakpoint
CREATE INDEX "delivery_tasks_batch_status_lease_idx" ON "delivery_tasks" USING btree ("batch_id","status","lease_expires_at","created_at");--> statement-breakpoint
CREATE INDEX "delivery_tasks_scope_target_status_idx" ON "delivery_tasks" USING btree ("brand_id","scope_id","surface_target_key","status");--> statement-breakpoint

CREATE FUNCTION "enforce_delivery_batch_manifest"() RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
	task_count integer;
BEGIN
	IF OLD.status = 'completed' OR OLD.status = 'cancelled' THEN
		IF (to_jsonb(NEW) - 'updated_at') IS DISTINCT FROM (to_jsonb(OLD) - 'updated_at') THEN
			RAISE EXCEPTION 'delivery batch % is terminal and cannot be changed', OLD.id;
		END IF;
	END IF;

	IF NOT (
		(OLD.status = 'draft' AND NEW.status IN ('draft', 'frozen', 'cancelled')) OR
		(OLD.status = 'frozen' AND NEW.status IN ('frozen', 'in_progress', 'cancelled')) OR
		(OLD.status = 'in_progress' AND NEW.status IN ('in_progress', 'completed', 'cancelled')) OR
		(OLD.status = 'completed' AND NEW.status = 'completed') OR
		(OLD.status = 'cancelled' AND NEW.status = 'cancelled')
	) THEN
		RAISE EXCEPTION 'invalid delivery batch transition from % to %', OLD.status, NEW.status;
	END IF;

	IF OLD.status <> 'draft' AND (
		NEW.brand_id IS DISTINCT FROM OLD.brand_id OR
		NEW.scope_id IS DISTINCT FROM OLD.scope_id OR
		NEW.idempotency_key IS DISTINCT FROM OLD.idempotency_key OR
		NEW.name IS DISTINCT FROM OLD.name OR
		NEW.protocol::jsonb IS DISTINCT FROM OLD.protocol::jsonb OR
		NEW.planned_task_count IS DISTINCT FROM OLD.planned_task_count OR
		NEW.manifest_snapshot::jsonb IS DISTINCT FROM OLD.manifest_snapshot::jsonb OR
		NEW.manifest_hash IS DISTINCT FROM OLD.manifest_hash OR
		NEW.frozen_by IS DISTINCT FROM OLD.frozen_by OR
		NEW.frozen_at IS DISTINCT FROM OLD.frozen_at
	) THEN
		RAISE EXCEPTION 'delivery batch % manifest is frozen', OLD.id;
	END IF;

	IF OLD.status = 'draft' AND NEW.status = 'frozen' THEN
		IF NEW.manifest_hash !~ '^[0-9a-f]{64}$' THEN
			RAISE EXCEPTION 'delivery batch % manifest hash is invalid', OLD.id;
		END IF;
		SELECT count(*) INTO task_count FROM delivery_tasks WHERE batch_id = OLD.id;
		IF task_count = 0 OR task_count <> NEW.planned_task_count THEN
			RAISE EXCEPTION 'delivery batch % planned task count does not match its manifest', OLD.id;
		END IF;
		IF EXISTS (SELECT 1 FROM delivery_tasks WHERE batch_id = OLD.id AND status <> 'planned') THEN
			RAISE EXCEPTION 'delivery batch % contains a non-planned task before freezing', OLD.id;
		END IF;
	END IF;

	IF NEW.status = 'completed' AND EXISTS (
		SELECT 1 FROM delivery_tasks WHERE batch_id = OLD.id AND status NOT IN ('succeeded', 'failed', 'cancelled')
	) THEN
		RAISE EXCEPTION 'delivery batch % still contains unresolved tasks', OLD.id;
	END IF;

	RETURN NEW;
END;
$$;--> statement-breakpoint

CREATE TRIGGER "delivery_batches_enforce_manifest"
BEFORE UPDATE ON "delivery_batches"
FOR EACH ROW EXECUTE FUNCTION "enforce_delivery_batch_manifest"();--> statement-breakpoint

CREATE FUNCTION "enforce_delivery_task_manifest"() RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
	batch_status delivery_batch_status;
	old_batch_status delivery_batch_status;
	attempt observation_attempts%ROWTYPE;
BEGIN
	IF TG_OP = 'INSERT' THEN
		SELECT status INTO batch_status FROM delivery_batches WHERE id = NEW.batch_id;
		IF batch_status IS DISTINCT FROM 'draft' THEN
			RAISE EXCEPTION 'tasks can only be added to a draft delivery batch';
		END IF;
		IF NEW.slot_key !~ '^[0-9a-f]{64}$' THEN
			RAISE EXCEPTION 'delivery task slot key must be a SHA-256 digest';
		END IF;
		RETURN NEW;
	END IF;

	IF TG_OP = 'DELETE' THEN
		SELECT status INTO batch_status FROM delivery_batches WHERE id = OLD.batch_id;
		IF batch_status IS DISTINCT FROM 'draft' THEN
			RAISE EXCEPTION 'tasks cannot be deleted after a delivery batch is frozen';
		END IF;
		RETURN OLD;
	END IF;

	SELECT status INTO batch_status FROM delivery_batches WHERE id = NEW.batch_id;
	SELECT status INTO old_batch_status FROM delivery_batches WHERE id = OLD.batch_id;

	IF OLD.status IN ('succeeded', 'failed', 'cancelled') AND
		(to_jsonb(NEW) - 'updated_at') IS DISTINCT FROM (to_jsonb(OLD) - 'updated_at') THEN
		RAISE EXCEPTION 'delivery task % is terminal and cannot be changed', OLD.id;
	END IF;

	IF (batch_status <> 'draft' OR old_batch_status <> 'draft') AND (
		NEW.batch_id IS DISTINCT FROM OLD.batch_id OR
		NEW.brand_id IS DISTINCT FROM OLD.brand_id OR
		NEW.scope_id IS DISTINCT FROM OLD.scope_id OR
		NEW.prompt_id IS DISTINCT FROM OLD.prompt_id OR
		NEW.prompt_text IS DISTINCT FROM OLD.prompt_text OR
		NEW.surface_target_key IS DISTINCT FROM OLD.surface_target_key OR
		NEW.capture_route_key IS DISTINCT FROM OLD.capture_route_key OR
		NEW.sample_index IS DISTINCT FROM OLD.sample_index OR
		NEW.session_requirement IS DISTINCT FROM OLD.session_requirement OR
		NEW.search_requirement IS DISTINCT FROM OLD.search_requirement OR
		NEW.evaluation_role IS DISTINCT FROM OLD.evaluation_role OR
		NEW.slot_key IS DISTINCT FROM OLD.slot_key
	) THEN
		RAISE EXCEPTION 'delivery task % manifest identity is frozen', OLD.id;
	END IF;

	IF NOT (
		(OLD.status = 'planned' AND NEW.status IN ('planned', 'available', 'cancelled')) OR
		(OLD.status = 'available' AND NEW.status IN ('available', 'claimed', 'cancelled')) OR
		(OLD.status = 'claimed' AND NEW.status IN ('available', 'claimed', 'succeeded', 'failed', 'cancelled')) OR
		(OLD.status = 'succeeded' AND NEW.status = 'succeeded') OR
		(OLD.status = 'failed' AND NEW.status = 'failed') OR
		(OLD.status = 'cancelled' AND NEW.status = 'cancelled')
	) THEN
		RAISE EXCEPTION 'invalid delivery task transition from % to %', OLD.status, NEW.status;
	END IF;

	IF NEW.status = 'claimed' AND (
		NEW.lease_token_hash !~ '^[0-9a-f]{64}$' OR
		((OLD.status <> 'claimed' OR NEW.lease_token_hash IS DISTINCT FROM OLD.lease_token_hash) AND
			NEW.lease_generation <= OLD.lease_generation)
	) THEN
		RAISE EXCEPTION 'delivery task % claim does not advance a hashed lease generation', OLD.id;
	END IF;

	IF NEW.observation_attempt_id IS NOT NULL THEN
		SELECT * INTO attempt FROM observation_attempts WHERE id = NEW.observation_attempt_id;
		IF NOT FOUND OR
			attempt.brand_id IS DISTINCT FROM NEW.brand_id OR
			attempt.scope_id IS DISTINCT FROM NEW.scope_id OR
			attempt.prompt_id IS DISTINCT FROM NEW.prompt_id OR
			attempt.prompt_text IS DISTINCT FROM NEW.prompt_text OR
			attempt.surface_target_key IS DISTINCT FROM NEW.surface_target_key OR
			attempt.capture_route_key IS DISTINCT FROM NEW.capture_route_key OR
			attempt.sample_index IS DISTINCT FROM NEW.sample_index THEN
			RAISE EXCEPTION 'observation attempt does not match delivery task %', NEW.id;
		END IF;
		IF (NEW.status = 'succeeded' AND attempt.status <> 'succeeded') OR
			(NEW.status = 'failed' AND attempt.status <> 'failed') OR
			NEW.status NOT IN ('succeeded', 'failed') THEN
			RAISE EXCEPTION 'observation attempt status does not match delivery task %', NEW.id;
		END IF;
	END IF;

	RETURN NEW;
END;
$$;--> statement-breakpoint

CREATE TRIGGER "delivery_tasks_enforce_manifest"
BEFORE INSERT OR UPDATE OR DELETE ON "delivery_tasks"
FOR EACH ROW EXECUTE FUNCTION "enforce_delivery_task_manifest"();
