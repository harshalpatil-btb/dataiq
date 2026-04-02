// dealiq/frontend/components/deal/HealthBar.js
export default function HealthBar({ score = 0, showLabel = false }) {
  const color = score >= 75 ? '#16a34a' : score >= 50 ? '#d97706' : '#dc2626'
  return (
    <div className="flex items-center gap-2">
      <div className="w-12 h-1.5 rounded-full bg-[rgba(17,17,25,0.08)] overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${score}%`, background: color }} />
      </div>
      <span className="text-xs font-black font-mono" style={{ color }}>{score}</span>
      {showLabel && <span className="text-[10px] text-[#8a8899]">{score >= 75 ? 'Strong' : score >= 50 ? 'Fair' : 'At risk'}</span>}
    </div>
  )
}
