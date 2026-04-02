# DealIQ — Zero-Terminal Deploy Guide
## From zero to live in 2 weeks, no coding required

---

## WEEK 1: Accounts + Database (Days 1–3)

---

### STEP 1 — Upload code to GitHub (15 min)

1. Go to **github.com** → click **"New repository"** (green button)
2. Name it: `dealiq`
3. Keep it **Private**
4. Click **"Create repository"**
5. On the next screen, click **"uploading an existing file"**
6. Drag the entire `dealiq` folder into the upload box
7. Scroll down → click **"Commit changes"** (green button)

✅ Your code is now in GitHub.

---

### STEP 2 — Set up Supabase database (20 min)

1. Go to **supabase.com** → **"Start your project"** (free)
2. Sign in with GitHub
3. Click **"New project"**
   - Name: `dealiq`
   - Database password: create a strong one and **save it somewhere**
   - Region: choose **Singapore** (closest to India)
4. Wait ~2 minutes for setup
5. In the left sidebar, click **"SQL Editor"**
6. Click **"New query"**
7. Open the file `supabase/migrations/001_schema.sql` from your project folder
8. Copy ALL the content and paste it into the SQL editor
9. Click **"Run"** (green button)
10. You should see: *"Success. No rows returned"*

**Get your Supabase keys:**
- Left sidebar → **Settings** → **API**
- Copy: **Project URL** → save as `NEXT_PUBLIC_SUPABASE_URL`
- Copy: **anon / public key** → save as `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Copy: **service_role key** → save as `SUPABASE_SERVICE_ROLE_KEY`

> ⚠️ Never share the service_role key with anyone. It bypasses all security.

---

### STEP 3 — Enable Supabase Auth (5 min)

1. Left sidebar → **Authentication** → **Providers**
2. Make sure **Email** is enabled (it is by default)
3. Optional: enable **Google** provider (requires Google Cloud Console — skip for now)
4. Left sidebar → **Authentication** → **URL Configuration**
5. Set **Site URL** to: `https://your-app-name.vercel.app` (we'll update after deploy)

---

### STEP 4 — Set up Resend for emails (10 min)

1. Go to **resend.com** → **"Get Started"** (free — 3,000 emails/month)
2. Sign up with GitHub or email
3. Click **"Add Domain"** → enter your domain (or use their free `@resend.dev` for testing)
4. Left sidebar → **API Keys** → **"Create API Key"**
5. Name it: `dealiq-production`
6. Copy the key → save as `RESEND_API_KEY`

---

### STEP 5 — Set up Stripe products (20 min)

You already have Stripe ✅ — just need to create the products.

1. Go to **dashboard.stripe.com**
2. Make sure you're in **Test Mode** first (toggle top right)
3. Left sidebar → **Product catalog** → **"Add product"**

**Create 3 products:**

**Product 1: DealIQ Starter**
- Name: `DealIQ Starter`
- Add price → Monthly: `₹4,285` → Recurring → Monthly → Save
- Add price → Annual: `₹35,988` → Recurring → Yearly → Save
- Copy both Price IDs (start with `price_`)

**Product 2: DealIQ Growth**
- Name: `DealIQ Growth`
- Add price → Monthly: `₹12,855` → Monthly → Save
- Add price → Annual: `₹1,07,988` → Yearly → Save
- Copy both Price IDs

4. Left sidebar → **Developers** → **API Keys**
   - Copy **Publishable key** → `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
   - Copy **Secret key** → `STRIPE_SECRET_KEY`

**Set up webhook:**
5. Left sidebar → **Developers** → **Webhooks** → **"Add endpoint"**
6. Endpoint URL: `https://your-app.vercel.app/api/billing/webhook`
7. Select events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`
8. Copy **Signing secret** → `STRIPE_WEBHOOK_SECRET`

---

## WEEK 1: Deploy (Days 3–4)

---

### STEP 6 — Deploy to Vercel (15 min)

1. Go to **vercel.com** → **"Start Deploying"** → Sign in with GitHub
2. Click **"Add New Project"**
3. Find your `dealiq` repository → click **"Import"**
4. Framework: it auto-detects **Next.js** ✅
5. **IMPORTANT — Add Environment Variables** before deploying:
   Click **"Environment Variables"** and add ALL of these:

```
NEXT_PUBLIC_SUPABASE_URL          = https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY     = eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY         = eyJhbGc...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = pk_test_...
STRIPE_SECRET_KEY                 = sk_test_...
STRIPE_WEBHOOK_SECRET             = whsec_...
STRIPE_PRICE_STARTER_MONTHLY      = price_...
STRIPE_PRICE_STARTER_ANNUAL       = price_...
STRIPE_PRICE_GROWTH_MONTHLY       = price_...
STRIPE_PRICE_GROWTH_ANNUAL        = price_...
RESEND_API_KEY                    = re_...
RESEND_FROM_EMAIL                 = noreply@yourdomain.com
NEXT_PUBLIC_APP_URL               = https://your-app.vercel.app
NEXT_PUBLIC_APP_NAME              = DealIQ
CRON_SECRET                       = make-up-a-random-long-string-here
```

6. Click **"Deploy"**
7. Wait ~3 minutes
8. You'll get a URL like `dealiq-xyz.vercel.app` — that's your live app! 🎉

---

### STEP 7 — Update URLs after deploy (5 min)

1. Go back to **Supabase** → Authentication → URL Configuration
2. Update **Site URL** to your actual Vercel URL
3. Add to **Redirect URLs**: `https://your-app.vercel.app/auth/callback`

