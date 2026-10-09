import { supabase } from './supabaseClient'

// ── Shape mappers ────────────────────────────────────────────────────────────

function toFrontend(row) {
  return {
    defaultPriority:          row.default_priority,
    showCompletedOnDashboard: row.show_completed_on_dashboard,
    overdueReminder:          row.overdue_reminder,
  }
}

function toDb(userId, settings) {
  return {
    user_id:                     userId,
    default_priority:            settings.defaultPriority,
    show_completed_on_dashboard: settings.showCompletedOnDashboard,
    overdue_reminder:            settings.overdueReminder,
    updated_at:                  new Date().toISOString(),
  }
}

// ── Repository functions ─────────────────────────────────────────────────────

/**
 * Fetch preferences for the authenticated user.
 * Returns null when no row exists yet (new account).
 * RLS scopes the result to auth.uid() — no userId argument needed.
 */
export async function fetchPreferences() {
  const { data, error } = await supabase
    .from('user_preferences')
    .select('*')
    .maybeSingle()
  if (error) throw error
  return data ? toFrontend(data) : null
}

/**
 * Upsert preferences for the authenticated user.
 * user_id is the primary key so subsequent calls update in place.
 * Both INSERT and UPDATE RLS policies verify auth.uid() = user_id.
 */
export async function upsertPreferences(userId, settings) {
  const { data, error } = await supabase
    .from('user_preferences')
    .upsert(toDb(userId, settings), { onConflict: 'user_id' })
    .select()
    .single()
  if (error) throw error
  return toFrontend(data)
}
