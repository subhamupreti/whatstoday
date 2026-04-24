-- Allow invitees to delete (reject) their own pending invitations
CREATE POLICY "Invitees can reject their invitations"
ON public.workspace_invitations
FOR DELETE
TO authenticated
USING (
  accepted_at IS NULL
  AND lower(email) = lower(COALESCE((SELECT p.email FROM public.profiles p WHERE p.user_id = auth.uid() LIMIT 1), ''))
);

-- Update task SELECT policy: members only see tasks created on/after they joined
DROP POLICY IF EXISTS "Workspace members can view workspace tasks" ON public.tasks;

CREATE POLICY "Workspace members can view workspace tasks"
ON public.tasks
FOR SELECT
TO authenticated
USING (
  has_task_access(id, auth.uid())
  OR auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM public.workspace_members wm
    WHERE wm.workspace_id = tasks.workspace_id
      AND wm.user_id = auth.uid()
      AND tasks.created_at >= wm.created_at
  )
);
