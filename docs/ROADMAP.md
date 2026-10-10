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

- **Status:** Implemented — automated checks passing, browser test outstanding
- **Implemented:**
  - `src/lib/useDesktopNotifications.js` — seed-without-fire, hydration guard, per-user state isolation, dedup via sentRef, overdue-before-upcoming scan.
  - `src/App.jsx` — `assignmentsLoaded` flag, `notifTick` 5-minute interval, `reminders` useMemo, hook call before early returns.
  - `src/components/settings/SettingsView.jsx` — 4 permission states (unsupported/denied/default/granted), toggle, test button.
  - `src/lib/__tests__/useDesktopNotifications.test.js` — 12 tests covering all key invariants.
- **Verified (automated):** 12/12 tests pass, lint clean, build clean (2026-10-10). Diagnostic logs removed.
- **Verified (manual):** NOT YET — needs real Windows browser test.
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

- **Status:** Not started
- **Note:** Browser notifications alone cannot guarantee delivery with the browser closed. May need the desktop app, a background process, push infrastructure, or similar.
- **Next step:** Research once 3B is manually verified.

## Phase 4 — AI Assistant

**Goal:** Natural-language interface grounded in the user's real data: answer workload questions, summarize, prioritize, suggest study plans, break down large assignments. Later: conversational create/edit, multi-step planning, cross-service context, possibly voice.

**Engineering requirements:** controlled, explicit interfaces to authorized data · auth and data isolation enforced · no API keys in frontend · confirmation for consequential actions · distinguish verified data from AI suggestions · **not** a generic chatbot disconnected from the app.

- **Status:** Not started
- **Next step:** Begin once Phases 2–3B are manually verified.

## Phase 5 — Desktop Experience

**Goal:** Package the web app for Windows (Tauri being evaluated); native OS notifications; background execution and startup behavior; more dependable reminders; preserve auth, sync and settings; safe updates. Later: persistent assistant UI, quick access, optional voice, system tray, configurable startup.

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

1. **Manual Phase 3B browser test** — the only remaining gate before Phase 3B is verified. Follow the steps in the "How to manually test 3B" section above.
2. Once 3B is verified, decide: clean up `[JARVIS notif]` diagnostics fully or move to Phase 3C / Phase 4.
3. RLS policy audit (2A outstanding) before adding any new data types.

## Session log

| Date | What was done | Verified? | Next |
|------|---------------|-----------|------|
| 2026-10-10 | Roadmap and CLAUDE.md created. Repo inspected: all commits present (`d5351be`, `aa24c1e`, `2081076`, `6f3a625`). Vitest pool changed to `vmThreads` for Windows stability. Diagnostic console.logs removed. 12/12 tests pass, lint clean, build clean. | Automated only | Manual Phase 3B browser test |
