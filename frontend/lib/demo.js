// dealiq/frontend/lib/demo.js
// ─────────────────────────────────────────────────────────────
// DEMO MODE — no backend, no Supabase, no Stripe needed
// Everything is mocked with realistic data
// Remove this file and set NEXT_PUBLIC_DEMO_MODE=false for production
// ─────────────────────────────────────────────────────────────

export const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true'

// ── DEMO USER & ORG ──────────────────────────────────────────
export const DEMO_USER = {
    id: 'demo-user-001',
    email: 'demo@dealiq.io',
    full_name: 'Vikram Singh',
    role: 'admin',
    title: 'Sales Manager',
    avatar_url: null,
    org_id: 'demo-org-001',
}

export const DEMO_ORG = {
    id: 'demo-org-001',
    name: 'TechWave Sales',
    slug: 'techwave-sales',
    plan: 'growth',
    trial_ends_at: null,
    seat_count: 8,
    brand_color: '#3d5afe',
}

// ── DEMO DEALS ────────────────────────────────────────────────
export const DEMO_DEALS = [
    {
        id: 'deal-001',
        name: 'Enterprise Platform Q3 2025',
        company_name: 'Acme Corp',
        company_domain: 'acmecorp.com',
        stage: 'negotiation',
        status: 'active',
        value: 1800000,
        currency: 'INR',
        close_date: '2025-04-15',
        health_score: 82,
        win_probability: 0.78,
        room_slug: 'acme-corp',
        updated_at: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
        owner: { id: 'demo-user-001', full_name: 'Vikram Singh', email: 'demo@dealiq.io' },
        stakeholders: [
            { id: 'sh-001', full_name: 'Rahul Kumar', email: 'rahul@acmecorp.com', title: 'CTO', role_in_deal: 'decision_maker', engagement_score: 85, last_seen_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(), visit_count: 8 },
            { id: 'sh-002', full_name: 'Priya Sharma', email: 'priya@acmecorp.com', title: 'CFO', role_in_deal: 'budget_owner', engagement_score: 72, last_seen_at: new Date(Date.now() - 2 * 60 * 1000).toISOString(), visit_count: 5 },
            { id: 'sh-003', full_name: 'Arjun Mehta', email: 'arjun@acmecorp.com', title: 'IT Head', role_in_deal: 'influencer', engagement_score: 31, last_seen_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(), visit_count: 2 },
        ],
        map_tasks: [
            { id: 'task-001', title: 'Discovery call completed', status: 'completed', owner_side: 'seller', phase: 1, sort_order: 1, due_date: '2025-03-10' },
            { id: 'task-002', title: 'Demo walkthrough delivered', status: 'completed', owner_side: 'seller', phase: 1, sort_order: 2, due_date: '2025-03-15' },
            { id: 'task-003', title: 'Security questionnaire returned', status: 'completed', owner_side: 'buyer', phase: 1, sort_order: 3, due_date: '2025-03-20' },
            { id: 'task-004', title: 'Legal terms reviewed & approved', status: 'completed', owner_side: 'buyer', phase: 2, sort_order: 1, due_date: '2025-03-23' },
            { id: 'task-005', title: 'CFO budget sign-off', status: 'overdue', owner_side: 'buyer', phase: 2, sort_order: 2, due_date: '2025-03-25' },
            { id: 'task-006', title: 'IT POC integration sign-off', status: 'pending', owner_side: 'buyer', phase: 2, sort_order: 3, due_date: '2025-04-01' },
            { id: 'task-007', title: 'Commercial proposal accepted', status: 'pending', owner_side: 'buyer', phase: 3, sort_order: 1, due_date: '2025-04-08' },
            { id: 'task-008', title: 'Contract signed by both parties', status: 'pending', owner_side: 'buyer', phase: 3, sort_order: 2, due_date: '2025-04-15' },
        ],
    },
    {
        id: 'deal-002',
        name: 'Platform Modernisation H1',
        company_name: 'TechWave Platform',
        company_domain: 'techwave.io',
        stage: 'proposal',
        status: 'active',
        value: 4200000,
        currency: 'INR',
        close_date: '2025-05-01',
        health_score: 61,
        win_probability: 0.55,
        room_slug: 'techwave-platform',
        updated_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        owner: { id: 'demo-user-001', full_name: 'Vikram Singh', email: 'demo@dealiq.io' },
        stakeholders: [
            { id: 'sh-004', full_name: 'Arun Joshi', email: 'arun@techwave.io', title: 'VP Engineering', role_in_deal: 'champion', engagement_score: 68, last_seen_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(), visit_count: 6 },
        ],
        map_tasks: [
            { id: 'task-009', title: 'Discovery call', status: 'completed', owner_side: 'seller', phase: 1, sort_order: 1, due_date: '2025-03-05' },
            { id: 'task-010', title: 'Technical requirements doc', status: 'pending', owner_side: 'buyer', phase: 1, sort_order: 2, due_date: '2025-04-10' },
        ],
    },
    {
        id: 'deal-003',
        name: 'Retail Suite Upgrade',
        company_name: 'NovaMart',
        company_domain: 'novamart.in',
        stage: 'demo',
        status: 'stalled',
        value: 800000,
        currency: 'INR',
        close_date: '2025-04-20',
        health_score: 28,
        win_probability: 0.22,
        room_slug: 'novamart',
        updated_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
        owner: { id: 'demo-user-001', full_name: 'Vikram Singh', email: 'demo@dealiq.io' },
        stakeholders: [
            { id: 'sh-005', full_name: 'Deepak Sharma', email: 'deepak@novamart.in', title: 'CEO', role_in_deal: 'decision_maker', engagement_score: 22, last_seen_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(), visit_count: 2 },
        ],
        map_tasks: [
            { id: 'task-011', title: 'Discovery call', status: 'completed', owner_side: 'seller', phase: 1, sort_order: 1 },
            { id: 'task-012', title: 'Demo scheduled', status: 'overdue', owner_side: 'buyer', phase: 1, sort_order: 2, due_date: '2025-03-28' },
        ],
    },
    {
        id: 'deal-004',
        name: 'Logistics CRM Integration',
        company_name: 'SkyPath Logistics',
        company_domain: 'skypath.com',
        stage: 'closing',
        status: 'active',
        value: 3100000,
        currency: 'INR',
        close_date: '2025-04-15',
        health_score: 93,
        win_probability: 0.91,
        room_slug: 'skypath-logistics',
        updated_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
        owner: { id: 'demo-user-001', full_name: 'Vikram Singh', email: 'demo@dealiq.io' },
        stakeholders: [
            { id: 'sh-006', full_name: 'Rohit Verma', email: 'rohit@skypath.com', title: 'CEO', role_in_deal: 'decision_maker', engagement_score: 91, last_seen_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(), visit_count: 12 },
        ],
        map_tasks: [
            { id: 'task-013', title: 'Discovery call', status: 'completed', owner_side: 'seller', phase: 1, sort_order: 1 },
            { id: 'task-014', title: 'POC integration sign-off', status: 'completed', owner_side: 'buyer', phase: 2, sort_order: 1, due_date: '2025-04-01' },
            { id: 'task-015', title: 'Contract signed', status: 'pending', owner_side: 'buyer', phase: 3, sort_order: 1, due_date: '2025-04-15' },
        ],
    },
]

