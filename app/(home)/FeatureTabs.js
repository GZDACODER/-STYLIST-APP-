"use client";

// Homepage feature explorer: one tab at a time instead of a long scroll.
// Each tab has a short pitch, three points and a small picture drawn in code.
import { useEffect, useRef, useState } from "react";
import RegularStar from "@/components/RegularStar";

// The six parts of the suite. Each: a short pitch, three points and a small
// picture drawn in code (no images, so the page stays fast).
const TABS = [
  {
    key: "booking",
    label: "Booking",
    title: "A booking page that looks like you.",
    text: "Your name, your work and your prices. Clients book, pay a deposit and manage their visit from one link. No app to download.",
    points: [
      "Deposits paid straight to your own Stripe account.",
      "A waitlist that fills cancellations for you.",
      "Booking rules: notice, breaks, start times, a daily limit.",
    ],
    visual: "page",
  },
  {
    key: "regulars",
    label: "Regulars first",
    title: "Your best clients never fight for a spot.",
    text: "The clients who keep your book full get first pick of your time. Everyone else books what's left.",
    points: [
      "Regulars-only times nobody else sees.",
      "Standing appointments held months ahead.",
      "New openings go to regulars first.",
    ],
    visual: "times",
  },
  {
    key: "money",
    label: "Money",
    title: "Every dollar in one place.",
    text: "What you earned by day, week, month or year, including cash, Zelle and Cash App. Balances owed, payouts and gift cards too.",
    points: [
      "Record tips and product sales in seconds.",
      "Friendly balance reminders, one tap.",
      "Spreadsheet and PDF downloads for tax time.",
    ],
    visual: "money",
  },
  {
    key: "clients",
    label: "Clients",
    title: "Remember everything about everyone.",
    text: "Notes on every visit, their look and formulas, intake forms and signed waivers, all on the client's card.",
    points: [
      "Signed waivers saved as PDFs.",
      "Share a photo of their look after the visit.",
      "Close out the day in a minute with wrap-ups.",
    ],
    visual: "wrapup",
  },
  {
    key: "found",
    label: "Get found",
    title: "A profile clients can find and share.",
    text: "Your work, reviews, prices and next open times on one page. Clients search for you by name and follow you for openings.",
    points: [
      "Reviews only from real visits, and you choose which show.",
      "'Notify me' emails followers when you open times.",
      "Made for your Instagram and TikTok bio.",
    ],
    visual: "profile",
  },
  {
    key: "insights",
    label: "Insights",
    title: "Know what's working.",
    text: "Rebooking, no-shows, your busiest and quietest times, top services and average ticket, compared with last month.",
    points: [
      "See who's overdue and invite them back in one tap.",
      "Spot quiet slots to fill with an offer.",
      "Plain numbers, no spreadsheets.",
    ],
    visual: "insights",
  },
];

