import { useCallback, useEffect, useRef, useState } from 'react'
import {
  FOCUS_TIMER_STORAGE_KEY,
  finishAt,
  isFinished,
  loadTimer,
  pause as pauseTimer,
  remainingMs,
  resume as resumeTimer,
  saveTimer,
  sessionRecord,
  startBreak,
  startFocus,
} from './focusTimer'

// A phase that ran out more than this long ago (app was closed) finishes
// quietly — no "time's up" notification for something that ended hours ago.
const LATE_MS = 2 * 60_000

/**
 * Shared focus-timer state. Every window/tab using this hook sees the same
 * timer (localStorage + 'storage' events). Exactly one instance per app
 * should pass `handleCompletion` (App's), so a finished phase is logged and
 * announced once.
 *
 * `logSession(record)` saves a finished focus session (focusRepo).
 * `onPhaseEnd({ phase, late })` lets the owner notify the user.
 */
export function useFocusTimer({ handleCompletion = false, logSession, onPhaseEnd } = {}) {
  const [timer, setTimerState] = useState(loadTimer)
  const [now, setNow] = useState(() => Date.now())
  const callbacks = useRef({ logSession, onPhaseEnd })
  callbacks.current = { logSession, onPhaseEnd }

  const setTimer = useCallback(next => {
    saveTimer(next)
    setTimerState(next)
    setNow(Date.now())
  }, [])

  // Another window or tab changed the timer.
  useEffect(() => {
    function onStorage(e) {
      if (e.key === FOCUS_TIMER_STORAGE_KEY) {
        setTimerState(loadTimer())
        setNow(Date.now())
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  // Tick once a second while running.
  const running = timer?.status === 'running'
  useEffect(() => {
    if (!running) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [running, timer?.id])

  // Phase finished: log focus sessions, roll focus → break → idle.
  useEffect(() => {
    if (!handleCompletion || !isFinished(timer, now)) return
    const t = Date.now()
    const late = t - (finishAt(timer) ?? t) > LATE_MS
    if (timer.phase === 'focus') {
      const record = sessionRecord(timer, t)
      if (record) callbacks.current.logSession?.(record)
      setTimer(late ? null : startBreak(t))
    } else {
      setTimer(null)
    }
    if (!late) callbacks.current.onPhaseEnd?.({ phase: timer.phase })
  }, [handleCompletion, timer, now, setTimer])

  const start = useCallback(opts => setTimer(startFocus(opts, Date.now())), [setTimer])
  const pause = useCallback(() => setTimer(pauseTimer(loadTimer() ?? timer, Date.now())), [setTimer, timer])
  const resume = useCallback(() => setTimer(resumeTimer(loadTimer() ?? timer, Date.now())), [setTimer, timer])

  /** End the current phase now; a focus phase of ≥1 minute is still logged. */
  const stop = useCallback(() => {
    const current = loadTimer() ?? timer
    const record = sessionRecord(current, Date.now())
    if (record) callbacks.current.logSession?.(record)
    setTimer(null)
  }, [setTimer, timer])

  return { timer, remaining: remainingMs(timer, now), start, pause, resume, stop }
}
