// Bridge to the Tauri desktop shell (src-tauri/src/lib.rs). Every export is a
// safe no-op in the browser, so callers don't need their own isDesktopApp checks.

import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { isDesktopApp } from './platform'

/** 'main', 'quickpanel', or null in a browser. */
export const windowLabel = isDesktopApp ? getCurrentWindow().label : null

export const isQuickPanelWindow = windowLabel === 'quickpanel'

/** Show or hide the floating Quick Panel window. */
export function toggleQuickPanelWindow() {
  if (!isDesktopApp) return Promise.resolve()
  return invoke('toggle_quick_panel')
}

/** Bring the main window forward, optionally switching it to `view`. */
export function showMainWindow(view) {
  if (!isDesktopApp) return Promise.resolve()
  return invoke('show_main', { view: view ?? null })
}

export function hideCurrentWindow() {
  if (!isDesktopApp) return Promise.resolve()
  return getCurrentWindow().hide()
}

/**
 * Subscribe to a desktop-shell event ('jarvis:navigate', 'quickpanel:shown').
 * Returns a cleanup function, usable directly as a useEffect return value.
 */
export function onDesktopEvent(name, handler) {
  if (!isDesktopApp) return () => {}
  let unlisten = null
  let cancelled = false
  listen(name, event => handler(event.payload)).then(fn => {
    if (cancelled) fn()
    else unlisten = fn
  })
  return () => {
    cancelled = true
    unlisten?.()
  }
}
