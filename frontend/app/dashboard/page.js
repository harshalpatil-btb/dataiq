'use client'
// dealiq/frontend/app/dashboard/page.js

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useDeals, useDealStats, useEngagementFeed, useRealtimeEngagement, useToast } from '../../hooks'
import { useAuthStore } from '../../lib/store'
import { deals as dealsApi } from '../../lib/api'
import HealthBar from '../../components/deal/HealthBar'
import StagePill from '../../components/deal/StagePill'
import { formatDistanceToNow } from 'date-fns'

export default function DashboardPage() {
  const { user, org } = useAuthStore()
  const firstName = user?.full_name?.split(' ')[0] || 'there'
  const toast = useToast()

  const { deals, isLoading: dealsLoading } = useDeals({ limit: 8 })
  const { stats, isLoading: statsLoading } = useDealStats()
  const [liveEvents, setLiveEvents] = useState([])

  // Add real-time events to the feed
  const onLiveEvent = useCallback((event) => {
    setLiveEvents(prev => [event, ...prev].slice(0, 8))
  }, [])

  // Subscribe to all engagement events for org
  // (in production: subscribe to org-level channel)
  const { events: feedEvents } = useEngagementFeed(null)

  // Greeting based on time
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  const kpis = [
    {
      label: 'Pipeline Value',
      value: stats?.pipeline_value
        ? '₹' + (stats.pipeline_value / 100000).toFixed(1) + 'L'
        : '—',
      icon: '💰',
      color: '#3d5afe',
      change: '+18%',
      up: true,
    },
    {
      label: 'Active Deals',
      value: stats?.status_counts?.active || '—',
      icon: '⚡',
      color: '#3d5afe',
      change: '3 new this week',
      up: true,
    },
    {
      label: 'Stalled Deals',
      value: stats?.status_counts?.stalled || 0,
      icon: '⚠️',
      color: '#dc2626',
      change: 'Need action',
      up: false,
    },
    {
      label: 'Win Rate',
      value: '64%',
      icon: '🏆',
      color: '#16a34a',
      change: '+8pp this quarter',
      up: true,
    },
    {
      label: 'Won This Month',
      value: '₹38L',
      icon: '🎯',
      color: '#16a34a',
      change: '3 deals closed',
      up: true,
    },
  ]

  if (dealsLoading) {
    return (
      <div className="p-8">
        <div className="grid grid-cols-5 gap-3 mb-6">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="skeleton h-24 rounded-2xl" />
          ))}
        </div>
        <div className="skeleton h-64 rounded-2xl" />
      </div>
    )
  }

  return (
    <div className="p-8">

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">{greeting}, {firstName} 👋</h1>
          <p className="text-[#8a8899] text-sm mt-1">
            {org?.name} · {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <Link
          href="/dashboard/deals/new"
          className="flex items-center gap-2 px-4 py-2 rounded-[9px] bg-[#3d5afe] text-white text-sm font-bold hover:bg-[#536dfe] hover:-translate-y-0.5 transition-all shadow-[0_2px_10px_rgba(61,90,254,0.25)]"
        >
          + New Deal Room
        </Link>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-5 gap-3 mb-6">
        {kpis.map(k => (
          <div key={k.label} className="bg-white rounded-2xl p-5 border border-[rgba(17,17,25,0.08)] shadow-[0_1px_3px_rgba(0,0,0,0.06)] hover:-translate-y-0.5 transition-transform cursor-default">
            <div className="text-xs font-bold text-[#8a8899] uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <span>{k.icon}</span>{k.label}
            </div>
            <div className="text-2xl font-black tracking-tighter mb-1" style={{ color: k.color }}>{k.value}</div>
            <div className={`text-xs font-semibold ${k.up ? 'text-[#16a34a]' : 'text-[#dc2626]'}`}>
              {k.up ? '↑' : '↓'} {k.change}
            </div>
          </div>
        ))}
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-3 gap-5">

        {/* Deal table — spans 2 cols */}
        <div className="col-span-2 bg-white rounded-2xl border border-[rgba(17,17,25,0.08)] shadow-[0_1px_3px_rgba(0,0,0,0.06)] overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(17,17,25,0.08)]">
            <div className="font-extrabold text-sm">🔥 Deals needing attention</div>
            <Link href="/dashboard/deals" className="text-xs text-[#3d5afe] font-bold">View all →</Link>
          </div>

          {/* Table header */}
          <div className="grid grid-cols-[2fr_1fr_1fr_100px_80px] px-5 py-2.5 bg-[#f6f5f2] border-b border-[rgba(17,17,25,0.08)] text-[10px] font-black uppercase tracking-wider text-[#b5b3c1]">
            <span>Deal / Company</span>
            <span>Stage</span>
            <span>Value</span>
            <span>Health</span>
            <span>Action</span>
          </div>

          {deals.filter(d => d.status !== 'won' && d.status !== 'lost').slice(0, 6).map(deal => (
            <Link
              key={deal.id}
              href={`/dashboard/deals/${deal.id}`}
              className="grid grid-cols-[2fr_1fr_1fr_100px_80px] px-5 py-3.5 border-b border-[rgba(17,17,25,0.06)] hover:bg-[#f6f5f2] transition-colors items-center"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-black shrink-0"
                  style={{ background: `hsl(${deal.company_name.charCodeAt(0) * 7 % 360}, 65%, 55%)` }}>
                  {deal.company_name.slice(0,1).toUpperCase()}
                </div>
                <div>
                  <div className="text-sm font-bold truncate max-w-[160px]">{deal.company_name}</div>
                  <div className="text-[10px] text-[#8a8899] font-mono">{deal.stakeholders?.length || 0} stakeholders</div>
                </div>
              </div>
              <div><StagePill stage={deal.stage} status={deal.status} /></div>
              <div className="text-sm font-bold">
                {deal.value ? '₹' + (deal.value / 100000).toFixed(1) + 'L' : '—'}
              </div>
              <div><HealthBar score={deal.health_score} /></div>
              <div>
                {deal.status === 'stalled' ? (
                  <button
                    onClick={e => { e.preventDefault(); toast.success('🤖 AI re-engagement draft ready!') }}
                    className="px-2.5 py-1 rounded-lg bg-[rgba(220,38,38,0.08)] text-[#dc2626] text-xs font-bold border border-[rgba(220,38,38,0.15)]"
                  >
                    Revive
                  </button>
                ) : deal.health_score > 80 ? (
                  <button
                    onClick={e => { e.preventDefault(); toast.success('📝 Contract sent!') }}
                    className="px-2.5 py-1 rounded-lg bg-[rgba(22,163,74,0.1)] text-[#16a34a] text-xs font-bold border border-[rgba(22,163,74,0.2)]"
                  >
                    Close
                  </button>
                ) : (
                  <button
                    onClick={e => e.preventDefault()}
                    className="px-2.5 py-1 rounded-lg bg-[rgba(61,90,254,0.07)] text-[#3d5afe] text-xs font-bold border border-[rgba(61,90,254,0.15)]"
                  >
                    Open
                  </button>
                )}
              </div>
            </Link>
          ))}
        </div>

        {/* Live activity feed */}
        <div className="bg-white rounded-2xl border border-[rgba(17,17,25,0.08)] shadow-[0_1px_3px_rgba(0,0,0,0.06)] overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(17,17,25,0.08)]">
            <div className="font-extrabold text-sm">⚡ Live activity</div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#16a34a]">
              <div className="w-1.5 h-1.5 rounded-full bg-[#16a34a] animate-pulse" />
              Live
            </div>
          </div>
          <div className="p-4 space-y-3 overflow-y-auto max-h-[380px]">
            {[
              { icon: '💰', text: 'Priya viewed pricing · Acme', time: '2m ago', color: '#d97706' },
              { icon: '👤', text: 'New stakeholder · TechWave', time: '1hr ago', color: '#3d5afe' },
              { icon: '✅', text: 'MAP task done · SkyPath', time: '3hr ago', color: '#16a34a' },
              { icon: '⚠️', text: 'NovaMart gone dark (4d)', time: 'Today', color: '#dc2626' },
              { icon: '💬', text: 'Question posted · Acme', time: 'Yesterday', color: '#3d5afe' },
            ].map((ev, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: ev.color }} />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-[#2e2e3a] leading-snug">{ev.text}</div>
                  <div className="text-[10px] text-[#b5b3c1] font-mono mt-0.5">{ev.time}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