4. Go back to **Stripe** → Developers → Webhooks
5. Update your webhook endpoint to your real Vercel URL

---

## WEEK 2: Test + Connect custom domain (Days 5–7)

---

### STEP 8 — Test everything (1 hr)

Go through this checklist:

**Auth:**
- [ ] Sign up at `/signup` — receive welcome email?
- [ ] Login at `/login` — reach dashboard?
- [ ] 4-day trial counter showing?

**Deal Rooms:**
- [ ] Create a deal at `/dashboard` → "New Deal Room"
- [ ] Get a room link (e.g. `/room/acme-corp-abc123`)
- [ ] Open that link in a private/incognito window as a "buyer"
- [ ] Engage with content — does rep get email alert?

**Billing:**
- [ ] Click "Upgrade" from dashboard
- [ ] Use Stripe test card: `4242 4242 4242 4242` (any future date, any CVC)
- [ ] See "Growth" plan activate?
- [ ] Stripe Webhook logs show `checkout.session.completed`?

---

### STEP 9 — Connect your domain (30 min)

1. In Vercel → your project → **Settings** → **Domains**
2. Click **"Add Domain"** → enter `app.yourdomain.com`
3. Vercel shows you DNS records to add
4. Go to your domain registrar (GoDaddy / Namecheap / etc.)
5. Add the CNAME record Vercel gives you
6. Wait up to 1 hr for DNS to propagate
7. Update `NEXT_PUBLIC_APP_URL` in Vercel environment variables to your real domain

---

### STEP 10 — Switch Stripe to Live mode (Day 7)

Once everything works in test mode:

1. **Stripe Dashboard** → toggle to **Live mode** (top right)
2. Create the same products again in live mode (prices are separate per mode)
3. Get new live API keys and update in Vercel:
   - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` → live publishable key
   - `STRIPE_SECRET_KEY` → live secret key
4. Create new live webhook and update `STRIPE_WEBHOOK_SECRET`
5. In Vercel → your project → **Settings** → **Environment Variables**
6. Update all 4 Stripe values
7. Vercel auto-redeploys

✅ You're now taking real payments!

---

## Quick Reference — All Your Dashboards

| Service | URL | What you manage |
|---------|-----|-----------------|
| Your App | `app.yourdomain.com` | Live product |
| Vercel | `vercel.com/dashboard` | Hosting, env vars, deploys |
| Supabase | `supabase.com/dashboard` | Database, users, auth |
| Stripe | `dashboard.stripe.com` | Payments, subscriptions |
| Resend | `resend.com/emails` | Email logs, deliverability |

---

## If Something Breaks

**White screen / 500 error:**
→ Vercel → your project → **Functions** tab → check error logs

**Emails not sending:**
→ Resend dashboard → **Logs** tab → see what failed

**Payments not working:**
→ Stripe → **Developers** → **Webhook logs** → see the error

**Database errors:**
→ Supabase → **Logs** → **API** → see the query that failed

**Still stuck?**
→ Take a screenshot of the error and ask Claude — paste the exact error message.

---

## Total Monthly Cost at Launch (₹0 customers)

| Service | Free Tier | When you pay |
|---------|-----------|--------------|
| Vercel | Unlimited hobby | When you need team features |
| Supabase | 500MB DB, 50K rows | When DB exceeds 500MB |
| Resend | 3,000 emails/month | When you exceed 3K |
| Stripe | Free | 2.9% + ₹2 per transaction |

**Total fixed cost to launch: ₹0/month** until you scale.
