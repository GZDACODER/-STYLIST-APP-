import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { BRAND_NAME } from "@/lib/brand";
import { DEPOSIT_FEE_FIXED_CENTS, DEPOSIT_FEE_PERCENT, PLANS, TRIAL_DAYS } from "@/lib/plans";
import { formatPrice } from "@/lib/money";
import RegularStar from "@/components/RegularStar";

const TITLE = `${BRAND_NAME} — Booking for Hair Stylists`;
const DESCRIPTION =
  "Luxury booking that puts your regulars first. Deposits, waitlist and regulars-only times.";

export const metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: { title: TITLE, description: DESCRIPTION, siteName: BRAND_NAME, type: "website", url: "/" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

// Dollars without cents when they're whole ($15, not $15.00).
const price = (cents) => formatPrice(cents).replace(/\.00$/, "");

const STEPS = [
  {
    title: "Open your times",
    text: "Post the times you want to fill. Mark some \"Regulars only\", and your best clients see them before anyone else.",
  },
  {
    title: "Share your link",
    text: "One booking page with your name, cover photo, Instagram and location. Clients book in a minute, with no app and no password.",
  },
  {
    title: "Get booked",
    text: "Deposits protect your time. When someone cancels, your waitlist hears first, and the first to claim the time gets it.",
  },
];

const FEATURES = [
  {
    star: true,
    title: "Regulars First",
    text: "Hold times for your regulars, switch to regulars-only when you're full, and send one-time invite links to new clients you want to take on.",
  },
  {
    title: "A waitlist that fills cancellations",
    text: "Clients choose the days and times they'd like. When a time opens, they get a \"Claim this time\" email. Regulars hear first.",
  },
  {
    title: "Deposits, paid to you",
    text: "Set a dollar amount or a percent per service. Clients pay on Stripe before the time is theirs, and it goes straight to your account.",
  },
  {
    title: "A booking page that looks like you",
    text: "Your business name in script over your own cover photo, with your Instagram and location one tap away.",
  },
  {
    title: "Clients, sorted",
    text: "Every client is Regular, New or Blocked. Regulars can be made automatically after a number of visits you choose.",
  },
  {
    title: "Nothing to download",
    text: "Clients confirm with a code sent to their email. You run everything from your phone, iPad or computer.",
  },
];

const FAQ = [
  {
    q: "Do my clients need an app or an account?",
    a: "No. They open your link, pick a time and confirm with a code we email them. That's it.",
  },
  {
    q: "What happens after the free trial?",
    a: `You get ${TRIAL_DAYS} days with everything switched on and no card needed. Before it ends, choose a plan. If you don't, your bookings and clients are kept and you can pick a plan any time.`,
  },
  {
    q: "Can I change plans or cancel?",
    a: "Yes, any time, from Settings. If you cancel, your plan runs to the end of the period you've paid for.",
  },
  {
    q: "How do deposits work?",
    a: `You connect your own Stripe account and choose a deposit per service. Clients pay it before the booking is confirmed, and Stripe pays you out. Clientele keeps ${DEPOSIT_FEE_PERCENT}% + ${DEPOSIT_FEE_FIXED_CENTS}¢ of each deposit to cover card costs.`,
  },
  {
    q: "What makes someone a Regular?",
    a: "You decide. Mark clients as Regulars yourself, or let Clientele do it after a number of visits you pick. Regulars are recognised by their phone number.",
  },
];

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const base = PLANS.base;
  const bundle = PLANS.bundle;
  const addOns = [PLANS.regulars, PLANS.waitlist];

  return (
    <>
      <header className="hm-nav">
        <Link href="/" className="hm-logo" aria-label={`${BRAND_NAME} home`}>
          {BRAND_NAME}
        </Link>
        <nav className="hm-nav-links" aria-label="Main">
          <a href="#how">How it works</a>
          <a href="#pricing">Pricing</a>
          {user ? (
            <Link href="/dashboard" className="hm-button hm-button-small">
              Your dashboard
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
      </header>

      <main>
        {/* ---------- Hero ---------- */}
        <section className="hm-hero">
          <div className="hm-hero-copy">
            <p className="hm-kicker">Booking for hair stylists</p>
            <h1>Your regulars come first.</h1>
            <p className="hm-lede">
              {BRAND_NAME} is online booking that gives your loyal clients first pick of your time,
              fills cancellations from a waitlist, and takes deposits so no-shows cost you less.
            </p>
            <div className="hm-cta-row">
              <Link href={user ? "/dashboard" : "/signup"} className="hm-button">
                {user ? "Go to your dashboard" : "Start your free trial"}
              </Link>
              <a href="#pricing" className="hm-link">
                See pricing
              </a>
            </div>
            <p className="hm-fine">
              {TRIAL_DAYS} days free, everything included. No card needed.
            </p>
          </div>

          {/* A small picture of a stylist's booking page. */}
          <div className="hm-preview" aria-hidden="true">
            <div className="hm-preview-panel">
              <span className="hm-preview-name">Studio Noir</span>
            </div>
            <div className="hm-preview-body">
              <p className="hm-preview-label">Thursday, Nov 12</p>
              <div className="hm-preview-times">
                <span>9:00 AM</span>
                <span className="is-regular">
                  10:30 AM <RegularStar label={null} size={10} />
                </span>
                <span className="is-picked">1:00 PM</span>
                <span className="is-regular">
                  3:30 PM <RegularStar label={null} size={10} />
                </span>
              </div>
              <p className="hm-preview-note">
                <RegularStar label={null} size={10} /> Regulars only
              </p>
              <span className="hm-preview-button">Book · $20 deposit</span>
            </div>
          </div>
        </section>

        {/* ---------- How it works ---------- */}
        <section id="how" className="hm-section">
          <p className="hm-kicker">How it works</p>
          <h2>Three steps to a fuller book.</h2>
          <ol className="hm-steps">
            {STEPS.map((step, i) => (
              <li key={step.title}>
                <span className="hm-step-num">0{i + 1}</span>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* ---------- Features ---------- */}
        <section className="hm-section">
          <p className="hm-kicker">What you get</p>
          <h2>Made for stylists with a loyal book.</h2>
          <ul className="hm-features">
            {FEATURES.map((f) => (
              <li key={f.title}>
                <h3>
                  {f.star && (
                    <>
                      <RegularStar label={null} size={13} />{" "}
                    </>
                  )}
                  {f.title}
                </h3>
                <p>{f.text}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* ---------- Pricing ---------- */}
        <section id="pricing" className="hm-section">
          <p className="hm-kicker">Pricing</p>
          <h2>Pay for what you use.</h2>
          <p className="hm-section-lede">
            Start with {base.name}, add what you need, or take everything with All-in. Pay yearly
            and get 2 months free.
          </p>

          <div className="hm-plans">
            <div className="hm-plan">
              <h3>{base.name}</h3>
              <p className="hm-price">
                {price(base.monthlyCents)}
                <span>/month</span>
              </p>
              <p className="hm-plan-year">or {price(base.yearlyCents)}/year</p>
              <p>{base.description}</p>
              <div className="hm-addons">
                <p className="hm-addons-title">Add-ons</p>
                {addOns.map((a) => (
                  <p key={a.key} className="hm-addon">
                    <span>{a.name}</span>
                    <span>+{price(a.monthlyCents)}/mo</span>
                  </p>
                ))}
              </div>
            </div>

            <div className="hm-plan hm-plan-featured">
              <p className="hm-plan-badge">Best value</p>
              <h3>{bundle.name}</h3>
              <p className="hm-price">
                {price(bundle.monthlyCents)}
                <span>/month</span>
              </p>
              <p className="hm-plan-year">or {price(bundle.yearlyCents)}/year</p>
              <p>
                Everything: {base.name}, Regulars First and Waitlist. Save{" "}
                {price(
                  base.monthlyCents + PLANS.regulars.monthlyCents + PLANS.waitlist.monthlyCents -
                    bundle.monthlyCents
                )}{" "}
                a month on buying them separately.
              </p>
            </div>
          </div>

          <p className="hm-fine hm-center">
            Every plan starts with a {TRIAL_DAYS}-day free trial. Deposits:{" "}
            {DEPOSIT_FEE_PERCENT}% + {DEPOSIT_FEE_FIXED_CENTS}¢ per deposit, which covers card
            processing.
          </p>
          <div className="hm-center">
            <Link href={user ? "/dashboard/settings#plan" : "/signup"} className="hm-button">
              {user ? "Choose your plan" : "Start your free trial"}
            </Link>
          </div>
        </section>

        {/* ---------- FAQ ---------- */}
        <section className="hm-section hm-faq">
          <p className="hm-kicker">Questions</p>
          <h2>Good to know.</h2>
          {FAQ.map((item) => (
            <details key={item.q}>
              <summary>{item.q}</summary>
              <p>{item.a}</p>
            </details>
          ))}
        </section>

        {/* ---------- Final call ---------- */}
        <section className="hm-final">
          <h2>Give your regulars first pick.</h2>
          <p>Set up in minutes. {TRIAL_DAYS} days free.</p>
          <Link href={user ? "/dashboard" : "/signup"} className="hm-button hm-button-light">
            {user ? "Go to your dashboard" : "Start your free trial"}
          </Link>
        </section>
      </main>

      <footer className="hm-footer">
        <span className="hm-logo hm-logo-small">{BRAND_NAME}</span>
        <nav aria-label="Footer">
          <Link href="/login">Log in</Link>
          <Link href="/signup">Sign up</Link>
          <a href="mailto:hello@clientelesuite.com">hello@clientelesuite.com</a>
        </nav>
        <p>© {new Date().getFullYear()} {BRAND_NAME}</p>
      </footer>
    </>
  );
}
