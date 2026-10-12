import { describe, it, expect } from 'vitest'
import {
  localDateInZone,
  addDays,
  reminderKey,
  selectPushReminders,
  buildPushPayloads,
} from '../../../supabase/functions/_shared/reminderSelection.js'

// 2026-10-12 15:00 UTC = 11:00 in Toronto (EDT, UTC-4)
const NOW = new Date('2026-10-12T15:00:00Z')
const TZ  = 'America/Toronto'

function row(id, due_date, status = 'pending', extra = {}) {
  return { id, title: `Task ${id}`, course: 'CS 101', due_date, status, ...extra }
}

function select(assignments, opts = {}) {
  return selectPushReminders(assignments, {
    now: NOW,
    timeZone: TZ,
    sentKeys: new Set(),
    ...opts,
  })
}

describe('date helpers', () => {
  it('localDateInZone uses the given time zone, not UTC', () => {
    // 02:00 UTC on the 13th is still the 12th in Toronto
    const lateEvening = new Date('2026-10-13T02:00:00Z')
    expect(localDateInZone(lateEvening, 'UTC')).toBe('2026-10-13')
    expect(localDateInZone(lateEvening, TZ)).toBe('2026-10-12')
  })

  it('addDays crosses month and year boundaries', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01')
    expect(addDays('2027-01-01', -1)).toBe('2026-12-31')
  })
})

describe('selectPushReminders', () => {
  it('due tomorrow → upcoming', () => {
    const out = select([row('a', '2026-10-13')])
    expect(out).toEqual([
      { type: 'upcoming', key: reminderKey('upcoming', 'a', '2026-10-13'), assignment: expect.objectContaining({ id: 'a' }) },
    ])
  })

  it('due yesterday → overdue', () => {
    const out = select([row('a', '2026-10-11')])
    expect(out.map(i => i.type)).toEqual(['overdue'])
  })

  it('skips older overdue backlog (only the day it became overdue)', () => {
    expect(select([row('a', '2026-10-10')])).toEqual([])
  })

  it('excludes completed assignments', () => {
    expect(select([row('a', '2026-10-13', 'completed')])).toEqual([])
  })

  it('excludes assignments beyond the 48h window', () => {
    // Window end = 2026-10-14 11:00 Toronto → the 14th is in, the 15th is out
    const out = select([row('in', '2026-10-14'), row('out', '2026-10-15')])
    expect(out.map(i => i.assignment.id)).toEqual(['in'])
  })

  it('skips reminders already sent', () => {
    const sentKeys = new Set([reminderKey('upcoming', 'a', '2026-10-13')])
    expect(select([row('a', '2026-10-13')], { sentKeys })).toEqual([])
  })

  it('re-notifies when the due date changes', () => {
    const sentKeys = new Set([reminderKey('upcoming', 'a', '2026-10-20')])
    expect(select([row('a', '2026-10-13')], { sentKeys })).toHaveLength(1)
  })

  it('an assignment sent as upcoming still gets an overdue push', () => {
    const sentKeys = new Set([reminderKey('upcoming', 'a', '2026-10-11')])
    expect(select([row('a', '2026-10-11')], { sentKeys }).map(i => i.type)).toEqual(['overdue'])
  })

  it('evaluates "today" in the user time zone', () => {
    // 03:00 UTC on the 13th = 23:00 on the 12th in Toronto.
    // Due the 12th → still upcoming (today) in Toronto, but overdue in UTC.
    const now = new Date('2026-10-13T03:00:00Z')
    const a = [row('a', '2026-10-12')]
    expect(select(a, { now }).map(i => i.type)).toEqual(['upcoming'])
    expect(select(a, { now, timeZone: 'UTC' }).map(i => i.type)).toEqual(['overdue'])
  })

  it('orders overdue first, then upcoming by due date', () => {
    const out = select([row('u2', '2026-10-14'), row('u1', '2026-10-12'), row('o', '2026-10-11')])
    expect(out.map(i => i.assignment.id)).toEqual(['o', 'u1', 'u2'])
  })
})

describe('buildPushPayloads', () => {
  it('builds one payload per reminder with tags matching the in-tab notifications', () => {
    const items = select([row('a', '2026-10-13'), row('b', '2026-10-11')])
    expect(buildPushPayloads(items)).toEqual([
      { title: 'Overdue: Task b',  body: 'CS 101 · Was due Oct 11', tag: 'jarvis-overdue-b',  view: 'assignments' },
      { title: 'Due soon: Task a', body: 'CS 101 · Due Oct 13',     tag: 'jarvis-upcoming-a', view: 'assignments' },
    ])
  })

  it('omits an empty course from the body', () => {
    const items = select([row('a', '2026-10-13', 'pending', { course: '' })])
    expect(buildPushPayloads(items)[0].body).toBe('Due Oct 13')
  })

  it('collapses more than three reminders into one summary', () => {
    const items = select([
      row('o', '2026-10-11'),
      row('a', '2026-10-12'),
      row('b', '2026-10-13'),
      row('c', '2026-10-14'),
    ])
    const payloads = buildPushPayloads(items)
    expect(payloads).toHaveLength(1)
    expect(payloads[0]).toMatchObject({
      title: 'JARVIS: 4 assignments need attention',
      body:  '3 due soon · 1 overdue',
      tag:   'jarvis-summary',
    })
  })
})
