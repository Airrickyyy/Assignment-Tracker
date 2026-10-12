import { describe, it, expect } from 'vitest'
import { effectiveStatus, withEffectiveStatus, daysUntil } from '../assignmentStatus'

const NOW = new Date(2026, 9, 12, 17, 30) // Mon 2026-10-12, evening

describe('effectiveStatus', () => {
  it('a stored "pending" assignment whose date has passed is overdue', () => {
    expect(effectiveStatus({ status: 'pending', dueDate: '2026-10-11' }, '2026-10-12')).toBe('overdue')
  })

  it('due today is still pending, all day', () => {
    expect(effectiveStatus({ status: 'pending', dueDate: '2026-10-12' }, '2026-10-12')).toBe('pending')
  })

  it('a stored "overdue" assignment moved to a future date is pending again', () => {
    expect(effectiveStatus({ status: 'overdue', dueDate: '2026-10-20' }, '2026-10-12')).toBe('pending')
  })

  it('completed always stays completed', () => {
    expect(effectiveStatus({ status: 'completed', dueDate: '2026-01-01' }, '2026-10-12')).toBe('completed')
  })
})

describe('withEffectiveStatus', () => {
  it('rewrites only the items whose status changed', () => {
    const stale = { id: 1, status: 'pending', dueDate: '2026-10-11' }
    const fine  = { id: 2, status: 'pending', dueDate: '2026-10-13' }
    const [a, b] = withEffectiveStatus([stale, fine], NOW)
    expect(a).toEqual({ ...stale, status: 'overdue' })
    expect(a).not.toBe(stale)
    expect(b).toBe(fine)
  })
})

describe('daysUntil', () => {
  it('counts whole calendar days regardless of time of day', () => {
    expect(daysUntil('2026-10-12', '2026-10-12')).toBe(0)
    expect(daysUntil('2026-10-13', '2026-10-12')).toBe(1)
    expect(daysUntil('2026-10-11', '2026-10-12')).toBe(-1)
    expect(daysUntil('2026-11-01', '2026-10-31')).toBe(1)
  })
})
