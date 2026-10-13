import { supabase } from './supabaseClient'
import { isDesktopApp } from './platform'

// Public half of the VAPID key pair — safe to ship to the browser.
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY

/**
 * 'unsupported'  — browser lacks service workers / Push API
 * 'unconfigured' — VITE_VAPID_PUBLIC_KEY not set
 * 'available'    — background reminders can be enabled
 */
export function getPushSupport() {
  // Browser Web Push has no push service inside the desktop app's WebView;
  // the desktop app delivers reminders natively instead (Phase 5B).
  if (isDesktopApp) return 'unsupported'
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return 'unsupported'
  if (typeof window === 'undefined' || !('PushManager' in window)) return 'unsupported'
  if (!VAPID_PUBLIC_KEY) return 'unconfigured'
  return 'available'
}

/** Decode a base64url string (as produced for VAPID keys) to bytes. */
export function urlBase64ToUint8Array(base64url) {
  const padded = base64url + '='.repeat((4 - (base64url.length % 4)) % 4)
  const base64 = padded.replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  return Uint8Array.from(raw, c => c.charCodeAt(0))
}

function sameKey(a, b) {
  if (!a || !b) return false
  const x = new Uint8Array(a)
  const y = new Uint8Array(b)
  return x.length === y.length && x.every((v, i) => v === y[i])
}

/**
 * Register the service worker, subscribe this browser to push and record the
 * subscription against the signed-in user. Safe to call repeatedly.
 */
export async function enablePush() {
  const registration = await navigator.serviceWorker.register('/sw.js')
  await navigator.serviceWorker.ready

  const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
  let subscription = await registration.pushManager.getSubscription()

  // A subscription made with an older VAPID key can't receive our pushes.
  if (subscription && !sameKey(subscription.options?.applicationServerKey, applicationServerKey)) {
    await subscription.unsubscribe()
    subscription = null
  }
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey,
    })
  }

  const { endpoint, keys } = subscription.toJSON()
  const { error } = await supabase.rpc('register_push_subscription', {
    p_endpoint:  endpoint,
    p_p256dh:    keys.p256dh,
    p_auth:      keys.auth,
    p_time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  })
  if (error) throw error
}

/**
 * Remove this browser's subscription from the server and unsubscribe it.
 * Must run while the user is still signed in (RLS scopes the delete).
 */
export async function disablePush() {
  if (getPushSupport() === 'unsupported') return
  const registration = await navigator.serviceWorker.getRegistration('/')
  const subscription = await registration?.pushManager.getSubscription()
  if (!subscription) return
  const { error } = await supabase
    .from('push_subscriptions')
    .delete()
    .eq('endpoint', subscription.endpoint)
  await subscription.unsubscribe()
  if (error) throw error
}
