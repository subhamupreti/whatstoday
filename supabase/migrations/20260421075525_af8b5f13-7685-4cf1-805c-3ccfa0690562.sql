-- 1. Add music_links column to tasks
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS music_links text[] NOT NULL DEFAULT '{}'::text[];

-- 2. Allow collaborators to update music_links (in addition to status).
--    Owners are unaffected.
CREATE OR REPLACE FUNCTION public.restrict_shared_task_updates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() <> OLD.user_id THEN
    IF NEW.title IS DISTINCT FROM OLD.title
       OR NEW.description IS DISTINCT FROM OLD.description
       OR NEW.priority IS DISTINCT FROM OLD.priority
       OR NEW.tags IS DISTINCT FROM OLD.tags
       OR NEW.due_date IS DISTINCT FROM OLD.due_date
       OR NEW.user_id IS DISTINCT FROM OLD.user_id THEN
      RAISE EXCEPTION 'Shared collaborators can only change task status or music links';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- 3. Make sure realtime captures full row payloads for tasks + task_shares
ALTER TABLE public.tasks REPLICA IDENTITY FULL;
ALTER TABLE public.task_shares REPLICA IDENTITY FULL;

-- 4. Ensure both tables are part of the realtime publication (idempotent)
DO $$
BEGIN
  BEGIN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks';
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.task_shares';
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;