// ── DEMO ENGAGEMENT EVENTS ────────────────────────────────────
export const DEMO_EVENTS = [
    { id: 'ev-001', deal_id: 'deal-001', event_type: 'content_opened', occurred_at: new Date(Date.now() - 2 * 60 * 1000).toISOString(), duration_s: 374, stakeholder: { full_name: 'Priya Sharma', email: 'priya@acmecorp.com' } },
    { id: 'ev-002', deal_id: 'deal-002', event_type: 'stakeholder_joined', occurred_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(), duration_s: 0, stakeholder: { full_name: 'Arun Joshi', email: 'arun@techwave.io' } },
    { id: 'ev-003', deal_id: 'deal-004', event_type: 'map_task_completed', occurred_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(), duration_s: 0, stakeholder: { full_name: 'Rohit Verma', email: 'rohit@skypath.com' } },
    { id: 'ev-004', deal_id: 'deal-003', event_type: 'room_viewed', occurred_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(), duration_s: 72, stakeholder: { full_name: 'Deepak Sharma', email: 'deepak@novamart.in' } },
    { id: 'ev-005', deal_id: 'deal-001', event_type: 'question_posted', occurred_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), duration_s: 0, stakeholder: { full_name: 'Rahul Kumar', email: 'rahul@acmecorp.com' } },
]

// ── DEMO STATS ─────────────────────────────────────────────────
export const DEMO_STATS = {
    pipeline_value: 9900000,
    avg_health_score: 66,
    status_counts: { active: 3, stalled: 1, won: 3, lost: 1 },
    stage_counts: { discovery: 1, demo: 1, proposal: 1, negotiation: 1, closing: 1 },
    recent_wins: [
        { name: 'Zeta Finance Suite', company_name: 'Zeta Tech', value: 2400000 },
    ],
}

// ── DEMO TEAM ─────────────────────────────────────────────────
export const DEMO_TEAM = [
    { id: 'demo-user-001', full_name: 'Vikram Singh', email: 'demo@dealiq.io', role: 'admin', title: 'Sales Manager', last_active_at: new Date().toISOString() },
    { id: 'demo-user-002', full_name: 'Priya Rao', email: 'priya@dealiq.io', role: 'sales', title: 'Account Executive' },
    { id: 'demo-user-003', full_name: 'Rahul Kapoor', email: 'rahul@dealiq.io', role: 'sales', title: 'Account Executive' },
    { id: 'demo-user-004', full_name: 'Anita Nair', email: 'anita@dealiq.io', role: 'sales', title: 'Account Executive' },
]
