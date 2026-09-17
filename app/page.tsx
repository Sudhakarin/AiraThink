import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Fraunces, Inter } from "next/font/google";

const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["500", "600"],
  variable: "--font-display",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-body",
});

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/chat");
  }

  return (
    <main
      className={`${fraunces.variable} ${inter.variable} relative min-h-screen overflow-hidden bg-[#FAFAF7] font-[family-name:var(--font-body)] text-[#1B1E23]`}
    >
      <style>{`
        @keyframes seal-breathe {
          0%, 100% { transform: scale(1); opacity: 0.9; }
          50% { transform: scale(1.04); opacity: 1; }
        }
        @keyframes ring-turn {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes rise-in {
          from { opacity: 0; transform: translateY(14px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .al-seal { animation: seal-breathe 5s ease-in-out infinite; transform-origin: center; }
        .al-ring-outer { animation: ring-turn 60s linear infinite; transform-origin: center; }
        .al-ring-inner { animation: ring-turn 40s linear infinite reverse; transform-origin: center; }
        .al-rise { animation: rise-in 0.7s cubic-bezier(0.16, 1, 0.3, 1) both; }
        @media (prefers-reduced-motion: reduce) {
          .al-seal, .al-ring-outer, .al-ring-inner, .al-rise { animation: none; }
        }
      `}</style>

      {/* Background */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,#EFF5F2_0%,transparent_60%)]" />
      <div className="pointer-events-none absolute inset-0 [background-image:radial-gradient(#00000008_1px,transparent_1px)] [background-size:22px_22px]" />

      {/* Nav */}
      <nav className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-7 md:px-10">
        <div className="flex items-center gap-2.5">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="9" stroke="#1F6F63" strokeWidth="1.6" />
            <path d="M8.5 12.5 11 15l4.5-5.5" stroke="#1F6F63" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="font-[family-name:var(--font-display)] text-xl font-semibold tracking-tight text-[#1B1E23]">
            Airalance
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="rounded-full px-4 py-2 text-sm font-medium text-[#5B6169] transition hover:text-[#1B1E23]"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="rounded-full bg-[#1B1E23] px-4 py-2 text-sm font-medium text-[#FAFAF7] transition hover:bg-[#1F6F63]"
          >
            Get started
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative z-10 mx-auto grid max-w-6xl gap-16 px-6 pt-10 md:grid-cols-[1.1fr_0.9fr] md:items-center md:gap-8 md:px-10 md:pt-16">
        <div className="al-rise">
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-[#E6E3DA] bg-white/70 px-4 py-1.5 text-xs font-medium text-[#5B6169]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#1F6F63]" />
            Private, encrypted, and refreshingly quiet
          </div>

          <h1 className="font-[family-name:var(--font-display)] text-[2.75rem] font-semibold leading-[1.08] tracking-tight text-[#1B1E23] sm:text-6xl">
            Talk like no one&rsquo;s
            <br />
            listening. Because no one is.
          </h1>

          <p className="mt-6 max-w-md text-[1.05rem] leading-relaxed text-[#5B6169]">
            Airalance encrypts every message end-to-end and delivers it the
            instant you hit send — no ads, no data mining, nothing watching
            over your shoulder.
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/signup"
              className="rounded-full bg-[#1F6F63] px-7 py-3.5 text-center text-sm font-semibold text-white shadow-[0_10px_30px_-10px_rgba(31,111,99,0.55)] transition hover:bg-[#195b51]"
            >
              Create your account
            </Link>
            <Link
              href="/login"
              className="rounded-full border border-[#E6E3DA] bg-white px-7 py-3.5 text-center text-sm font-semibold text-[#1B1E23] transition hover:border-[#1B1E23]/20"
            >
              I already have one
            </Link>
          </div>
        </div>

        {/* Seal visual */}
        <div
          className="al-rise relative mx-auto flex h-72 w-72 items-center justify-center sm:h-80 sm:w-80"
          style={{ animationDelay: "0.15s" }}
        >
          <svg viewBox="0 0 200 200" className="al-ring-outer absolute inset-0 h-full w-full">
            <circle cx="100" cy="100" r="96" fill="none" stroke="#DCE7E3" strokeWidth="1" strokeDasharray="1 7" strokeLinecap="round" />
          </svg>
          <svg viewBox="0 0 200 200" className="al-ring-inner absolute inset-6 h-[calc(100%-3rem)] w-[calc(100%-3rem)]">
            <circle cx="100" cy="100" r="94" fill="none" stroke="#C9DBD5" strokeWidth="1" strokeDasharray="2 10" strokeLinecap="round" />
          </svg>
          <div className="al-seal flex h-36 w-36 items-center justify-center rounded-full bg-white shadow-[0_20px_45px_-15px_rgba(27,30,35,0.25)] ring-1 ring-[#E6E3DA]">
            <svg width="46" height="46" viewBox="0 0 24 24" fill="none">
              <rect x="5" y="10.5" width="14" height="9.5" rx="2" stroke="#1B1E23" strokeWidth="1.6" />
              <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" stroke="#1F6F63" strokeWidth="1.6" strokeLinecap="round" />
              <circle cx="12" cy="15" r="1.4" fill="#1F6F63" />
            </svg>
          </div>
        </div>
      </section>

      {/* Feature row */}
      <section className="relative z-10 mx-auto mt-24 max-w-6xl px-6 md:px-10">
        <div className="grid divide-y divide-[#E6E3DA] border-y border-[#E6E3DA] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {[
            {
              title: "Encrypted end-to-end",
              desc: "Only the people in the conversation can read it. Not us, not anyone else.",
              icon: (
                <>
                  <rect x="5" y="10.5" width="14" height="9.5" rx="2" stroke="#1F6F63" strokeWidth="1.5" />
                  <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" stroke="#1F6F63" strokeWidth="1.5" strokeLinecap="round" />
                </>
              ),
            },
            {
              title: "Delivered instantly",
              desc: "No spinners, no delay. Messages arrive the moment you send them.",
              icon: (
                <path d="M13 3 5 14h6l-1 7 9-12h-6l1-6Z" stroke="#1F6F63" strokeWidth="1.5" strokeLinejoin="round" />
              ),
            },
            {
              title: "Built to feel quiet",
              desc: "No feeds, no engagement bait — just the people you're actually talking to.",
              icon: (
                <>
                  <circle cx="9" cy="12" r="6" stroke="#1F6F63" strokeWidth="1.5" />
                  <circle cx="15" cy="12" r="6" stroke="#1F6F63" strokeWidth="1.5" />
                </>
              ),
            },
          ].map((feature) => (
            <div key={feature.title} className="px-2 py-9 sm:px-8">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="mb-4">
                {feature.icon}
              </svg>
              <h3 className="font-[family-name:var(--font-display)] text-base font-semibold text-[#1B1E23]">
                {feature.title}
              </h3>
              <p className="mt-2 max-w-[26ch] text-sm leading-relaxed text-[#5B6169]">
                {feature.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      <footer className="relative z-10 mx-auto mt-20 max-w-6xl px-6 py-10 text-center text-xs text-[#9AA0A6] md:px-10">
        © 2026 Airalance. All rights reserved.
      </footer>
    </main>
  );
}
