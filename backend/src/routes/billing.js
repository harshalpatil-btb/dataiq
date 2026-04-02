// dealiq/backend/src/routes/billing.js

import { supabase } from '../lib/clients.js'
import { stripe, STRIPE_PRICES } from '../lib/clients.js'

export default async function billingRoutes(app) {

  app.addHook('onRequest', app.authenticate)

  async function getOrgForUser(userId) {
    const { data } = await supabase.from('users').select('org_id, organizations(*)').eq('id', userId).single()
    return { org_id: data.org_id, org: data.organizations }
  }

  // ── CREATE CHECKOUT SESSION ───────────────────────────────
  app.post('/checkout', {
    schema: {
      body: {
        type: 'object',
        required: ['plan', 'billing_cycle'],
        properties: {
          plan:          { type: 'string', enum: ['starter', 'growth'] },
          billing_cycle: { type: 'string', enum: ['monthly', 'annual'] },
          coupon:        { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const userId = request.user.sub
    const { org_id, org } = await getOrgForUser(userId)
    const { plan, billing_cycle, coupon } = request.body
    const { data: user } = await supabase.from('users').select('email, full_name').eq('id', userId).single()

    const priceKey = `${plan}_${billing_cycle}`
    const priceId  = STRIPE_PRICES[priceKey]

    if (!priceId) return reply.status(400).send({ error: 'Invalid plan or billing cycle.' })

    // Get or create Stripe customer
    let customerId = org.stripe_customer_id
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name:  user.full_name,
        metadata: { org_id, user_id: userId },
      })
      customerId = customer.id
      await supabase.from('organizations').update({ stripe_customer_id: customerId }).eq('id', org_id)
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      ...(coupon ? { discounts: [{ coupon }] } : {}),
      subscription_data: {
        trial_period_days: 0, // trial already handled in app
        metadata: { org_id, plan, billing_cycle },
      },
      success_url: `${process.env.FRONTEND_URL}/dashboard?upgraded=true`,
      cancel_url:  `${process.env.FRONTEND_URL}/pricing?canceled=true`,
      metadata: { org_id, user_id: userId },
      // India-specific: collect billing address for GST
      billing_address_collection: 'required',
      customer_update: { address: 'auto' },
    })

    return reply.send({ checkout_url: session.url, session_id: session.id })
  })

  // ── CUSTOMER PORTAL (manage subscription) ─────────────────
  app.post('/portal', async (request, reply) => {
    const { org_id, org } = await getOrgForUser(request.user.sub)

    if (!org.stripe_customer_id) {
      return reply.status(400).send({ error: 'No active subscription found.' })
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: org.stripe_customer_id,
      return_url: `${process.env.FRONTEND_URL}/dashboard/settings/billing`,
    })

    return reply.send({ portal_url: session.url })
  })

  // ── GET CURRENT SUBSCRIPTION ──────────────────────────────
  app.get('/subscription', async (request, reply) => {
    const { org_id, org } = await getOrgForUser(request.user.sub)

    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('org_id', org_id)
      .eq('status', 'active')
      .single()

    // Trial status
    const trialEnds  = org.trial_ends_at ? new Date(org.trial_ends_at) : null
    const isOnTrial  = org.plan === 'trial' && trialEnds && trialEnds > new Date()
    const trialDaysLeft = isOnTrial ? Math.ceil((trialEnds - new Date()) / (1000 * 60 * 60 * 24)) : 0

    return reply.send({
      plan: org.plan,
      subscription,
      trial: {
        is_trial: isOnTrial,
        days_left: trialDaysLeft,
        ends_at: trialEnds,
      },
    })
  })

  // ── GET INVOICES ──────────────────────────────────────────
  app.get('/invoices', async (request, reply) => {
    const { org_id } = await getOrgForUser(request.user.sub)

    const { data: invoices } = await supabase
      .from('invoices')
      .select('*')
      .eq('org_id', org_id)
      .order('issued_at', { ascending: false })
      .limit(24)

    return reply.send({ invoices: invoices || [] })
  })

  // ── CHECK FEATURE ACCESS ──────────────────────────────────
  app.get('/feature/:feature', async (request, reply) => {
    const { org_id, org } = await getOrgForUser(request.user.sub)

    const PLAN_FEATURES = {
      trial: {
        deal_rooms_limit: 3,
        analytics: 'basic',
        slack_alerts: false,
        crm_sync: false,
        ai_drafts: false,
        custom_branding: false,
        automation: false,
      },
      starter: {
        deal_rooms_limit: 10,
        analytics: 'basic',
        slack_alerts: false,
        crm_sync: false,
        ai_drafts: false,
        custom_branding: false,
        automation: false,
      },
      growth: {
        deal_rooms_limit: null, // unlimited
        analytics: 'full',
        slack_alerts: true,
        crm_sync: true,
        ai_drafts: false,
        custom_branding: true,
        automation: true,
      },
      enterprise: {
        deal_rooms_limit: null,
        analytics: 'full',
        slack_alerts: true,
        crm_sync: true,
        ai_drafts: true,
        custom_branding: true,
        automation: true,
        sso: true,
        custom_domain: true,
      },
    }

    const planFeatures = PLAN_FEATURES[org.plan] || PLAN_FEATURES.trial
    const featureValue = planFeatures[request.params.feature]

    return reply.send({
      feature: request.params.feature,
      value: featureValue,
      has_access: featureValue !== false && featureValue !== undefined,
      plan: org.plan,
      upgrade_required: featureValue === false || featureValue === undefined,
    })
  })
}
