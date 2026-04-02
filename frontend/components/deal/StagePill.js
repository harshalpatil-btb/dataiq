// dealiq/frontend/components/deal/StagePill.js
export default function StagePill({ stage, status }) {
  const display = status === 'stalled' ? 'stalled' : status === 'won' ? 'won' : status === 'lost' ? 'lost' : stage
  const styles = {
    discovery:   { bg: 'rgba(8,145,178,0.1)',    color: '#0891b2' },
    demo:        { bg: 'rgba(61,90,254,0.08)',   color: '#3d5afe' },
    proposal:    { bg: 'rgba(217,119,6,0.1)',    color: '#d97706' },
    negotiation: { bg: 'rgba(8,145,178,0.1)',    color: '#0891b2' },
    closing:     { bg: 'rgba(22,163,74,0.1)',    color: '#16a34a' },
    stalled:     { bg: 'rgba(220,38,38,0.08)',   color: '#dc2626' },
    won:         { bg: 'rgba(22,163,74,0.1)',    color: '#16a34a' },
    lost:        { bg: 'rgba(220,38,38,0.08)',   color: '#dc2626' },
  }
  const s = styles[display] || styles.discovery
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold capitalize"
      style={{ background: s.bg, color: s.color }}>
      {display === 'stalled' && '⚠ '}
      {display}
    </span>
  )
}
