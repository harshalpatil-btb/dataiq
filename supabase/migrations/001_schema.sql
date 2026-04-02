-- ============================================================
-- DEALIQ — Complete Database Schema
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ── ORGANIZATIONS ────────────────────────────────────────────
create table organizations (
  id            uuid primary key default uuid_generate_v4(),
  name          text not null,
  slug          text unique not null,
  plan          text not null default 'trial'
                check (plan in ('trial','starter','growth','enterprise')),
  trial_ends_at timestamptz not null default (now() + interval '4 days'),
  stripe_customer_id    text unique,
  stripe_subscription_id text,
  seat_count    int not null default 1,
  logo_url      text,
  website       text,
  gstin         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ── USERS ────────────────────────────────────────────────────
create table users (
  id            uuid primary key references auth.users(id) on delete cascade,
  org_id        uuid references organizations(id) on delete cascade,
  email         text unique not null,
  full_name     text,
  avatar_url    text,
  role          text not null default 'sales'
                check (role in ('admin','sales','analyst','viewer')),
  crm_user_id   text,
  last_active_at timestamptz,
  created_at    timestamptz not null default now()
);

-- ── DEALS ─────────────────────────────────────────────────────
create table deals (
  id              uuid primary key default uuid_generate_v4(),
  org_id          uuid not null references organizations(id) on delete cascade,
  owner_id        uuid not null references users(id),
  name            text not null,
  company_name    text not null,
  company_domain  text,
  stage           text not null default 'discovery'
                  check (stage in ('discovery','demo','proposal','negotiation','closing','won','lost')),
  value_inr       numeric(12,2),
  close_date      date,
  health_score    int default 50 check (health_score between 0 and 100),
  win_probability float default 0.5 check (win_probability between 0 and 1),
  room_slug       text unique not null,
  room_password   text,
  status          text not null default 'active'
                  check (status in ('active','stalled','won','lost','archived')),
  crm_deal_id     text,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ── STAKEHOLDERS ─────────────────────────────────────────────
create table stakeholders (
  id              uuid primary key default uuid_generate_v4(),
  deal_id         uuid not null references deals(id) on delete cascade,
  email           text not null,
  full_name       text,
  title           text,
  role_in_deal    text default 'influencer'
                  check (role_in_deal in ('champion','decision_maker','blocker','influencer','user','economic_buyer')),
  influence_level text default 'medium'
                  check (influence_level in ('high','medium','low')),
  engagement_score int default 0,
  last_seen_at    timestamptz,
  enrichment_data jsonb default '{}',
  created_at      timestamptz not null default now(),
  unique(deal_id, email)
);

-- ── CONTENT ITEMS ─────────────────────────────────────────────
create table content_items (
  id          uuid primary key default uuid_generate_v4(),
  org_id      uuid not null references organizations(id) on delete cascade,
  deal_id     uuid references deals(id) on delete cascade,
  title       text not null,
  type        text not null check (type in ('deck','pdf','video','interactive','image','link','contract')),
  url         text,
  file_key    text,
  file_size   int,
  tags        text[] default '{}',
  is_library  boolean default false,
  sort_order  int default 0,
  view_count  int default 0,
  created_by  uuid references users(id),
  created_at  timestamptz not null default now()
);

-- ── MAP TASKS ─────────────────────────────────────────────────
create table map_tasks (
  id          uuid primary key default uuid_generate_v4(),
  deal_id     uuid not null references deals(id) on delete cascade,
  title       text not null,
  description text,
  owner_side  text not null check (owner_side in ('buyer','seller')),
  assigned_to text,
  due_date    date,
  status      text not null default 'pending'
              check (status in ('pending','in_progress','done','overdue','skipped')),
  sort_order  int default 0,
  completed_at timestamptz,
  created_at  timestamptz not null default now()
);

-- ── ENGAGEMENT EVENTS ─────────────────────────────────────────
create table engagement_events (
  id              uuid primary key default uuid_generate_v4(),
  deal_id         uuid not null references deals(id) on delete cascade,
  stakeholder_id  uuid references stakeholders(id) on delete set null,
  event_type      text not null check (event_type in (
    'room_viewed','content_viewed','content_downloaded','video_played',
    'question_posted','task_completed','contract_signed','link_shared',
    'comment_posted','map_opened'
  )),
  content_id      uuid references content_items(id) on delete set null,
  duration_seconds int,
  metadata        jsonb default '{}',
  ip_address      inet,
  user_agent      text,
  occurred_at     timestamptz not null default now()
);

-- ── DISCUSSIONS ───────────────────────────────────────────────
create table messages (
  id          uuid primary key default uuid_generate_v4(),
  deal_id     uuid not null references deals(id) on delete cascade,
  sender_type text not null check (sender_type in ('rep','buyer')),
  sender_id   uuid references users(id) on delete set null,
  sender_name text not null,
  sender_email text,
  content     text not null,
  is_read     boolean default false,
  created_at  timestamptz not null default now()
);

-- ── AUTOMATION RULES ──────────────────────────────────────────
create table automation_rules (
  id          uuid primary key default uuid_generate_v4(),
  org_id      uuid not null references organizations(id) on delete cascade,
  name        text not null,
  trigger_type text not null check (trigger_type in (
    'pricing_viewed','no_activity','new_stakeholder',
    'task_overdue','question_posted','proposal_opened',
    'contract_signed','deal_won','deal_stalled'
  )),
  filter_conditions jsonb default '{}',
  actions     jsonb not null default '[]',
  is_active   boolean default true,
  fired_count int default 0,
  created_by  uuid references users(id),
  created_at  timestamptz not null default now()
);

-- ── SUBSCRIPTIONS ─────────────────────────────────────────────
create table subscriptions (
  id                      uuid primary key default uuid_generate_v4(),
  org_id                  uuid not null references organizations(id) on delete cascade,
  stripe_subscription_id  text unique,
  stripe_price_id         text,
  plan                    text not null,
  billing_cycle           text check (billing_cycle in ('monthly','annual')),
  status                  text not null check (status in ('active','past_due','canceled','trialing','paused')),
  current_period_start    timestamptz,
  current_period_end      timestamptz,
  cancel_at               timestamptz,
  created_at              timestamptz not null default now()
);

-- ── INDEXES ───────────────────────────────────────────────────
create index idx_deals_org on deals(org_id, status);
create index idx_deals_room_slug on deals(room_slug);
create index idx_engagement_deal_time on engagement_events(deal_id, occurred_at desc);
create index idx_stakeholders_deal on stakeholders(deal_id);
create index idx_map_tasks_deal on map_tasks(deal_id, status);
create index idx_messages_deal on messages(deal_id, created_at);
create index idx_content_deal on content_items(deal_id, sort_order);

-- ── ROW LEVEL SECURITY ────────────────────────────────────────
alter table organizations enable row level security;
alter table users enable row level security;
alter table deals enable row level security;
alter table stakeholders enable row level security;
alter table content_items enable row level security;
alter table map_tasks enable row level security;
alter table engagement_events enable row level security;
alter table messages enable row level security;
alter table automation_rules enable row level security;
alter table subscriptions enable row level security;

-- Users can only see their own org's data
create policy "Users see own org" on organizations
  for select using (
    id in (select org_id from users where id = auth.uid())
  );

create policy "Users see own org users" on users
  for select using (
    org_id in (select org_id from users where id = auth.uid())
  );

create policy "Users see own org deals" on deals
  for all using (
    org_id in (select org_id from users where id = auth.uid())
  );

create policy "Users see deal stakeholders" on stakeholders
  for all using (
    deal_id in (select id from deals where org_id in (
      select org_id from users where id = auth.uid()
    ))
  );

create policy "Users see deal content" on content_items
  for all using (
    org_id in (select org_id from users where id = auth.uid())
  );

create policy "Users see deal tasks" on map_tasks
  for all using (
    deal_id in (select id from deals where org_id in (
      select org_id from users where id = auth.uid()
    ))
  );

create policy "Users see deal messages" on messages
  for all using (
    deal_id in (select id from deals where org_id in (
      select org_id from users where id = auth.uid()
    ))
  );

create policy "Anyone can insert engagement events" on engagement_events
  for insert with check (true);

create policy "Users see own org engagement" on engagement_events
  for select using (
    deal_id in (select id from deals where org_id in (
      select org_id from users where id = auth.uid()
    ))
  );

-- ── FUNCTIONS ─────────────────────────────────────────────────

-- Auto-update updated_at
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger deals_updated_at before update on deals
  for each row execute function update_updated_at();

create trigger orgs_updated_at before update on organizations
  for each row execute function update_updated_at();

-- Recalculate deal health score
create or replace function calculate_health_score(p_deal_id uuid)
returns int language plpgsql as $$
declare
  v_score int := 50;
  v_last_event timestamptz;
  v_event_count int;
  v_task_done int;
  v_task_total int;
  v_sh_count int;
  v_days_since int;
begin
  -- Engagement recency (max 30 pts)
  select max(occurred_at), count(*) into v_last_event, v_event_count
  from engagement_events where deal_id = p_deal_id
  and occurred_at > now() - interval '14 days';

  if v_last_event is not null then
    v_days_since := extract(epoch from (now() - v_last_event)) / 86400;
    if v_days_since < 1 then v_score := v_score + 30;
    elsif v_days_since < 3 then v_score := v_score + 20;
    elsif v_days_since < 7 then v_score := v_score + 10;
    else v_score := v_score - 10;
    end if;
  end if;

  -- Event volume (max 20 pts)
  if v_event_count > 20 then v_score := v_score + 20;
  elsif v_event_count > 10 then v_score := v_score + 12;
  elsif v_event_count > 3 then v_score := v_score + 6;
  end if;

  -- MAP progress (max 25 pts)
  select count(*) filter (where status='done'), count(*)
  into v_task_done, v_task_total from map_tasks where deal_id = p_deal_id;
  if v_task_total > 0 then
    v_score := v_score + ((v_task_done::float / v_task_total) * 25)::int;
  end if;

  -- Stakeholder count (max 15 pts)
  select count(*) into v_sh_count from stakeholders where deal_id = p_deal_id;
  if v_sh_count >= 4 then v_score := v_score + 15;
  elsif v_sh_count >= 2 then v_score := v_score + 8;
  elsif v_sh_count >= 1 then v_score := v_score + 3;
  end if;

  return greatest(0, least(100, v_score));
end;
$$;

-- ── SEED DATA (remove in production) ──────────────────────────
-- Uncomment to add demo data for testing:
/*
insert into organizations (name, slug, plan) values
  ('TechWave Sales', 'techwave', 'growth');
*/
