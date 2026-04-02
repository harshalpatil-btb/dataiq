# DealIQ — Complete MVP

> **No terminal needed.** Every step below is point-and-click.

---

## What you're deploying

| Layer | What it does | Where it runs |
|-------|-------------|---------------|
| Frontend | All 7 UI screens, routing, auth | Vercel (free) |
| Backend API | Deal logic, alerts, billing webhooks | Railway (free) |
| Database | All your data | Supabase (free) |
| Auth | Login, signup, magic link | Supabase Auth |
| Payments | Subscriptions, billing | Stripe |
| Email | Alerts, trial nudges | Resend (free) |

---

## Step 1 — Create accounts (20 min)

Create accounts at these URLs in order:

1. **Supabase** → https://supabase.com (click "Start for free")
2. **Railway** → https://railway.app (click "Login with GitHub")
3. **Resend** → https://resend.com (click "Get started for free")
4. **Razorpay** → https://razorpay.com (for India payments — optional for MVP)

You already have: GitHub ✅ and Stripe ✅

---

## Step 2 — Set up Supabase (15 min)

1. Go to https://supabase.com/dashboard
2. Click **"New project"**
3. Name it `dealiq-prod`, choose a strong password, pick **Mumbai** region
4. Wait 2 minutes for it to spin up
5. Go to **SQL Editor** in the left sidebar
6. Copy the entire contents of `supabase/migrations/001_initial.sql`
7. Paste it into the SQL editor and click **"Run"**
8. Go to **Settings → API** and copy:
   - `Project URL` → save as `SUPABASE_URL`
   - `anon public` key → save as `SUPABASE_ANON_KEY`
   - `service_role` key → save as `SUPABASE_SERVICE_KEY`

---

## Step 3 — Deploy Backend to Railway (10 min)

1. Go to https://railway.app/dashboard
2. Click **"New Project"** → **"Deploy from GitHub repo"**
3. Select your `dealiq` repo → select the `backend` folder
4. Railway will detect it's a Node.js app automatically
5. Click **"Variables"** tab and add these (copy from your notes):

```
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_service_key
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=get_this_after_step_6
RESEND_API_KEY=your_resend_key
JWT_SECRET=any_random_32_char_string
FRONTEND_URL=https://your-app.vercel.app
NODE_ENV=production
```

6. Click **"Deploy"** — Railway gives you a URL like `https://dealiq-backend.railway.app`
7. Copy that URL → save as `BACKEND_URL`

---

## Step 4 — Deploy Frontend to Vercel (10 min)

1. Go to https://vercel.com/new
2. Click **"Import Git Repository"** → select your `dealiq` repo
3. Set **Root Directory** to `frontend`
4. Add Environment Variables:

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_BACKEND_URL=https://dealiq-backend.railway.app
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key
```

5. Click **"Deploy"** — Vercel gives you `https://dealiq.vercel.app`

---

## Step 5 — Set up Stripe (10 min)

1. Go to https://dashboard.stripe.com/products
2. Click **"Add product"** → create 3 products:
   - `DealIQ Starter` → ₹2,999/month recurring + ₹35,988/year recurring
   - `DealIQ Growth` → ₹8,999/month + ₹1,07,988/year
   - `DealIQ Enterprise` → custom (contact sales)
3. Copy each **Price ID** (starts with `price_...`)
4. Go to **Developers → Webhooks** → **"Add endpoint"**
5. URL: `https://dealiq-backend.railway.app/webhooks/stripe`
6. Events to listen for: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`
7. Copy the **Webhook Secret** → add to Railway as `STRIPE_WEBHOOK_SECRET`

---

## Step 6 — Set up Resend Email (5 min)

1. Go to https://resend.com/api-keys
2. Click **"Create API Key"** → name it `dealiq-prod`
3. Copy the key → add to Railway as `RESEND_API_KEY`
4. Go to **Domains** → add your domain (or use the free `@resend.dev` for testing)

---

## Step 7 — Test everything (10 min)

1. Go to your Vercel URL
2. Click **"Start free trial"**
3. Sign up with your email
4. Check your email for the magic link
5. Complete onboarding
6. Create a deal room
7. Copy the room link and open it in an incognito window (simulating a buyer)
8. Go back to your dashboard — you should see engagement tracked

---

## You're live. 🎉

Total time: ~80 minutes
Total cost: ₹0/month until paying customers

---

## Project structure

```
dealiq/
├── frontend/          ← Next.js 14 app (deploys to Vercel)
│   ├── app/           ← All pages
│   ├── components/    ← Reusable UI components  
│   ├── lib/           ← API client, Supabase client, utils
│   └── hooks/         ← React hooks
│
├── backend/           ← Node.js + Fastify API (deploys to Railway)
│   ├── src/
│   │   ├── routes/    ← All API endpoints
│   │   ├── services/  ← Business logic
│   │   ├── workers/   ← Background jobs (email, automation)
│   │   └── lib/       ← Supabase, Stripe, Resend clients
│   └── prisma/        ← DB schema reference
│
└── supabase/
    └── migrations/    ← Run this SQL in Supabase dashboard
```
