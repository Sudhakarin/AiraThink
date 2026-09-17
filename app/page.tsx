import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const features = [
  {
    title: "Private by design",
    desc: "Your messages, your database, your rules. No trackers, no ad profiles.",
    icon: (
      <path
        d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5l-8-3Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    ),
  },
  {
    title: "Real-time, always",
    desc: "Messages land instantly. Presence, typing indicators — all live.",
    icon: (
      <path
        d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    ),
  },
  {
    title: "Made to feel calm",
    desc: "A quiet, distraction-free space. No clutter, no noise, just talk.",
    icon: (
      <path
        d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5c-1.35 0-2.62-.32-3.75-.9L3 21l1.9-5.75A8.47 8.47 0 0 1 3.5 11.5 8.5 8.5 0 0 1 12 3a8.5 8.5 0 0 1 9 8.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    ),
  },
];

const steps = [
  { n: "01", title: "Create your account", desc: "One email, one password. No phone number, no fuss." },
  { n: "02", title: "Find your people", desc: "Invite friends with a single link and you're connected." },
  { n: "03", title: "Start talking", desc: "Real-time chats that just work — on any device." },
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
    <main className="relative min-h-screen overflow-hidden bg-white text-slate-900">
      {/* Background */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-sky-100/70 via-white to-white" />
      <div className="pointer-events-none absolute -top-32 right-[-10%] h-[480px] w-[480px] rounded-full bg-sky-200/50 blur-[110px]" />
      <div className="pointer-events-none absolute left-[-12%] top-1/3 h-[420px] w-[420px] rounded-full bg-blue-200/40 blur-[120px]" />
      <div className="pointer-events-none absolute bottom-[-10%] right-1/4 h-[380px] w-[380px] rounded-full bg-amber-100/60 blur-[110px]" />

      {/* Nav */}
      <nav className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 shadow-lg shadow-blue-600/25">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path
                d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5c-1.35 0-2.62-.32-3.75-.9L3 21l1.9-5.75A8.47 8.47 0 0 1 3.5 11.5 8.5 8.5 0 0 1 12 3a8.5 8.5 0 0 1 9 8.5Z"
                stroke="white"
                strokeWidth="1.8"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <span className="font-display text-2xl font-bold tracking-tight">Airalance!</span>
        </Link>
        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/login"
            className="rounded-full px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-slate-900/15 transition hover:bg-blue-600 hover:shadow-blue-600/25"
          >
            Get started
          </Link>
        </div>
      </nav>

      {/* Hero — split layout with product mockup */}
      <section className="relative z-10 mx-auto grid max-w-6xl items-center gap-14 px-6 pb-20 pt-10 lg:grid-cols-2 lg:pt-16">
        {/* Left: copy */}
        <div className="text-center lg:text-left">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-200/70 bg-blue-50/80 px-4 py-1.5 text-xs font-semibold text-blue-700">
            <span className="flex h-1.5 w-1.5 rounded-full bg-blue-600" />
            Introducing Airalance — calm, private messaging
          </div>

          <h1 className="font-display text-5xl font-extrabold leading-[1.05] tracking-tight md:text-6xl xl:text-7xl">
            Where Privacy
            <br />
            <span className="bg-gradient-to-r from-blue-600 via-sky-500 to-cyan-500 bg-clip-text text-transparent">
              Matters!
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-md text-balance text-lg text-slate-500 lg:mx-0">
            Airalance is a calm, quietly premium space to talk. No clutter, no
            noise — just fast, real-time messages wrapped in a design that gets
            out of your way.
          </p>

          <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row lg:justify-start">
            <Link
              href="/signup"
              className="rounded-full bg-blue-600 px-8 py-3.5 text-sm font-semibold text-white shadow-xl shadow-blue-600/25 transition hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-2xl hover:shadow-blue-600/30"
            >
              Create your account
            </Link>
            <Link
              href="/login"
              className="rounded-full border border-slate-200 bg-white px-8 py-3.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-blue-300 hover:text-blue-700"
            >
              I already have one
            </Link>
          </div>

          <div className="mt-9 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs font-medium text-slate-400 lg:justify-start">
            <span className="flex items-center gap-1.5">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-blue-600"><path d="m5 13 4 4L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              Free to start
            </span>
            <span className="flex items-center gap-1.5">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-blue-600"><path d="m5 13 4 4L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              No phone number needed
            </span>
            <span className="flex items-center gap-1.5">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-blue-600"><path d="m5 13 4 4L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              Works on any device
            </span>
          </div>
        </div>

        {/* Right: chat mockup */}
        <div className="relative mx-auto w-full max-w-md">
          {/* glow behind */}
          <div className="pointer-events-none absolute inset-0 -z-10 scale-90 rounded-[2.5rem] bg-gradient-to-br from-blue-500/15 to-cyan-400/15 blur-2xl" />

          {/* floating chip: encrypted */}
          <div className="absolute -right-3 -top-6 z-20 hidden animate-floatSlow items-center gap-2 rounded-2xl border border-slate-100 bg-white px-3.5 py-2.5 shadow-xl shadow-slate-900/10 sm:flex">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><rect x="5" y="11" width="14" height="9" rx="2" stroke="currentColor" strokeWidth="1.8"/><path d="M8 11V8a4 4 0 1 1 8 0v3" stroke="currentColor" strokeWidth="1.8"/></svg>
            </span>
            <div>
              <p className="text-xs font-bold text-slate-900">End-to-end encrypted</p>
              <p className="text-[10px] text-slate-400">Only you can read this</p>
            </div>
          </div>

          {/* floating chip: delivered */}
          <div className="absolute -bottom-5 -left-3 z-20 hidden animate-floatSlow items-center gap-2 rounded-2xl border border-slate-100 bg-white px-3.5 py-2.5 shadow-xl shadow-slate-900/10 sm:flex" style={{ animationDelay: "1.4s" }}>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="m5 13 4 4L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </span>
            <div>
              <p className="text-xs font-bold text-slate-900">Delivered instantly</p>
              <p className="text-[10px] text-slate-400">Real-time, always in sync</p>
            </div>
          </div>

          {/* chat window */}
          <div className="overflow-hidden rounded-[1.75rem] border border-slate-200/80 bg-white shadow-2xl shadow-blue-900/10">
            {/* header */}
            <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50/60 px-5 py-4">
              <div className="relative">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-cyan-400 font-display text-sm font-bold text-white">
                  A
                </span>
                <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-emerald-500" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-slate-900">Aira</p>
                <p className="text-[11px] font-medium text-emerald-600">Active now</p>
              </div>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-slate-300"><circle cx="5" cy="12" r="1.5" fill="currentColor"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/><circle cx="19" cy="12" r="1.5" fill="currentColor"/></svg>
            </div>

            {/* messages */}
            <div className="flex flex-col gap-3 px-5 py-6">
              <div className="max-w-[80%] rounded-2xl rounded-tl-sm bg-slate-100 px-4 py-2.5 text-sm text-slate-700">
                Hey! Did you try the new Airalance design? ✨
                <span className="mt-1 block text-right text-[10px] text-slate-400">10:02</span>
              </div>
              <div className="max-w-[80%] self-end rounded-2xl rounded-tr-sm bg-blue-600 px-4 py-2.5 text-sm text-white shadow-md shadow-blue-600/20">
                Just did — it feels so calm and light ☁️
                <span className="mt-1 flex items-center justify-end gap-1 text-[10px] text-blue-200">
                  10:03
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="m2 13 4 4L14 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="m9 15 2 2 8-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </span>
              </div>
              <div className="max-w-[80%] rounded-2xl rounded-tl-sm bg-slate-100 px-4 py-2.5 text-sm text-slate-700">
                Told you! Privacy <span className="font-semibold text-blue-600">and</span> beauty can coexist 😌
              </div>
              {/* typing indicator */}
              <div className="flex w-16 items-center justify-center gap-1 rounded-2xl rounded-tl-sm bg-slate-100 px-4 py-3">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: "0.15s" }} />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: "0.3s" }} />
              </div>
            </div>

            {/* input */}
            <div className="flex items-center gap-2 border-t border-slate-100 bg-slate-50/60 px-4 py-3.5">
              <div className="flex flex-1 items-center rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-400">
                Type a message…
              </div>
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-white shadow-md shadow-blue-600/30">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="m22 2-7 20-4-9-9-4 20-7Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/></svg>
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 pb-8">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="group rounded-2xl border border-slate-200/70 bg-white p-6 shadow-[0_4px_20px_rgba(15,23,42,0.04)] transition duration-300 hover:-translate-y-1 hover:border-blue-200 hover:shadow-[0_16px_40px_rgba(37,99,235,0.10)]"
            >
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600 ring-1 ring-blue-100 transition duration-300 group-hover:bg-blue-600 group-hover:text-white group-hover:ring-blue-600">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none">{feature.icon}</svg>
              </div>
              <h3 className="font-display text-base font-bold">{feature.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{feature.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 py-16">
        <div className="mb-10 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-600">How it works</p>
          <h2 className="font-display mt-3 text-3xl font-extrabold tracking-tight md:text-4xl">
            Up and running in minutes
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {steps.map((step) => (
            <div key={step.n} className="relative rounded-2xl border border-slate-200/70 bg-gradient-to-b from-slate-50/80 to-white p-6">
              <span className="font-display text-4xl font-extrabold text-blue-100">{step.n}</span>
              <h3 className="font-display mt-3 text-base font-bold">{step.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA banner */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 pb-24">
        <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-blue-700 via-blue-600 to-cyan-500 px-8 py-14 text-center shadow-2xl shadow-blue-600/25 md:py-16">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.12)_1px,transparent_0)] bg-[size:24px_24px]" />
          <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
          <div className="relative">
            <h2 className="font-display text-3xl font-extrabold tracking-tight text-white md:text-4xl">
              Ready to talk freely?
            </h2>
            <p className="mx-auto mt-3 max-w-md text-blue-100">
              Join Airalance today — your calm, private space is one click away.
            </p>
            <Link
              href="/signup"
              className="mt-8 inline-block rounded-full bg-white px-8 py-3.5 text-sm font-bold text-blue-700 shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl"
            >
              Create your account
            </Link>
          </div>
        </div>
      </section>

      <footer className="relative z-10 border-t border-slate-100 px-6 py-8 text-center text-xs text-slate-400">
        Copyright © 2026 by AiraThink! · All rights reserved.
      </footer>
    </main>
  );
}
