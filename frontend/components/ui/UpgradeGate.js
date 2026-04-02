// dealiq/frontend/components/ui/UpgradeGate.js
'use client'
import Link from 'next/link'
import { useAuthStore } from '../../lib/store'

export default function UpgradeGate({ feature, requiredPlan = 'growth', children }) {
  const canAccess = useAuthStore(s => s.canAccess)

  if (canAccess(feature)) return children

  const planLabel = requiredPlan.charAt(0).toUpperCase() + requiredPlan.slice(1)

  return (
    <div className="relative">
      <div className="pointer-events-none select-none opacity-30 blur-[2px]">
        {children}
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-2xl border border-[rgba(17,17,25,0.1)] p-6 text-center max-w-xs mx-4">
          <div className="text-3xl mb-3">🔒</div>
          <h3 className="font-extrabold text-sm mb-1">
            {planLabel} plan required
          </h3>
          <p className="text-xs text-[#8a8899] mb-4 leading-relaxed">
            Upgrade to unlock {feature.replace(/_/g, ' ')} and start closing more deals.
          </p>
          <Link
            href="/pricing"
            className="inline-block px-5 py-2.5 rounded-[9px] bg-[#3d5afe] text-white text-xs font-bold hover:bg-[#536dfe] transition-colors"
          >
            Upgrade to {planLabel} →
          </Link>
        </div>
      </div>
    </div>
  )
}
