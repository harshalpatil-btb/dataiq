// dealiq/backend/src/services/stakeholders.js
import { supabase } from '../lib/clients.js'

export async function identifyStakeholder({ deal_id, email, name }) {
  if (!email || !deal_id) return null

  // Upsert stakeholder
  const { data: existing } = await supabase
    .from('stakeholders')
    .select('*')
    .eq('deal_id', deal_id)
    .eq('email', email.toLowerCase())
    .single()

  if (existing) {
    // Update last seen + visit count
    const { data } = await supabase.from('stakeholders').update({
      last_seen_at: new Date().toISOString(),
      visit_count: (existing.visit_count || 0) + 1,
      full_name: name || existing.full_name,
    }).eq('id', existing.id).select().single()
    return data
  }

  // New stakeholder — create and fire "new stakeholder" event
  const { data: newSh } = await supabase.from('stakeholders').insert({
    deal_id,
    email: email.toLowerCase(),
    full_name: name || email.split('@')[0],
    first_seen_at: new Date().toISOString(),
    last_seen_at:  new Date().toISOString(),
    visit_count: 1,
  }).select().single()

  // Fire stakeholder_joined engagement event
  if (newSh) {
    await supabase.from('engagement_events').insert({
      deal_id,
      stakeholder_id: newSh.id,
      event_type: 'stakeholder_joined',
      metadata: { email, name },
    })
  }

  return newSh
}
