import { DEFAULT_SETTINGS } from '../../lib/storage'
import './SettingsView.css'

const PRIORITY_OPTIONS = [
  { value: 'low',    label: 'Low'    },
  { value: 'medium', label: 'Medium' },
  { value: 'high',   label: 'High'   },
]

const REMINDER_OPTIONS = [
  { value: 'banner', label: 'Dashboard banner' },
  { value: 'none',   label: 'None'             },
]

function SettingsSection({ title, description, children }) {
  return (
    <div className="settings-section">
      <div className="settings-section-header">
        <h2 className="settings-section-title">{title}</h2>
        {description && <p className="settings-section-desc">{description}</p>}
      </div>
      <div className="settings-items">{children}</div>
    </div>
  )
}

function SettingsRow({ label, description, children }) {
  return (
    <div className="settings-row">
      <div className="settings-row-label">
        <span className="settings-label">{label}</span>
        {description && <span className="settings-desc">{description}</span>}
      </div>
      <div className="settings-row-control">{children}</div>
    </div>
  )
}

function SegmentedControl({ options, value, onChange, variant }) {
  return (
    <div className="seg-control">
      {options.map(o => (
        <button
          key={o.value}
          className={[
            'seg-option',
            value === o.value ? 'active' : '',
            variant ? `seg--${o.value}` : '',
          ].join(' ')}
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function Toggle({ value, onChange }) {
  return (
    <button
      className={`toggle-btn ${value ? 'active' : ''}`}
      onClick={() => onChange(!value)}
      aria-pressed={value}
      role="switch"
      aria-label={value ? 'On' : 'Off'}
    >
      <span className="toggle-knob" />
    </button>
  )
}

const PUSH_STATUS = {
  active:       { label: 'Active',         tone: 'ok'    },
  registering:  { label: 'Connecting…',    tone: 'off'   },
  inactive:     { label: 'Off',            tone: 'off'   },
  unconfigured: { label: 'Not configured', tone: 'warn'  },
  unsupported:  { label: 'Not supported',  tone: 'warn'  },
  error:        { label: 'Error',          tone: 'error' },
}

function BackgroundRemindersRow({ pushStatus }) {
  const { label, tone } = PUSH_STATUS[pushStatus] ?? PUSH_STATUS.inactive
  return (
    <>
      <SettingsRow
        label="Background Reminders"
        description="Get reminders even when JARVIS isn't open, as long as your browser is running."
      >
        <span className={`notif-status-tag notif-status-tag--${tone}`}>{label}</span>
      </SettingsRow>
      {pushStatus === 'error' && (
        <p className="notif-hint">
          JARVIS couldn't register this browser for background reminders. Reload to retry;
          if it keeps failing, check the browser console.
        </p>
      )}
      {pushStatus === 'unconfigured' && (
        <p className="notif-hint">
          Background reminders aren't set up for this deployment yet (missing VAPID public key).
        </p>
      )}
    </>
  )
}

function DesktopNotifSection({ settings, updateSettings, pushStatus }) {
  const supported = 'Notification' in window
  const permission = supported ? Notification.permission : 'unsupported'

  function requestPermission() {
    Notification.requestPermission().then(() => {
      // Force a re-render so the UI reflects the new permission state.
      // We trigger it by toggling enabled on grant; otherwise just re-render via a no-op patch.
      if (Notification.permission === 'granted') {
        updateSettings({ desktopNotificationsEnabled: true })
      } else {
        updateSettings({})
      }
    })
  }

  function sendTest() {
    if (!supported || Notification.permission !== 'granted') return
    try {
      const n = new Notification('JARVIS Test', {
        body: 'Desktop notifications are working.',
        icon: '/favicon.svg',
        tag: 'jarvis-test',
      })
      setTimeout(() => n.close(), 4000)
    } catch {
      // restricted context
    }
  }

  if (!supported) {
    return (
      <SettingsRow
        label="Desktop Notifications"
        description="Receive OS-level alerts for upcoming and overdue assignments."
      >
        <span className="notif-status-tag notif-status-tag--warn">Not supported</span>
      </SettingsRow>
    )
  }

  if (permission === 'denied') {
    return (
      <>
        <SettingsRow
          label="Desktop Notifications"
          description="Receive OS-level alerts for upcoming and overdue assignments."
        >
          <span className="notif-status-tag notif-status-tag--error">Blocked</span>
        </SettingsRow>
        <p className="notif-hint">
          Notifications are blocked. To unblock: click the lock icon in your browser address bar,
          set Notifications to Allow, then reload JARVIS.
        </p>
      </>
    )
  }

  if (permission === 'default') {
    return (
      <SettingsRow
        label="Desktop Notifications"
        description="Receive OS-level alerts for upcoming and overdue assignments."
      >
        <button className="btn-notif-request" onClick={requestPermission}>
          Request Permission
        </button>
      </SettingsRow>
    )
  }

  // permission === 'granted'
  return (
    <>
      <SettingsRow
        label="Desktop Notifications"
        description="Receive OS-level alerts for upcoming and overdue assignments."
      >
        <div className="notif-granted-controls">
          {settings.desktopNotificationsEnabled
            ? <span className="notif-status-tag notif-status-tag--ok">Allowed</span>
            : <span className="notif-status-tag notif-status-tag--off">Disabled</span>}
          <Toggle
            value={settings.desktopNotificationsEnabled}
            onChange={val => updateSettings({ desktopNotificationsEnabled: val })}
          />
          <button className="btn-notif-test" onClick={sendTest}>
            Test
          </button>
        </div>
      </SettingsRow>
      <p className="notif-hint">
        Note: Windows Focus Assist / Do Not Disturb may suppress notifications even when allowed.
      </p>
      <BackgroundRemindersRow pushStatus={pushStatus} />
    </>
  )
}

function SettingsView({ settings, updateSettings, pushStatus }) {
  function reset() {
    updateSettings({ ...DEFAULT_SETTINGS })
  }

  return (
    <div className="settings-view">
      <SettingsSection
        title="Assignments"
        description="Defaults applied when creating new assignments."
      >
        <SettingsRow
          label="Default Priority"
          description="The priority pre-selected when adding a new assignment."
        >
          <SegmentedControl
            options={PRIORITY_OPTIONS}
            value={settings.defaultPriority}
            onChange={val => updateSettings({ defaultPriority: val })}
            variant
          />
        </SettingsRow>
      </SettingsSection>

      <SettingsSection
        title="Dashboard"
        description="Controls what appears on the main dashboard."
      >
        <SettingsRow
          label="Show Completed Count"
          description="Display the count of completed assignments in the summary row."
        >
          <Toggle
            value={settings.showCompletedOnDashboard}
            onChange={val => updateSettings({ showCompletedOnDashboard: val })}
          />
        </SettingsRow>

        <SettingsRow
          label="Overdue Reminders"
          description="How overdue assignments are surfaced on the dashboard."
        >
          <SegmentedControl
            options={REMINDER_OPTIONS}
            value={settings.overdueReminder}
            onChange={val => updateSettings({ overdueReminder: val })}
          />
        </SettingsRow>
      </SettingsSection>

      <SettingsSection
        title="Notifications"
        description="Control how JARVIS alerts you about deadlines."
      >
        <DesktopNotifSection settings={settings} updateSettings={updateSettings} pushStatus={pushStatus} />
      </SettingsSection>

      <SettingsSection
        title="Data"
        description="Manage stored preferences."
      >
        <SettingsRow
          label="Reset to Defaults"
          description="Restore all settings to their original values. Assignment data is not affected."
        >
          <button className="btn-settings-reset" onClick={reset}>
            Reset Settings
          </button>
        </SettingsRow>
      </SettingsSection>

      <p className="settings-footer">
        Settings are saved automatically to your account and synced across devices.
        Assignment data is stored separately.
      </p>
    </div>
  )
}

export default SettingsView
