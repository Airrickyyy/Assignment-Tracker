import { useId, useMemo, useRef, useState } from 'react'
import { buildQuickPanelData, dueLabel, shiftDays } from '../../lib/quickPanel'
import './QuickPanel.css'

// Host-agnostic: no overlay, routing or window assumptions. The web app wraps
// it in QuickPanelOverlay; the Phase 5B desktop app will host it in its own
// window and pass the same props.

const TABS = [
  { id: 'today',    label: 'Today'     },
  { id: 'upcoming', label: 'Upcoming'  },
  { id: 'stats',    label: 'Stats'     },
  { id: 'add',      label: 'Quick add' },
]

const UPCOMING_LIMIT = 20

// ── Icons ─────────────────────────────────────────────────────────────────────

function CheckIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M3.5 8.5l3 3 6-7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ChevronIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M6 3.5L10.5 8 6 12.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function TileIcon({ name }) {
  const paths = {
    today:   <><circle cx="10" cy="10" r="6.5" /><path d="M10 6.5V10l2.5 1.5" strokeLinecap="round" /></>,
    week:    <><rect x="3.5" y="4.5" width="13" height="12" rx="2" /><path d="M3.5 8.5h13M7 3v3M13 3v3" strokeLinecap="round" /></>,
    overdue: <><path d="M10 3.5l7 12.5H3z" strokeLinejoin="round" /><path d="M10 8.5v3.5M10 14v.01" strokeLinecap="round" /></>,
  }
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      {paths[name]}
    </svg>
  )
}

// ── Building blocks ───────────────────────────────────────────────────────────

function Tile({ icon, label, value, tone = 'default', onClick }) {
  return (
    <button type="button" className={`qp-tile qp-tile--${tone}`} onClick={onClick}>
      <span className="qp-tile-icon"><TileIcon name={icon} /></span>
      <span className="qp-tile-text">
        <span className="qp-tile-label">{label}</span>
        <span className="qp-tile-value">{value}</span>
      </span>
    </button>
  )
}

function AssignmentRow({ assignment, today, busy, onComplete, onOpen }) {
  const overdue = assignment.dueDate < today
  return (
    <li className="qp-row">
      <span className={`qp-dot qp-dot--${assignment.priority}`} aria-hidden="true" />
      <span className="qp-row-main">
        <span className="qp-row-title">{assignment.title}</span>
        {assignment.course && <span className="qp-row-course">{assignment.course}</span>}
      </span>
      <span className={`qp-row-due${overdue ? ' qp-row-due--overdue' : ''}`}>
        {dueLabel(assignment.dueDate, today)}
      </span>
      <button
        type="button"
        className="qp-icon-btn qp-icon-btn--complete"
        onClick={() => onComplete(assignment.id)}
        disabled={busy}
        aria-label={`Mark ${assignment.title} complete`}
      >
        <CheckIcon />
      </button>
      <button
        type="button"
        className="qp-icon-btn"
        onClick={onOpen}
        aria-label={`Open ${assignment.title} in Assignments`}
      >
        <ChevronIcon />
      </button>
    </li>
  )
}

function AssignmentList({ title, tone, items, ...rowProps }) {
  if (!items.length) return null
  return (
    <section className="qp-group">
      <h3 className={`qp-group-title${tone ? ` qp-group-title--${tone}` : ''}`}>
        {title} · {items.length}
      </h3>
      <ul className="qp-list">
        {items.map(a => (
          <AssignmentRow
            key={a.id}
            assignment={a}
            busy={rowProps.busyIds.has(a.id)}
            today={rowProps.today}
            onComplete={rowProps.onComplete}
            onOpen={rowProps.onOpen}
          />
        ))}
      </ul>
    </section>
  )
}

function Ring({ fraction, value, label, detail, tone = 'accent' }) {
  const r = 34
  const circumference = 2 * Math.PI * r
  const clamped = Math.max(0, Math.min(1, fraction ?? 0))
  return (
    <figure className={`qp-ring qp-ring--${tone}`}>
      <svg viewBox="0 0 84 84" width="96" height="96" role="img" aria-label={`${label}: ${value}. ${detail}`}>
        <circle className="qp-ring-track" cx="42" cy="42" r={r} />
        <circle
          className="qp-ring-fill"
          cx="42" cy="42" r={r}
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - clamped)}
          transform="rotate(-90 42 42)"
        />
        <text className="qp-ring-value" x="42" y="47" textAnchor="middle">{value}</text>
      </svg>
      <figcaption>
        <span className="qp-ring-label">{label}</span>
        <span className="qp-ring-detail">{detail}</span>
      </figcaption>
    </figure>
  )
}

