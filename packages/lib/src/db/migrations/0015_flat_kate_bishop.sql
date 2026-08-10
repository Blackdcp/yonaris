ALTER TABLE "observation_attempts" DROP CONSTRAINT "observation_attempts_prompt_id_prompts_id_fk";
--> statement-breakpoint
ALTER TABLE "observation_attempts" ADD CONSTRAINT "observation_attempts_prompt_id_prompts_id_fk" FOREIGN KEY ("prompt_id") REFERENCES "public"."prompts"("id") ON DELETE no action ON UPDATE no action;