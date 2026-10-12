import { useEffect, useState } from 'react'
import { getPushSupport, enablePush, disablePush } from './pushSubscription'

/**
 * Keeps this browser's background-push subscription in step with the
 * desktop-notifications toggle.
 *
 * Subscribes when signed in, the toggle is on and permission is granted;
 * unsubscribes when the toggle is turned off. Sign-out cleanup is done
 * explicitly in App's signOut() because the server row can only be deleted
 * while the session is still valid.
 *
 * Returns 'unsupported' | 'unconfigured' | 'inactive' | 'registering' |
 *         'active' | 'error'.
 */
export function usePushSubscription({ enabled, sessionUserId }) {
  const support = getPushSupport()
  const [status, setStatus] = useState('inactive')

  useEffect(() => {
    if (support !== 'available' || !sessionUserId) return

    let cancelled = false
    if (enabled && Notification.permission === 'granted') {
      setStatus('registering')
      enablePush()
        .then(() => { if (!cancelled) setStatus('active') })
        .catch(err => {
          if (cancelled) return
          console.warn('JARVIS: background reminders unavailable —', err?.message ?? err)
          setStatus('error')
        })
    } else {
      setStatus('inactive')
      disablePush().catch(err => {
        console.warn('JARVIS: could not remove push subscription —', err?.message ?? err)
      })
    }
    return () => { cancelled = true }
  }, [support, enabled, sessionUserId])

  return support === 'available' ? status : support
}
