import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/chat");
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-ink-900">
      {/* Background layers */}
      <div className="pointer-events-none absolute inset-0 bg-aurora" />
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-violet/20 blur-[120px]" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-[420px] w-[420px] translate-x-1/3 translate-y-1/3 rounded-full bg-teal/10 blur-[130px]" />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
          backgroundSize: "56px 56px",
        }}
      />

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-6 md:px-12">
        <div className="flex items-center gap-2">
          <span className="font-display text-2xl font-bold text-white">Airalance!</span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="rounded-full px-4 py-2 text-sm font-medium text-mist-light transition hover:text-white"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-ink-900 transition hover:bg-mist-light"
          >
            Get started
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative z-10 mx-auto flex max-w-5xl flex-col items-center px-6 pt-16 text-center md:pt-24">
        <div className="mb-8 flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-medium text-mist-light backdrop-blur-sm">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" className="text-teal">
            <path
              d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5l-8-3Z"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
            <path d="m9 12 2 2 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          End-to-end encrypted · Real-time
        </div>

        <h1 className="font-display text-5xl font-extrabold leading-[1.05] tracking-tight text-white md:text-7xl">
          Where Privacy
          <br />
          <span className="text-gradient">Matters!</span>
        </h1>

        <p className="mt-6 max-w-xl text-balance text-lg text-mist">
          Airalance is a calm, quietly premium space to talk. No clutter, no
          noise — just fast, real-time messages wrapped in a design that gets
          out of your way.
        </p>

        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/signup"
            className="rounded-full bg-gradient-to-r from-violet to-violet-light px-8 py-3.5 text-sm font-semibold text-white shadow-lg shadow-violet/30 transition hover:shadow-violet/50"
          >
            Create your account
          </Link>
          <Link
            href="/login"
            className="rounded-full border border-white/10 bg-white/5 px-8 py-3.5 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            I already have one
          </Link>
        </div>

        {/* Feature strip */}
        <div className="mt-16 grid w-full max-w-3xl grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            {
              title: "Private by design",
              desc: "Your messages, your database, your rules.",
              icon: (
                <path
                  d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5l-8-3Z"
                  stroke="url(#g1)"
                  strokeWidth="1.6"
                  strokeLinejoin="round"
                />
              ),
            },
            {
              title: "Real-time, always",
              desc: "Messages land instantly, no delays.",
              icon: (
                <path
                  d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z"
                  stroke="url(#g1)"
                  strokeWidth="1.6"
                  strokeLinejoin="round"
                />
              ),
            },
            {
              title: "Made to feel calm",
              desc: "A quiet, distraction-free space to talk.",
              icon: (
                <path
                  d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5c-1.35 0-2.62-.32-3.75-.9L3 21l1.9-5.75A8.47 8.47 0 0 1 3.5 11.5 8.5 8.5 0 0 1 12 3a8.5 8.5 0 0 1 9 8.5Z"
                  stroke="url(#g1)"
                  strokeWidth="1.6"
                  strokeLinejoin="round"
                />
              ),
            },
          ].map((feature) => (
            <div
              key={feature.title}
              className="glass rounded-2xl border border-white/5 px-5 py-6 text-left transition hover:border-white/10"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className="mb-3">
                {feature.icon}
                <defs>
                  <linearGradient id="g1" x1="3" y1="3" x2="21" y2="21">
                    <stop stopColor="#9C82FF" />
                    <stop offset="1" stopColor="#22D3B8" />
                  </linearGradient>
                </defs>
              </svg>
              <h3 className="font-display text-sm font-bold text-white">{feature.title}</h3>
              <p className="mt-1 text-xs leading-relaxed text-mist">{feature.desc}</p>
            </div>
          ))}
        </div>

        {/* Animated badge */}
        <div className="relative mt-20 flex h-56 w-56 items-center justify-center">
          <span className="absolute h-full w-full animate-pulseRing rounded-full border border-violet/40" />
          <span
            className="absolute h-full w-full animate-pulseRing rounded-full border border-teal/30"
            style={{ animationDelay: "0.7s" }}
          />
          <span
            className="absolute h-full w-full animate-pulseRing rounded-full border border-violet/30"
            style={{ animationDelay: "1.4s" }}
          />
          <div className="glass animate-floatSlow flex h-24 w-24 items-center justify-center rounded-3xl shadow-2xl">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
              <path
                d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5c-1.35 0-2.62-.32-3.75-.9L3 21l1.9-5.75A8.47 8.47 0 0 1 3.5 11.5 8.5 8.5 0 0 1 12 3a8.5 8.5 0 0 1 9 8.5Z"
                stroke="url(#g)"
                strokeWidth="1.6"
                strokeLinejoin="round"
              />
              <defs>
                <linearGradient id="g" x1="3" y1="3" x2="21" y2="21">
                  <stop stopColor="#9C82FF" />
                  <stop offset="1" stopColor="#22D3B8" />
                </linearGradient>
              </defs>
            </svg>
          </div>
        </div>
      </section>

      <footer className="relative z-10 mt-20 border-t border-white/5 px-6 py-8 text-center text-xs text-mist/60">
        Copyright © 2026 by AiraThink! · All rights reserved.
      </footer>
    </main>
  );
}
