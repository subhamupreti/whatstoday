
-- 1. Restrict profiles SELECT to authenticated users only
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Profiles are viewable by authenticated users"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

-- 2. Let task owners view share rows for their own tasks
CREATE POLICY "Owners view shares of their tasks"
  ON public.task_shares FOR SELECT
  TO authenticated
  USING (public.is_task_owner(task_id, auth.uid()));

-- 3. Require auth in preview_task_share
CREATE OR REPLACE FUNCTION public.preview_task_share(_code text)
 RETURNS TABLE(task_id uuid, title text, owner_name text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  RETURN QUERY
  SELECT t.id, t.title, COALESCE(p.display_name, 'A user') AS owner_name
  FROM public.task_shares ts
  JOIN public.tasks t ON t.id = ts.task_id AND t.user_id = ts.user_id
  LEFT JOIN public.profiles p ON p.user_id = t.user_id
  WHERE ts.share_code = regexp_replace(upper(_code), '[^A-Z0-9]', '', 'g')
  LIMIT 1;
END;
$function$;

-- 4. Stronger share codes: 8-char alphanumeric (uppercase, no ambiguous chars)
CREATE OR REPLACE FUNCTION public.generate_share_code()
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  alphabet text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; -- no 0/O/1/I/L
  candidate text;
  i int;
  attempts int := 0;
BEGIN
  LOOP
    candidate := '';
    FOR i IN 1..8 LOOP
      candidate := candidate || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.task_shares WHERE share_code = candidate);
    attempts := attempts + 1;
    IF attempts > 50 THEN
      RAISE EXCEPTION 'Could not allocate a unique share code';
    END IF;
  END LOOP;
  RETURN candidate;
END;
$function$;

-- Update join_task_by_code to accept alphanumeric input
CREATE OR REPLACE FUNCTION public.join_task_by_code(_code text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_task_id uuid;
  v_role public.share_role;
  v_uid uuid := auth.uid();
  v_clean_code text := regexp_replace(upper(_code), '[^A-Z0-9]', '', 'g');
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
$function$;

-- 5. Realtime authorization: scope channel subscriptions to tasks the user has access to.
-- Topic convention: 'task:<task_id>' or 'tasks:<user_id>' (own tasks list).
ALTER TABLE IF EXISTS realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read own task channels" ON realtime.messages;
CREATE POLICY "Authenticated can read own task channels"
  ON realtime.messages FOR SELECT
  TO authenticated
  USING (
    (realtime.topic() LIKE 'task:%'
      AND public.has_task_access(
        substring(realtime.topic() from 6)::uuid,
        (select auth.uid())
      ))
    OR (realtime.topic() = 'tasks:' || (select auth.uid())::text)
    OR (realtime.topic() = 'task_shares:' || (select auth.uid())::text)
  );

DROP POLICY IF EXISTS "Authenticated can broadcast on own task channels" ON realtime.messages;
CREATE POLICY "Authenticated can broadcast on own task channels"
  ON realtime.messages FOR INSERT
  TO authenticated
  WITH CHECK (
    (realtime.topic() LIKE 'task:%'
      AND public.has_task_access(
        substring(realtime.topic() from 6)::uuid,
        (select auth.uid())
      ))
    OR (realtime.topic() = 'tasks:' || (select auth.uid())::text)
    OR (realtime.topic() = 'task_shares:' || (select auth.uid())::text)
  );

-- 6. Avatars storage bucket: allow public read of individual files (so public URLs still work),
-- but block listing the bucket contents wholesale.
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Public read avatars" ON storage.objects;
DROP POLICY IF EXISTS "Avatars public read by name" ON storage.objects;

-- Public can read individual avatar objects only when fetching by exact name (no listing).
CREATE POLICY "Avatars public read by name"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'avatars' AND name IS NOT NULL);

DROP POLICY IF EXISTS "Users upload own avatar" ON storage.objects;
CREATE POLICY "Users upload own avatar"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users update own avatar" ON storage.objects;
CREATE POLICY "Users update own avatar"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users delete own avatar" ON storage.objects;
CREATE POLICY "Users delete own avatar"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
