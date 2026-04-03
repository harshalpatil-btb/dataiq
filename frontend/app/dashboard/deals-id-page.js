'use client'
import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useDeal, useEngagementFeed, useToast } from '../../../../hooks'
import { deals as dealsApi } from '../../../../lib/api'
import HealthBar from '../../../../components/deal/HealthBar'
import StagePill from '../../../../components/deal/StagePill'
import { formatDistanceToNow } from 'date-fns'

export default function DealDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const toast = useToast()
  const { deal, isLoading, mutate } = useDeal(id)
  const { events } = useEngagementFeed(id)
  const [activeTab, setActiveTab] = useState('overview')
  const [updating, setUpdating] = useState(false)

  async function updateStage(stage) {
    setUpdating(true)
    try {
      await dealsApi.update(id, { stage })
      mutate()
      toast.success(`Stage updated to ${stage}`)
    } catch { toast.error('Could not update stage') }
    finally { setUpdating(false) }
  }

  if (isLoading) return (
    <div className="p-8 space-y-4">
      {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-16 rounded-2xl" />)}
    </div>
  )
  if (!deal) return (
    <div className="p-8 text-center"><p className="text-[#8a8899]">Deal not found.</p>
      <Link href="/dashboard/deals" className="text-[#3d5afe] text-sm font-bold mt-2 inline-block">← Back to deals</Link>
    </div>
  )

  const roomUrl = `${process.env.NEXT_PUBLIC_APP_URL || window.location.origin}/room/${deal.room_slug}`

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/dashboard/deals" className="text-[#8a8899] text-xs font-semibold hover:text-[#3d5afe]">← Deals</Link>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight">{deal.company_name}</h1>
          <div className="flex items-center gap-3 mt-2">
            <StagePill stage={deal.stage} status={deal.status} />
            <HealthBar score={deal.health_score || 0} showLabel />
            {deal.value && <span className="text-sm font-bold text-[#2e2e3a]">₹{(deal.value/100000).toFixed(1)}L</span>}
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { navigator.clipboard.writeText(roomUrl); toast.success('🔗 Room link copied!') }}
            className="px-4 py-2 rounded-[9px] border border-[rgba(17,17,25,0.12)] bg-white text-sm font-bold hover:bg-[#f6f5f2] transition-colors">
            📋 Copy room link
          </button>
          <a href={roomUrl} target="_blank" rel="noopener noreferrer"
            className="px-4 py-2 rounded-[9px] bg-[#3d5afe] text-white text-sm font-bold hover:bg-[#536dfe] transition-colors">
            🏠 Open room →
          </a>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[rgba(17,17,25,0.04)] rounded-lg p-1 mb-6 w-fit">
        {['overview','map','activity','stakeholders'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-1.5 rounded-md text-sm font-bold capitalize transition-all ${
              activeTab === tab ? 'bg-white shadow-sm text-[#111119]' : 'text-[#8a8899] hover:text-[#2e2e3a]'
            }`}>{tab}</button>
        ))}
      </div>

      <div className="grid grid-cols-[1fr_280px] gap-5">
        <div>
          {/* OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-4">
              <div className="bg-white rounded-2xl border border-[rgba(17,17,25,0.08)] p-5">
                <h3 className="font-extrabold text-sm mb-4">Deal details</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  {[
                    ['Company', deal.company_name],
                    ['Deal name', deal.name],
                    ['Stage', deal.stage],
                    ['Value', deal.value ? '₹' + (deal.value/100000).toFixed(1) + 'L' : '—'],
                    ['Close date', deal.close_date || '—'],
                    ['Owner', deal.owner?.full_name || '—'],
                    ['Room slug', deal.room_slug],
                    ['Health score', deal.health_score + '/100'],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-[#b5b3c1] mb-0.5">{k}</div>
                      <div className="font-semibold text-[#2e2e3a]">{v}</div>
                    </div>
                  ))}
                </div>
              </div>
              {/* Stage updater */}
              <div className="bg-white rounded-2xl border border-[rgba(17,17,25,0.08)] p-5">
                <h3 className="font-extrabold text-sm mb-3">Move stage</h3>
                <div className="flex gap-2 flex-wrap">
                  {['discovery','demo','proposal','negotiation','closing','won','lost'].map(s => (
                    <button key={s} onClick={() => updateStage(s)} disabled={updating || deal.stage === s}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-colors ${
                        deal.stage === s
                          ? 'bg-[#3d5afe] text-white'
                          : 'bg-[#f6f5f2] text-[#8a8899] hover:bg-[#eeecea] border border-[rgba(17,17,25,0.08)]'
                      }`}>{s}</button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* MAP */}
          {activeTab === 'map' && (
            <div className="bg-white rounded-2xl border border-[rgba(17,17,25,0.08)] overflow-hidden">
              <div className="px-5 py-4 border-b border-[rgba(17,17,25,0.08)]">
                <h3 className="font-extrabold text-sm">Mutual Action Plan</h3>
              </div>
              {(deal.map_tasks || []).length === 0 ? (
                <div className="py-10 text-center text-[#8a8899] text-sm">No tasks yet.</div>
              ) : (
                (deal.map_tasks || []).map(task => (
                  <div key={task.id} className="flex items-center gap-3 px-5 py-3 border-b border-[rgba(17,17,25,0.06)] last:border-0">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] shrink-0 ${
                      task.status === 'completed' ? 'bg-[#16a34a] text-white' :
                      task.status === 'overdue' ? 'border-2 border-[#dc2626]' : 'border-2 border-[rgba(17,17,25,0.2)]'
                    }`}>{task.status === 'completed' && '✓'}</div>
                    <div className="flex-1">
                      <div className={`text-sm font-bold ${task.status === 'completed' ? 'line-through text-[#8a8899]' : task.status === 'overdue' ? 'text-[#dc2626]' : ''}`}>{task.title}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${task.owner_side === 'buyer' ? 'bg-[rgba(61,90,254,0.08)] text-[#3d5afe]' : 'bg-[rgba(147,51,234,0.08)] text-[#9333ea]'}`}>{task.owner_side}</span>
                      {task.due_date && <span className="text-[10px] font-mono text-[#b5b3c1]">{task.due_date}</span>}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* ACTIVITY */}
          {activeTab === 'activity' && (
            <div className="bg-white rounded-2xl border border-[rgba(17,17,25,0.08)] overflow-hidden">
              <div className="px-5 py-4 border-b border-[rgba(17,17,25,0.08)]">
                <h3 className="font-extrabold text-sm">Engagement timeline</h3>
              </div>
              {events.length === 0 ? (
                <div className="py-10 text-center text-[#8a8899] text-sm">No activity yet. Share the room link to start tracking.</div>
              ) : (
                events.map((ev, i) => (
                  <div key={ev.id || i} className="flex gap-3 px-5 py-3 border-b border-[rgba(17,17,25,0.06)] last:border-0">
                    <div className="w-2 h-2 rounded-full bg-[#3d5afe] mt-1.5 shrink-0" />
                    <div>
                      <div className="text-xs font-semibold">{ev.event_type.replace(/_/g,' ')}</div>
                      {ev.stakeholder && <div className="text-[10px] text-[#8a8899]">{ev.stakeholder.full_name || ev.stakeholder.email}</div>}
                      <div className="text-[10px] text-[#b5b3c1] font-mono mt-0.5">{formatDistanceToNow(new Date(ev.occurred_at), { addSuffix: true })}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* STAKEHOLDERS */}
          {activeTab === 'stakeholders' && (
            <div className="bg-white rounded-2xl border border-[rgba(17,17,25,0.08)] overflow-hidden">
              <div className="px-5 py-4 border-b border-[rgba(17,17,25,0.08)]">
                <h3 className="font-extrabold text-sm">Stakeholders ({(deal.stakeholders || []).length})</h3>
              </div>
              {(deal.stakeholders || []).length === 0 ? (
                <div className="py-10 text-center text-[#8a8899] text-sm">No stakeholders yet. They'll appear automatically when buyers open your room.</div>
              ) : (
                (deal.stakeholders || []).map(sh => (
                  <div key={sh.id} className="flex items-center gap-3 px-5 py-3 border-b border-[rgba(17,17,25,0.06)] last:border-0">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-xs font-black shrink-0">
                      {(sh.full_name || sh.email || '?').slice(0,2).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-bold">{sh.full_name || sh.email}</div>
                      <div className="text-[10px] text-[#8a8899]">{sh.title || sh.role_in_deal}</div>
                    </div>
                    <div className="text-[10px] text-[#8a8899]">{sh.visit_count || 0} visits</div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-[rgba(17,17,25,0.08)] p-4">
            <div className="text-[10px] font-black uppercase tracking-widest text-[#b5b3c1] mb-3">Room link</div>
            <div className="bg-[#f6f5f2] rounded-lg px-3 py-2 text-xs font-mono text-[#3d5afe] break-all mb-2">{roomUrl}</div>
            <button onClick={() => { navigator.clipboard.writeText(roomUrl); toast.success('🔗 Copied!') }}
              className="w-full py-2 rounded-lg bg-[rgba(61,90,254,0.07)] text-[#3d5afe] text-xs font-bold border border-[rgba(61,90,254,0.15)]">
              📋 Copy link
            </button>
          </div>
          <div className="bg-white rounded-2xl border border-[rgba(17,17,25,0.08)] p-4">
            <div className="text-[10px] font-black uppercase tracking-widest text-[#b5b3c1] mb-3">Quick actions</div>
            <div className="space-y-2">
              <button onClick={() => toast.info('🤖 AI draft coming — feature on Growth plan')}
                className="w-full py-2 rounded-lg bg-[#f6f5f2] text-xs font-bold text-[#2e2e3a] border border-[rgba(17,17,25,0.08)] text-left px-3">
                🤖 Generate AI follow-up
              </button>
              <button onClick={() => updateStage('won')}
                className="w-full py-2 rounded-lg bg-[rgba(22,163,74,0.08)] text-[#16a34a] text-xs font-bold border border-[rgba(22,163,74,0.2)]">
                🏆 Mark as Won
              </button>
              <button onClick={() => updateStage('lost')}
                className="w-full py-2 rounded-lg bg-[rgba(220,38,38,0.06)] text-[#dc2626] text-xs font-bold border border-[rgba(220,38,38,0.15)]">
                Mark as Lost
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
