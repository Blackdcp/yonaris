CREATE TYPE "public"."observation_status" AS ENUM('pending', 'running', 'succeeded', 'failed', 'cancelled');--> statement-breakpoint
CREATE TABLE "measurement_scopes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" text NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"market" text NOT NULL,
	"locale" text NOT NULL,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "measurement_scopes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "observation_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_key" text NOT NULL,
	"source_job_id" text,
	"prompt_id" uuid NOT NULL,
	"prompt_text" text NOT NULL,
	"brand_id" text NOT NULL,
	"scope_id" uuid NOT NULL,
	"surface_target_key" text NOT NULL,
	"capture_route_key" text NOT NULL,
	"model" text NOT NULL,
	"provider" text NOT NULL,
	"requested_version" text,
	"web_search_enabled" boolean NOT NULL,
	"sample_index" smallint NOT NULL,
	"execution_count" smallint DEFAULT 1 NOT NULL,
	"status" "observation_status" DEFAULT 'pending' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"latency_ms" integer,
	"error_class" text,
	"error_code" text,
	"error_message" text,
	"failure_stage" text,
	"capture_metadata" json DEFAULT '{}'::json NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "observation_attempts_positive_sample_index" CHECK ("observation_attempts"."sample_index" > 0)
);
--> statement-breakpoint
ALTER TABLE "observation_attempts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "prompt_runs" ADD COLUMN "observation_attempt_id" uuid;--> statement-breakpoint
ALTER TABLE "prompt_runs" ADD COLUMN "scope_id" uuid;--> statement-breakpoint
ALTER TABLE "prompt_runs" ADD COLUMN "surface_target_key" text;--> statement-breakpoint
ALTER TABLE "prompt_runs" ADD COLUMN "capture_route_key" text;--> statement-breakpoint
ALTER TABLE "prompt_runs" ADD COLUMN "answer_text" text;--> statement-breakpoint
ALTER TABLE "prompt_runs" ADD COLUMN "observed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "prompts" ADD COLUMN "scope_id" uuid;--> statement-breakpoint
ALTER TABLE "measurement_scopes" ADD CONSTRAINT "measurement_scopes_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "measurement_scopes_brand_id_uidx" ON "measurement_scopes" USING btree ("brand_id","id");--> statement-breakpoint
ALTER TABLE "observation_attempts" ADD CONSTRAINT "observation_attempts_prompt_id_prompts_id_fk" FOREIGN KEY ("prompt_id") REFERENCES "public"."prompts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "observation_attempts" ADD CONSTRAINT "observation_attempts_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "observation_attempts" ADD CONSTRAINT "observation_attempts_brand_scope_fk" FOREIGN KEY ("brand_id","scope_id") REFERENCES "public"."measurement_scopes"("brand_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "measurement_scopes_brand_key_uidx" ON "measurement_scopes" USING btree ("brand_id","key");--> statement-breakpoint
CREATE UNIQUE INDEX "measurement_scopes_one_default_per_brand_uidx" ON "measurement_scopes" USING btree ("brand_id") WHERE "measurement_scopes"."is_default" = true;--> statement-breakpoint
CREATE INDEX "measurement_scopes_brand_enabled_idx" ON "measurement_scopes" USING btree ("brand_id","enabled");--> statement-breakpoint
CREATE UNIQUE INDEX "observation_attempts_brand_source_key_uidx" ON "observation_attempts" USING btree ("brand_id","source_key");--> statement-breakpoint
CREATE INDEX "observation_attempts_prompt_created_idx" ON "observation_attempts" USING btree ("prompt_id","created_at");--> statement-breakpoint
CREATE INDEX "observation_attempts_scope_target_status_created_idx" ON "observation_attempts" USING btree ("brand_id","scope_id","surface_target_key","status","created_at");--> statement-breakpoint
ALTER TABLE "prompt_runs" ADD CONSTRAINT "prompt_runs_observation_attempt_id_observation_attempts_id_fk" FOREIGN KEY ("observation_attempt_id") REFERENCES "public"."observation_attempts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prompt_runs" ADD CONSTRAINT "prompt_runs_brand_scope_fk" FOREIGN KEY ("brand_id","scope_id") REFERENCES "public"."measurement_scopes"("brand_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prompts" ADD CONSTRAINT "prompts_brand_scope_fk" FOREIGN KEY ("brand_id","scope_id") REFERENCES "public"."measurement_scopes"("brand_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "prompt_runs_observation_attempt_id_uidx" ON "prompt_runs" USING btree ("observation_attempt_id");--> statement-breakpoint
CREATE INDEX "prompt_runs_scope_target_created_at_idx" ON "prompt_runs" USING btree ("brand_id","scope_id","surface_target_key","created_at");--> statement-breakpoint
CREATE INDEX "prompts_brand_scope_enabled_idx" ON "prompts" USING btree ("brand_id","scope_id","enabled");
