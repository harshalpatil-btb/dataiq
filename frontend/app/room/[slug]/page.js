'use client'
// dealiq/frontend/app/room/[slug]/page.js
// PUBLIC — no auth. Buyer-facing deal room.

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { room as roomApi, engagement, createTracker } from '../../../lib/api'
import { formatDistanceToNow } from 'date-fns'

export default function DealRoomPage() {
  const { slug } = useParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState('overview')
  const [stakeholder, setStakeholder] = useState(null)
  const [identified, setIdentified] = useState(false)
  const [identForm, setIdentForm] = useState({ email: '', name: '' })
  const [sheetOpen, setSheetOpen] = useState(null) // 'sign' | 'question'
  const [questionText, setQuestionText] = useState('')
  const [chatInput, setChatInput] = useState('')
  const [chatMessages, setChatMessages] = useState([])
  const trackerRef = useRef(null)

  // Load room data
  useEffect(() => {
    roomApi.get(slug)
      .then(d => {
        setData(d)
        setLoading(false)
        // Load existing comments into chat
        setChatMessages(d.comments || [])
      })
      .catch(err => {
        setError(err.message)
        setLoading(false)
      })
  }, [slug])

  // Initialize tracker once stakeholder identified
  useEffect(() => {
    if (identified && data?.deal?.id) {
      trackerRef.current = createTracker(
        data.deal.id,
        stakeholder.email,
        stakeholder.name
      )
    }
  }, [identified, data])

  // Identify buyer
  async function handleIdentify(e) {
    e.preventDefault()
    const res = await engagement.identify({
      deal_id: data.deal.id,
      email: identForm.email,
      name: identForm.name,
    })
    setStakeholder({ ...identForm, id: res.stakeholder_id })
    setIdentified(true)
    localStorage.setItem(`dealiq_sh_${slug}`, JSON.stringify({ ...identForm, id: res.stakeholder_id }))
  }

  // Track content open
  function openContent(item) {
    trackerRef.current?.trackContentOpen(item.id, item.type)
    if (item.file_url) window.open(item.file_url, '_blank')
    else alert(`Opening: ${item.title}`)
  }

  // Send chat message
  async function sendMessage(e) {
    e.preventDefault()
    if (!chatInput.trim()) return
    const msg = chatInput.trim()
    setChatInput('')

    // Optimistic update
    const optimistic = {
      id: Date.now(),
      body: msg,
      author_name: stakeholder?.name || 'You',
      author_type: 'stakeholder',
      created_at: new Date().toISOString(),
    }
    setChatMessages(prev => [...prev, optimistic])

    // Track event
    trackerRef.current?.trackQuestion(msg)

    // Save to backend
    await roomApi.postComment(slug, {
      body: msg,
      stakeholder_email: stakeholder?.email,
      stakeholder_name: stakeholder?.name,
    }).catch(console.error)
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#f6f5f2]">
      <div className="text-center">
        <div className="w-10 h-10 rounded-xl bg-[#3d5afe] flex items-center justify-center text-white font-black text-lg mx-auto mb-3">D</div>
        <div className="text-sm text-[#8a8899] font-semibold">Loading your deal room…</div>
      </div>
    </div>
  )

  if (error) return (
    <div className="min-h-screen flex items-center justify-center bg-[#f6f5f2]">
      <div className="text-center max-w-sm">
        <div className="text-3xl mb-3">🔒</div>
        <h2 className="font-extrabold text-lg mb-2">Room not found</h2>
        <p className="text-[#8a8899] text-sm">This deal room may have expired or the link is incorrect.</p>
      </div>
    </div>
  )

  const { deal, content_items = [], map_tasks = [] } = data
  const doneTasks   = map_tasks.filter(t => t.status === 'completed').length
  const totalTasks  = map_tasks.length
  const progress    = totalTasks ? Math.round(doneTasks / totalTasks * 100) : 0

  // Check if stakeholder already identified (from localStorage)
  useEffect(() => {
    const saved = localStorage.getItem(`dealiq_sh_${slug}`)
    if (saved) {
      const sh = JSON.parse(saved)
      setStakeholder(sh)
      setIdentified(true)
    }
  }, [slug])

  return (
    <div className="min-h-screen bg-[#f6f5f2]" style={{ fontFamily: "'Sora', sans-serif" }}>

      {/* Live banner */}
      <div className="bg-[rgba(22,163,74,0.1)] border-b border-[rgba(22,163,74,0.15)] px-4 py-2 flex items-center gap-2 text-xs font-semibold text-[#16a34a]">
        <div className="w-1.5 h-1.5 rounded-full bg-[#16a34a] animate-pulse" />
        <span id="live-banner-text">Your DealIQ workspace is live</span>
      </div>

      {/* Topbar */}
      <header className="sticky top-0 z-50 bg-[rgba(246,245,242,0.92)] backdrop-blur-xl border-b border-[rgba(17,17,25,0.08)]">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          {/* Brand */}
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-1.5">
              <div className="w-7 h-7 rounded-lg bg-[#3d5afe] flex items-center justify-center text-white text-xs font-black">D</div>
              <span className="text-[10px] font-bold text-[#8a8899]">×</span>
              <div className="w-7 h-7 rounded-lg bg-[#0f172a] flex items-center justify-center text-white text-xs font-black">
                {deal.company_name?.slice(0,1) || 'A'}
              </div>
            </div>
            <div>
              <div className="text-sm font-extrabold tracking-tight leading-tight">DealIQ × {deal.company_name}</div>
              <div className="text-[10px] text-[#8a8899]">{deal.name}</div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 bg-[rgba(17,17,25,0.05)] rounded-lg p-1">
            {[
              { id: 'overview',     label: '📁 Overview' },
              { id: 'map',          label: '✅ Plan' },
              { id: 'discussion',   label: '💬 Chat' },
              { id: 'stakeholders', label: '👥 People' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                  activeTab === tab.id
                    ? 'bg-white shadow-sm text-[#111119]'
                    : 'text-[#8a8899] hover:text-[#2e2e3a]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button onClick={() => setSheetOpen('question')} className="px-3 py-1.5 rounded-lg bg-white border border-[rgba(17,17,25,0.12)] text-xs font-bold text-[#2e2e3a] hover:bg-[#f0ede8] transition-colors">
              💬 Ask
            </button>
            <button onClick={() => setSheetOpen('sign')} className="px-3 py-1.5 rounded-lg bg-[#3d5afe] text-white text-xs font-bold hover:bg-[#536dfe] transition-colors">
              ✍ Sign contract
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6 grid grid-cols-[1fr_280px] gap-5">

        {/* MAIN CONTENT */}
        <div>

          {/* ── OVERVIEW TAB ── */}
          {activeTab === 'overview' && (
            <div>
              {/* Hero */}
              <div className="rounded-2xl overflow-hidden mb-5 p-7"
                style={{ background: 'linear-gradient(160deg, #0f1228, #1a1040, #0f1a28)' }}>
                <div className="inline-flex items-center gap-2 bg-[rgba(255,255,255,0.1)] border border-[rgba(255,255,255,0.15)] rounded-full px-3 py-1 text-xs font-bold text-[rgba(255,255,255,0.8)] mb-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#22c55e] animate-pulse" />
                  Live deal workspace
                </div>
                <h2 className="text-2xl font-extrabold text-white tracking-tight mb-2">
                  Welcome{identified ? `, ${stakeholder.name.split(' ')[0]}` : ''} 👋
                </h2>
                <p className="text-[rgba(255,255,255,0.5)] text-sm max-w-md leading-relaxed">
                  {deal.owner?.full_name} has set up this workspace for {deal.company_name}. Everything you need to evaluate and decide is right here.
                </p>
                <div className="flex gap-6 mt-5">
                  <div>
                    <div className="text-xl font-black text-white">
                      {deal.value ? '₹' + (deal.value / 100000).toFixed(1) + 'L' : '—'}
                    </div>
                    <div className="text-[9px] text-[rgba(255,255,255,0.4)] uppercase tracking-widest mt-0.5">Deal Value</div>
                  </div>
                  <div>
                    <div className="text-xl font-black text-white">{content_items.length}</div>
                    <div className="text-[9px] text-[rgba(255,255,255,0.4)] uppercase tracking-widest mt-0.5">Resources</div>
                  </div>
                  <div>
                    <div className="text-xl font-black text-white">{doneTasks}/{totalTasks}</div>
                    <div className="text-[9px] text-[rgba(255,255,255,0.4)] uppercase tracking-widest mt-0.5">Tasks Done</div>
                  </div>
                </div>
                <div className="mt-4">
                  <div className="flex justify-between text-[10px] text-[rgba(255,255,255,0.45)] mb-1.5">
                    <span>Deal progress</span><span>{progress}%</span>
                  </div>
                  <div className="h-1.5 bg-[rgba(255,255,255,0.1)] rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-[#3d5afe] to-[#8b5cf6]" style={{ width: `${progress}%` }} />
                  </div>
                </div>
              </div>

              {/* Content grid */}
              <h3 className="font-extrabold text-sm mb-3">📁 Shared Resources</h3>
              <div className="grid grid-cols-3 gap-3 mb-6">
                {content_items.map(item => (
                  <button key={item.id} onClick={() => openContent(item)}
                    className="bg-white rounded-xl border border-[rgba(17,17,25,0.08)] overflow-hidden text-left hover:-translate-y-0.5 hover:border-[rgba(61,90,254,0.3)] transition-all">
                    <div className="h-20 flex items-center justify-center text-3xl bg-gradient-to-br from-blue-50 to-purple-50">
                      {item.type === 'pdf' ? '📄' : item.type === 'video' ? '🎥' : item.type === 'deck' ? '📊' : '📁'}
                    </div>
                    <div className="p-3">
                      <div className="text-xs font-extrabold leading-tight mb-1">{item.title}</div>
                      <div className="text-[10px] text-[#8a8899]">{item.view_count || 0} views</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── MAP TAB ── */}
          {activeTab === 'map' && (
            <div>
              <div className="bg-white rounded-2xl border border-[rgba(17,17,25,0.08)] p-5 mb-4">
                <h3 className="font-extrabold mb-1">Mutual Action Plan</h3>
                <p className="text-xs text-[#8a8899]">Shared steps to close by {deal.close_date ? new Date(deal.close_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'TBD'}</p>
                <div className="flex gap-3 mt-4">
                  {[
                    { label: 'Done', count: doneTasks, color: '#16a34a', bg: 'rgba(22,163,74,0.1)' },
                    { label: 'Pending', count: map_tasks.filter(t => t.status === 'pending').length, color: '#d97706', bg: 'rgba(217,119,6,0.1)' },
                    { label: 'Overdue', count: map_tasks.filter(t => t.status === 'overdue').length, color: '#dc2626', bg: 'rgba(220,38,38,0.08)' },
                  ].map(s => (
                    <div key={s.label} className="flex-1 text-center rounded-xl py-3" style={{ background: s.bg }}>
                      <div className="text-xl font-black" style={{ color: s.color }}>{s.count}</div>
                      <div className="text-[9px] uppercase tracking-widest text-[#8a8899] mt-1">{s.label}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                {[1, 2, 3].map(phase => {
                  const phaseTasks = map_tasks.filter(t => t.phase === phase)
                  if (!phaseTasks.length) return null
                  return (
                    <div key={phase}>
                      <div className="flex items-center gap-3 mb-2">
                        <div className="h-px flex-1 bg-[rgba(17,17,25,0.08)]" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-[#b5b3c1]">Phase {phase}</span>
                        <div className="h-px flex-1 bg-[rgba(17,17,25,0.08)]" />
                      </div>
                      {phaseTasks.map(task => (
                        <div key={task.id} className={`bg-white rounded-xl border p-4 mb-2 flex items-start gap-3 ${
                          task.status === 'overdue' ? 'border-[rgba(220,38,38,0.3)] bg-[rgba(220,38,38,0.02)]' : 'border-[rgba(17,17,25,0.08)]'
                        }`}>
                          <div className={`w-5 h-5 rounded-full mt-0.5 flex items-center justify-center text-[10px] shrink-0 ${
                            task.status === 'completed' ? 'bg-[#16a34a] text-white' :
                            task.status === 'overdue'   ? 'border-2 border-[#dc2626]' :
                            'border-2 border-[rgba(17,17,25,0.14)]'
                          }`}>
                            {task.status === 'completed' && '✓'}
                          </div>
                          <div className="flex-1">
                            <div className={`text-sm font-bold ${
                              task.status === 'completed' ? 'line-through text-[#8a8899]' :
                              task.status === 'overdue'   ? 'text-[#dc2626]' : ''
                            }`}>{task.title}</div>
                            {task.description && <div className="text-xs text-[#8a8899] mt-0.5">{task.description}</div>}
                          </div>
                          <div className="text-right shrink-0">
                            <div className={`text-[10px] inline-block px-2 py-0.5 rounded-full font-bold ${
                              task.owner_side === 'buyer'
                                ? 'bg-[rgba(61,90,254,0.08)] text-[#3d5afe]'
                                : 'bg-[rgba(147,51,234,0.08)] text-[#9333ea]'
                            }`}>{task.owner_side}</div>
                            {task.due_date && (
                              <div className={`text-[10px] font-mono mt-1 ${task.status === 'overdue' ? 'text-[#dc2626]' : 'text-[#b5b3c1]'}`}>
                                {task.due_date}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── DISCUSSION TAB ── */}
          {activeTab === 'discussion' && (
            <div>
              <div className="space-y-4 mb-4 min-h-[300px]">
                {chatMessages.map((msg, i) => {
                  const isMe = msg.author_type === 'stakeholder' && msg.author_stakeholder_id === stakeholder?.id
                  const isMeOptimistic = msg.author_name === stakeholder?.name && msg.author_type === 'stakeholder'
                  const mine = isMe || isMeOptimistic

                  return (
                    <div key={msg.id || i} className={`flex gap-3 ${mine ? 'flex-row-reverse' : ''}`}>
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black text-white shrink-0 self-end"
                        style={{ background: mine ? '#0f172a' : 'linear-gradient(135deg,#3d5afe,#7c3aed)' }}>
                        {msg.author_name?.slice(0,2).toUpperCase() || 'U'}
                      </div>
                      <div className={`max-w-[70%] ${mine ? 'items-end' : ''}`}>
                        <div className={`text-[10px] font-bold mb-1 text-[#8a8899] ${mine ? 'text-right' : ''}`}>
                          {msg.author_name} · {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
                        </div>
                        <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                          mine
                            ? 'bg-[#3d5afe] text-white rounded-tr-sm'
                            : 'bg-white border border-[rgba(17,17,25,0.08)] text-[#2e2e3a] rounded-tl-sm'
                        }`}>{msg.body}</div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {identified ? (
                <form onSubmit={sendMessage} className="flex gap-2 items-end bg-white border border-[rgba(17,17,25,0.14)] rounded-xl px-4 py-2.5">
                  <textarea
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    placeholder="Type a message…"
                    rows={1}
                    className="flex-1 bg-none border-none outline-none text-sm resize-none leading-relaxed"
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(e) } }}
                  />
                  <button type="submit" className="w-8 h-8 rounded-lg bg-[#3d5afe] text-white flex items-center justify-center text-sm shrink-0">↑</button>
                </form>
              ) : (
                <div className="bg-white rounded-xl border border-[rgba(17,17,25,0.08)] p-4 text-center">
                  <p className="text-sm text-[#8a8899] mb-3">Identify yourself to join the discussion</p>
                  <button onClick={() => setSheetOpen('identify')} className="px-4 py-2 rounded-lg bg-[#3d5afe] text-white text-sm font-bold">Identify yourself →</button>
                </div>
              )}
            </div>
          )}

        </div>

        {/* RIGHT SIDEBAR */}
        <div className="space-y-4">

          {/* Contact card */}
          <div className="bg-white rounded-2xl border border-[rgba(17,17,25,0.08)] p-4">
            <div className="text-[10px] font-black uppercase tracking-widest text-[#b5b3c1] mb-3">Your Contact</div>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#3d5afe] to-[#7c3aed] flex items-center justify-center text-white text-sm font-black">
                {deal.owner?.full_name?.slice(0,2).toUpperCase() || 'VS'}
              </div>
              <div>
                <div className="font-extrabold text-sm">{deal.owner?.full_name}</div>
                <div className="text-xs text-[#8a8899]">{deal.owner?.title || 'Account Executive'}</div>
              </div>
            </div>
            <button
              onClick={() => setSheetOpen('question')}
              className="w-full py-2 rounded-lg bg-[rgba(61,90,254,0.07)] text-[#3d5afe] text-xs font-bold border border-[rgba(61,90,254,0.15)] hover:bg-[rgba(61,90,254,0.12)] transition-colors"
            >
              💬 Ask a question
            </button>
          </div>

          {/* Identify yourself (if not yet) */}
          {!identified && (
            <div className="bg-[rgba(61,90,254,0.06)] rounded-2xl border border-[rgba(61,90,254,0.15)] p-4">
              <div className="text-xs font-extrabold text-[#3d5afe] mb-1">👋 Who are you?</div>
              <p className="text-[11px] text-[#8a8899] mb-3 leading-relaxed">Tell us who you are to unlock personalised content and full discussion access.</p>
              <form onSubmit={handleIdentify} className="space-y-2">
                <input required type="text" placeholder="Your name" value={identForm.name} onChange={e => setIdentForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-[rgba(17,17,25,0.14)] bg-white text-xs outline-none focus:border-[#3d5afe] transition-colors" />
                <input required type="email" placeholder="Work email" value={identForm.email} onChange={e => setIdentForm(f => ({ ...f, email: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-[rgba(17,17,25,0.14)] bg-white text-xs outline-none focus:border-[#3d5afe] transition-colors" />
                <button type="submit" className="w-full py-2 rounded-lg bg-[#3d5afe] text-white text-xs font-bold">Identify yourself →</button>
              </form>
            </div>
          )}

          {/* Action CTA */}
          <button
            onClick={() => setSheetOpen('sign')}
            className="w-full py-3.5 rounded-xl bg-[#3d5afe] text-white text-sm font-extrabold hover:bg-[#536dfe] transition-colors shadow-[0_4px_16px_rgba(61,90,254,0.25)]"
          >
            ✍ Sign contract →
          </button>

        </div>
      </div>

      {/* ── SHEET MODALS ── */}
      {sheetOpen && (
        <div className="fixed inset-0 z-[500] bg-[rgba(17,17,25,0.5)] backdrop-blur-sm flex items-end justify-center p-4"
          onClick={e => { if (e.target === e.currentTarget) setSheetOpen(null) }}>
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-[slideUp_0.3s_ease]">
            <div className="w-10 h-1 rounded-full bg-[rgba(17,17,25,0.1)] mx-auto mt-3 mb-4" />

            {sheetOpen === 'sign' && (
              <>
                <div className="px-6 pb-4 border-b border-[rgba(17,17,25,0.08)]">
                  <h3 className="font-extrabold text-lg">✍ Sign the contract</h3>
                  <p className="text-xs text-[#8a8899] mt-1">DealIQ Enterprise Agreement · MSA v3.2</p>
                </div>
                <div className="p-6 space-y-4">
                  <div className="bg-[#f6f5f2] rounded-xl p-4 flex items-center gap-3">
                    <div className="text-2xl">📄</div>
                    <div className="flex-1">
                      <div className="font-bold text-sm">DealIQ Enterprise Agreement</div>
                      <div className="text-xs text-[#8a8899]">MSA v3.2 · 24 pages</div>
                    </div>
                    <button className="text-xs text-[#3d5afe] font-bold">Preview</button>
                  </div>
                  <div>
                    <label className="block text-xs font-bold mb-1.5">Full legal name</label>
                    <input type="text" className="w-full px-3 py-2.5 rounded-[9px] border border-[rgba(17,17,25,0.14)] text-sm bg-[#f6f5f2] outline-none focus:border-[#3d5afe] transition-colors" defaultValue={stakeholder?.name} />
                  </div>
                  <div className="bg-[rgba(22,163,74,0.08)] border border-[rgba(22,163,74,0.2)] rounded-lg p-3 text-xs text-[#16a34a] font-semibold flex gap-2">
                    <span>🔒</span>
                    <span>By signing you confirm you're authorised to sign on behalf of {deal.company_name}.</span>
                  </div>
                </div>
                <div className="px-6 pb-6">
                  <button
                    onClick={() => { setSheetOpen(null); alert('🎉 Contract signed! Vikram has been notified.') }}
                    className="w-full py-3.5 rounded-xl bg-[#16a34a] text-white font-extrabold hover:bg-[#15803d] transition-colors"
                  >
                    ✍ Sign & Submit
                  </button>
                </div>
              </>
            )}

            {sheetOpen === 'question' && (
              <>
                <div className="px-6 pb-4 border-b border-[rgba(17,17,25,0.08)]">
                  <h3 className="font-extrabold text-lg">💬 Ask a question</h3>
                  <p className="text-xs text-[#8a8899] mt-1">{deal.owner?.full_name} will reply within a few hours</p>
                </div>
                <div className="p-6 space-y-3">
                  <div>
                    <label className="block text-xs font-bold mb-1.5">Topic</label>
                    <select className="w-full px-3 py-2.5 rounded-[9px] border border-[rgba(17,17,25,0.14)] text-sm bg-[#f6f5f2] outline-none">
                      <option>Pricing & Commercial</option>
                      <option>Technical Integration</option>
                      <option>Security & Compliance</option>
                      <option>Contract & Legal</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold mb-1.5">Your question</label>
                    <textarea rows={4} value={questionText} onChange={e => setQuestionText(e.target.value)}
                      placeholder="What would you like to know…"
                      className="w-full px-3 py-2.5 rounded-[9px] border border-[rgba(17,17,25,0.14)] text-sm bg-[#f6f5f2] outline-none resize-none" />
                  </div>
                </div>
                <div className="px-6 pb-6">
                  <button
                    onClick={() => {
                      if (questionText.trim()) {
                        trackerRef.current?.trackQuestion(questionText)
                        setSheetOpen(null)
                        alert('💬 Question sent! You\'ll hear back soon.')
                      }
                    }}
                    className="w-full py-3 rounded-xl bg-[#3d5afe] text-white font-extrabold hover:bg-[#536dfe] transition-colors"
                  >
                    Send question →
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
      `}</style>
    </div>
  )
}
