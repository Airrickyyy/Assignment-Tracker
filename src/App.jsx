import { useState } from 'react'
import Shell from './components/layout/Shell'
import Dashboard from './components/dashboard/Dashboard'
import AssignmentsView from './components/assignments/AssignmentsView'
import CalendarView from './components/calendar/CalendarView'
import SettingsView from './components/settings/SettingsView'
import { sampleAssignments, sampleSchedule } from './data/sampleData'

function deriveStatus(dueDate, currentStatus) {
  if (currentStatus === 'completed') return 'completed'
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(dueDate + 'T00:00:00')
  return due < today ? 'overdue' : 'pending'
}

function App() {
  const [activeView, setActiveView] = useState('dashboard')
  const [assignments, setAssignments] = useState(sampleAssignments)
  const [schedule, setSchedule] = useState(sampleSchedule)

  function toggleAssignment(id) {
    setAssignments(prev =>
      prev.map(a =>
        a.id === id
          ? { ...a, status: a.status === 'completed' ? 'pending' : 'completed' }
          : a
      )
    )
  }

  function addAssignment(data) {
    const status = deriveStatus(data.dueDate, 'pending')
    setAssignments(prev => [{ ...data, id: Date.now(), status }, ...prev])
  }

  function updateAssignment(id, data) {
    setAssignments(prev =>
      prev.map(a => {
        if (a.id !== id) return a
        const status = deriveStatus(data.dueDate, a.status)
        return { ...a, ...data, id, status }
      })
    )
  }

  function deleteAssignment(id) {
    setAssignments(prev => prev.filter(a => a.id !== id))
  }

  function toggleTask(id) {
    setSchedule(prev =>
      prev.map(t => (t.id === id ? { ...t, completed: !t.completed } : t))
    )
  }

  const views = {
    dashboard: (
      <Dashboard
        assignments={assignments}
        schedule={schedule}
        toggleAssignment={toggleAssignment}
        toggleTask={toggleTask}
      />
    ),
    assignments: (
      <AssignmentsView
        assignments={assignments}
        toggleAssignment={toggleAssignment}
        addAssignment={addAssignment}
        updateAssignment={updateAssignment}
        deleteAssignment={deleteAssignment}
      />
    ),
    calendar: <CalendarView />,
    settings: <SettingsView />,
  }

  return (
    <Shell activeView={activeView} setActiveView={setActiveView}>
      {views[activeView]}
    </Shell>
  )
}

export default App
