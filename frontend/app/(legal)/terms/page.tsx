import type { Metadata } from "next";
import { LegalTitle, Section, UL, LI, A } from "../parts";

export const metadata: Metadata = {
  title: "Terms of Service — Velnor",
  description: "The terms that govern your use of Velnor, including that it is not investment advice.",
};

export default function TermsPage() {
  return (
    <article>
      <LegalTitle eyebrow="Legal" title="Terms of Service" updated="12 July 2026">
        <p>
          These terms govern your use of Velnor. By joining the waitlist, creating an account, or using the app,
          you agree to them. Please read the section on advice carefully — it matters.
        </p>
      </LegalTitle>

      <Section n="01" title="Who we are and eligibility">
        <p>
          Velnor is operated by <strong className="text-zinc-200">[Operator legal name]</strong> from{" "}
          <strong className="text-zinc-200">[Country — Poland]</strong>. You must be at least 18 years old and able to
          form a binding contract to use Velnor.
        </p>
      </Section>

      <Section n="02" title="Velnor is not financial advice">
        <p className="text-zinc-200">
          This is the most important term. Velnor is an educational and organisational tool. It is not an investment
          adviser, broker, or financial institution, and nothing in it is personal advice.
        </p>
        <UL>
          <LI>Nothing Velnor shows you — including AI-generated text, scores, calculators, prompts, or data — is a recommendation to buy, sell, or hold any security, or investment, financial, tax, or legal advice.</LI>
          <LI>Velnor does not know your full circumstances and does not assess whether any investment is suitable for you. No fiduciary or advisory relationship is created by using it.</LI>
          <LI>All investing carries risk, including the loss of your capital. Past performance does not predict future results.</LI>
          <LI>You are solely responsible for your own decisions. Before acting, consult a licensed financial, tax, or legal professional.</LI>
        </UL>
      </Section>

      <Section n="03" title="The service, during pre-launch and after">
        <p>
          Velnor is under active development and currently pre-launch. Features may change, break, or be removed, and
          the service is provided on an &ldquo;as is&rdquo; and &ldquo;as available&rdquo; basis. We do not guarantee
          uninterrupted or error-free operation.
        </p>
      </Section>

      <Section n="04" title="Data accuracy">
        <p>
          Market data, prices, fundamentals, and similar information come from third-party sources and may be delayed,
          incomplete, or inaccurate. Any figures Velnor computes from data you enter are only as good as that input.
          Do not rely on Velnor as a system of record or for the execution of any transaction.
        </p>
      </Section>

      <Section n="05" title="Your account and responsibilities">
        <UL>
          <LI>Keep your login credentials secure and do not share your account.</LI>
          <LI>Provide accurate information and use Velnor only for lawful, personal, non-commercial purposes.</LI>
          <LI>You are responsible for the data you enter and for activity under your account.</LI>
        </UL>
      </Section>

      <Section n="06" title="Acceptable use">
        <p>You agree not to:</p>
        <UL>
          <LI>reverse-engineer, scrape, overload, or interfere with Velnor or its infrastructure;</LI>
          <LI>attempt to access accounts or data that are not yours;</LI>
          <LI>use Velnor to break the law or infringe anyone&apos;s rights;</LI>
          <LI>resell or redistribute the service or its data.</LI>
        </UL>
      </Section>

      <Section n="07" title="Intellectual property">
        <p>
          Velnor, including its name, design, and software, belongs to us and is protected by law. You keep ownership
          of the content and data you enter; you grant us the limited licence needed to store and process it in order
          to provide the service.
        </p>
      </Section>

      <Section n="08" title="Limitation of liability">
        <p>
          To the fullest extent permitted by law, Velnor and its operator are not liable for any investment losses or
          for any indirect, incidental, or consequential damages arising from your use of the service or your reliance
          on any information in it. Nothing in these terms limits liability that cannot be limited under applicable law,
          including liability for death, personal injury, or fraud.
        </p>
      </Section>

      <Section n="09" title="Termination">
        <p>
          You may stop using Velnor and delete your account at any time. We may suspend or end access if these terms
          are breached or if we discontinue the service.
        </p>
      </Section>

      <Section n="10" title="Governing law">
        <p>
          These terms are governed by the laws of Poland and the European Union, without prejudice to any mandatory
          consumer-protection rights you have where you live.
        </p>
      </Section>

      <Section n="11" title="Changes and contact">
        <p>
          We may update these terms as Velnor evolves; the &ldquo;last updated&rdquo; date above will change. Questions?
          Email <A href="mailto:hello@velnor.app">hello@velnor.app</A>. See also our{" "}
          <A href="/privacy">Privacy Policy</A>.
        </p>
      </Section>
    </article>
  );
}
