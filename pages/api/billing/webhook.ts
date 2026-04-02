// pages/api/billing/webhook.ts
// Stripe sends events here when payments succeed, fail, subscriptions change
// Set this URL in Stripe Dashboard → Webhooks → Add endpoint

import type { NextApiRequest, NextApiResponse } from 'next'
import Stripe from 'stripe'
import { supabaseAdmin } from '../../../lib/supabase'
import { buffer } from 'micro'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-04-10' })

// Disable Next.js body parsing — Stripe needs raw body to verify signature
export const config = { api: { bodyParser: false } }

const PLAN_MAP: Record<string, string> = {
  [process.env.STRIPE_PRICE_STARTER_MONTHLY!]: 'starter',
  [process.env.STRIPE_PRICE_STARTER_ANNUAL!]:  'starter',
  [process.env.STRIPE_PRICE_GROWTH_MONTHLY!]:  'growth',
  [process.env.STRIPE_PRICE_GROWTH_ANNUAL!]:   'growth',
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const sig = req.headers['stripe-signature']!
  const rawBody = await buffer(req)

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return res.status(400).send(`Webhook Error: ${err}`)
  }

  try {
    switch (event.type) {

      // ── Payment succeeded → activate subscription ────────────
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.CheckoutSession
        const orgId = session.metadata?.org_id
        const plan = session.metadata?.plan || 'starter'
        const billingCycle = session.metadata?.billing_cycle || 'monthly'

        if (orgId) {
          await supabaseAdmin.from('organizations').update({
            plan,
            stripe_subscription_id: session.subscription as string,
          }).eq('id', orgId)

          await supabaseAdmin.from('subscriptions').upsert({
            org_id: orgId,
            stripe_subscription_id: session.subscription as string,
            stripe_price_id: session.metadata?.price_id,
            plan,
            billing_cycle: billingCycle,
            status: 'active',
          })

          await sendUpgradeConfirmationEmail(session.customer_email!, plan, orgId)
          console.log(`✅ Org ${orgId} upgraded to ${plan}`)
        }
        break
      }

      // ── Subscription updated (plan change, renewal) ──────────
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription
        const orgId = sub.metadata?.org_id
        const priceId = sub.items.data[0]?.price?.id
        const plan = PLAN_MAP[priceId] || 'starter'

        if (orgId) {
          await supabaseAdmin.from('organizations')
            .update({ plan, stripe_subscription_id: sub.id })
            .eq('id', orgId)

          await supabaseAdmin.from('subscriptions')
            .update({
              status: sub.status as string,
              plan,
              current_period_start: new Date(sub.current_period_start * 1000).toISOString(),
              current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
            })
            .eq('stripe_subscription_id', sub.id)
        }
        break
      }

      // ── Subscription cancelled ────────────────────────────────
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        const orgId = sub.metadata?.org_id
        if (orgId) {
          await supabaseAdmin.from('organizations')
            .update({ plan: 'trial' })
            .eq('id', orgId)
          await supabaseAdmin.from('subscriptions')
            .update({ status: 'canceled' })
            .eq('stripe_subscription_id', sub.id)
        }
        break
      }

      // ── Payment failed → notify and downgrade ────────────────
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const customerId = invoice.customer as string
        const { data: org } = await supabaseAdmin
          .from('organizations').select('id').eq('stripe_customer_id', customerId).single()
        if (org) {
          await supabaseAdmin.from('subscriptions')
            .update({ status: 'past_due' })
            .eq('org_id', org.id)
          // TODO: send payment failed email
        }
        break
      }
    }

    return res.status(200).json({ received: true })
  } catch (err) {
    console.error('Webhook handler error:', err)
    return res.status(500).json({ error: 'Webhook processing failed' })
  }
}

async function sendUpgradeConfirmationEmail(email: string, plan: string, orgId: string) {
  if (!process.env.RESEND_API_KEY || !email) return
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM_EMAIL,
      to: email,
      subject: `🎉 Welcome to DealIQ ${plan.charAt(0).toUpperCase() + plan.slice(1)}!`,
      html: `
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:40px 20px">
          <h1 style="font-size:26px;font-weight:900;color:#111">You're on DealIQ ${plan}! 🚀</h1>
          <p style="color:#666;line-height:1.7">Your subscription is active. All features are now unlocked.</p>
          <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard" style="display:inline-block;background:#2d4ef5;color:#fff;padding:14px 28px;border-radius:9px;text-decoration:none;font-weight:700;margin-top:16px">Go to dashboard →</a>
          <p style="color:#999;font-size:12px;margin-top:24px">A GST invoice has been sent to your billing email.</p>
        </div>`,
    }),
  })
}
