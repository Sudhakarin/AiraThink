'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const supabase = createClient()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [step, setStep] = useState<'email' | 'otp'>('email')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Step 1: OTP bhejo
  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error: err } = await supabase.auth.signInWithOtp({
      email: email,
    })

    if (err) {
      setError(err.message)
    } else {
      setStep('otp') // OTP form dikhao
    }
    setLoading(false)
  }

  // Step 2: OTP verify karo
  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error: err } = await supabase.auth.verifyOtp({
      email: email,
      token: otp,
      type: 'email',
    })

    if (err) {
      setError(err.message)
    } else {
      router.push('/') // Chat page pe bhejo
    }
    setLoading(false)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-900 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-ink-800/60 p-8 shadow-xl">
        
        <h1 className="mb-2 text-center font-display text-2xl font-bold text-white">
          Aira<span className="text-gradient">Think</span>
        </h1>

        {step === 'email' ? (
          <>
            <p className="mb-6 text-center text-sm text-mist">
              Email dalo, OTP aayega ✉️
            </p>
            <form onSubmit={handleSendOtp} className="space-y-4">
              <input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full rounded-xl border border-white/10 bg-ink-900 px-4 py-3 text-sm text-white placeholder:text-mist/50 focus:border-violet focus:outline-none"
              />
              {error && <p className="text-xs text-red-400">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-full bg-gradient-to-r from-violet to-violet-light py-3 text-sm font-semibold text-white shadow-lg disabled:opacity-50"
              >
                {loading ? 'Bhej raha hai...' : 'OTP Bhejo'}
              </button>
            </form>
          </>
        ) : (
          <>
            <p className="mb-6 text-center text-sm text-mist">
              {email} pe OTP bheja! 📧
            </p>
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <input
                type="text"
                placeholder="6-digit OTP"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                maxLength={6}
                required
                className="w-full rounded-xl border border-white/10 bg-ink-900 px-4 py-3 text-center text-xl tracking-widest text-white placeholder:text-mist/50 focus:border-violet focus:outline-none"
              />
              {error && <p className="text-xs text-red-400">{error}</p>}
              <button
                type="submit"
                disabled={loading || otp.length !== 6}
                className="w-full rounded-full bg-gradient-to-r from-violet to-violet-light py-3 text-sm font-semibold text-white shadow-lg disabled:opacity-50"
              >
                {loading ? 'Verify ho raha...' : 'Login Karo'}
              </button>
              <button
                type="button"
                onClick={() => { setStep('email'); setError(''); setOtp(''); }}
                className="w-full text-xs text-mist hover:text-white"
              >
                ← Email badlo
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
