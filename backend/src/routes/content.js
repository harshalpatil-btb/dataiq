// dealiq/backend/src/routes/content.js
import { supabase } from '../lib/clients.js'

export default async function contentRoutes(app) {
  app.addHook('onRequest', app.authenticate)

  async function getOrgId(userId) {
    const { data } = await supabase.from('users').select('org_id').eq('id', userId).single()
    return data?.org_id
  }

  // GET /content — list all content items for org
  app.get('/', async (request, reply) => {
    const org_id = await getOrgId(request.user.sub)
    const { type, search, deal_id } = request.query

    let q = supabase.from('content_items').select('*').eq('org_id', org_id).order('created_at', { ascending: false })
    if (type)    q = q.eq('type', type)
    if (deal_id) q = q.eq('deal_id', deal_id)
    if (search)  q = q.ilike('title', `%${search}%`)

    const { data, error } = await q
    if (error) return reply.status(500).send({ error: error.message })
    return reply.send({ items: data })
  })

  // POST /content/upload — create content item record (file upload handled separately via Supabase Storage)
  app.post('/upload', async (request, reply) => {
    const org_id = await getOrgId(request.user.sub)
    const { title, type, file_url, thumbnail_url, deal_id, tags } = request.body

    const { data, error } = await supabase.from('content_items').insert({
      org_id, title, type, file_url, thumbnail_url,
      deal_id: deal_id || null,
      tags: tags || [],
      uploaded_by: request.user.sub,
    }).select().single()

    if (error) return reply.status(500).send({ error: error.message })
    return reply.status(201).send({ item: data })
  })

  // POST /content/:id/attach — attach library item to a deal
  app.post('/:id/attach', async (request, reply) => {
    const org_id = await getOrgId(request.user.sub)
    const { deal_id } = request.body

    // Verify deal belongs to org
    const { data: deal } = await supabase.from('deals').select('id').eq('id', deal_id).eq('org_id', org_id).single()
    if (!deal) return reply.status(404).send({ error: 'Deal not found.' })

    // Create a copy linked to the deal
    const { data: original } = await supabase.from('content_items').select('*').eq('id', request.params.id).single()
    if (!original) return reply.status(404).send({ error: 'Content item not found.' })

    const { data, error } = await supabase.from('content_items').insert({
      ...original,
      id: undefined,
      deal_id,
      view_count: 0,
      created_at: undefined,
      updated_at: undefined,
    }).select().single()

    if (error) return reply.status(500).send({ error: error.message })
    return reply.status(201).send({ item: data })
  })

  // DELETE /content/:id
  app.delete('/:id', async (request, reply) => {
    const org_id = await getOrgId(request.user.sub)
    await supabase.from('content_items').delete().eq('id', request.params.id).eq('org_id', org_id)
    return reply.send({ message: 'Deleted.' })
  })
}
