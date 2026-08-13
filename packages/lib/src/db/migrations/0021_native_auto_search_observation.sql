ALTER TYPE "public"."delivery_session_requirement" ADD VALUE 'dedicated_sampling_profile';--> statement-breakpoint
ALTER TYPE "public"."delivery_search_requirement" ADD VALUE 'platform_default';--> statement-breakpoint
ALTER TABLE "observation_attempts" ADD COLUMN "web_search_observed" boolean;--> statement-breakpoint
ALTER TABLE "prompt_runs" ADD COLUMN "web_search_observed" boolean;
