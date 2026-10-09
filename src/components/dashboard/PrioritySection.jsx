import { scoreAssignments } from '../../lib/priorityEngine'
import './PrioritySection.css'

function PrioritySection({ assignments, onToggle }) {
  const scored = scoreAssignments(assignments).slice(0, 4)

  if (scored.length === 0) {
    return (
      <section className="priority-section">
        <h2 className="section-title">Priority Items</h2>
        <p className="empty-state">No urgent items — all clear.</p>
      </section>
    )
  }

  const [top, ...rest] = scored
  const topVariant = top.status === 'overdue' ? 'overdue' : top.priority

  return (
    <section className="priority-section">
      <h2 className="section-title">
        Priority Items
        <span className="section-badge">{scored.length}</span>
      </h2>

      {/* Top recommendation with reason */}
      <div className={`priority-focus priority-item--${topVariant}`}>
        <div className="focus-header">
          <span className="focus-label">NEXT FOCUS</span>
          <span className={`priority-due ${top.daysUntilDue < 0 ? 'is-overdue' : ''}`}>
            {top.urgencyLabel}
          </span>
        </div>
        <div className="focus-content">
          <input
            type="checkbox"
            className="priority-check"
            checked={top.status === 'completed'}
            onChange={() => onToggle(top.id)}
            aria-label={`Mark "${top.title}" complete`}
          />
          <div className="priority-info">
            <span className="priority-title">{top.title}</span>
            <span className="priority-course">{top.course}</span>
            <span className="focus-reason">{top.reason}</span>
          </div>
        </div>
      </div>

      {/* Remaining items */}
      {rest.length > 0 && (
        <ul className="priority-list">
          {rest.map(a => (
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
              <span className={`priority-due ${a.daysUntilDue < 0 ? 'is-overdue' : ''}`}>
                {a.urgencyLabel}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export default PrioritySection
