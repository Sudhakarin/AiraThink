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
function ArrowRight() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function CheckIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
      <path d="M5 12.5 10 17 19 7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function GoogleIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24">
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.24 1.4-1.7 4.1-5.5 4.1-3.3 0-6-2.7-6-6.2s2.7-6.2 6-6.2c1.9 0 3.1.8 3.9 1.5l2.6-2.5C16.9 3.2 14.7 2.2 12 2.2 6.9 2.2 2.7 6.4 2.7 11.5S6.9 20.8 12 20.8c6.9 0 9.3-4.9 9.3-7.4 0-.5-.05-.9-.13-1.2H12Z" />
    </svg>
  );
}
function AppleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
      <path d="M16.5 1.5c.1 1.2-.35 2.35-1 3.2-.7.9-1.85 1.6-2.95 1.5-.15-1.15.4-2.35 1.05-3.1.75-.9 2-1.55 2.9-1.6ZM20.9 17.6c-.55 1.25-.8 1.8-1.5 2.9-1 1.55-2.4 3.45-4.15 3.5-1.55.05-1.95-1-4.05-1s-2.55.95-4.1 1c-1.75.05-3.05-1.75-4.05-3.3C.6 17.05-.5 12.8 1 9.9c1.05-2.05 2.9-3.35 4.9-3.4 1.7-.05 2.85 1.05 4.1 1.05 1.2 0 2.05-1.05 4.15-1 1.4.05 2.9.6 3.95 1.65-3.45 2.05-2.9 6.9.3 8.7-.55 1.4-.5 1.5-1.5 2.7Z" />
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
          className="h-14 w-full min-w-0 rounded-2xl border border-white/10 bg-white/[0.04] text-center font-semibold text-white outline-none transition focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-400/25"
        />
      ))}
    </div>
  );
}

