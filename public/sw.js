// JARVIS service worker — Phase 3C background push reminders.
// Payloads come from the send-reminders Edge Function:
//   { title, body, tag, view }

const VIEWS = ['dashboard', 'assignments', 'calendar', 'progress', 'settings']

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()))

self.addEventListener('push', event => {
  event.waitUntil((async () => {
    let data = {}
    try { data = event.data ? event.data.json() : {} } catch { /* non-JSON payload */ }

    // A visible JARVIS tab already notifies through useDesktopNotifications;
    // showing the push too would double up.
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    if (windows.some(w => w.visibilityState === 'visible')) return

    await self.registration.showNotification(data.title || 'JARVIS', {
      body: data.body || '',
      icon: '/favicon.svg',
      tag:  data.tag,
      data: { view: VIEWS.includes(data.view) ? data.view : 'assignments' },
    })
  })())
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const view = event.notification.data?.view || 'assignments'

  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    const existing = windows.find(w => new URL(w.url).origin === self.location.origin)
    if (existing) {
      await existing.focus()
      existing.postMessage({ type: 'jarvis:navigate', view })
      return
    }
    await self.clients.openWindow(`/?view=${view}`)
  })())
})
