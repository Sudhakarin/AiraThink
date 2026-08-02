"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const router = useRouter();
  const supabase = createClient();

  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username: username.trim().toLowerCase(),
          display_name: displayName.trim() || username.trim(),
        },
      },
    });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    if (data.session) {
      router.push("/chat");
      router.refresh();
    } else {
      setDone(true);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-ink-900 px-6">
      <div className="pointer-events-none absolute inset-0 bg-aurora" />

      <div className="glass animate-fadeUp relative z-10 w-full max-w-md rounded-3xl p-8 shadow-2xl">
        <Link href="/" className="font-display text-lg font-bold text-white">
          Think<span className="text-gradient">chat</span>
        </Link>

        {done ? (
          <div className="mt-6">
            <h1 className="font-display text-2xl font-bold text-white">Check your inbox</h1>
            <p className="mt-2 text-sm text-mist">
              We sent a confirmation link to <span className="text-white">{email}</span>. Confirm
              your email, then log in.
            </p>
            <Link
              href="/login"
              className="mt-6 inline-block rounded-xl bg-gradient-to-r from-violet to-violet-light px-5 py-2.5 text-sm font-semibold text-white"
            >
              Go to login
            </Link>
          </div>
        ) : (
          <>
            <h1 className="mt-6 font-display text-2xl font-bold text-white">Create your account</h1>
            <p className="mt-1 text-sm text-mist">Takes less than a minute.</p>

            <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-mist-light">Username</label>
                <input
                  type="text"
                  required
                  minLength={3}
                  pattern="[a-zA-Z0-9_]+"
                  title="Letters, numbers and underscores only"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="janedoe"
                  className="w-full rounded-xl border border-white/10 bg-ink-800 px-4 py-3 text-sm text-white placeholder:text-mist/50 focus:border-violet focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-mist-light">Display name</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Jane Doe"
                  className="w-full rounded-xl border border-white/10 bg-ink-800 px-4 py-3 text-sm text-white placeholder:text-mist/50 focus:border-violet focus:outline-none"
                />
              </div>

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
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
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
                {loading ? "Creating…" : "Create account"}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-mist">
              Already have an account?{" "}
              <Link href="/login" className="font-medium text-violet-light hover:underline">
                Log in
              </Link>
            </p>
          </>
        )}
      </div>
    </main>
  );
}
