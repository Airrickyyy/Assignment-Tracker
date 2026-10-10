import { useEffect, useRef } from 'react'

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

function fire(type, assignment, onNavigate) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return
  const isOverdue = type === 'overdue'
  const title = isOverdue
    ? `Overdue: ${assignment.title}`
    : `Due soon: ${assignment.title}`
  const body = [
    assignment.course || null,
    isOverdue
      ? `Was due ${formatDate(assignment.dueDate)}`
      : `Due ${formatDate(assignment.dueDate)}`,
  ].filter(Boolean).join(' · ')
  const tag = `jarvis-${type}-${assignment.id}`
  try {
    const n = new Notification(title, {
      body,
      icon: '/favicon.ico',
      // tag deduplicates at the OS level — one notification per assignment per type
      tag,
      requireInteraction: false,
    })
    n.onclick = () => {
      window.focus()
      onNavigate?.('assignments')
      n.close()
    }
  } catch (err) {
    console.warn('Notification() failed:', err)
  }
}

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * Fires browser Notification API alerts for newly-detected reminders.
 *
 * Initial-load behaviour: the very first qualifying run seeds the sent-set
 * without firing, so existing assignments do not flood the user on sign-in.
 * Crucially, seeding is deferred until `assignmentsLoaded` is true so the
 * seed captures the actual cloud data rather than the empty array that
 * exists while the initial fetchAssignments() call is in-flight. Without
 * this guard, sessionUserId becoming non-null fires the effect before the
 * fetch completes, seeds with [], then treats every loaded assignment as
 * "new" — causing a flood and potentially throttling subsequent alerts.
 *
 * `reminders`         — derived from deriveReminders(); recomputed on CRUD
 *                       changes and on the 5-minute notifTick from App.jsx.
 * `enabled`           — user's JARVIS-level toggle (desktopNotificationsEnabled).
 * `sessionUserId`     — current auth user id; null when signed out.
 * `assignmentsLoaded` — true once the initial fetchAssignments() resolves;
 *                       reset to false on sign-out to prevent stale seeds.
 * `onNavigate`        — stable setActiveView ref; excluded from dep array.
 */
export function useDesktopNotifications({ reminders, enabled, sessionUserId, assignmentsLoaded, onNavigate }) {
  const sentRef     = useRef(new Set())
  const seededRef   = useRef(false)
  const prevUserRef = useRef(null)

  useEffect(() => {
    // ── Reset when the authenticated user changes ─────────────────────────
    if (sessionUserId !== prevUserRef.current) {
      sentRef.current   = new Set()
      seededRef.current = false
      prevUserRef.current = sessionUserId
    }

    // ── Guard: all conditions must be met ─────────────────────────────────
    if (!sessionUserId) return
    if (!enabled) return
    if (!('Notification' in window)) return
    if (Notification.permission !== 'granted') return

    const { upcoming = [], overdue = [] } = reminders

    // ── First qualifying run: seed without firing ─────────────────────────
    if (!seededRef.current) {
      // Wait until the initial cloud fetch has completed. Without this, the
      // effect fires while assignments = [] (fetch in-flight), seeds nothing,
      // then fires notifications for ALL loaded assignments on the next run.
      if (!assignmentsLoaded) return
      for (const a of upcoming) sentRef.current.add(`upcoming:${a.id}`)
      for (const a of overdue)  sentRef.current.add(`overdue:${a.id}`)
      seededRef.current = true
      return
    }

    // ── Subsequent runs: notify for newly-entered items only ──────────────
    // Overdue checked first so an assignment that crosses midnight gets an
    // overdue alert even if it was already seeded as upcoming.
    for (const a of overdue) {
      const key = `overdue:${a.id}`
      if (!sentRef.current.has(key)) {
        sentRef.current.add(key)
        fire('overdue', a, onNavigate)
      }
    }
    for (const a of upcoming) {
      const key = `upcoming:${a.id}`
      if (!sentRef.current.has(key)) {
        sentRef.current.add(key)
        fire('upcoming', a, onNavigate)
      }
    }
    // onNavigate (= setActiveView) is a stable React dispatch ref — safe to
    // exclude from deps to avoid re-seeding when the function identity changes.
  }, [reminders, enabled, sessionUserId, assignmentsLoaded])
}
