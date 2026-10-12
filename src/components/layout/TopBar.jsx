import { useState, useEffect } from 'react'
import NotificationBell from '../notifications/NotificationBell'
import './TopBar.css'

function PanelIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" width="15" height="15" aria-hidden="true">
      <rect x="3" y="3" width="6" height="6" rx="1.5" />
      <rect x="11" y="3" width="6" height="6" rx="1.5" />
      <rect x="3" y="11" width="6" height="6" rx="1.5" />
      <rect x="11" y="11" width="6" height="6" rx="3" />
    </svg>
  )
}

function TopBar({ title, reminders, onNavigate, onOpenQuickPanel }) {
  const [time, setTime] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const formattedTime = time.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })

  const formattedDate = time.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

  return (
    <header className="topbar">
      <h1 className="topbar-title">{title}</h1>
      <div className="topbar-right">
        <span className="topbar-date">{formattedDate}</span>
        <span className="topbar-time">{formattedTime}</span>
        {onOpenQuickPanel && (
          <button
            type="button"
            className="topbar-panel-btn"
            onClick={onOpenQuickPanel}
            aria-label="Open Quick Panel (Ctrl+Space)"
            title="Quick Panel (Ctrl+Space)"
          >
            <PanelIcon />
          </button>
        )}
        <NotificationBell reminders={reminders} onNavigate={onNavigate} />
        <div className="system-indicator">
          <span className="indicator-dot" aria-hidden="true" />
          <span className="indicator-label">ONLINE</span>
        </div>
      </div>
    </header>
  )
}

export default TopBar
