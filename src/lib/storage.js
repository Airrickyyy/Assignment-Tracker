import { sampleAssignments } from '../data/sampleData'

const KEYS = {
  assignments: 'jarvis_assignments',
  settings: 'jarvis_settings',
}

export const DEFAULT_SETTINGS = {
  defaultPriority: 'medium',
  showCompletedOnDashboard: true,
  overdueReminder: 'banner',
  desktopNotificationsEnabled: false,
}

function tryParse(raw) {
  try { return JSON.parse(raw) } catch { return null }
}

function isValidAssignment(a) {
  return (
    a !== null &&
    typeof a === 'object' &&
    (typeof a.id === 'number' || typeof a.id === 'string') &&
    typeof a.title === 'string' && a.title.length > 0 &&
    typeof a.dueDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(a.dueDate) &&
    ['pending', 'overdue', 'completed'].includes(a.status) &&
    ['low', 'medium', 'high'].includes(a.priority)
  )
}

export function loadAssignments() {
  const raw = localStorage.getItem(KEYS.assignments)
  if (!raw) return [...sampleAssignments]
  const parsed = tryParse(raw)
  if (!Array.isArray(parsed)) return [...sampleAssignments]
  const valid = parsed.filter(isValidAssignment)
  return valid.length > 0 ? valid : [...sampleAssignments]
}

export function saveAssignments(assignments) {
  try {
    localStorage.setItem(KEYS.assignments, JSON.stringify(assignments))
  } catch (err) {
    console.warn('JARVIS: could not save assignments', err)
  }
}

export function loadSettings() {
  const raw = localStorage.getItem(KEYS.settings)
  const parsed = tryParse(raw)
  if (!parsed || typeof parsed !== 'object') return { ...DEFAULT_SETTINGS }
  return { ...DEFAULT_SETTINGS, ...parsed }
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(KEYS.settings, JSON.stringify(settings))
  } catch (err) {
    console.warn('JARVIS: could not save settings', err)
  }
}

export function clearStorage() {
  localStorage.removeItem(KEYS.assignments)
  localStorage.removeItem(KEYS.settings)
}
