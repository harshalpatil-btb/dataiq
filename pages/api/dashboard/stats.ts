// pages/api/dashboard/stats.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import { createServerSupabaseClient } from '@supabase/auth-helpers-nextjs'
import { supabaseAdmin } from '../../../lib/supabase'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end()

  const supabase = createServerSupabaseClient({ req, res })
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return res.status(401).json({ error: 'Unauthorized' })

  const { data: user } = await supabaseAdmin
    .from('users').select('org_id').eq('id', session.user.id).single()
  if (!user) return res.status(401).end()

  const orgId = user.org_id
  const startOfMonth = new Date(); startOfMonth.setDate(1); startOfMonth.setHours(0,0,0,0)

  // Run all queries in parallel for speed
  const [activeDeals, stalledDeals, wonDeals, allDeals] = await Promise.all([
    supabaseAdmin.from('deals').select('id', { count: 'exact', head: true })
      .eq('org_id', orgId).eq('status', 'active'),
    supabaseAdmin.from('deals').select('id', { count: 'exact', head: true })
      .eq('org_id', orgId).eq('status', 'stalled'),
    supabaseAdmin.from('deals').select('value_inr')
      .eq('org_id', orgId).eq('status', 'won')
      .gte('updated_at', startOfMonth.toISOString()),
    supabaseAdmin.from('deals').select('health_score, value_inr, status')
      .eq('org_id', orgId).neq('status', 'archived'),
  ])

  const totalPipeline = allDeals.data
    ?.filter(d => d.status === 'active' || d.status === 'stalled')
    .reduce((sum, d) => sum + (d.value_inr || 0), 0) || 0

  const wonValue = wonDeals.data?.reduce((sum, d) => sum + (d.value_inr || 0), 0) || 0
  const avgHealth = allDeals.data?.length
    ? Math.round(allDeals.data.reduce((s, d) => s + d.health_score, 0) / allDeals.data.length)
    : 0

  const totalClosed = allDeals.data?.filter(d => d.status === 'won' || d.status === 'lost').length || 0
  const wonCount = allDeals.data?.filter(d => d.status === 'won').length || 0
  const winRate = totalClosed > 0 ? Math.round((wonCount / totalClosed) * 100) : 0

  return res.status(200).json({
    data: {
      pipeline_value: totalPipeline,
      active_deals: activeDeals.count || 0,
      stalled_deals: stalledDeals.count || 0,
      won_this_month: wonValue,
      win_rate: winRate,
      avg_health_score: avgHealth,
    }
  })
}
