CREATE TYPE "public"."evidence_artifact_kind" AS ENUM('screenshot', 'page_snapshot');--> statement-breakpoint
CREATE TYPE "public"."evidence_artifact_status" AS ENUM('staged', 'attached');--> statement-breakpoint
CREATE TABLE "evidence_artifacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"batch_id" uuid NOT NULL,
	"brand_id" text NOT NULL,
	"scope_id" uuid NOT NULL,
	"lease_generation" integer NOT NULL,
	"uploaded_by" text NOT NULL,
	"kind" "evidence_artifact_kind" NOT NULL,
	"media_type" text NOT NULL,
	"original_filename" text,
	"byte_size" integer NOT NULL,
	"sha256" text NOT NULL,
	"storage_backend" text DEFAULT 'postgres' NOT NULL,
	"storage_key" text NOT NULL,
	"content" "bytea" NOT NULL,
	"status" "evidence_artifact_status" DEFAULT 'staged' NOT NULL,
	"observation_attempt_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"attached_at" timestamp with time zone,
	CONSTRAINT "evidence_artifacts_positive_lease_generation" CHECK ("evidence_artifacts"."lease_generation" > 0),
	CONSTRAINT "evidence_artifacts_valid_byte_size" CHECK ("evidence_artifacts"."byte_size" > 0 AND "evidence_artifacts"."byte_size" <= 8388608 AND octet_length("evidence_artifacts"."content") = "evidence_artifacts"."byte_size"),
	CONSTRAINT "evidence_artifacts_valid_sha256" CHECK ("evidence_artifacts"."sha256" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "evidence_artifacts_postgres_storage" CHECK ("evidence_artifacts"."storage_backend" = 'postgres' AND "evidence_artifacts"."storage_key" = 'evidence/' || "evidence_artifacts"."id"::text),
	CONSTRAINT "evidence_artifacts_valid_media_type" CHECK (("evidence_artifacts"."kind" = 'screenshot' AND "evidence_artifacts"."media_type" IN ('image/png', 'image/jpeg', 'image/webp')) OR ("evidence_artifacts"."kind" = 'page_snapshot' AND "evidence_artifacts"."media_type" = 'application/pdf')),
	CONSTRAINT "evidence_artifacts_state_consistent" CHECK (("evidence_artifacts"."status" = 'staged' AND "evidence_artifacts"."observation_attempt_id" IS NULL AND "evidence_artifacts"."attached_at" IS NULL) OR ("evidence_artifacts"."status" = 'attached' AND "evidence_artifacts"."observation_attempt_id" IS NOT NULL AND "evidence_artifacts"."attached_at" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "evidence_artifacts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE UNIQUE INDEX "delivery_tasks_evidence_identity_uidx" ON "delivery_tasks" USING btree ("brand_id","scope_id","batch_id","id");--> statement-breakpoint
ALTER TABLE "evidence_artifacts" ADD CONSTRAINT "evidence_artifacts_task_id_delivery_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."delivery_tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_artifacts" ADD CONSTRAINT "evidence_artifacts_observation_attempt_id_observation_attempts_id_fk" FOREIGN KEY ("observation_attempt_id") REFERENCES "public"."observation_attempts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_artifacts" ADD CONSTRAINT "evidence_artifacts_task_identity_fk" FOREIGN KEY ("brand_id","scope_id","batch_id","task_id") REFERENCES "public"."delivery_tasks"("brand_id","scope_id","batch_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "evidence_artifacts_task_generation_sha_uidx" ON "evidence_artifacts" USING btree ("task_id","lease_generation","sha256");--> statement-breakpoint
CREATE INDEX "evidence_artifacts_task_status_created_idx" ON "evidence_artifacts" USING btree ("task_id","status","created_at");--> statement-breakpoint
CREATE INDEX "evidence_artifacts_attempt_id_idx" ON "evidence_artifacts" USING btree ("observation_attempt_id");--> statement-breakpoint

CREATE FUNCTION "enforce_evidence_artifact"() RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
	task delivery_tasks%ROWTYPE;
	attempt observation_attempts%ROWTYPE;
BEGIN
	IF TG_OP = 'DELETE' THEN
		IF OLD.status <> 'staged' THEN
			RAISE EXCEPTION 'attached evidence artifact % cannot be deleted', OLD.id;
		END IF;
		RETURN OLD;
	END IF;

	SELECT * INTO task FROM delivery_tasks WHERE id = NEW.task_id;
	IF NOT FOUND OR
		task.brand_id IS DISTINCT FROM NEW.brand_id OR
		task.scope_id IS DISTINCT FROM NEW.scope_id OR
		task.batch_id IS DISTINCT FROM NEW.batch_id THEN
		RAISE EXCEPTION 'evidence artifact does not match delivery task %', NEW.task_id;
	END IF;
	IF btrim(NEW.uploaded_by) = '' THEN
		RAISE EXCEPTION 'evidence artifact uploader must not be empty';
	END IF;

	IF TG_OP = 'INSERT' THEN
		IF NEW.status <> 'staged' OR task.status <> 'claimed' OR
			NEW.lease_generation IS DISTINCT FROM task.lease_generation OR
			NEW.uploaded_by IS DISTINCT FROM task.claimed_by OR
			task.lease_expires_at IS NULL OR task.lease_expires_at <= clock_timestamp() THEN
			RAISE EXCEPTION 'evidence artifact must be staged against the current claimed task generation';
		END IF;
		RETURN NEW;
	END IF;

	IF OLD.status = 'attached' THEN
		RAISE EXCEPTION 'attached evidence artifact % cannot be changed', OLD.id;
	END IF;
	IF NEW.id IS DISTINCT FROM OLD.id OR
		NEW.task_id IS DISTINCT FROM OLD.task_id OR
		NEW.batch_id IS DISTINCT FROM OLD.batch_id OR
		NEW.brand_id IS DISTINCT FROM OLD.brand_id OR
		NEW.scope_id IS DISTINCT FROM OLD.scope_id OR
		NEW.lease_generation IS DISTINCT FROM OLD.lease_generation OR
		NEW.uploaded_by IS DISTINCT FROM OLD.uploaded_by OR
		NEW.kind IS DISTINCT FROM OLD.kind OR
		NEW.media_type IS DISTINCT FROM OLD.media_type OR
		NEW.original_filename IS DISTINCT FROM OLD.original_filename OR
		NEW.byte_size IS DISTINCT FROM OLD.byte_size OR
		NEW.sha256 IS DISTINCT FROM OLD.sha256 OR
		NEW.storage_backend IS DISTINCT FROM OLD.storage_backend OR
		NEW.storage_key IS DISTINCT FROM OLD.storage_key OR
		NEW.content IS DISTINCT FROM OLD.content OR
		NEW.created_at IS DISTINCT FROM OLD.created_at THEN
		RAISE EXCEPTION 'evidence artifact % content and identity are immutable', OLD.id;
	END IF;
	IF OLD.status <> 'staged' OR NEW.status <> 'attached' THEN
		RAISE EXCEPTION 'invalid evidence artifact transition from % to %', OLD.status, NEW.status;
	END IF;
	IF task.status <> 'claimed' OR NEW.lease_generation IS DISTINCT FROM task.lease_generation OR
		NEW.uploaded_by IS DISTINCT FROM task.claimed_by OR
		task.lease_expires_at IS NULL OR task.lease_expires_at <= clock_timestamp() THEN
		RAISE EXCEPTION 'evidence artifact must be attached by the current claimed task generation';
	END IF;

	SELECT * INTO attempt FROM observation_attempts WHERE id = NEW.observation_attempt_id;
	IF NOT FOUND OR attempt.status <> 'succeeded' OR
		attempt.brand_id IS DISTINCT FROM task.brand_id OR
		attempt.scope_id IS DISTINCT FROM task.scope_id OR
		attempt.prompt_id IS DISTINCT FROM task.prompt_id OR
		attempt.prompt_text IS DISTINCT FROM task.prompt_text OR
		attempt.surface_target_key IS DISTINCT FROM task.surface_target_key OR
		attempt.capture_route_key IS DISTINCT FROM task.capture_route_key OR
		attempt.sample_index IS DISTINCT FROM task.sample_index THEN
		RAISE EXCEPTION 'observation attempt does not match evidence artifact task %', NEW.task_id;
	END IF;
	RETURN NEW;
END;
$$;--> statement-breakpoint

CREATE TRIGGER "evidence_artifacts_enforce_lifecycle"
BEFORE INSERT OR UPDATE OR DELETE ON "evidence_artifacts"
FOR EACH ROW EXECUTE FUNCTION "enforce_evidence_artifact"();--> statement-breakpoint

CREATE FUNCTION "enforce_attached_evidence_task_attempt"() RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
	task_attempt_id uuid;
BEGIN
	SELECT observation_attempt_id INTO task_attempt_id FROM delivery_tasks WHERE id = NEW.task_id;
	IF task_attempt_id IS DISTINCT FROM NEW.observation_attempt_id THEN
		RAISE EXCEPTION 'attached evidence artifact % does not match the delivery task observation attempt', NEW.id;
	END IF;
	RETURN NULL;
END;
$$;--> statement-breakpoint

CREATE CONSTRAINT TRIGGER "evidence_artifacts_task_attempt_consistent"
AFTER INSERT OR UPDATE ON "evidence_artifacts"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW WHEN (NEW.status = 'attached')
EXECUTE FUNCTION "enforce_attached_evidence_task_attempt"();
