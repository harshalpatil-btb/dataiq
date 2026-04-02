-- ============================================================
-- DealIQ — Complete Database Schema
-- Run this entire file in Supabase SQL Editor
-- ============================================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- for fast text search

-- ============================================================
-- ORGANIZATIONS (tenants)
-- ============================================================
CREATE TABLE organizations (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            TEXT NOT NULL,
  slug            TEXT UNIQUE NOT NULL,
  logo_url        TEXT,
  -- Billing
  plan            TEXT NOT NULL DEFAULT 'trial' CHECK (plan IN ('trial','starter','growth','enterprise')),
  billing_cycle   TEXT DEFAULT 'annual' CHECK (billing_cycle IN ('monthly','annual')),
  trial_ends_at   TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '4 days'),
  stripe_customer_id    TEXT UNIQUE,
  stripe_subscription_id TEXT UNIQUE,
  razorpay_customer_id  TEXT UNIQUE,
  -- India billing
  gstin           TEXT,
  billing_address JSONB,
  -- Settings
  seat_count      INT NOT NULL DEFAULT 2,
  custom_domain   TEXT UNIQUE,
  brand_color     TEXT DEFAULT '#3d5afe',
  -- Metadata
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- USERS
-- ============================================================
CREATE TABLE users (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email           TEXT NOT NULL,
  full_name       TEXT,
  avatar_url      TEXT,
  role            TEXT NOT NULL DEFAULT 'sales' CHECK (role IN ('admin','sales','analyst','viewer')),
  title           TEXT,
  phone           TEXT,
  crm_user_id     TEXT,
  -- Notifications
  slack_user_id   TEXT,
  notify_slack    BOOLEAN DEFAULT true,
  notify_email    BOOLEAN DEFAULT true,
  -- Activity
  last_active_at  TIMESTAMPTZ,
  onboarded_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- DEALS
-- ============================================================
CREATE TABLE deals (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  owner_id        UUID NOT NULL REFERENCES users(id),
  -- Identity
  name            TEXT NOT NULL,
  company_name    TEXT NOT NULL,
  company_domain  TEXT,
  company_logo    TEXT,
  -- Pipeline
  stage           TEXT NOT NULL DEFAULT 'discovery' CHECK (stage IN (
                    'discovery','demo','proposal','negotiation','closing','won','lost'
                  )),
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','stalled','won','lost','archived')),
  value           NUMERIC(12,2),
  currency        TEXT DEFAULT 'INR',
  close_date      DATE,
  -- Intelligence
  health_score    INT DEFAULT 50 CHECK (health_score BETWEEN 0 AND 100),
  win_probability FLOAT DEFAULT 0.5 CHECK (win_probability BETWEEN 0 AND 1),
  stall_detected_at TIMESTAMPTZ,
  -- CRM sync
  crm_deal_id     TEXT,
  crm_source      TEXT,
  -- Room
  room_slug       TEXT UNIQUE,
  room_password   TEXT, -- bcrypt hashed
  room_is_active  BOOLEAN DEFAULT true,
  -- Metadata
  notes           TEXT,
  tags            TEXT[] DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- STAKEHOLDERS (buyer contacts)
-- ============================================================
CREATE TABLE stakeholders (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  deal_id         UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  -- Identity
  email           TEXT NOT NULL,
  full_name       TEXT,
  title           TEXT,
  phone           TEXT,
  avatar_url      TEXT,
  linkedin_url    TEXT,
  -- Role in deal
  role_in_deal    TEXT DEFAULT 'influencer' CHECK (role_in_deal IN (
                    'champion','decision_maker','budget_owner','influencer','blocker','user','unknown'
                  )),
  influence_level TEXT DEFAULT 'medium' CHECK (influence_level IN ('low','medium','high')),
  -- Engagement
  engagement_score    INT DEFAULT 0,
  first_seen_at       TIMESTAMPTZ,
  last_seen_at        TIMESTAMPTZ,
  total_time_spent_s  INT DEFAULT 0,
  visit_count         INT DEFAULT 0,
  -- Status
  is_active       BOOLEAN DEFAULT true,
  -- Enrichment (from Clearbit etc)
  enrichment_data JSONB,
  -- Metadata
  added_by        UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- unique email per deal
CREATE UNIQUE INDEX stakeholders_deal_email ON stakeholders(deal_id, email);

-- ============================================================
-- CONTENT LIBRARY
-- ============================================================
CREATE TABLE content_items (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  deal_id         UUID REFERENCES deals(id) ON DELETE SET NULL, -- NULL = library item
  -- Identity
  title           TEXT NOT NULL,
  description     TEXT,
  type            TEXT NOT NULL CHECK (type IN ('deck','pdf','video','interactive','image','link','contract')),
  -- Storage
  file_url        TEXT,
  thumbnail_url   TEXT,
  file_size_bytes BIGINT,
  page_count      INT,
  duration_s      INT, -- for videos
  -- Tagging
  tags            TEXT[] DEFAULT '{}',
  icp_tags        TEXT[] DEFAULT '{}',
  -- Performance
  view_count      INT DEFAULT 0,
  total_time_spent_s INT DEFAULT 0,
  -- Metadata
  uploaded_by     UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ENGAGEMENT EVENTS (the heart of the platform)
-- ============================================================
CREATE TABLE engagement_events (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  deal_id         UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  stakeholder_id  UUID REFERENCES stakeholders(id) ON DELETE SET NULL,
  content_id      UUID REFERENCES content_items(id) ON DELETE SET NULL,
  -- Event
  event_type      TEXT NOT NULL CHECK (event_type IN (
                    'room_viewed','content_opened','content_scrolled',
                    'video_played','video_paused','video_completed',
                    'question_posted','comment_added','map_task_completed',
                    'contract_viewed','contract_signed','room_shared',
                    'stakeholder_joined','link_clicked'
                  )),
  -- Context
  duration_s      INT DEFAULT 0,
  scroll_depth_pct INT, -- 0-100
  page_number     INT,
  metadata        JSONB DEFAULT '{}',
  -- Network
  ip_address      INET,
  user_agent      TEXT,
  device_type     TEXT CHECK (device_type IN ('desktop','mobile','tablet')),
  -- Timing
  occurred_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast deal-level queries
CREATE INDEX engagement_events_deal_idx ON engagement_events(deal_id, occurred_at DESC);
CREATE INDEX engagement_events_stakeholder_idx ON engagement_events(stakeholder_id, occurred_at DESC);

-- ============================================================
-- MUTUAL ACTION PLAN TASKS
-- ============================================================
CREATE TABLE map_tasks (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  deal_id         UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  -- Content
  title           TEXT NOT NULL,
  description     TEXT,
  owner_side      TEXT NOT NULL DEFAULT 'buyer' CHECK (owner_side IN ('buyer','seller')),
  assigned_to_email TEXT,
  assigned_to_name  TEXT,
  -- Status
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_progress','completed','overdue','skipped')),
  due_date        DATE,
  completed_at    TIMESTAMPTZ,
  -- Phase
  phase           INT DEFAULT 1,
  sort_order      INT DEFAULT 0,
  -- Metadata
  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- COMMENTS / DISCUSSION
-- ============================================================
CREATE TABLE comments (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  deal_id         UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  content_id      UUID REFERENCES content_items(id) ON DELETE SET NULL,
  -- Author (either internal user or external stakeholder)
  author_type     TEXT NOT NULL CHECK (author_type IN ('user','stakeholder')),
  author_user_id  UUID REFERENCES users(id),
  author_stakeholder_id UUID REFERENCES stakeholders(id),
  author_name     TEXT NOT NULL,
  -- Content
  body            TEXT NOT NULL,
  is_read         BOOLEAN DEFAULT false,
  -- Threading
  parent_id       UUID REFERENCES comments(id),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- AUTOMATION RULES
-- ============================================================
CREATE TABLE automation_rules (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by      UUID REFERENCES users(id),
  -- Identity
  name            TEXT NOT NULL,
  description     TEXT,
  is_active       BOOLEAN DEFAULT true,
  -- Rule definition (stored as JSON)
  trigger_type    TEXT NOT NULL CHECK (trigger_type IN (
                    'pricing_viewed','deal_stalled','new_stakeholder',
                    'map_task_overdue','question_posted','contract_viewed',
                    'first_room_view','deal_won','deal_lost','custom'
                  )),
  trigger_config  JSONB DEFAULT '{}', -- e.g. {"min_seconds": 60, "min_value": 500000}
  filter_config   JSONB DEFAULT '{}', -- e.g. {"stages": ["proposal","negotiation"]}
  actions         JSONB NOT NULL,     -- array of actions [{type, config}]
  -- Stats
  fire_count      INT DEFAULT 0,
  last_fired_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- AUTOMATION RUNS (audit log)
-- ============================================================
CREATE TABLE automation_runs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rule_id         UUID NOT NULL REFERENCES automation_rules(id) ON DELETE CASCADE,
  deal_id         UUID REFERENCES deals(id) ON DELETE SET NULL,
  -- Result
  status          TEXT DEFAULT 'success' CHECK (status IN ('success','failed','skipped')),
  actions_taken   JSONB DEFAULT '[]',
  error_message   TEXT,
  fired_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- AI DRAFTS
-- ============================================================
CREATE TABLE ai_drafts (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  deal_id         UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  created_by      UUID NOT NULL REFERENCES users(id),
  -- Trigger context
  trigger_type    TEXT NOT NULL,
  trigger_event_id UUID REFERENCES engagement_events(id),
  -- Draft content
  subject         TEXT,
  body            TEXT NOT NULL,
  tone            TEXT DEFAULT 'professional',
  -- Status
  status          TEXT DEFAULT 'pending' CHECK (status IN ('pending','sent','discarded')),
  sent_at         TIMESTAMPTZ,
  -- AI metadata
  model           TEXT DEFAULT 'gpt-4o',
  signals_used    JSONB DEFAULT '[]',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SUBSCRIPTIONS
-- ============================================================
CREATE TABLE subscriptions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  -- Stripe
  stripe_subscription_id TEXT UNIQUE,
  stripe_price_id        TEXT,
  stripe_product_id      TEXT,
  -- Razorpay (India)
  razorpay_subscription_id TEXT UNIQUE,
  razorpay_plan_id         TEXT,
  -- Details
  plan            TEXT NOT NULL,
  billing_cycle   TEXT NOT NULL,
  status          TEXT NOT NULL CHECK (status IN ('active','past_due','canceled','trialing','paused')),
  seat_count      INT DEFAULT 2,
  -- Billing
  amount          NUMERIC(10,2),
  currency        TEXT DEFAULT 'INR',
  current_period_start TIMESTAMPTZ,
  current_period_end   TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT false,
  -- Metadata
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INVOICES
-- ============================================================
CREATE TABLE invoices (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES subscriptions(id),
  -- Stripe
  stripe_invoice_id TEXT UNIQUE,
  -- Details
  invoice_number  TEXT UNIQUE,
  amount_subtotal NUMERIC(10,2),
  amount_gst      NUMERIC(10,2),
  amount_total    NUMERIC(10,2),
  currency        TEXT DEFAULT 'INR',
  status          TEXT CHECK (status IN ('draft','open','paid','void','uncollectible')),
  -- GST fields
  gstin           TEXT,
  hsn_code        TEXT DEFAULT '998314', -- IT services SAC code
  -- Dates
  issued_at       TIMESTAMPTZ,
  due_at          TIMESTAMPTZ,
  paid_at         TIMESTAMPTZ,
  -- PDF
  pdf_url         TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- CRM SYNC LOG
-- ============================================================
CREATE TABLE crm_sync_logs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          UUID NOT NULL REFERENCES organizations(id),
  crm_type        TEXT CHECK (crm_type IN ('hubspot','salesforce','pipedrive','zoho')),
  entity_type     TEXT CHECK (entity_type IN ('deal','contact','company')),
  local_id        UUID,
  crm_id          TEXT,
  direction       TEXT CHECK (direction IN ('push','pull')),
  status          TEXT CHECK (status IN ('success','failed')),
  payload         JSONB,
  error           TEXT,
  synced_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE organizations     ENABLE ROW LEVEL SECURITY;
ALTER TABLE users             ENABLE ROW LEVEL SECURITY;
ALTER TABLE deals             ENABLE ROW LEVEL SECURITY;
ALTER TABLE stakeholders      ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_items     ENABLE ROW LEVEL SECURITY;
ALTER TABLE engagement_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE map_tasks         ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments          ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_rules  ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_drafts         ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices          ENABLE ROW LEVEL SECURITY;

-- Users can only see their own org's data
CREATE POLICY "org_isolation" ON organizations
  FOR ALL USING (id IN (SELECT org_id FROM users WHERE id = auth.uid()));

CREATE POLICY "org_isolation" ON deals
  FOR ALL USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

CREATE POLICY "org_isolation" ON users
  FOR ALL USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

CREATE POLICY "org_isolation" ON content_items
  FOR ALL USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

CREATE POLICY "org_isolation" ON automation_rules
  FOR ALL USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

CREATE POLICY "org_isolation" ON subscriptions
  FOR ALL USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

CREATE POLICY "org_isolation" ON invoices
  FOR ALL USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

-- Deal-scoped: stakeholders, events, tasks, comments, drafts
CREATE POLICY "deal_isolation" ON stakeholders
  FOR ALL USING (deal_id IN (SELECT id FROM deals WHERE org_id IN (SELECT org_id FROM users WHERE id = auth.uid())));

CREATE POLICY "deal_isolation" ON engagement_events
  FOR ALL USING (deal_id IN (SELECT id FROM deals WHERE org_id IN (SELECT org_id FROM users WHERE id = auth.uid())));

CREATE POLICY "deal_isolation" ON map_tasks
  FOR ALL USING (deal_id IN (SELECT id FROM deals WHERE org_id IN (SELECT org_id FROM users WHERE id = auth.uid())));

CREATE POLICY "deal_isolation" ON comments
  FOR ALL USING (deal_id IN (SELECT id FROM deals WHERE org_id IN (SELECT org_id FROM users WHERE id = auth.uid())));

CREATE POLICY "deal_isolation" ON ai_drafts
  FOR ALL USING (deal_id IN (SELECT id FROM deals WHERE org_id IN (SELECT org_id FROM users WHERE id = auth.uid())));

-- ============================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER deals_updated_at         BEFORE UPDATE ON deals         FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER organizations_updated_at BEFORE UPDATE ON organizations FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER content_items_updated_at BEFORE UPDATE ON content_items FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER map_tasks_updated_at     BEFORE UPDATE ON map_tasks     FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER subscriptions_updated_at BEFORE UPDATE ON subscriptions FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-generate room slug from company name
CREATE OR REPLACE FUNCTION generate_room_slug()
RETURNS TRIGGER AS $$
DECLARE slug_base TEXT;
DECLARE final_slug TEXT;
DECLARE counter INT := 0;
BEGIN
  IF NEW.room_slug IS NULL THEN
    slug_base := LOWER(REGEXP_REPLACE(NEW.company_name, '[^a-zA-Z0-9]+', '-', 'g'));
    slug_base := TRIM(BOTH '-' FROM slug_base);
    final_slug := slug_base;
    WHILE EXISTS (SELECT 1 FROM deals WHERE room_slug = final_slug AND id != NEW.id) LOOP
      counter := counter + 1;
      final_slug := slug_base || '-' || counter;
    END LOOP;
    NEW.room_slug := final_slug;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER deals_room_slug BEFORE INSERT ON deals FOR EACH ROW EXECUTE FUNCTION generate_room_slug();

-- Recalculate deal health score when engagement events come in
CREATE OR REPLACE FUNCTION recalculate_deal_health()
RETURNS TRIGGER AS $$
DECLARE
  v_engagement_score INT;
  v_days_since_activity INT;
  v_map_completion_pct FLOAT;
  v_stakeholder_count INT;
  v_health INT;
BEGIN
  -- Days since last activity (penalise staleness)
  SELECT EXTRACT(DAY FROM NOW() - MAX(occurred_at))::INT
  INTO v_days_since_activity
  FROM engagement_events WHERE deal_id = NEW.deal_id;

  -- Stakeholder engagement breadth
  SELECT COUNT(DISTINCT stakeholder_id) INTO v_stakeholder_count
  FROM engagement_events WHERE deal_id = NEW.deal_id AND occurred_at > NOW() - INTERVAL '14 days';

  -- MAP completion
  SELECT COALESCE(
    COUNT(*) FILTER (WHERE status = 'completed')::FLOAT / NULLIF(COUNT(*), 0), 0
  ) INTO v_map_completion_pct
  FROM map_tasks WHERE deal_id = NEW.deal_id;

  -- Simple weighted formula
  v_health := LEAST(100, GREATEST(0,
    50                                        -- base
    - COALESCE(v_days_since_activity, 0) * 3  -- -3 per stale day
    + LEAST(v_stakeholder_count * 8, 25)      -- +8 per active stakeholder (max 25)
    + (v_map_completion_pct * 25)::INT        -- up to 25 for MAP
  ));

  UPDATE deals SET health_score = v_health, updated_at = NOW()
  WHERE id = NEW.deal_id;

  -- Flag stalled deals
  IF v_days_since_activity >= 3 AND v_health < 40 THEN
    UPDATE deals SET status = 'stalled', stall_detected_at = NOW()
    WHERE id = NEW.deal_id AND status = 'active';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER recalculate_health_on_event
  AFTER INSERT ON engagement_events
  FOR EACH ROW EXECUTE FUNCTION recalculate_deal_health();

-- ============================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================
CREATE INDEX deals_org_status    ON deals(org_id, status);
CREATE INDEX deals_org_owner     ON deals(org_id, owner_id);
CREATE INDEX deals_health_score  ON deals(health_score);
CREATE INDEX stakeholders_deal   ON stakeholders(deal_id);
CREATE INDEX map_tasks_deal      ON map_tasks(deal_id, status);
CREATE INDEX comments_deal       ON comments(deal_id, created_at DESC);
CREATE INDEX ai_drafts_deal      ON ai_drafts(deal_id, status);

-- ============================================================
-- SEED DATA — Demo org for testing
-- ============================================================
INSERT INTO organizations (id, name, slug, plan, trial_ends_at)
VALUES ('00000000-0000-0000-0000-000000000001', 'Demo Company', 'demo', 'growth', NOW() + INTERVAL '30 days');
