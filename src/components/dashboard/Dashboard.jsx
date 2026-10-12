import SummaryCard from './SummaryCard'
import PrioritySection from './PrioritySection'
import TodaySchedule from './TodaySchedule'
import UpcomingDeadlines from './UpcomingDeadlines'
import { localDateStr, shiftDays } from '../../lib/quickPanel'
import './Dashboard.css'

// `assignments` carry the effective status (see lib/assignmentStatus), so
// 'overdue' reflects today's date rather than the last save.
function Dashboard({ assignments, schedule, toggleAssignment, toggleTask, settings = {}, onNavigate, now = new Date() }) {
  const today   = localDateStr(now)
  const weekEnd = shiftDays(today, 7)

  const pending   = assignments.filter(a => a.status === 'pending').length
  const overdue   = assignments.filter(a => a.status === 'overdue').length
  const completed = assignments.filter(a => a.status === 'completed').length
  // Due today through 7 days from now, inclusive. Compared as date strings so
  // assignments due today count even after midnight has passed this morning.
  const dueThisWeek = assignments.filter(a =>
    a.status !== 'completed' && a.dueDate >= today && a.dueDate <= weekEnd,
  ).length

  const showCompleted = settings.showCompletedOnDashboard !== false

  return (
    <div className="dashboard">
      {/* Overdue banner */}
      {settings.overdueReminder === 'banner' && overdue > 0 && (
        <div className="overdue-banner">
          <div className="overdue-banner-left">
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" width="14" height="14" aria-hidden="true">
              <path d="M10 3l7 14H3L10 3z" strokeLinejoin="round" />
              <path d="M10 9v4M10 15v.5" strokeLinecap="round" />
            </svg>
            <span>
              {overdue} overdue assignment{overdue !== 1 ? 's' : ''} need{overdue === 1 ? 's' : ''} attention
            </span>
          </div>
          <button className="overdue-banner-btn" onClick={() => onNavigate?.('assignments')}>
            View overdue
          </button>
        </div>
      )}

      <div className="summary-row">
        <SummaryCard label="Pending"       value={pending}   subtext="assignments"  variant="default" />
        <SummaryCard label="Due This Week" value={dueThisWeek} subtext="upcoming"  variant="warning" />
        <SummaryCard label="Overdue"       value={overdue}   subtext="need attention" variant="danger" />
        <SummaryCard
          label="Completed"
          value={showCompleted ? completed : '—'}
          subtext="this cycle"
          variant="success"
        />
      </div>

      <PrioritySection assignments={assignments} onToggle={toggleAssignment} />

      <div className="dashboard-grid">
        <TodaySchedule schedule={schedule} onToggle={toggleTask} />
        <UpcomingDeadlines assignments={assignments} today={today} />
      </div>
    </div>
  )
}

export default Dashboard
