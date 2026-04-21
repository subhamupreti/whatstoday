
-- Bundle table
CREATE TABLE public.task_share_bundles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL,
  share_code text NOT NULL UNIQUE,
  role public.share_role NOT NULL DEFAULT 'completer',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.task_share_bundle_items (
  bundle_id uuid NOT NULL REFERENCES public.task_share_bundles(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  PRIMARY KEY (bundle_id, task_id)
);

CREATE INDEX idx_bundle_items_task ON public.task_share_bundle_items(task_id);
CREATE INDEX idx_bundles_owner ON public.task_share_bundles(owner_user_id);

ALTER TABLE public.task_share_bundles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_share_bundle_items ENABLE ROW LEVEL SECURITY;

-- Only owners can see/modify their bundles directly; redemption goes through SECURITY DEFINER RPCs.
CREATE POLICY "Owner manages bundles"
  ON public.task_share_bundles FOR ALL
  TO authenticated
  USING (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());

CREATE POLICY "Owner manages bundle items"
  ON public.task_share_bundle_items FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.task_share_bundles b WHERE b.id = bundle_id AND b.owner_user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.task_share_bundles b WHERE b.id = bundle_id AND b.owner_user_id = auth.uid()));

-- RPC: create a bundle for a list of tasks owned by the caller.
CREATE OR REPLACE FUNCTION public.create_task_bundle_share(_task_ids uuid[], _role public.share_role DEFAULT 'completer')
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_code text;
  v_bundle_id uuid;
  v_owned_count int;
  v_total int;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _task_ids IS NULL OR array_length(_task_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'No tasks provided';
  END IF;

  v_total := array_length(_task_ids, 1);

  SELECT count(*) INTO v_owned_count
  FROM public.tasks
  WHERE id = ANY(_task_ids) AND user_id = v_uid;

  IF v_owned_count <> v_total THEN
    RAISE EXCEPTION 'You can only bundle tasks you own';
  END IF;

  v_code := public.generate_share_code();

  INSERT INTO public.task_share_bundles (owner_user_id, share_code, role)
  VALUES (v_uid, v_code, _role)
  RETURNING id INTO v_bundle_id;

  INSERT INTO public.task_share_bundle_items (bundle_id, task_id)
  SELECT v_bundle_id, unnest(_task_ids);

  RETURN v_code;
END;
$function$;

-- RPC: preview a bundle (auth required, like single-task preview).
CREATE OR REPLACE FUNCTION public.preview_task_bundle_share(_code text)
 RETURNS TABLE(bundle_id uuid, owner_name text, task_count int, sample_titles text[])
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_clean text := regexp_replace(upper(_code), '[^A-Z0-9]', '', 'g');
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  RETURN QUERY
  SELECT
    b.id,
    COALESCE(p.display_name, 'A user') AS owner_name,
    (SELECT count(*)::int FROM public.task_share_bundle_items i WHERE i.bundle_id = b.id) AS task_count,
    (SELECT array_agg(t.title ORDER BY t.created_at DESC) FROM (
        SELECT t.title, t.created_at
        FROM public.task_share_bundle_items i
        JOIN public.tasks t ON t.id = i.task_id
        WHERE i.bundle_id = b.id
        ORDER BY t.created_at DESC
        LIMIT 5
      ) t) AS sample_titles
  FROM public.task_share_bundles b
  LEFT JOIN public.profiles p ON p.user_id = b.owner_user_id
  WHERE b.share_code = v_clean
  LIMIT 1;
END;
$function$;

-- RPC: join all tasks in a bundle.
CREATE OR REPLACE FUNCTION public.join_task_bundle_by_code(_code text)
 RETURNS int
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_clean text := regexp_replace(upper(_code), '[^A-Z0-9]', '', 'g');
  v_bundle public.task_share_bundles%ROWTYPE;
  v_added int := 0;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_bundle FROM public.task_share_bundles WHERE share_code = v_clean LIMIT 1;
  IF v_bundle.id IS NULL THEN RAISE EXCEPTION 'Invalid bundle code'; END IF;

  WITH ins AS (
    INSERT INTO public.task_shares (task_id, user_id, role, share_code)
    SELECT i.task_id, v_uid, v_bundle.role, NULL
    FROM public.task_share_bundle_items i
    JOIN public.tasks t ON t.id = i.task_id AND t.user_id = v_bundle.owner_user_id
    WHERE i.bundle_id = v_bundle.id
    ON CONFLICT (task_id, user_id) DO UPDATE SET role = EXCLUDED.role
    RETURNING 1
  )
  SELECT count(*)::int INTO v_added FROM ins;

  RETURN v_added;
END;
$function$;
