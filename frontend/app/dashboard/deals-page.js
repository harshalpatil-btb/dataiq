'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useDeals } from '../../../hooks'
import HealthBar from '../../../components/deal/HealthBar'
import StagePill from '../../../components/deal/StagePill'
import { deals as dealsApi } from '../../../lib/api'
import { useUIStore } from '../../../lib/store'

export default function DealsPage() {
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const showToast = useUIStore(s => s.showToast)

  const params = {}
  if (filter !== 'all') params.status = filter
  if (search) params.search = search

  const { deals, total, isLoading, mutate } = useDeals(params)

  const filters = [
    { id: 'all',     label: 'All deals' },
    { id: 'active',  label: 'Active' },
    { id: 'stalled', label: '⚠ Stalled' },
    { id: 'won',     label: 'Won' },
    { id: 'lost',    label: 'Lost' },
  ]

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Deal Rooms</h1>
          <p className="text-[#8a8899] text-sm mt-1">{total} deals total</p>
        </div>
        <Link href="/dashboard/deals/new"
          className="px-4 py-2 rounded-[9px] bg-[#3d5afe] text-white text-sm font-bold hover:bg-[#536dfe] transition-colors">
          + New Deal Room
        </Link>
      </div>

      {/* Filters + Search */}
      <div className="flex items-center justify-between mb-5 gap-4 flex-wrap">
        <div className="flex gap-2">
          {filters.map(f => (
            <button key={f.id} onClick={() => setFilter(f.id)}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                filter === f.id ? 'bg-[#3d5afe] text-white' : 'bg-white border border-[rgba(17,17,25,0.12)] text-[#8a8899] hover:text-[#111119]'
              }`}>
              {f.label}
            </button>
          ))}
        </div>
        <input
          type="text" placeholder="Search companies…" value={search}
          onChange={e => setSearch(e.target.value)}
          className="px-3 py-2 rounded-lg border border-[rgba(17,17,25,0.12)] bg-white text-sm outline-none focus:border-[#3d5afe] w-52"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-[rgba(17,17,25,0.08)] shadow-sm overflow-hidden">
        <div className="grid grid-cols-[2.5fr_1fr_1fr_1fr_90px_100px] px-5 py-3 bg-[#f6f5f2] border-b border-[rgba(17,17,25,0.08)] text-[10px] font-black uppercase tracking-widest text-[#b5b3c1]">
          <span>Deal / Company</span><span>Stage</span><span>Value</span>
          <span>Health</span><span>Last Active</span><span>Action</span>
        </div>

        {isLoading ? (
          [...Array(5)].map((_, i) => (
            <div key={i} className="px-5 py-4 border-b border-[rgba(17,17,25,0.06)]">
              <div className="skeleton h-5 w-48 rounded mb-1" /><div className="skeleton h-3 w-32 rounded" />
            </div>
          ))
        ) : deals.length === 0 ? (
          <div className="py-16 text-center">
            <div className="text-3xl mb-3">🏠</div>
            <p className="font-bold text-sm mb-1">No deals yet</p>
            <p className="text-[#8a8899] text-xs mb-4">Create your first deal room to get started</p>
            <Link href="/dashboard/deals/new"
              className="px-4 py-2 rounded-lg bg-[#3d5afe] text-white text-sm font-bold inline-block">
              + Create Deal Room
            </Link>
          </div>
        ) : (
          deals.map(deal => (
            <Link key={deal.id} href={`/dashboard/deals/${deal.id}`}
              className="grid grid-cols-[2.5fr_1fr_1fr_1fr_90px_100px] px-5 py-3.5 border-b border-[rgba(17,17,25,0.06)] hover:bg-[#f6f5f2] transition-colors items-center">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-black shrink-0"
                  style={{ background: `hsl(${(deal.company_name?.charCodeAt(0) || 65) * 7 % 360}, 65%, 55%)` }}>
                  {deal.company_name?.slice(0,1).toUpperCase()}
                </div>
                <div>
                  <div className="text-sm font-bold">{deal.company_name}</div>
                  <div className="text-[10px] text-[#8a8899] font-mono">{deal.name}</div>
                </div>
              </div>
              <div><StagePill stage={deal.stage} status={deal.status} /></div>
              <div className="text-sm font-bold">{deal.value ? '₹' + (deal.value/100000).toFixed(1)+'L' : '—'}</div>
              <div><HealthBar score={deal.health_score || 0} /></div>
              <div className="text-xs text-[#8a8899]">
                {deal.updated_at ? new Date(deal.updated_at).toLocaleDateString('en-IN') : '—'}
              </div>
              <div>
                <span className="px-2.5 py-1 rounded-lg bg-[rgba(61,90,254,0.07)] text-[#3d5afe] text-xs font-bold border border-[rgba(61,90,254,0.15)]">
                  Open →
                </span>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  )
}
