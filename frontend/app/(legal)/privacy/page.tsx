import type { Metadata } from "next";
import { LegalTitle, Section, UL, LI, A } from "../parts";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Velnor collects, uses, and protects your personal data under the GDPR.",
};

export default function PrivacyPage() {
  return (
    <article>
      <LegalTitle eyebrow="Legal" title="Privacy Policy" updated="12 July 2026">
        <p>
          This policy explains what personal data Velnor collects, why, and the rights you have over it
          under the EU General Data Protection Regulation (GDPR) and Polish data-protection law. Velnor is
          currently pre-launch: today we primarily operate a waitlist, and this policy also covers the
          product features as they roll out.
        </p>
      </LegalTitle>

      <Section n="01" title="Who we are (the data controller)">
        <p>
          The controller of your personal data is <strong className="text-zinc-200">[Operator legal name]</strong>,
          an individual operating Velnor from <strong className="text-zinc-200">[Country — Poland]</strong>. Once the
          Velnor operating company (a Polish sp. z o.o.) is incorporated, it will become the controller and this
          policy will be updated accordingly.
        </p>
        <p>
          For any privacy question or to exercise your rights, contact us at{" "}
          <A href="mailto:privacy@velnor.app">privacy@velnor.app</A>.
        </p>
      </Section>

      <Section n="02" title="What data we collect">
        <UL>
          <LI><strong className="text-zinc-200">Waitlist data</strong> — the email address you submit to join the waitlist.</LI>
          <LI><strong className="text-zinc-200">Account data</strong> — when you create an account, your email address and authentication details, handled by our authentication provider (Supabase).</LI>
          <LI><strong className="text-zinc-200">Financial data you enter</strong> — holdings, transactions, watchlists, goals, notes, theses, and any other information you choose to add to organise your finances. You control this data and can delete it at any time.</LI>
          <LI><strong className="text-zinc-200">Usage &amp; device data</strong> — basic technical information such as IP address, browser type, and pages visited, collected to keep the service secure and working.</LI>
        </UL>
        <p>
          We do <strong className="text-zinc-200">not</strong> connect to your brokerage or bank, and we do not ask for
          bank credentials, card numbers, or government identifiers.
        </p>
      </Section>

      <Section n="03" title="Why we use it, and our legal basis">
        <UL>
          <LI><strong className="text-zinc-200">To run the waitlist and tell you about launch</strong> — on the basis of your <em>consent</em>, which you can withdraw at any time.</LI>
          <LI><strong className="text-zinc-200">To provide the product</strong> (your account and the features you use) — on the basis of performing our <em>contract</em> with you.</LI>
          <LI><strong className="text-zinc-200">To keep Velnor secure, reliable, and improving</strong> — on the basis of our <em>legitimate interests</em>, balanced against your rights.</LI>
          <LI><strong className="text-zinc-200">To meet legal obligations</strong> where the law requires it.</LI>
        </UL>
      </Section>

      <Section n="04" title="Who we share it with">
        <p>We do not sell your personal data. We share it only with service providers (processors) that help us run Velnor, under contracts that require them to protect it:</p>
        <UL>
          <LI><strong className="text-zinc-200">Supabase</strong> — database, authentication, and hosting of your account and data.</LI>
          <LI><strong className="text-zinc-200">Anthropic</strong> — powers the AI features. When you use an AI feature, the relevant context is sent to Anthropic to generate a response. It is not used to train their models.</LI>
          <LI><strong className="text-zinc-200">Market-data providers</strong> — we retrieve public market data (e.g. prices, fundamentals) to display in the app; your personal data is not sent to them.</LI>
          <LI><strong className="text-zinc-200">[Email / advertising providers]</strong> — if used for launch communications or campaigns; listed here as they are engaged.</LI>
        </UL>
      </Section>

      <Section n="05" title="International transfers">
        <p>
          Some providers (such as Anthropic) process data outside the European Economic Area, primarily in the
          United States. Where that happens, transfers are protected by appropriate safeguards such as the European
          Commission&apos;s Standard Contractual Clauses. Where possible, data is stored in the EU region.
        </p>
      </Section>

      <Section n="06" title="How long we keep it">
        <p>
          We keep waitlist emails until launch and for a reasonable period afterwards, or until you unsubscribe or
          ask us to delete them. Account and financial data is kept while your account is active; when you delete
          your account, we delete or anonymise it within a reasonable period, except where the law requires us to
          keep certain records.
        </p>
      </Section>

      <Section n="07" title="Your rights">
        <p>Under the GDPR you have the right to:</p>
        <UL>
          <LI>access the personal data we hold about you;</LI>
          <LI>correct data that is inaccurate or incomplete;</LI>
          <LI>have your data erased (&ldquo;right to be forgotten&rdquo;);</LI>
          <LI>restrict or object to how we process it;</LI>
          <LI>receive your data in a portable format;</LI>
          <LI>withdraw consent at any time, without affecting processing already carried out.</LI>
        </UL>
        <p>
          To exercise any of these, email <A href="mailto:privacy@velnor.app">privacy@velnor.app</A>. You also have the
          right to lodge a complaint with your supervisory authority — in Poland, the President of the Personal Data
          Protection Office (Prezes Urzędu Ochrony Danych Osobowych, UODO).
        </p>
      </Section>

      <Section n="08" title="Cookies">
        <p>
          We use strictly necessary cookies to keep you signed in and to keep the service secure. These are required
          for the app to function. If we later add analytics or advertising cookies, we will ask for your consent
          first and update this policy.
        </p>
      </Section>

      <Section n="09" title="Security">
        <p>
          We use industry-standard measures — encryption in transit, access controls, and reputable infrastructure —
          to protect your data. No system is perfectly secure, but we work to keep the risk low and to notify you and
          the relevant authority if a breach affecting your rights occurs.
        </p>
      </Section>

      <Section n="10" title="Children">
        <p>Velnor is not intended for anyone under 18, and we do not knowingly collect data from children.</p>
      </Section>

      <Section n="11" title="Changes to this policy">
        <p>
          We may update this policy as Velnor evolves. We will change the &ldquo;last updated&rdquo; date above and, for
          material changes, tell you directly where appropriate.
        </p>
      </Section>
    </article>
  );
}
