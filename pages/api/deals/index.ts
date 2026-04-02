// pages/api/deals/index.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import { createServerSupabaseClient } from '@supabase/auth-helpers-nextjs'
import { supabaseAdmin } from '../../../lib/supabase'
import { nanoid } from 'nanoid'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const supabase = createServerSupabaseClient({ req, res })
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return res.status(401).json({ error: 'Unauthorized' })

  // Get user's org_id
  const { data: user } = await supabaseAdmin
    .from('users').select('org_id, role').eq('id', session.user.id).single()
  if (!user) return res.status(401).json({ error: 'User not found' })

  // ── GET: List all deals ──────────────────────────────────────
  if (req.method === 'GET') {
    const { status, stage, owner_id, search } = req.query

    let query = supabaseAdmin
      .from('deals')
      .select(`
        *,
        owner:users(id, full_name, email, avatar_url),
        stakeholders(id, full_name, email, role_in_deal, engagement_score, last_seen_at),
        map_tasks(id, title, status, due_date, owner_side),
        content_items(id, title, type, view_count)
      `)
      .eq('org_id', user.org_id)
      .order('updated_at', { ascending: false })

    if (status) query = query.eq('status', status as string)
    if (stage) query = query.eq('stage', stage as string)
    if (owner_id) query = query.eq('owner_id', owner_id as string)
    if (search) query = query.ilike('company_name', `%${search}%`)

    const { data, error } = await query
    if (error) return res.status(500).json({ error: error.message })

    return res.status(200).json({ data })
  }

  // ── POST: Create new deal ────────────────────────────────────
  if (req.method === 'POST') {
    // Check trial limits
    const { data: org } = await supabaseAdmin
      .from('organizations').select('plan, trial_ends_at').eq('id', user.org_id).single()

    if (org?.plan === 'trial') {
      const { count } = await supabaseAdmin
        .from('deals').select('*', { count: 'exact', head: true })
        .eq('org_id', user.org_id).neq('status', 'archived')

      if ((count ?? 0) >= 3) {
        return res.status(403).json({
          error: 'Trial limit reached',
          message: 'Upgrade to create more than 3 deal rooms',
          upgrade_url: `${process.env.NEXT_PUBLIC_APP_URL}/pricing`,
        })
      }
    }

    const { name, company_name, company_domain, value_inr, close_date, stage } = req.body

    if (!name || !company_name) {
      return res.status(400).json({ error: 'Deal name and company name are required' })
    }

    // Generate unique room slug
    const baseSlug = company_name.toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '-')
      .slice(0, 30)
    const room_slug = `${baseSlug}-${nanoid(6)}`

    const { data: deal, error } = await supabaseAdmin
      .from('deals')
      .insert({
        org_id: user.org_id,
        owner_id: session.user.id,
        name,
        company_name,
        company_domain,
        value_inr: value_inr ? Number(value_inr) : null,
        close_date: close_date || null,
        stage: stage || 'discovery',
        room_slug,
        status: 'active',
        health_score: 50,
      })
      .select()
      .single()

    if (error) return res.status(500).json({ error: error.message })

    // Add default MAP tasks
    await supabaseAdmin.from('map_tasks').insert([
      { deal_id: deal.id, title: 'Discovery call', owner_side: 'seller', sort_order: 1 },
      { deal_id: deal.id, title: 'Product demo delivered', owner_side: 'seller', sort_order: 2 },
      { deal_id: deal.id, title: 'Proposal reviewed', owner_side: 'buyer', sort_order: 3 },
      { deal_id: deal.id, title: 'Legal review completed', owner_side: 'buyer', sort_order: 4 },
      { deal_id: deal.id, title: 'Contract signed', owner_side: 'buyer', sort_order: 5 },
    ])

    return res.status(201).json({
      data: deal,
      room_url: `${process.env.NEXT_PUBLIC_APP_URL}/room/${room_slug}`,
    })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
