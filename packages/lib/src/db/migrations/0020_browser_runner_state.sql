CREATE TYPE "public"."delivery_execution_mode" AS ENUM('manual', 'browser_runner');--> statement-breakpoint
CREATE TYPE "public"."browser_runner_batch_status" AS ENUM('not_started', 'running', 'needs_human', 'settled');--> statement-breakpoint
CREATE TYPE "public"."browser_runner_task_status" AS ENUM('queued', 'running', 'needs_human', 'completed');--> statement-breakpoint
ALTER TABLE "delivery_batches" ADD COLUMN "execution_mode" "delivery_execution_mode" DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "delivery_batches" ADD COLUMN "automation_status" "browser_runner_batch_status";--> statement-breakpoint
ALTER TABLE "delivery_batches" ADD COLUMN "automation_started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "delivery_batches" ADD COLUMN "automation_settled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "delivery_tasks" ADD COLUMN "automation_status" "browser_runner_task_status";--> statement-breakpoint
ALTER TABLE "delivery_tasks" ADD COLUMN "automation_attempt_count" smallint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "delivery_tasks" ADD COLUMN "runner_session_id" text;--> statement-breakpoint
ALTER TABLE "delivery_tasks" ADD COLUMN "submit_intent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "delivery_tasks" ADD COLUMN "submit_confirmed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "delivery_tasks" ADD COLUMN "needs_human_code" text;--> statement-breakpoint
ALTER TABLE "delivery_tasks" ADD COLUMN "needs_human_reason" text;--> statement-breakpoint
ALTER TABLE "delivery_tasks" ADD CONSTRAINT "delivery_tasks_nonnegative_automation_attempt_count" CHECK ("delivery_tasks"."automation_attempt_count" >= 0);--> statement-breakpoint
ALTER TABLE "delivery_batches" ADD CONSTRAINT "delivery_batches_execution_state_consistent" CHECK (("delivery_batches"."execution_mode" = 'manual' AND "delivery_batches"."automation_status" IS NULL AND "delivery_batches"."automation_started_at" IS NULL AND "delivery_batches"."automation_settled_at" IS NULL) OR ("delivery_batches"."execution_mode" = 'browser_runner' AND "delivery_batches"."automation_status" IS NOT NULL));--> statement-breakpoint
ALTER TABLE "delivery_tasks" ADD CONSTRAINT "delivery_tasks_automation_state_consistent" CHECK (("delivery_tasks"."automation_status" IS NULL AND "delivery_tasks"."automation_attempt_count" = 0 AND "delivery_tasks"."runner_session_id" IS NULL AND "delivery_tasks"."submit_intent_at" IS NULL AND "delivery_tasks"."submit_confirmed_at" IS NULL AND "delivery_tasks"."needs_human_code" IS NULL AND "delivery_tasks"."needs_human_reason" IS NULL) OR ("delivery_tasks"."automation_status" = 'queued' AND "delivery_tasks"."status" IN ('planned', 'available') AND "delivery_tasks"."lease_token_hash" IS NULL AND "delivery_tasks"."lease_expires_at" IS NULL AND "delivery_tasks"."runner_session_id" IS NULL AND "delivery_tasks"."submit_intent_at" IS NULL AND "delivery_tasks"."submit_confirmed_at" IS NULL AND "delivery_tasks"."needs_human_code" IS NULL AND "delivery_tasks"."needs_human_reason" IS NULL) OR ("delivery_tasks"."automation_status" = 'running' AND "delivery_tasks"."status" = 'claimed' AND "delivery_tasks"."lease_token_hash" IS NOT NULL AND "delivery_tasks"."lease_expires_at" IS NOT NULL) OR ("delivery_tasks"."automation_status" = 'needs_human' AND "delivery_tasks"."status" = 'available' AND "delivery_tasks"."lease_token_hash" IS NULL AND "delivery_tasks"."lease_expires_at" IS NULL AND "delivery_tasks"."needs_human_code" IS NOT NULL AND "delivery_tasks"."needs_human_reason" IS NOT NULL) OR ("delivery_tasks"."automation_status" = 'completed' AND "delivery_tasks"."status" IN ('succeeded', 'failed', 'cancelled')));--> statement-breakpoint
ALTER TABLE "delivery_tasks" ADD CONSTRAINT "delivery_tasks_runner_session_state_consistent" CHECK (("delivery_tasks"."runner_session_id" IS NULL AND "delivery_tasks"."submit_intent_at" IS NULL AND "delivery_tasks"."submit_confirmed_at" IS NULL) OR ("delivery_tasks"."runner_session_id" IS NOT NULL AND char_length("delivery_tasks"."runner_session_id") BETWEEN 1 AND 300 AND "delivery_tasks"."submit_intent_at" IS NOT NULL));--> statement-breakpoint
CREATE FUNCTION "enforce_delivery_task_execution_mode"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE batch_mode delivery_execution_mode;
BEGIN
	SELECT execution_mode INTO batch_mode FROM delivery_batches WHERE id = NEW.batch_id;
	IF batch_mode IS NULL THEN RAISE EXCEPTION 'delivery batch % was not found', NEW.batch_id; END IF;
	IF (batch_mode = 'manual' AND NEW.automation_status IS NOT NULL) OR
		(batch_mode = 'browser_runner' AND NEW.automation_status IS NULL) THEN
		RAISE EXCEPTION 'delivery task automation state does not match batch execution mode';
	END IF;
	RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER "delivery_tasks_enforce_execution_mode" BEFORE INSERT OR UPDATE ON "delivery_tasks" FOR EACH ROW EXECUTE FUNCTION "enforce_delivery_task_execution_mode"();--> statement-breakpoint
CREATE INDEX "delivery_tasks_automation_queue_idx" ON "delivery_tasks" USING btree ("batch_id", "automation_status", "created_at");--> statement-breakpoint
ALTER TABLE "evidence_artifacts" DROP CONSTRAINT "evidence_artifacts_valid_media_type";--> statement-breakpoint
ALTER TABLE "evidence_artifacts" ADD CONSTRAINT "evidence_artifacts_valid_media_type" CHECK (("evidence_artifacts"."kind" = 'screenshot' AND "evidence_artifacts"."media_type" IN ('image/png', 'image/jpeg', 'image/webp')) OR ("evidence_artifacts"."kind" = 'page_snapshot' AND "evidence_artifacts"."media_type" IN ('application/pdf', 'text/html')));
