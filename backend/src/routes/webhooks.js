// dealiq/backend/src/routes/webhooks.js
// Stripe webhooks — raw body required for signature verification

import { stripe } from '../lib/clients.js'
import { supabase } from '../lib/clients.js'
import { sendPaymentSuccessEmail, sendPaymentFailedEmail, sendTrialEndingEmail } from '../services/email.js'
import { generateGSTInvoice } from '../services/invoice.js'

export default async function webhookRoutes(app) {

  // ── STRIPE WEBHOOK ────────────────────────────────────────
  app.post('/stripe', {
    config: {
      // Disable body parsing — Stripe needs raw body for sig verification
      rawBody: true,
    },
  }, async (request, reply) => {
    const sig  = request.headers['stripe-signature']
    const body = request.rawBody

    let event
    try {
      event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET)
    } catch (err) {
      console.error('Stripe webhook signature failed:', err.message)
      return reply.status(400).send({ error: `Webhook error: ${err.message}` })
    }

    console.log(`📦 Stripe event: ${event.type}`)

    try {
      switch (event.type) {

        // ── CHECKOUT COMPLETED (first payment) ───────────────
        case 'checkout.session.completed': {
          const session = event.data.object
          const { org_id, plan, billing_cycle } = session.metadata

          // Update org plan
          await supabase.from('organizations').update({
            plan,
            billing_cycle,
            stripe_subscription_id: session.subscription,
            trial_ends_at: null,
          }).eq('id', org_id)

          // Create subscription record
          const stripeSubscription = await stripe.subscriptions.retrieve(session.subscription)
          await supabase.from('subscriptions').insert({
            org_id,
            stripe_subscription_id: session.subscription,
            stripe_price_id: stripeSubscription.items.data[0].price.id,
            plan,
            billing_cycle,
            status: 'active',
            amount: stripeSubscription.items.data[0].price.unit_amount / 100,
            currency: stripeSubscription.currency.toUpperCase(),
            current_period_start: new Date(stripeSubscription.current_period_start * 1000).toISOString(),
            current_period_end:   new Date(stripeSubscription.current_period_end   * 1000).toISOString(),
          })

          // Send confirmation email
          const { data: org } = await supabase.from('organizations').select('name').eq('id', org_id).single()
          const { data: admin } = await supabase.from('users').select('email, full_name').eq('org_id', org_id).eq('role', 'admin').single()
          await sendPaymentSuccessEmail({ email: admin.email, full_name: admin.full_name, plan, org_name: org.name })

          break
        }

        // ── SUBSCRIPTION UPDATED ─────────────────────────────
        case 'customer.subscription.updated': {
          const sub = event.data.object
          const metadata = sub.metadata

          // Find org by stripe customer id
          const { data: org } = await supabase
            .from('organizations')
            .select('id')
            .eq('stripe_customer_id', sub.customer)
            .single()

          if (!org) break

          const newPlan = metadata?.plan || (
            sub.items.data[0]?.price?.metadata?.plan || 'growth'
          )

          await supabase.from('organizations').update({
            plan: sub.status === 'active' ? newPlan : 'trial',
          }).eq('id', org.id)

          await supabase.from('subscriptions').update({
            status: sub.status,
            current_period_start: new Date(sub.current_period_start * 1000).toISOString(),
            current_period_end:   new Date(sub.current_period_end   * 1000).toISOString(),
            cancel_at_period_end: sub.cancel_at_period_end,
          }).eq('stripe_subscription_id', sub.id)

          break
        }

        // ── SUBSCRIPTION CANCELLED ────────────────────────────
        case 'customer.subscription.deleted': {
          const sub = event.data.object

          const { data: org } = await supabase
            .from('organizations')
            .select('id')
            .eq('stripe_customer_id', sub.customer)
            .single()

          if (!org) break

          // Downgrade to trial (data retained 30 days)
          await supabase.from('organizations').update({
            plan: 'trial',
            trial_ends_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          }).eq('id', org.id)

          await supabase.from('subscriptions')
            .update({ status: 'canceled' })
            .eq('stripe_subscription_id', sub.id)

          break
        }

        // ── INVOICE PAID ──────────────────────────────────────
        case 'invoice.payment_succeeded': {
          const inv = event.data.object

          const { data: org } = await supabase
            .from('organizations')
            .select('id, name, gstin, billing_address')
            .eq('stripe_customer_id', inv.customer)
            .single()

          if (!org) break

          // Generate invoice number (IND format: DQ-2025-001)
          const year = new Date().getFullYear()
          const { count } = await supabase
            .from('invoices')
            .select('*', { count: 'exact', head: true })
            .eq('org_id', org.id)

          const invoiceNumber = `DQ-${year}-${String((count || 0) + 1).padStart(4, '0')}`

          // Calculate GST (18% for Indian customers)
          const subtotal = inv.amount_paid / 100
          const isIndian = inv.customer_address?.country === 'IN'
          const gst      = isIndian ? subtotal * 0.18 : 0

          // Create invoice record
          const { data: invoice } = await supabase.from('invoices').insert({
            org_id: org.id,
            stripe_invoice_id: inv.id,
            invoice_number: invoiceNumber,
            amount_subtotal: subtotal,
            amount_gst: gst,
            amount_total: subtotal + gst,
            currency: inv.currency.toUpperCase(),
            status: 'paid',
            gstin: org.gstin,
            hsn_code: '998314',
            issued_at: new Date(inv.created * 1000).toISOString(),
            paid_at: new Date().toISOString(),
          }).select().single()

          // Generate PDF invoice (async)
          generateGSTInvoice(invoice, org).catch(console.error)

          break
        }

        // ── PAYMENT FAILED ────────────────────────────────────
        case 'invoice.payment_failed': {
          const inv = event.data.object

          const { data: org } = await supabase
            .from('organizations')
            .select('id')
            .eq('stripe_customer_id', inv.customer)
            .single()

          if (!org) break

          // Update subscription status
          await supabase.from('subscriptions')
            .update({ status: 'past_due' })
            .eq('org_id', org.id)

          // Email admin
          const { data: admin } = await supabase
            .from('users')
            .select('email, full_name')
            .eq('org_id', org.id)
            .eq('role', 'admin')
            .single()

          if (admin) await sendPaymentFailedEmail({ email: admin.email, full_name: admin.full_name })

          break
        }

        default:
          console.log(`Unhandled Stripe event: ${event.type}`)
      }
    } catch (err) {
      console.error(`Error processing ${event.type}:`, err)
      // Don't return 500 — Stripe will retry. Log and move on.
    }

    return reply.send({ received: true })
  })
}
