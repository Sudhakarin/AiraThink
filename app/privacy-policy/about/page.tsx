import Link from "next/link";

export const metadata = {
  title: "Sudhakar Mishra — Founder, AiraThink & Airalance",
  description:
    "Biography of Sudhakar Mishra, founder and CEO of AiraThink Digital Media and creator of Airalance.",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="font-display text-lg font-bold text-white">{title}</h2>
      <div className="mt-2 space-y-3 text-sm leading-relaxed text-mist">{children}</div>
    </section>
  );
}

export default function AboutPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-ink-900 px-6 py-14">
      <div className="pointer-events-none absolute inset-0 bg-aurora" />

      <div className="glass animate-fadeUp relative z-10 mx-auto w-full max-w-3xl rounded-3xl p-8 shadow-2xl sm:p-10">
        <Link href="/" className="font-display text-lg font-bold text-white">
          Aira<span className="text-gradient">Think!</span>
        </Link>

        {/* Hero */}
        <div className="mt-6 flex items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet to-violet-light font-display text-2xl font-bold text-white">
            SM
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold text-white sm:text-3xl">Sudhakar Mishra</h1>
            <p className="mt-1 text-sm text-mist">Founder &amp; CEO, AiraThink Digital Media</p>
          </div>
        </div>

        <p className="mt-6 text-sm leading-relaxed text-mist">
          Sudhakar Mishra is an Indian entrepreneur, digital media professional, and
          technology-focused business founder known for establishing AiraThink Digital Media, a
          digital solutions company founded in 2019. Born on 18 October 2004 in Uttar Pradesh,
          India, he began exploring the digital and entrepreneurial space at a notably young age.
          His professional interests center on digital media, branding, public relations, online
          promotion, technology, and the development of digital platforms.
        </p>

        <a
          href="https://instagram.com/sudhakarinofficial"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-violet-light hover:underline"
        >
          @Sudhakarinofficial ↗
        </a>

        <Section title="Early Life">
          <p>
            From his teenage years, Mishra developed an interest in technology, the internet,
            social media, and the rapidly changing digital ecosystem. Rather than treating the
            internet merely as a medium for entertainment, he became interested in how digital
            platforms could be used to build brands, reach audiences, and create businesses — an
            interest that later formed the foundation of his work with AiraThink.
          </p>
        </Section>

        <Section title="Education">
          <p>
            Mishra pursued higher education in business administration at Amity University,
            Noida, where he built an academic foundation in management and entrepreneurship. This
            formal training complemented his hands-on experience in digital marketing, allowing
            him to combine management knowledge with practical work in technology and media.
          </p>
        </Section>

        <Section title="Founding of AiraThink">
          <p>
            In 2019, at approximately 15 years of age, Sudhakar Mishra founded AiraThink Digital
            Media. What began as a young entrepreneur&rsquo;s initiative developed into a broader
            digital-media business spanning public relations, branding, search-engine optimization
            (SEO), online promotions, music distribution, online reputation management, website
            development, influencer marketing, and social-media promotion.
          </p>
          <p>
            The company reflects a broader approach to entrepreneurship — combining media,
            technology, marketing, and online infrastructure rather than concentrating on a single
            conventional advertising service.
          </p>
        </Section>

        <Section title="Work in Digital Media">
          <p>
            A major part of Mishra&rsquo;s professional identity has been connected with digital
            marketing and online brand development, spanning social-media marketing, SEO, content
            marketing, advertising, brand marketing, and content strategy.
          </p>
          <p>
            Through AiraThink, his work has extended across the digital ecosystem — helping brands
            and individuals establish an online presence, improving digital visibility, developing
            promotional strategies, and working with internet-based media channels.
          </p>
        </Section>

        <Section title="Music &amp; Online Distribution">
          <p>
            AiraThink&rsquo;s activities have also included music distribution and digital
            promotion, helping artists distribute their work through major digital platforms and
            reach online audiences — bringing together interests in entertainment, technology,
            marketing, and digital distribution.
          </p>
        </Section>

        <Section title="Airalance">
          <p>
            Airalance is a social platform developed under the AiraThink ecosystem, combining
            social networking and messaging with a news-feed experience. It represents a move
            beyond traditional digital-media services toward building a consumer-facing technology
            product — one focused on communication, content discovery, and user identity, with a
            strong emphasis on privacy.
          </p>
        </Section>

        <Section title="Vision">
          <p>
            Mishra&rsquo;s entrepreneurial approach is closely associated with the convergence of
            technology, media, branding, and communication. AiraThink began in 2019 and expanded
            across multiple areas of the digital economy; Airalance represents the next stage of
            that journey, with a greater emphasis on technology and product development.
          </p>
        </Section>

        <Section title="Professional Identity">
          <p>
            Sudhakar Mishra is also associated with the professional name{" "}
            <span className="font-medium text-white">Sudhakarin</span>. His public presence has
            developed around the identity of a young entrepreneur working at the intersection of
            business and digital technology, with an emphasis on experimentation, independent
            business building, and the use of internet technologies to create new opportunities.
          </p>
        </Section>

        <Section title="Company Details">
          <div className="rounded-xl border border-white/10 bg-ink-800 px-4 py-4">
            <p><span className="text-mist-light">Company:</span> AiraThink Digital Media</p>
            <p><span className="text-mist-light">Founded:</span> 2019</p>
            <p><span className="text-mist-light">Founder &amp; CEO:</span> Sudhakar Mishra</p>
            <p><span className="text-mist-light">Products:</span> Airalance (social &amp; news platform)</p>
            <p><span className="text-mist-light">Services:</span> Digital marketing, branding, SEO, PR, music distribution, web development, influencer marketing</p>
            <p><span className="text-mist-light">Website:</span>{" "}
              <a href="https://airathink.com" target="_blank" rel="noopener noreferrer" className="text-violet-light hover:underline">
                AiraThink.com
              </a>
            </p>
          </div>
        </Section>

        <Section title="Contact">
          <p>Email: help@airalance.com</p>
          <p>Phone: 7055520186</p>
        </Section>

        <Link
          href="/privacy-policy"
          className="mt-8 inline-block rounded-xl bg-gradient-to-r from-violet to-violet-light px-5 py-2.5 text-sm font-semibold text-white"
        >
          Back to Privacy Policy
        </Link>
      </div>
    </main>
  );
}
