"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/* ---------- tiny inline icons (no extra deps) ---------- */
function MailIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="5" width="18" height="14" rx="3" stroke="currentColor" strokeWidth="1.6" />
      <path d="m4 7 8 6 8-6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function LockIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <rect x="4.5" y="10.5" width="15" height="9.5" rx="2.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8 10.5V7.8a4 4 0 1 1 8 0v2.7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
function EyeIcon({ off }: { off?: boolean }) {
  return off ? (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M3 3l18 18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M10.6 5.2A10.6 10.6 0 0 1 12 5c5.5 0 9 5 9 7-.4.7-1.2 1.9-2.5 3M6.2 6.8C4 8.3 2.6 10.3 2 12c1 2 4.5 7 10 7 1.2 0 2.3-.2 3.3-.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9.5 10a3 3 0 0 0 4.3 4.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}
function ChevronLeft() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M15 5 8 12l7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function Spinner() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="animate-spin">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" strokeOpacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

/* ---------- 6-box OTP input ---------- */
function OtpBoxes({ value, onChange, autoFocus }: { value: string; onChange: (v: string) => void; autoFocus?: boolean }) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length: 6 }, (_, i) => value[i] ?? "");

  function setDigit(i: number, d: string) {
    const clean = d.replace(/\D/g, "").slice(-1);
    const next = digits.slice();
    next[i] = clean;
    onChange(next.join(""));
    if (clean && i < 5) refs.current[i + 1]?.focus();
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!text) return;
    e.preventDefault();
    onChange(text);
    const focusIndex = Math.min(text.length, 5);
    refs.current[focusIndex]?.focus();
  }

  return (
    <div className="flex justify-between gap-2" onPaste={handlePaste}>
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          value={d}
          autoFocus={autoFocus && i === 0}
          inputMode="numeric"
          maxLength={1}
          onChange={(e) => setDigit(i, e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Backspace" && !digits[i] && i > 0) refs.current[i - 1]?.focus();
          }}
          style={{ fontSize: 20 }}
          className="h-14 w-full min-w-0 rounded-2xl border border-white/10 bg-ink-800 text-center font-semibold text-white outline-none transition focus:border-violet focus:ring-2 focus:ring-violet/30"
        />
      ))}
    </div>
  );
}

