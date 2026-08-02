import Link from "next/link";

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-ink-900">
      <div className="pointer-events-none absolute inset-0 bg-aurora" />
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-violet/20 blur-[120px]" />

      <nav className="relative z-10 flex items-center justify-between px-6 py-6 md:px-12">
        <div className="flex items-center gap-2">
          <span className="font-display text-xl font-bold tracking-tight text-white">
                        Aira<span className="text-gradient">Think!</span>
          </span>
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

      <section className="relative z-10 mx-auto flex max-w-5xl flex-col items-center px-6 pt-20 text-center md:pt-28">
        <div className="mb-8 flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-medium text-mist-light">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-teal" />
          </span>
          Real-time, end-to-end fast
        </div>

        <h1 className="font-display text-5xl font-extrabold leading-[1.05] tracking-tight text-white md:text-7xl">
          Conversations that
          <br />
          <span className="text-gradient">think ahead.</span>
        </h1>

        <p className="mt-6 max-w-xl text-balance text-lg text-mist">
                    AiraThink! is a calm, quietly premium space to talk. No clutter, no
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

        <div className="relative mt-24 flex h-56 w-56 items-center justify-center">
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

      <footer className="relative z-10 mt-24 px-6 pb-10 text-center text-xs text-mist/60">
        Built with Thinkchat · Your messages, your database, your rules.
      </footer>
    </main>
  );
}
