/**
 * Focused tests for the seeding/trigger logic in useDesktopNotifications.
 *
 * Key invariants verified:
 * 1. No notification fires for assignments present at initial load (seed-without-fire).
 * 2. A new assignment created AFTER load DOES fire a notification.
 * 3. The same assignment never fires twice in a session (deduplication).
 * 4. Nothing fires while assignmentsLoaded=false (hydration guard).
 * 5. Refs reset on user change (account isolation).
 */

import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useDesktopNotifications } from '../useDesktopNotifications'

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
})
