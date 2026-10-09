import { useState } from 'react'
import AssignmentModal from './AssignmentModal'
import './AssignmentsView.css'

const FILTERS = ['all', 'pending', 'overdue', 'completed']

function formatDate(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function EditIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" width="13" height="13" aria-hidden="true">
      <path d="M14.5 3.5a2.121 2.121 0 013 3L7 17H4v-3L14.5 3.5z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function DeleteIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" width="13" height="13" aria-hidden="true">
      <path d="M3 5h14M8 5V3h4v2M6 5l1 12h6l1-12" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function AssignmentsView({ assignments, toggleAssignment, addAssignment, updateAssignment, deleteAssignment }) {
  const [filter, setFilter] = useState('all')
  const [modalMode, setModalMode] = useState(null) // 'add' | 'edit'
  const [editingAssignment, setEditingAssignment] = useState(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)

  const filtered = filter === 'all' ? assignments : assignments.filter(a => a.status === filter)
  const sorted = [...filtered].sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))

  function openAdd() {
    setEditingAssignment(null)
    setModalMode('add')
  }

  function openEdit(assignment) {
    setEditingAssignment(assignment)
    setModalMode('edit')
  }

  function closeModal() {
    setModalMode(null)
    setEditingAssignment(null)
  }

  function handleSave(data) {
    if (modalMode === 'add') {
      addAssignment(data)
    } else {
      updateAssignment(editingAssignment.id, data)
    }
    closeModal()
  }

  function handleDelete(id) {
    deleteAssignment(id)
    setConfirmDeleteId(null)
  }

  return (
    <>
      <div className="assignments-view">
        <div className="assignments-header">
          <div className="header-left">
            <div className="filter-tabs" role="tablist" aria-label="Filter assignments">
              {FILTERS.map(f => (
                <button
                  key={f}
                  role="tab"
                  aria-selected={filter === f}
                  className={`filter-tab ${filter === f ? 'active' : ''}`}
                  onClick={() => setFilter(f)}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
            <span className="assignments-count">{sorted.length} item{sorted.length !== 1 ? 's' : ''}</span>
          </div>

          <button className="btn-add" onClick={openAdd}>
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13" aria-hidden="true">
              <path d="M10 4v12M4 10h12" strokeLinecap="round" />
            </svg>
            Add Assignment
          </button>
        </div>

        <ul className="assignment-list">
          {sorted.map(a => (
            <li
              key={a.id}
              className={`assignment-item ${a.status === 'completed' ? 'is-completed' : ''}`}
            >
              <input
                type="checkbox"
                className="assignment-check"
                checked={a.status === 'completed'}
                onChange={() => toggleAssignment(a.id)}
                aria-label={`Mark "${a.title}" complete`}
              />
              <div className={`assignment-priority-bar priority--${a.priority}`} aria-hidden="true" />
              <div className="assignment-info">
                <span className="assignment-title">{a.title}</span>
                <span className="assignment-course">
                  {a.course}
                  {a.points != null ? ` · ${a.points} pts` : ''}
                  {a.estimatedHours != null ? ` · ${a.estimatedHours}h est.` : ''}
                </span>
                {a.description && <span className="assignment-desc">{a.description}</span>}
              </div>
              <div className="assignment-meta">
                <span className="assignment-date">{formatDate(a.dueDate)}</span>
                <span className={`assignment-status-tag status--${a.status}`}>
                  {a.status.charAt(0).toUpperCase() + a.status.slice(1)}
                </span>

                {confirmDeleteId === a.id ? (
                  <div className="delete-confirm">
                    <span className="delete-confirm-label">Delete?</span>
                    <button
                      className="btn-confirm-yes"
                      onClick={() => handleDelete(a.id)}
                    >
                      Yes
                    </button>
                    <button
                      className="btn-confirm-no"
                      onClick={() => setConfirmDeleteId(null)}
                    >
                      No
                    </button>
                  </div>
                ) : (
                  <div className="assignment-actions">
                    <button
                      className="btn-icon"
                      onClick={() => openEdit(a)}
                      aria-label={`Edit "${a.title}"`}
                      title="Edit"
                    >
                      <EditIcon />
                    </button>
                    <button
                      className="btn-icon btn-icon--delete"
                      onClick={() => setConfirmDeleteId(a.id)}
                      aria-label={`Delete "${a.title}"`}
                      title="Delete"
                    >
                      <DeleteIcon />
                    </button>
                  </div>
                )}
              </div>
            </li>
          ))}

          {sorted.length === 0 && (
            <li className="empty-state-row">
              <p className="empty-state">No assignments in this category.</p>
            </li>
          )}
        </ul>
      </div>

      {modalMode && (
        <AssignmentModal
          mode={modalMode}
          initial={editingAssignment}
          onSave={handleSave}
          onClose={closeModal}
        />
      )}
    </>
  )
}

export default AssignmentsView
