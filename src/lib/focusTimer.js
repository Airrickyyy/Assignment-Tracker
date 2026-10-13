// Focus timer (Phase 5C) — pure state transitions over timestamps, so the
// timer survives reloads, hidden panels and both desktop windows (they share
// localStorage and see each other's changes through the 'storage' event).
//
// State shape (null = idle):
//   {
//     id,             // uuid; becomes the focus_sessions row id → no double logging
//     phase,          // 'focus' | 'break'
//     status,         // 'running' | 'paused'
//     plannedMs,      // length of this phase
//     elapsedBefore,  // ms accumulated before the current running segment
//     segmentStart,   // epoch ms the current segment began (null while paused)
//     startedAt,      // ISO time the focus phase first started
//     assignmentId, course, label,
//   }

export const FOCUS_PRESETS_MIN = [25, 50]
export const BREAK_MIN = 5
export const MIN_LOGGED_SECONDS = 60

const STORAGE_KEY = 'jarvis_focus_timer'

function newId() {
  return globalThis.crypto?.randomUUID?.() ??
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
    })
}

export function elapsedMs(timer, now) {
  if (!timer) return 0
  const running = timer.status === 'running' ? Math.max(0, now - timer.segmentStart) : 0
  return Math.min(timer.plannedMs, timer.elapsedBefore + running)
}

export function remainingMs(timer, now) {
  return timer ? timer.plannedMs - elapsedMs(timer, now) : 0
}

export function isFinished(timer, now) {
  return Boolean(timer) && remainingMs(timer, now) <= 0
}

/** Epoch ms this phase ends (or ended) if it keeps running; null while paused. */
export function finishAt(timer) {
  if (timer?.status !== 'running') return null
  return timer.segmentStart + timer.plannedMs - timer.elapsedBefore
}

export function startFocus({ minutes, assignment = null }, now) {
  return {
    id: newId(),
    phase: 'focus',
    status: 'running',
    plannedMs: minutes * 60_000,
    elapsedBefore: 0,
    segmentStart: now,
    startedAt: new Date(now).toISOString(),
    assignmentId: assignment?.id ?? null,
    course: assignment?.course ?? '',
    label: assignment?.title ?? '',
  }
}

export function pause(timer, now) {
  if (timer?.status !== 'running') return timer
  return { ...timer, status: 'paused', elapsedBefore: elapsedMs(timer, now), segmentStart: null }
}

export function resume(timer, now) {
  if (timer?.status !== 'paused') return timer
  return { ...timer, status: 'running', segmentStart: now }
}

export function startBreak(now) {
  return {
    id: newId(),
    phase: 'break',
    status: 'running',
    plannedMs: BREAK_MIN * 60_000,
    elapsedBefore: 0,
    segmentStart: now,
    startedAt: new Date(now).toISOString(),
    assignmentId: null,
    course: '',
    label: '',
  }
}

/**
 * The focus_sessions row for a focus phase that ended (completed or stopped),
 * or null when there's nothing worth logging (a break, or under a minute).
 */
export function sessionRecord(timer, now) {
  if (!timer || timer.phase !== 'focus') return null
  const seconds = Math.round(elapsedMs(timer, now) / 1000)
  if (seconds < MIN_LOGGED_SECONDS) return null
  return {
    id: timer.id,
    assignmentId: timer.assignmentId,
    course: timer.course,
    label: timer.label,
    startedAt: timer.startedAt,
    // If the app was closed when the timer ran out, end at the real finish.
    endedAt: new Date(Math.min(now, finishAt(timer) ?? now)).toISOString(),
    durationSeconds: seconds,
  }
}

export function formatClock(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

// ── Persistence ──────────────────────────────────────────────────────────────

export function loadTimer() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY))
    return parsed && typeof parsed === 'object' && parsed.id ? parsed : null
  } catch {
    return null
  }
}

export function saveTimer(timer) {
  try {
    if (timer) localStorage.setItem(STORAGE_KEY, JSON.stringify(timer))
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    // storage unavailable — timer still works for this page
  }
}

export const FOCUS_TIMER_STORAGE_KEY = STORAGE_KEY
