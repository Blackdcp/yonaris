ALTER TYPE "public"."response_snapshot_access_action" ADD VALUE 'view_screenshot' BEFORE 'export';--> statement-breakpoint
ALTER TYPE "public"."response_snapshot_access_action" ADD VALUE 'download_screenshot' BEFORE 'export';
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "enforce_evidence_artifact"() RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
	task delivery_tasks%ROWTYPE;
	attempt observation_attempts%ROWTYPE;
BEGIN
	IF TG_OP = 'DELETE' THEN
		IF OLD.status = 'staged' THEN
			RETURN OLD;
		END IF;
		IF OLD.status = 'attached' AND OLD.kind = 'screenshot' AND
			EXISTS (
				SELECT 1
				FROM prompt_runs pr
				JOIN response_snapshots rs ON rs.prompt_run_id = pr.id
				WHERE pr.observation_attempt_id = OLD.observation_attempt_id
					AND rs.schema_version = 'response-snapshot.v2'
					AND rs.status = 'expired'
					AND rs.expires_at <= clock_timestamp()
			) AND
			NOT EXISTS (
				SELECT 1
				FROM prompt_runs pr
				JOIN response_snapshots rs ON rs.prompt_run_id = pr.id
				WHERE pr.observation_attempt_id = OLD.observation_attempt_id
					AND rs.schema_version = 'response-snapshot.v2'
					AND (rs.expires_at > clock_timestamp() OR rs.status IN ('pending', 'ready'))
			) THEN
			RETURN OLD;
		END IF;
		RAISE EXCEPTION 'attached evidence artifact % cannot be deleted', OLD.id;
	END IF;

	SELECT * INTO task FROM delivery_tasks WHERE id = NEW.task_id;
	IF NOT FOUND OR
		task.brand_id IS DISTINCT FROM NEW.brand_id OR
		task.scope_id IS DISTINCT FROM NEW.scope_id OR
		task.batch_id IS DISTINCT FROM NEW.batch_id THEN
		RAISE EXCEPTION 'evidence artifact does not match delivery task %', NEW.task_id;
	END IF;
	IF btrim(NEW.uploaded_by) = '' THEN
		RAISE EXCEPTION 'evidence artifact uploader must not be empty';
	END IF;

	IF TG_OP = 'INSERT' THEN
		IF NEW.status <> 'staged' OR task.status <> 'claimed' OR
			NEW.lease_generation IS DISTINCT FROM task.lease_generation OR
			NEW.uploaded_by IS DISTINCT FROM task.claimed_by OR
			task.lease_expires_at IS NULL OR task.lease_expires_at <= clock_timestamp() THEN
			RAISE EXCEPTION 'evidence artifact must be staged against the current claimed task generation';
		END IF;
		RETURN NEW;
	END IF;

	IF OLD.status = 'attached' THEN
		RAISE EXCEPTION 'attached evidence artifact % cannot be changed', OLD.id;
	END IF;
	IF NEW.id IS DISTINCT FROM OLD.id OR
		NEW.task_id IS DISTINCT FROM OLD.task_id OR
		NEW.batch_id IS DISTINCT FROM OLD.batch_id OR
		NEW.brand_id IS DISTINCT FROM OLD.brand_id OR
		NEW.scope_id IS DISTINCT FROM OLD.scope_id OR
		NEW.lease_generation IS DISTINCT FROM OLD.lease_generation OR
		NEW.uploaded_by IS DISTINCT FROM OLD.uploaded_by OR
		NEW.kind IS DISTINCT FROM OLD.kind OR
		NEW.media_type IS DISTINCT FROM OLD.media_type OR
		NEW.original_filename IS DISTINCT FROM OLD.original_filename OR
		NEW.byte_size IS DISTINCT FROM OLD.byte_size OR
		NEW.sha256 IS DISTINCT FROM OLD.sha256 OR
		NEW.storage_backend IS DISTINCT FROM OLD.storage_backend OR
		NEW.storage_key IS DISTINCT FROM OLD.storage_key OR
		NEW.content IS DISTINCT FROM OLD.content OR
		NEW.created_at IS DISTINCT FROM OLD.created_at THEN
		RAISE EXCEPTION 'evidence artifact % content and identity are immutable', OLD.id;
	END IF;
	IF OLD.status <> 'staged' OR NEW.status <> 'attached' THEN
		RAISE EXCEPTION 'invalid evidence artifact transition from % to %', OLD.status, NEW.status;
	END IF;
	IF task.status <> 'claimed' OR NEW.lease_generation IS DISTINCT FROM task.lease_generation OR
		NEW.uploaded_by IS DISTINCT FROM task.claimed_by OR
		task.lease_expires_at IS NULL OR task.lease_expires_at <= clock_timestamp() THEN
		RAISE EXCEPTION 'evidence artifact must be attached by the current claimed task generation';
	END IF;

	SELECT * INTO attempt FROM observation_attempts WHERE id = NEW.observation_attempt_id;
	IF NOT FOUND OR attempt.status <> 'succeeded' OR
		attempt.brand_id IS DISTINCT FROM task.brand_id OR
		attempt.scope_id IS DISTINCT FROM task.scope_id OR
		attempt.prompt_id IS DISTINCT FROM task.prompt_id OR
		attempt.prompt_text IS DISTINCT FROM task.prompt_text OR
		attempt.surface_target_key IS DISTINCT FROM task.surface_target_key OR
		attempt.capture_route_key IS DISTINCT FROM task.capture_route_key OR
		attempt.sample_index IS DISTINCT FROM task.sample_index THEN
		RAISE EXCEPTION 'observation attempt does not match evidence artifact task %', NEW.task_id;
	END IF;
	RETURN NEW;
END;
$$;