// ── Tabs ──────────────────────────────────────────────────────────────────────

function TodayTab({ data, listProps, onTab }) {
  const { dueToday, dueTomorrow, next7, overdue } = data
  const empty = !overdue.length && !dueToday.length && !dueTomorrow.length
  return (
    <>
      <div className="qp-tiles">
        <Tile icon="today"   label="Due today"   value={dueToday.length} tone={dueToday.length ? 'warn' : 'default'} onClick={() => onTab('upcoming')} />
        <Tile icon="week"    label="Next 7 days" value={next7.length} onClick={() => onTab('upcoming')} />
        <Tile icon="overdue" label="Overdue"     value={overdue.length} tone={overdue.length ? 'danger' : 'ok'} onClick={() => onTab('stats')} />
      </div>
      {empty ? (
        <p className="qp-empty">All clear — nothing due today or tomorrow.</p>
      ) : (
        <>
          <AssignmentList title="Overdue"  tone="danger" items={overdue}     {...listProps} />
          <AssignmentList title="Today"                   items={dueToday}    {...listProps} />
          <AssignmentList title="Tomorrow"                items={dueTomorrow} {...listProps} />
        </>
      )}
    </>
  )
}

function UpcomingTab({ data, listProps, onViewAll }) {
  const shown = data.upcoming.slice(0, UPCOMING_LIMIT)
  return (
    <>
      {shown.length ? (
        <AssignmentList title="Next up" items={shown} {...listProps} />
      ) : (
        <p className="qp-empty">No upcoming assignments.</p>
      )}
      <button type="button" className="qp-link-btn" onClick={onViewAll}>
        {data.upcoming.length > UPCOMING_LIMIT
          ? `View all ${data.upcoming.length} in Assignments →`
          : 'Open Assignments →'}
      </button>
    </>
  )
}

function StatsTab({ stats }) {
  const { week, hours, onTrack } = stats
  return (
    <div className="qp-rings">
      <Ring
        label="This week"
        fraction={week.total ? week.done / week.total : 0}
        value={week.total ? `${Math.round((week.done / week.total) * 100)}%` : '—'}
        detail={week.total ? `${week.done} of ${week.total} done` : 'Nothing due this week'}
      />
      <Ring
        label="Next 7 days"
        tone="warn"
        fraction={hours.total ? hours.left / hours.total : 0}
        value={`${hours.left}h`}
        detail={hours.total ? `left of ${hours.total}h estimated` : 'No estimates yet'}
      />
      <Ring
        label="On track"
        tone={onTrack.overdue ? 'danger' : 'ok'}
        fraction={onTrack.total ? onTrack.count / onTrack.total : 1}
        value={onTrack.overdue ? `${onTrack.overdue}` : '✓'}
        detail={onTrack.overdue ? `${onTrack.overdue} overdue` : 'Nothing overdue'}
      />
    </div>
  )
}

function QuickAddTab({ today, defaultPriority, onAdd }) {
  const ids = useId()
  const titleRef = useRef(null)
  const [form, setForm] = useState(() => ({
    title: '', course: '', dueDate: shiftDays(today, 1), priority: defaultPriority,
  }))
  const [error, setError] = useState(null)
  const [status, setStatus] = useState(null)
  const [saving, setSaving] = useState(false)

  function set(field) {
    return e => setForm(prev => ({ ...prev, [field]: e.target.value }))
  }

  async function submit(e) {
    e.preventDefault()
    if (!form.title.trim()) { setError('Title is required.'); titleRef.current?.focus(); return }
    if (!form.dueDate)      { setError('Due date is required.'); return }
    setError(null)
    setSaving(true)
    const ok = await onAdd({
      title: form.title.trim(),
      course: form.course.trim(),
      dueDate: form.dueDate,
      priority: form.priority,
    })
    setSaving(false)
    if (ok) {
      setStatus(`Added “${form.title.trim()}” — due ${dueLabel(form.dueDate, today).toLowerCase()}.`)
      setForm(prev => ({ ...prev, title: '' }))
      titleRef.current?.focus()
    } else {
      setStatus(null)
      setError('Could not add the assignment. Try again.')
    }
  }

  return (
    <form className="qp-add" onSubmit={submit} noValidate>
      <div className="qp-field qp-field--wide">
        <label htmlFor={`${ids}-title`}>Title</label>
        <input
          id={`${ids}-title`} ref={titleRef} value={form.title} onChange={set('title')}
          placeholder="e.g. Lab 5 report" autoComplete="off"
          aria-invalid={error?.startsWith('Title') || undefined}
        />
      </div>
      <div className="qp-field">
        <label htmlFor={`${ids}-course`}>Course</label>
        <input id={`${ids}-course`} value={form.course} onChange={set('course')} placeholder="Optional" autoComplete="off" />
      </div>
      <div className="qp-field">
        <label htmlFor={`${ids}-due`}>Due</label>
        <input id={`${ids}-due`} type="date" value={form.dueDate} onChange={set('dueDate')} />
      </div>
      <div className="qp-field">
        <label htmlFor={`${ids}-priority`}>Priority</label>
        <select id={`${ids}-priority`} value={form.priority} onChange={set('priority')}>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </div>
      <button type="submit" className="qp-add-btn" disabled={saving}>
        {saving ? 'Adding…' : 'Add'}
      </button>
      <p className={`qp-add-msg${error ? ' qp-add-msg--error' : ''}`} role="status" aria-live="polite">
        {error ?? status ?? ''}
      </p>
    </form>
  )
}

