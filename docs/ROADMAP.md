# JARVIS Roadmap & Living Status Tracker

> Living document. Update after every work session.
> **Status values:** Not started · In progress · Implemented · Verified
> A phase is only **Verified** when its acceptance criteria have actually been tested — code existing is not enough.

## Vision

A unified, persistent, AI-powered productivity assistant that understands the user's real tasks and schedule, works across devices, integrates with authorized services, and proactively helps the user stay organized — not just another assignment tracker or chatbot.

Core goals: academic productivity · reliable persistence · proactive reminders (even when JARVIS isn't the active tab) · a personal AI grounded in real data · desktop and mobile presence · external integrations (Brightspace, calendars) · a polished, cohesive JARVIS identity.

## How the phases fit

1. Core planner → data model and UX
2. Cloud sync → persistent, consistent data
3. Notifications → proactive
4. AI → natural-language, context-aware help
5. Desktop → persistent, Windows-integrated
6. Integrations → connected to the user's wider digital life
7. Deployment & polish → secure, reliable, maintainable

Work can overlap (e.g. browser notifications before desktop; integration research before AI is done), but **don't build advanced features on broken auth or unreliable sync.**

---

## Phase 1 — Core Planner

**Goal:** Foundational app — dashboard, assignment/task create/edit/complete/delete, due dates and status, upcoming/overdue summaries, settings, extensible structure.

- **Status:** Implemented (unverified in browser)
- **Implemented:** Dashboard, assignments view, calendar view, settings view, in-memory task toggle, sampleData — all present in repo as of commit `da3d009`.
- **Verified:** Code structure confirmed; acceptance criteria not manually tested end-to-end.
- **Outstanding:** No known bugs. Browser walkthrough not done.
- **Next step:** Covered by Phase 3B manual test — treat as verified once that passes.

## Phase 2 — Cloud-Connected JARVIS

### 2A — Supabase Foundation

**Goal:** Supabase backend, database and schema, foundation for persistent user data.

- **Status:** Implemented (unverified)
- **Implemented:** `src/lib/supabaseClient.js`, `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` env vars. Schema and RLS policies exist in the project's Supabase dashboard (not in repo).
- **Verified:** Client initializes; auth calls succeed (evidenced by auth working).
- **Outstanding:** RLS policies not audited in this session.
- **Next step:** Audit RLS policies once other phases are stable.

### 2B — Authentication

**Goal:** Sign-in/out, data tied to the right user, loading/session restore/error handling, no cross-user data leakage.

- **Status:** Implemented (unverified in browser)
- **Implemented:** Email magic-link auth via Supabase, session restore in `App.jsx`, `access_denied`/`otp_expired` redirect bug reportedly fixed.
- **Verified:** Session state machine (`undefined`→loading, `null`→signed-out, object→signed-in) confirmed in code.
- **Outstanding:** Multi-user isolation, token expiry handling not manually tested.
- **Next step:** Verify during Phase 3B browser test.

### 2C — Cloud Storage & Sync

**Goal:** Assignments in Supabase; load the authenticated user's data; persist reliably; handle refresh and session restore; stale local state never overwrites newer cloud data; no updates lost during loading/auth transitions.

- **Status:** Implemented (unverified)
- **Implemented:** `src/lib/assignmentsRepo.js` — `fetchAssignments`, `insertAssignment`, `updateAssignment`, `deleteAssignment`, `bulkInsertAssignments`. `localStorage` migration banner for existing users.
- **Verified:** Code confirmed present and wired into App.jsx correctly.
- **Outstanding:** Migration edge cases (duplicate detection, partial failures) not tested. No optimistic updates — all writes are server-confirmed.
- **Next step:** Test migration path with real local data on next available opportunity.

### 2D — Preferences & Sync Reliability

**Goal:** Reliable settings persistence; decide local vs cloud preferences; preserve across sign-in/out, refresh, session restore; resolve races between defaults, local and cloud settings.

- **Status:** Implemented (unverified in browser)
- **Implemented:** `src/lib/preferencesRepo.js` — `fetchPreferences`, `upsertPreferences`. `desktopNotificationsEnabled` is localStorage-only (excluded from Supabase sync). Sign-out reset preserves `desktopNotificationsEnabled` via functional update.
- **Verified:** Code of the preference-reset fix confirmed in `src/App.jsx`:
  ```js
  setSettings(prev => ({ ...DEFAULT_SETTINGS, desktopNotificationsEnabled: prev.desktopNotificationsEnabled }))
  ```
- **Outstanding:** Real browser test needed — enable notifications, refresh, sign out/in, confirm preference survives.
- **Next step:** Covered by Phase 3B manual test.

## Phase 3 — Notifications & Reminders

### 3A — In-App Reminders

**Goal:** Reminders derived from real assignment data; upcoming/overdue shown in-app; consistent with completion and due dates; no unnecessary duplicates.

- **Status:** Implemented (unverified)
- **Implemented:** `deriveReminders` in `src/lib/notifications.js` — 48-hour upcoming window, local-timezone YYYY-MM-DD comparison, excludes completed. Reminder bell in Shell. Tested by 4 unit tests.
- **Verified:** Logic confirmed by unit tests (due tomorrow → upcoming, due yesterday → overdue, completed → excluded, far future → excluded).
- **Outstanding:** Visual display of the bell/count not manually confirmed.
- **Next step:** Verify during Phase 3B browser test.

### 3B — Browser / OS Notifications

**Goal:** Permission requested appropriately; enable/disable toggle; detect new assignments needing reminders; notify for upcoming/overdue; don't fire for assignments existing at load; dedupe; handle user change, completion, permission denial, unavailable API; click navigates to the relevant view.

- **Status:** Verified (2026-10-12, user-confirmed)
- **Implemented:**
  - `src/lib/useDesktopNotifications.js` — seed-without-fire, hydration guard, per-user state isolation, dedup via sentRef, overdue-before-upcoming scan.
  - `src/App.jsx` — `assignmentsLoaded` flag, `notifTick` 5-minute interval, `reminders` useMemo, hook call before early returns.
  - `src/components/settings/SettingsView.jsx` — 4 permission states (unsupported/denied/default/granted), toggle, test button.
  - `src/lib/__tests__/useDesktopNotifications.test.js` — 12 tests covering all key invariants.
- **Verified (automated):** 12/12 tests pass, lint clean, build clean (2026-10-10). Diagnostic logs removed.
- **Verified (manual):** 2026-10-10 — new assignment due tomorrow fired a Windows notification once the in-app toggle was on. Root cause of the earlier "no notification" reports: the toggle had been stored as `false` (old sign-out bug) while the status tag still said "Allowed". The tag now reads "Disabled" when the toggle is off. Click → Assignments navigation and refresh/sign-out persistence not yet explicitly confirmed.
- **Outstanding:**
  - **Required:** On Windows in a real browser, enable notifications, grant permission, create a new pending assignment due tomorrow → notification must appear. Click it → must navigate to assignments view.
  - Preference must survive refresh and sign-out/sign-in.
  - Windows Focus Assist / notification throttling may suppress notifications even when permission is granted.
- **Next step:** Manual browser test. See instructions below.

#### How to manually test 3B

1. `npm run dev`
2. Sign in.
3. Go to Settings → Notifications. Grant permission and enable the toggle.
4. Refresh the page. Confirm the toggle is still enabled (preference survived).
5. Create a new assignment with a due date of tomorrow.
6. Confirm a Windows notification appears titled `Due soon: <your title>`.
7. Click the notification — confirm it navigates to the Assignments view.
8. Sign out, sign back in. Confirm no flood of notifications.
9. If no notification appears despite the toggle being on, check Windows Settings → System → Notifications and ensure both the browser app and Focus Assist are not blocking.

### 3C — Reliable Background Reminders

**Goal:** Reminders when the tab is inactive or closed where technically possible; handle scheduling, time zones, permission state, duplicate delivery, stale assignments; consider server-side delivery.

- **Status:** Verified (core flow) — deployed and manually tested 2026-10-12
- **Approach:** Web Push. pg_cron → `send-reminders` Edge Function every 15 min → web-push to each subscribed browser → service worker shows it. Full design, setup and test steps: `docs/PHASE-3C-SETUP.md`.
- **Implemented (2026-10-12):**
  - `supabase/migrations/003_push_grants.sql` — table GRANTs for `authenticated` / `service_role` (this project doesn't auto-grant API roles on SQL-created tables).
  - `supabase/migrations/002_push_subscriptions.sql` — `push_subscriptions` (RLS: own rows select/delete), `push_reminders_sent` (service-role only), `register_push_subscription()` RPC (validates endpoint, keys, time zone).
  - `supabase/functions/send-reminders/index.ts` — cron-secret auth, per-user time zone, dedup via sent log (key includes due date), prunes 404/410 endpoints, marks sent only after a browser accepts.
  - `supabase/functions/_shared/reminderSelection.js` — upcoming = today…now+48h; overdue = due yesterday only (no backlog flood); >3 reminders → one summary.
  - `public/sw.js` — shows push unless a JARVIS tab is visible; click focuses/opens JARVIS on Assignments.
  - `src/lib/pushSubscription.js`, `src/lib/usePushSubscription.js`, App wiring (sign-out removes subscription, `?view=` deep link, SW navigate message), Settings "Background Reminders" status row.
  - `scripts/setup-push-keys.mjs` — VAPID keys + cron secret written to gitignored files (`.env.local`, `supabase/functions/.env`). Keys generated 2026-10-12.
- **Verified (automated):** 37/37 tests (15 selection, 7 hook, 2 key decoding + existing 13), lint clean, build clean.
- **Deployed (2026-10-12):** migrations 002 + 003 run; secrets set; `send-reminders` deployed (`--no-verify-jwt`); pg_cron job `jarvis-send-reminders` (id 1) every 15 min. Smoke test: no secret → 401; with secret → 200.
- **Verified (manual, 2026-10-12):** JARVIS tab closed, browser running → triggered run returned `{"users":1,"sent":1}` and the Windows notification appeared (user-confirmed).
- **Outstanding:**
  - Not yet explicitly checked: click → opens Assignments; toggle off / sign-out removes the `push_subscriptions` row; a second run doesn't repeat the push; the scheduled (unattended) cron run.
  - Known gap: if a reminder's push lands while a JARVIS tab is visible, the service worker suppresses it but the server still marks it sent. Reminders for assignments created in-tab are covered by the in-tab hook; ones already in the window when the tab loaded only show in the in-app bell.
  - Browser fully closed is not covered (push TTL 6h) — that's Phase 5.
- **Next step:** Run the remaining checks opportunistically; move on to the RLS audit.

## Phase 4 — AI Assistant

**Goal:** Natural-language interface grounded in the user's real data: answer workload questions, summarize, prioritize, suggest study plans, break down large assignments. Later: conversational create/edit, multi-step planning, cross-service context, possibly voice.

**Engineering requirements:** controlled, explicit interfaces to authorized data · auth and data isolation enforced · no API keys in frontend · confirmation for consequential actions · distinguish verified data from AI suggestions · **not** a generic chatbot disconnected from the app.

- **Status:** Not started
- **Next step:** Begin once Phases 2–3B are manually verified.

## Phase 5 — Desktop Experience

### 5A — Quick Panel (in-app)

**Goal:** A compact, tabbed control panel for managing upcoming assignments at a glance, styled after a desktop-shell dashboard (reference: user-supplied screenshots, 2026-10-12 — tab row, large rounded tiles, ring gauges). Built as a self-contained React component inside the web app so 5B can reuse it unchanged as the desktop overlay.

**Tabs:**
- **Today** — summary tiles (due today · due this week · overdue) + assignments due today/tomorrow with one-click complete.
- **Upcoming** — next assignments in due-date order; complete, open/edit, jump to the full Assignments view.
- **Stats** — ring gauges: % completed this week, estimated hours due in the next 7 days, overdue count.
- **Quick add** — single-row add (title · course · due date) using the existing `addAssignment` path.

**Acceptance criteria:**
- Opens over the current view from a header button and a keyboard shortcut; closes with Esc or clicking outside.
- Reads the same `assignments` state and uses the existing CRUD handlers — no separate data path; changes show immediately everywhere.
- Loading, empty and error states; works at narrow widths; keyboard and screen-reader accessible.
- Matches the existing JARVIS theme (tokens from `src/styles/variables.css`), not a pasted-in second design system.
- Component has no web-only assumptions that would block hosting it in a Tauri window.
- Tests for tab content selection (today/upcoming/stats calculations) and quick add.

- **Status:** Not started
- **Open decision:** overlay on top of the app (recommended — becomes the 5B desktop overlay) vs. replacing the Dashboard.
- **Next step:** Confirm the open decision, then build. Doesn't depend on Phase 4 and can start any time.

### 5B — Windows Desktop App

**Goal:** Package the web app for Windows (Tauri being evaluated); native OS notifications; background execution and startup behavior; more dependable reminders; preserve auth, sync and settings; safe updates. Later: persistent assistant UI, optional voice, system tray, configurable startup.

**Quick Panel overlay:** host the 5A panel in a frameless, transparent, always-on-top window toggled by a global shortcut (e.g. Ctrl+Space) from anywhere in Windows.

**Important:** browser notifications, Tauri desktop notifications and background-service reminders are different capabilities — implement and test each separately.

- **Status:** Not started
- **Next step:** Confirm the desktop architecture choice against the existing app's constraints.

## Phase 6 — External Integrations

- **Brightspace:** research the institution's APIs and auth; import assignments, due dates and courses; map to the internal model; handle duplicates and changes; clear errors; respect permissions, policy and API limits. Don't assume every Brightspace install exposes the same features.
- **Calendar:** research APIs/auth; show deadlines alongside events; optional sync; handle time zones, recurrence, duplicates, conflicts.
- **Other productivity services:** officially supported ones only, when they add real value.

- **Status:** Not started
- **Next step:** Feasibility research (access, permissions, maintenance) before committing.

## Phase 7 — Deployment, Reliability & Polish

**Goal:** Deployment strategy (Vercel/Cloudflare considered); production env vars and secret management; verify Supabase security rules and isolation; loading/empty/error states and network-failure recovery; responsive and accessible; performance; repeatable build/test/release; more tests; setup/deploy/troubleshooting docs; validate auth, sync, notifications and integrations in production-like conditions; consistent design across browser and desktop.

- **Status:** Not started (ongoing as features mature)
- **Next step:** Check what's already configured before adding infrastructure.

---

## Immediate priority

1. RLS policy audit (2A outstanding) — now also covers `push_subscriptions` / `push_reminders_sent`.
2. Phase 5A Quick Panel (in-app) — confirm overlay vs. Dashboard, then build. Independent of Phase 4.
3. Phase 4 (AI assistant) scoping.
4. Remaining 3C spot-checks (see 3C Outstanding).

## Session log

| Date | What was done | Verified? | Next |
|------|---------------|-----------|------|
| 2026-10-12 | 3B marked verified (user-confirmed). Built and deployed Phase 3C Web Push (incl. migration 003 grants fix): migration 002, `send-reminders` Edge Function, shared selection logic, service worker, subscription hook, Settings status row, key setup script, setup doc. VAPID keys generated locally. | Automated (37/37, lint, build) + manual: background push delivered with tab closed | RLS audit, then Phase 4 |
| 2026-10-12 | Planned Phase 5A Quick Panel from user's desktop-dashboard screenshots; split Phase 5 into 5A (in-app panel) and 5B (Windows app + overlay). | — | Decide overlay vs. Dashboard |
| 2026-10-10 (late) | Diagnosed 3B: toggle stored `false`. `loadSettings()` auto-enables when permission is granted and no preference is stored; status tag shows Disabled/Allowed based on the toggle; notification icon → `favicon.svg`; diagnostic logs removed. Manual test: notification fired. Note: three stale dev servers were running on ports 5173–5175 (each a separate origin with its own settings). | Manual (firing) + automated | Confirm click navigation + persistence; RLS audit; Phase 4 scoping |
| 2026-10-10 | Roadmap and CLAUDE.md created. Repo inspected: all commits present (`d5351be`, `aa24c1e`, `2081076`, `6f3a625`). Vitest pool changed to `vmThreads` for Windows stability. Diagnostic console.logs removed. 12/12 tests pass, lint clean, build clean. | Automated only | Manual Phase 3B browser test |
