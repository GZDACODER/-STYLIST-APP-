import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { BRAND_NAME } from "@/lib/brand";
import { DEPOSIT_FEE_FIXED_CENTS, DEPOSIT_FEE_PERCENT, PLANS, TRIAL_DAYS } from "@/lib/plans";
import { formatPrice } from "@/lib/money";
import HeroObject from "./HeroObject";
import FeatureTabs from "./FeatureTabs";
import PricingToggle from "./PricingToggle";
import Icon from "./Icon";

const TITLE = `${BRAND_NAME}: Booking that puts your regulars first.`;
const DESCRIPTION =
  "Deposits, waitlists and regulars-only times for businesses built on regulars.";

export const metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: { title: TITLE, description: DESCRIPTION, siteName: BRAND_NAME, type: "website", url: "/" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

// Dollars without cents when they're whole ($15, not $15.00).
const price = (cents) => formatPrice(cents).replace(/\.00$/, "");

// Who it's for (shown under the hero).
const EXAMPLES = [
  "Hair",
  "Barbers",
  "Nails",
  "Lashes",
  "Tattoo",
  "Trainers",
  "Tutors",
  "Pet grooming",
  "Photographers",
];

// "We don't charge extra for": all included in the one plan.
const NO_EXTRA = [
  "Waitlist",
  "Regulars-only times",
  "Invite links",
  "Standing appointments",
  "Confirmation and reminder emails",
  "Self-serve reschedule",
  "Intake forms and waivers",
  "Portfolio photos",
  "Reports",
  "Calendar events and holidays",
  "Client import and export",
  "Help switching from another app",
];

const NEVER = ["Booking fees charged to your clients", "A cut of new clients", "A marketplace listing next to other pros"];

export default async function HomePage() {
  // The homepage stays the homepage when logged in; the top button says
  // "View dashboard" instead of "Log in".
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const account = user
    ? { href: "/dashboard", label: "View dashboard" }
    : { href: "/login", label: "Log in" };

  const { allin, team, assistant } = PLANS;
  const included = [
    "Your booking page, portfolio and deposits",
    "Confirmation and reminder emails",
    "Regulars-only times and invite links",
    "Standing appointments for regulars",
    "Smart waitlist, regulars first",
    "Self-serve reschedule and cancel",
    "End-of-day wrap-up, notes and reports",
  ];

  return (
    <>
      <header className="hm-nav">
        <div className="hm-nav-inner">
        <Link href="/" className="hm-logo" aria-label={`${BRAND_NAME} home`}>
          {BRAND_NAME}
        </Link>
        <nav className="hm-nav-links" aria-label="Main">
          <a href="#features" className="hm-hide-phone">
            Features
          </a>
          <a href="#switching" className="hm-hide-phone">
            Switching
          </a>
          <a href="#pricing" className="hm-hide-phone">
            Pricing
          </a>
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
        <section className="hm-hero">
          <div className="hm-hero-copy">
            <p className="hm-kicker">Booking for pros with a full book</p>
            <h1>
              Booking that puts your <em>regulars</em> first.
            </h1>
            <p className="hm-lede">
              Deposits, waitlists and regulars-only times for businesses built on regulars.
            </p>
            <div className="hm-cta-row">
              <Link href="/signup" className="hm-button">
                Start free trial
              </Link>
              <a href="#features" className="hm-button hm-button-ghost">
                See how it works
              </a>
            </div>
            <p className="hm-fine">{TRIAL_DAYS} days free. No card needed.</p>
            <p className="hm-switch-line">
              Coming from Booksy, GlossGenius, Acuity, Square or Vagaro?{" "}
              <Link href="/switch">See how switching works →</Link>
            </p>
          </div>
          <div className="hm-hero-visual">
            <HeroObject />
          </div>
        </section>

        {/* ---------- Who it's for ---------- */}
        <section className="hm-for" aria-label="Who it's for">
          <ul>
            {EXAMPLES.map((name) => (
              <li key={name}>{name}</li>
            ))}
          </ul>
        </section>

        {/* ---------- Features (one tab at a time) ---------- */}
        <section id="features" className="hm-section">
          <p className="hm-kicker">What you get</p>
          <h2>
            Built for a book full of <em>regulars.</em>
          </h2>
          <p className="hm-section-lede">
            Everything a busy pro needs in one plan: tap through what makes Clientele different.
          </p>
          <FeatureTabs />
        </section>

        {/* ---------- Switching ---------- */}
        <section id="switching" className="hm-section hm-switch-strip">
          <div>
            <p className="hm-kicker">Make the switch</p>
            <h2>Moving over takes an afternoon.</h2>
            <p className="hm-section-lede">
              Coming from Booksy, GlossGenius, Acuity, Square, Vagaro or a paper book? Bring your clients, keep
              your old app until you&apos;re ready, and let us help.
            </p>
          </div>
          <ol className="hm-steps3">
            <li>
              <Icon name="swap" />
              <h3>Import your client list</h3>
              <p>Export a CSV from your old app and import it in a few taps. Names, phones, emails and notes come over.</p>
            </li>
            <li>
              <Icon name="link" />
              <h3>We&apos;ll help you move</h3>
              <p>Can&apos;t find the export, or want it done for you? Email us the file and we&apos;ll import it.</p>
            </li>
            <li>
              <Icon name="repeat" />
              <h3>Run both side by side</h3>
              <p>Bookings already made stay in your old app. New ones come to Clientele. Cancel the old one when you&apos;re ready.</p>
            </li>
          </ol>
          <Link href="/switch" className="hm-button hm-button-ghost">
            Read the switching guide
          </Link>
        </section>

        {/* ---------- Pricing ---------- */}
        <section id="pricing" className="hm-section">
          <p className="hm-kicker">Pricing</p>
          <h2>One plan. Everything included.</h2>
          <p className="hm-section-lede">
            {price(allin.monthlyCents)}/mo for everything, or yearly and get 2 months free. {TRIAL_DAYS}-day free
            trial, no card needed, cancel any time.
          </p>
          <PricingToggle
            allin={allin}
            team={team}
            assistant={assistant}
            trialDays={TRIAL_DAYS}
            included={[...new Set([...included, ...NO_EXTRA])]}
            assistantOn={Boolean(process.env.ANTHROPIC_API_KEY)}
          />
          <div className="hm-never">
            <h3>And never</h3>
            <ul className="hm-noextra-list is-never">
              {NEVER.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <p className="hm-fine">
            Deposits: {DEPOSIT_FEE_PERCENT}% + {DEPOSIT_FEE_FIXED_CENTS}¢ per deposit, which covers card processing.
          </p>
        </section>

        {/* ---------- Final call ---------- */}
        <section className="hm-final">
          <h2>
            Give your regulars <em>first pick.</em>
          </h2>
          <p>Set up in minutes. {TRIAL_DAYS} days free, no card.</p>
          <div className="hm-cta-row hm-cta-center">
            <Link href="/signup" className="hm-button">
              Start free trial
            </Link>
            <Link href="/switch" className="hm-button hm-button-ghost">
              Switching? Start here
            </Link>
          </div>
        </section>
      </main>

      <footer className="hm-footer">
        <span className="hm-logo hm-logo-small">{BRAND_NAME}</span>
        <nav aria-label="Footer">
          <Link href="/switch">Switch to {BRAND_NAME}</Link>
          <Link href={account.href}>{account.label}</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/privacy">Privacy</Link>
          <a href="mailto:hello@clientelesuite.com">Contact · hello@clientelesuite.com</a>
        </nav>
        <p>© {new Date().getFullYear()} {BRAND_NAME}</p>
      </footer>
    </>
  );
}
