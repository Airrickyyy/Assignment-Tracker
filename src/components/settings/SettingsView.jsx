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

function SettingsView({ settings, updateSettings }) {
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
        Settings are saved automatically to local storage.
        Assignment data persists across refreshes independently.
      </p>
    </div>
  )
}

export default SettingsView
