import { describe, it, expect } from 'vitest'
import { buildQuickPanelData, dueLabel, weekBounds, shiftDays } from '../quickPanel'

// Wednesday 2026-10-14, midday local time
const NOW = new Date(2026, 9, 14, 12, 0, 0)

function a(id, dueDate, extra = {}) {
  return { id, title: `Task ${id}`, course: 'CS', dueDate, priority: 'medium', status: 'pending', ...extra }
}

describe('date helpers', () => {
  it('weekBounds returns Monday–Sunday', () => {
    expect(weekBounds('2026-10-14')).toEqual({ start: '2026-10-12', end: '2026-10-18' })
    expect(weekBounds('2026-10-18')).toEqual({ start: '2026-10-12', end: '2026-10-18' }) // Sunday
    expect(weekBounds('2026-10-12')).toEqual({ start: '2026-10-12', end: '2026-10-18' }) // Monday
  })

  it('shiftDays crosses month boundaries', () => {
    expect(shiftDays('2026-10-31', 1)).toBe('2026-11-01')
  })

  it('dueLabel', () => {
    const today = '2026-10-14'
    expect(dueLabel('2026-10-14', today)).toBe('Today')
    expect(dueLabel('2026-10-15', today)).toBe('Tomorrow')
    expect(dueLabel('2026-10-17', today)).toBe('Sat')
    expect(dueLabel('2026-10-30', today)).toBe('Oct 30')
    expect(dueLabel('2026-10-12', today)).toBe('2d overdue')
  })
})

describe('buildQuickPanelData', () => {
  const assignments = [
    a('overdue',  '2026-10-12'),
    a('today-lo', '2026-10-14', { priority: 'low' }),
    a('today-hi', '2026-10-14', { priority: 'high' }),
    a('tomorrow', '2026-10-15', { estimatedHours: 2.5 }),
    a('in6',      '2026-10-20', { estimatedHours: 1 }),
    a('in7',      '2026-10-21', { estimatedHours: 9 }),
    a('done',     '2026-10-16', { status: 'completed', estimatedHours: 3 }),
    a('done-old', '2026-10-01', { status: 'completed' }),
  ]
  const data = buildQuickPanelData(assignments, NOW)
  const ids = list => list.map(x => x.id)

  it('splits open assignments into overdue / today / tomorrow', () => {
    expect(data.today).toBe('2026-10-14')
    expect(ids(data.overdue)).toEqual(['overdue'])
    expect(ids(data.dueToday)).toEqual(['today-hi', 'today-lo']) // priority order within a day
    expect(ids(data.dueTomorrow)).toEqual(['tomorrow'])
  })

  it('upcoming excludes overdue and completed; next7 stops at 6 days ahead', () => {
    expect(ids(data.upcoming)).toEqual(['today-hi', 'today-lo', 'tomorrow', 'in6', 'in7'])
    expect(ids(data.next7)).toEqual(['today-hi', 'today-lo', 'tomorrow', 'in6'])
  })

  it('week stats count Mon–Sun, including completed', () => {
    // Week Oct 12–18: overdue, today-lo, today-hi, tomorrow, done → 1 of 5 done
    expect(data.stats.week).toEqual({ done: 1, total: 5 })
  })

  it('hours: left (open, next 7 days) vs total (incl. completed)', () => {
    expect(data.stats.hours).toEqual({ left: 3.5, total: 6.5 })
  })

  it('on-track counts open assignments that are not overdue', () => {
    expect(data.stats.onTrack).toEqual({ count: 5, total: 6, overdue: 1 })
  })

  it('handles no assignments', () => {
    const empty = buildQuickPanelData([], NOW)
    expect(empty.upcoming).toEqual([])
    expect(empty.stats).toEqual({
      week: { done: 0, total: 0 },
      hours: { left: 0, total: 0 },
      onTrack: { count: 0, total: 0, overdue: 0 },
    })
  })
})
