DROP POLICY IF EXISTS "Users delete own tasks" ON public.tasks;

CREATE POLICY "Delete own or shared tasks"
  ON public.tasks FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id OR public.has_task_access(id, auth.uid()));