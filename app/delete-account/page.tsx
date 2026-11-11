"use client";

import { useState } from "react";
import Link from "next/link";

export default function DeleteAccountPage() {
  const [email, setEmail] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email.trim() || !email.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }
    if (!confirmed) {
      setError("You must confirm that you understand this action is permanent.");
      return;
    }

    setLoading(true);

    // Option 1: Open email client with pre-filled request (Works without backend)
    const subject = encodeURIComponent("Account Deletion Request — Airalance");
    const body = encodeURIComponent(
      `Hello Airalance Support,\n\nI want to permanently delete my Airalance account and all associated data.\n\nAccount Email: ${email}\n\nPlease confirm once the deletion is complete.\n\nThank you.`
    );
    window.location.href = `mailto:help@airalance.com?subject=${subject}&body=${body}`;

    // Option 2: If you have an API route (e.g., /api/delete-account), uncomment below:
    /*
    try {
      const res = await fetch("/api/delete-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) throw new Error("Failed to submit request.");
      setSubmitted(true);
    } catch (err) {
      setError("Something went wrong. Please email us directly at help@airalance.com");
    } finally {
      setLoading(false);
    }
    */

    // Simulate success after mailto (since mailto doesn't give feedback)
    setTimeout(() => {
      setLoading(false);
      setSubmitted(true);
    }, 1000);
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-ink-900 px-6 py-14">
      <div className="pointer-events-none absolute inset-0 bg-aurora" />

      <div className="glass animate-fadeUp relative z-10 mx-auto w-full max-w-2xl rounded-3xl p-8 shadow-2xl sm:p-10">
        <Link href="/" className="font-display text-lg font-bold text-white">
          Aira<span className="text-gradient">Think!</span>
        </Link>

        <h1 className="mt-6 font-display text-3xl font-bold text-white">Delete Your Account</h1>
        <p className="mt-2 text-sm text-mist">
          We're sorry to see you go. This page allows you to request the permanent deletion of your Airalance account and all associated data.
        </p>

        <div className="mt-6 rounded-2xl border border-red-500/20 bg-red-500/5 p-4">
          <p className="text-xs font-semibold text-red-400 uppercase tracking-wide">Important</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-mist-light">
            <li>This action is <strong>permanent</strong> and cannot be undone.</li>
            <li>Your profile, messages, status updates, and connections will be deleted.</li>
            <li>Data will be permanently removed from our servers within <strong>30 days</strong>.</li>
            <li>You can also delete your account directly inside the App via <strong>Settings → Delete Account</strong>.</li>
          </ul>
        </div>

        {submitted ? (
          <div className="mt-8 rounded-2xl border border-teal-500/20 bg-teal-500/10 p-6 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-teal-500/20">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M20 6L9 17L4 12" stroke="#2DD4BF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h3 className="mt-4 font-display text-lg font-bold text-white">Request Received</h3>
            <p className="mt-2 text-sm text-mist">
              Your email app should have opened. Please send the pre-filled email to complete your deletion request. If it didn't open, email us directly at{" "}
              <a href="mailto:help@airalance.com" className="font-semibold text-violet-light hover:underline">
                help@airalance.com
              </a>.
            </p>
            <Link href="/" className="mt-6 inline-block rounded-xl bg-white/10 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-white/20">
              Back to Home
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div>
              <label htmlFor="email" className="block text-xs font-semibold text-mist mb-1.5">
                Email Address Associated with Your Account
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition focus:border-violet focus:ring-2 focus:ring-violet/20 placeholder:text-mist/50"
              />
            </div>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-white/20 bg-white/5 accent-violet"
                required
              />
              <span className="text-sm text-mist-light leading-relaxed">
                I understand that deleting my account is permanent and all my data (messages, media, profile) will be permanently removed.
              </span>
            </label>

            {error && <p className="text-sm font-medium text-red-400">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-gradient-to-r from-red-500 to-red-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-red-500/30 transition hover:shadow-red-500/50 disabled:opacity-50"
            >
              {loading ? "Submitting Request…" : "Request Account Deletion"}
            </button>

            <p className="text-center text-xs text-mist">
              Changed your mind?{" "}
              <Link href="/" className="font-semibold text-violet-light hover:underline">
                Go back to Airalance
              </Link>
            </p>
          </form>
        )}

        <p className="mt-8 border-t border-white/10 pt-6 text-xs text-mist">
          For any questions, contact us at{" "}
          <a href="mailto:help@airalance.com" className="font-semibold text-violet-light hover:underline">
            help@airalance.com
          </a>
          . We aim to respond within 30 days.
        </p>
      </div>
    </main>
  );
}
