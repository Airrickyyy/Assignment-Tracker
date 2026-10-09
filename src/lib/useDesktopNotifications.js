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
  try {
    const n = new Notification(title, {
      body,
      icon: '/favicon.ico',
      // tag deduplicates at the OS level — one notification per assignment per type
      tag: `jarvis-${type}-${assignment.id}`,
      requireInteraction: false,
    })
    n.onclick = () => {
      window.focus()
      onNavigate?.('assignments')
      n.close()
    }
  } catch {
    // Notification constructor can throw in some restricted contexts; ignore.
  }
}

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * Fires browser Notification API alerts for newly-detected reminders.
 *
 * Initial-load behaviour: the very first call that meets all conditions
 * seeds the sent-set without firing, so existing overdue/upcoming items
 * do not flood the user on sign-in.
 *
 * The sent-set and seeded flag are reset whenever `sessionUserId` changes
 * (sign-out or account switch), preventing cross-user notifications.
 *
 * `reminders`      — derived from deriveReminders(); recomputed on CRUD
 *                    changes and on the 5-minute notifTick from App.jsx.
 * `enabled`        — user's JARVIS-level toggle (settings.desktopNotificationsEnabled).
 * `sessionUserId`  — current auth user id; null when signed out.
 * `onNavigate`     — stable setActiveView ref; excluded from dep array.
 */
export function useDesktopNotifications({ reminders, enabled, sessionUserId, onNavigate }) {
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
    if (
      !sessionUserId ||
      !enabled ||
      !('Notification' in window) ||
      Notification.permission !== 'granted'
    ) return

    const { upcoming = [], overdue = [] } = reminders

    // ── First qualifying run: seed without firing ─────────────────────────
    if (!seededRef.current) {
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
  }, [reminders, enabled, sessionUserId])
}
