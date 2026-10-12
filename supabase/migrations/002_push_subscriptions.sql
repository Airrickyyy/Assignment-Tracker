-- ============================================================
-- JARVIS — background push reminders (Phase 3C)
-- Migration: 002_push_subscriptions.sql
--
-- Rerunnable: yes (IF NOT EXISTS / CREATE OR REPLACE / DROP POLICY IF EXISTS)
-- Secrets  : none. The pg_cron schedule that calls the Edge Function
--            needs secrets, so it lives in docs/PHASE-3C-SETUP.md.
-- ============================================================


-- ------------------------------------------------------------
-- TABLE: public.push_subscriptions
-- One row per browser push endpoint. An endpoint belongs to
-- whichever user most recently signed in on that browser.
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  endpoint    TEXT         NOT NULL,
  user_id     UUID         NOT NULL
                REFERENCES auth.users(id) ON DELETE CASCADE,
  p256dh      TEXT         NOT NULL,
  auth        TEXT         NOT NULL,
  time_zone   TEXT         NOT NULL DEFAULT 'UTC',
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),

  CONSTRAINT push_subscriptions_pkey
    PRIMARY KEY (endpoint)
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id
  ON public.push_subscriptions (user_id);


-- ------------------------------------------------------------
-- TABLE: public.push_reminders_sent
-- Server-side dedup log, written only by the send-reminders
-- Edge Function (service role). The key includes due_date so a
-- rescheduled assignment can be reminded again.
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.push_reminders_sent (
  assignment_id  UUID         NOT NULL
                   REFERENCES public.assignments(id) ON DELETE CASCADE,
  reminder_type  TEXT         NOT NULL,
  due_date       DATE         NOT NULL,
  sent_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),

  CONSTRAINT push_reminders_sent_pkey
    PRIMARY KEY (assignment_id, reminder_type, due_date),

  CONSTRAINT push_reminders_sent_type_check
    CHECK (reminder_type IN ('upcoming', 'overdue'))
);


-- ------------------------------------------------------------
-- ROW LEVEL SECURITY
-- push_subscriptions: users may read and delete their own rows.
--   Inserts/updates go through register_push_subscription() so
--   an endpoint can move between accounts on a shared browser.
-- push_reminders_sent: RLS on, no policies → service role only.
-- ------------------------------------------------------------

ALTER TABLE public.push_subscriptions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_reminders_sent ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "push_subscriptions_select" ON public.push_subscriptions;
DROP POLICY IF EXISTS "push_subscriptions_delete" ON public.push_subscriptions;

CREATE POLICY "push_subscriptions_select"
  ON public.push_subscriptions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "push_subscriptions_delete"
  ON public.push_subscriptions
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);


-- ------------------------------------------------------------
-- FUNCTION: public.register_push_subscription
-- Upserts the caller's subscription for this browser endpoint.
-- SECURITY DEFINER so it can take over an endpoint previously
-- registered by another account on the same browser. Endpoints
-- are unguessable capability URLs issued by the push service.
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.register_push_subscription(
  p_endpoint   TEXT,
  p_p256dh     TEXT,
  p_auth       TEXT,
  p_time_zone  TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF p_endpoint IS NULL OR p_endpoint NOT LIKE 'https://%' OR length(p_endpoint) > 2048 THEN
    RAISE EXCEPTION 'invalid push endpoint';
  END IF;

  IF coalesce(length(p_p256dh), 0) NOT BETWEEN 1 AND 256
     OR coalesce(length(p_auth), 0) NOT BETWEEN 1 AND 256 THEN
    RAISE EXCEPTION 'invalid push keys';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_timezone_names WHERE name = p_time_zone) THEN
    RAISE EXCEPTION 'invalid time zone';
  END IF;

  INSERT INTO public.push_subscriptions (endpoint, user_id, p256dh, auth, time_zone)
  VALUES (p_endpoint, auth.uid(), p_p256dh, p_auth, p_time_zone)
  ON CONFLICT (endpoint) DO UPDATE
    SET user_id    = EXCLUDED.user_id,
        p256dh     = EXCLUDED.p256dh,
        auth       = EXCLUDED.auth,
        time_zone  = EXCLUDED.time_zone,
        updated_at = now();
END;
$$;

REVOKE ALL     ON FUNCTION public.register_push_subscription(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.register_push_subscription(TEXT, TEXT, TEXT, TEXT) TO authenticated;
