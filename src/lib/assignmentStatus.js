import { localDateStr } from './quickPanel'

// The stored `status` column is only recomputed on create/edit, so an
// assignment saved as 'pending' stays 'pending' after its due date passes.
// Views use the effective status instead: completed stays completed,
// anything else is overdue once its due date (local calendar day) has passed.

export function effectiveStatus(assignment, today) {
  if (assignment.status === 'completed') return 'completed'
  return assignment.dueDate < today ? 'overdue' : 'pending'
}

/** Assignments with `status` replaced by the effective status. Unchanged items keep their identity. */
export function withEffectiveStatus(assignments, now = new Date()) {
  const today = localDateStr(now)
  return assignments.map(a => {
    const status = effectiveStatus(a, today)
    return status === a.status ? a : { ...a, status }
  })
}

/** Whole calendar days from `today` to `dueDate` (negative when past). */
export function daysUntil(dueDate, today) {
  return Math.round(
    (new Date(dueDate + 'T00:00:00') - new Date(today + 'T00:00:00')) / 86_400_000,
  )
}
