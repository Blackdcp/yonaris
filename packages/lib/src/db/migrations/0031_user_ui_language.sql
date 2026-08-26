ALTER TABLE "user" ADD COLUMN "ui_language" text DEFAULT 'en' NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_ui_language_supported" CHECK ("ui_language" IN ('en', 'zh-CN'));
