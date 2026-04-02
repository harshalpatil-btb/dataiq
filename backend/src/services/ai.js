// dealiq/backend/src/services/ai.js

import { openai, supabase } from '../lib/clients.js'

/**
 * Generate an AI follow-up email draft using GPT-4o.
 * Called by automation engine when trigger fires.
 */
export async function generateAIDraft({
  deal_id,
  created_by,
  trigger_type,
  trigger_event_id,
  stakeholder,
  event,
}) {
  try {
    // Get full deal context
    const { data: deal } = await supabase
      .from('deals')
      .select(`
        *,
        owner:users!deals_owner_id_fkey(full_name, email, title),
        stakeholders(full_name, email, title, role_in_deal, engagement_score, last_seen_at, visit_count),
        map_tasks(title, status, due_date, owner_side),
        comments(body, author_name, created_at ORDER BY created_at DESC LIMIT 5)
      `)
      .eq('id', deal_id)
      .single()

    if (!deal) return null

    // Build context for GPT
    const signals = buildSignals(deal, event, stakeholder, trigger_type)
    const prompt  = buildPrompt(deal, signals, stakeholder, trigger_type)

    // Call GPT-4o
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 600,
      temperature: 0.7,
      messages: [
        {
          role: 'system',
          content: `You are an expert B2B sales writer. Write concise, personalised, high-converting sales emails.
Never use corporate jargon. Be specific and reference real details from the deal.
Write in first person as the sales rep. Output ONLY the email body — no subject line, no HTML.
Tone: professional but warm. Length: 100–180 words maximum.`,
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
    })

    const draftBody = response.choices[0].message.content.trim()

    // Build subject line
    const subject = buildSubject(trigger_type, deal, stakeholder)

    // Save draft to DB
    const { data: draft } = await supabase.from('ai_drafts').insert({
      deal_id,
      created_by,
      trigger_type,
      trigger_event_id,
      subject,
      body: draftBody,
      tone: 'professional',
      status: 'pending',
      model: 'gpt-4o',
      signals_used: signals,
    }).select().single()

    return draft

  } catch (err) {
    console.error('AI draft generation failed:', err)
    return null
  }
}

// ── PROMPT BUILDER ────────────────────────────────────────

function buildPrompt(deal, signals, stakeholder, triggerType) {
  const rep = deal.owner
  const who = stakeholder?.full_name || stakeholder?.email || 'the prospect'
  const overdueTasks = deal.map_tasks?.filter(t => t.status === 'overdue') || []
  const pendingTasks = deal.map_tasks?.filter(t => t.status === 'pending') || []
  const recentComments = deal.comments?.slice(0, 2).map(c => `"${c.body}" — ${c.author_name}`).join('\n') || 'None'

  const triggerContext = {
    pricing_viewed: `The buyer just spent ${signals.find(s => s.key === 'time_spent')?.value || 'significant time'} reading the pricing proposal. They are likely evaluating budget right now.`,
    new_stakeholder: `A new contact (${who}, ${stakeholder?.title || 'unknown role'}) just accessed the deal room for the first time. This could be a new decision maker.`,
    deal_stalled: `The deal has had no activity for ${signals.find(s => s.key === 'days_inactive')?.value || '3'} days. The buyer has gone quiet.`,
    question_posted: `The buyer just posted a question in the deal room discussion.`,
    contract_viewed: `The buyer just opened the contract — a very strong buying signal.`,
    map_task_overdue: `A buyer-side MAP task is overdue by ${signals.find(s => s.key === 'days_overdue')?.value || '1'} day(s): "${overdueTasks[0]?.title}".`,
  }

  return `
Write a follow-up email from ${rep.full_name} (${rep.title || 'Account Executive'}) to ${who} at ${deal.company_name}.

DEAL CONTEXT:
- Deal: ${deal.name}
- Company: ${deal.company_name}
- Stage: ${deal.stage}
- Deal value: ₹${deal.value?.toLocaleString('en-IN') || 'not set'}
- Close date target: ${deal.close_date || 'not set'}

TRIGGER:
${triggerContext[triggerType] || triggerType}

KEY SIGNALS:
${signals.map(s => `• ${s.label}: ${s.value}`).join('\n')}

PENDING ACTIONS:
${pendingTasks.slice(0, 3).map(t => `• ${t.title} (${t.due_date || 'no date'})`).join('\n') || 'None'}

RECENT CONVERSATION:
${recentComments}

Write a ${triggerType === 'deal_stalled' ? 're-engagement' : 'follow-up'} email that:
1. Opens with a specific reference to the trigger (not generic)
2. Adds value (insight, data, or a clear next step)
3. Ends with ONE clear call to action
4. Does NOT use: "I hope this email finds you well", "per my last email", "just checking in"
`.trim()
}

// ── SIGNAL BUILDER ────────────────────────────────────────

function buildSignals(deal, event, stakeholder, triggerType) {
  const signals = []

  if (event.duration_s > 0) {
    signals.push({ key: 'time_spent', label: 'Time spent on document', value: `${event.duration_s} seconds` })
  }

  if (stakeholder) {
    signals.push({ key: 'stakeholder_visits', label: 'Total room visits', value: stakeholder.visit_count || 1 })
    signals.push({ key: 'stakeholder_role', label: 'Stakeholder role', value: stakeholder.role_in_deal || 'unknown' })
    if (stakeholder.last_seen_at) {
      const days = Math.floor((Date.now() - new Date(stakeholder.last_seen_at)) / 86400000)
      signals.push({ key: 'days_since_last_visit', label: 'Days since last visit', value: days })
    }
  }

  if (deal.health_score) {
    signals.push({ key: 'health_score', label: 'Deal health score', value: deal.health_score })
  }

  const stalledDays = Math.floor((Date.now() - new Date(deal.updated_at)) / 86400000)
  if (stalledDays > 0) {
    signals.push({ key: 'days_inactive', label: 'Days inactive', value: stalledDays })
  }

  const overdueTasks = deal.map_tasks?.filter(t => t.status === 'overdue') || []
  if (overdueTasks.length > 0) {
    signals.push({ key: 'overdue_tasks', label: 'Overdue MAP tasks', value: overdueTasks.length })
  }

  return signals
}

// ── SUBJECT LINE BUILDER ──────────────────────────────────

function buildSubject(triggerType, deal, stakeholder) {
  const company = deal.company_name
  const who = stakeholder?.full_name?.split(' ')[0] || null

  const subjects = {
    pricing_viewed:  `Quick thought on the ${company} pricing`,
    new_stakeholder: `Welcome ${who ? who + ' to the' : 'to your'} deal room — ${company}`,
    deal_stalled:    `Still thinking about it, ${company}?`,
    question_posted: `Re: your question — ${company}`,
    contract_viewed: `Next step for ${company}`,
    map_task_overdue:`Gentle nudge on the ${company} timeline`,
  }

  return subjects[triggerType] || `Following up — ${company}`
}

// ── AI ROUTES (called from API) ───────────────────────────

export async function getDraftVariants({ deal_id, trigger_type, stakeholder_id, tone }) {
  const tones = ['professional', 'warm', 'direct', 'brief']
  const drafts = []

  for (const t of tones.slice(0, 3)) {
    // In production: call GPT with different tone prompts
    // For now: slight variation in subject
    drafts.push({ tone: t, subject: `[${t}] variant`, body: `Draft with ${t} tone...` })
  }

  return drafts
}
