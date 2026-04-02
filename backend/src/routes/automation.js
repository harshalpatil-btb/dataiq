// dealiq/backend/src/routes/automation.js
import { supabase } from '../lib/clients.js'

export default async function automationRoutes(app) {
  app.addHook('onRequest', app.authenticate)

  async function getOrgId(userId) {
    const { data } = await supabase.from('users').select('org_id').eq('id', userId).single()
    return data?.org_id
  }

  // GET /automation/rules
  app.get('/rules', async (request, reply) => {
    const org_id = await getOrgId(request.user.sub)
    const { data, error } = await supabase.from('automation_rules').select('*').eq('org_id', org_id).order('created_at')
    if (error) return reply.status(500).send({ error: error.message })
    return reply.send({ rules: data })
  })

  // POST /automation/rules — create a new rule
  app.post('/rules', async (request, reply) => {
    const org_id = await getOrgId(request.user.sub)
    const { data, error } = await supabase.from('automation_rules').insert({
      ...request.body,
      org_id,
      created_by: request.user.sub,
    }).select().single()
    if (error) return reply.status(500).send({ error: error.message })
    return reply.status(201).send({ rule: data })
  })

  // PATCH /automation/rules/:id
  app.patch('/rules/:id', async (request, reply) => {
    const org_id = await getOrgId(request.user.sub)
    const { data, error } = await supabase.from('automation_rules')
      .update(request.body).eq('id', request.params.id).eq('org_id', org_id).select().single()
    if (error) return reply.status(500).send({ error: error.message })
    return reply.send({ rule: data })
  })

  // DELETE /automation/rules/:id
  app.delete('/rules/:id', async (request, reply) => {
    const org_id = await getOrgId(request.user.sub)
    await supabase.from('automation_rules').delete().eq('id', request.params.id).eq('org_id', org_id)
    return reply.send({ message: 'Rule deleted.' })
  })

  // GET /automation/runs
  app.get('/runs', async (request, reply) => {
    const org_id = await getOrgId(request.user.sub)
    const { rule_id } = request.query
    let q = supabase.from('automation_runs')
      .select('*, rule:automation_rules(name,trigger_type)')
      .eq('automation_rules.org_id', org_id)
      .order('fired_at', { ascending: false })
      .limit(50)
    if (rule_id) q = q.eq('rule_id', rule_id)
    const { data } = await q
    return reply.send({ runs: data || [] })
  })
}
