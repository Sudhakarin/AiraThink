'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function LoginPage() {
  const supabase = createClient()
  const router = useRouter()

  const [mode, setMode] = useState<'password' | 'otp-email' | 'otp-verify'>('password')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Password login
  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error: err } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (err) {
      setError('Email ya password galat hai.')
    } else {
      router.push('/chat')
      router.refresh()
    }
    setLoading(false)
  }

  // OTP bhejo
  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error: err } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    })

    if (err) {
      setError(err.message)
    } else {
      setMode('otp-verify')
    }
    setLoading(false)
  }

  // OTP verify karo
  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error: err } = await supabase.auth.verifyOtp({
      email,
      token: otp,
      type: 'email',
    })

    if (err) {
      setError('OTP galat hai ya expire ho gaya.')
    } else {
      router.push('/chat')
      router.refresh()
    }
    setLoading(false)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-900 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-ink-800/60 p-8 shadow-xl">

        {/* Logo */}
        <p className="mb-1 font-display text-lg font-bold text-white">
          Aira<span className="text-gradient">Think!</span>
        </p>

        {mode === 'password' && (
          <>
            <h1 className="mb-1 text-2xl font-bold text-white">Welcome back</h1>
            <p className="mb-6 text-sm text-mist">Login karke chat karo.</p>

            <form onSubmit={handlePasswordLogin} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-mist">Email</label>
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full rounded-xl border border-white/10 bg-ink-900 px-4 py-3 text-sm text-white placeholder:text-mist/50 focus:border-violet focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-mist">Password</label>
                <input
                  type="password"
                  placeholder="Apna password daalo"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full rounded-xl border border-white/10 bg-ink-900 px-4 py-3 text-sm text-white placeholder:text-mist/50 focus:border-violet focus:outline-none"
                />
              </div>

              {error && <p className="text-xs text-red-400">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-full bg-gradient-to-r from-violet to-violet-light py-3 text-sm font-semibold text-white shadow-lg shadow-violet/30 disabled:opacity-50"
              >
                {loading ? 'Login ho raha hai...' : 'Log in'}
              </button>
            </form>

            <div className="mt-4 flex items-center gap-3">
              <div className="h-px flex-1 bg-white/10" />
              <span className="text-xs text-mist">ya</span>
              <div className="h-px flex-1 bg-white/10" />
            </div>

            <button
              onClick={() => { setMode('otp-email'); setError('') }}
              className="mt-4 w-full rounded-full border border-white/10 py-3 text-sm font-semibold text-white transition hover:bg-white/5"
            >
              🔢 Login with OTP
            </button>

            <p className="mt-6 text-center text-xs text-mist">
              Account nahi hai?{' '}
              <Link href="/signup" className="font-semibold text-violet-light hover:underline">
                Sign up
              </Link>
            </p>
          </>
        )}

        {mode === 'otp-email' && (
          <>
            <h1 className="mb-1 text-2xl font-bold text-white">OTP Login</h1>
            <p className="mb-6 text-sm text-mist">Email pe 6-digit code aayega.</p>

            <form onSubmit={handleSendOtp} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-mist">Email</label>
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full rounded-xl border border-white/10 bg-ink-900 px-4 py-3 text-sm text-white placeholder:text-mist/50 focus:border-violet focus:outline-none"
                />
              </div>

              {error && <p className="text-xs text-red-400">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-full bg-gradient-to-r from-violet to-violet-light py-3 text-sm font-semibold text-white shadow-lg shadow-violet/30 disabled:opacity-50"
              >
                {loading ? 'Bhej raha hai...' : 'OTP Bhejo'}
              </button>
            </form>

            <button
              onClick={() => { setMode('password'); setError('') }}
              className="mt-4 w-full text-xs text-mist hover:text-white"
            >
              ← Password se login karo
            </button>
          </>
        )}

        {mode === 'otp-verify' && (
          <>
            <h1 className="mb-1 text-2xl font-bold text-white">Code daalo</h1>
            <p className="mb-6 text-sm text-mist">
              <span className="font-medium text-white">{email}</span> pe code bheja gaya hai.
            </p>

            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <input
                type="text"
                placeholder="000000"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                maxLength={6}
                required
                autoFocus
                className="w-full rounded-xl border border-white/10 bg-ink-900 px-4 py-4 text-center text-2xl tracking-[0.5em] text-white placeholder:text-mist/30 focus:border-violet focus:outline-none"
              />

              {error && <p className="text-xs text-red-400">{error}</p>}

              <button
                type="submit"
                disabled={loading || otp.length !== 6}
                className="w-full rounded-full bg-gradient-to-r from-violet to-violet-light py-3 text-sm font-semibold text-white shadow-lg shadow-violet/30 disabled:opacity-50"
              >
                {loading ? 'Verify ho raha...' : 'Login Karo'}
              </button>
            </form>

            <button
              onClick={() => { setMode('otp-email'); setOtp(''); setError('') }}
              className="mt-4 w-full text-xs text-mist hover:text-white"
            >
              ← Email badlo
            </button>
          </>
        )}

      </div>
    </div>
  )
}
