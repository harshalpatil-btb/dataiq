// pages/api/room/[slug]/engage.ts
// Called by buyer-facing deal room on every interaction
// No auth required — public endpoint

import type { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '../../../../lib/supabase'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { slug } = req.query
  const {
    event_type,
    stakeholder_email,
    stakeholder_name,
    content_id,
    duration_seconds,
    metadata = {},
  } = req.body

  if (!event_type) return res.status(400).json({ error: 'event_type required' })

  try {
    // 1. Get deal by slug
    const { data: deal } = await supabaseAdmin
      .from('deals')
      .select('id, org_id, owner_id, company_name, name, status')
      .eq('room_slug', slug as string)
      .single()

    if (!deal) return res.status(404).json({ error: 'Room not found' })
    if (deal.status === 'archived') return res.status(410).json({ error: 'Room is closed' })

    // 2. Resolve or create stakeholder
    let stakeholderId: string | null = null
    if (stakeholder_email) {
      const { data: existing } = await supabaseAdmin
        .from('stakeholders')
        .select('id')
        .eq('deal_id', deal.id)
        .eq('email', stakeholder_email)
        .single()

      if (existing) {
        stakeholderId = existing.id
        // Update last_seen
        await supabaseAdmin
          .from('stakeholders')
          .update({ last_seen_at: new Date().toISOString() })
          .eq('id', stakeholderId)
      } else {
        // New stakeholder — auto-create and fire automation
        const { data: newSH } = await supabaseAdmin
          .from('stakeholders')
          .insert({
            deal_id: deal.id,
            email: stakeholder_email,
            full_name: stakeholder_name || stakeholder_email,
            last_seen_at: new Date().toISOString(),
          })
          .select()
          .single()
        if (newSH) {
          stakeholderId = newSH.id
          // Fire new_stakeholder automation
          await fireAutomation(deal.org_id, deal.id, deal.owner_id, 'new_stakeholder', {
            stakeholder_email,
            stakeholder_name: stakeholder_name || stakeholder_email,
            deal_name: deal.name,
            company_name: deal.company_name,
          })
        }
      }
    }

    // 3. Record engagement event
    await supabaseAdmin.from('engagement_events').insert({
      deal_id: deal.id,
      stakeholder_id: stakeholderId,
      event_type,
      content_id: content_id || null,
      duration_seconds: duration_seconds || null,
      metadata,
      ip_address: req.headers['x-forwarded-for'] as string || req.socket.remoteAddress,
      user_agent: req.headers['user-agent'],
    })

    // 4. Fire automation rules based on event type
    if (event_type === 'content_viewed' && metadata?.content_title?.toLowerCase().includes('pric')) {
      await fireAutomation(deal.org_id, deal.id, deal.owner_id, 'pricing_viewed', {
        stakeholder_email,
        stakeholder_name,
        duration_seconds,
        deal_name: deal.name,
        company_name: deal.company_name,
        content_title: metadata.content_title,
      })
    }

    // 5. Recalculate health score asynchronously
    await supabaseAdmin.rpc('calculate_health_score', { p_deal_id: deal.id }).then(({ data: score }) => {
      if (score) supabaseAdmin.from('deals').update({ health_score: score }).eq('id', deal.id)
    })

    return res.status(200).json({ ok: true })
  } catch (error) {
    console.error('Engagement tracking error:', error)
    return res.status(500).json({ error: 'Internal error' })
  }
}

// ── Automation Engine ──────────────────────────────────────────
async function fireAutomation(
  orgId: string,
  dealId: string,
  ownerId: string,
  triggerType: string,
  context: Record<string, unknown>
) {
  // Get matching active rules for this org
  const { data: rules } = await supabaseAdmin
    .from('automation_rules')
    .select('*')
    .eq('org_id', orgId)
    .eq('trigger_type', triggerType)
    .eq('is_active', true)

  if (!rules?.length) return

  // Get deal owner's email for notifications
  const { data: owner } = await supabaseAdmin
    .from('users').select('email, full_name').eq('id', ownerId).single()

  for (const rule of rules) {
    const actions = rule.actions as Array<{ type: string; config: Record<string, unknown> }>
    for (const action of actions) {
      await executeAction(action, context, owner, dealId, rule.id)
    }

    // Increment fired count
    await supabaseAdmin
      .from('automation_rules')
      .update({ fired_count: rule.fired_count + 1 })
      .eq('id', rule.id)
  }
}

