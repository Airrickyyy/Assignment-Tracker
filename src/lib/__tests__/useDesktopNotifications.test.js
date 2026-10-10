/**
 * Focused tests for the seeding/trigger logic in useDesktopNotifications,
 * plus deriveReminders date classification.
 *
 * Key invariants verified:
 * 1. No notification fires for assignments present at initial load (seed-without-fire).
 * 2. A new assignment created AFTER load DOES fire a notification.
 * 3. The same assignment never fires twice in a session (deduplication).
 * 4. Nothing fires while assignmentsLoaded=false (hydration guard).
 * 5. Refs reset on user change (account isolation).
 * 6. Seeding happens correctly when enabled flips from false→true after load.
 * 7. deriveReminders classifies "due tomorrow" as upcoming (real date logic).
 * 8. Full pipeline: deriveReminders output → hook fires for new assignment.
 */

import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useDesktopNotifications } from '../useDesktopNotifications'
import { deriveReminders } from '../notifications'

// ── Fake Notification API ─────────────────────────────────────────────────────

class FakeNotification {
  constructor(title, options) {
    this.title = title
    this.options = options
    FakeNotification.instances.push(this)
  }
  close() {}
  static instances = []
  static permission = 'granted'
  static requestPermission() { return Promise.resolve('granted') }
}