// ── Panel ─────────────────────────────────────────────────────────────────────

function QuickPanel({
  assignments,
  loading = false,
  defaultPriority = 'medium',
  onToggle,
  onAdd,
  onNavigate,
  onClose,
  initialTab = 'today',
  now,
}) {
  const ids = useId()
  const [tab, setTab] = useState(initialTab)
  const [busyIds, setBusyIds] = useState(() => new Set())
  const tabRefs = useRef({})

  // `now` is only passed by tests; otherwise recompute with the assignments.
  const data = useMemo(() => buildQuickPanelData(assignments, now ?? new Date()), [assignments, now])

  async function complete(id) {
    setBusyIds(prev => new Set(prev).add(id))
    try {
      await onToggle(id)
    } finally {
      setBusyIds(prev => { const next = new Set(prev); next.delete(id); return next })
    }
  }

  function openAssignments() {
    onNavigate?.('assignments')
    onClose?.()
  }

  function onTabKeyDown(e) {
    const i = TABS.findIndex(t => t.id === tab)
    let next = null
    if (e.key === 'ArrowRight') next = TABS[(i + 1) % TABS.length]
    if (e.key === 'ArrowLeft')  next = TABS[(i - 1 + TABS.length) % TABS.length]
    if (e.key === 'Home')       next = TABS[0]
    if (e.key === 'End')        next = TABS[TABS.length - 1]
    if (!next) return
    e.preventDefault()
    setTab(next.id)
    tabRefs.current[next.id]?.focus()
  }

  const listProps = { today: data.today, busyIds, onComplete: complete, onOpen: openAssignments }

  return (
    <div className="qp">
      <div className="qp-header">
        <div className="qp-tabs" role="tablist" aria-label="Quick Panel" onKeyDown={onTabKeyDown}>
          {TABS.map(t => (
            <button
              key={t.id}
              ref={el => { tabRefs.current[t.id] = el }}
              type="button"
              role="tab"
              id={`${ids}-tab-${t.id}`}
              aria-selected={tab === t.id}
              aria-controls={`${ids}-panel`}
              tabIndex={tab === t.id ? 0 : -1}
              className={`qp-tab${tab === t.id ? ' is-active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
        {onClose && (
          <button type="button" className="qp-close" onClick={onClose} aria-label="Close Quick Panel">×</button>
        )}
      </div>

      <div
        className="qp-body"
        role="tabpanel"
        id={`${ids}-panel`}
        aria-labelledby={`${ids}-tab-${tab}`}
        aria-busy={loading || undefined}
      >
        {loading && tab !== 'add' ? (
          <p className="qp-empty">Loading assignments…</p>
        ) : tab === 'today' ? (
          <TodayTab data={data} listProps={listProps} onTab={setTab} />
        ) : tab === 'upcoming' ? (
          <UpcomingTab data={data} listProps={listProps} onViewAll={openAssignments} />
        ) : tab === 'stats' ? (
          <StatsTab stats={data.stats} />
        ) : (
          <QuickAddTab today={data.today} defaultPriority={defaultPriority} onAdd={onAdd} />
        )}
      </div>
    </div>
  )
}

export default QuickPanel