async function executeAction(
  action: { type: string; config: Record<string, unknown> },
  context: Record<string, unknown>,
  owner: { email: string; full_name?: string } | null,
  dealId: string,
  ruleId: string
) {
  try {
    switch (action.type) {
      case 'email_rep':
        if (owner?.email) await sendRepAlert(owner.email, owner.full_name || 'there', context)
        break

      case 'generate_ai_draft':
        // Queue AI draft generation (Phase 2 — requires OpenAI key)
        console.log('AI draft queued for deal:', dealId, 'context:', context)
        break

      case 'crm_sync':
        // CRM sync hook (Phase 2)
        console.log('CRM sync triggered for deal:', dealId)
        break
    }
  } catch (e) {
    console.error(`Action ${action.type} failed for rule ${ruleId}:`, e)
  }
}

// ── Email Alert to Rep ─────────────────────────────────────────
async function sendRepAlert(
  repEmail: string,
  repName: string,
  context: Record<string, unknown>
) {
  if (!process.env.RESEND_API_KEY) return

  const firstName = (repName || 'there').split(' ')[0]
  const company = context.company_name as string
  const stakeholder = context.stakeholder_name as string
  const duration = context.duration_seconds as number
  const trigger = context.content_title || 'your deal room'
  const dealName = context.deal_name as string
  const appUrl = process.env.NEXT_PUBLIC_APP_URL

  const subject = duration
    ? `🔥 ${company} just spent ${Math.round(duration / 60)}m on ${trigger} — strike now!`
    : `👤 New stakeholder ${stakeholder} joined your ${company} deal room`

  const html = `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:32px 20px;background:#f9f9f9">
      <div style="background:#fff;border-radius:16px;padding:32px;box-shadow:0 2px 12px rgba(0,0,0,.06)">
        <div style="font-size:28px;margin-bottom:8px">${duration ? '🔥' : '👤'}</div>
        <h2 style="font-size:20px;font-weight:900;color:#111;margin-bottom:8px">${subject}</h2>
        <p style="color:#666;line-height:1.7;margin-bottom:20px">
          Hey ${firstName},<br><br>
          ${duration
            ? `<strong>${stakeholder || 'A stakeholder'}</strong> at <strong>${company}</strong> just spent <strong>${Math.round(duration / 60)} minutes</strong> on your pricing proposal. They're reading right now — this is your window.`
            : `<strong>${stakeholder}</strong> just joined your <strong>${company}</strong> deal room for the first time. Auto-enrichment is running in the background.`
          }
        </p>
        <div style="background:#f5f5f5;border-radius:10px;padding:16px;margin-bottom:24px;font-size:13px;color:#555">
          <strong>Deal:</strong> ${dealName}<br>
          <strong>Company:</strong> ${company}<br>
          ${stakeholder ? `<strong>Stakeholder:</strong> ${stakeholder}<br>` : ''}
          ${duration ? `<strong>Time spent:</strong> ${Math.round(duration / 60)}m ${duration % 60}s<br>` : ''}
          <strong>Time:</strong> ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST
        </div>
        <a href="${appUrl}/dashboard" style="display:inline-block;background:#2d4ef5;color:#fff;padding:13px 24px;border-radius:9px;text-decoration:none;font-weight:700;font-size:14px">View deal + AI draft →</a>
        <p style="color:#bbb;font-size:11px;margin-top:24px">This alert was triggered by your DealIQ automation. <a href="${appUrl}/settings/automation" style="color:#bbb">Manage alerts</a></p>
      </div>
    </div>`

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM_EMAIL,
      to: repEmail,
      reply_to: process.env.RESEND_REPLY_TO,
      subject,
      html,
    }),
  })
}
