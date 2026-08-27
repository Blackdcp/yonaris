DROP INDEX "brand_opportunities_brand_scope_created_at_idx";--> statement-breakpoint
ALTER TABLE "brand_opportunities" ADD COLUMN "output_language" text DEFAULT 'en' NOT NULL;--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "output_language" text DEFAULT 'en' NOT NULL;--> statement-breakpoint
CREATE INDEX "brand_opportunities_brand_scope_language_created_at_idx" ON "brand_opportunities" USING btree ("brand_id","scope_id","output_language","created_at");--> statement-breakpoint
ALTER TABLE "brand_opportunities" ADD CONSTRAINT "brand_opportunities_output_language_supported" CHECK ("brand_opportunities"."output_language" IN ('en', 'zh-CN'));--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_output_language_supported" CHECK ("reports"."output_language" IN ('en', 'zh-CN'));