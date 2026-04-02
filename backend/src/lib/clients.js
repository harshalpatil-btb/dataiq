// dealiq/backend/src/lib/clients.js
// All third-party client initialisation in one place

import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
import { Resend } from 'resend'
import OpenAI from 'openai'

// ── SUPABASE (admin / service role) ──────────────────────
// Uses service_role key — bypasses RLS for server-side ops
export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  {
    auth: { autoRefreshToken: false, persistSession: false },
  }
)

// ── STRIPE ───────────────────────────────────────────────
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-02-15',
})

// Stripe Price IDs — set these after creating products in Stripe dashboard
export const STRIPE_PRICES = {
  starter_monthly:  process.env.STRIPE_STARTER_MONTHLY_PRICE_ID,
  starter_annual:   process.env.STRIPE_STARTER_ANNUAL_PRICE_ID,
  growth_monthly:   process.env.STRIPE_GROWTH_MONTHLY_PRICE_ID,
  growth_annual:    process.env.STRIPE_GROWTH_ANNUAL_PRICE_ID,
}

// ── RESEND (email) ────────────────────────────────────────
export const resend = new Resend(process.env.RESEND_API_KEY)
export const FROM_EMAIL = process.env.FROM_EMAIL || 'hello@dealiq.io'
export const FROM_NAME  = 'DealIQ'

// ── OPENAI ────────────────────────────────────────────────
export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})
