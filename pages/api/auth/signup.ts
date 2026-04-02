// pages/api/auth/signup.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '../../../lib/supabase'
import { nanoid } from 'nanoid'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { email, password, full_name, org_name } = req.body

  if (!email || !password || !full_name || !org_name) {
    return res.status(400).json({ error: 'All fields required' })
  }

  try {
    // 1. Create auth user in Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Skip email confirmation for now
    })
    if (authError) throw authError

    // 2. Create organization with 4-day trial
    const slug = org_name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-')
    const { data: org, error: orgError } = await supabaseAdmin
      .from('organizations')
      .insert({
        name: org_name,
        slug: `${slug}-${nanoid(4)}`,
        plan: 'trial',
        trial_ends_at: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .select()
      .single()
    if (orgError) throw orgError

    // 3. Create user profile linked to org
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .insert({
        id: authData.user.id,
        org_id: org.id,
        email,
        full_name,
        role: 'admin', // First user = admin
      })
      .select()
      .single()
    if (userError) throw userError

    // 4. Send welcome email via Resend
    await sendWelcomeEmail(email, full_name, org_name)

    return res.status(201).json({
      message: 'Account created successfully',
      user: { id: user.id, email, full_name, role: user.role },
      org: { id: org.id, name: org.name, plan: org.plan, trial_ends_at: org.trial_ends_at },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Signup failed'
    console.error('Signup error:', error)
    return res.status(500).json({ error: message })
  }
}

async function sendWelcomeEmail(email: string, name: string, orgName: string) {
  if (!process.env.RESEND_API_KEY) return
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL,
        to: email,
        subject: `Welcome to DealIQ, ${name.split(' ')[0]}! 🚀`,
        html: `
          <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:40px 20px">
            <h1 style="font-size:26px;font-weight:900;color:#111">Hey ${name.split(' ')[0]}, you're in! 🎉</h1>
            <p style="color:#666;line-height:1.7">Your <strong>${orgName}</strong> workspace is live. You have <strong>4 days free</strong> — no credit card needed.</p>
            <p style="color:#666;line-height:1.7">Your mission this week:<br>
              ✅ Create your first deal room (5 min)<br>
              ✅ Share the link with a prospect<br>
              ✅ Watch them engage in real-time
            </p>
            <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard" style="display:inline-block;background:#2d4ef5;color:#fff;padding:14px 28px;border-radius:9px;text-decoration:none;font-weight:700;margin-top:16px">Go to your dashboard →</a>
            <p style="color:#999;font-size:12px;margin-top:32px">Questions? Reply to this email — Vikram is real and reads every message.</p>
          </div>`,
      }),
    })
  } catch (e) {
    console.error('Welcome email failed:', e)
  }
}
