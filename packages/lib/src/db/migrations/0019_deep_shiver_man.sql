DROP INDEX "brands_organization_id_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "brands_organization_id_uidx" ON "brands" USING btree ("organization_id");