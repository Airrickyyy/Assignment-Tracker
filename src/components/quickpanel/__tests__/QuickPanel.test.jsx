import { render, screen, fireEvent, waitFor, within, cleanup } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import QuickPanel from '../QuickPanel'
import QuickPanelOverlay from '../QuickPanelOverlay'

afterEach(cleanup)

const NOW = new Date(2026, 9, 14, 12, 0, 0) // Wed 2026-10-14

const ASSIGNMENTS = [
  { id: 'o', title: 'Old essay',  course: 'HIST', dueDate: '2026-10-12', priority: 'high',   status: 'pending' },
  { id: 't', title: 'Lab 4',      course: 'CS',   dueDate: '2026-10-14', priority: 'medium', status: 'pending', estimatedHours: 2 },
  { id: 'm', title: 'Problem set', course: 'MATH', dueDate: '2026-10-15', priority: 'low',    status: 'pending' },
  { id: 'd', title: 'Done quiz',  course: 'CS',   dueDate: '2026-10-13', priority: 'low',    status: 'completed' },
]

function renderPanel(props = {}) {
  const handlers = {
    onToggle:   vi.fn(() => Promise.resolve()),
    onAdd:      vi.fn(() => Promise.resolve(true)),
    onNavigate: vi.fn(),
    onClose:    vi.fn(),
  }
  render(<QuickPanel assignments={ASSIGNMENTS} now={NOW} {...handlers} {...props} />)
  return handlers
}

describe('QuickPanel', () => {
  it('Today tab shows summary tiles and overdue/today/tomorrow groups', () => {
    renderPanel()
    expect(screen.getByRole('tab', { name: 'Today' }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByRole('button', { name: /Due today\s*1/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Overdue\s*1/ })).toBeTruthy()
    expect(screen.getByText('Old essay')).toBeTruthy()
    expect(screen.getByText('Lab 4')).toBeTruthy()
    expect(screen.getByText('Problem set')).toBeTruthy()
    expect(screen.queryByText('Done quiz')).toBeNull()
  })

  it('completing an assignment calls onToggle with its id', async () => {
    const { onToggle } = renderPanel()
    fireEvent.click(screen.getByRole('button', { name: 'Mark Lab 4 complete' }))
    await waitFor(() => expect(onToggle).toHaveBeenCalledWith('t'))
  })

  it('the open button navigates to Assignments and closes the panel', () => {
    const { onNavigate, onClose } = renderPanel()
    fireEvent.click(screen.getByRole('button', { name: 'Open Lab 4 in Assignments' }))
    expect(onNavigate).toHaveBeenCalledWith('assignments')
    expect(onClose).toHaveBeenCalled()
  })

  it('arrow keys move between tabs', () => {
    renderPanel()
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Today' }), { key: 'ArrowRight' })
    expect(screen.getByRole('tab', { name: 'Upcoming' }).getAttribute('aria-selected')).toBe('true')
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Upcoming' }))
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Upcoming' }), { key: 'ArrowLeft' })
    expect(screen.getByRole('tab', { name: 'Today' }).getAttribute('aria-selected')).toBe('true')
  })

  it('Upcoming tab lists open assignments from today on', () => {
    renderPanel()
    fireEvent.click(screen.getByRole('tab', { name: 'Upcoming' }))
    const panel = screen.getByRole('tabpanel')
    expect(within(panel).getByText('Lab 4')).toBeTruthy()
    expect(within(panel).getByText('Problem set')).toBeTruthy()
    expect(within(panel).queryByText('Old essay')).toBeNull()
  })

  it('Stats tab shows the three rings', () => {
    renderPanel()
    fireEvent.click(screen.getByRole('tab', { name: 'Stats' }))
    // Week Oct 12–18: 4 assignments, 1 done → 25%
    expect(screen.getByRole('img', { name: /This week: 25%\. 1 of 4 done/ })).toBeTruthy()
    expect(screen.getByRole('img', { name: /Next 7 days: 2h/ })).toBeTruthy()
    expect(screen.getByRole('img', { name: /On track: 1\. 1 overdue/ })).toBeTruthy()
  })

  it('Quick add requires a title', async () => {
    const { onAdd } = renderPanel()
    fireEvent.click(screen.getByRole('tab', { name: 'Quick add' }))
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    expect(await screen.findByText('Title is required.')).toBeTruthy()
    expect(onAdd).not.toHaveBeenCalled()
  })

  it('Quick add submits with defaults (due tomorrow, default priority) and clears the title', async () => {
    const { onAdd } = renderPanel({ defaultPriority: 'high' })
    fireEvent.click(screen.getByRole('tab', { name: 'Quick add' }))
    const title = screen.getByLabelText('Title')
    fireEvent.change(title, { target: { value: '  Essay outline ' } })
    fireEvent.change(screen.getByLabelText('Course'), { target: { value: 'HIST' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    await waitFor(() => expect(onAdd).toHaveBeenCalledWith({
      title: 'Essay outline', course: 'HIST', dueDate: '2026-10-15', priority: 'high',
    }))
    expect(await screen.findByText(/Added “Essay outline”/)).toBeTruthy()
    expect(title.value).toBe('')
  })

  it('Quick add reports a failed save', async () => {
    renderPanel({ onAdd: vi.fn(() => Promise.resolve(false)) })
    fireEvent.click(screen.getByRole('tab', { name: 'Quick add' }))
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'X' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    expect(await screen.findByText(/Could not add/)).toBeTruthy()
  })

  it('shows a loading state', () => {
    renderPanel({ loading: true })
    expect(screen.getByText('Loading assignments…')).toBeTruthy()
  })

  it('shows an empty state', () => {
    renderPanel({ assignments: [] })
    expect(screen.getByText(/All clear/)).toBeTruthy()
  })
})

describe('QuickPanelOverlay', () => {
  function renderOverlay(open = true) {
    const onClose = vi.fn()
    const utils = render(
      <QuickPanelOverlay
        open={open} onClose={onClose} assignments={ASSIGNMENTS} now={NOW}
        onToggle={vi.fn()} onAdd={vi.fn()} onNavigate={vi.fn()}
      />,
    )
    return { onClose, ...utils }
  }

  it('renders nothing when closed', () => {
    renderOverlay(false)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('opens as a modal dialog with focus on the active tab', () => {
    renderOverlay()
    expect(screen.getByRole('dialog', { name: 'Quick Panel' }).getAttribute('aria-modal')).toBe('true')
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Today' }))
  })

  it('Escape closes it', () => {
    const { onClose } = renderOverlay()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })

  it('clicking the backdrop closes it; clicking inside does not', () => {
    const { onClose, container } = renderOverlay()
    fireEvent.mouseDown(screen.getByRole('dialog'))
    expect(onClose).not.toHaveBeenCalled()
    fireEvent.mouseDown(container.querySelector('.qp-overlay'))
    expect(onClose).toHaveBeenCalled()
  })
})
