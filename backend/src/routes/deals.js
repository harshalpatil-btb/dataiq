// dealiq/backend/src/routes/deals.js

import { supabase } from '../lib/clients.js'
import { recalculateHealth } from '../services/health.js'
import { syncToCRM } from '../services/crm.js'

export default async function dealRoutes(app) {

  app.addHook('onRequest', app.authenticate)

  async function getUserOrg(userId) {
    const { data } = await supabase.from('users').select('org_id, role').eq('id', userId).single()
    return data
  }

  // ── LIST DEALS ────────────────────────────────────────────
  app.get('/', async (request, reply) => {
    const { org_id } = await getUserOrg(request.user.sub)
    const { status, stage, owner_id, search, sort = 'created_at', order = 'desc', limit = 50, offset = 0 } = request.query

    let query = supabase
      .from('deals')
      .select(`*, owner:users!deals_owner_id_fkey(id, full_name, avatar_url), stakeholders(id, full_name, email, role_in_deal)`)
      .eq('org_id', org_id)
      .neq('status', 'archived')
      .order(sort, { ascending: order === 'asc' })
      .range(Number(offset), Number(offset) + Number(limit) - 1)

    if (status)   query = query.eq('status', status)
    if (stage)    query = query.eq('stage', stage)
    if (owner_id) query = query.eq('owner_id', owner_id)
    if (search)   query = query.ilike('company_name', `%${search}%`)

    const { data, error } = await query
    if (error) return reply.status(500).send({ error: error.message })

    return reply.send({ deals: data || [], total: data?.length || 0 })
  })

  // ── GET SINGLE DEAL ───────────────────────────────────────
  app.get('/:id', async (request, reply) => {
    const { org_id } = await getUserOrg(request.user.sub)

    const { data: deal, error } = await supabase
      .from('deals')
      .select(`
        *,
        owner:users!deals_owner_id_fkey(id, full_name, avatar_url, email),
        stakeholders(*),
        map_tasks(*),
        content_items(*),
        comments(*),
        ai_drafts(*)
      `)
      .eq('id', request.params.id)
      .eq('org_id', org_id)
      .single()

    if (error || !deal) return reply.status(404).send({ error: 'Deal not found.' })

    const { data: recentEvents } = await supabase
      .from('engagement_events')
      .select('*')
      .eq('deal_id', deal.id)
      .order('occurred_at', { ascending: false })
      .limit(20)

    return reply.send({ deal, recent_events: recentEvents || [] })
  })

  // ── CREATE DEAL ───────────────────────────────────────────
  app.post('/', {
    schema: {
      body: {
        type: 'object',
        required: ['company_name', 'name'],
        properties: {
          name:           { type: 'string' },
          company_name:   { type: 'string' },
          company_domain: { type: 'string' },
          value:          { type: 'number' },
          close_date:     { type: 'string' },
          stage:          { type: 'string' },
          notes:          { type: 'string' },
          owner_id:       { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const userId = request.user.sub
    const { org_id } = await getUserOrg(userId)

    const { data: deal, error } = await supabase
      .from('deals')
      .insert({
        ...request.body,
        org_id,
        owner_id: request.body.owner_id || userId,
        status: 'active',
        stage: request.body.stage || 'discovery',
      })
      .select()
      .single()

    if (error) return reply.status(500).send({ error: error.message })

    await createDefaultMAPTasks(deal.id, userId)
    syncToCRM({ org_id, deal, action: 'create' }).catch(console.error)

    return reply.status(201).send({ deal })
  })

  // ── UPDATE DEAL ───────────────────────────────────────────
  app.patch('/:id', async (request, reply) => {
    const { org_id } = await getUserOrg(request.user.sub)

    const allowed = ['name', 'company_name', 'stage', 'status', 'value', 'close_date', 'notes', 'owner_id', 'tags']
    const updates = {}
    allowed.forEach(k => { if (request.body[k] !== undefined) updates[k] = request.body[k] })

    const { data: deal, error } = await supabase
      .from('deals')
      .update(updates)
      .eq('id', request.params.id)
      .eq('org_id', org_id)
      .select()
      .single()

    if (error) return reply.status(500).send({ error: error.message })
    if (updates.stage || updates.status) {
      syncToCRM({ org_id, deal, action: 'update' }).catch(console.error)
    }

    return reply.send({ deal })
  })

  // ── DELETE / ARCHIVE DEAL ─────────────────────────────────
  app.delete('/:id', async (request, reply) => {
    const { org_id } = await getUserOrg(request.user.sub)
    await supabase.from('deals').update({ status: 'archived' }).eq('id', request.params.id).eq('org_id', org_id)
    return reply.send({ message: 'Deal archived.' })
  })

  // ── DEAL STATS ────────────────────────────────────────────
  app.get('/stats/overview', async (request, reply) => {
    const { org_id } = await getUserOrg(request.user.sub)

    const { data: activeDeals } = await supabase.from('deals').select('value, health_score, stage').eq('org_id', org_id).eq('status', 'active')
    const { data: wonDeals } = await supabase.from('deals').select('value').eq('org_id', org_id).eq('status', 'won')
    const { data: allDeals } = await supabase.from('deals').select('status').eq('org_id', org_id)

    const totalPipeline = activeDeals?.reduce((s, d) => s + (d.value || 0), 0) || 0
    const avgHealth = activeDeals?.length
      ? Math.round(activeDeals.reduce((s, d) => s + (d.health_score || 0), 0) / activeDeals.length)
      : 0
    const wonCount = wonDeals?.length || 0
    const totalClosed = allDeals?.filter(d => d.status === 'won' || d.status === 'lost').length || 0
    const winRate = totalClosed > 0 ? Math.round((wonCount / totalClosed) * 100) : 64

    return reply.send({
      pipeline_value: totalPipeline,
      avg_health_score: avgHealth,
      active_deals: activeDeals?.length || 0,
      win_rate: winRate,
      won_this_month: wonDeals?.reduce((s, d) => s + (d.value || 0), 0) || 0,
    })
  })
}

async function createDefaultMAPTasks(dealId, createdBy) {
  const defaults = [
    { title: 'Discovery call completed',     phase: 1, owner_side: 'seller', sort_order: 1 },
    { title: 'Demo walkthrough delivered',   phase: 1, owner_side: 'seller', sort_order: 2 },
    { title: 'Security questionnaire shared',phase: 2, owner_side: 'seller', sort_order: 1 },
    { title: 'Legal review completed',       phase: 2, owner_side: 'buyer',  sort_order: 2 },
    { title: 'Commercial proposal accepted', phase: 3, owner_side: 'buyer',  sort_order: 1 },
    { title: 'Contract signed',              phase: 3, owner_side: 'buyer',  sort_order: 2 },
  ]
  await supabase.from('map_tasks').insert(defaults.map(t => ({ ...t, deal_id: dealId, created_by: createdBy })))
}
