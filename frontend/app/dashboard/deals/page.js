'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { deals } from '../../../../lib/api'
import { useUIStore } from '../../../../lib/store'

export default function NewDealPage() {
  const router = useRouter()
  const showToast = useUIStore(s => s.showToast)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    company_name: '', name: '', value: '', close_date: '', stage: 'discovery', notes: '',
  })

  function update(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    try {
      const payload = { ...form, value: form.value ? parseFloat(form.value) : null }
      const { deal } = await deals.create(payload)
      showToast('🏠 Deal room created! Share the link with your buyer.', 'success')
      router.push(`/dashboard/deals/${deal.id}`)
    } catch (err) {
      showToast(err.message || 'Could not create deal', 'error')
      setLoading(false)
    }
  }

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight mb-1">New Deal Room</h1>
        <p className="text-[#8a8899] text-sm">Takes 2 minutes. Share with your buyer immediately after.</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-[rgba(17,17,25,0.08)] p-7 space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-[#2e2e3a] mb-1.5">Prospect company *</label>
            <input required value={form.company_name} onChange={e => update('company_name', e.target.value)}
              placeholder="e.g. Acme Corp" className="w-full px-3 py-2.5 rounded-[9px] border border-[rgba(17,17,25,0.14)] bg-[#f6f5f2] text-sm outline-none focus:border-[#3d5afe] transition-colors" />
          </div>
          <div>
            <label className="block text-xs font-bold text-[#2e2e3a] mb-1.5">Deal name *</label>
            <input required value={form.name} onChange={e => update('name', e.target.value)}
              placeholder="e.g. Enterprise Platform Q2" className="w-full px-3 py-2.5 rounded-[9px] border border-[rgba(17,17,25,0.14)] bg-[#f6f5f2] text-sm outline-none focus:border-[#3d5afe] transition-colors" />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-[#2e2e3a] mb-1.5">Deal value (₹)</label>
            <input type="number" value={form.value} onChange={e => update('value', e.target.value)}
              placeholder="1800000" className="w-full px-3 py-2.5 rounded-[9px] border border-[rgba(17,17,25,0.14)] bg-[#f6f5f2] text-sm outline-none focus:border-[#3d5afe] transition-colors" />
          </div>
          <div>
            <label className="block text-xs font-bold text-[#2e2e3a] mb-1.5">Close date</label>
            <input type="date" value={form.close_date} onChange={e => update('close_date', e.target.value)}
              className="w-full px-3 py-2.5 rounded-[9px] border border-[rgba(17,17,25,0.14)] bg-[#f6f5f2] text-sm outline-none focus:border-[#3d5afe] transition-colors" />
          </div>
          <div>
            <label className="block text-xs font-bold text-[#2e2e3a] mb-1.5">Stage</label>
            <select value={form.stage} onChange={e => update('stage', e.target.value)}
              className="w-full px-3 py-2.5 rounded-[9px] border border-[rgba(17,17,25,0.14)] bg-[#f6f5f2] text-sm outline-none focus:border-[#3d5afe] transition-colors appearance-none">
              {['discovery','demo','proposal','negotiation','closing'].map(s => (
                <option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-[#2e2e3a] mb-1.5">Notes (optional)</label>
          <textarea value={form.notes} onChange={e => update('notes', e.target.value)}
            placeholder="Context about this deal, key contacts, anything important…" rows={3}
            className="w-full px-3 py-2.5 rounded-[9px] border border-[rgba(17,17,25,0.14)] bg-[#f6f5f2] text-sm outline-none focus:border-[#3d5afe] transition-colors resize-none" />
        </div>

        <div className="flex gap-3 pt-2">
          <button type="button" onClick={() => router.back()}
            className="px-5 py-2.5 rounded-[9px] border border-[rgba(17,17,25,0.14)] text-sm font-bold text-[#8a8899] hover:bg-[#f6f5f2] transition-colors">
            Cancel
          </button>
          <button type="submit" disabled={loading}
            className="flex-1 py-2.5 rounded-[9px] bg-[#3d5afe] text-white text-sm font-bold hover:bg-[#536dfe] transition-colors disabled:opacity-60">
            {loading ? 'Creating…' : 'Create Deal Room →'}
          </button>
        </div>
      </form>
    </div>
  )
}
