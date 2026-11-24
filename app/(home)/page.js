import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { BRAND_NAME } from "@/lib/brand";
import { DEPOSIT_FEE_FIXED_CENTS, DEPOSIT_FEE_PERCENT, PLANS, TRIAL_DAYS } from "@/lib/plans";
import { formatPrice } from "@/lib/money";
import FeatureTabs from "./FeatureTabs";
import PricingToggle from "./PricingToggle";
import Icon from "./Icon";
import TrialCta from "./TrialCta";
import { DeskShot, PhoneShot } from "./Shots";
import "./landing.css";
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

// Real quotes from Clientele pros, shown in the social proof row. Add one
// only with the pro's permission: { quote, name, trade, city }. The row of
// facts shows either way; quotes show once there's at least one.
const TESTIMONIALS = [];

// What's always true, for the social proof row.
const FACTS = [
  { value: "$0", label: "Booking fees charged to your clients" },
  { value: `${TRIAL_DAYS} days`, label: "Free to try. No card needed" },
  { value: "1 plan", label: "Every feature included" },
  { value: "Your Stripe", label: "Deposits paid straight to your own account" },
];

const FAQ = [
  {
    q: "Do my clients need to download an app?",
    a: "No. They book from your link in any browser, pay a deposit if you ask for one, and can reschedule or cancel from their confirmation email.",
  },
  {
    q: "How does the free trial work?",
    a: `You get every feature for ${TRIAL_DAYS} days with no card. Choose your plan before it ends to keep going; if you don't, nothing is charged.`,
  },
  {
    q: "What does it cost to take deposits?",
    a: `${DEPOSIT_FEE_PERCENT}% + ${DEPOSIT_FEE_FIXED_CENTS}¢ per deposit, which covers card processing. Deposits go straight to your own Stripe account.`,
  },
  {
    q: "Can I bring my clients from Booksy, GlossGenius or Square?",
    a: "Yes. Export a spreadsheet from your old app and import it in a few taps, or email us the file and we'll import it for you. Keep your old app until you're ready.",
  },
  {
    q: "What are Regulars?",
    a: "The clients who keep your book full. You can give them times nobody else sees, standing appointments held months ahead, and first pick of new openings.",
  },
  {
    q: "Can I cancel any time?",
    a: "Yes, from Settings, with no fees. You can download all your clients, bookings and payments first.",
  },
  {
    q: "Does it work for my team?",
    a: `Yes. Add team members for ${price(PLANS.team.monthlyCents)}/mo each, half the price of the plan.`,
  },
];

const SWITCH_FROM = ["Booksy", "GlossGenius", "Square", "Vagaro", "Acuity", "A paper book"];

