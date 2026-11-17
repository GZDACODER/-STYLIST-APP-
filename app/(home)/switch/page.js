// "Make the Switch": the guide for pros moving from another booking app.
// Why switch, what comes over (and what doesn't), the steps in order, a
// message to send clients, and common questions. Other apps are named only
// as where pros are coming from; nothing is claimed about them.
import Link from "next/link";
import { BRAND_NAME } from "@/lib/brand";
import { CONTACT_EMAIL } from "@/lib/legal";
import { DEPOSIT_FEE_FIXED_CENTS, DEPOSIT_FEE_PERCENT, PLANS, TRIAL_DAYS } from "@/lib/plans";
import { formatPrice } from "@/lib/money";
import Icon from "../Icon";
import CopyMessage from "./CopyMessage";
import { createClient } from "@/lib/supabase/server";

const TITLE = `Make the switch to ${BRAND_NAME}`;
const DESCRIPTION =
  "Moving from Booksy, GlossGenius, Acuity, Square or Vagaro? Bring your client list over in an afternoon, keep your old app until you're ready, and we'll help you move.";

export const metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/switch" },
  openGraph: { title: TITLE, description: DESCRIPTION, siteName: BRAND_NAME, type: "website", url: "/switch" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

const price = (cents) => formatPrice(cents).replace(/\.00$/, "");

const WHY = [
  {
    icon: "star",
    title: "Your regulars come first",
    text: "Regulars-only times, early access to new openings, and their usual time held months ahead.",
  },
  {
    icon: "shield",
    title: "Your clients stay yours",
    text: "No marketplace, no other businesses on your page, no cut of new clients and no booking fees charged to them.",
  },
  {
    icon: "chart",
    title: "One price, everything on",
    text: `${price(PLANS.allin.monthlyCents)}/mo with every feature. No add-ons to work out.`,
  },
];

const COMES_OVER = [
  "Client names, phone numbers and emails",
  "Your notes on each client",
  "Who's a Regular (you pick for the whole list, then change anyone)",
];

const STAYS = [
  "Appointments already booked: finish those where they are",
  "Past visit history and cards on file",
  "Reviews, which live on the other app",
];

// Where pros are coming from (named only; no claims about them).
const FROM = ["Booksy", "GlossGenius", "Acuity", "Square Appointments", "Vagaro", "Fresha", "Schedulicity", "A paper book or DMs"];

const HELP = [
  {
    icon: "swap",
    title: "Send us your export",
    text: "Email us the client file from your old app and we'll import it for you, with Regulars marked the way you want.",
  },
  {
    icon: "link",
    title: "Can't find the export?",
    text: "Tell us which app you use and we'll walk you through finding it. A spreadsheet or a list of names and numbers works too.",
  },
  {
    icon: "bell",
    title: "Set-up questions",
    text: "Services, hours, deposits or openings: reply to any Clientele email or write to us, and a real person answers.",
  },
];

const ALONGSIDE = [
  ["Week 1", "Import your clients, add services and hours, and open times a few weeks out. Keep taking bookings in your old app."],
  ["Week 2", "Share your Clientele link with regulars first. Block the times your old app already has booked, so nobody double-books."],
  ["Weeks 3–4", "Put your link in your Instagram bio and send the message below to everyone. New bookings come to Clientele."],
  ["When you're ready", "Once your old app's last appointments are done, cancel it. Your trial is 14 days; take as long as you need."],
];

const STEPS = [
  {
    time: "2 min",
    title: "Start your free trial",
    text: `Business name, email, password. ${TRIAL_DAYS} days with everything on, and no card needed.`,
  },
  {
    time: "5 min",
    title: "Export your clients from your old app",
    text: "Most booking apps have an Export or Download button on the client list or in settings. Save the file as a CSV. Can't find it? Email us and we'll help.",
  },
  {
    time: "5 min",
    title: "Import them into Clientele",
    text: "Clients → Import clients. Pick the file, check which column is which (it guesses for you), and choose Regular or New. Anyone already on your list is skipped.",
  },
  {
    time: "20 min",
    title: "Add your services, hours and openings",
    text: "Your services with prices and times, your working hours, then open the times clients can book. Mark any of them Regulars only.",
  },
  {
    time: "10 min",
    title: "Turn on deposits (optional)",
    text: `Connect your own Stripe account and set a deposit for each service. It's paid straight to you, less ${DEPOSIT_FEE_PERCENT}% + ${DEPOSIT_FEE_FIXED_CENTS}¢ to cover card processing.`,
  },
  {
    time: "10 min",
    title: "Keep what's already booked",
    text: "Appointments already in your old app stay there until they're done. Don't open those times in Clientele, or add them to your Calendar as events with Block bookings on. Set up standing appointments for regulars who come on a schedule.",
  },
  {
    time: "5 min",
    title: "Share your link and tell your clients",
    text: "Put your booking link in your Instagram bio and send the message below. From then on, new bookings come to Clientele.",
  },
];

const MESSAGE =
  "Hi! I've moved my booking to a new page: [your booking link]. You can book, move or cancel your appointment there, with no app to download. Regulars get first pick of my times. Any appointment you already have with me stays the same. See you soon!";

const FAQ = [
  {
    q: "Do I have to cancel my old app right away?",
    a: `No. Keep it running during your ${TRIAL_DAYS}-day trial while appointments already booked there finish. Move over at your own pace.`,
  },
  {
    q: "Do my clients need to download an app or make an account?",
    a: "No. They book from your link in their phone's browser and confirm with a code sent to them. Nothing to download, no password.",
  },
  {
    q: "Can my appointments come over too?",
    a: "Not automatically. Only your client list imports. Keep upcoming appointments in your old app until they're done, and block those times in Clientele so nobody double-books them.",
  },
  {
    q: "What if my old app won't let me export?",
    a: `Email ${CONTACT_EMAIL} and we'll help. A spreadsheet works too: any CSV with names and a phone number or email can be imported.`,
  },
  {
    q: "What does it cost?",
    a: `${price(PLANS.allin.monthlyCents)}/mo, or ${price(PLANS.allin.yearlyCents)}/year (2 months free), with every feature. Team members are ${price(PLANS.team.monthlyCents)}/mo each (${price(PLANS.team.yearlyCents)}/year). The optional Assistant is ${price(PLANS.assistant.monthlyCents)}/mo (${price(PLANS.assistant.yearlyCents)}/year). The first ${TRIAL_DAYS} days are free with everything on, no card needed. Deposits carry ${DEPOSIT_FEE_PERCENT}% + ${DEPOSIT_FEE_FIXED_CENTS}¢ each to cover card processing. Cancel any time.`,
  },
  {
    q: "If I leave Clientele, can I take my clients with me?",
    a: "Yes. Clients → Export clients downloads your whole list as a CSV any time. Your clients are yours.",
  },
];

export default async function SwitchPage() {
  // Logged in: "View dashboard" instead of "Log in".
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const account = user ? { href: "/dashboard", label: "View dashboard" } : { href: "/login", label: "Log in" };
  return (
    <>
      <header className="hm-nav">
        <div className="hm-nav-inner">
          <Link href="/" className="hm-logo" aria-label={`${BRAND_NAME} home`}>
            {BRAND_NAME}
          </Link>
          <nav className="hm-nav-links" aria-label="Main">
            <Link href="/#features" className="hm-hide-phone">
              Features
            </Link>
            <Link href="/#pricing" className="hm-hide-phone">
              Pricing
            </Link>
            {user ? (
              <Link href={account.href} className="hm-button hm-button-small">
                {account.label}
              </Link>
            ) : (
              <>
                <Link href="/login">Log in</Link>
                <Link href="/signup" className="hm-button hm-button-small">
                  Start free trial
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <main>
        {/* ---------- Hero ---------- */}
        <section className="hm-sw-hero">
          <p className="hm-kicker">Make the switch</p>
          <h1>
            Bring your book over <em>in an afternoon.</em>
          </h1>
          <p className="hm-lede">
            Import your client list, open your times, and share one link. Keep your old app until
            what&apos;s booked there is done. About an hour, start to finish.
          </p>
          <div className="hm-cta-row">
            <Link href="/signup" className="hm-button">
              Start free trial
            </Link>
            <a href="#steps" className="hm-button hm-button-ghost">
              See the steps
            </a>
          </div>
          <p className="hm-fine">{TRIAL_DAYS} days free. No card needed.</p>
          <div className="hm-sw-from">
            <p>Coming from</p>
            <ul>
              {FROM.map((name) => (
                <li key={name}>{name}</li>
              ))}
            </ul>
          </div>
        </section>

        {/* ---------- Why ---------- */}
        <section className="hm-section">
          <p className="hm-kicker">Why pros switch</p>
          <h2>Built for a book full of regulars.</h2>
          <ul className="hm-cards hm-sw-why">
            {WHY.map((w) => (
              <li key={w.title}>
                <Icon name={w.icon} />
                <h3>{w.title}</h3>
                <p>{w.text}</p>
              </li>
            ))}
          </ul>
          <p className="hm-fine hm-sw-more">
            <Link href="/#features">See every feature</Link>
          </p>
        </section>

        {/* ---------- What comes over ---------- */}
        <section className="hm-section">
          <p className="hm-kicker">What comes with you</p>
          <h2>Your list moves. Your bookings finish where they are.</h2>
          <div className="hm-sw-lists">
            <div>
              <h3>Comes over</h3>
              <ul className="hm-sw-check">
                {COMES_OVER.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3>Stays behind</h3>
              <ul className="hm-sw-dash">
                {STAYS.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* ---------- Help migrating ---------- */}
        <section className="hm-section">
          <p className="hm-kicker">Help migrating</p>
          <h2>We&apos;ll help you move.</h2>
          <p className="hm-section-lede">
            Switching shouldn&apos;t cost you a weekend. Email{" "}
            <a href={`mailto:${CONTACT_EMAIL}?subject=Help%20me%20switch`}>{CONTACT_EMAIL}</a> and we&apos;ll get your
            list in.
          </p>
          <ul className="hm-cards hm-sw-why">
            {HELP.map((h) => (
              <li key={h.title}>
                <Icon name={h.icon} />
                <h3>{h.title}</h3>
                <p>{h.text}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* ---------- Side by side ---------- */}
        <section className="hm-section">
          <p className="hm-kicker">No big-bang switch</p>
          <h2>
            Run Clientele <em>alongside</em> your old app.
          </h2>
          <p className="hm-section-lede">
            Keep both until you&apos;re comfortable. Here&apos;s how most pros do it.
          </p>
          <ol className="hm-sw-timeline">
            {ALONGSIDE.map(([when, what]) => (
              <li key={when}>
                <strong>{when}</strong>
                <p>{what}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* ---------- Steps ---------- */}
        <section id="steps" className="hm-section">
          <p className="hm-kicker">Step by step</p>
          <h2>Seven steps, about an hour.</h2>
          <ol className="hm-sw-steps">
            {STEPS.map((s, i) => (
              <li key={s.title}>
                <span className="hm-sw-num" aria-hidden="true">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div>
                  <h3>{s.title}</h3>
                  <p>{s.text}</p>
                </div>
                <span className="hm-sw-time">{s.time}</span>
              </li>
            ))}
          </ol>
        </section>

        {/* ---------- Message ---------- */}
        <section className="hm-section">
          <p className="hm-kicker">Tell your clients</p>
          <h2>Copy, paste, send.</h2>
          <p className="hm-section-lede">
            Text it, email it, or post it to your stories. Put your own link in, and change the
            words to sound like you.
          </p>
          <CopyMessage text={MESSAGE} />
        </section>

        {/* ---------- FAQ ---------- */}
        <section className="hm-section">
          <p className="hm-kicker">Questions</p>
          <h2>Before you move.</h2>
          <div className="hm-faq">
            {FAQ.map((f) => (
              <details key={f.q}>
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
          <p className="hm-fine hm-sw-more">
            Something else? Email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> and
            we&apos;ll help you move.
          </p>
        </section>

        {/* ---------- Final call ---------- */}
        <section className="hm-final">
          <h2>
            Your clients, <em>your way.</em>
          </h2>
          <p>Set up in an afternoon. {TRIAL_DAYS} days free, no card.</p>
          <Link href="/signup" className="hm-button">
            Start free trial
          </Link>
        </section>
      </main>

      <footer className="hm-footer">
        <span className="hm-logo hm-logo-small">{BRAND_NAME}</span>
        <nav aria-label="Footer">
          <Link href="/">Home</Link>
          <Link href={account.href}>{account.label}</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/privacy">Privacy</Link>
          <a href={`mailto:${CONTACT_EMAIL}`}>Contact · {CONTACT_EMAIL}</a>
        </nav>
        <p>© {new Date().getFullYear()} {BRAND_NAME}</p>
      </footer>
    </>
  );
}
