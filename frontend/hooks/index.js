// dealiq/frontend/hooks/index.js
// SWR-based data hooks for all API resources

import useSWR from 'swr'
import useSWRMutation from 'swr/mutation'
import { useEffect, useRef } from 'react'
import { deals, engagement, team, content, billing, realtime } from '../lib/api'
import { useUIStore } from '../lib/store'

// ── DEALS ─────────────────────────────────────────────────

export function useDeals(params = {}) {
  const key = ['/deals', JSON.stringify(params)]
  const { data, error, isLoading, mutate } = useSWR(key, () => deals.list(params), {
    refreshInterval: 30000, // refresh every 30s
  })
  return {
    deals: data?.deals || [],
    total: data?.total || 0,
    isLoading,
    error,
    mutate,
  }
}

export function useDeal(id) {
  const { data, error, isLoading, mutate } = useSWR(
    id ? `/deals/${id}` : null,
    () => deals.get(id),
    { revalidateOnFocus: true }
  )
  return {
    deal: data?.deal || null,
    recentEvents: data?.recent_events || [],
    isLoading,
    error,
    mutate,
  }
}

export function useDealStats() {
  const { data, isLoading } = useSWR('/deals/stats', deals.stats, {
    refreshInterval: 60000,
  })
  return { stats: data || null, isLoading }
}

// ── ENGAGEMENT ────────────────────────────────────────────

export function useEngagementFeed(dealId) {
  const { data, error, isLoading, mutate } = useSWR(
    dealId ? `/engagement/feed/${dealId}` : null,
    () => engagement.feed(dealId),
    { refreshInterval: 15000 }
  )
  return { events: data?.events || [], isLoading, error, mutate }
}

export function useEngagementAnalytics(dealId) {
  const { data, isLoading } = useSWR(
    dealId ? `/engagement/analytics/${dealId}` : null,
    () => engagement.analytics(dealId),
    { refreshInterval: 60000 }
  )
  return { analytics: data || null, isLoading }
}

// Real-time subscription to new engagement events
export function useRealtimeEngagement(dealId, onEvent) {
  const channelRef = useRef(null)

  useEffect(() => {
    if (!dealId) return

    channelRef.current = realtime.onEngagement(dealId, (payload) => {
      onEvent?.(payload.new)
    })

    return () => {
      if (channelRef.current) {
        realtime.unsubscribe(channelRef.current)
      }
    }
  }, [dealId, onEvent])
}

// ── BILLING ───────────────────────────────────────────────

export function useSubscription() {
  const { data, isLoading, mutate } = useSWR('/billing/subscription', billing.subscription)
  return { subscription: data || null, isLoading, mutate }
}

export function useInvoices() {
  const { data, isLoading } = useSWR('/billing/invoices', billing.invoices)
  return { invoices: data?.invoices || [], isLoading }
}

export function useFeature(featureName) {
  const { data } = useSWR(
    featureName ? `/billing/feature/${featureName}` : null,
    () => billing.feature(featureName)
  )
  return {
    hasAccess: data?.has_access ?? false,
    value: data?.value,
    upgradeRequired: data?.upgrade_required ?? false,
  }
}

// ── TEAM ─────────────────────────────────────────────────

export function useTeam() {
  const { data, isLoading, mutate } = useSWR('/team', team.list)
  return { members: data?.members || [], isLoading, mutate }
}

export function useTeamStats() {
  const { data, isLoading } = useSWR('/team/stats', team.stats, {
    refreshInterval: 120000,
  })
  return { stats: data || null, isLoading }
}

// ── CONTENT ───────────────────────────────────────────────

export function useContent(params = {}) {
  const key = ['/content', JSON.stringify(params)]
  const { data, isLoading, mutate } = useSWR(key, () => content.list(params))
  return { items: data?.items || [], isLoading, mutate }
}

// ── TOAST HELPER ──────────────────────────────────────────

export function useToast() {
  const showToast = useUIStore(s => s.showToast)
  return {
    success: (msg) => showToast(msg, 'success'),
    error:   (msg) => showToast(msg, 'error'),
    info:    (msg) => showToast(msg, 'info'),
  }
}
