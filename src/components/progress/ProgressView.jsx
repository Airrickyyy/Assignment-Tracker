import { useMemo, useState } from 'react'
import SummaryCard from '../dashboard/SummaryCard'
import {
  NO_COURSE, courseBreakdown, currentStreak, dailyActivity, formatMinutes, sessionsSince,
} from '../../lib/progressStats'
import { localDateStr } from '../../lib/quickPanel'
import './ProgressView.css'

const DAYS = 7
const MAX_COURSES = 6

// Chart geometry (SVG user units; the SVG scales to its container width).
const W = 640
const H = 200
const PAD = { top: 18, right: 8, bottom: 8, left: 40 }
const PLOT_W = W - PAD.left - PAD.right
const PLOT_H = H - PAD.top - PAD.bottom

function niceMax(value) {
  for (const step of [30, 60, 120, 180, 240, 360, 480, 720]) {
    if (value <= step) return step
  }
  return Math.ceil(value / 240) * 240
}

function weekday(date) {
  return new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' })
}

function longDate(date) {
  return new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

/** Bar with only its top corners rounded, anchored to the baseline. */
function barPath(x, y, w, h, r = 4) {
  const rr = Math.min(r, w / 2, h)
  return `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`
}

function FocusByDayChart({ rows, today }) {
  const [hover, setHover] = useState(null)
  const max = niceMax(Math.max(30, ...rows.map(r => r.minutes)))
  const band = PLOT_W / rows.length
  const barW = Math.min(40, band * 0.56)
  const y = m => PAD.top + PLOT_H - (m / max) * PLOT_H
  const peak = rows.reduce((best, r, i) => (r.minutes > (rows[best]?.minutes ?? 0) ? i : best), -1)
  const hovered = hover != null ? rows[hover] : null

  return (
    <div className="pg-chart">
      <svg viewBox={`0 0 ${W} ${H}`} className="pg-chart-svg" role="img"
        aria-label={`Focus minutes per day, last ${rows.length} days. ${rows.map(r => `${weekday(r.date)} ${formatMinutes(r.minutes)}`).join(', ')}.`}>
        {[0, max / 2, max].map(v => (
          <g key={v}>
            <line className="pg-gridline" x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} />
            <text className="pg-axis-label" x={PAD.left - 8} y={y(v) + 4} textAnchor="end">{formatMinutes(v)}</text>
          </g>
        ))}
        {rows.map((r, i) => {
          const cx = PAD.left + band * i + band / 2
          const h = PLOT_H - (y(r.minutes) - PAD.top)
          return (
            <g key={r.date}>
              {r.minutes > 0 && (
                <path
                  className={`pg-bar${hover === i ? ' is-hover' : ''}`}
                  d={barPath(cx - barW / 2, y(r.minutes), barW, h)}
                />
              )}
              {i === peak && r.minutes > 0 && (
                <text className="pg-bar-label" x={cx} y={y(r.minutes) - 6} textAnchor="middle">
                  {formatMinutes(r.minutes)}
                </text>
              )}
              {/* Hit target: the whole day column, larger than the bar. */}
              <rect
                className="pg-hit" x={PAD.left + band * i} y={PAD.top} width={band} height={PLOT_H}
                onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
              />
            </g>
          )
        })}
      </svg>

      <div className="pg-days" style={{ paddingLeft: `${(PAD.left / W) * 100}%`, paddingRight: `${(PAD.right / W) * 100}%` }}>
        {rows.map(r => (
          <div key={r.date} className={`pg-day${r.date === today ? ' is-today' : ''}`}>
            <span className="pg-day-name">{r.date === today ? 'Today' : weekday(r.date)}</span>
            <span className="pg-day-done" title={`${r.completed} assignment${r.completed === 1 ? '' : 's'} completed`}>
              {r.completed ? `✓ ${r.completed}` : '·'}
            </span>
          </div>
        ))}
      </div>

      {hovered && (
        <div
          className="pg-tooltip" role="status"
          style={{ left: `${((PAD.left + band * hover + band / 2) / W) * 100}%` }}
        >
          <strong>{longDate(hovered.date)}</strong>
          <span>{formatMinutes(hovered.minutes)} focus · {hovered.sessions} session{hovered.sessions === 1 ? '' : 's'}</span>
          <span>{hovered.completed} completed</span>
        </div>
      )}
    </div>
  )
}

