// Privacy Policy. Plain language, drafted from what Clientele actually
// stores and who it shares it with. Not legal advice: have a lawyer review
// before relying on it. Keep it in step with the app when features change.
import Link from "next/link";
import LegalShell from "../LegalShell";
import { BRAND_NAME } from "@/lib/brand";
import { CONTACT_EMAIL, LEGAL_ENTITY } from "@/lib/legal";

export const metadata = {
  title: `Privacy Policy · ${BRAND_NAME}`,
  description: `What ${BRAND_NAME} collects, why, and who it's shared with.`,
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  const us = LEGAL_ENTITY;

  return (
    <LegalShell title="Privacy Policy">
      <p className="hm-legal-lede">
        This policy explains what information {BRAND_NAME} collects, why, who it&apos;s shared
        with, and the choices you have.{" "}
        {us !== BRAND_NAME ? `${BRAND_NAME} is run by ${us}. ` : ""}We don&apos;t sell personal information, and we don&apos;t use
        advertising or tracking cookies.
      </p>

      <h2>1. Two kinds of people use {BRAND_NAME}</h2>
      <ul>
        <li>
          <strong>Businesses</strong> sign up to take bookings. For their own account
          information, we decide how it&apos;s used, as described here.
        </li>
        <li>
          <strong>Clients</strong> book with a business through its booking page. Their
          information belongs to that business: we store and use it on the business&apos;s
          behalf, only to run bookings for them. If you&apos;re a client, the business you booked
          with is your first contact for questions about your information, and you can also
          contact us.
        </li>
      </ul>

      <h2>2. What we collect from businesses</h2>
      <ul>
        <li>Your login email and password (passwords are stored scrambled, never in plain text).</li>
        <li>
          Business details you add: business name, your first name, kind of business, time zone,
          booking link, tagline, cover photo, Instagram, location, services and prices, working
          hours, openings, and the email you want client replies sent to.
        </li>
        <li>
          Your plan and billing status. Card details are entered on Stripe&apos;s own pages and
          kept by Stripe. We never see or store your full card number.
        </li>
        <li>
          If you take deposits, the ID of your Stripe account and whether it can take payments.
        </li>
      </ul>

      <h2>3. What we store about clients, for the business</h2>
      <ul>
        <li>Name, phone number and email address.</li>
        <li>
          Bookings: service, date and time, price, deposit and whether it was paid, cancellations,
          standing appointments, and how each visit went (for example kept or no-show) when the
          business marks it.
        </li>
        <li>Notes the business writes on a client&apos;s card, and whether they&apos;re a Regular.</li>
        <li>Waitlist choices: the service, days and times a client would like.</li>
        <li>
          Client lists a business imports from another booking app (names, phone numbers, emails
          and notes).
        </li>
      </ul>
      <p>
        {BRAND_NAME} isn&apos;t designed for health or medical information, and businesses
        shouldn&apos;t record it.
      </p>

      <h2>4. How the information is used</h2>
      <ul>
        <li>To run booking pages, dashboards, deposits, standing appointments and waitlists.</li>
        <li>
          To send emails that are part of the service: sign-in codes and links, booking
          confirmations, 24-hour reminders, cancellation and deposit links, standing appointment
          notices and waitlist offers to clients; and to businesses, their welcome email, trial
          and billing notices, the end-of-day wrap-up and the Monday summary.
        </li>
        <li>To take payments for plans, and to pass client deposits to the business&apos;s Stripe account.</li>
        <li>To keep {BRAND_NAME} secure, fix problems, and answer your questions.</li>
      </ul>
      <p>We don&apos;t send marketing to clients, and we don&apos;t sell or rent anyone&apos;s information.</p>

      <h2>5. Who we share it with</h2>
      <p>Only with the companies that help run {BRAND_NAME}, and only for that:</p>
      <ul>
        <li><strong>Supabase</strong>: our database and logins.</li>
        <li><strong>Vercel</strong>: hosts the website and app.</li>
        <li><strong>Stripe</strong>: plan payments, and client deposits paid to businesses.</li>
        <li><strong>Resend</strong>: sends our emails.</li>
        <li>
          <strong>Twilio</strong>: would send text messages, if texts are turned on. They&apos;re
          currently off.
        </li>
      </ul>
      <p>
        Clients&apos; details are also shown to the business they booked with. We may share
        information if the law requires it, to protect people&apos;s safety or our rights, or
        as part of a sale or merger of {BRAND_NAME} (the same protections would continue).
      </p>

      <h2>6. Cookies</h2>
      <p>
        We only use the cookies needed to keep you logged in and to remember that a client has
        confirmed their email on a booking page. There are no advertising, analytics or tracking
        cookies.
      </p>

      <h2>7. How long we keep it</h2>
      <ul>
        <li>Business accounts: while the account is open, and deleted when you ask us to close it.</li>
        <li>
          Client information: for as long as the business keeps it in {BRAND_NAME}. Businesses can
          delete a client at any time.
        </li>
        <li>
          Some records (such as payments) may be kept longer where the law requires it, for
          example for tax.
        </li>
      </ul>

      <h2>8. Your choices and rights</h2>
      <ul>
        <li>Businesses can see, change, export and delete their clients from the dashboard.</li>
        <li>
          Anyone can ask us to see, correct or delete their information by emailing{" "}
          {CONTACT_EMAIL}. Clients: we may pass your request to the business you booked with,
          since it&apos;s their record.
        </li>
        <li>
          Clients can cancel a visit from the link in their email, and leave a waitlist at any
          time from the waitlist email.
        </li>
        <li>
          Depending on where you live (for example California), you may have extra rights under
          local law. We&apos;ll honour them; just email us.
        </li>
      </ul>

      <h2>9. Security</h2>
      <p>
        Information is sent over encrypted connections, stored with our providers above, and
        protected so that each business can only see its own clients. No system is perfectly
        secure, so please use a strong password and tell us at {CONTACT_EMAIL} if you notice
        anything wrong.
      </p>

      <h2>10. Children</h2>
      <p>
        {BRAND_NAME} isn&apos;t meant for children under 13, and we don&apos;t knowingly collect
        their information. If a child&apos;s details have been added, contact us and we&apos;ll
        delete them.
      </p>

      <h2>11. Where information is stored</h2>
      <p>
        {BRAND_NAME} is run from the United States. Information may be stored and processed in
        the United States, or in other countries where the providers above operate, with the
        same protections.
      </p>

      <h2>12. Changes</h2>
      <p>
        If we change this policy in an important way, we&apos;ll tell businesses by email before
        it takes effect, and update the date at the top of this page.
      </p>

      <h2>13. Contact</h2>
      <p>
        Questions or requests about privacy? Email{" "}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. See also our{" "}
        <Link href="/terms">Terms of Service</Link>.
      </p>
    </LegalShell>
  );
}
