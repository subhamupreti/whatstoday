ALTER TABLE public.task_shares
ALTER COLUMN share_code DROP NOT NULL;

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

  INSERT INTO public.task_shares (task_id, user_id, role, share_code)
  VALUES (_task_id, v_uid, _role, v_code)
  ON CONFLICT (task_id, user_id)
  DO UPDATE SET share_code = EXCLUDED.share_code, role = EXCLUDED.role;

  RETURN v_code;
END;
$$;

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
  v_clean_code text := regexp_replace(_code, '\D', '', 'g');
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT ts.task_id, ts.role
  INTO v_task_id, v_role
  FROM public.task_shares ts
  JOIN public.tasks t ON t.id = ts.task_id AND t.user_id = ts.user_id
  WHERE ts.share_code = v_clean_code
  LIMIT 1;

  IF v_task_id IS NULL THEN
    RAISE EXCEPTION 'Invalid share code';
  END IF;

  INSERT INTO public.task_shares (task_id, user_id, role, share_code)
  VALUES (v_task_id, v_uid, v_role, NULL)
  ON CONFLICT (task_id, user_id) DO UPDATE
  SET role = EXCLUDED.role;

  RETURN v_task_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.preview_task_share(_code text)
RETURNS TABLE(task_id uuid, title text, owner_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT t.id, t.title, COALESCE(p.display_name, 'A user') AS owner_name
  FROM public.task_shares ts
  JOIN public.tasks t ON t.id = ts.task_id AND t.user_id = ts.user_id
  LEFT JOIN public.profiles p ON p.user_id = t.user_id
  WHERE ts.share_code = regexp_replace(_code, '\D', '', 'g')
  LIMIT 1;
$$;