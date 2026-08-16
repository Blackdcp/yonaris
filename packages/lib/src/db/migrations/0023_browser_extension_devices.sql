CREATE TABLE "browser_runner_device_brands" (
	"device_id" uuid NOT NULL,
	"brand_id" text NOT NULL,
	"assigned_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "browser_runner_device_brands_pk" PRIMARY KEY("device_id","brand_id")
);
--> statement-breakpoint
ALTER TABLE "browser_runner_device_brands" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "browser_runner_devices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"display_name" text NOT NULL,
	"token_hash" text NOT NULL,
	"extension_version" text NOT NULL,
	"browser_family" text NOT NULL,
	"browser_version" text NOT NULL,
	"platform" text NOT NULL,
	"supported_surfaces" text[] DEFAULT '{}' NOT NULL,
	"readiness" json DEFAULT '{}'::json NOT NULL,
	"last_seen_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "browser_runner_devices_valid_display_name" CHECK (char_length("browser_runner_devices"."display_name") BETWEEN 1 AND 100),
	CONSTRAINT "browser_runner_devices_valid_token_hash" CHECK ("browser_runner_devices"."token_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "browser_runner_devices_valid_browser_family" CHECK ("browser_runner_devices"."browser_family" = 'chrome'),
	CONSTRAINT "browser_runner_devices_valid_platform" CHECK ("browser_runner_devices"."platform" IN ('windows', 'macos')),
	CONSTRAINT "browser_runner_devices_valid_surface_count" CHECK (cardinality("browser_runner_devices"."supported_surfaces") BETWEEN 1 AND 2),
	CONSTRAINT "browser_runner_devices_valid_surfaces" CHECK ("browser_runner_devices"."supported_surfaces" <@ ARRAY['doubao.consumer_web', 'deepseek.consumer_web']::text[])
);
--> statement-breakpoint
ALTER TABLE "browser_runner_devices" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "browser_runner_pairings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code_hash" text NOT NULL,
	"display_name" text NOT NULL,
	"brand_id" text NOT NULL,
	"created_by" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"device_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "browser_runner_pairings_valid_display_name" CHECK (char_length("browser_runner_pairings"."display_name") BETWEEN 1 AND 100),
	CONSTRAINT "browser_runner_pairings_valid_code_hash" CHECK ("browser_runner_pairings"."code_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "browser_runner_pairings_valid_expiry" CHECK ("browser_runner_pairings"."expires_at" > "browser_runner_pairings"."created_at" AND "browser_runner_pairings"."expires_at" <= "browser_runner_pairings"."created_at" + interval '15 minutes'),
	CONSTRAINT "browser_runner_pairings_consumption_consistent" CHECK (("browser_runner_pairings"."consumed_at" IS NULL AND "browser_runner_pairings"."device_id" IS NULL) OR ("browser_runner_pairings"."consumed_at" IS NOT NULL AND "browser_runner_pairings"."device_id" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "browser_runner_pairings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "browser_runner_device_brands" ADD CONSTRAINT "browser_runner_device_brands_device_id_browser_runner_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."browser_runner_devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "browser_runner_device_brands" ADD CONSTRAINT "browser_runner_device_brands_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "browser_runner_pairings" ADD CONSTRAINT "browser_runner_pairings_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "browser_runner_pairings" ADD CONSTRAINT "browser_runner_pairings_device_id_browser_runner_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."browser_runner_devices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "browser_runner_device_brands_brand_idx" ON "browser_runner_device_brands" USING btree ("brand_id");--> statement-breakpoint
CREATE UNIQUE INDEX "browser_runner_devices_token_hash_uidx" ON "browser_runner_devices" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "browser_runner_devices_last_seen_idx" ON "browser_runner_devices" USING btree ("last_seen_at");--> statement-breakpoint
CREATE UNIQUE INDEX "browser_runner_pairings_code_hash_uidx" ON "browser_runner_pairings" USING btree ("code_hash");--> statement-breakpoint
CREATE INDEX "browser_runner_pairings_brand_created_idx" ON "browser_runner_pairings" USING btree ("brand_id","created_at");