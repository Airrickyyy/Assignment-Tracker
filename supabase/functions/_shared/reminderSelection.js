// Shared between the send-reminders Edge Function (Deno) and Vitest (Node).
// Plain JS, no imports, so both runtimes can load it unchanged.

export const REMINDER_WINDOW_HOURS = 48
export const MAX_INDIVIDUAL_PUSHES = 3

/** 'YYYY-MM-DD' for `date` as seen in `timeZone` (IANA name, e.g. 'America/Toronto'). */
export function localDateInZone(date, timeZone) {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

/** Shift a 'YYYY-MM-DD' string by whole days, independent of any time zone. */
export function addDays(dateStr, days) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}

export function reminderKey(type, assignmentId, dueDate) {
  return `${type}:${assignmentId}:${dueDate}`
}

/**
 * Pick the reminders a user should be pushed right now.
 *
 * Mirrors deriveReminders() in src/lib/notifications.js, evaluated in the
 * user's own time zone, with two server-side differences:
 * - Overdue is limited to assignments due *yesterday* — the day they became
 *   overdue — so a first subscription never floods with an old backlog.
 * - Anything whose key is in `sentKeys` is skipped. The key includes the due
 *   date, so moving an assignment's deadline makes it eligible again.
 *
 * `assignments` are DB rows: { id, title, course, due_date, status }.
 * Returns [{ type, key, assignment }], overdue first.
 */
export function selectPushReminders(assignments, { now, timeZone, sentKeys }) {
  const today     = localDateInZone(now, timeZone)
  const yesterday = addDays(today, -1)
  const windowEnd = localDateInZone(
    new Date(now.getTime() + REMINDER_WINDOW_HOURS * 60 * 60 * 1000),
    timeZone,
  )

  const overdue  = []
  const upcoming = []

  for (const a of assignments) {
    if (a.status === 'completed') continue
    const due = a.due_date
    let type = null
    if (due < today) {
      if (due >= yesterday) type = 'overdue'
    } else if (due <= windowEnd) {
      type = 'upcoming'
    }
    if (!type) continue
    const key = reminderKey(type, a.id, due)
    if (sentKeys.has(key)) continue
    ;(type === 'overdue' ? overdue : upcoming).push({ type, key, assignment: a })
  }

  upcoming.sort((x, y) => x.assignment.due_date.localeCompare(y.assignment.due_date))
  return [...overdue, ...upcoming]
}

function formatDue(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

/**
 * Turn selected reminders into push payloads. Titles and tags match the
 * in-tab notifications (useDesktopNotifications) so the OS replaces rather
 * than stacks a reminder that both paths deliver. More than
 * MAX_INDIVIDUAL_PUSHES collapses into one summary notification.
 */
export function buildPushPayloads(items) {
  if (items.length > MAX_INDIVIDUAL_PUSHES) {
    const overdue  = items.filter(i => i.type === 'overdue').length
    const upcoming = items.length - overdue
    const parts = []
    if (upcoming) parts.push(`${upcoming} due soon`)
    if (overdue)  parts.push(`${overdue} overdue`)
    return [{
      title: `JARVIS: ${items.length} assignments need attention`,
      body:  parts.join(' · '),
      tag:   'jarvis-summary',
      view:  'assignments',
    }]
  }

  return items.map(({ type, assignment: a }) => {
    const isOverdue = type === 'overdue'
    return {
      title: isOverdue ? `Overdue: ${a.title}` : `Due soon: ${a.title}`,
      body: [
        a.course || null,
        isOverdue ? `Was due ${formatDue(a.due_date)}` : `Due ${formatDue(a.due_date)}`,
      ].filter(Boolean).join(' · '),
      tag:  `jarvis-${type}-${a.id}`,
      view: 'assignments',
    }
  })
}
