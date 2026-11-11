// Terms of Service. Plain language, drafted from how Clientele actually
// works. Not legal advice: have a lawyer review before relying on it.
import Link from "next/link";
import LegalShell from "../LegalShell";
import { BRAND_NAME } from "@/lib/brand";
import { CONTACT_EMAIL, GOVERNING_STATE, LEGAL_ENTITY } from "@/lib/legal";
import { DEPOSIT_FEE_FIXED_CENTS, DEPOSIT_FEE_PERCENT, PLANS, TRIAL_DAYS } from "@/lib/plans";
import { formatPrice } from "@/lib/money";

export const metadata = {
  title: `Terms of Service · ${BRAND_NAME}`,
  description: `The terms for using ${BRAND_NAME}.`,
  alternates: { canonical: "/terms" },
};

const price = (cents) => formatPrice(cents).replace(/\.00$/, "");

export default function TermsPage() {
  const { base, regulars, waitlist, bundle } = PLANS;
  const us = LEGAL_ENTITY;

  return (
    <LegalShell title="Terms of Service">
      <p className="hm-legal-lede">
        These terms are an agreement between you and {us} (
        {us !== BRAND_NAME ? <>&quot;{BRAND_NAME}&quot;, </> : null}&quot;we&quot;,
        &quot;us&quot;) about using {BRAND_NAME}: the website at
        clientelesuite.com, your booking page, your dashboard and the emails we send for you. By
        creating an account or using {BRAND_NAME}, you agree to them. If you don&apos;t agree,
        please don&apos;t use {BRAND_NAME}.
      </p>

      <h2>1. Who these terms are for</h2>
      <p>
        {BRAND_NAME} is booking software for businesses that take appointments: the business
        owner who signs up (&quot;you&quot;) and their clients who book. These terms are mainly
        for businesses. Clients who book through a business&apos;s booking page agree to the parts
        that apply to them (sections 6, 9 and 10), and their appointment itself is between them
        and that business.
      </p>
      <p>You must be at least 18 and able to enter a contract to create a business account.</p>

      <h2>2. Your account</h2>
      <ul>
        <li>Give accurate details, and keep your login details private. You&apos;re responsible for what happens in your account.</li>
        <li>Tell us straight away at {CONTACT_EMAIL} if you think someone else has used your account.</li>
        <li>One account is for one business. You may not resell or share access to {BRAND_NAME}.</li>
      </ul>

      <h2>3. Free trial, plans and billing</h2>
      <ul>
        <li>
          New accounts get a {TRIAL_DAYS}-day free trial with every feature on. No card is needed
          to start. If you don&apos;t choose a plan by the end of the trial, your account is
          paused until you do. Your bookings and clients are kept.
        </li>
        <li>
          Plans are billed monthly or yearly, in US dollars: {base.name} {price(base.monthlyCents)}
          /month, with add-ons {regulars.name} +{price(regulars.monthlyCents)}/month and{" "}
          {waitlist.name} +{price(waitlist.monthlyCents)}/month, or {bundle.name}{" "}
          {price(bundle.monthlyCents)}/month. Yearly plans cost 10 times the monthly price. Current
          prices are always on our <Link href="/#pricing">pricing section</Link>.
        </li>
        <li>
          Payments are handled by Stripe. Your plan renews automatically at the end of each
          monthly or yearly period until you cancel.
        </li>
        <li>
          You can cancel any time from Settings → Manage billing. Your plan stays on until the end
          of the period you&apos;ve paid for, and then stops. We don&apos;t give refunds for part
          of a period, unless the law requires it.
        </li>
        <li>
          If a payment fails, Stripe tries again for a few days and everything stays on
          meanwhile. If it still fails, paid features are paused until payment goes through.
        </li>
        <li>
          We may change prices. We&apos;ll tell you by email at least 30 days before a change
          affects you, and it applies from your next billing period.
        </li>
        <li>Prices don&apos;t include any sales tax that may apply where you are.</li>
      </ul>

      <h2>4. Client deposits</h2>
      <ul>
        <li>
          If you take deposits, you connect your own Stripe account. Deposits are paid by your
          clients straight to your Stripe account, under Stripe&apos;s own terms, which you agree
          to with Stripe.
        </li>
        <li>
          {BRAND_NAME} keeps a fee of {DEPOSIT_FEE_PERCENT}% + {DEPOSIT_FEE_FIXED_CENTS}¢ of each
          deposit, which helps cover card processing. It&apos;s taken automatically when the
          deposit is paid.
        </li>
        <li>
          You decide your deposit amounts and your cancellation policy, and you&apos;re
          responsible for refunds, chargebacks and disputes with your clients. {BRAND_NAME}{" "}
          doesn&apos;t refund deposits automatically.
        </li>
      </ul>

      <h2>5. Your clients and your information</h2>
      <ul>
        <li>
          Your client list, bookings and notes belong to you. You can export your client list at
          any time, and we don&apos;t sell it or contact your clients for our own marketing.
        </li>
        <li>
          You&apos;re responsible for having the right to add your clients&apos; details to{" "}
          {BRAND_NAME} (for example, when you import a list from another app), and for how you use
          them.
        </li>
        <li>
          {BRAND_NAME} sends emails to your clients for you: booking confirmations, reminders,
          standing appointment notices, cancellation and deposit links, and waitlist offers. By
          using these features, you confirm your clients have given you their details for this
          kind of booking communication.
        </li>
        <li>
          You give us permission to store and process this information only to run{" "}
          {BRAND_NAME} for you, as described in our <Link href="/privacy">Privacy Policy</Link>.
        </li>
      </ul>

      <h2>6. Appointments are between you and your client</h2>
      <p>
        {BRAND_NAME} provides the booking tools. We aren&apos;t part of the appointment, and
        we&apos;re not responsible for the services a business provides, whether an appointment
        happens, or any dispute between a business and a client. Clients should contact the
        business directly about their appointment.
      </p>

      <h2>7. Acceptable use</h2>
      <p>Don&apos;t use {BRAND_NAME} to:</p>
      <ul>
        <li>break any law, or offer services that are illegal where you or your clients are;</li>
        <li>send spam, or email people who haven&apos;t given you their details;</li>
        <li>upload anything you don&apos;t have the right to use, or anything harmful or offensive;</li>
        <li>try to get into other accounts, or interfere with how {BRAND_NAME} works;</li>
        <li>
          offer medical, therapy or other healthcare services, or collect health information
          through {BRAND_NAME}. It isn&apos;t designed for that kind of information.
        </li>
      </ul>
      <p>We may pause or close accounts that break these rules.</p>

      <h2>8. Our service</h2>
      <ul>
        <li>
          We work to keep {BRAND_NAME} running and your information safe, but we can&apos;t
          promise it will always be available or free of errors. We may improve, change or stop
          features over time, and we&apos;ll give notice before removing anything you pay for.
        </li>
        <li>
          {BRAND_NAME} relies on other companies to run (such as hosting, payments and email).
          We&apos;re not responsible for their outages.
        </li>
        <li>The {BRAND_NAME} name, design and software belong to us.</li>
      </ul>

      <h2>9. Disclaimers</h2>
      <p>
        {BRAND_NAME} is provided &quot;as is&quot; and &quot;as available&quot;. To the extent
        the law allows, we make no other promises, including that it will suit a particular
        purpose, or that every email (such as a reminder) will be delivered or read.
      </p>

      <h2>10. Limit of liability</h2>
      <p>
        To the extent the law allows, we&apos;re not liable for indirect or knock-on losses, such
        as lost profits, lost bookings or lost data, and our total liability for any claim is
        limited to what you paid us in the 12 months before the claim. Nothing here limits
        liability that can&apos;t be limited by law.
      </p>

      <h2>11. Your responsibility to us</h2>
      <p>
        If someone makes a claim against us because of how you used {BRAND_NAME}, your content,
        your services or your dealings with your clients, you agree to cover our reasonable costs
        of dealing with it.
      </p>

      <h2>12. Ending things</h2>
      <ul>
        <li>You can stop using {BRAND_NAME} and cancel your plan at any time.</li>
        <li>
          To close your account and delete your information, email {CONTACT_EMAIL}. Export your
          client list first if you want to keep it.
        </li>
        <li>
          We may close an account that breaks these terms, or that hasn&apos;t been used or paid
          for in a long time, and we&apos;ll give notice by email where we reasonably can.
        </li>
        <li>Sections 4 to 11 continue to apply after an account is closed.</li>
      </ul>

      <h2>13. Changes to these terms</h2>
      <p>
        We may update these terms. If a change is important, we&apos;ll email you before it takes
        effect. Continuing to use {BRAND_NAME} after a change means you accept the new terms.
      </p>

      <h2>14. General</h2>
      <ul>
        <li>
          {GOVERNING_STATE
            ? `These terms are governed by the laws of the State of ${GOVERNING_STATE}, USA, and the laws of the United States.`
            : "These terms are governed by the laws of the United States and of the state where we are based."}
        </li>
        <li>
          If any part of these terms can&apos;t be enforced, the rest still applies. If we
          don&apos;t enforce something straight away, we can still enforce it later.
        </li>
        <li>These terms and our Privacy Policy are the whole agreement between us about {BRAND_NAME}.</li>
      </ul>

      <h2>15. Contact</h2>
      <p>
        Questions about these terms? Email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>
    </LegalShell>
  );
}
