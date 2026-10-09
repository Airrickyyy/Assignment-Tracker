import { supabase } from './supabaseClient'

// ── Shape mappers ────────────────────────────────────────────────────────────

/** DB row → frontend assignment object */
function toFrontend(row) {
  return {
    id:             row.id,
    title:          row.title,
    course:         row.course,
    dueDate:        row.due_date,   // DATE column → 'YYYY-MM-DD' string
    priority:       row.priority,
    status:         row.status,
    points:         row.points          != null ? Number(row.points)          : undefined,
    estimatedHours: row.estimated_hours != null ? Number(row.estimated_hours) : undefined,
    description:    row.description     != null ? row.description              : undefined,
  }
}

/** Frontend object → DB insert payload (includes user_id) */
function toDbInsert(userId, data) {
  return {
    user_id:         userId,
    title:           data.title,
    course:          data.course          ?? '',
    due_date:        data.dueDate,
    priority:        data.priority,
    status:          data.status,
    // points is INTEGER in DB — round defensively in case the UI sends a decimal.
    points:          data.points          != null ? Math.round(data.points)   : null,
    estimated_hours: data.estimatedHours  != null ? data.estimatedHours       : null,
    description:     data.description     != null ? data.description          : null,
  }
}

/** Frontend object → DB update payload (no user_id — ownership never changes) */
function toDbUpdate(data) {
  return {
    title:           data.title,
    course:          data.course          ?? '',
    due_date:        data.dueDate,
    priority:        data.priority,
    status:          data.status,
    points:          data.points          != null ? Math.round(data.points)   : null,
    estimated_hours: data.estimatedHours  != null ? data.estimatedHours       : null,
    description:     data.description     != null ? data.description          : null,
    updated_at:      new Date().toISOString(),
  }
}

// ── Repository functions ─────────────────────────────────────────────────────

/**
 * Fetch all assignments for the authenticated user.
 * RLS ensures only the caller's rows are returned — no userId argument needed.
 */
export async function fetchAssignments() {
  const { data, error } = await supabase
    .from('assignments')
    .select('*')
    .order('due_date', { ascending: true })
  if (error) throw error
  return data.map(toFrontend)
}

/**
 * Insert one assignment. userId must come from session.user.id — never from
 * client-supplied data. RLS WITH CHECK verifies auth.uid() = user_id server-side.
 */
export async function insertAssignment(userId, frontendData) {
  const { data, error } = await supabase
    .from('assignments')
    .insert(toDbInsert(userId, frontendData))
    .select()
    .single()
  if (error) throw error
  return toFrontend(data)
}

/**
 * Update one assignment by id. Only updates data fields — user_id is never
 * changed. RLS USING ensures the caller can only update their own rows.
 */
export async function updateAssignment(id, frontendData) {
  const { data, error } = await supabase
    .from('assignments')
    .update(toDbUpdate(frontendData))
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return toFrontend(data)
}

/** Delete one assignment. RLS USING restricts deletion to the owner. */
export async function deleteAssignment(id) {
  const { error } = await supabase
    .from('assignments')
    .delete()
    .eq('id', id)
  if (error) throw error
}

/**
 * Bulk-insert multiple assignments for migration.
 * Returns the inserted rows so the caller can verify the count.
 */
export async function bulkInsertAssignments(userId, assignments) {
  const rows = assignments.map(a => toDbInsert(userId, a))
  const { data, error } = await supabase
    .from('assignments')
    .insert(rows)
    .select()
  if (error) throw error
  return data.map(toFrontend)
}
