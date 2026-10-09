import { useState, useEffect, useRef, useCallback } from 'react'
import './AssignmentModal.css'

const EMPTY_FORM = {
  title: '',
  course: '',
  dueDate: '',
  priority: 'medium',
  estimatedHours: '',
  points: '',
  description: '',
}

function toFormValues(assignment) {
  return {
    title: assignment.title ?? '',
    course: assignment.course ?? '',
    dueDate: assignment.dueDate ?? '',
    priority: assignment.priority ?? 'medium',
    estimatedHours: assignment.estimatedHours != null ? String(assignment.estimatedHours) : '',
    points: assignment.points != null ? String(assignment.points) : '',
    description: assignment.description ?? '',
  }
}

function validate(form) {
  const errors = {}
  if (!form.title.trim()) errors.title = 'Title is required.'
  if (!form.course.trim()) errors.course = 'Course is required.'
  if (!form.dueDate) errors.dueDate = 'Due date is required.'
  if (form.estimatedHours !== '' && (isNaN(Number(form.estimatedHours)) || Number(form.estimatedHours) < 0)) {
    errors.estimatedHours = 'Must be a positive number.'
  }
  if (form.points !== '' && (isNaN(Number(form.points)) || Number(form.points) < 0)) {
    errors.points = 'Must be a positive number.'
  }
  return errors
}

function AssignmentModal({ mode, initial, onSave, onClose, defaultPriority = 'medium' }) {
  const [form, setForm] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState({})
  const firstInputRef = useRef(null)

  useEffect(() => {
    if (mode === 'edit' && initial) {
      setForm(toFormValues(initial))
    } else {
      setForm({ ...EMPTY_FORM, priority: defaultPriority })
    }
    setErrors({})
  }, [mode, initial, defaultPriority])

  useEffect(() => {
    firstInputRef.current?.focus()
  }, [])

  const handleClose = useCallback(() => onClose(), [onClose])

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') handleClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [handleClose])

  function handleChange(e) {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: undefined }))
  }

  function handleSubmit(e) {
    e.preventDefault()
    const errs = validate(form)
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      return
    }
    onSave({
      title: form.title.trim(),
      course: form.course.trim(),
      dueDate: form.dueDate,
      priority: form.priority,
      description: form.description.trim(),
      estimatedHours: form.estimatedHours !== '' ? Number(form.estimatedHours) : null,
      points: form.points !== '' ? Number(form.points) : null,
    })
  }

  function handleBackdropClick(e) {
    if (e.target === e.currentTarget) handleClose()
  }

  return (
    <div className="modal-backdrop" onClick={handleBackdropClick} aria-hidden="false">
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={mode === 'edit' ? 'Edit assignment' : 'New assignment'}
      >
        <div className="modal-header">
          <h2 className="modal-title">
            {mode === 'edit' ? 'Edit Assignment' : 'New Assignment'}
          </h2>
          <button className="modal-close-btn" onClick={handleClose} aria-label="Close">
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" width="15" height="15" aria-hidden="true">
              <path d="M4 4l12 12M16 4L4 16" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <form className="modal-form" onSubmit={handleSubmit} noValidate>
          {/* Title */}
          <div className="form-field">
            <label className="form-label" htmlFor="modal-title">
              Title <span className="form-required">*</span>
            </label>
            <input
              ref={firstInputRef}
              id="modal-title"
              name="title"
              type="text"
              className={`form-input ${errors.title ? 'form-input--error' : ''}`}
              value={form.title}
              onChange={handleChange}
              placeholder="e.g. Lab Report 4"
              autoComplete="off"
            />
            {errors.title && <span className="form-error">{errors.title}</span>}
          </div>

          {/* Course + Priority */}
          <div className="form-row">
            <div className="form-field">
              <label className="form-label" htmlFor="modal-course">
                Course <span className="form-required">*</span>
              </label>
              <input
                id="modal-course"
                name="course"
                type="text"
                className={`form-input ${errors.course ? 'form-input--error' : ''}`}
                value={form.course}
                onChange={handleChange}
                placeholder="e.g. COMP 3320"
                autoComplete="off"
              />
              {errors.course && <span className="form-error">{errors.course}</span>}
            </div>
            <div className="form-field">
              <label className="form-label" htmlFor="modal-priority">Priority</label>
              <select
                id="modal-priority"
                name="priority"
                className="form-input form-select"
                value={form.priority}
                onChange={handleChange}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>

          {/* Due Date + Points */}
          <div className="form-row">
            <div className="form-field">
              <label className="form-label" htmlFor="modal-dueDate">
                Due Date <span className="form-required">*</span>
              </label>
              <input
                id="modal-dueDate"
                name="dueDate"
                type="date"
                className={`form-input form-input--date ${errors.dueDate ? 'form-input--error' : ''}`}
                value={form.dueDate}
                onChange={handleChange}
              />
              {errors.dueDate && <span className="form-error">{errors.dueDate}</span>}
            </div>
            <div className="form-field">
              <label className="form-label" htmlFor="modal-points">Points</label>
              <input
                id="modal-points"
                name="points"
                type="number"
                min="0"
                className={`form-input ${errors.points ? 'form-input--error' : ''}`}
                value={form.points}
                onChange={handleChange}
                placeholder="e.g. 50"
              />
              {errors.points && <span className="form-error">{errors.points}</span>}
            </div>
          </div>

          {/* Est. Hours */}
          <div className="form-row form-row--half">
            <div className="form-field">
              <label className="form-label" htmlFor="modal-estimatedHours">
                Est. Hours
              </label>
              <input
                id="modal-estimatedHours"
                name="estimatedHours"
                type="number"
                min="0"
                step="0.5"
                className={`form-input ${errors.estimatedHours ? 'form-input--error' : ''}`}
                value={form.estimatedHours}
                onChange={handleChange}
                placeholder="e.g. 3"
              />
              {errors.estimatedHours && <span className="form-error">{errors.estimatedHours}</span>}
            </div>
          </div>

          {/* Description */}
          <div className="form-field">
            <label className="form-label" htmlFor="modal-description">Description</label>
            <textarea
              id="modal-description"
              name="description"
              className="form-input form-textarea"
              value={form.description}
              onChange={handleChange}
              placeholder="Optional notes about this assignment…"
              rows={3}
            />
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-modal-cancel" onClick={handleClose}>
              Cancel
            </button>
            <button type="submit" className="btn-modal-save">
              {mode === 'edit' ? 'Save Changes' : 'Add Assignment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default AssignmentModal
