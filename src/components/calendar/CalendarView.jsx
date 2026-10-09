import { useState } from 'react'
import './CalendarView.css'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function formatDateKey(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function getCalendarDays(year, month) {
  const firstWeekday  = new Date(year, month, 1).getDay()
  const daysInMonth   = new Date(year, month + 1, 0).getDate()
  const daysInPrev    = new Date(year, month, 0).getDate()
  const days = []

  for (let i = firstWeekday - 1; i >= 0; i--) {
    days.push({ date: new Date(year, month - 1, daysInPrev - i), isCurrentMonth: false })
  }
  for (let d = 1; d <= daysInMonth; d++) {
    days.push({ date: new Date(year, month, d), isCurrentMonth: true })
  }
  const remaining = 42 - days.length
  for (let d = 1; d <= remaining; d++) {
    days.push({ date: new Date(year, month + 1, d), isCurrentMonth: false })
  }
  return days
}

function ChevronLeft() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" width="16" height="16" aria-hidden="true">
      <path d="M13 16l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ChevronRight() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" width="16" height="16" aria-hidden="true">
      <path d="M7 4l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function CalendarView({ assignments = [] }) {
  const today = new Date()
  const [viewYear,  setViewYear]  = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())
  const [selectedKey, setSelectedKey] = useState(null)

  const todayKey = formatDateKey(today)
  const days = getCalendarDays(viewYear, viewMonth)

  // Build date → assignments map
  const byDate = {}
  for (const a of assignments) {
    if (!byDate[a.dueDate]) byDate[a.dueDate] = []
    byDate[a.dueDate].push(a)
  }

  // Count assignments in current view month
  const monthStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}`
  const monthCount = assignments.filter(a => a.dueDate.startsWith(monthStr) && a.status !== 'completed').length

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) }
    else setViewMonth(m => m - 1)
    setSelectedKey(null)
  }

  function nextMonth() {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) }
    else setViewMonth(m => m + 1)
    setSelectedKey(null)
  }

  function goToToday() {
    setViewYear(today.getFullYear())
    setViewMonth(today.getMonth())
    setSelectedKey(todayKey)
  }

  function handleDayClick(key) {
    setSelectedKey(prev => prev === key ? null : key)
  }

  // This-week range: today through 6 days ahead
  const weekEnd = new Date(today)
  weekEnd.setDate(weekEnd.getDate() + 6)
  const weekEndKey = formatDateKey(weekEnd)
  const thisWeekAssignments = assignments
    .filter(a => a.dueDate >= todayKey && a.dueDate <= weekEndKey)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))

  const selectedAssignments = selectedKey ? (byDate[selectedKey] ?? []) : []
  const selectedDateLabel = selectedKey
    ? new Date(selectedKey + 'T00:00:00').toLocaleDateString('en-US', {
        weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
      })
    : null

  // Panel is always visible: shows selected day or this week's assignments
  const panelAssignments = selectedKey ? selectedAssignments : thisWeekAssignments
  const panelTitle = selectedKey
    ? selectedDateLabel
    : `This Week · ${today.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`

  return (
    <div className="calendar-view">
      {/* Header */}
      <div className="cal-header">
        <button className="cal-nav-btn" onClick={prevMonth} aria-label="Previous month">
          <ChevronLeft />
        </button>
        <div className="cal-month-info">
          <h2 className="cal-month-title">
            {MONTH_NAMES[viewMonth]} <span className="cal-year">{viewYear}</span>
          </h2>
          {monthCount > 0 && (
            <span className="cal-month-count">
              {monthCount} pending
            </span>
          )}
        </div>
        <button className="cal-nav-btn" onClick={nextMonth} aria-label="Next month">
          <ChevronRight />
        </button>
        <button className="cal-today-btn" onClick={goToToday}>Today</button>
      </div>

      {/* Calendar grid + floating side panel */}
      <div className="cal-body">
      <div className="cal-grid">
        {WEEKDAYS.map(d => (
          <div key={d} className="cal-weekday">{d}</div>
        ))}

        {days.map(({ date, isCurrentMonth }) => {
          const key = formatDateKey(date)
          const cellAssignments = byDate[key] ?? []
          const hasDue = cellAssignments.length > 0
          const isToday    = key === todayKey
          const isSelected = key === selectedKey

          return (
            <div
              key={key}
              className={[
                'cal-day',
                !isCurrentMonth ? 'cal-day--other'    : '',
                isToday          ? 'cal-day--today'    : '',
                isSelected       ? 'cal-day--selected' : '',
                hasDue           ? 'cal-day--has-due'  : '',
              ].join(' ')}
              onClick={() => handleDayClick(key)}
              role="button"
              tabIndex={0}
              aria-label={
                hasDue
                  ? `${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}: ${cellAssignments.length} assignment${cellAssignments.length !== 1 ? 's' : ''}`
                  : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
              }
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') handleDayClick(key) }}
            >
              <span className="cal-day-num">{date.getDate()}</span>

              {hasDue && (
                <div className="cal-dots">
                  {cellAssignments.slice(0, 3).map(a => (
                    <span
                      key={a.id}
                      className={`cal-dot priority--${a.priority} ${a.status === 'completed' ? 'cal-dot--done' : ''}`}
                      aria-hidden="true"
                    />
                  ))}
                  {cellAssignments.length > 3 && (
                    <span className="cal-dot-overflow">+{cellAssignments.length - 3}</span>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Detail panel — always visible, shows selected day or this week */}
      <div className="cal-detail-panel">
        <div className="cal-detail-header">
          <h3 className="cal-detail-date">{panelTitle}</h3>
          {selectedKey && (
            <button className="cal-detail-close" onClick={() => setSelectedKey(null)} aria-label="Back to this week">
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" width="14" height="14" aria-hidden="true">
                <path d="M4 4l12 12M16 4L4 16" strokeLinecap="round" />
              </svg>
            </button>
          )}
        </div>

        {panelAssignments.length === 0 ? (
          <p className="empty-state" style={{ padding: '8px 0' }}>
            {selectedKey ? 'No assignments due on this date.' : 'Nothing due this week.'}
          </p>
        ) : (
          <ul className="cal-detail-list">
            {panelAssignments.map(a => (
              <li key={a.id} className="cal-detail-item">
                <div className={`cal-detail-bar priority--${a.priority}`} aria-hidden="true" />
                <div className="cal-detail-info">
                  <span className="cal-detail-title">{a.title}</span>
                  <span className="cal-detail-meta">
                    {!selectedKey && new Date(a.dueDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    {!selectedKey && ' · '}
                    {a.course}
                    {a.points != null ? ` · ${a.points} pts` : ''}
                    {a.estimatedHours != null ? ` · ${a.estimatedHours}h est.` : ''}
                  </span>
                  {a.description && (
                    <span className="cal-detail-desc">{a.description}</span>
                  )}
                </div>
                <span className={`assignment-status-tag status--${a.status}`}>
                  {a.status.charAt(0).toUpperCase() + a.status.slice(1)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
      </div>
    </div>
  )
}

export default CalendarView
