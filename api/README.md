// ============================================================
// DEALIQ — API Routes Index
// All routes live under /pages/api/
// ============================================================

// ── /api/auth/signup ──────────────────────────────────────────
// POST { email, password, full_name, org_name }
// Creates user + organization + starts 4-day trial
// Returns { user, org, session }

// ── /api/auth/login ───────────────────────────────────────────
// POST { email, password }
// Returns { user, org, session }

// ── /api/auth/logout ──────────────────────────────────────────
// POST — clears session

// ── /api/deals ────────────────────────────────────────────────
// GET  — list all deals for org (with filters: status, stage, owner)
// POST { name, company_name, value_inr, close_date, stage } — create deal

// ── /api/deals/[id] ───────────────────────────────────────────
// GET    — single deal with all relations
// PUT    — update deal fields
// DELETE — archive deal

// ── /api/deals/[id]/stakeholders ──────────────────────────────
// GET  — list stakeholders for deal
// POST { email, full_name, title, role_in_deal } — add stakeholder

// ── /api/deals/[id]/content ───────────────────────────────────
// GET  — list content items for deal room
// POST { title, type, url } — add content item

// ── /api/deals/[id]/tasks ─────────────────────────────────────
// GET  — list MAP tasks
// POST { title, owner_side, due_date } — add task
// PUT  /api/deals/[id]/tasks/[taskId] — update task status

// ── /api/deals/[id]/messages ──────────────────────────────────
// GET  — get discussion thread
// POST { content, sender_name, sender_email } — post message (buyer or rep)

// ── /api/room/[slug] ──────────────────────────────────────────
// GET — public buyer-facing deal room data (no auth required)
// Validates password if set, returns room content

// ── /api/room/[slug]/engage ───────────────────────────────────
// POST { event_type, content_id, duration_seconds, stakeholder_email }
// Tracks buyer engagement, fires automation rules

// ── /api/billing/checkout ─────────────────────────────────────
// POST { plan, billing_cycle, email }
// Creates Stripe checkout session, returns { url }

// ── /api/billing/portal ───────────────────────────────────────
// POST — creates Stripe billing portal session for plan management

// ── /api/billing/webhook ──────────────────────────────────────
// POST — Stripe webhook handler
// Handles: checkout.completed, subscription.updated, payment.failed

// ── /api/dashboard/stats ──────────────────────────────────────
// GET — pipeline value, active deals, win rate, health scores

// ── /api/health ───────────────────────────────────────────────
// GET — returns { status: 'ok' } for uptime monitoring
