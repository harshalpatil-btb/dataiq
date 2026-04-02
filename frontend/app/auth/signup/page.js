'use client'
// dealiq/frontend/app/auth/signup/page.js

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { auth } from '../../../lib/api'
import { useAuthStore } from '../../../lib/store'

export default function SignupPage() {
  const router = useRouter()
  const setAuth = useAuthStore(s => s.setAuth)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')
  const [pwScore, setPwScore] = useState(0)
  const [form, setForm] = useState({ email: '', password: '', full_name: '', org_name: '' })

  function update(k, v) { setForm(f => ({ ...f, [k]: v })) }

  function checkPw(v) {
    let s = 0
    if (v.length >= 8) s++
    if (/[A-Z]/.test(v)) s++
    if (/[0-9]/.test(v)) s++
    if (/[^A-Za-z0-9]/.test(v)) s++
    setPwScore(s)
  }

  const pwColors = ['#dc2626', '#d97706', '#84cc16', '#16a34a']
  const pwLabels = ['Weak', 'Fair', 'Good', 'Strong']

  async function handleSubmit(e) {
    e.preventDefault()
    if (pwScore < 2) { setError('Please choose a stronger password.'); return }
    setLoading(true); setError('')
    try {
      const data = await auth.signup(form)
      setAuth(data)
      router.push('/onboarding')
    } catch (err) {
      setError(err.message || 'Signup failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f6f5f2] px-4 py-12">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center gap-2 mb-8 justify-center">
          <div className="w-8 h-8 rounded-lg bg-[#3d5afe] flex items-center justify-center text-white font-black text-sm">D</div>
          <span className="font-extrabold text-lg">DealIQ</span>
        </div>

        {/* Trial badge */}
        <div className="flex items-center justify-center gap-2 mb-6">
          <div className="flex items-center gap-2 bg-[rgba(22,163,74,0.1)] border border-[rgba(22,163,74,0.2)] rounded-full px-4 py-1.5 text-xs font-bold text-[#16a34a]">
            <div className="w-1.5 h-1.5 rounded-full bg-[#16a34a] animate-pulse" />
            4-day free trial · No credit card needed
          </div>
        </div>

        <div className="bg-white rounded-2xl p-8 shadow-[0_4px_24px_rgba(0,0,0,0.08)] border border-[rgba(17,17,25,0.08)]">
          <h1 className="text-xl font-extrabold tracking-tight mb-1">Create your account</h1>
          <p className="text-[#8a8899] text-sm mb-6">Join 2,000+ sales teams closing smarter.</p>

          {error && (
            <div className="bg-[rgba(220,38,38,0.08)] border border-[rgba(220,38,38,0.2)] rounded-lg px-3 py-2.5 text-[#dc2626] text-xs font-semibold mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-[#2e2e3a] mb-1">Full name</label>
                <input
                  required type="text" placeholder="Rahul Kumar"
                  value={form.full_name} onChange={e => update('full_name', e.target.value)}
                  className="w-full px-3 py-2.5 rounded-[9px] border-[1.5px] border-[rgba(17,17,25,0.14)] bg-[#f6f5f2] text-sm outline-none focus:border-[#3d5afe] focus:shadow-[0_0_0_3px_rgba(61,90,254,0.12)] transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#2e2e3a] mb-1">Company name</label>
                <input
                  required type="text" placeholder="Acme Corp"
                  value={form.org_name} onChange={e => update('org_name', e.target.value)}
                  className="w-full px-3 py-2.5 rounded-[9px] border-[1.5px] border-[rgba(17,17,25,0.14)] bg-[#f6f5f2] text-sm outline-none focus:border-[#3d5afe] focus:shadow-[0_0_0_3px_rgba(61,90,254,0.12)] transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#2e2e3a] mb-1">Work email</label>
              <input
                required type="email" placeholder="rahul@acmecorp.com"
                value={form.email} onChange={e => update('email', e.target.value)}
                className="w-full px-3 py-2.5 rounded-[9px] border-[1.5px] border-[rgba(17,17,25,0.14)] bg-[#f6f5f2] text-sm outline-none focus:border-[#3d5afe] focus:shadow-[0_0_0_3px_rgba(61,90,254,0.12)] transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#2e2e3a] mb-1">Password</label>
              <input
                required type="password" placeholder="Min. 8 characters"
                value={form.password}
                onChange={e => { update('password', e.target.value); checkPw(e.target.value) }}
                className="w-full px-3 py-2.5 rounded-[9px] border-[1.5px] border-[rgba(17,17,25,0.14)] bg-[#f6f5f2] text-sm outline-none focus:border-[#3d5afe] focus:shadow-[0_0_0_3px_rgba(61,90,254,0.12)] transition-all"
              />
              {form.password && (
                <div className="mt-1.5">
                  <div className="flex gap-1 mb-1">
                    {[0,1,2,3].map(i => (
                      <div key={i} className="flex-1 h-1 rounded-full transition-all" style={{ background: i < pwScore ? pwColors[pwScore-1] : '#e8e5df' }} />
                    ))}
                  </div>
                  {pwScore > 0 && <div className="text-[10px] font-bold" style={{ color: pwColors[pwScore-1] }}>{pwLabels[pwScore-1]}</div>}
                </div>
              )}
            </div>

            <button
              type="submit" disabled={loading}
              className="w-full py-3 rounded-[9px] bg-[#3d5afe] text-white text-sm font-bold mt-2 transition-all hover:bg-[#536dfe] hover:-translate-y-0.5 shadow-[0_2px_10px_rgba(61,90,254,0.25)] disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating account…' : 'Start free trial →'}
            </button>
          </form>

          <p className="text-[10px] text-[#b5b3c1] text-center mt-4">
            By signing up you agree to our{' '}
            <Link href="/terms" className="text-[#3d5afe]">Terms</Link> and{' '}
            <Link href="/privacy" className="text-[#3d5afe]">Privacy Policy</Link>
          </p>
        </div>

        <p className="text-center text-xs text-[#8a8899] mt-5">
          Already have an account?{' '}
          <Link href="/auth/login" className="text-[#3d5afe] font-bold">Sign in →</Link>
        </p>
      </div>
    </div>
  )
}
