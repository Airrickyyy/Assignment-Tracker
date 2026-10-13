// True when JARVIS runs inside the Tauri desktop app (Phase 5B) rather than a
// browser tab. Tauri injects __TAURI_INTERNALS__ before any page script runs.
export const isDesktopApp =
  typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
