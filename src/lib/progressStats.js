// Study progress (Phase 5D) — pure derivations over focus sessions and
// assignments for the Progress view. Days are local calendar days.

import { localDateStr, shiftDays } from './quickPanel'

export const NO_COURSE = 'No course'

function dayOf(iso) {
  return localDateStr(new Date(iso))
}

/**
 * The last `days` days ending today, oldest first:
 * [{ date, minutes, sessions, completed }].
 * `completed` counts assignments whose completedAt falls on that day.
 */
export function dailyActivity(sessions, assignments, today, days = 7) {
  const rows = []
  const index = new Map()
  for (let i = days - 1; i >= 0; i--) {
    const date = shiftDays(today, -i)
    const row = { date, minutes: 0, sessions: 0, completed: 0 }
    rows.push(row)
    index.set(date, row)
  }
  for (const s of sessions) {
    const row = index.get(dayOf(s.startedAt))
    if (!row) continue
    row.minutes += s.durationSeconds / 60
    row.sessions += 1
  }
  for (const a of assignments) {
    if (a.status !== 'completed' || !a.completedAt) continue
    const row = index.get(dayOf(a.completedAt))
    if (row) row.completed += 1
  }
  for (const row of rows) row.minutes = Math.round(row.minutes)
  return rows
}

/**
 * Consecutive active days (any focus session or completed assignment) ending
 * today — or ending yesterday if today has no activity yet, so the streak
 * isn't shown as broken before the day is over.
 */
export function currentStreak(sessions, assignments, today) {
  const active = new Set(sessions.map(s => dayOf(s.startedAt)))
  for (const a of assignments) {
    if (a.status === 'completed' && a.completedAt) active.add(dayOf(a.completedAt))
  }
  let day = active.has(today) ? today : shiftDays(today, -1)
  let streak = 0
  while (active.has(day)) {
    streak += 1
    day = shiftDays(day, -1)
  }
  return streak
}

/** Focus minutes per course over the given sessions, largest first. */
export function courseBreakdown(sessions) {
  const totals = new Map()
  for (const s of sessions) {
    const course = s.course?.trim() || NO_COURSE
    totals.set(course, (totals.get(course) ?? 0) + s.durationSeconds / 60)
  }
  return [...totals]
    .map(([course, minutes]) => ({ course, minutes: Math.round(minutes) }))
    .filter(r => r.minutes > 0)
    .sort((a, b) => b.minutes - a.minutes || a.course.localeCompare(b.course))
}

/** Sessions that started within the last `days` days (including today). */
export function sessionsSince(sessions, today, days) {
  const first = shiftDays(today, -(days - 1))
  return sessions.filter(s => dayOf(s.startedAt) >= first)
}

export function formatMinutes(minutes) {
  if (minutes < 60) return `${minutes}m`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m ? `${h}h ${m}m` : `${h}h`
}
