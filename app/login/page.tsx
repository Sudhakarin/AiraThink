"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [mode, setMode] = useState<"password" | "otp-email" | "otp-verify">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Password login
  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error: err } = await supabase.auth.signInWithPassword({ email, password });

    if (err) {
      setError("Incorrect email or password.");
    } else {
      router.push("/chat");
      router.refresh();
    }
    setLoading(false);
  }

  // Send OTP
  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error: err } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    });

    if (err) {
      setError(err.message);
    } else {
      setMode("otp-verify");
    }
    setLoading(false);
  }

  // Verify OTP
  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error: err } = await supabase.auth.verifyOtp({
      email,
      token: otp,
      type: "email",
    });

    if (err) {
      setError("Invalid or expired code. Please try again.");
    } else {
      router.push("/chat");
      router.refresh();
    }
    setLoading(false);
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-ink-900 px-6">
      <div className="pointer-events-none absolute inset-0 bg-aurora" />

      <div className="glass animate-fadeUp relative z-10 w-full max-w-md rounded-3xl p-8 shadow-2xl">
        <Link href="/" className="font-display text-lg font-bold text-white">
          Aira<span className="text-gradient">Think!</span>
        </Link>

        {/* PASSWORD MODE */}
        {mode === "password" && (
          <>
            <h1 className="mt-6 font-display text-2xl font-bold text-white">Welcome back</h1>
            <p className="mt-1 text-sm text-mist">Log in to continue chatting.</p>

            <form onSubmit={handlePasswordLogin} className="mt-8 flex flex-col gap-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-mist-light">Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-xl border border-white/10 bg-ink-800 px-4 py-3 text-sm text-white placeholder:text-mist/50 focus:border-violet focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-mist-light">Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Your password"
                  className="w-full rounded-xl border border-white/10 bg-ink-800 px-4 py-3 text-sm text-white placeholder:text-mist/50 focus:border-violet focus:outline-none"
                />
              </div>

              {error && (
                <p className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="mt-2 rounded-xl bg-gradient-to-r from-violet to-violet-light py-3 text-sm font-semibold text-white shadow-lg shadow-violet/30 transition hover:shadow-violet/50 disabled:opacity-60"
              >
                {loading ? "Logging in…" : "Log in"}
              </button>
            </form>

            <div className="mt-5 flex items-center gap-3">
              <div className="h-px flex-1 bg-white/10" />
              <span className="text-xs text-mist">or</span>
              <div className="h-px flex-1 bg-white/10" />
            </div>

            <button
              onClick={() => { setMode("otp-email"); setError(null); }}
              className="mt-4 w-full rounded-xl border border-white/10 bg-ink-800 py-3 text-sm font-semibold text-white transition hover:bg-white/5"
            >
              Log in with OTP
            </button>

            <p className="mt-6 text-center text-sm text-mist">
              Don&apos;t have an account?{" "}
              <Link href="/signup" className="font-medium text-violet-light hover:underline">
                Sign up
              </Link>
            </p>
          </>
        )}

        {/* OTP EMAIL MODE */}
        {mode === "otp-email" && (
          <>
            <h1 className="mt-6 font-display text-2xl font-bold text-white">Log in with OTP</h1>
            <p className="mt-1 text-sm text-mist">We&apos;ll send a 6-digit code to your email.</p>

            <form onSubmit={handleSendOtp} className="mt-8 flex flex-col gap-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-mist-light">Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-xl border border-white/10 bg-ink-800 px-4 py-3 text-sm text-white placeholder:text-mist/50 focus:border-violet focus:outline-none"
                />
              </div>

              {error && (
                <p className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="mt-2 rounded-xl bg-gradient-to-r from-violet to-violet-light py-3 text-sm font-semibold text-white shadow-lg shadow-violet/30 transition hover:shadow-violet/50 disabled:opacity-60"
              >
                {loading ? "Sending…" : "Send OTP"}
              </button>
            </form>

            <button
              onClick={() => { setMode("password"); setError(null); }}
              className="mt-5 w-full text-center text-sm text-mist hover:text-white"
            >
              ← Back to password login
            </button>
          </>
        )}

        {/* OTP VERIFY MODE */}
        {mode === "otp-verify" && (
          <>
            <h1 className="mt-6 font-display text-2xl font-bold text-white">Enter your code</h1>
            <p className="mt-1 text-sm text-mist">
              A 6-digit code was sent to{" "}
              <span className="font-medium text-white">{email}</span>.
            </p>

            <form onSubmit={handleVerifyOtp} className="mt-8 flex flex-col gap-4">
              <input
                type="text"
                placeholder="000000"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                maxLength={6}
                required
                autoFocus
                className="w-full rounded-xl border border-white/10 bg-ink-800 px-4 py-4 text-center text-2xl tracking-[0.5em] text-white placeholder:text-mist/30 focus:border-violet focus:outline-none"
              />

              {error && (
                <p className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading || otp.length !== 6}
                className="mt-2 rounded-xl bg-gradient-to-r from-violet to-violet-light py-3 text-sm font-semibold text-white shadow-lg shadow-violet/30 transition hover:shadow-violet/50 disabled:opacity-60"
              >
                {loading ? "Verifying…" : "Log in"}
              </button>
            </form>

            <button
              onClick={() => { setMode("otp-email"); setOtp(""); setError(null); }}
              className="mt-5 w-full text-center text-sm text-mist hover:text-white"
            >
              ← Change email
            </button>
          </>
        )}
      </div>
    </main>
  );
}