function CourseBars({ rows }) {
  const shown = rows.slice(0, MAX_COURSES)
  const rest = rows.slice(MAX_COURSES)
  if (rest.length) shown.push({ course: `Other (${rest.length})`, minutes: rest.reduce((n, r) => n + r.minutes, 0) })
  const max = Math.max(...shown.map(r => r.minutes))
  return (
    <ul className="pg-courses">
      {shown.map(r => (
        <li key={r.course} className="pg-course">
          <span className={`pg-course-name${r.course === NO_COURSE ? ' is-muted' : ''}`}>{r.course}</span>
          <span className="pg-course-track" aria-hidden="true">
            <span className="pg-course-bar" style={{ width: `${(r.minutes / max) * 100}%` }} />
          </span>
          <span className="pg-course-value">{formatMinutes(r.minutes)}</span>
        </li>
      ))}
    </ul>
  )
}

function ProgressView({ focusSessions, assignments, error, now = new Date() }) {
  const today = localDateStr(now)
  const data = useMemo(() => {
    const rows = dailyActivity(focusSessions, assignments, today, DAYS)
    const week = sessionsSince(focusSessions, today, DAYS)
    return {
      rows,
      todayRow: rows[rows.length - 1],
      weekMinutes: rows.reduce((n, r) => n + r.minutes, 0),
      weekCompleted: rows.reduce((n, r) => n + r.completed, 0),
      streak: currentStreak(focusSessions, assignments, today),
      courses: courseBreakdown(week),
    }
  }, [focusSessions, assignments, today])

  const empty = data.weekMinutes === 0 && data.weekCompleted === 0

  return (
    <div className="progress-view">
      {error && <div className="crud-error-banner" role="alert"><span className="crud-error-banner-msg">Could not load study history: {error}</span></div>}

      <div className="summary-row">
        <SummaryCard label="Focus today" value={formatMinutes(data.todayRow.minutes)}
          subtext={`${data.todayRow.sessions} session${data.todayRow.sessions === 1 ? '' : 's'}`} />
        <SummaryCard label="Streak" value={data.streak}
          subtext={data.streak === 1 ? 'day active' : 'days active'} />
        <SummaryCard label="Last 7 days" value={formatMinutes(data.weekMinutes)} subtext="focus time" />
        <SummaryCard label="Completed" value={data.weekCompleted} subtext="last 7 days" />
      </div>

      {empty ? (
        <section className="pg-card pg-empty">
          <h2 className="section-title">No study activity yet</h2>
          <p>Start a focus session from the Quick Panel — press <kbd>Ctrl</kbd>+<kbd>Space</kbd> and open the <strong>Focus</strong> tab.
            Focus time and completed assignments will show up here.</p>
        </section>
      ) : (
        <div className="pg-grid">
          <section className="pg-card">
            <h2 className="section-title">Focus time · last 7 days</h2>
            <FocusByDayChart rows={data.rows} today={today} />
            <details className="pg-table">
              <summary>View as table</summary>
              <table>
                <thead><tr><th scope="col">Day</th><th scope="col">Focus</th><th scope="col">Sessions</th><th scope="col">Completed</th></tr></thead>
                <tbody>
                  {data.rows.map(r => (
                    <tr key={r.date}><th scope="row">{longDate(r.date)}</th><td>{formatMinutes(r.minutes)}</td><td>{r.sessions}</td><td>{r.completed}</td></tr>
                  ))}
                </tbody>
              </table>
            </details>
          </section>

          <section className="pg-card">
            <h2 className="section-title">By course · last 7 days</h2>
            {data.courses.length
              ? <CourseBars rows={data.courses} />
              : <p className="pg-muted">No focus sessions in the last 7 days.</p>}
          </section>
        </div>
      )}
    </div>
  )
}

export default ProgressView
