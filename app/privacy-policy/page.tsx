import Link from "next/link";

export const metadata = {
  title: "Privacy Policy — Airalance",
  description: "Privacy Policy for Airalance, an application under AiraThink.",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="font-display text-lg font-bold text-white">{title}</h2>
      <div className="mt-2 space-y-2 text-sm leading-relaxed text-mist">{children}</div>
    </section>
  );
}

export default function PrivacyPolicyPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-ink-900 px-6 py-14">
      <div className="pointer-events-none absolute inset-0 bg-aurora" />

      <div className="glass animate-fadeUp relative z-10 mx-auto w-full max-w-3xl rounded-3xl p-8 shadow-2xl sm:p-10">
        <Link href="/" className="font-display text-lg font-bold text-white">
          Aira<span className="text-gradient">Think!</span>
        </Link>

        <h1 className="mt-6 font-display text-3xl font-bold text-white">Privacy Policy</h1>
        <p className="mt-1 text-sm text-mist">for Airalance</p>
        <p className="mt-4 text-xs font-medium text-mist-light">Last Updated: August 21, 2026</p>

        <p className="mt-6 text-sm leading-relaxed text-mist">
          Airalance (referred to as &ldquo;we,&rdquo; &ldquo;our,&rdquo; or &ldquo;us&rdquo;) is an
          application under AiraThink. We are committed to protecting your privacy. This policy
          explains how we collect, use, and safeguard your information when you use our chat and
          news feed platform.
        </p>

        <Section title="1. Information We Collect">
          <p className="font-semibold text-mist-light">Information you provide:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Account details (name, email, phone number) when you sign up</li>
            <li>Profile information you choose to add</li>
            <li>Messages and content you send through chat</li>
            <li>Comments, reactions, and posts you make on the news feed</li>
            <li>Any feedback or support requests</li>
          </ul>

          <p className="mt-4 font-semibold text-mist-light">Information automatically collected:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Device information (model, OS version, unique identifiers, IP address)</li>
            <li>Usage data (features accessed, time spent, interactions)</li>
            <li>Log data (app crashes, system activity, clickstream)</li>
            <li>Approximate location (for local news relevance, only with your permission)</li>
          </ul>

          <p className="mt-4 font-semibold text-mist-light">Information from third parties:</p>
          <p>
            If you log in via social media platforms, we may access your name, email, and profile
            picture as per your authorization settings.
          </p>
        </Section>

        <Section title="2. How We Use Your Information">
          <ul className="list-disc space-y-1 pl-5">
            <li>To create and manage your account</li>
            <li>To enable chat and messaging features</li>
            <li>To deliver personalized news feed content</li>
            <li>To improve app performance and user experience</li>
            <li>To send important updates, security alerts, and support messages</li>
            <li>To maintain platform safety and prevent fraud/abuse</li>
            <li>To respond to your queries and support requests</li>
          </ul>
        </Section>

        <Section title="3. News Feed Content">
          <p>
            Airalance displays news and content aggregated from various sources. We do not control
            the content, privacy policies, or practices of third-party publishers whose content
            appears in your feed. If you are a publisher and wish to opt out, please contact us.
          </p>
        </Section>

        <Section title="4. Data Sharing">
          <p>We do not sell your personal data. We may share information with:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Service providers (analytics, hosting, push notifications) who process data on our behalf</li>
            <li>Legal authorities if required by law or to protect our rights</li>
          </ul>
          <p>
            Your messages and posts are visible to recipients as per your privacy settings within
            the app.
          </p>
        </Section>

        <Section title="5. Data Storage & Retention">
          <p>
            Your data is stored on secure servers. We retain your information only as long as
            necessary to provide our services or as required by law. Once a message is delivered
            successfully, it may be deleted from our servers per your preferences.
          </p>
        </Section>

        <Section title="6. Your Rights & Choices">
          <p>You have the right to:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Access the personal data we hold about you</li>
            <li>Correct inaccurate or incomplete information</li>
            <li>Delete your account and personal data (via &ldquo;Delete Account&rdquo; in settings or by contacting us)</li>
            <li>Withdraw consent for data processing at any time</li>
            <li>Opt-out of marketing communications</li>
            <li>Nominate someone to exercise your rights in case of incapacity</li>
          </ul>
          <p>To exercise these rights, contact us at the details below.</p>
        </Section>

        <Section title="7. Children's Privacy">
          <p>
            Airalance is not intended for users under 18 years of age. We do not knowingly collect
            data from children without verifiable parental consent, as required under applicable
            laws.
          </p>
        </Section>

        <Section title="8. Security">
          <p>
            We implement reasonable security measures to protect your data from unauthorized
            access, disclosure, or destruction.
          </p>
        </Section>

        <Section title="9. Data Breach Notification">
          <p>
            In case of a personal data breach that may pose a risk to your rights, we will notify
            you and the relevant authorities as required by law.
          </p>
        </Section>

        <Section title="10. Grievance Redressal">
          <p>If you have privacy concerns or complaints, please contact our Grievance Officer:</p>
          <div className="mt-2 rounded-xl border border-white/10 bg-ink-800 px-4 py-3">
            <p>
              <span className="text-mist-light">Name:</span>{" "}
              <Link href="/about" className="font-medium text-violet-light hover:underline">
                Sudhakar Mishra
              </Link>
            </p>
            <p><span className="text-mist-light">Email:</span> help@airalance.com</p>
            <p><span className="text-mist-light">Phone:</span> 7055520186</p>
            <p><span className="text-mist-light">Response Time:</span> We aim to respond within 30 days.</p>
          </div>
        </Section>

        <Section title="11. Updates to This Policy">
          <p>
            We may update this policy periodically. Changes will be posted here with a revised
            &ldquo;Last Updated&rdquo; date. Significant changes may be notified via email or
            in-app alerts.
          </p>
        </Section>

        <Section title="12. Contact Us">
          <p>For any privacy-related questions:</p>
          <p>Email: help@airalance.com</p>
          <p>Phone: 7055520186</p>
        </Section>

        <p className="mt-8 border-t border-white/10 pt-6 text-xs text-mist">
          Airalance is an application under AiraThink. This policy applies to all services
          provided by Airalance through our website and mobile app.
        </p>

        <Link
          href="/signup"
          className="mt-8 inline-block rounded-xl bg-gradient-to-r from-violet to-violet-light px-5 py-2.5 text-sm font-semibold text-white"
        >
          Back to sign up
        </Link>
      </div>
    </main>
  );
}