/* ---------- pill-style field used across all modes ---------- */
function PillField({
  icon,
  showLabel,
  label,
  children,
}: {
  icon?: React.ReactNode;
  showLabel?: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      {showLabel && <label className="mb-1.5 block pl-1 text-xs font-medium text-white/50">{showLabel}</label>}
      <div className="relative">
        {icon && <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/40">{icon}</span>}
        {children}
      </div>
    </div>
  );
}

const inputBase =
  "w-full rounded-full border border-white/10 bg-white/[0.04] py-3.5 text-white placeholder:text-white/35 outline-none transition focus:border-fuchsia-400/60 focus:ring-2 focus:ring-fuchsia-400/20";

/* ---------- custom checkbox to match the reference art ---------- */
function CheckBox({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onChange}
      className="flex items-center gap-2 text-xs font-medium text-white/60 transition hover:text-white/85"
    >
      <span
        className={`flex h-4.5 w-4.5 items-center justify-center rounded-md border transition ${
          checked
            ? "border-transparent bg-gradient-to-br from-fuchsia-500 via-violet-500 to-blue-500 text-white"
            : "border-white/25 bg-white/5 text-transparent"
        }`}
        style={{ height: 18, width: 18 }}
      >
        <CheckIcon />
      </span>
      {label}
    </button>
  );
}

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
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<string | null>(null);
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
      try {
        if (rememberMe) localStorage.setItem("airalance-last-email", email);
        else localStorage.removeItem("airalance-last-email");
      } catch {}
      router.push("/chat");
      router.refresh();
    }
    setLoading(false);
  }

  // OAuth login (Google / Facebook / Apple)
  async function handleOAuth(provider: "google" | "facebook" | "apple") {
    setOauthLoading(provider);
    setError(null);
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/chat` },
    });
    if (err) {
      setError(err.message);
      setOauthLoading(null);
    }
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

  const showBack = mode !== "password";
  const title =
    mode === "password"
      ? "Login"
      : mode === "otp-email"
      ? "Log in with OTP"
      : mode === "otp-verify"
      ? "Enter your code"
      : mode === "forgot-email"
      ? "Reset password"
      : mode === "forgot-otp"
      ? "Enter your code"
      : "Set new password";

  const subtitle =
    mode === "password"
      ? "Please sign in to continue"
      : mode === "otp-email"
      ? "We'll send a 6-digit code to your email"
      : mode === "otp-verify" || mode === "forgot-otp"
      ? `A 6-digit code was sent to ${email || "your email"}`
      : mode === "forgot-email"
      ? "Enter your email — we'll send a verification code"
      : "Choose a strong new password";

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-black px-5 py-10">
      {/* ambient glow / texture background, echoing the reference art */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-32 top-0 h-[26rem] w-[26rem] rounded-full bg-fuchsia-600/20 blur-[110px]" />
        <div className="absolute -right-28 bottom-0 h-[26rem] w-[26rem] rounded-full bg-blue-600/20 blur-[110px]" />
        <div className="absolute left-1/2 top-1/2 h-[30rem] w-[30rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-600/10 blur-[130px]" />
      </div>

      {/* card with a conic-gradient ring border, evoking the circular frame */}
      <div
        className="animate-fadeUp relative z-10 w-full max-w-md rounded-[40px] p-[1.5px] shadow-2xl"
        style={{ background: "conic-gradient(from 210deg, #ec4899, #a855f7, #6366f1, #3b82f6, #ec4899)" }}
      >
        <div className="rounded-[40px] bg-[#0b0b12]/95 px-7 py-9 backdrop-blur-xl sm:px-9">
          {showBack && (
            <button
              onClick={() => {
                resetState();
                if (mode === "otp-verify") setMode("otp-email");
                else if (mode === "otp-email") setMode("password");
                else if (mode === "forgot-otp") setMode("forgot-email");
                else if (mode === "forgot-email") setMode("password");
                else if (mode === "forgot-newpass") setMode("forgot-otp");
              }}
              className="mb-2 flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-white/60 transition hover:bg-white/10 hover:text-white"
              aria-label="Back"
            >
              <ChevronLeft />
            </button>
          )}

          {/* centered heading, matching the reference */}
          <div className="text-center">
            <h1 className="font-display text-[26px] font-bold text-white">{title}</h1>
            <p className="mt-1.5 text-[13px] text-white/45">{subtitle}</p>
          </div>

          {/* PASSWORD LOGIN */}
          {mode === "password" && (
            <>
              <form onSubmit={handlePasswordLogin} className="mt-7 flex flex-col gap-3.5">
                <PillField icon={<MailIcon />} label="Username">
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Username"
                    style={{ fontSize: 16 }}
                    className={`${inputBase} pl-11 pr-4`}
                  />
                </PillField>

                <PillField icon={<LockIcon />} label="Password">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password"
                    style={{ fontSize: 16 }}
                    className={`${inputBase} pl-11 pr-11`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 transition hover:text-white"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    <EyeIcon off={showPassword} />
                  </button>
                </PillField>

                <div className="mt-0.5 flex items-center justify-between">
                  <CheckBox checked={rememberMe} onChange={() => setRememberMe((v) => !v)} label="Remember me" />
                  <button
                    type="button"
                    onClick={() => { resetState(); setMode("forgot-email"); }}
                    className="text-xs font-medium text-fuchsia-300 hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>

                {error && (
                  <p className="rounded-xl bg-red-500/10 px-3.5 py-2.5 text-xs text-red-400">{error}</p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="mt-2 flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-fuchsia-500 via-violet-500 to-blue-500 py-3.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/30 transition-all hover:shadow-violet-500/50 hover:brightness-110 active:scale-[0.98] disabled:opacity-60"
                >
                  {loading ? <Spinner /> : (
                    <>
                      Login
                      <ArrowRight />
                    </>
                  )}
                </button>
              </form>

              <div className="mt-6 flex items-center gap-3">
                <div className="h-px flex-1 bg-white/10" />
                <span className="text-xs text-white/35">or continue with</span>
                <div className="h-px flex-1 bg-white/10" />
              </div>

              <div className="mt-4 flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => handleOAuth("google")}
                  disabled={!!oauthLoading}
                  aria-label="Continue with Google"
                  className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] transition hover:bg-white/[0.08] disabled:opacity-50"
                >
                  {oauthLoading === "google" ? <Spinner /> : <GoogleIcon />}
                </button>
                <button
                  type="button"
                  onClick={() => handleOAuth("facebook")}
                  disabled={!!oauthLoading}
                  aria-label="Continue with Facebook"
                  className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-[15px] font-bold text-[#1877F2] transition hover:bg-white/[0.08] disabled:opacity-50"
                >
                  {oauthLoading === "facebook" ? <Spinner /> : "f"}
                </button>
                <button
                  type="button"
                  onClick={() => handleOAuth("apple")}
                  disabled={!!oauthLoading}
                  aria-label="Continue with Apple"
                  className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] transition hover:bg-white/[0.08] disabled:opacity-50"
                >
                  {oauthLoading === "apple" ? <Spinner /> : <AppleIcon />}
                </button>
              </div>

              <button
                onClick={() => { resetState(); setMode("otp-email"); }}
                className="mt-5 block w-full text-center text-xs font-medium text-white/40 hover:text-white/70"
              >
                Prefer a code instead? Log in with OTP
              </button>

              <p className="mt-5 text-center text-sm text-white/45">
                Don&apos;t have an account?{" "}
                <Link href="/signup" className="font-medium text-fuchsia-300 hover:underline">
                  Sign up
                </Link>
              </p>
            </>
          )}

          {/* OTP LOGIN - EMAIL */}
          {mode === "otp-email" && (
            <form onSubmit={handleSendOtp} className="mt-7 flex flex-col gap-4">
              <PillField icon={<MailIcon />} label="Email">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  style={{ fontSize: 16 }}
                  className={`${inputBase} pl-11 pr-4`}
                />
              </PillField>

              {error && (
                <p className="rounded-xl bg-red-500/10 px-3.5 py-2.5 text-xs text-red-400">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="mt-2 flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-fuchsia-500 via-violet-500 to-blue-500 py-3.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/30 transition-all hover:shadow-violet-500/50 active:scale-[0.98] disabled:opacity-60"
              >
                {loading && <Spinner />}
                {loading ? "Sending…" : "Send OTP"}
              </button>
            </form>
          )}

          {/* OTP LOGIN - VERIFY */}
          {mode === "otp-verify" && (
            <form onSubmit={handleVerifyOtp} className="mt-7 flex flex-col gap-4">
              <OtpBoxes value={otp} onChange={setOtp} autoFocus />

              {error && (
                <p className="rounded-xl bg-red-500/10 px-3.5 py-2.5 text-xs text-red-400">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading || otp.length !== 6}
                className="mt-2 flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-fuchsia-500 via-violet-500 to-blue-500 py-3.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/30 transition-all hover:shadow-violet-500/50 active:scale-[0.98] disabled:opacity-60"
              >
                {loading && <Spinner />}
                {loading ? "Verifying…" : "Log in"}
              </button>
            </form>
          )}

          {/* FORGOT PASSWORD - EMAIL */}
          {mode === "forgot-email" && (
            <form onSubmit={handleForgotSendOtp} className="mt-7 flex flex-col gap-4">
              <PillField icon={<MailIcon />} label="Email">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  style={{ fontSize: 16 }}
                  className={`${inputBase} pl-11 pr-4`}
                />
              </PillField>

              {error && (
                <p className="rounded-xl bg-red-500/10 px-3.5 py-2.5 text-xs text-red-400">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="mt-2 flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-fuchsia-500 via-violet-500 to-blue-500 py-3.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/30 transition-all hover:shadow-violet-500/50 active:scale-[0.98] disabled:opacity-60"
              >
                {loading && <Spinner />}
                {loading ? "Sending…" : "Send Code"}
              </button>
            </form>
          )}

          {/* FORGOT PASSWORD - OTP VERIFY */}
          {mode === "forgot-otp" && (
            <form onSubmit={handleForgotVerifyOtp} className="mt-7 flex flex-col gap-4">
              <OtpBoxes value={otp} onChange={setOtp} autoFocus />

              {error && (
                <p className="rounded-xl bg-red-500/10 px-3.5 py-2.5 text-xs text-red-400">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading || otp.length !== 6}
                className="mt-2 flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-fuchsia-500 via-violet-500 to-blue-500 py-3.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/30 transition-all hover:shadow-violet-500/50 active:scale-[0.98] disabled:opacity-60"
              >
                {loading && <Spinner />}
                {loading ? "Verifying…" : "Verify Code"}
              </button>
            </form>
          )}

          {/* FORGOT PASSWORD - SET NEW PASSWORD */}
          {mode === "forgot-newpass" && (
            <form onSubmit={handleSetNewPassword} className="mt-7 flex flex-col gap-4">
              <PillField icon={<LockIcon />} label="New password">
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
              </PillField>

              <PillField icon={<LockIcon />} label="Confirm password">
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
              </PillField>

              {error && (
                <p className="rounded-xl bg-red-500/10 px-3.5 py-2.5 text-xs text-red-400">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="mt-2 flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-fuchsia-500 via-violet-500 to-blue-500 py-3.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/30 transition-all hover:shadow-violet-500/50 active:scale-[0.98] disabled:opacity-60"
              >
                {loading && <Spinner />}
                {loading ? "Saving…" : "Save New Password"}
              </button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
