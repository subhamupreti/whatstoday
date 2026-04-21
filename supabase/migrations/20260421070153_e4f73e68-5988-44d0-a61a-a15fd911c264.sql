-- Role enum
CREATE TYPE public.share_role AS ENUM ('viewer', 'completer');

-- Helper to generate short codes
CREATE OR REPLACE FUNCTION public.generate_share_code()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text := '';
  i int;
BEGIN
  FOR i IN 1..8 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN result;
END;
$$;

-- task_shares table
CREATE TABLE public.task_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role public.share_role NOT NULL DEFAULT 'completer',
  share_code text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (task_id, user_id)
);

CREATE INDEX idx_task_shares_user ON public.task_shares(user_id);
CREATE INDEX idx_task_shares_task ON public.task_shares(task_id);
CREATE UNIQUE INDEX idx_task_shares_code ON public.task_shares(task_id, share_code);

ALTER TABLE public.task_shares ENABLE ROW LEVEL SECURITY;

-- Security definer helpers (avoid recursive RLS)
CREATE OR REPLACE FUNCTION public.is_task_owner(_task_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.tasks WHERE id = _task_id AND user_id = _user_id);
$$;

CREATE OR REPLACE FUNCTION public.has_task_access(_task_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_task_owner(_task_id, _user_id)
      OR EXISTS (SELECT 1 FROM public.task_shares WHERE task_id = _task_id AND user_id = _user_id);
$$;

CREATE OR REPLACE FUNCTION public.has_share_role(_task_id uuid, _user_id uuid, _role public.share_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.task_shares WHERE task_id = _task_id AND user_id = _user_id AND role = _role);
$$;

-- task_shares policies
CREATE POLICY "Owner manages shares"
  ON public.task_shares FOR ALL
  TO authenticated
  USING (public.is_task_owner(task_id, auth.uid()))
  WITH CHECK (public.is_task_owner(task_id, auth.uid()));

CREATE POLICY "Users view own share rows"
  ON public.task_shares FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Allow a user to join a task themselves by inserting their own share row.
-- App layer validates the code via RPC; this lets the RPC's auth context insert.
CREATE POLICY "Users can leave shares"
  ON public.task_shares FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Update tasks RLS: extend SELECT to shared users; restrict UPDATE for completers to status fields via trigger.
DROP POLICY IF EXISTS "Users view own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users update own tasks" ON public.tasks;

CREATE POLICY "View own or shared tasks"
  ON public.tasks FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.has_task_access(id, auth.uid()));

CREATE POLICY "Update own or completer-shared tasks"
  ON public.tasks FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id OR public.has_share_role(id, auth.uid(), 'completer'))
  WITH CHECK (auth.uid() = user_id OR public.has_share_role(id, auth.uid(), 'completer'));

-- Trigger: non-owners can only modify status/completed_at
CREATE OR REPLACE FUNCTION public.restrict_shared_task_updates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() <> OLD.user_id THEN
    IF NEW.title IS DISTINCT FROM OLD.title
       OR NEW.description IS DISTINCT FROM OLD.description
       OR NEW.priority IS DISTINCT FROM OLD.priority
       OR NEW.tags IS DISTINCT FROM OLD.tags
       OR NEW.due_date IS DISTINCT FROM OLD.due_date
       OR NEW.user_id IS DISTINCT FROM OLD.user_id THEN
      RAISE EXCEPTION 'Shared collaborators can only change task status';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_restrict_shared_task_updates
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.restrict_shared_task_updates();

-- RPC: join a task by code
CREATE OR REPLACE FUNCTION public.join_task_by_code(_code text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_task_id uuid;
  v_role public.share_role;
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT task_id, role INTO v_task_id, v_role
  FROM public.task_shares
  WHERE share_code = upper(_code)
  LIMIT 1;

  IF v_task_id IS NULL THEN
    RAISE EXCEPTION 'Invalid share code';
  END IF;

  INSERT INTO public.task_shares (task_id, user_id, role, share_code)
  VALUES (v_task_id, v_uid, v_role, upper(_code))
  ON CONFLICT (task_id, user_id) DO NOTHING;

  RETURN v_task_id;
END;
$$;

-- RPC: owner creates a share code for a task
CREATE OR REPLACE FUNCTION public.create_task_share(_task_id uuid, _role public.share_role DEFAULT 'completer')
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text;
  v_uid uuid := auth.uid();
BEGIN
  IF NOT public.is_task_owner(_task_id, v_uid) THEN
    RAISE EXCEPTION 'Only the owner can create a share code';
  END IF;

  v_code := public.generate_share_code();

  -- Owner row acts as the canonical code carrier; if exists, refresh its code.
  INSERT INTO public.task_shares (task_id, user_id, role, share_code)
  VALUES (_task_id, v_uid, _role, v_code)
  ON CONFLICT (task_id, user_id)
  DO UPDATE SET share_code = EXCLUDED.share_code, role = EXCLUDED.role;

  RETURN v_code;
END;
$$;

-- Realtime
ALTER TABLE public.tasks REPLICA IDENTITY FULL;
ALTER TABLE public.task_shares REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.task_shares;