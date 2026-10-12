// send-reminders — Phase 3C background push reminders.
//
// Invoked every 15 minutes by pg_cron (see docs/PHASE-3C-SETUP.md). For each
// user with a push subscription, selects reminders that haven't been pushed
// yet, sends them to every subscribed browser, and records them in
// push_reminders_sent so each reminder is delivered once.
//
// Deploy with --no-verify-jwt: the caller authenticates with x-cron-secret.

import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'
import {
  addDays,
  buildPushPayloads,
  reminderKey,
  selectPushReminders,
} from '../_shared/reminderSelection.js'

const SUPABASE_URL      = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_ROLE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const VAPID_PUBLIC_KEY  = Deno.env.get('VAPID_PUBLIC_KEY') ?? ''
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY') ?? ''
const VAPID_SUBJECT     = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:jarvis@example.com'
const CRON_SECRET       = Deno.env.get('CRON_SECRET') ?? ''

// Push services drop the message if the browser stays offline longer than this.
const PUSH_TTL_SECONDS = 6 * 60 * 60

type Subscription = {
  endpoint: string
  user_id: string
  p256dh: string
  auth: string
  time_zone: string
  updated_at: string
}

type AssignmentRow = {
  id: string
  user_id: string
  title: string
  course: string
  due_date: string
  status: string
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function secretMatches(given: string | null): boolean {
  if (!CRON_SECRET || !given || given.length !== CRON_SECRET.length) return false
  let diff = 0
  for (let i = 0; i < given.length; i++) diff |= given.charCodeAt(i) ^ CRON_SECRET.charCodeAt(i)
  return diff === 0
}

Deno.serve(async req => {
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)
  if (!secretMatches(req.headers.get('x-cron-secret'))) return json({ error: 'unauthorized' }, 401)
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return json({ error: 'VAPID keys not configured' }, 500)

  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
  const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } })

  // ── Subscriptions, grouped by user ──────────────────────────────────────
  const { data: subs, error: subsErr } = await db
    .from('push_subscriptions')
    .select('endpoint, user_id, p256dh, auth, time_zone, updated_at')
  if (subsErr) return json({ error: `subscriptions: ${subsErr.message}` }, 500)
  if (!subs?.length) return json({ users: 0, sent: 0 })

  const byUser = new Map<string, Subscription[]>()
  for (const s of subs as Subscription[]) {
    const list = byUser.get(s.user_id) ?? []
    list.push(s)
    byUser.set(s.user_id, list)
  }

  // ── Candidate assignments ───────────────────────────────────────────────
  // A UTC range wide enough to cover "yesterday … now+48h" in any time zone;
  // selectPushReminders narrows it per user.
  const todayUtc = new Date().toISOString().slice(0, 10)
  const { data: rows, error: rowsErr } = await db
    .from('assignments')
    .select('id, user_id, title, course, due_date, status')
    .in('user_id', [...byUser.keys()])
    .neq('status', 'completed')
    .gte('due_date', addDays(todayUtc, -2))
    .lte('due_date', addDays(todayUtc, 4))
  if (rowsErr) return json({ error: `assignments: ${rowsErr.message}` }, 500)

  const assignments = (rows ?? []) as AssignmentRow[]
  const sentKeys = new Set<string>()
  if (assignments.length) {
    const { data: sentRows, error: sentErr } = await db
      .from('push_reminders_sent')
      .select('assignment_id, reminder_type, due_date')
      .in('assignment_id', assignments.map(a => a.id))
    if (sentErr) return json({ error: `sent log: ${sentErr.message}` }, 500)
    for (const r of sentRows ?? []) sentKeys.add(reminderKey(r.reminder_type, r.assignment_id, r.due_date))
  }

  // ── Per-user delivery ───────────────────────────────────────────────────
  const now = new Date()
  let pushesSent = 0
  let failures = 0
  let removedEndpoints = 0

  for (const [userId, userSubs] of byUser) {
    // The most recently registered browser decides the user's time zone.
    userSubs.sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    const timeZone = userSubs[0].time_zone

    const items = selectPushReminders(
      assignments.filter(a => a.user_id === userId),
      { now, timeZone, sentKeys },
    )
    if (!items.length) continue

    const payloads = buildPushPayloads(items)
    let delivered = false

    for (const sub of userSubs) {
      const target = { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }
      for (const payload of payloads) {
        try {
          await webpush.sendNotification(target, JSON.stringify(payload), { TTL: PUSH_TTL_SECONDS })
          delivered = true
          pushesSent++
        } catch (err) {
          const status = (err as { statusCode?: number }).statusCode
          if (status === 404 || status === 410) {
            // Browser unsubscribed or the subscription expired.
            await db.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
            removedEndpoints++
            break
          }
          failures++
          console.warn(`push failed (status ${status ?? 'unknown'})`)
        }
      }
    }

    // Only mark as sent once at least one browser accepted the push, so a
    // transient push-service outage is retried on the next run.
    if (delivered) {
      const { error } = await db.from('push_reminders_sent').upsert(
        items.map(i => ({
          assignment_id: i.assignment.id,
          reminder_type: i.type,
          due_date:      i.assignment.due_date,
        })),
        { onConflict: 'assignment_id,reminder_type,due_date', ignoreDuplicates: true },
      )
      if (error) console.warn(`sent log write failed: ${error.message}`)
    }
  }

  return json({ users: byUser.size, sent: pushesSent, failures, removedEndpoints })
})
