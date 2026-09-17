import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const FEATURES = [
  {
    title: "Private by design",
    desc: "End-to-end encrypted messages. Your data, your database, your rules — nothing leaves your control.",
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
    desc: "Sub-second delivery powered by live channels. Messages land instantly — no refresh, no delay.",
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
    desc: "A quiet, distraction-free space. No feeds, no noise — just clean, focused conversations.",
    icon: (
      <path
        d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5c-1.35 0-2.62-.32-3.75-.9L3 21l1.9-5.75A8.47 8.47 0 0 1 3.5 11.5 8.5 8.5 0 0 1 12 3a8.5 8.5 0 0 1 9 8.5Z"
        stroke="url(#g1)"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    ),
  },
  {
    title: "Zero clutter UI",
    desc: "Thoughtfully minimal interface that gets out of your way and keeps the conversation front and center.",
    icon: (
      <path
        d="M4 6h16M4 12h10M4 18h7"
        stroke="url(#g1)"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    ),
  },
  {
    title: "Works everywhere",
    desc: "Fully responsive across mobile, tablet and desktop. One account, every device, always in sync.",
    icon: (
      <path
        d="M12 18h.01M8 21h8a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2Z"
        stroke="url(#g1)"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
  {
    title: "Open & auditable",
    desc: "Transparent architecture you can inspect. No hidden trackers, no third-party analytics.",
    icon: (
      <path
        d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"
        stroke="url(#g1)"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    ),
  },
];

const STATS = [
  { value: "99.9%", label: "Uptime" },
  { value: "<100ms", label: "Delivery time" },
  { value: "E2E", label: "Encrypted by default" },
  { value: "0", label: "Ads · Trackers" },
];

const MESSAGES = [
  { from: "them", text: "Hey! Did you check the new build?", time: "09:41" },
  { from: "me", text: "Yes — the glass UI looks incredible ✨", time: "09:42" },
  { from: "them", text: "Right? And messages are instant now.", time: "09:42" },
  { from: "me", text: "Deploying to production tonight 🚀", time: "09:43" },
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
    <main className="relative min-h-screen overflow-hidden bg-ink-900">
      {/* Background layers */}
      <div className="pointer-events-none absolute inset-0 bg-aurora" />
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-violet/20 blur-[120px]" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-[420px] w-[420px] translate-x-1/3 translate-y-1/3 rounded-full bg-teal/10 blur-[130px]" />
      <div className="pointer-events-none absolute left-0 top-1/2 h-[300px] w-[300px] -translate-x-1/3 -translate-y-1/2 rounded-full bg-violet/10 blur-[100px]" />

      {/* Nav — glass bar */}
      <nav className="sticky top-0 z-50">
        <div className="glass mx-4 mt-4 flex items-center justify-between rounded-2xl border border-white/10 px-5 py-3 md:mx-8">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-violet to-teal">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path
                  d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5c-1.35 0-2.62-.32-3.75-.9L3 21l1.9-5.75A8.47 8.47 0 0 1 3.5 11.5 8.5 8.5 0 0 1 12 3a8.5 8.5 0 0 1 9 8.5Z"
                  stroke="white"
                  strokeWidth="1.8"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <span className="font-display text-xl font-bold tracking-tight text-white">
              Airalance
            </span>
          </div>
          <div className="hidden items-center gap-8 text-sm text-mist-light md:flex">
            <a href="#features" className="transition hover:text-white">Features</a>
            <a href="#preview" className="transition hover:text-white">Preview</a>
            <a href="#stats" className="transition hover:text-white">Why us</a>
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
              className="rounded-full bg-white px-5 py-2 text-sm font-semibold text-ink-900 shadow-lg shadow-white/10 transition hover:bg-mist-light"
            >
              Get started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative z-10 mx-auto flex max-w-5xl flex-col items-center px-6 pt-20 text-center md:pt-28">
        <div className="mb-8 flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-medium text-mist-light backdrop-blur-sm">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-teal" />
          </span>
          End-to-end encrypted · Real-time
        </div>

        <h1 className="font-display text-5xl font-extrabold leading-[1.05] tracking-tight text-white md:text-7xl">
          Where Privacy
          <br />
          <span className="text-gradient">Meets Elegance</span>
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
            className="glass rounded-full border border-white/10 px-8 py-3.5 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            I already have one
          </Link>
        </div>

        <p className="mt-5 text-xs text-mist/60">
          Free forever · No credit card required · Set up in 30 seconds
        </p>
      </section>

      {/* Product preview artifact — glass chat mockup */}
      <section id="preview" className="relative z-10 mx-auto mt-20 max-w-3xl px-6">
        <div className="relative">
          <div className="pointer-events-none absolute -inset-8 rounded-[2.5rem] bg-gradient-to-r from-violet/20 to-teal/20 blur-2xl" />
          <div className="glass relative rounded-3xl border border-white/10 p-2 shadow-2xl shadow-black/40">
            {/* Window chrome */}
            <div className="flex items-center gap-2 border-b border-white/5 px-4 py-3">
              <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
              <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
              <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
              <span className="ml-3 text-xs font-medium text-mist/60">airalance.app/chat</span>
              <span className="ml-auto flex items-center gap-1.5 rounded-full bg-teal/10 px-2.5 py-1 text-[10px] font-semibold text-teal">
                <span className="h-1.5 w-1.5 rounded-full bg-teal" />
                Live
              </span>
            </div>
            {/* Chat body */}
            <div className="flex flex-col gap-3 px-4 py-6 md:px-8">
              {MESSAGES.map((m, i) => (
                <div
                  key={i}
                  className={
                    m.from === "me"
                      ? "flex justify-end"
                      : "flex justify-start"
                  }
                >
                  <div
                    className={
                      m.from === "me"
                        ? "max-w-[75%] rounded-2xl rounded-br-sm bg-gradient-to-r from-violet to-violet-light px-4 py-2.5 text-left text-sm text-white shadow-md shadow-violet/20"
                        : "glass max-w-[75%] rounded-2xl rounded-bl-sm border border-white/10 px-4 py-2.5 text-left text-sm text-white/90"
                    }
                  >
                    <p>{m.text}</p>
                    <p className={
                      m.from === "me"
                        ? "mt-1 text-right text-[10px] text-white/60"
                        : "mt-1 text-right text-[10px] text-mist/50"
                    }>
                      {m.time}
                    </p>
                  </div>
                </div>
              ))}
              {/* Typing indicator */}
              <div className="flex justify-start">
                <div className="glass flex items-center gap-1.5 rounded-2xl rounded-bl-sm border border-white/10 px-4 py-3">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-mist" style={{ animationDelay: "0s" }} />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-mist" style={{ animationDelay: "0.15s" }} />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-mist" style={{ animationDelay: "0.3s" }} />
                </div>
              </div>
              {/* Input */}
              <div className="glass mt-2 flex items-center gap-3 rounded-full border border-white/10 px-5 py-3">
                <span className="flex-1 text-sm text-mist/50">Type a message…</span>
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-r from-violet to-violet-light">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7Z" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section id="stats" className="relative z-10 mx-auto mt-24 max-w-4xl px-6">
        <div className="glass grid grid-cols-2 gap-px overflow-hidden rounded-3xl border border-white/10 md:grid-cols-4">
          {STATS.map((s) => (
            <div key={s.label} className="bg-white/[0.02] px-6 py-8 text-center transition hover:bg-white/[0.05]">
              <p className="font-display text-3xl font-extrabold text-gradient">{s.value}</p>
              <p className="mt-2 text-xs font-medium uppercase tracking-widest text-mist/60">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="relative z-10 mx-auto mt-24 max-w-5xl px-6">
        <div className="mb-12 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal">Why Airalance</p>
          <h2 className="mt-3 font-display text-3xl font-extrabold tracking-tight text-white md:text-4xl">
            Everything you need. Nothing you don't.
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="glass group rounded-2xl border border-white/5 px-6 py-7 transition hover:-translate-y-1 hover:border-violet/30 hover:shadow-xl hover:shadow-violet/10"
            >
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 transition group-hover:border-violet/30">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  {feature.icon}
                  <defs>
                    <linearGradient id="g1" x1="3" y1="3" x2="21" y2="21">
                      <stop stopColor="#9C82FF" />
                      <stop offset="1" stopColor="#22D3B8" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>
              <h3 className="font-display text-sm font-bold text-white">{feature.title}</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-mist">{feature.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative z-10 mx-auto mt-28 max-w-3xl px-6 text-center">
        <div className="glass rounded-3xl border border-white/10 px-8 py-14">
          <div className="relative mx-auto mb-8 flex h-56 w-56 items-center justify-center">
            <span className="absolute h-full w-full animate-pulseRing rounded-full border border-violet/40" />
            <span className="absolute h-full w-full animate-pulseRing rounded-full border border-teal/30" style={{ animationDelay: "0.7s" }} />
            <span className="absolute h-full w-full animate-pulseRing rounded-full border border-violet/30" style={{ animationDelay: "1.4s" }} />
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
          <h2 className="font-display text-3xl font-extrabold tracking-tight text-white md:text-4xl">
            Start talking, <span className="text-gradient">privately.</span>
          </h2>
          <p className="mx-auto mt-4 max-w-md text-mist">
            Join Airalance today and experience messaging the way it should feel — calm, fast, and yours.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/signup"
              className="rounded-full bg-gradient-to-r from-violet to-violet-light px-8 py-3.5 text-sm font-semibold text-white shadow-lg shadow-violet/30 transition hover:shadow-violet/50"
            >
              Create your account
            </Link>
            <Link
              href="/login"
              className="glass rounded-full border border-white/10 px-8 py-3.5 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              Log in
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 mt-24 border-t border-white/5 px-6 py-10">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 text-xs text-mist/60 md:flex-row">
          <span>Copyright © 2026 by AiraThink · All rights reserved.</span>
          <div className="flex items-center gap-6">
            <a href="#features" className="transition hover:text-white">Features</a>
            <a href="#preview" className="transition hover:text-white">Preview</a>
            <a href="/login" className="transition hover:text-white">Log in</a>
          </div>
        </div>
      </footer>
    </main>
  );
}
