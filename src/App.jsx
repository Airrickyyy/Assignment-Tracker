import { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from './lib/supabaseClient'
import Shell from './components/layout/Shell'
import AuthScreen from './components/auth/AuthScreen'
import Dashboard from './components/dashboard/Dashboard'
import AssignmentsView from './components/assignments/AssignmentsView'
import CalendarView from './components/calendar/CalendarView'
import SettingsView from './components/settings/SettingsView'
import ProgressView from './components/progress/ProgressView'
import MigrationBanner from './components/migration/MigrationBanner'
import QuickPanelOverlay from './components/quickpanel/QuickPanelOverlay'
import './components/migration/MigrationBanner.css'
import {
  fetchAssignments,
  insertAssignment,
  updateAssignment as repoUpdateAssignment,
  deleteAssignment as repoDeleteAssignment,
  bulkInsertAssignments,
} from './lib/assignmentsRepo'
import { deriveReminders } from './lib/notifications'
import { withEffectiveStatus } from './lib/assignmentStatus'
import { useFocusTimer } from './lib/useFocusTimer'
import { BREAK_MIN } from './lib/focusTimer'
import { fetchFocusSessions, flushFocusSessions, logFocusSession } from './lib/focusRepo'
import { localDateStr, shiftDays } from './lib/quickPanel'
import { useDesktopNotifications } from './lib/useDesktopNotifications'
import { usePushSubscription } from './lib/usePushSubscription'
import { disablePush } from './lib/pushSubscription'
import { isDesktopApp } from './lib/platform'
import { onDesktopEvent, toggleQuickPanelWindow } from './lib/desktop'
import { fetchPreferences, upsertPreferences } from './lib/preferencesRepo'
import { loadAssignments, loadSettings, saveSettings, DEFAULT_SETTINGS } from './lib/storage'
import { sampleSchedule } from './data/sampleData'

function deriveStatus(dueDate, currentStatus) {
  if (currentStatus === 'completed') return 'completed'
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(dueDate + 'T00:00:00')
  return due < today ? 'overdue' : 'pending'
}

const VIEWS = ['dashboard', 'assignments', 'calendar', 'progress', 'settings']

// A background push notification opens JARVIS at /?view=<name>.
// Read it once, then strip it so a refresh doesn't keep forcing that view.
function initialView() {
  const params = new URLSearchParams(window.location.search)
  const view = params.get('view')
  if (!view) return 'dashboard'
  params.delete('view')
  const query = params.toString()
  window.history.replaceState(null, '', window.location.pathname + (query ? `?${query}` : '') + window.location.hash)
  return VIEWS.includes(view) ? view : 'dashboard'
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

  async function signOut() {
    // End any running focus session while it can still be saved to this account.
    focus.stop()
    // Drop this browser's push subscription while the session can still
    // authorise the delete, so the next account here doesn't get our pushes.
    try {
      await disablePush()
    } catch (err) {
      console.warn('JARVIS: could not remove push subscription —', err?.message ?? err)
    }
    supabase.auth.signOut()
  }

  // ── Planner state ────────────────────────────────────────────────────────
  const [activeView,        setActiveView]        = useState(initialView)
  const [assignments,       setAssignments]       = useState([])
  const [assignmentsLoading,  setAssignmentsLoading] = useState(false)
  const [assignmentsLoaded,   setAssignmentsLoaded]  = useState(false)
  const [assignmentsError,    setAssignmentsError]   = useState(null)
  const [crudError,          setCrudError]           = useState(null)
  const [settingsError,      setSettingsError]       = useState(null)
  const [schedule,          setSchedule]          = useState(sampleSchedule)
  const [settings,          setSettings]          = useState(() => loadSettings())

  // ── Migration state ──────────────────────────────────────────────────────
  const [localAssignments,    setLocalAssignments]    = useState([])
  const [migrationPending,    setMigrationPending]    = useState(false)
  const [migrationInProgress, setMigrationInProgress] = useState(false)
  const [migrationError,      setMigrationError]      = useState(null)

  useEffect(() => { saveSettings(settings) }, [settings])

  // ── Derived state ────────────────────────────────────────────────────────
  const sessionUserId = session?.user?.id ?? null

  // notifTick increments every 5 minutes so reminders recompute at time boundaries
  const [notifTick, setNotifTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setNotifTick(t => t + 1), 5 * 60 * 1000)
    return () => clearInterval(id)
  }, [])

  const reminders = useMemo(() => deriveReminders(assignments), [assignments, notifTick])

  // What views display: stored status corrected for dates that have since
  // passed (the DB value only updates on create/edit). notifTick re-derives
  // it across midnight.
  const viewAssignments = useMemo(() => withEffectiveStatus(assignments), [assignments, notifTick])

  useEffect(() => {
    if (!sessionUserId) {
      setAssignments([])
      setAssignmentsLoading(false)
      setAssignmentsLoaded(false)
      setAssignmentsError(null)
      setMigrationPending(false)
      // desktopNotificationsEnabled is a browser-level preference — it must
      // survive sign-out/sign-in and page refreshes. Preserve it when resetting
      // the rest of settings to defaults. (The sign-out branch runs on every
      // initial mount while session is undefined, which would otherwise write
      // desktopNotificationsEnabled:false to localStorage on every page load.)
      setSettings(prev => ({ ...DEFAULT_SETTINGS, desktopNotificationsEnabled: prev.desktopNotificationsEnabled }))
      setSettingsError(null)
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
        setAssignmentsLoaded(true)

        // Migration detection: only prompt once per user account.
        // Check the raw key first so we don't trigger on the sampleData fallback.
        const marker = localStorage.getItem(`jarvis_migrated_${sessionUserId}`)
        if (!marker) {
          const rawLocal = localStorage.getItem('jarvis_assignments')
          if (rawLocal) {
            const local = loadAssignments()
            // The old app auto-saved sampleAssignments (IDs 1–9) on first load.
            // Filter those out so we don't migrate placeholder data.
            // Real user assignments used Date.now() (13-digit) or UUIDs.
            const userLocal = local.filter(
              a => !(typeof a.id === 'number' && a.id >= 1 && a.id <= 9)
            )
            if (userLocal.length > 0) {
              setLocalAssignments(userLocal)
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

  // ── Cloud preferences fetch on sign-in ──────────────────────────────────
  useEffect(() => {
    if (!sessionUserId) return
    let cancelled = false
    setSettingsError(null)
    fetchPreferences()
      .then(prefs => {
        if (cancelled) return
        if (prefs) {
          setSettings(prev => ({ ...prev, ...prefs }))
        } else {
          // New account — seed cloud row with defaults; don't change UI state.
          upsertPreferences(sessionUserId, DEFAULT_SETTINGS).catch(() => {})
        }
      })
      .catch(err => {
        if (cancelled) return
        setSettingsError(`Could not load preferences: ${err.message}`)
      })
    return () => { cancelled = true }
  }, [sessionUserId])

  // ── Migration handlers ───────────────────────────────────────────────────
  async function handleMigrateLocal() {
    setMigrationInProgress(true)
    setMigrationError(null)
    try {
      await bulkInsertAssignments(sessionUserId, localAssignments)
    } catch (err) {
      setMigrationError(err.message)
      setMigrationInProgress(false)
      return
    }
    // Insert confirmed — close the banner and mark complete before anything else.
    // This must happen before the refetch so a refetch failure cannot leave the
    // banner open with a Retry button that would re-run the insert.
    localStorage.setItem(`jarvis_migrated_${sessionUserId}`, '1')
    setMigrationPending(false)
    setLocalAssignments([])
    setMigrationInProgress(false)
    // Best-effort refetch to show the newly migrated assignments immediately.
    try {
      const fresh = await fetchAssignments()
      setAssignments(fresh)
    } catch {
      // Ignore — migration already succeeded. Data will appear on next sign-in.
    }
  }

  function handleDismissMigration() {
    localStorage.setItem(`jarvis_migrated_${sessionUserId}`, '1')
    setMigrationPending(false)
    setLocalAssignments([])
    setMigrationError(null)
  }

  async function updateSettings(patch) {
    let next
    setSettings(prev => {
      next = { ...prev, ...patch }
      return next
    })
    if (!sessionUserId) return
    try {
      await upsertPreferences(sessionUserId, next)
      setSettingsError(null)
    } catch (err) {
      setSettingsError(`Could not save preferences: ${err.message}`)
    }
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
      return true
    } catch (err) {
      setCrudError(err.message)
      return false
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

  // ── Desktop notifications ────────────────────────────────────────────────
  useDesktopNotifications({
    reminders,
    enabled: settings.desktopNotificationsEnabled,
    sessionUserId,
    assignmentsLoaded,
    onNavigate: setActiveView,
  })

  // ── Background push reminders (Phase 3C) ─────────────────────────────────
  const pushStatus = usePushSubscription({
    enabled: settings.desktopNotificationsEnabled,
    sessionUserId,
  })

  // Clicking a push notification while JARVIS is already open focuses this
  // tab and the service worker asks us to switch views.
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    function onMessage(event) {
      if (event.data?.type === 'jarvis:navigate' && VIEWS.includes(event.data.view)) {
        setActiveView(event.data.view)
      }
    }
    navigator.serviceWorker.addEventListener('message', onMessage)
    return () => navigator.serviceWorker.removeEventListener('message', onMessage)
  }, [])

  // ── Focus timer + study tracking (Phases 5C / 5D) ────────────────────────
  // Last 35 days of focus sessions: today's total for the Quick Panel and the
  // Progress view's charts.
  const [focusSessions, setFocusSessions] = useState([])
  const [focusError, setFocusError] = useState(null)
  const refreshFocusSessions = useCallback(() => {
    if (!sessionUserId) return
    const since = new Date(shiftDays(localDateStr(new Date()), -34) + 'T00:00:00').toISOString()
    fetchFocusSessions(since)
      .then(list => { setFocusSessions(list); setFocusError(null) })
      .catch(err => setFocusError(err.message))
  }, [sessionUserId])

  useEffect(() => {
    if (!sessionUserId) { setFocusSessions([]); return }
    // Save anything queued while offline, then load.
    flushFocusSessions(sessionUserId).catch(() => {}).finally(refreshFocusSessions)
  }, [sessionUserId, refreshFocusSessions])

  const notificationsOn = settings.desktopNotificationsEnabled
  const focus = useFocusTimer({
    handleCompletion: Boolean(sessionUserId),
    logSession: record => {
      if (!sessionUserId) return
      logFocusSession(sessionUserId, record).catch(() => {}).finally(refreshFocusSessions)
    },
    onPhaseEnd: ({ phase }) => {
      if (!notificationsOn || !('Notification' in window) || Notification.permission !== 'granted') return
      try {
        new Notification(phase === 'focus' ? 'Focus session complete' : 'Break over', {
          body: phase === 'focus'
            ? `Nice work. Take a ${BREAK_MIN}-minute break.`
            : 'Ready for another focus session?',
          icon: '/favicon.svg',
          tag: 'jarvis-focus',
        })
      } catch {
        // restricted context
      }
    },
  })

  // Re-check the logged totals when another window (desktop Quick Panel)
  // finishes or stops a session.
  useEffect(() => {
    if (!focus.timer) refreshFocusSessions()
  }, [focus.timer, refreshFocusSessions])

  const focusToday = useMemo(() => {
    const today = localDateStr(new Date())
    const todays = focusSessions.filter(s => localDateStr(new Date(s.startedAt)) === today)
    return { seconds: todays.reduce((sum, s) => sum + s.durationSeconds, 0), sessions: todays.length }
  }, [focusSessions, notifTick])

  // ── Quick Panel (Phase 5A) ───────────────────────────────────────────────
  const [quickPanelOpen, setQuickPanelOpen] = useState(false)
  const closeQuickPanel = useCallback(() => setQuickPanelOpen(false), [])
  const signedIn = Boolean(session) && !isRecovery

  // In the desktop app the panel is its own always-on-top window (Phase 5B);
  // in a browser it's an overlay inside this page.
  const openQuickPanel = useCallback(() => {
    if (isDesktopApp) toggleQuickPanelWindow()
    else setQuickPanelOpen(open => !open)
  }, [])

  // Ctrl+Space toggles the panel from anywhere in the app. On desktop the
  // shell also registers it system-wide; this is the fallback if that failed.
  useEffect(() => {
    if (!signedIn) {
      setQuickPanelOpen(false)
      return
    }
    function onKeyDown(e) {
      if (e.ctrlKey && !e.altKey && !e.metaKey && e.code === 'Space') {
        e.preventDefault()
        openQuickPanel()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [signedIn, openQuickPanel])

  // Desktop: the panel window asks to show a view here ("Open in Assignments").
  useEffect(() => onDesktopEvent('jarvis:navigate', view => {
    if (VIEWS.includes(view)) setActiveView(view)
  }), [])

  // Desktop: pick up changes made in the Quick Panel window when this window
  // regains focus.
  useEffect(() => {
    if (!isDesktopApp || !sessionUserId) return
    function onFocus() {
      fetchAssignments().then(setAssignments).catch(() => {})
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [sessionUserId])

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
  ) : assignmentsError ? (
    <div className="crud-error-banner" role="alert">
      <span className="crud-error-banner-msg">Could not load assignments: {assignmentsError}</span>
      <button className="btn-banner-close" onClick={() => setAssignmentsError(null)} aria-label="Dismiss error">×</button>
    </div>
  ) : settingsError ? (
    <div className="crud-error-banner" role="alert">
      <span className="crud-error-banner-msg">{settingsError}</span>
      <button className="btn-banner-close" onClick={() => setSettingsError(null)} aria-label="Dismiss error">×</button>
    </div>
  ) : crudError ? (
    <div className="crud-error-banner" role="alert">
      <span className="crud-error-banner-msg">{crudError}</span>
      <button className="btn-banner-close" onClick={() => setCrudError(null)} aria-label="Dismiss error">×</button>
    </div>
  ) : null

  const views = {
    dashboard: (
      <Dashboard
        assignments={viewAssignments}
        schedule={schedule}
        toggleAssignment={toggleAssignment}
        toggleTask={toggleTask}
        settings={settings}
        onNavigate={setActiveView}
      />
    ),
    assignments: (
      <AssignmentsView
        assignments={viewAssignments}
        assignmentsLoading={assignmentsLoading}
        toggleAssignment={toggleAssignment}
        addAssignment={addAssignment}
        updateAssignment={updateAssignment}
        deleteAssignment={deleteAssignment}
        settings={settings}
      />
    ),
    calendar: <CalendarView assignments={viewAssignments} />,
    progress: <ProgressView focusSessions={focusSessions} assignments={viewAssignments} error={focusError} />,
    settings:  <SettingsView settings={settings} updateSettings={updateSettings} pushStatus={pushStatus} />,
  }

  return (
    <>
      <Shell
        activeView={activeView}
        setActiveView={setActiveView}
        onSignOut={signOut}
        banner={banner}
        reminders={reminders}
        onNavigate={setActiveView}
        onOpenQuickPanel={openQuickPanel}
      >
        {views[activeView]}
      </Shell>
      <QuickPanelOverlay
        open={quickPanelOpen}
        onClose={closeQuickPanel}
        assignments={viewAssignments}
        loading={assignmentsLoading}
        defaultPriority={settings.defaultPriority}
        onToggle={toggleAssignment}
        onAdd={addAssignment}
        onNavigate={setActiveView}
        focus={focus}
        focusToday={focusToday}
        initialTab={focus.timer ? 'focus' : 'today'}
      />
    </>
  )
}

export default App
