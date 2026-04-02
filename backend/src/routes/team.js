// dealiq/backend/src/routes/team.js
import { supabase } from '../lib/clients.js'
import { resend, FROM_EMAIL, FROM_NAME } from '../lib/clients.js'

export default async function teamRoutes(app) {
  app.addHook('onRequest', app.authenticate)

  async function getUserOrg(userId) {
    const { data } = await supabase.from('users').select('org_id, role, organizations(*)').eq('id', userId).single()
    return data
  }

  // GET /team — list all team members
  app.get('/', async (request, reply) => {
    const { org_id } = await getUserOrg(request.user.sub)
    const { data, error } = await supabase
      .from('users')
      .select('id, email, full_name, role, title, avatar_url, last_active_at, created_at')
      .eq('org_id', org_id)
      .order('created_at', { ascending: true })
    if (error) return reply.status(500).send({ error: error.message })
    return reply.send({ members: data })
  })

  // POST /team/invite — invite a new team member
  app.post('/invite', {
    schema: {
      body: {
        type: 'object',
        required: ['email', 'role'],
        properties: {
          email:     { type: 'string', format: 'email' },
          full_name: { type: 'string' },
          role:      { type: 'string', enum: ['admin','sales','analyst','viewer'] },
        },
      },
    },
  }, async (request, reply) => {
    const userId = request.user.sub
    const { org_id, role, organizations: org } = await getUserOrg(userId)

    // Only admins can invite
    if (role !== 'admin') return reply.status(403).send({ error: 'Only admins can invite team members.' })

    // Check seat limit
    const { count } = await supabase.from('users').select('*', { count: 'exact', head: true }).eq('org_id', org_id)
    if (org.plan !== 'enterprise' && org.plan !== 'growth' && count >= org.seat_count) {
      return reply.status(403).send({ error: 'seat_limit', message: 'Seat limit reached. Upgrade to add more members.' })
    }

    const { email, full_name, role: inviteRole } = request.body

    // Check not already a member
    const { data: existing } = await supabase.from('users').select('id').eq('org_id', org_id).eq('email', email).single()
    if (existing) return reply.status(409).send({ error: 'This person is already on your team.' })

    // Send invite via Supabase auth
    const { data: invite, error } = await supabase.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${process.env.FRONTEND_URL}/auth/accept-invite`,
      data: { org_id, full_name, role: inviteRole },
    })

    if (error) return reply.status(500).send({ error: error.message })

    // Pre-create user profile (will be filled on first login)
    await supabase.from('users').insert({
      id: invite.user.id,
      org_id,
      email,
      full_name: full_name || email.split('@')[0],
      role: inviteRole,
    }).catch(() => {}) // ignore if already exists

    return reply.status(201).send({ message: `Invite sent to ${email}.` })
  })

  // PATCH /team/:userId — update role
  app.patch('/:userId', async (request, reply) => {
    const { org_id, role } = await getUserOrg(request.user.sub)
    if (role !== 'admin') return reply.status(403).send({ error: 'Only admins can change roles.' })

    const { data, error } = await supabase
      .from('users')
      .update({ role: request.body.role, title: request.body.title })
      .eq('id', request.params.userId)
      .eq('org_id', org_id)
      .select().single()

    if (error) return reply.status(500).send({ error: error.message })
    return reply.send({ member: data })
  })

  // DELETE /team/:userId — remove member
  app.delete('/:userId', async (request, reply) => {
    const { org_id, role } = await getUserOrg(request.user.sub)
    if (role !== 'admin') return reply.status(403).send({ error: 'Only admins can remove members.' })
    if (request.params.userId === request.user.sub) return reply.status(400).send({ error: "You can't remove yourself." })

    await supabase.from('users').delete().eq('id', request.params.userId).eq('org_id', org_id)
    return reply.send({ message: 'Team member removed.' })
  })

  // GET /team/stats — performance stats for each rep
  app.get('/stats', async (request, reply) => {
    const { org_id } = await getUserOrg(request.user.sub)
    const { data: members } = await supabase.from('users').select('id, full_name, role').eq('org_id', org_id)

    const stats = await Promise.all((members || []).map(async (m) => {
      const [{ count: activeDeals }, { data: wonDeals }] = await Promise.all([
        supabase.from('deals').select('*', { count: 'exact', head: true }).eq('owner_id', m.id).eq('status', 'active'),
        supabase.from('deals').select('value').eq('owner_id', m.id).eq('status', 'won'),
      ])
      const pipeline = wonDeals?.reduce((s, d) => s + (d.value || 0), 0) || 0
      return { ...m, active_deals: activeDeals, deals_won: wonDeals?.length || 0, pipeline_value: pipeline }
    }))

    return reply.send({ stats })
  })
}
