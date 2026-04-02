// dealiq/frontend/lib/store.js
// Global state with Zustand — auth, org, UI state

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { auth as authApi, saveSession, clearSession } from './api'

// ── AUTH STORE ────────────────────────────────────────────
export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      org: null,
      session: null,
      isLoading: false,
      isAuthenticated: false,

      setAuth: ({ user, org, session }) => {
        if (session) saveSession(session)
        set({ user, org, session, isAuthenticated: true, isLoading: false })
      },

      logout: async () => {
        try { await authApi.logout() } catch {}
        clearSession()
        set({ user: null, org: null, session: null, isAuthenticated: false })
        window.location.href = '/auth/login'
      },

      refreshMe: async () => {
        try {
          const { user, org } = await authApi.me()
          set({ user, org })
        } catch {
          get().logout()
        }
      },

      // Plan helpers
      isOnTrial: () => get().org?.plan === 'trial',
      trialDaysLeft: () => {
        const trialEnd = get().org?.trial_ends_at
        if (!trialEnd) return 0
        return Math.max(0, Math.ceil((new Date(trialEnd) - new Date()) / 86400000))
      },
      canAccess: (feature) => {
        const plan = get().org?.plan || 'trial'
        const gates = {
          trial:      ['deal_rooms', 'map', 'basic_tracking'],
          starter:    ['deal_rooms', 'map', 'basic_tracking', 'content_library'],
          growth:     ['deal_rooms', 'map', 'full_tracking', 'content_library', 'slack_alerts', 'crm_sync', 'automation', 'custom_branding'],
          enterprise: ['deal_rooms', 'map', 'full_tracking', 'content_library', 'slack_alerts', 'crm_sync', 'automation', 'custom_branding', 'ai_drafts', 'sso', 'custom_domain'],
        }
        return (gates[plan] || gates.trial).includes(feature)
      },
    }),
    {
      name: 'dealiq-auth',
      partialize: (s) => ({ user: s.user, org: s.org, isAuthenticated: s.isAuthenticated }),
    }
  )
)

// ── UI STORE ──────────────────────────────────────────────
export const useUIStore = create((set) => ({
  sidebarOpen: true,
  activeDealId: null,
  toast: null,

  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setActiveDeal: (id) => set({ activeDealId: id }),

  showToast: (message, type = 'success', duration = 3500) => {
    set({ toast: { message, type, id: Date.now() } })
    setTimeout(() => set({ toast: null }), duration)
  },

  hideToast: () => set({ toast: null }),
}))
