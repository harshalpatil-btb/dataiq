// dealiq/frontend/hooks/index.js
import useSWR from 'swr'
import { useEffect, useRef, useCallback } from 'react'
import { deals, engagement, team, content, billing, realtime } from '../lib/api'
import { useUIStore } from '../lib/store'
import {
  DEMO_MODE,
  DEMO_DEALS, DEMO_EVENTS, DEMO_STATS, DEMO_TEAM,
} from '../lib/demo'

// ── DEALS ─────────────────────────────────────────────────────
export function useDeals(params = {}) {
  const { data, error, isLoading, mutate } = useSWR(
    DEMO_MODE ? null : ['/deals', JSON.stringify(params)],
    () => deals.list(params),
    { refreshInterval: 30000 }
  )
  if (DEMO_MODE) {
    let result = [...DEMO_DEALS]
    if (params.status && params.status !== 'all') result = result.filter(d => d.status === params.status)
    if (params.search) result = result.filter(d => d.company_name.toLowerCase().includes(params.search.toLowerCase()))
    return { deals: result, total: result.length, isLoading: false, error: null, mutate: () => {} }
  }
  return { deals: data?.deals || [], total: data?.total || 0, isLoading, error, mutate }
}

export function useDeal(id) {
  const { data, error, isLoading, mutate } = useSWR(
    DEMO_MODE ? null : (id ? `/deals/${id}` : null),
    () => deals.get(id),
    { revalidateOnFocus: true }
  )
  if (DEMO_MODE) {
    const deal = DEMO_DEALS.find(d => d.id === id) || null
    return { deal, recentEvents: DEMO_EVENTS.filter(e => e.deal_id === id), isLoading: false, error: null, mutate: () => {} }
  }
  return { deal: data?.deal || null, recentEvents: data?.recent_events || [], isLoading, error, mutate }
}

export function useDealStats() {
  const { data, isLoading } = useSWR(DEMO_MODE ? null : '/deals/stats', deals.stats, { refreshInterval: 60000 })
  if (DEMO_MODE) return { stats: DEMO_STATS, isLoading: false }
  return { stats: data || null, isLoading }
}

// ── ENGAGEMENT ─────────────────────────────────────────────────
export function useEngagementFeed(dealId) {
  const { data, error, isLoading, mutate } = useSWR(
    DEMO_MODE ? null : (dealId ? `/engagement/feed/${dealId}` : null),
    () => engagement.feed(dealId),
    { refreshInterval: 15000 }
  )
  if (DEMO_MODE) {
    const evs = dealId ? DEMO_EVENTS.filter(e => e.deal_id === dealId) : DEMO_EVENTS
    return { events: evs, isLoading: false, error: null, mutate: () => {} }
  }
  return { events: data?.events || [], isLoading, error, mutate }
}

export function useEngagementAnalytics(dealId) {
  const { data, isLoading } = useSWR(
    DEMO_MODE ? null : (dealId ? `/engagement/analytics/${dealId}` : null),
    () => engagement.analytics(dealId),
    { refreshInterval: 60000 }
  )
  if (DEMO_MODE) return { analytics: { total_views: 24, unique_viewers: 3, device_breakdown: { desktop: 18, mobile: 6, tablet: 0 } }, isLoading: false }
  return { analytics: data || null, isLoading }
}

export function useRealtimeEngagement(dealId, onEvent) {
  const channelRef = useRef(null)
  useEffect(() => {
    if (!dealId || DEMO_MODE) return
    channelRef.current = realtime.onEngagement(dealId, payload => onEvent?.(payload.new))
    return () => { if (channelRef.current) realtime.unsubscribe(channelRef.current) }
  }, [dealId, onEvent])
}

// ── BILLING ────────────────────────────────────────────────────
export function useSubscription() {
  const { data, isLoading, mutate } = useSWR(DEMO_MODE ? null : '/billing/subscription', billing.subscription)
  if (DEMO_MODE) return {
    subscription: { plan: 'growth', status: 'active', billing_cycle: 'annual', current_period_end: '2026-04-01' },
    isLoading: false, mutate: () => {}
  }
  return { subscription: data || null, isLoading, mutate }
}

export function useInvoices() {
  const { data, isLoading } = useSWR(DEMO_MODE ? null : '/billing/invoices', billing.invoices)
  if (DEMO_MODE) return {
    invoices: [
      { id: 'inv-001', invoice_number: 'DQ-2025-0001', amount_total: 126945, currency: 'INR', status: 'paid', issued_at: '2025-03-01' },
      { id: 'inv-002', invoice_number: 'DQ-2025-0002', amount_total: 126945, currency: 'INR', status: 'paid', issued_at: '2025-02-01' },
    ],
    isLoading: false
  }
  return { invoices: data?.invoices || [], isLoading }
}

export function useFeature(featureName) {
  const { data } = useSWR(DEMO_MODE ? null : (featureName ? `/billing/feature/${featureName}` : null), () => billing.feature(featureName))
  if (DEMO_MODE) return { hasAccess: true, value: true, upgradeRequired: false }
  return { hasAccess: data?.has_access ?? false, value: data?.value, upgradeRequired: data?.upgrade_required ?? false }
}

// ── TEAM ───────────────────────────────────────────────────────
export function useTeam() {
  const { data, isLoading, mutate } = useSWR(DEMO_MODE ? null : '/team', team.list)
  if (DEMO_MODE) return { members: DEMO_TEAM, isLoading: false, mutate: () => {} }
  return { members: data?.members || [], isLoading, mutate }
}

export function useTeamStats() {
  const { data, isLoading } = useSWR(DEMO_MODE ? null : '/team/stats', team.stats, { refreshInterval: 120000 })
  if (DEMO_MODE) return { stats: null, isLoading: false }
  return { stats: data || null, isLoading }
}

// ── CONTENT ────────────────────────────────────────────────────
export function useContent(params = {}) {
  const key = ['/content', JSON.stringify(params)]
  const { data, isLoading, mutate } = useSWR(DEMO_MODE ? null : key, () => content.list(params))
  if (DEMO_MODE) return {
    items: [
      { id: 'c-001', title: 'Product Demo Deck v4.2', type: 'deck', view_count: 248, tags: ['Enterprise','SaaS'] },
      { id: 'c-002', title: 'Pricing & Proposal Template', type: 'pdf', view_count: 184 },
      { id: 'c-003', title: 'Security & Compliance One-Pager', type: 'pdf', view_count: 96 },
      { id: 'c-004', title: 'ROI Calculator — CFO View', type: 'interactive', view_count: 72 },
      { id: 'c-005', title: 'Full Platform Walkthrough', type: 'video', view_count: 138 },
      { id: 'c-006', title: 'Customer Case Studies Pack', type: 'pdf', view_count: 112 },
    ],
    isLoading: false, mutate: () => {}
  }
  return { items: data?.items || [], isLoading, mutate }
}

// ── TOAST ──────────────────────────────────────────────────────
export function useToast() {
  const showToast = useUIStore(s => s.showToast)
  return {
    success: msg => showToast(msg, 'success'),
    error:   msg => showToast(msg, 'error'),
    info:    msg => showToast(msg, 'info'),
  }
}
