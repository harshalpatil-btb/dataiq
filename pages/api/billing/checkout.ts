// pages/api/billing/checkout.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import Stripe from 'stripe'
import { createServerSupabaseClient } from '@supabase/auth-helpers-nextjs'
import { supabaseAdmin } from '../../../lib/supabase'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-04-10' })

// Price ID map — create these in Stripe Dashboard
const PRICE_IDS: Record<string, string> = {
  starter_monthly: process.env.STRIPE_PRICE_STARTER_MONTHLY!,
  starter_annual:  process.env.STRIPE_PRICE_STARTER_ANNUAL!,
  growth_monthly:  process.env.STRIPE_PRICE_GROWTH_MONTHLY!,
  growth_annual:   process.env.STRIPE_PRICE_GROWTH_ANNUAL!,
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const supabase = createServerSupabaseClient({ req, res })
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return res.status(401).json({ error: 'Unauthorized' })

  const { plan, billing_cycle, gstin } = req.body
  const priceKey = `${plan}_${billing_cycle}`
  const priceId = PRICE_IDS[priceKey]

  if (!priceId) return res.status(400).json({ error: `Invalid plan: ${priceKey}` })

  try {
    // Get org + existing Stripe customer
    const { data: user } = await supabaseAdmin
      .from('users').select('org_id').eq('id', session.user.id).single()
    const { data: org } = await supabaseAdmin
      .from('organizations').select('*').eq('id', user!.org_id).single()

    // Create or reuse Stripe customer
    let customerId = org?.stripe_customer_id
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: session.user.email,
        name: org?.name,
        metadata: {
          org_id: org!.id,
          gstin: gstin || '',
          country: 'IN',
        },
      })
      customerId = customer.id
      await supabaseAdmin
        .from('organizations')
        .update({ stripe_customer_id: customerId })
        .eq('id', org!.id)
    }

    // Create Stripe Checkout session
    const checkoutSession = await stripe.checkout.sessions.create({
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      allow_promotion_codes: true,
      billing_address_collection: 'required',
      tax_id_collection: { enabled: true }, // For GSTIN
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?upgraded=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/pricing?canceled=true`,
      metadata: {
        org_id: org!.id,
        plan,
        billing_cycle,
        gstin: gstin || '',
      },
      subscription_data: {
        trial_period_days: 0, // Trial already running in-app
        metadata: { org_id: org!.id },
      },
    })

    return res.status(200).json({ url: checkoutSession.url })
  } catch (error) {
    console.error('Checkout error:', error)
    return res.status(500).json({ error: 'Failed to create checkout session' })
  }
}
