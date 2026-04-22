
-- Status enum for assignments
DO $$ BEGIN
  CREATE TYPE public.assignment_status AS ENUM ('pending', 'completed', 'overdue');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  subject text NOT NULL,
  title text NOT NULL,
  description text,
  due_date timestamptz,
  submitted_at timestamptz,
  progress integer NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  status public.assignment_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_assignments_user ON public.assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_assignments_due ON public.assignments(due_date);

ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own assignments" ON public.assignments;
CREATE POLICY "Users view own assignments" ON public.assignments
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert own assignments" ON public.assignments;
CREATE POLICY "Users insert own assignments" ON public.assignments
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own assignments" ON public.assignments;
CREATE POLICY "Users update own assignments" ON public.assignments
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users delete own assignments" ON public.assignments;
CREATE POLICY "Users delete own assignments" ON public.assignments
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS trg_assignments_updated_at ON public.assignments;
CREATE TRIGGER trg_assignments_updated_at
  BEFORE UPDATE ON public.assignments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
