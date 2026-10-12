import { useEffect, useRef } from 'react'
import QuickPanel from './QuickPanel'

const FOCUSABLE = 'button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])'

/**
 * Web host for the Quick Panel: drops it down over the current view with a
 * backdrop. Esc or a click outside closes it; focus moves into the panel on
 * open, is kept inside while open, and returns to the trigger on close.
 */
function QuickPanelOverlay({ open, onClose, ...panelProps }) {
  const dialogRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const returnTo = document.activeElement
    dialogRef.current?.querySelector('[role="tab"][aria-selected="true"]')?.focus()

    function onKeyDown(e) {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }
      if (e.key !== 'Tab' || !dialogRef.current) return
      const items = [...dialogRef.current.querySelectorAll(FOCUSABLE)]
      if (!items.length) return
      const first = items[0]
      const last  = items[items.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      if (returnTo instanceof HTMLElement) returnTo.focus()
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="qp-overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="qp-dialog" role="dialog" aria-modal="true" aria-label="Quick Panel" ref={dialogRef}>
        <QuickPanel {...panelProps} onClose={onClose} />
      </div>
    </div>
  )
}

export default QuickPanelOverlay
