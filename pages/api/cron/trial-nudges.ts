// pages/api/cron/trial-nudges.ts
// Vercel calls this daily via cron. Set up in vercel.json.
// Sends Day 0 → Day 4 trial nudge emails automatically.

import type { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '../../../lib/supabase'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Protect: only Vercel Cron or your secret key can call this
  const authHeader = req.headers.authorization
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const now = new Date()
  const results = { day2: 0, day3: 0, day4: 0, expired: 0 }

  // Get all trial orgs
  const { data: trialOrgs } = await supabaseAdmin
    .from('organizations')
    .select('id, name, trial_ends_at')
    .eq('plan', 'trial')

  if (!trialOrgs) return res.status(200).json({ results })

  for (const org of trialOrgs) {
    const trialEnd = new Date(org.trial_ends_at)
    const hoursRemaining = (trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60)
    const daysRemaining = hoursRemaining / 24

    // Get org owner's email
    const { data: owner } = await supabaseAdmin
      .from('users').select('email, full_name').eq('org_id', org.id).eq('role', 'admin').single()
    if (!owner) continue

    const firstName = owner.full_name?.split(' ')[0] || 'there'

    // Day 2 nudge (48-56 hrs remaining)
    if (daysRemaining <= 2.33 && daysRemaining > 1.66) {
      await sendNudgeEmail(owner.email, 'day2', firstName, org.name, Math.ceil(daysRemaining))
      results.day2++
    }
    // Day 3 nudge (24-32 hrs remaining)
    else if (daysRemaining <= 1.33 && daysRemaining > 0.66) {
      await sendNudgeEmail(owner.email, 'day3', firstName, org.name, Math.ceil(daysRemaining))
      results.day3++
    }
    // Day 4 / final nudge (under 24 hrs)
    else if (daysRemaining <= 1 && daysRemaining > 0) {
      await sendNudgeEmail(owner.email, 'day4', firstName, org.name, Math.ceil(hoursRemaining))
      results.day4++
    }
    // Trial expired — feature lock (no negative hours)
    else if (hoursRemaining <= 0) {
      await supabaseAdmin
        .from('organizations')
        .update({ plan: 'trial' }) // keep as trial but flag expired
        .eq('id', org.id)
      results.expired++
    }
  }

  console.log('Trial nudge cron results:', results)
  return res.status(200).json({ results })
}

async function sendNudgeEmail(
  email: string, day: string, firstName: string, orgName: string, timeLeft: number
) {
  if (!process.env.RESEND_API_KEY) return

  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  const pricingUrl = `${appUrl}/pricing`

  const templates: Record<string, { subject: string; body: string }> = {
    day2: {
      subject: `${firstName}, your DealIQ trial is going strong 🚀`,
      body: `You've got <strong>${timeLeft} days left</strong> in your trial. If you've created a deal room and shared it — you already know the magic. <br><br>Upgrade now and lock in your pricing before the trial ends.`,
    },
    day3: {
      subject: `⏰ 1 day left in your DealIQ trial`,
      body: `Your trial ends tomorrow. Don't lose access to your deal rooms, buyer tracking, and Slack alerts.<br><br>Upgrade takes 2 minutes. No setup, no migration — your data stays exactly where it is.`,
    },
    day4: {
      subject: `⚠️ ${timeLeft} hours left — your DealIQ deal rooms will lock`,
      body: `Your trial ends in <strong>${timeLeft} hours</strong>. After that, your deal rooms go read-only and buyers who visit the links will see a "room closed" message.<br><br>Don't let a live deal go dark. Upgrade now — it takes 90 seconds.`,
    },
  }

  const { subject, body } = templates[day]
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM_EMAIL,
      to: email,
      subject,
      html: `
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:40px 20px">
          <h2 style="font-size:22px;font-weight:900;color:#111">${subject}</h2>
          <p style="color:#666;line-height:1.8">${body}</p>
          <a href="${pricingUrl}" style="display:inline-block;background:#2d4ef5;color:#fff;padding:14px 28px;border-radius:9px;text-decoration:none;font-weight:700;margin-top:20px">Upgrade DealIQ →</a>
          <p style="color:#aaa;font-size:11px;margin-top:28px">You're receiving this because you signed up for a DealIQ trial with ${orgName}. <a href="${appUrl}/unsubscribe" style="color:#aaa">Unsubscribe</a></p>
        </div>`,
    }),
  })
}
