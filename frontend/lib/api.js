// dealiq/frontend/lib/api.js
// Typed API client — every frontend component uses this

const BASE = process.env.NEXT_PUBLIC_BACKEND_URL

// ── BASE FETCHER ──────────────────────────────────────────

async function apiFetch(path, options = {}) {
  const token = typeof window !== 'undefined'
    ? localStorage.getItem('dealiq_token')
    : null

  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  })

  const data = await res.json()

  if (!res.ok) {
    throw Object.assign(new Error(data.message || data.error || 'API error'), {
      status: res.status,
      code: data.error,
      data,
    })
  }

  return data
}

const get  = (path, params) => {
  const url = params ? `${path}?${new URLSearchParams(params)}` : path
  return apiFetch(url, { method: 'GET' })
}
const post   = (path, body) => apiFetch(path, { method: 'POST',   body })
const patch  = (path, body) => apiFetch(path, { method: 'PATCH',  body })
const del    = (path)       => apiFetch(path, { method: 'DELETE' })

// ── AUTH ──────────────────────────────────────────────────

export const auth = {
  signup:     (data) => post('/auth/signup', data),
  login:      (data) => post('/auth/login', data),
  magicLink:  (email) => post('/auth/magic-link', { email }),
  googleSSO:  (token) => post('/auth/sso/google', { access_token: token }),
  logout:     () => post('/auth/logout'),
  me:         () => get('/auth/me'),
}

// ── DEALS ─────────────────────────────────────────────────

export const deals = {
  list:    (params) => get('/deals', params),
  get:     (id) => get(`/deals/${id}`),
  create:  (data) => post('/deals', data),
  update:  (id, data) => patch(`/deals/${id}`, data),
  delete:  (id) => del(`/deals/${id}`),
  stats:   () => get('/deals/stats/overview'),
}

// ── ROOM (public — no auth needed) ───────────────────────

export const room = {
  get:      (slug) => get(`/rooms/${slug}`),
  verify:   (slug, email, password) => post(`/rooms/${slug}/verify`, { email, password }),
  getMap:   (slug) => get(`/rooms/${slug}/map`),
  getComments: (slug) => get(`/rooms/${slug}/comments`),
  postComment: (slug, data) => post(`/rooms/${slug}/comments`, data),
  updateTask:  (slug, taskId, status) => patch(`/rooms/${slug}/map/${taskId}`, { status }),
  sign:        (slug, data) => post(`/rooms/${slug}/sign`, data),
}

// ── ENGAGEMENT ────────────────────────────────────────────

export const engagement = {
  // Public — call from buyer's browser
  track: (data) => post('/engagement/track', data),
  identify: (data) => post('/engagement/identify', data),

  // Protected
  feed:      (dealId, params) => get(`/engagement/feed/${dealId}`, params),
  analytics: (dealId) => get(`/engagement/analytics/${dealId}`),
}

// ── TEAM ─────────────────────────────────────────────────

export const team = {
  list:   () => get('/team'),
  invite: (data) => post('/team/invite', data),
  update: (userId, data) => patch(`/team/${userId}`, data),
  remove: (userId) => del(`/team/${userId}`),
  stats:  () => get('/team/stats'),
}

// ── CONTENT ──────────────────────────────────────────────

export const content = {
  list:     (params) => get('/content', params),
  get:      (id) => get(`/content/${id}`),
  upload:   (formData) => apiFetch('/content/upload', { method: 'POST', body: formData, headers: {} }),
  delete:   (id) => del(`/content/${id}`),
  addToDeal: (contentId, dealId) => post(`/content/${contentId}/attach`, { deal_id: dealId }),
}

// ── STAKEHOLDERS ──────────────────────────────────────────

export const stakeholders = {
  list:   (dealId) => get(`/deals/${dealId}/stakeholders`),
  add:    (dealId, data) => post(`/deals/${dealId}/stakeholders`, data),
  update: (dealId, id, data) => patch(`/deals/${dealId}/stakeholders/${id}`, data),
  remove: (dealId, id) => del(`/deals/${dealId}/stakeholders/${id}`),
}

// ── MAP TASKS ─────────────────────────────────────────────

export const mapTasks = {
  list:   (dealId) => get(`/deals/${dealId}/map`),
  create: (dealId, data) => post(`/deals/${dealId}/map`, data),
  update: (dealId, id, data) => patch(`/deals/${dealId}/map/${id}`, data),
  delete: (dealId, id) => del(`/deals/${dealId}/map/${id}`),
}

// ── COMMENTS ─────────────────────────────────────────────

