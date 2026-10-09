import './MigrationBanner.css'

function MigrationBanner({ count, inProgress, error, onImport, onDismiss }) {
  if (error) {
    return (
      <div className="migration-banner" role="alert">
        <span className="migration-banner-error">
          Import failed: {error}
        </span>
        <div className="migration-banner-actions">
          <button className="btn-migrate" onClick={onImport} disabled={inProgress}>
            Retry
          </button>
          <button className="btn-migrate-dismiss" onClick={onDismiss}>
            Skip
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="migration-banner" role="status">
      <span className="migration-banner-text">
        <strong>{count} local assignment{count !== 1 ? 's' : ''}</strong> found — import to cloud to sync across devices?
      </span>
      <div className="migration-banner-actions">
        <button className="btn-migrate" onClick={onImport} disabled={inProgress}>
          {inProgress ? 'Importing…' : 'Import'}
        </button>
        <button className="btn-migrate-dismiss" onClick={onDismiss} disabled={inProgress}>
          Dismiss
        </button>
      </div>
    </div>
  )
}

export default MigrationBanner
