CREATE TYPE "public"."response_snapshot_access_action" AS ENUM('view_html', 'download_html', 'download_json', 'download_manifest', 'export');--> statement-breakpoint
CREATE TYPE "public"."response_snapshot_capture_method" AS ENUM('brightdata_dataset', 'brightdata_serp', 'consumer_web_browser', 'historical_reconstruction');--> statement-breakpoint
CREATE TYPE "public"."response_snapshot_content_source" AS ENUM('native_answer_html', 'browser_answer_html', 'rendered_from_structured_response', 'reconstructed_from_historical_run');--> statement-breakpoint
CREATE TYPE "public"."response_snapshot_status" AS ENUM('pending', 'ready', 'failed', 'expired');--> statement-breakpoint
CREATE TYPE "public"."response_snapshot_storage_backend" AS ENUM('filesystem', 'kodo');--> statement-breakpoint
CREATE TABLE "response_snapshot_access_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"snapshot_id" uuid NOT NULL,
	"brand_id" text NOT NULL,
	"actor_user_id" text NOT NULL,
	"action" "response_snapshot_access_action" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "response_snapshot_access_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "response_snapshot_outbox" (
	"snapshot_id" uuid PRIMARY KEY NOT NULL,
	"html_gzip" "bytea" NOT NULL,
	"json_gzip" "bytea" NOT NULL,
	"manifest_json" "bytea" NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_error_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "response_snapshot_outbox_bounded_payload" CHECK (octet_length("response_snapshot_outbox"."html_gzip") > 0 AND octet_length("response_snapshot_outbox"."json_gzip") > 0 AND octet_length("response_snapshot_outbox"."manifest_json") > 0 AND octet_length("response_snapshot_outbox"."html_gzip") + octet_length("response_snapshot_outbox"."json_gzip") + octet_length("response_snapshot_outbox"."manifest_json") <= 8388608),
	CONSTRAINT "response_snapshot_outbox_valid_expiry" CHECK ("response_snapshot_outbox"."expires_at" > "response_snapshot_outbox"."created_at"),
	CONSTRAINT "response_snapshot_outbox_nonnegative_attempts" CHECK ("response_snapshot_outbox"."attempt_count" >= 0)
);
--> statement-breakpoint
ALTER TABLE "response_snapshot_outbox" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "response_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"prompt_run_id" uuid NOT NULL,
	"brand_id" text NOT NULL,
	"scope_id" uuid,
	"prompt_id" uuid NOT NULL,
	"revision" smallint DEFAULT 1 NOT NULL,
	"is_current" boolean DEFAULT true NOT NULL,
	"status" "response_snapshot_status" DEFAULT 'pending' NOT NULL,
	"storage_backend" "response_snapshot_storage_backend",
	"storage_key" text,
	"content_source" "response_snapshot_content_source",
	"capture_method" "response_snapshot_capture_method",
	"schema_version" text,
	"template_version" text,
	"html_sha256" text,
	"json_sha256" text,
	"manifest_sha256" text,
	"source_payload_sha256" text,
	"html_bytes" integer,
	"json_bytes" integer,
	"manifest_bytes" integer,
	"html_gzip_bytes" integer,
	"json_gzip_bytes" integer,
	"failure_code" text,
	"observed_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ready_at" timestamp with time zone,
	"failed_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "response_snapshots_positive_revision" CHECK ("response_snapshots"."revision" > 0),
	CONSTRAINT "response_snapshots_valid_retention" CHECK ("response_snapshots"."expires_at" > "response_snapshots"."observed_at"),
	CONSTRAINT "response_snapshots_storage_pair_consistent" CHECK (("response_snapshots"."storage_backend" IS NULL AND "response_snapshots"."storage_key" IS NULL) OR ("response_snapshots"."storage_backend" IS NOT NULL AND "response_snapshots"."storage_key" IS NOT NULL AND char_length("response_snapshots"."storage_key") BETWEEN 1 AND 1000 AND "response_snapshots"."storage_key" !~ '(^/|(^|/)[.][.](/|$))')),
	CONSTRAINT "response_snapshots_artifact_metadata_consistent" CHECK (("response_snapshots"."content_source" IS NULL AND "response_snapshots"."capture_method" IS NULL AND "response_snapshots"."schema_version" IS NULL AND "response_snapshots"."template_version" IS NULL AND "response_snapshots"."html_sha256" IS NULL AND "response_snapshots"."json_sha256" IS NULL AND "response_snapshots"."manifest_sha256" IS NULL AND "response_snapshots"."html_bytes" IS NULL AND "response_snapshots"."json_bytes" IS NULL AND "response_snapshots"."manifest_bytes" IS NULL AND "response_snapshots"."html_gzip_bytes" IS NULL AND "response_snapshots"."json_gzip_bytes" IS NULL) OR ("response_snapshots"."content_source" IS NOT NULL AND "response_snapshots"."capture_method" IS NOT NULL AND char_length("response_snapshots"."schema_version") BETWEEN 1 AND 100 AND char_length("response_snapshots"."template_version") BETWEEN 1 AND 100 AND "response_snapshots"."html_sha256" ~ '^[0-9a-f]{64}$' AND "response_snapshots"."json_sha256" ~ '^[0-9a-f]{64}$' AND "response_snapshots"."manifest_sha256" ~ '^[0-9a-f]{64}$' AND ("response_snapshots"."source_payload_sha256" IS NULL OR "response_snapshots"."source_payload_sha256" ~ '^[0-9a-f]{64}$') AND "response_snapshots"."html_bytes" > 0 AND "response_snapshots"."json_bytes" > 0 AND "response_snapshots"."manifest_bytes" > 0 AND "response_snapshots"."html_gzip_bytes" > 0 AND "response_snapshots"."json_gzip_bytes" > 0)),
	CONSTRAINT "response_snapshots_state_consistent" CHECK (("response_snapshots"."status" = 'pending' AND "response_snapshots"."ready_at" IS NULL AND "response_snapshots"."failed_at" IS NULL AND "response_snapshots"."failure_code" IS NULL AND "response_snapshots"."storage_backend" IS NULL AND "response_snapshots"."storage_key" IS NULL) OR ("response_snapshots"."status" = 'ready' AND "response_snapshots"."ready_at" IS NOT NULL AND "response_snapshots"."failed_at" IS NULL AND "response_snapshots"."failure_code" IS NULL AND "response_snapshots"."storage_backend" IS NOT NULL AND "response_snapshots"."storage_key" IS NOT NULL AND "response_snapshots"."content_source" IS NOT NULL) OR ("response_snapshots"."status" = 'failed' AND "response_snapshots"."ready_at" IS NULL AND "response_snapshots"."failed_at" IS NOT NULL AND char_length("response_snapshots"."failure_code") BETWEEN 1 AND 100 AND "response_snapshots"."storage_backend" IS NULL AND "response_snapshots"."storage_key" IS NULL) OR ("response_snapshots"."status" = 'expired' AND "response_snapshots"."ready_at" IS NOT NULL AND "response_snapshots"."failed_at" IS NULL AND "response_snapshots"."failure_code" IS NULL AND "response_snapshots"."storage_backend" IS NULL AND "response_snapshots"."storage_key" IS NULL AND "response_snapshots"."content_source" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "response_snapshots" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "response_snapshot_access_events" ADD CONSTRAINT "response_snapshot_access_events_snapshot_id_response_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."response_snapshots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "response_snapshot_access_events" ADD CONSTRAINT "response_snapshot_access_events_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "response_snapshot_outbox" ADD CONSTRAINT "response_snapshot_outbox_snapshot_id_response_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."response_snapshots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "response_snapshots" ADD CONSTRAINT "response_snapshots_prompt_run_id_prompt_runs_id_fk" FOREIGN KEY ("prompt_run_id") REFERENCES "public"."prompt_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "response_snapshots" ADD CONSTRAINT "response_snapshots_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "response_snapshots" ADD CONSTRAINT "response_snapshots_prompt_id_prompts_id_fk" FOREIGN KEY ("prompt_id") REFERENCES "public"."prompts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "response_snapshots" ADD CONSTRAINT "response_snapshots_brand_scope_fk" FOREIGN KEY ("brand_id","scope_id") REFERENCES "public"."measurement_scopes"("brand_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "response_snapshot_access_events_brand_created_idx" ON "response_snapshot_access_events" USING btree ("brand_id","created_at");--> statement-breakpoint
CREATE INDEX "response_snapshot_access_events_snapshot_created_idx" ON "response_snapshot_access_events" USING btree ("snapshot_id","created_at");--> statement-breakpoint
CREATE INDEX "response_snapshot_outbox_next_attempt_idx" ON "response_snapshot_outbox" USING btree ("next_attempt_at");--> statement-breakpoint
CREATE UNIQUE INDEX "response_snapshots_prompt_run_revision_uidx" ON "response_snapshots" USING btree ("prompt_run_id","revision");--> statement-breakpoint
CREATE UNIQUE INDEX "response_snapshots_prompt_run_current_uidx" ON "response_snapshots" USING btree ("prompt_run_id") WHERE "response_snapshots"."is_current";--> statement-breakpoint
CREATE INDEX "response_snapshots_brand_created_idx" ON "response_snapshots" USING btree ("brand_id","created_at");--> statement-breakpoint
CREATE INDEX "response_snapshots_status_expires_idx" ON "response_snapshots" USING btree ("status","expires_at");
