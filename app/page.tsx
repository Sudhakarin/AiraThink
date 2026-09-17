import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const features = [
  {
    title: "Private by design",
    desc: "Your messages, your database, your rules.",
    gradId: "grad-shield",
    icon: (
      <path
        d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5l-8-3Z"
        stroke="url(#grad-shield)"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    ),
  },
  {
    title: "Real-time, always",
    desc: "Messages land instantly, no delays.",
    gradId: "grad-bolt",
    icon: (
      <path
        d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z"
        stroke="url(#grad-bolt)"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    ),
  },
  {
    title: "Made to feel calm",
    desc: "A quiet, distraction-free space to talk.",
    gradId: "grad-chat",
    icon: (
      <path
        d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5c-1.35 0-2.62-.32-3.75-.9L3 21l1.9-5.75A8.47 8.47 0 0 1 3.5 11.5 8.5 8.5 0 0 1 12 3a8.5 8.5 0 0 1 9 8.5Z"
        stroke="url(#grad-chat)"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    ),
  },
];

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/chat");
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#F8F9FE] text-slate-900">
      {/* Background layers */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(15,23,42,0.045)_1px,transparent_0)] bg-[size:28px_28px]" />
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[560px] w-[560px] -translate-x-1/2 rounded-full bg-[#7C5CFF]/15 blur-[120px]" />
      <div className="pointer-events-none absolute -left-24 top-1/3 h-[380px] w-[380px] rounded-full bg-[#0FB5A3]/10 blur-[110px]" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-[420px] w-[420px] translate-x-1/4 translate-y-1/4 rounded-full bg-[#F59E0B]/10 blur-[130px]" />

      {/* Nav */}
      <nav className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Link href="/" className="group flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#7C5CFF] to-[#0FB5A3] shadow-lg shadow-[#7C5CFF]/25 transition-transform duration-300 group-hover:scale-105 group-hover:rotate-3">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path
                d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5c-1.35 0-2.62-.32-3.75-.9L3 21l1.9-5.75A8.47 8.47 0 0 1 3.5 11.5 8.5 8.5 0 0 1 12 3a8.5 8.5 0 0 1 9 8.5Z"
                stroke="white"
                strokeWidth="1.8"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <span className="font-display text-2xl font-bold tracking-tight text-slate-900">
            Airalance!
          </span>
        </Link>
        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/login"
            className="rounded-full px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-900/5 hover:text-slate-900"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-slate-900/15 transition hover:bg-slate-800 hover:shadow-slate-900/25"
          >
            Get started
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative z-10 mx-auto flex max-w-5xl flex-col items-center px-6 pt-14 text-center md:pt-20">
        <div className="mb-8 flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/80 px-4 py-1.5 text-xs font-medium text-slate-600 shadow-sm backdrop-blur-sm">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#0FB5A3] opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-[#0FB5A3]" />
          </span>
          End-to-end encrypted · Real-time
        </div>

        <h1 className="font-display text-5xl font-extrabold leading-[1.05] tracking-tight text-slate-900 md:text-7xl">
          Where Privacy
          <br />
          <span className="bg-gradient-to-r from-[#7C5CFF] via-[#8F7BFF] to-[#0FB5A3] bg-clip-text text-transparent">
            Matters!
          </span>
        </h1>

        <p className="mt-6 max-w-xl text-balance text-lg text-slate-500">
          Airalance is a calm, quietly premium space to talk. No clutter, no
          noise — just fast, real-time messages wrapped in a design that gets
          out of your way.
        </p>

        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/signup"
            className="rounded-full bg-gradient-to-r from-[#7C5CFF] to-[#0FB5A3] px-8 py-3.5 text-sm font-semibold text-white shadow-xl shadow-[#7C5CFF]/25 transition duration-300 hover:scale-[1.03] hover:shadow-2xl hover:shadow-[#7C5CFF]/35"
          >
            Create your account
          </Link>
          <Link
            href="/login"
            className="rounded-full border border-slate-200 bg-white px-8 py-3.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
          >
            I already have one
          </Link>
        </div>

        {/* Floating chat bubbles (decorative) */}
        <div className="pointer-events-none absolute left-[6%] top-40 hidden animate-floatSlow lg:block">
          <div className="rounded-2xl rounded-bl-sm border border-slate-200/70 bg-white/90 px-4 py-2.5 text-sm font-medium text-slate-700 shadow-lg shadow-slate-900/5 backdrop-blur-sm">
            See you at 6? ☕
          </div>
        </div>
        <div className="pointer-events-none absolute right-[6%] top-64 hidden animate-floatSlow lg:block" style={{ animationDelay: "1.2s" }}>
          <div className="rounded-2xl rounded-br-sm border border-slate-200/70 bg-white/90 px-4 py-2.5 text-sm font-medium text-slate-700 shadow-lg shadow-slate-900/5 backdrop-blur-sm">
            On my way ✈️
          </div>
        </div>

        {/* Feature strip */}
        <div className="mt-16 grid w-full max-w-3xl grid-cols-1 gap-4 sm:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="group rounded-2xl border border-slate-200/70 bg-white/80 px-5 py-6 text-left shadow-[0_8px_30px_rgba(15,23,42,0.05)] backdrop-blur-sm transition duration-300 hover:-translate-y-1 hover:border-[#7C5CFF]/30 hover:shadow-[0_20px_40px_rgba(124,92,255,0.12)]"
            >
              <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-[#7C5CFF]/10 to-[#0FB5A3]/10 ring-1 ring-slate-900/5 transition duration-300 group-hover:from-[#7C5CFF]/20 group-hover:to-[#0FB5A3]/20">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                  {feature.icon}
                  <defs>
                    <linearGradient id={feature.gradId} x1="3" y1="3" x2="21" y2="21">
                      <stop stopColor="#7C5CFF" />
                      <stop offset="1" stopColor="#0FB5A3" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>
              <h3 className="font-display text-sm font-bold text-slate-900">{feature.title}</h3>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">{feature.desc}</p>
            </div>
          ))}
        </div>

        {/* Animated badge */}
        <div className="relative mt-20 flex h-56 w-56 items-center justify-center">
          <span className="absolute h-full w-full animate-pulseRing rounded-full border border-[#7C5CFF]/30" />
          <span
            className="absolute h-full w-full animate-pulseRing rounded-full border border-[#0FB5A3]/25"
            style={{ animationDelay: "0.7s" }}
          />
          <span
            className="absolute h-full w-full animate-pulseRing rounded-full border border-[#7C5CFF]/20"
            style={{ animationDelay: "1.4s" }}
          />
          <div className="animate-floatSlow flex h-24 w-24 items-center justify-center rounded-3xl border border-slate-200/60 bg-white shadow-xl shadow-[#7C5CFF]/10">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
              <path
                d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5c-1.35 0-2.62-.32-3.75-.9L3 21l1.9-5.75A8.47 8.47 0 0 1 3.5 11.5 8.5 8.5 0 0 1 12 3a8.5 8.5 0 0 1 9 8.5Z"
                stroke="url(#hero-grad)"
                strokeWidth="1.6"
                strokeLinejoin="round"
              />
              <defs>
                <linearGradient id="hero-grad" x1="3" y1="3" x2="21" y2="21">
                  <stop stopColor="#7C5CFF" />
                  <stop offset="1" stopColor="#0FB5A3" />
                </linearGradient>
              </defs>
            </svg>
          </div>
        </div>
      </section>

      <footer className="relative z-10 mt-20 border-t border-slate-200/60 px-6 py-8 text-center text-xs text-slate-400">
        Copyright © 2026 by AiraThink! · All rights reserved.
      </footer>
    </main>
  );
}
