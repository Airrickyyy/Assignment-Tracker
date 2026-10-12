-- ============================================================
-- JARVIS — remove unused table privileges from API roles
-- Migration: 004_revoke_unused_privileges.sql
--
-- RLS audit 2026-10-12: anon and authenticated held TRUNCATE,
-- TRIGGER and REFERENCES on every public table (Supabase default
-- grants). TRUNCATE is not subject to RLS. PostgREST can't issue
-- it, but nothing in JARVIS needs these, so they're revoked as
-- defence in depth. Row-level SELECT/INSERT/UPDATE/DELETE grants
-- (still gated by RLS policies) are untouched.
--
-- Rerunnable: yes (REVOKE is idempotent)
-- ============================================================

REVOKE TRUNCATE, TRIGGER, REFERENCES
  ON public.assignments,
     public.user_preferences,
     public.push_subscriptions,
     public.push_reminders_sent
  FROM anon, authenticated;
