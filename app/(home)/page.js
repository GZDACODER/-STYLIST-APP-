import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { BRAND_NAME } from "@/lib/brand";
import { DEPOSIT_FEE_FIXED_CENTS, DEPOSIT_FEE_PERCENT, PLANS, TRIAL_DAYS } from "@/lib/plans";
import { formatPrice } from "@/lib/money";
import HeroObject from "./HeroObject";
import FeatureTabs from "./FeatureTabs";
import PricingToggle from "./PricingToggle";
import Icon from "./Icon";
import { AVAILABLE_TYPES, COMING_SOON_TYPES } from "@/lib/businessTypes";
import { templateFor } from "@/lib/templates";
import TradeSwitcher from "./TradeSwitcher";

const TITLE = `${BRAND_NAME}: Run your whole business from one place.`;
const DESCRIPTION =
  "Booking, deposits, money, clients, reviews and insights in one app for hair stylists, barbers, tattoo artists and tutors. Your regulars come first. 14 days free, no card.";

export const metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: { title: TITLE, description: DESCRIPTION, siteName: BRAND_NAME, type: "website", url: "/" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

// Dollars without cents when they're whole ($15, not $15.00).
const price = (cents) => formatPrice(cents).replace(/\.00$/, "");


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
  "Money tracking and exports",
  "Insights",
  "Public profile and reviews",
  "Gift cards",
  "Opening alerts for followers",
  "Calendar events and holidays",
  "Client import and export",
  "Help switching from another app",
];

// The trade switcher's content: words and example services come from the
// real templates; the highlights are written for each trade.
const TRADES = [
  {
    key: "stylist",
    demo: "hair",
    title: "For hair stylists",
    points: ["Regulars-only times for your best clients", "Deposits on long services like braids", "Aftercare tips emailed after every visit", "Share their look and color formula"],
  },
  {
    key: "barber",
    demo: "barber",
    title: "For barbers",
    points: ["Standing every-2-weeks cuts, held for your regulars", "Book my usual: their cut in one tap", "Cash and tips tracked in Money", "Deposits that stop no-shows"],
  },
  {
    key: "tattoo",
    demo: "tattoo",
    title: "For tattoo artists",
    points: ["Request first: idea, placement and reference photos", "A deposit on every session", "Consent waiver with an age check, signed on their phone", "Healing aftercare emailed after each session"],
  },
  {
    key: "tutor",
    demo: "tutor",
    title: "For tutors",
    points: ["Students and sessions, not clients and appointments", "Weekly standing sessions", "An intake form for goals and grade level", "Reminders so nobody forgets a session"],
  },
].map((t) => {
  const tpl = templateFor(t.key === "stylist" ? "hair" : t.key);
  return {
    ...t,
    label: tpl.label,
    blurb: tpl.blurb,
    words: { services: tpl.words.services || "services", clients: tpl.words.clients || "clients", appointment: tpl.words.appointment || "appointment" },
    services: (tpl.presets.services || []).slice(0, 4).map((x) => ({ name: x.name, price: x.price_cents ? price(x.price_cents) : "Free" })),
  };
});

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
          <a href="#trades" className="hm-hide-phone">
            Your trade
          </a>
          <a href="#pricing" className="hm-hide-phone">
            Pricing
          </a>
          {/* Clients looking for their pro (search: /find). */}
          <Link href="/find" className="hm-find-link" aria-label="Find your pro">
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="10.5" cy="10.5" r="6.5" />
              <path d="M15.5 15.5 20 20" />
            </svg>
            <span>Find your pro</span>
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
        <section className="hm-hero">
          <div className="hm-hero-copy">
            <p className="hm-kicker">Booking and business tools for independent pros</p>
            <h1>
              Run your whole business from one place. <em>Your regulars come first.</em>
            </h1>
            <p className="hm-lede">
              Bookings, deposits, money, clients, reviews and insights in one app, for hair stylists, barbers,
              tattoo artists and tutors.
            </p>
            <div className="hm-cta-row">
              <Link href="/signup" className="hm-button">
                Start free trial
              </Link>
              <a href="/demo" className="hm-button hm-button-ghost">
                Try the live demo
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
            {AVAILABLE_TYPES.map((t) => (
              <li key={t.value}>{t.label}</li>
            ))}
          </ul>
          <p className="hm-soon">
            <span className="hm-soon-tag">Coming soon</span> {COMING_SOON_TYPES.map((t) => t.label).join(" · ")}
          </p>
        </section>

        {/* ---------- Features (one tab at a time) ---------- */}
        <section id="features" className="hm-section">
          <p className="hm-kicker">One app, six jobs</p>
          <h2>
            Everything behind the chair, <em>handled.</em>
          </h2>
          <p className="hm-section-lede">Booking, regulars, money, clients, getting found and insights. One plan, no add-on fees.</p>
          <FeatureTabs />
        </section>

        {/* ---------- Made for your trade ---------- */}
        <section id="trades" className="hm-section">
          <p className="hm-kicker">Made for your trade</p>
          <h2>Your words, your services, your way of working.</h2>
          <p className="hm-section-lede">
            Pick your trade when you sign up and Clientele sets itself up for it. Switch any time without losing anything.
          </p>
          <TradeSwitcher trades={TRADES} />
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
            Your whole business, <em>one place.</em>
          </h2>
          <p>Set up in minutes. {TRIAL_DAYS} days free, no card.</p>
          <div className="hm-cta-row hm-cta-center">
            <Link href="/signup" className="hm-button">
              Start free trial
            </Link>
            <a href="/demo" className="hm-button hm-button-ghost">
              Try the live demo
            </a>
          </div>
          <p className="hm-fine">
            Switching from another app? <Link href="/switch">Here&apos;s how</Link>.
          </p>
        </section>
      </main>

      <footer className="hm-footer">
        <span className="hm-logo hm-logo-small">{BRAND_NAME}</span>
        <nav aria-label="Footer">
          <Link href="/find">Find your pro</Link>
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
