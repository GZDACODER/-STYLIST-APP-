// Help and support: for clients who booked through a pro's page, and for
// pros. Linked from the footer and given to Stripe as the support URL.
import Link from "next/link";
import LegalShell from "../LegalShell";
import { BRAND_NAME } from "@/lib/brand";
import { CONTACT_EMAIL } from "@/lib/legal";

export const metadata = {
  title: `Help · ${BRAND_NAME}`,
  description: `How to change or cancel a booking, deposits, and how to reach ${BRAND_NAME}.`,
  alternates: { canonical: "/help" },
};

const Mail = () => <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>;

export default function HelpPage() {
  return (
    <LegalShell title="Help" kicker="Support">
      <p className="hm-legal-lede">
        {BRAND_NAME} is booking software used by independent pros. If you booked an appointment, your
        appointment is with that pro. Here&apos;s how to manage it, and how to reach us.
      </p>

      <h2>If you booked an appointment</h2>

      <h3>Move or cancel your appointment</h3>
      <p>
        Open your confirmation email and tap <strong>Manage my appointment</strong>. From there you can
        reschedule, cancel, say you&apos;re running late or add it to your calendar. Each pro sets how close
        to the appointment you can still change it online; after that, contact them directly.
      </p>

      <h3>Lost your confirmation email?</h3>
      <p>
        Search your inbox (and spam) for your pro&apos;s business name. Or use{" "}
        <Link href="/client">Find your appointment</Link> with your pro&apos;s ID (it starts with
        &quot;CL-&quot; and is on their booking page) and your phone number.
      </p>

      <h3>Deposits and refunds</h3>
      <p>
        Deposits are paid to your pro, not to {BRAND_NAME}. Whether a deposit is refunded when you cancel
        or miss an appointment is up to your pro&apos;s cancellation policy, which is shown before you pay
        and in your booking. To ask about a refund, reply to your confirmation email: it goes straight
        to your pro. Refunds go back to the card you paid with and usually show within 5–10 business days.
      </p>

      <h3>A charge you don&apos;t recognise</h3>
      <p>
        Deposits show on your statement under <strong>CLIENTELE</strong> or your pro&apos;s business name. If
        you don&apos;t recognise one, email us at <Mail /> with the date and amount and we&apos;ll help you
        find the booking before you contact your bank.
      </p>

      <h3>Your details and privacy</h3>
      <p>
        Your pro uses your details to run your bookings. To see, correct or delete them, ask your pro or
        email us. See our <Link href="/privacy">Privacy Policy</Link>.
      </p>

      <h2>If you&apos;re a pro using {BRAND_NAME}</h2>

      <h3>Getting set up</h3>
      <p>
        After you sign up: add your services (there&apos;s a &quot;Use these services&quot; button to start from
        examples), set your hours, then open times on the Openings page. Clients only see times you
        open. Then share your booking link from Home.
      </p>

      <h3>Your plan, card and invoices</h3>
      <p>
        In your dashboard, go to <strong>Settings → Plan &amp; billing → Manage billing</strong> to change
        your card, see invoices or cancel. Cancelling keeps your plan on until the end of the period
        you&apos;ve paid for.
      </p>

      <h3>Deposits and payouts</h3>
      <p>
        Deposits go to your own Stripe account (Settings → Deposits → Connect Stripe). Refunds are up to
        your policy: issue them from Stripe (Settings → Deposits → Open Stripe).
      </p>

      <h2>Contact us</h2>
      <p>
        Email <Mail />. We read every message and usually reply within one business day.
      </p>
    </LegalShell>
  );
}
