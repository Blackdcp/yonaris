CREATE TYPE "public"."overseas_run_call_status" AS ENUM('queued', 'running', 'succeeded', 'failed');--> statement-breakpoint
CREATE TYPE "public"."overseas_run_cohort_status" AS ENUM('dispatch_pending', 'running', 'completed');--> statement-breakpoint
CREATE TABLE "overseas_run_calls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cohort_id" uuid NOT NULL,
	"brand_id" text NOT NULL,
	"scope_id" uuid NOT NULL,
	"prompt_id" uuid NOT NULL,
	"prompt_text" text NOT NULL,
	"channel_key" text NOT NULL,
	"model" text NOT NULL,
	"provider" text NOT NULL,
	"requested_version" text,
	"web_search_enabled" boolean NOT NULL,
	"surface_target_key" text NOT NULL,
	"capture_route_key" text NOT NULL,
	"sample_index" smallint NOT NULL,
	"status" "overseas_run_call_status" DEFAULT 'queued' NOT NULL,
	"job_dispatched_at" timestamp with time zone,
	"paid_intent_at" timestamp with time zone,
	"provider_submission_id" text,
	"observation_attempt_id" uuid,
	"prompt_run_id" uuid,
	"failure_class" text,
	"failure_code" text,
	"failure_message" text,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "overseas_run_calls_valid_sample_index" CHECK ("overseas_run_calls"."sample_index" BETWEEN 1 AND 5),
	CONSTRAINT "overseas_run_calls_brightdata_only" CHECK ("overseas_run_calls"."provider" = 'brightdata'),
	CONSTRAINT "overseas_run_calls_lifecycle_consistent" CHECK (("overseas_run_calls"."status" = 'queued' AND "overseas_run_calls"."started_at" IS NULL AND "overseas_run_calls"."completed_at" IS NULL AND "overseas_run_calls"."paid_intent_at" IS NULL AND "overseas_run_calls"."observation_attempt_id" IS NULL AND "overseas_run_calls"."prompt_run_id" IS NULL) OR ("overseas_run_calls"."status" = 'running' AND "overseas_run_calls"."started_at" IS NOT NULL AND "overseas_run_calls"."completed_at" IS NULL AND "overseas_run_calls"."prompt_run_id" IS NULL) OR ("overseas_run_calls"."status" = 'succeeded' AND "overseas_run_calls"."started_at" IS NOT NULL AND "overseas_run_calls"."completed_at" IS NOT NULL AND "overseas_run_calls"."paid_intent_at" IS NOT NULL AND "overseas_run_calls"."observation_attempt_id" IS NOT NULL AND "overseas_run_calls"."prompt_run_id" IS NOT NULL AND "overseas_run_calls"."failure_class" IS NULL AND "overseas_run_calls"."failure_code" IS NULL AND "overseas_run_calls"."failure_message" IS NULL) OR ("overseas_run_calls"."status" = 'failed' AND "overseas_run_calls"."started_at" IS NOT NULL AND "overseas_run_calls"."completed_at" IS NOT NULL AND "overseas_run_calls"."failure_class" IS NOT NULL AND "overseas_run_calls"."failure_code" IS NOT NULL AND "overseas_run_calls"."failure_message" IS NOT NULL AND "overseas_run_calls"."prompt_run_id" IS NULL))
);
--> statement-breakpoint
ALTER TABLE "overseas_run_calls" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "overseas_run_cohorts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" text NOT NULL,
	"scope_id" uuid NOT NULL,
	"idempotency_key" text NOT NULL,
	"manifest" json NOT NULL,
	"manifest_fingerprint" text NOT NULL,
	"status" "overseas_run_cohort_status" DEFAULT 'dispatch_pending' NOT NULL,
	"planned_call_count" integer NOT NULL,
	"created_by" text NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "overseas_run_cohorts_valid_manifest_fingerprint" CHECK ("overseas_run_cohorts"."manifest_fingerprint" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "overseas_run_cohorts_positive_planned_call_count" CHECK ("overseas_run_cohorts"."planned_call_count" > 0 AND "overseas_run_cohorts"."planned_call_count" <= 10000),
	CONSTRAINT "overseas_run_cohorts_lifecycle_consistent" CHECK (("overseas_run_cohorts"."status" = 'dispatch_pending' AND "overseas_run_cohorts"."started_at" IS NULL AND "overseas_run_cohorts"."completed_at" IS NULL) OR ("overseas_run_cohorts"."status" = 'running' AND "overseas_run_cohorts"."started_at" IS NOT NULL AND "overseas_run_cohorts"."completed_at" IS NULL) OR ("overseas_run_cohorts"."status" = 'completed' AND "overseas_run_cohorts"."started_at" IS NOT NULL AND "overseas_run_cohorts"."completed_at" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "overseas_run_cohorts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "overseas_run_calls" ADD CONSTRAINT "overseas_run_calls_cohort_id_overseas_run_cohorts_id_fk" FOREIGN KEY ("cohort_id") REFERENCES "public"."overseas_run_cohorts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "overseas_run_calls" ADD CONSTRAINT "overseas_run_calls_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "overseas_run_calls" ADD CONSTRAINT "overseas_run_calls_prompt_id_prompts_id_fk" FOREIGN KEY ("prompt_id") REFERENCES "public"."prompts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "overseas_run_calls" ADD CONSTRAINT "overseas_run_calls_observation_attempt_id_observation_attempts_id_fk" FOREIGN KEY ("observation_attempt_id") REFERENCES "public"."observation_attempts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "overseas_run_calls" ADD CONSTRAINT "overseas_run_calls_prompt_run_id_prompt_runs_id_fk" FOREIGN KEY ("prompt_run_id") REFERENCES "public"."prompt_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "overseas_run_calls" ADD CONSTRAINT "overseas_run_calls_brand_scope_fk" FOREIGN KEY ("brand_id","scope_id") REFERENCES "public"."measurement_scopes"("brand_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "overseas_run_calls" ADD CONSTRAINT "overseas_run_calls_prompt_identity_fk" FOREIGN KEY ("brand_id","scope_id","prompt_id") REFERENCES "public"."prompts"("brand_id","scope_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "overseas_run_cohorts" ADD CONSTRAINT "overseas_run_cohorts_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "overseas_run_cohorts" ADD CONSTRAINT "overseas_run_cohorts_brand_scope_fk" FOREIGN KEY ("brand_id","scope_id") REFERENCES "public"."measurement_scopes"("brand_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "overseas_run_calls_cohort_slot_uidx" ON "overseas_run_calls" USING btree ("cohort_id","prompt_id","surface_target_key","sample_index");--> statement-breakpoint
CREATE INDEX "overseas_run_calls_cohort_status_created_idx" ON "overseas_run_calls" USING btree ("cohort_id","status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "overseas_run_calls_observation_attempt_uidx" ON "overseas_run_calls" USING btree ("observation_attempt_id");--> statement-breakpoint
CREATE UNIQUE INDEX "overseas_run_calls_prompt_run_uidx" ON "overseas_run_calls" USING btree ("prompt_run_id");--> statement-breakpoint
CREATE UNIQUE INDEX "overseas_run_cohorts_brand_idempotency_uidx" ON "overseas_run_cohorts" USING btree ("brand_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "overseas_run_cohorts_brand_scope_created_idx" ON "overseas_run_cohorts" USING btree ("brand_id","scope_id","created_at");