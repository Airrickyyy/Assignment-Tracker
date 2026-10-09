const PRIORITY_BASE = { high: 30, medium: 20, low: 10 }

function getDaysUntilDue(dueDateStr) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(dueDateStr + 'T00:00:00')
  return Math.ceil((due - today) / (1000 * 60 * 60 * 24))
}

function urgencyScore(days) {
  if (days < 0)   return 50
  if (days === 0) return 40
  if (days === 1) return 30
  if (days <= 3)  return 20
  if (days <= 7)  return 10
  return 0
}

export function getUrgencyLabel(days) {
  if (days < 0)   return 'Overdue'
  if (days === 0) return 'Due today'
  if (days === 1) return 'Due tomorrow'
  return `${days} days left`
}

function buildReason(a, days) {
  const parts = []
  if (days < 0)        parts.push('past deadline')
  else if (days === 0) parts.push('due today')
  else if (days === 1) parts.push('due tomorrow')
  else if (days <= 3)  parts.push(`due in ${days} days`)
  if (a.priority === 'high')          parts.push('high priority')
  if ((a.estimatedHours ?? 0) > 4)    parts.push(`${a.estimatedHours}h workload`)
  if (parts.length === 0)             parts.push('upcoming')
  return parts.join(' · ')
}

export function scoreAssignment(a) {
  if (a.status === 'completed') return null
  const days  = getDaysUntilDue(a.dueDate)
  const score = (PRIORITY_BASE[a.priority] ?? 10) + urgencyScore(days) + ((a.estimatedHours ?? 0) > 4 ? 5 : 0)
  return {
    ...a,
    score,
    daysUntilDue: days,
    urgencyLabel: getUrgencyLabel(days),
    reason: buildReason(a, days),
  }
}

export function scoreAssignments(assignments) {
  return assignments
    .map(scoreAssignment)
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)
}

export function getTopRecommendation(assignments) {
  return scoreAssignments(assignments)[0] ?? null
}
