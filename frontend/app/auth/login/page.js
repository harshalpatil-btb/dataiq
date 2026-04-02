'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuthStore } from '../../../lib/store'
import { auth } from '../../../lib/api'

export default function LoginPage() {
  const router = useRouter()
  const setAuth = useAuthStore(s => s.setAuth)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [mode, setMode] = useState('password')
  const [magicSent, setMagicSent] = useState(false)

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      if (mode === 'magic') {
        await auth.magicLink(email)
        setMagicSent(true)
      } else {
        const data = await auth.login({ email, password })
        setAuth(data)
        router.push('/dashboard')
      }
    } catch (err) {
      setError(err.message || 'Login failed. Check your credentials.')
    } finally {
      setLoading(false)
    }
  }

  if (magicSent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f6f5f2] px-4">
        <div className="bg-white rounded-2xl p-10 max-w-md w-full text-center shadow-lg border border-[rgba(17,17,25,0.08)]">
          <div className="text-5xl mb-4">📧</div>
          <h2 className="text-xl font-extrabold mb-2">Check your inbox</h2>
          <p className="text-[#8a8899] text-sm mb-1">We sent a sign-in link to</p>
          <p className="font-bold text-[#3d5afe] mb-6 font-mono text-sm">{email}</p>
          <button onClick={() => { setMagicSent(false); setMode('password') }}
            className="text-sm text-[#3d5afe] font-bold">← Back to login</button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-stretch">
      {/* Left panel */}
      <div className="hidden lg:flex flex-col justify-between w-[420px] shrink-0 bg-[#0f0f18] p-12">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#3d5afe] flex items-center justify-center text-white font-black text-sm">D</div>
          <span className="text-white font-extrabold text-lg tracking-tight">DealIQ</span>
        </div>
        <div>
          {[
            ['🏠', 'Deal Rooms', 'Personalized workspace for every deal'],
            ['⚡', 'Live Alerts', 'Know the moment pricing is viewed'],
            ['🤖', 'AI Follow-ups', 'GPT-4o drafts in 1 click'],
            ['✅', 'Action Plans', 'Shared MAP with buyers'],
          ].map(([icon, title, desc]) => (
            <div key={title} className="flex gap-3 mb-5">
              <div className="w-8 h-8 rounded-lg bg-[rgba(61,90,254,0.12)] flex items-center justify-center text-base shrink-0">{icon}</div>
              <div>
                <div className="text-white text-sm font-bold">{title}</div>
                <div className="text-[rgba(255,255,255,0.4)] text-xs mt-0.5">{desc}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="bg-[rgba(255,255,255,0.04)] rounded-xl p-5 border border-[rgba(255,255,255,0.08)]">
          <div className="text-yellow-400 text-xs mb-2">★★★★★</div>
          <p className="text-[rgba(255,255,255,0.7)] text-sm italic leading-relaxed">"I got a Slack alert the moment the CFO opened pricing. Called within 10 minutes. Closed that week."</p>
          <div className="flex items-center gap-2 mt-3">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-black">VN</div>
            <div>
              <div className="text-white text-xs font-bold">Vivek Nair</div>
              <div className="text-[rgba(255,255,255,0.35)] text-xs">Enterprise AE · Bangalore</div>
            </div>
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="w-8 h-8 rounded-lg bg-[#3d5afe] flex items-center justify-center text-white font-black text-sm">D</div>
            <span className="font-extrabold text-lg">DealIQ</span>
          </div>

          <h1 className="text-2xl font-extrabold tracking-tight mb-1">Welcome back</h1>
          <p className="text-[#8a8899] text-sm mb-8">Sign in to your workspace</p>

          {error && (
            <div className="bg-[rgba(220,38,38,0.08)] border border-[rgba(220,38,38,0.2)] rounded-lg px-4 py-3 text-[#dc2626] text-sm font-semibold mb-5">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-[#2e2e3a] mb-1.5">Work email</label>
              <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="w-full px-3.5 py-2.5 rounded-[9px] border-[1.5px] border-[rgba(17,17,25,0.14)] bg-[#f6f5f2] text-sm outline-none focus:border-[#3d5afe] transition-all" />
            </div>

            {mode === 'password' && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-[#2e2e3a]">Password</label>
                  <Link href="/auth/reset" className="text-xs text-[#3d5afe] font-semibold">Forgot?</Link>
                </div>
                <input type="password" required value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2.5 rounded-[9px] border-[1.5px] border-[rgba(17,17,25,0.14)] bg-[#f6f5f2] text-sm outline-none focus:border-[#3d5afe] transition-all" />
              </div>
            )}

            <button type="submit" disabled={loading}
              className="w-full py-3 rounded-[9px] bg-[#3d5afe] text-white text-sm font-bold transition-all hover:bg-[#536dfe] disabled:opacity-60">
              {loading ? 'Signing in…' : mode === 'magic' ? 'Send magic link →' : 'Sign in →'}
            </button>
          </form>

          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-[rgba(17,17,25,0.08)]" />
            <span className="text-xs text-[#b5b3c1] font-semibold">or</span>
            <div className="flex-1 h-px bg-[rgba(17,17,25,0.08)]" />
          </div>

          <button onClick={() => setMode(mode === 'magic' ? 'password' : 'magic')}
            className="w-full py-2.5 rounded-[9px] bg-white border border-[rgba(17,17,25,0.12)] text-sm font-semibold text-[#2e2e3a] hover:bg-[#f6f5f2] transition-all">
            {mode === 'magic' ? '🔑 Sign in with password' : '✉ Sign in with magic link'}
          </button>

          <p className="text-center text-xs text-[#8a8899] mt-6">
            No account?{' '}
            <Link href="/auth/signup" className="text-[#3d5afe] font-bold">Start free trial →</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
