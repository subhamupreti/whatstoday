-- Backfill: ensure every existing user has a Personal workspace and membership
DO $$
DECLARE
  u RECORD;
  v_ws_id UUID;
BEGIN
  FOR u IN SELECT id FROM auth.users LOOP
    -- Ensure profile exists
    INSERT INTO public.profiles (user_id, email)
    SELECT u.id, lower(au.email) FROM auth.users au WHERE au.id = u.id
    ON CONFLICT (user_id) DO NOTHING;

    -- Skip if user already owns/belongs to any workspace
    IF EXISTS (SELECT 1 FROM public.workspace_members WHERE user_id = u.id) THEN
      CONTINUE;
    END IF;

    INSERT INTO public.workspaces (owner_user_id, name)
    VALUES (u.id, 'Personal')
    RETURNING id INTO v_ws_id;

    INSERT INTO public.workspace_members (workspace_id, user_id, role, invited_by_user_id)
    VALUES (v_ws_id, u.id, 'owner', u.id)
    ON CONFLICT (workspace_id, user_id) DO NOTHING;
  END LOOP;
END $$;