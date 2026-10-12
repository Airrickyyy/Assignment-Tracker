// Data for the Quick Panel (Phase 5A). Pure functions over the frontend
// assignment shape so the panel can be hosted anywhere (web overlay now,
// Tauri window later) and tested without a DOM.
//
// Dates follow the app-wide convention: 'YYYY-MM-DD' strings compared as
// strings, interpreted in the user's local time zone.

/** 'YYYY-MM-DD' for `date` in local time. */
export function localDateStr(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function shiftDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return localDateStr(d)
}

/** Monday and Sunday of the week containing `dateStr`. */
export function weekBounds(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  const sinceMonday = (d.getDay() + 6) % 7
  const start = shiftDays(dateStr, -sinceMonday)
  return { start, end: shiftDays(start, 6) }
}

const PRIORITY_RANK = { high: 0, medium: 1, low: 2 }

function byDueThenPriority(a, b) {
  return (
    a.dueDate.localeCompare(b.dueDate) ||
    (PRIORITY_RANK[a.priority] ?? 1) - (PRIORITY_RANK[b.priority] ?? 1) ||
    a.title.localeCompare(b.title)
  )
}

function sumHours(list) {
  const total = list.reduce((sum, a) => sum + (Number(a.estimatedHours) || 0), 0)
  return Math.round(total * 10) / 10
}

/**
 * Everything the Quick Panel shows, derived from the assignments array.
 *
 * - overdue / dueToday / dueTomorrow / upcoming / next7 contain only
 *   assignments that aren't completed, sorted by due date then priority.
 * - next7 = due today through 6 days from now (7 calendar days).
 * - stats.week    = assignments due Mon–Sun of the current week, done vs total.
 * - stats.hours   = estimated hours due in the next 7 days, left vs total.
 * - stats.onTrack = open assignments that aren't overdue, vs all open.
 */
export function buildQuickPanelData(assignments, now = new Date()) {
  const today     = localDateStr(now)
  const tomorrow  = shiftDays(today, 1)
  const weekAhead = shiftDays(today, 6)

  const open = assignments.filter(a => a.status !== 'completed').sort(byDueThenPriority)

  const overdue     = open.filter(a => a.dueDate < today)
  const dueToday    = open.filter(a => a.dueDate === today)
  const dueTomorrow = open.filter(a => a.dueDate === tomorrow)
  const upcoming    = open.filter(a => a.dueDate >= today)
  const next7       = upcoming.filter(a => a.dueDate <= weekAhead)

  const { start, end } = weekBounds(today)
  const thisWeek = assignments.filter(a => a.dueDate >= start && a.dueDate <= end)
  const next7All = assignments.filter(a => a.dueDate >= today && a.dueDate <= weekAhead)

  return {
    today,
    overdue,
    dueToday,
    dueTomorrow,
    upcoming,
    next7,
    stats: {
      week:    { done: thisWeek.filter(a => a.status === 'completed').length, total: thisWeek.length },
      hours:   { left: sumHours(next7), total: sumHours(next7All) },
      onTrack: { count: open.length - overdue.length, total: open.length, overdue: overdue.length },
    },
  }
}

/** Short relative due label: 'Today', 'Tomorrow', 'Thu', 'Oct 20', '2d overdue'. */
export function dueLabel(dueDate, today) {
  if (dueDate === today) return 'Today'
  const diff = Math.round(
    (new Date(dueDate + 'T00:00:00') - new Date(today + 'T00:00:00')) / 86_400_000,
  )
  if (diff < 0) return `${-diff}d overdue`
  if (diff === 1) return 'Tomorrow'
  const date = new Date(dueDate + 'T00:00:00')
  if (diff < 7) return date.toLocaleDateString('en-US', { weekday: 'short' })
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
