CREATE TYPE public.workspace_role AS ENUM ('owner', 'admin', 'member');

CREATE TABLE public.workspaces (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_user_id UUID NOT NULL,
  name TEXT NOT NULL,
  slug TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT workspaces_name_length CHECK (char_length(btrim(name)) BETWEEN 1 AND 80)
);

ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.workspace_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL,
  user_id UUID NOT NULL,
  role public.workspace_role NOT NULL DEFAULT 'member',
  invited_by_user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, user_id)
);

ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.workspace_invitations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL,
  email TEXT NOT NULL,
  role public.workspace_role NOT NULL DEFAULT 'member',
  invited_by_user_id UUID NOT NULL,
  accepted_by_user_id UUID,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, email),
  CONSTRAINT workspace_invitations_email_format CHECK (position('@' in email) > 1)
);

ALTER TABLE public.workspace_invitations ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS email TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_unique_idx
ON public.profiles (lower(email))
WHERE email IS NOT NULL;

ALTER TABLE public.tasks
ADD COLUMN IF NOT EXISTS workspace_id UUID,
ADD COLUMN IF NOT EXISTS assigned_to_user_id UUID;

CREATE INDEX IF NOT EXISTS idx_tasks_workspace_id ON public.tasks (workspace_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to_user_id ON public.tasks (assigned_to_user_id) WHERE assigned_to_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace_id ON public.workspace_members (workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_user_id ON public.workspace_members (user_id);
CREATE INDEX IF NOT EXISTS idx_workspace_invitations_workspace_id ON public.workspace_invitations (workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_invitations_email ON public.workspace_invitations (lower(email));
CREATE INDEX IF NOT EXISTS idx_workspaces_owner_user_id ON public.workspaces (owner_user_id);

CREATE OR REPLACE FUNCTION public.is_workspace_member(_workspace_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.workspace_members
    WHERE workspace_id = _workspace_id
      AND user_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.has_workspace_role(_workspace_id UUID, _user_id UUID, _role public.workspace_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.workspace_members
    WHERE workspace_id = _workspace_id
      AND user_id = _user_id
      AND (
        role = _role
        OR (role = 'owner' AND _role IN ('admin', 'member'))
        OR (role = 'admin' AND _role = 'member')
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.can_manage_workspace(_workspace_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_workspace_role(_workspace_id, _user_id, 'admin');
$$;

CREATE OR REPLACE FUNCTION public.create_workspace(_name TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_workspace_id UUID;
  v_name TEXT := NULLIF(btrim(_name), '');
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO public.workspaces (owner_user_id, name)
  VALUES (v_uid, COALESCE(v_name, 'Untitled Workspace'))
  RETURNING id INTO v_workspace_id;

  INSERT INTO public.workspace_members (workspace_id, user_id, role, invited_by_user_id)
  VALUES (v_workspace_id, v_uid, 'owner', v_uid)
  ON CONFLICT (workspace_id, user_id) DO NOTHING;

  RETURN v_workspace_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_workspace_invitation(_workspace_id UUID, _email TEXT, _role public.workspace_role DEFAULT 'member')
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_email TEXT := lower(trim(_email));
  v_invitation_id UUID;
  v_existing_user UUID;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.can_manage_workspace(_workspace_id, v_uid) THEN
    RAISE EXCEPTION 'Only workspace admins can invite members';
  END IF;

  IF _role = 'owner' THEN
    RAISE EXCEPTION 'Owner role cannot be granted by invitation';
  END IF;

  IF v_email IS NULL OR v_email = '' THEN
    RAISE EXCEPTION 'Email is required';
  END IF;

  SELECT p.user_id INTO v_existing_user
  FROM public.profiles p
  WHERE lower(p.email) = v_email
  LIMIT 1;

  IF v_existing_user IS NULL THEN
    RAISE EXCEPTION 'Only registered users can be invited';
  END IF;

  INSERT INTO public.workspace_invitations (workspace_id, email, role, invited_by_user_id)
  VALUES (_workspace_id, v_email, _role, v_uid)
  ON CONFLICT (workspace_id, email)
  DO UPDATE SET role = EXCLUDED.role, invited_by_user_id = EXCLUDED.invited_by_user_id, accepted_by_user_id = NULL, accepted_at = NULL, updated_at = now()
  RETURNING id INTO v_invitation_id;

  RETURN v_invitation_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_workspace_invitation(_invitation_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_email TEXT;
  v_inv public.workspace_invitations%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT email INTO v_email
  FROM public.profiles
  WHERE user_id = v_uid
  LIMIT 1;

  SELECT * INTO v_inv
  FROM public.workspace_invitations
  WHERE id = _invitation_id
  LIMIT 1;

  IF v_inv.id IS NULL THEN
    RAISE EXCEPTION 'Invitation not found';
  END IF;

  IF v_inv.accepted_at IS NOT NULL THEN
    RETURN v_inv.workspace_id;
  END IF;

  IF lower(coalesce(v_email, '')) <> lower(v_inv.email) THEN
    RAISE EXCEPTION 'Invitation email does not match your account';
  END IF;

  INSERT INTO public.workspace_members (workspace_id, user_id, role, invited_by_user_id)
  VALUES (v_inv.workspace_id, v_uid, v_inv.role, v_inv.invited_by_user_id)
  ON CONFLICT (workspace_id, user_id)
  DO UPDATE SET role = EXCLUDED.role, updated_at = now();

  UPDATE public.workspace_invitations
  SET accepted_by_user_id = v_uid,
      accepted_at = now(),
      updated_at = now()
  WHERE id = v_inv.id;

  RETURN v_inv.workspace_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_workspace_id UUID;
BEGIN
  INSERT INTO public.profiles (user_id, display_name, email)
  VALUES (NEW.id, NULL, lower(NEW.email))
  ON CONFLICT (user_id) DO UPDATE
  SET email = EXCLUDED.email;

  INSERT INTO public.workspaces (owner_user_id, name)
  VALUES (NEW.id, 'Personal')
  RETURNING id INTO v_workspace_id;

  INSERT INTO public.workspace_members (workspace_id, user_id, role, invited_by_user_id)
  VALUES (v_workspace_id, NEW.id, 'owner', NEW.id)
  ON CONFLICT (workspace_id, user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_task_workspace_assignment()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.assigned_to_user_id IS NOT NULL AND NOT public.is_workspace_member(NEW.workspace_id, NEW.assigned_to_user_id) THEN
    RAISE EXCEPTION 'Assignee must be a member of the same workspace';
  END IF;
  RETURN NEW;
END;
$$;

UPDATE public.profiles p
SET email = lower(u.email)
FROM auth.users u
WHERE u.id = p.user_id
  AND (p.email IS NULL OR p.email <> lower(u.email));

INSERT INTO public.workspaces (owner_user_id, name)
SELECT p.user_id, 'Personal'
FROM public.profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM public.workspaces w WHERE w.owner_user_id = p.user_id AND lower(w.name) = 'personal'
);

INSERT INTO public.workspace_members (workspace_id, user_id, role, invited_by_user_id)
SELECT w.id, w.owner_user_id, 'owner', w.owner_user_id
FROM public.workspaces w
WHERE lower(w.name) = 'personal'
ON CONFLICT (workspace_id, user_id) DO NOTHING;

UPDATE public.tasks t
SET workspace_id = w.id
FROM public.workspaces w
WHERE t.workspace_id IS NULL
  AND w.owner_user_id = t.user_id
  AND lower(w.name) = 'personal';

ALTER TABLE public.tasks
ALTER COLUMN workspace_id SET NOT NULL;

DROP POLICY IF EXISTS "View own or shared tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users insert own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Update own or completer-shared tasks" ON public.tasks;
DROP POLICY IF EXISTS "Owner deletes own tasks" ON public.tasks;

CREATE POLICY "Workspace members can view workspace tasks"
ON public.tasks
FOR SELECT
TO authenticated
USING (
  public.is_workspace_member(workspace_id, auth.uid())
  OR public.has_task_access(id, auth.uid())
);

CREATE POLICY "Workspace members can create workspace tasks"
ON public.tasks
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_workspace_member(workspace_id, auth.uid())
  AND public.is_workspace_member(workspace_id, user_id)
  AND (assigned_to_user_id IS NULL OR public.is_workspace_member(workspace_id, assigned_to_user_id))
);

CREATE POLICY "Workspace members can update workspace tasks"
ON public.tasks
FOR UPDATE
TO authenticated
USING (
  public.is_workspace_member(workspace_id, auth.uid())
  OR public.has_share_role(id, auth.uid(), 'completer')
)
WITH CHECK (
  public.is_workspace_member(workspace_id, auth.uid())
  AND public.is_workspace_member(workspace_id, user_id)
  AND (assigned_to_user_id IS NULL OR public.is_workspace_member(workspace_id, assigned_to_user_id))
);

CREATE POLICY "Task owners or workspace admins can delete workspace tasks"
ON public.tasks
FOR DELETE
TO authenticated
USING (
  auth.uid() = user_id
  OR public.can_manage_workspace(workspace_id, auth.uid())
);

DROP POLICY IF EXISTS "Users read own profile" ON public.profiles;
CREATE POLICY "Users read own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Workspace members can view member profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1
    FROM public.workspace_members me
    JOIN public.workspace_members them
      ON them.workspace_id = me.workspace_id
    WHERE me.user_id = auth.uid()
      AND them.user_id = profiles.user_id
  )
);

CREATE POLICY "Members can view their workspaces"
ON public.workspaces
FOR SELECT
TO authenticated
USING (public.is_workspace_member(id, auth.uid()));

CREATE POLICY "Users can create workspaces"
ON public.workspaces
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = owner_user_id);

CREATE POLICY "Workspace owners and admins can update workspaces"
ON public.workspaces
FOR UPDATE
TO authenticated
USING (public.can_manage_workspace(id, auth.uid()))
WITH CHECK (public.can_manage_workspace(id, auth.uid()));

CREATE POLICY "Workspace owners can delete workspaces"
ON public.workspaces
FOR DELETE
TO authenticated
USING (public.has_workspace_role(id, auth.uid(), 'owner'));

CREATE POLICY "Members can view workspace members"
ON public.workspace_members
FOR SELECT
TO authenticated
USING (public.is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Workspace admins can add members"
ON public.workspace_members
FOR INSERT
TO authenticated
WITH CHECK (public.can_manage_workspace(workspace_id, auth.uid()));

CREATE POLICY "Workspace admins can update members"
ON public.workspace_members
FOR UPDATE
TO authenticated
USING (public.can_manage_workspace(workspace_id, auth.uid()))
WITH CHECK (public.can_manage_workspace(workspace_id, auth.uid()));

CREATE POLICY "Workspace owners and self can delete members"
ON public.workspace_members
FOR DELETE
TO authenticated
USING (
  public.has_workspace_role(workspace_id, auth.uid(), 'owner')
  OR user_id = auth.uid()
);

CREATE POLICY "Members can view workspace invitations"
ON public.workspace_invitations
FOR SELECT
TO authenticated
USING (
  public.is_workspace_member(workspace_id, auth.uid())
  OR lower(email) = lower(coalesce((SELECT p.email FROM public.profiles p WHERE p.user_id = auth.uid() LIMIT 1), ''))
);

CREATE POLICY "Workspace admins can create invitations"
ON public.workspace_invitations
FOR INSERT
TO authenticated
WITH CHECK (public.can_manage_workspace(workspace_id, auth.uid()));

CREATE POLICY "Workspace admins can update invitations"
ON public.workspace_invitations
FOR UPDATE
TO authenticated
USING (public.can_manage_workspace(workspace_id, auth.uid()))
WITH CHECK (public.can_manage_workspace(workspace_id, auth.uid()));

CREATE POLICY "Workspace admins can delete invitations"
ON public.workspace_invitations
FOR DELETE
TO authenticated
USING (public.can_manage_workspace(workspace_id, auth.uid()));

CREATE TRIGGER set_workspaces_updated_at
BEFORE UPDATE ON public.workspaces
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_workspace_members_updated_at
BEFORE UPDATE ON public.workspace_members
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_workspace_invitations_updated_at
BEFORE UPDATE ON public.workspace_invitations
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS validate_task_workspace_assignment_trigger ON public.tasks;
CREATE TRIGGER validate_task_workspace_assignment_trigger
BEFORE INSERT OR UPDATE ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.validate_task_workspace_assignment();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'workspaces'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.workspaces;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'workspace_members'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.workspace_members;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'workspace_invitations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.workspace_invitations;
  END IF;
END $$;