// dealiq/backend/src/routes/engagement.js
// Public-facing: buyer visits don't require auth JWT
// Protected: internal analytics require auth

import { supabase } from '../lib/clients.js'
import { triggerAutomations } from '../services/automation.js'
import { identifyStakeholder } from '../services/stakeholders.js'

export default async function engagementRoutes(app) {

  // ── TRACK EVENT (public — called from buyer's browser) ────
  // No auth required — buyers don't have accounts
  app.post('/track', {
    config: { rateLimit: { max: 120, timeWindow: '1 minute' } },
    schema: {
      body: {
        type: 'object',
        required: ['deal_id', 'event_type'],
        properties: {
          deal_id:          { type: 'string' },
          event_type:       { type: 'string' },
          stakeholder_email:{ type: 'string' },
          stakeholder_name: { type: 'string' },
          content_id:       { type: 'string' },
          duration_s:       { type: 'number' },
          scroll_depth_pct: { type: 'number' },
          page_number:      { type: 'number' },
          metadata:         { type: 'object' },
        },
      },
    },
  }, async (request, reply) => {
    const {
      deal_id,
      event_type,
      stakeholder_email,
      stakeholder_name,
      content_id,
      duration_s,
      scroll_depth_pct,
      page_number,
      metadata,
    } = request.body

    // 1. Verify deal exists and is active
    const { data: deal } = await supabase
      .from('deals')
      .select('id, org_id, room_is_active, status')
      .eq('id', deal_id)
      .single()

    if (!deal || !deal.room_is_active) {
      return reply.status(404).send({ error: 'Deal room not found or inactive.' })
    }

    // 2. Identify/upsert stakeholder
    let stakeholderId = null
    if (stakeholder_email) {
      const stakeholder = await identifyStakeholder({
        deal_id,
        email: stakeholder_email,
        name: stakeholder_name,
      })
      stakeholderId = stakeholder?.id || null
    }

    // 3. Extract device info
    const ua = request.headers['user-agent'] || ''
    const deviceType = /mobile/i.test(ua) ? 'mobile' : /tablet/i.test(ua) ? 'tablet' : 'desktop'

    // 4. Insert engagement event
    const { data: event, error } = await supabase
      .from('engagement_events')
      .insert({
        deal_id,
        stakeholder_id: stakeholderId,
        content_id,
        event_type,
        duration_s: duration_s || 0,
        scroll_depth_pct,
        page_number,
        metadata: metadata || {},
        ip_address: request.ip,
        user_agent: ua.substring(0, 500),
        device_type: deviceType,
        occurred_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) {
      console.error('Engagement track error:', error)
      return reply.status(500).send({ error: 'Could not track event.' })
    }

    // 5. Update content view count (async)
    if (content_id && ['content_opened','video_played'].includes(event_type)) {
      supabase.from('content_items')
        .update({ view_count: supabase.raw('view_count + 1') })
        .eq('id', content_id)
        .catch(console.error)
    }

    // 6. Fire automations (async — don't block the tracker response)
    triggerAutomations({ deal, event, stakeholderId }).catch(console.error)

    // 7. Return success immediately (tracking should be instant)
    return reply.send({ tracked: true, event_id: event.id })
  })

  // ── GET ENGAGEMENT FEED for a deal (protected) ────────────
  app.get('/feed/:deal_id', { onRequest: [app.authenticate] }, async (request, reply) => {
    const { deal_id } = request.params
    const { limit = 30, before } = request.query

    let query = supabase
      .from('engagement_events')
      .select(`
        *,
        stakeholder:stakeholders(full_name, email, title, role_in_deal),
        content:content_items(title, type)
      `)
      .eq('deal_id', deal_id)
      .order('occurred_at', { ascending: false })
      .limit(limit)

    if (before) query = query.lt('occurred_at', before)

    const { data, error } = await query
    if (error) return reply.status(500).send({ error: error.message })

    return reply.send({ events: data })
  })

  // ── GET ENGAGEMENT ANALYTICS for a deal (protected) ───────
  app.get('/analytics/:deal_id', { onRequest: [app.authenticate] }, async (request, reply) => {
    const { deal_id } = request.params

    // Aggregate stats
    const [
      { data: totalViews },
      { data: uniqueViewers },
      { data: contentBreakdown },
      { data: deviceBreakdown },
      { data: timeseriesData },
    ] = await Promise.all([
      supabase.from('engagement_events').select('*', { count: 'exact', head: true }).eq('deal_id', deal_id),
      supabase.from('engagement_events').select('stakeholder_id').eq('deal_id', deal_id).not('stakeholder_id', 'is', null),
      supabase.rpc('content_engagement_breakdown', { p_deal_id: deal_id }),
      supabase.from('engagement_events').select('device_type').eq('deal_id', deal_id),
      supabase.rpc('deal_engagement_timeseries', { p_deal_id: deal_id, p_days: 14 }),
    ])

    // Device breakdown
    const devices = { desktop: 0, mobile: 0, tablet: 0 }
    deviceBreakdown?.forEach(e => { if (devices[e.device_type] !== undefined) devices[e.device_type]++ })

    // Unique viewer count
    const uniqueCount = new Set(uniqueViewers?.map(e => e.stakeholder_id)).size

    return reply.send({
      total_views: totalViews,
      unique_viewers: uniqueCount,
      content_breakdown: contentBreakdown,
      device_breakdown: devices,
      timeseries: timeseriesData,
    })
  })

  // ── MARK STAKEHOLDER (buyer identifies themselves) ────────
  app.post('/identify', {
    schema: {
      body: {
        type: 'object',
        required: ['deal_id', 'email'],
        properties: {
          deal_id:  { type: 'string' },
          email:    { type: 'string', format: 'email' },
          name:     { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const { deal_id, email, name } = request.body

    const stakeholder = await identifyStakeholder({ deal_id, email, name })

    return reply.send({
      stakeholder_id: stakeholder.id,
      is_known: stakeholder.visit_count > 1,
    })
  })
}
