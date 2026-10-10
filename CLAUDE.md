# JARVIS — Project Context for Claude Code

JARVIS is a personal AI assistant and productivity app (inspired by Tony Stark's JARVIS) for managing university assignments, deadlines, schedule and reminders, eventually with AI, desktop/mobile apps and external integrations.

Prioritize reliability, good architecture, polished UI/UX and genuinely useful functionality over adding features. The full phase-by-phase plan and status tracker lives in `docs/ROADMAP.md` — read it before starting new work and update it when you finish.

## Ground rules

- **Continue from the existing repo. Do not start from scratch** or migrate frameworks without inspecting the code and identifying a concrete reason.
- Inspect the actual repository before trusting anything in this file — paths, commits and implementation may have changed.
- Code being present does not mean a feature is complete. A feature is complete only when its acceptance criteria are verified.
- Automated tests passing does **not** prove Windows/browser notifications actually appear. Manually verify OS, browser and integration behavior.
- Don't build advanced features on top of broken auth or unreliable data sync.
- Never log auth tokens, secrets or complete user identifiers. Keep API keys out of frontend code.

## Tech stack

- **Frontend:** React + JavaScript (TypeScript a possible future improvement), Vite
- **Backend/DB:** Supabase + PostgreSQL, Supabase Auth
- **Desktop (planned):** Tauri · **Mobile (planned):** Expo
- **Hosting (considered):** Cloudflare and/or Vercel
- **Testing:** Vitest, React Testing Library, jsdom (Vitest uses the `vmThreads` worker pool)

## Key files

- `src/App.jsx` — main component: app state, settings, auth/session behavior, assignment loading
- `src/lib/useDesktopNotifications.js` — notification hook: permission checks, initial seeding, dedup, triggers
- `src/lib/notifications.js` — `deriveReminders`, classifies upcoming and overdue assignments
- `src/lib/__tests__/useDesktopNotifications.test.js` — hook unit + integration tests
- `vite.config.js` — Vite and Vitest config

## History (verify — hashes are from a previous session)

- Phase 1 core planner: reported done.
- Supabase + auth: built in stages. An `access_denied` / `otp_expired` auth redirect bug was reportedly fixed.
- Cloud assignments, localStorage migration and persistent settings: built in stages; migration edge cases may not all be resolved.
- Phase 3A in-app reminders: commit `d5351be`.
- Phase 3B browser/desktop notifications: commit `aa24c1e` — permission handling, settings toggle, test-notification button, upcoming/overdue notifications, dedup, 5-minute check interval, click navigates to assignments section.
- Notification bug fixes: commits `2081076`, `6f3a625` — 12/12 tests passing, lint clean, build succeeds, diagnostic logs removed.

## Current main issue: notifications

**Unresolved:** verify in a real browser on Windows that creating a new assignment due tomorrow fires a notification.

Intended flow:
1. User signs in.
2. JARVIS loads the user's assignments.
3. Existing assignments are seeded (registered) without a notification flood.
4. User creates a new assignment due tomorrow.
5. `deriveReminders` classifies it as upcoming.
6. `useDesktopNotifications` recognizes it as a new reminder.
7. A notification appears, titled like `Due soon: New Task`.
8. Clicking it navigates to the assignments section and closes the notification.

### Bug 1 — notification preference reset (fixed)

The sign-out/session-init branch in `src/App.jsx` fires on every initial mount because `session` starts as `undefined`. It previously called `setSettings({ ...DEFAULT_SETTINGS })`, which set `desktopNotificationsEnabled: false` and persisted it to localStorage on every page load.

Fix in `6f3a625` — preserve the browser-level preference while resetting the rest:

```js
setSettings(prev => ({
  ...DEFAULT_SETTINGS,
  desktopNotificationsEnabled: prev.desktopNotificationsEnabled
}))
```

**Verify the current implementation before changing it again.** Confirm settings load and persist in the right order and that session init doesn't overwrite the saved preference across refresh and sign-out/sign-in.

### Bug 2 — test coverage (fixed)

Added tests covering:
- due tomorrow → upcoming; due yesterday → overdue
- completed assignments excluded
- assignments more than 48h away excluded from the reminder window
- existing assignments seeded without notifications
- enabling notifications after initial load without flooding
- a newly added assignment triggers a notification
- dedup and user-session changes

### Hook behavior

Before sending, the hook requires: a valid session, notifications enabled, Notification API supported, permission `granted`, and initial assignment load complete.

- Existing assignments are seeded into a tracking set; only new qualifying reminders fire afterward.
- Notification IDs (assignment + reminder type) prevent duplicates; in-memory state resets when the user changes.
- Check overdue before upcoming, so assignments crossing midnight are handled correctly.
- `onclick` navigates to assignments and closes the notification.

## Workflow for any new feature

1. Inspect repo, branch, working tree, recent commits.
2. Read the relevant implementation and tests.
3. Compare against the phase's acceptance criteria in `docs/ROADMAP.md`.
4. Pick the smallest reliable next step.
5. Implement without unnecessarily rewriting working code.
6. Run tests, lint, build.
7. Manually verify what automated tests can't.
8. Update `docs/ROADMAP.md`.
