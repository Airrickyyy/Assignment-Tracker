-- ============================================================
-- JARVIS — table privileges for Phase 3C push tables
-- Migration: 003_push_grants.sql
--
-- Newer Supabase projects don't auto-grant the API roles access to
-- tables created in SQL, so 002's tables were unreachable
-- ("permission denied for table push_subscriptions"). RLS still
-- decides which rows each role sees; these grants only allow the
-- statements at all.
--
-- Rerunnable: yes (GRANT is idempotent)
-- ============================================================

-- Browser: list and remove its own subscription (RLS: own rows only).
-- Inserts/updates go through register_push_subscription().
GRANT SELECT, DELETE ON public.push_subscriptions TO authenticated;

-- send-reminders Edge Function (service role).
GRANT SELECT, DELETE         ON public.push_subscriptions  TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.push_reminders_sent TO service_role;
GRANT SELECT                 ON public.assignments         TO service_role;