function installFakeNotification() {
  FakeNotification.instances = []
  FakeNotification.permission = 'granted'
  global.Notification = FakeNotification
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeAssignment(id, dueDate, status = 'pending') {
  return { id, title: `Task ${id}`, dueDate, status, course: 'CS101' }
}

/** Returns a reminders object in the same shape as deriveReminders(). */
function makeReminders(upcomingIds = [], overdueIds = []) {
  const today = new Date()
  const fmt = (d) => d.toISOString().slice(0, 10)
  const tomorrow = fmt(new Date(today.getTime() + 24 * 60 * 60 * 1000))
  const yesterday = fmt(new Date(today.getTime() - 24 * 60 * 60 * 1000))

  const upcoming = upcomingIds.map(id => makeAssignment(id, tomorrow))
  const overdue  = overdueIds.map(id => makeAssignment(id, yesterday))
  return { upcoming, overdue, total: upcoming.length + overdue.length }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useDesktopNotifications', () => {
  beforeEach(() => {
    installFakeNotification()
  })

  it('does not fire for assignments present when assignmentsLoaded first becomes true (seed-without-fire)', () => {
    // Simulate: session active, assignments already loaded, notifications enabled.
    // The first qualifying run should seed sentRef without firing.
    const { rerender } = renderHook(
      (props) => useDesktopNotifications(props),
      {
        initialProps: {
          reminders: makeReminders(['a1', 'a2']),
          enabled: true,
          sessionUserId: 'user1',
          assignmentsLoaded: true,
          onNavigate: vi.fn(),
        },
      }
    )

    expect(FakeNotification.instances).toHaveLength(0)

    // Re-render with same reminders — should still not fire (already seeded).
    rerender({
      reminders: makeReminders(['a1', 'a2']),
      enabled: true,
      sessionUserId: 'user1',
      assignmentsLoaded: true,
      onNavigate: vi.fn(),
    })

    expect(FakeNotification.instances).toHaveLength(0)
  })

  it('fires for a NEW assignment created after the initial seed', () => {
    const onNavigate = vi.fn()

    const { rerender } = renderHook(
      (props) => useDesktopNotifications(props),
      {
        initialProps: {
          reminders: makeReminders(['a1']),
          enabled: true,
          sessionUserId: 'user1',
          assignmentsLoaded: true,
          onNavigate,
        },
      }
    )

    // Initial seed — no notifications.
    expect(FakeNotification.instances).toHaveLength(0)

    // User creates 'a2' — reminders now includes the new assignment.
    act(() => {
      rerender({
        reminders: makeReminders(['a1', 'a2']),
        enabled: true,
        sessionUserId: 'user1',
        assignmentsLoaded: true,
        onNavigate,
      })
    })

    expect(FakeNotification.instances).toHaveLength(1)
    expect(FakeNotification.instances[0].title).toContain('a2')
  })

  it('does not fire a second time for the same assignment (deduplication)', () => {
    const { rerender } = renderHook(
      (props) => useDesktopNotifications(props),
      {
        initialProps: {
          reminders: makeReminders([]),
          enabled: true,
          sessionUserId: 'user1',
          assignmentsLoaded: true,
          onNavigate: vi.fn(),
        },
      }
    )

    // First new assignment appears → fires once.
    rerender({ reminders: makeReminders(['a1']), enabled: true, sessionUserId: 'user1', assignmentsLoaded: true, onNavigate: vi.fn() })
    expect(FakeNotification.instances).toHaveLength(1)

    // Same reminders re-delivered (e.g. 5-min tick) → no duplicate.
    rerender({ reminders: makeReminders(['a1']), enabled: true, sessionUserId: 'user1', assignmentsLoaded: true, onNavigate: vi.fn() })
    expect(FakeNotification.instances).toHaveLength(1)
  })

  it('does not fire while assignmentsLoaded=false (hydration guard)', () => {
    const { rerender } = renderHook(
      (props) => useDesktopNotifications(props),
      {
        initialProps: {
          // assignments are "loaded" in reminders but the flag is still false
          reminders: makeReminders(['a1', 'a2']),
          enabled: true,
          sessionUserId: 'user1',
          assignmentsLoaded: false,
          onNavigate: vi.fn(),
        },
      }
    )

    // Flag false → should not seed or fire.
    expect(FakeNotification.instances).toHaveLength(0)

    // Flag flips true → seed fires (no notifications for existing items).
    rerender({
      reminders: makeReminders(['a1', 'a2']),
      enabled: true,
      sessionUserId: 'user1',
      assignmentsLoaded: true,
      onNavigate: vi.fn(),
    })
    expect(FakeNotification.instances).toHaveLength(0)

    // New assignment after seed → fires.
    rerender({
      reminders: makeReminders(['a1', 'a2', 'a3']),
      enabled: true,
      sessionUserId: 'user1',
      assignmentsLoaded: true,
      onNavigate: vi.fn(),
    })
    expect(FakeNotification.instances).toHaveLength(1)
    expect(FakeNotification.instances[0].title).toContain('a3')
  })

  it('resets state on user change (account isolation)', () => {
    const { rerender } = renderHook(
      (props) => useDesktopNotifications(props),
      {
        initialProps: {
          reminders: makeReminders([]),
          enabled: true,
          sessionUserId: 'user1',
          assignmentsLoaded: true,
          onNavigate: vi.fn(),
        },
      }
    )

    // user1 creates an assignment → fires once.
    rerender({ reminders: makeReminders(['a1']), enabled: true, sessionUserId: 'user1', assignmentsLoaded: true, onNavigate: vi.fn() })
    expect(FakeNotification.instances).toHaveLength(1)

    // Sign out.
    rerender({ reminders: makeReminders([]), enabled: true, sessionUserId: null, assignmentsLoaded: false, onNavigate: vi.fn() })

    // Sign in as user2 with fresh load.
    rerender({ reminders: makeReminders([]), enabled: true, sessionUserId: 'user2', assignmentsLoaded: false, onNavigate: vi.fn() })
    rerender({ reminders: makeReminders(['b1']), enabled: true, sessionUserId: 'user2', assignmentsLoaded: true, onNavigate: vi.fn() })

    // Seed for user2 should not fire for existing b1.
    expect(FakeNotification.instances).toHaveLength(1)

    // user2 creates b2 → fires.
    rerender({ reminders: makeReminders(['b1', 'b2']), enabled: true, sessionUserId: 'user2', assignmentsLoaded: true, onNavigate: vi.fn() })
    expect(FakeNotification.instances).toHaveLength(2)
    expect(FakeNotification.instances[1].title).toContain('b2')
  })

  it('does not fire when enabled=false', () => {
    const { rerender } = renderHook(
      (props) => useDesktopNotifications(props),
      {
        initialProps: {
          reminders: makeReminders([]),
          enabled: false,
          sessionUserId: 'user1',
          assignmentsLoaded: true,
          onNavigate: vi.fn(),
        },
      }
    )

    rerender({ reminders: makeReminders(['a1']), enabled: false, sessionUserId: 'user1', assignmentsLoaded: true, onNavigate: vi.fn() })
    expect(FakeNotification.instances).toHaveLength(0)
  })

  it('seeds with loaded data when enabled flips true after load — no flood, new assignment fires', () => {
    // This is the "user enables notifications after page has already loaded" path,
    // which is also what happens every page-load if desktopNotificationsEnabled was
    // persisted in localStorage as true but then reset by the sign-out effect.
    const { rerender } = renderHook(
      (props) => useDesktopNotifications(props),
      {
        initialProps: {
          reminders: makeReminders(['existing1', 'existing2']),
          enabled: false,
          sessionUserId: 'user1',
          assignmentsLoaded: true,
          onNavigate: vi.fn(),
        },
      }
    )

    // enabled=false — guard returns early, nothing seeded yet
    expect(FakeNotification.instances).toHaveLength(0)

    // User enables notifications (or preference is restored after sign-out reset fix)
    rerender({
      reminders: makeReminders(['existing1', 'existing2']),
      enabled: true,
      sessionUserId: 'user1',
      assignmentsLoaded: true,
      onNavigate: vi.fn(),
    })
    // Seed runs: existing assignments added to sentRef, no notification fires
    expect(FakeNotification.instances).toHaveLength(0)

    // User creates a new assignment
    rerender({
      reminders: makeReminders(['existing1', 'existing2', 'newAssignment']),
      enabled: true,
      sessionUserId: 'user1',
      assignmentsLoaded: true,
      onNavigate: vi.fn(),
    })
    expect(FakeNotification.instances).toHaveLength(1)
    expect(FakeNotification.instances[0].title).toContain('newAssignment')
  })
})

