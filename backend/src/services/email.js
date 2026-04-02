// dealiq/backend/src/services/email.js

import { resend, FROM_EMAIL, FROM_NAME } from '../lib/clients.js'

const LOGO = 'https://dealiq.io/logo.png' // update with your real logo URL

// ── BASE TEMPLATE ─────────────────────────────────────────
function baseTemplate(content) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { margin: 0; padding: 0; background: #f5f4f0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    .wrapper { max-width: 560px; margin: 32px auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid rgba(0,0,0,0.08); }
    .header { background: #0f0f18; padding: 28px 32px; display: flex; align-items: center; gap: 10px; }
    .logo-text { color: #fff; font-size: 18px; font-weight: 800; letter-spacing: -0.03em; }
    .logo-mark { width: 30px; height: 30px; border-radius: 8px; background: #3d5afe; display: inline-flex; align-items: center; justify-content: center; font-weight: 900; color: #fff; font-size: 13px; }
    .body { padding: 32px; }
    .body p { margin: 0 0 16px; font-size: 15px; color: #2e2e38; line-height: 1.65; }
    .body h2 { margin: 0 0 20px; font-size: 22px; font-weight: 800; letter-spacing: -0.03em; color: #111118; }
    .btn { display: inline-block; background: #3d5afe; color: #fff; padding: 13px 24px; border-radius: 10px; text-decoration: none; font-weight: 700; font-size: 14px; margin: 8px 0; }
    .btn-green { background: #16a34a; }
    .divider { height: 1px; background: rgba(0,0,0,0.07); margin: 24px 0; }
    .footer { padding: 20px 32px; background: #f5f4f0; text-align: center; font-size: 12px; color: #8a8898; }
    .footer a { color: #3d5afe; text-decoration: none; }
    .highlight-box { background: rgba(61,90,254,0.06); border: 1px solid rgba(61,90,254,0.15); border-radius: 10px; padding: 16px 20px; margin: 16px 0; }
    .highlight-box p { margin: 0; font-size: 14px; color: #3d5afe; font-weight: 600; }
    .stat-row { display: flex; gap: 16px; margin: 16px 0; }
    .stat-box { flex: 1; background: #f5f4f0; border-radius: 10px; padding: 14px; text-align: center; }
    .stat-num { font-size: 24px; font-weight: 900; color: #111118; letter-spacing: -0.04em; }
    .stat-lbl { font-size: 11px; color: #8a8898; text-transform: uppercase; letter-spacing: 0.06em; margin-top: 3px; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <div class="logo-mark">D</div>
      <div class="logo-text">DealIQ</div>
    </div>
    <div class="body">${content}</div>
    <div class="footer">
      DealIQ · <a href="${process.env.FRONTEND_URL}">dealiq.io</a> ·
      <a href="${process.env.FRONTEND_URL}/settings/notifications">Manage notifications</a> ·
      <a href="${process.env.FRONTEND_URL}/unsubscribe">Unsubscribe</a>
    </div>
  </div>
</body>
</html>`
}

async function send({ to, subject, html }) {
  try {
    const result = await resend.emails.send({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to,
      subject,
      html,
    })
    return result
  } catch (err) {
    console.error('Email send failed:', err)
    // Don't throw — email failures shouldn't break the app
  }
}

// ── WELCOME EMAIL ─────────────────────────────────────────
export async function sendWelcomeEmail({ email, full_name, org_name }) {
  const firstName = full_name?.split(' ')[0] || 'there'
  return send({
    to: email,
    subject: `Welcome to DealIQ, ${firstName} — your trial starts now 🚀`,
    html: baseTemplate(`
      <h2>Welcome aboard, ${firstName}! 🎉</h2>
      <p>Your DealIQ workspace for <strong>${org_name}</strong> is live. You have <strong>4 days</strong> to explore everything — no credit card needed.</p>
      <div class="highlight-box"><p>💡 Your first task: create a deal room and share it with a buyer. Most teams see their first engagement alert within 24 hours.</p></div>
      <a href="${process.env.FRONTEND_URL}/onboarding" class="btn">Complete setup in 5 min →</a>
      <div class="divider"></div>
      <p style="font-size:13px;color:#8a8898;">What to expect over your trial:</p>
      <p style="font-size:13px;color:#8a8898;">📧 Day 2: Your first buyer engagement alert<br>🔔 Day 3: Upgrade nudge with your real deal data<br>⏰ Day 4: Trial ends — upgrade to keep going</p>
    `),
  })
}

// ── MAGIC LINK / OTP EMAIL ────────────────────────────────
export async function sendMagicLinkEmail({ email, otp_code, expires_in_minutes }) {
  return send({
    to: email,
    subject: `${otp_code} is your DealIQ verification code`,
    html: baseTemplate(`
      <h2>Your sign-in code</h2>
      <p>Enter this code in DealIQ to sign in:</p>
      <div style="background:#f5f4f0;border-radius:12px;padding:24px;text-align:center;margin:20px 0;">
        <div style="font-size:42px;font-weight:900;letter-spacing:0.2em;color:#111118;font-family:'JetBrains Mono',monospace;">${otp_code}</div>
      </div>
      <p style="font-size:13px;color:#8a8898;">This code expires in ${expires_in_minutes || 10} minutes. If you didn't request this, ignore this email.</p>
    `),
  })
}

// ── ENGAGEMENT ALERT ──────────────────────────────────────
export async function sendEmailAlert({ to, subject, body, deal }) {
  return send({ to, subject, html: body })
}

// ── PRICING VIEWED ALERT ──────────────────────────────────
export async function sendPricingViewedAlert({ to, rep_name, deal_name, company, stakeholder_name, duration_s, deal_url }) {
  const firstName = rep_name?.split(' ')[0] || 'there'
  return send({
    to,
    subject: `🔥 ${company}: Pricing viewed for ${duration_s}s — strike while hot`,
    html: baseTemplate(`
      <h2>${company} is reading your pricing right now</h2>
      <p>Hi ${firstName} — <strong>${stakeholder_name || 'A buyer'}</strong> just spent <strong>${duration_s} seconds</strong> on your pricing proposal in the <strong>${deal_name}</strong> deal room.</p>
      <div class="stat-row">
        <div class="stat-box"><div class="stat-num">${duration_s}s</div><div class="stat-lbl">Time spent</div></div>
        <div class="stat-box"><div class="stat-num">🔥</div><div class="stat-lbl">Hot signal</div></div>
      </div>
      <div class="highlight-box"><p>🤖 An AI follow-up draft has been prepared. Review and send it in 1 click.</p></div>
      <a href="${deal_url}" class="btn">View deal + send follow-up →</a>
      <p style="font-size:13px;color:#8a8898;margin-top:20px;">Deals where reps follow up within 30 minutes of a pricing view are 67% more likely to close. This is your moment.</p>
    `),
  })
}

// ── DEAL STALLED ALERT ─────────────────────────────────────
export async function sendDealStalledAlert({ to, rep_name, deal_name, company, days_inactive, deal_url }) {
  const firstName = rep_name?.split(' ')[0] || 'there'
  return send({
    to,
    subject: `⚠ ${company} has been silent for ${days_inactive} days`,
    html: baseTemplate(`
      <h2>⚠ ${company} is going dark</h2>
      <p>Hi ${firstName} — your <strong>${deal_name}</strong> deal has had no buyer activity for <strong>${days_inactive} days</strong>.</p>
      <p>Deals that go dark for 5+ days close at less than 20% the normal rate. Now is the time to re-engage.</p>
      <div class="highlight-box"><p>🤖 DealIQ has drafted a re-engagement email for you. One click to review and send.</p></div>
      <a href="${deal_url}" class="btn">Re-engage ${company} →</a>
    `),
  })
}

// ── TRIAL ENDING NUDGE ────────────────────────────────────
export async function sendTrialEndingEmail({ email, full_name, days_left, deal_count, engagement_count }) {
  const firstName = full_name?.split(' ')[0] || 'there'
  const isLastDay = days_left <= 1

  return send({
    to: email,
    subject: isLastDay
      ? `⏰ Your DealIQ trial ends today — don't lose your deal rooms`
      : `⏰ ${days_left} days left in your DealIQ trial`,
    html: baseTemplate(`
      <h2>${isLastDay ? '⏰ Trial ending today' : `${days_left} days left in your trial`}</h2>
      <p>Hi ${firstName} — here's what you've done in DealIQ so far:</p>
      <div class="stat-row">
        <div class="stat-box"><div class="stat-num">${deal_count}</div><div class="stat-lbl">Deal Rooms</div></div>
        <div class="stat-box"><div class="stat-num">${engagement_count}</div><div class="stat-lbl">Buyer Events</div></div>
      </div>
      <p>${isLastDay
        ? 'After today, your deal rooms will be locked and real-time alerts will stop. Upgrade now to keep everything running.'
        : 'Upgrade before your trial ends to keep all deal rooms active, alerts running, and data intact.'
      }</p>
      <a href="${process.env.FRONTEND_URL}/pricing" class="btn btn-green">Upgrade now — starts at ₹2,999/mo →</a>
      <p style="font-size:13px;color:#8a8898;margin-top:16px;">Questions? Reply to this email — we respond within 2 hours.</p>
    `),
  })
}

// ── PAYMENT SUCCESS ───────────────────────────────────────
export async function sendPaymentSuccessEmail({ email, full_name, plan, org_name }) {
  const firstName = full_name?.split(' ')[0] || 'there'
  return send({
    to: email,
    subject: `✅ You're on DealIQ ${plan.charAt(0).toUpperCase() + plan.slice(1)} — let's close more deals`,
    html: baseTemplate(`
      <h2>You're all set, ${firstName}! 🎉</h2>
      <p>Your <strong>${org_name}</strong> workspace is now on the <strong>${plan.charAt(0).toUpperCase() + plan.slice(1)} plan</strong>. All features are unlocked.</p>
      <div class="highlight-box"><p>💡 Your GST invoice will be emailed separately within 24 hours.</p></div>
      <a href="${process.env.FRONTEND_URL}/dashboard" class="btn">Go to dashboard →</a>
    `),
  })
}

// ── PAYMENT FAILED ────────────────────────────────────────
export async function sendPaymentFailedEmail({ email, full_name }) {
  const firstName = full_name?.split(' ')[0] || 'there'
  return send({
    to: email,
    subject: `⚠ DealIQ payment failed — action needed`,
    html: baseTemplate(`
      <h2>Payment issue — let's fix this</h2>
      <p>Hi ${firstName} — we couldn't process your last DealIQ payment. Your subscription is currently paused.</p>
      <p>Update your payment method to restore full access to your deal rooms and alerts.</p>
      <a href="${process.env.FRONTEND_URL}/billing/portal" class="btn">Update payment method →</a>
      <p style="font-size:13px;color:#8a8898;margin-top:16px;">Need help? Reply to this email and we'll sort it out.</p>
    `),
  })
}

// ── NEW STAKEHOLDER ALERT ─────────────────────────────────
export async function sendNewStakeholderAlert({ to, rep_name, deal_name, company, stakeholder_name, stakeholder_title, deal_url }) {
  const firstName = rep_name?.split(' ')[0] || 'there'
  return send({
    to,
    subject: `👤 New buyer contact in ${company}: ${stakeholder_name}`,
    html: baseTemplate(`
      <h2>New stakeholder detected in ${company}</h2>
      <p>Hi ${firstName} — <strong>${stakeholder_name}</strong> (${stakeholder_title || 'Unknown title'}) just accessed your deal room for <strong>${deal_name}</strong> for the first time.</p>
      <div class="highlight-box"><p>💡 A new stakeholder often means the deal is being escalated internally. This could be the decision maker — reach out now.</p></div>
      <a href="${deal_url}" class="btn">View stakeholder profile →</a>
    `),
  })
}
