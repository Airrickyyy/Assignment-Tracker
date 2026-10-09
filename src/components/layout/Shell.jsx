import Sidebar from './Sidebar'
import TopBar from './TopBar'
import './Shell.css'

const VIEW_TITLES = {
  dashboard: 'Dashboard',
  assignments: 'Assignments',
  calendar: 'Calendar',
  settings: 'Settings',
}

function Shell({ activeView, setActiveView, children }) {
  return (
    <div className="shell">
      <Sidebar activeView={activeView} setActiveView={setActiveView} />
      <div className="shell-main">
        <TopBar title={VIEW_TITLES[activeView]} />
        <main className="shell-content">{children}</main>
      </div>
    </div>
  )
}

export default Shell
