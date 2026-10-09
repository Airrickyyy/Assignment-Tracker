import { useState, useEffect } from 'react'
import './TodaySchedule.css'

function parseMinutes(timeStr) {
  const [h, m] = timeStr.split(':').map(Number)
  return h * 60 + m
}

function TodaySchedule({ schedule, onToggle }) {
  const [now, setNow] = useState(new Date())

  // Update every minute so active/past classes track real time
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(timer)
  }, [])

  const currentMinutes = now.getHours() * 60 + now.getMinutes()

  return (
    <section className="schedule-section">
      <h2 className="section-title">Today's Schedule</h2>
      <ul className="schedule-list">
        {schedule.map((item, index) => {
          const start = parseMinutes(item.time)
          const end   = parseMinutes(item.endTime)
          const isActive = currentMinutes >= start && currentMinutes <= end
          const isPast   = currentMinutes > end || item.completed

          return (
            <li
              key={item.id}
              className={`schedule-item ${isPast ? 'past' : ''} ${isActive ? 'active' : ''}`}
              data-last={index === schedule.length - 1 ? 'true' : undefined}
            >
              <div className="schedule-time">
                <span className="schedule-time-start">{item.time}</span>
                <span className="schedule-time-end">{item.endTime}</span>
              </div>

              <div className="schedule-bar">
                <div className="schedule-bar-track" />
                <div className={`schedule-bar-dot dot--${item.type} ${isActive ? 'dot--active' : ''}`} />
              </div>

              <div className="schedule-content">
                <span className="schedule-title">{item.title}</span>
                <span className="schedule-subtitle">{item.subtitle}</span>
              </div>

              {item.type === 'task' && (
                <input
                  type="checkbox"
                  className="schedule-check"
                  checked={item.completed}
                  onChange={() => onToggle(item.id)}
                  aria-label={`Mark "${item.title}" done`}
                />
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

export default TodaySchedule
