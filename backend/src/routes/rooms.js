// dealiq/backend/src/routes/rooms.js
// Public-facing deal room API — no auth needed for buyers

import { supabase } from '../lib/clients.js'
import bcrypt from 'bcryptjs'

export default async function roomRoutes(app) {

  // GET /rooms/:slug — load deal room for buyer
  app.get('/:slug', async (request, reply) => {
    const { slug } = request.params

    const { data: deal, error } = await supabase
      .from('deals')
      .select(`
        id, name, company_name, company_logo, stage, value, close_date,
        room_slug, room_is_active,
        owner:users!deals_owner_id_fkey(id, full_name, email, title, avatar_url),
        content_items(id, title, type, file_url, thumbnail_url, view_count, duration_s),
        map_tasks(id, title, description, status, due_date, owner_side, phase, sort_order),
        comments(id, body, author_name, author_type, created_at)
      `)
      .eq('room_slug', slug)
      .eq('room_is_active', true)
      .single()

    if (error || !deal) {
      return reply.status(404).send({ error: 'Deal room not found or has been deactivated.' })
    }

    deal.map_tasks = (deal.map_tasks || []).sort((a, b) => a.phase - b.phase || a.sort_order - b.sort_order)

    return reply.send({ deal })
  })

  // POST /rooms/:slug/verify — buyer identifies themselves
  app.post('/:slug/verify', {
    schema: {
      body: {
        type: 'object',
        required: ['email'],
        properties: {
          email: { type: 'string', format: 'email' },
          name:  { type: 'string' },
          password: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const { slug } = request.params
    const { email, name, password } = request.body

    const { data: deal } = await supabase
      .from('deals')
      .select('id, room_password')
      .eq('room_slug', slug)
      .single()

    if (!deal) return reply.status(404).send({ error: 'Room not found.' })

    if (deal.room_password) {
      if (!password) return reply.status(401).send({ error: 'password_required' })
      const valid = await bcrypt.compare(password, deal.room_password)
      if (!valid) return reply.status(401).send({ error: 'Incorrect password.' })
    }

    return reply.send({ verified: true, deal_id: deal.id })
  })

  // POST /rooms/:slug/comments — buyer posts a comment
  app.post('/:slug/comments', {
    schema: {
      body: {
        type: 'object',
        required: ['body'],
        properties: {
          body: { type: 'string', minLength: 1, maxLength: 2000 },
          stakeholder_email: { type: 'string' },
          stakeholder_name:  { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const { slug } = request.params
    const { body, stakeholder_email, stakeholder_name } = request.body

    const { data: deal } = await supabase
      .from('deals')
      .select('id, org_id, owner_id')
      .eq('room_slug', slug)
      .single()

    if (!deal) return reply.status(404).send({ error: 'Room not found.' })

    let stakeholderId = null
    if (stakeholder_email) {
      const { data: sh } = await supabase
        .from('stakeholders')
        .select('id')
        .eq('deal_id', deal.id)
        .eq('email', stakeholder_email)
        .single()
      stakeholderId = sh?.id || null
    }

    const { data: comment, error } = await supabase
      .from('comments')
      .insert({
        deal_id: deal.id,
        author_type: 'stakeholder',
        author_stakeholder_id: stakeholderId,
        author_name: stakeholder_name || stakeholder_email || 'Anonymous',
        body,
      })
      .select()
      .single()

    if (error) return reply.status(500).send({ error: 'Could not post comment.' })

    const { triggerAutomations } = await import('../services/automation.js')
    triggerAutomations({
      deal,
      event: { event_type: 'question_posted', duration_s: 0, metadata: { question_preview: body.slice(0, 100) }, id: null },
      stakeholderId,
    }).catch(console.error)

    return reply.status(201).send({ comment })
  })

  // PATCH /rooms/:slug/map/:taskId — buyer marks task complete
  app.patch('/:slug/map/:taskId', async (request, reply) => {
    const { slug, taskId } = request.params
    const { status } = request.body

    const { data: deal } = await supabase
      .from('deals')
      .select('id')
      .eq('room_slug', slug)
      .single()

    if (!deal) return reply.status(404).send({ error: 'Room not found.' })

    const { data: task, error } = await supabase
      .from('map_tasks')
      .update({
        status,
        completed_at: status === 'completed' ? new Date().toISOString() : null,
      })
      .eq('id', taskId)
      .eq('deal_id', deal.id)
      .select()
      .single()

    if (error) return reply.status(500).send({ error: 'Could not update task.' })
    return reply.send({ task })
  })

  // POST /rooms/:slug/sign — e-signature submission
  app.post('/:slug/sign', {
    schema: {
      body: {
        type: 'object',
        required: ['full_name', 'email'],
        properties: {
          full_name:   { type: 'string' },
          email:       { type: 'string', format: 'email' },
          designation: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const { slug } = request.params
    const { full_name, email, designation } = request.body

    const { data: deal } = await supabase
      .from('deals')
      .select('id, org_id, name, company_name, owner_id')
      .eq('room_slug', slug)
      .single()

    if (!deal) return reply.status(404).send({ error: 'Room not found.' })

    await supabase.from('engagement_events').insert({
      deal_id: deal.id,
      event_type: 'contract_signed',
      metadata: { signer_name: full_name, signer_email: email, designation },
    })

    await supabase.from('comments').insert({
      deal_id: deal.id,
      author_type: 'stakeholder',
      author_name: full_name,
      body: `✍ ${full_name} (${designation || 'Signatory'}) signed the contract on ${new Date().toLocaleDateString('en-IN')}.`,
    })

    const { sendEmailAlert } = await import('../services/email.js')
    const { data: owner } = await supabase.from('users').select('email, full_name').eq('id', deal.owner_id).single()
    if (owner) {
      sendEmailAlert({
        to: owner.email,
        subject: `🎉 ${deal.company_name} just signed the contract!`,
        body: `<p>Hi ${owner.full_name?.split(' ')[0]},</p>
               <p><strong>${full_name}</strong> from ${deal.company_name} just signed the contract for <strong>${deal.name}</strong>.</p>
               <p><a href="${process.env.FRONTEND_URL}/dashboard/deals/${deal.id}">Mark as Won →</a></p>`,
        deal,
      }).catch(console.error)
    }

    return reply.send({ signed: true, message: 'Contract signed. Your rep has been notified.' })
  })
}
