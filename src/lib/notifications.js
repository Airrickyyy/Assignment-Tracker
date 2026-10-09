// ── Helpers ──────────────────────────────────────────────────────────────────

/** Format a Date as 'YYYY-MM-DD' in the user's local timezone. */
function localDateStr(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// ── Public API ────────────────────────────────────────────────────────────────

export const REMINDER_WINDOW_HOURS = 48

/**
 * Derive overdue and upcoming reminders from an assignments array.
 *
 * Rules:
 * - Completed assignments are never included.
 * - An assignment is overdue when its due-date string is strictly before
 *   today's local date string (i.e. the calendar day has passed).
 * - An assignment is upcoming when it is due today or within the next
 *   REMINDER_WINDOW_HOURS hours, measured from right now.
 * - String comparison on 'YYYY-MM-DD' is safe for ISO dates and keeps
 *   the logic in local time, matching the app-wide `dueDate + 'T00:00:00'`
 *   convention.
 *
 * Returns { upcoming, overdue, total } — arrays sorted by dueDate ascending
 * for upcoming and descending (most recent first) for overdue.
 */
export function deriveReminders(assignments) {
  const now      = new Date()
  const todayStr = localDateStr(now)
  const windowEnd    = new Date(now.getTime() + REMINDER_WINDOW_HOURS * 60 * 60 * 1000)
  const windowEndStr = localDateStr(windowEnd)

  const upcoming = []
  const overdue  = []

  for (const a of assignments) {
    if (a.status === 'completed') continue
    if (a.dueDate < todayStr) {
      overdue.push(a)
    } else if (a.dueDate <= windowEndStr) {
      upcoming.push(a)
    }
  }

  upcoming.sort((a, b) =>  a.dueDate.localeCompare(b.dueDate))
  overdue.sort( (a, b) => -a.dueDate.localeCompare(b.dueDate)) // most recent first

  return { upcoming, overdue, total: upcoming.length + overdue.length }
}
