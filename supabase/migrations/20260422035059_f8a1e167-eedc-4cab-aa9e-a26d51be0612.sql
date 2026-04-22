
-- Restore default column grants and rely on row-level policy for column protection
GRANT SELECT ON public.profiles TO authenticated;

-- Drop the overly-permissive read-all policy added previously
DROP POLICY IF EXISTS "Authenticated users read public profile fields" ON public.profiles;

-- Keep only "Users read own profile" (auth.uid() = user_id) for direct table access.
-- For cross-user access (display_name, avatar_url for share previews), use the
-- profiles_public view which omits phone entirely. RLS on the view runs as security_invoker,
-- which means it inherits the underlying table policy — so we need a dedicated SELECT policy
-- granting access to non-sensitive columns. Simpler: add an additional policy that only
-- allows reading rows where the requester knows the user_id, but excludes the phone column.
-- Postgres RLS is row-level not column-level, so the cleanest fix is:
--   1. Owner can SELECT * from their own row (already set)
--   2. Authenticated users can SELECT from profiles_public (a view) which omits phone.
-- Re-grant the view, and revoke other users' direct access via row policy.

-- Make profiles_public bypass RLS by using SECURITY DEFINER function instead of view,
-- which is more reliable across Postgres versions:
DROP VIEW IF EXISTS public.profiles_public;

CREATE OR REPLACE FUNCTION public.get_public_profile(_user_id uuid)
RETURNS TABLE(user_id uuid, display_name text, designation text, avatar_url text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT user_id, display_name, designation, avatar_url
  FROM public.profiles
  WHERE user_id = _user_id
  LIMIT 1;
$function$;

GRANT EXECUTE ON FUNCTION public.get_public_profile(uuid) TO authenticated;

-- Tasks: restrict DELETE to owner only (shared users should not be able to delete)
DROP POLICY IF EXISTS "Delete own or shared tasks" ON public.tasks;
CREATE POLICY "Owner deletes own tasks"
ON public.tasks
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);
