DROP INDEX IF EXISTS public.idx_task_shares_code;
CREATE UNIQUE INDEX idx_task_shares_code ON public.task_shares(share_code);