import './UpcomingDeadlines.css'

function formatDate(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

function daysLeft(dateStr, status) {
  if (status === 'overdue') return { label: 'Overdue', cls: 'tag--overdue' }
  const due = new Date(dateStr + 'T23:59:59')
  const diff = Math.ceil((due - new Date()) / (1000 * 60 * 60 * 24))
  if (diff <= 0) return { label: 'Today', cls: 'tag--today' }
  if (diff === 1) return { label: '1 day', cls: 'tag--soon' }
  if (diff <= 3) return { label: `${diff} days`, cls: 'tag--soon' }
  return { label: `${diff} days`, cls: 'tag--normal' }
}

function UpcomingDeadlines({ assignments }) {
  const upcoming = assignments
    .filter(a => a.status !== 'completed')
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
    .slice(0, 6)

  return (
    <section className="deadlines-section">
      <h2 className="section-title">Upcoming Deadlines</h2>
      <ul className="deadlines-list">
        {upcoming.map(a => {
          const { label, cls } = daysLeft(a.dueDate, a.status)
          return (
            <li key={a.id} className="deadline-item">
              <div className={`deadline-priority priority--${a.priority}`} aria-hidden="true" />
              <div className="deadline-info">
                <span className="deadline-title">{a.title}</span>
                <span className="deadline-course">{a.course}</span>
              </div>
              <div className="deadline-meta">
                <span className="deadline-date">{formatDate(a.dueDate)}</span>
                <span className={`deadline-tag ${cls}`}>{label}</span>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

export default UpcomingDeadlines
