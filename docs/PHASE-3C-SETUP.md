# Phase 3C — Background Push Reminders: Setup & Test

Reminders that arrive when no JARVIS tab is open, as long as the browser itself is running (Chrome/Edge on Windows keep a background process by default).

## How it works

```
pg_cron (every 15 min)
  └── POST /functions/v1/send-reminders   (x-cron-secret header)
        ├── reads push_subscriptions           (one row per browser)
        ├── reads assignments                  (not completed, near today)
        ├── selectPushReminders()              (user's time zone; skips push_reminders_sent)
        │     upcoming = due today … now+48h
        │     overdue  = due yesterday only (no backlog floods)
        ├── web-push → each of the user's browsers   (>3 reminders → one summary)
        └── writes push_reminders_sent        (once a browser accepted it)

Browser
  ├── public/sw.js              shows the push unless a JARVIS tab is visible
  │                             click → focus tab + switch to Assignments, or open /?view=assignments
  ├── usePushSubscription       subscribes when signed in + toggle on + permission granted
  │                             unsubscribes when the toggle is turned off
  └── App.signOut()             deletes this browser's subscription before signing out
```

| File | Role |
|------|------|
| `supabase/migrations/002_push_subscriptions.sql` | Tables, RLS, `register_push_subscription()` RPC |
| `supabase/functions/send-reminders/index.ts` | Edge Function (Deno) |
| `supabase/functions/_shared/reminderSelection.js` | Selection + payload logic, shared with Vitest |
| `public/sw.js` | Service worker |
| `src/lib/pushSubscription.js`, `src/lib/usePushSubscription.js` | Browser subscription |
| `scripts/setup-push-keys.mjs` | Generates VAPID keys + cron secret into gitignored env files |

## One-time setup

Secrets live in two gitignored files written by the key script: `.env.local` (public key only) and `supabase/functions/.env` (private key + cron secret). **Never paste their values into chat, commits or the frontend.**

1. **Keys** — already generated on 2026-10-12. To regenerate: `node scripts/setup-push-keys.mjs --force`.
2. **Database** — Supabase dashboard → SQL Editor → run `supabase/migrations/002_push_subscriptions.sql`, then `003_push_grants.sql`. The "destructive operations" warning on 002 comes from `DROP POLICY IF EXISTS` and is safe. Without 003 the function fails with `permission denied for table push_subscriptions`.
3. **Deploy the function** (from the repo root):
   ```sh
   npx supabase login        # in a real PowerShell window — needs an interactive terminal
   npx supabase secrets set --env-file supabase/functions/.env --project-ref <ref>
   npx supabase functions deploy send-reminders --no-verify-jwt --use-api --project-ref <ref>
   ```
   `<ref>` is the subdomain of your `VITE_SUPABASE_URL`. A deploy can fail with a transient `500 internal error`; rerun it.
4. **Schedule it** — run the SQL below in SQL Editor (it also enables `pg_cron` and `pg_net`). On 2026-10-12 this was generated with the values filled in at `supabase/.temp/cron-setup.sql` (gitignored, contains the secret, rerunnable). Success returns the job id. Manual version, replacing the two placeholders (the secret is the `CRON_SECRET` line in `supabase/functions/.env`):
   ```sql
   select vault.create_secret('https://<your-project-ref>.supabase.co', 'jarvis_project_url');
   select vault.create_secret('<CRON_SECRET>', 'jarvis_cron_secret');

   select cron.schedule(
     'jarvis-send-reminders',
     '*/15 * * * *',
     $$
     select net.http_post(
       url     := (select decrypted_secret from vault.decrypted_secrets where name = 'jarvis_project_url')
                  || '/functions/v1/send-reminders',
       headers := jsonb_build_object(
                    'Content-Type',  'application/json',
                    'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'jarvis_cron_secret')),
       body    := '{}'::jsonb,
       timeout_milliseconds := 30000
     );
     $$
   );
   ```
5. **Restart** `npm run dev` so Vite picks up `VITE_VAPID_PUBLIC_KEY`.

## Manual test (Windows, real browser)

Run only one dev server (see the stale-port note in the roadmap session log).

1. Sign in → Settings → Notifications. With the toggle on, **Background Reminders** should read **Active**.
   - *Not configured* → `VITE_VAPID_PUBLIC_KEY` missing; restart the dev server.
   - *Error* → check the browser console; usually migration 002 hasn't been run.
2. Create an assignment due **tomorrow**. (The open tab notifies immediately via the in-tab path — that's 3B.)
3. **Close the JARVIS tab** but leave the browser running.
4. Wait up to 15 minutes, or trigger a run now from SQL Editor by executing just the `select net.http_post(...)` statement from step 4.
5. A notification titled `Due soon: <title>` should appear. It is sent once — later runs must not repeat it.
6. Click it → JARVIS opens on the Assignments view.
7. Toggle notifications **off** → the row disappears from `push_subscriptions` (Table Editor). Toggle back on → it returns.
8. Sign out → this browser's row is removed.

Troubleshooting a run: `select status_code, content from net._http_response order by created desc limit 5;` — the function returns `{ users, sent, failures, removedEndpoints }`. Edge Function logs are in Dashboard → Edge Functions → send-reminders → Logs.

## Known limits

- Browser fully closed (no background process) → pushes queue at the push service for up to 6 hours (TTL), then are dropped. Guaranteed delivery needs Phase 5 (desktop app).
- Delivery granularity is the cron interval (15 min).
- A user's time zone comes from their most recently registered browser.
- While a JARVIS tab is visible the service worker suppresses pushes; the in-tab hook handles those cases. A reminder delivered by both paths shares the same `tag`, so the OS replaces rather than stacks it.
