// dealiq/backend/src/services/automation.js
// Checks automation rules and fires actions when triggered

import { supabase } from '../lib/clients.js'
import { sendSlackAlert, sendEmailAlert } from './notifications.js'
import { generateAIDraft } from './ai.js'

/**
 * Called after every engagement event.
 * Checks all active automation rules for the deal's org
 * and fires matching ones.
 */
export async function triggerAutomations({ deal, event, stakeholderId }) {
  // Get all active rules for this org
  const { data: rules } = await supabase
    .from('automation_rules')
    .select('*')
    .eq('org_id', deal.org_id)
    .eq('is_active', true)

  if (!rules || rules.length === 0) return

  for (const rule of rules) {
    try {
      const matches = await doesRuleMatch(rule, deal, event)
      if (!matches) continue

      // Fire actions
      await executeActions(rule, deal, event, stakeholderId)

      // Log the run
      await supabase.from('automation_runs').insert({
        rule_id: rule.id,
        deal_id: deal.id,
        status: 'success',
        actions_taken: rule.actions,
      })

      // Update rule stats
      await supabase.from('automation_rules')
        .update({ fire_count: rule.fire_count + 1, last_fired_at: new Date().toISOString() })
        .eq('id', rule.id)

    } catch (err) {
      console.error(`Automation rule ${rule.id} failed:`, err)
      await supabase.from('automation_runs').insert({
        rule_id: rule.id,
        deal_id: deal.id,
        status: 'failed',
        error_message: err.message,
      })
    }
  }
}

// ── RULE MATCHING ─────────────────────────────────────────

async function doesRuleMatch(rule, deal, event) {
  const cfg = rule.trigger_config || {}
  const filter = rule.filter_config || {}

  // Check trigger type matches event type
  const triggerToEvent = {
    pricing_viewed:    ['content_opened'],
    new_stakeholder:   ['stakeholder_joined'],
    map_task_overdue:  ['__scheduled__'], // handled by cron
    question_posted:   ['question_posted'],
    contract_viewed:   ['contract_viewed'],
    first_room_view:   ['room_viewed'],
    deal_won:          ['__deal_status__'],
    deal_lost:         ['__deal_status__'],
  }

  const matchingEvents = triggerToEvent[rule.trigger_type]
  if (!matchingEvents) return false
  if (!matchingEvents.includes(event.event_type) && !matchingEvents.includes('__scheduled__')) return false

  // Special: pricing_viewed — check if it was the pricing content and enough time spent
  if (rule.trigger_type === 'pricing_viewed') {
    const minSeconds = cfg.min_seconds || 30
    if (event.duration_s < minSeconds) return false
    // Check if content is a pricing document
    if (event.metadata?.content_type && !['pricing','proposal'].includes(event.metadata.content_type)) return false
  }

  // Filter: stage restriction
  if (filter.stages && filter.stages.length > 0) {
    if (!filter.stages.includes(deal.stage)) return false
  }

  // Filter: min deal value
  if (filter.min_value && deal.value < filter.min_value) return false

  // Deduplication: don't fire same rule on same deal more than once per hour
  const { count } = await supabase
    .from('automation_runs')
    .select('*', { count: 'exact', head: true })
    .eq('rule_id', rule.id)
    .eq('deal_id', deal.id)
    .gte('fired_at', new Date(Date.now() - 60 * 60 * 1000).toISOString())

  if (count > 0) return false

  return true
}

// ── ACTION EXECUTION ──────────────────────────────────────

async function executeActions(rule, deal, event, stakeholderId) {
  const actions = rule.actions || []

  // Get deal owner's details
  const { data: owner } = await supabase
    .from('users')
    .select('*')
    .eq('id', deal.owner_id)
    .single()

  // Get stakeholder if available
  let stakeholder = null
  if (stakeholderId) {
    const { data } = await supabase.from('stakeholders').select('*').eq('id', stakeholderId).single()
    stakeholder = data
  }

  for (const action of actions) {
    switch (action.type) {

      case 'slack_dm': {
        if (!owner.slack_user_id || !owner.notify_slack) break
        const message = buildSlackMessage(rule.trigger_type, deal, event, stakeholder)
        await sendSlackAlert({ user_id: owner.slack_user_id, message })
        break
      }

      case 'email_alert': {
        if (!owner.notify_email) break
        const subject = buildEmailSubject(rule.trigger_type, deal, stakeholder)
        const body    = buildEmailBody(rule.trigger_type, deal, event, stakeholder)
        await sendEmailAlert({ to: owner.email, subject, body, deal })
        break
      }

      case 'generate_ai_draft': {
        await generateAIDraft({
          deal_id: deal.id,
          created_by: deal.owner_id,
          trigger_type: rule.trigger_type,
          trigger_event_id: event.id,
          stakeholder,
          event,
        })
        break
      }

      case 'update_deal_stage': {
        if (action.config?.stage) {
          await supabase.from('deals')
            .update({ stage: action.config.stage })
            .eq('id', deal.id)
        }
        break
      }

      case 'webhook': {
        if (action.config?.url) {
          await fetch(action.config.url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ deal, event, stakeholder, rule_id: rule.id }),
          }).catch(console.error)
        }
        break
      }
    }
  }
}

