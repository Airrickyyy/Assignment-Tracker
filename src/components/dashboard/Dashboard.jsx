import SummaryCard from './SummaryCard'
import PrioritySection from './PrioritySection'
import TodaySchedule from './TodaySchedule'
import UpcomingDeadlines from './UpcomingDeadlines'
import './Dashboard.css'

function Dashboard({ assignments, schedule, toggleAssignment, toggleTask }) {
  const today = new Date()
  const weekEnd = new Date(today)
  weekEnd.setDate(today.getDate() + 7)

  const pending = assignments.filter(a => a.status === 'pending').length
  const overdue = assignments.filter(a => a.status === 'overdue').length
  const completed = assignments.filter(a => a.status === 'completed').length
  const dueThisWeek = assignments.filter(a => {
    if (a.status === 'completed') return false
    const due = new Date(a.dueDate + 'T00:00:00')
    return due >= today && due <= weekEnd
  }).length

  return (
    <div className="dashboard">
      <div className="summary-row">
        <SummaryCard label="Pending" value={pending} subtext="assignments" variant="default" />
        <SummaryCard label="Due This Week" value={dueThisWeek} subtext="upcoming" variant="warning" />
        <SummaryCard label="Overdue" value={overdue} subtext="need attention" variant="danger" />
        <SummaryCard label="Completed" value={completed} subtext="this cycle" variant="success" />
      </div>

      <PrioritySection assignments={assignments} onToggle={toggleAssignment} />

      <div className="dashboard-grid">
        <TodaySchedule schedule={schedule} onToggle={toggleTask} />
        <UpcomingDeadlines assignments={assignments} />
      </div>
    </div>
  )
}

export default Dashboard
