'use client'
// dealiq/frontend/app/dashboard/layout.js
// Wraps all /dashboard/* pages with sidebar + topbar

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { useAuthStore, useUIStore } from '../../lib/store'
import { useSubscription } from '../../hooks'
import Toast from '../../components/ui/Toast'

const NAV = [
  { href: '/dashboard',              icon: '📊', label: 'Overview' },
  { href: '/dashboard/deals',        icon: '🏠', label: 'Deal Rooms',   badge: 'deals' },
  { href: '/dashboard/team',         icon: '👥', label: 'Team' },
  { href: '/dashboard/content',      icon: '📁', label: 'Content' },
  { href: '/dashboard/alerts',       icon: '🔔', label: 'Alerts',       badge: 'alerts', badgeColor: 'red' },
  { href: '/dashboard/drafts',       icon: '🤖', label: 'AI Drafts',    badge: 'drafts', badgeColor: 'amber' },
  { href: '/dashboard/automation',   icon: '⚡', label: 'Automation' },
]

const BOTTOM_NAV = [
  { href: '/dashboard/settings',     icon: '⚙️', label: 'Settings' },
  { href: '/dashboard/settings/billing', icon: '💳', label: 'Billing' },
]

export default function DashboardLayout({ children }) {
  const router   = useRouter()
  const pathname = usePathname()
  const { user, org, isAuthenticated, logout, isOnTrial, trialDaysLeft } = useAuthStore()
  const { sidebarOpen } = useUIStore()
  const { subscription } = useSubscription()

  // Redirect if not authed
  useEffect(() => {
    if (!isAuthenticated) router.replace('/auth/login')
  }, [isAuthenticated])

  if (!isAuthenticated || !user) return null

  const trial = isOnTrial()
  const daysLeft = trialDaysLeft()

  return (
    <div className="flex h-screen overflow-hidden bg-[#f6f5f2]">

      {/* ── SIDEBAR ── */}
      <aside className={`${sidebarOpen ? 'w-[220px]' : 'w-[56px]'} flex-shrink-0 bg-white border-r border-[rgba(17,17,25,0.08)] flex flex-col transition-all duration-200 overflow-hidden`}>

        {/* Logo */}
        <div className="h-[56px] flex items-center px-4 border-b border-[rgba(17,17,25,0.08)] gap-2.5 shrink-0">
          <div className="w-7 h-7 rounded-[7px] bg-[#3d5afe] flex items-center justify-center text-white font-black text-xs shrink-0">D</div>
          {sidebarOpen && <span className="font-extrabold text-[15px] tracking-tight whitespace-nowrap">DealIQ</span>}
        </div>

        {/* Trial banner */}
        {trial && sidebarOpen && (
          <div className="mx-3 mt-3 bg-[rgba(217,119,6,0.08)] border border-[rgba(217,119,6,0.2)] rounded-lg px-3 py-2">
            <div className="text-[10px] font-bold text-[#d97706]">⏰ Trial — {daysLeft} days left</div>
            <Link href="/pricing" className="text-[10px] text-[#3d5afe] font-bold">Upgrade now →</Link>
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-2">
          {NAV.map(item => {
            const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
            return (
              <Link
                key={item.href} href={item.href}
                className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg mb-0.5 text-sm font-semibold transition-all
                  ${active
                    ? 'bg-[rgba(61,90,254,0.08)] text-[#3d5afe]'
                    : 'text-[#8a8899] hover:bg-[#f6f5f2] hover:text-[#2e2e3a]'
                  }`}
              >
                <span className="text-base w-5 text-center shrink-0">{item.icon}</span>
                {sidebarOpen && <span className="whitespace-nowrap">{item.label}</span>}
              </Link>
            )
          })}
        </nav>

        {/* Bottom */}
        <div className="border-t border-[rgba(17,17,25,0.08)] py-3 px-2">
          {BOTTOM_NAV.map(item => (
            <Link
              key={item.href} href={item.href}
              className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-semibold text-[#8a8899] hover:bg-[#f6f5f2] hover:text-[#2e2e3a] transition-all"
            >
              <span className="text-base w-5 text-center shrink-0">{item.icon}</span>
              {sidebarOpen && <span className="whitespace-nowrap">{item.label}</span>}
            </Link>
          ))}

          {/* User */}
          {sidebarOpen && (
            <div className="mx-1 mt-2 p-2.5 rounded-lg bg-[#f6f5f2] border border-[rgba(17,17,25,0.08)] flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-[10px] font-black shrink-0">
                {user.full_name?.slice(0,2).toUpperCase() || 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold truncate">{user.full_name}</div>
                <div className="text-[10px] text-[#8a8899] truncate">{user.role}</div>
              </div>
              <button onClick={logout} className="text-[#8a8899] hover:text-[#dc2626] transition-colors text-xs">↩</button>
            </div>
          )}
        </div>
      </aside>

      {/* ── MAIN ── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Topbar */}
        <header className="h-[56px] shrink-0 flex items-center justify-between px-6 bg-white border-b border-[rgba(17,17,25,0.08)]">
          <div className="flex items-center gap-3">
            <button
              onClick={() => useUIStore.getState().toggleSidebar()}
              className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[#f6f5f2] transition-colors text-[#8a8899]"
            >
              ☰
            </button>
            <div className="text-sm text-[#8a8899]">
              <span className="font-semibold text-[#111119]">{org?.name}</span>
              {' '}<span className="text-[#b5b3c1]">·</span>{' '}
              <span className="capitalize font-medium">{org?.plan} plan</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {trial && (
              <Link href="/pricing" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[rgba(217,119,6,0.08)] border border-[rgba(217,119,6,0.2)] text-xs font-bold text-[#d97706]">
                ⏰ {daysLeft}d left · Upgrade
              </Link>
            )}
            <Link href="/dashboard/deals/new" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#3d5afe] text-white text-xs font-bold hover:bg-[#536dfe] transition-colors">
              + New Deal
            </Link>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <div className="page-enter">
            {children}
          </div>
        </main>
      </div>

      {/* Toast notifications */}
      <Toast />
    </div>
  )
}
