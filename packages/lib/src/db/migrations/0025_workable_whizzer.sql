DROP INDEX "brand_opportunities_brand_id_created_at_idx";--> statement-breakpoint
ALTER TABLE "brand_opportunities" ADD COLUMN "scope_id" uuid;--> statement-breakpoint
ALTER TABLE "brand_opportunities" ADD CONSTRAINT "brand_opportunities_scope_fk" FOREIGN KEY ("scope_id") REFERENCES "public"."measurement_scopes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "brand_opportunities_brand_scope_created_at_idx" ON "brand_opportunities" USING btree ("brand_id","scope_id","created_at");
