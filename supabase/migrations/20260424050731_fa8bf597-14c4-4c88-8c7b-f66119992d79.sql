DROP POLICY IF EXISTS "Workspace owners and self can delete members" ON public.workspace_members;

CREATE POLICY "Admins owners and self can delete members"
ON public.workspace_members
FOR DELETE
TO authenticated
USING (
  user_id = auth.uid()
  OR (
    can_manage_workspace(workspace_id, auth.uid())
    AND role <> 'owner'
  )
);
