import { useState, useEffect, useRef } from 'react'
import './NotificationBell.css'

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDueLabel(dueDate) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(dueDate + 'T00:00:00')
  const diffDays = Math.round((due - today) / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return 'Due today'
  if (diffDays === 1) return 'Due tomorrow'
  return `Due in ${diffDays}d`
}

function formatShortDate(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

// ── Sub-components ────────────────────────────────────────────────────────────

function BellIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" width="15" height="15" aria-hidden="true">
      <path d="M10 2a6 6 0 00-6 6v2.5L3 13h14l-1-2.5V8a6 6 0 00-6-6z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8.5 16a1.5 1.5 0 003 0" strokeLinecap="round" />
    </svg>
  )
}

function NotifItem({ assignment, type, onClick }) {
  return (
    <button className="notif-item" onClick={onClick}>
      <span className={`notif-priority-dot priority-dot--${assignment.priority}`} aria-hidden="true" />
      <span className="notif-item-body">
        <span className="notif-item-title">{assignment.title}</span>
        {assignment.course && (
          <span className="notif-item-course">{assignment.course}</span>
        )}
      </span>
      <span className="notif-item-when">
        <span className={`notif-item-label${type === 'overdue' ? ' notif-label--overdue' : ''}`}>
          {type === 'overdue' ? 'Overdue' : formatDueLabel(assignment.dueDate)}
        </span>
        <span className="notif-item-date">{formatShortDate(assignment.dueDate)}</span>
      </span>
    </button>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

const EMPTY_REMINDERS = { upcoming: [], overdue: [], total: 0 }

function NotificationBell({ reminders = EMPTY_REMINDERS, onNavigate }) {
  const { upcoming, overdue, total } = reminders
  const [open, setOpen] = useState(false)
  const containerRef = useRef(null)

  // Close panel on outside click
  useEffect(() => {
    if (!open) return
    function onMouseDown(e) {
      if (!containerRef.current?.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [open])

  // Close panel on Escape key
  useEffect(() => {
    if (!open) return
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  function handleItemClick() {
    setOpen(false)
    onNavigate?.('assignments')
  }

  function handleViewAll() {
    setOpen(false)
    onNavigate?.('assignments')
  }

  const hasOverdue  = overdue.length > 0
  const hasUpcoming = upcoming.length > 0
  const isEmpty     = !hasOverdue && !hasUpcoming

  return (
    <div className="notif-bell" ref={containerRef}>
      <button
        className={[
          'notif-bell-btn',
          open        ? 'is-open'     : '',
          hasOverdue  ? 'has-overdue' : '',
        ].filter(Boolean).join(' ')}
        onClick={() => setOpen(prev => !prev)}
        aria-label={total > 0
          ? `Notifications — ${total} reminder${total !== 1 ? 's' : ''}`
          : 'Notifications'}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <BellIcon />
        {total > 0 && (
          <span className="notif-badge" aria-hidden="true">
            {total > 9 ? '9+' : total}
          </span>
        )}
      </button>

      {open && (
        <div className="notif-panel" role="dialog" aria-label="Reminders">
          <div className="notif-panel-header">
            <span className="notif-panel-title">Reminders</span>
            <button
              className="notif-panel-close"
              onClick={() => setOpen(false)}
              aria-label="Close reminders"
            >
              ×
            </button>
          </div>

          {isEmpty ? (
            <div className="notif-empty">
              <p className="notif-empty-text">All caught up — no upcoming deadlines.</p>
            </div>
          ) : (
            <>
              <div className="notif-panel-body">
                {hasOverdue && (
                  <div className="notif-section">
                    <span className="notif-section-label notif-section-label--overdue">
                      Overdue · {overdue.length}
                    </span>
                    {overdue.map(a => (
                      <NotifItem key={a.id} assignment={a} type="overdue" onClick={handleItemClick} />
                    ))}
                  </div>
                )}
                {hasUpcoming && (
                  <div className="notif-section">
                    <span className="notif-section-label">
                      Upcoming · {upcoming.length}
                    </span>
                    {upcoming.map(a => (
                      <NotifItem key={a.id} assignment={a} type="upcoming" onClick={handleItemClick} />
                    ))}
                  </div>
                )}
              </div>
              <div className="notif-panel-footer">
                <button className="btn-notif-view-all" onClick={handleViewAll}>
                  View all assignments →
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default NotificationBell
