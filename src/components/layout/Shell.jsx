import Sidebar from './Sidebar'
import TopBar from './TopBar'
import './Shell.css'

const VIEW_TITLES = {
  dashboard: 'Dashboard',
  assignments: 'Assignments',
  calendar: 'Calendar',
  settings: 'Settings',
}

function Shell({ activeView, setActiveView, onSignOut, children, banner, reminders, onNavigate, onOpenQuickPanel }) {
  return (
    <div className="shell">
      <Sidebar activeView={activeView} setActiveView={setActiveView} onSignOut={onSignOut} />
      <div className="shell-main">
        <TopBar title={VIEW_TITLES[activeView]} reminders={reminders} onNavigate={onNavigate} onOpenQuickPanel={onOpenQuickPanel} />
        {banner}
        <main className="shell-content">{children}</main>
      </div>
    </div>
  )
}

export default Shell
