import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  startFocus, pause, resume, startBreak, elapsedMs, remainingMs, isFinished,
  sessionRecord, formatClock, loadTimer, FOCUS_TIMER_STORAGE_KEY,
} from '../focusTimer'
import { useFocusTimer } from '../useFocusTimer'

const T0 = Date.UTC(2026, 9, 13, 14, 0, 0)
const MIN = 60_000
const assignment = { id: 'a1', title: 'Lab 4', course: 'CS' }

describe('focus timer state', () => {
  it('counts down while running and stops counting while paused', () => {
    let t = startFocus({ minutes: 25, assignment }, T0)
    expect(remainingMs(t, T0 + 10 * MIN)).toBe(15 * MIN)
    t = pause(t, T0 + 10 * MIN)
    expect(remainingMs(t, T0 + 20 * MIN)).toBe(15 * MIN) // paused: no change
    t = resume(t, T0 + 20 * MIN)
    expect(remainingMs(t, T0 + 25 * MIN)).toBe(10 * MIN)
    expect(isFinished(t, T0 + 35 * MIN)).toBe(true)
    expect(elapsedMs(t, T0 + 99 * MIN)).toBe(25 * MIN) // capped at planned
  })

  it('records the assignment it was started for', () => {
    const t = startFocus({ minutes: 25, assignment }, T0)
    expect(t).toMatchObject({ phase: 'focus', assignmentId: 'a1', course: 'CS', label: 'Lab 4' })
  })

  it('sessionRecord: full session ends at the real finish time even if noticed late', () => {
    const t = startFocus({ minutes: 25 }, T0)
    const rec = sessionRecord(t, T0 + 3 * 60 * MIN)
    expect(rec.durationSeconds).toBe(25 * 60)
    expect(rec.endedAt).toBe(new Date(T0 + 25 * MIN).toISOString())
    expect(rec.id).toBe(t.id)
  })

  it('sessionRecord: stopped early is logged if ≥ 1 minute, ignored otherwise', () => {
    const t = startFocus({ minutes: 25 }, T0)
    expect(sessionRecord(t, T0 + 30_000)).toBeNull()
    expect(sessionRecord(t, T0 + 7 * MIN).durationSeconds).toBe(7 * 60)
  })

  it('breaks are never logged', () => {
    expect(sessionRecord(startBreak(T0), T0 + 5 * MIN)).toBeNull()
  })

  it('formatClock rounds up to whole seconds', () => {
    expect(formatClock(25 * MIN)).toBe('25:00')
    expect(formatClock(61_500)).toBe('01:02')
    expect(formatClock(-5)).toBe('00:00')
  })
})

describe('useFocusTimer', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers()
    vi.setSystemTime(T0)
  })
  afterEach(() => vi.useRealTimers())

  it('persists the timer so a reload continues it', () => {
    const { result } = renderHook(() => useFocusTimer())
    act(() => result.current.start({ minutes: 25, assignment }))
    expect(loadTimer()).toMatchObject({ phase: 'focus', status: 'running' })
    const reloaded = renderHook(() => useFocusTimer())
    expect(reloaded.result.current.timer.id).toBe(result.current.timer.id)
  })

  it('on completion the owner logs once, notifies, and starts a break', () => {
    const logSession = vi.fn()
    const onPhaseEnd = vi.fn()
    const { result } = renderHook(() => useFocusTimer({ handleCompletion: true, logSession, onPhaseEnd }))
    act(() => result.current.start({ minutes: 25, assignment }))
    act(() => vi.advanceTimersByTime(25 * MIN + 1000))
    expect(logSession).toHaveBeenCalledTimes(1)
    expect(logSession.mock.calls[0][0]).toMatchObject({ durationSeconds: 1500, assignmentId: 'a1' })
    expect(onPhaseEnd).toHaveBeenCalledWith({ phase: 'focus' })
    expect(result.current.timer.phase).toBe('break')

    act(() => vi.advanceTimersByTime(5 * MIN + 1000))
    expect(result.current.timer).toBeNull()
    expect(onPhaseEnd).toHaveBeenLastCalledWith({ phase: 'break' })
    expect(logSession).toHaveBeenCalledTimes(1) // breaks aren't logged
  })

  it('non-owner windows never log completion themselves', () => {
    const logSession = vi.fn()
    const { result } = renderHook(() => useFocusTimer({ logSession }))
    act(() => result.current.start({ minutes: 25 }))
    act(() => vi.advanceTimersByTime(26 * MIN))
    expect(logSession).not.toHaveBeenCalled()
  })

  it('a session that ran out while the app was closed is logged quietly, with no break', () => {
    localStorage.setItem(FOCUS_TIMER_STORAGE_KEY, JSON.stringify(startFocus({ minutes: 25 }, T0)))
    vi.setSystemTime(T0 + 3 * 60 * MIN)
    const logSession = vi.fn()
    const onPhaseEnd = vi.fn()
    const { result } = renderHook(() => useFocusTimer({ handleCompletion: true, logSession, onPhaseEnd }))
    expect(logSession).toHaveBeenCalledTimes(1)
    expect(onPhaseEnd).not.toHaveBeenCalled()
    expect(result.current.timer).toBeNull()
  })

  it('stop logs a focus session of at least a minute', () => {
    const logSession = vi.fn()
    const { result } = renderHook(() => useFocusTimer({ logSession }))
    act(() => result.current.start({ minutes: 25 }))
    act(() => vi.advanceTimersByTime(10 * MIN))
    act(() => result.current.stop())
    expect(logSession).toHaveBeenCalledWith(expect.objectContaining({ durationSeconds: 600 }))
    expect(result.current.timer).toBeNull()
  })

  it('follows changes made in another window', () => {
    const { result } = renderHook(() => useFocusTimer())
    const other = startFocus({ minutes: 50 }, T0)
    act(() => {
      localStorage.setItem(FOCUS_TIMER_STORAGE_KEY, JSON.stringify(other))
      window.dispatchEvent(new StorageEvent('storage', { key: FOCUS_TIMER_STORAGE_KEY }))
    })
    expect(result.current.timer.id).toBe(other.id)
    expect(result.current.remaining).toBe(50 * MIN)
  })
})
