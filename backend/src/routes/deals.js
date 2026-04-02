// dealiq/backend/src/routes/deals.js

import { supabase } from '../lib/clients.js'
import { recalculateHealth } from '../services/health.js'
import { syncToCRM } from '../services/crm.js'

export default async function dealRoutes(app) {

  // All deal routes require auth
  app.addHook('onRequest', app.authenticate)

  // Helper: get org_id for current user
  async function getUserOrg(userId) {
    const { data } = await supabase.from('users').select('org_id, role').eq('id', userId).single()
    return data
  }

  // ── LIST DEALS ────────────────────────────────────────────
  app.get('/', async (request, reply) => {
    const { org_id } = await getUserOrg(request.user.sub)
    const { status, stage, owner_id, search, sort = 'health_score', order = 'desc', limit = 50, offset = 0 } = request.query

    let query = supabase
      .from('deals')
      .select(`
        *,
        owner:users!deals_owner_id_fkey(id, full_name, avatar_url),
        stakeholders(id, full_name, email, role_in_deal, engagement_score, last_seen_at),
        _map_count:map_tasks(count),
        _comment_count:comments(count)
      `)
      .eq('org_id', org_id)
      .neq('status', 'archived')
      .order(sort, { ascending: order === 'asc' })
      .range(offset, offset + limit - 1)

    if (status)   query = query.eq('status', status)
    if (stage)    query = query.eq('stage', stage)
    if (owner_id) query = query.eq('owner_id', owner_id)
    if (search)   query = query.ilike('company_name', `%${search}%`)

    const { data, error, count } = await query
    if (error) return reply.status(500).send({ error: error.message })

    return reply.send({ deals: data, total: count })
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
        map_tasks(* ORDER BY phase ASC, sort_order ASC),
        content_items(*),
        comments(*, ORDER BY created_at ASC),
        ai_drafts(* WHERE status = 'pending' ORDER BY created_at DESC LIMIT 3)
      `)
      .eq('id', request.params.id)
      .eq('org_id', org_id)
      .single()

    if (error || !deal) return reply.status(404).send({ error: 'Deal not found.' })

    // Get recent engagement
    const { data: recentEvents } = await supabase
      .from('engagement_events')
      .select('*, stakeholder:stakeholders(full_name, email)')
      .eq('deal_id', deal.id)
      .order('occurred_at', { ascending: false })
      .limit(20)

    return reply.send({ deal, recent_events: recentEvents })
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

    // Check plan limits
    const { count } = await supabase
      .from('deals')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', org_id)
      .eq('status', 'active')

    const { data: org } = await supabase.from('organizations').select('plan').eq('id', org_id).single()

    if (org.plan === 'trial' && count >= 3) {
      return reply.status(403).send({
        error: 'trial_limit',
        message: 'Trial plan is limited to 3 deal rooms. Upgrade to create more.',
      })
    }

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

    // Add default MAP tasks
    await createDefaultMAPTasks(deal.id, userId)

    // Async CRM sync
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

    // Sync stage change to CRM
    if (updates.stage || updates.status) {
      syncToCRM({ org_id, deal, action: 'update' }).catch(console.error)
    }

    return reply.send({ deal })
  })

  // ── DELETE / ARCHIVE DEAL ─────────────────────────────────
  app.delete('/:id', async (request, reply) => {
    const { org_id } = await getUserOrg(request.user.sub)

    await supabase.from('deals')
      .update({ status: 'archived' })
      .eq('id', request.params.id)
      .eq('org_id', org_id)

    return reply.send({ message: 'Deal archived.' })
  })

  // ── DEAL STATS (for dashboard) ────────────────────────────
  app.get('/stats/overview', async (request, reply) => {
    const { org_id } = await getUserOrg(request.user.sub)

    const [
      { data: statusCounts },
      { data: pipelineValue },
      { data: stageCounts },
      { data: recentWins },
    ] = await Promise.all([
      supabase.rpc('deal_status_counts', { p_org_id: org_id }),
      supabase.from('deals').select('value').eq('org_id', org_id).eq('status', 'active'),
      supabase.rpc('deal_stage_counts', { p_org_id: org_id }),
      supabase.from('deals').select('name, company_name, value, updated_at')
        .eq('org_id', org_id).eq('status', 'won')
        .order('updated_at', { ascending: false }).limit(5),
    ])

    const totalPipeline = pipelineValue?.reduce((sum, d) => sum + (d.value || 0), 0) || 0
    const avgHealth = await supabase
      .from('deals')
      .select('health_score')
      .eq('org_id', org_id)
      .eq('status', 'active')
      .then(({ data }) => data?.length
        ? Math.round(data.reduce((s, d) => s + d.health_score, 0) / data.length)
        : 0
      )

    return reply.send({
      pipeline_value: totalPipeline,
      avg_health_score: avgHealth,
      status_counts: statusCounts,
      stage_counts: stageCounts,
      recent_wins: recentWins,
    })
  })
}

// ── HELPER: create default MAP tasks for new deal ─────────
async function createDefaultMAPTasks(dealId, createdBy) {
  const defaults = [
    { title: 'Discovery call completed',  phase: 1, owner_side: 'seller', sort_order: 1 },
    { title: 'Demo walkthrough delivered', phase: 1, owner_side: 'seller', sort_order: 2 },
    { title: 'Security questionnaire shared', phase: 2, owner_side: 'seller', sort_order: 1 },
    { title: 'Legal review completed',    phase: 2, owner_side: 'buyer',  sort_order: 2 },
    { title: 'Commercial proposal accepted', phase: 3, owner_side: 'buyer', sort_order: 1 },
    { title: 'Contract signed',           phase: 3, owner_side: 'buyer',  sort_order: 2 },
  ]

  await supabase.from('map_tasks').insert(
    defaults.map(t => ({ ...t, deal_id: dealId, created_by: createdBy }))
  )
}