function Visual({ kind }) {
  switch (kind) {
    case "times":
      return (
        <div className="hm-fx-card">
          <p className="hm-fx-label">Thursday · Signature session</p>
          <div className="hm-fx-times">
            <span>9:00 AM</span>
            <span className="is-regular">
              10:30 AM <RegularStar label={null} size={9} />
            </span>
            <span className="is-regular">
              12:00 PM <RegularStar label={null} size={9} />
            </span>
            <span className="is-picked">1:00 PM</span>
            <span>3:30 PM</span>
            <span className="is-gone">5:00 PM</span>
          </div>
          <p className="hm-fx-foot">
            <RegularStar label={null} size={9} /> Regulars only · hidden from everyone else
          </p>
        </div>
      );
    case "waitlist":
      return (
        <div className="hm-fx-card">
          <p className="hm-fx-label">A time just opened</p>
          <p className="hm-fx-big">Fri, 2:00 PM</p>
          <ul className="hm-fx-list">
            <li>
              <span>Maya J. · Regular</span>
              <em>Emailed first</em>
            </li>
            <li>
              <span>Priya S.</span>
              <em>Emailed 30 min later</em>
            </li>
          </ul>
          <span className="hm-fx-button">Claim this time</span>
        </div>
      );
    case "deposit":
      return (
        <div className="hm-fx-card">
          <p className="hm-fx-label">Signature service · Thu 10:30 AM</p>
          <p className="hm-fx-big">$20 deposit</p>
          <p className="hm-fx-paid">Paid · goes to your Stripe</p>
          <p className="hm-fx-foot">“Cancel within 24 hours and the deposit is kept.” ✓ Agreed</p>
        </div>
      );
    case "wrapup":
      return (
        <div className="hm-fx-card">
          <p className="hm-fx-label">Today · wrap up</p>
          <ul className="hm-fx-list">
            <li>
              <span>10:00 · Maya J.</span>
              <em className="ok">Paid in full</em>
            </li>
            <li>
              <span>1:00 · Ana R.</span>
              <em className="owed">$15 owed</em>
            </li>
            <li>
              <span>4:00 · Chris P.</span>
              <em className="no">No-show</em>
            </li>
          </ul>
        </div>
      );
    case "money":
      return (
        <div className="hm-fx-card">
          <p className="hm-fx-label">This week · earned</p>
          <p className="hm-fx-big">$1,840</p>
          <div className="hm-fx-bars" aria-hidden="true">
            {[40, 72, 55, 90, 64, 100, 20].map((h, i) => (
              <span key={i} style={{ height: `${h}%` }} />
            ))}
          </div>
          <ul className="hm-fx-list">
            <li>
              <span>Cash App · tip</span>
              <em className="ok">+$20</em>
            </li>
            <li>
              <span>Ana R. · balance</span>
              <em className="owed">$15 owed</em>
            </li>
          </ul>
        </div>
      );
    case "profile":
      return (
        <div className="hm-fx-card">
          <p className="hm-fx-label">clientelesuite.com/p/royaltystudio</p>
          <p className="hm-fx-big">
            Royalty Studio <span className="hm-fx-stars">★ 4.9</span>
          </p>
          <p className="hm-fx-quote">“So easy to book, and right on time. Already booked my next one.”</p>
          <p className="hm-fx-foot">Next open: Thu 10:30 AM · 128 following</p>
          <span className="hm-fx-button">Notify me of openings</span>
        </div>
      );
    case "insights":
      return (
        <div className="hm-fx-card">
          <p className="hm-fx-label">This month</p>
          <ul className="hm-fx-list">
            <li>
              <span>Rebooked</span>
              <em className="ok">78%</em>
            </li>
            <li>
              <span>No-shows</span>
              <em>3%</em>
            </li>
            <li>
              <span>Busiest</span>
              <em>Sat mornings</em>
            </li>
          </ul>
          <p className="hm-fx-foot">4 clients to invite back</p>
        </div>
      );
    case "assistant":
      return (
        <div className="hm-fx-card hm-fx-chat">
          <p className="hm-fx-bubble you">Block off Friday afternoon</p>
          <p className="hm-fx-bubble bot">Add “Blocked” Fri 12–5 PM with Block bookings on? Nobody is booked then.</p>
          <div className="hm-fx-confirm">
            <span className="hm-fx-button">Confirm</span>
            <span className="hm-fx-ghost">Cancel</span>
          </div>
        </div>
      );
    case "standing":
      return (
        <div className="hm-fx-card">
          <p className="hm-fx-label">Jasmine R. · every 4 weeks · Tuesday</p>
          <ul className="hm-fx-list">
            {["Tue, Dec 1", "Tue, Dec 29", "Tue, Jan 26", "Tue, Feb 23"].map((d) => (
              <li key={d}>
                <span>{d} · 10:00 AM</span>
                <em>Held</em>
              </li>
            ))}
          </ul>
        </div>
      );
    default:
      return (
        <div className="hm-fx-card hm-fx-page">
          <div className="hm-fx-cover">
            <span>Royalty Studio</span>
            <small>Chicago · @royaltystudio</small>
          </div>
          <div className="hm-fx-times">
            <span>9:00 AM</span>
            <span className="is-picked">1:00 PM</span>
            <span>3:30 PM</span>
          </div>
          <span className="hm-fx-button">Book · $20 deposit</span>
        </div>
      );
  }
}

export default function FeatureTabs() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const tabsRef = useRef(null);
  const tab = TABS[active];

  // Gently cycle through the tabs until someone picks one (not with
  // reduced motion).
  useEffect(() => {
    if (paused || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const t = setTimeout(() => setActive((i) => (i + 1) % TABS.length), 7000);
    return () => clearTimeout(t);
  }, [active, paused]);

  function pick(i) {
    setPaused(true);
    setActive(i);
  }

  return (
    <div className="hm-fx" onMouseEnter={() => setPaused(true)}>
      <div className="hm-fx-tabs" role="tablist" aria-label="Features" ref={tabsRef}>
        {TABS.map((t, i) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            id={`fx-tab-${t.key}`}
            aria-selected={i === active}
            aria-controls="fx-panel"
            className={i === active ? "hm-fx-tab active" : "hm-fx-tab"}
            onClick={() => pick(i)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="hm-fx-panel" role="tabpanel" id="fx-panel" aria-labelledby={`fx-tab-${tab.key}`} key={tab.key}>
        <div className="hm-fx-copy">
          <h3>{tab.title}</h3>
          <p>{tab.text}</p>
          <ul className="hm-points">
            {tab.points.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
        <div className="hm-fx-visual" aria-hidden="true">
          <Visual kind={tab.visual} />
        </div>
      </div>
    </div>
  );
}