export const comments = {
  list:   (dealId) => get(`/deals/${dealId}/comments`),
  post:   (dealId, data) => post(`/deals/${dealId}/comments`, data),
}

// ── AI DRAFTS ─────────────────────────────────────────────

export const aiDrafts = {
  list:      (dealId) => get(`/ai/drafts/${dealId}`),
  send:      (draftId, data) => post(`/ai/drafts/${draftId}/send`, data),
  discard:   (draftId) => del(`/ai/drafts/${draftId}`),
  generate:  (data) => post('/ai/drafts/generate', data),
  variants:  (data) => post('/ai/drafts/variants', data),
}

// ── AUTOMATION ────────────────────────────────────────────

export const automation = {
  listRules:   () => get('/automation/rules'),
  createRule:  (data) => post('/automation/rules', data),
  updateRule:  (id, data) => patch(`/automation/rules/${id}`, data),
  deleteRule:  (id) => del(`/automation/rules/${id}`),
  listRuns:    (ruleId) => get(`/automation/runs${ruleId ? `?rule_id=${ruleId}` : ''}`),
}

// ── BILLING ───────────────────────────────────────────────

export const billing = {
  checkout:     (data) => post('/billing/checkout', data),
  portal:       () => post('/billing/portal'),
  subscription: () => get('/billing/subscription'),
  invoices:     () => get('/billing/invoices'),
  feature:      (name) => get(`/billing/feature/${name}`),
}

// ── REAL-TIME (Supabase channels) ─────────────────────────

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export const realtime = {
  // Subscribe to engagement events for a deal (for live dashboard)
  onEngagement: (dealId, callback) => {
    return supabase
      .channel(`engagement:${dealId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'engagement_events',
        filter: `deal_id=eq.${dealId}`,
      }, callback)
      .subscribe()
  },

  // Subscribe to deal updates (health score, stage changes)
  onDealUpdate: (dealId, callback) => {
    return supabase
      .channel(`deal:${dealId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'deals',
        filter: `id=eq.${dealId}`,
      }, callback)
      .subscribe()
  },

  // Subscribe to new comments
  onComment: (dealId, callback) => {
    return supabase
      .channel(`comments:${dealId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'comments',
        filter: `deal_id=eq.${dealId}`,
      }, callback)
      .subscribe()
  },

  unsubscribe: (channel) => supabase.removeChannel(channel),
}

// ── AUTH HELPERS ──────────────────────────────────────────

export function saveSession(session) {
  if (typeof window === 'undefined') return
  localStorage.setItem('dealiq_token', session.access_token)
  localStorage.setItem('dealiq_refresh', session.refresh_token)
}

export function clearSession() {
  if (typeof window === 'undefined') return
  localStorage.removeItem('dealiq_token')
  localStorage.removeItem('dealiq_refresh')
}

export function getToken() {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('dealiq_token')
}

// ── ENGAGEMENT TRACKER (embed in deal room pages) ─────────

export function createTracker(dealId, stakeholderEmail, stakeholderName) {
  let sessionStart = Date.now()
  let lastContentId = null

  function trackEvent(eventType, extra = {}) {
    engagement.track({
      deal_id: dealId,
      event_type: eventType,
      stakeholder_email: stakeholderEmail,
      stakeholder_name: stakeholderName,
      duration_s: Math.round((Date.now() - sessionStart) / 1000),
      ...extra,
    }).catch(() => {}) // silently fail — never break the buyer experience
  }

  // Track room view on load
  trackEvent('room_viewed')

  // Track tab close / navigation away
  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', () => {
      trackEvent('room_viewed', {
        duration_s: Math.round((Date.now() - sessionStart) / 1000),
      })
    })
  }

  return {
    trackContentOpen: (contentId, contentType) => {
      lastContentId = contentId
      sessionStart = Date.now()
      trackEvent('content_opened', { content_id: contentId, metadata: { content_type: contentType } })
    },
    trackContentScroll: (contentId, scrollDepthPct, pageNumber) => {
      trackEvent('content_scrolled', { content_id: contentId, scroll_depth_pct: scrollDepthPct, page_number: pageNumber })
    },
    trackVideoPlay:  (contentId) => trackEvent('video_played',   { content_id: contentId }),
    trackVideoPause: (contentId) => trackEvent('video_paused',   { content_id: contentId }),
    trackQuestion:   (text)      => trackEvent('question_posted', { metadata: { question_preview: text.slice(0, 100) } }),
    trackContractView: ()        => trackEvent('contract_viewed'),
    trackRoomShare: ()           => trackEvent('room_shared'),
  }
}