// ── deriveReminders date classification ───────────────────────────────────────

function localDateStr(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

describe('deriveReminders', () => {
  it('classifies a pending assignment due tomorrow as upcoming', () => {
    const tomorrow = localDateStr(new Date(Date.now() + 24 * 60 * 60 * 1000))
    const a = { id: 'uuid-tomorrow', title: 'Test', dueDate: tomorrow, status: 'pending' }
    const { upcoming, overdue } = deriveReminders([a])
    expect(upcoming).toHaveLength(1)
    expect(upcoming[0].id).toBe('uuid-tomorrow')
    expect(overdue).toHaveLength(0)
  })

  it('classifies a pending assignment due yesterday as overdue', () => {
    const yesterday = localDateStr(new Date(Date.now() - 24 * 60 * 60 * 1000))
    const a = { id: 'uuid-yesterday', title: 'Test', dueDate: yesterday, status: 'pending' }
    const { upcoming, overdue } = deriveReminders([a])
    expect(overdue).toHaveLength(1)
    expect(overdue[0].id).toBe('uuid-yesterday')
    expect(upcoming).toHaveLength(0)
  })

  it('excludes completed assignments', () => {
    const tomorrow = localDateStr(new Date(Date.now() + 24 * 60 * 60 * 1000))
    const a = { id: 'uuid-done', title: 'Test', dueDate: tomorrow, status: 'completed' }
    const { upcoming, overdue, total } = deriveReminders([a])
    expect(upcoming).toHaveLength(0)
    expect(overdue).toHaveLength(0)
    expect(total).toBe(0)
  })

  it('excludes assignments due more than 48 hours away', () => {
    const farFuture = localDateStr(new Date(Date.now() + 4 * 24 * 60 * 60 * 1000))
    const a = { id: 'uuid-future', title: 'Test', dueDate: farFuture, status: 'pending' }
    const { upcoming, overdue } = deriveReminders([a])
    expect(upcoming).toHaveLength(0)
    expect(overdue).toHaveLength(0)
  })
})

// ── Integration: deriveReminders → hook pipeline ──────────────────────────────

describe('deriveReminders → useDesktopNotifications integration', () => {
  beforeEach(() => {
    installFakeNotification()
  })

  it('fires for a new "due tomorrow" assignment using real deriveReminders output', () => {
    const tomorrow = localDateStr(new Date(Date.now() + 24 * 60 * 60 * 1000))

    const existingAssignment = { id: 'existing-uuid-1', title: 'Existing', dueDate: tomorrow, status: 'pending' }
    const newAssignment      = { id: 'new-uuid-2',      title: 'New Task', dueDate: tomorrow, status: 'pending' }

    const seedReminders = deriveReminders([existingAssignment])
    const afterReminders = deriveReminders([existingAssignment, newAssignment])

    const { rerender } = renderHook(
      (props) => useDesktopNotifications(props),
      {
        initialProps: {
          reminders: seedReminders,
          enabled: true,
          sessionUserId: 'user1',
          assignmentsLoaded: true,
          onNavigate: vi.fn(),
        },
      }
    )

    // Initial seed: existing assignment added to sentRef, no notification
    expect(FakeNotification.instances).toHaveLength(0)

    // New assignment added
    act(() => {
      rerender({
        reminders: afterReminders,
        enabled: true,
        sessionUserId: 'user1',
        assignmentsLoaded: true,
        onNavigate: vi.fn(),
      })
    })

    expect(FakeNotification.instances).toHaveLength(1)
    expect(FakeNotification.instances[0].title).toBe('Due soon: New Task')
  })
})
