"use client";

// Homepage feature explorer: one tab at a time instead of a long scroll.
// Each tab has a short pitch, three points and a small picture drawn in code.
import { useEffect, useRef, useState } from "react";
import RegularStar from "@/components/RegularStar";

const TABS = [
  {
    key: "regulars",
    label: "Regulars first",
    title: "Your best clients never fight for a spot.",
    text: "The clients who keep your book full get first pick of your time. Everyone else books what's left.",
    points: [
      "Mark any opening “Regulars only”; nobody else sees it.",
      "New openings go to regulars first.",
      "Book full? Switch the whole page to regulars-only in one tap.",
    ],
    visual: "times",
  },
  {
    key: "waitlist",
    label: "Smart waitlist",
    title: "Cancellations fill themselves.",
    text: "Clients pick the days and times they want. When a time opens, the waitlist is emailed straight away, and regulars hear first.",
    points: [
      "First to claim the time gets it.",
      "Deposits still apply to waitlist bookings.",
      "No more texting your list one by one.",
    ],
    visual: "waitlist",
  },
  {
    key: "deposits",
    label: "Deposits",
    title: "Deposits up front, paid to you.",
    text: "Set a dollar amount or a percent for each service. Clients pay before the time is theirs, straight into your own Stripe account.",
    points: [
      "A cancellation policy clients agree to before paying.",
      "Late cancel? Keep the deposit, or refund it in one tap.",
      "Apple Pay and Google Pay on phones that have them.",
    ],
    visual: "deposit",
  },
  {
    key: "wrapup",
    label: "Wrap-ups",
    title: "Close out the day in a minute.",
    text: "One email at the end of the day: mark each visit kept, no-show or someone else came. Balances owed get flagged until they're paid.",
    points: [
      "Notes on every visit, by client or by day.",
      "No-shows and balances show on the client's history.",
      "Monday summary of last week's numbers.",
    ],
    visual: "wrapup",
  },
  {
    key: "assistant",
    label: "Assistant",
    title: "Run your book in plain words.",
    text: "Ask “Who's booked tomorrow?” or say “Block off Friday afternoon”. The Assistant reads your schedule and makes the change after you confirm.",
    points: [
      "Answers about bookings, openings, events and holidays.",
      "Adds events, blocks days off, cancels a booking.",
      "Nothing changes until you tap Confirm.",
    ],
    visual: "assistant",
  },
  {
    key: "standing",
    label: "Standing appointments",
    title: "Their usual time, held for them.",
    text: "Set a regular's every-4-weeks Tuesday once. Their visits are held three months ahead and keep rolling forward.",
    points: [
      "Every 2 to 12 weeks, on their usual day and time.",
      "Skip or move one date without touching the rest.",
      "Skips your days off and closed holidays.",
    ],
    visual: "standing",
  },
  {
    key: "page",
    label: "Your booking page",
    title: "A booking page that looks like you.",
    text: "Your name over your own cover photo, your portfolio, Instagram and location. No marketplace, no other pros on the page, no app for clients to download.",
    points: [
      "Clients book, move or cancel from one link.",
      "Intake forms and waivers for new clients.",
      "Confirmations and reminders sent for you.",
    ],
    visual: "page",
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
          <p className="hm-fx-label">Silk press · Thu 10:30 AM</p>
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
