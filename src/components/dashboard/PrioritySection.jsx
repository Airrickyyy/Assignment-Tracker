import './PrioritySection.css'

function daysUntilLabel(dateStr, status) {
  if (status === 'overdue') return 'Overdue'
  const due = new Date(dateStr + 'T23:59:59')
  const diff = Math.ceil((due - new Date()) / (1000 * 60 * 60 * 24))
  if (diff <= 0) return 'Due today'
  if (diff === 1) return 'Due tomorrow'
  return `${diff}d left`
}

function PrioritySection({ assignments, onToggle }) {
  const urgent = assignments
    .filter(a => a.status !== 'completed' && (a.priority === 'high' || a.status === 'overdue'))
    .slice(0, 4)

  return (
    <section className="priority-section">
      <h2 className="section-title">
        Priority Items
        {urgent.length > 0 && <span className="section-badge">{urgent.length}</span>}
      </h2>

      {urgent.length === 0 ? (
        <p className="empty-state">No urgent items — all clear.</p>
      ) : (
        <ul className="priority-list">
          {urgent.map(a => (
            <li
              key={a.id}
              className={`priority-item priority-item--${a.status === 'overdue' ? 'overdue' : a.priority}`}
            >
              <input
                type="checkbox"
                className="priority-check"
                checked={a.status === 'completed'}
                onChange={() => onToggle(a.id)}
                aria-label={`Mark "${a.title}" complete`}
              />
              <div className="priority-info">
                <span className="priority-title">{a.title}</span>
                <span className="priority-course">{a.course}</span>
              </div>
              <span className={`priority-due ${a.status === 'overdue' ? 'is-overdue' : ''}`}>
                {daysUntilLabel(a.dueDate, a.status)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export default PrioritySection
