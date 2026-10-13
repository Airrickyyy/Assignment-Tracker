import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { describe, it, expect, afterEach } from 'vitest'
import { dailyActivity, currentStreak, courseBreakdown, sessionsSince, formatMinutes, NO_COURSE } from '../progressStats'
import ProgressView from '../../components/progress/ProgressView'

afterEach(cleanup)

const TODAY = '2026-10-14'

// Local-time ISO strings so day bucketing matches the test machine's zone.
function at(date, hour = 12) {
  return new Date(`${date}T${String(hour).padStart(2, '0')}:00:00`).toISOString()
}

function session(date, minutes, course = 'CS', hour = 12) {
  return { id: `${date}-${hour}-${course}`, startedAt: at(date, hour), durationSeconds: minutes * 60, course }
}

const SESSIONS = [
  session('2026-10-14', 25),
  session('2026-10-14', 50, 'MATH', 15),
  session('2026-10-13', 25, ''),
  session('2026-10-11', 30),
  session('2026-10-01', 90), // outside 7 days
]

const ASSIGNMENTS = [
  { id: 'a', status: 'completed', completedAt: at('2026-10-14', 9) },
  { id: 'b', status: 'completed', completedAt: at('2026-10-12', 9) },
  { id: 'c', status: 'pending' },
  { id: 'd', status: 'completed' }, // no completedAt (pre-migration) — ignored
]

describe('progress stats', () => {
  it('dailyActivity buckets the last 7 days, oldest first', () => {
    const rows = dailyActivity(SESSIONS, ASSIGNMENTS, TODAY)
    expect(rows.map(r => r.date)).toEqual([
      '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11', '2026-10-12', '2026-10-13', '2026-10-14',
    ])
    expect(rows[6]).toEqual({ date: '2026-10-14', minutes: 75, sessions: 2, completed: 1 })
    expect(rows[4]).toMatchObject({ minutes: 0, completed: 1 })
    expect(rows[3]).toMatchObject({ minutes: 30, sessions: 1 })
  })

  it('streak counts consecutive active days ending today', () => {
    // 14 (focus+done), 13 (focus), 12 (done), 11 (focus), 10 (none)
    expect(currentStreak(SESSIONS, ASSIGNMENTS, TODAY)).toBe(4)
  })

  it('streak is not broken just because today has no activity yet', () => {
    expect(currentStreak(SESSIONS, ASSIGNMENTS, '2026-10-15')).toBe(4)
    expect(currentStreak(SESSIONS, ASSIGNMENTS, '2026-10-16')).toBe(0)
  })

  it('courseBreakdown sums minutes per course, largest first, blank → No course', () => {
    const week = sessionsSince(SESSIONS, TODAY, 7)
    expect(courseBreakdown(week)).toEqual([
      { course: 'CS', minutes: 55 },
      { course: 'MATH', minutes: 50 },
      { course: NO_COURSE, minutes: 25 },
    ])
  })

  it('formatMinutes', () => {
    expect(formatMinutes(45)).toBe('45m')
    expect(formatMinutes(60)).toBe('1h')
    expect(formatMinutes(135)).toBe('2h 15m')
  })
})

describe('ProgressView', () => {
  const NOW = new Date(`${TODAY}T18:00:00`)

  it('shows stat tiles, the chart with a table view, and course bars', () => {
    render(<ProgressView focusSessions={SESSIONS} assignments={ASSIGNMENTS} now={NOW} />)
    const tile = label => [...document.querySelectorAll('.summary-label')].find(el => el.textContent === label)
      .closest('.summary-card').querySelector('.summary-value').textContent
    expect(tile('Focus today')).toBe('1h 15m')
    expect(tile('Streak')).toBe('4')
    expect(tile('Last 7 days')).toBe('2h 10m')
    expect(tile('Completed')).toBe('2')
    expect(screen.getByRole('img', { name: /Focus minutes per day/ })).toBeTruthy()
    expect(screen.getByText('View as table')).toBeTruthy()
    expect(screen.getByText('MATH')).toBeTruthy()
    expect(screen.getByText(NO_COURSE)).toBeTruthy()
  })

  it('hovering a day shows its tooltip', () => {
    const { container } = render(<ProgressView focusSessions={SESSIONS} assignments={ASSIGNMENTS} now={NOW} />)
    fireEvent.mouseEnter(container.querySelectorAll('.pg-hit')[6])
    expect(screen.getByRole('status').textContent).toMatch(/1h 15m focus · 2 sessions/)
  })

  it('shows an empty state with no activity', () => {
    render(<ProgressView focusSessions={[]} assignments={[]} now={NOW} />)
    expect(screen.getByText('No study activity yet')).toBeTruthy()
  })
})
