import { useState, useEffect } from 'react'
import { supabase } from './lib/supabaseClient'
import Shell from './components/layout/Shell'
import AuthScreen from './components/auth/AuthScreen'
import Dashboard from './components/dashboard/Dashboard'
import AssignmentsView from './components/assignments/AssignmentsView'
import CalendarView from './components/calendar/CalendarView'
import SettingsView from './components/settings/SettingsView'
import { loadAssignments, saveAssignments, loadSettings, saveSettings } from './lib/storage'
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
    // Resolve initial session from storage (nearly instant)
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session ?? null)
    })

    // Single subscription for the lifetime of the app
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

  // ── Planner state (localStorage — unchanged from Milestone 1) ────────────
  const [activeView, setActiveView] = useState('dashboard')
  const [assignments, setAssignments] = useState(() => loadAssignments())
  const [schedule,    setSchedule]    = useState(sampleSchedule)
  const [settings,    setSettings]    = useState(() => loadSettings())

  useEffect(() => { saveAssignments(assignments) }, [assignments])
  useEffect(() => { saveSettings(settings) },       [settings])

  function updateSettings(patch) {
    setSettings(prev => ({ ...prev, ...patch }))
  }

  function toggleAssignment(id) {
    setAssignments(prev =>
      prev.map(a => {
        if (a.id !== id) return a
        if (a.status === 'completed') return { ...a, status: deriveStatus(a.dueDate, 'pending') }
        return { ...a, status: 'completed' }
      })
    )
  }

  function addAssignment(data) {
    const status = deriveStatus(data.dueDate, 'pending')
    setAssignments(prev => [{ ...data, id: Date.now(), status }, ...prev])
  }

  function updateAssignment(id, data) {
    setAssignments(prev =>
      prev.map(a => {
        if (a.id !== id) return a
        const status = deriveStatus(data.dueDate, a.status)
        return { ...a, ...data, id, status }
      })
    )
  }

  function deleteAssignment(id) {
    setAssignments(prev => prev.filter(a => a.id !== id))
  }

  function toggleTask(id) {
    setSchedule(prev =>
      prev.map(t => (t.id === id ? { ...t, completed: !t.completed } : t))
    )
  }

  // ── Routing ──────────────────────────────────────────────────────────────
  if (session === undefined) {
    // Session still resolving — render nothing to avoid flash
    return null
  }

  if (!session || isRecovery) {
    return <AuthScreen isRecovery={isRecovery} />
  }

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
    <Shell activeView={activeView} setActiveView={setActiveView} onSignOut={signOut}>
      {views[activeView]}
    </Shell>
  )
}

export default App
