CREATE OR REPLACE FUNCTION public.generate_share_code()
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  candidate text;
  attempts int := 0;
BEGIN
  LOOP
    candidate := lpad(floor(random() * 1000000)::int::text, 6, '0');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.task_shares WHERE share_code = candidate);
    attempts := attempts + 1;
    IF attempts > 50 THEN
      RAISE EXCEPTION 'Could not allocate a unique share code';
    END IF;
  END LOOP;
  RETURN candidate;
END;
$$;

-- Clear old non-numeric codes so users can generate fresh numeric ones.
DELETE FROM public.task_shares WHERE share_code !~ '^[0-9]+$';