/* ---------- shared field wrapper ---------- */
function Field({
  label,
  icon,
  right,
  children,
}: {
  label: string;
  icon?: React.ReactNode;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <label className="text-xs font-medium text-mist-light">{label}</label>
        {right}
      </div>
      <div className="relative">
        {icon && <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-mist/70">{icon}</span>}
        {children}
      </div>
    </div>
  );
}

const inputBase =
  "w-full rounded-2xl border border-white/10 bg-ink-800 py-3.5 text-white placeholder:text-mist/40 outline-none transition focus:border-violet focus:ring-2 focus:ring-violet/20";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [mode, setMode] = useState<
    "password" | "otp-email" | "otp-verify" | "forgot-email" | "forgot-otp" | "forgot-newpass"
  >("password");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function resetState() {
    setOtp("");
    setError(null);
    setNewPassword("");
    setConfirmPassword("");
  }

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

  // Send OTP (login)
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

  // Verify OTP (login)
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

  // Send OTP (forgot password)
  async function handleForgotSendOtp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error: err } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false },
    });
    if (err) {
      setError("No account found with this email.");
    } else {
      setMode("forgot-otp");
    }
    setLoading(false);
  }

  // Verify OTP (forgot password)
  async function handleForgotVerifyOtp(e: React.FormEvent) {
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
      setMode("forgot-newpass");
    }
    setLoading(false);
  }

  // Set new password
  async function handleSetNewPassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setLoading(true);
    setError(null);
    const { error: err } = await supabase.auth.updateUser({ password: newPassword });
    if (err) {
      setError(err.message);
    } else {
      router.push("/chat");
      router.refresh();
    }
    setLoading(false);
  }

  const showBrandHeader = mode === "password";

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-ink-900 px-5 py-10">
      <div className="pointer-events-none absolute inset-0 bg-aurora" />
      {/* floating gradient orbs for depth */}
      <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-violet/25 blur-[100px]" />
      <div className="pointer-events-none absolute -bottom-24 -right-16 h-80 w-80 rounded-full bg-violet-light/20 blur-[110px]" />

      <div className="glass animate-fadeUp relative z-10 w-full max-w-md rounded-[28px] p-8 shadow-2xl">
        {/* Brand */}
        <div className="flex items-center gap-3">
          {mode !== "password" ? (
            <button
              onClick={() => {
                resetState();
                if (mode === "otp-verify") setMode("otp-email");
                else if (mode === "otp-email") setMode("password");
                else if (mode === "forgot-otp") setMode("forgot-email");
                else if (mode === "forgot-email") setMode("password");
                else if (mode === "forgot-newpass") setMode("forgot-otp");
              }}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/5 text-mist transition hover:bg-white/10 hover:text-white"
              aria-label="Back"
            >
              <ChevronLeft />
            </button>
          ) : null}
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-br from-violet to-violet-light shadow-lg shadow-violet/40">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5c-1.35 0-2.62-.32-3.75-.9L3 21l1.9-5.75A8.47 8.47 0 0 1 3.5 11.5 8.5 8.5 0 0 1 12 3a8.5 8.5 0 0 1 9 8.5Z" fill="white" fillOpacity="0.95" />
              </svg>
            </span>
            <span className="font-display text-lg font-bold text-white">
              Aira<span className="text-gradient">Think!</span>
            </span>
          </Link>
        </div>

        {showBrandHeader && (
          <p className="mt-2 pl-0.5 text-[13px] text-mist/70">Where conversations think ahead ⚡</p>
        )}

        {/* PASSWORD LOGIN */}
        {mode === "password" && (
          <>
            <h1 className="mt-7 font-display text-2xl font-bold text-white">Welcome back</h1>
            <p className="mt-1 text-sm text-mist">Log in to continue chatting.</p>

            <form onSubmit={handlePasswordLogin} className="mt-7 flex flex-col gap-4">
              <Field label="Email" icon={<MailIcon />}>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  style={{ fontSize: 16 }}
                  className={`${inputBase} pl-11 pr-4`}
                />
              </Field>

              <Field
                label="Password"
                icon={<LockIcon />}
                right={
                  <button
                    type="button"
                    onClick={() => { resetState(); setMode("forgot-email"); }}
                    className="text-xs font-medium text-violet-light hover:underline"
                  >
                    Forgot password?
                  </button>
                }
              >
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Your password"
                  style={{ fontSize: 16 }}
                  className={`${inputBase} pl-11 pr-11`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-mist/70 transition hover:text-white"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  <EyeIcon off={showPassword} />
                </button>
              </Field>

              {error && (
                <p className="rounded-xl bg-red-500/10 px-3.5 py-2.5 text-xs text-red-400">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="mt-2 flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet to-violet-light py-3.5 text-sm font-semibold text-white shadow-lg shadow-violet/30 transition-all hover:shadow-violet/50 hover:brightness-110 active:scale-[0.98] disabled:opacity-60"
              >
                {loading && <Spinner />}
                {loading ? "Logging in…" : "Log in"}
              </button>
            </form>

            <div className="mt-6 flex items-center gap-3">
              <div className="h-px flex-1 bg-white/10" />
              <span className="text-xs text-mist">or</span>
              <div className="h-px flex-1 bg-white/10" />
            </div>

            <button
              onClick={() => { resetState(); setMode("otp-email"); }}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] py-3.5 text-sm font-semibold text-white transition hover:bg-white/[0.07] active:scale-[0.98]"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <rect x="3" y="6" width="18" height="12" rx="2.5" stroke="currentColor" strokeWidth="1.6" />
                <path d="M3 8l9 6 9-6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Log in with OTP
            </button>

            <p className="mt-7 text-center text-sm text-mist">
              Don&apos;t have an account?{" "}
              <Link href="/signup" className="font-medium text-violet-light hover:underline">
                Sign up
              </Link>
            </p>
          </>
        )}

        {/* OTP LOGIN - EMAIL */}
        {mode === "otp-email" && (
          <>
            <h1 className="mt-7 font-display text-2xl font-bold text-white">Log in with OTP</h1>
            <p className="mt-1 text-sm text-mist">We&apos;ll send a 6-digit code to your email.</p>

            <form onSubmit={handleSendOtp} className="mt-7 flex flex-col gap-4">
              <Field label="Email" icon={<MailIcon />}>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  style={{ fontSize: 16 }}
                  className={`${inputBase} pl-11 pr-4`}
                />
              </Field>

              {error && (
                <p className="rounded-xl bg-red-500/10 px-3.5 py-2.5 text-xs text-red-400">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="mt-2 flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet to-violet-light py-3.5 text-sm font-semibold text-white shadow-lg shadow-violet/30 transition-all hover:shadow-violet/50 active:scale-[0.98] disabled:opacity-60"
              >
                {loading && <Spinner />}
                {loading ? "Sending…" : "Send OTP"}
              </button>
            </form>
          </>
        )}

        {/* OTP LOGIN - VERIFY */}
        {mode === "otp-verify" && (
          <>
            <h1 className="mt-7 font-display text-2xl font-bold text-white">Enter your code</h1>
            <p className="mt-1 text-sm text-mist">
              A 6-digit code was sent to <span className="font-medium text-white">{email}</span>.
            </p>

            <form onSubmit={handleVerifyOtp} className="mt-7 flex flex-col gap-4">
              <OtpBoxes value={otp} onChange={setOtp} autoFocus />

              {error && (
                <p className="rounded-xl bg-red-500/10 px-3.5 py-2.5 text-xs text-red-400">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading || otp.length !== 6}
                className="mt-2 flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet to-violet-light py-3.5 text-sm font-semibold text-white shadow-lg shadow-violet/30 transition-all hover:shadow-violet/50 active:scale-[0.98] disabled:opacity-60"
              >
                {loading && <Spinner />}
                {loading ? "Verifying…" : "Log in"}
              </button>
            </form>
          </>
        )}

        {/* FORGOT PASSWORD - EMAIL */}
        {mode === "forgot-email" && (
          <>
            <h1 className="mt-7 font-display text-2xl font-bold text-white">Reset password</h1>
            <p className="mt-1 text-sm text-mist">Enter your email — we&apos;ll send a verification code.</p>

            <form onSubmit={handleForgotSendOtp} className="mt-7 flex flex-col gap-4">
              <Field label="Email" icon={<MailIcon />}>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  style={{ fontSize: 16 }}
                  className={`${inputBase} pl-11 pr-4`}
                />
              </Field>

              {error && (
                <p className="rounded-xl bg-red-500/10 px-3.5 py-2.5 text-xs text-red-400">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="mt-2 flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet to-violet-light py-3.5 text-sm font-semibold text-white shadow-lg shadow-violet/30 transition-all hover:shadow-violet/50 active:scale-[0.98] disabled:opacity-60"
              >
                {loading && <Spinner />}
                {loading ? "Sending…" : "Send Code"}
              </button>
            </form>
          </>
        )}

        {/* FORGOT PASSWORD - OTP VERIFY */}
        {mode === "forgot-otp" && (
          <>
            <h1 className="mt-7 font-display text-2xl font-bold text-white">Enter your code</h1>
            <p className="mt-1 text-sm text-mist">
              A 6-digit code was sent to <span className="font-medium text-white">{email}</span>.
            </p>

            <form onSubmit={handleForgotVerifyOtp} className="mt-7 flex flex-col gap-4">
              <OtpBoxes value={otp} onChange={setOtp} autoFocus />

              {error && (
                <p className="rounded-xl bg-red-500/10 px-3.5 py-2.5 text-xs text-red-400">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading || otp.length !== 6}
                className="mt-2 flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet to-violet-light py-3.5 text-sm font-semibold text-white shadow-lg shadow-violet/30 transition-all hover:shadow-violet/50 active:scale-[0.98] disabled:opacity-60"
              >
                {loading && <Spinner />}
                {loading ? "Verifying…" : "Verify Code"}
              </button>
            </form>
          </>
        )}

        {/* FORGOT PASSWORD - SET NEW PASSWORD */}
        {mode === "forgot-newpass" && (
          <>
            <h1 className="mt-7 font-display text-2xl font-bold text-white">Set new password</h1>
            <p className="mt-1 text-sm text-mist">Choose a strong new password.</p>

            <form onSubmit={handleSetNewPassword} className="mt-7 flex flex-col gap-4">
              <Field label="New password" icon={<LockIcon />}>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  style={{ fontSize: 16 }}
                  className={`${inputBase} pl-11 pr-4`}
                />
              </Field>

              <Field label="Confirm password" icon={<LockIcon />}>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat your password"
                  style={{ fontSize: 16 }}
                  className={`${inputBase} pl-11 pr-4`}
                />
              </Field>

              {error && (
                <p className="rounded-xl bg-red-500/10 px-3.5 py-2.5 text-xs text-red-400">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="mt-2 flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet to-violet-light py-3.5 text-sm font-semibold text-white shadow-lg shadow-violet/30 transition-all hover:shadow-violet/50 active:scale-[0.98] disabled:opacity-60"
              >
                {loading && <Spinner />}
                {loading ? "Saving…" : "Save New Password"}
              </button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