// ── MESSAGE BUILDERS ──────────────────────────────────────

function buildSlackMessage(triggerType, deal, event, stakeholder) {
  const who = stakeholder?.full_name || stakeholder?.email || 'Someone'
  const msgs = {
    pricing_viewed:  `🔥 *${who}* just spent ${event.duration_s}s on your pricing proposal in *${deal.company_name}*. Strike now! 👉 ${process.env.FRONTEND_URL}/deals/${deal.id}`,
    new_stakeholder: `👤 New contact *${who}* just joined the *${deal.company_name}* deal room. They might be a decision maker! 👉 ${process.env.FRONTEND_URL}/deals/${deal.id}`,
    question_posted: `❓ *${who}* posted a question in *${deal.company_name}*: "${event.metadata?.question_preview || 'View in dashboard'}" 👉 ${process.env.FRONTEND_URL}/deals/${deal.id}`,
    contract_viewed: `📝 *${who}* just opened the contract in *${deal.company_name}* — this is a strong buying signal! 👉 ${process.env.FRONTEND_URL}/deals/${deal.id}`,
    first_room_view: `👁 *${who}* opened your deal room for *${deal.company_name}* for the first time! 👉 ${process.env.FRONTEND_URL}/deals/${deal.id}`,
  }
  return msgs[triggerType] || `⚡ Activity in ${deal.company_name}: ${triggerType}`
}

function buildEmailSubject(triggerType, deal, stakeholder) {
  const who = stakeholder?.full_name || stakeholder?.email || 'A buyer'
  const subjects = {
    pricing_viewed:  `🔥 ${deal.company_name}: Pricing just viewed — act now`,
    new_stakeholder: `👤 New contact in your ${deal.company_name} deal`,
    question_posted: `❓ ${deal.company_name} posted a question`,
    deal_stalled:    `⚠ ${deal.company_name} hasn't been active in 3 days`,
    contract_viewed: `📝 ${deal.company_name} just opened the contract`,
  }
  return subjects[triggerType] || `⚡ Activity in ${deal.company_name}`
}

function buildEmailBody(triggerType, deal, event, stakeholder) {
  const who = stakeholder?.full_name || stakeholder?.email || 'A buyer'
  return `
    <p>Hi there,</p>
    <p><strong>${who}</strong> just triggered an alert in your deal with <strong>${deal.company_name}</strong>.</p>
    <p>Trigger: <strong>${triggerType.replace(/_/g, ' ')}</strong></p>
    <p><a href="${process.env.FRONTEND_URL}/deals/${deal.id}" style="background:#3d5afe;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;margin-top:12px">View Deal Room →</a></p>
    <hr>
    <p style="font-size:12px;color:#888">DealIQ · <a href="${process.env.FRONTEND_URL}/settings/notifications">Manage notifications</a></p>
  `
}

// ── SCHEDULED AUTOMATION (called by cron worker) ──────────

export async function runScheduledAutomations() {
  // Check for stalled deals (no activity in 3 days)
  const { data: stalledDeals } = await supabase
    .from('deals')
    .select(`
      *,
      org:organizations(id, plan)
    `)
    .eq('status', 'active')
    .not('stage', 'in', '("won","lost")')
    .lt('updated_at', new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString())

  for (const deal of stalledDeals || []) {
    // Check if stall rule exists for this org
    const { data: rules } = await supabase
      .from('automation_rules')
      .select('*')
      .eq('org_id', deal.org_id)
      .eq('trigger_type', 'deal_stalled')
      .eq('is_active', true)

    for (const rule of rules || []) {
      const fakeEvent = { event_type: '__scheduled__', duration_s: 0, metadata: {}, id: null }
      const matches = await doesRuleMatch(rule, deal, fakeEvent)
      if (matches) {
        await executeActions(rule, deal, fakeEvent, null)
      }
    }
  }

  // Check for overdue MAP tasks
  const { data: overdueTasks } = await supabase
    .from('map_tasks')
    .select('*, deal:deals(*)')
    .eq('status', 'pending')
    .eq('owner_side', 'buyer')
    .lt('due_date', new Date().toISOString().split('T')[0])

  for (const task of overdueTasks || []) {
    await supabase.from('map_tasks').update({ status: 'overdue' }).eq('id', task.id)
    // Trigger map_task_overdue automation
    const fakeEvent = { event_type: '__scheduled__', metadata: { task }, id: null, duration_s: 0 }
    const { data: rules } = await supabase
      .from('automation_rules')
      .select('*')
      .eq('org_id', task.deal.org_id)
      .eq('trigger_type', 'map_task_overdue')
      .eq('is_active', true)

    for (const rule of rules || []) {
      await executeActions(rule, task.deal, fakeEvent, null)
    }
  }
}
