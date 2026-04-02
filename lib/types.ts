// ============================================================
// DEALIQ — TypeScript Types (mirrors Supabase schema)
// ============================================================

export type Plan = 'trial' | 'starter' | 'growth' | 'enterprise'
export type DealStage = 'discovery' | 'demo' | 'proposal' | 'negotiation' | 'closing' | 'won' | 'lost'
export type DealStatus = 'active' | 'stalled' | 'won' | 'lost' | 'archived'
export type UserRole = 'admin' | 'sales' | 'analyst' | 'viewer'
export type TaskStatus = 'pending' | 'in_progress' | 'done' | 'overdue' | 'skipped'
export type ContentType = 'deck' | 'pdf' | 'video' | 'interactive' | 'image' | 'link' | 'contract'
export type EngagementEventType =
  | 'room_viewed' | 'content_viewed' | 'content_downloaded'
  | 'video_played' | 'question_posted' | 'task_completed'
  | 'contract_signed' | 'link_shared' | 'comment_posted' | 'map_opened'

export interface Organization {
  id: string
  name: string
  slug: string
  plan: Plan
  trial_ends_at: string
  stripe_customer_id?: string
  stripe_subscription_id?: string
  seat_count: number
  logo_url?: string
  website?: string
  gstin?: string
  created_at: string
  updated_at: string
}

export interface User {
  id: string
  org_id: string
  email: string
  full_name?: string
  avatar_url?: string
  role: UserRole
  last_active_at?: string
  created_at: string
}

export interface Deal {
  id: string
  org_id: string
  owner_id: string
  name: string
  company_name: string
  company_domain?: string
  stage: DealStage
  value_inr?: number
  close_date?: string
  health_score: number
  win_probability: number
  room_slug: string
  room_password?: string
  status: DealStatus
  crm_deal_id?: string
  notes?: string
  created_at: string
  updated_at: string
  // joined
  owner?: User
  stakeholders?: Stakeholder[]
  content_items?: ContentItem[]
  map_tasks?: MapTask[]
}

export interface Stakeholder {
  id: string
  deal_id: string
  email: string
  full_name?: string
  title?: string
  role_in_deal: 'champion' | 'decision_maker' | 'blocker' | 'influencer' | 'user' | 'economic_buyer'
  influence_level: 'high' | 'medium' | 'low'
  engagement_score: number
  last_seen_at?: string
  enrichment_data?: Record<string, unknown>
  created_at: string
}

export interface ContentItem {
  id: string
  org_id: string
  deal_id?: string
  title: string
  type: ContentType
  url?: string
  file_key?: string
  file_size?: number
  tags: string[]
  is_library: boolean
  sort_order: number
  view_count: number
  created_by?: string
  created_at: string
}

export interface MapTask {
  id: string
  deal_id: string
  title: string
  description?: string
  owner_side: 'buyer' | 'seller'
  assigned_to?: string
  due_date?: string
  status: TaskStatus
  sort_order: number
  completed_at?: string
  created_at: string
}

export interface EngagementEvent {
  id: string
  deal_id: string
  stakeholder_id?: string
  event_type: EngagementEventType
  content_id?: string
  duration_seconds?: number
  metadata?: Record<string, unknown>
  occurred_at: string
}

export interface Message {
  id: string
  deal_id: string
  sender_type: 'rep' | 'buyer'
  sender_id?: string
  sender_name: string
  sender_email?: string
  content: string
  is_read: boolean
  created_at: string
}

export interface AutomationRule {
  id: string
  org_id: string
  name: string
  trigger_type: string
  filter_conditions: Record<string, unknown>
  actions: AutomationAction[]
  is_active: boolean
  fired_count: number
  created_at: string
}

export interface AutomationAction {
  type: 'slack_dm' | 'email_rep' | 'email_manager' | 'generate_ai_draft' | 'crm_sync' | 'create_task'
  config: Record<string, unknown>
}

// ── API Response types ────────────────────────────────────────
export interface ApiResponse<T> {
  data?: T
  error?: string
  message?: string
}

// ── Dashboard stats ───────────────────────────────────────────
export interface DashboardStats {
  pipeline_value: number
  active_deals: number
  stalled_deals: number
  won_this_month: number
  win_rate: number
  avg_health_score: number
}

// ── Trial status ──────────────────────────────────────────────
export interface TrialStatus {
  is_trial: boolean
  days_remaining: number
  trial_ends_at: string
  is_expired: boolean
  deal_rooms_used: number
  deal_rooms_limit: number
}

// ── Supabase Database type (for typed client) ──────────────────
export interface Database {
  public: {
    Tables: {
      organizations: { Row: Organization; Insert: Partial<Organization>; Update: Partial<Organization> }
      users: { Row: User; Insert: Partial<User>; Update: Partial<User> }
      deals: { Row: Deal; Insert: Partial<Deal>; Update: Partial<Deal> }
      stakeholders: { Row: Stakeholder; Insert: Partial<Stakeholder>; Update: Partial<Stakeholder> }
      content_items: { Row: ContentItem; Insert: Partial<ContentItem>; Update: Partial<ContentItem> }
      map_tasks: { Row: MapTask; Insert: Partial<MapTask>; Update: Partial<MapTask> }
      engagement_events: { Row: EngagementEvent; Insert: Partial<EngagementEvent>; Update: Partial<EngagementEvent> }
      messages: { Row: Message; Insert: Partial<Message>; Update: Partial<Message> }
      automation_rules: { Row: AutomationRule; Insert: Partial<AutomationRule>; Update: Partial<AutomationRule> }
    }
  }
}
