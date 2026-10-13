import { supabase } from './supabaseClient'

// focus_sessions (migration 005). Writes go through a small local queue so a
// session that ends while offline is saved on the next successful flush.

const PENDING_KEY = 'jarvis_focus_pending'
const UNIQUE_VIOLATION = '23505'

function toFrontend(row) {
  return {
    id:              row.id,
    assignmentId:    row.assignment_id,
    course:          row.course,
    label:           row.label,
    startedAt:       row.started_at,
    endedAt:         row.ended_at,
    durationSeconds: row.duration_seconds,
  }
}

function toDb(userId, s) {
  return {
    id:               s.id,
    user_id:          userId,
    assignment_id:    s.assignmentId,
    course:           s.course ?? '',
    label:            s.label ?? '',
    started_at:       s.startedAt,
    ended_at:         s.endedAt,
    duration_seconds: s.durationSeconds,
  }
}

function readPending() {
  try {
    const list = JSON.parse(localStorage.getItem(PENDING_KEY))
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

function writePending(list) {
  try {
    if (list.length) localStorage.setItem(PENDING_KEY, JSON.stringify(list))
    else localStorage.removeItem(PENDING_KEY)
  } catch {
    // storage unavailable
  }
}

/** Sessions that started on or after `sinceIso`, newest first. RLS scopes to the user. */
export async function fetchFocusSessions(sinceIso) {
  const { data, error } = await supabase
    .from('focus_sessions')
    .select('*')
    .gte('started_at', sinceIso)
    .order('started_at', { ascending: false })
  if (error) throw error
  return data.map(toFrontend)
}

/**
 * Try to save every queued session belonging to `userId`. Returns the
 * sessions saved by this call. A duplicate id means another window already
 * saved it — treated as done.
 */
export async function flushFocusSessions(userId) {
  const pending = readPending()
  const saved = []
  const keep = []
  for (const item of pending) {
    if (item.userId !== userId) { keep.push(item); continue }
    const { error } = await supabase.from('focus_sessions').insert(toDb(userId, item.session))
    if (!error) saved.push(item.session)
    else if (error.code !== UNIQUE_VIOLATION) keep.push(item)
  }
  // Re-read so entries queued by another window during the flush survive.
  const savedIds = new Set(pending.filter(p => !keep.includes(p)).map(p => p.session.id))
  writePending(readPending().filter(p => !savedIds.has(p.session.id)))
  return saved
}

/** Queue a finished session for `userId` and try to save it right away. */
export async function logFocusSession(userId, session) {
  const pending = readPending()
  if (!pending.some(p => p.session.id === session.id)) {
    writePending([...pending, { userId, session }])
  }
  return flushFocusSessions(userId)
}
