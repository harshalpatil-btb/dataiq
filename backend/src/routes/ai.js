// dealiq/backend/src/routes/ai.js
import { supabase } from '../lib/clients.js'
import { generateAIDraft } from '../services/ai.js'
import { resend, FROM_EMAIL, FROM_NAME } from '../lib/clients.js'

export default async function aiRoutes(app) {
  app.addHook('onRequest', app.authenticate)

  async function getOrgId(userId) {
    const { data } = await supabase.from('users').select('org_id').eq('id', userId).single()
    return data?.org_id
  }

  // GET /ai/drafts/:dealId — list pending drafts for a deal
  app.get('/drafts/:dealId', async (request, reply) => {
    const { data } = await supabase.from('ai_drafts')
      .select('*').eq('deal_id', request.params.dealId)
      .order('created_at', { ascending: false }).limit(10)
    return reply.send({ drafts: data || [] })
  })

  // POST /ai/drafts/generate — manually trigger AI draft
  app.post('/drafts/generate', async (request, reply) => {
    const { deal_id, trigger_type } = request.body
    const draft = await generateAIDraft({
      deal_id, created_by: request.user.sub,
      trigger_type: trigger_type || 'manual', stakeholder: null, event: { duration_s: 0, metadata: {} },
    })
    if (!draft) return reply.status(500).send({ error: 'Could not generate draft. Check your OpenAI key.' })
    return reply.status(201).send({ draft })
  })

  // POST /ai/drafts/:id/send — rep approves and sends
  app.post('/drafts/:id/send', async (request, reply) => {
    const { data: draft } = await supabase.from('ai_drafts').select('*, deal:deals(*)').eq('id', request.params.id).single()
    if (!draft) return reply.status(404).send({ error: 'Draft not found.' })

    const finalBody   = request.body.body    || draft.body
    const finalSubject = request.body.subject || draft.subject
    const toEmail     = request.body.to

    if (!toEmail) return reply.status(400).send({ error: 'Recipient email required.' })

    // Send the email via Resend
    const { data: user } = await supabase.from('users').select('full_name, email').eq('id', request.user.sub).single()
    await resend.emails.send({
      from: `${user.full_name} via DealIQ <${FROM_EMAIL}>`,
      reply_to: user.email,
      to: toEmail,
      subject: finalSubject,
      html: finalBody.replace(/\n/g, '<br>'),
    })

    // Mark as sent
    await supabase.from('ai_drafts').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', draft.id)

    return reply.send({ sent: true })
  })

  // DELETE /ai/drafts/:id — discard
  app.delete('/drafts/:id', async (request, reply) => {
    await supabase.from('ai_drafts').update({ status: 'discarded' }).eq('id', request.params.id)
    return reply.send({ discarded: true })
  })
}
