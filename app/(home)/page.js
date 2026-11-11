import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BRAND_NAME } from "@/lib/brand";
import { DEPOSIT_FEE_FIXED_CENTS, DEPOSIT_FEE_PERCENT, PLANS, TRIAL_DAYS } from "@/lib/plans";
import { formatPrice } from "@/lib/money";
import RegularStar from "@/components/RegularStar";
import HeroObject from "./HeroObject";
import Switching from "./Switching";
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

// Standing appointments: the next few held visits, for the picture.
const STANDING_DATES = [
  ["Tue, Dec 1", "10:00 AM"],
  ["Tue, Dec 29", "10:00 AM"],
  ["Tue, Jan 26", "10:00 AM"],
  ["Tue, Feb 23", "10:00 AM"],
];

const STANDING_POINTS = [
  "Every 2 to 12 weeks, on their usual day and time.",
  "The next 3 months are held, and it keeps rolling forward.",
  "Held times never show as open to anyone else.",
  "Skip or move one date without touching the rest.",
  "No deposit, or a deposit each visit. Your choice for each regular.",
];

// Runs your day for you.
const RUNS = [
  {
    icon: "bell",
    title: "Confirmations and reminders",
    text: "Every client gets a confirmation and a reminder 24 hours before, with a one-tap Cancel this visit. The time opens up again for your waitlist.",
  },
  {
    icon: "wrapup",
    title: "The 8 PM wrap-up",
    text: "One email at the end of the day: mark each visit kept, no-show or someone else came. Balances owed get flagged until they're paid.",
  },
  {
    icon: "chart",
    title: "Your Monday summary",
    text: "Last week's visits, what you booked, deposits, no-shows and waitlist fills, plus what's on this week.",
  },
  {
    icon: "card",
    title: "Client history",
    text: "Every client card shows their visits, what they've spent, cancellations, no-shows and when they last came in.",
  },
  {
    icon: "swap",
    title: "Import and export",
    text: "Bring your list over from another app with a CSV file, and download it again any time. Your clients stay yours.",
  },
];

const REGULARS = [
  {
    title: "Regulars-only times",
    text: "Mark any opening “Regulars only”. Everyone else never sees it, so your best clients always have somewhere to land.",
  },
  {
    title: "Early access",
    text: "New openings go to your regulars first. When the book is full, switch the whole page to regulars-only with one tap.",
  },
  {
    title: "Invite links",
    text: "Taking on someone new? Send a private link that lets just that person book once, even when you’re regulars-only.",
  },
];

