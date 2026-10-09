import { useState, useEffect } from 'react'
import { supabase } from './lib/supabaseClient'
import Shell from './components/layout/Shell'
import AuthScreen from './components/auth/AuthScreen'
import Dashboard from './components/dashboard/Dashboard'
import AssignmentsView from './components/assignments/AssignmentsView'
import CalendarView from './components/calendar/CalendarView'
import SettingsView from './components/settings/SettingsView'
import MigrationBanner from './components/migration/MigrationBanner'
import './components/migration/MigrationBanner.css'
import {
  fetchAssignments,
  insertAssignment,
  updateAssignment as repoUpdateAssignment,
  deleteAssignment as repoDeleteAssignment,
  bulkInsertAssignments,
} from './lib/assignmentsRepo'
import { loadAssignments, loadSettings, saveSettings } from './lib/storage'
import { sampleSchedule } from './data/sampleData'

function deriveStatus(dueDate, currentStatus) {
  if (currentStatus === 'completed') return 'completed'
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(dueDate + 'T00:00:00')
  return due < today ? 'overdue' : 'pending'
}

function App() {
  // ── Auth state ───────────────────────────────────────────────────────────
  // undefined = still resolving, null = signed out, object = signed in
  const [session,    setSession]    = useState(undefined)
  const [isRecovery, setIsRecovery] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session ?? null)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsRecovery(true)
      } else if (event === 'USER_UPDATED' || event === 'SIGNED_OUT') {
        setIsRecovery(false)
      }
      setSession(session ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  function signOut() {
    supabase.auth.signOut()
  }

  // ── Planner state ────────────────────────────────────────────────────────
  const [activeView,        setActiveView]        = useState('dashboard')
  const [assignments,       setAssignments]       = useState([])
  const [assignmentsLoading, setAssignmentsLoading] = useState(false)
  const [assignmentsError,   setAssignmentsError]   = useState(null)
  const [crudError,          setCrudError]           = useState(null)
  const [schedule,          setSchedule]          = useState(sampleSchedule)
  const [settings,          setSettings]          = useState(() => loadSettings())

  // ── Migration state ──────────────────────────────────────────────────────
  const [localAssignments,    setLocalAssignments]    = useState([])
  const [migrationPending,    setMigrationPending]    = useState(false)
  const [migrationInProgress, setMigrationInProgress] = useState(false)
  const [migrationError,      setMigrationError]      = useState(null)

  useEffect(() => { saveSettings(settings) }, [settings])

  // ── Cloud assignment fetch on sign-in ────────────────────────────────────
  const sessionUserId = session?.user?.id ?? null

  useEffect(() => {
    if (!sessionUserId) {
      setAssignments([])
      setAssignmentsLoading(false)
      setAssignmentsError(null)
      setMigrationPending(false)
      return
    }

    let cancelled = false
    setAssignmentsLoading(true)
    setAssignmentsError(null)
    setCrudError(null)

    fetchAssignments()
      .then(rows => {
        if (cancelled) return
        setAssignments(rows)
        setAssignmentsLoading(false)

        // Migration detection: only prompt once per user account.
        // Check the raw key first so we don't migrate the sample-data fallback.
        const marker = localStorage.getItem(`jarvis_migrated_${sessionUserId}`)
        if (!marker) {
          const rawLocal = localStorage.getItem('jarvis_assignments')
          if (rawLocal) {
            const local = loadAssignments()
            if (local.length > 0) {
              setLocalAssignments(local)
              setMigrationPending(true)
            } else {
              localStorage.setItem(`jarvis_migrated_${sessionUserId}`, '1')
            }
          } else {
            localStorage.setItem(`jarvis_migrated_${sessionUserId}`, '1')
          }
        }
      })
      .catch(err => {
        if (cancelled) return
        setAssignmentsError(err.message)
        setAssignmentsLoading(false)
      })

    return () => { cancelled = true }
  }, [sessionUserId])

  // ── Migration handlers ───────────────────────────────────────────────────
  async function handleMigrateLocal() {
    setMigrationInProgress(true)
    setMigrationError(null)
    try {
      await bulkInsertAssignments(sessionUserId, localAssignments)
      localStorage.setItem(`jarvis_migrated_${sessionUserId}`, '1')
      const fresh = await fetchAssignments()
      setAssignments(fresh)
      setMigrationPending(false)
      setLocalAssignments([])
    } catch (err) {
      setMigrationError(err.message)
    } finally {
      setMigrationInProgress(false)
    }
  }

  function handleDismissMigration() {
    localStorage.setItem(`jarvis_migrated_${sessionUserId}`, '1')
    setMigrationPending(false)
    setLocalAssignments([])
    setMigrationError(null)
  }

  function updateSettings(patch) {
    setSettings(prev => ({ ...prev, ...patch }))
  }

  // ── CRUD handlers (server-confirmed, no optimistic updates) ─────────────
  async function toggleAssignment(id) {
    setCrudError(null)
    const existing = assignments.find(a => a.id === id)
    if (!existing) return
    const newStatus = existing.status === 'completed'
      ? deriveStatus(existing.dueDate, 'pending')
      : 'completed'
    try {
      const updated = await repoUpdateAssignment(id, { ...existing, status: newStatus })
      setAssignments(prev => prev.map(a => a.id === id ? updated : a))
    } catch (err) {
      setCrudError(err.message)
    }
  }

  async function addAssignment(data) {
    setCrudError(null)
    const status = deriveStatus(data.dueDate, 'pending')
    try {
      const created = await insertAssignment(sessionUserId, { ...data, status })
      setAssignments(prev => [created, ...prev])
    } catch (err) {
      setCrudError(err.message)
    }
  }

  async function updateAssignment(id, data) {
    setCrudError(null)
    const existing = assignments.find(a => a.id === id)
    const status = deriveStatus(data.dueDate, existing?.status ?? 'pending')
    try {
      const updated = await repoUpdateAssignment(id, { ...data, status })
      setAssignments(prev => prev.map(a => a.id === id ? updated : a))
    } catch (err) {
      setCrudError(err.message)
    }
  }

  async function deleteAssignment(id) {
    setCrudError(null)
    try {
      await repoDeleteAssignment(id)
      setAssignments(prev => prev.filter(a => a.id !== id))
    } catch (err) {
      setCrudError(err.message)
    }
  }

  function toggleTask(id) {
    setSchedule(prev =>
      prev.map(t => (t.id === id ? { ...t, completed: !t.completed } : t))
    )
  }

  // ── Routing ──────────────────────────────────────────────────────────────
  if (session === undefined) return null
  if (!session || isRecovery) return <AuthScreen isRecovery={isRecovery} />

  const banner = migrationPending ? (
    <MigrationBanner
      count={localAssignments.length}
      inProgress={migrationInProgress}
      error={migrationError}
      onImport={handleMigrateLocal}
      onDismiss={handleDismissMigration}
    />
  ) : crudError ? (
    <div className="crud-error-banner" role="alert">
      <span className="crud-error-banner-msg">{crudError}</span>
      <button className="btn-banner-close" onClick={() => setCrudError(null)} aria-label="Dismiss error">×</button>
    </div>
  ) : null

  const views = {
    dashboard: (
      <Dashboard
        assignments={assignments}
        schedule={schedule}
        toggleAssignment={toggleAssignment}
        toggleTask={toggleTask}
        settings={settings}
        onNavigate={setActiveView}
      />
    ),
    assignments: (
      <AssignmentsView
        assignments={assignments}
        toggleAssignment={toggleAssignment}
        addAssignment={addAssignment}
        updateAssignment={updateAssignment}
        deleteAssignment={deleteAssignment}
        settings={settings}
      />
    ),
    calendar: <CalendarView assignments={assignments} />,
    settings:  <SettingsView settings={settings} updateSettings={updateSettings} />,
  }

  return (
    <Shell
      activeView={activeView}
      setActiveView={setActiveView}
      onSignOut={signOut}
      banner={banner}
    >
      {views[activeView]}
    </Shell>
  )
}

export default App
