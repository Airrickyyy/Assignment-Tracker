import './SummaryCard.css'

function SummaryCard({ label, value, subtext, variant = 'default' }) {
  return (
    <div className={`summary-card summary-card--${variant}`}>
      <span className="summary-value">{value}</span>
      <span className="summary-label">{label}</span>
      {subtext && <span className="summary-subtext">{subtext}</span>}
    </div>
  )
}

export default SummaryCard
