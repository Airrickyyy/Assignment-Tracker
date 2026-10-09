-- ============================================================
-- JARVIS — initial schema
-- Migration: 001_initial_schema.sql
--
-- Rerunnable: yes
--   Tables  : CREATE TABLE IF NOT EXISTS — skipped if present
--   Indexes : CREATE INDEX IF NOT EXISTS — skipped if present
--   RLS     : ENABLE ROW LEVEL SECURITY  — idempotent
--   Policies: every policy is dropped by full name+table before
--             being recreated, so a second run will not fail
--             with a duplicate-policy error
--
-- Secrets  : none — no passwords, no service-role keys
-- ============================================================


-- ------------------------------------------------------------
-- TABLE: public.assignments
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.assignments (
  id               UUID         NOT NULL DEFAULT gen_random_uuid(),
  user_id          UUID         NOT NULL
                     REFERENCES auth.users(id) ON DELETE CASCADE,
  title            TEXT         NOT NULL,
  course           TEXT         NOT NULL DEFAULT '',
  due_date         DATE         NOT NULL,
  priority         TEXT         NOT NULL DEFAULT 'medium',
  status           TEXT         NOT NULL DEFAULT 'pending',
  points           INTEGER,
  estimated_hours  NUMERIC(4,1),
  description      TEXT,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),

  CONSTRAINT assignments_pkey
    PRIMARY KEY (id),

  CONSTRAINT assignments_priority_check
    CHECK (priority IN ('low', 'medium', 'high')),

  CONSTRAINT assignments_status_check
    CHECK (status IN ('pending', 'overdue', 'completed'))
);

-- Index on user_id: every data-fetch query filters by owner.
CREATE INDEX IF NOT EXISTS idx_assignments_user_id
  ON public.assignments (user_id);

-- Index on due_date: calendar view and "this week" range queries.
CREATE INDEX IF NOT EXISTS idx_assignments_due_date
  ON public.assignments (due_date);


-- ------------------------------------------------------------
-- TABLE: public.user_preferences
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.user_preferences (
  user_id                      UUID         NOT NULL
                                 REFERENCES auth.users(id) ON DELETE CASCADE,
  default_priority             TEXT         NOT NULL DEFAULT 'medium',
  show_completed_on_dashboard  BOOLEAN      NOT NULL DEFAULT TRUE,
  overdue_reminder             TEXT         NOT NULL DEFAULT 'banner',
  updated_at                   TIMESTAMPTZ  NOT NULL DEFAULT now(),

  CONSTRAINT user_preferences_pkey
    PRIMARY KEY (user_id),

  CONSTRAINT user_preferences_default_priority_check
    CHECK (default_priority IN ('low', 'medium', 'high')),

  CONSTRAINT user_preferences_overdue_reminder_check
    CHECK (overdue_reminder IN ('banner', 'none'))
);


-- ------------------------------------------------------------
-- ROW LEVEL SECURITY
-- ------------------------------------------------------------

ALTER TABLE public.assignments      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;


-- ------------------------------------------------------------
-- DROP EXISTING POLICIES
-- Every statement names both the policy and its table so that
-- no statement is ambiguous or incomplete.
-- ------------------------------------------------------------

DROP POLICY IF EXISTS "assignments_select" ON public.assignments;
DROP POLICY IF EXISTS "assignments_insert" ON public.assignments;
DROP POLICY IF EXISTS "assignments_update" ON public.assignments;
DROP POLICY IF EXISTS "assignments_delete" ON public.assignments;

DROP POLICY IF EXISTS "user_preferences_select" ON public.user_preferences;
DROP POLICY IF EXISTS "user_preferences_insert" ON public.user_preferences;
DROP POLICY IF EXISTS "user_preferences_update" ON public.user_preferences;
DROP POLICY IF EXISTS "user_preferences_delete" ON public.user_preferences;


-- ------------------------------------------------------------
-- POLICIES: public.assignments
-- ------------------------------------------------------------

CREATE POLICY "assignments_select"
  ON public.assignments
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "assignments_insert"
  ON public.assignments
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "assignments_update"
  ON public.assignments
  FOR UPDATE
  TO authenticated
  USING     (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "assignments_delete"
  ON public.assignments
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);


-- ------------------------------------------------------------
-- POLICIES: public.user_preferences
-- ------------------------------------------------------------

CREATE POLICY "user_preferences_select"
  ON public.user_preferences
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "user_preferences_insert"
  ON public.user_preferences
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_preferences_update"
  ON public.user_preferences
  FOR UPDATE
  TO authenticated
  USING     (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_preferences_delete"
  ON public.user_preferences
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
