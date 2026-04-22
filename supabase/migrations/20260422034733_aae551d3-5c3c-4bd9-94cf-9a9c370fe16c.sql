
-- 1. Rewrite share-code generator to produce 6-digit numeric codes
--    Checks uniqueness across BOTH task_shares and task_share_bundles.
CREATE OR REPLACE FUNCTION public.generate_share_code()
RETURNS text
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  candidate text;
  attempts int := 0;
BEGIN
  LOOP
    candidate := lpad(floor(random() * 1000000)::int::text, 6, '0');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.task_shares WHERE share_code = candidate)
          AND NOT EXISTS (SELECT 1 FROM public.task_share_bundles WHERE share_code = candidate);
    attempts := attempts + 1;
    IF attempts > 200 THEN
      RAISE EXCEPTION 'Could not allocate a unique share code';
    END IF;
  END LOOP;
  RETURN candidate;
END;
$function$;

-- 2. Update join/preview RPCs to strip non-digits (still tolerate old alphanumeric codes)
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

CREATE OR REPLACE FUNCTION public.preview_task_bundle_share(_code text)
RETURNS TABLE(bundle_id uuid, owner_name text, task_count integer, sample_titles text[])
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

-- 3. Profile privacy: stop exposing phone numbers to all authenticated users
DROP POLICY IF EXISTS "Profiles are viewable by authenticated users" ON public.profiles;

-- Users can read their own full profile
CREATE POLICY "Users read own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Public-safe profile view for share previews (display name + avatar + designation only, NO phone)
CREATE OR REPLACE VIEW public.profiles_public
WITH (security_invoker = true)
AS
SELECT user_id, display_name, designation, avatar_url
FROM public.profiles;

GRANT SELECT ON public.profiles_public TO authenticated;

-- Allow authenticated users to read non-sensitive profile fields of others (needed for share previews)
CREATE POLICY "Authenticated users read public profile fields"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

-- Note: The above re-allows full row reads. To truly hide phone we revoke column-level access:
REVOKE SELECT ON public.profiles FROM authenticated;
GRANT SELECT (user_id, display_name, designation, avatar_url, created_at, updated_at, id) ON public.profiles TO authenticated;
-- Phone column is intentionally excluded from the grant. Owners can still see their own phone via the SECURITY DEFINER own-profile policy: re-grant phone only to allow the own-profile policy to evaluate.
-- We need a SECURITY DEFINER getter for own phone:
CREATE OR REPLACE FUNCTION public.get_my_profile()
RETURNS TABLE(
  user_id uuid,
  display_name text,
  phone text,
  designation text,
  avatar_url text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT user_id, display_name, phone, designation, avatar_url
  FROM public.profiles
  WHERE user_id = auth.uid()
  LIMIT 1;
$function$;

GRANT EXECUTE ON FUNCTION public.get_my_profile() TO authenticated;

-- 4. Remove duplicate avatar storage policies (keep one of each pair)
DROP POLICY IF EXISTS "Users upload own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users update own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users delete own avatar" ON storage.objects;

-- 5. Privilege-escalation guardrail: explicit policy denying recipients from inserting
--    task_shares for tasks they don't own. The SECURITY DEFINER join_task_by_code()
--    function bypasses this (intentional), but any direct client insert is blocked.
--    The existing "Owner manages shares" ALL policy already covers this, but we make it explicit:
DROP POLICY IF EXISTS "Block direct recipient inserts" ON public.task_shares;
CREATE POLICY "Block direct recipient inserts"
ON public.task_shares
AS RESTRICTIVE
FOR INSERT
TO authenticated
WITH CHECK (public.is_task_owner(task_id, auth.uid()));