export default async function HomePage() {
  // The homepage stays the homepage when logged in; the top button says
  // "View dashboard" instead of "Log in".
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const account = user ? { href: "/dashboard", label: "View dashboard" } : { href: "/login", label: "Log in" };

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
  const navLinks = [
    ["#features", "Features"],
    ["#trades", "Your trade"],
    ["#pricing", "Pricing"],
  ];

  return (
    <div className="ln">
      {/* ---------- Top nav: frosted and sticky ---------- */}
      <header className="ln-nav">
        <div className="ln-nav-inner">
          <Link href="/" className="ln-logo" aria-label={`${BRAND_NAME} home`}>
            {BRAND_NAME}
          </Link>
          <nav className="ln-nav-links" aria-label="Main">
            {navLinks.map(([href, label]) => (
              <a key={href} href={href}>
                {label}
              </a>
            ))}
            <Link href="/find" className="ln-find">
              <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="10.5" cy="10.5" r="6.5" />
                <path d="M15.5 15.5 20 20" />
              </svg>
              Find your pro
            </Link>
          </nav>
          <div className="ln-nav-end">
            <Link href={account.href} className="ln-login">
              {account.label}
            </Link>
            {!user && <TrialCta small />}
            {/* Phones: the section links and Find your pro in a small menu. */}
            <details className="ln-menu">
              <summary aria-label="Menu">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
                  <path d="M4 7h16M4 12h16M4 17h16" />
                </svg>
              </summary>
              <div className="ln-menu-sheet">
                {navLinks.map(([href, label]) => (
                  <a key={href} href={href}>
                    {label}
                  </a>
                ))}
                <Link href="/find">Find your pro</Link>
                <Link href={account.href}>{account.label}</Link>
              </div>
            </details>
          </div>
        </div>
      </header>

      <main>
        {/* ---------- Hero ---------- */}
        <section className="ln-hero ln-wrap">
          <div className="ln-hero-copy">
            <p className="ln-eyebrow">Booking and business tools for independent pros</p>
            <h1>
              Run your whole business from one place. <em>Your regulars come first.</em>
            </h1>
            <p className="ln-lede">
              Bookings, deposits, money, clients, reviews and insights in one app, for hair stylists, barbers, tattoo
              artists and tutors.
            </p>
            <div className="ln-cta-row">
              <TrialCta />
              <a href="/demo" className="ln-btn ln-btn-ghost">
                Try the live demo
              </a>
            </div>
            <p className="ln-fine">{TRIAL_DAYS} days free. No card needed.</p>
          </div>
          <div className="ln-hero-visual">
            <div className="ln-hero-desk">
              <DeskShot
                src="dash-home"
                priority
                hideOnPhones
                alt="The Clientele dashboard: a good-morning greeting, the next three appointments, what needs attention, and this week's numbers"
              />
            </div>
            <div className="ln-hero-phone">
              <PhoneShot
                src="dash-today-phone"
                height={1208}
                priority
                alt="Today in Clientele on a phone: the date, three appointments today and the next one up"
              />
            </div>
          </div>
        </section>

        {/* ---------- Trade strip ---------- */}
        <section className="ln-strip ln-wrap" aria-label="Who it's for">
          <span className="ln-strip-label">Made for</span>
          <ul>
            {AVAILABLE_TYPES.map((t) => (
              <li key={t.value}>{t.label}</li>
            ))}
          </ul>
          {COMING_SOON_TYPES.length > 0 && (
            <p className="ln-soon">
              <span>Coming soon</span> {COMING_SOON_TYPES.map((t) => t.label).join(" · ")}
            </p>
          )}
        </section>

        {/* ---------- Social proof ---------- */}
        <section className="ln-proof ln-wrap" aria-label="Why pros choose Clientele">
          <div className="ln-facts">
            {FACTS.map((f) => (
              <div key={f.label} className="ln-card ln-fact">
                <strong>{f.value}</strong>
                <span>{f.label}</span>
              </div>
            ))}
          </div>
          {TESTIMONIALS.length > 0 && (
            <div className="ln-quotes">
              {TESTIMONIALS.map((t) => (
                <figure key={t.name} className="ln-card ln-quote">
                  <blockquote>&ldquo;{t.quote}&rdquo;</blockquote>
                  <figcaption>
                    <strong>{t.name}</strong> · {t.trade}
                    {t.city ? `, ${t.city}` : ""}
                  </figcaption>
                </figure>
              ))}
            </div>
          )}
        </section>

        {/* ---------- Features (one tab at a time) ---------- */}
        <section id="features" className="ln-section ln-wrap">
          <header className="ln-head">
            <p className="ln-eyebrow">One app, six jobs</p>
            <h2>
              Everything behind the chair, <em>handled.</em>
            </h2>
            <p className="ln-lede">Booking, regulars, money, clients, getting found and insights. One plan, no add-on fees.</p>
          </header>
          <FeatureTabs />
        </section>

        {/* ---------- Made for your trade ---------- */}
        <section id="trades" className="ln-section ln-wrap">
          <header className="ln-head">
            <p className="ln-eyebrow">Made for your trade</p>
            <h2>Your words, your services, your way of working.</h2>
            <p className="ln-lede">
              Pick your trade when you sign up and Clientele sets itself up for it. Switch any time without losing anything.
            </p>
          </header>
          <TradeSwitcher trades={TRADES} />
        </section>

        {/* ---------- Switching ---------- */}
        <section id="switching" className="ln-section ln-wrap">
          <header className="ln-head">
            <p className="ln-eyebrow">Make the switch</p>
            <h2>Switching from Booksy, GlossGenius or Square?</h2>
            <p className="ln-lede">Moving over takes an afternoon. Bring your clients, keep your old app until you&apos;re ready, and let us help.</p>
          </header>
          <ul className="ln-from" aria-label="Pros switch from">
            {SWITCH_FROM.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
          <ol className="ln-steps">
            <li className="ln-card">
              <span className="ln-step-n">1</span>
              <Icon name="swap" />
              <h3>Import your client list</h3>
              <p>Export a spreadsheet from your old app and import it in a few taps. Names, phones, emails and notes come over.</p>
            </li>
            <li className="ln-card">
              <span className="ln-step-n">2</span>
              <Icon name="link" />
              <h3>We&apos;ll help you move</h3>
              <p>Can&apos;t find the export, or want it done for you? Email us the file and we&apos;ll import it.</p>
            </li>
            <li className="ln-card">
              <span className="ln-step-n">3</span>
              <Icon name="repeat" />
              <h3>Run both side by side</h3>
              <p>Bookings already made stay in your old app. New ones come to Clientele. Cancel the old one when you&apos;re ready.</p>
            </li>
          </ol>
          <div className="ln-center">
            <Link href="/switch" className="ln-btn ln-btn-ghost">
              Read the switching guide
            </Link>
          </div>
        </section>

        {/* ---------- Pricing ---------- */}
        <section id="pricing" className="ln-section ln-wrap">
          <header className="ln-head">
            <p className="ln-eyebrow">Pricing</p>
            <h2>One plan. Everything included.</h2>
            <p className="ln-lede">
              {price(allin.monthlyCents)}/mo for everything, or yearly and get 2 months free. {TRIAL_DAYS}-day free trial, no
              card needed, cancel any time.
            </p>
          </header>
          <PricingToggle
            allin={allin}
            team={team}
            assistant={assistant}
            trialDays={TRIAL_DAYS}
            included={[...new Set([...included, ...NO_EXTRA])]}
            assistantOn={Boolean(process.env.ANTHROPIC_API_KEY)}
          />
          <div className="ln-never">
            <h3>And never</h3>
            <ul>
              {NEVER.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </section>

        {/* ---------- FAQ ---------- */}
        <section id="faq" className="ln-section ln-wrap ln-faq-wrap">
          <header className="ln-head">
            <p className="ln-eyebrow">Questions</p>
            <h2>Good to know.</h2>
          </header>
          <div className="ln-faq">
            {FAQ.map((f) => (
              <details key={f.q} className="ln-faq-item">
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* ---------- Final call ---------- */}
        <section className="ln-wrap">
          <div className="ln-card ln-final">
            <h2>
              Your whole business, <em>one place.</em>
            </h2>
            <p className="ln-lede">Set up in minutes. {TRIAL_DAYS} days free, no card.</p>
            <div className="ln-cta-row ln-center">
              <TrialCta />
              <a href="/demo" className="ln-btn ln-btn-ghost">
                Try the live demo
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className="ln-footer">
        <div className="ln-wrap ln-footer-grid">
          <div>
            <span className="ln-logo">{BRAND_NAME}</span>
            <p className="ln-muted">Booking and business tools for independent pros.</p>
          </div>
          <nav aria-label="Product">
            <h3>Product</h3>
            <a href="#features">Features</a>
            <a href="#pricing">Pricing</a>
            <a href="/demo">Live demo</a>
            <Link href="/switch">Switch to {BRAND_NAME}</Link>
          </nav>
          <nav aria-label="For clients">
            <h3>For clients</h3>
            <Link href="/find">Find your pro</Link>
            <Link href="/client">Client sign in</Link>
          </nav>
          <nav aria-label="Company">
            <h3>Company</h3>
            <Link href={account.href}>{account.label}</Link>
            <Link href="/terms">Terms</Link>
            <Link href="/privacy">Privacy</Link>
            <a href="mailto:hello@clientelesuite.com">hello@clientelesuite.com</a>
          </nav>
        </div>
        <p className="ln-wrap ln-copy">
          © {new Date().getFullYear()} {BRAND_NAME}
        </p>
      </footer>
    </div>
  );
}
