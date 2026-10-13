import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { fetchAssignments, insertAssignment, updateAssignment } from '../../lib/assignmentsRepo'
import { withEffectiveStatus } from '../../lib/assignmentStatus'
import { localDateStr } from '../../lib/quickPanel'
import { loadSettings } from '../../lib/storage'
import { hideCurrentWindow, onDesktopEvent, showMainWindow } from '../../lib/desktop'
import QuickPanel from './QuickPanel'

/**
 * Desktop host for the Quick Panel (Phase 5B): the whole content of the
 * frameless "quickpanel" window. Shares the Supabase session with the main
 * window (same WebView storage) and loads assignments itself, refreshing each
 * time the panel is shown. Changes are written straight to Supabase; the main
 * window refetches when it regains focus.
 */
function QuickPanelWindow() {
  const [session, setSession] = useState(undefined)
  const [assignments, setAssignments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [shownCount, setShownCount] = useState(0)
  const [defaultPriority] = useState(() => loadSettings().defaultPriority)
  const frameRef = useRef(null)
  const userId = session?.user?.id ?? null

  useEffect(() => {
    document.documentElement.classList.add('qp-window')
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => setSession(s ?? null))
    return () => subscription.unsubscribe()
  }, [])

  const refresh = useCallback(async () => {
    if (!userId) return
    try {
      setAssignments(await fetchAssignments())
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => { refresh() }, [refresh])

  // Each time the shell shows the panel: fresh data, first tab, focus inside.
  useEffect(() => onDesktopEvent('quickpanel:shown', () => {
    setShownCount(n => n + 1)
    refresh()
  }), [refresh])

  useEffect(() => {
    frameRef.current?.querySelector('[role="tab"][aria-selected="true"]')?.focus()
  }, [shownCount, userId])

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === 'Escape') hideCurrentWindow()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  const view = useMemo(() => withEffectiveStatus(assignments), [assignments, shownCount])

  async function toggle(id) {
    const existing = assignments.find(a => a.id === id)
    if (!existing) return
    const today = localDateStr(new Date())
    const status = existing.status === 'completed'
      ? (existing.dueDate < today ? 'overdue' : 'pending')
      : 'completed'
    try {
      const updated = await updateAssignment(id, { ...existing, status })
      setAssignments(prev => prev.map(a => (a.id === id ? updated : a)))
    } catch (err) {
      setError(err.message)
    }
  }

  async function add(data) {
    const status = data.dueDate < localDateStr(new Date()) ? 'overdue' : 'pending'
    try {
      const created = await insertAssignment(userId, { ...data, status })
      setAssignments(prev => [created, ...prev])
      return true
    } catch {
      return false
    }
  }

  function openInMain(viewName) {
    showMainWindow(viewName)
    hideCurrentWindow()
  }

  if (session === undefined) return null

  return (
    <div className="qp-window-frame" ref={frameRef}>
      {session ? (
        <>
          {error && <p className="qp-window-error" role="alert">Couldn’t reach JARVIS: {error}</p>}
          <QuickPanel
            key={shownCount}
            assignments={view}
            loading={loading}
            defaultPriority={defaultPriority}
            onToggle={toggle}
            onAdd={add}
            onNavigate={openInMain}
            onClose={hideCurrentWindow}
          />
        </>
      ) : (
        <div className="qp qp-signed-out">
          <p>Sign in to JARVIS to use the Quick Panel.</p>
          <button type="button" className="qp-add-btn" onClick={() => openInMain()}>Open JARVIS</button>
        </div>
      )}
    </div>
  )
}

export default QuickPanelWindow
