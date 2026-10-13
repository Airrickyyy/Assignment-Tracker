-- ============================================================
-- JARVIS — study tracking (Phases 5C focus timer / 5D study progress)
-- Migration: 005_focus_sessions.sql
--
-- 1. focus_sessions: one row per completed (or stopped ≥1 min) focus
--    session. The client generates the id when the timer starts, so if
--    two windows both notice the session ending, the second insert is a
--    harmless primary-key conflict.
-- 2. assignments.completed_at: set by trigger when an assignment becomes
--    completed, cleared when it's reopened — "completed per day" stats
--    without trusting the client clock.
--
-- Rerunnable: yes
-- ============================================================


-- ------------------------------------------------------------
-- TABLE: public.focus_sessions
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.focus_sessions (
  id                UUID         NOT NULL,
  user_id           UUID         NOT NULL DEFAULT auth.uid()
                      REFERENCES auth.users(id) ON DELETE CASCADE,
  assignment_id     UUID
                      REFERENCES public.assignments(id) ON DELETE SET NULL,
  course            TEXT         NOT NULL DEFAULT '',
  label             TEXT         NOT NULL DEFAULT '',
  started_at        TIMESTAMPTZ  NOT NULL,
  ended_at          TIMESTAMPTZ  NOT NULL,
  duration_seconds  INTEGER      NOT NULL,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),

  CONSTRAINT focus_sessions_pkey
    PRIMARY KEY (id),

  CONSTRAINT focus_sessions_duration_check
    CHECK (duration_seconds BETWEEN 60 AND 6 * 60 * 60),

  CONSTRAINT focus_sessions_order_check
    CHECK (ended_at > started_at),

  CONSTRAINT focus_sessions_text_check
    CHECK (length(course) <= 200 AND length(label) <= 300)
);

CREATE INDEX IF NOT EXISTS idx_focus_sessions_user_started
  ON public.focus_sessions (user_id, started_at DESC);

ALTER TABLE public.focus_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "focus_sessions_select" ON public.focus_sessions;
DROP POLICY IF EXISTS "focus_sessions_insert" ON public.focus_sessions;
DROP POLICY IF EXISTS "focus_sessions_delete" ON public.focus_sessions;

CREATE POLICY "focus_sessions_select"
  ON public.focus_sessions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "focus_sessions_insert"
  ON public.focus_sessions
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "focus_sessions_delete"
  ON public.focus_sessions
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Sessions are logged once and never edited. Same least-privilege grants
-- as the rest of the schema (see 003 / 004).
REVOKE ALL ON public.focus_sessions FROM anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.focus_sessions TO authenticated;


-- ------------------------------------------------------------
-- COLUMN: public.assignments.completed_at
-- ------------------------------------------------------------

ALTER TABLE public.assignments
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- Backfill: best available signal for already-completed assignments.
UPDATE public.assignments
   SET completed_at = updated_at
 WHERE status = 'completed' AND completed_at IS NULL;

CREATE OR REPLACE FUNCTION public.set_assignment_completed_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.status = 'completed' THEN
    IF TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'completed' THEN
      NEW.completed_at := now();
    END IF;
  ELSE
    NEW.completed_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assignments_completed_at ON public.assignments;

CREATE TRIGGER trg_assignments_completed_at
  BEFORE INSERT OR UPDATE OF status ON public.assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.set_assignment_completed_at();
