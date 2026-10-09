import { useState, useEffect } from 'react'
import NotificationBell from '../notifications/NotificationBell'
import './TopBar.css'

function TopBar({ title, reminders, onNavigate }) {
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
