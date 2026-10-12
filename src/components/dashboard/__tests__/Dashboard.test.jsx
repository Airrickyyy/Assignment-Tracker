/**
 * Regression test for the Dashboard overdue bug (2026-10-12): assignments
 * saved as 'pending' never turned overdue as their dates passed, due-today
 * items were missing from "Due This Week", and past items were tagged "Today".
 * App passes assignments through withEffectiveStatus; this test does the same.
 */

import { render, screen, within, cleanup } from '@testing-library/react'
import { describe, it, expect, afterEach } from 'vitest'
import Dashboard from '../Dashboard'
import { withEffectiveStatus } from '../../../lib/assignmentStatus'

afterEach(cleanup)

const NOW = new Date(2026, 9, 12, 17, 30) // Mon 2026-10-12, evening

// All stored as 'pending' — exactly what the database held for the bug.
const STORED = [
  { id: 'past',     title: 'Lab report 6', course: 'EOM', dueDate: '2026-10-11', priority: 'high',   status: 'pending' },
  { id: 'today',    title: 'Reading',      course: 'HIS', dueDate: '2026-10-12', priority: 'medium', status: 'pending' },
  { id: 'tomorrow', title: 'Push 4',       course: 'CMP', dueDate: '2026-10-13', priority: 'low',    status: 'pending' },
  { id: 'later',    title: 'Essay',        course: 'ENG', dueDate: '2026-10-30', priority: 'low',    status: 'pending' },
]

function renderDashboard() {
  return render(
    <Dashboard
      assignments={withEffectiveStatus(STORED, NOW)}
      schedule={[]}
      toggleAssignment={() => {}}
      toggleTask={() => {}}
      settings={{ overdueReminder: 'banner' }}
      now={NOW}
    />,
  )
}

function cardValue(label) {
  const labelEl = [...document.querySelectorAll('.summary-label')].find(el => el.textContent === label)
  return labelEl.closest('.summary-card').querySelector('.summary-value').textContent
}

describe('Dashboard date handling', () => {
  it('counts a past-due "pending" assignment as overdue, with the banner', () => {
    renderDashboard()
    expect(cardValue('Overdue')).toBe('1')
    expect(cardValue('Pending')).toBe('3')
    expect(screen.getByText('1 overdue assignment needs attention')).toBeTruthy()
  })

  it('"Due This Week" includes assignments due today', () => {
    renderDashboard()
    // today + tomorrow; the Oct 30 essay is outside the 7-day window
    expect(cardValue('Due This Week')).toBe('2')
  })

  it('Upcoming Deadlines tags past items Overdue and today’s items Today', () => {
    renderDashboard()
    const list = screen.getByText('Upcoming Deadlines').closest('section')
    const tagFor = title => within(list).getByText(title).closest('li').querySelector('.deadline-tag').textContent
    expect(tagFor('Lab report 6')).toBe('Overdue')
    expect(tagFor('Reading')).toBe('Today')
    expect(tagFor('Push 4')).toBe('1 day')
  })
})