export default async function HomePage() {
  // Stylists who are logged in go straight to their dashboard.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");

  const { base, regulars, waitlist, bundle } = PLANS;
  const tiers = [
    {
      name: base.name,
      amount: price(base.monthlyCents),
      unit: "/mo",
      text: "Your booking page, deposits, reminders, the end-of-day wrap-up, the Monday summary and client history.",
    },
    {
      name: regulars.name,
      amount: `+${price(regulars.monthlyCents)}`,
      unit: "/mo",
      text: "Regulars-only times, regulars-only mode, invite links and standing appointments.",
    },
    {
      name: waitlist.name,
      amount: `+${price(waitlist.monthlyCents)}`,
      unit: "/mo",
      text: "A waitlist that emails clients the moment a time opens. Regulars hear first.",
    },
    {
      name: bundle.name,
      amount: price(bundle.monthlyCents),
      unit: "/mo",
      text: "Everything above, for less than buying it separately.",
      featured: true,
    },
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
          <Link href="/login">Log in</Link>
          <Link href="/signup" className="hm-button hm-button-small">
            Start free trial
          </Link>
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

        {/* ---------- 1. Regulars First ---------- */}
        <section id="features" className="hm-section">
          <p className="hm-kicker">01 · Regulars First</p>
          <h2>Your best clients never fight for a spot.</h2>
          <p className="hm-section-lede">
            The clients who keep your book full get first pick of your time. Everyone else books
            what&apos;s left.
          </p>
          <ul className="hm-cards">
            {REGULARS.map((f) => (
              <li key={f.title}>
                <RegularStar label={null} size={14} />
                <h3>{f.title}</h3>
                <p>{f.text}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* ---------- 2. Standing appointments ---------- */}
        <section id="standing" className="hm-section hm-standing">
          <div>
            <p className="hm-kicker">02 · Standing appointments</p>
            <h2>
              Their usual time, <em>held for them.</em>
            </h2>
            <p className="hm-section-lede">
              Your regulars come back every few weeks. Set it once on their client card, and their
              visits are booked months ahead. Part of Regulars First.
            </p>
            <ul className="hm-points">
              {STANDING_POINTS.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          </div>

          {/* A held series, drawn in code. */}
          <div className="hm-ledger" aria-hidden="true">
            <div className="hm-ledger-head">
              <span className="hm-ledger-name">Jasmine R.</span>
              <span className="hm-ledger-repeat">Every 4 weeks · Tuesday</span>
            </div>
            <ul>
              {STANDING_DATES.map(([date, time]) => (
                <li key={date}>
                  <span>{date}</span>
                  <span className="hm-ledger-time">{time}</span>
                  <span className="hm-ledger-tag">Standing</span>
                </li>
              ))}
            </ul>
            <p className="hm-ledger-foot">Held · rolls forward every week</p>
          </div>
        </section>

        {/* ---------- 3. No more no-shows ---------- */}
        <section className="hm-section">
          <p className="hm-kicker">03 · No more no-shows</p>
          <h2>Deposits up front. Cancellations filled for you.</h2>
          <div className="hm-split">
            <div className="hm-split-item">
              <h3>Deposits, paid to you</h3>
              <p>
                Set a dollar amount or a percent for each service. Clients pay before the time is
                theirs, and it goes straight to your own Stripe account.
              </p>
              <div className="hm-mini" aria-hidden="true">
                <span>Signature session · Thu 10:30 AM</span>
                <strong>$20 deposit paid</strong>
              </div>
            </div>
            <div className="hm-split-item">
              <h3>A waitlist that fills the gap</h3>
              <p>
                Clients choose the days and times they want. When someone cancels, the waitlist is
                emailed straight away, and the first to claim the time gets it.
              </p>
              <div className="hm-mini" aria-hidden="true">
                <span>A time just opened · Fri 2:00 PM</span>
                <strong>Claim this time</strong>
              </div>
            </div>
          </div>
        </section>

        {/* ---------- 4. Runs your day ---------- */}
        <section className="hm-section">
          <p className="hm-kicker">04 · Runs your day for you</p>
          <h2>The admin, handled.</h2>
          <p className="hm-section-lede">
            The reminders, the follow-up and the numbers happen on their own, so your time goes to
            your clients.
          </p>
          <ul className="hm-runs">
            {RUNS.map((r) => (
              <li key={r.title}>
                <Icon name={r.icon} />
                <h3>{r.title}</h3>
                <p>{r.text}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* ---------- 5. Your brand ---------- */}
        <section className="hm-section hm-brand">
          <div className="hm-brand-copy">
            <p className="hm-kicker">05 · Your brand, not ours</p>
            <h2>A booking page that looks like you.</h2>
            <p className="hm-section-lede">
              Your name in script over your own cover photo, with your Instagram and location one
              tap away. No marketplace, no other businesses on the page, no app for clients to
              download.
            </p>
          </div>

          {/* A booking page, drawn in code (the "photo" is a gradient). */}
          <div className="hm-phone" aria-hidden="true">
            <div className="hm-phone-cover">
              <span className="hm-phone-name">Royalty Studio</span>
              <span className="hm-phone-rule" />
              <span className="hm-phone-meta">Chicago · @royaltystudio</span>
            </div>
            <div className="hm-phone-body">
              <p className="hm-phone-label">Signature session · 60 min · $80</p>
              <p className="hm-phone-label hm-phone-day">Thursday, Nov 12</p>
              <div className="hm-phone-times">
                <span>9:00 AM</span>
                <span className="is-regular">
                  10:30 AM <RegularStar label={null} size={9} />
                </span>
                <span className="is-picked">1:00 PM</span>
                <span>3:30 PM</span>
              </div>
              <span className="hm-phone-button">Book · $20 deposit</span>
            </div>
          </div>
        </section>

        {/* ---------- Switching from another app? ---------- */}
        <Switching />

        {/* ---------- 6. Pricing ---------- */}
        <section id="pricing" className="hm-section">
          <p className="hm-kicker">06 · Pricing</p>
          <h2>Simple monthly pricing.</h2>
          <p className="hm-section-lede">
            Start with {base.name} and add what you need, or take everything with {bundle.name}.
            Pay yearly and get 2 months free.
          </p>
          <ul className="hm-tiers">
            {tiers.map((t) => (
              <li key={t.name} className={t.featured ? "is-featured" : undefined}>
                {t.featured && <span className="hm-tier-badge">Best value</span>}
                <h3>{t.name}</h3>
                <p className="hm-price">
                  {t.amount}
                  <span>{t.unit}</span>
                </p>
                <p>{t.text}</p>
              </li>
            ))}
          </ul>
          <ul className="hm-promises">
            <li>{TRIAL_DAYS}-day free trial with everything on</li>
            <li>No card needed to start</li>
            <li>No marketplace cut on your clients</li>
          </ul>
          <p className="hm-fine">
            Deposits: {DEPOSIT_FEE_PERCENT}% + {DEPOSIT_FEE_FIXED_CENTS}¢ per deposit, which covers
            card processing. Cancel any time.
          </p>
        </section>

        {/* ---------- Final call ---------- */}
        <section className="hm-final">
          <h2>
            Give your regulars <em>first pick.</em>
          </h2>
          <p>Set up in minutes. {TRIAL_DAYS} days free, no card.</p>
          <Link href="/signup" className="hm-button">
            Start free trial
          </Link>
        </section>
      </main>

      <footer className="hm-footer">
        <span className="hm-logo hm-logo-small">{BRAND_NAME}</span>
        <nav aria-label="Footer">
          <Link href="/login">Log in</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/privacy">Privacy</Link>
          <a href="mailto:hello@clientelesuite.com">Contact · hello@clientelesuite.com</a>
        </nav>
        <p>© {new Date().getFullYear()} {BRAND_NAME}</p>
      </footer>
    </>
  );
}
